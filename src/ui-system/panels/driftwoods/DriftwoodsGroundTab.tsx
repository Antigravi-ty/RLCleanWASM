import React from 'react';
import { Link2, Unlink2, RotateCcw } from 'lucide-react';
import {
  DEFAULT_Q1_LAYER_COLORS,
  GROUND_Q1_MANIFEST,
  type DriftwoodsGroundConfig,
  type DriftwoodsGroundTextureMode,
  type DriftwoodsQ1LayerColors,
  type DriftwoodsQ1LayerId,
} from '../../../config/driftwoodsConfig';
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
  const activeMode: DriftwoodsGroundTextureMode = ground.textureMode ?? 'q1-7gray';
  const q1Colors: DriftwoodsQ1LayerColors = {
    ...DEFAULT_Q1_LAYER_COLORS,
    ...(ground.q1Colors || {}),
  };

  const handleLayerColorChange = (layerId: DriftwoodsQ1LayerId, hex: string) => {
    onChange({
      q1Colors: {
        ...q1Colors,
        [layerId]: hex,
      },
    });
  };

  const resetQ1Palette = () => {
    onChange({
      q1Colors: { ...DEFAULT_Q1_LAYER_COLORS },
      l4UseTeamColor: true,
      l5UseTeamColor: true,
      l6UseTeamColor: true,
      lineThreshold: 0.35,
      lineSmoothness: 0.001,
    });
  };

  const resetQ1UVTransform = () => {
    onChange({
      q1ScaleX: 1.0,
      q1ScaleY: 1.0,
      q1OffsetX: 0.0,
      q1OffsetY: 0.0,
    });
  };

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
    onChange({
      scaleX: 1.015,
      scaleY: 1.037,
      offsetX: -0.0075,
      offsetY: -0.0176,
      originalLineThreshold: 0.0921,
      originalLineSmoothness: 0.0364,
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* 0. Ground Texture Source Switch */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">
          Ground Texture Mode
        </span>

        <TunerSegmentedControl<DriftwoodsGroundTextureMode>
          label="Active Ground Texture"
          description="Switch between Q1 7-Layer Grayscale Mask (2048x3000 MirroredRepeat) and Legacy Original Texture"
          value={activeMode}
          options={[
            { value: 'q1-7gray', label: 'Q1 7-Layer Mask (L0-L6)' },
            { value: 'original', label: 'Original Texture (2-Color)' },
          ]}
          onChange={(mode) => onChange({ textureMode: mode })}
          isLight={isLight}
        />
      </div>

      {activeMode === 'q1-7gray' ? (
        <>
          {/* 1A. Q1 7-Layer Semantic Grayscale Palette */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                Q1 7-Layer Semantic Palette (L0 - L6)
              </span>
              <button
                type="button"
                onClick={resetQ1Palette}
                title="Reset L0-L6 layer colors to default manifest palette"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-neutral-300'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset L0-L6</span>
              </button>
            </div>

            {GROUND_Q1_MANIFEST.layers.map((layer) => {
              const isTeamToggleLayer = layer.id === 'L4' || layer.id === 'L5' || layer.id === 'L6';
              const isTeamColorActive =
                layer.id === 'L4'
                  ? Boolean(ground.l4UseTeamColor ?? true)
                  : layer.id === 'L5'
                  ? Boolean(ground.l5UseTeamColor ?? true)
                  : layer.id === 'L6'
                  ? Boolean(ground.l6UseTeamColor ?? true)
                  : false;

              return (
                <React.Fragment key={layer.id}>
                  <TunerColorRow
                    label={`${layer.id} - ${layer.name}`}
                    description={
                      isTeamToggleLayer && isTeamColorActive
                        ? 'Overridden by Half-Field Team Color (Blue Z < 0: #0089ff | Orange Z > 0: #ff5200)'
                        : `Gray ${layer.centerGray} (${layer.normalizedValue.toFixed(3)}) | Range ${layer.grayRange[0]}~${layer.grayRange[1]} (${layer.normalizedRange[0].toFixed(2)}~${layer.normalizedRange[1].toFixed(2)})`
                    }
                    value={q1Colors[layer.id]}
                    onChange={(hex) => handleLayerColorChange(layer.id, hex)}
                    isLight={isLight}
                  />
                  {isTeamToggleLayer && (
                    <TunerToggleRow
                      label={`${layer.id} Use Half-Field Team Color (Blue / Orange)`}
                      checked={isTeamColorActive}
                      onChange={(checked) => {
                        if (layer.id === 'L4') onChange({ l4UseTeamColor: checked });
                        else if (layer.id === 'L5') onChange({ l5UseTeamColor: checked });
                        else if (layer.id === 'L6') onChange({ l6UseTeamColor: checked });
                      }}
                      isLight={isLight}
                    />
                  )}
                </React.Fragment>
              );
            })}

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <TunerRow
                label="Line Smoothness (Edge)"
                description="Continuous anti-aliased edge transition width against L0 turf"
                value={ground.lineSmoothness ?? 0.001}
                sliderMin={0.001}
                sliderMax={0.25}
                sliderStep={0.001}
                onChange={(val) => onChange({ lineSmoothness: val })}
                isLight={isLight}
              />

              <TunerRow
                label="Line Cutoff Threshold"
                description="Normalized coverage cutoff (lower expands edges, higher shrinks edges)"
                value={ground.lineThreshold ?? 0.35}
                sliderMin={0.02}
                sliderMax={0.9}
                sliderStep={0.001}
                onChange={(val) => onChange({ lineThreshold: val })}
                isLight={isLight}
              />
            </div>
          </div>

          {/* 2A. Q1 Physical Space & 4-Quadrant Mirrored UV Mapping */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                Q1 Physical Space &amp; Mirrored UV Mapping
              </span>
              <button
                type="button"
                onClick={resetQ1UVTransform}
                title="Reset Q1 UV scale (1.0, 1.0) and offset (0.0, 0.0)"
                className={`p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-neutral-800 text-neutral-400'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>

            <div
              className={`p-2 rounded-xl border text-[10px] font-mono leading-relaxed flex flex-col gap-0.5 ${
                isLight
                  ? 'bg-neutral-100/80 border-neutral-200 text-neutral-700'
                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
              }`}
            >
              <div>Top-Left (u=0, v=0) -&gt; Center Origin (X=0, Y=0)</div>
              <div>Bottom-Right (u=1, v=1) -&gt; (X=4096 UU, Y=6000 UU) [Includes Goal Depth 5120~6000]</div>
              <div>Formula: u = abs(worldX) / 4096.0, v = abs(worldY) / 6000.0 (MirroredRepeat)</div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <TunerRow
                label="Q1 Scale U"
                description="Horizontal Q1 UV multiplier"
                value={ground.q1ScaleX ?? 1.0}
                sliderMin={0.5}
                sliderMax={2.0}
                sliderStep={0.0001}
                onChange={(val) => onChange({ q1ScaleX: val })}
                isLight={isLight}
              />

              <TunerRow
                label="Q1 Scale V"
                description="Vertical Q1 UV multiplier"
                value={ground.q1ScaleY ?? 1.0}
                sliderMin={0.5}
                sliderMax={2.0}
                sliderStep={0.0001}
                onChange={(val) => onChange({ q1ScaleY: val })}
                isLight={isLight}
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <TunerRow
                label="Q1 Offset U"
                description="Horizontal Q1 UV offset"
                value={ground.q1OffsetX ?? 0.0}
                sliderMin={-1.0}
                sliderMax={1.0}
                sliderStep={0.0001}
                onChange={(val) => onChange({ q1OffsetX: val })}
                isLight={isLight}
              />

              <TunerRow
                label="Q1 Offset V"
                description="Vertical Q1 UV offset"
                value={ground.q1OffsetY ?? 0.0}
                sliderMin={-1.0}
                sliderMax={1.0}
                sliderStep={0.0001}
                onChange={(val) => onChange({ q1OffsetY: val })}
                isLight={isLight}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 1B. Legacy Ground & Marking Tinting */}
          <div className="flex flex-col gap-1.5 pt-1">
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
          </div>

          {/* 2B. Legacy Texture UV Transform Matrix */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                Texture UV Transform (Scale &amp; Offset)
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
                  title="Reset UV repeat (1.015, 1.037) and offset (-0.0075, -0.0176)"
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

            <div className="grid grid-cols-2 gap-1.5">
              <TunerRow
                label="Line Smoothness (Edge)"
                description="Shader smoothstep width. Smaller values yield razor-sharp line borders."
                value={ground.originalLineSmoothness ?? 0.0364}
                sliderMin={0.001}
                sliderMax={0.15}
                sliderStep={0.001}
                onChange={(val) => onChange({ originalLineSmoothness: val })}
                isLight={isLight}
              />

              <TunerRow
                label="Line Cutoff Threshold"
                description="Luminance threshold separating turf from field boundary markings"
                value={ground.originalLineThreshold ?? 0.0921}
                sliderMin={0.02}
                sliderMax={0.35}
                sliderStep={0.001}
                onChange={(val) => onChange({ originalLineThreshold: val })}
                isLight={isLight}
              />
            </div>
          </div>
        </>
      )}

      {/* 3. PBR Surface & Texture Filtering */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">
          Surface Material &amp; Texture Filtering
        </span>

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

        <TunerSegmentedControl<'linear' | 'nearest'>
          label="Mag Filter (Magnification Algorithm)"
          description="Linear = Bilinear interpolation. Nearest = Point sampling (exact discrete texel values)."
          value={ground.magFilter || 'linear'}
          options={[
            { value: 'linear', label: 'Linear (Smooth)' },
            { value: 'nearest', label: 'Nearest (Sharp Pixel)' }
          ]}
          onChange={(val) => onChange({ magFilter: val })}
          isLight={isLight}
        />

        <TunerRow
          label="Anisotropy Level"
          description="Preserves crispness at oblique grazing camera angles across the field"
          value={ground.anisotropy ?? 1}
          sliderMin={1}
          sliderMax={16}
          sliderStep={1}
          stepOverride={1}
          unit="x"
          onChange={(val) => onChange({ anisotropy: Math.round(val) })}
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
