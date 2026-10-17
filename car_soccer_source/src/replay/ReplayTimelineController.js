/**
 * ReplayTimelineController.js
 * Unified 256MB WASM Native Replay Buffer & JS RingBuffer Timeline Scrubber and Goal Replay Controller.
 *
 * Capabilities:
 * 1. Direct zero-copy scrubbing over the 256MB C++ Replay Buffer via
 *    `engine.getReplayFrameByOffset(ticksAgo)` and `engine.getReplayFrameByIndex(frameIndex)`,
 *    with seamless fallback to `ReplayRingBuffer`.
 * 2. Interactive timeline playback control:
 *    - Seek by absolute frame index, backward tick offset (`ticksAgo`), or normalized progress `[0..1]`.
 *    - Play / Pause toggle and variable playback speed (`0.25x`, `0.5x`, `1.0x`, `2.0x`) with sub-tick interpolation.
 * 3. Goal Replay slice extraction (`extractGoalReplayFrames`) and pure-math Goal Replay camera framing.
 * 4. Strictly Worker-pure (zero `window`, `document`, `three`, or `ui-system` dependencies).
 */

import {
  SIM_OFFSETS,
  BALL_STATE_STRIDE,
  CAR_STATE_STRIDE,
  MAX_CARS
} from '../physics/RocketSimConstants.js';
import {
  GAME_STATE_BUFFER_FLOATS,
  REPLAY_TICK_RATE
} from './ReplayRingBuffer.js';

export const REPLAY_PLAYBACK_SPEEDS = Object.freeze([0.25, 0.5, 1.0, 2.0]);
export const DEFAULT_GOAL_REPLAY_TICKS = 360; // 3.0s @ 120Hz

/**
 * Extracts a chronological slice of replay frames from either a `ReplayRingBuffer`
 * or the 256MB C++ WASM Replay Buffer (`getReplayFrameByOffset`).
 *
 * @param {object} options
 * @param {import('./ReplayRingBuffer.js').ReplayRingBuffer|null} [options.ringBuffer]
 * @param {import('../physics/RocketSimPhysicsEngine.js').RocketSimPhysicsEngine|null} [options.engine]
 * @param {number} [options.durationTicks=360]
 * @returns {Array<{ tick: number, snapshot: Float32Array, signals: Array<object>, audioEvents: Array<object> }>}
 */
export function extractGoalReplayFrames({ ringBuffer = null, engine = null, durationTicks = DEFAULT_GOAL_REPLAY_TICKS } = {}) {
  const maxTicks = Math.max(1, Math.floor(durationTicks));

  if (ringBuffer && ringBuffer.size > 0) {
    const recent = ringBuffer.getRecentFrames(maxTicks);
    if (recent.length > 0) {
      return recent.filter(Boolean);
    }
  }

  if (engine && typeof engine.getReplayFrameCount === 'function' && typeof engine.getReplayFrameByOffset === 'function') {
    const totalWasmFrames = engine.getReplayFrameCount();
    const count = Math.min(totalWasmFrames, maxTicks);
    const frames = new Array(count);
    for (let i = 0; i < count; i++) {
      const ticksAgo = count - 1 - i;
      const view = engine.getReplayFrameByOffset(ticksAgo);
      if (view) {
        const snapshot = new Float32Array(view.length);
        snapshot.set(view);
        frames[i] = {
          tick: Math.floor(snapshot[0] || 0),
          snapshot,
          signals: [],
          audioEvents: []
        };
      }
    }
    return frames.filter(Boolean);
  }

  return [];
}

/**
 * Applies a 424-float GameStateBufferPod (or 4201-float ArenaSnapshotPod) replay frame
 * directly to a RocketSimPhysicsEngine instance and optional PhysicsStateInterpolator.
 *
 * @param {import('../physics/RocketSimPhysicsEngine.js').RocketSimPhysicsEngine} engine
 * @param {Float32Array|null} frameBuffer
 * @param {import('../physics/PhysicsStateInterpolator.js').PhysicsStateInterpolator|null} [interpolator=null]
 * @param {Float32Array|null} [prevFrameBuffer=null]
 * @param {number} [alpha=1.0]
 * @returns {boolean}
 */
