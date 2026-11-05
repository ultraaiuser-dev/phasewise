import { Card, CardColor, Meld, MeldCard, MeldType } from '../types/cards.js';
import { ActionLogEntry, GameSettings, GameState, Player, TurnStage } from '../types/game.js';
import { createDeck, shuffleDeck } from './deck.js';
import { evaluateRoundEnd } from './scoring.js';
import { validateHit, validatePhaseMelds, ValidationError } from './validation.js';
import { HAND_SIZE, MIN_PLAYERS, MAX_PLAYERS } from '../config.js';

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'UPDATE_SETTINGS'; settings: GameSettings }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'DRAW_DECK' }
  | { type: 'DRAW_DISCARD' }
  | {
      type: 'LAY_DOWN_PHASE';
      melds: {
        type: MeldType;
        cards: { cardId: string; representedValue?: number; representedColor?: CardColor }[];
      }[];
    }
  | {
      type: 'HIT_MELD';
      meldId: string;
      cardId: string;
      representedValue?: number;
      representedColor?: CardColor;
    }
  | {
      type: 'DISCARD';
      cardId: string;
      skipTargetPlayerId?: string;
    }
  | {
      type: 'AUTO_PLAY_TURN';
    }
  | {
      type: 'REMOVE_AWAY_PLAYER';
      targetPlayerId: string;
    };

export function createInitialState(roomId: string, hostPlayer: { id: string; name: string }): GameState {
  const initialPlayer: Player = {
    id: hostPlayer.id,
    name: hostPlayer.name,
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
  };

  return {
    roomId,
    status: 'lobby',
    settings: {
      shortGame: false,
      turnTimerSeconds: 0
    },
    players: [initialPlayer],
    currentTurnPlayerId: hostPlayer.id,
    turnStage: 'draw',
    dealerIndex: 0,
    roundNumber: 0,
    drawPile: [],
    discardPile: [],
    tableMelds: [],
    actionLog: [
      {
        id: `log-${Date.now()}-0`,
        timestamp: Date.now(),
        text: `Room created by ${hostPlayer.name}.`
      }
    ],
    version: 1
  };
}

function addLog(state: GameState, text: string, playerId?: string, playerName?: string): ActionLogEntry[] {
  const entry: ActionLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    playerId,
    playerName,
    text
  };
  return [...state.actionLog.slice(-49), entry]; // keep last 50 entries
}

/**
 * Advance turn to next non-skipped player in seat order.
 */
function advanceTurn(state: GameState): {
  nextPlayerId: string;
  updatedPlayers: Player[];
  logs: string[];
} {
  const numPlayers = state.players.length;
  let currentIndex = state.players.findIndex(p => p.id === state.currentTurnPlayerId);
  if (currentIndex === -1) currentIndex = 0;

  const updatedPlayers = state.players.map(p => ({ ...p }));
  const logs: string[] = [];

  let nextIndex = (currentIndex + 1) % numPlayers;
  // Loop until we find a player who is not skipped
  let checked = 0;
  while (checked < numPlayers) {
    const candidate = updatedPlayers[nextIndex];
    if (candidate.skipTurns > 0) {
      candidate.skipTurns -= 1;
      logs.push(`${candidate.name}'s turn was skipped!`);
      nextIndex = (nextIndex + 1) % numPlayers;
      checked++;
    } else {
      break;
    }
  }

  return {
    nextPlayerId: updatedPlayers[nextIndex].id,
    updatedPlayers,
    logs
  };
}

/**
 * Set up a brand new round.
 * Deals 10 cards to each player and flips top card to discard pile.
 * If top card is a Skip, first player is skipped!
 */
