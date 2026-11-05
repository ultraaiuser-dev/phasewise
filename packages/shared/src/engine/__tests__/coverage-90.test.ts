import { describe, it, expect } from 'vitest';
import * as sharedIndex from '../../index.js';
import { Card } from '../../types/cards.js';
import { getLegalMoves, canHandSatisfyPhase } from '../hints.js';
import { createInitialState, startRound, applyAction } from '../reducer.js';
import { validateHit, validateRun, validatePhaseMelds } from '../validation.js';

describe('Targeted 90%+ Coverage Tests', () => {
  it('covers shared index re-exports', () => {
    expect(sharedIndex.GAME_TITLE).toBe('Phasewise');
    expect(sharedIndex.createDeck).toBeDefined();
    expect(sharedIndex.applyAction).toBeDefined();
    expect(sharedIndex.PHASES).toHaveLength(10);
  });

  it('covers hints getLegalMoves when player has laid down phase and has valid hits', () => {
    let state = startRound({
      ...createInitialState('ROOME', { id: 'p1', name: 'Alice' }),
      players: [
        {
          id: 'p1',
          name: 'Alice',
          seatIndex: 0,
          phase: 1,
          phaseCompletedThisRound: false,
          hasLaidDownPhase: false,
          score: 0,
          roundScore: 0,
          hand: [],
          isAway: false,
          isHost: true,
          skipTurns: 0
        },
        {
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
        }
      ]
    });

    // Set p1 as having laid down their phase with specific hittable hand
    const p1 = state.players.find(p => p.id === 'p1')!;
    p1.hasLaidDownPhase = true;
    p1.phaseCompletedThisRound = true;
    p1.hand = [
      { id: 'h1', type: 'number', color: 'red', value: 7 },
      { id: 'h2', type: 'number', color: 'blue', value: 11 }
    ];

    state.currentTurnPlayerId = 'p1';
    state.turnStage = 'action';
    state.tableMelds = [
      {
        id: 'm1',
        ownerId: 'p1',
        type: 'set',
        targetNumber: 7,
        cards: [{ cardId: 'c1', representedValue: 7 }]
      }
    ];

    const moves = getLegalMoves(state, 'p1');
    expect(moves.validHits.length).toBeGreaterThan(0);
    expect(moves.validHits[0].cardId).toBe('h1');
    expect(moves.stepHint).toContain('hit');
  });

  it('covers run validation auto-resolution with wild at end and start', () => {
    // 1 natural card at value 1 and 3 wilds -> must start at 1
    const cards = [
      { card: { id: 'c1', type: 'number' as const, color: 'red' as const, value: 1 } },
      { card: { id: 'w1', type: 'wild' as const } },
      { card: { id: 'w2', type: 'wild' as const } },
      { card: { id: 'w3', type: 'wild' as const } }
    ];
    const res = validateRun(cards, 4);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.meld.minRunValue).toBe(1);
      expect(res.meld.maxRunValue).toBe(4);
    }
  });

  it('covers run hit when Wild does not specify representedValue but only one end is valid', () => {
    // Run currently spans 1 to 5. Min is 1 (cannot go lower than 1).
    // Wild hit must extend to 6!
    const runMeld = {
      id: 'm-run1',
      ownerId: 'p1',
      type: 'run' as const,
      minRunValue: 1,
      maxRunValue: 5,
      cards: []
    };
    const res = validateHit(runMeld, { id: 'w1', type: 'wild' }, true);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.updatedMeld.maxRunValue).toBe(6);
    }

    // Run currently spans 8 to 12. Max is 12 (cannot go higher).
    // Wild hit must extend low to 7!
    const runMeldHigh = {
      id: 'm-run2',
      ownerId: 'p1',
      type: 'run' as const,
      minRunValue: 8,
      maxRunValue: 12,
      cards: []
    };
    const resHigh = validateHit(runMeldHigh, { id: 'w2', type: 'wild' }, true);
    expect(resHigh.valid).toBe(true);
    if (resHigh.valid) {
      expect(resHigh.updatedMeld.minRunValue).toBe(7);
    }
  });

  it('covers reducer round advance to next round with START_NEXT_ROUND', () => {
    let state = createInitialState('ROOMNEXT', { id: 'p1', name: 'Alice' });
    state.players.push({
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
    state.status = 'round_end';

    const res = applyAction(state, 'p1', { type: 'START_NEXT_ROUND' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      expect(res.state.status).toBe('playing');
      expect(res.state.roundNumber).toBe(1);
    }
  });
});
