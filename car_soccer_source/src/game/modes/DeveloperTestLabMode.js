/**
 * DeveloperTestLabMode.js
 * Standalone Developer Test Lab game mode ('dev-test-lab') providing 4 isolated, mutually-exclusive test benches:
 * 1. Bench 1 ('probes'): 2-Car Predictive & Non-Predictive Probes (Strictly Inside Arena)
 * 2. Bench 2 ('dual-world'): Dual-World Same-Map Ghost Sandbox
 * 3. Bench 3 ('state-replay'): State Replay Scrubbing & Resume Sandbox (Hotkeys O / P / [ / ])
 * 4. Bench 4 ('incident-match'): 1:30 (90s) Incident, Overtime, Countdown, Speed Multiplier & Possession Match
 */

import { BaseGameMode } from './BaseGameMode.js';
import { RocketSimPhysicsEngine } from '../../physics/RocketSimPhysicsEngine.js';
import { KickoffGhostVisuals } from './KickoffGhostVisuals.js';
import {
  PROBE_BOOST_SLOT,
  PROBE_QE_SLOT,
  setupDevTestLabProbes,
  parkDevTestLabProbes,
  stepDevTestLabProbes,
} from './DevTestLabProbesHelper.js';
import {
  bindDevTestLabReplayHotkeys,
  unbindDevTestLabReplayHotkeys,
  applyTasFrameAtCursor,
  recordTasFrameAfterTick,
} from './DevTestLabReplayHelper.js';
import {
  applyIncidentControlledCar,
  applyIncidentSpeedMultiplier,
  startIncidentMatchSession,
  handleIncidentControlModeSwitch,
  triggerIncidentSandboxAction,
  stepIncidentMatchTick,
} from './DevTestLabIncidentMatchHelper.js';
import { DEFAULT_CAR_CONTROLS } from '../../ai/RLBotAgent.js';
import { useDevTestLabStore } from '../../ui-system/tokens/devTestLabStore';
import { hudStore } from '../../ui-system/index';
import { floatingStore } from '../../ui-system/tokens/floatingStore';
import { DEV_TEST_LAB_PRESET } from '../../ui-system/tokens/floatingPresets';

export class DeveloperTestLabMode extends BaseGameMode {
  constructor(runtime) {
    super('dev-test-lab', runtime);
    this.probeState = null;

    this.secondarySim = null;
    this.secondaryInitPromise = null;
    this.secondaryPrevState = null;
    this.secondaryCurrState = null;
    this.ghostVisuals = null;

    this.tasFrames = [];
    this.tasCursor = 0;
    this.tasScrubAccumulator = 0;
    this._keyDownHandler = null;
    this._keyUpHandler = null;

    this.botBlue = null;
    this.botOrange = null;
    this.botBlueControls = { ...DEFAULT_CAR_CONTROLS };
    this.botOrangeControls = { ...DEFAULT_CAR_CONTROLS };
    this.botBlueTickSkip = 0;
    this.botOrangeTickSkip = 0;
    this.botBlueDeciding = false;
    this.botOrangeDeciding = false;
    this.botDecisionEpoch = 0;
    this.incidentKickoffStep = 0;

    this.incidentCountdownTicks = 0;
    this.incidentTicksSinceKickoff = 0;
    this.incidentClockStarted = false;
    this.incidentClockTickAccum = 0;
    this.incidentRemainingSec = 90;
    this.incidentOvertime = false;
    this.incidentPhase = 'kickoff';
    this.incidentBlueScore = 0;
    this.incidentOrangeScore = 0;
    this.incidentPauseResumeTicks = 0;
    this.incidentGoalResetTicks = 0;
    this.incidentLatched10s = -1;
  }

