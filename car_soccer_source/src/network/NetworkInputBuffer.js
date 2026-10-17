/**
 * src/network/NetworkInputBuffer.js
 * Network-layer input buffering subsystem decoupled from PhysicsEngineManager.
 * 
 * - Enforces immutable past: historical inputs (tick < currentTick) dropped.
 * - Future tick ceiling (maxBufferTicks, default 24/64) to prevent buffer bloat.
 * - Decoupled from PhysicsEngineManager so single-player operates with 0ms direct latency.
 * - Ingests redundant input history from UDP/WebRTC data packets.
 * - Supports 1.0s input timeout degradation: when a session's input is marked stale
 *   (> 1000ms since last valid packet), forces NEUTRAL_CONTROLS instead of holding last controls.
 */

export const MAX_INPUT_BUFFER_TICKS = 128;

export const NEUTRAL_CONTROLS = Object.freeze({
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false
});

export class NetworkInputBuffer {
  /**
   * @param {number} [maxBufferTicks=128]
   */
  constructor(maxBufferTicks = MAX_INPUT_BUFFER_TICKS) {
    this.maxBufferTicks = maxBufferTicks;
    this.carInputBuffers = new Map(); // carIndex -> Map<tick, controls>
    this.starvationCounts = new Map(); // carIndex -> number
    this.staleCars = new Set(); // carIndex set whose last valid input exceeded 1.0s
    this.isPaused = false;
  }

  /**
   * Register vehicle slot in the network input buffer
   * @param {number} carIndex
   */
  registerCar(carIndex) {
    if (!this.carInputBuffers.has(carIndex)) {
      this.carInputBuffers.set(carIndex, new Map());
    }
    this.staleCars.delete(carIndex);
  }

  /**
   * Unregister vehicle slot and clear pending inputs
   * @param {number} carIndex
   */
  unregisterCar(carIndex) {
    this.carInputBuffers.delete(carIndex);
    this.starvationCounts.delete(carIndex);
    this.staleCars.delete(carIndex);
  }

  /**
   * Marks or clears the 1.0s input timeout neutral-fallback state for a vehicle
   * @param {number} carIndex
   * @param {boolean} isStale
   */
  setCarInputStale(carIndex, isStale) {
    if (isStale) {
      this.staleCars.add(carIndex);
    } else {
      this.staleCars.delete(carIndex);
    }
  }

  /**
   * Returns whether a vehicle's input stream has timed out (> 1s)
   * @param {number} carIndex
   * @returns {boolean}
   */
  isCarInputStale(carIndex) {
    return this.staleCars.has(carIndex);
  }

  /**
   * Pushes a client input packet into the entity buffer
   * @param {number} carIndex
   * @param {number} currentTick
   * @param {number} targetTick
   * @param {object} controls
   * @returns {boolean}
   */
  pushInput(carIndex, currentTick, targetTick, controls) {
    this.staleCars.delete(carIndex);
    if (targetTick < currentTick) return false;
    if (targetTick - currentTick > this.maxBufferTicks) return false;

    let buf = this.carInputBuffers.get(carIndex);
    if (!buf) {
      buf = new Map();
      this.carInputBuffers.set(carIndex, buf);
    }
    if (buf.has(targetTick)) {
      return false;
    }
    buf.set(targetTick, { ...controls });
    return true;
  }

  /**
   * Ingest a window of redundant inputs (e.g. from UDP history)
   * @param {number} carIndex
   * @param {number} currentTick
   * @param {Array<{ tick: number, controls: object }>} inputList
   * @returns {number}
   */
  pushRedundantInputs(carIndex, currentTick, inputList) {
    if (!Array.isArray(inputList)) return 0;
    this.staleCars.delete(carIndex);
    let accepted = 0;
    for (let i = 0; i < inputList.length; i++) {
      const item = inputList[i];
      if (item && typeof item.tick === 'number' && item.controls) {
        if (this.pushInput(carIndex, currentTick, item.tick, item.controls)) {
          accepted++;
        }
      }
    }
    return accepted;
  }

  /**
   * Retrieves buffered controls for an entity at the target tick.
   * - If the car is marked stale (> 1.0s without valid input), returns NEUTRAL_CONTROLS.
   * - Otherwise, if not available in buffer, returns fallbackControls (last acknowledged) for up to 1.0s.
   * @param {number} carIndex
   * @param {number} tick
   * @param {object} [fallbackControls=null]
   * @returns {object}
   */
  getControlsForTick(carIndex, tick, fallbackControls = null) {
    let buf = this.carInputBuffers.get(carIndex);
    if (buf && buf.has(tick)) {
      return buf.get(tick);
    }

    const isStale = this.staleCars.has(carIndex);
    const resolved = (!isStale && fallbackControls) ? { ...fallbackControls } : { ...NEUTRAL_CONTROLS };
    if (this.isPaused) {
      return resolved;
    }
    if (!buf) {
      buf = new Map();
      this.carInputBuffers.set(carIndex, buf);
    }
    buf.set(tick, resolved);
    const count = (this.starvationCounts.get(carIndex) || 0) + 1;
    this.starvationCounts.set(carIndex, count);
    if (count <= 3 || count % 60 === 0) {
      console.warn(
        `[NetworkInputBuffer] Input starvation for car #${carIndex} at tick #${tick} (total starvations: ${count}), falling back to ${(!isStale && fallbackControls) ? 'last acknowledged controls' : 'neutral controls'}`
      );
    }
    return resolved;
  }

  /**
   * Purges historical inputs strictly older than current simulation tick
   * @param {number} tick
   */
  pruneOlderThan(tick) {
    for (const buf of this.carInputBuffers.values()) {
      for (const oldTick of buf.keys()) {
        if (oldTick <= tick) {
          buf.delete(oldTick);
        }
      }
    }
  }

  /**
   * Returns current pending future input buffer depth
   * @param {number} carIndex
   * @param {number} currentTick
   * @returns {number}
   */
  getInputBufferSize(carIndex, currentTick) {
    const buf = this.carInputBuffers.get(carIndex);
    if (!buf || buf.size === 0) return 0;
    let futureCount = 0;
    for (const tick of buf.keys()) {
      if (tick >= currentTick) futureCount++;
    }
    return Math.min(this.maxBufferTicks, futureCount);
  }

  getStarvationCount(carIndex) {
    return this.starvationCounts.get(carIndex) || 0;
  }

  /**
   * Clear all pending buffers
   */
  clear() {
    this.carInputBuffers.clear();
    this.staleCars.clear();
  }
}

export default NetworkInputBuffer;
