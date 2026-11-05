import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { EMOJI_REACTIONS, EmojiReaction } from '@phasewise/shared';
import { ScrollText, ChevronDown, ChevronUp, Smile } from 'lucide-react';

export const ActionLog: React.FC = () => {
  const { gameState, sendReaction, actionLogOpen, setActionLogOpen } = useGameStore();
  const [reactionCooldown, setReactionCooldown] = useState(false);

  if (!gameState) return null;

  const logs = gameState.actionLog.slice(-15).reverse();

  const handleReaction = (emoji: EmojiReaction) => {
    if (reactionCooldown) return;
    sendReaction(emoji);
    setReactionCooldown(true);
    setTimeout(() => setReactionCooldown(false), 3000);
  };

  return (
    <div className="fixed bottom-3 right-3 z-30 max-w-xs sm:max-w-sm w-full pointer-events-auto">
      {/* Collapsed Bar / Trigger */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden">
        <div
          onClick={() => setActionLogOpen(!actionLogOpen)}
          className="flex items-center justify-between p-2.5 px-3.5 cursor-pointer hover:bg-slate-800/50 transition text-xs font-semibold text-slate-300"
        >
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-amber-400" />
            <span>Game Log ({logs.length})</span>
          </div>
          {actionLogOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>

        {/* Expanded Feed */}
        {actionLogOpen && (
          <div className="p-3 border-t border-slate-800 space-y-2">
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px] leading-relaxed text-slate-300">
              {logs.map(log => (
                <div key={log.id} className="p-1 rounded hover:bg-slate-800/40 transition">
                  <span className="text-slate-500 mr-1.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>

            {/* Quick Emoji Reactions Bar */}
            <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between gap-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <Smile className="w-3 h-3 text-amber-400" /> React:
              </span>
              <div className="flex items-center gap-1">
                {EMOJI_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    disabled={reactionCooldown}
                    className="p-1 text-sm hover:scale-125 disabled:opacity-30 disabled:scale-100 transition active:scale-95"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
