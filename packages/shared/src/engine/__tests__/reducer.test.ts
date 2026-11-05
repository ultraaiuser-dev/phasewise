import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  startRound,
  applyAction
} from '../reducer.js';
import { GameState, Player } from '../../types/game.js';
import { Card } from '../../types/cards.js';
import { projectStateForPlayer } from '../projection.js';
import { evaluateRoundEnd } from '../scoring.js';

describe('Game Reducer & Turn State Machine', () => {
  function makeTwoPlayerGameState(): GameState {
    const s0 = createInitialState('TEST1', { id: 'p1', name: 'Alice' });
    const p2: Player = {
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
    };
    const lobbyState: GameState = {
      ...s0,
      players: [...s0.players, p2]
    };
    return startRound(lobbyState);
  }

  it('initializes round correctly with dealt hands and non-skip discard', () => {
    const state = makeTwoPlayerGameState();
    expect(state.status).toBe('playing');
    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
    expect(state.discardPile.length).toBeGreaterThanOrEqual(1);
    expect(state.turnStage).toBe('draw');
  });

  it('draws a card from the deck and transitions to action stage', () => {
    const state = makeTwoPlayerGameState();
    const activePlayerId = state.currentTurnPlayerId;
    const initialDrawLen = state.drawPile.length;

    const res = applyAction(state, activePlayerId, { type: 'DRAW_DECK' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      const activePlayer = res.state.players.find(p => p.id === activePlayerId)!;
      expect(activePlayer.hand).toHaveLength(11);
      expect(res.state.drawPile).toHaveLength(initialDrawLen - 1);
      expect(res.state.turnStage).toBe('action');
    }
  });

  it('draws a card from discard pile if top is not a Skip', () => {
    let state = makeTwoPlayerGameState();
    // Force top discard to be a number card
    state.discardPile = [{ id: 'disc-1', type: 'number', color: 'red', value: 7 }];
    const activePlayerId = state.currentTurnPlayerId;

    const res = applyAction(state, activePlayerId, { type: 'DRAW_DISCARD' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      const activePlayer = res.state.players.find(p => p.id === activePlayerId)!;
      expect(activePlayer.hand.some(c => c.id === 'disc-1')).toBe(true);
      expect(res.state.discardPile).toHaveLength(0);
      expect(res.state.turnStage).toBe('action');
    }
  });

  it('rejects drawing from discard pile if top card is a Skip', () => {
    let state = makeTwoPlayerGameState();
    state.discardPile = [{ id: 'skip-top', type: 'skip' }];
    const activePlayerId = state.currentTurnPlayerId;

    const res = applyAction(state, activePlayerId, { type: 'DRAW_DISCARD' });
    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error.code).toBe('CANNOT_DRAW_SKIP');
    }
  });

  it('reshuffles discard pile when draw pile is empty', () => {
    let state = makeTwoPlayerGameState();
    state.drawPile = [];
    state.discardPile = [
      { id: 'd1', type: 'number', color: 'red', value: 1 },
      { id: 'd2', type: 'number', color: 'blue', value: 2 },
      { id: 'd3', type: 'number', color: 'green', value: 3 }
    ];
    const activePlayerId = state.currentTurnPlayerId;

    const res = applyAction(state, activePlayerId, { type: 'DRAW_DECK' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      // Discard top card 'd3' remains, 'd1' and 'd2' shuffled into draw pile, one drawn
      expect(res.state.discardPile).toHaveLength(1);
      expect(res.state.discardPile[0].id).toBe('d3');
      expect(res.state.turnStage).toBe('action');
    }
  });

  it('handles "no cards anywhere" edge case gracefully by skipping draw', () => {
    let state = makeTwoPlayerGameState();
    state.drawPile = [];
    state.discardPile = [{ id: 'top-only', type: 'number', color: 'red', value: 5 }];
    const activePlayerId = state.currentTurnPlayerId;

    const res = applyAction(state, activePlayerId, { type: 'DRAW_DECK' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      expect(res.state.turnStage).toBe('action');
      expect(res.state.drawPile).toHaveLength(0);
    }
  });

  it('rejects going out without laying down phase', () => {
    let state = makeTwoPlayerGameState();
    const activePlayerId = state.currentTurnPlayerId;
    const player = state.players.find(p => p.id === activePlayerId)!;
    // Set hand to 1 card without having laid down phase
    player.hand = [{ id: 'last-card', type: 'number', color: 'red', value: 5 }];
    player.hasLaidDownPhase = false;
    state.turnStage = 'action';

    const res = applyAction(state, activePlayerId, { type: 'DISCARD', cardId: 'last-card' });
    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error.code).toBe('CANNOT_GO_OUT_WITHOUT_PHASE');
    }
  });

  it('handles Skip discard in 2-player game: skips opponent, gives discarder another turn', () => {
    let state = makeTwoPlayerGameState();
    const activePlayerId = state.currentTurnPlayerId;
    const opponent = state.players.find(p => p.id !== activePlayerId)!;
    const player = state.players.find(p => p.id === activePlayerId)!;

    player.hand = [
      { id: 's1', type: 'skip' },
      { id: 'c1', type: 'number', color: 'red', value: 5 }
    ];
    state.turnStage = 'action';

    const res = applyAction(state, activePlayerId, { type: 'DISCARD', cardId: 's1' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      // In 2-player, opponent is skipped, turn goes back to active player!
      expect(res.state.currentTurnPlayerId).toBe(activePlayerId);
      expect(res.state.turnStage).toBe('draw');
    }
  });

  it('handles Skip discard in 3-player game: requires target player', () => {
    let state = makeTwoPlayerGameState();
    const p3: Player = {
      id: 'p3',
      name: 'Charlie',
      seatIndex: 2,
      phase: 1,
      phaseCompletedThisRound: false,
      hasLaidDownPhase: false,
      score: 0,
      roundScore: 0,
      hand: [{ id: 'c10', type: 'number', color: 'blue', value: 2 }],
      isAway: false,
      isHost: false,
      skipTurns: 0
    };
    state.players.push(p3);

    // This scenario specifically tests Bob skipping the next seat. The random
    // opening discard can itself be a Skip, so explicitly arrange the actor.
    state.currentTurnPlayerId = 'p2';

    const activePlayerId = state.currentTurnPlayerId;
    const player = state.players.find(p => p.id === activePlayerId)!;
    player.hand = [
      { id: 's1', type: 'skip' },
      { id: 'c1', type: 'number', color: 'red', value: 5 }
    ];
    state.turnStage = 'action';

    // Must provide target
    const noTargetRes = applyAction(state, activePlayerId, { type: 'DISCARD', cardId: 's1' });
    expect('error' in noTargetRes).toBe(true);

    // Target Charlie (p3) who is immediately next in turn order after Bob
    const res = applyAction(state, activePlayerId, {
      type: 'DISCARD',
      cardId: 's1',
      skipTargetPlayerId: 'p3'
    });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      // Charlie was immediately next, so his turn was skipped and passed to p1 (Alice)!
      expect(res.state.currentTurnPlayerId).toBe('p1');
      const charlie = res.state.players.find(p => p.id === 'p3')!;
      expect(charlie.skipTurns).toBe(0); // consumed
    }
  });

  it('allows going out via hit and calculates scores correctly', () => {
    let state = makeTwoPlayerGameState();
    const activePlayerId = state.currentTurnPlayerId;
    const player = state.players.find(p => p.id === activePlayerId)!;
    const opponent = state.players.find(p => p.id !== activePlayerId)!;

    player.hasLaidDownPhase = true;
    player.phaseCompletedThisRound = true;
    player.hand = [{ id: 'hit-card', type: 'number', color: 'blue', value: 7 }];

    state.tableMelds = [
      {
        id: 'm1',
        ownerId: activePlayerId,
        type: 'set',
        targetNumber: 7,
        cards: [{ cardId: 'c1', representedValue: 7 }]
      }
    ];

    // Opponent has 1 card: a Wild (25 pts), a 10 (10 pts), and a 5 (5 pts)
    opponent.hand = [
      { id: 'w1', type: 'wild' },
      { id: 'num-10', type: 'number', color: 'red', value: 10 },
      { id: 'num-5', type: 'number', color: 'green', value: 5 }
    ];
    state.turnStage = 'action';

    const res = applyAction(state, activePlayerId, {
      type: 'HIT_MELD',
      meldId: 'm1',
      cardId: 'hit-card'
    });

    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      expect(res.state.status).toBe('round_end');
      const updatedOpponent = res.state.players.find(p => p.id === opponent.id)!;
      // 25 (wild) + 10 (10) + 5 (5) = 40 points
      expect(updatedOpponent.roundScore).toBe(40);
      expect(updatedOpponent.score).toBe(40);
      const winner = res.state.players.find(p => p.id === activePlayerId)!;
      expect(winner.roundScore).toBe(0);
      expect(winner.phase).toBe(2); // Advanced to Phase 2!
    }
  });

  it('handles game over when Phase 10 is completed (lowest score wins, tie breaks)', () => {
    const p1: Player = {
      id: 'p1',
      name: 'Alice',
      seatIndex: 0,
      phase: 10,
      phaseCompletedThisRound: true,
      hasLaidDownPhase: true,
      score: 120,
      roundScore: 0,
      hand: [],
      isAway: false,
      isHost: true,
      skipTurns: 0
    };
    const p2: Player = {
      id: 'p2',
      name: 'Bob',
      seatIndex: 1,
      phase: 10,
      phaseCompletedThisRound: true,
      hasLaidDownPhase: true,
      score: 95, // Bob has lower score!
      roundScore: 0,
      hand: [{ id: 'c1', type: 'number', color: 'red', value: 2 }],
      isAway: false,
      isHost: false,
      skipTurns: 0
    };

    const state: GameState = {
      roomId: 'TEST10',
      status: 'playing',
      settings: { shortGame: false, turnTimerSeconds: 0 },
      players: [p1, p2],
      currentTurnPlayerId: 'p1',
      turnStage: 'action',
      dealerIndex: 0,
      roundNumber: 10,
      drawPile: [],
      discardPile: [],
      tableMelds: [],
      actionLog: [],
      version: 1
    };

    const res = evaluateRoundEnd(state, 'p1');
    expect(res.isGameOver).toBe(true);
    // Bob has 95 + 5 = 100, Alice has 120 + 0 = 120. Bob wins!
    expect(res.winnerIds).toEqual(['p2']);
  });

  it('hand privacy: client state projection never leaks opponents hands or draw pile order', () => {
    const state = makeTwoPlayerGameState();
    const p1 = state.players[0];
    const p2 = state.players[1];

    const projectedP1 = projectStateForPlayer(state, p1.id);
    // P1 sees their own hand
    expect(projectedP1.myHand).toHaveLength(10);
    // P1 sees P2's cardCount only
    const p2InView = projectedP1.players.find(p => p.id === p2.id)!;
    expect(p2InView.cardCount).toBe(10);
    expect(p2InView.hand).toBeUndefined();

    // Draw pile array is not present in projected state, only drawPileCount
    expect((projectedP1 as any).drawPile).toBeUndefined();
    expect(projectedP1.drawPileCount).toBe(state.drawPile.length);
  });
});
