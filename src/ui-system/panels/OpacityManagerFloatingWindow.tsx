import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { useFloatingStore } from '../../stores/floatingStore';

export interface OpacityManagerFloatingWindowProps {
  isLight?: boolean;
}

export const OpacityManagerFloatingWindow: React.FC<OpacityManagerFloatingWindowProps> = ({
  isLight = false,
}) => {
  const { opacity, setOpacity } = useFloatingStore();
  const [inputValue, setInputValue] = useState<string>(String(opacity));

  useEffect(() => {
    setInputValue(String(opacity));
  }, [opacity]);

  const handleSliderChange = (vals: number[]) => {
    const nextVal = Math.min(100, Math.max(1, vals[0]));
    setOpacity(nextVal);
    setInputValue(String(nextVal));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const parsed = parseInt(raw.trim(), 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(100, Math.max(1, parsed));
      setOpacity(clamped);
    }
  };

  const handleBlur = () => {
    const parsed = parseInt(inputValue.trim(), 10);
    if (Number.isNaN(parsed)) {
      setInputValue(String(opacity));
    } else {
      const clamped = Math.min(100, Math.max(1, parsed));
      setOpacity(clamped);
      setInputValue(String(clamped));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-3 w-full h-full font-mono text-xs select-none px-1">
      {/* Simple Slider Progress Bar */}
      <SliderPrimitive.Root
        value={[opacity]}
        min={1}
        max={100}
        step={1}
        onValueChange={handleSliderChange}
        className="relative flex items-center select-none touch-none flex-1 h-5 cursor-pointer"
      >
        <SliderPrimitive.Track
          className={`relative grow rounded-full h-2 overflow-hidden ${
            isLight ? 'bg-neutral-200' : 'bg-neutral-800'
          }`}
        >
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-amber-500 transition-colors" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={`block h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
          }`}
        />
      </SliderPrimitive.Root>

      {/* Right-side Numeric Input */}
      <div className="flex items-center shrink-0">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={3}
          className={`w-12 px-2 py-1 text-center font-mono text-xs font-bold rounded-lg border outline-none transition-all ${
            isLight
              ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-amber-500 focus:bg-white'
              : 'bg-neutral-800 border-neutral-700 text-neutral-100 focus:border-amber-500 focus:bg-neutral-850'
          }`}
        />
        <span className={`ml-1 text-[11px] font-bold ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          %
        </span>
      </div>
    </div>
  );
};
