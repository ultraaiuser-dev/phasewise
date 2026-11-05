import { ScoreTally } from "./ScoreTally.js";
import React from "react";
import { useGameStore } from "../stores/gameStore.js";
import { CardView } from "./CardView.js";
import { Trophy, ArrowRight, RotateCcw, Crown, Play } from "lucide-react";
import {
  applyAction,
  startRound,
  projectStateForPlayer,
} from "@phasewise/shared";

export const RoundSummaryModal: React.FC = () => {
  const { gameState, playerId, mode, practiceFullState, socket } =
    useGameStore();

  if (
    !gameState ||
    gameState.status !== "round_end" ||
    !gameState.roundSummary
  ) {
    return null;
  }

  const summary = gameState.roundSummary;
  const isHost =
    gameState.players.find((p) => p.id === playerId)?.isHost ?? false;

  const handleNextRound = () => {
    if (mode === "practice" && practiceFullState) {
      const nextState = startRound(practiceFullState);
      useGameStore.setState({
        practiceFullState: nextState,
        selectedCardIds: [],
        handOrder: [],
        botBusy: nextState.currentTurnPlayerId !== playerId,
      });
      useGameStore
        .getState()
        .receiveState(projectStateForPlayer(nextState, playerId));
      if (nextState.currentTurnPlayerId !== playerId) {
        setTimeout(() => {
          const current = useGameStore.getState();
          if (current.practiceFullState === nextState)
            current.processPracticeBotTurns();
        }, 800);
      }
      return;
    }

    // Online game: host triggers next round
    socket?.emit("START_GAME"); // starts round
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-summary-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/20 rounded-full border border-amber-500/30 text-amber-400 mb-3">
            <Trophy className="w-8 h-8" />
          </div>
          <h2
            id="round-summary-title"
            className="text-2xl sm:text-3xl font-black text-slate-100"
          >
            Round {summary.roundNumber} Complete!
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            <span className="font-bold text-amber-400">
              {summary.outPlayerName}
            </span>{" "}
            went out and scored 0 points!
          </p>
        </div>

        {/* Players Score Cards */}
        <div className="space-y-3 mb-6">
          {summary.playerScores.map((scoreItem) => {
            const isMe = scoreItem.playerId === playerId;
            return (
              <div
                key={scoreItem.playerId}
                className={`p-4 rounded-2xl border transition ${
                  isMe
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-slate-800/60 border-slate-700/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-100">
                      {scoreItem.playerName}{" "}
                      {isMe && (
                        <span className="text-amber-400 text-xs font-mono">
                          (You)
                        </span>
                      )}
                    </span>
                    {scoreItem.completedPhase ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        Phase {scoreItem.phase} Complete!{" "}
                        <ArrowRight className="w-3 h-3" /> Phase{" "}
                        {scoreItem.nextPhase}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                        <RotateCcw className="w-3 h-3" /> Repeating Phase{" "}
                        {scoreItem.phase}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 mr-2">
                      Round: +{scoreItem.roundScore}
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-400">
                      Total:{" "}
                      <ScoreTally
                        from={scoreItem.totalScore - scoreItem.roundScore}
                        to={scoreItem.totalScore}
                      />{" "}
                      pts
                    </span>
                  </div>
                </div>

                {/* Remaining cards in hand */}
                {scoreItem.handRemaining.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-700/50">
                    <span className="text-xs text-slate-400 mr-1">
                      Remaining in hand:
                    </span>
                    {scoreItem.handRemaining.map((card, cIdx) => (
                      <CardView key={cIdx} card={card} small />
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold pt-1">
                    Empty hand (0 cards left)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Next Round Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {isHost
              ? "You are the host. Click below to start the next round."
              : "Waiting for host to start next round..."}
          </div>

          {(isHost || mode === "practice") && (
            <button
              onClick={handleNextRound}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg transition"
            >
              <Play className="w-5 h-5 fill-current" /> Next Round
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