export function applyReplayFrameToEngine(engine, frameBuffer, interpolator = null, prevFrameBuffer = null, alpha = 1.0) {
  if (!engine || !frameBuffer || frameBuffer.length === 0) return false;

  const fullSnapshotSize = typeof engine.getStateSnapshotSize === 'function'
    ? engine.getStateSnapshotSize()
    : 4201;

  if (frameBuffer.length >= fullSnapshotSize) {
    engine.restoreState(frameBuffer);
  } else if (frameBuffer.length >= 410) {
    const headerCars = Math.min(MAX_CARS, Math.max(0, Math.round(frameBuffer[SIM_OFFSETS.NUM_CARS] || 0)));
    while (engine.numCars < headerCars && typeof engine.addCar === 'function') {
      engine.addCar(engine.numCars % 2, 'octane');
    }
    if (typeof engine.setBallState === 'function') {
      engine.setBallState(frameBuffer.subarray(SIM_OFFSETS.BALL, SIM_OFFSETS.BALL + BALL_STATE_STRIDE));
    }
    const numCars = Math.min(engine.numCars, headerCars || engine.numCars, MAX_CARS);
    for (let c = 0; c < numCars; c++) {
      const carOffset = SIM_OFFSETS.CARS + c * CAR_STATE_STRIDE;
      if (typeof engine.setCarState === 'function') {
        engine.setCarState(c, frameBuffer.subarray(carOffset, carOffset + CAR_STATE_STRIDE));
      }
    }
    if (engine.state) {
      const copyLen = Math.min(frameBuffer.length, engine.state.length);
      engine.state.subarray(0, copyLen).set(frameBuffer.subarray(0, copyLen));
    }
  } else {
    return false;
  }

  if (interpolator) {
    const currLen = Math.min(interpolator.currState.length, engine.state.length);
    interpolator.currState.subarray(0, currLen).set(engine.state.subarray(0, currLen));
    if (prevFrameBuffer && prevFrameBuffer.length >= 410 && prevFrameBuffer.length <= 512) {
      const prevLen = Math.min(interpolator.prevState.length, prevFrameBuffer.length);
      interpolator.prevState.subarray(0, prevLen).set(prevFrameBuffer.subarray(0, prevLen));
      interpolator.alpha = Math.max(0, Math.min(1, alpha));
    } else {
      interpolator.prevState.subarray(0, currLen).set(engine.state.subarray(0, currLen));
      interpolator.alpha = 0;
    }
  }

  return true;
}

/**
 * Computes pure-math 3D camera placement (Unreal Units: X right, Y forward toward Orange goal, Z up)
 * for framing the ball and scoring trajectory during a Goal Replay.
 *
 * @param {Float32Array} stateBuffer - 424-float GameStateBufferPod
 * @param {number} [scoringTeam=0] - 0: Blue scored (into Orange goal +Y), 1: Orange scored (into Blue goal -Y)
 * @returns {{ eyeX: number, eyeY: number, eyeZ: number, targetX: number, targetY: number, targetZ: number }}
 */
export function computeGoalReplayCameraPose(stateBuffer, scoringTeam = 0) {
  if (!stateBuffer || stateBuffer.length < SIM_OFFSETS.BALL + BALL_STATE_STRIDE) {
    return { eyeX: 0, eyeY: -3600, eyeZ: 420, targetX: 0, targetY: 0, targetZ: 120 };
  }

  const ballX = stateBuffer[SIM_OFFSETS.BALL];
  const ballY = stateBuffer[SIM_OFFSETS.BALL + 1];
  const ballZ = stateBuffer[SIM_OFFSETS.BALL + 2];
  const ballVelX = stateBuffer[SIM_OFFSETS.BALL + 12] || 0;
  const ballVelY = stateBuffer[SIM_OFFSETS.BALL + 13] || 0;

  const goalSignY = (scoringTeam === 0 || ballY >= 0) ? 1.0 : -1.0;
  const goalY = goalSignY * 5120.0;

  // Position camera behind the ball looking toward the target goal net, slightly elevated
  const dirToGoalX = -ballX;
  const dirToGoalY = goalY - ballY;
  const distToGoal = Math.hypot(dirToGoalX, dirToGoalY) || 1.0;
  const nx = dirToGoalX / distToGoal;
  const ny = dirToGoalY / distToGoal;

  const sideOffset = Math.abs(ballVelX) > 50 ? Math.sign(ballVelX) * -180.0 : 160.0;
  const rawEyeX = ballX - nx * 680.0 + sideOffset;
  const rawEyeY = ballY - ny * 680.0;
  const rawEyeZ = Math.max(180.0, Math.min(1650.0, ballZ + 210.0));

  // Clamp camera inside arena bounds so it never clips outside walls
  const eyeX = Math.max(-3750.0, Math.min(3750.0, rawEyeX));
  const eyeY = Math.max(-4950.0, Math.min(4950.0, rawEyeY));
  const eyeZ = rawEyeZ;

  const targetX = ballX * 0.75;
  const targetY = ballY * 0.75 + goalY * 0.25 + (ballVelY * 0.05);
  const targetZ = Math.max(95.0, ballZ + 25.0);

  return { eyeX, eyeY, eyeZ, targetX, targetY, targetZ };
}

