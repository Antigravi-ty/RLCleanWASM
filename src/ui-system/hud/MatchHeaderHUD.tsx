import React from 'react';
import { useHudStore } from '../../stores/hudStore';
import { useAppStore } from '../../stores/appStore';

export interface MatchHeaderHUDProps {
  className?: string;
  isLight?: boolean;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/**
 * MatchHeaderHUD
 * Lightweight top-center scoreboard and match timer.
 * Follows minimal TelemetryHUD design: monospaced, transparent background, raw metrics.
 */
export const MatchHeaderHUD: React.FC<MatchHeaderHUDProps> = ({
  className = '',
  isLight = false,
}) => {
  const blueScore = useHudStore((s) => s.blueScore);
  const orangeScore = useHudStore((s) => s.orangeScore);
  const remainingSeconds = useHudStore((s) => s.remainingSeconds);
  const overtimeSeconds = useHudStore((s) => s.overtimeSeconds);
  const isOvertime = useHudStore((s) => s.isOvertime);
  const kickoffCountdown = useHudStore((s) => s.kickoffCountdown);
  const matchPhase = useHudStore((s) => s.matchPhase);
  const winner = useHudStore((s) => s.winner);
  const winReason = useHudStore((s) => s.winReason);

  const replayProgress = useHudStore((s) => s.replayProgress);
  const replayFrameIndex = useHudStore((s) => s.replayFrameIndex);
  const replayTotalFrames = useHudStore((s) => s.replayTotalFrames);
  const replayPaused = useHudStore((s) => s.replayPaused);
  const replayPersistent = useHudStore((s) => s.replayPersistent);
  const replaySpeed = useHudStore((s) => s.replaySpeed);
  const replayCameraMode = useHudStore((s) => s.replayCameraMode);
  const replayScorerName = useHudStore((s) => s.replayScorerName);
  const replayScorerTeam = useHudStore((s) => s.replayScorerTeam);
  const replayBallSpeedKph = useHudStore((s) => s.replayBallSpeedKph);
  const replayAssistName = useHudStore((s) => s.replayAssistName);
  const onReplaySeekNormalized = useHudStore((s) => s.onReplaySeekNormalized);
  const onReplayTogglePause = useHudStore((s) => s.onReplayTogglePause);
  const onReplayCycleSpeed = useHudStore((s) => s.onReplayCycleSpeed);
  const onReplayToggleCameraMode = useHudStore((s) => s.onReplayToggleCameraMode);

  const isBlueWin = winner === 0 || winner === 'BLUE';
  const isOrangeWin = winner === 1 || winner === 'ORANGE';

  return (
    <div
      data-ui-element="match-header-hud"
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none flex flex-col items-center gap-1.5 ${className}`}
    >
      <div
        className={`px-4 py-1.5 rounded-xl border font-mono text-[13px] flex items-center gap-3 backdrop-blur-md shadow-lg transition-colors ${
          isLight
            ? 'bg-neutral-100/90 border-neutral-300 text-neutral-800'
            : 'bg-neutral-900/85 border-neutral-700/80 text-neutral-200'
        }`}
      >
        {/* Blue Team Score */}
        <span className="font-bold text-sky-400">
          BLUE {blueScore}
        </span>

        <span className="text-neutral-500 font-sans text-xs">-</span>

        {/* Orange Team Score */}
        <span className="font-bold text-amber-500">
          {orangeScore} ORANGE
        </span>

        <span className="text-neutral-600">|</span>

        {/* Timer */}
        <span
          data-testid="match-timer"
          className={`font-semibold tracking-wider ${
            isOvertime
              ? 'text-amber-400 font-bold'
              : isLight
              ? 'text-neutral-950 font-bold'
              : 'text-neutral-100'
          }`}
        >
          {isOvertime ? `+${formatTime(overtimeSeconds || 0)}` : formatTime(remainingSeconds)}
        </span>

        <span className="text-neutral-600">|</span>

        {/* Match Phase / Kickoff / Overtime / Winner Indicator */}
        {matchPhase === 'ended' || matchPhase === 'podium' ? (
          <div className="flex items-center gap-2">
            <span
              data-testid="match-winner"
              className={`font-black uppercase tracking-wider animate-pulse ${
                isBlueWin
                  ? 'text-sky-400 font-extrabold'
                  : isOrangeWin
                  ? 'text-amber-400 font-extrabold'
                  : isLight
                  ? 'text-neutral-900 font-bold'
                  : 'text-neutral-200 font-bold'
              }`}
            >
              {isBlueWin ? 'BLUE WINS!' : isOrangeWin ? 'ORANGE WINS!' : 'DRAW!'}
              {winReason && winReason !== 'SCORE' ? ` (${winReason})` : ''}
            </span>
            <button
              type="button"
              onClick={() => useAppStore.getState().bridge.onVoteRematch?.(true)}
              className="pointer-events-auto px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase cursor-pointer transition-colors"
            >
              Rematch Ready
            </button>
            <button
              type="button"
              onClick={() => useAppStore.getState().bridge.onReturnToFreeplay?.()}
              className="pointer-events-auto px-2 py-0.5 rounded bg-neutral-700/60 hover:bg-neutral-600/80 border border-neutral-500/40 text-neutral-200 text-[10px] font-bold uppercase cursor-pointer transition-colors"
            >
              Exit Room
            </button>
          </div>
        ) : matchPhase === 'replay' || matchPhase === 'goal' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-extrabold text-rose-400 animate-pulse">
              {matchPhase === 'goal' ? 'GOAL SCORED' : 'GOAL REPLAY'}
            </span>
            {matchPhase === 'replay' && (
              <>
                <button
                  type="button"
                  onClick={() => onReplayTogglePause?.()}
                  className="pointer-events-auto px-1.5 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-600/60 text-neutral-200 text-[10px] font-bold uppercase cursor-pointer transition-colors"
                >
                  {replayPaused ? '[P] Play' : '[P] Pause'}
                </button>
                {onReplayToggleCameraMode && (
                  <button
                    type="button"
                    onClick={() => onReplayToggleCameraMode?.()}
                    className="pointer-events-auto px-1.5 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-600/60 text-amber-300 text-[10px] font-bold uppercase cursor-pointer transition-colors"
                  >
                    Cam: {replayCameraMode === 'director' ? 'Director' : 'POV'}
                  </button>
                )}
                {(replayPersistent || replayPaused) && (
                  <button
                    type="button"
                    onClick={() => onReplayCycleSpeed?.()}
                    className="pointer-events-auto px-1.5 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-600/60 text-sky-300 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    {replaySpeed}x
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => useAppStore.getState().bridge.onVoteSkipReplay?.()}
              className="pointer-events-auto px-2 py-0.5 rounded bg-neutral-700/60 hover:bg-neutral-600/80 border border-neutral-500/40 text-neutral-200 text-[10px] font-bold uppercase cursor-pointer transition-colors"
            >
              Skip Replay
            </button>
          </div>
        ) : matchPhase === 'prepare' ? (
          <span className="text-xs uppercase tracking-wider font-bold text-sky-400 animate-pulse">
            SYNCING ARENA...
          </span>
        ) : kickoffCountdown > 0 ? (
          <span
            data-testid="kickoff-countdown"
            className={`font-black animate-pulse ${
              isOvertime
                ? 'text-amber-400 font-extrabold'
                : isLight
                ? 'text-black font-extrabold'
                : 'text-emerald-400'
            }`}
          >
            {isOvertime ? `OT KICKOFF: ${kickoffCountdown}` : `KICKOFF: ${kickoffCountdown}`}
          </span>
        ) : isOvertime ? (
          <span
            data-testid="overtime-indicator"
            className="text-xs uppercase tracking-wider font-extrabold text-amber-400 animate-pulse"
          >
            OVERTIME
          </span>
        ) : (
          <span
            className={`text-xs uppercase tracking-wide font-medium ${
              isLight ? 'text-neutral-700' : 'text-neutral-400'
            }`}
          >
            {matchPhase}
          </span>
        )}
      </div>

      {/* Goal Scorer, Ball Speed & Assist Telemetry Pill */}
      {(matchPhase === 'goal' || matchPhase === 'replay') && (replayScorerName || typeof replayBallSpeedKph === 'number') && (
        <div
          data-testid="goal-telemetry-banner"
          className={`px-3.5 py-1 rounded-lg border font-mono text-[11px] flex items-center gap-3 backdrop-blur-md shadow-md ${
            isLight
              ? 'bg-white/90 border-neutral-300 text-neutral-800'
              : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-200'
          }`}
        >
          {replayScorerName && (
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 uppercase text-[10px]">Scorer:</span>
              <span
                className={`font-extrabold uppercase ${
                  replayScorerTeam === 0
                    ? 'text-sky-400'
                    : replayScorerTeam === 1
                    ? 'text-amber-400'
                    : isLight
                    ? 'text-neutral-900'
                    : 'text-white'
                }`}
              >
                {replayScorerName}
              </span>
            </div>
          )}
          {typeof replayBallSpeedKph === 'number' && (
            <>
              {replayScorerName && <span className="text-neutral-600">|</span>}
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 uppercase text-[10px]">Speed:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {replayBallSpeedKph} KM/H
                </span>
              </div>
            </>
          )}
          {replayAssistName && (
            <>
              <span className="text-neutral-600">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 uppercase text-[10px]">Assist:</span>
                <span className="font-semibold text-neutral-200 uppercase">
                  {replayAssistName}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Interactive Replay Timeline Scrubber Bar (Revealed when P is pressed: Pause & Persistent) */}
      {matchPhase === 'replay' && (replayPersistent || replayPaused) && (
        <div
          data-testid="replay-timeline-scrubber"
          className="pointer-events-auto px-3 py-1 rounded-lg bg-neutral-900/85 border border-neutral-700/80 backdrop-blur-md flex items-center gap-2.5 font-mono text-[10px] text-neutral-300 shadow-md"
        >
          <span className="text-rose-400 font-bold">SCRUB</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round((replayProgress || 0) * 1000)}
            onChange={(e) => {
              const norm = Number(e.target.value) / 1000;
              onReplaySeekNormalized?.(norm);
            }}
            className="w-36 h-1.5 accent-rose-500 cursor-pointer"
          />
          <span className="text-neutral-400 tabular-nums">
            {replayFrameIndex}/{Math.max(1, replayTotalFrames)}
          </span>
        </div>
      )}

      {/* Post-Match Podium Celebration Sub-Banner */}
      {(matchPhase === 'podium' || matchPhase === 'ended') && (
        <div
          data-testid="podium-celebration-banner"
          className="px-3 py-0.5 rounded-lg bg-neutral-900/75 border border-neutral-700/60 font-mono text-[10px] text-neutral-300 tracking-wide"
        >
          PODIUM SHOWCASE — JUMP / BOOST / AIR ROLL TO CELEBRATE
        </div>
      )}
    </div>
  );
};

