/**
 * src/network/PhysicsEngineManager.js
 * Physics Engine Layer Orchestrator and Signal Processor.
 * 
 * Architectural Highlights:
 * 1. Signal-Driven Physics Orchestration:
 *    Processes session signals dispatched from MatchSessionAdmin (Kickoff resets,
 *    Ball resets, Dynamic input masking, Simulation freeze, Hitbox hot swap).
 * 2. Decoupled Network Input Architecture:
 *    - In multiplayer mode: consumes inputs via NetworkInputBuffer (network layer).
 *    - In single-player mode: bypasses buffering entirely for 0ms zero-latency direct control.
 * 3. Reactive Physics Output Pipeline:
 *    Upon completing each physical tick, emits an authoritative physics snapshot
 *    to registered listeners (e.g. GlobalPayload encoder -> EstablishedSessionManager).
 */

import { RocketSimPhysicsEngine } from '../physics/RocketSimPhysicsEngine.js';
import { NetworkInputBuffer, NEUTRAL_CONTROLS, MAX_INPUT_BUFFER_TICKS } from './NetworkInputBuffer.js';

export { NEUTRAL_CONTROLS, MAX_INPUT_BUFFER_TICKS };

export class PhysicsEngineManager {
  /**
   * @param {object} [options]
   * @param {RocketSimPhysicsEngine} [options.sim]
   * @param {NetworkInputBuffer} [options.inputBuffer] Optional network input buffer
   * @param {number} [options.maxBufferTicks=64]
   * @param {Function} [options.onPhysicsOutput] Callback invoked when physics completes a step
   */
  constructor(options = {}) {
    this.sim = options.sim || new RocketSimPhysicsEngine();
    this.inputBuffer = options.inputBuffer || null;
    this.maxBufferTicks = options.maxBufferTicks ?? MAX_INPUT_BUFFER_TICKS;
    this.onPhysicsOutput = options.onPhysicsOutput || null;

    this.activeCarIndices = new Set();
    this.directControls = new Map(); // carIndex -> controls (for 0ms single player mode)

    this.isMasked = false;
    this.maskUntilFrame = -1;
    this.isPaused = false;

    this.lastAcknowledgedControls = new Map();
  }

  async init() {
    if (!this.sim.isInitialized) {
      await this.sim.init();
    }
    return this;
  }

  /**
   * Attach or detach a NetworkInputBuffer
   * @param {NetworkInputBuffer|null} buffer
   */
  setInputBuffer(buffer) {
    this.inputBuffer = buffer;
  }

  /**
   * Register a new player car entity in the simulation
   * @param {number} carIndex
   * @param {number} [team=0] 0: Blue, 1: Orange
   * @param {string} [config='octane']
   */
  registerCarEntity(carIndex, team = 0, config = 'octane') {
    if (this.activeCarIndices.has(carIndex)) {
      return carIndex;
    }

    this.activeCarIndices.add(carIndex);
    if (this.inputBuffer) {
      this.inputBuffer.registerCar(carIndex);
    }

    if (this.sim && this.sim.numCars <= carIndex) {
      if (typeof this.sim.addCar === "function") {
        while (this.sim.numCars <= carIndex) {
          const t = this.sim.numCars === carIndex ? team : (this.sim.numCars === 0 ? 0 : 1);
          this.sim.addCar(t, config || "default");
        }
      } else if (typeof this.sim.configureCars === "function") {
        this.sim.configureCars("custom", false, 0);
      }
    }
    return carIndex;
  }

  /**
   * Unregister a car entity and flush its state
   * @param {number} carIndex
   */
  unregisterCarEntity(carIndex) {
    this.activeCarIndices.delete(carIndex);
    this.directControls.delete(carIndex);
    this.lastAcknowledgedControls.delete(carIndex);
    if (this.inputBuffer) {
      this.inputBuffer.unregisterCar(carIndex);
    }
    if (this.sim && typeof this.sim.removeCar === 'function') {
      this.sim.removeCar(carIndex);
    }
  }

  /**
   * Current authoritative simulation tick
   */
  get currentTick() {
    if (!this.sim) return 0;
    if (typeof this.sim.getHeaderView === "function") {
      const header = this.sim.getHeaderView();
      if (header && typeof header.tickCount === "number") {
        return Math.floor(header.tickCount);
      }
    }
    return 0;
  }

  /**
   * Pushes a client input packet into the network input buffer (multiplayer path)
   * or direct controls (single player path)
   * @param {number} carIndex
   * @param {number} targetTick
   * @param {object} controls
   * @returns {boolean}
   */
  pushInput(carIndex, targetTick, controls) {
    if (!this.activeCarIndices.has(carIndex)) return false;
    if (this.inputBuffer) {
      return this.inputBuffer.pushInput(carIndex, this.currentTick, targetTick, controls);
    }
    // Direct zero-latency path (single player)
    this.directControls.set(carIndex, { ...controls });
    return true;
  }

  /**
   * Pushes redundant inputs into network buffer (multiplayer path)
   * @param {number} carIndex
   * @param {Array<{ tick: number, controls: object }>} inputList
   * @returns {number}
   */
  pushRedundantInputs(carIndex, inputList) {
    if (!this.inputBuffer) return 0;
    return this.inputBuffer.pushRedundantInputs(carIndex, this.currentTick, inputList);
  }

  /**
   * Query buffered future inputs for an entity
   * @param {number} carIndex
   * @returns {number}
   */
  getInputBufferSize(carIndex) {
    if (!this.inputBuffer) return 0;
    return this.inputBuffer.getInputBufferSize(carIndex, this.currentTick);
  }