export function startRound(state: GameState, rng: () => number = Math.random): GameState {
  const fullDeck = shuffleDeck(createDeck(), rng);
  const players = state.players.map(p => ({
    ...p,
    hand: [] as Card[],
    hasLaidDownPhase: false,
    phaseCompletedThisRound: false,
    roundScore: 0,
    skipTurns: 0
  }));

  // Deal 10 cards to each player
  let deckIndex = 0;
  for (let cardNum = 0; cardNum < HAND_SIZE; cardNum++) {
    for (const player of players) {
      player.hand.push(fullDeck[deckIndex++]);
    }
  }

  // Flip one card to start the discard pile
  const initialDiscard = fullDeck[deckIndex++];
  const remainingDrawPile = fullDeck.slice(deckIndex);

  let newLogs = addLog(
    state,
    `Round ${state.roundNumber + 1} started. Dealer is ${players[state.dealerIndex].name}.`
  );

  newLogs = [
    ...newLogs,
    {
      id: `log-${Date.now()}-flip`,
      timestamp: Date.now(),
      text: `First discard card flipped: ${formatCardName(initialDiscard)}.`
    }
  ];

  // First player to play is (dealerIndex + 1) % players.length
  let firstPlayerIndex = (state.dealerIndex + 1) % players.length;

  // Rule: "if it is a Skip, the first player is skipped, standard rule"
  if (initialDiscard.type === 'skip') {
    const skippedPlayer = players[firstPlayerIndex];
    newLogs = [
      ...newLogs,
      {
        id: `log-${Date.now()}-skipfirst`,
        timestamp: Date.now(),
        text: `${skippedPlayer.name} is skipped by the opening Skip card!`
      }
    ];
    firstPlayerIndex = (firstPlayerIndex + 1) % players.length;
  }

  return {
    ...state,
    status: 'playing',
    roundNumber: state.roundNumber + 1,
    players,
    drawPile: remainingDrawPile,
    discardPile: [initialDiscard],
    tableMelds: [],
    currentTurnPlayerId: players[firstPlayerIndex].id,
    turnStage: 'draw',
    actionLog: newLogs,
    version: state.version + 1,
    roundSummary: undefined
  };
}