  _resetSecondaryWorldSpawn(sim) {
    if (!sim) return;
    while (sim.numCars > 1 && typeof sim.removeCar === 'function') {
      sim.removeCar(sim.numCars - 1);
    }
    if (sim.numCars < 1) sim.addCar(0, 'octane');
    sim.setUnlimitedBoost(true);
    sim.resetKickoff(0, false);
    sim.setCarState(0, {
      pos: [0, 2560, 17.05],
      vel: [0, 0, 0],
      angVel: [0, 0, 0],
      rot: [0, -Math.PI / 2, 0],
      boost: 100,
    });
    sim.setBallState({ pos: [0, 0, 93.15], vel: [0, 0, 0], angVel: [0, 0, 0] });
    sim.step(1);
  }

  async _ensureSecondaryEngine() {
    if (this.secondarySim?.isInitialized) return this.secondarySim;
    if (this.secondaryInitPromise) return this.secondaryInitPromise;

    this.secondaryInitPromise = (async () => {
      const sim = new RocketSimPhysicsEngine();
      await sim.init({
        collisionData: RocketSimPhysicsEngine.cachedCollisionData,
        freshInstance: true,
        isolated: true,
      });
      sim.configureCars('default', false, 0);
      this._resetSecondaryWorldSpawn(sim);
      this.secondarySim = sim;
      this.secondaryPrevState = sim.state.slice();
      this.secondaryCurrState = sim.state.slice();
      return sim;
    })();
    return this.secondaryInitPromise;
  }

  _ensureSinglePlayerCarOnly() {
    const r = this.runtime;
    if (!r?.physics) return;
    parkDevTestLabProbes(r.physics, r.arena);
    this.probeState = null;
    while (r.physics.numCars > 1 && typeof r.physics.removeCar === 'function') {
      r.physics.removeCar(r.physics.numCars - 1);
    }
    if (r.arena?.cars) {
      for (let i = 1; i < r.arena.cars.length; i++) {
        if (r.arena.cars[i]) r.arena.cars[i].visible = false;
      }
    }
    this._applyProbeCameraTarget('player');
  }

  onEnter() {
    const r = this.runtime;
    const store = useDevTestLabStore.getState();

    floatingStore.setOpacity(70);
    const hasWindow = floatingStore.getSnapshot().windows.some((w) => w.id === DEV_TEST_LAB_PRESET.id);
    if (!hasWindow) {
      const w = DEV_TEST_LAB_PRESET.width ?? 470;
      const posX = typeof window !== 'undefined' ? Math.max(20, window.innerWidth - w - 28) : 40;
      floatingStore.spawnWindow({ ...DEV_TEST_LAB_PRESET, position: { x: posX, y: 68 }, startMinimized: false });
    } else {
      floatingStore.restoreWindow(DEV_TEST_LAB_PRESET.id);
    }

    if (!this.ghostVisuals && r.arena) {
      this.ghostVisuals = new KickoffGhostVisuals(r.arena);
    }

    store.setRuntimeHandlers({
      onTabChange: (tab) => this._handleTabSwitch(tab),
      onProbesConfigChange: () => this._syncProbesConfiguration(),
      onProbeCameraChange: (target) => this._applyProbeCameraTarget(target),
      onDualWorldConfigChange: () => this._syncDualWorldConfiguration(),
      onSwitchWorld: (idx) => this._handleSwitchWorld(idx),
      onTasStartRecording: () => this.startTasRecording(),
      onTasStopRecording: () => this.stopTasRecording(),
      onTasPushBackwardStart: () => this.beginTasScrub('rewinding'),
      onTasPushBackwardStop: () => this.pauseTasScrub(),
      onTasPushForwardStart: () => this.beginTasScrub('forwarding'),
      onTasPushForwardStop: () => this.pauseTasScrub(),
      onTasResumeFromHere: () => this.resumeTasFromCursor(),
      onTasCancelToFreeplay: () => this.cancelTasToFreeplay(),
      onStartIncidentMatch: (oppMode) => this.startIncidentMatch(oppMode),
      onIncidentControlModeChange: (oppMode) => handleIncidentControlModeSwitch(this, oppMode),
      onIncidentControlledCarChange: (carIdx) => applyIncidentControlledCar(this, carIdx),
      onIncidentSpeedMultiplierChange: (mult) => applyIncidentSpeedMultiplier(this, mult),
      onTriggerIncidentAction: (action) => this.triggerIncidentAction(action),
    });

    bindDevTestLabReplayHotkeys(this);
    if (r.keyboard) r.keyboard.ballControlEnabled = true;
    r.physics?.setUnlimitedBoost?.(true);
    this._handleTabSwitch(store.activeTab || 'probes');
  }

