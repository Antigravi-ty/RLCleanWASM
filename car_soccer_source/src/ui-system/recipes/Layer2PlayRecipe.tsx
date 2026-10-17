import React, { useState } from 'react';
import { Bot, Hammer, Info, PencilRuler, Play, RotateCcw, Users } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Badge } from '../primitives/Badge';
import { UI_RADIUS, DEFAULT_PANEL_SIZING } from '../tokens';

export interface Layer2PlayRecipeProps {
  isLight?: boolean;
  matchMode?: 'freeplay' | 'match' | 'online-warmup' | 'kickoff-training' | 'dev-test-lab';
  onBack?: () => void;
  onSelectSinglePlayer?: () => void;
  onSelectMultiplayerMatch?: () => void;
  onSelectCustomMatch?: () => void;
  onReturnToFreeplay?: () => void;
  onSelectCustomTraining?: () => void;
  onSelectOnlineWarmup?: () => void;
}

export interface PlayCardDef {
  id: string;
  title: string;
  subtitle: string;
  tag?: string;
  isAvailable: boolean;
  description: string;
  customIcon?: React.ReactNode;
  action?: () => void;
}

/**
 * [Recipe] Layer 2 Play Menu (Width: 680px)
 * Clean 2x3 grid presenting 6 mode cards:
 * - Top-left: Single Player with Bots (active, tag "currently 1v1")
 * - Top-center: Multiplayer Match (1v1 / 2v2 / 3v3 Authoritative Match Admin)
 * - Top-right: Custom Match (Private arena lobbies with Match Admin & custom rules)
 * - Row 2 Left: Free Play Training (CURRENT badge in freeplay / RETURN action in active match)
 * - Row 2 Center: Custom Training (Kickoff Training with PPO Optimal AI)
 * - Row 2 Right: Online Warmup (Users icon)
 */