  /**
   * Configure input masking (e.g. for kickoff countdown or match pause)
   * @param {boolean} isMasked
   * @param {number} [untilFrame=-1]
   */
  setInputMask(isMasked, untilFrame = -1) {
    this.isMasked = isMasked;
    this.maskUntilFrame = untilFrame;
  }

  /**
   * Evaluates whether inputs should be masked for the given tick
   * @param {number} tick
   * @returns {boolean}
   */
  shouldMaskInputs(tick) {
    if (this.isPaused) return true;
    if (this.maskUntilFrame >= 0) {
      if (tick < this.maskUntilFrame) return true;
      this.maskUntilFrame = -1;
      this.isMasked = false;
      return false;
    }
    return this.isMasked;
  }

  /**
   * Applies signals from MatchSessionAdmin to alter physics state
   * @param {string|number} signalType
   * @param {object} [data={}]
   */
  applySignal(signalType, data = {}) {
    switch (signalType) {
      case 'KICKOFF_RESET':
      case 2:
        this.resetKickoff(data.seed || 0);
        break;

      case 'BALL_RESET':
      case 5:
        this.resetBallToCenter();
        break;

      case 'INPUT_MASK':
        this.setInputMask(Boolean(data.masked), data.untilFrame ?? -1);
        break;

      case 'PAUSE_SIMULATION':
        this.isPaused = Boolean(data.paused);
        break;

      case 'HOTSWAP_HITBOX':
        if (typeof data.carIndex === 'number' && data.hitboxType && typeof this.sim?.setCarHitbox === 'function') {
          this.sim.setCarHitbox(data.carIndex, data.hitboxType);
        }
        break;

      default:
        break;
    }
  }

  /**
   * Advances physics simulation by 1 authoritative tick (120Hz).
   * Emits onPhysicsOutput when complete so GlobalPayload can process snapshot data.
   * @returns {{ tick: number, acknowledgedControls: Array<object>, stateSnapshot: Float32Array, goalScored: boolean, goalTeam: number }}
   */
  stepAuthoritativeTick() {
    const tick = this.currentTick;
    const mask = this.shouldMaskInputs(tick);
    const ackList = [];

    for (const carIndex of this.activeCarIndices) {
      let controls = null;

      if (this.inputBuffer) {
        const last = this.lastAcknowledgedControls.get(carIndex);
        controls = this.inputBuffer.getControlsForTick(carIndex, tick, last);
      } else if (this.directControls.has(carIndex)) {
        controls = this.directControls.get(carIndex);
      } else {
        const last = this.lastAcknowledgedControls.get(carIndex);
        controls = last ? { ...last } : { ...NEUTRAL_CONTROLS };
      }

      const effectiveControls = mask ? { ...NEUTRAL_CONTROLS } : controls;

      if (typeof this.sim.setControls === "function") {
        this.sim.setControls(carIndex, effectiveControls);
      } else if (typeof this.sim.setCarControls === "function") {
        this.sim.setCarControls(carIndex, effectiveControls);
      }
      this.lastAcknowledgedControls.set(carIndex, effectiveControls);
      ackList.push({ carIndex, controls: effectiveControls });
    }

    if (this.inputBuffer) {
      this.inputBuffer.pruneOlderThan(tick);
    }

    this.sim.step(1);

    // Goal detection
    let goalScored = false;
    let goalTeam = -1;
    if (typeof this.sim?.pollGoal === 'function') {
      const g = this.sim.pollGoal();
      if (g !== 0) {
        goalScored = true;
        goalTeam = g > 0 ? 0 : 1;
      }
    }
    if (!goalScored && typeof this.sim?.getBallStateView === 'function') {
      const b = this.sim.getBallStateView();
      if (Math.abs(b.posY) > 5120 && Math.abs(b.posX) < 893 && b.posZ < 643) {
        goalScored = true;
        goalTeam = b.posY > 0 ? 0 : 1;
      }
    }

    if (goalScored) {
      this.resetBallToCenter();
    }

    const newTick = this.currentTick;
    const stateSnapshot = this.sim.saveState();

    const output = {
      tick: newTick,
      acknowledgedControls: ackList,
      stateSnapshot,
      goalScored,
      goalTeam
    };

    // Signal GlobalPayload processing layer
    if (typeof this.onPhysicsOutput === 'function') {
      this.onPhysicsOutput(output);
    }

    return output;
  }

  /**
   * Resets ball to center field (0, 0, 93) with zero velocity
   */
  resetBallToCenter() {
    if (typeof this.sim?.setBallState === 'function') {
      const resetBall = new Float32Array([
        0, 0, 93,       // POS (x, y, z)
        1, 0, 0,       // FWD
        0, 1, 0,       // RIGHT
        0, 0, 1,       // UP
        0, 0, 0,       // VEL (x, y, z)
        0, 0, 0        // ANG_VEL (x, y, z)
      ]);
      this.sim.setBallState(resetBall);
    }
  }

  /**
   * Resets kickoff layout in arena
   * @param {number} [seed=0]
   */
  resetKickoff(seed = 0) {
    this.sim.resetKickoff(seed);
    if (this.inputBuffer) {
      this.inputBuffer.clear();
    }
    this.directControls.clear();
  }

  destroy() {
    if (this.inputBuffer) {
      this.inputBuffer.clear();
    }
    this.directControls.clear();
    this.activeCarIndices.clear();
    this.lastAcknowledgedControls.clear();
    if (this.sim && typeof this.sim.destroy === 'function') {
      this.sim.destroy();
    }
  }
}

export default PhysicsEngineManager;
