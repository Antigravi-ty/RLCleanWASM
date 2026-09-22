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
import { loadCameraMicrokernel, CameraMicrokernel } from '../camera/exempt_pov_microkernel/index.js';
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
  INCIDENT_EVENT_TYPES,
  SURFACE_SUBTYPES,
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

/**
 * Resolves standard 6 Rocket League hitbox preset indices for WASM bridge:
 * 0: Octane, 1: Dominus, 2: Plank (Batmobile), 3: Breakout, 4: Hybrid, 5: Merc
 * @param {string|number} hitboxType
 * @returns {number}
 */
export function getHitboxIndex(hitboxType) {
  if (typeof hitboxType === 'number') return hitboxType;
  const lower = String(hitboxType).toLowerCase();
  if (lower.includes('dominus') || lower.includes('flat')) return 1;
  if (lower.includes('plank') || lower.includes('batmobile')) return 2;
  if (lower.includes('breakout')) return 3;
  if (lower.includes('hybrid')) return 4;
  if (lower.includes('merc')) return 5;
  return 0; // Octane by default
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
    if (options.collisionData) {
      RocketSimPhysicsEngine.cachedCollisionData = options.collisionData;
    }
    // Parallel instantiation of dual WASM microkernels
    const [module, cameraKernel] = await Promise.all([
      loadRocketSimWasmModule(options),
      loadCameraMicrokernel(options)
    ]);
    this.module = module;
    this.cameraKernel = cameraKernel;
    this.isInitialized = true;

    let collisionData = RocketSimPhysicsEngine.cachedCollisionData;
    if (!collisionData) {
      const manifestUrl = '/custom/arenamesh/manifest.json';
      const manifestRes = await fetch(manifestUrl);
      const manifestCheck = validateAssetResponse(manifestRes, manifestUrl, 'json');
      if (!manifestCheck.ok) throw manifestCheck.error;

      const chunkFilenames = await manifestRes.json();
      collisionData = await Promise.all(
        chunkFilenames.map(async (chunkFile) => {
          const chunkPath = `/custom/arenamesh/${chunkFile}`;
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
  /**
   * Set dynamic thresholds for ball impact state machine
   * @param {number} ballGround
   * @param {number} ballWall
   * @param {number} carBall
   * @param {number} cooldownTicks
   */
  setImpactThresholds(ballGround = 140.0, ballWall = 160.0, carBall = 50.0, cooldownTicks = 8) {
    if (typeof this.module?._physics_setImpactThresholds === 'function') {
      this.module._physics_setImpactThresholds(ballGround, ballWall, carBall, cooldownTicks);
    }
  }

  /**
   * Set surface normal taxonomy thresholds for Floor, Field Net and Transition Curves
   * @param {number} floorNz - Normal Z threshold for floor (default 0.8)
   * @param {number} netNz - Normal Z threshold for sidewall / net (default 0.05)
   */
  setSurfaceTaxonomyThresholds(floorNz = 0.8, netNz = 0.05) {
    this.floorNz = floorNz;
    this.netNz = netNz;
    if (typeof this.module?._physics_setSurfaceTaxonomyThresholds === 'function') {
      this.module._physics_setSurfaceTaxonomyThresholds(floorNz, netNz);
    }
  }

  /**
   * Set normalized unit-vector direction dot product threshold (sin(impactAngle))
   * @param {number} minDirDot - 0.0 to 1.0 (0.0 = unconstrained)
   */
  setDirectionDotThreshold(minDirDot = 0.0) {
    this.minDirDot = minDirDot;
    if (typeof this.module?._physics_setDirectionDotThreshold === 'function') {
      this.module._physics_setDirectionDotThreshold(minDirDot);
    }
  }

  getSurfaceTaxonomyThresholds() {
    return { floorNz: this.floorNz ?? 0.8, netNz: this.netNz ?? 0.05 };
  }

  getDirectionDotThreshold() {
    return this.minDirDot ?? 0.0;
  }

  /**
   * Update ball trajectory prediction up to maxSeconds (max 5.0s = 600 ticks)
   * @param {number} maxSeconds
   * @returns {number} count of predicted ticks
   */
  updateBallPrediction(maxSeconds = 5.0) {
    if (typeof this.module?._physics_updateBallPrediction === 'function') {
      this.module._physics_updateBallPrediction(maxSeconds);
      return typeof this.module._physics_getBallPredictionCount === 'function'
        ? this.module._physics_getBallPredictionCount()
        : 0;
    }
    return 0;
  }

  /**
   * Retrieve ball prediction trajectory slice array
   * @returns {Float32Array | null}
   */
  getBallPrediction() {
    if (typeof this.module?._physics_getBallPredictionPtr === 'function' &&
        typeof this.module?._physics_getBallPredictionCount === 'function') {
      const ptr = this.module._physics_getBallPredictionPtr();
      const count = this.module._physics_getBallPredictionCount();
      if (ptr && count > 0) {
        return new Float32Array(this.module.HEAPF32.buffer, ptr, count * 6);
      }
    }
    return null;
  }

  /**
   * Check whether the ball is currently sleeping / at rest
   * @returns {boolean}
   */
  isBallSleeping() {
    if (typeof this.module?._physics_isBallSleeping === 'function') {
      return this.module._physics_isBallSleeping() !== 0;
    }
    const ballVel = this.getBallLinearVelocity();
    return (ballVel[0] === 0 && ballVel[1] === 0 && ballVel[2] === 0);
  }

  /**
   * Freeze physical simulation while monotonically advancing tick IDs
   * @param {boolean} frozen
   * @param {number} targetResumeTick
   * @param {boolean} maskInputs
   */
  setSimulationFrozen(frozen, targetResumeTick = 0, maskInputs = false) {
    if (typeof this.module?._physics_setSimulationFrozen === 'function') {
      this.module._physics_setSimulationFrozen(frozen ? 1 : 0, targetResumeTick, maskInputs ? 1 : 0);
    }
  }

  /**
   * Enable or disable possession incident event dispatch
   * @param {boolean} enabled
   */
  setPossessionReportingEnabled(enabled) {
    if (typeof this.module?._physics_setPossessionReportingEnabled === 'function') {
      this.module._physics_setPossessionReportingEnabled(enabled ? 1 : 0);
    }
  }

  /**
   * Retrieve current team possession statistics
   * @returns {{ team: number, bluePoints: number, orangePoints: number, time: number }}
   */
  getPossessionStats() {
    if (this.state && this.state.length >= 416) {
      return {
        team: Math.round(this.state[412]),
        bluePoints: Math.round(this.state[413]),
        orangePoints: Math.round(this.state[414]),
        time: this.state[415]
      };
    }
    return { team: 0, bluePoints: 0, orangePoints: 0, time: 0 };
  }

  /**
   * Push an external Signal Event into the shared physics event ring buffer
   */
  pushSignalEvent(type, tick, x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0, primaryId = 0, secondaryId = 0, subType = 0, flags = 0, customFloat = 0, customInt = 0) {
    if (typeof this.module?._physics_pushSignalEvent === 'function') {
      this.module._physics_pushSignalEvent(type, tick, x, y, z, nx, ny, nz, primaryId, secondaryId, subType, flags, customFloat, customInt);
    }
  }

  /**
   * Get player input buffer amount
   * @param {number} carIndex
   * @returns {number}
   */
  getPlayerInputBufferAmount(carIndex = 0) {
    return this.inputBufferCount?.[carIndex] || 0;
  }

  readEvents(callback) {
    if (!this.eventReader) return 0;

    // Re-verify heap buffer binding in case WebAssembly linear memory expanded
    if (this.module && typeof this.module._physics_getEventBufferPtr === 'function') {
      const heapBuffer = this.module.HEAPU8.buffer;
      if (this.eventReader.buffer !== heapBuffer) {
        this.eventReader.attach(heapBuffer, this.eventBufferPtr);
      }
    }

    if (this.eventReader.strideWords === 12) {
      this.eventReader.ballStateProvider = this.ballState;
      return this.eventReader.readEvents((event) => {
        // Suppress resting or sliding rolling contact where normal relative velocity is below impact threshold
        if (event.type === INCIDENT_EVENT_TYPES.BALL_WORLD_HIT || event.type === INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT) {
          const threshold = (event.surfaceTag === SURFACE_SUBTYPES.FLOOR || event.subType === 1) ? 140.0 : 160.0;
          if (event.normalRelVel < threshold) {
            return;
          }
        }
        if (callback) callback(event);
      });
    }

    return this.eventReader.readEvents(callback);
  }

  /**
   * Add a car with the given team and hitbox configuration
   * @param {number} team 0 for Blue, 1 for Orange
   * @param {string} hitboxType 'default' (Octane) or 'flat' (Dominus)
   * @returns {number} car index in arena
   */
  /**
   * Add a car with the given team and hitbox configuration (supports all 6 RL hitboxes)
   * @param {number} team 0 for Blue, 1 for Orange
   * @param {string|number} hitboxType 'default' | 'flat' | 'octane' | 'dominus' | 'plank' | 'breakout' | 'hybrid' | 'merc'
   * @returns {number} car index in arena
   */
  addCar(team, hitboxType = 'default') {
    const hitboxIndex = getHitboxIndex(hitboxType);
    return this.module._physics_addCar(team, hitboxIndex);
  }

  /**
   * Remove a car from the physics arena
   * @param {number} carIndex
   * @returns {boolean}
   */
  removeCar(carIndex) {
    if (this.module && typeof this.module._physics_removeCar === 'function') {
      return this.module._physics_removeCar(carIndex) === 1;
    }
    return false;
  }

  /**
   * In-place Hot Swap: Update a car physical hitbox without changing its entity slot or resetting velocity
   * @param {number} carIndex
   * @param {string|number} hitboxType
   * @returns {boolean}
   */
  setCarHitbox(carIndex, hitboxType) {
    if (this.module && typeof this.module._physics_setCarHitbox === 'function') {
      const hitboxIndex = getHitboxIndex(hitboxType);
      return this.module._physics_setCarHitbox(carIndex, hitboxIndex) === 1;
    }
    return false;
  }

  /**
   * Demolish a car with the given respawn delay
   * @param {number} carIndex
   * @param {number} [respawnDelay=3.0]
   * @returns {boolean}
   */
  demolishCar(carIndex, respawnDelay = 3.0) {
    if (this.module && typeof this.module._physics_demolishCar === 'function') {
      return this.module._physics_demolishCar(carIndex, respawnDelay) === 1;
    }
    return false;
  }

  /**
   * Respawn a car
   * @param {number} carIndex
   * @param {number} [seed=-1]
   * @param {number} [boostAmount=33.33]
   * @returns {boolean}
   */
  respawnCar(carIndex, seed = -1, boostAmount = 33.33) {
    if (this.module && typeof this.module._physics_respawnCar === 'function') {
      return this.module._physics_respawnCar(carIndex, seed, boostAmount) === 1;
    }
    return false;
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
   * Current ball state view attached to shared state buffer
   * @returns {BallStateView}
   */
  get ballState() {
    return this.getBallStateView();
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
