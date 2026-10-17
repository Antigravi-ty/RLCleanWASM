/**
 * KickoffTrainingMode.js
 * Dedicated Kickoff Training game mode powered by the optimal PPO model from RLRL101.
 */

import { BaseGameMode } from './BaseGameMode.js';
import { RocketSimPhysicsEngine } from '../../physics/RocketSimPhysicsEngine.js';
import {
  KickoffPPOAgent,
  KICKOFF_SPAWNS,
  KICKOFF_SETTLE_TICKS,
  TICKS_PER_DECISION,
  preloadKickoffPPOWeights,
  multiDiscreteToControls,
  controlsToMultiDiscrete,
  multiDiscreteToOverlayKeys,
  multiDiscreteToKeyString,
  areMultiDiscreteActionsEqual,
} from '../../ai/KickoffPPOAgent.js';
import { KickoffGhostVisuals } from './KickoffGhostVisuals.js';
import {
  clampSettledKickoffPlayerCar,
  resetKickoffTrainingEpisode,
} from './KickoffTrainingPhysicsHelper.js';
import { hudStore } from '../../ui-system/index';
import { useKickoffTrainingStore } from '../../ui-system/tokens/kickoffTrainingStore';
import { floatingStore } from '../../ui-system/tokens/floatingStore';
import { KICKOFF_TRAINING_PRESET } from '../../ui-system/tokens/floatingPresets';
import { gameAudio } from '../../audio/AudioArchitecture.js';

