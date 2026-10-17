import React, { useState } from 'react';
import {
  Check,
  GraduationCap,
  Info,
  PencilRuler,
  Play,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { useUIStore } from '../core/store';
import { UI_RADIUS, DEFAULT_PANEL_SIZING } from '../tokens';
import {
  useKickoffTrainingStore,
  type KickoffGhostPlacement,
  type KickoffSubMode,
} from '../tokens/kickoffTrainingStore';
import { KICKOFF_TRAINING_PRESET } from '../tokens/floatingPresets';
import { floatingStore, useFloatingStore } from '../tokens/floatingStore';
import { FloatingWindowCard } from './settings/components/FloatingWindowCard';

export interface Layer3CustomTrainingRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onStartKickoffTraining?: () => void;
}

interface SubModeCardDef {
  id: KickoffSubMode;
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  tooltip: string;
}

const SUB_MODE_CARDS: SubModeCardDef[] = [
  {
    id: 'instant',
    title: 'Instant',
    badge: 'Default',
    icon: <Zap className="h-4 w-4" />,
    description: 'Settled spawn; player & ghost launch on first key press.',
    tooltip:
      'Instant (Default): Settles car suspension silently via stepSilent, ticks frame ID normally, and launches player + AI ghost on your first key press.',
  },
  {
    id: 'easy-learning',
    title: 'Easy Learning',
    badge: 'Step-by-Step',
    icon: <GraduationCap className="h-4 w-4" />,
    description: 'Pauses physics until your keys match the PPO model.',
    tooltip:
      'Easy Learning: Freezes physics simulation whenever your held keys diverge from the PPO model action until you match the highlighted keys.',
  },
  {
    id: 'realistic',
    title: 'Realistic',
    badge: 'Countdown',
    icon: <Timer className="h-4 w-4" />,
    description: 'Configurable 0.25s-step countdown before kickoff start.',
    tooltip:
      'Realistic Kickoff: Configurable countdown (0.25s / 30-frame steps up to 4.00s / 480 frames) with KICKOFF_WILL_START trigger on every reset.',
  },
];

/**
 * [Recipe] Layer 3 Custom Training Menu (Width: 500px)
 * Lets the player select Kickoff Training (powered by the optimal PPO kickoff model),
 * pre-select or inspect the sub-mode (defaults to 'instant' on entry) and Ghost Spawn Side
 * (defaults to 'same'), spawn the Kickoff Training Config floating window with flight
 * animation to the top-right stack, and launch directly into Kickoff Training mode.
 */
