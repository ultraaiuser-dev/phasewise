import { preferences } from '../stores/preferences.js';
import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { GAME_TITLE } from '@phasewise/shared';
import { Play, Users, Bot, BookOpen, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onOpenTutorial: () => void;
  onOpenRules: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenTutorial, onOpenRules }) => {
  const { createOnlineRoom, joinOnlineRoom, startPracticeGame, connecting, connectionError } = useGameStore();

  const [playerName, setPlayerName] = useState(preferences.get('pw_player_name') || '');
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showPracticeConfig, setShowPracticeConfig] = useState(false);
  const [practiceBots, setPracticeBots] = useState(2);
  const [practiceShortGame, setPracticeShortGame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    setErrorMsg(null);
    const res = await createOnlineRoom(playerName.trim());
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create room.');
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    if (!joinCode.trim()) {
      setErrorMsg('Please enter the 5-character room code.');
      return;
    }
    setErrorMsg(null);
    const res = await joinOnlineRoom(joinCode.trim(), playerName.trim());
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to join room.');
    }
  };

  const handlePracticeStart = () => {
    const name = playerName.trim() || 'You';
    preferences.set('pw_player_name', name);
    startPracticeGame(name, practiceBots, practiceShortGame);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center p-4 py-8">
      {/* Top Bar with rules button */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 font-mono shadow-md">
            PW
          </div>
          <span className="font-bold text-lg text-slate-200 tracking-tight">{GAME_TITLE}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" /> Rules
          </button>
          <button
            onClick={onOpenTutorial}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition"
          >
            <BookOpen className="w-4 h-4" /> How to Play · 2-minute tour
          </button>
        </div>
      </div>

      {/* Hero Content */}
      <div className="w-full max-w-md my-auto py-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight drop-shadow-md mb-2">
            {GAME_TITLE}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-xs mx-auto leading-relaxed">
            Multiplayer rummy-style 10 phases game. Play instantly in browser with friends or learn with bots!
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4">
          <div>
            <label htmlFor="player-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Your Name
            </label>
            <input
              id="player-name-input"
              type="text"
              maxLength={16}
              placeholder="e.g. Alex"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-semibold transition"
            />
          </div>

          {(errorMsg || connectionError) && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl font-medium">
              {errorMsg || connectionError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleCreate}
              disabled={connecting}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm sm:text-base shadow-xl transition flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              {connecting ? 'Creating Room...' : 'Create Multiplayer Room'}
            </button>

            {!showJoinInput ? (
              <button
                onClick={() => setShowJoinInput(true)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm border border-slate-700 transition"
              >
                Join with Room Code
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="5-letter code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 uppercase font-mono tracking-widest placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-bold text-center"
                />
                <button
                  onClick={handleJoin}
                  disabled={connecting}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-sm border border-slate-700 transition flex items-center gap-1"
                >
                  Join <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-xs text-slate-500 font-mono">OR</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Practice vs Bots */}
          {!showPracticeConfig ? (
            <button
              onClick={() => setShowPracticeConfig(true)}
              className="w-full py-3 bg-slate-800/60 hover:bg-slate-800 text-emerald-400 font-bold rounded-xl text-sm border border-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4" /> Practice vs Bots (Offline)
            </button>
          ) : (
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Number of Bots:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setPracticeBots(cnt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        practiceBots === cnt ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Short Game (5 Phases):</span>
                <input
                  type="checkbox"
                  checked={practiceShortGame}
                  onChange={e => setPracticeShortGame(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <button
                onClick={handlePracticeStart}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" /> Start Practice Game
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 space-y-1">
        <div>Open source multiplayer card game. No accounts, no installs, no tracking.</div>
        <div className="text-[11px] text-slate-600">
          Rules based on a well-known rummy-style card game. Not affiliated with Mattel.
        </div>
      </div>
    </div>
  );
};
