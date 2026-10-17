import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

export interface TunerRowProps {
  label: string;
  description?: string;
  value: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
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
  onChange,
  isLight = false,
  unit = '',
}) => {
  const [text, setText] = useState<string>(String(value));

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

  const sliderClamped = typeof value === 'number' && Number.isFinite(value)
    ? Math.min(sliderMax, Math.max(sliderMin, value))
    : sliderMin;

  return (
    <div
      className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-colors ${
        isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
      }`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={text}
            onChange={handleInputChange}
            placeholder="0.0"
            className={`w-20 px-2 py-0.5 text-right font-mono text-xs rounded border transition-colors outline-none focus:ring-1 focus:ring-amber-500 ${
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
          step={sliderStep}
          onValueChange={([val]) => {
            if (sliderStep < 1) {
              const decimals = (String(sliderStep).split('.')[1] || '').length;
              onChange(parseFloat(val.toFixed(decimals)));
            } else {
              onChange(val);
            }
          }}
          className="relative flex items-center select-none touch-none w-full h-4 cursor-pointer"
        >
          <SliderPrimitive.Track
            className={`relative grow rounded-full h-1.5 overflow-hidden ${
              isLight ? 'bg-neutral-200' : 'bg-neutral-700'
            }`}
          >
            <SliderPrimitive.Range className="absolute h-full bg-amber-500" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block h-3.5 w-3.5 rounded-full bg-white border border-neutral-300 shadow-sm transition-transform hover:scale-110 focus:outline-none"
          />
        </SliderPrimitive.Root>
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
          value={value.startsWith('#') && value.length === 7 ? value : '#ffaa00'}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded border border-neutral-600 cursor-pointer p-0 bg-transparent"
        />
        <input
          type="text"
          value={text}
          onChange={handleInputChange}
          placeholder="#ffffff"
          className={`w-20 px-2 py-0.5 text-center font-mono text-xs rounded border transition-colors outline-none focus:ring-1 focus:ring-amber-500 ${
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

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
          checked ? 'bg-amber-500' : isLight ? 'bg-neutral-300' : 'bg-neutral-700'
        }`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
