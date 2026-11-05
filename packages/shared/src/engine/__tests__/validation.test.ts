import { describe, it, expect } from 'vitest';
import {
  validateSet,
  validateRun,
  validateColorGroup,
  validatePhaseMelds,
  validateHit
} from '../validation.js';
import { Card, Meld } from '../../types/cards.js';

describe('Meld validation', () => {
  describe('Set validation', () => {
    it('validates a valid natural set', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 7 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 7 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 7 } }
      ];
      const res = validateSet(cards, 3);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.targetNumber).toBe(7);
        expect(res.meld.cards).toHaveLength(3);
      }
    });

    it('validates a set with wild cards', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 5 } },
        { card: { id: 'c2', type: 'wild' } },
        { card: { id: 'c3', type: 'number', color: 'yellow', value: 5 } }
      ];
      const res = validateSet(cards, 3);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.targetNumber).toBe(5);
        expect(res.meld.cards[1].representedValue).toBe(5);
      }
    });

    it('rejects a set with no natural cards', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'w1', type: 'wild' } },
        { card: { id: 'w2', type: 'wild' } },
        { card: { id: 'w3', type: 'wild' } }
      ];
      const res = validateSet(cards, 3);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('NO_NATURAL_CARDS');
      }
    });

    it('rejects a set with mismatched numbers', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 5 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 6 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 5 } }
      ];
      const res = validateSet(cards, 3);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('SET_NUMBER_MISMATCH');
      }
    });

    it('rejects a set containing a Skip card', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 5 } },
        { card: { id: 's1', type: 'skip' } },
        { card: { id: 'c2', type: 'number', color: 'green', value: 5 } }
      ];
      const res = validateSet(cards, 3);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('SKIP_NOT_ALLOWED');
      }
    });
  });

  describe('Run validation', () => {
    it('validates a natural run', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 3 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 4 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 5 } },
        { card: { id: 'c4', type: 'number', color: 'yellow', value: 6 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.minRunValue).toBe(3);
        expect(res.meld.maxRunValue).toBe(6);
      }
    });

    it('validates run with Wild at the start', () => {
      const cards: { card: Card; intent?: { representedValue?: number } }[] = [
        { card: { id: 'w1', type: 'wild' }, intent: { representedValue: 3 } },
        { card: { id: 'c1', type: 'number', color: 'red', value: 4 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 5 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 6 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.minRunValue).toBe(3);
        expect(res.meld.maxRunValue).toBe(6);
      }
    });

    it('validates run with Wild in the middle', () => {
      const cards: { card: Card; intent?: { representedValue?: number } }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 4 } },
        { card: { id: 'w1', type: 'wild' }, intent: { representedValue: 5 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 6 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 7 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.minRunValue).toBe(4);
        expect(res.meld.maxRunValue).toBe(7);
      }
    });

    it('validates run with Wild at the end', () => {
      const cards: { card: Card; intent?: { representedValue?: number } }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 4 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 5 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 6 } },
        { card: { id: 'w1', type: 'wild' }, intent: { representedValue: 7 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.minRunValue).toBe(4);
        expect(res.meld.maxRunValue).toBe(7);
      }
    });

    it('rejects a run that would wrap around (12 connecting to 1)', () => {
      const cards: { card: Card; intent?: { representedValue?: number } }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 11 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 12 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 1 } },
        { card: { id: 'c4', type: 'number', color: 'yellow', value: 2 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(['RUN_NOT_CONSECUTIVE', 'RUN_GAP_TOO_WIDE', 'RUN_NO_VALID_RANGE']).toContain(res.error.code);
      }
    });

    it('rejects a run with duplicate numbers', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 4 } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 4 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 5 } },
        { card: { id: 'c4', type: 'number', color: 'yellow', value: 6 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('RUN_DUPLICATE_NUMBER');
      }
    });

    it('rejects a run longer than 12 cards', () => {
      const cards: { card: Card }[] = Array.from({ length: 13 }, (_, i) => ({
        card: { id: `c${i}`, type: 'number', color: 'red', value: (i % 12) + 1 }
      }));
      const res = validateRun(cards);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('RUN_TOO_LONG');
      }
    });

    it('rejects a run containing a Skip card', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 3 } },
        { card: { id: 's1', type: 'skip' } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 5 } },
        { card: { id: 'c3', type: 'number', color: 'green', value: 6 } }
      ];
      const res = validateRun(cards, 4);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('SKIP_NOT_ALLOWED');
      }
    });
  });

  describe('Color group validation', () => {
    it('validates a natural color group', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 1 } },
        { card: { id: 'c2', type: 'number', color: 'red', value: 8 } },
        { card: { id: 'c3', type: 'number', color: 'red', value: 12 } }
      ];
      const res = validateColorGroup(cards, 3);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.targetColor).toBe('red');
      }
    });

    it('validates a color group with Wilds', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'blue', value: 2 } },
        { card: { id: 'w1', type: 'wild' } },
        { card: { id: 'c2', type: 'number', color: 'blue', value: 9 } }
      ];
      const res = validateColorGroup(cards, 3);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.meld.targetColor).toBe('blue');
      }
    });

    it('rejects a color group with mismatched colors', () => {
      const cards: { card: Card }[] = [
        { card: { id: 'c1', type: 'number', color: 'red', value: 2 } },
        { card: { id: 'c2', type: 'number', color: 'green', value: 9 } }
      ];
      const res = validateColorGroup(cards, 2);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.code).toBe('COLOR_MISMATCH');
      }
    });
  });
});

