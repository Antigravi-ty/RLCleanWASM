import React from 'react';
import { KeycapBadge } from '../primitives/KeycapBadge';

export interface BallCameraIndicatorProps {
  /** Ball Cam Active state */
  active?: boolean;
  /** Shortcut hint, defaults to 'SPACE' */
  shortcut?: string | null;
  /** Primary label, defaults to 'BALL CAM' */
  label?: string;
  /** Action description text, defaults to 'TO TOGGLE' */
  actionText?: string;
  /** Theme: light/dark */
  isLight?: boolean;
  /** Toggle callback */
  onToggle?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * BallCameraIndicator
 * Rocket League style ball camera HUD indicator with frosted glass styling and KeycapBadge integration.
 */
export const BallCameraIndicator: React.FC<BallCameraIndicatorProps> = ({
  active = true,
  shortcut = 'SPACE',
  label = 'BALL CAM',
  actionText = 'TO TOGGLE',
  isLight = false,
  onToggle,
  className = '',
}) => {
  return (
    <div
      data-ui-element="hud-ball-camera-indicator"
      onClick={onToggle}
      className={`select-none pointer-events-auto transition-all cursor-pointer group active:scale-95 inline-flex ${className}`}
      title="Toggle Ball Camera"
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-150 shadow-lg ${
          isLight
            ? active
              ? 'bg-white/95 border-neutral-300/90 text-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)]'
              : 'bg-white/70 border-neutral-200 text-neutral-400 shadow-sm opacity-60'
            : active
            ? 'bg-neutral-950/90 border-neutral-800 text-white shadow-[0_4px_25px_rgba(0,0,0,0.7)]'
            : 'bg-neutral-900/60 border-neutral-800/60 text-neutral-500 shadow-none opacity-50'
        } backdrop-blur-md`}
      >
        {/* Left: Indicator light */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div
            className={`w-5 h-5 rounded-full transition-all duration-150 ${
              active
                ? 'bg-red-500 shadow-[0_0_12px_#ef4444,0_0_3px_#ffffff]'
                : isLight
                ? 'bg-neutral-300'
                : 'bg-neutral-700'
            }`}
          />
          {active && (
            <div className="absolute w-7 h-7 rounded-full bg-red-500/25 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Right: Text block */}
        <div className="flex flex-col items-start text-left leading-tight">
          {/* Status title */}
          <span
            className={`text-sm font-black tracking-wider font-mono uppercase transition-colors ${
              active
                ? isLight
                  ? 'text-neutral-900'
                  : 'text-white'
                : isLight
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }`}
          >
            {label}
          </span>

          {/* Action shortcut prompt */}
          {shortcut ? (
            <div
              className={`flex items-center gap-1.5 text-[10px] font-mono tracking-tight mt-0.5 transition-opacity ${
                active ? 'opacity-85' : 'opacity-50'
              } ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}
            >
              <span>PRESS</span>
              <KeycapBadge shortcut={shortcut} size="sm" isLight={isLight} />
              <span>{actionText}</span>
            </div>
          ) : (
            <span
              className={`text-[10px] font-mono tracking-tight mt-0.5 transition-opacity ${
                active ? 'opacity-70' : 'opacity-40'
              } ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}
            >
              {active ? 'CAMERA LOCKED ON BALL' : 'FREE COCKPIT VIEW'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
