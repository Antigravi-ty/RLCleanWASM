import React from 'react';
import { Play, Gamepad2, Wrench, Settings, ArrowUpRight, RotateCcw, Router, LogOut } from 'lucide-react';
import { PanelContainer, PanelContent } from '../layout/Panel';
import { MenuContainer, MenuItem, MenuDivider } from '../navigation';
import { Badge } from '../primitives/Badge';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { UI_RADIUS } from '../tokens';
import { useUIStore } from '../core/store';

export interface Layer1MainMenuRecipeProps {
  isLight?: boolean;
  matchMode?: 'freeplay' | 'match' | 'online-warmup';
  onResume?: () => void;
  onRestartMatch?: () => void;
  onNavigatePlay?: () => void;
  onNavigateGarage?: () => void;
  onNavigateSettings?: (targetTab?: string) => void;
  onNavigateManageRoom?: () => void;
  onLeaveRoom?: () => void;
  /** Background render pause indicator status */
  backgroundRenderPaused?: boolean;
  className?: string;
}

/**
 * [Recipe] Layer 1 Main Menu (Root / Width: 420px)
 * Designed for instant in-game ESC menu overlay.
 */
export const Layer1MainMenuRecipe: React.FC<Layer1MainMenuRecipeProps> = ({
  isLight = false,
  matchMode = 'freeplay',
  onResume,
  onRestartMatch,
  onNavigatePlay,
  onNavigateGarage,
  onNavigateSettings,
  onNavigateManageRoom,
  onLeaveRoom,
  backgroundRenderPaused = true,
  className = '',
}) => {
  const isInMatch = matchMode === 'match';
  const isOnlineWarmup = matchMode === 'online-warmup';

  return (
    <PanelContainer
      isLight={isLight}
      className={`w-full max-w-[420px] ${
        isLight
          ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_0_24px_rgba(0,0,0,0.16),0_0_48px_rgba(0,0,0,0.10)]'
          : 'shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85),0_0_35px_rgba(255,255,255,0.08)]'
      } ${className}`}
    >
      {/* 1. TOP HEADER: Large Centered "MENU", "PAUSE", or "ONLINE WARMUP" */}
      <div
        data-ui-element="panel-header"
        data-panel-section="header"
        className={`px-6 pt-5 pb-4 border-b select-none text-center transition-colors ${
          isLight
            ? 'border-neutral-200/90 bg-neutral-50/70 text-neutral-900'
            : 'border-neutral-800/80 bg-neutral-900/60 text-white'
        }`}
      >
        <h1 className="text-xl font-black tracking-widest uppercase">
          {isOnlineWarmup ? 'ONLINE WARMUP' : isInMatch ? 'PAUSE' : 'MENU'}
        </h1>
      </div>

      {/* 2. CENTER CONTENT: Resume, Manage Room / Play, Garage, Settings */}
      <PanelContent scrollable={false} className="px-6 py-5">
        <MenuContainer ariaLabel="Main Game Menu">
          {/* Resume */}
          <MenuItem
            icon={<Play className="h-5 w-5" />}
            title="Resume Match"
            subtitle="Return to active arena gameplay"
            shortcut="ESC"
            variant="primary"
            autoFocus
            onClick={onResume}
            isLight={isLight}
          />

          <MenuDivider isLight={isLight} />

          {/* If in Online Warmup: Configure Room (Host) or Inspect Room Info (Client) */}
          {isOnlineWarmup ? (
            <MenuItem
              icon={<Router className="h-5 w-5 text-sky-400" />}
              title={useUIStore.getState().onlineSession.isHosting ? "Configure Room" : "Inspect Room Info"}
              subtitle={
                useUIStore.getState().onlineSession.isHosting
                  ? "Room configuration panel & connected players"
                  : "Inspect room details & connection status"
              }
              hasArrow
              onClick={onNavigateManageRoom}
              isLight={isLight}
            />
          ) : (
            <MenuItem
              icon={<Gamepad2 className="h-5 w-5" />}
              title="Play"
              subtitle="Single player bot & multiplayer matches"
              hasArrow
              onClick={onNavigatePlay}
              isLight={isLight}
            />
          )}

          {/* Garage */}
          <MenuItem
            icon={<Wrench className="h-5 w-5" />}
            title="Garage"
            subtitle="Vehicle models, colours & player anthem"
            hasArrow
            onClick={onNavigateGarage}
            isLight={isLight}
          />

          {/* Settings */}
          <MenuItem
            icon={<Settings className="h-5 w-5" />}
            title="Settings"
            subtitle="Gameplay, controls, video & sound"
            hasArrow
            onClick={() => onNavigateSettings?.()}
            isLight={isLight}
          />

          {/* Match Pause Mode: Restart Match at bottom */}
          {isInMatch && (
            <>
              <MenuDivider isLight={isLight} />
              <MenuItem
                icon={<RotateCcw className="h-5 w-5" />}
                title="Restart Match"
                subtitle="Reset score, clock and restart kickoff"
                variant="secondary"
                onClick={onRestartMatch}
                isLight={isLight}
              />
            </>
          )}

          {/* Online Warmup Mode: Leave Room at bottom */}
          {isOnlineWarmup && (
            <>
              <MenuDivider isLight={isLight} />
              <MenuItem
                icon={<LogOut className="h-5 w-5 text-rose-400" />}
                title="Leave Room"
                subtitle="Disconnect session and return to Freeplay"
                variant="secondary"
                onClick={onLeaveRoom}
                isLight={isLight}
              />
            </>
          )}
        </MenuContainer>
      </PanelContent>

      {/* 3. BOTTOM FOOTER: Render Pause Indicator + Settings Shortcut Link */}
      <div
        data-ui-element="panel-footer"
        data-panel-section="footer"
        className={`px-6 py-4 border-t text-xs select-none flex items-center justify-between transition-colors ${
          isLight
            ? 'border-neutral-200/90 text-neutral-600 bg-neutral-50/90'
            : 'border-neutral-800/80 text-neutral-400 bg-neutral-900/90'
        }`}
      >
        {/* Left: Background render pause indicator synced with menu power save status */}
        {(() => {
          const powerSave = useUIStore.getState().graphics?.menuPowerSave ?? (backgroundRenderPaused ? 'freeze' : '30');
          let dotColor = 'bg-emerald-500';
          let label = 'Background: 30 FPS';
          if (powerSave === 'freeze') {
            dotColor = 'bg-amber-500 animate-pulse';
            label = 'Background: Freeze';
          } else if (powerSave === '15') {
            dotColor = 'bg-amber-400';
            label = 'Background: 15 FPS';
          } else if (powerSave === '30') {
            dotColor = 'bg-emerald-400';
            label = 'Background: 30 FPS';
          } else if (powerSave === 'match') {
            dotColor = 'bg-emerald-500';
            label = 'Background: Match';
          }

          return (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="font-mono text-[11px] truncate">{label}</span>
            </div>
          );
        })()}

        {/* Right: Click to change settings navigation shortcut with highlight dispatch */}
        <button
          type="button"
          onClick={() => {
            useUIStore.getState().setHighlightSetting('menu-power-save');
            onNavigateSettings?.('graphics');
          }}
          className={`flex items-center gap-1 font-mono text-[11px] shrink-0 font-medium transition-colors cursor-pointer outline-none ${
            isLight
              ? 'text-neutral-500 hover:text-amber-600'
              : 'text-neutral-400 hover:text-amber-400'
          }`}
          title="Jump directly to Settings -> Graphics (Background Render Power Save)"
        >
          <span>click to change</span>
          <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
        </button>
      </div>
    </PanelContainer>
  );
};
