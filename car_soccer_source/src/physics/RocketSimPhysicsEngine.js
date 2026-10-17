/**
 * RocketSimPhysicsEngine.js
 * Clean, modern wrapper for RocketSim WebAssembly simulation core.
 *
 * Parallel Dual-WASM Architecture:
 * 1. core.wasm (compiled from ReWASM C++ source): handles arena physics, car simulation, collision raycasts.
 * 2. camera.wasm (exempt POV microkernel): handles 3rd-person follow/ball-cam tracking calculations.
 */

import { loadRocketSimWasmModule } from './RocketSimWasm.js';
import { loadCameraMicrokernel, CameraMicrokernel } from '../camera/exempt_pov_microkernel/CameraMicrokernel.js';
import {
  PLAYER_CAR_INDEX, BOT_CAR_INDEX, getTeamAssignment, getHitboxIndex,
  fetchArenaCollisionMeshes, initWasmCollisionMeshes
} from './RocketSimMeshLoader.js';
import {
  SIM_OFFSETS, EXTENDED_STATE_OFFSETS, BALL_CONTROL_MODES, BALL_STATE_STRIDE,
  CAR_STATE_STRIDE, BOOST_PAD_STATES_OFFSET, BOOST_PAD_STATE_STRIDE,
  NUM_BOOST_PADS, PHYSICS_EVENT_TYPES, PHYSICS_EVENT_FLAGS, EVENT_TOTAL_BUFFER_BYTES
} from './RocketSimConstants.js';
import {
  CarStateView, BallStateView, ArenaHeaderView, BoostPadStateView, GameStateView
} from './RocketSimStateViews.js';
import { PhysicsEventReader } from './PhysicsEventReader.js';
import {
  writeCarControlsToEngine, readPhysicsEvents, applyBallStateToEngine, applyCarStateToEngine,
  ensureWasmSnapshotBuffer, saveWasmSnapshotState, saveCompactStateSnapshot, restoreWasmSnapshotState, readArenaPads
} from './RocketSimSnapshotHelper.js';

export { PLAYER_CAR_INDEX, BOT_CAR_INDEX, getTeamAssignment, getHitboxIndex };

export class RocketSimPhysicsEngine {
  static cachedCollisionData = null;

  constructor() {
    this.module = null;
    this.cameraKernel = null;
    this.statePtr = 0;
    this.stateLen = 0;
    this.controlsPtr = 0;
    this.viewPtr = 0;
    this.eventBufferPtr = 0;
    this.eventBufferSize = 0;
    this.eventReader = null;
    this.stateView = null;
    this.controlsView = null;
    this.viewView = null;
    this.headerViewInstance = null;
    this.gameStateViewInstance = null;
    this.ballStateViewInstance = null;
    this.carStateViewInstances = [];
    this.boostPadStateViewInstances = [];
    this.wasmStatePtr = 0;
    this.wasmStateSize = 0;
    this.cachedSnapshotBuffer = null;
    this.isUnlimitedBoost = false;
    this._accumulatedBluePossessionPts = 0;
    this._accumulatedOrangePossessionPts = 0;
    this._lastRawBluePossessionPts = 0;
    this._lastRawOrangePossessionPts = 0;
  }

  get state() {
    const buffer = this.module.HEAPF32.buffer;
    if (!this.stateView || this.stateView.buffer !== buffer) {
      this.stateView = new Float32Array(buffer, this.statePtr, this.stateLen);
    }
    return this.stateView;
  }

  async init(options = {}) {
    if (options.collisionData) {
      RocketSimPhysicsEngine.cachedCollisionData = options.collisionData;
    }
    const [module, cameraKernel] = await Promise.all([
      loadRocketSimWasmModule(options),
      loadCameraMicrokernel(options)
    ]);
    this.module = module;
    this.cameraKernel = cameraKernel;
    this.isInitialized = true;

    const collisionData = await fetchArenaCollisionMeshes(RocketSimPhysicsEngine.cachedCollisionData);
    RocketSimPhysicsEngine.cachedCollisionData = collisionData;
    initWasmCollisionMeshes(this.module, collisionData);

    if (this.module._physics_createArena() !== 1) throw new Error('Arena creation failed');
    if (!this.cameraKernel) throw new Error('[FATAL] POV Camera Microkernel is missing in RocketSimPhysicsEngine!');
    this.viewPtr = this.cameraKernel.getViewPtr();

    this.statePtr = this.module._physics_getStatePtr();
    this.stateLen = this.module._physics_getStateSize();
    this.controlsPtr = this.module._physics_getControlsPtr();

    if (typeof this.module._physics_getEventBufferPtr === 'function') {
      this.eventBufferPtr = this.module._physics_getEventBufferPtr();
      this.eventBufferSize = this.module._physics_getEventBufferSize?.() ?? EVENT_TOTAL_BUFFER_BYTES;
      this.eventReader = new PhysicsEventReader(this.module.HEAPU8.buffer, this.eventBufferPtr);
    } else {
      this.eventReader = null;
    }

    this.stateView = null;
    this.controlsView = null;
    this.viewView = null;
    this.resetView();
  }