  onLeave() {
    const r = this.runtime;
    unbindDevTestLabReplayHotkeys(this);
    this.botDecisionEpoch++;

    r.interpolator?.setTrainingPhysicsRate?.(120);
    if (r.physics) {
      this._ensureSinglePlayerCarOnly();
      r.physics.setSimulationFrozen?.(false, 0, false);
      r.physics.setUnlimitedBoost?.(true);
    }
    if (this.ghostVisuals) this.ghostVisuals.setVisible(false);
    useDevTestLabStore.getState().updateLiveTelemetry({
      tasState: 'idle',
      incidentMatchActive: false,
      probeCameraTarget: 'player',
    });
  }

  _handleTabSwitch(tab) {
    const r = this.runtime;
    const store = useDevTestLabStore.getState();
    this.botDecisionEpoch++;

    if (tab !== 'probes') {
      if (r.physics) parkDevTestLabProbes(r.physics, r.arena);
      this.probeState = null;
      this._applyProbeCameraTarget('player');
    }
    if (tab !== 'dual-world' && this.ghostVisuals) {
      this.ghostVisuals.setVisible(false);
    }
    if (tab !== 'state-replay' && store.tasState !== 'idle' && store.tasState !== 'stopped') {
      store.updateLiveTelemetry({ tasState: 'stopped' });
    }
    if (tab !== 'incident-match') {
      this.incidentPauseResumeTicks = 0;
      this.incidentGoalResetTicks = 0;
      this.incidentCountdownTicks = 0;
      r.interpolator?.setTrainingPhysicsRate?.(120);
      r.physics?.setUnlimitedBoost?.(true);
    }

    if (tab === 'probes') {
      this._ensureSinglePlayerCarOnly();
      this._syncProbesConfiguration();
    } else if (tab === 'dual-world') {
      this._ensureSinglePlayerCarOnly();
      this._syncDualWorldConfiguration();
    } else if (tab === 'state-replay') {
      this._ensureSinglePlayerCarOnly();
    } else if (tab === 'incident-match') {
      this.startIncidentMatch(store.incidentOpponentMode);
    }
  }

  _syncProbesConfiguration() {
    const r = this.runtime;
    const store = useDevTestLabStore.getState();
    if (!r.physics) return;

    if (store.activeTab === 'probes' && store.probesEnabled) {
      this.probeState = setupDevTestLabProbes(r.physics, r.arena, store.probeBaseAltitudeZ, store.probePeakAltitudeZ);
    } else {
      parkDevTestLabProbes(r.physics, r.arena);
      this.probeState = null;
      if (store.probeCameraTarget !== 'player') this._applyProbeCameraTarget('player');
    }
  }

  _applyProbeCameraTarget(target) {
    const r = this.runtime;
    if (!r) return;
    r.playerCarIndex = target === 'boost_probe' ? PROBE_BOOST_SLOT : target === 'qe_probe' ? PROBE_QE_SLOT : 0;
    if (r.arena) r.arena.playerCarIndex = r.playerCarIndex;
  }

