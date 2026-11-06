import { z } from 'zod';
import { EMOJI_REACTIONS } from '../config.js';
import { CARD_COLORS } from './cards.js';
import { ClientGameState } from './game.js';

export const GameSettingsSchema = z.object({
  shortGame: z.boolean(),
  turnTimerSeconds: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(90)])
});

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1).max(10).trim().toUpperCase(),
  playerName: z.string().min(1).max(16).trim(),
  sessionToken: z.string().optional()
});

export const UpdateSettingsSchema = z.object({
  settings: GameSettingsSchema
});

export const KickPlayerSchema = z.object({
  targetPlayerId: z.string().min(1)
});

export const RemoveAwayPlayerSchema = z.object({
  targetPlayerId: z.string().min(1)
});

export const MeldCardIntentSchema = z.object({
  cardId: z.string().min(1),
  representedValue: z.number().int().min(1).max(12).optional(),
  representedColor: z.enum(['red', 'blue', 'green', 'yellow']).optional()
});

export const LayDownPhaseMeldIntentSchema = z.object({
  type: z.enum(['set', 'run', 'color_group']),
  cards: z.array(MeldCardIntentSchema).min(2)
});

export const LayDownPhaseIntentSchema = z.object({
  melds: z.array(LayDownPhaseMeldIntentSchema).min(1)
});

export const HitMeldIntentSchema = z.object({
  meldId: z.string().min(1),
  cardId: z.string().min(1),
  representedValue: z.number().int().min(1).max(12).optional(),
  representedColor: z.enum(['red', 'blue', 'green', 'yellow']).optional()
});

export const DiscardIntentSchema = z.object({
  cardId: z.string().min(1),
  skipTargetPlayerId: z.string().optional()
});

export const SendReactionSchema = z.object({
  emoji: z.enum(EMOJI_REACTIONS)
});

export const RequestResyncSchema = z.object({
  lastSeenVersion: z.number().int().nonnegative()
});

export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type UpdateSettingsPayload = z.infer<typeof UpdateSettingsSchema>;
export type KickPlayerPayload = z.infer<typeof KickPlayerSchema>;
export type RemoveAwayPlayerPayload = z.infer<typeof RemoveAwayPlayerSchema>;
export type LayDownPhasePayload = z.infer<typeof LayDownPhaseIntentSchema>;
export type HitMeldPayload = z.infer<typeof HitMeldIntentSchema>;
export type DiscardPayload = z.infer<typeof DiscardIntentSchema>;
export type SendReactionPayload = z.infer<typeof SendReactionSchema>;
export type RequestResyncPayload = z.infer<typeof RequestResyncSchema>;

export interface ServerToClientEvents {
  INIT_SESSION: (payload: { sessionToken: string; playerId: string; roomId: string }) => void;
  STATE_UPDATE: (payload: { state: ClientGameState }) => void;
  ACTION_ERROR: (payload: { code: string; message: string }) => void;
  PLAYER_REACTION: (payload: { playerId: string; emoji: string; timestamp: number }) => void;
  ROOM_NOT_FOUND: (payload: { message: string }) => void;
  LATE_JOIN_REJECTED: (payload: { message: string }) => void;
  KICKED: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  JOIN_ROOM: (payload: JoinRoomPayload, ack?: (response: { success: boolean; error?: string }) => void) => void;
  UPDATE_SETTINGS: (payload: UpdateSettingsPayload) => void;
  START_GAME: () => void;
  START_NEXT_ROUND: () => void;
  KICK_PLAYER: (payload: KickPlayerPayload) => void;
  REMOVE_AWAY_PLAYER: (payload: RemoveAwayPlayerPayload) => void;
  DRAW_DECK: () => void;
  DRAW_DISCARD: () => void;
  LAY_DOWN_PHASE: (payload: LayDownPhasePayload) => void;
  HIT_MELD: (payload: HitMeldPayload) => void;
  DISCARD: (payload: DiscardPayload) => void;
  SEND_REACTION: (payload: SendReactionPayload) => void;
  REQUEST_RESYNC: (payload: RequestResyncPayload) => void;
}
