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
import { MultiWorldGhostRenderer } from './MultiWorldGhostRenderer.js';
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

const MULTI_WORLD_SPAWN_PRESETS = Object.freeze([
  { pos: [0, -2560, 17.05], rot: [0, Math.PI / 2, 0] },
  { pos: [0, 2560, 17.05], rot: [0, -Math.PI / 2, 0] },
  { pos: [-1952, -2464, 17.05], rot: [0, Math.PI / 4, 0] },
  { pos: [1952, 2464, 17.05], rot: [0, -3 * Math.PI / 4, 0] },
  { pos: [1952, -2464, 17.05], rot: [0, 3 * Math.PI / 4, 0] },
  { pos: [-1952, 2464, 17.05], rot: [0, -Math.PI / 4, 0] },
  { pos: [-256, -3840, 17.05], rot: [0, Math.PI / 2, 0] },
  { pos: [256, 3840, 17.05], rot: [0, -Math.PI / 2, 0] },
]);

export class DeveloperTestLabMode extends BaseGameMode {
  constructor(runtime) {
    super('dev-test-lab', runtime);
    this.probeState = null;

    this.ghostWorlds = []; // Array of { worldId, sim, prevState, currState }
    this.externalGhostWorlds = new Map(); // Arbitrary external world feeds (3rd+ world custom sync)
    this.ghostWorldsInitPromise = null;
    this.ghostVisuals = null;
    this._currentActiveWorldIdx = 0;

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

  _configureWorldCarsCount(sim, carsPerWorld = 1, worldIndex = 0, syncArenaVisuals = false) {
    if (!sim) return;
    const targetCount = Math.max(1, Math.min(8, Math.round(carsPerWorld || 1)));
    while (sim.numCars > targetCount && typeof sim.removeCar === 'function') {
      sim.removeCar(sim.numCars - 1);
    }
    const existingCars = sim.numCars;
    while (sim.numCars < targetCount) {
      const slotIdx = sim.numCars;
      const team = slotIdx % 2;
      sim.addCar(team, 'octane');
    }
    sim.setUnlimitedBoost(true);

    // Position any newly added cars at deterministic non-overlapping spawns
    for (let c = existingCars; c < targetCount; c++) {
      const preset = MULTI_WORLD_SPAWN_PRESETS[(c + worldIndex) % MULTI_WORLD_SPAWN_PRESETS.length];
      sim.setCarState(c, {
        pos: [
          preset.pos[0] + (worldIndex * 160 * (c % 2 === 0 ? 1 : -1)),
          preset.pos[1],
          preset.pos[2],
        ],
        vel: [0, 0, 0],
        angVel: [0, 0, 0],
        rot: preset.rot,
        boost: 100,
      });
    }

    if (syncArenaVisuals && this.runtime?.arena) {
      const arena = this.runtime.arena;
      while (arena.cars.length < targetCount && typeof arena.addExtraCarVisual === 'function') {
        const slotIdx = arena.cars.length;
        arena.addExtraCarVisual('game-car', slotIdx % 2 === 0 ? 0x3b82f6 : 0xf97316);
      }
      for (let i = 0; i < arena.cars.length; i++) {
        if (arena.cars[i]) arena.cars[i].visible = i < targetCount;
      }
    }
  }

  _resetSecondaryWorldSpawn(sim, worldIndex = 1, carsPerWorld = 1) {
    if (!sim) return;
    sim.resetKickoff(0, false);
    this._configureWorldCarsCount(sim, carsPerWorld, worldIndex, false);
    for (let c = 0; c < Math.min(8, carsPerWorld); c++) {
      const preset = MULTI_WORLD_SPAWN_PRESETS[(c + worldIndex) % MULTI_WORLD_SPAWN_PRESETS.length];
      sim.setCarState(c, {
        pos: [
          preset.pos[0] + (worldIndex * 180 * (c % 2 === 0 ? 1 : -1)),
          preset.pos[1],
          preset.pos[2],
        ],
        vel: [0, 0, 0],
        angVel: [0, 0, 0],
        rot: preset.rot,
        boost: 100,
      });
    }
    sim.setBallState({
      pos: [worldIndex * 220 * (worldIndex % 2 === 1 ? 1 : -1), 0, 93.15],
      vel: [0, 0, 0],
      angVel: [0, 0, 0],
    });
    sim.step(1);
  }

  async _ensureGhostWorldEngines(ghostEngineCount = 1, carsPerWorld = 1) {
    const needed = Math.max(1, Math.min(7, ghostEngineCount));
    if (this.ghostWorldsInitPromise) {
      await this.ghostWorldsInitPromise;
    }

    this.ghostWorldsInitPromise = (async () => {
      while (this.ghostWorlds.length < needed) {
        const wIdx = this.ghostWorlds.length + 1;
        const sim = new RocketSimPhysicsEngine();
        await sim.init({
          collisionData: RocketSimPhysicsEngine.cachedCollisionData,
          freshInstance: true,
          isolated: true,
        });
        sim.configureCars('default', false, 0);
        this._resetSecondaryWorldSpawn(sim, wIdx, carsPerWorld);
        this.ghostWorlds.push({
          worldId: `world-${wIdx}`,
          worldIndex: wIdx,
          sim,
          prevState: sim.state.slice(),
          currState: sim.state.slice(),
        });
      }
      for (let i = 0; i < needed; i++) {
        const gw = this.ghostWorlds[i];
        this._configureWorldCarsCount(gw.sim, carsPerWorld, i + 1, false);
        gw.prevState.set(gw.sim.state);
        gw.currState.set(gw.sim.state);
      }
      return this.ghostWorlds.slice(0, needed);
    })();

    return this.ghostWorldsInitPromise;
  }

  /**
   * Public API to inject or synchronize an arbitrary external Ghost World (3rd world, 4th world, etc.)
   * with up to 8 cars + 1 ball.
   */
  syncExternalGhostWorld(worldId, prevState, currState, options = {}) {
    if (!prevState || !currState) return;
    this.externalGhostWorlds.set(worldId, {
      worldId,
      prevState: prevState instanceof Float32Array ? prevState : new Float32Array(prevState),
      currState: currState instanceof Float32Array ? currState : new Float32Array(currState),
      options,
    });
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
      this.ghostVisuals = new MultiWorldGhostRenderer(r.arena);
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
    if (!this.ghostVisuals && r.arena) this.ghostVisuals = new MultiWorldGhostRenderer(r.arena);
    if (store.activeTab === 'dual-world' && store.dualWorldEnabled) {
      const totalWorlds = Math.max(2, Math.min(4, store.ghostWorldCount || 2));
      const ghostCount = totalWorlds - 1;
      const carsPerWorld = Math.max(1, Math.min(8, store.ghostCarsPerWorld || 1));

      if (r.physics) {
        parkDevTestLabProbes(r.physics, r.arena);
        this.probeState = null;
        this._configureWorldCarsCount(r.physics, carsPerWorld, 0, true);
      }

      this._ensureGhostWorldEngines(ghostCount, carsPerWorld).then((ghostList) => {
        const latestStore = useDevTestLabStore.getState();
        if (latestStore.activeTab !== 'dual-world' || !this.ghostVisuals) return;
        const opacity = latestStore.ghostOpacity;

        for (let i = 0; i < this.ghostWorlds.length; i++) {
          const gw = this.ghostWorlds[i];
          const isActiveGhost = i < ghostList.length;
          this.ghostVisuals.ensureWorld(gw.worldId, {
            paletteIndex: i + 1,
            opacity,
            showCar: true,
            showBall: true,
          });
          this.ghostVisuals.setVisible(isActiveGhost, gw.worldId);
        }
        this.ghostVisuals.setVisible(true);
        this.ghostVisuals.setOpacity(opacity);
      });
    } else if (this.ghostVisuals) {
      this.ghostVisuals.setVisible(false);
    }
  }

  _handleSwitchWorld() {
    const r = this.runtime;
    const store = useDevTestLabStore.getState();
    const totalWorlds = Math.max(2, Math.min(4, store.ghostWorldCount || 2));
    const ghostCount = totalWorlds - 1;
    const carsPerWorld = Math.max(1, Math.min(8, store.ghostCarsPerWorld || 1));
    if (!r.physics || this.ghostWorlds.length < ghostCount) return;

    // Rotate snapshots across (Primary World -> Ghost World 1 -> ... -> Ghost World K -> Primary World)
    const primarySnap = r.physics.saveState();
    const ghostSnaps = [];
    for (let i = 0; i < ghostCount; i++) {
      ghostSnaps.push(this.ghostWorlds[i].sim.saveState());
    }

    r.physics.restoreState(ghostSnaps[0]);
    this._configureWorldCarsCount(r.physics, carsPerWorld, 0, true);

    for (let i = 0; i < ghostCount - 1; i++) {
      this.ghostWorlds[i].sim.restoreState(ghostSnaps[i + 1]);
    }
    this.ghostWorlds[ghostCount - 1].sim.restoreState(primarySnap);

    r.interpolator?.sync?.();
    for (let i = 0; i < ghostCount; i++) {
      const gw = this.ghostWorlds[i];
      gw.prevState.set(gw.sim.state);
      gw.currState.set(gw.sim.state);
    }
    if (this.ghostVisuals) {
      this.ghostVisuals.setOpacity(store.ghostOpacity);
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

    if (activeTab === 'dual-world' && store.dualWorldEnabled) {
      const ghostCount = Math.max(1, Math.min(3, (store.ghostWorldCount || 2) - 1));
      const carsPerWorld = Math.max(1, Math.min(8, store.ghostCarsPerWorld || 1));
      for (let i = 0; i < Math.min(ghostCount, this.ghostWorlds.length); i++) {
        const gw = this.ghostWorlds[i];
        if (!gw?.sim?.isInitialized) continue;
        gw.prevState.set(gw.currState);
        for (let c = 0; c < Math.min(carsPerWorld, gw.sim.numCars); c++) {
          gw.sim.setControls(c, r.neutralControls);
        }
        gw.sim.step(1);
        gw.currState.set(gw.sim.state);
      }
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

    if (store.activeTab === 'dual-world' && store.dualWorldEnabled && this.ghostVisuals) {
      const alpha = r.interpolator?.alpha ?? 1.0;
      const frameDt = dt ?? 0.016;
      const ghostCount = Math.max(1, Math.min(3, (store.ghostWorldCount || 2) - 1));

      for (let i = 0; i < Math.min(ghostCount, this.ghostWorlds.length); i++) {
        const gw = this.ghostWorlds[i];
        if (!gw?.sim?.isInitialized) continue;
        this.ghostVisuals.updateWorld(
          gw.worldId,
          gw.prevState,
          gw.currState,
          alpha,
          frameDt,
          {
            paletteIndex: i + 1,
            controls: r.neutralControls,
            showBall: true,
          }
        );
      }

      for (const ext of this.externalGhostWorlds.values()) {
        this.ghostVisuals.updateWorld(
          ext.worldId,
          ext.prevState,
          ext.currState,
          alpha,
          frameDt,
          ext.options || { showBall: true }
        );
      }
    }
    if (playerCarView) {
      hudStore.getState().setBoost(playerCarView.boost, playerCarView.isBoosting, store.activeTab !== 'incident-match');
    }
  }
}
