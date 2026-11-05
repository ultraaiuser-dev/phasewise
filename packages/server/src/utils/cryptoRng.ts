import crypto from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@phasewise/shared';

/**
 * Returns a cryptographically secure random float in [0, 1) using crypto.randomInt
 */
export function getCryptoRng(): () => number {
  return () => crypto.randomInt(0, 1000000000) / 1000000000;
}

/**
 * Generates an unambiguous random room code (no 0, O, 1, I, L)
 */
export function generateRoomCode(): string {
  let result = '';
  const alphabetLen = ROOM_CODE_ALPHABET.length;
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = crypto.randomInt(0, alphabetLen);
    result += ROOM_CODE_ALPHABET[idx];
  }
  return result;
}

/**
 * Generates a random session token
 */
export function generateSessionToken(): string {
  return crypto.randomUUID();
}
