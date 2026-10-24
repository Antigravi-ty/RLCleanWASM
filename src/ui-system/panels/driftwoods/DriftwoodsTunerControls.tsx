import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {
  TunerPrecisionContext,
  useTunerPrecision,
  getDecimalPlaces,
  PRECISION_DIGITS,
  PrecisionDigitPicker,
  type TunerPrecisionContextValue,
  type PrecisionDigitPickerProps,
} from '../../primitives/PrecisionDigitPicker';

export {
  TunerPrecisionContext,
  useTunerPrecision,
  getDecimalPlaces,
  PRECISION_DIGITS,
  PrecisionDigitPicker,
  type TunerPrecisionContextValue,
  type PrecisionDigitPickerProps,
};

export interface TunerRowProps {
  label: string;
  description?: string;
  value: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  stepOverride?: number;
  onChange: (val: number) => void;
  isLight?: boolean;
  unit?: string;
}

export const TunerRow: React.FC<TunerRowProps> = ({
  label,
  description,
  value,
  sliderMin,
  sliderMax,
  sliderStep,
  stepOverride,
  onChange,
  isLight = false,
  unit = '',
}) => {
  const { step: contextStep } = useTunerPrecision();
  const activeStep = stepOverride ?? contextStep ?? sliderStep;

  const [text, setText] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      delta = activeStep;
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      delta = -activeStep;
    }

    if (delta !== 0) {
      e.preventDefault();
      e.stopPropagation();

      const currentVal = typeof value === 'number' && Number.isFinite(value) ? value : 0;

      // Preserve all existing decimal precision and never truncate trailing fractional digits
      const existingDecimals = Math.max(getDecimalPlaces(value), getDecimalPlaces(text));
      const stepDecimals = getDecimalPlaces(activeStep);
      const targetDecimals = Math.min(8, Math.max(existingDecimals, stepDecimals));

      const nextVal = Number((currentVal + delta).toFixed(targetDecimals));
      onChange(nextVal);
      setText(String(nextVal));
    }
  };

  const sliderClamped =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(sliderMax, Math.max(sliderMin, value))
      : sliderMin;

  return (
    <div
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-all outline-none ${
        isFocused
          ? 'ring-1 ring-emerald-500 border-emerald-500/80 shadow-xs'
          : isLight
          ? 'bg-neutral-50/80 border-neutral-200'
          : 'bg-neutral-850/60 border-neutral-700/60'
      }`}
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-semibold truncate ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
            {label}
          </span>
          {isFocused && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono select-none">
              ±{activeStep}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="text"
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="0.0"
            title={`Step size: ±${activeStep}. Press Up/Down or Left/Right arrows to step.`}
            className={`w-24 px-2 py-0.5 text-right font-mono text-xs rounded border transition-colors outline-none focus:ring-1 focus:ring-emerald-500 ${
              isLight
                ? 'bg-white border-neutral-300 text-neutral-800'
                : 'bg-neutral-900 border-neutral-700 text-neutral-100'
            }`}
          />
          {unit && (
            <span className="text-[10px] font-mono text-neutral-400 select-none">
              {unit}
            </span>
          )}
        </div>
      </div>

      {description && (
        <span className={`text-[10px] leading-tight ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {description}
        </span>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <SliderPrimitive.Root
          value={[sliderClamped]}
          min={sliderMin}
          max={sliderMax}
          step={Math.min(sliderStep, activeStep)}
          onValueChange={([val]) => onChange(val)}
          className="relative flex items-center select-none touch-none w-full h-4 cursor-pointer"
        >
          <SliderPrimitive.Track
            className={`relative grow rounded-full h-1.5 overflow-hidden ${
              isLight ? 'bg-neutral-200' : 'bg-neutral-700'
            }`}
          >
            <SliderPrimitive.Range className="absolute h-full bg-emerald-500" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block h-3.5 w-3.5 rounded-full bg-white border border-neutral-300 shadow-sm transition-transform hover:scale-110 focus:outline-none"
          />
        </SliderPrimitive.Root>
      </div>
    </div>
  );
};

export interface TunerSegmentedOption<T> {
  value: T;
  label: string;
  badge?: string;
}

export interface TunerSegmentedControlProps<T extends string | number> {
  label?: string;
  description?: string;
  value: T;
  options: TunerSegmentedOption<T>[];
  onChange: (val: T) => void;
  isLight?: boolean;
}

export const TunerSegmentedControl = <T extends string | number>({
  label,
  description,
  value,
  options,
  onChange,
  isLight = false,
}: TunerSegmentedControlProps<T>) => {
  return (
    <div
      className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-colors ${
        isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
      }`}
    >
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
            {label}
          </span>
        </div>
      )}

      {description && (
        <span className={`text-[10px] leading-tight ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {description}
        </span>
      )}

      <div
        className={`flex items-center p-0.5 rounded-lg border gap-0.5 ${
          isLight ? 'bg-neutral-200/70 border-neutral-300' : 'bg-neutral-900 border-neutral-750'
        }`}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer text-center truncate ${
                isSelected
                  ? isLight
                    ? 'bg-white text-emerald-600 shadow-xs font-semibold'
                    : 'bg-neutral-800 text-emerald-400 shadow-xs font-semibold'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>{opt.label}</span>
              {opt.badge && (
                <span className="ml-1 text-[9px] opacity-70">({opt.badge})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export interface TunerColorRowProps {
  label: string;
  description?: string;
  value: string;
  onChange: (hex: string) => void;
  isLight?: boolean;
}

export const TunerColorRow: React.FC<TunerColorRowProps> = ({
  label,
  description,
  value,
  onChange,
  isLight = false,
}) => {
  const [text, setText] = useState<string>(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    onChange(raw);
  };

  return (
    <div
      className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-colors ${
        isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
      }`}
    >
      <div className="flex flex-col gap-0.5 min-w-0 pr-2">
        <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
          {label}
        </span>
        {description && (
          <span className={`text-[10px] leading-tight ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {description}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="color"
          value={value.startsWith('#') && value.length === 7 ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded border border-neutral-600 cursor-pointer p-0 bg-transparent"
        />
        <input
          type="text"
          value={text}
          onChange={handleInputChange}
          placeholder="#ffffff"
          className={`w-20 px-2 py-0.5 text-center font-mono text-xs rounded border transition-colors outline-none focus:ring-1 focus:ring-emerald-500 ${
            isLight
              ? 'bg-white border-neutral-300 text-neutral-800'
              : 'bg-neutral-900 border-neutral-700 text-neutral-100'
          }`}
        />
      </div>
    </div>
  );
};

export interface TunerToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isLight?: boolean;
}

export const TunerToggleRow: React.FC<TunerToggleRowProps> = ({
  label,
  description,
  checked,
  onChange,
  isLight = false,
}) => {
  return (
    <div
      className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-colors cursor-pointer select-none ${
        isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
      }`}
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-col gap-0.5 min-w-0 pr-2">
        <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
          {label}
        </span>
        {description && (
          <span className={`text-[10px] leading-tight ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {description}
          </span>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-emerald-500' : isLight ? 'bg-neutral-300' : 'bg-neutral-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
