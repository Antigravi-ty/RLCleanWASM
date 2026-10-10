import React, { useState, useEffect, useRef } from 'react';
import { useUIStore, type ActiveMenuRoute } from './store';
import { MorphingShell } from '../navigation/MorphingShell';
import { FloatingStackIcon } from '../navigation/FloatingStackIcon';
import { FloatingWindowManager } from '../navigation/FloatingWindowManager';
import { floatingStore } from '../tokens/floatingStore';
import { WifiOff } from 'lucide-react';
import {
  Layer1MainMenuRecipe,
  Layer2PlayRecipe,
  Layer2GarageRecipe,
  Layer2SettingsRecipe,
  Layer3AudioDetailRecipe,
  Layer3BallTrajectoryRecipe,
  Layer3BotDifficultyRecipe,
  Layer3CameraRecipe,
  KeybindingRecipe,
  Layer4AdvancedControllerRecipe,
  Layer3TrainingRecipe,
  Layer4AdvancedAudioRecipe,
  Layer4EventAndTriggererRecipe,
  Layer3OnlineWarmupRecipe,
  Layer2RoomHostControlRecipe,
} from '../recipes';

export type LivePreviewAnimPhase =
  | 'expanded'
  | 'collapsing_content'
  | 'collapsing_resize'
  | 'collapsed'
  | 'expanding_content'
  | 'expanding_resize';

const ROUTE_WIDTHS: Record<ActiveMenuRoute, number> = {
  'main-menu': 420,
  'play': 680,
  'bot-difficulty': 480,
  'online-warmup': 460,
  'room-host-control': 460,
  'garage': 680,
  'settings': 680,
  'audio-eq': 480,
  'trajectory': 480,
  'camera': 480,
  'training': 480,
  'keybindings': 560,
  'advanced-controller': 560,
  'advanced-audio': 560,
  'event-and-triggerer': 580,
};

export interface MenuShellProps {
  inspectorSlot?: React.ReactNode;
}

