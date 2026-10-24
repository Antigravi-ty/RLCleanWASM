import React from 'react';
import {
  Film,
  Flame,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Download,
  Trophy,
  Radio,
  ShieldAlert,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { useDevTestLabStore } from '../../../stores/devTestLabStore';
import { floatingStore } from '../../../stores/floatingStore';
import { REPLAY_DIRECTOR_TUNER_PRESET } from '../../../stores/floatingPresets';
import { SliderControl } from '../../primitives/SliderControl';
import { Badge } from '../../primitives/Badge';
import { Button } from '../../primitives/Button';

export interface GoalReplayBenchPanelProps {
  isLight?: boolean;
  cardBg: string;
  subPanelBg: string;
  mutedText: string;
}

export const GoalReplayBenchPanel: React.FC<GoalReplayBenchPanelProps> = ({
  isLight = false,
  cardBg,
  subPanelBg,
  mutedText,
}) => {
  const {
    goalReplayLookbackSec,
    goalReplayPostGoalSec,
    goalReplayPhase,
    goalReplayCurrentFrameId,
    goalReplayLastKickoffFrameId,
    goalReplayIncidentFrameId,
    goalReplayRequestedStartFrameId,
    goalReplayEffectiveStartFrameId,
    goalReplayEffectiveEndFrameId,
    goalReplayClampedByKickoff,
    goalReplayPlaybackCursor,
    goalReplayPlaybackTotal,
    goalReplayPaused,
    goalReplaySpeed,
    goalReplayRecordedBufferCount,
    podiumActive,
    podiumWinningTeam,
    setGoalReplayLookbackSec,
    setGoalReplayPostGoalSec,
    runtimeHandlers,
  } = useDevTestLabStore();

  const progressPct =
    goalReplayPlaybackTotal > 1
      ? Math.min(100, Math.max(0, (goalReplayPlaybackCursor / (goalReplayPlaybackTotal - 1)) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Goal Replay Window Parameters (Lookback Before Goal & Post-Goal Delay/End) */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Film className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span className="font-semibold text-[11px] truncate">
              Goal Incident & Goal Replay Window Parameters
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                floatingStore.spawnWindow({
                  ...REPLAY_DIRECTOR_TUNER_PRESET,
                  startMinimized: false,
                })
              }
              isLight={isLight}
              className="gap-1 py-0.5 px-2 text-[10px] font-semibold"
              title="Spawn Replay Director Camera & Slow-Mo Tuner Floating Window"
            >
              <Sliders className="h-2.5 w-2.5 text-amber-400 shrink-0" />
              <span>Director Tuner</span>
            </Button>
            <Badge
              variant={
                goalReplayPhase === 'replaying'
                  ? 'amber'
                  : goalReplayPhase === 'podium'
                  ? 'emerald'
                  : 'neutral'
              }
              size="sm"
              isLight={isLight}
              className="font-mono text-[10px] uppercase"
            >
              {goalReplayPhase}
            </Badge>
          </div>
        </div>

        <p className={`text-[10px] leading-relaxed ${mutedText}`}>
          Adjust how many seconds <b>before</b> the Goal Incident Event the replay begins, and how many seconds{' '}
          <b>after</b> the Goal Incident Event it ends (<code>SIGNAL_GOAL_REPLAY_WILL_START</code> default = 3.0s).
          <br />
          <b>Kickoff Minimum Time Rule:</b>{' '}
          <code>effectiveStart = max(goalFrame - lookbackTicks, lastKickoffWillStartFrame)</code> (follows the larger
          Frame ID / shorter duration so replay never rewinds past the most recent kickoff signal).
        </p>

        <div className={`p-2 rounded-lg border flex flex-col gap-2 ${subPanelBg}`}>
          <SliderControl
            label={`Pre-Goal Lookback Time (${goalReplayLookbackSec}s = ${Math.round(goalReplayLookbackSec * 120)}f)`}
            description="Seconds before Goal Incident to start replay (commit on Enter / unfocus)"
            value={goalReplayLookbackSec}
            min={0.5}
            max={15.0}
            step={0.5}
            unit="s"
            editable={true}
            allowOutOfBoundsInput={true}
            showStepper={true}
            colorScheme="amber"
            isLight={isLight}
            onChange={(val) => setGoalReplayLookbackSec(val)}
          />

          <SliderControl
            label={`Post-Goal Window / Delay (${goalReplayPostGoalSec}s = ${Math.round(goalReplayPostGoalSec * 120)}f)`}
            description="Seconds after Goal Incident before Goal Replay starts / ends (default 3.0s)"
            value={goalReplayPostGoalSec}
            min={0.0}
            max={10.0}
            step={0.5}
            unit="s"
            editable={true}
            allowOutOfBoundsInput={true}
            showStepper={true}
            colorScheme="neutral"
            isLight={isLight}
            onChange={(val) => setGoalReplayPostGoalSec(val)}
          />
        </div>
      </div>

      {/* 2. Frame ID Clamping & Signal Telemetry Readout */}
      <div className={`p-2.5 rounded-xl border font-mono text-[10px] flex flex-col gap-1.5 ${subPanelBg}`}>
        <div className="flex items-center justify-between border-b border-neutral-700/30 pb-1">
          <span className="font-bold text-sky-400">FRAME ID & KICKOFF CLAMP TELEMETRY</span>
          <span className="flex items-center gap-1">
            {goalReplayClampedByKickoff ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                CLAMPED TO KICKOFF
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                FULL LOOKBACK
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5">
          <span>
            Current Frame ID: <b>#{goalReplayCurrentFrameId}</b>
          </span>
          <span>
            RingBuffer Frames: <b>{goalReplayRecordedBufferCount}f</b>
          </span>
          <span>
            Last Kickoff Signal: <b className="text-amber-400">#{goalReplayLastKickoffFrameId}</b>
          </span>
          <span>
            Goal Incident Frame: <b className="text-rose-400">#{goalReplayIncidentFrameId || '—'}</b>
          </span>
          <span>
            Requested Start (G-{goalReplayLookbackSec}s): <b>#{goalReplayRequestedStartFrameId}</b>
          </span>
          <span>
            Effective Start (max):{' '}
            <b className={goalReplayClampedByKickoff ? 'text-amber-400' : 'text-emerald-400'}>
              #{goalReplayEffectiveStartFrameId}
            </b>
          </span>
          <span className="col-span-2">
            Effective Replay Window: <b>[{goalReplayEffectiveStartFrameId} .. {goalReplayEffectiveEndFrameId}]</b> (
            {Math.max(0, goalReplayEffectiveEndFrameId - goalReplayEffectiveStartFrameId)}f /{' '}
            {(Math.max(0, goalReplayEffectiveEndFrameId - goalReplayEffectiveStartFrameId) / 120).toFixed(2)}s)
          </span>
        </div>
      </div>

      {/* 3. Goal Incident & Kickoff Signal Test Scenarios */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${cardBg}`}>
        <span className={`text-[10px] font-semibold uppercase ${mutedText}`}>
          Goal Incident & Kickoff Signal Test Scenarios
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => runtimeHandlers.onGoalReplayTriggerScenario?.('instant_kickoff_goal')}
            isLight={isLight}
            className="gap-1 py-1.5 text-[10px] font-bold"
          >
            <Flame className="h-3 w-3 shrink-0" />
            <span>Instant Kickoff Goal (&lt;1s · Clamp)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => runtimeHandlers.onGoalReplayTriggerScenario?.('normal_play_goal')}
            isLight={isLight}
            className="gap-1 py-1.5 text-[10px] font-bold"
          >
            <Play className="h-3 w-3 shrink-0 fill-current" />
            <span>Normal Play Goal (&gt;6s · Full)</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => runtimeHandlers.onGoalReplayTriggerScenario?.('emit_kickoff_signal')}
            isLight={isLight}
            className="gap-1 py-1 text-[10px]"
          >
            <Radio className="h-3 w-3 text-amber-400 shrink-0" />
            <span>Emit KICKOFF_WILL_START Now</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => runtimeHandlers.onGoalReplayTriggerScenario?.('trigger_goal_now')}
            isLight={isLight}
            className="gap-1 py-1 text-[10px]"
          >
            <Flame className="h-3 w-3 text-rose-400 shrink-0" />
            <span>Trigger Goal Incident Now</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              runtimeHandlers.onGoalReplayTriggerScenario?.(
                goalReplayPhase === 'replaying' ? 'stop_replay' : 'start_replay_now'
              )
            }
            isLight={isLight}
            className="gap-1 py-1 text-[10px]"
          >
            {goalReplayPhase === 'replaying' ? (
              <>
                <RotateCcw className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>Exit Replay → Live Play</span>
              </>
            ) : (
              <>
                <Film className="h-3 w-3 text-sky-400 shrink-0" />
                <span>Play Extracted Replay Now</span>
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => runtimeHandlers.onGoalReplayTriggerScenario?.('export_replay_json')}
            isLight={isLight}
            className="gap-1 py-1 text-[10px]"
          >
            <Download className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>Export Match Replay (.json)</span>
          </Button>
        </div>

        {/* Replay Timeline Scrubbing Bar when Replaying */}
        {goalReplayPhase === 'replaying' && (
          <div className={`p-2 rounded-lg border mt-1 flex flex-col gap-1.5 ${subPanelBg}`}>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span>
                REPLAY PLAYBACK: <b>{goalReplayPlaybackCursor}</b> / <b>{goalReplayPlaybackTotal}f</b>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => runtimeHandlers.onGoalReplayTogglePause?.()}
                  className="px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  {goalReplayPaused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                  <span>{goalReplayPaused ? 'Play' : 'Pause'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => runtimeHandlers.onGoalReplayCycleSpeed?.()}
                  className="px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FastForward className="h-2.5 w-2.5" />
                  <span>{goalReplaySpeed}x</span>
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={progressPct}
              onChange={(e) => runtimeHandlers.onGoalReplaySeekNormalized?.(Number(e.target.value) / 100)}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* 4. Post-Match Podium Celebration Showcase Test */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">
              Post-Match Podium Celebration Test
            </span>
          </div>
          {podiumActive && (
            <Badge variant="emerald" size="sm" isLight={isLight} className="font-mono text-[10px]">
              {podiumWinningTeam === 0
                ? 'BLUE WINS'
                : podiumWinningTeam === 1
                ? 'ORANGE WINS'
                : 'DRAW'}
            </Badge>
          )}
        </div>
        <p className={`text-[10px] leading-relaxed ${mutedText}`}>
          Places cars onto V-formation Podium pedestals facing the Podium Showcase camera. Winners can drive freely;
          runners-up have horizontal XY locked while retaining jump, dodge, air-roll & boost stunts.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            variant={podiumActive && podiumWinningTeam === 0 ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => runtimeHandlers.onEnterPodiumTest?.(0)}
            isLight={isLight}
            className="py-1 text-[10px] font-bold"
          >
            Blue Wins
          </Button>
          <Button
            variant={podiumActive && podiumWinningTeam === 1 ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => runtimeHandlers.onEnterPodiumTest?.(1)}
            isLight={isLight}
            className="py-1 text-[10px] font-bold"
          >
            Orange Wins
          </Button>
          <Button
            variant={podiumActive && podiumWinningTeam === 2 ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => runtimeHandlers.onEnterPodiumTest?.(2)}
            isLight={isLight}
            className="py-1 text-[10px] font-bold"
          >
            Draw Podium
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => runtimeHandlers.onExitPodiumTest?.()}
            isLight={isLight}
            className="py-1 text-[10px]"
          >
            Exit Podium
          </Button>
        </div>
      </div>
    </div>
  );
};
