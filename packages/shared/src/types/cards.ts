export type CardColor = 'red' | 'blue' | 'green' | 'yellow';
export const CARD_COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];

export type CardType = 'number' | 'wild' | 'skip';

export interface Card {
  id: string;
  type: CardType;
  color?: CardColor;
  value?: number; // 1 to 12 for number cards
}

export interface MeldCard {
  cardId: string;
  // What this card represents in the meld (especially for Wilds)
  representedValue?: number;
  representedColor?: CardColor;
}

export type MeldType = 'set' | 'run' | 'color_group';

export interface Meld {
  id: string;
  type: MeldType;
  ownerId: string; // The player who originally laid down this meld
  cards: MeldCard[];
  // Resolved properties of the meld:
  targetNumber?: number; // for sets (e.g. set of 7s)
  targetColor?: CardColor; // for color groups (e.g. green)
  minRunValue?: number; // for runs (e.g. lowest number currently in run)
  maxRunValue?: number; // for runs (e.g. highest number currently in run)
}

/**
 * Point calculation based on card rules:
 * - 1-9: 5 points
 * - 10-12: 10 points
 * - Skip: 15 points
 * - Wild: 25 points
 */
export function getCardPointValue(card: Card): number {
  if (card.type === 'wild') return 25;
  if (card.type === 'skip') return 15;
  if (card.value !== undefined) {
    if (card.value >= 1 && card.value <= 9) return 5;
    if (card.value >= 10 && card.value <= 12) return 10;
  }
  return 0;
}
