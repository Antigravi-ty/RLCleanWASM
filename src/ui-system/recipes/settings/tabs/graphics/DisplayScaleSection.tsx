import React, { useState } from 'react';
import { SettingSliderRow } from '../../components/SettingSliderRow';
import { SettingToggleRow } from '../../components/SettingToggleRow';
import { SettingSegmentedRow } from '../../components/SettingSegmentedRow';
import { useUIStore } from '../../../../../stores/uiStore';

export interface DisplayScaleSectionProps {
  isLight?: boolean;
  onHover: (desc: string) => void;
  onLeave: () => void;
}

export const DisplayScaleSection: React.FC<DisplayScaleSectionProps> = ({
  isLight = false,
  onHover,
  onLeave,
}) => {
  const uiScale = useUIStore((s) => s.uiScale ?? 100);
  const setUiScale = useUIStore((s) => s.setUiScale);
  const safeAreaMargin = useUIStore((s) => s.safeAreaMargin ?? 0);
  const setSafeAreaMargin = useUIStore((s) => s.setSafeAreaMargin);
  const showSafeAreaHud = useUIStore((s) => s.showSafeAreaHud);
  const setShowSafeAreaHud = useUIStore((s) => s.setShowSafeAreaHud);

  const UI_SCALE_PRESETS = [100, 125, 150];
  const isPresetUiScale = UI_SCALE_PRESETS.includes(uiScale);
  const [isCustomUiScale, setIsCustomUiScale] = useState(!isPresetUiScale);
  const [lastCustomUiScale, setLastCustomUiScale] = useState(!isPresetUiScale ? uiScale : 100);

  const handleUiScalePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setIsCustomUiScale(true);
      setUiScale(lastCustomUiScale || 100);
    } else {
      setIsCustomUiScale(false);
      const num = Number(preset);
      setLastCustomUiScale(num);
      setUiScale(num);
    }
  };

  return (
    <>
      {/* UI Scaling Segmented Control: 100%, 125%, 150%, Custom */}
      <SettingSegmentedRow
        label="UI Scaling"
        subtitle="Scale HUD, overlays, and menu interface (100%, 125%, 150%, Custom)"
        value={isPresetUiScale && !isCustomUiScale ? String(uiScale) : 'custom'}
        onChange={handleUiScalePresetChange}
        options={[
          { value: '100', label: '100%' },
          { value: '125', label: '125%' },
          { value: '150', label: '150%' },
          { value: 'custom', label: 'Custom' },
        ]}
        onHover={() => onHover('Select interface scaling preset (100%, 125%, 150%) or select Custom for fine slider control.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Custom UI Scale Slider (shown when Custom is active or non-preset scale) */}
      {(isCustomUiScale || !isPresetUiScale) && (
        <SettingSliderRow
          label="Custom UI Scale"
          value={uiScale}
          min={50}
          max={200}
          step={5}
          unit="%"
          onChange={(val) => {
            setLastCustomUiScale(val);
            setUiScale(val);
          }}
          onHover={() => onHover('Fine-tune interface scale factor between 50% and 200%.')}
          onLeave={onLeave}
          isLight={isLight}
        />
      )}

      {/* Safe Area Margin Slider */}
      <SettingSliderRow
        label="Safe Area Margin"
        value={safeAreaMargin}
        min={-5}
        max={10}
        step={0.5}
        unit="%"
        onChange={(val) => setSafeAreaMargin(val)}
        onHover={() => onHover('Compensates for display bezel cutouts and camera notches (-5% to +10%).')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Safe Area & UI Scale Observation Toggle */}
      <SettingToggleRow
        label="Observe Safe Area Boundary"
        subtitle="Show visual boundary outline and calibration pill"
        checked={showSafeAreaHud}
        onChange={(val) => setShowSafeAreaHud(val)}
        onHover={() => onHover('Displays boundary guides and bottom telemetry pill to observe and calibrate UI scaling and bezel margins in real-time.')}
        onLeave={onLeave}
        isLight={isLight}
      />
    </>
  );
};
