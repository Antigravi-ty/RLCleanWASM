/**
 * RocketSimPhysicsEngine.js
 * Clean, deobfuscated wrapper for RocketSim WebAssembly simulation core (deobfuscates yC).
 * Interacts directly with Emscripten RocketSim C++ binding (16 collision mesh chunks,
 * suspension raycasting, 120Hz deterministic stepping, vehicle state memory buffer).
 *
 * Parallel Dual-WASM Architecture:
 * 1. core.wasm (compiled from ReWASM C++ source): handles arena physics, car simulation, collision raycasts.
 * 2. camera.wasm (stripped microkernel from legacy WASM): handles 3rd-person follow/ball-cam tracking calculations.
 *
 * Reference: https://github.com/zealanL/rocketsim
 */

import { loadRocketSimWasmModule } from './RocketSimWasm.js';
import { loadCameraMicrokernel, CameraMicrokernel } from './CameraMicrokernel.js';
import { validateAssetResponse } from '../game/AssetDiagnostics.js';
import {
  SIM_OFFSETS,
  BALL_CONTROL_MODES,
  MAX_CARS,
  CONTROLS_STRIDE,
  CONTROLS_OFFSETS,
  BALL_STATE_STRIDE,
  CAR_STATE_STRIDE,
  BOOST_PAD_STATES_OFFSET,
  BOOST_PAD_STATE_STRIDE,
  NUM_BOOST_PADS,
  CarStateView,
  BallStateView,
  ArenaHeaderView,
  BoostPadStateView,
  GameStateView,
  PHYSICS_EVENT_TYPES,
  PHYSICS_EVENT_FLAGS,
  EVENT_BUFFER_CAPACITY,
  EVENT_TOTAL_BUFFER_BYTES,
  PhysicsEventReader
} from './RocketSimConstants.js';

export const PLAYER_CAR_INDEX = 0;
export const BOT_CAR_INDEX = 1;

/**
 * Team assignment helper based on car visual type
 * @param {boolean} isFlatCar
 * @returns {{ playerTeam: number, botTeam: number }}
 */
export function getTeamAssignment(isFlatCar) {
  return isFlatCar
    ? { playerTeam: 0, botTeam: 1 }
    : { playerTeam: 1, botTeam: 0 };
}

export class RocketSimPhysicsEngine {
  /** Cached Uint8Array collision mesh data across instances */
  static cachedCollisionData = null;

  constructor() {
    this.module = null; // core.wasm (physics simulation)
    this.cameraKernel = null; // camera.wasm (camera tracking microkernel)

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

    // Pre-allocated static buffers to eliminate GC spikes during 120Hz rollback/snapshot loops
    this.wasmStatePtr = 0;
    this.wasmStateSize = 0;
    this.cachedSnapshotBuffer = null;
    this.isUnlimitedBoost = false;
  }

  /**
   * Get shared Float32Array state buffer directly mapped to WASM heap
   * @returns {Float32Array}
   */
  get state() {
    const buffer = this.module.HEAPF32.buffer;
    if (!this.stateView || this.stateView.buffer !== buffer) {
      this.stateView = new Float32Array(buffer, this.statePtr, this.stateLen);
    }
    return this.stateView;
  }

