/**
 * ExpMultiBotRosterHelper.js
 * Roster spawning, kickoff placement, and telemetry synchronization helpers
 * for ExperimentalMultiBotMode.
 */

import {
  DEFAULT_CAR_CONTROLS,
  ExperimentalBotAgent,
  isExperimentalEngineReady,
} from '../../../ai/experimental/ExperimentalBotAgent.js';
import { MATCH_SIGNALS } from '../../../physics/RocketSimConstants.js';
import { KICKOFF_SPAWN_PRESETS } from '../../../network/MatchRosterCoordinator.js';
import {
  useExpMultiBotsStore,
  getExpColorSwatch,
} from '../../../stores/expMultiBotsStore';
import { setNameTagRuntimeState } from '../../../config/nameTagConfig.ts';
import { hudStore } from '../../../stores/hudStore';
import { gameAudio } from '../../../audio/GameAudioEngineFacade.js';
import { clearRetainedMatchReplayOnMatchStart } from '../../../replay/ReplayFileExporter.js';

export const KICKOFF_COUNTDOWN_TICKS = 360; // 3.0s @ 120Hz

// Symmetric 5-slot kickoff permutations ensuring mirrored spawns across 1v1, 2v2, and 3v3
export const KICKOFF_SLOT_PERMUTATIONS = [
  [0, 1, 2, 3, 4],
  [1, 0, 3, 2, 4],
  [0, 2, 4, 1, 3],
  [1, 3, 4, 0, 2],
  [2, 3, 4, 0, 1],
];

export function getExpModeAudio(runtime) {
  return runtime?.options?.gameAudio || gameAudio;
}

export function publishExpSpawnedCarsTelemetry(mode) {
  const store = useExpMultiBotsStore.getState();
  store.updateLiveTelemetry({
    spawnedCars: mode.spawnedCars.map((c) => ({
      carIndex: c.carIndex,
      keyNumber: c.keyNumber,
      team: c.team,
      teamSlotIndex: c.teamSlotIndex,
      isPlayer: c.isPlayer,
      botType: c.botType,
      colorSlot: c.colorSlot,
      colorHex: c.colorHex,
      colorName: c.colorName,
      label: c.label,
    })),
    nextoLoaded: isExperimentalEngineReady('nexto'),
    nectoLoaded: isExperimentalEngineReady('necto'),
  });

  setNameTagRuntimeState({
    isMultiplayerOrMultiCarMode: true,
    carEntries: mode.spawnedCars.map((c) => ({
      carIndex: c.carIndex,
      name: getExpCarDisplayName(c, mode.spawnedCars),
      team: c.team === 1 ? 1 : 0,
    })),
  });
}

export function getExpCarDisplayName(entry, spawnedCars = []) {
  if (!entry) return 'Player';
  if (entry.isPlayer) return 'Player';
  const rawType = String(entry.botType || 'bot');
  const baseName = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
  const sameBotCount = Array.isArray(spawnedCars)
    ? spawnedCars.filter((c) => !c.isPlayer && c.botType === entry.botType).length
    : 1;
  return sameBotCount > 1 ? `${baseName} #${entry.keyNumber}` : baseName;
}

