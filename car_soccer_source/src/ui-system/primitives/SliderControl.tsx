import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Minus, Plus } from 'lucide-react';

export type SliderColorScheme = 'neutral' | 'amber' | 'orange';

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
  className?: string;
}

/**
 * SliderControl
 * Radix Slider primitive wrapped with SimpleUI tactile ergonomics:
 * - Direct value readout badge
 * - Stepper buttons (- / +)
 * - Highly neutral zero-saturation black & white track theme by default (avoiding blue)
 * - Accessible keyboard navigation & focus states
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
  isLight = false,
  disabled = false,
  colorScheme = 'neutral',
  className = '',
}) => {
  const handleDecrement = () => {
    const next = Math.max(min, Math.round((value - step) * 100) / 100);
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, Math.round((value + step) * 100) / 100);
    onChange(next);
  };

  // Resolve track active range color
  const getRangeColorClass = () => {
    if (colorScheme === 'amber') return 'bg-amber-500';
    if (colorScheme === 'orange') return 'bg-orange-500';
    // 'neutral' (default monochrome black-and-white scheme)
    return isLight ? 'bg-neutral-900' : 'bg-white';
  };

  return (
    <div
      data-component="slider-control"
      className={`flex flex-col gap-2 w-full select-none ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
          {label}
        </span>
        <span
          className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
            isLight
              ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
              : 'bg-neutral-900 text-neutral-300 border-neutral-700'
          }`}
        >
          {value}
          {unit}
        </span>
      </div>

      {description && (
        <span className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {description}
        </span>
      )}

      <div className="flex items-center gap-3">
        {showStepper && (
          <button
            type="button"
            aria-label="Decrement"
            onClick={handleDecrement}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}

        <SliderPrimitive.Root
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(vals) => onChange(vals[0])}
          className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
        >
          <SliderPrimitive.Track
            className={`relative grow rounded-full h-2 overflow-hidden ${
              isLight ? 'bg-neutral-200' : 'bg-neutral-800'
            }`}
          >
            <SliderPrimitive.Range className={`absolute h-full rounded-full transition-colors ${getRangeColorClass()}`} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
              isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
            }`}
          />
        </SliderPrimitive.Root>

        {showStepper && (
          <button
            type="button"
            aria-label="Increment"
            onClick={handleIncrement}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
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