  /**
   * Initialize dual RocketSim WASM microkernels:
   * - core.wasm for rigid-body collision and vehicular dynamics
   * - camera.wasm for independent camera tracking calculations
   * Load collision meshes and instantiate the standard arena
   */
  async init(options = {}) {
    // Parallel instantiation of dual WASM microkernels
    const [module, cameraKernel] = await Promise.all([
      loadRocketSimWasmModule(options),
      loadCameraMicrokernel(options)
    ]);
    this.module = module;
    this.cameraKernel = cameraKernel;

    let collisionData = RocketSimPhysicsEngine.cachedCollisionData;
    if (!collisionData) {
      const manifestUrl = '/assets/arena/collision/manifest.json';
      const manifestRes = await fetch(manifestUrl);
      const manifestCheck = validateAssetResponse(manifestRes, manifestUrl, 'json');
      if (!manifestCheck.ok) throw manifestCheck.error;

      const chunkFilenames = await manifestRes.json();
      collisionData = await Promise.all(
        chunkFilenames.map(async (chunkFile) => {
          const chunkPath = `/assets/arena/collision/${chunkFile}`;
          const chunkRes = await fetch(chunkPath);
          const chunkCheck = validateAssetResponse(chunkRes, chunkPath, 'cmf');
          if (!chunkCheck.ok) throw chunkCheck.error;
          return new Uint8Array(await chunkRes.arrayBuffer());
        })
      );
      RocketSimPhysicsEngine.cachedCollisionData = collisionData;
    }

    // Allocate continuous block in WASM heap for all mesh chunks
    const totalBytes = collisionData.reduce((acc, chunk) => acc + chunk.length, 0);
    const dataPtr = this.module._malloc(totalBytes);
    const sizesPtr = this.module._malloc(collisionData.length * 4);

    let byteOffset = 0;
    collisionData.forEach((chunk, idx) => {
      this.module.HEAPU8.set(chunk, dataPtr + byteOffset);
      this.module.HEAP32[sizesPtr / 4 + idx] = chunk.length;
      byteOffset += chunk.length;
    });

    const initResult = this.module._physics_init(dataPtr, sizesPtr, collisionData.length);
    this.module._free(dataPtr);
    this.module._free(sizesPtr);

    if (initResult !== 1) {
      throw new Error('Physics initialization failed — check collision meshes');
    }

    if (this.module._physics_createArena() !== 1) {
      throw new Error('Arena creation failed');
    }

    // View pointer setup exclusively from POV Camera Microkernel (No core.wasm fallback)
    if (!this.cameraKernel) {
      throw new Error('[FATAL] POV Camera Microkernel is missing in RocketSimPhysicsEngine! Strictly decoupled architecture forbids core.wasm view fallback.');
    }
    this.viewPtr = this.cameraKernel.getViewPtr();

    this.statePtr = this.module._physics_getStatePtr();
    this.stateLen = this.module._physics_getStateSize();
    this.controlsPtr = this.module._physics_getControlsPtr();

    // Event ring buffer setup (native C++ export)
    if (typeof this.module._physics_getEventBufferPtr === 'function') {
      this.eventBufferPtr = this.module._physics_getEventBufferPtr();
      this.eventBufferSize = typeof this.module._physics_getEventBufferSize === 'function'
        ? this.module._physics_getEventBufferSize()
        : EVENT_TOTAL_BUFFER_BYTES;
      this.eventReader = new PhysicsEventReader(this.module.HEAPU8.buffer, this.eventBufferPtr);
    } else {
      console.warn('[RocketSimPhysicsEngine] _physics_getEventBufferPtr export not found in WASM core');
      this.eventReader = null;
    }

    this.stateView = null;
    this.controlsView = null;
    this.viewView = null;
    this.resetView();
  }

  /**
   * Get native event buffer pointer in WASM linear memory
   * @returns {number}
   */
  getEventBufferPtr() {
    return this.eventBufferPtr || (typeof this.module?._physics_getEventBufferPtr === 'function'
      ? this.module._physics_getEventBufferPtr()
      : 0);
  }

  /**
   * Get native event buffer size in bytes
   * @returns {number}
   */
  getEventBufferSize() {
    return this.eventBufferSize || (typeof this.module?._physics_getEventBufferSize === 'function'
      ? this.module._physics_getEventBufferSize()
      : EVENT_TOTAL_BUFFER_BYTES);
  }

  /**
   * Clear event ring buffer in C++ and reset frontend read pointer
   */
  clearEvents() {
    if (typeof this.module?._physics_clearEvents === 'function') {
      this.module._physics_clearEvents();
    }
    if (this.eventReader) {
      this.eventReader.reset();
    }
    if (this.syntheticFallback) {
      this.syntheticFallback.reset();
    }
  }

