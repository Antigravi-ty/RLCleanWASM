import React, { useState, useEffect, useContext, useRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { TunerPrecisionContext, getDecimalPlaces } from './PrecisionDigitPicker';

export type SliderColorScheme = 'neutral' | 'amber' | 'orange' | 'sky' | 'emerald' | 'rose';
export type SliderVariation = 'default' | 'centered' | 'bipolar';

export interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  description?: string;
  showStepper?: boolean;
  isLight?: boolean;
  disabled?: boolean;
  /**
   * Color scheme for the slider active range track.
   * Defaults to 'neutral' (monochrome black/white, zero saturation), avoiding harsh blue.
   */
  colorScheme?: SliderColorScheme;
  /**
   * Optional distinct color scheme when value < origin in 'centered' / 'bipolar' mode.
   */
  negativeColorScheme?: SliderColorScheme;
  /**
   * Slider variation mode:
   * - 'default': fills continuously from the minimum left edge to the current value.
   * - 'centered' / 'bipolar': fills bi-directionally (leftward or rightward) from a reference origin point (e.g. 0 for positive/negative values).
   */
  variation?: SliderVariation;
  /**
   * Alias for `variation`.
   */
  variant?: SliderVariation;
  /**
   * Reference origin point for the 'centered' / 'bipolar' variation.
   * Defaults to 0 (or `(min + max) / 2` if 0 is out of bounds).
   */
  origin?: number;
  /**
   * Whether to render a subtle vertical tick/notch at the origin position.
   * Defaults to true in 'centered' mode.
   */
  showOriginIndicator?: boolean;
  /**
   * Whether double-clicking the slider or clicking the origin badge resets value to `origin`.
   * Defaults to true in 'centered' mode.
   */
  allowOriginReset?: boolean;
  /**
   * Custom formatter for displaying the current value badge.
   */
  formatValue?: (val: number) => string;
  /**
   * Whether to prefix positive values with a '+' sign in the readout badge (e.g. +20).
   */
  showSign?: boolean;
  /**
   * Whether to render an inline editable numeric input box instead of a static badge
   * (unified from RLCleanWASM TunerRow / AdvancedSliderRow / StepperSliderRow).
   */
  editable?: boolean;
  /**
   * Whether to allow typed values in `editable` mode to exceed `[min, max]` slider bounds.
   */
  allowOutOfBoundsInput?: boolean;
  /**
   * Whether to subscribe to `TunerPrecisionContext` (from `PrecisionDigitPicker`) when focused.
   */
  usePrecisionContext?: boolean;
  className?: string;
}

/**
 * SliderControl
 * Radix Slider primitive wrapped with SimpleUI tactile ergonomics:
 * - Direct value readout badge or inline editable numeric input (`editable={true}`)
 * - Stepper buttons (- / +) & keyboard arrow precision stepping
 * - Highly neutral zero-saturation black & white track theme by default (avoiding blue)
 * - Bi-directional origin-based filling (`variation="centered"`) for positive & negative values
 *   or custom anchor points (e.g., 0 center balance or 100% unity gain)
 */
