import { Card, CardColor, Meld, MeldCard, MeldType } from '../types/cards.js';
import { getPhaseDefinition, MeldRequirement } from '../types/phases.js';
import { GameState, Player } from '../types/game.js';

export interface ValidationError {
  code: string;
  message: string;
}

export interface ResolvedMeld {
  type: MeldType;
  cards: MeldCard[];
  targetNumber?: number;
  targetColor?: CardColor;
  minRunValue?: number;
  maxRunValue?: number;
}

/**
 * Validates a candidate Set of cards.
 * - Set: cards of the same number (any colors)
 * - Must have at least one natural card
 * - All natural cards must have the same number
 * - Skip cards are not allowed
 */
export function validateSet(
  cardItems: { card: Card; intent?: { representedValue?: number; representedColor?: CardColor } }[],
  requiredCount?: number
): { valid: true; meld: ResolvedMeld } | { valid: false; error: ValidationError } {
  if (requiredCount !== undefined && cardItems.length < requiredCount) {
    return {
      valid: false,
      error: {
        code: 'SET_TOO_SHORT',
        message: `A set requires at least ${requiredCount} cards, but only ${cardItems.length} were provided.`
      }
    };
  }

  if (cardItems.some(c => c.card.type === 'skip')) {
    return {
      valid: false,
      error: {
        code: 'SKIP_NOT_ALLOWED',
        message: 'Skip cards cannot be used in any meld.'
      }
    };
  }

  const naturalCards = cardItems.filter(c => c.card.type === 'number');
  if (naturalCards.length === 0) {
    return {
      valid: false,
      error: {
        code: 'NO_NATURAL_CARDS',
        message: 'Every meld must contain at least one natural (non-Wild) card.'
      }
    };
  }

  const setNumber = naturalCards[0].card.value!;
  for (const item of naturalCards) {
    if (item.card.value !== setNumber) {
      return {
        valid: false,
        error: {
          code: 'SET_NUMBER_MISMATCH',
          message: `A set requires all cards to have the same number. Found both ${setNumber} and ${item.card.value}.`
        }
      };
    }
  }

  const meldCards: MeldCard[] = cardItems.map(item => ({
    cardId: item.card.id,
    representedValue: setNumber,
    representedColor: item.card.color
  }));

  return {
    valid: true,
    meld: {
      type: 'set',
      cards: meldCards,
      targetNumber: setNumber
    }
  };
}

/**
 * Validates a candidate Run of cards.
 * - Run: consecutive numbers (any colors)
 * - Strictly no wrap-around (12 does not connect to 1)
 * - Maximum length 12
 * - Must have at least one natural card
 * - Resolves positions for Wild cards
 */