  getEventBufferPtr() {
    return this.eventBufferPtr || (this.module?._physics_getEventBufferPtr?.() ?? 0);
  }

  getEventBufferSize() {
    return this.eventBufferSize || (this.module?._physics_getEventBufferSize?.() ?? EVENT_TOTAL_BUFFER_BYTES);
  }

  clearEvents() {
    this.module?._physics_clearEvents?.();
    this.eventReader?.reset();
    this.syntheticFallback?.reset();
  }

  setImpactThresholds(ballGround = 140.0, ballWall = 160.0, carBall = 50.0, cooldownTicks = 8) {
    this.module?._physics_setImpactThresholds?.(ballGround, ballWall, carBall, cooldownTicks);
  }

  setSurfaceTaxonomyThresholds(floorNz = 0.8, netNz = 0.05) {
    this.floorNz = floorNz;
    this.netNz = netNz;
    this.module?._physics_setSurfaceTaxonomyThresholds?.(floorNz, netNz);
  }

  setDirectionDotThreshold(minDirDot = 0.0) {
    this.minDirDot = minDirDot;
    this.module?._physics_setDirectionDotThreshold?.(minDirDot);
  }

  getSurfaceTaxonomyThresholds() {
    return { floorNz: this.floorNz ?? 0.8, netNz: this.netNz ?? 0.05 };
  }

  getDirectionDotThreshold() {
    return this.minDirDot ?? 0.0;
  }

  updateBallPrediction(maxSeconds = 5.0) {
    if (typeof this.module?._physics_updateBallPrediction === 'function') {
      this.module._physics_updateBallPrediction(maxSeconds);
      return this.module._physics_getBallPredictionCount?.() ?? 0;
    }
    return 0;
  }

  getBallPrediction() {
    const ptr = this.module?._physics_getBallPredictionPtr?.() || 0;
    const count = this.module?._physics_getBallPredictionCount?.() || 0;
    return (ptr && count > 0) ? new Float32Array(this.module.HEAPF32.buffer, ptr, count * 6) : null;
  }

  isBallSleeping() {
    if (typeof this.module?._physics_isBallSleeping === 'function') {
      return this.module._physics_isBallSleeping() !== 0;
    }
    const bv = this.getBallStateView();
    return (bv.velX === 0 && bv.velY === 0 && bv.velZ === 0);
  }

  setSimulationFrozen(frozen, targetResumeTick = 0, maskInputs = false) {
    this.module?._physics_setSimulationFrozen?.(frozen ? 1 : 0, targetResumeTick, maskInputs ? 1 : 0);
  }

  setPossessionReportingEnabled(enabled) {
    this.module?._physics_setPossessionReportingEnabled?.(enabled ? 1 : 0);
  }

  resetPossessionStats() {
    this._accumulatedBluePossessionPts = 0;
    this._accumulatedOrangePossessionPts = 0;
    this._lastRawBluePossessionPts = 0;
    this._lastRawOrangePossessionPts = 0;
    if (this.module && this.state && this.state.length >= 416) {
      this.state[EXTENDED_STATE_OFFSETS.POSSESSION_STATE] = 0;
      this.state[EXTENDED_STATE_OFFSETS.POSSESSION_BLUE_POINTS] = 0;
      this.state[EXTENDED_STATE_OFFSETS.POSSESSION_ORANGE_POINTS] = 0;
      this.state[EXTENDED_STATE_OFFSETS.POSSESSION_DURATION] = 0;
    }
  }