export async function applyExpRosterAndStartMatch(mode) {
  const r = mode.runtime;
  if (!r?.physics) return;
  const store = useExpMultiBotsStore.getState();

  clearRetainedMatchReplayOnMatchStart();
  mode.replayController?.endReplaySession?.();
  mode.podiumController?.exitPodium?.();
  mode.replayRingBuffer?.clear?.();
  mode.isReplayActive = false;
  mode.isMatchEnded = false;
  mode.pendingMatchEndAfterReplay = false;
  mode.pendingMatchWinner = null;
  if (r) {
    r.goalReplayCameraOverrideActive = false;
  }

  await r.arena?.ensureOpponent?.();

  const blueSlots = store.blueSlots.slice(0, 3);
  const orangeSlots = store.orangeSlots.slice(0, 3);
  const combinedSlots = [
    ...blueSlots.map((s, idx) => ({ ...s, team: 0, teamSlotIndex: idx })),
    ...orangeSlots.map((s, idx) => ({ ...s, team: 1, teamSlotIndex: idx })),
  ];

  if (combinedSlots.length === 0) {
    combinedSlots.push({
      id: 'blue-0',
      team: 0,
      teamSlotIndex: 0,
      isPlayer: false,
      botType: 'necto',
      colorSlot: 3,
    });
  }

  while (r.physics.numCars > 0 && typeof r.physics.removeCar === 'function') {
    r.physics.removeCar(r.physics.numCars - 1);
  }

  mode.spawnedCars = [];
  mode.activeCarsList = [];
  mode.carControlsMap.clear();
  mode.humanPlayerCarIndex = -1;

  for (let i = 0; i < combinedSlots.length; i++) {
    const slot = combinedSlots[i];
    const carIndex = i;
    const keyNumber = i + 1;
    const swatch = getExpColorSwatch(slot.colorSlot);
    const isPlayer =
      (store.playerParticipation === 'blue' && slot.team === 0 && slot.teamSlotIndex === 0) ||
      (store.playerParticipation === 'orange' && slot.team === 1 && slot.teamSlotIndex === 0);

    const hitboxPreset = isPlayer ? (r.selectedPreset || 'octane') : 'octane';
    r.physics.addCar(slot.team, hitboxPreset);
    r.physics.setCarTeam?.(carIndex, slot.team);

    if (r.arena) {
      r.arena.ensureCar?.(carIndex, slot.team);
      r.arena.setCarTeam?.(carIndex, slot.team);
      r.arena.setCarColor?.(carIndex, swatch.hex);
      if (r.arena.cars?.[carIndex]) {
        r.arena.cars[carIndex].visible = true;
      }
    }

    if (isPlayer) {
      mode.humanPlayerCarIndex = carIndex;
    }

    const agent = isPlayer
      ? null
      : new ExperimentalBotAgent(slot.botType, carIndex, slot.team);

    const label = isPlayer
      ? `PLAYER (${slot.team === 0 ? 'Blue' : 'Orange'})`
      : `${slot.botType.toUpperCase()} #${keyNumber}`;

    mode.spawnedCars.push({
      carIndex,
      keyNumber,
      team: slot.team,
      teamSlotIndex: slot.teamSlotIndex,
      isPlayer,
      botType: slot.botType,
      colorSlot: swatch.id,
      colorHex: swatch.hex,
      colorName: swatch.name,
      label,
      agent,
    });

    mode.activeCarsList.push({
      carIndex,
      team: slot.team,
    });
    mode.carControlsMap.set(carIndex, { ...DEFAULT_CAR_CONTROLS });
  }

  if (r.arena?.cars) {
    for (let i = combinedSlots.length; i < r.arena.cars.length; i++) {
      if (r.arena.cars[i]) {
        r.arena.cars[i].visible = false;
      }
    }
  }

  const targetCamIdx =
    mode.humanPlayerCarIndex >= 0
      ? mode.humanPlayerCarIndex
      : Math.max(0, Math.min(mode.spawnedCars.length - 1, store.activeCameraCarIndex));

  mode._applyCameraCarIndex(targetCamIdx);
  mode._applySpeedMultiplier(store.speedMultiplier);

  r.physics.setUnlimitedBoost(Boolean(store.unlimitedBoost));
  r.physics.setPossessionReportingEnabled?.(true);
  r.physics.resetPossessionStats?.();

  const configuredDuration =
    typeof store.matchDurationSec === 'number' && Number.isFinite(store.matchDurationSec)
      ? Math.max(0, Math.round(store.matchDurationSec))
      : 300;

  mode.blueScore = 0;
  mode.orangeScore = 0;
  mode.remainingSec = configuredDuration;
  mode.isOvertime = configuredDuration === 0;
  mode.goalResetTicks = 0;
  mode.kickoffPermutationSeed = 0;
  if (Array.isArray(mode._pendingFrameSignals)) {
    mode._pendingFrameSignals.length = 0;
  }
  mode._emitReplaySignal?.(MATCH_SIGNALS.MATCH_STARTED, 0, 0);

  resetExpMultiCarKickoffSpawns(mode);
  beginExpKickoffCountdown(mode);

  store.updateLiveTelemetry({
    matchActive: true,
    activeCameraCarIndex: targetCamIdx,
    blueScore: 0,
    orangeScore: 0,
    remainingSec: mode.remainingSec,
    isOvertime: mode.isOvertime,
  });
  publishExpSpawnedCarsTelemetry(mode);

  hudStore.getState().setMatchState({
    blueScore: 0,
    orangeScore: 0,
    remainingSeconds: mode.remainingSec,
    isOvertime: mode.isOvertime,
    overtimeSeconds: 0,
    winner: null,
    winReason: null,
    replayScorerName: null,
    replayScorerTeam: null,
    replayBallSpeedKph: null,
    replayAssistName: null,
  });
}