  _syncDualWorldConfiguration() {
    const r = this.runtime;
    const store = useDevTestLabStore.getState();
    if (!this.ghostVisuals && r.arena) this.ghostVisuals = new KickoffGhostVisuals(r.arena);
    if (store.activeTab === 'dual-world' && store.dualWorldEnabled) {
      this._ensureSinglePlayerCarOnly();
      this._ensureSecondaryEngine().then((sim) => {
        if (useDevTestLabStore.getState().activeTab !== 'dual-world') return;
        while (sim.numCars > 1 && typeof sim.removeCar === 'function') sim.removeCar(sim.numCars - 1);
        if (!this.ghostVisuals) return;
        this.ghostVisuals.ensureBuilt();
        this.ghostVisuals.setGhostPlacement('same');
        this.ghostVisuals.setEntityVisibility(true, true);
        this.ghostVisuals.setVisible(true);
        const opacity = useDevTestLabStore.getState().ghostOpacity;
        for (const mat of this.ghostVisuals.ghostCarMaterials || []) mat.opacity = opacity;
        if (this.ghostVisuals.ghostBallMesh?.material) {
          this.ghostVisuals.ghostBallMesh.material.opacity = opacity * 0.85;
        }
      });
    } else if (this.ghostVisuals) {
      this.ghostVisuals.setVisible(false);
    }
  }

  _handleSwitchWorld() {
    const r = this.runtime;
    if (!r.physics || !this.secondarySim?.isInitialized) return;
    this._ensureSinglePlayerCarOnly();
    while (this.secondarySim.numCars > 1 && typeof this.secondarySim.removeCar === 'function') {
      this.secondarySim.removeCar(this.secondarySim.numCars - 1);
    }
    const snapA = r.physics.saveState();
    const snapB = this.secondarySim.saveState();
    r.physics.restoreState(snapB);
    this.secondarySim.restoreState(snapA);
    r.interpolator?.sync?.();
    this.secondaryPrevState.set(this.secondarySim.state);
    this.secondaryCurrState.set(this.secondarySim.state);
    if (this.ghostVisuals) {
      this.ghostVisuals.setGhostPlacement('same');
      const opacity = useDevTestLabStore.getState().ghostOpacity;
      for (const mat of this.ghostVisuals.ghostCarMaterials || []) mat.opacity = opacity;
    }
  }

  startTasRecording() {
    const r = this.runtime;
    if (!r.physics) return;
    this._ensureSinglePlayerCarOnly();
    this.tasFrames = [];
    this.tasCursor = 0;
    this.tasScrubAccumulator = 0;
    r.physics.clearReplayBuffer?.();
    useDevTestLabStore.getState().updateLiveTelemetry({ tasState: 'recording', tasRecordedFrames: 0, tasCursorFrame: 0 });
  }

  stopTasRecording() {
    const store = useDevTestLabStore.getState();
    if (store.tasState === 'recording') {
      store.updateLiveTelemetry({ tasState: 'stopped', tasCursorFrame: Math.max(0, this.tasFrames.length - 1) });
    }
  }

  beginTasScrub(direction = 'rewinding') {
    if (this.tasFrames.length === 0) return;
    const store = useDevTestLabStore.getState();
    if (store.tasState === 'recording') this.tasCursor = this.tasFrames.length - 1;
    this.tasScrubAccumulator = 0;
    store.updateLiveTelemetry({ tasState: direction, tasCursorFrame: this.tasCursor });
  }

  pauseTasScrub() {
    const store = useDevTestLabStore.getState();
    if (store.tasState === 'rewinding' || store.tasState === 'forwarding') {
      store.updateLiveTelemetry({ tasState: 'paused-scrub', tasCursorFrame: this.tasCursor });
    }
  }

  resumeTasFromCursor() {
    const r = this.runtime;
    if (!r.physics || this.tasFrames.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(this.tasFrames.length - 1, Math.round(this.tasCursor)));
    const entry = this.tasFrames[clampedIdx];
    if (entry?.arenaSnap) {
      r.physics.restoreState(entry.arenaSnap);
      r.interpolator?.sync?.();
    }
    useDevTestLabStore.getState().updateLiveTelemetry({ tasState: 'stopped', tasCursorFrame: clampedIdx });
  }

