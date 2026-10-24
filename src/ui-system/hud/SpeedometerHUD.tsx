import React from 'react';
import { useHudStore } from '../../stores/hudStore';

export interface SpeedometerHUDProps {
  speed?: number;
  className?: string;
}

function lerpColor(t: number): string {
  const r = Math.round(119 + (89 - 119) * t);
  const g = Math.round(202 + (241 - 202) * t);
  const b = Math.round(122 + (104 - 122) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * SpeedometerHUD (React Component)
 * Low-latency nonlinear speedometer progress bar managed within GameViewport.
 */
export const SpeedometerHUD: React.FC<SpeedometerHUDProps> = ({ speed: propSpeed, className = '' }) => {
  const storeSpeed = useHudStore((s) => s.carSpeed);
  const rawSpeed = propSpeed !== undefined ? propSpeed : storeSpeed;
  const v = Math.max(0, Math.min(2300, Math.abs(rawSpeed || 0)));

  let fillRatio = 0;
  let color = '#d4af37';
  let isSupersonic = false;

  if (v <= 1410) {
    fillRatio = (v / 1410) * 40;
    color = '#d4af37';
  } else if (v < 2200) {
    const t = (v - 1410) / (2200 - 1410);
    fillRatio = 40 + t * 45;
    color = lerpColor(t);
  } else {
    const t = Math.min(1, (v - 2200) / 100);
    fillRatio = 85 + t * 15;
    color = '#a020f0';
    isSupersonic = true;
  }

  return (
    <div
      id="hud-speedometer"
      data-ui-element="hud-speedometer"
      className={`pointer-events-none select-none ${className}`}
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        transformOrigin: 'bottom center',
        width: 'min(640px, 75%)',
        height: '9px',
        background: 'rgba(10, 15, 25, 0.75)',
        border: `1px solid ${isSupersonic ? '#d060ff' : 'rgba(255, 255, 255, 0.25)'}`,
        borderRadius: '0px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.6)',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <div
        title="Supersonic Threshold (2200 uu/s)"
        style={{
          position: 'absolute',
          left: '85%',
          top: '-3px',
          bottom: '-3px',
          width: '2px',
          background: '#cfd4dc',
          boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '85%',
          bottom: '12px',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontFamily: 'var(--sans, sans-serif)',
          fontWeight: 700,
          letterSpacing: '0.5px',
          color: '#cfd4dc',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        SUPERSONIC
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${fillRatio}%`,
          backgroundColor: color,
          borderRadius: '0px',
          transition: 'none',
          boxShadow: isSupersonic ? '0 0 12px #a020f0, 0 0 4px #e080ff' : 'none',
          zIndex: 2,
        }}
      />
    </div>
  );
};
