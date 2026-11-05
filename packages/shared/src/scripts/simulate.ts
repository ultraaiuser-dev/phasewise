import {
  createInitialState,
  startRound,
  applyAction,
  getBotMove,
  TOTAL_CARDS,
  GameState,
  Player
} from '../index.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Simulation assertion failed: ${msg}`);
  }
}

function verifyInvariants(state: GameState) {
  if (state.status !== 'playing') return;

  // 1. Verify card conservation: 108 cards total
  const handCards = state.players.flatMap(p => p.hand);
  const discardCards = state.discardPile;
  const drawCards = state.drawPile;
  const meldCards = state.tableMelds.flatMap(m => m.cards);

  const totalCardsInPlay = handCards.length + discardCards.length + drawCards.length + meldCards.length;

  assert(
    totalCardsInPlay === TOTAL_CARDS,
    `Card conservation violated! Expected ${TOTAL_CARDS}, got ${totalCardsInPlay} in round ${state.roundNumber}`
  );

  // 2. No duplicate card IDs
  const allIds = [
    ...handCards.map(c => c.id),
    ...discardCards.map(c => c.id),
    ...drawCards.map(c => c.id),
    ...meldCards.map(c => c.cardId)
  ];
  const uniqueIds = new Set(allIds);
  assert(
    uniqueIds.size === allIds.length,
    `Duplicate card ID detected! Unique: ${uniqueIds.size}, Total: ${allIds.length}`
  );
}

export function runSimulation(numGames = 1000) {
  console.log(`\n============================================================`);
  console.log(` Starting Phasewise Simulation: ${numGames} Full Headless Bot Games`);
  console.log(`============================================================\n`);

  const startTime = Date.now();
  let totalRounds = 0;
  let totalTurns = 0;

  for (let gameIdx = 1; gameIdx <= numGames; gameIdx++) {
    const numPlayers = Math.floor(Math.random() * 5) + 2; // 2 to 6 players
    const shortGame = Math.random() < 0.3; // 30% short games (5 phases)

    const hostName = `Bot-1`;
    let state = createInitialState(`SIM-${gameIdx}`, { id: 'bot-1', name: hostName });
    state.settings.shortGame = shortGame;

    // Add remaining bot players
    for (let p = 2; p <= numPlayers; p++) {
      const botPlayer: Player = {
        id: `bot-${p}`,
        name: `Bot-${p}`,
        seatIndex: p - 1,
        phase: 1,
        phaseCompletedThisRound: false,
        hasLaidDownPhase: false,
        score: 0,
        roundScore: 0,
        hand: [],
        isAway: false,
        isHost: false,
        isBot: true,
        skipTurns: 0
      };
      state.players.push(botPlayer);
    }

    // Start game
    state = startRound(state);
    verifyInvariants(state);

    let gameTurns = 0;
    const MAX_GAME_TURNS = 3000;

    while (state.status !== 'game_over') {
      gameTurns++;
      totalTurns++;

      if (gameTurns > MAX_GAME_TURNS) {
        throw new Error(
          `Game ${gameIdx} exceeded maximum turn limit (${MAX_GAME_TURNS}). Potential infinite loop.`
        );
      }

      if (state.status === 'round_end') {
        totalRounds++;
        const nextRoundRes = applyAction(state, state.players[0].id, { type: 'START_NEXT_ROUND' });
        assert(!('error' in nextRoundRes), `Failed to start next round: ${JSON.stringify(nextRoundRes)}`);
        state = (nextRoundRes as { state: GameState }).state;
        verifyInvariants(state);
        continue;
      }

      const activeId = state.currentTurnPlayerId;
      const botMove = getBotMove(state, activeId);
      const actionRes = applyAction(state, activeId, botMove);

      if ('error' in actionRes) {
        throw new Error(
          `Illegal move produced by bot in game ${gameIdx}, turn ${gameTurns}: ${actionRes.error.code} - ${actionRes.error.message}`
        );
      }

      state = actionRes.state;
      verifyInvariants(state);
    }

    totalRounds += state.roundNumber;

    if (gameIdx % 100 === 0 || gameIdx === numGames) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgTurns = (totalTurns / gameIdx).toFixed(1);
      console.log(
        `✓ Games completed: ${gameIdx}/${numGames} (${elapsed}s elapsed, avg ${avgTurns} turns/game, winners: ${state.winnerIds?.join(', ')})`
      );
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n============================================================`);
  console.log(` Simulation SUCCESS: All ${numGames} games completed without errors.`);
  console.log(` Total time: ${durationSec}s`);
  console.log(` Total rounds played: ${totalRounds}`);
  console.log(` Total turns played: ${totalTurns}`);
  console.log(` Avg turns per game: ${(totalTurns / numGames).toFixed(1)}`);
  console.log(`============================================================\n`);
}

// Run when executed directly
if (process.argv[1]?.includes('simulate')) {
  const count = process.env.SIM_GAMES ? parseInt(process.env.SIM_GAMES, 10) : 1000;
  runSimulation(count);
}
