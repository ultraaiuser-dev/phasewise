import React from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { X, Trophy, Crown, UserCheck, WifiOff } from 'lucide-react';

export const ScoreboardModal: React.FC = () => {
  const { scoreboardOpen, setScoreboardOpen, gameState, playerId } = useGameStore();

  if (!scoreboardOpen || !gameState) return null;

  const sortedPlayers = [...gameState.players].sort((a, b) => {
    // Highest phase first, then lowest score
    if (b.phase !== a.phase) return b.phase - a.phase;
    return a.score - b.score;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scoreboard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 id="scoreboard-title" className="text-xl font-bold">
              Scoreboard
            </h2>
          </div>
          <button
            onClick={() => setScoreboardOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close scoreboard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800 mb-4">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-800/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3">Phase</th>
                <th className="py-2.5 px-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedPlayers.map((p, idx) => {
                const isMe = p.id === playerId;
                return (
                  <tr
                    key={p.id}
                    className={`transition ${isMe ? 'bg-amber-500/10 font-bold' : 'hover:bg-slate-800/40'}`}
                  >
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">#{idx + 1}</span>
                      <span className="text-slate-200">
                        {p.name} {isMe && <span className="text-amber-400 text-xs">(You)</span>}
                      </span>
                      {p.isHost && (
                        <span title="Host">
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </span>
                      )}
                      {p.isAway && (
                        <span title="Away">
                          <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
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

        <div className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
          💡 Lowest cumulative score wins when someone completes Phase 10!
        </div>
      </div>
    </div>
  );
};