describe('All 10 Phase Validations', () => {
  // Phase 1: 2 sets of 3
  it('Phase 1: validates 2 sets of 3', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 4 },
      { id: '2', type: 'number', color: 'blue', value: 4 },
      { id: '3', type: 'number', color: 'green', value: 4 },
      { id: '4', type: 'number', color: 'red', value: 9 },
      { id: '5', type: 'number', color: 'blue', value: 9 },
      { id: '6', type: 'wild' }
    ];
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }] },
      { type: 'set' as const, cards: [{ cardId: '4' }, { cardId: '5' }, { cardId: '6' }] }
    ];
    const res = validatePhaseMelds(1, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 2: 1 set of 3 + 1 run of 4
  it('Phase 2: validates 1 set of 3 + 1 run of 4', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 5 },
      { id: '2', type: 'number', color: 'blue', value: 5 },
      { id: '3', type: 'number', color: 'green', value: 5 },
      { id: '4', type: 'number', color: 'red', value: 7 },
      { id: '5', type: 'number', color: 'blue', value: 8 },
      { id: '6', type: 'number', color: 'green', value: 9 },
      { id: '7', type: 'number', color: 'yellow', value: 10 }
    ];
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }] },
      { type: 'run' as const, cards: [{ cardId: '4' }, { cardId: '5' }, { cardId: '6' }, { cardId: '7' }] }
    ];
    const res = validatePhaseMelds(2, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 3: 1 set of 4 + 1 run of 4
  it('Phase 3: validates 1 set of 4 + 1 run of 4', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 8 },
      { id: '2', type: 'number', color: 'blue', value: 8 },
      { id: '3', type: 'number', color: 'green', value: 8 },
      { id: '4', type: 'wild' },
      { id: '5', type: 'number', color: 'red', value: 1 },
      { id: '6', type: 'number', color: 'blue', value: 2 },
      { id: '7', type: 'number', color: 'green', value: 3 },
      { id: '8', type: 'number', color: 'yellow', value: 4 }
    ];
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }, { cardId: '4' }] },
      { type: 'run' as const, cards: [{ cardId: '5' }, { cardId: '6' }, { cardId: '7' }, { cardId: '8' }] }
    ];
    const res = validatePhaseMelds(3, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 4: 1 run of 7
  it('Phase 4: validates 1 run of 7', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 2 },
      { id: '2', type: 'number', color: 'blue', value: 3 },
      { id: '3', type: 'number', color: 'green', value: 4 },
      { id: '4', type: 'number', color: 'yellow', value: 5 },
      { id: '5', type: 'number', color: 'red', value: 6 },
      { id: '6', type: 'wild' },
      { id: '7', type: 'number', color: 'green', value: 8 }
    ];
    const candidateMelds = [
      {
        type: 'run' as const,
        cards: [
          { cardId: '1' },
          { cardId: '2' },
          { cardId: '3' },
          { cardId: '4' },
          { cardId: '5' },
          { cardId: '6', representedValue: 7 },
          { cardId: '7' }
        ]
      }
    ];
    const res = validatePhaseMelds(4, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 5: 1 run of 8
  it('Phase 5: validates 1 run of 8', () => {
    const hand: Card[] = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      type: 'number' as const,
      color: 'red' as const,
      value: i + 3
    }));
    const candidateMelds = [
      { type: 'run' as const, cards: hand.map(c => ({ cardId: c.id })) }
    ];
    const res = validatePhaseMelds(5, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 6: 1 run of 9
  it('Phase 6: validates 1 run of 9', () => {
    const hand: Card[] = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`,
      type: 'number' as const,
      color: 'blue' as const,
      value: i + 2
    }));
    const candidateMelds = [
      { type: 'run' as const, cards: hand.map(c => ({ cardId: c.id })) }
    ];
    const res = validatePhaseMelds(6, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 7: 2 sets of 4
  it('Phase 7: validates 2 sets of 4', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 2 },
      { id: '2', type: 'number', color: 'blue', value: 2 },
      { id: '3', type: 'number', color: 'green', value: 2 },
      { id: '4', type: 'wild' },
      { id: '5', type: 'number', color: 'red', value: 11 },
      { id: '6', type: 'number', color: 'blue', value: 11 },
      { id: '7', type: 'number', color: 'green', value: 11 },
      { id: '8', type: 'number', color: 'yellow', value: 11 }
    ];
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }, { cardId: '4' }] },
      { type: 'set' as const, cards: [{ cardId: '5' }, { cardId: '6' }, { cardId: '7' }, { cardId: '8' }] }
    ];
    const res = validatePhaseMelds(7, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 8: 7 cards of one color
  it('Phase 8: validates 7 cards of one color', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'green', value: 1 },
      { id: '2', type: 'number', color: 'green', value: 4 },
      { id: '3', type: 'number', color: 'green', value: 5 },
      { id: '4', type: 'number', color: 'green', value: 9 },
      { id: '5', type: 'number', color: 'green', value: 10 },
      { id: '6', type: 'number', color: 'green', value: 12 },
      { id: '7', type: 'wild' }
    ];
    const candidateMelds = [
      { type: 'color_group' as const, cards: hand.map(c => ({ cardId: c.id })) }
    ];
    const res = validatePhaseMelds(8, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 9: 1 set of 5 + 1 set of 2
  it('Phase 9: validates 1 set of 5 + 1 set of 2', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 6 },
      { id: '2', type: 'number', color: 'blue', value: 6 },
      { id: '3', type: 'number', color: 'green', value: 6 },
      { id: '4', type: 'number', color: 'yellow', value: 6 },
      { id: '5', type: 'wild' },
      { id: '6', type: 'number', color: 'red', value: 12 },
      { id: '7', type: 'number', color: 'blue', value: 12 }
    ];
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }, { cardId: '4' }, { cardId: '5' }] },
      { type: 'set' as const, cards: [{ cardId: '6' }, { cardId: '7' }] }
    ];
    const res = validatePhaseMelds(9, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  // Phase 10: 1 set of 5 + 1 set of 3
  it('Phase 10: validates 1 set of 5 + 1 set of 3', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 3 },
      { id: '2', type: 'number', color: 'blue', value: 3 },
      { id: '3', type: 'number', color: 'green', value: 3 },
      { id: '4', type: 'number', color: 'yellow', value: 3 },
      { id: '5', type: 'wild' },
      { id: '6', type: 'number', color: 'red', value: 10 },
      { id: '7', type: 'number', color: 'blue', value: 10 },
      { id: '8', type: 'number', color: 'green', value: 10 }
    ];
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }, { cardId: '4' }, { cardId: '5' }] },
      { type: 'set' as const, cards: [{ cardId: '6' }, { cardId: '7' }, { cardId: '8' }] }
    ];
    const res = validatePhaseMelds(10, hand, candidateMelds);
    expect(res.valid).toBe(true);
  });

  it('rejects candidate meld that does not match required phase structure', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 3 },
      { id: '2', type: 'number', color: 'blue', value: 3 },
      { id: '3', type: 'number', color: 'green', value: 3 }
    ];
    // Phase 1 requires 2 sets of 3, but only 1 set is provided
    const candidateMelds = [
      { type: 'set' as const, cards: [{ cardId: '1' }, { cardId: '2' }, { cardId: '3' }] }
    ];
    const res = validatePhaseMelds(1, hand, candidateMelds);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('MELD_COUNT_MISMATCH');
    }
  });
});

describe('Hit validation', () => {
  const baseSetMeld: Meld = {
    id: 'm1',
    ownerId: 'p1',
    type: 'set',
    targetNumber: 7,
    cards: [
      { cardId: 'c1', representedValue: 7 },
      { cardId: 'c2', representedValue: 7 },
      { cardId: 'c3', representedValue: 7 }
    ]
  };

  const baseRunMeld: Meld = {
    id: 'm2',
    ownerId: 'p1',
    type: 'run',
    minRunValue: 4,
    maxRunValue: 7,
    cards: [
      { cardId: 'r4', representedValue: 4 },
      { cardId: 'r5', representedValue: 5 },
      { cardId: 'r6', representedValue: 6 },
      { cardId: 'r7', representedValue: 7 }
    ]
  };

  it('allows hitting a matching number on a set', () => {
    const card: Card = { id: 'c4', type: 'number', color: 'yellow', value: 7 };
    const res = validateHit(baseSetMeld, card, true);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.updatedMeld.cards).toHaveLength(4);
    }
  });

  it('rejects hitting a non-matching number on a set', () => {
    const card: Card = { id: 'c4', type: 'number', color: 'yellow', value: 8 };
    const res = validateHit(baseSetMeld, card, true);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('SET_HIT_MISMATCH');
    }
  });

  it('allows extending a run at the low end', () => {
    const card: Card = { id: 'r3', type: 'number', color: 'blue', value: 3 };
    const res = validateHit(baseRunMeld, card, true);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.updatedMeld.minRunValue).toBe(3);
      expect(res.updatedMeld.maxRunValue).toBe(7);
    }
  });

  it('allows extending a run at the high end', () => {
    const card: Card = { id: 'r8', type: 'number', color: 'red', value: 8 };
    const res = validateHit(baseRunMeld, card, true);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.updatedMeld.minRunValue).toBe(4);
      expect(res.updatedMeld.maxRunValue).toBe(8);
    }
  });

  it('allows hitting a Wild on a run', () => {
    const card: Card = { id: 'w1', type: 'wild' };
    const res = validateHit(baseRunMeld, card, true, { representedValue: 8 });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.updatedMeld.maxRunValue).toBe(8);
    }
  });

  it('rejects hitting a card that does not connect to the run', () => {
    const card: Card = { id: 'r10', type: 'number', color: 'green', value: 10 };
    const res = validateHit(baseRunMeld, card, true);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('RUN_HIT_NOT_ADJACENT');
    }
  });

  it('rejects hitting before player has laid down their own phase', () => {
    const card: Card = { id: 'c4', type: 'number', color: 'yellow', value: 7 };
    const res = validateHit(baseSetMeld, card, false);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('HIT_BEFORE_PHASE');
    }
  });
});
