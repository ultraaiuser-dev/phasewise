import React, { useEffect } from 'react';

import { useGameStore } from '../stores/gameStore.js';
import { Trophy, RotateCcw, Crown, Award } from 'lucide-react';
import { soundManager } from '../audio/soundManager.js';

export const GameOverModal: React.FC = () => {
  const { gameState, playerId, leaveRoom, mode, startPracticeGame, playerName } = useGameStore();

  useEffect(() => {
    if (gameState?.status === 'game_over') {
      soundManager.playWin();
      if(useGameStore.getState().motionEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void import('canvas-confetti').then(({default:confetti})=>confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },disableForReducedMotion:true
        }));
      }
    }
  }, [gameState?.status]);

  if (!gameState || gameState.status !== 'game_over') {
    return null;
  }

  const winners = gameState.players.filter(p => gameState.winnerIds?.includes(p.id));
  const winnerNames = winners.map(w => w.name).join(' & ');
  const isMeWinner = winners.some(w => w.id === playerId);

  const sortedStandings = [...gameState.players].sort((a, b) => {
    if (b.phase !== a.phase) return b.phase - a.phase;
    return a.score - b.score;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-full border border-amber-500/40 text-amber-400 mb-4 shadow-lg animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>

        <h2 id="game-over-title" className="text-3xl sm:text-4xl font-black text-amber-400 mb-2">
          {isMeWinner ? '🎉 You Won! 🎉' : `🏆 ${winnerNames} Won! 🏆`}
        </h2>

        <p className="text-sm text-slate-300 mb-6">
          {gameState.settings.shortGame ? 'Short Game (Phase 5) Complete!' : 'Phase 10 Completed with the lowest total score!'}
        </p>

        {/* Final Standings Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 mb-6 text-left">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3">Final Phase</th>
                <th className="py-2.5 px-3 text-right">Final Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedStandings.map((p, idx) => {
                const isWinner = gameState.winnerIds?.includes(p.id);
                const isMe = p.id === playerId;
                return (
                  <tr
                    key={p.id}
                    className={`transition ${isWinner ? 'bg-amber-500/20 font-bold' : isMe ? 'bg-slate-800/60 font-semibold' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {isMe && <span className="text-xs text-amber-400">(You)</span>}
                      {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-400">
                      Phase {p.phase}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-emerald-400 font-bold">
                      {p.score} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Play Again & Leave Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              if (mode === 'practice') {
                startPracticeGame(playerName || 'You', 2, gameState.settings.shortGame);
              } else {
                leaveRoom();
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg transition"
          >
            <RotateCcw className="w-5 h-5" /> Play Again
          </button>
          <button
            onClick={leaveRoom}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition"
          >
            Back to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
