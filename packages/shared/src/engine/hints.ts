import { Card, CardColor, CARD_COLORS, Meld, MeldCard, MeldType } from '../types/cards.js';
import { GameState, Player } from '../types/game.js';
import { getPhaseDefinition, MeldRequirement } from '../types/phases.js';
import { validateHit } from './validation.js';

export interface ProposedMeld {
  type: MeldType;
  cards: { cardId: string; representedValue?: number; representedColor?: CardColor }[];
}

export interface PhaseSatisfactionResult {
  satisfied: boolean;
  suggestedMelds?: ProposedMeld[];
}

export interface LegalMoves {
  canDrawDeck: boolean;
  canDrawDiscard: boolean;
  canLayDownPhase: boolean;
  suggestedPhaseMelds?: ProposedMeld[];
  validHits: {
    cardId: string;
    meldId: string;
    representedValue?: number;
    representedColor?: CardColor;
  }[];
  canDiscardCardIds: string[];
  phaseSatisfied: boolean;
  stepHint: string;
  cardsContributingToPhase: string[];
  unplayableCardIds: string[];
}

/**
 * Find candidate sets of given size from cards.
 */
function findCandidateSets(cards: Card[], count: number): ProposedMeld[] {
  const wilds = cards.filter(c => c.type === 'wild');
  const numbers = cards.filter(c => c.type === 'number');
  const byVal = new Map<number, Card[]>();

  for (const c of numbers) {
    const arr = byVal.get(c.value!) || [];
    arr.push(c);
    byVal.set(c.value!, arr);
  }

  const results: ProposedMeld[] = [];

  for (const [val, natCards] of byVal.entries()) {
    if (natCards.length + wilds.length >= count) {
      // Pick as many naturals as needed up to count, then fill rest with wilds
      const chosenNaturals = natCards.slice(0, count);
      const neededWilds = count - chosenNaturals.length;
      const chosenWilds = wilds.slice(0, neededWilds);

      const meldCards = [
        ...chosenNaturals.map(c => ({ cardId: c.id, representedValue: val, representedColor: c.color })),
        ...chosenWilds.map(c => ({ cardId: c.id, representedValue: val }))
      ];

      results.push({
        type: 'set',
        cards: meldCards
      });
    }
  }

  return results;
}

/**
 * Find candidate color groups of given size from cards.
 */
function findCandidateColorGroups(cards: Card[], count: number): ProposedMeld[] {
  const wilds = cards.filter(c => c.type === 'wild');
  const numbers = cards.filter(c => c.type === 'number');
  const byColor = new Map<CardColor, Card[]>();

  for (const c of numbers) {
    const arr = byColor.get(c.color!) || [];
    arr.push(c);
    byColor.set(c.color!, arr);
  }

  const results: ProposedMeld[] = [];

  for (const [color, natCards] of byColor.entries()) {
    if (natCards.length + wilds.length >= count) {
      const chosenNaturals = natCards.slice(0, count);
      const neededWilds = count - chosenNaturals.length;
      const chosenWilds = wilds.slice(0, neededWilds);

      const meldCards = [
        ...chosenNaturals.map(c => ({ cardId: c.id, representedValue: c.value, representedColor: color })),
        ...chosenWilds.map(c => ({ cardId: c.id, representedColor: color }))
      ];

      results.push({
        type: 'color_group',
        cards: meldCards
      });
    }
  }

  return results;
}

/**
 * Find candidate runs of given length from cards.
 */
