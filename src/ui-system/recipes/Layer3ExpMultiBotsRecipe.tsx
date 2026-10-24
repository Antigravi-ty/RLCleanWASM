import React, { useState, useEffect } from 'react';
import {
  Play,
  Eye,
  RotateCcw,
  Users,
  Clock,
  Info,
} from 'lucide-react';
import {
  PanelContainer,
  PanelHeader,
  PanelContent,
  PanelFooter,
} from '../layout/Panel';
import {
  useExpMultiBotsStore,
  getExpColorSwatch,
  type ExpPlayerParticipation,
  type ExpSpeedMultiplier,
} from '../../stores/expMultiBotsStore';
import { useAppStore } from '../../stores/appStore';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { SliderControl } from '../primitives/SliderControl';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { ExpMultiBotTeamRosterCard } from '../panels/ExpMultiBotTeamRosterCard';

export interface Layer3ExpMultiBotsRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onEnterGame?: () => void;
}

const DURATION_PRESETS = [
  { seconds: 90, label: '1:30', tooltip: 'Fast match: 1 minute 30 seconds.' },
  { seconds: 180, label: '3:00', tooltip: 'Standard dev match: 3 minutes.' },
  { seconds: 300, label: '5:00', tooltip: 'Regulation match: 5 minutes.' },
  { seconds: 600, label: '10:00', tooltip: 'Extended sandbox match: 10 minutes.' },
];

/**
 * [Recipe] Layer 3 Experimental Multiple Bots Configuration Menu (Width: 580px)
 * Secondary menu panel for configuring up to 3v3 Native SafeTensors Nexto & Necto matches,
 * player participation, 6-color swatches, match duration / time modification, and entering/restarting games.
 */
