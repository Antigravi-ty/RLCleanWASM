import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

export type DualGrabberColorScheme = 'neutral' | 'amber' | 'orange' | 'emerald' | 'sky' | 'rose';
export type DualGrabberMode = 'centered-deadband' | 'free-range';

export interface DualGrabberSliderProps {
  label: string;
  subtitle?: string;
  /**
   * Current dual-thumb values: `[leftVal, rightVal]`.
   */
  value: [number, number];
  onChange: (val: [number, number]) => void;
  /**
   * Symmetric target alpha (shorthand from RLCleanWASM `SettingTwoGrabberSliderRow`: sets `min = -target`, `max = +target`, `origin = 0`).
   */
  target?: number;
  min?: number;
  max?: number;
  step?: number;
  origin?: number;
  unit?: string;
  /**
   * - 'centered-deadband': Left thumb clamped to `[min, origin]`, right thumb clamped to `[origin, max]` (ideal for [-α .. +α] deadbands).
   * - 'free-range': Standard two-thumb interval `[low, high]` anywhere within `[min, max]`.
   */
  mode?: DualGrabberMode;
  colorScheme?: DualGrabberColorScheme;
  showTicks?: boolean;
  /**
   * Optional domain badge text next to title (e.g. `[-α .. +α]`).
   */
  domainBadge?: string;
  leftLabel?: string;
  rightLabel?: string;
  /**
   * Optional summary window badge formatter, e.g. `([l, r]) => \`Window: [\${target + l}..\${target + r}]\``
   */
  formatWindowBadge?: (val: [number, number], origin: number) => string | null;
  onHover?: () => void;
  onLeave?: () => void;
  isLight?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * DualGrabberSlider
 * Modularized from RLCleanWASM `SettingTwoGrabberSliderRow`:
 * Two-grabber range slider supporting both:
 * 1. Centered Split-Domain Deadband (`mode="centered-deadband"`):
 *    Left grabber controls negative offset `[min .. origin]`, right grabber controls positive offset `[origin .. max]`.
 *    Both grabbers can meet at center `origin` or expand outward independently.
 * 2. Free Range Interval (`mode="free-range"`):
 *    Arbitrary `[low, high]` selection across `[min, max]`.
 */
export const DualGrabberSlider: React.FC<DualGrabberSliderProps> = ({
  label,
  subtitle,
  value,
  onChange,
  target,
  min: propMin,
  max: propMax,
  step = 1,
  origin: propOrigin,
  unit = '',
  mode = 'centered-deadband',
  colorScheme = 'amber',
  showTicks = true,
  domainBadge,
  leftLabel = 'Catch-up',
  rightLabel = 'Skip',
  formatWindowBadge,
  onHover,
  onLeave,
  isLight = false,
  disabled = false,
  className = '',
}) => {
  const alpha = target !== undefined ? Math.max(1, Math.round(target)) : undefined;
  const min = alpha !== undefined ? -alpha : (propMin ?? -5);
  const max = alpha !== undefined ? alpha : (propMax ?? 5);
  const origin = propOrigin !== undefined ? propOrigin : min <= 0 && max >= 0 ? 0 : (min + max) / 2;

  const stepDecimals = (String(step).split('.')[1] || '').length;
  const roundStep = (v: number) => {
    const snapped = Math.round((v - min) / step) * step + min;
    return stepDecimals > 0 ? parseFloat(snapped.toFixed(stepDecimals)) : Math.round(snapped);
  };

  const leftVal =
    mode === 'centered-deadband'
      ? Math.max(min, Math.min(origin, roundStep(value[0])))
      : Math.max(min, Math.min(max, roundStep(Math.min(value[0], value[1]))));

  const rightVal =
    mode === 'centered-deadband'
      ? Math.max(origin, Math.min(max, roundStep(value[1])))
      : Math.max(min, Math.min(max, roundStep(Math.max(value[0], value[1]))));

  const handleSliderChange = (vals: number[]) => {
    if (!Array.isArray(vals) || vals.length < 2) return;
    if (mode === 'centered-deadband') {
      const nextLeft = Math.max(min, Math.min(origin, roundStep(vals[0])));
      const nextRight = Math.max(origin, Math.min(max, roundStep(vals[1])));
      onChange([nextLeft, nextRight]);
    } else {
      const nextLeft = Math.max(min, Math.min(max, roundStep(Math.min(vals[0], vals[1]))));
      const nextRight = Math.max(min, Math.min(max, roundStep(Math.max(vals[0], vals[1]))));
      onChange([nextLeft, nextRight]);
    }
  };

  // Generate tick markers
  const ticks: number[] = [];
  if (showTicks) {
    const totalSteps = Math.round((max - min) / step);
    const tickStride = totalSteps > 12 ? Math.ceil(totalSteps / 8) * step : step;
    for (let t = min; t <= max + 1e-7; t += tickStride) {
      ticks.push(stepDecimals > 0 ? parseFloat(t.toFixed(stepDecimals)) : Math.round(t));
    }
    if (mode === 'centered-deadband' && !ticks.includes(origin)) {
      ticks.push(origin);
      ticks.sort((a, b) => a - b);
    }
  }

  const totalRange = Math.max(1e-6, max - min);
  const originPct = ((origin - min) / totalRange) * 100;

  const getRangeColorClass = () => {
    if (colorScheme === 'neutral') return isLight ? 'bg-neutral-900' : 'bg-white';
    if (colorScheme === 'orange') return 'bg-orange-500';
    if (colorScheme === 'sky') return 'bg-sky-500';
    if (colorScheme === 'emerald') return 'bg-emerald-500';
    return 'bg-amber-500';
  };

  const getAccentTextClass = () => {
    if (colorScheme === 'neutral') return isLight ? 'text-neutral-900' : 'text-white';
    if (colorScheme === 'orange') return 'text-orange-500';
    if (colorScheme === 'sky') return 'text-sky-500';
    if (colorScheme === 'emerald') return 'text-emerald-500';
    return 'text-amber-500';
  };

  const resolvedDomainBadge =
    domainBadge !== undefined
      ? domainBadge
      : alpha !== undefined
      ? '[-α .. +α]'
      : mode === 'centered-deadband'
      ? `[${min}${unit} .. +${max}${unit}]`
      : undefined;

  const resolvedWindowBadge =
    formatWindowBadge !== undefined
      ? formatWindowBadge([leftVal, rightVal], origin)
      : alpha !== undefined
      ? `Window: [${alpha + leftVal}..${alpha + rightVal}]`
      : `Span: ${(rightVal - leftVal).toFixed(stepDecimals)}${unit}`;

  const formatSigned = (v: number, isPositiveSide: boolean) => {
    if (mode === 'centered-deadband') {
      if (v === origin) return isPositiveSide ? `+${origin}${unit}` : `-${origin}${unit}`;
      return v > 0 ? `+${v}${unit}` : `${v}${unit}`;
    }
    return `${v}${unit}`;
  };

  return (
    <div
      data-component="dual-grabber-slider"
      className={`flex flex-col gap-2.5 w-full p-3 rounded-xl border select-none transition-all ${
        disabled
          ? 'opacity-40 pointer-events-none'
          : isLight
          ? 'bg-neutral-50/90 border-neutral-200 hover:bg-neutral-100/80 shadow-2xs'
          : 'bg-neutral-900/70 hover:bg-neutral-900 border-neutral-800'
      } ${className}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Header with Title and Readout Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
              {label}
            </span>
            {resolvedDomainBadge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-amber-500/15 border-amber-500/30 text-amber-500">
                {resolvedDomainBadge}
              </span>
            )}
          </div>
          {subtitle && (
            <span className={`text-[11px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Readout Badges */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0 self-start sm:self-center">
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              isLight
                ? 'bg-white text-neutral-800 border-neutral-300'
                : 'bg-neutral-950 text-neutral-200 border-neutral-700'
            }`}
          >
            {leftLabel}: <strong className={getAccentTextClass()}>{formatSigned(leftVal, false)}</strong>
          </span>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              isLight
                ? 'bg-white text-neutral-800 border-neutral-300'
                : 'bg-neutral-950 text-neutral-200 border-neutral-700'
            }`}
          >
            {rightLabel}: <strong className={getAccentTextClass()}>{formatSigned(rightVal, true)}</strong>
          </span>
          {resolvedWindowBadge && (
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded border font-semibold ${
                isLight
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-amber-950/40 text-amber-300 border-amber-700/50'
              }`}
            >
              {resolvedWindowBadge}
            </span>
          )}
        </div>
      </div>

      {/* Slider Track with Dual Thumbs */}
      <div className="flex flex-col gap-1 w-full pt-1 px-1">
        <SliderPrimitive.Root
          value={[leftVal, rightVal]}
          min={min}
          max={max}
          step={step}
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
            {/* Center Origin Notch */}
            {mode === 'centered-deadband' && (
              <div
                className={`absolute top-0 bottom-0 w-0.5 -translate-x-1/2 z-10 pointer-events-none ${
                  isLight ? 'bg-neutral-500' : 'bg-neutral-400'
                }`}
                style={{ left: `${originPct}%` }}
              />
            )}

            {/* Active Range (Deadband / Interval Zone) */}
            <SliderPrimitive.Range
              className={`absolute h-full rounded-full transition-colors ${getRangeColorClass()}`}
            />
          </SliderPrimitive.Track>

          {/* Left Thumb */}
          <SliderPrimitive.Thumb
            aria-label={`${leftLabel} thumb`}
            className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-grab active:cursor-grabbing ${
              isLight ? 'bg-white border-neutral-400' : 'bg-neutral-100 border-neutral-300'
            }`}
          />

          {/* Right Thumb */}
          <SliderPrimitive.Thumb
            aria-label={`${rightLabel} thumb`}
            className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-grab active:cursor-grabbing ${
              isLight ? 'bg-white border-neutral-400' : 'bg-neutral-100 border-neutral-300'
            }`}
          />
        </SliderPrimitive.Root>

        {/* Axis Ticks and Labels */}
        {showTicks && ticks.length > 0 && (
          <div className="flex items-center justify-between text-[10px] font-mono px-0.5 text-neutral-400 select-none">
            {ticks.map((t) => {
              const isOrigin = Math.abs(t - origin) < 1e-6;
              const isSelected = Math.abs(t - leftVal) < 1e-6 || Math.abs(t - rightVal) < 1e-6;
              return (
                <span
                  key={t}
                  className={`transition-colors ${
                    isOrigin
                      ? `font-bold ${getAccentTextClass()} scale-105`
                      : isSelected
                      ? isLight
                        ? 'font-bold text-neutral-900'
                        : 'font-bold text-neutral-100'
                      : 'opacity-60'
                  }`}
                >
                  {isOrigin && mode === 'centered-deadband'
                    ? `${t} (Target)`
                    : t > 0 && mode === 'centered-deadband'
                    ? `+${t}`
                    : t}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
