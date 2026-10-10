import React from 'react';
import { useUIStore } from '../core/store';
import { useHudStore } from './hudStore';
import { BallCameraIndicator } from './BallCameraIndicator';
import { CircularBoostGauge } from './CircularBoostGauge';

export interface InGameHUDProps {
  className?: string;
}

/**
 * InGameHUD
 * Modern In-Game Match HUD Layer:
 * 1. Bottom-Left: BallCameraIndicator referencing UIStorybook commit 4cb7fc1.
 * 2. Bottom-Right: CircularBoostGauge with 4-segment color engine and SF Mono typography.
 * 3. Layering & Decoupling:
 *    - Placed in the GameViewport host layer at z-5 (above 3D Game Canvas, below Menu Dimming Backdrop z-10).
 *    - High-frequency numerical updates isolated within useHudStore without touching GameViewport/MenuShell.
 */
export const InGameHUD: React.FC<InGameHUDProps> = ({ className = '' }) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';
  const showBallCamIndicator = useUIStore((s) => s.gameplay.ballCamIndicator);

  const ballCamActive = useHudStore((s) => s.ballCamActive);
  const ballCamShortcut = useHudStore((s) => s.ballCamShortcut);
  const toggleBallCam = useHudStore((s) => s.toggleBallCam);
  const boostAmount = useHudStore((s) => s.boostAmount);

  return (
    <div
      data-ui-element="in-game-hud-layer"
      className={`fixed inset-0 pointer-events-none select-none z-[5] ${className}`}
    >
      {/* 1. Bottom-Left: Ball Camera Indicator */}
      {showBallCamIndicator && (
        <div
          className="fixed pointer-events-auto"
          style={{
            left: 'max(24px, env(safe-area-inset-left, 24px))',
            bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          }}
        >
          <BallCameraIndicator
            active={ballCamActive}
            shortcut={ballCamShortcut}
            isLight={isLight}
            onToggle={toggleBallCam}
          />
        </div>
      )}

      {/* 2. Bottom-Right: Circular Boost Gauge */}
      <div
        className="fixed pointer-events-auto"
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
    </div>
  );
};