  /**
   * Read and process newly arrived physics events
   * @param {Function} callback
   * @returns {number} number of events read
   */
  readEvents(callback) {
    if (!this.eventReader) return 0;

    // Re-verify heap buffer binding in case WebAssembly linear memory expanded
    if (this.module && typeof this.module._physics_getEventBufferPtr === 'function') {
      const heapBuffer = this.module.HEAPU8.buffer;
      if (this.eventReader.buffer !== heapBuffer) {
        this.eventReader.attach(heapBuffer, this.eventBufferPtr);
      }
    }

    return this.eventReader.readEvents(callback);
  }

  /**
   * Add a car with the given team and hitbox configuration
   * @param {number} team 0 for Blue, 1 for Orange
   * @param {string} hitboxType 'default' (Octane) or 'flat' (Dominus)
   * @returns {number} car index in arena
   */
  addCar(team, hitboxType = 'default') {
    return this.module._physics_addCar(team, hitboxType === 'flat' ? 1 : 0);
  }

  /**
   * Recreate arena and spawn appropriate cars for Freeplay or Match mode
   * @param {string} hitboxType 'default' or 'flat'
   * @param {boolean} isMatch
   * @param {number} defaultPlayerTeam
   */
  configureCars(hitboxType, isMatch, defaultPlayerTeam = 0) {
    const { playerTeam, botTeam } = getTeamAssignment(hitboxType === 'flat');

    if (this.module._physics_createArena() !== 1) {
      throw new Error('Arena creation failed');
    }

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

  /**
   * Push control inputs for a car into WASM shared memory
   * @param {number} carIndex
   * @param {{ throttle: number, steer: number, pitch: number, yaw: number, roll: number, jump: boolean, boost: boolean, handbrake: boolean }} controls
   */
  setControls(carIndex, controls) {
    const buffer = this.module.HEAPF32.buffer;
    if (!this.controlsView || this.controlsView.buffer !== buffer) {
      this.controlsView = new Float32Array(buffer, this.controlsPtr, MAX_CARS * CONTROLS_STRIDE);
    }
    const offset = carIndex * CONTROLS_STRIDE;
    const view = this.controlsView;

    view[offset + CONTROLS_OFFSETS.THROTTLE] = controls.throttle || 0;
    view[offset + CONTROLS_OFFSETS.STEER] = controls.steer || 0;
    view[offset + CONTROLS_OFFSETS.PITCH] = controls.pitch || 0;
    view[offset + CONTROLS_OFFSETS.YAW] = controls.yaw || 0;
    view[offset + CONTROLS_OFFSETS.ROLL] = controls.roll || 0;
    view[offset + CONTROLS_OFFSETS.JUMP] = controls.jump ? 1 : 0;
    view[offset + CONTROLS_OFFSETS.BOOST] = controls.boost ? 1 : 0;
    view[offset + CONTROLS_OFFSETS.HANDBRAKE] = controls.handbrake ? 1 : 0;
  }

  /**
   * Get zero-allocation ArenaHeaderView attached to current state buffer
   * @returns {ArenaHeaderView}
   */
  getHeaderView() {
    if (!this.headerViewInstance) {
      this.headerViewInstance = new ArenaHeaderView();
    }
    this.headerViewInstance.attach(this.state);
    return this.headerViewInstance;
  }

  /**
   * Total number of cars currently simulated in arena
   * @returns {number}
   */
  get numCars() {
    return this.state ? this.getHeaderView().numCars : 0;
  }

  /**
   * Get zero-allocation typed view of current ball state
   * @returns {BallStateView}
   */
  getBallStateView() {
    if (!this.ballStateViewInstance) {
      this.ballStateViewInstance = new BallStateView();
    }
    this.ballStateViewInstance.attach(this.state);
    return this.ballStateViewInstance;
  }

  /**
   * Get current ball state (18 floats: POS[3], ROT_MAT[9], VEL[3], ANG_VEL[3])
   * @returns {Float32Array}
   */
  getBallState() {
    return this.state.subarray(SIM_OFFSETS.BALL, SIM_OFFSETS.BALL + BALL_STATE_STRIDE);
  }

  /**
   * Set ball state and sync with C++ RocketSim WASM kernel
   * @param {ArrayLike<number> | number} ballState 18-element float array or native pointer
   * @returns {boolean}
   */
  setBallState(ballState) {
    if (typeof ballState === 'number') {
      if (typeof this.module?._physics_setBallState === 'function') {
        this.module._physics_setBallState(ballState);
        return true;
      }
      return false;
    }

    if (ballState && typeof ballState.length === 'number') {
      const target = this.getBallState();
      const count = Math.min(ballState.length, BALL_STATE_STRIDE);
      for (let i = 0; i < count; i++) {
        target[i] = ballState[i];
      }
      if (typeof this.module?._physics_setBallState === 'function') {
        this.module._physics_setBallState(this.statePtr + SIM_OFFSETS.BALL * 4);
      }
      return true;
    }
    return false;
  }

  /**
   * Get zero-allocation typed view of current car state
   * @param {number} carIndex
   * @returns {CarStateView}
   */
  getCarStateView(carIndex = 0) {
    if (!this.carStateViewInstances[carIndex]) {
      this.carStateViewInstances[carIndex] = new CarStateView();
    }
    this.carStateViewInstances[carIndex].attachCar(this.state, carIndex);
    return this.carStateViewInstances[carIndex];
  }

  /**
   * Get zero-allocation typed view of boost pad state
   * @param {number} padIndex
   * @returns {BoostPadStateView}
   */
  getBoostPadStateView(padIndex = 0) {
    if (!this.boostPadStateViewInstances[padIndex]) {
      this.boostPadStateViewInstances[padIndex] = new BoostPadStateView();
    }
    this.boostPadStateViewInstances[padIndex].attach(this.state, padIndex);
    return this.boostPadStateViewInstances[padIndex];
  }

  /**
   * Alias for getBoostPadStateView
   * @param {number} padIndex
   * @returns {BoostPadStateView}
   */
  getPadStateView(padIndex = 0) {
    return this.getBoostPadStateView(padIndex);
  }

  /**
   * Get composite zero-allocation GameStateView wrapping the entire state buffer
   * @returns {GameStateView}
   */
  getGameStateView() {
    if (!this.gameStateViewInstance) {
      this.gameStateViewInstance = new GameStateView();
    }
    this.gameStateViewInstance.attach(this.state);
    return this.gameStateViewInstance;
  }

  /**
   * Get current state for a specific car (51 floats)
   * @param {number} carIndex
   * @returns {Float32Array}
   */
  getCarState(carIndex) {
    const offset = SIM_OFFSETS.CARS + carIndex * CAR_STATE_STRIDE;
    return this.state.subarray(offset, offset + CAR_STATE_STRIDE);
  }

  /**
   * Set car state and sync with C++ RocketSim WASM kernel
   * @param {number} carIndex
   * @param {ArrayLike<number> | number} carState 51-element float array or native pointer
   * @returns {boolean}
   */
  setCarState(carIndex, carState) {
    const offset = SIM_OFFSETS.CARS + carIndex * CAR_STATE_STRIDE;
    if (typeof carState === 'number') {
      if (typeof this.module?._physics_setCarState === 'function') {
        this.module._physics_setCarState(carIndex, carState);
        return true;
      }
      return false;
    }

    if (carState && typeof carState.length === 'number') {
      const target = this.getCarState(carIndex);
      const count = Math.min(carState.length, CAR_STATE_STRIDE);
      for (let i = 0; i < count; i++) {
        target[i] = carState[i];
      }
      if (typeof this.module?._physics_setCarState === 'function') {
        this.module._physics_setCarState(carIndex, this.statePtr + offset * 4);
      }
      return true;
    }
    return false;
  }

  /**
   * Retrieve native C++ CarConfig pointer or structure for a hitbox preset
   * @param {string | number} hitboxTypeOrIndex 'default' (0) or 'flat' (1)
   * @returns {number | null} pointer
   */
  getCarConfig(hitboxTypeOrIndex = 'default') {
    const idx = typeof hitboxTypeOrIndex === 'number'
      ? hitboxTypeOrIndex
      : (hitboxTypeOrIndex === 'flat' ? 1 : 0);
    if (typeof this.module?._physics_getCarConfig === 'function') {
      return this.module._physics_getCarConfig(idx);
    }
    return null;
  }

  /**
   * Get current boost pad states (34 pads * 2 floats: isActive, cooldownTimer)
   * @returns {Float32Array}
   */
  getPadStates() {
    return this.state.subarray(
      BOOST_PAD_STATES_OFFSET,
      BOOST_PAD_STATES_OFFSET + NUM_BOOST_PADS * BOOST_PAD_STATE_STRIDE
    );
  }

  /**
   * Step view state using independent camera microkernel (camera.wasm)
   * @param {ArrayLike<number>} view
   * @returns {Float64Array}
   */
  stepView(view) {
    if (!this.cameraKernel) {
      throw new Error('[FATAL] POV Camera Microkernel not initialized in RocketSimPhysicsEngine. No core.wasm fallback allowed.');
    }
    return this.cameraKernel.stepView(view);
  }

  /**
   * Reset camera view state using independent camera microkernel (camera.wasm)
   */
  resetView() {
    if (!this.cameraKernel) {
      throw new Error('[FATAL] POV Camera Microkernel not initialized in RocketSimPhysicsEngine. No core.wasm fallback allowed.');
    }
    this.cameraKernel.resetView();
  }

  /**
   * Step the physics simulation by a given number of 120Hz ticks
   * @param {number} ticks
   */
  step(ticks = 1) {
    this.module._physics_step(ticks);
  }

  /**
   * Step the physics simulation silently without pushing events (for rollback fast-forward)
   * @param {number} ticks
   */
  stepSilent(ticks = 1) {
    this.module._physics_stepSilent(ticks);
  }

  /**
   * Save current physics simulation state into an internal slot (0-255)
   * @param {number} slot
   * @returns {boolean}
   */
  saveStateSlot(slot) {
    return this.module._physics_saveStateSlot(slot) === 1;
  }

  /**
   * Restore physics simulation state from an internal slot (0-255)
   * @param {number} slot
   * @returns {boolean}
   */
  restoreStateSlot(slot) {
    return this.module._physics_restoreStateSlot(slot) === 1;
  }

  /**
   * Get size of full state snapshot in float units
   * @returns {number}
   */
  getStateSnapshotSize() {
    return this.module._physics_getStateSnapshotSize();
  }

  /**
   * Ensure pre-allocated WASM buffer and JS cache are available without recurring malloc/free
   * @param {number} size Size in floats
   * @private
   */
  _ensureStateBuffer(size) {
    if (!this.wasmStatePtr || this.wasmStateSize < size) {
      if (this.wasmStatePtr && this.module && typeof this.module._free === 'function') {
        this.module._free(this.wasmStatePtr);
      }
      this.wasmStatePtr = this.module._malloc(size * 4);
      this.wasmStateSize = size;
      this.cachedSnapshotBuffer = new Float32Array(size);
    }
  }

  /**
   * Save full state into an external Float32Array without high-frequency malloc/free
   * @param {Float32Array|null} [targetBuffer] Optional destination buffer. If provided, zero allocations occur.
   * @returns {Float32Array}
   */
  saveState(targetBuffer = null) {
    const size = this.getStateSnapshotSize();
    this._ensureStateBuffer(size);

    this.module._physics_saveState(this.wasmStatePtr);

    const offset = this.wasmStatePtr >> 2;
    const wasmSlice = this.module.HEAPF32.subarray(offset, offset + size);

    if (targetBuffer) {
      targetBuffer.set(wasmSlice);
      return targetBuffer;
    }

    const buf = new Float32Array(size);
    buf.set(wasmSlice);
    return buf;
  }

  /**
   * Restore full state from an external Float32Array without high-frequency malloc/free
   * @param {Float32Array} buffer
   * @returns {boolean}
   */
  restoreState(buffer) {
    const size = buffer.length;
    this._ensureStateBuffer(size);

    const offset = this.wasmStatePtr >> 2;
    this.module.HEAPF32.subarray(offset, offset + size).set(buffer);
    const res = this.module._physics_restoreState(this.wasmStatePtr);
    return res === 1;
  }

  /**
   * Reset ball and cars to a kickoff position
   * @param {number} seed -1 for random kickoff, or specific seed
   */
  resetKickoff(seed = -1) {
    this.module._physics_resetKickoff(seed);
    this.clearEvents();
  }

  /**
   * Execute scripted ball control maneuver
   * @param {number} carIndex
   * @param {'takePossession' | 'startDribble' | 'passBall' | 'launchBall'} mode
   * @returns {boolean}
   */
  controlBall(carIndex, mode) {
    if (!this.module || typeof this.module._physics_controlBall !== 'function') return false;
    const modeIndex = typeof mode === 'number' ? mode : BALL_CONTROL_MODES.indexOf(mode);
    if (modeIndex < 0 || modeIndex >= BALL_CONTROL_MODES.length) return false;
    return this.module._physics_controlBall(carIndex, modeIndex) === 1;
  }

  /**
   * Enable/disable infinite boost
   * @param {boolean} unlimited
   */
  setUnlimitedBoost(unlimited) {
    this.isUnlimitedBoost = !!unlimited;
    this.module._physics_setUnlimitedBoost(unlimited ? 1 : 0);
  }

  /**
   * Check if a goal was scored and clear the internal flag
   * @returns {number} 0: none, 1: blue goal, 2: orange goal
   */
  pollGoal() {
    const goalFlag = this.getHeaderView().goalScoredFlag;
    if (goalFlag !== 0) {
      this.module._physics_clearGoalFlag();
    }
    return goalFlag;
  }

  /**
   * Ball collision sphere radius
   * @returns {number}
   */
  get ballRadius() {
    return this.module._physics_getBallRadius();
  }

  /**
   * Whether the ball is resting/rolling on the arena floor
   * @returns {boolean}
   */
  get ballOnGround() {
    return this.module._physics_getBallOnGround() === 1;
  }

  /**
   * Retrieve position and type for all 34 boost pads
   * @returns {Array<{ pos: [number, number, number], isBig: boolean }>}
   */
  getPads() {
    const numPads = this.getHeaderView().numPads;
    const padPtr = this.module._physics_getPadInfoPtr();
    const padView = new Float32Array(this.module.HEAPF32.buffer, padPtr, numPads * 4);

    return Array.from({ length: numPads }, (_, idx) => ({
      pos: [padView[idx * 4], padView[idx * 4 + 1], padView[idx * 4 + 2]],
      isBig: padView[idx * 4 + 3] === 1
    }));
  }

  /**
   * Dispose and clear state references and view instances
   */
  destroy() {
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

    if (this.wasmStatePtr && this.module && typeof this.module._free === 'function') {
      this.module._free(this.wasmStatePtr);
      this.wasmStatePtr = 0;
      this.wasmStateSize = 0;
      this.cachedSnapshotBuffer = null;
    }
  }
}

export {
  ArenaHeaderView,
  CarStateView,
  BallStateView,
  BoostPadStateView,
  GameStateView,
  PhysicsEventReader,
  PHYSICS_EVENT_TYPES,
  PHYSICS_EVENT_FLAGS,
  loadRocketSimWasmModule,
  CameraMicrokernel,
  loadCameraMicrokernel
};

export default RocketSimPhysicsEngine;