export const Layer3CustomTrainingRecipe: React.FC<Layer3CustomTrainingRecipeProps> = ({
  isLight = false,
  onBack,
  onStartKickoffTraining,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const bridge = useUIStore((s) => s.bridge);
  const subMode = useKickoffTrainingStore((s) => s.subMode);
  const setSubMode = useKickoffTrainingStore((s) => s.setSubMode);
  const ghostPlacement = useKickoffTrainingStore((s) => s.ghostPlacement);
  const setGhostPlacement = useKickoffTrainingStore((s) => s.setGhostPlacement);
  const ghostModeEnabled = useKickoffTrainingStore((s) => s.ghostModeEnabled);
  const setGhostModeEnabled = useKickoffTrainingStore((s) => s.setGhostModeEnabled);
  const { windows } = useFloatingStore();

  const handleLaunchKickoff = (e: React.MouseEvent<HTMLButtonElement>) => {
    const existing = windows.find((w) => w.id === KICKOFF_TRAINING_PRESET.id);
    if (!existing && typeof document !== 'undefined') {
      const containerEl =
        document.getElementById('game-ui-viewport-host') || document.body;
      floatingStore.spawnWithFlight(
        KICKOFF_TRAINING_PRESET,
        e.currentTarget,
        containerEl
      );
    }

    if (onStartKickoffTraining) {
      onStartKickoffTraining();
    } else if (bridge.onStartKickoffTraining) {
      bridge.onStartKickoffTraining();
    }
  };

  const launchButton = (
    <Button
      variant="primary"
      size="sm"
      onClick={handleLaunchKickoff}
      isLight={isLight}
      className="gap-1.5 px-3 py-1 text-xs font-semibold"
    >
      <Play className="h-3.5 w-3.5 fill-current" />
      <span>Start Kickoff Training</span>
    </Button>
  );

  return (
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer3-custom-training']} className="w-full">
      <PanelHeader
        title="CUSTOM TRAINING"
        onBack={onBack}
        isLight={isLight}
        rightElement={launchButton}
        actions={launchButton}
      />

      <PanelContent scrollable={true} className="p-5 flex flex-col gap-4">
        {/* 1. Featured Pack: Kickoff Training (PPO Optimal AI) */}
        <div
          onMouseEnter={() =>
            setHoveredDesc(
              'Kickoff Training: Practice all 5 kickoff spawns (keys 1-5) with dual-world PPO AI Ghost Car, Ghost Ball trajectory, and 9-key falling rhythm guide.'
            )
          }
          onMouseLeave={() => setHoveredDesc(null)}
          className={`flex flex-col gap-2.5 p-3.5 rounded-xl border select-none ${
            isLight
              ? 'bg-neutral-50/90 border-neutral-200 text-neutral-900'
              : 'bg-neutral-850/90 border-neutral-700/80 text-neutral-100'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-lg border ${
                  isLight
                    ? 'bg-white border-neutral-200 text-sky-600'
                    : 'bg-neutral-900 border-neutral-700 text-sky-400'
                }`}
              >
                <PencilRuler className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs tracking-tight">
                    Kickoff Training (PPO Optimal AI)
                  </span>
                  <Badge variant="default" size="sm" isLight={isLight} className="text-[9px]">
                    30Hz Policy
                  </Badge>
                </div>
                <span
                  className={`text-[11px] mt-0.5 ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  Hotkeys 1–5 (LF, LB, CB, RB, RF) • Dual-World Ghost • DDR Key Overlay
                </span>
              </div>
            </div>

            <Sparkles className="h-4 w-4 text-sky-400 shrink-0 mt-1" />
          </div>
        </div>

        {/* 2. Sub-Mode Selection (Defaults to Instant upon entry) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider px-0.5">
            <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>
              Kickoff Training Sub-Mode
            </span>
            <span className={`font-mono text-[10px] ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Default on Entry: Instant
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 w-full">
            {SUB_MODE_CARDS.map((card) => {
              const isSelected = subMode === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSubMode(card.id)}
                  onMouseEnter={() => setHoveredDesc(card.tooltip)}
                  onMouseLeave={() => setHoveredDesc(null)}
                  className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${UI_RADIUS.md} ${
                    isSelected
                      ? isLight
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                        : 'bg-white border-white text-neutral-950 shadow-md'
                      : isLight
                      ? 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-800'
                      : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isSelected
                          ? isLight
                            ? 'bg-neutral-800 border-neutral-700 text-white'
                            : 'bg-neutral-200 border-neutral-300 text-neutral-950'
                          : isLight
                          ? 'bg-neutral-100 border-neutral-200 text-neutral-700'
                          : 'bg-neutral-900 border-neutral-700 text-neutral-300'
                      }`}
                    >
                      {card.icon}
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-current" />
                    ) : (
                      <Badge
                        variant="neutral"
                        size="sm"
                        isLight={isLight}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {card.badge}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col mt-auto min-w-0">
                    <span className="font-bold text-xs truncate">{card.title}</span>
                    <span
                      className={`text-[10px] line-clamp-2 mt-0.5 leading-snug ${
                        isSelected
                          ? isLight
                            ? 'text-neutral-300'
                            : 'text-neutral-700'
                          : isLight
                          ? 'text-neutral-500'
                          : 'text-neutral-400'
                      }`}
                    >
                      {card.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.5 AI Spawn Position & Ghost Mode Toggle */}
        <div className="flex flex-col gap-2">
          <div
            onMouseEnter={() =>
              setHoveredDesc(
                ghostPlacement === 'same'
                  ? ghostModeEnabled
                    ? 'Same Position (Default): Ghost spawns at your exact kickoff position so you can directly compare movement and flip mechanics.'
                    : 'Same Side (Solid Car): AI spawns at your axis-symmetric partner position (1↔5, 2↔4; position 3 disabled).'
                  : ghostModeEnabled
                  ? 'Opposite Side (180° Mirror): Ghost spawns on the opponent side so you can clearly judge who reaches the ball faster.'
                  : 'Opposite Side (Solid 1v1): Physical PPO opponent on the opposite half — practice dunking/blocking or test slow kickoff tolerance.'
              )
            }
            onMouseLeave={() => setHoveredDesc(null)}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider px-0.5">
              <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>
                AI Spawn Position
              </span>
              <span className={`font-mono text-[10px] ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {ghostPlacement === 'same' ? 'Compare Mechanics (Default)' : 'Compare Speed to Ball'}
              </span>
            </div>
            <SegmentedSwitch<KickoffGhostPlacement>
              options={[
                { label: 'Same Position', value: 'same' },
                { label: 'Opposite Side', value: 'opposite' },
              ]}
              value={ghostPlacement}
              onChange={setGhostPlacement}
              isLight={isLight}
              size="sm"
              fullWidth
            />
          </div>

          <div
            onMouseEnter={() =>
              setHoveredDesc(
                'Ghost Mode ON: Intangible holographic ghost car in an isolated world. Ghost Mode OFF: Real physical PPO car in the arena (supports 1v1 dunking on Opposite Side, or 1↔5 / 2↔4 partner on Same Side).'
              )
            }
            onMouseLeave={() => setHoveredDesc(null)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
              isLight
                ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
                : 'bg-neutral-850/80 border-neutral-700/80 text-neutral-200'
            }`}
          >
            <div className="flex flex-col min-w-0 pr-3">
              <span className="font-bold text-xs">
                {ghostModeEnabled ? 'Ghost Mode (No Collision)' : 'Solid Car Mode (Physical Collision)'}
              </span>
              <span className={`text-[10px] truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {ghostModeEnabled
                  ? 'Intangible holographic Ghost Car & Ghost Ball'
                  : ghostPlacement === 'opposite'
                  ? 'Physical 1v1 kickoff (block/dunk or test slow kickoff)'
                  : 'Physical same-side partner (1↔5, 2↔4; pos 3 disabled)'}
              </span>
            </div>
            <ToggleSwitch
              checked={ghostModeEnabled}
              onCheckedChange={setGhostModeEnabled}
              isLight={isLight}
              variant="neutral"
            />
          </div>
        </div>

        {/* 3. Floating Window Spawner (flies to top-right stack icon) */}
        <FloatingWindowCard
          preset={KICKOFF_TRAINING_PRESET}
          icon={<PencilRuler className="h-5 w-5" />}
          iconBgClass={isLight ? 'bg-sky-500/10 text-sky-600' : 'bg-sky-500/10 text-sky-500'}
          badge="In-Game HUD"
          badgeClass={
            isLight
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-600'
              : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
          }
          description="Tune sub-modes, realistic wait (0.25s steps), N/120 speed & ghost visuals"
          hoverTooltip="Spawn the Kickoff Training Config floating window into the top-right stack tray (also auto-spawns when entering Kickoff Training)."
          onHover={(desc) => setHoveredDesc(desc)}
          onLeave={() => setHoveredDesc(null)}
          isLight={isLight}
        />
      </PanelContent>

      {/* Dynamic Inspector Footer */}
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
            {hoveredDesc || 'Hover over any item to view more details.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
