import { Server, Socket } from 'socket.io';
import {
  applyAction,
  createInitialState,
  DEFAULT_DISCONNECT_AUTO_PLAY_MS,
  GameAction,
  GameState,
  IDLE_ROOM_TIMEOUT_MS,
  MAX_PLAYERS,
  Player,
  projectStateForPlayer,
  ServerToClientEvents,
  ClientToServerEvents,
  EmojiReaction,
  REACTION_COOLDOWN_MS
} from '@phasewise/shared';
import { IRoomStore, RoomData } from '../store/IRoomStore.js';
import { generateRoomCode, generateSessionToken, getCryptoRng } from '../utils/cryptoRng.js';
import { sanitizePlayerName, SimpleRateLimiter } from '../utils/security.js';

export class RoomManager {
  private turnTimers = new Map<string, NodeJS.Timeout>();
  private reactionCooldowns = new Map<string, number>();
  private socketToPlayer = new Map<string, { roomId: string; playerId: string; sessionToken: string }>();

  // Rate limiters: 10 room creates / min, 30 joins / min
  private createLimiter = new SimpleRateLimiter(10, 60 * 1000);
  private joinLimiter = new SimpleRateLimiter(30, 60 * 1000);

  constructor(
    private store: IRoomStore,
    private io: Server<ClientToServerEvents, ServerToClientEvents>
  ) {}

  async createRoom(
    hostName: string,
    clientIp: string
  ): Promise<{ success: boolean; error?: string; roomId?: string; sessionToken?: string; playerId?: string }> {
    if (!this.createLimiter.isAllowed(clientIp)) {
      return { success: false, error: 'Rate limit exceeded: too many rooms created. Please wait a minute.' };
    }

    const cleanName = sanitizePlayerName(hostName);
    const roomId = generateRoomCode();
    const playerId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sessionToken = generateSessionToken();

    const initialState = createInitialState(roomId, { id: playerId, name: cleanName });

    const roomData: RoomData = {
      roomId,
      state: initialState,
      sessions: {
        [sessionToken]: {
          playerId,
          sessionToken,
          lastSeen: Date.now()
        }
      },
      lastActivity: Date.now()
    };

    await this.store.set(roomId, roomData);
    return { success: true, roomId, sessionToken, playerId };
  }

  async joinRoom(
    roomId: string,
    playerName: string,
    sessionToken: string | undefined,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    clientIp: string
  ): Promise<{ success: boolean; error?: string; playerId?: string; sessionToken?: string }> {
    if (!this.joinLimiter.isAllowed(clientIp)) {
      return { success: false, error: 'Too many join attempts. Please slow down.' };
    }

    const room = await this.store.get(roomId);
    if (!room) {
      return { success: false, error: `Room ${roomId} not found.` };
    }

    const cleanName = sanitizePlayerName(playerName);

    // 1. Check for reconnection via sessionToken
    if (sessionToken && room.sessions[sessionToken]) {
      const existingSession = room.sessions[sessionToken];
      const player = room.state.players.find(p => p.id === existingSession.playerId);

      if (player) {
        // Restore seat
        player.isAway = false;
        existingSession.socketId = socket.id;
        existingSession.lastSeen = Date.now();
        room.lastActivity = Date.now();

        socket.join(roomId);
        this.socketToPlayer.set(socket.id, {
          roomId,
          playerId: player.id,
          sessionToken
        });

        await this.store.set(roomId, room);
        this.broadcastState(room);

        // If turn timer was waiting on this away player, we can let them play
        return {
          success: true,
          playerId: player.id,
          sessionToken
        };
      }
    }

    // 2. Reject late joiners if game has already started
    if (room.state.status !== 'lobby') {
      return {
        success: false,
        error: 'Game has already started. Late joining is not allowed.'
      };
    }

    // 3. Check player limit (max 6 players)
    if (room.state.players.length >= MAX_PLAYERS) {
      return {
        success: false,
        error: `Room is full (maximum ${MAX_PLAYERS} players).`
      };
    }

    // 4. Check socket limit for room (max 6 active sockets)
    const activeSockets = await this.io.in(roomId).fetchSockets();
    if (activeSockets.length >= MAX_PLAYERS) {
      return {
        success: false,
        error: `Room has reached the maximum number of connected players (${MAX_PLAYERS}).`
      };
    }

    // 5. New player joining
    const newPlayerId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSessionToken = generateSessionToken();

    const newPlayer: Player = {
      id: newPlayerId,
      name: cleanName,
      seatIndex: room.state.players.length,
      phase: 1,
      phaseCompletedThisRound: false,
      hasLaidDownPhase: false,
      score: 0,
      roundScore: 0,
      hand: [],
      isAway: false,
      isHost: false,
      skipTurns: 0
    };

    room.state.players.push(newPlayer);
    room.state.version += 1;
    room.sessions[newSessionToken] = {
      playerId: newPlayerId,
      sessionToken: newSessionToken,
      socketId: socket.id,
      lastSeen: Date.now()
    };
    room.lastActivity = Date.now();

    socket.join(roomId);
    this.socketToPlayer.set(socket.id, {
      roomId,
      playerId: newPlayerId,
      sessionToken: newSessionToken
    });

    await this.store.set(roomId, room);
    this.broadcastState(room);

    return {
      success: true,
      playerId: newPlayerId,
      sessionToken: newSessionToken
    };
  }

