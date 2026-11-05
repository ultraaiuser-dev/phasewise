import { IRoomStore, RoomData } from './IRoomStore.js';

export class MemoryRoomStore implements IRoomStore {
  private rooms = new Map<string, RoomData>();

  async get(roomId: string): Promise<RoomData | undefined> {
    return this.rooms.get(roomId);
  }

  async set(roomId: string, data: RoomData): Promise<void> {
    this.rooms.set(roomId, data);
  }

  async delete(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }

  async getAll(): Promise<RoomData[]> {
    return Array.from(this.rooms.values());
  }
}
