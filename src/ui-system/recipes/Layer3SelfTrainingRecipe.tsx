import React, { useState } from 'react';
import {
  Film,
  Info,
  PencilRuler,
  Play,
  RotateCcw,
  ChevronRight,
  Target,
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Badge } from '../primitives/Badge';
import { DEFAULT_PANEL_SIZING, UI_RADIUS } from '../tokens';
import { floatingStore } from '../../stores/floatingStore';
import { REPLAY_VIEWER_PRESET } from '../../stores/floatingPresets';

export interface Layer3SelfTrainingRecipeProps {
  isLight?: boolean;
  matchMode?: 'freeplay' | 'match' | 'online-warmup' | 'kickoff-training' | 'dev-test-lab' | 'exp-multi-bots' | 'static-training-pack';
  onBack?: () => void;
  onSelectFreeplay?: () => void;
  onSelectKickoffTraining?: () => void;
  onSelectStaticTrainingPack?: () => void;
  onSelectReplayViewer?: () => void;
}

/**
 * [Recipe] Layer 3 Self-Training Menu (Width: 500px)
 * Provides solo practice & analysis options:
 * 1. Free Play — Unlimited boost physics sandbox & arena practice
 * 2. Static Training Pack — Browse, Play, Create & Edit multi-shot Static Training Packs (.RCSPack)
 * 3. Kickoff Training — Practice all 5 kickoff spawns with v1 PPO Optimal AI ghost & falling rhythm guide
 * 4. Replay Viewer — Upload .rcreplay.gz / .json files with Play, Pause, Rewind/Forward scrubbing & Resume From Here
 */
export const Layer3SelfTrainingRecipe: React.FC<Layer3SelfTrainingRecipeProps> = ({
  isLight = false,
  matchMode = 'freeplay',
  onBack,
  onSelectFreeplay,
  onSelectKickoffTraining,
  onSelectStaticTrainingPack,
  onSelectReplayViewer,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const canReturnToFreeplay = matchMode !== 'freeplay';
  const isInKickoff = matchMode === 'kickoff-training';
  const isInStaticPack = matchMode === 'static-training-pack';

  const handleOpenReplayViewer = (e: React.MouseEvent<HTMLButtonElement>) => {
    const existing = floatingStore
      .getSnapshot()
      .windows.find((w) => w.id === REPLAY_VIEWER_PRESET.id);
    if (!existing) {
      if (typeof document !== 'undefined') {
        const containerEl =
          document.getElementById('game-ui-viewport-host') || document.body;
        floatingStore.spawnWithFlight(
          REPLAY_VIEWER_PRESET,
          e.currentTarget,
          containerEl
        );
      } else {
        floatingStore.spawnWindow({
          ...REPLAY_VIEWER_PRESET,
          startMinimized: false,
        });
      }
    } else {
      floatingStore.restoreWindow(REPLAY_VIEWER_PRESET.id);
      floatingStore.bringToFront(REPLAY_VIEWER_PRESET.id);
    }

    onSelectReplayViewer?.();
  };

  const items = [
    {
      id: 'self-training-freeplay',
      title: 'Free Play',
      subtitle: canReturnToFreeplay
        ? 'Leave current mode and return to Free Play sandbox practice'
        : 'Unlimited boost physics sandbox & arena mechanics practice',
      badge: canReturnToFreeplay ? 'RETURN' : 'ACTIVE',
      icon: canReturnToFreeplay ? (
        <RotateCcw className="h-5 w-5" />
      ) : (
        <Play className="h-5 w-5" />
      ),
      description:
        'Free Play: Practice ball control, aerial mechanics, and kickoff resets in an open arena sandbox.',
      onClick: () => onSelectFreeplay?.(),
    },
    {
      id: 'self-training-static-pack',
      title: 'Static Training Pack',
      subtitle: 'Browse, play, create, and edit custom multi-shot training packs (.RCSPack)',
      badge: isInStaticPack ? 'ACTIVE' : 'RCSPack',
      icon: <Target className="h-5 w-5" />,
      description:
        'Static Training Pack: Practice custom shot playlists, edit 3D car & ball trajectories, or import/export compressed .RCSPack archives.',
      onClick: () => onSelectStaticTrainingPack?.(),
    },
    {
      id: 'self-training-kickoff',
      title: 'Kickoff Training',
      subtitle: 'Practice all 5 kickoff spawns with PPO v1 Optimal AI ghost & rhythm guide',
      badge: isInKickoff ? 'ACTIVE' : 'v1 Policy',
      icon: <PencilRuler className="h-5 w-5" />,
      description:
        'Kickoff Training: Compare your kickoff speed and flip mechanics against the v1 PPO AI ghost car and 9-key falling rhythm guide.',
      onClick: () => onSelectKickoffTraining?.(),
    },
    {
      id: 'self-training-replay-viewer',
      title: 'Replay Viewer',
      subtitle: 'Upload .rcreplay.gz / .json files to Play, Pause, Scrub & Resume From Here',
      badge: 'State Replay',
      icon: <Film className="h-5 w-5" />,
      description:
        'Replay Viewer: Open the standalone RC Replay floating window to upload compressed match replays, play/pause, scrub timeline frames, or resume live control.',
      onClick: handleOpenReplayViewer,
    },
  ];

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer3-self-training']}
      className="w-full"
    >
      <PanelHeader title="SELF-TRAINING" onBack={onBack} isLight={isLight} />

      <PanelContent scrollable={true} className="p-5 flex flex-col gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            onMouseEnter={() => setHoveredDesc(item.description)}
            onMouseLeave={() => setHoveredDesc(null)}
            className={`group flex items-center justify-between gap-3.5 p-4 text-left transition-all duration-150 border outline-none cursor-pointer active:scale-[0.99] ${UI_RADIUS.lg} ${
              isLight
                ? 'bg-neutral-50/90 hover:bg-white hover:border-neutral-400 hover:shadow-xs border-neutral-200/90 text-neutral-900'
                : 'bg-neutral-850/90 hover:bg-neutral-800 hover:border-neutral-500 hover:shadow-md border-neutral-700/80 text-neutral-100'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`p-2.5 rounded-lg border shrink-0 transition-colors ${
                  isLight
                    ? 'bg-white border-neutral-200 group-hover:border-neutral-400 text-neutral-900'
                    : 'bg-neutral-900 border-neutral-700 group-hover:border-neutral-500 text-white'
                }`}
              >
                {item.icon}
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs tracking-tight truncate">
                    {item.title}
                  </span>
                  {item.badge && (
                    <Badge
                      variant={item.badge === 'ACTIVE' ? 'default' : 'neutral'}
                      size="sm"
                      isLight={isLight}
                      className="text-[9px]"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <span
                  className={`text-[11px] mt-0.5 line-clamp-1 ${
                    isLight ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  {item.subtitle}
                </span>
              </div>
            </div>

            <ChevronRight
              className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                isLight ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            />
          </button>
        ))}
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
            {hoveredDesc || 'Select Free Play, Kickoff Training, or Replay Viewer.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
