import React, { useState } from 'react';
import {
  Bot,
  GraphStar,
  Send,
  PencilRuler,
  BookOpenCheck,
  HouseCog,
  Hammer,
  Info,
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Badge } from '../primitives/Badge';
import { UI_RADIUS, DEFAULT_PANEL_SIZING } from '../tokens';

export interface Layer2PlayRecipeProps {
  isLight?: boolean;
  matchMode?: 'freeplay' | 'match' | 'online-warmup' | 'kickoff-training' | 'dev-test-lab' | 'exp-multi-bots' | 'static-training-pack';
  onBack?: () => void;
  onSelectExhibition?: () => void;
  onSelectHostMatch?: () => void;
  onSelectJoinRoom?: () => void;
  onSelectSelfTraining?: () => void;
  onSelectHostTraining?: () => void;
  onSelectAdvanced?: () => void;
  // Legacy prop aliases for compatibility
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
 * Row 1:
 *  - Exhibition (Bot icon)
 *  - Host Match (GraphStar icon)
 *  - Join Room (Send icon)
 * Row 2:
 *  - Self-Training (PencilRuler icon -> Free Play, Kickoff Training, Replay Viewer)
 *  - Host-Training (BookOpenCheck icon -> disabled)
 *  - Advanced (HouseCog icon -> disabled)
 */
export const Layer2PlayRecipe: React.FC<Layer2PlayRecipeProps> = ({
  isLight = false,
  matchMode = 'freeplay',
  onBack,
  onSelectExhibition,
  onSelectHostMatch,
  onSelectJoinRoom,
  onSelectSelfTraining,
  onSelectSinglePlayer,
  onSelectMultiplayerMatch,
  onSelectOnlineWarmup,
  onSelectCustomTraining,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const isInMatch = matchMode === 'match';
  const isInKickoff = matchMode === 'kickoff-training';
  const isInExpBots = matchMode === 'exp-multi-bots';

  const handleExhibition = onSelectExhibition || onSelectSinglePlayer;
  const handleHostMatch = onSelectHostMatch || onSelectMultiplayerMatch || onSelectOnlineWarmup;
  const handleJoinRoom = onSelectJoinRoom || onSelectOnlineWarmup || onSelectMultiplayerMatch;
  const handleSelfTraining = onSelectSelfTraining || onSelectCustomTraining;

  const cards: PlayCardDef[] = [
    {
      id: 'exhibition',
      title: 'Exhibition',
      subtitle: '1v1 / 2v2 / 3v3 match against Native SafeTensors RLBot policies',
      tag: isInMatch || isInExpBots ? 'ACTIVE' : '1v1 · 2v2 · 3v3',
      isAvailable: Boolean(handleExhibition),
      description:
        'Play a local Exhibition match (Solo 1v1, Double 2v2, or Standard 3v3) against Necto or Nexto policies with Goal Replay.',
      customIcon: <Bot className="h-5 w-5" />,
      action: handleExhibition,
    },
    {
      id: 'host-match',
      title: 'Host Match',
      subtitle: 'Create an authoritative online match lobby with WebRTC signaling',
      tag: 'Host Lobby',
      isAvailable: Boolean(handleHostMatch),
      description:
        'Host a 1v1, 2v2, or 3v3 online match room with Lobby Ghost warmup, countdown, goal replay, and podium.',
      customIcon: <GraphStar className="h-5 w-5" />,
      action: handleHostMatch,
    },
    {
      id: 'join-room',
      title: 'Join Room',
      subtitle: 'Connect to an existing online match or training room code',
      tag: 'WebRTC',
      isAvailable: Boolean(handleJoinRoom),
      description:
        'Enter a room code to join a peer-to-peer online match or warmup session via WebRTC.',
      customIcon: <Send className="h-5 w-5" />,
      action: handleJoinRoom,
    },
    {
      id: 'self-training',
      title: 'Self-Training',
      subtitle: 'Free Play sandbox, Kickoff Training (v1 AI) & RC Replay Viewer',
      tag: isInKickoff ? 'ACTIVE' : 'Solo Hub',
      isAvailable: Boolean(handleSelfTraining),
      description:
        'Enter Self-Training to choose between Free Play, Kickoff Training (v1 PPO AI), and the standalone RC Replay Viewer.',
      customIcon: <PencilRuler className="h-5 w-5" />,
      action: handleSelfTraining,
    },
    {
      id: 'host-training',
      title: 'Host-Training',
      subtitle: 'Multiplayer free play & shared training lobby without ghosts',
      tag: 'SOON',
      isAvailable: false,
      description:
        'Host-Training (Coming Soon): Direct multiplayer Free Play arena without lobby ghost separation.',
      customIcon: <BookOpenCheck className="h-5 w-5" />,
    },
    {
      id: 'advanced',
      title: 'Advanced',
      subtitle: 'Custom mutators, physics rules & advanced arena configuration',
      tag: 'SOON',
      isAvailable: false,
      description:
        'Advanced (Coming Soon): Custom match mutators, experimental physics rules, and specialized sandboxes.',
      customIcon: <HouseCog className="h-5 w-5" />,
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
