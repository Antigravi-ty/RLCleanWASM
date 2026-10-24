import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DriftwoodsLayerConfig, DriftwoodsTunerConfig } from '../../../config/driftwoodsConfig';
import {
  TunerRow,
  TunerColorRow,
  TunerToggleRow
} from './DriftwoodsTunerControls';

export interface DriftwoodsSurfacesTabProps {
  config: DriftwoodsTunerConfig;
  onChange: (patch: Partial<DriftwoodsTunerConfig>) => void;
  isLight?: boolean;
}

interface PartCardProps {
  id: string;
  name: string;
  description: string;
  layer: DriftwoodsLayerConfig;
  onLayerChange: (patch: Partial<DriftwoodsLayerConfig>) => void;
  isLight?: boolean;
  defaultOpen?: boolean;
}

const PartCard: React.FC<PartCardProps> = ({
  name,
  description,
  layer,
  onLayerChange,
  isLight = false,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-xl border transition-colors overflow-hidden ${
        isLight ? 'bg-neutral-50/60 border-neutral-200' : 'bg-neutral-900/40 border-neutral-800'
      }`}
    >
      <div
        className="flex items-center justify-between p-2.5 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3.5 h-3.5 rounded-full border border-neutral-600 shrink-0 shadow-xs"
            style={{ backgroundColor: layer.color }}
          />
          <div className="flex flex-col min-w-0">
            <span className={`text-xs font-semibold truncate ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
              {name}
            </span>
            <span className={`text-[10px] truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              layer.visible
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
            }`}
          >
            {layer.visible ? 'Visible' : 'Hidden'}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          )}
        </div>
      </div>

      {open && (
        <div className="p-2.5 pt-0 flex flex-col gap-1.5 border-t border-neutral-700/20">
          <TunerColorRow
            label="Base Color"
            value={layer.color}
            onChange={(hex) => onLayerChange({ color: hex })}
            isLight={isLight}
          />

          <div className="grid grid-cols-2 gap-1.5">
            <TunerRow
              label="Roughness"
              value={layer.roughness}
              sliderMin={0.0}
              sliderMax={1.0}
              sliderStep={0.01}
              onChange={(val) => onLayerChange({ roughness: val })}
              isLight={isLight}
            />

            <TunerRow
              label="Metalness"
              value={layer.metalness}
              sliderMin={0.0}
              sliderMax={1.0}
              sliderStep={0.01}
              onChange={(val) => onLayerChange({ metalness: val })}
              isLight={isLight}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <TunerToggleRow
              label="Visible"
              checked={layer.visible}
              onChange={(checked) => onLayerChange({ visible: checked })}
              isLight={isLight}
            />

            <TunerToggleRow
              label="Wireframe"
              checked={layer.wireframe}
              onChange={(checked) => onLayerChange({ wireframe: checked })}
              isLight={isLight}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const DriftwoodsSurfacesTab: React.FC<DriftwoodsSurfacesTabProps> = ({
  config,
  onChange,
  isLight = false,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">
        Solid Stadium Meshes & PBR Materials
      </span>

      <PartCard
        id="ramps"
        name="Woods Field Ramps"
        description="Perimeter slopes & curved banking ramps (2,684 tris)"
        layer={config.ramps}
        onLayerChange={(patch) => onChange({ ramps: { ...config.ramps, ...patch } })}
        isLight={isLight}
        defaultOpen={true}
      />

      <PartCard
        id="rampsTrim"
        name="Ramps Golden Trim"
        description="Beveled transition edges and metallic accent trim (16,940 tris)"
        layer={config.rampsTrim}
        onLayerChange={(patch) => onChange({ rampsTrim: { ...config.rampsTrim, ...patch } })}
        isLight={isLight}
      />

      <PartCard
        id="wallPosts"
        name="Wall Posts & Columns"
        description="Structural steel pylons around boundary perimeter (11,936 tris)"
        layer={config.wallPosts}
        onLayerChange={(patch) => onChange({ wallPosts: { ...config.wallPosts, ...patch } })}
        isLight={isLight}
      />

      <PartCard
        id="goalFrame"
        name="Goal Mouth Frame"
        description="Outer rectangular goal frame & back casing (2,664 tris)"
        layer={config.goalFrame}
        onLayerChange={(patch) => onChange({ goalFrame: { ...config.goalFrame, ...patch } })}
        isLight={isLight}
      />

      <PartCard
        id="goalPosts"
        name="Goal Posts & Crossbar"
        description="High-visibility goal posts & crossbars (4,424 tris)"
        layer={config.goalPosts}
        onLayerChange={(patch) => onChange({ goalPosts: { ...config.goalPosts, ...patch } })}
        isLight={isLight}
      />
    </div>
  );
};
