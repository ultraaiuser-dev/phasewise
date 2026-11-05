import { Card, CardColor, CARD_COLORS } from '../types/cards.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];

  // 96 number cards: 1-12 in 4 colors, 2 copies each
  for (const color of CARD_COLORS) {
    for (let value = 1; value <= 12; value++) {
      deck.push({
        id: `${color}-${value}-1`,
        type: 'number',
        color,
        value
      });
      deck.push({
        id: `${color}-${value}-2`,
        type: 'number',
        color,
        value
      });
    }
  }

  // 8 Wild cards
  for (let i = 1; i <= 8; i++) {
    deck.push({
      id: `wild-${i}`,
      type: 'wild'
    });
  }

  // 4 Skip cards
  for (let i = 1; i <= 4; i++) {
    deck.push({
      id: `skip-${i}`,
      type: 'skip'
    });
  }

  return deck;
}

/**
 * In-place or copy Fisher-Yates shuffle.
 * Uses an optional random number generator fn returning [0, 1).
 */
export function shuffleDeck<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
