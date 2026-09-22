/**
 * PhysicsStateInterpolator.js
 * 120Hz deterministic physics state accumulator and linear interpolator (deobfuscates CC).
 *
 * Provides smooth rendering at any monitor refresh rate (60Hz, 120Hz, 144Hz, 240Hz, etc.)
 * by interpolating between prevState and currState using alpha = accumulator / timestep.
 * Prevents spiral-of-death by capping max simulated substeps to 12 ticks (100ms) per frame.
 */

import {
  SIM_OFFSETS,
  CAR_STATE_STRIDE,
  BALL_STATE_STRIDE,
  FIXED_TIMESTEP,
  MAX_PHYSICS_SUBSTEPS,
  ArenaHeaderView,
  CarStateView,
  BallStateView,
  BoostPadStateView
} from './RocketSimConstants.js';

export class PhysicsStateInterpolator {
  /**
   * @param {import('./RocketSimPhysicsEngine.js').RocketSimPhysicsEngine} sim
   */
  constructor(sim) {
    this.sim = sim;
    this.prevState = sim.state.slice();
    this.currState = sim.state.slice();

    this.alpha = 0;
    this.lastTicks = 0;
    this.lastDropped = 0;
    this.lastStalled = false;
    this.accumulator = 0;
    this.lastTime = -1;
    this._physicsRate = 120;

    this.currHeaderView = null;
    this.prevHeaderView = null;
    this.currBallView = null;
    this.prevBallView = null;
    this.currCarViews = [];
    this.prevCarViews = [];
    this.currPadViews = [];
    this.prevPadViews = [];
  }

  /**
   * Get zero-allocation ArenaHeaderView attached to currState
   * @returns {ArenaHeaderView}
   */
  getCurrHeaderView() {
    if (!this.currHeaderView) {
      this.currHeaderView = new ArenaHeaderView();
    }
    return this.currHeaderView.attach(this.currState);
  }

  /**
   * Get zero-allocation ArenaHeaderView attached to prevState
   * @returns {ArenaHeaderView}
   */
  getPrevHeaderView() {
    if (!this.prevHeaderView) {
      this.prevHeaderView = new ArenaHeaderView();
    }
    return this.prevHeaderView.attach(this.prevState);
  }

  /**
   * Number of active cars in current physics state
   * @returns {number}
   */
  get numCars() {
    return this.currState ? this.getCurrHeaderView().numCars : 0;
  }

  /**
   * Get zero-allocation BallStateView attached to currState
   * @returns {BallStateView}
   */
  getCurrBallStateView() {
    if (!this.currBallView) {
      this.currBallView = new BallStateView();
    }
    this.currBallView.attach(this.currState);
    return this.currBallView;
  }

  /**
   * Get zero-allocation BallStateView attached to prevState
   * @returns {BallStateView}
   */
  getPrevBallStateView() {
    if (!this.prevBallView) {
      this.prevBallView = new BallStateView();
    }
    this.prevBallView.attach(this.prevState);
    return this.prevBallView;
  }

  /**
   * Get zero-allocation CarStateView attached to currState
   * @param {number} carIndex
   * @returns {CarStateView}
   */
  getCurrCarStateView(carIndex = 0) {
    if (!this.currCarViews[carIndex]) {
      this.currCarViews[carIndex] = new CarStateView();
    }
    this.currCarViews[carIndex].attachCar(this.currState, carIndex);
    return this.currCarViews[carIndex];
  }

  /**
   * Get zero-allocation CarStateView attached to prevState
   * @param {number} carIndex
   * @returns {CarStateView}
   */
  getPrevCarStateView(carIndex = 0) {
    if (!this.prevCarViews[carIndex]) {
      this.prevCarViews[carIndex] = new CarStateView();
    }
    this.prevCarViews[carIndex].attachCar(this.prevState, carIndex);
    return this.prevCarViews[carIndex];
  }

  /**
   * Get zero-allocation BoostPadStateView attached to currState
   * @param {number} padIndex
   * @returns {BoostPadStateView}
   */
  getCurrBoostPadStateView(padIndex = 0) {
    if (!this.currPadViews[padIndex]) {
      this.currPadViews[padIndex] = new BoostPadStateView();
    }
    return this.currPadViews[padIndex].attach(this.currState, padIndex);
  }

