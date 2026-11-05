import { describe, it, expect } from 'vitest';
import { canHandSatisfyPhase, getCardsContributingToPhase, getLegalMoves } from '../hints.js';
import { Card, getCardPointValue } from '../../types/cards.js';
import { applyAction, createInitialState, startRound } from '../reducer.js';
import {
  JoinRoomSchema,
  GameSettingsSchema,
  DiscardIntentSchema,
  LayDownPhaseIntentSchema
} from '../../types/protocol.js';
import { validateHit, validateColorGroup, validateRun } from '../validation.js';

describe('Coverage Boost Tests', () => {
  it('covers point values for all card types', () => {
    expect(getCardPointValue({ id: '1', type: 'number', value: 5 })).toBe(5);
    expect(getCardPointValue({ id: '2', type: 'number', value: 10 })).toBe(10);
    expect(getCardPointValue({ id: '3', type: 'number', value: 12 })).toBe(10);
    expect(getCardPointValue({ id: '4', type: 'skip' })).toBe(15);
    expect(getCardPointValue({ id: '5', type: 'wild' })).toBe(25);
    expect(getCardPointValue({ id: '6', type: 'number', value: 99 })).toBe(0);
  });

  it('covers canHandSatisfyPhase for runs (Phase 4, 5, 6)', () => {
    const runHand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 2 },
      { id: '2', type: 'number', color: 'blue', value: 3 },
      { id: '3', type: 'number', color: 'green', value: 4 },
      { id: '4', type: 'number', color: 'yellow', value: 5 },
      { id: '5', type: 'wild' },
      { id: '6', type: 'number', color: 'red', value: 7 },
      { id: '7', type: 'number', color: 'blue', value: 8 }
    ];
    const res = canHandSatisfyPhase(runHand, 4); // 1 run of 7
    expect(res.satisfied).toBe(true);
  });

  it('covers canHandSatisfyPhase for color groups (Phase 8)', () => {
    const colorHand: Card[] = [
      { id: '1', type: 'number', color: 'blue', value: 1 },
      { id: '2', type: 'number', color: 'blue', value: 3 },
      { id: '3', type: 'number', color: 'blue', value: 5 },
      { id: '4', type: 'number', color: 'blue', value: 7 },
      { id: '5', type: 'number', color: 'blue', value: 9 },
      { id: '6', type: 'number', color: 'blue', value: 11 },
      { id: '7', type: 'wild' }
    ];
    const res = canHandSatisfyPhase(colorHand, 8); // 7 cards of one color
    expect(res.satisfied).toBe(true);
  });

  it('covers canHandSatisfyPhase for set + run (Phase 2)', () => {
    const setRunHand: Card[] = [
      { id: '1', type: 'number', color: 'red', value: 3 },
      { id: '2', type: 'number', color: 'blue', value: 3 },
      { id: '3', type: 'number', color: 'green', value: 3 },
      { id: '4', type: 'number', color: 'red', value: 6 },
      { id: '5', type: 'number', color: 'blue', value: 7 },
      { id: '6', type: 'number', color: 'green', value: 8 },
      { id: '7', type: 'wild' }
    ];
    const res = canHandSatisfyPhase(setRunHand, 2); // 1 set of 3 + 1 run of 4
    expect(res.satisfied).toBe(true);
  });

  it('covers getCardsContributingToPhase for color groups and runs', () => {
    const hand: Card[] = [
      { id: '1', type: 'number', color: 'green', value: 4 },
      { id: '2', type: 'number', color: 'green', value: 9 },
      { id: '3', type: 'number', color: 'green', value: 12 },
      { id: '4', type: 'number', color: 'blue', value: 5 }
    ];
    const contrib = getCardsContributingToPhase(hand, 8);
    expect(contrib).toContain('1');
    expect(contrib).toContain('2');
    expect(contrib).toContain('3');

    const runContrib = getCardsContributingToPhase(
      [
        { id: '1', type: 'number', color: 'red', value: 4 },
        { id: '2', type: 'number', color: 'blue', value: 5 },
        { id: '3', type: 'number', color: 'green', value: 9 }
      ],
      4
    );
    expect(runContrib).toContain('1');
    expect(runContrib).toContain('2');
  });

  it('covers reducer LAY_DOWN_PHASE in live game', () => {
    const s0 = createInitialState('ROOMA', { id: 'p1', name: 'Alice' });
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
    let state = startRound(s1);
    const activeId = state.currentTurnPlayerId;
    const player = state.players.find(p => p.id === activeId)!;

    // Equip player with cards for Phase 1 (2 sets of 3)
    player.hand = [
      { id: 'c1', type: 'number', color: 'red', value: 4 },
      { id: 'c2', type: 'number', color: 'blue', value: 4 },
      { id: 'c3', type: 'number', color: 'green', value: 4 },
      { id: 'c4', type: 'number', color: 'red', value: 8 },
      { id: 'c5', type: 'number', color: 'blue', value: 8 },
      { id: 'c6', type: 'number', color: 'yellow', value: 8 },
      { id: 'extra', type: 'number', color: 'green', value: 1 }
    ];
    state.turnStage = 'action';

    const layRes = applyAction(state, activeId, {
      type: 'LAY_DOWN_PHASE',
      melds: [
        { type: 'set', cards: [{ cardId: 'c1' }, { cardId: 'c2' }, { cardId: 'c3' }] },
        { type: 'set', cards: [{ cardId: 'c4' }, { cardId: 'c5' }, { cardId: 'c6' }] }
      ]
    });

    expect('error' in layRes).toBe(false);
    if (!('error' in layRes)) {
      expect(layRes.state.tableMelds).toHaveLength(2);
      const updatedPlayer = layRes.state.players.find(p => p.id === activeId)!;
      expect(updatedPlayer.hasLaidDownPhase).toBe(true);
      expect(updatedPlayer.phaseCompletedThisRound).toBe(true);
      expect(updatedPlayer.hand).toHaveLength(1);
    }
  });

  it('covers reducer AUTO_PLAY_TURN action', () => {
    const s0 = createInitialState('ROOMB', { id: 'p1', name: 'Alice' });
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
    let state = startRound(s1);
    const activeId = state.currentTurnPlayerId;

    const res = applyAction(state, activeId, { type: 'AUTO_PLAY_TURN' });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      // Turn stage should have reset to 'draw' for the next turn
      expect(res.state.turnStage).toBe('draw');
      expect(res.state.version).toBeGreaterThan(state.version);
    }
  });

  it('covers UPDATE_SETTINGS in lobby', () => {
    let state = createInitialState('ROOMC', { id: 'p1', name: 'Alice' });
    const res = applyAction(state, 'p1', {
      type: 'UPDATE_SETTINGS',
      settings: { shortGame: true, turnTimerSeconds: 30 }
    });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      expect(res.state.settings.shortGame).toBe(true);
      expect(res.state.settings.turnTimerSeconds).toBe(30);
    }
  });

  it('covers REMOVE_AWAY_PLAYER by host', () => {
    let state = createInitialState('ROOMD', { id: 'p1', name: 'Alice' });
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
      isAway: true,
      isHost: false,
      skipTurns: 0
    });
    state.players.push({
      id: 'p3',
      name: 'Charlie',
      seatIndex: 2,
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
    state = startRound(state);

    const res = applyAction(state, 'p1', {
      type: 'REMOVE_AWAY_PLAYER',
      targetPlayerId: 'p2'
    });
    expect('error' in res).toBe(false);
    if (!('error' in res)) {
      expect(res.state.players).toHaveLength(2);
      expect(res.state.players.some(p => p.id === 'p2')).toBe(false);
    }
  });

  it('covers Zod protocol schemas', () => {
    const validJoin = JoinRoomSchema.safeParse({
      roomId: 'ABCDE',
      playerName: 'Player1'
    });
    expect(validJoin.success).toBe(true);

    const invalidJoin = JoinRoomSchema.safeParse({
      roomId: '',
      playerName: ''
    });
    expect(invalidJoin.success).toBe(false);

    const validSettings = GameSettingsSchema.safeParse({
      shortGame: true,
      turnTimerSeconds: 60
    });
    expect(validSettings.success).toBe(true);
  });

  it('covers hitting on color group melds', () => {
    const colorMeld = {
      id: 'm-col',
      ownerId: 'p1',
      type: 'color_group' as const,
      targetColor: 'red' as const,
      cards: [{ cardId: 'c1', representedColor: 'red' as const }]
    };

    // Matching color
    const hitRes = validateHit(colorMeld, { id: 'c2', type: 'number', color: 'red', value: 9 }, true);
    expect(hitRes.valid).toBe(true);

    // Mismatched color
    const badHit = validateHit(colorMeld, { id: 'c3', type: 'number', color: 'blue', value: 9 }, true);
    expect(badHit.valid).toBe(false);
  });
});