export function resetExpMultiCarKickoffSpawns(mode) {
  const r = mode.runtime;
  const sim = r?.physics;
  if (!sim) return;

  sim.resetGoalLatch?.();
  sim.resetKickoff(0, false);

  const perm =
    KICKOFF_SLOT_PERMUTATIONS[mode.kickoffPermutationSeed % KICKOFF_SLOT_PERMUTATIONS.length];
  mode.kickoffPermutationSeed++;

  for (const entry of mode.spawnedCars) {
    const presetIdx = perm[entry.teamSlotIndex % perm.length] ?? 0;
    const preset = KICKOFF_SPAWN_PRESETS[presetIdx] || KICKOFF_SPAWN_PRESETS[0];
    const coord = entry.team === 0 ? preset.team0 : preset.team1;
    const cy = Math.cos(coord.yaw);
    const sy = Math.sin(coord.yaw);

    sim.setCarTeam?.(entry.carIndex, entry.team);
    sim.setCarState(entry.carIndex, {
      pos: [coord.x, coord.y, coord.z],
      vel: [0, 0, 0],
      angVel: [0, 0, 0],
      rot: [0, coord.yaw, 0],
      fwd: [cy, sy, 0],
      right: [-sy, cy, 0],
      up: [0, 0, 1],
      isOnGround: true,
      isSupersonic: false,
      isDemoed: false,
      hasFlipOrJump: true,
      isBoosting: false,
      isFlipping: false,
      boost: useExpMultiBotsStore.getState().unlimitedBoost ? 100 : 33.33,
    });

    entry.agent?.reset();
    mode.carControlsMap.set(entry.carIndex, { ...DEFAULT_CAR_CONTROLS });
  }

  sim.setBallState({
    pos: [0, 0, 93.15],
    vel: [0, 0, 0],
    angVel: [0, 0, 0],
  });

  const targetCamIdx =
    mode.humanPlayerCarIndex >= 0
      ? mode.humanPlayerCarIndex
      : Math.max(0, Math.min(mode.spawnedCars.length - 1, useExpMultiBotsStore.getState().activeCameraCarIndex));
  mode._applyCameraCarIndex(targetCamIdx);

  r.camera?.resetView?.();
  r.interpolator?.sync?.();
}

export function beginExpKickoffCountdown(mode) {
  const r = mode.runtime;
  const store = useExpMultiBotsStore.getState();
  const audio = getExpModeAudio(r);

  mode.replayController?.endReplaySession?.();
  mode.isReplayActive = false;
  if (r) {
    r.goalReplayCameraOverrideActive = false;
  }
  mode._resetPlayTouchAndGoalState?.();

  mode.countdownTicks = KICKOFF_COUNTDOWN_TICKS;
  mode.kickoffTick = 0;
  mode.ticksSinceKickoff = 0;
  mode.clockStarted = false;
  mode.clockTickAccum = 0;
  mode.matchPhase = 'kickoff (3)';
  mode.lastKickoffStartTick = Math.floor(r?.physics?.getHeaderView?.()?.tickCount ?? 0);
  mode._emitReplaySignal?.(MATCH_SIGNALS.KICKOFF_WILL_START, KICKOFF_COUNTDOWN_TICKS, 3);

  if (r?.match?.state) {
    r.match.state.phase = 'kickoff';
    r.match.state.countdown = 3;
  }

  audio?.play?.('match_countdown_321', 1.0);
  store.updateLiveTelemetry({
    kickoffCountdownSec: 3,
    matchPhase: mode.matchPhase,
  });
  hudStore.getState().setMatchState({
    matchPhase: 'kickoff',
    kickoffCountdown: 3,
    replayScorerName: null,
    replayScorerTeam: null,
    replayBallSpeedKph: null,
    replayAssistName: null,
  });
}

export function triggerExpSandboxAction(mode, action) {
  const r = mode.runtime;
  const store = useExpMultiBotsStore.getState();
  const audio = getExpModeAudio(r);
  if (!r?.physics) return;

  switch (action) {
    case 'reset_kickoff': {
      resetExpMultiCarKickoffSpawns(mode);
      beginExpKickoffCountdown(mode);
      break;
    }
    case 'score_blue': {
      mode.countdownTicks = 0;
      mode.goalResetTicks = 0;
      mode.clockStarted = true;
      if (mode.isReplayActive) {
        mode.skipGoalReplay?.();
      }
      r.physics.setBallState({
        pos: [0, 5050, 200],
        vel: [0, 1200, 0],
        angVel: [0, 0, 0],
      });
      break;
    }
    case 'score_orange': {
      mode.countdownTicks = 0;
      mode.goalResetTicks = 0;
      mode.clockStarted = true;
      if (mode.isReplayActive) {
        mode.skipGoalReplay?.();
      }
      r.physics.setBallState({
        pos: [0, -5050, 200],
        vel: [0, -1200, 0],
        angVel: [0, 0, 0],
      });
      break;
    }
    case 'force_overtime': {
      const tied = Math.max(mode.blueScore, mode.orangeScore, 1);
      mode.blueScore = tied;
      mode.orangeScore = tied;
      mode.remainingSec = 0;
      mode.isOvertime = true;
      audio?.play?.('match_entering_overtime', 1.0, 10000);
      resetExpMultiCarKickoffSpawns(mode);
      beginExpKickoffCountdown(mode);
      store.updateLiveTelemetry({
        blueScore: tied,
        orangeScore: tied,
        remainingSec: 0,
        isOvertime: true,
      });
      hudStore.getState().setMatchState({
        blueScore: tied,
        orangeScore: tied,
        remainingSeconds: 0,
        isOvertime: true,
        overtimeSeconds: 0,
      });
      break;
    }
    case 'end_match': {
      if (mode.blueScore === mode.orangeScore) {
        mode.blueScore += 1;
      }
      const winner = mode.blueScore >= mode.orangeScore ? 0 : 1;
      mode._finishMatch?.(winner);
      break;
    }
    default:
      break;
  }
}
