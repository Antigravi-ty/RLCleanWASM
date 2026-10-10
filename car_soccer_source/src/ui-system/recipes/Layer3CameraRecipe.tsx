import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { RotateCcw, AlertCircle, Check } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { VStack } from '../layout/VStack';
import { useUIStore, type CameraConfig } from '../core/store';

export interface Layer3CameraRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onCollapsePreview?: () => void;
  transparent?: boolean;
  camera?: CameraConfig;
  onUpdateCamera?: (patch: Partial<CameraConfig>) => void;
  onResetCamera?: () => void;
}

interface CameraSliderRowProps {
  label: string;
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

const CameraSliderRow: React.FC<CameraSliderRowProps> = ({
  label,
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
  return (
    <div
      className="flex items-center gap-3 w-full py-1 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
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
        {value}{unit}
      </span>
    </div>
  );
};

/**
 * [Recipe] Layer 3 Camera Live Preview Panel (Width: 480px)
 * Dedicated Level 3 camera tuning panel with Live Preview dock collapse.
 */
export const Layer3CameraRecipe: React.FC<Layer3CameraRecipeProps> = ({
  isLight = false,
  onBack,
  onCollapsePreview,
  transparent = false,
  camera: propCamera,
  onUpdateCamera: propUpdateCamera,
  onResetCamera: propResetCamera,
}) => {
  const storeCamera = useUIStore((s) => s.camera);
  const storeUpdateCamera = useUIStore((s) => s.updateCamera);
  const storeResetCamera = useUIStore((s) => s.resetCamera);

  const camera = propCamera ?? storeCamera;
  const updateCamera = propUpdateCamera ?? storeUpdateCamera;
  const resetCamera = propResetCamera ?? storeResetCamera;

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  useEffect(() => {
    if (isConfirmingReset) {
      const timer = setTimeout(() => setIsConfirmingReset(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmingReset]);

  return (
    <PanelContainer isLight={isLight} transparent={transparent} className="w-full max-w-[480px]">
      <PanelHeader
        title="CAMERA SETTINGS"
        onBack={onBack}
        isLight={isLight}
        rightElement={
          <button
            type="button"
            onClick={onCollapsePreview}
            onMouseEnter={() => setHoveredDesc('Press TAB or click to collapse into Live Preview dock and test camera freely.')}
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
        <VStack gap="sm" isLight={isLight}>
          <CameraSliderRow
            label="Field of View"
            value={camera.fov}
            min={60}
            max={110}
            step={1}
            unit="°"
            onChange={(val) => updateCamera({ fov: val })}
            onHover={() => setHoveredDesc('Adjusts horizontal field of view angle in degrees.')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <CameraSliderRow
            label="Distance"
            value={camera.distance}
            min={100}
            max={400}
            step={10}
            onChange={(val) => updateCamera({ distance: val })}
            onHover={() => setHoveredDesc('Sets the distance between camera and vehicle.')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <CameraSliderRow
            label="Height"
            value={camera.height}
            min={40}
            max={200}
            step={10}
            onChange={(val) => updateCamera({ height: val })}
            onHover={() => setHoveredDesc('Controls the vertical height of the camera above vehicle.')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <CameraSliderRow
            label="Angle"
            value={camera.angleDeg}
            min={-15}
            max={0}
            step={1}
            unit="°"
            onChange={(val) => updateCamera({ angleDeg: val })}
            onHover={() => setHoveredDesc('Adjusts the downward pitch angle pointing toward vehicle.')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <CameraSliderRow
            label="Stiffness"
            value={camera.stiffness}
            min={0}
            max={1}
            step={0.05}
            onChange={(val) => updateCamera({ stiffness: val })}
            onHover={() => setHoveredDesc('Controls how rigidly camera tracks vehicle orientation (0 = loose, 1 = locked).')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <CameraSliderRow
            label="Swivel Speed"
            value={camera.swivelSpeed}
            min={1}
            max={10}
            step={0.1}
            onChange={(val) => updateCamera({ swivelSpeed: val })}
            onHover={() => setHoveredDesc('Sets rotation speed when looking around with stick or keys.')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <CameraSliderRow
            label="Transition Speed"
            value={camera.transitionSpeed}
            min={1}
            max={2}
            step={0.1}
            onChange={(val) => updateCamera({ transitionSpeed: val })}
            onHover={() => setHoveredDesc('Determines how quickly the view blends between Ball Cam and Car Cam.')}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          <div
            className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
            onMouseEnter={() => setHoveredDesc('Toggles camera vibrations on impacts, supersonic speeds and landings.')}
            onMouseLeave={() => setHoveredDesc(null)}
            onClick={() => updateCamera({ cameraShake: !camera.cameraShake })}
          >
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Camera Shake
            </span>
            <ToggleSwitch
              checked={camera.cameraShake}
              onCheckedChange={(checked) => updateCamera({ cameraShake: checked })}
              isLight={isLight}
              variant="neutral"
            />
          </div>

          <div
            className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
            onMouseEnter={() => setHoveredDesc('Reverses vertical swivel look direction in ball and car cam.')}
            onMouseLeave={() => setHoveredDesc(null)}
            onClick={() => updateCamera({ invertSwivel: !camera.invertSwivel })}
          >
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Invert Swivel
            </span>
            <ToggleSwitch
              checked={camera.invertSwivel}
              onCheckedChange={(checked) => updateCamera({ invertSwivel: checked })}
              isLight={isLight}
              variant="neutral"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (isConfirmingReset) {
                  resetCamera();
                  setIsConfirmingReset(false);
                } else {
                  setIsConfirmingReset(true);
                }
              }}
              onMouseEnter={() => setHoveredDesc('Resets all camera angles, distances and stiffness back to defaults.')}
              onMouseLeave={() => setHoveredDesc(null)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-[0.99] ${
                isConfirmingReset
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700 shadow-2xs'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300 shadow-2xs'
              }`}
            >
              {isConfirmingReset ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                  <span>Click Again to Confirm Reset</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5 opacity-75" />
                  <span>Reset Camera Defaults</span>
                </>
              )}
            </button>
          </div>
        </VStack>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <span className="text-[11px] font-mono opacity-70 truncate">
          {hoveredDesc ?? 'Camera settings update in real-time in viewport.'}
        </span>
      </PanelFooter>
    </PanelContainer>
  );
};
