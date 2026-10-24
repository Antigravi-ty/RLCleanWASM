import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { useHudStore } from '../../stores/hudStore';
import { BallCameraIndicator } from './BallCameraIndicator';
import { CircularBoostGauge } from './CircularBoostGauge';
import { MatchHeaderHUD } from './MatchHeaderHUD';
import { KickoffKeyboardOverlay } from './KickoffKeyboardOverlay';
import { SpeedometerHUD } from './SpeedometerHUD';
import { StaticTrainingPackHUD } from './StaticTrainingPackHUD';

export interface InGameHUDProps {
  className?: string;
}

export const InGameHUD: React.FC<InGameHUDProps> = ({ className = '' }) => {
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === 'light';
  const showBallCamIndicator = useAppStore((s) => s.gameplay.ballCamIndicator);
  const matchMode = useAppStore((s) => s.matchMode);

  const ballCamActive = useHudStore((s) => s.ballCamActive);
  const ballCamShortcut = useHudStore((s) => s.ballCamShortcut);
  const toggleBallCam = useHudStore((s) => s.toggleBallCam);
  const boostAmount = useHudStore((s) => s.boostAmount);
  const hasFlip = useHudStore((s) => s.hasFlip);
  const flipStatus = useHudStore((s) => s.flipStatus);
  const flipRemainingSeconds = useHudStore((s) => s.flipRemainingSeconds);

  const isUnlimitedFlip = hasFlip && flipStatus === 'unlimited';
  const isCountingDownFlip = hasFlip && flipStatus === 'countdown';
  const flipProgressPct = !hasFlip
    ? 0
    : isUnlimitedFlip || flipStatus === 'grounded'
    ? 100
    : Math.max(0, Math.min(100, (flipRemainingSeconds / 1.25) * 100));

  return (
    <div
      data-ui-element="in-game-hud-layer"
      className={`absolute inset-0 pointer-events-none select-none z-[5] ${className}`}
    >
      {/* 1. Bottom-Left: HAS FLIP Indicator + Ball Camera Indicator + Kickoff DDR Keyboard Overlay */}
      <div
        className="absolute pointer-events-auto flex flex-col items-start gap-2.5"
        style={{
          left: 'max(24px, env(safe-area-inset-left, 24px))',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        }}
      >
        <div
          data-ui-element="hud-flip-indicator"
          className={`relative overflow-hidden flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-150 shadow-lg backdrop-blur-md min-w-[164px] ${
            isLight
              ? hasFlip
                ? isUnlimitedFlip
                  ? 'bg-white/95 border-cyan-400/90 text-neutral-900 shadow-[0_4px_20px_rgba(6,182,212,0.18)]'
                  : 'bg-white/95 border-emerald-400/90 text-neutral-900 shadow-[0_4px_20px_rgba(16,185,129,0.12)]'
                : 'bg-white/70 border-neutral-200 text-neutral-400 opacity-60'
              : hasFlip
              ? isUnlimitedFlip
                ? 'bg-neutral-950/90 border-cyan-400/50 text-white shadow-[0_4px_25px_rgba(6,182,212,0.25)]'
                : 'bg-neutral-950/90 border-emerald-500/40 text-white shadow-[0_4px_25px_rgba(0,0,0,0.7)]'
              : 'bg-neutral-900/60 border-neutral-800/60 text-neutral-500 opacity-50'
          }`}
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <div
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                hasFlip
                  ? isUnlimitedFlip
                    ? 'bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_3px_#ffffff]'
                    : isCountingDownFlip && flipRemainingSeconds < 0.35
                    ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b,0_0_3px_#ffffff]'
                    : 'bg-emerald-500 shadow-[0_0_12px_#10b981,0_0_3px_#ffffff]'
                  : isLight
                  ? 'bg-neutral-300'
                  : 'bg-neutral-700'
              }`}
            />
          </div>
          <div className="flex flex-col items-start text-left leading-tight flex-1">
            <div className="flex items-center justify-between w-full gap-2">
              <span
                className={`text-xs font-black tracking-wider font-mono uppercase ${
                  hasFlip
                    ? isUnlimitedFlip
                      ? isLight
                        ? 'text-cyan-700'
                        : 'text-cyan-300'
                      : isLight
                      ? 'text-neutral-900'
                      : 'text-emerald-300'
                    : 'text-neutral-400'
                }`}
              >
                {hasFlip ? 'HAS FLIP' : 'NO FLIP'}
              </span>
              {hasFlip && (
                <span
                  className={`text-[10px] font-mono font-bold tabular-nums ${
                    isUnlimitedFlip
                      ? isLight
                        ? 'text-cyan-600'
                        : 'text-cyan-300'
                      : isCountingDownFlip
                      ? flipRemainingSeconds < 0.35
                        ? 'text-amber-400'
                        : isLight
                        ? 'text-emerald-600'
                        : 'text-emerald-300'
                      : 'opacity-70'
                  }`}
                >
                  {isUnlimitedFlip
                    ? '∞'
                    : isCountingDownFlip
                    ? `${flipRemainingSeconds.toFixed(2)}s`
                    : '1.25s'}
                </span>
              )}
            </div>
            <span className="text-[9px] font-mono tracking-tight opacity-75">
              {!hasFlip
                ? 'EXPENDED'
                : isUnlimitedFlip
                ? 'UNLIMITED · FLIP RESET'
                : isCountingDownFlip
                ? `COUNTDOWN · ${flipRemainingSeconds.toFixed(2)}s`
                : 'DODGE / RESET READY'}
            </span>
          </div>

          {/* Bottom countdown progress bar */}
          <div className="absolute left-0 right-0 bottom-0 h-1 bg-neutral-500/15">
            <div
              className={`h-full transition-all duration-75 ${
                !hasFlip
                  ? 'bg-transparent'
                  : isUnlimitedFlip
                  ? 'bg-cyan-400'
                  : isCountingDownFlip && flipRemainingSeconds < 0.35
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${flipProgressPct}%` }}
            />
          </div>
        </div>

        {showBallCamIndicator && (
          <BallCameraIndicator
            active={ballCamActive}
            shortcut={ballCamShortcut}
            isLight={isLight}
            onToggle={toggleBallCam}
          />
        )}
        {matchMode === 'kickoff-training' && <KickoffKeyboardOverlay isLight={isLight} />}
      </div>

      {/* 2. Bottom-Right: Circular Boost Gauge */}
      <div
        className="absolute pointer-events-auto"
        style={{
          right: 'max(24px, env(safe-area-inset-right, 24px))',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        }}
      >
        <CircularBoostGauge
          amount={boostAmount}
          size={148}
          isLight={isLight}
        />
      </div>

      {/* 3. Bottom-Center: Nonlinear Speedometer HUD */}
      <SpeedometerHUD />

      {/* 4. Top-Center: Minimal Match Header HUD (Score & Timer & Kickoff) */}
      <MatchHeaderHUD isLight={isLight} />

      {/* 5. Top-Center Sub-Banner: Static Training Pack HUD */}
      {matchMode === 'static-training-pack' && <StaticTrainingPackHUD isLight={isLight} />}
    </div>
  );
};