export function validateRun(
  cardItems: { card: Card; intent?: { representedValue?: number; representedColor?: CardColor } }[],
  requiredCount?: number
): { valid: true; meld: ResolvedMeld } | { valid: false; error: ValidationError } {
  if (requiredCount !== undefined && cardItems.length < requiredCount) {
    return {
      valid: false,
      error: {
        code: 'RUN_TOO_SHORT',
        message: `A run requires at least ${requiredCount} cards, but only ${cardItems.length} were provided.`
      }
    };
  }

  if (cardItems.length > 12) {
    return {
      valid: false,
      error: {
        code: 'RUN_TOO_LONG',
        message: 'A run cannot have more than 12 cards.'
      }
    };
  }

  if (cardItems.some(c => c.card.type === 'skip')) {
    return {
      valid: false,
      error: {
        code: 'SKIP_NOT_ALLOWED',
        message: 'Skip cards cannot be used in any meld.'
      }
    };
  }

  const naturalCards = cardItems.filter(c => c.card.type === 'number');
  if (naturalCards.length === 0) {
    return {
      valid: false,
      error: {
        code: 'NO_NATURAL_CARDS',
        message: 'Every meld must contain at least one natural (non-Wild) card.'
      }
    };
  }

  // Check for duplicate natural numbers
  const naturalValues = naturalCards.map(c => c.card.value!);
  const uniqueNaturals = new Set(naturalValues);
  if (uniqueNaturals.size !== naturalValues.length) {
    return {
      valid: false,
      error: {
        code: 'RUN_DUPLICATE_NUMBER',
        message: 'A run cannot contain duplicate numbers.'
      }
    };
  }

  // If client specified explicit represented values for wilds, verify them first
  const hasExplicitWildValues = cardItems
    .filter(c => c.card.type === 'wild')
    .every(c => c.intent?.representedValue !== undefined);

  if (hasExplicitWildValues) {
    const assigned = cardItems.map(c => ({
      cardId: c.card.id,
      card: c.card,
      value: c.card.type === 'number' ? c.card.value! : c.intent!.representedValue!
    }));

    // Check bounds 1-12
    for (const item of assigned) {
      if (item.value < 1 || item.value > 12) {
        return {
          valid: false,
          error: {
            code: 'RUN_OUT_OF_BOUNDS',
            message: `Card numbers must be between 1 and 12. ${item.value} is out of bounds.`
          }
        };
      }
    }

    // Sort by assigned value
    assigned.sort((a, b) => a.value - b.value);

    // Check consecutive without gaps or duplicates
    for (let i = 0; i < assigned.length - 1; i++) {
      if (assigned[i + 1].value !== assigned[i].value + 1) {
        return {
          valid: false,
          error: {
            code: 'RUN_NOT_CONSECUTIVE',
            message: `A run needs consecutive numbers. ${assigned[i].value} and ${assigned[i + 1].value} are not next to each other.`
          }
        };
      }
    }

    const minRunValue = assigned[0].value;
    const maxRunValue = assigned[assigned.length - 1].value;

    return {
      valid: true,
      meld: {
        type: 'run',
        cards: assigned.map(a => ({
          cardId: a.cardId,
          representedValue: a.value,
          representedColor: a.card.color
        })),
        minRunValue,
        maxRunValue
      }
    };
  }

  // If wild values were not explicitly specified, auto-resolve them if possible
  const minNat = Math.min(...naturalValues);
  const maxNat = Math.max(...naturalValues);
  const span = maxNat - minNat + 1;
  const wildsCount = cardItems.length - naturalCards.length;

  if (span > cardItems.length) {
    return {
      valid: false,
      error: {
        code: 'RUN_GAP_TOO_WIDE',
        message: `The gap between ${minNat} and ${maxNat} is too large to fill with the available Wild cards.`
      }
    };
  }

  // Find valid start positions in [1, 12] such that start + cardItems.length - 1 <= 12
  // and all natural numbers fall within [start, start + length - 1]
  const validStarts: number[] = [];
  const len = cardItems.length;

  for (let start = 1; start <= 13 - len; start++) {
    const end = start + len - 1;
    if (minNat >= start && maxNat <= end) {
      validStarts.push(start);
    }
  }

  if (validStarts.length === 0) {
    return {
      valid: false,
      error: {
        code: 'RUN_NO_VALID_RANGE',
        message: 'Could not form a valid consecutive run within 1 to 12 with these cards.'
      }
    };
  }

  // Pick the best start: if there is only 1 valid start, use it.
  // Otherwise, default to starting at minNat (placing wilds at the higher end) unless minNat + len - 1 > 12
  let chosenStart = validStarts[0];
  if (validStarts.includes(minNat)) {
    chosenStart = minNat;
  } else {
    chosenStart = validStarts[validStarts.length - 1];
  }

  // Build the resolved run
  const targetNumbers = Array.from({ length: len }, (_, i) => chosenStart + i);
  const remainingWilds = cardItems.filter(c => c.card.type === 'wild');
  const meldCards: MeldCard[] = [];

  for (const num of targetNumbers) {
    const nat = naturalCards.find(c => c.card.value === num);
    if (nat) {
      meldCards.push({
        cardId: nat.card.id,
        representedValue: num,
        representedColor: nat.card.color
      });
    } else {
      const wild = remainingWilds.shift();
      if (wild) {
        meldCards.push({
          cardId: wild.card.id,
          representedValue: num
        });
      }
    }
  }

  return {
    valid: true,
    meld: {
      type: 'run',
      cards: meldCards,
      minRunValue: chosenStart,
      maxRunValue: chosenStart + len - 1
    }
  };
}

/**
 * Validates a candidate Color Group.
 * - Color group: cards all of one color (numbers irrelevant)
 * - Must have at least one natural card
 * - All natural cards must have the same color
 * - Skip cards are not allowed
 */