export const Layer3ExpMultiBotsRecipe: React.FC<Layer3ExpMultiBotsRecipeProps> = ({
  isLight = false,
  onBack,
  onEnterGame,
}) => {
  const {
    playerParticipation,
    blueSlots,
    orangeSlots,
    activeCameraCarIndex,
    matchDurationSec,
    speedMultiplier,
    unlimitedBoost,
    disableGoalReplay,
    matchPhase,
    blueScore,
    orangeScore,
    remainingSec,
    isOvertime,
    nextoLoaded,
    nectoLoaded,
    lastTotalInferenceMs,
    spawnedCars,
    setPlayerParticipation,
    addBotToTeam,
    removeSlotFromTeam,
    setSlotBotType,
    setSlotColor,
    applyPresetRoster,
    setActiveCameraCarIndex,
    setMatchDurationSec,
    setSpeedMultiplier,
    setUnlimitedBoost,
    setDisableGoalReplay,
    startOrApplyMatch,
    triggerSandboxAction,
    preloadEngines,
  } = useExpMultiBotsStore();

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  useEffect(() => {
    preloadEngines();
  }, [preloadEngines]);

  const matchMode = useAppStore((s) => s.matchMode);
  const bridge = useAppStore((s) => s.bridge);
  const closeMenu = useAppStore((s) => s.closeMenu);
  const isInExpMode = matchMode === 'exp-multi-bots';

  const handleEnterOrRestart = () => {
    if (onEnterGame) {
      onEnterGame();
      return;
    }
    if (isInExpMode) {
      startOrApplyMatch();
      closeMenu();
    } else {
      bridge.onStartExpMultiBots?.();
    }
  };

  const cardBg = isLight
    ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
    : 'bg-neutral-850/60 border-neutral-700/60 text-neutral-200';

  const subPanelBg = isLight
    ? 'bg-white border-neutral-200/90 text-neutral-800'
    : 'bg-neutral-950/50 border-neutral-800 text-neutral-200';

  const mutedText = isLight ? 'text-neutral-500' : 'text-neutral-400';

  const totalCars = blueSlots.length + orangeSlots.length;
  const formatClock = (sec: number, showPlus = false) => {
    const abs = Math.max(0, Math.floor(sec));
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${showPlus ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
  };

  const actionButton = (
    <Button
      variant="primary"
      size="sm"
      onClick={handleEnterOrRestart}
      isLight={isLight}
      className="gap-1.5 px-3 py-1 text-xs font-semibold"
    >
      {isInExpMode ? (
        <>
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Apply &amp; Restart Game</span>
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Enter Game</span>
        </>
      )}
    </Button>
  );

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer3-exp-multi-bots']}
      className="w-full"
    >
      <PanelHeader
        title="EXPERIMENTAL MULTIPLE BOTS"
        onBack={onBack}
        isLight={isLight}
        rightElement={actionButton}
        actions={actionButton}
      />

      <PanelContent scrollable={true} className="p-5 flex flex-col gap-3 text-xs select-none">
        {/* 1. Native SafeTensors Model Status Bar */}
        <div
          className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${subPanelBg}`}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant={nextoLoaded ? 'emerald' : 'amber'}
              size="sm"
              isLight={isLight}
              className="font-mono text-[10px]"
            >
              Nexto SafeTensors: {nextoLoaded ? 'READY' : 'LOADING'}
            </Badge>
            <Badge
              variant={nectoLoaded ? 'emerald' : 'amber'}
              size="sm"
              isLight={isLight}
              className="font-mono text-[10px]"
            >
              Necto SafeTensors: {nectoLoaded ? 'READY' : 'LOADING'}
            </Badge>
          </div>
          <span className="text-[10px] font-mono text-sky-400 shrink-0">
            {isInExpMode
              ? `Active (${blueSlots.length}v${orangeSlots.length}) · Infer: ${lastTotalInferenceMs.toFixed(2)} ms`
              : `Format: ${blueSlots.length}v${orangeSlots.length} · Zero ONNX`}
          </span>
        </div>

        {/* 2. Player Participation & Quick Format Presets */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-sky-400" />
              <span>Player Participation &amp; Format Presets</span>
            </span>
            <span className={`text-[10px] font-mono ${mutedText}`}>
              {playerParticipation === 'none'
                ? 'All-Bots Spectator (Keys 1–6 switch POV)'
                : `Human Player on ${playerParticipation.toUpperCase()}`}
            </span>
          </div>

          <SegmentedSwitch
            value={playerParticipation}
            onChange={(v) => setPlayerParticipation(v as ExpPlayerParticipation)}
            options={[
              { value: 'none', label: 'No Player (Spectate)' },
              { value: 'blue', label: '+ Player (Blue)' },
              { value: 'orange', label: '+ Player (Orange)' },
            ]}
            size="sm"
            isLight={isLight}
          />

          <div className="grid grid-cols-6 gap-1.5 pt-0.5">
            {[
              { id: '1v1-player', label: '1v1 +P', desc: '1v1 Duel with Human Player on Blue vs 1 Bot' },
              { id: '2v2-player', label: '2v2 +P', desc: '2v2 Doubles with Human Player + 1 Bot vs 2 Bots' },
              { id: '3v3-player', label: '3v3 +P', desc: '3v3 Standard with Human Player + 2 Bots vs 3 Bots' },
              { id: '1v1-bots', label: '1v1 Bot', desc: '1v1 All-Bots AI Showcase (Spectate keys 1–2)' },
              { id: '2v2-bots', label: '2v2 Bot', desc: '2v2 All-Bots AI Showcase (Spectate keys 1–4)' },
              { id: '3v3-bots', label: '3v3 Bot', desc: '3v3 All-Bots AI Showcase (Spectate keys 1–6)' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  applyPresetRoster(
                    p.id as
                      | '1v1-player'
                      | '2v2-player'
                      | '3v3-player'
                      | '1v1-bots'
                      | '2v2-bots'
                      | '3v3-bots'
                  )
                }
                onMouseEnter={() => setHoveredDesc(p.desc)}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`py-1 px-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer text-center ${
                  isLight
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Match Duration / Time Modification & Simulation Settings */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              <span>Match Duration &amp; Simulation Options</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              Configured Clock: {formatClock(matchDurationSec)} ({matchDurationSec}s)
            </span>
          </div>

          {/* Preset Duration Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {DURATION_PRESETS.map((d) => {
              const isSelected = matchDurationSec === d.seconds;
              return (
                <button
                  key={d.seconds}
                  type="button"
                  onClick={() => setMatchDurationSec(d.seconds)}
                  onMouseEnter={() => setHoveredDesc(d.tooltip)}
                  onMouseLeave={() => setHoveredDesc(null)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                        : 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-xs'
                      : isLight
                        ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <SliderControl
            label="Custom Match Duration"
            value={matchDurationSec}
            min={30}
            max={900}
            step={30}
            unit="s"
            onChange={(val) => setMatchDurationSec(val)}
            isLight={isLight}
          />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className={`text-[11px] ${mutedText}`}>Simulation Speed</span>
            <SegmentedSwitch
              value={String(speedMultiplier)}
              onChange={(v) => setSpeedMultiplier(Number(v) as ExpSpeedMultiplier)}
              options={[
                { value: '100', label: '1x' },
                { value: '200', label: '2x' },
                { value: '300', label: '3x' },
                { value: '400', label: '4x' },
              ]}
              size="sm"
              isLight={isLight}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-0.5">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${mutedText}`}>Unlimited Boost</span>
              <ToggleSwitch
                checked={unlimitedBoost}
                onChange={(v) => setUnlimitedBoost(v)}
                isLight={isLight}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${mutedText}`}>Fast Goal Reset</span>
              <ToggleSwitch
                checked={disableGoalReplay}
                onChange={(v) => setDisableGoalReplay(v)}
                isLight={isLight}
              />
            </div>
          </div>
        </div>

        {/* 4. Blue Team (Team 0) Roster Builder (Max 3) */}
        <ExpMultiBotTeamRosterCard
          team={0}
          slots={blueSlots}
          globalOffset={0}
          activeCameraCarIndex={activeCameraCarIndex}
          totalCars={totalCars}
          isLight={isLight}
          cardBg={cardBg}
          subPanelBg={subPanelBg}
          mutedText={mutedText}
          onAddBot={addBotToTeam}
          onSelectCameraCar={setActiveCameraCarIndex}
          onSetSlotBotType={setSlotBotType}
          onRemoveSlot={removeSlotFromTeam}
          onSetSlotColor={setSlotColor}
          onHoverDesc={setHoveredDesc}
        />

        {/* 5. Orange Team (Team 1) Roster Builder (Max 3) */}
        <ExpMultiBotTeamRosterCard
          team={1}
          slots={orangeSlots}
          globalOffset={blueSlots.length}
          activeCameraCarIndex={activeCameraCarIndex}
          totalCars={totalCars}
          isLight={isLight}
          cardBg={cardBg}
          subPanelBg={subPanelBg}
          mutedText={mutedText}
          onAddBot={addBotToTeam}
          onSelectCameraCar={setActiveCameraCarIndex}
          onSetSlotBotType={setSlotBotType}
          onRemoveSlot={removeSlotFromTeam}
          onSetSlotColor={setSlotColor}
          onHoverDesc={setHoveredDesc}
        />

        {/* 6. Bot Camera POV Hotkey Bar (1 - 6) & Live Match Actions (when active) */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-amber-400" />
              <span>Camera POV Switcher (Keys 1–6)</span>
            </span>
            <span className={`text-[10px] font-mono ${mutedText}`}>
              {isInExpMode
                ? `Score: Blue ${blueScore} — ${orangeScore} Orange · ${formatClock(remainingSec, isOvertime)} (${matchPhase})`
                : 'Press 1–6 in All-Bots mode to switch POV'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(spawnedCars.length > 0
              ? spawnedCars
              : [
                  ...blueSlots.map((s, i) => ({
                    carIndex: i,
                    keyNumber: i + 1,
                    team: 0 as const,
                    isPlayer: s.isPlayer,
                    botType: s.botType,
                    colorHex: getExpColorSwatch(s.colorSlot).hex,
                    label: s.isPlayer ? 'PLAYER' : `${s.botType.toUpperCase()} #${i + 1}`,
                  })),
                  ...orangeSlots.map((s, i) => ({
                    carIndex: blueSlots.length + i,
                    keyNumber: blueSlots.length + i + 1,
                    team: 1 as const,
                    isPlayer: s.isPlayer,
                    botType: s.botType,
                    colorHex: getExpColorSwatch(s.colorSlot).hex,
                    label: s.isPlayer
                      ? 'PLAYER'
                      : `${s.botType.toUpperCase()} #${blueSlots.length + i + 1}`,
                  })),
                ]
            ).map((car) => {
              const isSelected = activeCameraCarIndex === car.carIndex;
              return (
                <button
                  key={car.carIndex}
                  type="button"
                  onClick={() => setActiveCameraCarIndex(car.carIndex)}
                  className={`px-2 py-1.5 rounded-lg border flex items-center gap-1.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-sm'
                      : isLight
                        ? 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                        : 'bg-neutral-900/70 hover:bg-neutral-800 border-neutral-700/70 text-neutral-300'
                  }`}
                >
                  <KeycapBadge label={String(car.keyNumber)} size="sm" isLight={isLight} />
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: car.colorHex }}
                  />
                  <span className="text-[10px] font-mono truncate">{car.label}</span>
                </button>
              );
            })}
          </div>

          {isInExpMode && (
            <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-neutral-700/30">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  triggerSandboxAction('reset_kickoff');
                  closeMenu();
                }}
                isLight={isLight}
                className="text-[10px] py-1"
              >
                Reset Kickoff
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  triggerSandboxAction('score_blue');
                  closeMenu();
                }}
                isLight={isLight}
                className="text-[10px] py-1"
              >
                +1 Blue Goal
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  triggerSandboxAction('score_orange');
                  closeMenu();
                }}
                isLight={isLight}
                className="text-[10px] py-1"
              >
                +1 Orange Goal
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  triggerSandboxAction('force_overtime');
                  closeMenu();
                }}
                isLight={isLight}
                className="text-[10px] py-1"
              >
                Force OT
              </Button>
            </div>
          )}
        </div>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center justify-between gap-2 w-full text-xs">
          <div className="flex items-center gap-2 min-w-0 truncate">
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
                'Configure Blue & Orange bots, match duration, and click Enter Game / Apply & Restart.'}
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleEnterOrRestart}
            isLight={isLight}
            className="gap-1.5 px-3 py-1 text-xs font-semibold shrink-0"
          >
            {isInExpMode ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restart Game</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Enter Game</span>
              </>
            )}
          </Button>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