function findCandidateRuns(cards: Card[], length: number): ProposedMeld[] {
  if (length > 12) return [];

  const wilds = cards.filter(c => c.type === 'wild');
  const numbers = cards.filter(c => c.type === 'number');
  const byVal = new Map<number, Card[]>();

  for (const c of numbers) {
    const arr = byVal.get(c.value!) || [];
    arr.push(c);
    byVal.set(c.value!, arr);
  }

  const results: ProposedMeld[] = [];

  for (let start = 1; start <= 13 - length; start++) {
    const neededNumbers = Array.from({ length }, (_, i) => start + i);
    let naturalsFound = 0;
    let missing = 0;
    const meldCards: { cardId: string; representedValue: number; representedColor?: CardColor }[] = [];
    const usedWilds: Card[] = [];

    let possible = true;
    let wildIdx = 0;

    for (const num of neededNumbers) {
      const available = byVal.get(num);
      if (available && available.length > 0) {
        // Use natural card (pick first available)
        meldCards.push({
          cardId: available[0].id,
          representedValue: num,
          representedColor: available[0].color
        });
        naturalsFound++;
      } else {
        missing++;
        if (wildIdx < wilds.length) {
          const w = wilds[wildIdx++];
          usedWilds.push(w);
          meldCards.push({
            cardId: w.id,
            representedValue: num
          });
        } else {
          possible = false;
          break;
        }
      }
    }

    // Must have at least 1 natural card
    if (possible && naturalsFound >= 1) {
      results.push({
        type: 'run',
        cards: meldCards
      });
    }
  }

  return results;
}

function findCandidatesForReq(cards: Card[], req: MeldRequirement): ProposedMeld[] {
  if (req.type === 'set') return findCandidateSets(cards, req.count);
  if (req.type === 'run') return findCandidateRuns(cards, req.count);
  if (req.type === 'color_group') return findCandidateColorGroups(cards, req.count);
  return [];
}

/**
 * Checks whether hand can satisfy the given phase number,
 * and returns suggested melds if satisfied.
 */
export function canHandSatisfyPhase(hand: Card[], phaseNumber: number): PhaseSatisfactionResult {
  const phaseDef = getPhaseDefinition(phaseNumber);
  if (!phaseDef) return { satisfied: false };

  const reqs = phaseDef.requirements;

  if (reqs.length === 1) {
    const candidates = findCandidatesForReq(hand, reqs[0]);
    if (candidates.length > 0) {
      return {
        satisfied: true,
        suggestedMelds: [candidates[0]]
      };
    }
    return { satisfied: false };
  }

  if (reqs.length === 2) {
    // Try both orders: (req0 then req1), or (req1 then req0)
    for (const [r0, r1] of [
      [reqs[0], reqs[1]],
      [reqs[1], reqs[0]]
    ]) {
      const firstCandidates = findCandidatesForReq(hand, r0);
      for (const m1 of firstCandidates) {
        const usedIds = new Set(m1.cards.map(c => c.cardId));
        const remainingCards = hand.filter(c => !usedIds.has(c.id));
        const secondCandidates = findCandidatesForReq(remainingCards, r1);
        if (secondCandidates.length > 0) {
          const m2 = secondCandidates[0];
          // Ensure correct order in output matching phaseDef.requirements
          const orderedMelds = r0 === reqs[0] ? [m1, m2] : [m2, m1];
          return {
            satisfied: true,
            suggestedMelds: orderedMelds
          };
        }
      }
    }
  }

  return { satisfied: false };
}

/**
 * Identifies card IDs in hand that contribute to the current phase requirement.
 * Used for Assist Mode highlighting.
 */
