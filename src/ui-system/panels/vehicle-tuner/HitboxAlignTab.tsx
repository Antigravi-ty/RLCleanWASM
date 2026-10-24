import React from 'react';
import { ArrowDownToLine, Crosshair } from 'lucide-react';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import { SliderControl } from '../../primitives/SliderControl';
import {
  PrecisionDigitPicker,
  useTunerPrecision,
} from '../../primitives/PrecisionDigitPicker';
import { ReferenceOverlayCard } from './ReferenceOverlayCard';
import { CameraSwivelSimulatorCard } from './CameraSwivelSimulatorCard';

export interface HitboxAlignTabProps {
  descriptor: any;
  hitboxSpec: any;
  selectedCar: 'fennec' | 'insidio';
  notifyAndRefresh: (carId?: 'fennec' | 'insidio', nextHitboxPreset?: string) => void;
  handleCenterOffsetAxis: (axisIndex: 0 | 1 | 2, val: number) => void;
  handleAlignmentChange: (patch: Record<string, any>) => void;
  handleAlignTopToRLHitbox: () => void;
  handleAlignToWheelArches: () => void;
  handleAlignRawOrigin: () => void;
  isLight: boolean;
  cardClass: string;
}

export const HitboxAlignTab: React.FC<HitboxAlignTabProps> = ({
  descriptor,
  hitboxSpec,
  selectedCar,
  notifyAndRefresh,
  handleCenterOffsetAxis,
  handleAlignmentChange,
  handleAlignTopToRLHitbox,
  handleAlignToWheelArches,
  handleAlignRawOrigin,
  isLight,
  cardClass,
}) => {
  const { step: precisionStep, setStep: setPrecisionStep } = useTunerPrecision();

  const raw = descriptor.rawBounds;
  const s = descriptor.alignment.scale ?? 1;
  const sx = s * (descriptor.alignment.scaleX ?? 1);
  const sy = s * (descriptor.alignment.scaleY ?? 1);
  const sz = s * (descriptor.alignment.scaleZ ?? 1);
  const [ox = 0, oy = 0, oz = 0] = descriptor.alignment.centerOffset || [0, 0, 0];

  const visMinX = raw.min[0] * sx + ox;
  const visMaxX = raw.max[0] * sx + ox;
  const visMinY = raw.min[1] * sy + oy;
  const visMaxY = raw.max[1] * sy + oy;
  const visMaxZ = raw.max[2] * sz + Math.abs(oz);

  const hbTopY = hitboxSpec.up + hitboxSpec.height * 0.5;
  const hbBotY = hitboxSpec.up - hitboxSpec.height * 0.5;
  const hbFrontX = hitboxSpec.forward + hitboxSpec.length * 0.5;
  const hbRearX = hitboxSpec.forward - hitboxSpec.length * 0.5;
  const hbHalfZ = hitboxSpec.width * 0.5;

  return (
    <div className="flex flex-col gap-2.5">
      {/* 0. Reference Image Folder Overlay & Calibration */}
      <ReferenceOverlayCard isLight={isLight} cardClass={cardClass} />

      {/* 0.5. Camera Look & Rear View Simulation Override */}
      <CameraSwivelSimulatorCard isLight={isLight} cardClass={cardClass} />

      {/* 0.8. Precision Step Digit Picker */}
      <PrecisionDigitPicker
        step={precisionStep}
        onStepChange={setPrecisionStep}
        label="Precision Step"
        subtitle="Select digit & use Up/Down/Left/Right arrows on any focused parameter"
        colorScheme="amber"
        isLight={isLight}
      />

      {/* 1. Hitbox Archetype Selector */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px]">Rocket League Hitbox Preset</span>
          <span className="text-[10px] font-mono text-amber-500">{hitboxSpec.name}</span>
        </div>
        <SegmentedSwitch
          value={descriptor.hitboxPreset}
          onValueChange={(val) => {
            descriptor.hitboxPreset = val;
            notifyAndRefresh(selectedCar, val);
          }}
          options={[
            { value: 'hitbox-octane', label: 'Octane' },
            { value: 'hitbox-hybrid', label: 'Hybrid' },
            { value: 'hitbox-dominus', label: 'Dominus' },
            { value: 'hitbox-breakout', label: 'Breakout' },
          ]}
          size="sm"
          fullWidth
          isLight={isLight}
        />

        {/* Live Top-Surface & 6-Face Bounds Readout */}
        <div
          className={`p-2 rounded-lg border font-mono text-[10px] leading-relaxed ${
            isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <div className="font-bold text-amber-500 mb-1 flex items-center justify-between">
            <span>RL Top-Down Bounds Comparison (uu)</span>
            <span>ΔRL Top: {(visMaxY - (raw.rlHitboxTopY ?? hbTopY)).toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
            <span className="opacity-60">Plane</span>
            <span className="opacity-60">Visual Mesh</span>
            <span className="opacity-60">RL Hitbox OBB</span>

            <span>Top Y (Roof):</span>
            <span className="text-emerald-400 font-bold">{visMaxY.toFixed(2)}</span>
            <span>
              {(raw.rlHitboxTopY ?? hbTopY).toFixed(2)} (Sim: {hbTopY.toFixed(2)})
            </span>

            <span>Bottom Y:</span>
            <span>{visMinY.toFixed(2)} (stripped)</span>
            <span>{hbBotY.toFixed(2)}</span>

            <span>Front / Rear X:</span>
            <span>
              [{visMinX.toFixed(1)}, {visMaxX.toFixed(1)}]
            </span>
            <span>
              [{hbRearX.toFixed(1)}, {hbFrontX.toFixed(1)}]
            </span>

            <span>Half-Width Z:</span>
            <span>±{visMaxZ.toFixed(2)}</span>
            <span>±{hbHalfZ.toFixed(2)}</span>
          </div>
        </div>

        {/* 1-Click Top-Down Alignment Actions */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={handleAlignTopToRLHitbox}
            className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              isLight
                ? 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-900'
                : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-300'
            }`}
            title="Aligns untouched visual roof maxY directly flush with Rocket League Hitbox Top (Octane 38.83 / Hybrid 37.83)"
          >
            <ArrowDownToLine className="h-3 w-3" />
            <span>RL Hitbox Top</span>
          </button>
          <button
            type="button"
            onClick={handleAlignToWheelArches}
            className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              isLight
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
            }`}
            title="Aligns visual wheel arch centers to suspension wheel rest heights"
          >
            <Crosshair className="h-3 w-3" />
            <span>Wheel Arch Ref</span>
          </button>
          <button
            type="button"
            onClick={handleAlignRawOrigin}
            className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <span>Raw [0,0,0]</span>
          </button>
        </div>
      </div>

      {/* 2. Spatial Offset & Scale Sliders (All editable & connected to PrecisionDigitPicker) */}
      <div className={cardClass}>
        <span className="font-bold text-[11px]">Chassis Center Offset & Scale</span>
        <SliderControl
          label="Offset X (Forward / Back)"
          value={descriptor.alignment.centerOffset[0]}
          min={-25}
          max={25}
          step={0.05}
          unit=" uu"
          variation="centered"
          origin={0}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleCenterOffsetAxis(0, v)}
          isLight={isLight}
        />
        <SliderControl
          label="Offset Y (Top-Down Height)"
          value={descriptor.alignment.centerOffset[1]}
          min={-25}
          max={25}
          step={0.05}
          unit=" uu"
          variation="centered"
          origin={0}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleCenterOffsetAxis(1, v)}
          isLight={isLight}
        />
        <SliderControl
          label="Offset Z (Lateral)"
          value={descriptor.alignment.centerOffset[2]}
          min={-15}
          max={15}
          step={0.05}
          unit=" uu"
          variation="centered"
          origin={0}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleCenterOffsetAxis(2, v)}
          isLight={isLight}
        />
        <SliderControl
          label="Uniform Scale"
          value={descriptor.alignment.scale}
          min={0.7}
          max={1.3}
          step={0.005}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleAlignmentChange({ scale: v })}
          isLight={isLight}
        />
        <SliderControl
          label="Scale X (Length Ratio)"
          value={descriptor.alignment.scaleX ?? 1}
          min={0.8}
          max={1.2}
          step={0.005}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleAlignmentChange({ scaleX: v })}
          isLight={isLight}
        />
        <SliderControl
          label="Scale Y (Height Ratio)"
          value={descriptor.alignment.scaleY ?? 1}
          min={0.8}
          max={1.2}
          step={0.005}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleAlignmentChange({ scaleY: v })}
          isLight={isLight}
        />
        <SliderControl
          label="Scale Z (Width Ratio)"
          value={descriptor.alignment.scaleZ ?? 1}
          min={0.8}
          max={1.2}
          step={0.005}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(v) => handleAlignmentChange({ scaleZ: v })}
          isLight={isLight}
        />
      </div>
    </div>
  );
};
