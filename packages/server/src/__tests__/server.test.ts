import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createServer } from '../server.js';
import { ClientGameState, ClientToServerEvents, ServerToClientEvents } from '@phasewise/shared';

describe('Server & Socket.IO Integration Tests', () => {
  let serverInstance: ReturnType<typeof createServer>;
  let port: number;
  let serverUrl: string;

  beforeAll(async () => {
    serverInstance = createServer();
    await new Promise<void>(resolve => {
      serverInstance.httpServer.listen(0, () => {
        const addr = serverInstance.httpServer.address() as AddressInfo;
        port = addr.port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      serverInstance.httpServer.close(() => resolve());
    });
  });

  it('GET /health returns 200 with status ok and uptime', async () => {
    const res = await fetch(`${serverUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.uptime).toBeDefined();
  });

  it('creates a room via POST /api/rooms', async () => {
    const res = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'HostPlayer' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.roomId).toHaveLength(5);
    expect(data.sessionToken).toBeDefined();
    expect(data.playerId).toBeDefined();
    const preview = await fetch(`${serverUrl}/api/rooms/${data.roomId}/preview`);
    expect(preview.status).toBe(200);
    const publicRoom = await preview.json();
    expect(publicRoom.players).toEqual([{name:'HostPlayer',isAway:false}]);
    expect(JSON.stringify(publicRoom)).not.toContain(data.sessionToken);
    expect(publicRoom).not.toHaveProperty('drawPile');
  });

  it('socket joins room, receives INIT_SESSION and projected STATE_UPDATE with hand privacy', async () => {
    // 1. Create room
    const createRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'Alice' })
    });
    const { roomId, sessionToken: hostToken } = await createRes.json();

    // 2. Connect client 1 (Alice)
    const client1: ClientSocketType<ServerToClientEvents, ClientToServerEvents> = ClientSocket(serverUrl, {
      transports: ['websocket']
    });

    const initPromise = new Promise<{ sessionToken: string; playerId: string }>(resolve => {
      client1.on('INIT_SESSION', resolve);
    });

    const statePromise1 = new Promise<{ state: ClientGameState }>(resolve => {
      client1.on('STATE_UPDATE', resolve);
    });

    client1.emit('JOIN_ROOM', { roomId, playerName: 'Alice', sessionToken: hostToken });
    const init1 = await initPromise;
    expect(init1.sessionToken).toBe(hostToken);

    const update1 = await statePromise1;
    expect(update1.state.roomId).toBe(roomId);
    expect(update1.state.players).toHaveLength(1);
    expect(update1.state.players[0].name).toBe('Alice');
    expect(update1.state.players[0].isHost).toBe(true);

    // 3. Connect client 2 (Bob)
    const client2: ClientSocketType<ServerToClientEvents, ClientToServerEvents> = ClientSocket(serverUrl, {
      transports: ['websocket']
    });

    const statePromise2 = new Promise<{ state: ClientGameState }>(resolve => {
      client2.on('STATE_UPDATE', resolve);
    });

    client2.emit('JOIN_ROOM', { roomId, playerName: 'Bob' });
    const update2 = await statePromise2;

    expect(update2.state.players).toHaveLength(2);
    expect(update2.state.players.some(p => p.name === 'Bob')).toBe(true);

    // 4. Start game
    client1.emit('START_GAME');

    const playingStatePromise1 = new Promise<{ state: ClientGameState }>(resolve => {
      client1.once('STATE_UPDATE', resolve);
    });
    const playingStatePromise2 = new Promise<{ state: ClientGameState }>(resolve => {
      client2.once('STATE_UPDATE', resolve);
    });

    const [playingState1, playingState2] = await Promise.all([
      playingStatePromise1,
      playingStatePromise2
    ]);

    expect(playingState1.state.status).toBe('playing');
    expect(playingState2.state.status).toBe('playing');

    // VERIFY HAND PRIVACY:
    // Client 1 sees its own hand, but sees Bob's hand as undefined!
    expect(playingState1.state.myHand).toHaveLength(10);
    const bobInViewOfAlice = playingState1.state.players.find(p => p.name === 'Bob')!;
    expect(bobInViewOfAlice.hand).toBeUndefined();
    expect(bobInViewOfAlice.cardCount).toBe(10);

    // Client 2 sees its own hand, but sees Alice's hand as undefined!
    expect(playingState2.state.myHand).toHaveLength(10);
    const aliceInViewOfBob = playingState2.state.players.find(p => p.name === 'Alice')!;
    expect(aliceInViewOfBob.hand).toBeUndefined();
    expect(aliceInViewOfBob.cardCount).toBe(10);

    // Neither client receives draw pile array!
    expect((playingState1.state as any).drawPile).toBeUndefined();
    expect((playingState2.state as any).drawPile).toBeUndefined();
    expect(playingState1.state.drawPileCount).toBeGreaterThan(0);

    client1.disconnect();
    client2.disconnect();
  });

  it('reconnecting with session token restores player seat and hand', async () => {
    // 1. Create room
    const createRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'HostR' })
    });
    const { roomId, sessionToken, playerId } = await createRes.json();

    // 2. Connect socket 1
    const socket1 = ClientSocket(serverUrl, { transports: ['websocket'] });
    await new Promise<void>(resolve => {
      socket1.emit('JOIN_ROOM', { roomId, playerName: 'HostR', sessionToken }, () => resolve());
    });

    // Disconnect socket 1
    socket1.disconnect();
    await new Promise(r => setTimeout(r, 50));

    // 3. Connect socket 2 with same sessionToken (simulating page refresh)
    const socket2 = ClientSocket(serverUrl, { transports: ['websocket'] });
    const restorePromise = new Promise<{ state: ClientGameState }>(resolve => {
      socket2.on('STATE_UPDATE', resolve);
    });

    socket2.emit('JOIN_ROOM', { roomId, playerName: 'HostR', sessionToken });
    const restored = await restorePromise;

    expect(restored.state.myPlayerId).toBe(playerId);
    const me = restored.state.players.find(p => p.id === playerId)!;
    expect(me.isAway).toBe(false);
    expect(me.isHost).toBe(true);

    socket2.disconnect();
  });

  it('host transfer: when host leaves in lobby, next active player becomes host', async () => {
    const createRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'OriginalHost' })
    });
    const { roomId, sessionToken: hostToken } = await createRes.json();

    const hostSocket = ClientSocket(serverUrl, { transports: ['websocket'] });
    await new Promise<void>(resolve => {
      hostSocket.emit('JOIN_ROOM', { roomId, playerName: 'OriginalHost', sessionToken: hostToken }, () => resolve());
    });

    const player2Socket = ClientSocket(serverUrl, { transports: ['websocket'] });
    await new Promise<void>(resolve => {
      player2Socket.emit('JOIN_ROOM', { roomId, playerName: 'SecondPlayer' }, () => resolve());
    });

    // Wait for state update where SecondPlayer becomes host after Host disconnects
    const hostTransferPromise = new Promise<{ state: ClientGameState }>(resolve => {
      player2Socket.on('STATE_UPDATE', data => {
        const p2 = data.state.players.find((p: { name: string; isHost: boolean }) => p.name === 'SecondPlayer');
        if (p2?.isHost) {
          resolve(data);
        }
      });
    });

    hostSocket.disconnect();
    const updated = await hostTransferPromise;
    const p2 = updated.state.players.find(p => p.name === 'SecondPlayer')!;
    expect(p2.isHost).toBe(true);

    player2Socket.disconnect();
  });

  it('rejects late joiners once game starts', async () => {
    const createRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'H1' })
    });
    const { roomId, sessionToken } = await createRes.json();

    const s1 = ClientSocket(serverUrl, { transports: ['websocket'] });
    const s2 = ClientSocket(serverUrl, { transports: ['websocket'] });

    await new Promise<void>(r => s1.emit('JOIN_ROOM', { roomId, playerName: 'H1', sessionToken }, () => r()));
    await new Promise<void>(r => s2.emit('JOIN_ROOM', { roomId, playerName: 'H2' }, () => r()));

    // Start game
    s1.emit('START_GAME');
    await new Promise(r => setTimeout(r, 100));

    // Try joining as a 3rd new player
    const s3 = ClientSocket(serverUrl, { transports: ['websocket'] });
    const lateJoinPromise = new Promise<{ message: string }>(resolve => {
      s3.on('LATE_JOIN_REJECTED', resolve);
    });

    s3.emit('JOIN_ROOM', { roomId, playerName: 'LateComer' });
    const rejected = await lateJoinPromise;
    expect(rejected.message).toContain('started');

    s1.disconnect();
    s2.disconnect();
    s3.disconnect();
  });

  it('rate limiting rejects excess room creation attempts from same IP', async () => {
    // Attempt 15 rapid room creates (limit is 10/min)
    let rejectedCount = 0;
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${serverUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: `Spammer${i}` })
      });
      if (res.status === 400) {
        rejectedCount++;
      }
    }
    expect(rejectedCount).toBeGreaterThan(0);
    // Reset limiters so subsequent tests aren't blocked
    serverInstance.roomManager.resetLimiters();
  });

  it('turn-timer auto-play triggers when turn timer expires on away player', async () => {
    const createRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'TimerHost' })
    });
    const { roomId, sessionToken: hostToken } = await createRes.json();

    const s1 = ClientSocket(serverUrl, { transports: ['websocket'] });
    const s2 = ClientSocket(serverUrl, { transports: ['websocket'] });

    await new Promise<void>(r => {
      s1.emit('JOIN_ROOM', { roomId, playerName: 'TimerHost', sessionToken: hostToken }, () => r());
    });
    await new Promise<void>(r => {
      s2.emit('JOIN_ROOM', { roomId, playerName: 'P2' }, () => r());
    });

    // Start game
    const startPromise = new Promise<void>(resolve => {
      s2.on('STATE_UPDATE', update => {
        if (update.state.status === 'playing') {
          resolve();
        }
      });
    });

    s1.emit('START_GAME');
    await startPromise;

    // Verify cleanup
    await serverInstance.roomManager.runIdleCleanup();

    s1.disconnect();
    s2.disconnect();
  });
});
