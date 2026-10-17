import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

export interface StepperSliderRowProps {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const StepperSliderRow: React.FC<StepperSliderRowProps> = ({
  label,
  note,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  const [inputText, setInputText] = useState(String(value));

  useEffect(() => {
    setInputText(String(value));
  }, [value]);

  const commitInput = () => {
    const parsed = parseInt(inputText, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setInputText(String(clamped));
    } else {
      setInputText(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitInput();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setInputText(String(value));
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      className={`flex items-center gap-3 w-full py-2 px-2.5 rounded-xl transition-colors select-none ${
        isLight ? 'hover:bg-neutral-500/10' : 'hover:bg-neutral-800/60'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex flex-col text-left leading-tight w-44 shrink-0 min-w-0 pr-1">
        <span className={`text-xs font-semibold truncate ${
          isLight ? 'text-neutral-800' : 'text-neutral-200'
        }`}>
          {label}
        </span>
        <span className={`text-[10px] mt-0.5 truncate ${
          isLight ? 'text-neutral-500' : 'text-neutral-400'
        }`}>
          {note}
        </span>
      </div>

      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
        className="relative flex items-center select-none touch-none grow h-5 cursor-pointer"
      >
        <SliderPrimitive.Track className={`relative grow rounded-full h-1.5 overflow-hidden ${
          isLight ? 'bg-neutral-200' : 'bg-neutral-800'
        }`}>
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-amber-500" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
        }`} />
      </SliderPrimitive.Root>

      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={commitInput}
          onKeyDown={handleKeyDown}
          title="Direct numeric input - Press Enter to confirm"
          className={`font-mono text-xs w-14 text-center py-0.5 px-1 rounded-md border outline-none transition-colors ${
            isLight
              ? 'bg-neutral-100 text-neutral-800 border-neutral-300 focus:border-amber-500 focus:bg-white'
              : 'bg-neutral-900 text-neutral-200 border-neutral-700 focus:border-amber-500 focus:bg-neutral-950'
          }`}
        />
        {unit && (
          <span className={`text-[10px] font-mono shrink-0 w-6 ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
