import React from 'react';
import { PHASES } from '@phasewise/shared';
import { X, Award, HelpCircle } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <h2 id="rules-modal-title" className="text-xl font-bold text-slate-100">
              Rules & Phase Reference
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close rules"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-sm text-slate-300">
          {/* The 10 Phases Table */}
          <section>
            <h3 className="text-base font-bold text-amber-300 mb-2.5 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> The 10 Phases
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-800/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Phase</th>
                    <th className="py-2.5 px-3">Requirement</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Cards Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {PHASES.map(phase => {
                    const totalRequiredCards = phase.requirements.reduce((sum, r) => sum + r.count, 0);
                    return (
                      <tr key={phase.number} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">{phase.title}</td>
                        <td className="py-2 px-3 font-medium text-slate-200">{phase.description}</td>
                        <td className="py-2 px-3 text-slate-400 hidden sm:table-cell">{totalRequiredCards} cards</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Scoring Table */}
          <section>
            <h3 className="text-base font-bold text-amber-300 mb-2.5">Scoring System</h3>
            <p className="text-xs text-slate-400 mb-2">
              The player who goes out scores 0 points. All other players score the sum of cards remaining in their hand:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="font-bold text-slate-200">Cards 1 to 9</div>
                <div className="text-lg font-mono font-black text-emerald-400">5 pts</div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="font-bold text-slate-200">Cards 10 to 12</div>
                <div className="text-lg font-mono font-black text-amber-400">10 pts</div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="font-bold text-slate-200">Skip Card</div>
                <div className="text-lg font-mono font-black text-purple-400">15 pts</div>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="font-bold text-slate-200">Wild Card</div>
                <div className="text-lg font-mono font-black text-rose-400">25 pts</div>
              </div>
            </div>
          </section>

          {/* Key Rule Highlights */}
          <section className="bg-slate-800/50 p-4 rounded-xl border border-slate-800 space-y-2 text-xs leading-relaxed">
            <h4 className="font-bold text-slate-200 text-sm">Key Gameplay Rules</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>
                <strong className="text-slate-100">Runs do not wrap:</strong> 12 does not connect to 1.
              </li>
              <li>
                <strong className="text-slate-100">Naturals required:</strong> Every meld must contain at least one natural (non-Wild) card.
              </li>
              <li>
                <strong className="text-slate-100">Hitting:</strong> You can only hit on table melds after you have laid down your own phase for the round.
              </li>
              <li>
                <strong className="text-slate-100">Going out:</strong> A player going out must have laid down their phase.
              </li>
              <li>
                <strong className="text-slate-100">Winning:</strong> When a player completes Phase 10 (or Phase 5 in Short Game), the player with the lowest total score wins!
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold rounded-xl border border-slate-700 transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
