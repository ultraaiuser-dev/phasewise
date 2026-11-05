import { GameState } from '@phasewise/shared';

export interface RoomSession {
  playerId: string;
  sessionToken: string;
  socketId?: string;
  lastSeen: number;
}

export interface RoomData {
  roomId: string;
  state: GameState;
  sessions: Record<string, RoomSession>; // sessionToken -> RoomSession
  lastActivity: number;
}

export interface IRoomStore {
  get(roomId: string): Promise<RoomData | undefined>;
  set(roomId: string, data: RoomData): Promise<void>;
  delete(roomId: string): Promise<void>;
  getAll(): Promise<RoomData[]>;
}
