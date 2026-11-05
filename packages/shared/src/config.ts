/**
 * Working title and core configuration constants.
 * Easy to rename: GAME_TITLE is defined in one single place.
 */
export const GAME_TITLE = 'Phasewise';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Unambiguous: no 0, O, 1, I, L
export const ROOM_CODE_LENGTH = 5;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const HAND_SIZE = 10;
export const TOTAL_CARDS = 108;

export const DEFAULT_PORT = 3001;
export const DEFAULT_CLIENT_PORT = 5173;

export const IDLE_ROOM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
export const DEFAULT_DISCONNECT_AUTO_PLAY_MS = 60 * 1000; // 60 seconds if no timer set

export const EMOJI_REACTIONS = ['👍', '🎉', '🔥', '😱', '🤔', '👋', '💔', '😎'] as const;
export type EmojiReaction = (typeof EMOJI_REACTIONS)[number];
export const REACTION_COOLDOWN_MS = 3000;
