import http from 'node:http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  DiscardIntentSchema,
  GameSettingsSchema,
  HitMeldIntentSchema,
  JoinRoomSchema,
  KickPlayerSchema,
  LayDownPhaseIntentSchema,
  RemoveAwayPlayerSchema,
  RequestResyncSchema,
  SendReactionSchema,
  ServerToClientEvents,
  UpdateSettingsSchema,
  ROOM_CLEANUP_INTERVAL_MS
} from '@phasewise/shared';
import { MemoryRoomStore } from './store/MemoryRoomStore.js';
import { RoomManager } from './services/RoomManager.js';

export function createServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '*';
  const allowedOrigins = allowedOriginsEnv === '*' ? '*' : allowedOriginsEnv.split(',').map(s => s.trim());

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true
    })
  );
  app.use(express.json());

  // Health check endpoint (used by hosting platforms like Render, fly, etc.)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now()
    });
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const roomStore = new MemoryRoomStore();
  const roomManager = new RoomManager(roomStore, io);

  // Invite preview deliberately exposes names only, never hands or session tokens.
  app.get('/api/rooms/:code/preview', async (req: Request, res: Response) => {
    const code = String(req.params.code).toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { res.status(400).json({error:'Invalid room code'}); return; }
    const room = await roomStore.get(code);
    if (!room) { res.status(404).json({error:'Room not found'}); return; }
    res.json({roomId:code, status:room.state.status, players:room.state.players.map(p=>({name:p.name,isAway:p.isAway}))});
  });

  // REST endpoint to create a room
  app.post('/api/rooms', async (req: Request, res: Response) => {
    const hostName = req.body?.hostName || 'Host';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const createRes = await roomManager.createRoom(hostName, clientIp);
    if (!createRes.success) {
      res.status(400).json({ error: createRes.error });
      return;
    }
    res.status(200).json({
      roomId: createRes.roomId,
      sessionToken: createRes.sessionToken,
      playerId: createRes.playerId
    });
  });

  // Periodic cleanup of idle rooms (> 30 min)
  const cleanupInterval = setInterval(() => {
    roomManager.runIdleCleanup().catch(err => {
      console.error('Idle cleanup error:', err);
    });
  }, ROOM_CLEANUP_INTERVAL_MS);

  // Keep reference for clean shutdown in tests
  httpServer.on('close', () => {
    clearInterval(cleanupInterval);
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress || 'unknown';
    let currentRoomId: string | undefined;
    let currentPlayerId: string | undefined;

    // 1. JOIN_ROOM intent
    socket.on('JOIN_ROOM', async (payload, ack) => {
      const parsed = JoinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ success: false, error: 'Invalid join request payload.' });
        socket.emit('ACTION_ERROR', { code: 'INVALID_PAYLOAD', message: 'Invalid join parameters.' });
        return;
      }

      const { roomId, playerName, sessionToken } = parsed.data;
      const res = await roomManager.joinRoom(roomId, playerName, sessionToken, socket, clientIp);

      if (!res.success) {
        ack?.({ success: false, error: res.error });
        if (res.error?.includes('started')) {
          socket.emit('LATE_JOIN_REJECTED', { message: res.error });
        } else if (res.error?.includes('not found')) {
          socket.emit('ROOM_NOT_FOUND', { message: res.error });
        } else {
          socket.emit('ACTION_ERROR', { code: 'JOIN_FAILED', message: res.error || 'Failed to join room.' });
        }
        return;
      }

      currentRoomId = roomId;
      currentPlayerId = res.playerId;

      socket.emit('INIT_SESSION', {
        roomId,
        playerId: res.playerId!,
        sessionToken: res.sessionToken!
      });

      ack?.({ success: true });
    });

    // 2. UPDATE_SETTINGS intent
    socket.on('UPDATE_SETTINGS', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = UpdateSettingsSchema.safeParse(payload);
      if (!parsed.success) return;

      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'UPDATE_SETTINGS',
        settings: parsed.data.settings
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'UPDATE_SETTINGS_FAILED', message: res.error || 'Failed' });
      }
    });

    // 3. START_GAME intent
    socket.on('START_GAME', async () => {
      if (!currentRoomId || !currentPlayerId) return;
      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'START_GAME'
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'START_GAME_FAILED', message: res.error || 'Failed' });
      }
    });

    // 4. KICK_PLAYER intent
    socket.on('KICK_PLAYER', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = KickPlayerSchema.safeParse(payload);
      if (!parsed.success) return;

      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'REMOVE_AWAY_PLAYER',
        targetPlayerId: parsed.data.targetPlayerId
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'KICK_FAILED', message: res.error || 'Failed' });
      }
    });

    // 5. REMOVE_AWAY_PLAYER intent
    socket.on('REMOVE_AWAY_PLAYER', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = RemoveAwayPlayerSchema.safeParse(payload);
      if (!parsed.success) return;

      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'REMOVE_AWAY_PLAYER',
        targetPlayerId: parsed.data.targetPlayerId
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'REMOVE_FAILED', message: res.error || 'Failed' });
      }
    });

    // 6. DRAW_DECK intent
    socket.on('DRAW_DECK', async () => {
      if (!currentRoomId || !currentPlayerId) return;
      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'DRAW_DECK'
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'DRAW_FAILED', message: res.error || 'Failed' });
      }
    });

    // 7. DRAW_DISCARD intent
    socket.on('DRAW_DISCARD', async () => {
      if (!currentRoomId || !currentPlayerId) return;
      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'DRAW_DISCARD'
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'DRAW_DISCARD_FAILED', message: res.error || 'Failed' });
      }
    });

    // 8. LAY_DOWN_PHASE intent
    socket.on('LAY_DOWN_PHASE', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = LayDownPhaseIntentSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('ACTION_ERROR', { code: 'INVALID_PAYLOAD', message: 'Invalid meld structure.' });
        return;
      }

      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'LAY_DOWN_PHASE',
        melds: parsed.data.melds
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'LAY_DOWN_FAILED', message: res.error || 'Failed' });
      }
    });

    // 9. HIT_MELD intent
    socket.on('HIT_MELD', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = HitMeldIntentSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('ACTION_ERROR', { code: 'INVALID_PAYLOAD', message: 'Invalid hit parameters.' });
        return;
      }

      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'HIT_MELD',
        meldId: parsed.data.meldId,
        cardId: parsed.data.cardId,
        representedValue: parsed.data.representedValue,
        representedColor: parsed.data.representedColor
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'HIT_FAILED', message: res.error || 'Failed' });
      }
    });

    // 10. DISCARD intent
    socket.on('DISCARD', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = DiscardIntentSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('ACTION_ERROR', { code: 'INVALID_PAYLOAD', message: 'Invalid discard parameters.' });
        return;
      }

      const res = await roomManager.applyGameAction(currentRoomId, currentPlayerId, {
        type: 'DISCARD',
        cardId: parsed.data.cardId,
        skipTargetPlayerId: parsed.data.skipTargetPlayerId
      });
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'DISCARD_FAILED', message: res.error || 'Failed' });
      }
    });

    // 11. SEND_REACTION intent
    socket.on('SEND_REACTION', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = SendReactionSchema.safeParse(payload);
      if (!parsed.success) return;

      const res = await roomManager.sendReaction(currentRoomId, currentPlayerId, parsed.data.emoji);
      if (!res.success) {
        socket.emit('ACTION_ERROR', { code: 'REACTION_FAILED', message: res.error || 'Failed' });
      }
    });

    // 12. REQUEST_RESYNC intent
    socket.on('REQUEST_RESYNC', async payload => {
      if (!currentRoomId || !currentPlayerId) return;
      const parsed = RequestResyncSchema.safeParse(payload);
      if (!parsed.success) return;

      await roomManager.resyncSocket(currentRoomId, socket, currentPlayerId);
    });

    // Disconnect event
    socket.on('disconnect', async () => {
      await roomManager.handleDisconnect(socket.id);
    });
  });

  return { app, httpServer, io, roomManager, roomStore };
}
