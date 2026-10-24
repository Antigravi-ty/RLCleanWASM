import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Monitor,
  Info,
  Sliders,
  Terminal,
  Volume2,
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../../layout/Panel';
import { DEFAULT_PANEL_SIZING } from '../../tokens';
import { UnderlineTabs, type TabItem } from '../../primitives/UnderlineTabs';
import { Badge } from '../../primitives/Badge';
import {
  useAppStore,
  calculateSettingsSafeScale,
  type CameraConfig,
  type TrajectoryConfig,
  type GraphicsConfig,
  type TelemetryConfig,
} from '../../../stores/appStore';
import { useUIStore } from '../../../stores/uiStore';
import { GameplayTab } from './tabs/GameplayTab';
import { AudioTab } from './tabs/AudioTab';
import { GraphicsTab } from './tabs/GraphicsTab';
import { AdvancedTab } from './tabs/AdvancedTab';
import { DeveloperTab } from './tabs/DeveloperTab';

export interface Layer2SettingsRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onNavigateAudioDetail?: () => void;
  onNavigateTrainingDetail?: () => void;
  onNavigateAdvancedAudio?: () => void;
  onNavigateEventAndTriggerer?: () => void;
  onNavigateExpMultiBots?: () => void;
  onNavigateDevSandboxes?: () => void;
  onNavigateDevActiveTuners?: () => void;
  onNavigateDevCalibratedPresets?: () => void;
  onNavigateDevUnderDevelopment?: () => void;
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

export const Layer2SettingsRecipe: React.FC<Layer2SettingsRecipeProps> = ({
  isLight = false,
  onBack,
  onNavigateTrainingDetail,
  onNavigateAdvancedAudio,
  onNavigateEventAndTriggerer,
  onNavigateExpMultiBots,
  onNavigateDevSandboxes,
  onNavigateDevActiveTuners,
  onNavigateDevCalibratedPresets,
  onNavigateDevUnderDevelopment,
  onNavigateTrajectoryDetail,
  onNavigateCameraDetail,
  onNavigateKeybindingsDetail,
  initialTab = 'gameplay',
  activeTab: controlledTab,
  onTabChange,
  highlightSetting,
  onClearHighlight,
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

  const developerMode = useAppStore((s) => s.developerMode);
  const uiScale = useUIStore((s) => s.uiScale ?? 100);
  const safeAreaMargin = useUIStore((s) => s.safeAreaMargin ?? 0);

  // Hover description state for footer
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Measure window dimensions for viewport-aware display capping
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxSafeScale = calculateSettingsSafeScale(windowDimensions.width, windowDimensions.height, safeAreaMargin);
  const isCapped = uiScale > maxSafeScale;

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
      label: 'Display',
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
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer2-settings']} className="w-full">
      <PanelHeader
        title="SETTINGS"
        badge={
          isCapped && currentTab === 'graphics' ? (
            <Badge
              variant="amber"
              size="sm"
              className="font-mono text-[11px] font-semibold tracking-normal"
            >
              Capped: {maxSafeScale}%
            </Badge>
          ) : undefined
        }
        onBack={onBack}
        isLight={isLight}
      />

      <div className="px-6 pt-2 w-full shrink-0" data-ui-element="tabs-wrapper" data-panel-section="tabs">
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
        {currentTab === 'gameplay' && (
          <GameplayTab
            isLight={isLight}
            onNavigateTrainingDetail={onNavigateTrainingDetail}
            onNavigateKeybindingsDetail={onNavigateKeybindingsDetail}
            onNavigateTrajectoryDetail={onNavigateTrajectoryDetail}
            onNavigateCameraDetail={onNavigateCameraDetail}
            trajectory={propTrajectory}
            onUpdateTrajectory={propUpdateTrajectory}
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
          />
        )}

        {currentTab === 'audio' && (
          <AudioTab
            isLight={isLight}
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
          />
        )}

        {currentTab === 'graphics' && (
          <GraphicsTab
            isLight={isLight}
            graphics={propGraphics}
            onUpdateGraphics={propUpdateGraphics}
            theme={propTheme}
            onThemeChange={propThemeChange}
            highlightSetting={highlightSetting}
            onClearHighlight={onClearHighlight}
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
          />
        )}

        {currentTab === 'advanced' && (
          <AdvancedTab
            isLight={isLight}
            telemetry={propTelemetry}
            onUpdateTelemetry={propUpdateTelemetry}
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
          />
        )}

        {currentTab === 'developer' && developerMode && (
          <DeveloperTab
            isLight={isLight}
            onNavigateAdvancedAudio={onNavigateAdvancedAudio}
            onNavigateEventAndTriggerer={onNavigateEventAndTriggerer}
            onNavigateExpMultiBots={onNavigateExpMultiBots}
            onNavigateDevSandboxes={onNavigateDevSandboxes}
            onNavigateDevActiveTuners={onNavigateDevActiveTuners}
            onNavigateDevCalibratedPresets={onNavigateDevCalibratedPresets}
            onNavigateDevUnderDevelopment={onNavigateDevUnderDevelopment}
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
          />
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