export const Layer2PlayRecipe: React.FC<Layer2PlayRecipeProps> = ({
  isLight = false,
  matchMode = 'freeplay',
  onBack,
  onSelectSinglePlayer,
  onSelectMultiplayerMatch,
  onSelectCustomMatch,
  onReturnToFreeplay,
  onSelectCustomTraining,
  onSelectOnlineWarmup,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const isInMatch = matchMode === 'match';
  const isInKickoff = matchMode === 'kickoff-training';
  const isInDevLab = matchMode === 'dev-test-lab';
  const canReturnToFreeplay = isInMatch || isInKickoff || isInDevLab;

  const cards: PlayCardDef[] = [
    {
      id: 'single-player-bot',
      title: 'Single Player with Bots',
      subtitle: isInMatch
        ? 'Active 1v1 match against neural network bot'
        : '1v1 match duel against local RLBot policies',
      tag: isInMatch ? '1v1 Match' : 'currently 1v1',
      isAvailable: true,
      description: isInMatch
        ? 'Configure bot difficulty or restart 1v1 match against neural network bots.'
        : 'Jump into a solo duel match against AI neural network bots with customizable difficulty.',
      action: onSelectSinglePlayer,
    },
    {
      id: 'multiplayer-matchmaking',
      title: 'Multiplayer Match',
      subtitle: '1v1 / 2v2 / 3v3 online match with lobby warmup & admin',
      tag: '1v1 · 2v2 · 3v3',
      isAvailable: Boolean(onSelectMultiplayerMatch || onSelectOnlineWarmup),
      description: 'Host or join a structured 1v1, 2v2, or 3v3 online match with Lobby Ghost warmup, countdown, goal replay, and podium.',
      customIcon: <Users className="h-5 w-5" />,
      action: onSelectMultiplayerMatch || onSelectOnlineWarmup,
    },
    {
      id: 'custom-private-match',
      title: 'Custom Match',
      subtitle: 'Private arena lobbies with Match Admin & custom rules',
      tag: 'Lobby Admin',
      isAvailable: Boolean(onSelectCustomMatch || onSelectMultiplayerMatch || onSelectOnlineWarmup),
      description: 'Host or join a custom multiplayer match lobby with Match Admin controls, custom team sizes, and practice modes.',
      customIcon: <Users className="h-5 w-5" />,
      action: onSelectCustomMatch || onSelectMultiplayerMatch || onSelectOnlineWarmup,
    },
    {
      id: 'training-freeplay',
      title: 'Free Play Training',
      subtitle: canReturnToFreeplay
        ? 'Return to free play sandbox practice'
        : 'Unlimited boost physics sandbox & arena practice',
      tag: canReturnToFreeplay ? 'RETURN' : undefined,
      isAvailable: true,
      description: canReturnToFreeplay
        ? 'Leave active mode and return to Free Play Training mode.'
        : 'Reset kickoff and practice ball physics and mechanics in Free Play.',
      customIcon: canReturnToFreeplay ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" />,
      action: onReturnToFreeplay,
    },
    {
      id: 'training-drills',
      title: 'Custom Training',
      subtitle: 'Kickoff Training with PPO Optimal AI ghost & rhythm overlay',
      tag: isInKickoff ? 'ACTIVE' : 'Kickoff AI',
      isAvailable: Boolean(onSelectCustomTraining),
      description: 'Practice all 5 kickoff spawns against the optimal PPO AI ghost car with falling key rhythm guide.',
      customIcon: <PencilRuler className="h-5 w-5" />,
      action: onSelectCustomTraining,
    },
    {
      id: 'online-warmup',
      title: 'Online Warmup',
      subtitle: 'Shared online warmup arena session via WebRTC',
      tag: 'WebRTC',
      isAvailable: Boolean(onSelectOnlineWarmup),
      description: 'Host or join peer-to-peer multiplayer warmup session via WebRTC signaling.',
      customIcon: <Users className="h-5 w-5" />,
      action: onSelectOnlineWarmup,
    },
  ];

  return (
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer2-play']} className="w-full">
      <PanelHeader
        title="PLAY"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 w-full select-none">
          {cards.map((card) => {
            const isSelectable = card.isAvailable;
            const isCurrentBadge = card.tag === 'CURRENT';

            return (
              <button
                key={card.id}
                type="button"
                disabled={!isSelectable}
                onClick={card.action}
                onMouseEnter={() => setHoveredDesc(card.description)}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`group flex flex-col justify-between p-4 min-h-[160px] text-left transition-all duration-150 border outline-none ${UI_RADIUS.lg} ${
                  isSelectable
                    ? isLight
                      ? 'bg-neutral-50/90 hover:bg-white hover:border-neutral-400 hover:shadow-xs border-neutral-200/90 text-neutral-900 cursor-pointer active:scale-[0.98]'
                      : 'bg-neutral-850/90 hover:bg-neutral-800 hover:border-neutral-500 hover:shadow-md border-neutral-700/80 text-neutral-100 cursor-pointer active:scale-[0.98]'
                    : isCurrentBadge
                    ? isLight
                      ? 'bg-neutral-100/70 border-neutral-300/80 cursor-default text-neutral-800 ring-1 ring-black/5'
                      : 'bg-neutral-850/50 border-neutral-700/80 cursor-default text-neutral-200 ring-1 ring-white/10'
                    : isLight
                    ? 'bg-neutral-100/50 border-neutral-200/60 opacity-60 cursor-not-allowed text-neutral-500'
                    : 'bg-neutral-900/40 border-neutral-800/60 opacity-50 cursor-not-allowed text-neutral-400'
                }`}
              >
                {/* Card Top: Icon & Optional Tag */}
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`p-2.5 rounded-lg border transition-colors ${
                      isSelectable
                        ? isLight
                          ? 'bg-white border-neutral-200 group-hover:border-neutral-400 text-neutral-900'
                          : 'bg-neutral-900 border-neutral-700 group-hover:border-neutral-500 text-white'
                        : isCurrentBadge
                        ? isLight
                          ? 'bg-white/80 border-neutral-300 text-neutral-800'
                          : 'bg-neutral-800/80 border-neutral-600 text-neutral-200'
                        : isLight
                        ? 'bg-neutral-200/50 border-neutral-300/50 text-neutral-400'
                        : 'bg-neutral-800/40 border-neutral-700/50 text-neutral-500'
                    }`}
                  >
                    {card.customIcon ? (
                      card.customIcon
                    ) : card.id === 'single-player-bot' ? (
                      <Bot className="h-5 w-5" />
                    ) : (
                      <Hammer className="h-5 w-5" />
                    )}
                  </div>

                  {card.tag && (
                    <Badge
                      variant={isCurrentBadge ? 'default' : 'neutral'}
                      size="sm"
                      isLight={isLight}
                      className="text-[10px]"
                    >
                      {card.tag}
                    </Badge>
                  )}
                </div>

                {/* Card Bottom: Title & Subtitle */}
                <div className="flex flex-col mt-auto">
                  <span
                    className={`font-bold text-xs tracking-tight mb-1 truncate ${
                      isSelectable || isCurrentBadge
                        ? isLight
                          ? 'text-neutral-900'
                          : 'text-white'
                        : isLight
                        ? 'text-neutral-500'
                        : 'text-neutral-400'
                    }`}
                  >
                    {card.title}
                  </span>
                  <span
                    className={`text-[11px] line-clamp-2 leading-relaxed ${
                      isLight ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    {card.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </PanelContent>

      {/* Unified Dynamic Inspector Footer */}
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
