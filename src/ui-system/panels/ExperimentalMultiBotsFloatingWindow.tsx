import React from 'react';
import {
  Play,
  Eye,
  RotateCcw,
  Zap,
  Users,
} from 'lucide-react';
import {
  useExpMultiBotsStore,
  getExpColorSwatch,
  type ExpPlayerParticipation,
  type ExpSpeedMultiplier,
} from '../../stores/expMultiBotsStore';
import { useAppStore } from '../../stores/appStore';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { ExpMultiBotTeamRosterCard } from './ExpMultiBotTeamRosterCard';

export interface ExperimentalMultiBotsFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const ExperimentalMultiBotsFloatingWindow: React.FC<
  ExperimentalMultiBotsFloatingWindowProps
> = ({ isLight = false }) => {
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

  React.useEffect(() => {
    preloadEngines();
  }, [preloadEngines]);

  const matchMode = useAppStore((s) => s.matchMode);
  const bridge = useAppStore((s) => s.bridge);
  const isInExpMode = matchMode === 'exp-multi-bots';

  const cardBg = isLight
    ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
    : 'bg-neutral-850/60 border-neutral-700/60 text-neutral-200';

  const subPanelBg = isLight
    ? 'bg-white border-neutral-200/90 text-neutral-800'
    : 'bg-neutral-950/50 border-neutral-800 text-neutral-200';

  const mutedText = isLight ? 'text-neutral-500' : 'text-neutral-400';

  const totalCars = blueSlots.length + orangeSlots.length;
  const formatClock = (sec: number) => {
    const abs = Math.max(0, Math.floor(sec));
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${isOvertime ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2.5 select-none text-xs">
      {/* 1. Top Status Bar & Mode Activation */}
      <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${cardBg}`}>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isInExpMode
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-xs truncate">
              {isInExpMode
                ? `Experimental Multiple Bots (${blueSlots.length}v${orangeSlots.length})`
                : 'Experimental Multiple Bots Standby'}
            </span>
          </div>
          <span className={`text-[10px] font-mono truncate mt-0.5 ${mutedText}`}>
            Native SafeTensors EARL Perceiver · Zero ONNX · Up to 3v3
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isInExpMode ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => bridge.onStartExpMultiBots?.()}
              isLight={isLight}
              className="gap-1.5 px-2.5 py-1 text-[11px] font-semibold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Enter Mode</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startOrApplyMatch()}
              isLight={isLight}
              className="gap-1 px-2 py-1 text-[11px] font-semibold"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Apply &amp; Restart</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Native Model Weights & Inference Telemetry Bar */}
      <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 ${subPanelBg}`}>
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
          Infer: {lastTotalInferenceMs.toFixed(2)} ms
        </span>
      </div>

      {/* 3. Player Participation & Quick Presets */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <span>Player Participation</span>
          </span>
          <span className={`text-[10px] font-mono ${mutedText}`}>
            {playerParticipation === 'none'
              ? 'All-Bots Mode (Keys 1-6 switch POV)'
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

        {/* Quick Format Presets */}
        <div className="grid grid-cols-6 gap-1 pt-0.5">
          {[
            { id: '1v1-player', label: '1v1 +P' },
            { id: '2v2-player', label: '2v2 +P' },
            { id: '3v3-player', label: '3v3 +P' },
            { id: '1v1-bots', label: '1v1 Bot' },
            { id: '2v2-bots', label: '2v2 Bot' },
            { id: '3v3-bots', label: '3v3 Bot' },
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

      {/* 4. Bot Camera POV Hotkey Bar (1 - 6) */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-amber-400" />
            <span>Camera POV Switcher (Keys 1–6)</span>
          </span>
          <span className={`text-[10px] font-mono ${mutedText}`}>
            {playerParticipation === 'none'
              ? 'Press 1-6 to switch bot POV'
              : 'Click to inspect car POV'}
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
      </div>

      {/* 5. Blue Team (Team 0) Roster Builder (Max 3) */}
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
      />

      {/* 6. Orange Team (Team 1) Roster Builder (Max 3) */}
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
      />

      {/* 7. Live Match Scoreboard, Speed Multiplier & Sandbox Triggers */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Match Telemetry &amp; Controls</span>
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-400">
            Blue {blueScore} — {orangeScore} Orange · {formatClock(remainingSec)} ({matchPhase})
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] ${mutedText}`}>Match Duration</span>
          <SegmentedSwitch
            value={String(matchDurationSec)}
            onChange={(v) => setMatchDurationSec(Number(v))}
            options={[
              { value: '90', label: '1:30' },
              { value: '180', label: '3:00' },
              { value: '300', label: '5:00' },
              { value: '600', label: '10:00' },
            ]}
            size="sm"
            isLight={isLight}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
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

        <div className="grid grid-cols-5 gap-1.5 pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => triggerSandboxAction('reset_kickoff')}
            isLight={isLight}
            className="text-[10px] py-1"
          >
            Reset Kickoff
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => triggerSandboxAction('score_blue')}
            isLight={isLight}
            className="text-[10px] py-1"
          >
            +1 Blue Goal
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => triggerSandboxAction('score_orange')}
            isLight={isLight}
            className="text-[10px] py-1"
          >
            +1 Orange Goal
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => triggerSandboxAction('force_overtime')}
            isLight={isLight}
            className="text-[10px] py-1"
          >
            Force OT
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => triggerSandboxAction('end_match')}
            isLight={isLight}
            className="text-[10px] py-1"
          >
            End Match
          </Button>
        </div>
      </div>
    </div>
  );
};
