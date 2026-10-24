import React from 'react';
import { Eye } from 'lucide-react';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import { SliderControl } from '../../primitives/SliderControl';
import {
  useReferenceOverlayStore,
  type CameraLookOverridePreset,
} from '../../../stores/referenceOverlayStore';

export interface CameraSwivelSimulatorCardProps {
  isLight: boolean;
  cardClass: string;
}

export const CameraSwivelSimulatorCard: React.FC<CameraSwivelSimulatorCardProps> = ({
  isLight,
  cardClass,
}) => {
  const cameraLookPreset = useReferenceOverlayStore((s) => s.cameraLookPreset);
  const cameraLookStrength = useReferenceOverlayStore((s) => s.cameraLookStrength);
  const cameraLookXOverride = useReferenceOverlayStore((s) => s.cameraLookXOverride);
  const cameraLookYOverride = useReferenceOverlayStore((s) => s.cameraLookYOverride);
  const setCameraLookPreset = useReferenceOverlayStore((s) => s.setCameraLookPreset);
  const setCameraLookStrength = useReferenceOverlayStore((s) => s.setCameraLookStrength);
  const setCameraLookAxes = useReferenceOverlayStore((s) => s.setCameraLookAxes);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-sky-400 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          <span>Camera Swivel & Rear View Simulator</span>
        </span>
        <span className="text-[10px] font-mono opacity-75">
          Hands-Free Camera Input Override
        </span>
      </div>

      <SegmentedSwitch
        value={cameraLookPreset}
        onValueChange={(val) => setCameraLookPreset(val as CameraLookOverridePreset)}
        options={[
          { value: 'none', label: 'None' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'up', label: 'Up' },
          { value: 'down', label: 'Down' },
          { value: 'rearView', label: 'Rear' },
        ]}
        size="sm"
        fullWidth
        isLight={isLight}
      />

      {cameraLookPreset !== 'none' && cameraLookPreset !== 'rearView' && (
        <SliderControl
          label={
            cameraLookPreset === 'left' || cameraLookPreset === 'right'
              ? 'Simulated Analog Swivel Magnitude (Default Left/Right: 0.95)'
              : 'Simulated Analog Swivel Magnitude (Default Up/Down: 0.81)'
          }
          value={cameraLookStrength}
          min={0}
          max={1}
          step={0.01}
          editable={true}
          usePrecisionContext={true}
          onChange={(val) => setCameraLookStrength(val)}
          isLight={isLight}
        />
      )}

      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <SliderControl
          label="Manual Look X (Left / Right)"
          value={cameraLookXOverride}
          min={-1}
          max={1}
          step={0.01}
          variation="centered"
          origin={0}
          editable={true}
          usePrecisionContext={true}
          onChange={(val) => setCameraLookAxes(val, cameraLookYOverride)}
          isLight={isLight}
        />
        <SliderControl
          label="Manual Look Y (Up / Down)"
          value={cameraLookYOverride}
          min={-1}
          max={1}
          step={0.01}
          variation="centered"
          origin={0}
          editable={true}
          usePrecisionContext={true}
          onChange={(val) => setCameraLookAxes(cameraLookXOverride, val)}
          isLight={isLight}
        />
      </div>
    </div>
  );
};