  async handleDisconnect(socketId: string): Promise<void> {
    const mapping = this.socketToPlayer.get(socketId);
    if (!mapping) return;

    this.socketToPlayer.delete(socketId);
    const { roomId, playerId } = mapping;

    const room = await this.store.get(roomId);
    if (!room) return;

    const player = room.state.players.find(p => p.id === playerId);
    if (!player) return;

    player.isAway = true;
    room.lastActivity = Date.now();

    // If host leaves in lobby, transfer host to next active player
    if (player.isHost) {
      const nextActive = room.state.players.find(p => p.id !== playerId && !p.isAway);
      if (nextActive) {
        player.isHost = false;
        nextActive.isHost = true;
      }
    }

    await this.store.set(roomId, room);
    this.broadcastState(room);

    // If it's this away player's turn in an active game, schedule turn auto-play
    if (room.state.status === 'playing' && room.state.currentTurnPlayerId === playerId) {
      this.scheduleTurnTimer(room);
    }
  }

  async applyGameAction(
    roomId: string,
    playerId: string,
    action: GameAction
  ): Promise<{ success: boolean; error?: string }> {
    const room = await this.store.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found.' };
    }

    const previousTurnPlayerId = room.state.currentTurnPlayerId;
    const previousRound = room.state.roundNumber;

    const res = applyAction(room.state, playerId, action, getCryptoRng());
    if ('error' in res) {
      return { success: false, error: res.error.message };
    }

    room.state = res.state;
    room.lastActivity = Date.now();

    // Clear existing turn timer if turn advanced or round ended
    if (
      room.state.currentTurnPlayerId !== previousTurnPlayerId ||
      room.state.roundNumber !== previousRound ||
      room.state.status !== 'playing'
    ) {
      this.clearTurnTimer(roomId);
    }

    // Schedule turn timer for new turn if needed
    if (room.state.status === 'playing') {
      this.scheduleTurnTimer(room);
    }

    await this.store.set(roomId, room);
    this.broadcastState(room);

    return { success: true };
  }

  async sendReaction(
    roomId: string,
    playerId: string,
    emoji: EmojiReaction
  ): Promise<{ success: boolean; error?: string }> {
    const now = Date.now();
    const lastReaction = this.reactionCooldowns.get(playerId) || 0;
    if (now - lastReaction < REACTION_COOLDOWN_MS) {
      return { success: false, error: 'Reaction cooldown in effect. Please wait a moment.' };
    }

    this.reactionCooldowns.set(playerId, now);
    this.io.to(roomId).emit('PLAYER_REACTION', {
      playerId,
      emoji,
      timestamp: now
    });

    return { success: true };
  }

  private scheduleTurnTimer(room: RoomData): void {
    this.clearTurnTimer(room.roomId);

    const activePlayer = room.state.players.find(p => p.id === room.state.currentTurnPlayerId);
    if (!activePlayer) return;

    let delayMs = 0;
    if (room.state.settings.turnTimerSeconds > 0) {
      delayMs = room.state.settings.turnTimerSeconds * 1000;
    } else if (activePlayer.isAway) {
      delayMs = DEFAULT_DISCONNECT_AUTO_PLAY_MS; // 60 seconds
    }

    if (delayMs > 0) {
      const timer = setTimeout(async () => {
        const curRoom = await this.store.get(room.roomId);
        if (
          curRoom &&
          curRoom.state.status === 'playing' &&
          curRoom.state.currentTurnPlayerId === activePlayer.id
        ) {
          // Auto-play safe turn
          await this.applyGameAction(room.roomId, activePlayer.id, { type: 'AUTO_PLAY_TURN' });
        }
      }, delayMs);

      this.turnTimers.set(room.roomId, timer);
    }
  }

  private clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }

  /**
   * Broadcasts state update to all sockets in room with per-player privacy projection.
   */
  broadcastState(room: RoomData): void {
    for (const session of Object.values(room.sessions)) {
      if (session.socketId) {
        const projected = projectStateForPlayer(room.state, session.playerId);
        this.io.to(session.socketId).emit('STATE_UPDATE', { state: projected });
      }
    }
  }

  async resyncSocket(roomId: string, socket: Socket, playerId: string): Promise<void> {
    const room = await this.store.get(roomId);
    if (!room) return;
    const projected = projectStateForPlayer(room.state, playerId);
    socket.emit('STATE_UPDATE', { state: projected });
  }

  async runIdleCleanup(): Promise<void> {
    const now = Date.now();
    const rooms = await this.store.getAll();

    for (const room of rooms) {
      if (now - room.lastActivity > IDLE_ROOM_TIMEOUT_MS) {
        this.clearTurnTimer(room.roomId);
        await this.store.delete(room.roomId);
      }
    }

    this.createLimiter.cleanup();
    this.joinLimiter.cleanup();
  }

  resetLimiters(): void {
    this.createLimiter.reset();
    this.joinLimiter.reset();
  }
}
