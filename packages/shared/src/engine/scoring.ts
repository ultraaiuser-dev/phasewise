import { Card, getCardPointValue } from '../types/cards.js';
import { GameSettings, GameState, Player, RoundSummary } from '../types/game.js';

export function calculateHandScore(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + getCardPointValue(card), 0);
}

export interface RoundEndResult {
  nextRoundNumber: number;
  dealerIndex: number;
  players: Player[];
  isGameOver: boolean;
  winnerIds?: string[];
  summary: RoundSummary;
}

export function evaluateRoundEnd(state: GameState, outPlayerId: string): RoundEndResult {
  const targetFinalPhase = state.settings.shortGame ? 5 : 10;
  const outPlayer = state.players.find(p => p.id === outPlayerId)!;

  const playerScores = state.players.map(player => {
    const isOut = player.id === outPlayerId;
    const roundScore = isOut ? 0 : calculateHandScore(player.hand);
    const completedPhase = player.phaseCompletedThisRound;
    const nextPhase = completedPhase ? player.phase + 1 : player.phase;
    const totalScore = player.score + roundScore;

    return {
      playerId: player.id,
      playerName: player.name,
      phase: player.phase,
      completedPhase,
      nextPhase,
      roundScore,
      totalScore,
      handRemaining: [...player.hand]
    };
  });

  const updatedPlayers: Player[] = state.players.map(player => {
    const summaryItem = playerScores.find(s => s.playerId === player.id)!;
    return {
      ...player,
      score: summaryItem.totalScore,
      roundScore: summaryItem.roundScore,
      phase: summaryItem.nextPhase,
      phaseCompletedThisRound: false,
      hasLaidDownPhase: false,
      hand: [],
      skipTurns: 0
    };
  });

  // Check game over condition:
  // The game ends after a round in which at least one player completed Phase 10 (or targetFinalPhase).
  // Winner is the player who completed targetFinalPhase with the lowest total score.
  // If several complete targetFinalPhase in the same round, lowest total score wins; further tie is shared draw.
  const completedFinalPhasePlayers = playerScores.filter(
    s => s.phase === targetFinalPhase && s.completedPhase
  );

  let isGameOver = false;
  let winnerIds: string[] | undefined;

  if (completedFinalPhasePlayers.length > 0) {
    isGameOver = true;
    let minScore = Math.min(...completedFinalPhasePlayers.map(p => p.totalScore));
    const winners = completedFinalPhasePlayers
      .filter(p => p.totalScore === minScore)
      .map(p => p.playerId);
    winnerIds = winners;
  }

  const nextDealerIndex = (state.dealerIndex + 1) % state.players.length;

  return {
    nextRoundNumber: state.roundNumber + 1,
    dealerIndex: nextDealerIndex,
    players: updatedPlayers,
    isGameOver,
    winnerIds,
    summary: {
      roundNumber: state.roundNumber,
      outPlayerId,
      outPlayerName: outPlayer.name,
      playerScores
    }
  };
}