export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  description,
  showStepper = true,
  isLight,
  disabled = false,
  colorScheme = 'neutral',
  negativeColorScheme,
  variation,
  variant,
  origin,
  showOriginIndicator,
  allowOriginReset,
  formatValue,
  showSign = false,
  editable = false,
  allowOutOfBoundsInput = false,
  usePrecisionContext = false,
  className = '',
}) => {
  const precisionCtx = useContext(TunerPrecisionContext);
  const activeStep = usePrecisionContext && precisionCtx ? precisionCtx.step : step;

  // Automatically resolve light mode from prop or document element
  const resolvedIsLight =
    isLight !== undefined
      ? isLight
      : typeof document !== 'undefined'
      ? document.documentElement.classList.contains('light') || document.documentElement.dataset.theme === 'light'
      : false;

  // Resolve effective variation mode and reference origin
  const rawVariation = variation ?? variant ?? (origin !== undefined ? 'centered' : 'default');
  const isCentered = rawVariation === 'centered' || rawVariation === 'bipolar';

  const resolvedOrigin =
    origin !== undefined
      ? origin
      : min <= 0 && max >= 0
      ? 0
      : (min + max) / 2;

  const clampedOrigin = Math.max(min, Math.min(max, resolvedOrigin));
  const clampedValue = Math.max(min, Math.min(max, Number.isFinite(value) ? value : resolvedOrigin));
  const totalRange = max - min;
  const originPct = totalRange > 0 ? ((clampedOrigin - min) / totalRange) * 100 : 50;
  const valuePct = totalRange > 0 ? ((clampedValue - min) / totalRange) * 100 : 50;

  const fillLeft = Math.min(originPct, valuePct);
  const fillWidth = Math.abs(valuePct - originPct);
  const shouldShowOrigin = showOriginIndicator ?? isCentered;
  const canResetOrigin = allowOriginReset ?? isCentered;

  const [inputText, setInputText] = useState<string>(String(value));
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isRowFocused, setIsRowFocused] = useState<boolean>(false);
  const ignoreNextBlurRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isInputFocused) {
      setInputText(String(value));
    }
  }, [value, isInputFocused]);

  const stepByDelta = (delta: number) => {
    const currentVal = typeof value === 'number' && Number.isFinite(value) ? value : clampedOrigin;
    const existingDecimals = Math.max(getDecimalPlaces(currentVal), getDecimalPlaces(inputText));
    const stepDecimals = getDecimalPlaces(activeStep);
    const targetDecimals = Math.min(8, Math.max(existingDecimals, stepDecimals));
    const unclamped = Number((currentVal + delta).toFixed(targetDecimals));
    const nextVal = allowOutOfBoundsInput ? unclamped : Math.max(min, Math.min(max, unclamped));
    onChange(nextVal);
    setInputText(String(nextVal));
  };

  const handleDecrement = () => stepByDelta(-activeStep);
  const handleIncrement = () => stepByDelta(activeStep);

  const commitInputText = () => {
    setIsInputFocused(false);
    if (ignoreNextBlurRef.current) {
      ignoreNextBlurRef.current = false;
      setInputText(String(value));
      return;
    }
    const parsed = parseFloat(inputText.trim());
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      const finalVal = allowOutOfBoundsInput ? parsed : Math.max(min, Math.min(max, parsed));
      onChange(finalVal);
      setInputText(String(finalVal));
    } else {
      setInputText(String(value));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInputText();
      ignoreNextBlurRef.current = true;
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ignoreNextBlurRef.current = true;
      setInputText(String(value));
      setIsInputFocused(false);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || (usePrecisionContext && e.key === 'ArrowRight')) {
      e.preventDefault();
      stepByDelta(activeStep);
    } else if (e.key === 'ArrowDown' || (usePrecisionContext && e.key === 'ArrowLeft')) {
      e.preventDefault();
      stepByDelta(-activeStep);
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!usePrecisionContext) return;
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      stepByDelta(activeStep);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      stepByDelta(-activeStep);
    }
  };

  // Format readout badge value
  const displayValue = () => {
    if (formatValue) return formatValue(value);
    if (showSign && value > 0) return `+${value}`;
    return `${value}`;
  };

  // Resolve track active range color
  const resolveSchemeClass = (scheme: SliderColorScheme) => {
    if (scheme === 'amber') return 'bg-amber-500';
    if (scheme === 'orange') return 'bg-orange-500';
    if (scheme === 'sky') return 'bg-sky-500';
    if (scheme === 'emerald') return 'bg-emerald-500';
    if (scheme === 'rose') return 'bg-rose-500';
    // 'neutral' (default monochrome black-and-white scheme)
    return resolvedIsLight ? 'bg-neutral-900' : 'bg-white';
  };

  const getRangeColorClass = () => {
    if (isCentered && value < clampedOrigin && negativeColorScheme) {
      return resolveSchemeClass(negativeColorScheme);
    }
    return resolveSchemeClass(colorScheme);
  };

  const isOffOrigin = Math.abs(value - clampedOrigin) > 1e-6;
  const isAnyFocused = isInputFocused || isRowFocused;

  return (
    <div
      data-component="slider-control"
      data-variation={isCentered ? 'centered' : 'default'}
      tabIndex={usePrecisionContext ? 0 : undefined}
      onFocus={() => {
        if (usePrecisionContext) setIsRowFocused(true);
      }}
      onBlur={(e) => {
        if (usePrecisionContext && !e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsRowFocused(false);
        }
      }}
      onKeyDown={handleRowKeyDown}
      className={`flex flex-col gap-2 w-full select-none outline-none ${disabled ? 'opacity-40 pointer-events-none' : ''} ${
        usePrecisionContext && isAnyFocused ? 'ring-1 ring-amber-500/60 rounded-lg p-1 -m-1' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-semibold truncate ${resolvedIsLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
            {label}
          </span>
          {isCentered && canResetOrigin && isOffOrigin && (
            <button
              type="button"
              onClick={() => {
                onChange(clampedOrigin);
                setInputText(String(clampedOrigin));
              }}
              title={`Reset to origin (${clampedOrigin}${unit})`}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                resolvedIsLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border-neutral-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border-neutral-700'
              }`}
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>{clampedOrigin}{unit}</span>
            </button>
          )}
          {usePrecisionContext && precisionCtx && isAnyFocused && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-500 font-mono">
              ±{activeStep}
            </span>
          )}
        </div>

        {editable ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="text"
              value={inputText}
              onFocus={() => {
                ignoreNextBlurRef.current = false;
                setIsInputFocused(true);
              }}
              onBlur={commitInputText}
              onChange={(e) => {
                setInputText(e.target.value);
              }}
              onKeyDown={handleInputKeyDown}
              title={`Step: ±${activeStep}. Press Up/Down arrows to step, or Enter / unfocus to commit.`}
              className={`w-20 px-2 py-0.5 text-right font-mono text-[11px] rounded border outline-none transition-colors ${
                resolvedIsLight
                  ? 'bg-white text-neutral-800 border-neutral-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40'
                  : 'bg-neutral-900 text-neutral-200 border-neutral-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40'
              }`}
            />
            {unit && (
              <span className={`font-mono text-[10px] ${resolvedIsLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {unit}
              </span>
            )}
          </div>
        ) : (
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border transition-colors shrink-0 ${
              resolvedIsLight
                ? 'bg-neutral-100 text-neutral-800 border-neutral-300 shadow-2xs'
                : 'bg-neutral-900 text-neutral-300 border-neutral-700'
            }`}
          >
            {displayValue()}
            {unit}
          </span>
        )}
      </div>

      {description && (
        <span className={`text-[11px] leading-snug ${resolvedIsLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {description}
        </span>
      )}

      <div className="flex items-center gap-3">
        {showStepper && (
          <button
            type="button"
            aria-label="Decrement"
            onClick={handleDecrement}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 shrink-0 ${
              resolvedIsLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}

        <SliderPrimitive.Root
          value={[clampedValue]}
          min={min}
          max={max}
          step={Math.min(step, activeStep)}
          onDoubleClick={() => {
            if (canResetOrigin) {
              onChange(clampedOrigin);
              setInputText(String(clampedOrigin));
            }
          }}
          onValueChange={(vals) => {
            const rawVal = vals[0];
            const effStep = Math.min(step, activeStep);
            const decimals = getDecimalPlaces(effStep);
            const rounded = decimals > 0 ? parseFloat(rawVal.toFixed(Math.min(8, decimals))) : rawVal;
            setIsInputFocused(false);
            setInputText(String(rounded));
            onChange(rounded);
          }}
          className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
        >
          <SliderPrimitive.Track
            className={`relative grow rounded-full h-2 overflow-hidden transition-colors ${
              resolvedIsLight ? 'bg-neutral-200' : 'bg-neutral-800'
            }`}
          >
            {isCentered ? (
              <>
                {shouldShowOrigin && (
                  <div
                    className={`absolute top-0 bottom-0 w-0.5 -translate-x-1/2 z-10 pointer-events-none transition-colors ${
                      resolvedIsLight ? 'bg-neutral-400' : 'bg-neutral-500'
                    }`}
                    style={{ left: `${originPct}%` }}
                  />
                )}
                <div
                  className={`absolute h-full rounded-full transition-colors ${getRangeColorClass()}`}
                  style={{
                    left: `${fillLeft}%`,
                    width: `${fillWidth}%`,
                  }}
                />
              </>
            ) : (
              <SliderPrimitive.Range className={`absolute h-full rounded-full transition-colors ${getRangeColorClass()}`} />
            )}
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
              resolvedIsLight ? 'bg-white border-neutral-400 shadow-xs' : 'bg-neutral-100 border-neutral-300'
            }`}
          />
        </SliderPrimitive.Root>

        {showStepper && (
          <button
            type="button"
            aria-label="Increment"
            onClick={handleIncrement}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 shrink-0 ${
              resolvedIsLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
