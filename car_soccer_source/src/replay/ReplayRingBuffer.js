/**
 * ReplayRingBuffer.js
 * First-In-First-Out (FIFO) Circular Ring Buffer for 120Hz Replay & Audio Event Recording.
 *
 * Design Specifications:
 * - Positive Count-Up Mode (Free Play / Online Warmup / Training):
 *   Uses a 2.5-minute (150s @ 120Hz = 18,000 ticks) FIFO circular buffer.
 *   Even if a session runs for 8+ minutes, only the most recent 2.5 minutes are kept in FIFO order,
 *   and countdown-specific audio alerts (30s / 10s countdown) are suppressed.
 * - Countdown Match Mode (Standard / Bot / Online Match):
 *   Uses a 14-minute (7 + 7 min = 840s @ 120Hz = 100,800 ticks) capacity buffer
 *   covering a full 5-minute regulation period (up to ~7 min wall-clock with kickoffs/goals)
 *   plus up to 7 minutes of Overtime before Possession tie-breaker resolves the match.
 * - Zero Three.js / DOM dependencies (safe inside Web Workers and Headless Node.js).
 */

import { MATCH_SIGNALS } from '../physics/RocketSimConstants.js';

export const CLOCK_MODES = Object.freeze({
  REGULATION_COUNTDOWN: 0,
  OVERTIME_COUNTUP: 1,
  TRAINING_COUNTUP: 2
});

export const REPLAY_TICK_RATE = 120;

/** 2.5 minutes (150 seconds) @ 120Hz = 18,000 ticks for positive count-up mode */
export const COUNTUP_REPLAY_DURATION_SECONDS = 150;
export const COUNTUP_REPLAY_CAPACITY_TICKS = COUNTUP_REPLAY_DURATION_SECONDS * REPLAY_TICK_RATE; // 18,000

/** 7 + 7 = 14 minutes (840 seconds) @ 120Hz = 100,800 ticks for countdown match mode */
export const REGULATION_MAX_WALL_SECONDS = 420; // 7 minutes (5 min clock + kickoffs/celebrations)
export const OVERTIME_MAX_WALL_SECONDS = 420;   // 7 minutes cap before possession tie-breaker
export const COUNTDOWN_REPLAY_DURATION_SECONDS = REGULATION_MAX_WALL_SECONDS + OVERTIME_MAX_WALL_SECONDS; // 840s
export const COUNTDOWN_REPLAY_CAPACITY_TICKS = COUNTDOWN_REPLAY_DURATION_SECONDS * REPLAY_TICK_RATE; // 100,800

/** Compact per-frame float count: Header (4) + Ball (18) + 8 Cars (320) + 34 Boost Pads (68) = 410 floats */
export const COMPACT_SNAPSHOT_FLOATS = 410;
/** Full GameStateBufferPod float count including Possession (6) + Extended Jump/AirTime (8) = 424 floats */
export const GAME_STATE_BUFFER_FLOATS = 424;

export const REPLAY_BUFFER_MODES = Object.freeze({
  COUNTUP_FIFO: 'countup_fifo',
  COUNTDOWN_MATCH: 'countdown_match'
});

/**
 * Maps an authoritative match signal to a replay audio cue (if applicable).
 * Strictly suppresses countdown audio cues when in positive count-up mode (clockMode === 2).
 */
export function resolveReplayAudioCueForSignal(signal, isCountUpMode = false) {
  if (!signal || typeof signal.signalType !== 'number') return null;

  switch (signal.signalType) {
    case MATCH_SIGNALS.KICKOFF_WILL_START:
      return { cueId: 'match_countdown_321', frameId: signal.frameId, param1: signal.param1 };
    case MATCH_SIGNALS.KICKOFF_START:
      return { cueId: 'match_start_go', frameId: signal.frameId, param1: signal.param1 };
    case MATCH_SIGNALS.SCORE_UPDATED:
      if ((signal.param1 || 0) + (signal.param2 || 0) <= 0) {
        return null;
      }
      return { cueId: 'sfx_goal_poof', frameId: signal.frameId, blueScore: signal.param1, orangeScore: signal.param2 };
    case MATCH_SIGNALS.TIME_ALERT_60S:
      return isCountUpMode ? null : { cueId: 'match_60_seconds_left', frameId: signal.frameId };
    case MATCH_SIGNALS.TIME_ALERT_30S:
      return isCountUpMode ? null : { cueId: 'match_30_seconds_left', frameId: signal.frameId };
    case MATCH_SIGNALS.COUNTDOWN_10S:
      return isCountUpMode ? null : { cueId: 'match_countdown_10s', frameId: signal.frameId, remainingSeconds: signal.param1 };
    case MATCH_SIGNALS.CLOCK_UPDATED_SECONDS: {
      const clockMode = signal.param2 ?? 0;
      if (isCountUpMode || clockMode === CLOCK_MODES.TRAINING_COUNTUP || clockMode === CLOCK_MODES.OVERTIME_COUNTUP) {
        return null;
      }
      if (signal.param1 === 30) {
        return { cueId: 'match_30_seconds_left', frameId: signal.frameId };
      }
      if (signal.param1 <= 10 && signal.param1 >= 1) {
        return { cueId: 'match_countdown_10s', frameId: signal.frameId, remainingSeconds: signal.param1 };
      }
      return null;
    }
    case MATCH_SIGNALS.OVERTIME_START:
      return { cueId: 'match_overtime', frameId: signal.frameId };
    case MATCH_SIGNALS.MATCH_ENDED:
      return { cueId: 'match_end_whistle', frameId: signal.frameId, winner: signal.param1, winReason: signal.param2 };
    default:
      return null;
  }
}

