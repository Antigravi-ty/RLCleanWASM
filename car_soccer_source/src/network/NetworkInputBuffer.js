/**
 * src/network/NetworkInputBuffer.js
 * Network-layer input buffering subsystem decoupled from PhysicsEngineManager.
 * 
 * - Enforces immutable past: historical inputs (tick < currentTick) dropped.
 * - Future tick ceiling (maxBufferTicks, default 24/64) to prevent buffer bloat.
 * - Decoupled from PhysicsEngineManager so single-player operates with 0ms direct latency.
 * - Ingests redundant input history from UDP/WebRTC data packets.
 */

export const MAX_INPUT_BUFFER_TICKS = 10;

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
   * @param {number} [maxBufferTicks=64]
   */
  constructor(maxBufferTicks = MAX_INPUT_BUFFER_TICKS) {
    this.maxBufferTicks = maxBufferTicks;
    this.carInputBuffers = new Map(); // carIndex -> Map<tick, controls>
  }

  /**
   * Register vehicle slot in the network input buffer
   * @param {number} carIndex
   */
  registerCar(carIndex) {
    if (!this.carInputBuffers.has(carIndex)) {
      this.carInputBuffers.set(carIndex, new Map());
    }
  }

  /**
   * Unregister vehicle slot and clear pending inputs
   * @param {number} carIndex
   */
  unregisterCar(carIndex) {
    this.carInputBuffers.delete(carIndex);
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
    if (targetTick < currentTick) return false;
    if (targetTick - currentTick > this.maxBufferTicks) return false;

    let buf = this.carInputBuffers.get(carIndex);
    if (!buf) {
      buf = new Map();
      this.carInputBuffers.set(carIndex, buf);
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
   * If not available, returns fallback controls (last acknowledged or neutral).
   * @param {number} carIndex
   * @param {number} tick
   * @param {object} [fallbackControls=null]
   * @returns {object}
   */
  getControlsForTick(carIndex, tick, fallbackControls = null) {
    const buf = this.carInputBuffers.get(carIndex);
    if (buf && buf.has(tick)) {
      return buf.get(tick);
    }
    return fallbackControls ? { ...fallbackControls } : { ...NEUTRAL_CONTROLS };
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

  /**
   * Clear all pending buffers
   */
  clear() {
    this.carInputBuffers.clear();
  }
}

export default NetworkInputBuffer;
