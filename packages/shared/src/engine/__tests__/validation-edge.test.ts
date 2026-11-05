import { describe, it, expect } from 'vitest';
import { Card } from '../../types/cards.js';
import { validatePhaseMelds, validateRun, validateSet, validateColorGroup, validateHit } from '../validation.js';
import { applyAction, createInitialState, startRound } from '../reducer.js';

describe('Validation Edge Cases for 90%+ Coverage', () => {
  it('rejects candidateMelds when card is not in hand', () => {
    const hand: Card[] = [{ id: 'c1', type: 'number', color: 'red', value: 3 }];
    const res = validatePhaseMelds(1, hand, [
      { type: 'set', cards: [{ cardId: 'c1' }, { cardId: 'missing-card' }, { cardId: 'w1' }] },
      { type: 'set', cards: [{ cardId: 'c1' }, { cardId: 'c2' }, { cardId: 'c3' }] }
    ]);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('CARD_NOT_IN_HAND');
    }
  });

  it('rejects candidateMelds when card is reused across melds', () => {
    const hand: Card[] = [
      { id: 'c1', type: 'number', color: 'red', value: 3 },
      { id: 'c2', type: 'number', color: 'blue', value: 3 },
      { id: 'c3', type: 'number', color: 'green', value: 3 },
      { id: 'c4', type: 'number', color: 'yellow', value: 3 }
    ];
    const res = validatePhaseMelds(1, hand, [
      { type: 'set', cards: [{ cardId: 'c1' }, { cardId: 'c2' }, { cardId: 'c3' }] },
      { type: 'set', cards: [{ cardId: 'c1' }, { cardId: 'c3' }, { cardId: 'c4' }] } // c1 reused!
    ]);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('CARD_REUSED');
    }
  });

  it('rejects run when gap is too wide for available wilds', () => {
    const cards = [
      { card: { id: 'c1', type: 'number' as const, color: 'red' as const, value: 2 } },
      { card: { id: 'c2', type: 'number' as const, color: 'blue' as const, value: 8 } },
      { card: { id: 'w1', type: 'wild' as const } }
    ];
    const res = validateRun(cards, 3);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('RUN_GAP_TOO_WIDE');
    }
  });

  it('rejects run with explicit wild values out of bounds (0 or 13)', () => {
    const cards = [
      { card: { id: 'c1', type: 'number' as const, color: 'red' as const, value: 12 } },
      { card: { id: 'w1', type: 'wild' as const }, intent: { representedValue: 13 } }
    ];
    const res = validateRun(cards, 2);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('RUN_OUT_OF_BOUNDS');
    }
  });

  it('rejects run with explicit wild values that are not consecutive', () => {
    const cards = [
      { card: { id: 'c1', type: 'number' as const, color: 'red' as const, value: 5 } },
      { card: { id: 'w1', type: 'wild' as const }, intent: { representedValue: 8 } }
    ];
    const res = validateRun(cards, 2);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('RUN_NOT_CONSECUTIVE');
    }
  });

  it('rejects hitting a skip card', () => {
    const meld = {
      id: 'm1',
      ownerId: 'p1',
      type: 'set' as const,
      targetNumber: 5,
      cards: [{ cardId: 'c1', representedValue: 5 }]
    };
    const res = validateHit(meld, { id: 's1', type: 'skip' }, true);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('SKIP_CANNOT_HIT');
    }
  });

  it('rejects run hit when card is out of bounds (< 1 or > 12)', () => {
    const meld = {
      id: 'm1',
      ownerId: 'p1',
      type: 'run' as const,
      minRunValue: 1,
      maxRunValue: 4,
      cards: []
    };
    const res = validateHit(meld, { id: 'w1', type: 'wild' }, true, { representedValue: 0 });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('RUN_OUT_OF_BOUNDS');
    }
  });

  it('rejects run hit when 1..12 run cannot extend further', () => {
    const fullRunMeld = {
      id: 'm1',
      ownerId: 'p1',
      type: 'run' as const,
      minRunValue: 1,
      maxRunValue: 12,
      cards: []
    };
    const res = validateHit(fullRunMeld, { id: 'w1', type: 'wild' }, true);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('RUN_CANNOT_EXTEND');
    }
  });

  it('covers reducer start game error checks', () => {
    const s0 = createInitialState('ROOM', { id: 'p1', name: 'Alice' });
    // Non-host tries to start
    const nonHostRes = applyAction(s0, 'non-host', { type: 'START_GAME' });
    expect('error' in nonHostRes).toBe(true);

    // Only 1 player tries to start
    const onePlayerRes = applyAction(s0, 'p1', { type: 'START_GAME' });
    expect('error' in onePlayerRes).toBe(true);

    // Already started game tries to start again
    s0.players.push({
      id: 'p2',
      name: 'Bob',
      seatIndex: 1,
      phase: 1,
      phaseCompletedThisRound: false,
      hasLaidDownPhase: false,
      score: 0,
      roundScore: 0,
      hand: [],
      isAway: false,
      isHost: false,
      skipTurns: 0
    });
    const started = startRound(s0);
    const againRes = applyAction(started, 'p1', { type: 'START_GAME' });
    expect('error' in againRes).toBe(true);
  });

  it('covers reducer illegal turn errors (draw twice, not your turn, etc.)', () => {
    const s0 = createInitialState('ROOM', { id: 'p1', name: 'Alice' });
    s0.players.push({
      id: 'p2',
      name: 'Bob',
      seatIndex: 1,
      phase: 1,
      phaseCompletedThisRound: false,
      hasLaidDownPhase: false,
      score: 0,
      roundScore: 0,
      hand: [],
      isAway: false,
      isHost: false,
      skipTurns: 0
    });
    const state = startRound(s0);
    const activeId = state.currentTurnPlayerId;
    const inactiveId = state.players.find(p => p.id !== activeId)!.id;

    // Wrong player tries to draw
    const wrongPlayerRes = applyAction(state, inactiveId, { type: 'DRAW_DECK' });
    expect('error' in wrongPlayerRes).toBe(true);

    // Active player draws
    const drawn = applyAction(state, activeId, { type: 'DRAW_DECK' });
    expect('error' in drawn).toBe(false);
    if (!('error' in drawn)) {
      // Active player tries to draw a second time in same turn
      const drawAgain = applyAction(drawn.state, activeId, { type: 'DRAW_DECK' });
      expect('error' in drawAgain).toBe(true);

      // Active player tries to discard card not in hand
      const badDiscard = applyAction(drawn.state, activeId, { type: 'DISCARD', cardId: 'nonexistent' });
      expect('error' in badDiscard).toBe(true);
    }
  });
});
