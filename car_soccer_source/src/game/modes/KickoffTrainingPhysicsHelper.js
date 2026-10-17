/**
 * KickoffTrainingPhysicsHelper.js
 * Spawn setup, suspension settling, and realistic/instant/easy-learning episode reset
 * helpers for KickoffTrainingMode.
 */

import { MATCH_SIGNALS } from '../../physics/RocketSimConstants.js';
import {
  KICKOFF_SPAWNS,
  KICKOFF_SETTLE_TICKS,
  CPP_SPAWN_INDEX_MAP,
  getSameSidePartnerSpawnIndex,
  makeKickoffRawCarState,
  multiDiscreteToOverlayKeys,
  multiDiscreteToKeyString,
} from '../../ai/KickoffPPOAgent.js';
import { hudStore } from '../../ui-system/index';
import { useKickoffTrainingStore } from '../../ui-system/tokens/kickoffTrainingStore';

export function clampSettledKickoffCar(mode, carIdx, spawn, teamSign = 1) {
  const r = mode.runtime;
  if (!r.physics || carIdx >= r.physics.numCars) return;
  const settled = new Float32Array(r.physics.getCarState(carIdx));
  settled[12] = 0.0;
  settled[13] = 0.0;
  settled[14] = 0.0;
  settled[15] = 0.0;
  settled[16] = 0.0;
  settled[17] = 0.0;
  if (Math.abs(spawn.x) < 500.0) {
    settled[0] = spawn.x * teamSign;
    settled[3] = 0.0;
    settled[4] = 1.0 * teamSign;
    settled[6] = -1.0 * teamSign;
    settled[7] = 0.0;
    settled[8] = 0.0;
    settled[9] = 0.0;
  }
  r.physics.setCarState(carIdx, settled);
}

export function clampSettledKickoffPlayerCar(mode, spawn) {
  const r = mode.runtime;
  const carIdx = r.playerCarIndex ?? 0;
  clampSettledKickoffCar(mode, carIdx, spawn, 1);
  if (!mode.ghostModeEnabled && r.physics?.numCars >= 2) {
    if (mode.ghostPlacement === 'opposite') {
      clampSettledKickoffCar(mode, 1, spawn, -1);
    } else {
      const partnerIdx = getSameSidePartnerSpawnIndex(mode.spawnIndex) ?? 4;
      const partnerSpawn = KICKOFF_SPAWNS[partnerIdx] || KICKOFF_SPAWNS[4];
      clampSettledKickoffCar(mode, 1, partnerSpawn, 1);
    }
  }
}

export function resetPlayerCarToKickoffSpawn(mode, spawnIndex, settleImmediate = true) {
  const r = mode.runtime;
  if (!r.physics) return;

  const spawn = KICKOFF_SPAWNS[spawnIndex] || KICKOFF_SPAWNS[0];
  const cppSpawnIdx = CPP_SPAWN_INDEX_MAP[spawnIndex] ?? 0;
  const carIdx = r.playerCarIndex ?? 0;
  const hitboxType = r.selectedHitbox || 'default';

  r.physics.setUnlimitedBoost(false);

  while (r.physics.numCars > 0 && typeof r.physics.removeCar === 'function') {
    r.physics.removeCar(r.physics.numCars - 1);
  }
  r.physics.addCar(0, hitboxType);

  if (!mode.ghostModeEnabled) {
    r.arena?.ensureOpponent?.();
    mode.solidAgent.resetTracker();

    if (mode.ghostPlacement === 'opposite') {
      r.physics.addCar(1, 'default');
      mode.aiTeamSign = -1;
      r.arena?.setCarColor?.(1, 0xf97316);

      if (typeof r.physics.resetKickoffAtSpawn === 'function') {
        r.physics.resetKickoffAtSpawn(cppSpawnIdx, settleImmediate ? KICKOFF_SETTLE_TICKS : 0);
      } else {
        r.physics.resetKickoff(-1);
        r.physics.setCarState(0, makeKickoffRawCarState(spawn.x, spawn.y));
        if (settleImmediate) {
          r.physics.stepSilent(KICKOFF_SETTLE_TICKS);
          clampSettledKickoffCar(mode, 0, spawn, 1);
        }
      }
      r.physics.setControls(0, r.neutralControls);
      r.physics.setControls(1, r.neutralControls);
    } else {
      const partnerIdx = getSameSidePartnerSpawnIndex(spawnIndex) ?? 4;
      const partnerSpawn = KICKOFF_SPAWNS[partnerIdx] || KICKOFF_SPAWNS[4];
      r.physics.addCar(0, 'default');
      mode.aiTeamSign = 1;
      r.arena?.setCarColor?.(1, 0x38bdf8);

      if (typeof r.physics.resetKickoffAtSpawn === 'function') {
        r.physics.resetKickoffAtSpawn(cppSpawnIdx, 0);
      } else {
        r.physics.resetKickoff(-1);
        r.physics.setCarState(0, makeKickoffRawCarState(spawn.x, spawn.y));
      }
      r.physics.setCarState(1, makeKickoffRawCarState(partnerSpawn.x, partnerSpawn.y));
      r.physics.setControls(0, r.neutralControls);
      r.physics.setControls(1, r.neutralControls);

      if (settleImmediate) {
        r.physics.stepSilent(KICKOFF_SETTLE_TICKS);
        clampSettledKickoffCar(mode, 0, spawn, 1);
        clampSettledKickoffCar(mode, 1, partnerSpawn, 1);
      }
    }
  } else {
    if (r.arena?.cars?.[1]) {
      r.arena.cars[1].visible = false;
    }
    if (typeof r.physics.resetKickoffAtSpawn === 'function') {
      r.physics.resetKickoffAtSpawn(cppSpawnIdx, settleImmediate ? KICKOFF_SETTLE_TICKS : 0);
      r.physics.setControls(carIdx, r.neutralControls);
    } else {
      r.physics.resetKickoff(-1);
      const rawState = makeKickoffRawCarState(spawn.x, spawn.y);
      r.physics.setCarState(carIdx, rawState);
      r.physics.setControls(carIdx, r.neutralControls);

      if (settleImmediate) {
        r.physics.stepSilent(KICKOFF_SETTLE_TICKS);
        clampSettledKickoffCar(mode, carIdx, spawn, 1);
      }
    }
  }

  r.botControls = { ...r.neutralControls };
  r.physics.clearEvents();
  r.ballTrajectoryPredictor?.clear?.();
  r.audioSubsystem?.resetAudio?.();
  r.arena?.resetBallTrail?.();
  r.physics.resetView?.();
  r.interpolator?.sync?.();
}

