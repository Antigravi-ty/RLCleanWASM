import React from 'react';
import { Loader2, Clock, Wifi } from 'lucide-react';

export interface JoinTabProps {
  isLight: boolean;
  isLoading: boolean;
  joinRoomId: string;
  onChangeJoinRoomId: (roomId: string) => void;
  onJoinRoom: () => void;
  currentStep: number;
  totalSteps: number;
  countdown: number;
  stepName?: string;
  stepPercentage: number;
}

export const JoinTab: React.FC<JoinTabProps> = ({
  isLight,
  isLoading,
  joinRoomId,
  onChangeJoinRoomId,
  onJoinRoom,
  currentStep,
  totalSteps,
  countdown,
  stepName,
  stepPercentage,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-xs">
        <label className="text-neutral-400 font-semibold font-mono text-[11px]">
          ENTER HOST ROOM CODE:
        </label>
        <input
          type="text"
          disabled={isLoading}
          placeholder="e.g. 4371 or custom-room"
          value={joinRoomId}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^\x21-\x7E]/g, '');
            onChangeJoinRoomId(clean);
          }}
          maxLength={32}
          className={`w-full px-3 py-2.5 rounded-xl border font-mono text-base tracking-wider outline-none text-center transition-all ${
            isLight
              ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-sky-500'
              : 'bg-neutral-850 border-neutral-700 text-sky-400 focus:border-sky-500'
          }`}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        Connect to host&apos;s room code via signaling server. Full predictive vehicle physics and network smoothing will be enabled.
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
            {stepName || 'Connecting to signaling server and establishing WebRTC peer connection...'}
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
        onClick={onJoinRoom}
        className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm ${
          isLoading
            ? 'bg-sky-600/60 text-white cursor-wait'
            : 'bg-sky-500 hover:bg-sky-400 text-white'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Joining ({countdown}s)...</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>Join Room</span>
          </>
        )}
      </button>
    </div>
  );
};
