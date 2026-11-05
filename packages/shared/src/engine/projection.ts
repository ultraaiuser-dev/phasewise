import { ClientGameState, GameState, PublicPlayer } from '../types/game.js';

/**
 * Projects full authoritative server GameState into ClientGameState for a specific player.
 * Guarantees hand privacy:
 * - Opponents' hands are NEVER sent (cardCount only)
 * - Draw pile contents and order are NEVER sent (drawPileCount only)
 */
export function projectStateForPlayer(state: GameState, playerId: string): ClientGameState {
  const viewingPlayer = state.players.find(p => p.id === playerId);

  const publicPlayers: PublicPlayer[] = state.players.map(p => {
    const isMe = p.id === playerId;
    return {
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      phase: p.phase,
      phaseCompletedThisRound: p.phaseCompletedThisRound,
      hasLaidDownPhase: p.hasLaidDownPhase,
      score: p.score,
      roundScore: p.roundScore,
      cardCount: p.hand.length,
      isAway: p.isAway,
      isHost: p.isHost,
      isBot: p.isBot,
      skipTurns: p.skipTurns,
      hand: isMe ? p.hand : undefined
    };
  });

  return {
    roomId: state.roomId,
    status: state.status,
    settings: state.settings,
    players: publicPlayers,
    myPlayerId: playerId,
    myHand: viewingPlayer ? [...viewingPlayer.hand] : [],
    currentTurnPlayerId: state.currentTurnPlayerId,
    turnStage: state.turnStage,
    dealerIndex: state.dealerIndex,
    roundNumber: state.roundNumber,
    drawPileCount: state.drawPile.length,
    discardPile: [...state.discardPile],
    tableMelds: state.tableMelds,
    winnerIds: state.winnerIds,
    actionLog: state.actionLog,
    version: state.version,
    roundSummary: state.roundSummary
  };
}