export function resetKickoffTrainingEpisode(mode, spawnIndex = mode.spawnIndex) {
  const r = mode.runtime;
  const store = useKickoffTrainingStore.getState();
  mode.subMode = store.subMode || 'instant';
  mode.ghostPlacement = store.ghostPlacement || 'same';
  mode.ghostModeEnabled = store.ghostModeEnabled ?? true;
  mode.episodeTick = 0;
  mode.playerTouchedBall = false;
  mode.playerTouchTick = null;
  mode.postTouchResetTimer = 0;
  mode.goalResetTicksRemaining = 0;
  mode.currentGhostControls = { ...r.neutralControls };
  r.botControls = { ...r.neutralControls };

  if (mode.ghostSim?.isInitialized) {
    mode.timeline = mode.ghostAgent.precomputeTimeline(mode.ghostSim, spawnIndex, 95);
    mode.aiTouchTick = mode.timeline.touchTick;
    mode.ghostPrevState.set(mode.ghostSim.state);
    mode.ghostCurrState.set(mode.ghostSim.state);
  }

  if (mode.ghostVisuals) {
    mode.ghostVisuals.setGhostPlacement(mode.ghostPlacement);
    mode.ghostVisuals.setVisible(mode.ghostModeEnabled);
    mode.ghostVisuals.resetTrail();
  }

  if (mode.subMode === 'realistic') {
    const waitTicks = store.realisticWaitTicks || 480;
    mode.phase = 'countdown';
    mode.countdownTicksRemaining = waitTicks;
    mode.countdownElapsedTicks = 0;
    mode.latchedCountdownSeconds.clear();

    resetPlayerCarToKickoffSpawn(mode, spawnIndex, false);
    r.physics?.setSimulationFrozen?.(false, 0, true);

    const curTick = Math.floor(r.physics?.getHeaderView?.()?.tickCount ?? 0);
    const targetTick = curTick + waitTicks;
    r.physics?.pushSignalEvent?.(
      MATCH_SIGNALS.KICKOFF_WILL_START,
      curTick,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      targetTick
    );

    const displaySec = Math.min(4, Math.ceil(waitTicks / 120));
    if (r.match) {
      r.match.state.phase = 'kickoff';
      r.match.state.countdown = displaySec;
    }
    hudStore.getState().setMatchState({
      matchPhase: 'kickoff',
      kickoffCountdown: displaySec,
    });
  } else {
    resetPlayerCarToKickoffSpawn(mode, spawnIndex, true);
    mode.phase = 'waiting-for-input';
    mode.countdownTicksRemaining = 0;

    r.physics?.setSimulationFrozen?.(true, 0, true);

    if (r.match) {
      r.match.state.phase = 'playing';
      r.match.state.countdown = 0;
    }
    hudStore.getState().setMatchState({
      matchPhase: 'playing',
      kickoffCountdown: 0,
    });
  }

  const firstStep = mode.timeline?.steps?.[0];
  const reqAct = firstStep ? firstStep.action : [2, 1, 1, 0, 1, 0];
  store.updateLiveState({
    phase: mode.phase,
    episodeTick: 0,
    decisionStep: 0,
    countdownRemainingTicks: mode.countdownTicksRemaining,
    requiredAction: reqAct,
    requiredKeys: multiDiscreteToOverlayKeys(reqAct),
    requiredKeyStr: multiDiscreteToKeyString(reqAct),
    timeline: mode.timeline,
    aiTouchTick: mode.aiTouchTick,
    playerTouchTick: null,
    lastDeltaTicks: null,
    isInputMatching: true,
  });
}
