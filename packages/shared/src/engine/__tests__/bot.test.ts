import { describe, it, expect } from 'vitest';
import { getBotMove } from '../bot.js';
import { createInitialState, startRound, applyAction } from '../reducer.js';
import { Player } from '../../types/game.js';

describe('Bot heuristic agent', () => {
  it('bot decides to draw from deck when discard does not help', () => {
    const s0 = createInitialState('TESTB', { id: 'p1', name: 'Bot1' });
    const p2: Player = {
      id: 'p2',
      name: 'Bot2',
      seatIndex: 1,
      phase: 1,
      phaseCompletedThisRound: false,
      hasLaidDownPhase: false,
      score: 0,
      roundScore: 0,
      hand: [],
      isAway: false,
      isHost: false,
      isBot: true,
      skipTurns: 0
    };
    const state = startRound({ ...s0, players: [...s0.players, p2] });
    const activeId = state.currentTurnPlayerId;

    const move = getBotMove(state, activeId);
    expect(['DRAW_DECK', 'DRAW_DISCARD']).toContain(move.type);
  });

  it('bot can play full sequence of turns without crashing', () => {
    let state = startRound({
      ...createInitialState('TESTB', { id: 'b1', name: 'Bot1' }),
      players: [
        {
          id: 'b1',
          name: 'Bot1',
          seatIndex: 0,
          phase: 1,
          phaseCompletedThisRound: false,
          hasLaidDownPhase: false,
          score: 0,
          roundScore: 0,
          hand: [],
          isAway: false,
          isHost: true,
          isBot: true,
          skipTurns: 0
        },
        {
          id: 'b2',
          name: 'Bot2',
          seatIndex: 1,
          phase: 1,
          phaseCompletedThisRound: false,
          hasLaidDownPhase: false,
          score: 0,
          roundScore: 0,
          hand: [],
          isAway: false,
          isHost: false,
          isBot: true,
          skipTurns: 0
        }
      ]
    });

    for (let turn = 0; turn < 20 && state.status === 'playing'; turn++) {
      const activeId = state.currentTurnPlayerId;
      const move = getBotMove(state, activeId);
      const res = applyAction(state, activeId, move);
      expect('error' in res).toBe(false);
      if (!('error' in res)) {
        state = res.state;
      }
    }
  });
});
