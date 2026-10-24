import React from 'react';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import { SliderControl } from '../../primitives/SliderControl';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';

export interface BoostAndBloomTabProps {
  descriptor: any;
  handleBoostNozzleChange: (patch: Record<string, any>) => void;
  boostVisual: 'cartoon' | 'gold-rush';
  onBoostVisualChange: (mode: 'cartoon' | 'gold-rush') => void;
  particleConfig: any;
  applyParticlePatch: (patch: Record<string, any>) => void;
  isLight: boolean;
  cardClass: string;
  scope?: 'all' | 'per-vehicle' | 'global';
}

export const BoostAndBloomTab: React.FC<BoostAndBloomTabProps> = ({
  descriptor,
  handleBoostNozzleChange,
  boostVisual,
  onBoostVisualChange,
  particleConfig,
  applyParticlePatch,
  isLight,
  cardClass,
  scope = 'all',
}) => {
  const showPerVehicle = scope === 'all' || scope === 'per-vehicle';
  const showGlobal = scope === 'all' || scope === 'global';
  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Micro: Per-Vehicle Dual Boost Exhaust Nozzle Offset */}
      {showPerVehicle && (
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] text-amber-500">
            1. Per-Vehicle Dual Boost Exhaust Nozzle Offset ({descriptor.name})
          </span>
          <span className="text-[10px] font-mono opacity-75">Live Emitter Sync</span>
        </div>

        <SliderControl
          label="Nozzle X (Rear Longitudinal)"
          value={descriptor.boostNozzleParams.x}
          min={-80}
          max={-35}
          step={0.1}
          unit=" uu"
          onChange={(x) => handleBoostNozzleChange({ x })}
          isLight={isLight}
        />
        <SliderControl
          label="Nozzle Y (Vertical Height)"
          value={descriptor.boostNozzleParams.y}
          min={-10}
          max={30}
          step={0.1}
          unit=" uu"
          onChange={(y) => handleBoostNozzleChange({ y })}
          isLight={isLight}
        />
        <SliderControl
          label="Nozzle Z (Lateral Dual Spread)"
          value={descriptor.boostNozzleParams.z}
          min={0}
          max={35}
          step={0.1}
          unit=" uu"
          onChange={(z) => handleBoostNozzleChange({ z })}
          isLight={isLight}
        />

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px]">Follow Chassis Center Offset</span>
          <ToggleSwitch
            checked={Boolean(descriptor.boostNozzleParams.followChassisOffset)}
            onChange={(followChassisOffset) => handleBoostNozzleChange({ followChassisOffset })}
            isLight={isLight}
          />
        </div>

        <div
          className={`p-2 rounded-lg border font-mono text-[10px] ${
            isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <div className="opacity-70 mb-0.5">Resolved Emitter World Offsets (uu):</div>
          <div>Left Nozzle: [{descriptor.boostOutlets[0]?.join(', ')}]</div>
          <div>Right Nozzle: [{descriptor.boostOutlets[1]?.join(', ')}]</div>
        </div>
      </div>
      )}

      {/* 2. Macro: Global Boost Cone Expansion, Dual-Stream & Distance Fade */}
      {showGlobal && (
      <div className={cardClass}>
        <div className="flex flex-col">
          <span className="font-bold text-[11px] text-emerald-400">
            2. Global Boost Trail, Dual-Stream & Bloom FX
          </span>
          <span className="text-[10px] opacity-70">
            Applies globally to all vehicle boost emitters in the arena
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[11px]">Active Boost Visual Style</span>
          <SegmentedSwitch
            value={boostVisual}
            onChange={(val) => onBoostVisualChange(val as 'cartoon' | 'gold-rush')}
            options={[
              { value: 'cartoon', label: 'Cartoon' },
              { value: 'gold-rush', label: 'Gold Rush' },
            ]}
            size="sm"
            fullWidth
            isLight={isLight}
          />
        </div>

        <ToggleSwitch
          label="Enable BoostBloom Post-Processing"
          description="Toggles the 4-mip dual-Kawase HDR bloom pass & depth occluder pass during boost"
          checked={particleConfig.bloomEnabled}
          onChange={(checked) => applyParticlePatch({ bloomEnabled: checked })}
          isLight={isLight}
        />

        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[11px]">Particle Detail Preset</span>
          <SegmentedSwitch
            value={particleConfig.detailPreset}
            onChange={(val) => applyParticlePatch({ detailPreset: val as 'none' | 'low' | 'full' })}
            options={[
              { value: 'none', label: 'None (Cone Only)' },
              { value: 'low', label: 'Low (40%)' },
              { value: 'full', label: 'Full (100%)' },
            ]}
            size="sm"
            fullWidth
            isLight={isLight}
          />
        </div>

        <ToggleSwitch
          label="Dual-Stream Trail Spawner (Short Near + Long Far)"
          description="Splits boost trail into a 0.10s near cone (following 0.6s expansion curve) and a 2.0s far plume"
          checked={Boolean(particleConfig.dualStreamEnabled)}
          onChange={(checked) => applyParticlePatch({ dualStreamEnabled: checked })}
          isLight={isLight}
        />

        {particleConfig.dualStreamEnabled ? (
          <div className="flex flex-col gap-2 pl-2 border-l-2 border-emerald-500/40">
            <SliderControl
              label="Near-Car Short Stream Spawn Rate"
              value={particleConfig.shortTrailSpawnMultiplier ?? 1.0}
              min={0}
              max={2}
              step={0.05}
              unit="x"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ shortTrailSpawnMultiplier: val })}
              isLight={isLight}
            />

            <SliderControl
              label="Near-Car Cutoff Lifetime"
              value={particleConfig.shortTrailLifetime ?? 0.1}
              min={0.05}
              max={1.2}
              step={0.05}
              unit="s"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ shortTrailLifetime: val })}
              isLight={isLight}
            />

            <SliderControl
              label="Near-Car Cone Expansion Curve Reference Duration"
              value={particleConfig.shortTrailScaleRefLife ?? 0.6}
              min={0.15}
              max={1.5}
              step={0.05}
              unit="s"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ shortTrailScaleRefLife: val })}
              isLight={isLight}
            />

            <SliderControl
              label="Far-Tail Long Stream Spawn Rate"
              value={particleConfig.longTrailSpawnMultiplier ?? 0.1}
              min={0}
              max={1.5}
              step={0.05}
              unit="x"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ longTrailSpawnMultiplier: val })}
              isLight={isLight}
            />

            <SliderControl
              label="Far-Tail Long Stream Lifetime"
              value={particleConfig.longTrailLifetime ?? 2.0}
              min={0.3}
              max={5.0}
              step={0.1}
              unit="s"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ longTrailLifetime: val })}
              isLight={isLight}
            />

            <ToggleSwitch
              label="Smooth Near-to-Far Transition Bridge"
              checked={particleConfig.smoothStreamTransition !== false}
              onChange={(checked) => applyParticlePatch({ smoothStreamTransition: checked })}
              isLight={isLight}
            />
          </div>
        ) : (
          <>
            <SliderControl
              label="Trail Spawn Rate Multiplier"
              value={particleConfig.trailSpawnMultiplier}
              min={0}
              max={2}
              step={0.1}
              unit="x"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ trailSpawnMultiplier: val })}
              isLight={isLight}
            />

            <SliderControl
              label="Trail Particle Lifetime Multiplier (Base = 1.0s)"
              value={particleConfig.trailLifeMultiplier}
              min={0.1}
              max={3}
              step={0.05}
              unit="x"
              editable={true}
              allowOutOfBoundsInput={true}
              onChange={(val) => applyParticlePatch({ trailLifeMultiplier: val })}
              isLight={isLight}
            />
          </>
        )}

        <ToggleSwitch
          label="Enable Smoothly Distance Fade Out"
          checked={Boolean(particleConfig.distanceDecayEnabled)}
          onChange={(checked) => applyParticlePatch({ distanceDecayEnabled: checked })}
          isLight={isLight}
        />

        {particleConfig.distanceDecayEnabled && (
          <SliderControl
            label="Distance Fade Out Radius (Default: 1200 uu)"
            value={particleConfig.distanceDecayFalloff ?? 1200}
            min={300}
            max={4000}
            step={50}
            unit=" uu"
            editable={true}
            allowOutOfBoundsInput={true}
            onChange={(val) => applyParticlePatch({ distanceDecayFalloff: val })}
            isLight={isLight}
          />
        )}

        <ToggleSwitch
          label="Enable Throttle Drive Puffs"
          checked={particleConfig.drivePuffsEnabled}
          onChange={(checked) => applyParticlePatch({ drivePuffsEnabled: checked })}
          isLight={isLight}
        />

        <ToggleSwitch
          label="Enable Nozzle Dynamic PointLight (Default Off)"
          checked={particleConfig.pointLightEnabled}
          onChange={(checked) => applyParticlePatch({ pointLightEnabled: checked })}
          isLight={isLight}
        />
      </div>
      )}
    </div>
  );
};
