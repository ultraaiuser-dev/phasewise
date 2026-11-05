import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { MIN_PLAYERS, MAX_PLAYERS } from '@phasewise/shared';
import { Copy, Share2, Crown, UserMinus, Play, ArrowLeft, Clock, Zap, Check } from 'lucide-react';

export const LobbyView: React.FC = () => {
  const { gameState, playerId, socket, leaveRoom } = useGameStore();
  const [copied, setCopied] = useState(false);

  if (!gameState || gameState.status !== 'lobby') return null;

  const isHost = gameState.players.find(p => p.id === playerId)?.isHost ?? false;
  const roomUrl = `${window.location.origin}/r/${gameState.roomId}`;
  const canStart = gameState.players.length >= MIN_PLAYERS && gameState.players.length <= MAX_PLAYERS;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Phasewise card game!',
          text: `Join room ${gameState.roomId} for a game of Phasewise!`,
          url: roomUrl
        });
      } catch (err) {}
    } else {
      handleCopyLink();
    }
  };

  const handleKick = (targetId: string) => {
    socket?.emit('KICK_PLAYER', { targetPlayerId: targetId });
  };

  const updateSetting = (shortGame?: boolean, timer?: 0 | 30 | 60 | 90) => {
    if (!isHost) return;
    socket?.emit('UPDATE_SETTINGS', {
      settings: {
        shortGame: shortGame !== undefined ? shortGame : gameState.settings.shortGame,
        turnTimerSeconds: timer !== undefined ? timer : gameState.settings.turnTimerSeconds
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={leaveRoom}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Leave Room
          </button>
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Game Lobby
          </span>
        </div>

        {/* Room Code & Share Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-1 font-semibold">Room Code</div>
          <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-amber-400 mb-3 selection:bg-amber-500">
            {gameState.roomId}
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition border border-slate-700"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied Link!' : 'Copy Invite Link'}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition border border-amber-500/30"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
          </div>
        </div>

        {/* Players List */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Players ({gameState.players.length} / {MAX_PLAYERS})
            </span>
            <span className="text-xs text-slate-500">Need at least {MIN_PLAYERS} to start</span>
          </div>

          <div className="space-y-2">
            {gameState.players.map(p => {
              const isMe = p.id === playerId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    isMe ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{p.name}</span>
                        {isMe && <span className="text-xs text-amber-400 font-mono">(You)</span>}
                        {p.isHost && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Crown className="w-3 h-3" /> Host
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isHost && !isMe && (
                    <button
                      onClick={() => handleKick(p.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Kick player"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Settings */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 mb-6 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Game Settings</div>

          {/* Short Game Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-sm font-semibold text-slate-200">Short Game (5 Phases)</div>
                <div className="text-xs text-slate-400">Stop after Phase 5 instead of Phase 10</div>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={gameState.settings.shortGame}
              onChange={e => updateSetting(e.target.checked, undefined)}
              className="w-5 h-5 accent-amber-500 rounded cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Turn Timer Selector */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-slate-200">Turn Timer</div>
                <div className="text-xs text-slate-400">Time limit per turn before safe auto-play</div>
              </div>
            </div>

            <select
              disabled={!isHost}
              value={gameState.settings.turnTimerSeconds}
              onChange={e => updateSetting(undefined, parseInt(e.target.value, 10) as any)}
              className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-200 disabled:opacity-50"
            >
              <option value={0}>Off (No timer)</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
            </select>
          </div>
        </div>

        {/* Start Game Action */}
        {isHost ? (
          <button
            onClick={() => socket?.emit('START_GAME')}
            disabled={!canStart}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black rounded-xl text-base shadow-xl transition flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            {canStart ? 'Start Game' : `Waiting for players (${gameState.players.length}/${MIN_PLAYERS} min)`}
          </button>
        ) : (
          <div className="text-center text-xs text-slate-400 py-2">
            Waiting for the host to start the game...
          </div>
        )}
      </div>
    </div>
  );
};
