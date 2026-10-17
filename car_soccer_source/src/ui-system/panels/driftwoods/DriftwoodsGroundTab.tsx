import React from 'react';
import { Link2, Unlink2, RotateCcw } from 'lucide-react';
import type { DriftwoodsGroundConfig } from '../../../entities/stadium/driftwoods/DriftwoodsConfigurator';
import {
  TunerRow,
  TunerColorRow,
  TunerToggleRow,
  TunerSegmentedControl
} from './DriftwoodsTunerControls';

export interface DriftwoodsGroundTabProps {
  ground: DriftwoodsGroundConfig;
  onChange: (patch: Partial<DriftwoodsGroundConfig>) => void;
  isLight?: boolean;
}

export const DriftwoodsGroundTab: React.FC<DriftwoodsGroundTabProps> = ({
  ground,
  onChange,
  isLight = false,
}) => {
  const handleScaleXChange = (val: number) => {
    if (ground.linkScale) {
      onChange({ scaleX: val, scaleY: val });
    } else {
      onChange({ scaleX: val });
    }
  };

  const handleScaleYChange = (val: number) => {
    if (ground.linkScale) {
      onChange({ scaleX: val, scaleY: val });
    } else {
      onChange({ scaleY: val });
    }
  };

  const resetUVTransform = () => {
    onChange({ scaleX: 1.0, scaleY: 1.0, offsetX: 0.0, offsetY: 0.0 });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Ground & Marking Tinting */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">
          Ground Shader Dual-Color Mask (Dynamic Mix)
        </span>

        <TunerColorRow
          label="Field Turf Color"
          description="Background pitch color (replaced dynamically via fragment shader)"
          value={ground.groundColor}
          onChange={(hex) => onChange({ groundColor: hex })}
          isLight={isLight}
        />

        <TunerColorRow
          label="Marking Lines Color"
          description="Field boundary and circle lines color (dynamic GPU mask)"
          value={ground.lineColor}
          onChange={(hex) => onChange({ lineColor: hex })}
          isLight={isLight}
        />

        <div className="grid grid-cols-2 gap-1.5">
          <TunerRow
            label="Roughness"
            value={ground.roughness}
            sliderMin={0.0}
            sliderMax={1.0}
            sliderStep={0.01}
            onChange={(val) => onChange({ roughness: val })}
            isLight={isLight}
          />

          <TunerRow
            label="Metalness"
            value={ground.metalness}
            sliderMin={0.0}
            sliderMax={1.0}
            sliderStep={0.01}
            onChange={(val) => onChange({ metalness: val })}
            isLight={isLight}
          />
        </div>
      </div>

      {/* 2. Texture UV Transform Matrix */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
            Texture UV Transform (Scale & Offset)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ linkScale: !ground.linkScale })}
              title={ground.linkScale ? 'Scaling linked (1:1). Click to unlock.' : 'Scaling unlinked. Click to lock aspect ratio.'}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                ground.linkScale
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isLight
                  ? 'bg-neutral-200 text-neutral-600 border border-neutral-300'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              {ground.linkScale ? (
                <>
                  <Link2 className="h-3 w-3" />
                  <span>Linked</span>
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
              onClick={resetUVTransform}
              title="Reset UV repeat (1.0, 1.0) and offset (0.0, 0.0)"
              className={`p-1 rounded cursor-pointer transition-colors ${
                isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-neutral-800 text-neutral-400'
              }`}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <TunerRow
            label="Scale X (Sx)"
            description="Horizontal UV repeat"
            value={ground.scaleX}
            sliderMin={0.5}
            sliderMax={2.0}
            sliderStep={0.0001}
            onChange={handleScaleXChange}
            isLight={isLight}
          />

          <TunerRow
            label="Scale Y (Sy)"
            description="Vertical UV repeat"
            value={ground.scaleY}
            sliderMin={0.5}
            sliderMax={2.0}
            sliderStep={0.0001}
            onChange={handleScaleYChange}
            isLight={isLight}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <TunerRow
            label="Offset X (Tx)"
            description="Horizontal UV translation"
            value={ground.offsetX}
            sliderMin={-1.0}
            sliderMax={1.0}
            sliderStep={0.0001}
            onChange={(val) => onChange({ offsetX: val })}
            isLight={isLight}
          />

          <TunerRow
            label="Offset Y (Ty)"
            description="Vertical UV translation"
            value={ground.offsetY}
            sliderMin={-1.0}
            sliderMax={1.0}
            sliderStep={0.0001}
            onChange={(val) => onChange({ offsetY: val })}
            isLight={isLight}
          />
        </div>
      </div>

      {/* 3. Texture Filtering & Edge Sharpness Algorithm */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">
          Texture Filtering & Edge Sharpness Algorithms
        </span>

        <TunerSegmentedControl<'linear' | 'nearest'>
          label="Mag Filter (Magnification Algorithm)"
          description="Linear = Bilinear interpolation (soft/blurry). Nearest = Point sampling (sharp/pixelated texels)."
          value={ground.magFilter || 'linear'}
          options={[
            { value: 'linear', label: 'Linear (Smooth)' },
            { value: 'nearest', label: 'Nearest (Sharp Pixel)' }
          ]}
          onChange={(val) => onChange({ magFilter: val })}
          isLight={isLight}
        />

        <div className="grid grid-cols-2 gap-1.5">
          <TunerRow
            label="Anisotropy Level"
            description="Preserves crispness at oblique grazing camera angles across the field"
            value={ground.anisotropy ?? 16}
            sliderMin={1}
            sliderMax={16}
            sliderStep={1}
            stepOverride={1}
            unit="x"
            onChange={(val) => onChange({ anisotropy: Math.round(val) })}
            isLight={isLight}
          />

          <TunerRow
            label="Line Smoothness (Edge)"
            description="Shader smoothstep width. Smaller values yield razor-sharp line borders."
            value={ground.lineSmoothness ?? 0.05}
            sliderMin={0.001}
            sliderMax={0.15}
            sliderStep={0.001}
            onChange={(val) => onChange({ lineSmoothness: val })}
            isLight={isLight}
          />
        </div>

        <TunerRow
          label="Line Cutoff Threshold"
          description="Luminance threshold separating turf from field boundary markings"
          value={ground.lineThreshold ?? 0.13}
          sliderMin={0.02}
          sliderMax={0.35}
          sliderStep={0.001}
          onChange={(val) => onChange({ lineThreshold: val })}
          isLight={isLight}
        />
      </div>

      {/* 4. Layer Toggles */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <TunerToggleRow
          label="Ground Visible"
          checked={ground.visible}
          onChange={(checked) => onChange({ visible: checked })}
          isLight={isLight}
        />

        <TunerToggleRow
          label="Wireframe Mode"
          checked={ground.wireframe}
          onChange={(checked) => onChange({ wireframe: checked })}
          isLight={isLight}
        />
      </div>
    </div>
  );
};