export class ReplayTimelineController {
  /**
   * @param {object} [options={}]
   * @param {import('../physics/RocketSimPhysicsEngine.js').RocketSimPhysicsEngine|null} [options.engine]
   * @param {import('./ReplayRingBuffer.js').ReplayRingBuffer|null} [options.ringBuffer]
   */
  constructor(options = {}) {
    this.engine = options.engine || null;
    this.ringBuffer = options.ringBuffer || null;

    this.activeFrames = [];
    this.cursorFloat = 0;
    this.isPaused = false;
    this.playbackSpeed = 1.0;
    this.isScrubbing = false;
    this.scoringTeam = 0;
    this.isActive = false;

    this._SmoothedEye = null;
    this._SmoothedTarget = null;
  }

  attach(engine, ringBuffer = null) {
    this.engine = engine || this.engine;
    if (ringBuffer) this.ringBuffer = ringBuffer;
    return this;
  }

  /**
   * Total frames currently stored in the 256MB C++ Replay Buffer (or fallback JS ring buffer).
   * @returns {number}
   */
  getTotalRecordedFrames() {
    if (this.ActiveWindowCount > 0) {
      return this.ActiveWindowCount;
    }
    const wasmCount = this.engine?.getReplayFrameCount?.() ?? 0;
    if (wasmCount > 0) return wasmCount;
    return this.ringBuffer?.size ?? 0;
  }

  get ActiveWindowCount() {
    return Array.isArray(this.activeFrames) ? this.activeFrames.length : 0;
  }

