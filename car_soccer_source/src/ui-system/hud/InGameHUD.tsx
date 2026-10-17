import React from 'react';
import { useUIStore } from '../core/store';
import { useHudStore } from './hudStore';
import { BallCameraIndicator } from './BallCameraIndicator';
import { CircularBoostGauge } from './CircularBoostGauge';
import { MatchHeaderHUD } from './MatchHeaderHUD';
import { KickoffKeyboardOverlay } from './KickoffKeyboardOverlay';

export interface InGameHUDProps {
  className?: string;
}

export const InGameHUD: React.FC<InGameHUDProps> = ({ className = '' }) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';
  const showBallCamIndicator = useUIStore((s) => s.gameplay.ballCamIndicator);
  const matchMode = useUIStore((s) => s.matchMode);

  const ballCamActive = useHudStore((s) => s.ballCamActive);
  const ballCamShortcut = useHudStore((s) => s.ballCamShortcut);
  const toggleBallCam = useHudStore((s) => s.toggleBallCam);
  const boostAmount = useHudStore((s) => s.boostAmount);
  const hasFlip = useHudStore((s) => s.hasFlip);

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
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-150 shadow-lg backdrop-blur-md ${
            isLight
              ? hasFlip
                ? 'bg-white/95 border-emerald-400/90 text-neutral-900 shadow-[0_4px_20px_rgba(16,185,129,0.12)]'
                : 'bg-white/70 border-neutral-200 text-neutral-400 opacity-60'
              : hasFlip
              ? 'bg-neutral-950/90 border-emerald-500/40 text-white shadow-[0_4px_25px_rgba(0,0,0,0.7)]'
              : 'bg-neutral-900/60 border-neutral-800/60 text-neutral-500 opacity-50'
          }`}
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <div
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                hasFlip
                  ? 'bg-emerald-500 shadow-[0_0_12px_#10b981,0_0_3px_#ffffff]'
                  : isLight
                  ? 'bg-neutral-300'
                  : 'bg-neutral-700'
              }`}
            />
          </div>
          <div className="flex flex-col items-start text-left leading-tight">
            <span
              className={`text-xs font-black tracking-wider font-mono uppercase ${
                hasFlip ? (isLight ? 'text-neutral-900' : 'text-emerald-300') : 'text-neutral-400'
              }`}
            >
              {hasFlip ? 'HAS FLIP' : 'NO FLIP'}
            </span>
            <span className="text-[9px] font-mono tracking-tight opacity-75">
              {hasFlip ? 'DODGE / RESET READY' : 'EXPENDED'}
            </span>
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

      {/* 4. Top-Center: Minimal Match Header HUD (Score & Timer & Kickoff) */}
      <MatchHeaderHUD isLight={isLight} />
    </div>
  );
};
