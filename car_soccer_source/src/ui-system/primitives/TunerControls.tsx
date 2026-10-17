import React, { useState, useEffect } from 'react';
import { Link2, Unlink2, RotateCcw } from 'lucide-react';
import { SliderControl } from './SliderControl';
export {
  PriorityQueueList,
  EventFilterMatrix,
  type PriorityQueueItem,
  type PriorityQueueListProps,
  type EventCatalogEntry,
  type EventFilterMatrixProps,
} from './TunerListControls';

export interface ColorSwatchInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
  isLight?: boolean;
  className?: string;
}

export const ColorSwatchInput: React.FC<ColorSwatchInputProps> = ({
  label,
  description,
  value,
  onChange,
  presets,
  isLight = false,
  className = '',
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
      data-component="color-swatch-input"
      className={`p-2.5 rounded-xl border flex flex-col gap-2 text-xs select-none transition-colors ${
        isLight
          ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
          : 'bg-neutral-900/60 border-neutral-800 text-neutral-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
          <span className={`font-semibold truncate ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
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
            value={value.startsWith('#') && value.length === 7 ? value : '#f59e0b'}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 rounded border border-neutral-500/60 cursor-pointer p-0 bg-transparent"
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

      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
          <span className="text-[10px] font-mono text-neutral-400 mr-1">Swatches:</span>
          {presets.map((hex) => {
            const isActive = value.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => onChange(hex)}
                title={hex}
                className={`h-4 w-4 rounded-full border transition-transform cursor-pointer ${
                  isActive
                    ? 'scale-125 ring-2 ring-amber-500 border-white'
                    : 'border-black/20 dark:border-white/20 hover:scale-110'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export interface UVTransformState {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  linkScale: boolean;
}

export interface UVTransformControlProps {
  title?: string;
  value: UVTransformState;
  onChange: (patch: Partial<UVTransformState>) => void;
  usePrecisionContext?: boolean;
  isLight?: boolean;
  className?: string;
}

export const UVTransformControl: React.FC<UVTransformControlProps> = ({
  title = 'Texture UV Transform (Scale & Offset)',
  value,
  onChange,
  usePrecisionContext = true,
  isLight = false,
  className = '',
}) => {
  const handleScaleXChange = (val: number) => {
    if (value.linkScale) {
      onChange({ scaleX: val, scaleY: val });
    } else {
      onChange({ scaleX: val });
    }
  };

  const handleScaleYChange = (val: number) => {
    if (value.linkScale) {
      onChange({ scaleX: val, scaleY: val });
    } else {
      onChange({ scaleY: val });
    }
  };

  const handleReset = () => {
    onChange({ scaleX: 1.0, scaleY: 1.0, offsetX: 0.0, offsetY: 0.0 });
  };

  return (
    <div
      data-component="uv-transform-control"
      className={`p-3 rounded-xl border flex flex-col gap-2.5 select-none transition-colors ${
        isLight
          ? 'bg-neutral-50/80 border-neutral-200 text-neutral-800'
          : 'bg-neutral-900/60 border-neutral-800 text-neutral-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
          {title}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ linkScale: !value.linkScale })}
            title={
              value.linkScale
                ? 'Scaling linked (1:1). Click to unlock.'
                : 'Scaling unlinked. Click to lock aspect ratio.'
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer transition-colors border ${
              value.linkScale
                ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                : isLight
                ? 'bg-white text-neutral-600 border-neutral-300'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            {value.linkScale ? (
              <>
                <Link2 className="h-3 w-3" />
                <span>Linked 1:1</span>
              </>
            ) : (
              <>
                <Unlink2 className="h-3 w-3" />
                <span>Unlinked</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Reset UV repeat (1.0, 1.0) and offset (0.0, 0.0)"
            className={`p-1 rounded border cursor-pointer transition-colors ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-600'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
            }`}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div
          className={`p-2.5 rounded-lg border ${
            isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <SliderControl
            label="Scale X (Sx)"
            value={value.scaleX}
            min={0.5}
            max={2.0}
            step={0.01}
            origin={1.0}
            variation="centered"
            colorScheme="emerald"
            editable={true}
            showStepper={false}
            usePrecisionContext={usePrecisionContext}
            onChange={handleScaleXChange}
            isLight={isLight}
          />
        </div>

        <div
          className={`p-2.5 rounded-lg border ${
            isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <SliderControl
            label="Scale Y (Sy)"
            value={value.scaleY}
            min={0.5}
            max={2.0}
            step={0.01}
            origin={1.0}
            variation="centered"
            colorScheme="emerald"
            editable={true}
            showStepper={false}
            usePrecisionContext={usePrecisionContext}
            onChange={handleScaleYChange}
            isLight={isLight}
          />
        </div>

        <div
          className={`p-2.5 rounded-lg border ${
            isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <SliderControl
            label="Offset X (Tx)"
            value={value.offsetX}
            min={-1.0}
            max={1.0}
            step={0.01}
            origin={0.0}
            variation="centered"
            showSign={true}
            colorScheme="amber"
            editable={true}
            showStepper={false}
            usePrecisionContext={usePrecisionContext}
            onChange={(val) => onChange({ offsetX: val })}
            isLight={isLight}
          />
        </div>

        <div
          className={`p-2.5 rounded-lg border ${
            isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <SliderControl
            label="Offset Y (Ty)"
            value={value.offsetY}
            min={-1.0}
            max={1.0}
            step={0.01}
            origin={0.0}
            variation="centered"
            showSign={true}
            colorScheme="amber"
            editable={true}
            showStepper={false}
            usePrecisionContext={usePrecisionContext}
            onChange={(val) => onChange({ offsetY: val })}
            isLight={isLight}
          />
        </div>
      </div>
    </div>
  );
};
