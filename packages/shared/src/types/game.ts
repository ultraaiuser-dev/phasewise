import { Card, Meld } from './cards.js';

export interface GameSettings {
  shortGame: boolean; // Stop after Phase 5
  turnTimerSeconds: 0 | 30 | 60 | 90;
}

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  phase: number;
  phaseCompletedThisRound: boolean;
  hasLaidDownPhase: boolean;
  score: number;
  roundScore: number;
  hand: Card[];
  isAway: boolean;
  isHost: boolean;
  isBot?: boolean;
  skipTurns: number; // If > 0, player loses their next turn
}

export interface PublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  phase: number;
  phaseCompletedThisRound: boolean;
  hasLaidDownPhase: boolean;
  score: number;
  roundScore: number;
  cardCount: number;
  isAway: boolean;
  isHost: boolean;
  isBot?: boolean;
  skipTurns: number;
  hand?: Card[]; // Only populated for the viewing client!
}

export type TurnStage = 'draw' | 'action';

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  playerId?: string;
  playerName?: string;
  text: string;
}

export interface GameState {
  roomId: string;
  status: 'lobby' | 'playing' | 'round_end' | 'game_over';
  settings: GameSettings;
  players: Player[];
  currentTurnPlayerId: string;
  turnStage: TurnStage;
  dealerIndex: number;
  roundNumber: number;
  drawPile: Card[];
  discardPile: Card[];
  tableMelds: Meld[];
  winnerIds?: string[];
  actionLog: ActionLogEntry[];
  version: number;
  roundSummary?: RoundSummary;
}

export interface RoundSummary {
  roundNumber: number;
  outPlayerId: string;
  outPlayerName: string;
  playerScores: {
    playerId: string;
    playerName: string;
    phase: number;
    completedPhase: boolean;
    nextPhase: number;
    roundScore: number;
    totalScore: number;
    handRemaining: Card[];
  }[];
}

/**
 * Projected state sent to a specific client.
 * Does NOT reveal other players' hands or draw pile order.
 */
export interface ClientGameState {
  roomId: string;
  status: 'lobby' | 'playing' | 'round_end' | 'game_over';
  settings: GameSettings;
  players: PublicPlayer[];
  myPlayerId: string;
  myHand: Card[];
  currentTurnPlayerId: string;
  turnStage: TurnStage;
  dealerIndex: number;
  roundNumber: number;
  drawPileCount: number;
  discardPile: Card[]; // Discard pile top is visible; client can inspect full discard pile
  tableMelds: Meld[];
  winnerIds?: string[];
  actionLog: ActionLogEntry[];
  version: number;
  roundSummary?: RoundSummary;
}