  _applyAccumulatedPossessionToState() {
    if (!this.module || !this.state || this.state.length < 416) return;
    const rawBlue = Math.max(0, Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_BLUE_POINTS] || 0));
    const rawOrange = Math.max(0, Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_ORANGE_POINTS] || 0));
    this._lastRawBluePossessionPts = rawBlue;
    this._lastRawOrangePossessionPts = rawOrange;
    if (this._accumulatedBluePossessionPts > 0) {
      this.state[EXTENDED_STATE_OFFSETS.POSSESSION_BLUE_POINTS] = rawBlue + this._accumulatedBluePossessionPts;
    }
    if (this._accumulatedOrangePossessionPts > 0) {
      this.state[EXTENDED_STATE_OFFSETS.POSSESSION_ORANGE_POINTS] = rawOrange + this._accumulatedOrangePossessionPts;
    }
  }

  getPossessionStats() {
    if (this.state && this.state.length >= 416) {
      return {
        team: Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_STATE]),
        bluePoints: Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_BLUE_POINTS]),
        orangePoints: Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_ORANGE_POINTS]),
        time: this.state[EXTENDED_STATE_OFFSETS.POSSESSION_DURATION]
      };
    }
    return { team: 0, bluePoints: 0, orangePoints: 0, time: 0 };
  }

  pushSignalEvent(type, tick, x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0, primaryId = 0, secondaryId = 0, subType = 0, flags = 0, customFloat = 0, customInt = 0) {
    this.module?._physics_pushSignalEvent?.(type, tick, x, y, z, nx, ny, nz, primaryId, secondaryId, subType, flags, customFloat, customInt);
  }

  resetGoalLatch() { this.module?._physics_resetGoalLatch?.(); }
  getPlayerInputBufferAmount(carIndex = 0) { return this.inputBufferCount?.[carIndex] || 0; }
  readEvents(callback) { return readPhysicsEvents(this, callback); }
  addCar(team, hitboxType = 'default') { return this.module._physics_addCar(team, getHitboxIndex(hitboxType)); }
  removeCar(carIndex) { return this.module?._physics_removeCar?.(carIndex) === 1; }
  setCarHitbox(carIndex, hitboxType) { return this.module?._physics_setCarHitbox?.(carIndex, getHitboxIndex(hitboxType)) === 1; }
  demolishCar(carIndex, respawnDelay = 3.0) { return this.module?._physics_demolishCar?.(carIndex, respawnDelay) === 1; }
  respawnCar(carIndex, seed = -1, boostAmount = 33.33) { return this.module?._physics_respawnCar?.(carIndex, seed, boostAmount) === 1; }

  getCarIsJumping(carIndex = 0) {
    return typeof this.module?._physics_getCarIsJumping === 'function'
      ? this.module._physics_getCarIsJumping(carIndex) === 1
      : this.getCarStateView(carIndex).isJumping;
  }

  getCarAirTime(carIndex = 0) {
    return typeof this.module?._physics_getCarAirTime === 'function'
      ? this.module._physics_getCarAirTime(carIndex)
      : this.getCarStateView(carIndex).airTime;
  }

  getCarJumpTime(carIndex = 0) {
    return typeof this.module?._physics_getCarJumpTime === 'function'
      ? this.module._physics_getCarJumpTime(carIndex)
      : this.getCarStateView(carIndex).jumpTime;
  }

  getCarAirTimeSinceJump(carIndex = 0) {
    return typeof this.module?._physics_getCarAirTimeSinceJump === 'function'
      ? this.module._physics_getCarAirTimeSinceJump(carIndex)
      : this.getCarStateView(carIndex).airTimeSinceJump;
  }

  resetKickoffAtSpawn(spawnIndex = 0, settleTicks = 30) {
    const ok = this.module?._physics_resetKickoffAtSpawn?.(spawnIndex, settleTicks) === 1;
    this.clearEvents();
    return ok;
  }

  setCarLinearFactorAndGravity(carIndex, fx = 1.0, fy = 1.0, fz = 1.0, gravityScale = 1.0) {
    return this.module?._physics_setCarLinearFactorAndGravity?.(carIndex, fx, fy, fz, gravityScale) === 1;
  }

  setCarCollisionMask(carIndex, interactWithBall = true, interactWithCars = true) {
    return this.module?._physics_setCarCollisionMask?.(carIndex, interactWithBall ? 1 : 0, interactWithCars ? 1 : 0) === 1;
  }

  setArenaMutators({ gravityZ = -650.0, boostAccelGround = -1.0, boostAccelAir = -1.0, ballMaxSpeed = -1.0, ballBounciness = -1.0 } = {}) {
    return this.module?._physics_setArenaMutators?.(gravityZ, boostAccelGround, boostAccelAir, ballMaxSpeed, ballBounciness) === 1;
  }

  initReplayBuffer() { this.module?._physics_initReplayBuffer?.(); }
  clearReplayBuffer() { this.module?._physics_clearReplayBuffer?.(); }
  recordReplayFrame() { this.module?._physics_recordReplayFrame?.(); }
  getReplayFrameCount() { return this.module?._physics_getReplayFrameCount?.() ?? 0; }

  getReplayFrameByOffset(ticksAgo = 0) {
    const ptr = this.module?._physics_getReplayFramePtrByOffset?.(ticksAgo) || 0;
    return ptr ? new Float32Array(this.module.HEAPF32.buffer, ptr, this.stateLen) : null;
  }

  getReplayFrameByIndex(frameIndex = 0) {
    const ptr = this.module?._physics_getReplayFramePtrByIndex?.(frameIndex) || 0;
    return ptr ? new Float32Array(this.module.HEAPF32.buffer, ptr, this.stateLen) : null;
  }

  configureCars(hitboxType, isMatch, defaultPlayerTeam = 0) {
    const { playerTeam, botTeam } = getTeamAssignment(hitboxType === 'flat');
    if (this.module._physics_createArena() !== 1) throw new Error('Arena creation failed');
    this.clearEvents();
    if (this.addCar(isMatch ? playerTeam : defaultPlayerTeam, hitboxType) !== PLAYER_CAR_INDEX) {
      throw new Error('Player creation failed');
    }
    if (isMatch && this.addCar(botTeam, 'default') !== BOT_CAR_INDEX) {
      throw new Error('Opponent creation failed');
    }
    this.resetKickoff();
    this.resetView();
  }

  setControls(carIndex, controls) { writeCarControlsToEngine(this, carIndex, controls); }

  getHeaderView() {
    if (!this.headerViewInstance) this.headerViewInstance = new ArenaHeaderView();
    return this.headerViewInstance.attach(this.state);
  }

  get numCars() { return this.state ? this.getHeaderView().numCars : 0; }
  get ballState() { return this.getBallStateView(); }

  getBallStateView() {
    if (!this.ballStateViewInstance) this.ballStateViewInstance = new BallStateView();
    return this.ballStateViewInstance.attach(this.state);
  }

  getBallState() { return this.state.subarray(SIM_OFFSETS.BALL, SIM_OFFSETS.BALL + BALL_STATE_STRIDE); }
  setBallState(ballState) { return applyBallStateToEngine(this, ballState); }

  getCarStateView(carIndex = 0) {
    if (!this.carStateViewInstances[carIndex]) this.carStateViewInstances[carIndex] = new CarStateView();
    return this.carStateViewInstances[carIndex].attachCar(this.state, carIndex);
  }

  getBoostPadStateView(padIndex = 0) {
    if (!this.boostPadStateViewInstances[padIndex]) this.boostPadStateViewInstances[padIndex] = new BoostPadStateView();
    return this.boostPadStateViewInstances[padIndex].attach(this.state, padIndex);
  }

  getPadStateView(padIndex = 0) { return this.getBoostPadStateView(padIndex); }

  getGameStateView() {
    if (!this.gameStateViewInstance) this.gameStateViewInstance = new GameStateView();
    return this.gameStateViewInstance.attach(this.state);
  }

  getCarState(carIndex) {
    const offset = SIM_OFFSETS.CARS + carIndex * CAR_STATE_STRIDE;
    return this.state.subarray(offset, offset + CAR_STATE_STRIDE);
  }

  setCarState(carIndex, carState) { return applyCarStateToEngine(this, carIndex, carState); }

  getCarConfig(hitboxTypeOrIndex = 'default') {
    const idx = getHitboxIndex(hitboxTypeOrIndex);
    return this.module?._physics_getCarConfig?.(idx) ?? null;
  }

  getPadStates() {
    return this.state.subarray(
      BOOST_PAD_STATES_OFFSET,
      BOOST_PAD_STATES_OFFSET + NUM_BOOST_PADS * BOOST_PAD_STATE_STRIDE
    );
  }

  stepView(view) {
    if (!this.cameraKernel) throw new Error('[FATAL] POV Camera Microkernel not initialized in RocketSimPhysicsEngine.');
    return this.cameraKernel.stepView(view);
  }

  resetView() {
    if (!this.cameraKernel) throw new Error('[FATAL] POV Camera Microkernel not initialized in RocketSimPhysicsEngine.');
    this.cameraKernel.resetView();
  }

  step(ticks = 1) {
    this.module._physics_step(ticks);
    this._applyAccumulatedPossessionToState();
  }
  stepSilent(ticks = 1) { this.module._physics_stepSilent(ticks); }
  saveStateSlot(slot) { return this.module._physics_saveStateSlot(slot) === 1; }
  restoreStateSlot(slot) { return this.module._physics_restoreStateSlot(slot) === 1; }
  getStateSnapshotSize() { return this.module._physics_getStateSnapshotSize(); }
  _ensureStateBuffer(size) { ensureWasmSnapshotBuffer(this, size); }
  saveState(targetBuffer = null) { return saveWasmSnapshotState(this, targetBuffer); }
  saveCompactState(targetBuffer = null) { return saveCompactStateSnapshot(this, targetBuffer); }
  restoreState(buffer) { return restoreWasmSnapshotState(this, buffer); }

  resetKickoff(seed = -1, preservePossessionScore = true) {
    if (preservePossessionScore && this.state && this.state.length >= 416) {
      this._accumulatedBluePossessionPts = Math.max(
        this._accumulatedBluePossessionPts,
        Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_BLUE_POINTS] || 0)
      );
      this._accumulatedOrangePossessionPts = Math.max(
        this._accumulatedOrangePossessionPts,
        Math.round(this.state[EXTENDED_STATE_OFFSETS.POSSESSION_ORANGE_POINTS] || 0)
      );
    } else if (!preservePossessionScore) {
      this._accumulatedBluePossessionPts = 0;
      this._accumulatedOrangePossessionPts = 0;
    }
    this.module._physics_resetKickoff(seed);
    this._applyAccumulatedPossessionToState();
    this.clearEvents();
  }

  controlBall(carIndex, mode) {
    if (!this.module || typeof this.module._physics_controlBall !== 'function') return false;
    const modeIndex = typeof mode === 'number' ? mode : BALL_CONTROL_MODES.indexOf(mode);
    if (modeIndex < 0 || modeIndex >= BALL_CONTROL_MODES.length) return false;
    return this.module._physics_controlBall(carIndex, modeIndex) === 1;
  }

  setUnlimitedBoost(unlimited) {
    this.isUnlimitedBoost = !!unlimited;
    this.module._physics_setUnlimitedBoost(unlimited ? 1 : 0);
  }

  pollGoal() {
    const goalFlag = this.getHeaderView().goalScoredFlag;
    if (goalFlag !== 0) this.module._physics_clearGoalFlag();
    return goalFlag;
  }

  get ballRadius() { return this.module._physics_getBallRadius(); }
  get ballOnGround() { return this.module._physics_getBallOnGround() === 1; }
  getPads() { return readArenaPads(this); }

  destroy() {
    if (this.wasmStatePtr && this.module && typeof this.module._free === 'function') {
      this.module._free(this.wasmStatePtr);
      this.wasmStatePtr = 0;
      this.wasmStateSize = 0;
      this.cachedSnapshotBuffer = null;
    }
    this.module = null;
    this.cameraKernel = null;
    this.stateView = null;
    this.controlsView = null;
    this.viewView = null;
    this.eventReader = null;
    this.headerViewInstance = null;
    this.gameStateViewInstance = null;
    this.ballStateViewInstance = null;
    this.carStateViewInstances = [];
    this.boostPadStateViewInstances = [];
  }
}

export {
  ArenaHeaderView, CarStateView, BallStateView, BoostPadStateView, GameStateView,
  PhysicsEventReader, PHYSICS_EVENT_TYPES, PHYSICS_EVENT_FLAGS, EXTENDED_STATE_OFFSETS,
  loadRocketSimWasmModule, CameraMicrokernel, loadCameraMicrokernel
};

export default RocketSimPhysicsEngine;