export class ReplayRingBuffer {
  /**
   * @param {object} [options={}]
   * @param {string} [options.mode='countdown_match'] - 'countup_fifo' (2.5m) or 'countdown_match' (14m)
   * @param {number} [options.capacityTicks] - Explicit capacity override in ticks
   * @param {number} [options.snapshotFloatLimit=410] - Max floats stored per frame snapshot
   */
  constructor(options = {}) {
    const mode = options.mode || (options.isCountUp ? REPLAY_BUFFER_MODES.COUNTUP_FIFO : REPLAY_BUFFER_MODES.COUNTDOWN_MATCH);
    this.mode = mode;
    this._hasExplicitFloatLimit = typeof options.snapshotFloatLimit === 'number' && options.snapshotFloatLimit > 0;
    this.snapshotFloatLimit = this._hasExplicitFloatLimit ? options.snapshotFloatLimit : GAME_STATE_BUFFER_FLOATS;
    this.capacityTicks = this._resolveCapacityTicks(mode, options.capacityTicks);

    this._slots = new Array(this.capacityTicks);
    this._head = 0; // Next write index (0 .. capacityTicks - 1)
    this._size = 0; // Number of valid frames currently in buffer (0 .. capacityTicks)
    this._totalRecordedFrames = 0;
  }

  _resolveCapacityTicks(mode, explicitCapacity) {
    if (typeof explicitCapacity === 'number' && Number.isFinite(explicitCapacity) && explicitCapacity > 0) {
      return Math.floor(explicitCapacity);
    }
    if (mode === REPLAY_BUFFER_MODES.COUNTUP_FIFO) {
      return COUNTUP_REPLAY_CAPACITY_TICKS;
    }
    if (mode === REPLAY_BUFFER_MODES.COUNTDOWN_MATCH) {
      return COUNTDOWN_REPLAY_CAPACITY_TICKS;
    }
    console.warn(`[ReplayRingBuffer:Fallback] Unknown mode "${mode}", falling back to COUNTDOWN_MATCH capacity (${COUNTDOWN_REPLAY_CAPACITY_TICKS} ticks).`);
    return COUNTDOWN_REPLAY_CAPACITY_TICKS;
  }

  get size() {
    return this._size;
  }

  get capacity() {
    return this.capacityTicks;
  }

  get totalRecordedFrames() {
    return this._totalRecordedFrames;
  }

  get isCountUpMode() {
    return this.mode === REPLAY_BUFFER_MODES.COUNTUP_FIFO;
  }

  /**
   * Switches the ring buffer mode (e.g., between positive count-up training/warmup and countdown match)
   * and resets the FIFO pointers.
   * @param {string} mode - REPLAY_BUFFER_MODES.COUNTUP_FIFO or REPLAY_BUFFER_MODES.COUNTDOWN_MATCH
   * @param {number} [explicitCapacity]
   */
  configureMode(mode, explicitCapacity = null) {
    const nextCapacity = this._resolveCapacityTicks(mode, explicitCapacity);
    this.mode = mode;
    if (nextCapacity !== this.capacityTicks) {
      this.capacityTicks = nextCapacity;
      this._slots = new Array(this.capacityTicks);
    }
    this.clear();
  }

  clear() {
    this._head = 0;
    this._size = 0;
    this._totalRecordedFrames = 0;
  }