  cancelTasToFreeplay() {
    const r = this.runtime;
    this.tasFrames = [];
    this.tasCursor = 0;
    r.physics?.resetKickoff?.(0, false);
    r.interpolator?.sync?.();
    useDevTestLabStore.getState().updateLiveTelemetry({ tasState: 'idle', tasRecordedFrames: 0, tasCursorFrame: 0 });
  }

  async startIncidentMatch(opponentMode = 'stationary') {
    return startIncidentMatchSession(this, opponentMode);
  }

  triggerIncidentAction(action) {
    return triggerIncidentSandboxAction(this, action);
  }

  onBeforePhysicsTick() {
    const r = this.runtime;
    const store = useDevTestLabStore.getState();
    const activeTab = store.activeTab;

    if (
      activeTab === 'state-replay' &&
      (store.tasState === 'rewinding' || store.tasState === 'forwarding' || store.tasState === 'paused-scrub')
    ) {
      if (store.tasState === 'rewinding' || store.tasState === 'forwarding') {
        const stepPerTick = (store.tasEffectiveFlowPct || 100) / 100;
        this.tasCursor = store.tasState === 'rewinding'
          ? Math.max(0, this.tasCursor - stepPerTick)
          : Math.min(Math.max(0, this.tasFrames.length - 1), this.tasCursor + stepPerTick);
        applyTasFrameAtCursor(this);
        store.updateLiveTelemetry({ tasCursorFrame: Math.round(this.tasCursor) });
      }
      return false;
    }

    if (activeTab === 'incident-match' && store.incidentMatchActive && this.incidentPauseResumeTicks > 0) {
      this.incidentPauseResumeTicks--;
      if (this.incidentPauseResumeTicks % 12 === 0) {
        this.incidentPhase = `will-resume (${(this.incidentPauseResumeTicks / 120).toFixed(1)}s)`;
        store.updateLiveTelemetry({ incidentPhase: this.incidentPhase });
      }
      if (this.incidentPauseResumeTicks === 0) {
        this.incidentPhase = this.incidentOvertime ? 'overtime' : 'playing';
        store.updateLiveTelemetry({ incidentPhase: this.incidentPhase });
      }
      return false;
    }

    if (activeTab === 'probes' && store.probesEnabled && r.physics) {
      if (!this.probeState) this._syncProbesConfiguration();
      const probeTelemetry = stepDevTestLabProbes(r.physics, this.probeState);
      if (probeTelemetry && this.probeState.tickCounter % 4 === 0) {
        store.updateLiveTelemetry({
          probeBoostZ: probeTelemetry.posZ,
          probeBoostVz: probeTelemetry.velZ,
          probeBoostPhase: probeTelemetry.phase,
          probeBoostHoldTicks: probeTelemetry.holdCounter,
          probeRollDir: probeTelemetry.rollDir,
        });
      }
    }

    if (activeTab === 'dual-world' && store.dualWorldEnabled && this.secondarySim?.isInitialized) {
      this.secondaryPrevState.set(this.secondaryCurrState);
      this.secondarySim.setControls(0, r.neutralControls);
      this.secondarySim.step(1);
      this.secondaryCurrState.set(this.secondarySim.state);
    }

    if (activeTab === 'incident-match' && store.incidentMatchActive && r.physics) {
      stepIncidentMatchTick(this, store);
    }
    return true;
  }

  onAfterPhysicsTick() {
    recordTasFrameAfterTick(this, useDevTestLabStore.getState());
  }

  update(context) {
    const r = this.runtime;
    const { dt, playerCarView } = context;
    const store = useDevTestLabStore.getState();

    if (store.activeTab === 'dual-world' && store.dualWorldEnabled && this.ghostVisuals && this.secondarySim?.isInitialized) {
      this.ghostVisuals.update(
        this.secondaryPrevState,
        this.secondaryCurrState,
        r.interpolator?.alpha ?? 1.0,
        dt ?? 0.016,
        r.neutralControls,
        false
      );
    }
    if (playerCarView) {
      hudStore.getState().setBoost(playerCarView.boost, playerCarView.isBoosting, store.activeTab !== 'incident-match');
    }
  }
}