export class KickoffTrainingMode extends BaseGameMode {
  constructor(runtime) {
    super('kickoff-training', runtime);

    this.ghostSim = null;
    this.ghostInitPromise = null;
    this.ghostPrevState = null;
    this.ghostCurrState = null;
    this.ghostAgent = new KickoffPPOAgent();
    this.solidAgent = new KickoffPPOAgent();
    this.ghostVisuals = null;

    this.spawnIndex = 0;
    this.subMode = 'instant';
    this.ghostPlacement = 'same';
    this.ghostModeEnabled = true;
    this.aiTeamSign = 1;
    this.phase = 'waiting-for-input';
    this.episodeTick = 0;
    this.countdownTicksRemaining = 0;
    this.countdownElapsedTicks = 0;
    this.latchedCountdownSeconds = new Set();

    this.timeline = null;
    this.currentGhostControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0,
      jump: false, boost: false, handbrake: false,
    };
    this.playerTouchedBall = false;
    this.playerTouchTick = null;
    this.aiTouchTick = null;
    this.postTouchResetTimer = 0;
    this.goalResetTicksRemaining = 0;
  }

  async _ensureGhostEngine() {
    if (this.ghostSim?.isInitialized) return this.ghostSim;
    if (this.ghostInitPromise) return this.ghostInitPromise;

    this.ghostInitPromise = (async () => {
      const sim = new RocketSimPhysicsEngine();
      await sim.init({
        collisionData: RocketSimPhysicsEngine.cachedCollisionData,
        freshInstance: true,
        isolated: true,
      });
      sim.configureCars('default', false, 0);
      sim.setUnlimitedBoost(false);
      this.ghostSim = sim;
      this.ghostPrevState = sim.state.slice();
      this.ghostCurrState = sim.state.slice();
      return sim;
    })();

    return this.ghostInitPromise;
  }

  onEnter() {
    const r = this.runtime;
    const store = useKickoffTrainingStore.getState();

    store.resetToEntryDefaults();
    this.subMode = 'instant';
    this.ghostPlacement = 'same';
    this.ghostModeEnabled = true;
    this.spawnIndex = store.spawnIndex ?? 0;

    r.arena?.ensureOpponent?.();

    store.setRuntimeHandlers({
      onSelectSpawn: (idx) => {
        if (r.match?.state?.mode === 'kickoff-training') this.selectSpawn(idx);
      },
      onResetSpawn: () => {
        if (r.match?.state?.mode === 'kickoff-training') this.selectSpawn(this.spawnIndex);
      },
      onSubModeChange: (nextSubMode) => {
        this.subMode = nextSubMode;
        if (r.match?.state?.mode === 'kickoff-training') this.selectSpawn(this.spawnIndex);
      },
      onSpeedChange: (physicsRate) => {
        if (r.match?.state?.mode === 'kickoff-training' && r.interpolator) {
          r.interpolator.setTrainingPhysicsRate?.(physicsRate);
        }
      },
      onRealisticWaitChange: () => {
        if (r.match?.state?.mode === 'kickoff-training' && this.subMode === 'realistic') {
          this.selectSpawn(this.spawnIndex);
        }
      },
      onGhostPlacementChange: (placement) => {
        this.ghostPlacement = placement;
        this.ghostVisuals?.setGhostPlacement(placement);
        if (r.match?.state?.mode === 'kickoff-training' && !this.ghostModeEnabled) {
          this.selectSpawn(useKickoffTrainingStore.getState().spawnIndex);
        }
      },
      onGhostModeChange: (enabled) => {
        this.ghostModeEnabled = enabled;
        this.ghostVisuals?.setVisible(enabled);
        if (r.match?.state?.mode === 'kickoff-training') {
          this.selectSpawn(useKickoffTrainingStore.getState().spawnIndex);
        }
      },
      onGhostVisibilityChange: (showCar, showBall) => {
        this.ghostVisuals?.setEntityVisibility(showCar, showBall);
      },
    });

    if (r.keyboard) {
      r.keyboard.ballControlEnabled = false;
    }

    r.physics?.setUnlimitedBoost?.(false);

    if (r.interpolator) {
      r.interpolator.setTrainingPhysicsRate?.(store.effectivePhysicsRate || 120);
    }

    if (!this.ghostVisuals && r.arena) {
      this.ghostVisuals = new KickoffGhostVisuals(r.arena);
    }
    if (this.ghostVisuals) {
      this.ghostVisuals.setGhostPlacement('same');
      this.ghostVisuals.setEntityVisibility(store.showGhostCar, store.showGhostBall);
      this.ghostVisuals.setVisible(true);
    }

    const hasWindow = floatingStore.getSnapshot().windows.some(
      (w) => w.id === KICKOFF_TRAINING_PRESET.id
    );
    if (!hasWindow) {
      const w = KICKOFF_TRAINING_PRESET.width ?? 460;
      const posX = typeof window !== 'undefined' ? Math.max(20, window.innerWidth - w - 28) : 40;
      floatingStore.spawnWindow({
        ...KICKOFF_TRAINING_PRESET,
        position: { x: posX, y: 68 },
        startMinimized: false,
      });
    }

    Promise.all([this._ensureGhostEngine(), preloadKickoffPPOWeights()]).then(() => {
      if (r.match?.state?.mode === 'kickoff-training') {
        this.selectSpawn(this.spawnIndex);
      }
    });
  }

  onLeave() {
    const r = this.runtime;
    if (this.ghostVisuals) {
      this.ghostVisuals.setVisible(false);
    }
    if (r.arena?.cars?.[1]) {
      r.arena.cars[1].visible = false;
    }
    r.botControls = { ...r.neutralControls };
    r.physics?.setSimulationFrozen?.(false, 0, false);
    if (r.physics && typeof r.physics.configureCars === 'function') {
      r.physics.configureCars(
        r.selectedPreset === 'flat-car' ? 'flat' : 'default',
        false,
        r.teamAssignment?.playerTeam ?? 1
      );
    }
    if (r.interpolator) {
      r.interpolator.setTrainingPhysicsRate?.(120);
    }
    if (r.keyboard) {
      r.keyboard.ballControlEnabled = (r.match?.state?.mode === 'freeplay');
    }
    const isUnlimited = r.trainingOptions?.boostOption === 'unlimited';
    r.physics?.setUnlimitedBoost?.(isUnlimited);
    hudStore.getState().setMatchState({
      matchPhase: 'playing',
      kickoffCountdown: 0,
    });
  }

  selectSpawn(spawnIndex = this.spawnIndex) {
    const clamped = Math.max(0, Math.min(4, Math.round(spawnIndex)));
    const store = useKickoffTrainingStore.getState();
    this.ghostPlacement = store.ghostPlacement || 'same';
    this.ghostModeEnabled = store.ghostModeEnabled ?? true;

    if (!this.ghostModeEnabled && this.ghostPlacement === 'same' && clamped === 2) {
      return;
    }

    this.spawnIndex = clamped;
    if (store.spawnIndex !== clamped) {
      useKickoffTrainingStore.setState({ spawnIndex: clamped });
    }
    this._resetKickoffEpisode(clamped);
  }

  onResetKickoff() {
    this._resetKickoffEpisode(this.spawnIndex);
  }

  _resetKickoffEpisode(spawnIndex = this.spawnIndex) {
    resetKickoffTrainingEpisode(this, spawnIndex);
  }

  onBeforePhysicsTick() {
    const r = this.runtime;
    const playerAction = controlsToMultiDiscrete(r.playerControls);
    const playerKeys = multiDiscreteToOverlayKeys(playerAction);

    const stepIdx = Math.floor(this.episodeTick / TICKS_PER_DECISION);
    const stepData = this.timeline?.steps?.[stepIdx] || this.timeline?.steps?.[this.timeline.steps.length - 1];
    const requiredAction = stepData ? stepData.action : [1, 1, 1, 0, 0, 0];
    const requiredKeys = stepData ? stepData.keys : multiDiscreteToOverlayKeys(requiredAction);
    const requiredKeyStr = stepData ? stepData.keyStr : multiDiscreteToKeyString(requiredAction);

    const isMatching = areMultiDiscreteActionsEqual(playerAction, requiredAction);
    const isAnyKeyPressed = !areMultiDiscreteActionsEqual(playerAction, [1, 1, 1, 0, 0, 0]);

    if (this.phase === 'countdown') {
      r.physics.setControls(r.playerCarIndex, r.neutralControls);
      if (!this.ghostModeEnabled && r.physics.numCars >= 2) {
        r.physics.setControls(1, r.neutralControls);
      }
      useKickoffTrainingStore.getState().updateLiveState({
        phase: 'countdown',
        countdownRemainingTicks: this.countdownTicksRemaining,
        playerAction,
        playerKeys,
        requiredAction,
        requiredKeys,
        requiredKeyStr,
      });
      return true;
    }

    if (this.subMode === 'instant' && this.phase === 'waiting-for-input') {
      if (isAnyKeyPressed) {
        this.phase = 'running';
        r.physics.setSimulationFrozen(false, 0, false);
        r.physics.setControls(r.playerCarIndex, r.playerControls);
      } else {
        r.physics.setSimulationFrozen(true, 0, true);
        useKickoffTrainingStore.getState().updateLiveState({
          phase: 'waiting-for-input',
          playerAction,
          playerKeys,
          requiredAction,
          requiredKeys,
          requiredKeyStr,
          isInputMatching: false,
        });
        return true;
      }
    }

    if (this.subMode === 'easy-learning') {
      const withinGuidedWindow = !this.playerTouchedBall && this.timeline && stepIdx < this.timeline.steps.length;
      if (withinGuidedWindow) {
        if (!isMatching) {
          this.phase = 'paused-mismatch';
          r.physics.setSimulationFrozen(true, 0, false);
          useKickoffTrainingStore.getState().updateLiveState({
            phase: 'paused-mismatch',
            episodeTick: this.episodeTick,
            decisionStep: stepIdx,
            playerAction,
            playerKeys,
            requiredAction,
            requiredKeys,
            requiredKeyStr,
            isInputMatching: false,
          });
          return false;
        }
        if (this.phase !== 'running') {
          this.phase = 'running';
          r.physics.setSimulationFrozen(false, 0, false);
        }
      } else if (this.phase !== 'running') {
        this.phase = 'running';
        r.physics.setSimulationFrozen(false, 0, false);
      }
    }

    useKickoffTrainingStore.getState().updateLiveState({
      phase: this.phase,
      episodeTick: this.episodeTick,
      decisionStep: stepIdx,
      playerAction,
      playerKeys,
      requiredAction,
      requiredKeys,
      requiredKeyStr,
      isInputMatching: isMatching,
    });

    return true;
  }

  onStepPhysicsTick() {
    const r = this.runtime;
    const audio = r.options?.gameAudio || gameAudio;

    if (this.phase === 'countdown') {
      r.physics.step(1);
      this.countdownElapsedTicks++;
      this.countdownTicksRemaining = Math.max(0, this.countdownTicksRemaining - 1);

      if (this.countdownElapsedTicks === KICKOFF_SETTLE_TICKS) {
        const spawn = KICKOFF_SPAWNS[this.spawnIndex] || KICKOFF_SPAWNS[0];
        clampSettledKickoffPlayerCar(this, spawn);
        if (this.countdownTicksRemaining > 0) {
          r.physics.setSimulationFrozen(true, 0, true);
        }
      }

      const rem = this.countdownTicksRemaining;
      const displaySec = rem > 0 ? Math.min(4, Math.ceil(rem / 120)) : 0;
      if (r.match && r.match.state.countdown !== displaySec) {
        r.match.state.countdown = displaySec;
        hudStore.getState().setMatchState({
          matchPhase: rem > 0 ? 'kickoff' : 'playing',
          kickoffCountdown: displaySec,
        });
      }

      if (rem <= 360 && rem > 240 && !this.latchedCountdownSeconds.has(3)) {
        this.latchedCountdownSeconds.add(3);
        audio?.play?.('match_countdown_321', 1.0);
      } else if (rem <= 240 && rem > 120 && !this.latchedCountdownSeconds.has(2)) {
        this.latchedCountdownSeconds.add(2);
        audio?.play?.('match_countdown_321', 1.0);
      } else if (rem <= 120 && rem > 0 && !this.latchedCountdownSeconds.has(1)) {
        this.latchedCountdownSeconds.add(1);
        audio?.play?.('match_countdown_321', 1.0);
      }

      if (rem <= 0) {
        this.phase = 'running';
        r.physics.setSimulationFrozen(false, 0, false);
        if (r.match) {
          r.match.state.phase = 'playing';
          r.match.state.countdown = 0;
        }
        hudStore.getState().setMatchState({
          matchPhase: 'playing',
          kickoffCountdown: 0,
        });
        audio?.play?.('match_start_go', 1.0);
      }
      return true;
    }

    if (this.phase === 'waiting-for-input') {
      r.physics.step(1);
      return true;
    }

    if (!this.ghostModeEnabled && r.physics.numCars >= 2) {
      if (this.episodeTick % TICKS_PER_DECISION === 0) {
        const solidObs = this.solidAgent.buildObsV3(r.physics, 1, this.solidAgent.obsBuffer, this.aiTeamSign);
        const solidAct = this.solidAgent.actDeterministic(solidObs);
        this.currentGhostControls = multiDiscreteToControls(solidAct);
      }
      r.physics.setControls(1, this.currentGhostControls);
      r.botControls = this.currentGhostControls;
    }

    r.physics.step(1);

    if (!this.ghostModeEnabled && r.physics.numCars >= 2) {
      const sCar = r.physics.getCarStateView(1);
      this.solidAgent.tracker.stepTick(this.currentGhostControls.jump, sCar.isOnGround);
    } else if (this.ghostModeEnabled && this.ghostSim?.isInitialized) {
      if (this.episodeTick % TICKS_PER_DECISION === 0) {
        const obs = this.ghostAgent.buildObsV3(this.ghostSim, 0);
        const act = this.ghostAgent.actDeterministic(obs);
        this.currentGhostControls = multiDiscreteToControls(act);
        this.ghostSim.setControls(0, this.currentGhostControls);
      }
      this.ghostPrevState.set(this.ghostCurrState);
      this.ghostSim.stepSilent(1);
      this.ghostCurrState.set(this.ghostSim.state);

      const gCar = this.ghostSim.getCarStateView(0);
      this.ghostAgent.tracker.stepTick(this.currentGhostControls.jump, gCar.isOnGround);

      const gBall = this.ghostSim.getBallStateView();
      this.ghostVisuals?.recordBallTrajectoryPoint(gBall);
    }

    this.episodeTick++;

    if (!this.playerTouchedBall) {
      const pBall = r.physics.getBallStateView();
      const pBallSpeed = Math.hypot(pBall.velX, pBall.velY, pBall.velZ);
      if (pBallSpeed > 1.0) {
        let playerHitIt = true;
        if (!this.ghostModeEnabled && r.physics.numCars >= 2) {
          const pCar = r.physics.getCarStateView(0);
          const distToBall = Math.hypot(pCar.posX - pBall.posX, pCar.posY - pBall.posY, pCar.posZ - pBall.posZ);
          playerHitIt = distToBall <= 235.0;
        }
        if (playerHitIt) {
          this.playerTouchedBall = true;
          this.playerTouchTick = this.episodeTick;
          const deltaTicks = this.aiTouchTick ? this.playerTouchTick - this.aiTouchTick : 0;
          useKickoffTrainingStore.getState().updateLiveState({
            playerTouchTick: this.playerTouchTick,
            lastDeltaTicks: deltaTicks,
          });
        }
      }
    }

    if (this.goalResetTicksRemaining > 0) {
      this.goalResetTicksRemaining--;
      if (this.goalResetTicksRemaining === 0) {
        this._resetKickoffEpisode(this.spawnIndex);
      }
    }

    return true;
  }

  update(context) {
    const r = this.runtime;
    const { goalScored, playerCarView, dt } = context;

    if (goalScored && !r.trainingOptions?.disableGoalReset && this.goalResetTicksRemaining === 0) {
      this.goalResetTicksRemaining = 54;
    }

    if (playerCarView) {
      hudStore.getState().setBoost(playerCarView.boost, playerCarView.isBoosting, false);
    }

    if (this.ghostModeEnabled && this.ghostVisuals && this.ghostPrevState && this.ghostCurrState) {
      this.ghostVisuals.update(
        this.ghostPrevState,
        this.ghostCurrState,
        r.interpolator?.alpha ?? 0,
        dt,
        this.currentGhostControls
      );
    }
  }
}
