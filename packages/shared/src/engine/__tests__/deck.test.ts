import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createDeck, shuffleDeck } from '../deck.js';
import { CARD_COLORS } from '../../types/cards.js';
import { TOTAL_CARDS } from '../../config.js';

describe('Deck composition & shuffling', () => {
  it('creates exactly 108 cards with correct distribution', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(TOTAL_CARDS);

    // 8 Wilds
    const wilds = deck.filter(c => c.type === 'wild');
    expect(wilds).toHaveLength(8);

    // 4 Skips
    const skips = deck.filter(c => c.type === 'skip');
    expect(skips).toHaveLength(4);

    // 96 numbers (1-12 in 4 colors, 2 of each)
    const numbers = deck.filter(c => c.type === 'number');
    expect(numbers).toHaveLength(96);

    for (const color of CARD_COLORS) {
      for (let v = 1; v <= 12; v++) {
        const matches = numbers.filter(c => c.color === color && c.value === v);
        expect(matches).toHaveLength(2);
      }
    }

    // Every card has a unique ID
    const uniqueIds = new Set(deck.map(c => c.id));
    expect(uniqueIds.size).toBe(108);
  });

  it('property test: shuffleDeck preserves card count and unique IDs', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 108 }), (numbers) => {
        const shuffled = shuffleDeck(numbers);
        expect(shuffled).toHaveLength(numbers.length);
        expect(new Set(shuffled)).toEqual(new Set(numbers));
      })
    );
  });

  it('property test: deal never duplicates card IDs and hand sizes + piles always total 108', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (numPlayers) => {
        const deck = shuffleDeck(createDeck());
        const hands: string[][] = Array.from({ length: numPlayers }, () => []);

        let idx = 0;
        for (let round = 0; round < 10; round++) {
          for (let p = 0; p < numPlayers; p++) {
            hands[p].push(deck[idx++].id);
          }
        }

        const discardPile = [deck[idx++].id];
        const drawPile = deck.slice(idx).map(c => c.id);

        const allCardIds = [
          ...hands.flat(),
          ...discardPile,
          ...drawPile
        ];

        // Total count must be 108
        expect(allCardIds).toHaveLength(108);
        // No duplicates
        expect(new Set(allCardIds).size).toBe(108);
      })
    );
  });
});
