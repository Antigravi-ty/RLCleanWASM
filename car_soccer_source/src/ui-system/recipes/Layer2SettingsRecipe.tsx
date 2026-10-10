import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {
  Gamepad2, Video, Keyboard, Monitor, Info, Sliders, ArrowRight,
  LineSquiggle, Activity, Plus, X, MonitorPlay, RefreshCw, Ruler, Gauge, Router,
  Volume2, Target, Terminal, Code2, Zap
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { UnderlineTabs, type TabItem } from '../primitives/UnderlineTabs';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { Badge } from '../primitives/Badge';
import { VStack } from '../layout/VStack';
import { useUIStore, type CameraConfig, type TrajectoryConfig, type GraphicsConfig, type MenuPowerSaveOption, type TelemetryConfig } from '../core/store';
import { useFloatingStore, floatingStore } from '../tokens/floatingStore';
import {
  DIAGNOSTICS_WINDOW_PRESET,
  EVENT_STREAM_OB_PRESET,
  DETERMINISM_HARNESS_PRESET,
  NETWORK_DIAGNOSTICS_PRESET,
} from '../tokens/floatingPresets';
import { audioConfig, AUDIO_SETTINGS_CHANGED_EVENT } from '../../audio/AudioArchitecture.js';

export interface Layer2SettingsRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onNavigateAudioDetail?: () => void;
  onNavigateTrainingDetail?: () => void;
  onNavigateAdvancedAudio?: () => void;
  onNavigateEventAndTriggerer?: () => void;
  onNavigateTrajectoryDetail?: () => void;
  onNavigateCameraDetail?: () => void;
  onNavigateKeybindingsDetail?: () => void;
  initialTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  highlightSetting?: string | null;
  onClearHighlight?: () => void;
  // Decoupled props for standalone / test usage
  camera?: CameraConfig;
  onUpdateCamera?: (patch: Partial<CameraConfig>) => void;
  onResetCamera?: () => void;
  trajectory?: TrajectoryConfig;
  onUpdateTrajectory?: (patch: Partial<TrajectoryConfig>) => void;
  graphics?: GraphicsConfig;
  onUpdateGraphics?: (patch: Partial<GraphicsConfig>) => void;
  telemetry?: TelemetryConfig;
  onUpdateTelemetry?: (patch: Partial<TelemetryConfig>) => void;
  theme?: 'dark' | 'light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
}

export type SettingsTabId = 'gameplay' | 'audio' | 'graphics' | 'advanced' | 'developer';

interface SettingSliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (val: number) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

const SettingSliderRow: React.FC<SettingSliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div
      className={`flex items-center gap-4 w-full py-1 px-2 rounded-lg transition-colors select-none ${
        disabled
          ? 'opacity-40 pointer-events-none'
          : 'hover:bg-neutral-500/10 cursor-pointer'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <span className={`w-36 sm:w-44 shrink-0 text-xs font-semibold truncate ${
        isLight ? 'text-neutral-800' : 'text-neutral-200'
      }`}>
        {label}
      </span>

      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(vals) => onChange(vals[0])}
        className="relative flex items-center select-none touch-none grow h-5 cursor-pointer"
      >
        <SliderPrimitive.Track className={`relative grow rounded-full h-1.5 overflow-hidden ${
          isLight ? 'bg-neutral-200' : 'bg-neutral-800'
        }`}>
          <SliderPrimitive.Range className={`absolute h-full rounded-full ${
            isLight ? 'bg-neutral-900' : 'bg-white'
          }`} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
          isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
        }`} />
      </SliderPrimitive.Root>

      <span className={`font-mono text-[11px] w-14 shrink-0 text-center py-0.5 rounded border select-none ${
        isLight
          ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
          : 'bg-neutral-800 text-neutral-300 border-neutral-700'
      }`}>
        {value}{unit}
      </span>
    </div>
  );
};

interface SettingToggleRowProps {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  label,
  subtitle,
  checked,
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div
      className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
        <span className={`text-xs font-semibold truncate ${
          isLight ? 'text-neutral-800' : 'text-neutral-200'
        }`}>
          {label}
        </span>
        {subtitle && (
          <span className={`text-[11px] mt-0.5 truncate ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            {subtitle}
          </span>
        )}
      </div>
      <ToggleSwitch
        checked={checked}
        onCheckedChange={onChange}
        isLight={isLight}
        variant="neutral"
      />
    </div>
  );
};

interface SettingSegmentedRowProps {
  label: string;
  subtitle?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

const SettingSegmentedRow: React.FC<SettingSegmentedRowProps> = ({
  label,
  subtitle,
  value,
  onChange,
  options,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div
      className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 select-none gap-4"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
        <span className={`text-xs font-semibold truncate ${
          isLight ? 'text-neutral-800' : 'text-neutral-200'
        }`}>
          {label}
        </span>
        {subtitle && (
          <span className={`text-[11px] mt-0.5 truncate ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            {subtitle}
          </span>
        )}
      </div>
      <div className="shrink-0">
        <SegmentedSwitch
          value={value}
          onValueChange={onChange}
          options={options}
          isLight={isLight}
          size="sm"
        />
      </div>
    </div>
  );
};

