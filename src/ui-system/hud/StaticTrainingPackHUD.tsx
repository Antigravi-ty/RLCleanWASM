import React from 'react';
import {
  useStaticTrainingPackStore,
  getActiveEditItemVariable,
} from '../../stores/staticTrainingPackStore';

export interface StaticTrainingPackHUDProps {
  isLight?: boolean;
}

/**
 * StaticTrainingPackHUD.tsx
 * Lightweight in-game overlay banner displayed when matchMode === 'static-training-pack'.
 * Shows:
 * - Play Mode: Shot index/name, remaining timeout timer (or overtime ground wait),
 *   Down Counter countdown / "Waiting for input", and [R] / [ / ] hotkeys.
 * - Edit Mode: Active 3D Edit Sub-Mode (1..4) with live Car/Ball telemetry and key hints.
 */
export const StaticTrainingPackHUD: React.FC<StaticTrainingPackHUDProps> = ({
  isLight = false,
}) => {
  const activePack = useStaticTrainingPackStore((s) => s.activePack);
  const sessionMode = useStaticTrainingPackStore((s) => s.sessionMode);
  const currentShotIndex = useStaticTrainingPackStore((s) => s.currentShotIndex);
  const editSubMode = useStaticTrainingPackStore((s) => s.editSubMode);
  const isEditingItem = useStaticTrainingPackStore((s) => s.isEditingItem);
  const editVarVersion = useStaticTrainingPackStore((s) => s.editVarVersion);
  const downCounterEnabled = useStaticTrainingPackStore((s) => s.downCounterEnabled);
  const remainingTimeoutSec = useStaticTrainingPackStore((s) => s.remainingTimeoutSec);
  const activeCountdownSec = useStaticTrainingPackStore((s) => s.activeCountdownSec);
  const isShotLaunched = useStaticTrainingPackStore((s) => s.isShotLaunched);
  const isOvertimeWaitGround = useStaticTrainingPackStore((s) => s.isOvertimeWaitGround);
  const isReplayActive = useStaticTrainingPackStore((s) => s.isReplayActive);

  void editVarVersion;

  if (!activePack || isReplayActive) return null;

  const items = activePack.items || [];
  const safeIdx = Math.max(0, Math.min(Math.max(0, items.length - 1), currentShotIndex));
  const shot =
    (sessionMode === 'edit' && isEditingItem && getActiveEditItemVariable()) ||
    items[safeIdx] ||
    null;

  if (!shot) return null;

  const subModeTitleMap: Record<string, string> = {
    'car-heading': '1. CAR HEADING & LOCATION',
    'car-speed': '2. CAR SPEED & DIRECTION',
    'ball-speed': '3. BALL SPEED & LOCATION',
    'free-cam': '4. FREE CAMERA INSPECTOR',
  };

  return (
    <div
      data-ui-element="static-training-pack-hud"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none flex flex-col items-center gap-1.5"
    >
      <div
        className={`px-4 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-3 backdrop-blur-md shadow-lg ${
          isLight
            ? 'bg-white/90 border-neutral-300 text-neutral-900'
            : 'bg-neutral-950/85 border-neutral-700/80 text-neutral-100'
        }`}
      >
        <span className="font-bold text-cyan-400">
          SHOT {safeIdx + 1}/{items.length}
        </span>
        <span className="font-sans font-bold truncate max-w-[180px]">{shot.name}</span>

        <span className="opacity-40">|</span>

        {sessionMode === 'play' ? (
          <>
            <span
              className={`font-bold tabular-nums ${
                isOvertimeWaitGround
                  ? 'text-amber-400 animate-pulse'
                  : remainingTimeoutSec <= 4
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {isOvertimeWaitGround
                ? '0.0s (OVERTIME - KEEP BALL UP!)'
                : `TIMER ${remainingTimeoutSec.toFixed(1)}s`}
            </span>

            <span className="opacity-40">|</span>

            {!isShotLaunched ? (
              <span className="text-amber-300 font-bold animate-pulse">
                {downCounterEnabled && activeCountdownSec > 0
                  ? `COUNTDOWN ${activeCountdownSec}...`
                  : 'PRESS ANY INPUT TO START'}
              </span>
            ) : (
              <span className="text-[11px] opacity-80">
                [R] Reset • [ / ] Prev/Next • [TAB] Panel
              </span>
            )}
          </>
        ) : (
          <>
            <span className="font-bold text-amber-400">
              {subModeTitleMap[editSubMode] || editSubMode}
            </span>
            <span className="opacity-40">|</span>
            <span className="text-[11px] opacity-85">
              Car: {Math.round(shot.car.speed)} UU/s{' '}
              {shot.car.snapToGround ? '(SNAP 60f)' : ''} • Boost:{' '}
              {shot.car.unlimitedBoost ? 'INF' : `${Math.round(shot.car.initialBoost)}%`} • Ball:{' '}
              {shot.ball.kickoffState ? 'KICKOFF FREEZE' : `${Math.round(shot.ball.speed)} UU/s`}
            </span>
          </>
        )}
      </div>

      {sessionMode === 'edit' && (
        <div
          className={`px-3 py-1 rounded-lg border font-mono text-[10px] backdrop-blur-md ${
            isLight
              ? 'bg-neutral-100/90 border-neutral-300 text-neutral-700'
              : 'bg-neutral-900/80 border-neutral-800 text-neutral-300'
          }`}
        >
          {editSubMode === 'car-heading' &&
            '[9/0/R-Click] Sub-Mode • [WASD/Space/V] Move Car (V at ground = Snap 60f) • [Drag] Heading • [Q/E] Roll • [O/P] Boost (P at 100 = INF)'}
          {editSubMode === 'car-speed' &&
            '[9/0/R-Click] Sub-Mode • [WASD/Space/V] Move Car • [Drag] Car Speed Dir • [[ / ]] Car Speed • [O/P] Boost'}
          {editSubMode === 'ball-speed' &&
            '[9/0/R-Click] Sub-Mode • [WASD/Space/V] Move Ball • [Drag] Ball Dir • [[ / ]] Ball Speed ([ at 0 = Kickoff Freeze)'}
          {editSubMode === 'free-cam' &&
            '[9/0/R-Click] Sub-Mode • [WASD + Space + V] Fly Free Camera • [Drag] Look Around • [TAB] Toggle Editor Panel'}
        </div>
      )}
    </div>
  );
};