export function getCardsContributingToPhase(hand: Card[], phaseNumber: number): string[] {
  const phaseDef = getPhaseDefinition(phaseNumber);
  if (!phaseDef) return [];

  const contributing = new Set<string>();

  // Wild cards always contribute
  for (const c of hand) {
    if (c.type === 'wild') contributing.add(c.id);
  }

  const reqs = phaseDef.requirements;
  const numbers = hand.filter(c => c.type === 'number');

  // Case 1: Pure color group (Phase 8)
  const colorReq = reqs.find(r => r.type === 'color_group');
  if (colorReq) {
    const counts = new Map<CardColor, Card[]>();
    for (const c of numbers) {
      const arr = counts.get(c.color!) || [];
      arr.push(c);
      counts.set(c.color!, arr);
    }
    // Pick the most frequent color
    let bestColor: CardColor | undefined;
    let bestCount = 0;
    for (const [col, cards] of counts.entries()) {
      if (cards.length > bestCount) {
        bestCount = cards.length;
        bestColor = col;
      }
    }
    if (bestColor) {
      // Only protect up to required count
      const colCards = counts.get(bestColor)!;
      for (const card of colCards.slice(0, colorReq.count)) {
        contributing.add(card.id);
      }
    }
    return Array.from(contributing);
  }

  // Case 2: Only sets (Phases 1, 7, 9, 10)
  const isOnlySets = reqs.every(r => r.type === 'set');
  if (isOnlySets) {
    const valCounts = new Map<number, Card[]>();
    for (const c of numbers) {
      const arr = valCounts.get(c.value!) || [];
      arr.push(c);
      valCounts.set(c.value!, arr);
    }

    // Sort numbers by frequency descending
    const sortedEntries = Array.from(valCounts.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );

    // Pick top N numbers matching requirement count
    // reqs sorted by size descending to match largest sets first
    const sortedReqs = [...reqs].sort((a, b) => b.count - a.count);
    for (let i = 0; i < Math.min(sortedReqs.length, sortedEntries.length); i++) {
      const targetCount = sortedReqs[i].count;
      const cardsForVal = sortedEntries[i][1];
      for (const card of cardsForVal.slice(0, targetCount)) {
        contributing.add(card.id);
      }
    }
    return Array.from(contributing);
  }

  // Case 3: Run involved (Phases 2, 3, 4, 5, 6)
  const runReq = reqs.find(r => r.type === 'run');
  const setReq = reqs.find(r => r.type === 'set');

  // If there's also a set (Phases 2, 3)
  let bestSetNumber: number | undefined;
  if (setReq) {
    const valCounts = new Map<number, Card[]>();
    for (const c of numbers) {
      const arr = valCounts.get(c.value!) || [];
      arr.push(c);
      valCounts.set(c.value!, arr);
    }
    const sortedEntries = Array.from(valCounts.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );
    if (sortedEntries.length > 0 && sortedEntries[0][1].length >= 2) {
      bestSetNumber = sortedEntries[0][0];
      const cardsForSet = sortedEntries[0][1].slice(0, setReq.count);
      for (const card of cardsForSet) {
        contributing.add(card.id);
      }
    }
  }

  // Find best window for run
  if (runReq) {
    const runLen = runReq.count;
    let bestStart = 1;
    let bestSpanCount = 0;

    for (let s = 1; s <= 13 - runLen; s++) {
      const inSpan = numbers.filter(
        c => c.value! >= s && c.value! < s + runLen && c.value !== bestSetNumber
      );
      const uniqueVals = new Set(inSpan.map(c => c.value!));
      if (uniqueVals.size > bestSpanCount) {
        bestSpanCount = uniqueVals.size;
        bestStart = s;
      }
    }

    const runCards = numbers.filter(
      c => c.value! >= bestStart && c.value! < bestStart + runLen && c.value !== bestSetNumber
    );

    // CRITICAL FIX: Only protect ONE card per value for a run! Duplicates do NOT contribute.
    const seenValues = new Set<number>();
    for (const card of runCards) {
      if (!seenValues.has(card.value!)) {
        seenValues.add(card.value!);
        contributing.add(card.id);
      }
    }
  }

  return Array.from(contributing);
}

/**
 * Computes all legal moves and assist hints for a player in a game state.
 */
