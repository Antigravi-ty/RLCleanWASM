import React, { useState } from 'react';
import { Bot, Cpu, Play, ArrowRight, Info } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { VStack } from '../layout/VStack';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { DEV_TEST_LAB_PRESET, EXPERIMENTAL_MULTI_BOTS_PRESET } from '../../stores/floatingPresets';
import { floatingStore } from '../../stores/floatingStore';
import { useAppStore } from '../../stores/appStore';
import { FloatingWindowCard } from './settings/components/FloatingWindowCard';

export interface Layer3DevSandboxesRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onNavigateExpMultiBots?: () => void;
}

/**
 * [Recipe] Layer 3 Developer Sandboxes & Isolation Labs
 * Provides dedicated actions to Enter Lab or Spawn Floating Controllers for:
 * 1. Subsystem Isolation & MVP Lab (Probes, Multi-World Ghost, State Replay, 90s Match, Goal Replay)
 * 2. Experimental Multiple Bots Mode (Up to 3v3 Native SafeTensors Nexto & Necto)
 */
export const Layer3DevSandboxesRecipe: React.FC<Layer3DevSandboxesRecipeProps> = ({
  isLight = false,
  onBack,
  onNavigateExpMultiBots,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer3-dev-sandboxes']}
      className="w-full"
    >
      <PanelHeader title="SANDBOXES & ISOLATION LABS" onBack={onBack} isLight={isLight} />

      <PanelContent scrollable className="p-6">
        <VStack gap="md" isLight={isLight}>
          {/* 1. Subsystem Isolation & MVP Lab: Enter Lab */}
          <div
            className={`flex items-center justify-between w-full p-3.5 rounded-xl border transition-colors select-none ${
              isLight
                ? 'bg-amber-500/10 border-amber-500/30 text-neutral-900'
                : 'bg-amber-500/10 border-amber-500/30 text-neutral-100'
            }`}
            onMouseEnter={() =>
              setHoveredDesc(
                'Enter Subsystem Isolation & MVP Lab: Verifies isolated basic components (Probes, Multi-World Ghost, State Replay, 90s Match, Goal Replay & 4-Model Kickoff Duel) before workflow integration.'
              )
            }
            onMouseLeave={() => setHoveredDesc(null)}
          >
            <div className="flex items-start gap-3 min-w-0 pr-2">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-amber-500/20 text-amber-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left leading-tight min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold truncate">Subsystem Isolation & MVP Lab</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-amber-500/20 border-amber-500/40 text-amber-400">
                    6 MVP Benches
                  </span>
                </div>
                <span className={`text-xs mt-0.5 line-clamp-2 ${isLight ? 'text-neutral-600' : 'text-neutral-300'}`}>
                  Isolated verification for Probes, Multi-World Ghost, State Replay, 90s Match, Goal Replay & 4-Model Kickoff Duel
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                floatingStore.setOpacity(70);
                useAppStore.getState().bridge.onStartDevTestLab?.();
              }}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                isLight
                  ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-neutral-950'
              }`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Enter Lab</span>
            </button>
          </div>

          {/* 1b. Subsystem Isolation & MVP Lab Floating Controller Spawner */}
          <FloatingWindowCard
            preset={DEV_TEST_LAB_PRESET}
            icon={<Cpu className="h-5 w-5" />}
            iconBgClass="bg-amber-500/10 text-amber-500"
            badge="70% Opacity"
            badgeClass="bg-amber-500/15 border-amber-500/30 text-amber-400"
            description="Spawn floating controller for Probes, Multi-World Ghost, State Replay & Match MVP"
            hoverTooltip="Subsystem Isolation & MVP Lab Controller: Closing this window from the top-right Stack automatically returns to Free Play."
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          {/* 2. Experimental Multiple Bots Mode: Configure Roster */}
          <div
            className={`flex items-center justify-between w-full p-3.5 rounded-xl border transition-colors select-none ${
              isLight
                ? 'bg-emerald-500/10 border-emerald-500/30 text-neutral-900'
                : 'bg-emerald-500/10 border-emerald-500/30 text-neutral-100'
            }`}
            onMouseEnter={() =>
              setHoveredDesc(
                'Configure Experimental Multiple Bots Mode: Set up Blue & Orange rosters up to 3v3 with Native SafeTensors Nexto/Necto bots, optional Human Player, and match duration.'
              )
            }
            onMouseLeave={() => setHoveredDesc(null)}
          >
            <div className="flex items-start gap-3 min-w-0 pr-2">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-emerald-500/20 text-emerald-400">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left leading-tight min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold truncate">Experimental Multiple Bots Mode</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-emerald-500/20 border-emerald-500/40 text-emerald-400">
                    Up to 3v3 · Native
                  </span>
                </div>
                <span className={`text-xs mt-0.5 line-clamp-2 ${isLight ? 'text-neutral-600' : 'text-neutral-300'}`}>
                  Native SafeTensors Nexto & Necto · Team Roster & Time Config · Keys 1–6 Bot POV
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigateExpMultiBots) {
                  onNavigateExpMultiBots();
                } else {
                  useAppStore.getState().navigate('exp-multi-bots-config');
                }
              }}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                isLight
                  ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-white'
                  : 'bg-emerald-400 hover:bg-emerald-300 border-emerald-300 text-neutral-950'
              }`}
            >
              <span>Roster</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 2b. Experimental Multiple Bots Mode Floating Window Spawner */}
          <FloatingWindowCard
            preset={EXPERIMENTAL_MULTI_BOTS_PRESET}
            icon={<Bot className="h-5 w-5" />}
            iconBgClass="bg-emerald-500/10 text-emerald-500"
            badge="Floating HUD"
            badgeClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            description="Spawn live floating controller for Multi-Bots POV switching & inference telemetry"
            hoverTooltip="Experimental Multiple Bots Floating Controller: Live in-arena roster & bot inference telemetry."
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />
        </VStack>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span
            className={`truncate transition-colors duration-150 ${
              hoveredDesc
                ? isLight
                  ? 'text-neutral-900'
                  : 'text-neutral-100'
                : isLight
                ? 'text-neutral-400'
                : 'text-neutral-500'
            }`}
          >
            {hoveredDesc ||
              'Enter isolated component testbeds or spawn floating sandbox controllers.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