  /**
   * Appends a single authoritative frame into the FIFO circular buffer.
   * When full, overwrites the oldest frame in-place (First-In-First-Out) without reallocating Float32Array.
   *
   * @param {number} tick - Authoritative server tick
   * @param {Float32Array|Array<number>|null} stateSnapshot - Physics state snapshot
   * @param {Array<object>} [signals=[]] - Signals emitted on this tick
   * @param {Array<object>} [audioEvents=null] - Optional explicit audio events on this tick
   * @returns {object} The recorded slot reference
   */
  recordFrame(tick, stateSnapshot, signals = [], audioEvents = null) {
    const writeIdx = this._head;
    let slot = this._slots[writeIdx];

    const copyLen = stateSnapshot
      ? Math.min(stateSnapshot.length, this.snapshotFloatLimit)
      : 0;

    if (!slot) {
      slot = {
        tick: 0,
        snapshot: copyLen > 0 ? new Float32Array(copyLen) : null,
        signals: [],
        audioEvents: []
      };
      this._slots[writeIdx] = slot;
    } else if (copyLen > 0) {
      if (!slot.snapshot || slot.snapshot.length !== copyLen) {
        slot.snapshot = new Float32Array(copyLen);
      }
    } else {
      slot.snapshot = null;
    }

    slot.tick = tick >>> 0;
    if (copyLen > 0 && slot.snapshot) {
      if (typeof stateSnapshot.subarray === 'function') {
        slot.snapshot.set(stateSnapshot.subarray(0, copyLen));
      } else {
        for (let i = 0; i < copyLen; i++) {
          slot.snapshot[i] = stateSnapshot[i];
        }
      }
    }

    slot.signals.length = 0;
    slot.audioEvents.length = 0;

    const isCountUp = this.isCountUpMode;
    if (Array.isArray(signals) && signals.length > 0) {
      for (let i = 0; i < signals.length; i++) {
        const sig = signals[i];
        if (!sig) continue;
        slot.signals.push({
          signalId: sig.signalId ?? 0,
          signalType: sig.signalType,
          frameId: sig.frameId ?? tick,
          param1: sig.param1 ?? 0,
          param2: sig.param2 ?? 0
        });
        const cue = resolveReplayAudioCueForSignal(sig, isCountUp);
        if (cue) {
          slot.audioEvents.push(cue);
        }
      }
    }

    if (Array.isArray(audioEvents) && audioEvents.length > 0) {
      for (let i = 0; i < audioEvents.length; i++) {
        if (audioEvents[i]) {
          slot.audioEvents.push(audioEvents[i]);
        }
      }
    }

    this._head = (writeIdx + 1) % this.capacityTicks;
    if (this._size < this.capacityTicks) {
      this._size++;
    }
    this._totalRecordedFrames++;

    return slot;
  }

  /**
   * Returns the physical array index of the oldest frame in the FIFO buffer.
   */
  _oldestPhysicalIndex() {
    if (this._size < this.capacityTicks) {
      return 0;
    }
    return this._head;
  }

  /**
   * Retrieves the frame at logical FIFO index (0 = oldest retained frame, size - 1 = newest frame).
   * @param {number} logicalIndex
   * @returns {object|null}
   */
  getFrameAt(logicalIndex) {
    if (logicalIndex < 0 || logicalIndex >= this._size) {
      return null;
    }
    const physIdx = (this._oldestPhysicalIndex() + logicalIndex) % this.capacityTicks;
    return this._slots[physIdx] || null;
  }

  /**
   * Returns the oldest frame currently retained in the FIFO ring buffer.
   */
  getOldestFrame() {
    return this._size > 0 ? this.getFrameAt(0) : null;
  }

  /**
   * Returns the newest frame currently retained in the FIFO ring buffer.
   */
  getNewestFrame() {
    return this._size > 0 ? this.getFrameAt(this._size - 1) : null;
  }

  /**
   * Retrieves a frame by backward offset from the newest frame (0 = newest frame, size - 1 = oldest frame).
   * Matches the C++ `_physics_getReplayFramePtrByOffset(ticksAgo)` semantics.
   * @param {number} [ticksAgo=0]
   * @returns {object|null}
   */
  getFrameByOffset(ticksAgo = 0) {
    if (this._size <= 0) return null;
    const clampedOffset = Math.max(0, Math.min(this._size - 1, Math.floor(ticksAgo)));
    return this.getFrameAt(this._size - 1 - clampedOffset);
  }

  /**
   * Finds the recorded frame matching or closest to `targetTick`.
   * @param {number} targetTick
   * @returns {object|null}
   */
  findFrameByTick(targetTick) {
    if (this._size <= 0) return null;
    let bestSlot = null;
    let bestDiff = Infinity;
    for (let i = this._size - 1; i >= 0; i--) {
      const slot = this.getFrameAt(i);
      if (!slot) continue;
      if (slot.tick === targetTick) return slot;
      const diff = Math.abs(slot.tick - targetTick);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSlot = slot;
      }
    }
    return bestSlot;
  }

  /**
   * Extracts up to `maxFrames` most recent frames in chronological (FIFO) order.
   * Useful for instant Goal Replays (e.g., last 360 ticks = 3.0s) or exporting the 2.5m count-up buffer.
   * @param {number} [maxFrames=this.size]
   * @returns {Array<object>}
   */
  getRecentFrames(maxFrames = this._size) {
    const count = Math.max(0, Math.min(this._size, Math.floor(maxFrames)));
    const startLogical = this._size - count;
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
      const slot = this.getFrameAt(startLogical + i);
      result[i] = slot ? {
        tick: slot.tick,
        snapshot: slot.snapshot ? new Float32Array(slot.snapshot) : null,
        signals: slot.signals.slice(),
        audioEvents: slot.audioEvents.slice()
      } : null;
    }
    return result;
  }

  /**
   * Collects all replay audio events recorded within [startTick, endTick].
   * @param {number} startTick
   * @param {number} endTick
   * @returns {Array<object>}
   */
  getAudioEventsInRange(startTick, endTick) {
    const events = [];
    for (let i = 0; i < this._size; i++) {
      const slot = this.getFrameAt(i);
      if (!slot || slot.tick < startTick || slot.tick > endTick) continue;
      for (let j = 0; j < slot.audioEvents.length; j++) {
        events.push({ tick: slot.tick, ...slot.audioEvents[j] });
      }
    }
    return events;
  }
}