export function formatCardName(card: Card): string {
  if (card.type === 'wild') return 'Wild';
  if (card.type === 'skip') return 'Skip';
  return `${card.value} of ${card.color}`;
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: GameAction,
  rng: () => number = Math.random
): { state: GameState } | { error: ValidationError } {
  // 1. START_GAME action
  if (action.type === 'START_GAME') {
    if (state.status !== 'lobby') {
      return { error: { code: 'GAME_ALREADY_STARTED', message: 'The game has already started.' } };
    }
    const host = state.players.find(p => p.id === playerId);
    if (!host?.isHost) {
      return { error: { code: 'NOT_HOST', message: 'Only the room host can start the game.' } };
    }
    if (state.players.length < MIN_PLAYERS || state.players.length > MAX_PLAYERS) {
      return {
        error: {
          code: 'INVALID_PLAYER_COUNT',
          message: `Need between ${MIN_PLAYERS} and ${MAX_PLAYERS} players to start (currently ${state.players.length}).`
        }
      };
    }
    return { state: startRound(state, rng) };
  }

  // 2. UPDATE_SETTINGS action
  if (action.type === 'UPDATE_SETTINGS') {
    if (state.status !== 'lobby') {
      return { error: { code: 'GAME_ALREADY_STARTED', message: 'Settings can only be changed in the lobby.' } };
    }
    const host = state.players.find(p => p.id === playerId);
    if (!host?.isHost) {
      return { error: { code: 'NOT_HOST', message: 'Only the host can update game settings.' } };
    }
    return {
      state: {
        ...state,
        settings: action.settings,
        version: state.version + 1
      }
    };
  }

  // 3. START_NEXT_ROUND action
  if (action.type === 'START_NEXT_ROUND') {
    if (state.status !== 'round_end') {
      return { error: { code: 'ROUND_NOT_ENDED', message: 'Round has not ended yet.' } };
    }
    const host = state.players.find(p => p.id === playerId);
    if (!host?.isHost) {
      return { error: { code: 'NOT_HOST', message: 'Only the host can advance to the next round.' } };
    }
    return { state: startRound(state, rng) };
  }

  // 4. REMOVE_AWAY_PLAYER action
  if (action.type === 'REMOVE_AWAY_PLAYER') {
    const host = state.players.find(p => p.id === playerId);
    if (!host?.isHost) {
      return { error: { code: 'NOT_HOST', message: 'Only the host can remove a player.' } };
    }
    const targetPlayer = state.players.find(p => p.id === action.targetPlayerId);
    if (!targetPlayer) {
      return { error: { code: 'PLAYER_NOT_FOUND', message: 'Target player not found.' } };
    }
    if (targetPlayer.isHost) {
      return { error: { code: 'CANNOT_REMOVE_HOST', message: 'Host cannot remove themselves.' } };
    }

    // Return target player's hand to discard pile
    const newDiscard = [...state.discardPile, ...targetPlayer.hand];
    const newPlayers = state.players.filter(p => p.id !== action.targetPlayerId);

    // If remaining players < 2 and game was playing, return to lobby or end
    if (newPlayers.length < MIN_PLAYERS) {
      return {
        state: {
          ...state,
          players: newPlayers,
          status: 'lobby',
          roundNumber: 0,
          actionLog: addLog(
            state,
            `${targetPlayer.name} was removed. Not enough players to continue; returned to lobby.`
          ),
          version: state.version + 1
        }
      };
    }

    let nextTurnPlayerId = state.currentTurnPlayerId;
    if (state.currentTurnPlayerId === action.targetPlayerId) {
      const next = advanceTurn({ ...state, players: newPlayers });
      nextTurnPlayerId = next.nextPlayerId;
    }

    return {
      state: {
        ...state,
        players: newPlayers,
        discardPile: newDiscard,
        currentTurnPlayerId: nextTurnPlayerId,
        turnStage: 'draw',
        actionLog: addLog(state, `${targetPlayer.name} was removed by the host. Hand returned to discard pile.`),
        version: state.version + 1
      }
    };
  }

  // For gameplay actions, status must be 'playing'
  if (state.status !== 'playing') {
    return { error: { code: 'NOT_IN_PLAY', message: 'Game is not currently active.' } };
  }

  // Verify that it is this player's turn
  if (state.currentTurnPlayerId !== playerId) {
    return {
      error: {
        code: 'NOT_YOUR_TURN',
        message: 'It is not your turn right now.'
      }
    };
  }

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];

  // Helper to ensure draw pile has cards:
  // "When the draw pile is empty, shuffle the discard pile (except its top card) to form a new draw pile.
  // If a player must draw and no card is available anywhere, they skip drawing and must discard/hit if possible"
  function ensureDrawPile(curState: GameState): GameState {
    if (curState.drawPile.length > 0) return curState;

    if (curState.discardPile.length > 1) {
      const topDiscard = curState.discardPile[curState.discardPile.length - 1];
      const cardsToShuffle = curState.discardPile.slice(0, -1);
      const newDrawPile = shuffleDeck(cardsToShuffle, rng);
      return {
        ...curState,
        drawPile: newDrawPile,
        discardPile: [topDiscard],
        actionLog: addLog(curState, 'Draw pile was empty. Discard pile reshuffled into new draw pile.')
      };
    }

    return curState;
  }

  // 5. DRAW_DECK action
  if (action.type === 'DRAW_DECK') {
    if (state.turnStage !== 'draw') {
      return { error: { code: 'INVALID_STAGE', message: 'You have already drawn a card this turn.' } };
    }

    const stateWithDeck = ensureDrawPile(state);
    if (stateWithDeck.drawPile.length === 0) {
      // Edge case: no cards anywhere to draw!
      return {
        state: {
          ...stateWithDeck,
          turnStage: 'action',
          actionLog: addLog(
            stateWithDeck,
            `${player.name} skipped drawing because no cards are available anywhere.`,
            player.id,
            player.name
          ),
          version: stateWithDeck.version + 1
        }
      };
    }

    const drawnCard = stateWithDeck.drawPile[0];
    const newDrawPile = stateWithDeck.drawPile.slice(1);
    const updatedHand = [...player.hand, drawnCard];

    const updatedPlayers = stateWithDeck.players.map(p =>
      p.id === playerId ? { ...p, hand: updatedHand } : p
    );

    return {
      state: {
        ...stateWithDeck,
        players: updatedPlayers,
        drawPile: newDrawPile,
        turnStage: 'action',
        actionLog: addLog(stateWithDeck, `${player.name} drew a card from the deck.`, player.id, player.name),
        version: stateWithDeck.version + 1
      }
    };
  }

  // 6. DRAW_DISCARD action
  if (action.type === 'DRAW_DISCARD') {
    if (state.turnStage !== 'draw') {
      return { error: { code: 'INVALID_STAGE', message: 'You have already drawn a card this turn.' } };
    }
    if (state.discardPile.length === 0) {
      return { error: { code: 'DISCARD_EMPTY', message: 'The discard pile is empty.' } };
    }

    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (topDiscard.type === 'skip') {
      return {
        error: {
          code: 'CANNOT_DRAW_SKIP',
          message: 'You cannot pick up a Skip card from the discard pile.'
        }
      };
    }

    const newDiscard = state.discardPile.slice(0, -1);
    const updatedHand = [...player.hand, topDiscard];

    const updatedPlayers = state.players.map(p =>
      p.id === playerId ? { ...p, hand: updatedHand } : p
    );

    return {
      state: {
        ...state,
        players: updatedPlayers,
        discardPile: newDiscard,
        turnStage: 'action',
        actionLog: addLog(
          state,
          `${player.name} took the ${formatCardName(topDiscard)} from the discard pile.`,
          player.id,
          player.name
        ),
        version: state.version + 1
      }
    };
  }

  // 7. LAY_DOWN_PHASE action
  if (action.type === 'LAY_DOWN_PHASE') {
    if (state.turnStage !== 'action') {
      return { error: { code: 'MUST_DRAW_FIRST', message: 'You must draw a card before laying down your phase.' } };
    }
    if (player.hasLaidDownPhase) {
      return {
        error: {
          code: 'ALREADY_LAID_DOWN',
          message: 'You have already laid down your phase this round.'
        }
      };
    }

    const validation = validatePhaseMelds(player.phase, player.hand, action.melds);
    if (!validation.valid) {
      return { error: validation.error };
    }

    // Remove used cards from player's hand
    const usedCardIds = new Set<string>();
    for (const meld of validation.resolvedMelds) {
      for (const mc of meld.cards) {
        usedCardIds.add(mc.cardId);
      }
    }

    const remainingHand = player.hand.filter(c => !usedCardIds.has(c.id));

    // Construct new table melds
    const newTableMelds: Meld[] = [
      ...state.tableMelds,
      ...validation.resolvedMelds.map((rm, idx) => ({
        id: `meld-${Date.now()}-${playerId}-${idx}`,
        ownerId: playerId,
        type: rm.type,
        cards: rm.cards,
        targetNumber: rm.targetNumber,
        targetColor: rm.targetColor,
        minRunValue: rm.minRunValue,
        maxRunValue: rm.maxRunValue
      }))
    ];

    const updatedPlayers = state.players.map(p =>
      p.id === playerId
        ? {
            ...p,
            hand: remainingHand,
            hasLaidDownPhase: true,
            phaseCompletedThisRound: true
          }
        : p
    );

    let updatedLogs = addLog(
      state,
      `🎉 ${player.name} laid down Phase ${player.phase}!`,
      player.id,
      player.name
    );

    const nextState: GameState = {
      ...state,
      players: updatedPlayers,
      tableMelds: newTableMelds,
      actionLog: updatedLogs,
      version: state.version + 1
    };

    // Check if player went out by laying down phase (if hand is empty)
    if (remainingHand.length === 0) {
      const roundEnd = evaluateRoundEnd(nextState, playerId);
      return {
        state: {
          ...nextState,
          status: roundEnd.isGameOver ? 'game_over' : 'round_end',
          players: roundEnd.players,
          dealerIndex: roundEnd.dealerIndex,
          winnerIds: roundEnd.winnerIds,
          roundSummary: roundEnd.summary,
          actionLog: addLog(
            nextState,
            `🏆 ${player.name} went out! Round ${state.roundNumber} ended.`,
            player.id,
            player.name
          ),
          version: nextState.version + 1
        }
      };
    }

    return { state: nextState };
  }

  // 8. HIT_MELD action
  if (action.type === 'HIT_MELD') {
    if (state.turnStage !== 'action') {
      return { error: { code: 'MUST_DRAW_FIRST', message: 'You must draw a card before hitting.' } };
    }
    if (!player.hasLaidDownPhase) {
      return {
        error: {
          code: 'HIT_BEFORE_PHASE',
          message: 'You cannot hit on melds until you have laid down your own phase this round.'
        }
      };
    }

    const card = player.hand.find(c => c.id === action.cardId);
    if (!card) {
      return { error: { code: 'CARD_NOT_IN_HAND', message: 'Card not in your hand.' } };
    }

    const targetMeld = state.tableMelds.find(m => m.id === action.meldId);
    if (!targetMeld) {
      return { error: { code: 'MELD_NOT_FOUND', message: 'Target meld not found on table.' } };
    }

    const hitValidation = validateHit(targetMeld, card, player.hasLaidDownPhase, {
      representedValue: action.representedValue,
      representedColor: action.representedColor
    });

    if (!hitValidation.valid) {
      return { error: hitValidation.error };
    }

    const updatedHand = player.hand.filter(c => c.id !== card.id);
    const updatedMelds = state.tableMelds.map(m =>
      m.id === targetMeld.id ? hitValidation.updatedMeld : m
    );

    const updatedPlayers = state.players.map(p =>
      p.id === playerId ? { ...p, hand: updatedHand } : p
    );

    let updatedLogs = addLog(
      state,
      `${player.name} hit ${formatCardName(card)} onto a ${targetMeld.type}.`,
      player.id,
      player.name
    );

    const nextState: GameState = {
      ...state,
      players: updatedPlayers,
      tableMelds: updatedMelds,
      actionLog: updatedLogs,
      version: state.version + 1
    };

    // Rule: "If the player's hand becomes empty (via hitting or discarding), they go out and the round ends immediately."
    if (updatedHand.length === 0) {
      const roundEnd = evaluateRoundEnd(nextState, playerId);
      return {
        state: {
          ...nextState,
          status: roundEnd.isGameOver ? 'game_over' : 'round_end',
          players: roundEnd.players,
          dealerIndex: roundEnd.dealerIndex,
          winnerIds: roundEnd.winnerIds,
          roundSummary: roundEnd.summary,
          actionLog: addLog(
            nextState,
            `🏆 ${player.name} went out by playing their last card! Round ${state.roundNumber} ended.`,
            player.id,
            player.name
          ),
          version: nextState.version + 1
        }
      };
    }

    return { state: nextState };
  }

  // 9. DISCARD action
  if (action.type === 'DISCARD') {
    if (state.turnStage !== 'action') {
      return { error: { code: 'MUST_DRAW_FIRST', message: 'You must draw a card before discarding.' } };
    }

    const card = player.hand.find(c => c.id === action.cardId);
    if (!card) {
      return { error: { code: 'CARD_NOT_IN_HAND', message: 'Selected card is not in your hand.' } };
    }

    const updatedHand = player.hand.filter(c => c.id !== card.id);

    // Rule check: "A player going out must have laid down their phase."
    if (updatedHand.length === 0 && !player.hasLaidDownPhase) {
      return {
        error: {
          code: 'CANNOT_GO_OUT_WITHOUT_PHASE',
          message: 'You cannot go out without having laid down your phase.'
        }
      };
    }

    // Handle Skip card:
    // "When a player discards a Skip, they choose another player to skip (in a 2-player game,
    // the opponent is skipped and the discarder takes another turn). The skipped player loses their next turn only."
    let skipTargetId = action.skipTargetPlayerId;
    let targetPlayer: Player | undefined;

    if (card.type === 'skip') {
      if (state.players.length === 2) {
        // 2 players: opponent is auto-selected
        targetPlayer = state.players.find(p => p.id !== playerId);
        skipTargetId = targetPlayer?.id;
      } else {
        if (!skipTargetId) {
          return {
            error: {
              code: 'SKIP_TARGET_REQUIRED',
              message: 'You must select a player to skip when discarding a Skip card.'
            }
          };
        }
        if (skipTargetId === playerId) {
          return {
            error: {
              code: 'CANNOT_SKIP_SELF',
              message: 'You cannot skip yourself.'
            }
          };
        }
        targetPlayer = state.players.find(p => p.id === skipTargetId);
        if (!targetPlayer) {
          return {
            error: {
              code: 'TARGET_PLAYER_NOT_FOUND',
              message: 'Selected skip target player does not exist.'
            }
          };
        }
      }
    }

    // Apply skip to target player
    let updatedPlayers = state.players.map(p => {
      if (p.id === playerId) {
        return { ...p, hand: updatedHand };
      }
      if (card.type === 'skip' && p.id === skipTargetId) {
        return { ...p, skipTurns: p.skipTurns + 1 };
      }
      return p;
    });

    const newDiscard = [...state.discardPile, card];
    let newLogs = addLog(
      state,
      `${player.name} discarded ${formatCardName(card)}.${card.type === 'skip' && targetPlayer ? ` ${targetPlayer.name} will be skipped!` : ''}`,
      player.id,
      player.name
    );

    const intermediateState: GameState = {
      ...state,
      players: updatedPlayers,
      discardPile: newDiscard,
      actionLog: newLogs,
      version: state.version + 1
    };

    // Check if player went out
    if (updatedHand.length === 0) {
      const roundEnd = evaluateRoundEnd(intermediateState, playerId);
      return {
        state: {
          ...intermediateState,
          status: roundEnd.isGameOver ? 'game_over' : 'round_end',
          players: roundEnd.players,
          dealerIndex: roundEnd.dealerIndex,
          winnerIds: roundEnd.winnerIds,
          roundSummary: roundEnd.summary,
          actionLog: addLog(
            intermediateState,
            `🏆 ${player.name} went out! Round ${state.roundNumber} ended.`,
            player.id,
            player.name
          ),
          version: intermediateState.version + 1
        }
      };
    }

    // Turn is over. Advance turn to next non-skipped player.
    const { nextPlayerId, updatedPlayers: finalPlayers, logs: skipLogs } = advanceTurn(intermediateState);

    let finalLogs = intermediateState.actionLog;
    for (const logText of skipLogs) {
      finalLogs = addLog({ ...intermediateState, actionLog: finalLogs }, logText);
    }

    return {
      state: {
        ...intermediateState,
        players: finalPlayers,
        currentTurnPlayerId: nextPlayerId,
        turnStage: 'draw',
        actionLog: finalLogs,
        version: intermediateState.version + 1
      }
    };
  }

  // 10. AUTO_PLAY_TURN action (used when turn timer expires or player disconnected)
  // "auto-play a safe move (draw from deck, discard highest-value non-Wild card) so the game never stalls."
  if (action.type === 'AUTO_PLAY_TURN') {
    let curState = state;
    // Step 1: Draw if in draw stage
    if (curState.turnStage === 'draw') {
      const drawRes = applyAction(curState, playerId, { type: 'DRAW_DECK' }, rng);
      if ('error' in drawRes) {
        return drawRes;
      }
      curState = drawRes.state;
    }

    // Step 2: Discard highest-value non-Wild card
    const activePlayer = curState.players.find(p => p.id === playerId)!;
    if (activePlayer.hand.length === 0) {
      return { state: curState };
    }

    // Pick highest value non-wild card (or any card if only wilds/skips)
    // Preference: Skips -> high numbers -> low numbers -> wilds
    const sortedHand = [...activePlayer.hand].sort((a, b) => {
      // Prioritize discarding non-wilds
      if (a.type !== 'wild' && b.type === 'wild') return -1;
      if (a.type === 'wild' && b.type !== 'wild') return 1;
      if (a.type === 'skip' && b.type !== 'skip') return -1;
      if (a.type !== 'skip' && b.type === 'skip') return 1;
      return (b.value || 0) - (a.value || 0);
    });

    const discardCard = sortedHand[0];
    let skipTargetId: string | undefined;

    if (discardCard.type === 'skip') {
      const otherPlayers = curState.players.filter(p => p.id !== playerId);
      if (otherPlayers.length > 0) {
        skipTargetId = otherPlayers[0].id;
      }
    }

    return applyAction(
      curState,
      playerId,
      {
        type: 'DISCARD',
        cardId: discardCard.id,
        skipTargetPlayerId: skipTargetId
      },
      rng
    );
  }

  return { error: { code: 'UNKNOWN_ACTION', message: 'Unknown action type.' } };
}