  get currentFrameIndex() {
    const total = this.getTotalRecordedFrames();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(total - 1, Math.floor(this.cursorFloat)));
  }

  get progress() {
    const total = this.getTotalRecordedFrames();
    if (total <= 1) return 0;
    return Math.max(0, Math.min(1, this.cursorFloat / (total - 1)));
  }

  /**
   * Starts a Goal Replay or Timeline Scrubbing session.
   * @param {object} [options={}]
   * @param {number} [options.durationTicks=360]
   * @param {number} [options.scoringTeam=0]
   * @param {Array<object>|null} [options.frames=null]
   */
  beginReplaySession(options = {}) {
    const durationTicks = options.durationTicks ?? DEFAULT_GOAL_REPLAY_TICKS;
    this.scoringTeam = options.scoringTeam ?? 0;
    this.activeFrames = Array.isArray(options.frames) && options.frames.length > 0
      ? options.frames
      : extractGoalReplayFrames({
          ringBuffer: this.ringBuffer,
          engine: this.engine,
          durationTicks
        });
    this.cursorFloat = 0;
    this.isPaused = false;
    this.isScrubbing = false;
    this.playbackSpeed = 1.0;
    this.isActive = true;
    this._SmoothedEye = null;
    this._SmoothedTarget = null;
    return this.activeFrames.length;
  }

  endReplaySession() {
    this.isActive = false;
    this.isPaused = false;
    this.isScrubbing = false;
    this.activeFrames = [];
    this.cursorFloat = 0;
    this._SmoothedEye = null;
    this._SmoothedTarget = null;
  }

  /**
   * Retrieves a 424-float GameStateBufferPod by index from either the active replay slice,
   * the 256MB C++ WASM Replay Buffer (`getReplayFrameByIndex`), or the JS `ReplayRingBuffer`.
   * @param {number} index
   * @returns {Float32Array|null}
   */
  getFrameBufferByIndex(index) {
    if (this.ActiveWindowCount > 0) {
      const clamped = Math.max(0, Math.min(this.ActiveWindowCount - 1, Math.floor(index)));
      return this.activeFrames[clamped]?.snapshot || null;
    }
    if (this.engine && typeof this.engine.getReplayFrameByIndex === 'function') {
      const wasmCount = this.engine.getReplayFrameCount?.() ?? 0;
      if (wasmCount > 0) {
        const clamped = Math.max(0, Math.min(wasmCount - 1, Math.floor(index)));
        return this.engine.getReplayFrameByIndex(clamped);
      }
    }
    if (this.ringBuffer && this.ringBuffer.size > 0) {
      const clamped = Math.max(0, Math.min(this.ringBuffer.size - 1, Math.floor(index)));
      return this.ringBuffer.getFrameAt(clamped)?.snapshot || null;
    }
    return null;
  }

  /**
   * Retrieves a 424-float GameStateBufferPod by backward offset (`ticksAgo`: 0 = newest).
   * Directly utilizes C++ `_physics_getReplayFramePtrByOffset` when available.
   * @param {number} [ticksAgo=0]
   * @returns {Float32Array|null}
   */
  getFrameBufferByOffset(ticksAgo = 0) {
    const safeOffset = Math.max(0, Math.floor(ticksAgo));
    if (this.ActiveWindowCount > 0) {
      const idx = Math.max(0, this.ActiveWindowCount - 1 - safeOffset);
      return this.activeFrames[idx]?.snapshot || null;
    }
    if (this.engine && typeof this.engine.getReplayFrameByOffset === 'function') {
      const wasmFrame = this.engine.getReplayFrameByOffset(safeOffset);
      if (wasmFrame) return wasmFrame;
    }
    if (this.ringBuffer && this.ringBuffer.size > 0) {
      return this.ringBuffer.getFrameByOffset(safeOffset)?.snapshot || null;
    }
    return null;
  }

  seekToIndex(frameIndex, interpolator = null) {
    const total = this.getTotalRecordedFrames();
    if (total <= 0) return null;
    const clamped = Math.max(0, Math.min(total - 1, Number(frameIndex) || 0));
    this.cursorFloat = clamped;
    this.isScrubbing = true;
    const buf = this.getFrameBufferByIndex(Math.floor(clamped));
    if (buf && this.engine) {
      applyReplayFrameToEngine(this.engine, buf, interpolator);
    }
    return buf;
  }

  seekByOffset(ticksAgo = 0, interpolator = null) {
    const total = this.getTotalRecordedFrames();
    if (total <= 0) return null;
    const targetIdx = Math.max(0, Math.min(total - 1, total - 1 - Math.max(0, Math.floor(ticksAgo))));
    this.cursorFloat = targetIdx;
    this.isScrubbing = true;
    const buf = this.getFrameBufferByOffset(ticksAgo);
    if (buf && this.engine) {
      applyReplayFrameToEngine(this.engine, buf, interpolator);
    }
    return buf;
  }

  seekToNormalized(progress01, interpolator = null) {
    const total = this.getTotalRecordedFrames();
    if (total <= 0) return null;
    const p = Math.max(0, Math.min(1, Number(progress01) || 0));
    return this.seekToIndex(p * (total - 1), interpolator);
  }

  setPaused(paused) {
    this.isPaused = Boolean(paused);
    if (this.isPaused) {
      this.isScrubbing = true;
    }
    return this.isPaused;
  }

  togglePause() {
    return this.setPaused(!this.isPaused);
  }

  setPlaybackSpeed(speed) {
    const num = Number(speed);
    if (Number.isFinite(num) && num > 0) {
      this.playbackSpeed = Math.max(0.1, Math.min(4.0, num));
    }
    return this.playbackSpeed;
  }

  cyclePlaybackSpeed() {
    const idx = REPLAY_PLAYBACK_SPEEDS.findIndex((s) => Math.abs(s - this.playbackSpeed) < 0.01);
    const nextIdx = (idx + 1) % REPLAY_PLAYBACK_SPEEDS.length;
    this.playbackSpeed = REPLAY_PLAYBACK_SPEEDS[nextIdx];
    return this.playbackSpeed;
  }

  /**
   * Advances playback cursor by `dtSeconds` and optionally applies the frame to `this.engine`
   * when local scrubbing or non-1x playback is active.
   *
   * @param {number} dtSeconds
   * @param {import('../physics/PhysicsStateInterpolator.js').PhysicsStateInterpolator|null} [interpolator=null]
   * @param {boolean} [applyToEngine=false]
   */
  stepPlayback(dtSeconds, interpolator = null, applyToEngine = false) {
    const total = this.getTotalRecordedFrames();
    if (total <= 0) {
      return { frame: null, frameIndex: 0, totalFrames: 0, progress: 0, isFinished: true };
    }

    if (!this.isPaused) {
      const advanceTicks = Math.max(0, dtSeconds * REPLAY_TICK_RATE * this.playbackSpeed);
      this.cursorFloat = Math.min(total - 1, this.cursorFloat + advanceTicks);
    }

    const baseIdx = Math.max(0, Math.min(total - 1, Math.floor(this.cursorFloat)));
    const nextIdx = Math.min(total - 1, baseIdx + 1);
    const alpha = Math.max(0, Math.min(1, this.cursorFloat - baseIdx));

    const prevFrame = this.getFrameBufferByIndex(baseIdx);
    const currFrame = this.getFrameBufferByIndex(nextIdx) || prevFrame;

    if ((applyToEngine || this.isScrubbing || this.isPaused || this.playbackSpeed !== 1.0) && currFrame && this.engine) {
      applyReplayFrameToEngine(this.engine, currFrame, interpolator, prevFrame, alpha);
    }

    return {
      frame: currFrame,
      prevFrame,
      currFrame,
      alpha,
      frameIndex: baseIdx,
      totalFrames: total,
      progress: total > 1 ? this.cursorFloat / (total - 1) : 1,
      isFinished: this.cursorFloat >= total - 1
    };
  }
}

export default ReplayTimelineController;
