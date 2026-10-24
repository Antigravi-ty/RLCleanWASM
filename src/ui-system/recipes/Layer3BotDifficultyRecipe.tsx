import React, { useEffect, useState } from 'react';
import { Info, Play, SlidersHorizontal } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Button } from '../primitives/Button';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { useAppStore } from '../../stores/appStore';
import { useExpMultiBotsStore, ExpBotPolicyId } from '../../stores/expMultiBotsStore';
import { DEFAULT_PANEL_SIZING } from '../tokens';

export interface Layer3BotDifficultyRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onStartMatch?: (botId: string, durationSeconds?: number, teamSize?: 'standard' | 'double' | 'solo') => void;
}

/**
 * [Recipe] Layer 3 Exhibition Match Configuration
 * - Header: "EXHIBITION" + top-right "Start Match" action button
 * - Row 1: Team Size (left) + SegmentedSwitch [Standard, Double, Solo] (right)
 * - Row 2: Difficulty (left) + SegmentedSwitch [Nexto, Necto] (right)
 * - Row 3: Match Duration (left) + SegmentedSwitch [1:30, 3:00, 5:00] (right)
 * - Row 4: Advanced options button (disabled)
 * - Defaults: Solo, Necto, 5:00 (300s)
 */
export const Layer3BotDifficultyRecipe: React.FC<Layer3BotDifficultyRecipeProps> = ({
  isLight = false,
  onBack,
  onStartMatch,
}) => {
  const [teamSize, setTeamSize] = useState<'standard' | 'double' | 'solo'>('solo');
  const [difficulty, setDifficulty] = useState<'nexto' | 'necto'>('necto');
  const [durationSec, setDurationSec] = useState<number>(300);

  const bridge = useAppStore((s) => s.bridge);
  const preloadEngines = useExpMultiBotsStore((s) => s.preloadEngines);

  useEffect(() => {
    preloadEngines?.();
  }, [preloadEngines]);

  const handleStart = () => {
    const resolvedBot: ExpBotPolicyId = difficulty === 'nexto' ? 'nexto' : 'necto';
    useExpMultiBotsStore.getState().configureExhibitionMatch(resolvedBot, durationSec, teamSize);
    if (onStartMatch) {
      onStartMatch(resolvedBot, durationSec, teamSize);
    } else if (bridge.onStartMatch) {
      bridge.onStartMatch(resolvedBot, durationSec, teamSize);
    }
  };

  const teamSizeSummary =
    teamSize === 'standard' ? 'Standard 3v3' : teamSize === 'double' ? 'Double 2v2' : 'Solo 1v1';

  return (
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer3-bot-difficulty']} className="w-full">
      <PanelHeader
        title="EXHIBITION"
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

      <PanelContent scrollable={true} className="p-5 flex flex-col gap-4">
        {/* 1. Team Size Row */}
        <div
          data-testid="exhibition-row-team-size"
          className={`flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-xl border ${
            isLight
              ? 'bg-neutral-50 border-neutral-200/90'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <span
            className={`text-xs font-bold tracking-wide ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}
          >
            Team Size
          </span>
          <SegmentedSwitch
            id="exhibition-team-size-segmented"
            ariaLabel="Team Size"
            isLight={isLight}
            size="sm"
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'double', label: 'Double' },
              { value: 'solo', label: 'Solo' },
            ]}
            value={teamSize}
            onValueChange={(val) => {
              if (val === 'standard' || val === 'double' || val === 'solo') {
                setTeamSize(val);
              }
            }}
          />
        </div>

        {/* 2. Difficulty Row */}
        <div
          data-testid="exhibition-row-difficulty"
          className={`flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-xl border ${
            isLight
              ? 'bg-neutral-50 border-neutral-200/90'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <span
            className={`text-xs font-bold tracking-wide ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}
          >
            Difficulty
          </span>
          <SegmentedSwitch
            id="exhibition-difficulty-segmented"
            ariaLabel="Difficulty"
            isLight={isLight}
            size="sm"
            options={[
              { value: 'nexto', label: 'Nexto' },
              { value: 'necto', label: 'Necto' },
            ]}
            value={difficulty}
            onValueChange={(val) => setDifficulty(val === 'nexto' ? 'nexto' : 'necto')}
          />
        </div>

        {/* 3. Match Duration Row */}
        <div
          data-testid="exhibition-row-duration"
          className={`flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-xl border ${
            isLight
              ? 'bg-neutral-50 border-neutral-200/90'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <span
            className={`text-xs font-bold tracking-wide ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}
          >
            Match Duration
          </span>
          <SegmentedSwitch
            id="exhibition-duration-segmented"
            ariaLabel="Match Duration"
            isLight={isLight}
            size="sm"
            options={[
              { value: '90', label: '1:30' },
              { value: '180', label: '3:00' },
              { value: '300', label: '5:00' },
            ]}
            value={String(durationSec)}
            onValueChange={(val) => setDurationSec(Number(val) || 300)}
          />
        </div>

        {/* 4. Advanced Button (Disabled) */}
        <div className="flex items-center justify-end pt-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={true}
            isLight={isLight}
            className="gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Advanced</span>
          </Button>
        </div>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className={`truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {teamSizeSummary} · {difficulty === 'necto' ? 'Necto' : 'Nexto'} Policy · {durationSec === 90 ? '1:30' : durationSec === 180 ? '3:00' : '5:00'} Regulation · Goal Replay Enabled
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};

