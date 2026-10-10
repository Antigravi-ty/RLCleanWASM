import React, { useState } from 'react';
import { Bot, Check, Info, Lock, Play } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { useUIStore } from '../core/store';
import { UI_RADIUS } from '../tokens';

export interface Layer3BotDifficultyRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onStartMatch?: (botId: string) => void;
}

interface FormatOption {
  id: string;
  label: string;
  available: boolean;
  tooltip: string;
}

interface BotOption {
  id: string;
  name: string;
  rank: string;
  description: string;
  badgeVariant: 'default' | 'neutral' | 'success' | 'warning' | 'error';
  tooltip: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: '1v1', label: '1v1 Duel', available: true, tooltip: 'Solo Duel: Direct 1v1 regulation match against AI bot.' },
  { id: '2v2', label: '2v2 Doubles', available: false, tooltip: 'Doubles: Under construction. Coming soon.' },
  { id: '3v3', label: '3v3 Standard', available: false, tooltip: 'Standard: Under construction. Coming soon.' },
];

const BOT_OPTIONS: BotOption[] = [
  {
    id: 'seer',
    name: 'Seer',
    rank: 'Platinum',
    description: 'Defensive ground bot with solid positioning and fundamentals.',
    badgeVariant: 'neutral',
    tooltip: 'Seer: Defensive ground bot with solid positioning and fundamentals. (Rank: Platinum ~ Diamond)',
  },
  {
    id: 'necto',
    name: 'Necto',
    rank: 'Champion',
    description: 'Intermediate neural net agent with aerials and speed.',
    badgeVariant: 'default',
    tooltip: 'Necto: Intermediate neural net agent with aerials and speed. (Rank: Champion)',
  },
  {
    id: 'nexto',
    name: 'Nexto',
    rank: 'Grand Champ',
    description: 'Elite RLBot community neural net champion.',
    badgeVariant: 'warning',
    tooltip: 'Nexto: Elite RLBot community neural net champion with lethal flicks. (Rank: Grand Champion+)',
  },
];

/**
 * [Recipe] Layer 3 Bot Difficulty & Solo Match Configuration (Width: 500px)
 * Designed for ZERO vertical scrolling:
 * - Header: Minimal title "SINGLE PLAYER WITH BOTS" + top-right "Start Match" action button
 * - Segmented Control: Team Size Format (1v1 active, 2v2/3v3 locked)
 * - 3-Column Bot Cards: Seer, Necto, Nexto in single row with hover details in footer
 * - Single-line regulation summary: Duration (5 Min) · Overtime (Sudden Death)
 * - Dynamic Inspector Footer with smooth real-time tooltips
 */
export const Layer3BotDifficultyRecipe: React.FC<Layer3BotDifficultyRecipeProps> = ({
  isLight = false,
  onBack,
  onStartMatch,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<string>('1v1');
  const [selectedBotId, setSelectedBotId] = useState<string>('nexto');
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  const bridge = useUIStore((s) => s.bridge);

  const handleStart = () => {
    if (onStartMatch) {
      onStartMatch(selectedBotId);
    } else if (bridge.onStartMatch) {
      bridge.onStartMatch(selectedBotId);
    }
  };

  const selectedBot = BOT_OPTIONS.find((b) => b.id === selectedBotId) || BOT_OPTIONS[2];

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[500px]">
      <PanelHeader
        title="SINGLE PLAYER WITH BOTS"
        onBack={onBack}
        isLight={isLight}
        rightElement={
          <Button
            variant="primary"
            size="sm"
            onClick={handleStart}
            isLight={isLight}
            className="gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Match</span>
          </Button>
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleStart}
            isLight={isLight}
            className="gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Match</span>
          </Button>
        }
      />

      <PanelContent scrollable={false} className="p-5 flex flex-col gap-4">
        {/* 1. Format Segmented Control */}
        <div
          role="radiogroup"
          aria-label="Match Format"
          className={`flex w-full items-center border rounded-xl p-1 select-none ${
            isLight ? 'bg-neutral-200/80 border-neutral-300/80' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          {FORMAT_OPTIONS.map((opt) => {
            const isSelected = selectedFormat === opt.id;
            const isEnabled = opt.available;

            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!isEnabled}
                onClick={() => {
                  if (isEnabled) setSelectedFormat(opt.id);
                }}
                onMouseEnter={() => setHoveredDesc(opt.tooltip)}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`relative flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all outline-none ${
                  !isEnabled
                    ? 'opacity-40 cursor-not-allowed text-neutral-500'
                    : isSelected
                    ? isLight
                      ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-black/5 cursor-pointer'
                      : 'bg-neutral-800 text-white font-semibold shadow-xs border border-white/10 cursor-pointer'
                    : isLight
                    ? 'text-neutral-600 hover:text-neutral-900 cursor-pointer'
                    : 'text-neutral-400 hover:text-neutral-200 cursor-pointer'
                }`}
              >
                {!isEnabled && <Lock className="h-3 w-3 shrink-0 opacity-70" />}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Opponent Difficulty: 3-Column Compact Grid */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider px-0.5">
            <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>
              Opponent Difficulty
            </span>
            <span className={`font-mono text-[10px] ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Selected: {selectedBot.name} ({selectedBot.rank})
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 w-full">
            {BOT_OPTIONS.map((bot) => {
              const isSelected = selectedBotId === bot.id;

              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => setSelectedBotId(bot.id)}
                  onMouseEnter={() => setHoveredDesc(bot.tooltip)}
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
                      <Bot className="h-4 w-4" />
                    </div>

                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-current" />
                    ) : (
                      <Badge
                        variant={bot.badgeVariant}
                        size="sm"
                        isLight={isLight}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {bot.rank}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col mt-auto min-w-0">
                    <span className="font-bold text-xs truncate">
                      {bot.name}
                    </span>
                    <span
                      className={`text-[10px] truncate ${
                        isSelected
                          ? isLight
                            ? 'text-neutral-300'
                            : 'text-neutral-700'
                          : isLight
                          ? 'text-neutral-500'
                          : 'text-neutral-400'
                      }`}
                    >
                      {bot.rank}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Match Regulations Summary: Compact Single Row */}
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between select-none ${
            isLight
              ? 'bg-neutral-50/80 border-neutral-200/90 text-neutral-700'
              : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-300'
          }`}
          onMouseEnter={() => setHoveredDesc('Standard regulation match parameters: 5 minute clock with sudden death overtime.')}
          onMouseLeave={() => setHoveredDesc(null)}
        >
          <div className="flex items-center gap-1.5">
            <span className="opacity-70">Duration:</span>
            <span className="font-mono font-semibold">5 Minutes</span>
          </div>
          <div className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
          <div className="flex items-center gap-1.5">
            <span className="opacity-70">Overtime:</span>
            <span className="font-mono font-semibold">Sudden Death</span>
          </div>
        </div>
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