/**
 * [Recipe] Layer 2 Settings Menu (Width: 680px)
 * Streamlined, minimalist settings interface.
 * - Single header title without subtitle or badge
 * - UnderlineTabs hosting Camera tab
 * - Clean single-row layout for all sliders and switches
 * - Dynamic English tooltip footer based on active hovered item
 * - Inline red reset action with double-check confirmation
 */
export const Layer2SettingsRecipe: React.FC<Layer2SettingsRecipeProps> = ({
  isLight = false,
  onBack,
  onNavigateAudioDetail,
  onNavigateTrainingDetail,
  onNavigateAdvancedAudio,
  onNavigateEventAndTriggerer,
  onNavigateTrajectoryDetail,
  onNavigateCameraDetail,
  onNavigateKeybindingsDetail,
  initialTab = 'gameplay',
  activeTab: controlledTab,
  onTabChange,
  highlightSetting,
  onClearHighlight,
  camera: propCamera,
  onUpdateCamera: propUpdateCamera,
  onResetCamera: propResetCamera,
  trajectory: propTrajectory,
  onUpdateTrajectory: propUpdateTrajectory,
  graphics: propGraphics,
  onUpdateGraphics: propUpdateGraphics,
  telemetry: propTelemetry,
  onUpdateTelemetry: propUpdateTelemetry,
  theme: propTheme,
  onThemeChange: propThemeChange,
}) => {
  const [internalTab, setInternalTab] = useState<SettingsTabId>(initialTab as SettingsTabId);
  const currentTab = (controlledTab as SettingsTabId) ?? internalTab;

  const handleTabChange = (t: string) => {
    const valid = t as SettingsTabId;
    setInternalTab(valid);
    onTabChange?.(valid);
  };

  // Developer mode store connection (controlled strictly via URL ?dev=1)
  const developerMode = useUIStore((s) => s.developerMode);

  // Audio settings state synchronized with audioConfig
  const [audioState, setAudioState] = useState(() => ({
    continueAudioOnLostFocus: Boolean(audioConfig.get('continueAudioOnLostFocus')),
    masterVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('masterVolume') ?? 1.0) * 100))),
    engineVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('engineVolume') ?? 1.0) * 100))),
    boostVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('boostVolume') ?? 0.8) * 100))),
  }));

  useEffect(() => {
    const handleAudioSync = () => {
      setAudioState({
        continueAudioOnLostFocus: Boolean(audioConfig.get('continueAudioOnLostFocus')),
        masterVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('masterVolume') ?? 1.0) * 100))),
        engineVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('engineVolume') ?? 1.0) * 100))),
        boostVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('boostVolume') ?? 0.8) * 100))),
      });
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleAudioSync);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleAudioSync);
  }, []);

  const handleUpdateAudio = (key: string, val: number | boolean) => {
    if (typeof val === 'boolean') {
      audioConfig.set(key, val);
      setAudioState((prev) => ({ ...prev, [key]: val }));
    } else {
      audioConfig.set(key, val / 100);
      setAudioState((prev) => ({ ...prev, [key]: val }));
    }
  };

  // State connection with fallback props
  const storeCamera = useUIStore((s) => s.camera);
  const storeUpdateCamera = useUIStore((s) => s.updateCamera);
  const storeResetCamera = useUIStore((s) => s.resetCamera);

  const camera = propCamera ?? storeCamera;
  const updateCamera = propUpdateCamera ?? storeUpdateCamera;
  const resetCamera = propResetCamera ?? storeResetCamera;

  const storeTrajectory = useUIStore((s) => s.trajectory);
  const storeUpdateTrajectory = useUIStore((s) => s.updateTrajectory);
  const trajectory = propTrajectory ?? storeTrajectory;
  const updateTrajectory = propUpdateTrajectory ?? storeUpdateTrajectory;

  const storeGraphics = useUIStore((s) => s.graphics);
  const storeUpdateGraphics = useUIStore((s) => s.updateGraphics);
  const graphics = propGraphics ?? storeGraphics;
  const updateGraphics = propUpdateGraphics ?? storeUpdateGraphics;

  const storeTelemetry = useUIStore((s) => s.telemetry);
  const storeUpdateTelemetry = useUIStore((s) => s.updateTelemetry);
  const telemetry = propTelemetry ?? storeTelemetry;
  const updateTelemetry = propUpdateTelemetry ?? storeUpdateTelemetry;

  const storeTheme = useUIStore((s) => s.theme);
  const storeSetTheme = useUIStore((s) => s.setTheme);
  const theme = propTheme ?? storeTheme;
  const setTheme = propThemeChange ?? storeSetTheme;

  const storeGameplay = useUIStore((s) => s.gameplay);
  const storeUpdateGameplay = useUIStore((s) => s.updateGameplay);
  const gameplay = storeGameplay;
  const updateGameplay = storeUpdateGameplay;

  const currentRenderScale = graphics.renderScale ?? 50;
  const isPresetScale = currentRenderScale === 25 || currentRenderScale === 50 || currentRenderScale === 75;
  const [isCustomScale, setIsCustomScale] = useState(!isPresetScale);

  const handleScalePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setIsCustomScale(true);
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

  // Hover description state for footer
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Double check state for Reset Camera
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  // Auto reset confirmation after 4 seconds
  useEffect(() => {
    if (isConfirmingReset) {
      const timer = setTimeout(() => setIsConfirmingReset(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmingReset]);

  // Floating window store integration
  const { windows } = useFloatingStore();

  const tabs: TabItem[] = [
    {
      id: 'gameplay',
      label: 'Gameplay',
      icon: <Gamepad2 className="h-3.5 w-3.5" />,
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: <Volume2 className="h-3.5 w-3.5" />,
    },
    {
      id: 'graphics',
      label: 'Graphics',
      icon: <Monitor className="h-3.5 w-3.5" />,
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: <Sliders className="h-3.5 w-3.5" />,
    },
  ];

  if (developerMode) {
    tabs.push({
      id: 'developer',
      label: 'Developer',
      icon: <Terminal className="h-3.5 w-3.5" />,
    });
  }

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[680px]">
      <PanelHeader
        title="SETTINGS"
        onBack={onBack}
        isLight={isLight}
      />

      <div className="px-6 pt-2 w-full" data-ui-element="tabs-wrapper">
        <UnderlineTabs
          items={tabs}
          activeId={currentTab}
          onChange={handleTabChange}
          isLight={isLight}
          size="sm"
          fullWidth={true}
        />
      </div>

      <PanelContent scrollable className="p-6">
        {/* 1. GAMEPLAY */}
        {currentTab === 'gameplay' && (
          <VStack gap="md" isLight={isLight}>
            {/* 1. Top Item: Training Mode Configuration (Level 3 Menu Entry) */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Configure training rules, boost mode (standard vs unlimited), and car hitbox collision visualization.')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Target className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className={`text-xs font-semibold truncate ${
                    isLight ? 'text-neutral-800' : 'text-neutral-200'
                  }`}>
                    Training Mode Configuration
                  </span>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Boost mode & car hitbox collision overlay
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTrainingDetail?.()}
                className={`py-1 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                <span>Configure</span>
                <ArrowRight className="h-3 w-3 opacity-75" />
              </button>
            </div>

            {/* 2. Second Item: Key Bindings Settings (Directly under Training Mode Configuration) */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Customize keyboard keys and gamepad controller buttons.')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Keyboard className="h-4 w-4 text-neutral-400 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className={`text-xs font-semibold truncate ${
                    isLight ? 'text-neutral-800' : 'text-neutral-200'
                  }`}>
                    Key Bindings Settings
                  </span>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Keyboard, mouse & controller mapping configuration
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateKeybindingsDetail?.()}
                onMouseEnter={() => setHoveredDesc('Open key bindings panel to reassign keyboard and gamepad actions.')}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`shrink-0 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
                }`}
              >
                <span>Configure</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-75" />
              </button>
            </div>

            {/* 3. Third Item: Quick Toggle: Ball Cam Indicator (Bound to HUD in-game bottom-left indicator) */}
            <div
              className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
              onMouseEnter={() => setHoveredDesc('Toggles the on-screen ball camera HUD indicator displayed in the bottom-left corner.')}
              onMouseLeave={() => setHoveredDesc(null)}
              onClick={() => updateGameplay({ ballCamIndicator: !gameplay.ballCamIndicator })}
            >
              <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
                <span className={`text-xs font-semibold truncate ${
                  isLight ? 'text-neutral-800' : 'text-neutral-200'
                }`}>
                  Ball Cam Indicator
                </span>
                <span className={`text-[11px] mt-0.5 truncate ${
                  isLight ? 'text-neutral-500' : 'text-neutral-400'
                }`}>
                  Display HUD indicator in bottom-left corner
                </span>
              </div>
              <ToggleSwitch
                checked={Boolean(gameplay.ballCamIndicator)}
                onCheckedChange={(checked) => updateGameplay({ ballCamIndicator: checked })}
                isLight={isLight}
                variant="neutral"
              />
            </div>

            {/* 4. Fourth Item: Ball Trajectory Predictor Configuration Panel */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                isLight
                  ? 'bg-neutral-50/80 border-neutral-200'
                  : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
            >
              <div
                className="flex items-center justify-between w-full cursor-pointer select-none"
                onMouseEnter={() => setHoveredDesc('Toggles real-time 3D physical flight path prediction for the ball.')}
                onMouseLeave={() => setHoveredDesc(null)}
                onClick={() => updateTrajectory({ enabled: !trajectory.enabled })}
              >
                <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <LineSquiggle className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className={`text-xs font-semibold truncate ${
                      isLight ? 'text-neutral-800' : 'text-neutral-200'
                    }`}>
                      Ball Trajectory Predictor
                    </span>
                  </div>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    RocketSim WASM real-time 3D flight trajectory calculation
                  </span>
                </div>

                <ToggleSwitch
                  checked={Boolean(trajectory.enabled)}
                  onCheckedChange={(checked) => updateTrajectory({ enabled: checked })}
                  isLight={isLight}
                  variant="neutral"
                />
              </div>

              {/* Centered button to enter Layer 3 accuracy predictor panel */}
              <div className="flex justify-center w-full pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateTrajectoryDetail?.()}
                  onMouseEnter={() => setHoveredDesc('Open trajectory detail panel to adjust prediction horizon, styling, dash intervals and colors.')}
                  onMouseLeave={() => setHoveredDesc(null)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.99] ${
                    isLight
                      ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
                      : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5 opacity-75" />
                  <span>Configure Trajectory Parameters</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-75" />
                </button>
              </div>
            </div>

            {/* 5. Fifth Item: Camera Settings */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Field of view, height, angle, distance & tracking stiffness.')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Video className="h-4 w-4 text-neutral-400 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className={`text-xs font-semibold truncate ${
                    isLight ? 'text-neutral-800' : 'text-neutral-200'
                  }`}>
                    Camera Settings
                  </span>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Field of view, distance, height, angle & tracking stiffness
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateCameraDetail?.()}
                onMouseEnter={() => setHoveredDesc('Open camera live preview panel to adjust FOV, height, angle and stiffness.')}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`shrink-0 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
                }`}
              >
                <span>Configure</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-75" />
              </button>
            </div>
          </VStack>
        )}

        {/* 2. AUDIO */}
        {currentTab === 'audio' && (
          <VStack gap="md" isLight={isLight}>
            <SettingToggleRow
              label="Play Audio in Background"
              subtitle="Keep engine synthesis and game sound active when tab is unfocused"
              checked={audioState.continueAudioOnLostFocus}
              onChange={(val) => handleUpdateAudio('continueAudioOnLostFocus', val)}
              onHover={() => setHoveredDesc('Keep game sound and engine synthesis active even when the window or tab is unfocused.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <SettingSliderRow
              label="Master Volume"
              value={audioState.masterVolume}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(val) => handleUpdateAudio('masterVolume', val)}
              onHover={() => setHoveredDesc('Global audio output ceiling across all spatial audio and powertrain sound channels.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <SettingSliderRow
              label="Engine Volume"
              value={audioState.engineVolume}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(val) => handleUpdateAudio('engineVolume', val)}
              onHover={() => setHoveredDesc('Dynamic electric motor synthesis (EMotorSynth) powertrain continuous audio.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <SettingSliderRow
              label="Boost Volume"
              value={audioState.boostVolume}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(val) => handleUpdateAudio('boostVolume', val)}
              onHover={() => setHoveredDesc('Rocket thruster discharge loop and supersonic acceleration sound.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />
          </VStack>
        )}

        {/* 3. GRAPHICS */}
        {currentTab === 'graphics' && (
          <VStack gap="md" isLight={isLight}>
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
              onHover={() => setHoveredDesc('Switches user interface appearance between dark mode and light mode.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            {/* Stadium Arena Select Control */}
            <SettingSegmentedRow
              label="Stadium Arena"
              subtitle="Choose playing arena visual environment"
              value={graphics.useRLViserStadium ? 'original' : 'arcade'}
              onChange={(val) => updateGraphics({ useRLViserStadium: val === 'original' })}
              options={[
                { value: 'arcade', label: 'Arcade Stadium' },
                { value: 'original', label: 'Original Stadium' },
              ]}
              onHover={() => setHoveredDesc('Switches between the stylized Arcade Stadium and authentic original stadium.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            {/* Show Stadium Exterior Detail Toggle */}
            <SettingToggleRow
              label="Show Stadium Exterior Details"
              subtitle="Draws stands, roof architecture, floodlights, and outer environment"
              checked={Boolean(graphics.showStadium)}
              onChange={(checked) => updateGraphics({ showStadium: checked })}
              onHover={() => setHoveredDesc('Controls visibility of exterior stands, roof structure, and surrounding environment.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            {/* Frame Rate Limit FPS Toggle */}
            <SettingToggleRow
              label="Frame Rate Limit"
              subtitle="Cap render loop update rate to reduce GPU load and battery usage"
              checked={Boolean(graphics.limitFps)}
              onChange={(checked) => updateGraphics({ limitFps: checked })}
              onHover={() => setHoveredDesc('Enables capping the maximum rendering frame rate to keep system temperatures low.')}
              onLeave={() => setHoveredDesc(null)}
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
              onHover={() => setHoveredDesc('Select a frame rate target (30, 60, 75, 90, 120, 240) or select Custom for fine control.')}
              onLeave={() => setHoveredDesc(null)}
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
                  onHover={() => setHoveredDesc('Sets target maximum frame rate between 15 and 240 FPS (active when limit is enabled).')}
                  onLeave={() => setHoveredDesc(null)}
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
                onHover={() => setHoveredDesc('Controls 3D background rendering while menus are open: Freeze halts GPU rendering completely, 15/30 FPS throttles render rate to save power, and Match runs at normal FPS.')}
                onLeave={() => setHoveredDesc(null)}
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
              onHover={() => setHoveredDesc('Select a preset render scale (25%, 50%, 75%) or select Custom for fine control.')}
              onLeave={() => setHoveredDesc(null)}
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
                  onChange={(val) => updateGraphics({ renderScale: val })}
                  onHover={() => setHoveredDesc('Continuous internal resolution slider between 25% and 100%.')}
                  onLeave={() => setHoveredDesc(null)}
                  isLight={isLight}
                />
              </div>
            )}
          </VStack>
        )}

        {/* 4. ADVANCED TAB */}
        {currentTab === 'advanced' && (
          <VStack gap="lg" isLight={isLight}>
            {/* Top Toggle: Developer Settings (URL-controlled) */}
            <div
              className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all cursor-not-allowed ${
                isLight
                  ? 'bg-neutral-50/90 border-neutral-200 shadow-2xs opacity-75'
                  : 'bg-neutral-850/80 border-neutral-700/80 opacity-75'
              }`}
              onMouseEnter={() =>
                setHoveredDesc(
                  developerMode
                    ? 'Developer settings is unlocked. State is locked and cannot be toggled manually.'
                    : 'This developer settings is locked.'
                )
              }
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    developerMode
                      ? 'bg-amber-500/10 text-amber-500'
                      : isLight
                      ? 'bg-neutral-200/80 text-neutral-400'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  <Code2 className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-sm leading-tight ${
                        isLight ? 'text-neutral-900' : 'text-neutral-100'
                      }`}
                    >
                      Developer Settings
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${
                        developerMode
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                          : isLight
                          ? 'bg-neutral-200/60 border-neutral-300 text-neutral-500'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                      }`}
                    >
                      {developerMode ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-normal line-clamp-2 ${
                      isLight ? 'text-neutral-600' : 'text-neutral-400'
                    }`}
                  >
                    {developerMode
                      ? 'Developer settings is unlocked. State is locked and cannot be toggled manually.'
                      : 'This developer settings is locked.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 ml-3 pointer-events-none">
                <ToggleSwitch
                  checked={developerMode}
                  disabled={true}
                  onCheckedChange={() => {}}
                  isLight={isLight}
                  variant="amber"
                />
              </div>
            </div>

            {/* Multiplayer Network Diagnostics Card */}
            <div
              onMouseEnter={() =>
                setHoveredDesc(
                  'Multiplayer Network Diagnostics: Real-time WebRTC RTT latency, client lead ticks, packet loss simulation & predictive rollback smoothing (Shift+P / F2).'
                )
              }
              onMouseLeave={() => setHoveredDesc(null)}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-xs transition-all ${
                isLight
                  ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border-neutral-200 shadow-2xs'
                  : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Router className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-sm leading-tight ${
                        isLight ? 'text-neutral-900' : 'text-neutral-100'
                      }`}
                    >
                      Multiplayer Network Diagnostics
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-violet-500/15 border-violet-500/30 text-violet-400">
                      Shift+P / F2
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-normal line-clamp-2 ${
                      isLight ? 'text-neutral-600' : 'text-neutral-400'
                    }`}
                  >
                    Live RTT ping latency, packet loss stress injection, and predictive rollback verification.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                {(() => {
                  const existingWindow = windows.find((w) => w.id === NETWORK_DIAGNOSTICS_PRESET.id);
                  if (existingWindow) {
                    return (
                      <button
                        type="button"
                        onClick={() => floatingStore.closeWindow(NETWORK_DIAGNOSTICS_PRESET.id)}
                        title={`Close "${NETWORK_DIAGNOSTICS_PRESET.title}"`}
                        className="h-8 w-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 outline-none bg-red-500/15 hover:bg-red-500/25 border-red-400/40 text-red-500 shrink-0"
                      >
                        <X className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        const containerEl =
                          document.getElementById('game-ui-viewport-host') ||
                          document.body;
                        floatingStore.spawnWithFlight(
                          NETWORK_DIAGNOSTICS_PRESET,
                          e.currentTarget,
                          containerEl
                        );
                      }}
                      title={`Spawn "${NETWORK_DIAGNOSTICS_PRESET.title}" into Stack`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0 ${
                        isLight
                          ? 'bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800'
                          : 'bg-neutral-100 hover:bg-white text-neutral-950 font-bold border border-neutral-200'
                      }`}
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                      <span>Spawn</span>
                    </button>
                  );
                })()}
              </div>
            </div>

            {(() => {
              const existingWindow = windows.find((w) => w.id === DIAGNOSTICS_WINDOW_PRESET.id);
              return (
                <div
                  onMouseEnter={() =>
                    setHoveredDesc(
                      'Inspect live frame pacing, tick rate stability, CPU pipeline phases, and GPU draw calls in a dockable floating overlay.'
                    )
                  }
                  onMouseLeave={() => setHoveredDesc(null)}
                  className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-xs transition-all ${
                    isLight
                      ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border-neutral-200 shadow-2xs'
                      : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="h-5 w-5" />
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className={`font-bold text-sm leading-tight ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
                        {DIAGNOSTICS_WINDOW_PRESET.title}
                      </span>
                      <p className={`text-xs leading-normal line-clamp-2 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Real-time CPU phase breakdown, physics simulation sub-ticks, and WebGL rendering pipeline metrics.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {existingWindow ? (
                      <button
                        type="button"
                        onClick={() => floatingStore.closeWindow(DIAGNOSTICS_WINDOW_PRESET.id)}
                        title={`Close "${DIAGNOSTICS_WINDOW_PRESET.title}"`}
                        className="h-8 w-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 outline-none bg-red-500/15 hover:bg-red-500/25 border-red-400/40 text-red-500 shrink-0"
                      >
                        <X className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          const containerEl =
                            document.getElementById('game-ui-viewport-host') ||
                            document.body;
                          floatingStore.spawnWithFlight(
                            DIAGNOSTICS_WINDOW_PRESET,
                            e.currentTarget,
                            containerEl
                          );
                        }}
                        title={`Spawn "${DIAGNOSTICS_WINDOW_PRESET.title}" into Stack`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0 ${
                          isLight
                            ? 'bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800'
                            : 'bg-neutral-100 hover:bg-white text-neutral-950 font-bold border border-neutral-200'
                        }`}
                      >
                        <Plus className="h-4 w-4 stroke-[2.5]" />
                        <span>Spawn</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Always Show Telemetry Section */}
            <div
              className={`p-4 rounded-xl border text-xs flex flex-col gap-3 transition-all ${
                isLight
                  ? 'bg-neutral-50/90 border-neutral-200 shadow-2xs'
                  : 'bg-neutral-850 border-neutral-700/80'
              }`}
            >
              {/* Master Toggle Row */}
              <div
                className="flex items-center justify-between gap-3 cursor-pointer select-none"
                onMouseEnter={() =>
                  setHoveredDesc(
                    'Toggle persistent display of performance and hardware telemetry overlay in the top-left corner.'
                  )
                }
                onMouseLeave={() => setHoveredDesc(null)}
                onClick={() => updateTelemetry({ alwaysShow: !telemetry.alwaysShow })}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <MonitorPlay className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className={`font-bold text-sm leading-tight ${
                        isLight ? 'text-neutral-900' : 'text-neutral-100'
                      }`}
                    >
                      Always Show Telemetry
                    </span>
                    <p
                      className={`text-xs leading-normal line-clamp-2 ${
                        isLight ? 'text-neutral-600' : 'text-neutral-400'
                      }`}
                    >
                      Display real-time performance indicators and hardware metrics during gameplay.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                  <ToggleSwitch
                    checked={telemetry.alwaysShow}
                    onChange={(checked) => updateTelemetry({ alwaysShow: checked })}
                    isLight={isLight}
                  />
                </div>
              </div>

              {/* Sub-controls: Only rendered when alwaysShow is true */}
              {telemetry.alwaysShow && (
                <div
                  className={`flex flex-col gap-2.5 pt-3 border-t ${
                    isLight ? 'border-neutral-200' : 'border-neutral-700/60'
                  }`}
                >
                  {/* 1. Frames Per Second (FPS) */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
                    onMouseEnter={() =>
                      setHoveredDesc(
                        'Display real-time frame presentation rate (e.g. 120hz).'
                      )
                    }
                    onMouseLeave={() => setHoveredDesc(null)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <MonitorPlay className={`h-4 w-4 shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                      <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                        Frames Per Second (FPS)
                      </span>
                    </div>
                    <SegmentedSwitch
                      size="sm"
                      value={telemetry.fpsMode}
                      isLight={isLight}
                      onValueChange={(val) => updateTelemetry({ fpsMode: val as any })}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on_demand', label: 'On Demand', disabled: true },
                        { value: 'always', label: 'Always On' },
                      ]}
                    />
                  </div>

                  {/* 2. Screen Refresh Rate (requires FPS to be enabled) */}
                  <div
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none transition-opacity ${
                      telemetry.fpsMode === 'off' ? 'opacity-40' : ''
                    }`}
                    onMouseEnter={() =>
                      setHoveredDesc(
                        telemetry.fpsMode === 'off'
                          ? 'Display screen hardware refresh rate (e.g. / 120hz). Requires FPS to be enabled.'
                          : 'Display screen hardware refresh rate appended to FPS (e.g. / 120hz).'
                      )
                    }
                    onMouseLeave={() => setHoveredDesc(null)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <RefreshCw className={`h-4 w-4 shrink-0 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
                      <div className="flex flex-col">
                        <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                          Screen Refresh Rate
                        </span>
                        {telemetry.fpsMode === 'off' && (
                          <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Requires FPS to be enabled
                          </span>
                        )}
                      </div>
                    </div>
                    <SegmentedSwitch
                      size="sm"
                      disabled={telemetry.fpsMode === 'off'}
                      value={telemetry.fpsMode === 'off' ? 'off' : telemetry.refreshRateMode}
                      isLight={isLight}
                      onValueChange={(val) => updateTelemetry({ refreshRateMode: val as any })}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on_demand', label: 'On Demand', disabled: true },
                        { value: 'always', label: 'Always On' },
                      ]}
                    />
                  </div>

                  {/* 2. Render Scale */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
                    onMouseEnter={() =>
                      setHoveredDesc(
                        'Display current 3D viewport canvas rendering scale percentage (e.g. 50%).'
                      )
                    }
                    onMouseLeave={() => setHoveredDesc(null)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Ruler className={`h-4 w-4 shrink-0 ${isLight ? 'text-sky-600' : 'text-sky-400'}`} />
                      <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                        Render Scale
                      </span>
                    </div>
                    <SegmentedSwitch
                      size="sm"
                      value={telemetry.renderScaleMode}
                      isLight={isLight}
                      onValueChange={(val) => updateTelemetry({ renderScaleMode: val as any })}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on_demand', label: 'On Demand', disabled: true },
                        { value: 'always', label: 'Always On' },
                      ]}
                    />
                  </div>

                  {/* 3. Physics Rate */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
                    onMouseEnter={() =>
                      setHoveredDesc(
                        'Display physical simulation tick rate (118 to 122 Hz, integer steps).'
                      )
                    }
                    onMouseLeave={() => setHoveredDesc(null)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Gauge className={`h-4 w-4 shrink-0 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
                      <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                        Physics Rate
                      </span>
                    </div>
                    <SegmentedSwitch
                      size="sm"
                      value={telemetry.physicsRateMode}
                      isLight={isLight}
                      onValueChange={(val) => updateTelemetry({ physicsRateMode: val as any })}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on_demand', label: 'On Demand', disabled: true },
                        { value: 'always', label: 'Always On' },
                      ]}
                    />
                  </div>

                  {/* 4. Network Latency */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
                    onMouseEnter={() =>
                      setHoveredDesc(
                        'Display network round-trip ping and simulated latency offset (e.g. 0ms(+0)).'
                      )
                    }
                    onMouseLeave={() => setHoveredDesc(null)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Router className={`h-4 w-4 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                      <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                        Network Latency
                      </span>
                    </div>
                    <SegmentedSwitch
                      size="sm"
                      value={telemetry.latencyMode}
                      isLight={isLight}
                      onValueChange={(val) => updateTelemetry({ latencyMode: val as any })}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on_demand', label: 'On Demand', disabled: true },
                        { value: 'always', label: 'Always On' },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          </VStack>
        )}

        {/* 5. DEVELOPER TAB */}
        {currentTab === 'developer' && developerMode && (
          <VStack gap="md" isLight={isLight}>
            {/* Entry 1: Advanced Audio Settings */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Multi-bus audio calibration (0% - 500%), arbitrary integer direct inputs, and configuration export.')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Sliders className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className={`text-xs font-semibold truncate ${
                    isLight ? 'text-neutral-800' : 'text-neutral-200'
                  }`}>
                    Advanced Audio Settings
                  </span>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Extended 0% - 500% multi-bus calibration & JSON export
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateAdvancedAudio?.()}
                className={`py-1 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                <span>Configure</span>
                <ArrowRight className="h-3 w-3 opacity-75" />
              </button>
            </div>

            {/* Entry 2: Event and Triggerer */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Calibrate physical collision debounce timers, impulse thresholds, and console stream filters.')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className={`text-xs font-semibold truncate ${
                    isLight ? 'text-neutral-800' : 'text-neutral-200'
                  }`}>
                    Event and Triggerer
                  </span>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Audio debounce windows, impulse thresholds & console filters
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateEventAndTriggerer?.()}
                className={`py-1 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                <span>Configure</span>
                <ArrowRight className="h-3 w-3 opacity-75" />
              </button>
            </div>

            {/* Entry 3: Event Stream OB */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Event Stream OB: Real-time collision dynamics observer, impulse curves & audio threshold calibration (Shift+I).')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Activity className="h-4 w-4 text-sky-500 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold truncate ${
                      isLight ? 'text-neutral-800' : 'text-neutral-200'
                    }`}>
                      Event Stream OB
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-semibold bg-sky-500/15 border-sky-500/30 text-sky-400">
                      Shift+I
                    </span>
                  </div>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Physics collision observer, impulse curves & threshold visualizer
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(() => {
                  const existingWindow = windows.find((w) => w.id === EVENT_STREAM_OB_PRESET.id);
                  if (existingWindow) {
                    return (
                      <button
                        type="button"
                        onClick={() => floatingStore.closeWindow(EVENT_STREAM_OB_PRESET.id)}
                        title={`Close "${EVENT_STREAM_OB_PRESET.title}"`}
                        className="h-8 w-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 outline-none bg-red-500/15 hover:bg-red-500/25 border-red-400/40 text-red-500 shrink-0"
                      >
                        <X className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        const containerEl =
                          document.getElementById('game-ui-viewport-host') ||
                          document.body;
                        floatingStore.spawnWithFlight(
                          EVENT_STREAM_OB_PRESET,
                          e.currentTarget,
                          containerEl
                        );
                      }}
                      title={`Spawn "${EVENT_STREAM_OB_PRESET.title}" into Stack`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0 ${
                        isLight
                          ? 'bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800'
                          : 'bg-neutral-100 hover:bg-white text-neutral-950 font-bold border border-neutral-200'
                      }`}
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                      <span>Spawn</span>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Entry 4: Dual-Arena Determinism Harness */}
            <div
              className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
              onMouseEnter={() => setHoveredDesc('Dual-Arena Determinism Harness: Parallel RocketSim physics verification with live rollback desync checking (Shift+O).')}
              onMouseLeave={() => setHoveredDesc(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold truncate ${
                      isLight ? 'text-neutral-800' : 'text-neutral-200'
                    }`}>
                      Dual-Arena Determinism Harness
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-semibold bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
                      Shift+O
                    </span>
                  </div>
                  <span className={`text-[11px] mt-0.5 truncate ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    Bit-exact physics rollback verification & desync delta monitoring
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(() => {
                  const existingWindow = windows.find((w) => w.id === DETERMINISM_HARNESS_PRESET.id);
                  if (existingWindow) {
                    return (
                      <button
                        type="button"
                        onClick={() => floatingStore.closeWindow(DETERMINISM_HARNESS_PRESET.id)}
                        title={`Close "${DETERMINISM_HARNESS_PRESET.title}"`}
                        className="h-8 w-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 outline-none bg-red-500/15 hover:bg-red-500/25 border-red-400/40 text-red-500 shrink-0"
                      >
                        <X className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        const containerEl =
                          document.getElementById('game-ui-viewport-host') ||
                          document.body;
                        floatingStore.spawnWithFlight(
                          DETERMINISM_HARNESS_PRESET,
                          e.currentTarget,
                          containerEl
                        );
                      }}
                      title={`Spawn "${DETERMINISM_HARNESS_PRESET.title}" into Stack`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0 ${
                        isLight
                          ? 'bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800'
                          : 'bg-neutral-100 hover:bg-white text-neutral-950 font-bold border border-neutral-200'
                      }`}
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                      <span>Spawn</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </VStack>
        )}
      </PanelContent>

      {/* Dynamic Inspector Footer displaying English description of hovered item */}
      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className={`truncate transition-colors duration-150 ${
            hoveredDesc
              ? (isLight ? 'text-neutral-900' : 'text-neutral-100')
              : (isLight ? 'text-neutral-400' : 'text-neutral-500')
          }`}>
            {hoveredDesc || (
              currentTab === 'developer'
                ? 'Internal developer diagnostics and advanced multi-bus audio tuning.'
                : currentTab === 'advanced'
                ? 'Manage engine telemetry overlays, floating diagnostics windows, and developer tools.'
                : currentTab === 'graphics'
                ? 'Tune display render resolution, frame rate targets, and arena visual fidelity.'
                : currentTab === 'audio'
                ? 'Adjust master, engine, and boost sound levels or background audio behavior.'
                : 'Configure gameplay mechanics, training mode, and ball trajectory predictor.'
            )}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