export function getLegalMoves(state: GameState, playerId: string): LegalMoves {
  const player = state.players.find(p => p.id === playerId);
  const isMyTurn = state.currentTurnPlayerId === playerId && state.status === 'playing';

  if (!player || !isMyTurn) {
    return {
      canDrawDeck: false,
      canDrawDiscard: false,
      canLayDownPhase: false,
      validHits: [],
      canDiscardCardIds: [],
      phaseSatisfied: false,
      stepHint: isMyTurn ? '' : "Waiting for other players...",
      cardsContributingToPhase: player ? getCardsContributingToPhase(player.hand, player.phase) : [],
      unplayableCardIds: player ? player.hand.map(c => c.id) : []
    };
  }

  const isDrawStage = state.turnStage === 'draw';
  const isActionStage = state.turnStage === 'action';

  const canDrawDeck = isDrawStage;
  const topDiscard = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : undefined;
  const canDrawDiscard = isDrawStage && topDiscard !== undefined && topDiscard.type !== 'skip';

  const phaseSatisfaction = canHandSatisfyPhase(player.hand, player.phase);
  const canLayDownPhase = isActionStage && !player.hasLaidDownPhase && phaseSatisfaction.satisfied;

  // Compute valid hits
  const validHits: {
    cardId: string;
    meldId: string;
    representedValue?: number;
    representedColor?: CardColor;
  }[] = [];

  if (isActionStage && player.hasLaidDownPhase) {
    for (const card of player.hand) {
      for (const meld of state.tableMelds) {
        const hitResult = validateHit(meld, card, true);
        if (hitResult.valid) {
          validHits.push({
            cardId: card.id,
            meldId: meld.id
          });
        }
      }
    }
  }

  // Discardable cards: in action stage, all cards in hand can be discarded (as long as it doesn't violate "cannot go out without phase")
  const canDiscardCardIds: string[] = [];
  if (isActionStage) {
    for (const card of player.hand) {
      if (player.hand.length === 1 && !player.hasLaidDownPhase) {
        // Cannot discard last card without laying down phase
        continue;
      }
      canDiscardCardIds.push(card.id);
    }
  }

  // Assist Step Hint text
  let stepHint = '';
  const phaseDef = getPhaseDefinition(player.phase);
  const phaseDesc = phaseDef ? phaseDef.description : `Phase ${player.phase}`;

  if (isDrawStage) {
    if (canDrawDiscard) {
      stepHint = `Draw a card from the deck or discard pile. Goal: ${phaseDesc}.`;
    } else {
      stepHint = `Draw a card from the deck. Goal: ${phaseDesc}.`;
    }
  } else if (isActionStage) {
    if (canLayDownPhase) {
      stepHint = `You can lay down ${phaseDesc}! Click "Lay Down Phase", or discard a card.`;
    } else if (player.hasLaidDownPhase) {
      if (validHits.length > 0) {
        stepHint = `You can hit ${validHits.length} card(s) onto table melds, or discard to end your turn.`;
      } else {
        stepHint = 'Choose a card to discard to finish your turn.';
      }
    } else {
      stepHint = `Working on ${phaseDesc}. Choose a card to discard to end your turn.`;
    }
  }

  const contributing = getCardsContributingToPhase(player.hand, player.phase);
  const contributingSet = new Set(contributing);

  // Unplayable cards for Assist Mode dimming
  const unplayableCardIds: string[] = [];
  if (isDrawStage) {
    // Cannot play any hand card during draw stage
    unplayableCardIds.push(...player.hand.map(c => c.id));
  } else if (isActionStage) {
    // If player has laid down phase, cards that cannot be hit and cannot be discarded are unplayable
    for (const card of player.hand) {
      const isHittable = validHits.some(h => h.cardId === card.id);
      const isDiscardable = canDiscardCardIds.includes(card.id);
      if (!isHittable && !isDiscardable) {
        unplayableCardIds.push(card.id);
      }
    }
  }

  return {
    canDrawDeck,
    canDrawDiscard,
    canLayDownPhase,
    suggestedPhaseMelds: phaseSatisfaction.suggestedMelds,
    validHits,
    canDiscardCardIds,
    phaseSatisfied: phaseSatisfaction.satisfied,
    stepHint,
    cardsContributingToPhase: contributing,
    unplayableCardIds
  };
}