export function validateColorGroup(
  cardItems: { card: Card; intent?: { representedValue?: number; representedColor?: CardColor } }[],
  requiredCount?: number
): { valid: true; meld: ResolvedMeld } | { valid: false; error: ValidationError } {
  if (requiredCount !== undefined && cardItems.length < requiredCount) {
    return {
      valid: false,
      error: {
        code: 'COLOR_GROUP_TOO_SHORT',
        message: `A color group requires at least ${requiredCount} cards, but only ${cardItems.length} were provided.`
      }
    };
  }

  if (cardItems.some(c => c.card.type === 'skip')) {
    return {
      valid: false,
      error: {
        code: 'SKIP_NOT_ALLOWED',
        message: 'Skip cards cannot be used in any meld.'
      }
    };
  }

  const naturalCards = cardItems.filter(c => c.card.type === 'number');
  if (naturalCards.length === 0) {
    return {
      valid: false,
      error: {
        code: 'NO_NATURAL_CARDS',
        message: 'Every meld must contain at least one natural (non-Wild) card.'
      }
    };
  }

  const groupColor = naturalCards[0].card.color!;
  for (const item of naturalCards) {
    if (item.card.color !== groupColor) {
      return {
        valid: false,
        error: {
          code: 'COLOR_MISMATCH',
          message: `All cards in a color group must be the same color. Found both ${groupColor} and ${item.card.color}.`
        }
      };
    }
  }

  const meldCards: MeldCard[] = cardItems.map(item => ({
    cardId: item.card.id,
    representedValue: item.card.value,
    representedColor: groupColor
  }));

  return {
    valid: true,
    meld: {
      type: 'color_group',
      cards: meldCards,
      targetColor: groupColor
    }
  };
}

/**
 * Validates laying down a phase atomically.
 * Checks that the provided melds satisfy the requirements of the player's phase.
 */
export function validatePhaseMelds(
  playerPhase: number,
  playerHand: Card[],
  candidateMelds: {
    type: MeldType;
    cards: { cardId: string; representedValue?: number; representedColor?: CardColor }[];
  }[]
): { valid: true; resolvedMelds: ResolvedMeld[] } | { valid: false; error: ValidationError } {
  const phaseDef = getPhaseDefinition(playerPhase);
  if (!phaseDef) {
    return {
      valid: false,
      error: {
        code: 'INVALID_PHASE',
        message: `Phase ${playerPhase} does not exist.`
      }
    };
  }

  if (candidateMelds.length !== phaseDef.requirements.length) {
    return {
      valid: false,
      error: {
        code: 'MELD_COUNT_MISMATCH',
        message: `${phaseDef.title} requires ${phaseDef.requirements.length} melds (${phaseDef.description}), but received ${candidateMelds.length}.`
      }
    };
  }

  // Ensure all cards are in player's hand and no card is duplicated across melds
  const usedCardIds = new Set<string>();
  const handMap = new Map(playerHand.map(c => [c.id, c]));

  for (const meld of candidateMelds) {
    for (const cardRef of meld.cards) {
      if (!handMap.has(cardRef.cardId)) {
        return {
          valid: false,
          error: {
            code: 'CARD_NOT_IN_HAND',
            message: `Card ${cardRef.cardId} is not in your hand.`
          }
        };
      }
      if (usedCardIds.has(cardRef.cardId)) {
        return {
          valid: false,
          error: {
            code: 'CARD_REUSED',
            message: 'A card cannot be used in more than one meld.'
          }
        };
      }
      usedCardIds.add(cardRef.cardId);
    }
  }

  // Match melds to phase requirements
  // Because order of melds in submission might differ from phase requirement order,
  // we check if there exists a 1-to-1 matching between candidateMelds and phaseDef.requirements.
  const reqs = phaseDef.requirements;
  const numReqs = reqs.length;

  // For 1 or 2 requirements, permutation matching is very simple and robust
  const permutations: number[][] = [];
  if (numReqs === 1) {
    permutations.push([0]);
  } else if (numReqs === 2) {
    permutations.push([0, 1], [1, 0]);
  }

  let bestResolved: ResolvedMeld[] | null = null;
  let lastError: ValidationError = {
    code: 'PHASE_REQUIREMENTS_NOT_MET',
    message: `The provided cards do not satisfy ${phaseDef.title} (${phaseDef.description}).`
  };

  for (const perm of permutations) {
    let matches = true;
    const currentResolved: ResolvedMeld[] = [];

    for (let i = 0; i < numReqs; i++) {
      const meldIndex = perm[i];
      const candMeld = candidateMelds[meldIndex];
      const req = reqs[i];

      if (candMeld.type !== req.type) {
        matches = false;
        lastError = {
          code: 'MELD_TYPE_MISMATCH',
          message: `Expected a ${req.type} for requirement "${req.description}", but got a ${candMeld.type}.`
        };
        break;
      }

      const cardItems = candMeld.cards.map(c => ({
        card: handMap.get(c.cardId)!,
        intent: c
      }));

      let result: { valid: true; meld: ResolvedMeld } | { valid: false; error: ValidationError };
      if (req.type === 'set') {
        result = validateSet(cardItems, req.count);
      } else if (req.type === 'run') {
        result = validateRun(cardItems, req.count);
      } else {
        result = validateColorGroup(cardItems, req.count);
      }

      if (!result.valid) {
        matches = false;
        lastError = result.error;
        break;
      }

      currentResolved[meldIndex] = result.meld;
    }

    if (matches) {
      bestResolved = currentResolved;
      break;
    }
  }

  if (!bestResolved) {
    return {
      valid: false,
      error: lastError
    };
  }

  return {
    valid: true,
    resolvedMelds: bestResolved
  };
}

