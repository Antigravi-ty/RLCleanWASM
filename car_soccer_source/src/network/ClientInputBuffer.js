/**
 * src/network/ClientInputBuffer.js
 * Ring buffer storing recent player inputs for redundant UDP packet transmission.
 * 
 * Supports extracting a sliding window of the last N ticks [T, T-1, ..., T-(N-1)]
 * to provide N-fold resilience against packet loss without waiting for retransmission.
 * Supports pruning inputs acknowledged by the server's global input buffer status.
 */

export class ClientInputBuffer {
  /**
   * @param {number} [capacity=64] Must be a power of two
   */
  constructor(capacity = 64) {
    this.capacity = capacity;
    this.mask = capacity - 1;
    this.slots = new Array(capacity);

    this.neutralControls = {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jump: false,
      boost: false,
      handbrake: false
    };

    this.lastRecordedTick = -1;
    this.earliestRecordedTick = -1;
    this.serverAckedTick = -1;
  }

  /**
   * Record a single tick of controls
   * @param {number} tick
   * @param {number} carIndex
   * @param {object} controls
   */
  record(tick, carIndex, controls) {
    const idx = tick & this.mask;
    this.slots[idx] = {
      tick,
      carIndex,
      controls: {
        throttle: Number(controls.throttle ?? 0),
        steer: Number(controls.steer ?? 0),
        pitch: Number(controls.pitch ?? 0),
        yaw: Number(controls.yaw ?? 0),
        roll: Number(controls.roll ?? 0),
        jump: Boolean(controls.jump),
        boost: Boolean(controls.boost),
        handbrake: Boolean(controls.handbrake)
      }
    };

    if (this.earliestRecordedTick < 0 || tick < this.earliestRecordedTick) {
      this.earliestRecordedTick = tick;
    }
    if (tick > this.lastRecordedTick) {
      this.lastRecordedTick = tick;
    }
  }

  /**
   * Get controls for a specific historical tick
   * @param {number} tick
   * @returns {object|null}
   */
  get(tick) {
    const idx = tick & this.mask;
    const entry = this.slots[idx];
    if (entry && entry.tick === tick) {
      return entry.controls;
    }
    return null;
  }

  /**
   * Update server-acknowledged tick boundary
   * @param {number} ackedTick
   */
  pruneOlderThan(ackedTick) {
    if (ackedTick > this.serverAckedTick) {
      this.serverAckedTick = ackedTick;
    }
  }

  /**
   * Extract a sliding window of recent input history [T, T-1, ..., T-(count-1)]
   * Ordered from oldest (T - count + 1) to newest (T).
   * @param {number} targetTick Current tick T
   * @param {number} [count=10] Window size (default 10 ticks)
   * @param {number} [carIndex=0]
   * @returns {Array<{ tick: number, carIndex: number, controls: object }>}
   */
  getRedundantWindow(targetTick, count = 10, carIndex = 0) {
    const window = [];
    const startTick = targetTick - count + 1;

    let fallbackControls = this.neutralControls;

    // Scan to find the earliest known valid control for padding
    for (let t = startTick; t <= targetTick; t++) {
      const entry = this.get(t);
      if (entry) {
        fallbackControls = entry;
        break;
      }
    }

    for (let t = startTick; t <= targetTick; t++) {
      const controls = this.get(t) || fallbackControls;
      window.push({
        tick: t,
        carIndex,
        controls: { ...controls }
      });
      fallbackControls = controls;
    }

    return window;
  }

  /**
   * Clear all recorded inputs
   */
  clear() {
    this.slots.fill(undefined);
    this.lastRecordedTick = -1;
    this.earliestRecordedTick = -1;
    this.serverAckedTick = -1;
  }
}

export default ClientInputBuffer;
