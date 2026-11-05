import { Card, getCardPointValue } from '../types/cards.js';
import { GameAction } from './reducer.js';
import { GameState } from '../types/game.js';
import { canHandSatisfyPhase, getCardsContributingToPhase } from './hints.js';
import { validateHit } from './validation.js';

export function getBotMove(state: GameState, botPlayerId: string): GameAction {
  const bot = state.players.find(p => p.id === botPlayerId);
  if (!bot || state.currentTurnPlayerId !== botPlayerId) {
    throw new Error(`Bot ${botPlayerId} cannot move when not their turn.`);
  }

  // 1. Draw stage
  if (state.turnStage === 'draw') {
    const topDiscard = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : undefined;

    if (topDiscard && topDiscard.type !== 'skip') {
      const currentSatisfied = canHandSatisfyPhase(bot.hand, bot.phase).satisfied;
      const testSatisfied = canHandSatisfyPhase([...bot.hand, topDiscard], bot.phase).satisfied;

      // If taking discard completes the phase, take it!
      if (!currentSatisfied && testSatisfied) {
        return { type: 'DRAW_DISCARD' };
      }

      // If not yet laid down, check if discard contributes to phase
      if (!bot.hasLaidDownPhase) {
        const contributingBefore = getCardsContributingToPhase(bot.hand, bot.phase);
        const contributingAfter = getCardsContributingToPhase([...bot.hand, topDiscard], bot.phase);
        if (contributingAfter.includes(topDiscard.id) && contributingAfter.length > contributingBefore.length) {
          return { type: 'DRAW_DISCARD' };
        }
      }
    }

    return { type: 'DRAW_DECK' };
  }

  // 2. Action stage
  // 2a. Lay down phase as soon as possible
  if (!bot.hasLaidDownPhase) {
    const satisfaction = canHandSatisfyPhase(bot.hand, bot.phase);
    if (satisfaction.satisfied && satisfaction.suggestedMelds) {
      return {
        type: 'LAY_DOWN_PHASE',
        melds: satisfaction.suggestedMelds
      };
    }
  }

  // 2b. If already laid down, hit on melds
  if (bot.hasLaidDownPhase && state.tableMelds.length > 0) {
    for (const card of bot.hand) {
      for (const meld of state.tableMelds) {
        const hitRes = validateHit(meld, card, true);
        if (hitRes.valid) {
          return {
            type: 'HIT_MELD',
            meldId: meld.id,
            cardId: card.id
          };
        }
      }
    }
  }

  // 2c. Discard highest-scoring useless card
  const contributing = new Set(
    bot.hasLaidDownPhase ? [] : getCardsContributingToPhase(bot.hand, bot.phase)
  );

  // Score hand cards for discard priority:
  // We want to KEEP wilds and contributing cards, and discard high-scoring useless cards.
  const validCandidates = bot.hand.filter(c => !(bot.hand.length === 1 && !bot.hasLaidDownPhase));
  const pool = validCandidates.length > 0 ? validCandidates : bot.hand;

  const scoredCandidates = pool.map(card => {
    let discardScore = getCardPointValue(card); // higher points -> prefer discarding
    if (card.type === 'wild') {
      discardScore -= 1000; // never discard wild unless forced
    } else if (card.type === 'skip') {
      discardScore += 50; // good offensive discard
    } else if (contributing.has(card.id)) {
      discardScore -= 100; // prefer keeping cards that contribute to our phase
    }
    return { card, discardScore };
  });

  scoredCandidates.sort((a, b) => b.discardScore - a.discardScore);
  const cardToDiscard = scoredCandidates[0].card;

  let skipTargetPlayerId: string | undefined;
  if (cardToDiscard.type === 'skip') {
    // Choose opponent with lowest score or next player in turn order
    const opponents = state.players.filter(p => p.id !== botPlayerId);
    if (opponents.length > 0) {
      const leader = [...opponents].sort((a, b) => a.score - b.score)[0];
      skipTargetPlayerId = leader.id;
    }
  }

  return {
    type: 'DISCARD',
    cardId: cardToDiscard.id,
    skipTargetPlayerId
  };
}