/**
 * Validates a "Hit" action (adding a card to an existing table meld).
 */
export function validateHit(
  targetMeld: Meld,
  card: Card,
  playerHasLaidDown: boolean,
  intent?: { representedValue?: number; representedColor?: CardColor }
): { valid: true; updatedMeld: Meld } | { valid: false; error: ValidationError } {
  if (!playerHasLaidDown) {
    return {
      valid: false,
      error: {
        code: 'HIT_BEFORE_PHASE',
        message: 'You cannot hit on melds until you have laid down your own phase this round.'
      }
    };
  }

  if (card.type === 'skip') {
    return {
      valid: false,
      error: {
        code: 'SKIP_CANNOT_HIT',
        message: 'Skip cards cannot be added to any meld.'
      }
    };
  }

  const updatedMeld: Meld = {
    ...targetMeld,
    cards: [...targetMeld.cards]
  };

  if (targetMeld.type === 'set') {
    const targetNumber = targetMeld.targetNumber!;
    if (card.type === 'number' && card.value !== targetNumber) {
      return {
        valid: false,
        error: {
          code: 'SET_HIT_MISMATCH',
          message: `This set is for ${targetNumber}s. You cannot play a ${card.value} here.`
        }
      };
    }

    updatedMeld.cards.push({
      cardId: card.id,
      representedValue: targetNumber,
      representedColor: card.color
    });

    return { valid: true, updatedMeld };
  }

  if (targetMeld.type === 'color_group') {
    const targetColor = targetMeld.targetColor!;
    if (card.type === 'number' && card.color !== targetColor) {
      return {
        valid: false,
        error: {
          code: 'COLOR_HIT_MISMATCH',
          message: `This color group is for ${targetColor} cards. You cannot play a ${card.color} card here.`
        }
      };
    }

    updatedMeld.cards.push({
      cardId: card.id,
      representedValue: card.value,
      representedColor: targetColor
    });

    return { valid: true, updatedMeld };
  }

  if (targetMeld.type === 'run') {
    const minVal = targetMeld.minRunValue!;
    const maxVal = targetMeld.maxRunValue!;

    let assignedValue: number;

    if (card.type === 'number') {
      assignedValue = card.value!;
    } else {
      // Card is Wild
      if (intent?.representedValue !== undefined) {
        assignedValue = intent.representedValue;
      } else {
        // If not explicitly provided, see if only one end is valid
        const canLow = minVal > 1;
        const canHigh = maxVal < 12;

        if (canHigh && !canLow) {
          assignedValue = maxVal + 1;
        } else if (canLow && !canHigh) {
          assignedValue = minVal - 1;
        } else if (canHigh && canLow) {
          // If both are possible, default to extending higher
          assignedValue = maxVal + 1;
        } else {
          return {
            valid: false,
            error: {
              code: 'RUN_CANNOT_EXTEND',
              message: 'This run already spans from 1 to 12 and cannot be extended further.'
            }
          };
        }
      }
    }

    // Check bounds 1-12
    if (assignedValue < 1 || assignedValue > 12) {
      return {
        valid: false,
        error: {
          code: 'RUN_OUT_OF_BOUNDS',
          message: `Runs cannot go below 1 or above 12. ${assignedValue} is not allowed.`
        }
      };
    }

    // Check if it extends minVal - 1 or maxVal + 1
    if (assignedValue === minVal - 1) {
      // Extends low end
      updatedMeld.cards.unshift({
        cardId: card.id,
        representedValue: assignedValue,
        representedColor: card.color
      });
      updatedMeld.minRunValue = assignedValue;
      return { valid: true, updatedMeld };
    } else if (assignedValue === maxVal + 1) {
      // Extends high end
      updatedMeld.cards.push({
        cardId: card.id,
        representedValue: assignedValue,
        representedColor: card.color
      });
      updatedMeld.maxRunValue = assignedValue;
      return { valid: true, updatedMeld };
    } else {
      return {
        valid: false,
        error: {
          code: 'RUN_HIT_NOT_ADJACENT',
          message: `This run currently spans ${minVal} to ${maxVal}. You can only hit with ${minVal > 1 ? minVal - 1 : 'none'} or ${maxVal < 12 ? maxVal + 1 : 'none'}. ${assignedValue} does not connect.`
        }
      };
    }
  }

  return {
    valid: false,
    error: {
      code: 'UNKNOWN_MELD_TYPE',
      message: 'Unknown meld type.'
    }
  };
}
