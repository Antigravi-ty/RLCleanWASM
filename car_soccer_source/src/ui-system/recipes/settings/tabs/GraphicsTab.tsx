import React, { useState, useEffect } from 'react';
import { VStack } from '../../../layout/VStack';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSegmentedRow } from '../components/SettingSegmentedRow';
import {
  useUIStore,
  type GraphicsConfig,
  type MenuPowerSaveOption,
} from '../../../core/store';
import { DisplayScaleSection } from './graphics/DisplayScaleSection';

export interface GraphicsTabProps {
  isLight?: boolean;
  graphics?: GraphicsConfig;
  onUpdateGraphics?: (patch: Partial<GraphicsConfig>) => void;
  theme?: 'dark' | 'light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
  highlightSetting?: string | null;
  onClearHighlight?: () => void;
  onHover: (desc: string) => void;
  onLeave: () => void;
}

export const GraphicsTab: React.FC<GraphicsTabProps> = ({
  isLight = false,
  graphics: propGraphics,
  onUpdateGraphics: propUpdateGraphics,
  theme: propTheme,
  onThemeChange: propThemeChange,
  highlightSetting,
  onClearHighlight,
  onHover,
  onLeave,
}) => {
  const storeGraphics = useUIStore((s) => s.graphics);
  const storeUpdateGraphics = useUIStore((s) => s.updateGraphics);
  const graphics = propGraphics ?? storeGraphics;
  const updateGraphics = propUpdateGraphics ?? storeUpdateGraphics;

  const storeTheme = useUIStore((s) => s.theme);
  const storeSetTheme = useUIStore((s) => s.setTheme);
  const theme = propTheme ?? storeTheme;
  const setTheme = propThemeChange ?? storeSetTheme;

  const currentRenderScale = graphics.renderScale ?? 50;
  const isPresetScale = currentRenderScale === 25 || currentRenderScale === 50 || currentRenderScale === 75;
  const [isCustomScale, setIsCustomScale] = useState(!isPresetScale);
  const [hasUserCustomizedScale, setHasUserCustomizedScale] = useState(!isPresetScale && currentRenderScale !== 100);
  const [lastCustomScale, setLastCustomScale] = useState(!isPresetScale ? currentRenderScale : 100);

  const handleScalePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setIsCustomScale(true);
      const targetScale = hasUserCustomizedScale ? lastCustomScale : 100;
      updateGraphics({ renderScale: targetScale });
    } else {
      setIsCustomScale(false);
      updateGraphics({ renderScale: Number(preset) });
    }
  };

  // FPS Target segmented presets: 30, 60, 75, 90, 120, 240, Custom
  const FPS_PRESETS = [30, 60, 75, 90, 120, 240];
  const currentFps = graphics.maxFps ?? 120;
  const isPresetFps = FPS_PRESETS.includes(currentFps);
  const [isCustomFps, setIsCustomFps] = useState(!isPresetFps);

  const handleFpsPresetChange = (preset: string) => {
    if (preset === 'custom') {
      setIsCustomFps(true);
    } else {
      setIsCustomFps(false);
      updateGraphics({ maxFps: Number(preset) });
    }
  };

  // Pulsating glow highlight when navigated from Main Menu
  const [pulsingPowerSave, setPulsingPowerSave] = useState(highlightSetting === 'menu-power-save');

  useEffect(() => {
    if (highlightSetting === 'menu-power-save') {
      setPulsingPowerSave(true);
      const timer = setTimeout(() => {
        setPulsingPowerSave(false);
        onClearHighlight?.();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [highlightSetting, onClearHighlight]);

  return (
    <VStack gap="md" isLight={isLight}>
      {/* UI Scaling and Safe Area Margin Section */}
      <DisplayScaleSection
        isLight={isLight}
        onHover={onHover}
        onLeave={onLeave}
      />

      {/* Light Mode / Dark Mode Switch */}
      <SettingSegmentedRow
        label="Theme Mode"
        subtitle="Switch between dark and light user interface styling"
        value={theme}
        onChange={(val) => setTheme(val as 'dark' | 'light')}
        options={[
          { value: 'dark', label: 'Dark Mode' },
          { value: 'light', label: 'Light Mode' },
        ]}
        onHover={() => onHover('Switches user interface appearance between dark mode and light mode.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Show Stadium Exterior Detail Toggle */}
      <SettingToggleRow
        label="Show Stadium Exterior Details"
        subtitle="Draws stands, roof architecture, floodlights, and outer environment"
        checked={Boolean(graphics.showStadium)}
        onChange={(checked) => updateGraphics({ showStadium: checked })}
        onHover={() => onHover('Controls visibility of exterior stands, roof structure, and surrounding environment.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Frame Rate Limit FPS Toggle */}
      <SettingToggleRow
        label="Frame Rate Limit"
        subtitle="Cap render loop update rate to reduce GPU load and battery usage"
        checked={Boolean(graphics.limitFps)}
        onChange={(checked) => updateGraphics({ limitFps: checked })}
        onHover={() => onHover('Enables capping the maximum rendering frame rate to keep system temperatures low.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* FPS Target Segmented Control (30, 60, 75, 90, 120, 240, Custom) */}
      <SettingSegmentedRow
        label="FPS Target"
        subtitle="Target maximum frame rate cap when limit is enabled"
        value={isCustomFps || !isPresetFps ? 'custom' : String(currentFps)}
        onChange={handleFpsPresetChange}
        options={[
          { value: '30', label: '30' },
          { value: '60', label: '60' },
          { value: '75', label: '75' },
          { value: '90', label: '90' },
          { value: '120', label: '120' },
          { value: '240', label: '240' },
          { value: 'custom', label: 'Custom' },
        ]}
        onHover={() => onHover('Select a frame rate target (30, 60, 75, 90, 120, 240) or select Custom for fine control.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Continuous FPS Slider reveals only when Custom is chosen */}
      {(isCustomFps || !isPresetFps) && (
        <div className="pl-3 border-l-2 border-neutral-500/20 my-0.5">
          <SettingSliderRow
            label="Custom FPS Target"
            value={graphics.maxFps}
            min={15}
            max={240}
            step={1}
            unit=" FPS"
            disabled={!graphics.limitFps}
            onChange={(val) => updateGraphics({ maxFps: val })}
            onHover={() => onHover('Sets target maximum frame rate between 15 and 240 FPS (active when limit is enabled).')}
            onLeave={onLeave}
            isLight={isLight}
          />
        </div>
      )}

      {/* Menu Background Power Save (4 tiers, Segmented only, with pulsating highlight) */}
      <div
        className={`transition-all duration-300 rounded-lg p-0.5 ${
          pulsingPowerSave
            ? 'ring-2 ring-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.7)] animate-pulse bg-amber-500/10'
            : ''
        }`}
      >
        <SettingSegmentedRow
          label="Menu Power Save"
          subtitle="3D scene render behavior while menus are open (Default: 30 FPS)"
          value={graphics.menuPowerSave || '30'}
          onChange={(val) => {
            setPulsingPowerSave(false);
            onClearHighlight?.();
            updateGraphics({
              menuPowerSave: val as MenuPowerSaveOption,
              pauseRenderingOnMenu: val === 'freeze'
            });
          }}
          options={[
            { value: 'freeze', label: 'Freeze' },
            { value: '15', label: '15 FPS' },
            { value: '30', label: '30 FPS' },
            { value: 'match', label: 'Match' },
          ]}
          onHover={() => onHover('Controls 3D background rendering while menus are open: Freeze halts GPU rendering completely, 15/30 FPS throttles render rate to save power, and Match runs at normal FPS.')}
          onLeave={onLeave}
          isLight={isLight}
        />
      </div>

      {/* Render Scale Schematic Control: 25%, 50%, 75%, Custom */}
      <SettingSegmentedRow
        label="Render Scale"
        subtitle="Internal 3D canvas physical pixel resolution scaling"
        value={isCustomScale || !isPresetScale ? 'custom' : String(currentRenderScale)}
        onChange={handleScalePresetChange}
        options={[
          { value: '25', label: '25%' },
          { value: '50', label: '50%' },
          { value: '75', label: '75%' },
          { value: 'custom', label: 'Custom' },
        ]}
        onHover={() => onHover('Select a preset render scale (25%, 50%, 75%) or select Custom for fine control.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Custom slider appears only when Custom is chosen */}
      {(isCustomScale || !isPresetScale) && (
        <div className="pl-3 border-l-2 border-neutral-500/20 my-0.5">
          <SettingSliderRow
            label="Custom Render Scale"
            value={currentRenderScale}
            min={25}
            max={100}
            step={1}
            unit="%"
            onChange={(val) => {
              setHasUserCustomizedScale(true);
              setLastCustomScale(val);
              updateGraphics({ renderScale: val });
            }}
            onHover={() => onHover('Continuous internal resolution slider between 25% and 100%.')}
            onLeave={onLeave}
            isLight={isLight}
          />
        </div>
      )}
    </VStack>
  );
};