export const MenuShell: React.FC<MenuShellProps> = ({ inspectorSlot }) => {
  const isOpen = useUIStore((s) => s.isOpen);
  const closeMenu = useUIStore((s) => s.closeMenu);
  const activeRoute = useUIStore((s) => s.activeRoute);
  const navigate = useUIStore((s) => s.navigate);
  const goBack = useUIStore((s) => s.goBack);
  const theme = useUIStore((s) => s.theme);
  const matchMode = useUIStore((s) => s.matchMode);
  const bridge = useUIStore((s) => s.bridge);
  const isLivePreviewCollapsed = useUIStore((s) => s.isLivePreviewCollapsed);
  const setLivePreviewCollapsed = useUIStore((s) => s.setLivePreviewCollapsed);
  const settingsTargetTab = useUIStore((s) => s.settingsTargetTab);
  const setSettingsTargetTab = useUIStore((s) => s.setSettingsTargetTab);
  const highlightSetting = useUIStore((s) => s.highlightSetting);
  const clearHighlightSetting = useUIStore((s) => s.clearHighlightSetting);
  const onlineSession = useUIStore((s) => s.onlineSession);
  const setMatchMode = useUIStore((s) => s.setMatchMode);

  const isLight = theme === 'light';
  const isLayer1 = activeRoute === 'main-menu';

  // Live Preview phased state machine (matches UIStorybook commit 108dde1)
  const [liveAnimPhase, setLiveAnimPhase] = useState<LivePreviewAnimPhase>(
    isLivePreviewCollapsed ? 'collapsed' : 'expanded'
  );

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // Sequenced transition: Content fade out -> Container resizes & docks to right edge -> Pill fades in
  const handleTriggerCollapse = () => {
    if (liveAnimPhase !== 'expanded') return;
    clearAllTimers();
    setLiveAnimPhase('collapsing_content');
    const t1 = setTimeout(() => {
      setLiveAnimPhase('collapsing_resize');
      // Inputs penetrate to Three.js canvas & simulation unpauses
      bridge.onOverlayChange?.(false);
      bridge.onResume?.();
      const t2 = setTimeout(() => {
        setLiveAnimPhase('collapsed');
        setLivePreviewCollapsed(true);
      }, 260);
      timersRef.current.push(t2);
    }, 100);
    timersRef.current.push(t1);
  };

  // Sequenced transition: Pill fades out -> Container resizes back to center -> Content fades in
  const handleTriggerExpand = () => {
    if (liveAnimPhase !== 'collapsed') return;
    clearAllTimers();
    setLiveAnimPhase('expanding_content');
    const t1 = setTimeout(() => {
      setLiveAnimPhase('expanding_resize');
      const t2 = setTimeout(() => {
        setLiveAnimPhase('expanded');
        setLivePreviewCollapsed(false);
        bridge.onOverlayChange?.(true);
      }, 260);
      timersRef.current.push(t2);
    }, 80);
    timersRef.current.push(t1);
  };

  const isLivePreviewRoute = activeRoute === 'trajectory' || activeRoute === 'camera';

  // Synchronize external isLivePreviewCollapsed changes (e.g. TAB shortcut)
  useEffect(() => {
    if (isLivePreviewRoute) {
      if (isLivePreviewCollapsed && liveAnimPhase === 'expanded') {
        handleTriggerCollapse();
      } else if (!isLivePreviewCollapsed && liveAnimPhase === 'collapsed') {
        handleTriggerExpand();
      }
    } else {
      if (liveAnimPhase !== 'expanded') {
        setLiveAnimPhase('expanded');
      }
    }
  }, [isLivePreviewCollapsed, activeRoute, isLivePreviewRoute]);

  // Dock state: whether container is occupying or animating to/from the right edge dock
  const isDockState =
    isLivePreviewRoute &&
    (liveAnimPhase === 'collapsed' ||
      liveAnimPhase === 'collapsing_resize' ||
      liveAnimPhase === 'expanding_content');

  const isContentVisible = !isDockState && liveAnimPhase === 'expanded';
  const isPillContentVisible = liveAnimPhase === 'collapsed';

  // Apple Sheet Shake state (isolated to transient outer wrapper with 360ms auto-reset)
  const [isShaking, setIsShaking] = useState(false);
  const shakeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerShake = () => {
    if (isShaking) return;
    setIsShaking(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => {
      setIsShaking(false);
    }, 360);
  };

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* 1. Floating Window Manager (Strict Layering: z-[5], above game arena, below backdrop mask) */}
      <FloatingWindowManager isLight={isLight} />

      {/* 2. Floating Stack Icon (Strict Layering: z-50, top-right persistent tray) */}
      <FloatingStackIcon
        isLight={isLight}
        absolute={false}
        isMenuOpen={isOpen && !isDockState}
        blockedTooltipText={
          activeRoute === 'settings'
            ? 'Please close settings window first'
            : 'Please close active menu first'
        }
        onBlockedClick={() => {
          triggerShake();
        }}
      />

      {/* 3. Main Decoupled Stage Shell (z-30) */}
      <MorphingShell
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeMenu();
        }}
        width={ROUTE_WIDTHS[activeRoute] || 480}
        height={activeRoute === 'main-menu' ? 510 : 540}
        currentKey={activeRoute}
        isLight={isLight}
        isLayer1={isLayer1}
        isDockState={isDockState}
        isContentVisible={isContentVisible}
        isPillContentVisible={isPillContentVisible}
        onExpandDock={handleTriggerExpand}
        isShaking={isShaking}
        onBack={goBack}
        inspectorSlot={inspectorSlot}
      >
        {/* Layer 1: Main Pause Menu */}
        {activeRoute === 'main-menu' && (
          <Layer1MainMenuRecipe
            isLight={isLight}
            matchMode={matchMode}
            onResume={closeMenu}
            onRestartMatch={bridge.onRestartMatch}
            onNavigatePlay={() => {
              navigate('play');
            }}
            onNavigateGarage={() => {
              navigate('garage');
            }}
            onNavigateSettings={(tab) => {
              if (tab) setSettingsTargetTab(tab);
              navigate('settings');
            }}
            onNavigateManageRoom={() => {
              navigate('room-host-control');
            }}
            onLeaveRoom={async () => {
              if (bridge.onLeaveOnlineServer) {
                await bridge.onLeaveOnlineServer();
              }
              setMatchMode('freeplay');
              closeMenu();
            }}
          />
        )}

        {/* Layer 2: Play Modes Selection */}
        {activeRoute === 'play' && (
          <Layer2PlayRecipe
            isLight={isLight}
            matchMode={matchMode}
            onBack={goBack}
            onSelectSinglePlayer={() => navigate('bot-difficulty')}
            onSelectOnlineWarmup={() => navigate('online-warmup')}
            onReturnToFreeplay={bridge.onReturnToFreeplay}
          />
        )}

        {/* Layer 3: Online Warmup Host/Join Setup */}
        {activeRoute === 'online-warmup' && (
          <Layer3OnlineWarmupRecipe
            isLight={isLight}
            onBack={goBack}
            onHostSuccess={() => navigate('room-host-control')}
            onJoinSuccess={() => navigate('room-host-control')}
          />
        )}

        {/* Layer 2: Online Room Host Control Panel */}
        {activeRoute === 'room-host-control' && (
          <Layer2RoomHostControlRecipe
            isLight={isLight}
            onBack={goBack}
            onLeaveRoom={() => closeMenu()}
          />
        )}

        {/* Layer 3: Bot Difficulty & Solo Duel Setup */}
        {activeRoute === 'bot-difficulty' && (
          <Layer3BotDifficultyRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}

        {/* Layer 2: Garage & Vehicle Loadout */}
        {activeRoute === 'garage' && (
          <Layer2GarageRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}

        {/* Layer 2: Settings (3 Tabs: Gameplay, Graphics, Advanced) */}
        {activeRoute === 'settings' && (
          <Layer2SettingsRecipe
            isLight={isLight}
            activeTab={settingsTargetTab}
            onTabChange={setSettingsTargetTab}
            highlightSetting={highlightSetting}
            onClearHighlight={clearHighlightSetting}
            onBack={goBack}
            onNavigateAudioDetail={() => navigate('audio-eq')}
            onNavigateTrajectoryDetail={() => {
              setLiveAnimPhase('expanded');
              navigate('trajectory');
            }}
            onNavigateCameraDetail={() => {
              setLiveAnimPhase('expanded');
              navigate('camera');
            }}
            onNavigateKeybindingsDetail={() => {
              navigate('keybindings');
            }}
            onNavigateTrainingDetail={() => {
              navigate('training');
            }}
            onNavigateAdvancedAudio={() => {
              navigate('advanced-audio');
            }}
            onNavigateEventAndTriggerer={() => {
              navigate('event-and-triggerer');
            }}
          />
        )}

        {/* Layer 3: Training Configuration */}
        {activeRoute === 'training' && (
          <Layer3TrainingRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}

        {/* Layer 3: Ball Trajectory Predictor & Live Preview Configurator */}
        {activeRoute === 'trajectory' && (
          <Layer3BallTrajectoryRecipe
            isLight={isLight}
            transparent={true}
            onBack={() => {
              setLiveAnimPhase('expanded');
              goBack();
            }}
            onCollapsePreview={handleTriggerCollapse}
          />
        )}

        {/* Layer 3: Camera Live Preview Configurator */}
        {activeRoute === 'camera' && (
          <Layer3CameraRecipe
            isLight={isLight}
            transparent={true}
            onBack={() => {
              setLiveAnimPhase('expanded');
              goBack();
            }}
            onCollapsePreview={handleTriggerCollapse}
          />
        )}

        {/* Layer 3: Audio Acoustics & 3-Band EQ */}
        {activeRoute === 'audio-eq' && (
          <Layer3AudioDetailRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}

        {/* Layer 3: Controls & Keybinding Remap */}
        {activeRoute === 'keybindings' && (
          <KeybindingRecipe
            isLight={isLight}
            onBack={goBack}
            onNavigateAdvanced={() => navigate('advanced-controller')}
          />
        )}

        {/* Layer 4: Advanced Controller Hardware & Analog Stick Roles */}
        {activeRoute === 'advanced-controller' && (
          <Layer4AdvancedControllerRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}

        {/* Layer 4: Advanced Audio Settings & Volume Matrix */}
        {activeRoute === 'advanced-audio' && (
          <Layer4AdvancedAudioRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}

        {/* Layer 4: Event & Triggerer (Audio Debounce & Collision Thresholds) */}
        {activeRoute === 'event-and-triggerer' && (
          <Layer4EventAndTriggererRecipe
            isLight={isLight}
            onBack={goBack}
          />
        )}
      </MorphingShell>

      {/* Top Warning Banner: WebSocket Signaling Disconnected */}
      {matchMode === 'online-warmup' && !onlineSession.signalingConnected && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-xl border font-mono text-xs shadow-xl bg-amber-950/80 border-amber-500/50 text-amber-300 backdrop-blur-md">
          <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Signaling Server Disconnected. Match continuing peer-to-peer.</span>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('car-soccer:reconnect-signaling'));
              }
            }}
            className="ml-2 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] cursor-pointer transition-colors active:scale-95"
          >
            Reconnect
          </button>
        </div>
      )}
    </>
  );
};
