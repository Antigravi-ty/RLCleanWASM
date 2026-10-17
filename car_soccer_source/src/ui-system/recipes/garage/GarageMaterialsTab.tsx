import React from 'react';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import { VisualMaterialsConfig } from '../../core/store';

export interface MaterialOptionRowProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
  disabled?: boolean;
}

export const MaterialOptionRow: React.FC<MaterialOptionRowProps> = ({
  label,
  value,
  onChange,
  options,
  onHover,
  onLeave,
  isLight = false,
  disabled = false,
}) => {
  return (
    <div
      className={`flex items-center justify-between w-full py-1.5 px-3 rounded-lg transition-colors select-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-neutral-500/10 cursor-pointer'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <span className={`text-xs font-semibold truncate ${
        disabled
          ? 'opacity-60 text-neutral-400'
          : isLight ? 'text-neutral-800' : 'text-neutral-200'
      }`}>
        {label}
      </span>
      <div className="shrink-0 w-64 sm:w-80">
        <SegmentedSwitch
          value={value}
          onValueChange={onChange}
          onChange={onChange}
          options={options}
          size="sm"
          fullWidth
          isLight={isLight}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export interface GarageMaterialsTabProps {
  materials: VisualMaterialsConfig;
  updateMaterials: (partial: Partial<VisualMaterialsConfig>) => void;
  onHover: (text: string) => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const GarageMaterialsTab: React.FC<GarageMaterialsTabProps> = ({
  materials,
  updateMaterials,
  onHover,
  onLeave,
  isLight = false,
}) => {
  const setHoveredDesc = onHover;
  return (
    <div className="space-y-1 py-1">
            <MaterialOptionRow
              label="Ball Style"
              value={materials.ballStyle}
              onChange={(val) => updateMaterials({ ballStyle: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Soccer Ball' },
                { value: 'realistic', label: 'Rocket League' },
              ]}
              onHover={() => setHoveredDesc('Choose between classic geodesic soccer ball and authentic Rocket League sphere.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Vehicle Paint Finish"
              value={materials.carPaint}
              onChange={(val) => updateMaterials({ carPaint: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Matte Cel' },
                { value: 'realistic', label: 'Metallic Pearl' },
              ]}
              onHover={() => setHoveredDesc('Switches body finish between vibrant toon matte cel-shading and glossy metallic anodized pearlcoat.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Stadium Scenery"
              value={materials.stadiumScenery}
              onChange={(val) => updateMaterials({ stadiumScenery: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Arcade Cel' },
                { value: 'realistic', label: 'Realistic PBR' },
              ]}
              onHover={() => setHoveredDesc('Switches arena perimeter, goal structures and boundary walls between cel-shading and PBR shading.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Demolition Effect"
              value={materials.demolishedEffect}
              onChange={(val) => updateMaterials({ demolishedEffect: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Cartoon Sparks' },
                { value: 'realistic', label: 'Pyro Explosion' },
              ]}
              onHover={() => setHoveredDesc('Selects supersonic collision demolition aesthetic (arcade comic sparks vs realistic pyro blast).')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Boost Trail Effect"
              value={materials.boostVisual}
              onChange={(val) => updateMaterials({ boostVisual: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Toon Trail' },
                { value: 'realistic', label: 'Vapour Jet' },
              ]}
              onHover={() => setHoveredDesc('Selects rocket booster particle and ribbon trail rendering style.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Boost Flame Luminance"
              value={materials.boostFlameLuminance}
              onChange={(val) => updateMaterials({ boostFlameLuminance: val as 'balanced' | 'dynamic' })}
              options={[
                { value: 'balanced', label: 'Balanced (1.0x)' },
                { value: 'dynamic', label: 'Dynamic Angle' },
              ]}
              disabled={materials.boostVisual !== 'realistic'}
              onHover={() => setHoveredDesc(materials.boostVisual === 'realistic' ? 'Adjusts vehicle nozzle flame intensity: Balanced steady 1.0x vs original perspective Dynamic.' : 'Flame luminance is locked to balanced preset when using Toon Trail.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Vapour Plume Luminance"
              value={materials.boostPlumeLuminance}
              onChange={(val) => updateMaterials({ boostPlumeLuminance: val as 'min' | 'balanced' | 'dynamic' | 'hdr' })}
              options={[
                { value: 'min', label: 'Minimum' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'dynamic', label: 'Dynamic' },
                { value: 'hdr', label: 'Vivid HDR' },
              ]}
              disabled={materials.boostVisual !== 'realistic'}
              onHover={() => setHoveredDesc(materials.boostVisual === 'realistic' ? 'Adjusts exhaust smoke trail particle luminance: Minimum soft smoke, Balanced 1.0x, Dynamic angle, or Vivid HDR.' : 'Plume luminance is locked to balanced preset when using Toon Trail.')}
              onLeave={onLeave}
              isLight={isLight}
            />
          </div>
  );
};
