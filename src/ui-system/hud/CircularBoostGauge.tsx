import React from 'react';

export interface CircularBoostGaugeProps {
  /** Current boost amount (0 ~ 100) */
  amount: number;
  /** Outer diameter size in px (default 148) */
  size?: number;
  /** Theme: light/dark */
  isLight?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * 4-segment boost color mapping:
 * - 0  ~ 24  : Red (#ef4444)
 * - 25 ~ 60  : Yellow (#f59e0b)
 * - 61 ~ 96  : Green (#10b981)
 * - 97 ~ 100 : Sky Blue (#0ea5e9)
 */
export const getBoostSegmentColor = (amount: number): {
  color: string;
  segmentName: 'red' | 'yellow' | 'green' | 'sky';
  rangeLabel: string;
} => {
  const val = Math.max(0, Math.min(100, Math.round(amount)));
  if (val <= 24) {
    return { color: '#ef4444', segmentName: 'red', rangeLabel: '0-24 (Critical)' };
  }
  if (val <= 60) {
    return { color: '#f59e0b', segmentName: 'yellow', rangeLabel: '25-60 (Low)' };
  }
  if (val <= 96) {
    return { color: '#10b981', segmentName: 'green', rangeLabel: '61-96 (High)' };
  }
  return { color: '#0ea5e9', segmentName: 'sky', rangeLabel: '97-100 (Full)' };
};

/**
 * Monospace font family configuration
 */
const MONO_FONT_FAMILY = "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace";

/**
 * CircularBoostGauge
 * Minimalist lightweight circular boost gauge:
 * 1. Ultra-clean structure designed for 120Hz updates; no flame/fx layers.
 * 2. Typography strictly monospace (SF Mono / JetBrains Mono).
 * 3. Quad-tier color engine: 0-24 Red -> 25-60 Yellow -> 61-96 Green -> 97-100 Sky.
 */
export const CircularBoostGauge: React.FC<CircularBoostGaugeProps> = ({
  amount = 100,
  size = 148,
  isLight = false,
  className = '',
}) => {
  const clampedAmount = Math.max(0, Math.min(100, Math.round(amount)));
  const { color } = getBoostSegmentColor(clampedAmount);

  // SVG circular gauge geometry (270 degree arc)
  const radius = 54;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const sweepAngle = 270;
  const arcTotal = (sweepAngle / 360) * circumference;
  const progressOffset = arcTotal - (clampedAmount / 100) * arcTotal;

  return (
    <div
      data-ui-element="hud-circular-boost-gauge"
      className={`relative select-none pointer-events-auto flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontFamily: MONO_FONT_FAMILY,
      }}
    >
      <div
        className={`relative w-full h-full flex flex-col items-center justify-center p-3 rounded-full border transition-colors ${
          isLight
            ? 'bg-white/90 border-neutral-300/80 shadow-lg'
            : 'bg-neutral-950/85 border-neutral-800/80 shadow-xl'
        }`}
      >
        {/* SVG circular progress track (-225 deg start) */}
        <svg className="w-full h-full transform -rotate-[225deg]" viewBox="0 0 136 136">
          {/* Background track */}
          <circle
            cx="68"
            cy="68"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcTotal} ${circumference}`}
            strokeLinecap="round"
            className={isLight ? 'text-neutral-200' : 'text-neutral-800'}
          />

          {/* Active foreground arc with instant 0ms color tier updates */}
          <circle
            cx="68"
            cy="68"
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcTotal} ${circumference}`}
            strokeLinecap="round"
            strokeDashoffset={progressOffset}
            style={{
              transition: 'stroke 100ms ease, stroke-dashoffset 0ms',
            }}
          />
        </svg>

        {/* Center numeric readout and BOOST label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ fontFamily: MONO_FONT_FAMILY }}
        >
          <span
            className="text-4xl font-black tracking-tighter tabular-nums transition-colors leading-none"
            style={{
              color,
              fontFamily: MONO_FONT_FAMILY,
            }}
          >
            {clampedAmount}
          </span>

          <span
            className={`text-[10px] font-bold tracking-widest uppercase mt-1 ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}
            style={{ fontFamily: MONO_FONT_FAMILY }}
          >
            BOOST
          </span>
        </div>
      </div>
    </div>
  );
};
