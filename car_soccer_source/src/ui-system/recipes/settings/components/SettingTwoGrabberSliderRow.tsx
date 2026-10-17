import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

export interface SettingTwoGrabberSliderRowProps {
  label: string;
  subtitle?: string;
  target: number; // alpha, e.g. 1..6
  value: [number, number]; // [catchupOffset, skipOffset], e.g. [-2, 2]
  onChange: (val: [number, number]) => void;
  onHover?: () => void;
  onLeave?: () => void;
  isLight?: boolean;
  disabled?: boolean;
}

/**
 * SettingTwoGrabberSliderRow
 * Two-grabber range slider for input buffer threshold deadband:
 * - Domain spans from -target (-alpha) to +target (+alpha).
 * - Left grabber: Catch-up threshold (negative offset, [-alpha .. 0]).
 * - Right grabber: Skip threshold (positive offset, [0 .. +alpha]).
 * - Both grabbers can meet at center (0, zero deadband).
 * - Real-time allowed buffer range preview: [alpha + catchup .. alpha + skip].
 */
export const SettingTwoGrabberSliderRow: React.FC<SettingTwoGrabberSliderRowProps> = ({
  label,
  subtitle,
  target,
  value,
  onChange,
  onHover,
  onLeave,
  isLight = false,
  disabled = false,
}) => {
  const alpha = Math.max(1, Math.min(6, Math.round(target)));
  // Ensure value stays within [-alpha, 0] and [0, alpha]
  const catchup = Math.max(-alpha, Math.min(0, Math.round(value[0])));
  const skip = Math.max(0, Math.min(alpha, Math.round(value[1])));

  const minBufferAllowed = alpha + catchup;
  const maxBufferAllowed = alpha + skip;

  const handleSliderChange = (vals: number[]) => {
    if (!Array.isArray(vals) || vals.length < 2) return;
    let rawCatchup = Math.round(vals[0]);
    let rawSkip = Math.round(vals[1]);

    // When both thumbs meet at 0, Radix may pick the upper thumb (vals[1]) when dragging left,
    // or the lower thumb (vals[0]) when dragging right. Route the movement to the intended side.
    if (catchup === 0 && skip === 0) {
      if (rawSkip < 0) {
        rawCatchup = rawSkip;
        rawSkip = 0;
      } else if (rawCatchup > 0) {
        rawSkip = rawCatchup;
        rawCatchup = 0;
      }
    }

    // Left grabber controls catch-up (bounded in [-alpha, 0])
    const newCatchup = Math.max(-alpha, Math.min(0, rawCatchup)) || 0;
    // Right grabber controls skip (bounded in [0, alpha])
    const newSkip = Math.max(0, Math.min(alpha, rawSkip)) || 0;
    onChange([newCatchup, newSkip]);
  };

  // Generate tick markers from -alpha to +alpha
  const ticks = [];
  for (let t = -alpha; t <= alpha; t++) {
    ticks.push(t);
  }

  const bothAtZero = catchup === 0 && skip === 0;

  return (
    <div
      className={`flex flex-col gap-2.5 w-full p-3 rounded-xl border select-none transition-all ${
        disabled
          ? 'opacity-40 pointer-events-none'
          : isLight
          ? 'bg-neutral-50/90 border-neutral-200 hover:bg-neutral-100/90 shadow-2xs'
          : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Header with Title and Readout Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
              {label}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-amber-500/15 border-amber-500/30 text-amber-400">
              [-α .. +α]
            </span>
          </div>
          {subtitle && (
            <span className={`text-[11px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Readout Badges */}
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              isLight
                ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
                : 'bg-neutral-900 text-neutral-200 border-neutral-700'
            }`}
            title="Catch-up threshold offset (negative)"
          >
            Catch-up: <strong className="text-amber-500">{catchup === 0 ? '-0' : catchup}</strong>
          </span>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              isLight
                ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
                : 'bg-neutral-900 text-neutral-200 border-neutral-700'
            }`}
            title="Skip threshold offset (positive)"
          >
            Skip: <strong className="text-amber-500">{skip === 0 ? '+0' : `+${skip}`}</strong>
          </span>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border font-semibold ${
              isLight
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-amber-950/40 text-amber-300 border-amber-700/50'
            }`}
            title={`Effective allowed server queue depth: target ${alpha} + [${catchup} .. ${skip}]`}
          >
            Window: [{minBufferAllowed}..{maxBufferAllowed}]
          </span>
        </div>
      </div>

      {/* Slider Track with Dual Thumbs */}
      <div className="flex flex-col gap-1 w-full pt-1 px-1">
        <SliderPrimitive.Root
          value={[catchup, skip]}
          min={-alpha}
          max={alpha}
          step={1}
          disabled={disabled}
          onValueChange={handleSliderChange}
          className="relative flex items-center select-none touch-none w-full h-6 cursor-pointer"
        >
          {/* Base Track */}
          <SliderPrimitive.Track
            className={`relative grow rounded-full h-2 overflow-hidden ${
              isLight ? 'bg-neutral-200' : 'bg-neutral-800'
            }`}
          >
            {/* Active Range (Deadband Zone) */}
            <SliderPrimitive.Range
              className="absolute h-full rounded-full bg-amber-500 transition-colors"
            />
          </SliderPrimitive.Track>

          {/* Left Thumb (Catch-up / Negative Threshold) */}
          <SliderPrimitive.Thumb
            aria-label="Catch-up threshold offset"
            className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-grab active:cursor-grabbing ${
              bothAtZero ? '-translate-x-1' : ''
            } ${
              isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
            }`}
          />

          {/* Right Thumb (Skip / Positive Threshold) */}
          <SliderPrimitive.Thumb
            aria-label="Skip threshold offset"
            className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-grab active:cursor-grabbing ${
              bothAtZero ? 'translate-x-1' : ''
            } ${
              isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
            }`}
          />
        </SliderPrimitive.Root>

        {/* Axis Ticks and Labels */}
        <div className="flex items-center justify-between text-[10px] font-mono px-0.5 text-neutral-400 select-none">
          {ticks.map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                if (t < 0) onChange([t, skip]);
                else if (t > 0) onChange([catchup, t]);
                else onChange([0, 0]);
              }}
              className={`transition-colors cursor-pointer hover:text-amber-400 ${
                t === 0
                  ? 'font-bold text-amber-500 scale-110'
                  : t === catchup || t === skip
                  ? 'font-bold text-neutral-100 dark:text-neutral-200'
                  : 'opacity-60'
              }`}
            >
              {t === 0 ? '0 (Target)' : t > 0 ? `+${t}` : t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