  /**
   * Get zero-allocation BoostPadStateView attached to prevState
   * @param {number} padIndex
   * @returns {BoostPadStateView}
   */
  getPrevBoostPadStateView(padIndex = 0) {
    if (!this.prevPadViews[padIndex]) {
      this.prevPadViews[padIndex] = new BoostPadStateView();
    }
    return this.prevPadViews[padIndex].attach(this.prevState, padIndex);
  }

  /**
   * Synchronize ball state immediately without resetting car states
   */
  syncBall() {
    const ballSlice = this.sim.state.subarray(
      SIM_OFFSETS.BALL,
      SIM_OFFSETS.BALL + BALL_STATE_STRIDE
    );
    this.prevState.set(ballSlice, SIM_OFFSETS.BALL);
    this.currState.set(ballSlice, SIM_OFFSETS.BALL);
  }

  /**
   * Synchronize both previous and current states to the simulation state and reset accumulator
   * @param {number} time timestamp (ms)
   */
  sync(time = performance.now()) {
    this.prevState.set(this.sim.state);
    this.currState.set(this.sim.state);
    this.accumulator = 0;
    this.alpha = 0;
    this.lastTime = time;
    this.lastTicks = 0;
  }

  /**
   * Client physics rate in Hz (allowed: 118, 119, 120, 121, 122).
   * Pacing adjusts accumulator flow rate: speedFactor = physicsRate / 120.
   */
  get physicsRate() {
    return this._physicsRate ?? 120;
  }

  set physicsRate(rate) {
    this._physicsRate = Math.max(118, Math.min(122, Math.round(rate)));
  }

  setPhysicsRate(rate) {
    this.physicsRate = rate;
    return this.physicsRate;
  }

  /**
   * Advance the physics accumulator and execute 120Hz physics ticks
   * @param {number} currentTime performance.now() timestamp (ms)
   * @param {() => void} beforeStepCallback Callback to read & apply player controls before stepping
   * @param {(() => boolean) | undefined} stepCallback Optional tick callback (used in Match mode to evaluate AI bot)
   */
  update(currentTime, beforeStepCallback, stepCallback) {
    if (this.lastTime < 0) {
      this.lastTime = currentTime;
    }

    const rawDeltaSec = (currentTime - this.lastTime) / 1000;
    this.lastStalled = rawDeltaSec > 0.25;
    const speedFactor = (this._physicsRate || 120) / 120;
    const deltaSec = rawDeltaSec * speedFactor;
    this.accumulator += Math.min(deltaSec, 0.25);
    this.lastTime = currentTime;

    let ticksToRun = Math.floor(this.accumulator / FIXED_TIMESTEP);
    this.accumulator = Math.max(0, this.accumulator - ticksToRun * FIXED_TIMESTEP);
    this.lastDropped = Math.max(0, ticksToRun - MAX_PHYSICS_SUBSTEPS);

    if (ticksToRun > MAX_PHYSICS_SUBSTEPS) {
      ticksToRun = MAX_PHYSICS_SUBSTEPS;
    }
    this.lastTicks = ticksToRun;

    this.lastTicks = 0;
    if (ticksToRun > 0) {
      for (let i = 0; i < ticksToRun; i++) {
        if (beforeStepCallback) {
          const shouldProceed = beforeStepCallback();
          if (shouldProceed === false) {
            continue;
          }
        }

        this.prevState.set(this.currState);

        if (stepCallback) {
          if (!stepCallback()) {
            this.accumulator = 0;
            break;
          }
        } else {
          this.sim.step(1);
        }

        this.currState.set(this.sim.state);
        this.lastTicks++;
      }
      this.alpha = this.accumulator / FIXED_TIMESTEP;
    } else {
      this.alpha = Math.min(this.accumulator / FIXED_TIMESTEP, 1);
    }
  }
}

// Backward-compatibility alias with original obfuscated symbol CC
export default PhysicsStateInterpolator;
