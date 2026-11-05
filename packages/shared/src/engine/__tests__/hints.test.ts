import { describe, it, expect } from 'vitest';
import { canHandSatisfyPhase, getCardsContributingToPhase, getLegalMoves } from '../hints.js';
import { Card } from '../../types/cards.js';
import { createInitialState, startRound } from '../reducer.js';

describe('Hints & Assist system', () => {
  it('detects when Phase 1 (2 sets of 3) is satisfied', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 4 },
      { id: '2', type: 'number', color: 'blue', value: 4 },
      { id: '3', type: 'wild' },
      { id: '4', type: 'number', color: 'red', value: 9 },
      { id: '5', type: 'number', color: 'blue', value: 9 },
      { id: '6', type: 'number', color: 'green', value: 9 },
      { id: '7', type: 'number', color: 'yellow', value: 2 }
    ];
    const res = canHandSatisfyPhase(hand, 1);
    expect(res.satisfied).toBe(true);
    expect(res.suggestedMelds).toHaveLength(2);
  });

  it('detects when Phase 1 is not satisfied', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 4 },
      { id: '2', type: 'number', color: 'blue', value: 5 },
      { id: '3', type: 'number', color: 'green', value: 6 }
    ];
    const res = canHandSatisfyPhase(hand, 1);
    expect(res.satisfied).toBe(false);
  });

  it('identifies cards contributing to phase for Assist Mode', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 4 },
      { id: '2', type: 'number', color: 'blue', value: 4 },
      { id: '3', type: 'wild' },
      { id: '4', type: 'number', color: 'yellow', value: 11 }
    ];
    const contributing = getCardsContributingToPhase(hand, 1);
    expect(contributing).toContain('1');
    expect(contributing).toContain('2');
    expect(contributing).toContain('3'); // wild always contributes
  });

  it('computes legal moves and hints for active player', () => {
    const s0 = createInitialState('TEST', { id: 'p1', name: 'Alice' });
    const s1 = {
      ...s0,
      players: [
        ...s0.players,
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
    };
    const playingState = startRound(s1);
    const activeId = playingState.currentTurnPlayerId;

    const moves = getLegalMoves(playingState, activeId);
    expect(moves.canDrawDeck).toBe(true);
    expect(moves.stepHint.length).toBeGreaterThan(0);
  });
});
