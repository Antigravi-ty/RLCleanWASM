import React from 'react';
import { RefreshCw, Loader2, Clock, Server } from 'lucide-react';

export interface HostTabProps {
  isLight: boolean;
  isLoading: boolean;
  hostRoomId: string;
  onChangeHostRoomId: (roomId: string) => void;
  onRandomizeHostCode: () => void;
  onStartHosting: () => void;
  currentStep: number;
  totalSteps: number;
  countdown: number;
  stepName?: string;
  stepPercentage: number;
  roomType?: 'warmup' | 'match';
  onChangeRoomType?: (roomType: 'warmup' | 'match') => void;
  gameMode?: '1v1' | '2v2' | '3v3';
  onChangeGameMode?: (gameMode: '1v1' | '2v2' | '3v3') => void;
  botFillMode?: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom';
  onChangeBotFillMode?: (mode: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom') => void;
}

export const HostTab: React.FC<HostTabProps> = ({
  isLight,
  isLoading,
  hostRoomId,
  onChangeHostRoomId,
  onRandomizeHostCode,
  onStartHosting,
  currentStep,
  totalSteps,
  countdown,
  stepName,
  stepPercentage,
  roomType = 'warmup',
  onChangeRoomType,
  gameMode = '1v1',
  onChangeGameMode,
  botFillMode = 'no_bots',
  onChangeBotFillMode,
}) => {
  const isMatchLobby = roomType === 'match';

  return (
    <div className="flex flex-col gap-3">
      {onChangeRoomType && (
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-neutral-400 font-semibold font-mono text-[11px]">
            SESSION MODE:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChangeRoomType('warmup')}
              className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-bold font-mono cursor-pointer transition-all ${
                !isMatchLobby
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : isLight
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Warmup (Solid Collision)
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChangeRoomType('match')}
              className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-bold font-mono cursor-pointer transition-all ${
                isMatchLobby
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                  : isLight
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Multiplayer Match
            </button>
          </div>
        </div>
      )}

      {isMatchLobby && onChangeGameMode && (
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-neutral-400 font-semibold font-mono text-[11px]">
            MATCH FORMAT (LOBBY GHOST WARMUP + AUTO/ADMIN START):
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['1v1', '2v2', '3v3'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={isLoading}
                onClick={() => onChangeGameMode(mode)}
                className={`py-1.5 px-2 rounded-lg border text-xs font-bold font-mono cursor-pointer transition-all ${
                  gameMode === mode
                    ? 'bg-sky-500 text-white border-sky-400'
                    : isLight
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {mode === '1v1' ? '1v1 Duel' : mode === '2v2' ? '2v2 Doubles' : '3v3 Standard'}
              </button>
            ))}
          </div>
        </div>
      )}

      {isMatchLobby && onChangeBotFillMode && (
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-neutral-400 font-semibold font-mono text-[11px]">
            BOT FILL POLICY:
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'no_bots', label: 'No Bots' },
              { id: 'auto_fill', label: 'Auto-Fill' },
              { id: 'bots_vs_humans', label: 'Vs AI' },
              { id: 'custom', label: 'Custom' },
            ].map((policy) => (
              <button
                key={policy.id}
                type="button"
                disabled={isLoading}
                onClick={() => onChangeBotFillMode(policy.id as any)}
                className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-bold font-mono cursor-pointer transition-all ${
                  botFillMode === policy.id
                    ? 'bg-violet-500 text-white border-violet-400'
                    : isLight
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {policy.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <label className="text-neutral-400 font-semibold font-mono text-[11px]">
            ROOM CODE (4-DIGIT OR CUSTOM ASCII):
          </label>
          <button
            type="button"
            onClick={onRandomizeHostCode}
            disabled={isLoading}
            className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-mono cursor-pointer"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            <span>Randomize (4 Digits)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            disabled={isLoading}
            value={hostRoomId}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^\x21-\x7E]/g, '');
              onChangeHostRoomId(clean);
            }}
            placeholder="e.g. 4371 or custom-room"
            maxLength={32}
            className={`w-full px-4 py-2.5 rounded-xl border font-mono text-sm font-bold tracking-wider outline-none transition-all ${
              isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-sky-500'
                : 'bg-neutral-850 border-neutral-700 text-sky-400 focus:border-sky-500'
            }`}
          />
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        {isMatchLobby
          ? 'Players warm up as 70% opacity Ghost Cars in Lobby until the room fills or Host starts the match.'
          : 'Online Warmup enters shared Custom Training with real car & ball collisions and no match timer.'}
      </p>

      {isLoading && (
        <div
          className={`p-3 rounded-xl border flex flex-col gap-2 font-mono text-xs ${
            isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-sky-950/40 border-sky-500/30 text-sky-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              <span>Step {currentStep} of {totalSteps}</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1 font-bold">
              <Clock className="h-2.5 w-2.5" />
              <span>{countdown}s timeout</span>
            </span>
          </div>

          <p className="text-[11px] text-neutral-300 leading-snug">
            {stepName || 'Initializing dedicated 120Hz host server and binding to signaling...'}
          </p>

          <div className="w-full h-2 rounded-full bg-neutral-800 border border-neutral-700/80 overflow-hidden relative">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(56,189,248,0.5)]"
              style={{ width: `${stepPercentage}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={isLoading}
        onClick={onStartHosting}
        className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm ${
          isLoading
            ? 'bg-sky-600/60 text-white cursor-wait'
            : 'bg-sky-500 hover:bg-sky-400 text-white'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting ({countdown}s)...</span>
          </>
        ) : (
          <>
            <Server className="h-4 w-4" />
            <span>Start Hosting Room</span>
          </>
        )}
      </button>
    </div>
  );
};
