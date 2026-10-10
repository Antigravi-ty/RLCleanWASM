import React, { useState, useRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { VStack } from '../layout/VStack';
import { Info } from 'lucide-react';
import { useUIStore, type TrajectoryConfig } from '../core/store';

export interface Layer3BallTrajectoryRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onCollapsePreview?: () => void;
  transparent?: boolean;
  trajectory?: TrajectoryConfig;
  onUpdateTrajectory?: (patch: Partial<TrajectoryConfig>) => void;
}

interface CompactSliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string | number;
  onChange: (val: number) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

const CompactSliderRow: React.FC<CompactSliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  displayValue,
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div
      className="flex items-center gap-3 w-full py-1 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 select-none"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <span className={`w-36 shrink-0 text-xs font-semibold truncate ${
        isLight ? 'text-neutral-800' : 'text-neutral-200'
      }`}>
        {label}
      </span>

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
          <SliderPrimitive.Range className={`absolute h-full rounded-full ${
            isLight ? 'bg-neutral-900' : 'bg-white'
          }`} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
          isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
        }`} />
      </SliderPrimitive.Root>

      <span className={`font-mono text-[11px] w-14 shrink-0 text-center py-0.5 rounded border select-none ${
        isLight
          ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
          : 'bg-neutral-800 text-neutral-300 border-neutral-700'
      }`}>
        {displayValue !== undefined ? displayValue : value}{unit}
      </span>
    </div>
  );
};

const PRESET_COLORS: { value: string; label: string }[] = [
  { value: '#000000', label: 'Black' },
  { value: '#ffffff', label: 'White' },
  { value: '#00f0ff', label: 'Cyan' },
  { value: '#fbbf24', label: 'Amber' },
  { value: '#39ff14', label: 'Lime' },
];

/**
 * [Recipe] Layer 3 Ball Trajectory Predictor Configuration Panel (Width: 480px)
 * - Concise, compact single-row ergonomics throughout
 * - Header has Live Preview pill (label on left, TAB keycap on right)
 * - Removed redundant middle-content "press tab to collapse" pill
 * - Full-width segmented controls for pattern mode and color selection
 * - Compact horizontal single-row sliders without stepper buttons
 * - Purged non-existent physics markers and solver step mockups
 * - Color section includes active swatch preview with native picker click-through & 'Custom' option
 * - Fully neutral, desaturated styling
 */
export const Layer3BallTrajectoryRecipe: React.FC<Layer3BallTrajectoryRecipeProps> = ({
  isLight = false,
  onBack,
  onCollapsePreview,
  transparent = false,
  trajectory: propTrajectory,
  onUpdateTrajectory: propUpdateTrajectory,
}) => {
  const storeTrajectory = useUIStore((s) => s.trajectory);
  const storeUpdateTrajectory = useUIStore((s) => s.updateTrajectory);
  const trajectory = propTrajectory ?? storeTrajectory;
  const updateTrajectory = propUpdateTrajectory ?? storeUpdateTrajectory;

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const horizonSec = trajectory.duration ?? Number(((trajectory.predictionTicks || 600) / 120).toFixed(1));
  const opacityPct = Math.round((trajectory.opacity ?? 0.5) * 100);
  const currentColor = trajectory.color ?? '#000000';

  // Determine if current color matches any preset or is custom
  const isPreset = PRESET_COLORS.some((p) => p.value.toLowerCase() === currentColor.toLowerCase());
  const activeColorValue = isPreset ? currentColor.toLowerCase() : 'custom';

  const handleColorSelection = (val: string) => {
    if (val === 'custom') {
      // Trigger native color picker
      colorInputRef.current?.click();
    } else {
      updateTrajectory({ color: val });
    }
  };

  return (
    <PanelContainer isLight={isLight} transparent={transparent} className="w-full max-w-[480px]">
      <PanelHeader
        title="TRAJECTORY PREDICTOR"
        onBack={onBack}
        isLight={isLight}
        rightElement={
          <button
            type="button"
            onClick={onCollapsePreview}
            onMouseEnter={() => setHoveredDesc('Press TAB or click to collapse into Live Preview dock and drive freely in simulation.')}
            onMouseLeave={() => setHoveredDesc(null)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer select-none active:scale-95 ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
            }`}
            title="Press TAB or click to collapse to Live Preview dock"
          >
            <span className={`text-[11px] font-sans font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
              Live Preview
            </span>
            <KeycapBadge shortcut="TAB" size="sm" isLight={isLight} />
          </button>
        }
      />

      <PanelContent scrollable className="p-4 sm:p-5">
        <VStack gap="md" isLight={isLight}>
          {/* 1. Master Enable Switch */}
          <div
            className="flex items-center justify-between w-full py-1 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
            onMouseEnter={() => setHoveredDesc('Toggles real-time 3D physical flight path prediction for the ball.')}
            onMouseLeave={() => setHoveredDesc(null)}
            onClick={() => updateTrajectory({ enabled: !trajectory.enabled })}
          >
            <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
              <span className={`text-xs font-semibold truncate ${
                isLight ? 'text-neutral-800' : 'text-neutral-200'
              }`}>
                Enable Predictor
              </span>
              <span className={`text-[11px] mt-0.5 truncate ${
                isLight ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                Active when ball linear velocity ≥ 250 UU/s
              </span>
            </div>
            <ToggleSwitch
              checked={Boolean(trajectory.enabled)}
              onCheckedChange={(checked) => updateTrajectory({ enabled: checked })}
              isLight={isLight}
              variant="neutral"
            />
          </div>

          {/* 2. Trajectory Horizon Duration (Compact single-row) */}
          <CompactSliderRow
            label="Trajectory Horizon"
            value={horizonSec}
            min={0.5}
            max={5.0}
            step={0.1}
            unit="s"
            displayValue={horizonSec.toFixed(1)}
            onChange={(val) => updateTrajectory({ duration: val, predictionTicks: Math.round(val * 120) })}
            onHover={() => setHoveredDesc(`Sets future flight path simulation time up to ${Math.round(horizonSec * 120)} ticks (5.0s max @ 120Hz).`)}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          {/* 3. Trajectory Mode Selector (Dynamic vs Static) - Full Width */}
          <div
            className="flex flex-col gap-1.5 w-full py-1 px-2 rounded-lg transition-colors hover:bg-neutral-500/10"
            onMouseEnter={() => setHoveredDesc('Dynamic mode flows dashes relative to ball motion; Static mode locks dash intervals in world coordinates.')}
            onMouseLeave={() => setHoveredDesc(null)}
          >
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Trajectory Pattern Mode
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                {trajectory.dynamicMode ? 'Dynamic Flow' : 'Static Path'}
              </span>
            </div>
            <SegmentedSwitch
              value={trajectory.dynamicMode ? 'dynamic' : 'static'}
              onValueChange={(val) => updateTrajectory({ dynamicMode: val === 'dynamic' })}
              isLight={isLight}
              fullWidth={true}
              options={[
                { value: 'dynamic', label: 'Dynamic (Pushes Line)' },
                { value: 'static', label: 'Static (Follows Line)' },
              ]}
            />
          </div>

          {/* 4. Line Thickness & Opacity (Compact single-rows) */}
          <div className="flex flex-col gap-1 w-full pt-1 border-t border-neutral-500/15">
            <CompactSliderRow
              label="Line Thickness"
              value={trajectory.thickness ?? 10}
              min={1}
              max={75}
              step={1}
              unit="%"
              onChange={(val) => updateTrajectory({ thickness: val })}
              onHover={() => setHoveredDesc('Adjusts 3D wide line thickness as a percentage of physical ball diameter (1% - 75%).')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <CompactSliderRow
              label="Line Opacity"
              value={opacityPct}
              min={5}
              max={100}
              step={5}
              unit="%"
              onChange={(val) => updateTrajectory({ opacity: val / 100 })}
              onHover={() => setHoveredDesc('Adjusts alpha transparency of rendered trajectory segments (5% - 100%).')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />
          </div>

          {/* 5. Dash Timing: Solid Length & Transparent Gap (Compact single-rows) */}
          <div className="flex flex-col gap-1 w-full pt-1 border-t border-neutral-500/15">
            <CompactSliderRow
              label="Solid Dash Length"
              value={trajectory.solidTicks ?? 50}
              min={5}
              max={240}
              step={5}
              unit="t"
              displayValue={trajectory.solidTicks ?? 50}
              onChange={(val) => updateTrajectory({ solidTicks: val })}
              onHover={() => setHoveredDesc(`Duration of visible solid segments in simulation ticks (${( (trajectory.solidTicks ?? 50) / 120 * 1000 ).toFixed(0)}ms).`)}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <CompactSliderRow
              label="Transparent Gap"
              value={trajectory.transparentTicks ?? 20}
              min={5}
              max={240}
              step={5}
              unit="t"
              displayValue={trajectory.transparentTicks ?? 20}
              onChange={(val) => updateTrajectory({ transparentTicks: val })}
              onHover={() => setHoveredDesc(`Duration of transparent gaps between solid dashes (${( (trajectory.transparentTicks ?? 20) / 120 * 1000 ).toFixed(0)}ms).`)}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />
          </div>

          {/* 6. Trajectory Color Tone & Swatch Preview - Full Width with Custom Picker */}
          <div
            className="flex flex-col gap-2 w-full pt-2 border-t border-neutral-500/15"
            onMouseEnter={() => setHoveredDesc('Selects visual color tint for trajectory line. Switch to Custom to pick any color.')}
            onMouseLeave={() => setHoveredDesc(null)}
          >
            <div className="flex items-center justify-between text-xs px-2">
              <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Line Color Tone
              </span>
              {/* Color Preview Swatch Button (Upper right) */}
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                onMouseEnter={() => setHoveredDesc('Click color preview swatch to open the color picker.')}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-2xs"
                style={{
                  borderColor: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
                  backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                }}
                title="Click to customize color"
              >
                <span
                  className="w-3.5 h-3.5 rounded-sm border shadow-xs inline-block shrink-0"
                  style={{
                    backgroundColor: currentColor,
                    borderColor: currentColor.toLowerCase() === '#ffffff' ? '#ccc' : 'rgba(0,0,0,0.25)',
                  }}
                />
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>
                  {currentColor.toUpperCase()}
                </span>
              </button>
            </div>

            {/* Hidden native color input */}
            <input
              ref={colorInputRef}
              type="color"
              value={currentColor}
              onChange={(e) => updateTrajectory({ color: e.target.value })}
              className="sr-only"
              aria-label="Custom Color Picker"
            />

            {/* Full-width segmented palette switch */}
            <SegmentedSwitch
              value={activeColorValue}
              onValueChange={handleColorSelection}
              isLight={isLight}
              fullWidth={true}
              options={[
                { value: '#000000', label: 'Black' },
                { value: '#ffffff', label: 'White' },
                { value: '#00f0ff', label: 'Cyan' },
                { value: '#fbbf24', label: 'Amber' },
                { value: '#39ff14', label: 'Lime' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>
        </VStack>
      </PanelContent>

      {/* Dynamic Inspector Footer */}
      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className={`truncate transition-colors duration-150 ${
            hoveredDesc
              ? (isLight ? 'text-neutral-900' : 'text-neutral-100')
              : (isLight ? 'text-neutral-400' : 'text-neutral-500')
          }`}>
            {hoveredDesc || 'Hover over any setting to view its detailed description.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
