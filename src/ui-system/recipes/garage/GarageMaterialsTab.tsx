import React from 'react';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import { VisualMaterialsConfig } from '../../../stores/appStore';

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
              value="football"
              onChange={() => {}}
              options={[
                { value: 'football', label: 'Football' },
              ]}
              disabled={true}
              onHover={() => setHoveredDesc('Ball style is locked to the classic geodesic football.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Demolition Effect"
              value={materials.demolishedEffect}
              onChange={(val) => updateMaterials({ demolishedEffect: val as 'toon' | 'smoke' })}
              options={[
                { value: 'toon', label: 'Toon' },
                { value: 'smoke', label: 'Smoke' },
              ]}
              onHover={() => setHoveredDesc('Selects supersonic collision demolition aesthetic (toon burst vs volumetric smoke plume).')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Boost Trail Effect"
              value={materials.boostVisual}
              onChange={(val) => updateMaterials({ boostVisual: val as 'cartoon' | 'gold-rush' })}
              options={[
                { value: 'cartoon', label: 'Cartoon' },
                { value: 'gold-rush', label: 'Gold Rush' },
              ]}
              onHover={() => setHoveredDesc('Selects rocket booster particle and trail rendering style (Cartoon vs Gold Rush).')}
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
              disabled={materials.boostVisual !== 'gold-rush'}
              onHover={() => setHoveredDesc(materials.boostVisual === 'gold-rush' ? 'Adjusts vehicle nozzle flame intensity: Balanced steady 1.0x vs original perspective Dynamic.' : 'Flame luminance is locked to balanced preset when using Cartoon boost.')}
              onLeave={onLeave}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Gold Rush Plume Luminance"
              value={materials.boostPlumeLuminance}
              onChange={(val) => updateMaterials({ boostPlumeLuminance: val as 'min' | 'balanced' | 'dynamic' | 'hdr' })}
              options={[
                { value: 'min', label: 'Minimum' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'dynamic', label: 'Dynamic' },
                { value: 'hdr', label: 'Vivid HDR' },
              ]}
              disabled={materials.boostVisual !== 'gold-rush'}
              onHover={() => setHoveredDesc(materials.boostVisual === 'gold-rush' ? 'Adjusts Gold Rush exhaust plume and spark particle luminance: Minimum, Balanced 1.0x, Dynamic angle, or Vivid HDR.' : 'Plume luminance is locked to balanced preset when using Cartoon boost.')}
              onLeave={onLeave}
              isLight={isLight}
            />
          </div>
  );
};
