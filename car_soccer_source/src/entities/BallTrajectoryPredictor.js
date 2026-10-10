/**
 * BallTrajectoryPredictor.js
 * High-performance 3D visual subsystem for Ball Trajectory Prediction.
 *
 * Powered by RocketSim WASM BallPredTracker (up to 5.0 seconds = 600 ticks @ 120Hz).
 * Features:
 * - Purely client-side local prediction driven directly by native physics state
 * - World-space line thickness relative to ball size (1% - 75% of ball diameter, step 1%)
 * - Mandatory Native Physics Triggers (Zero-Overhead Raw Coordinate Comparison):
 *     1. Linear Velocity Threshold: Predicts only when at least one velocity component >= 250 UU/s.
 *     2. Trajectory Deviation Check: Recomputes when live ball position deviates > 5 UU from predicted point.
 * - Dual trajectory modes:
 *     * Static Mode: Dashed pattern fixed in world space; ball follows path; passed frames disappear
 *     * Dynamic Mode (Default): Dashed pattern flows forward relative to live ball position (ball pushes line)
 * - Hardware-accelerated 3D world-space wide lines using Three.js LineSegments2 & LineMaterial (worldUnits: true).
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export const DEFAULT_TRAJECTORY_SETTINGS = Object.freeze({
  enabled: true,
  predictionTicks: 600,        // 60 - 600 ticks (default: 600 ticks = 5.0s @ 120Hz)
  solidTicks: 50,              // 5 - 240 ticks (default: 50 ticks)
  transparentTicks: 20,        // 5 - 240 ticks (default: 20 ticks)
  thickness: 10,               // 1% - 75% of ball diameter (default: 10%)
  opacity: 0.5,                // 0.05 - 1.0 (default: 0.5)
  color: '#000000',            // Black (default: #000000)
  dynamicMode: true            // true: Ball pushes line (default: true)
});

export const TRAJECTORY_STORAGE_KEY = 'car_soccer_ball_trajectory_config_v3';
const LEGACY_STORAGE_KEY_V2 = 'car_soccer_ball_trajectory_config_v2';
const LEGACY_STORAGE_KEY_V1 = 'car_soccer_ball_trajectory_config_v1';

export function loadSavedTrajectorySettings() {
  try {
    const raw = localStorage.getItem(TRAJECTORY_STORAGE_KEY) ||
                localStorage.getItem(LEGACY_STORAGE_KEY_V2) ||
                localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_TRAJECTORY_SETTINGS.enabled,
        predictionTicks: Math.min(600, Math.max(60, Number(parsed.predictionTicks) || DEFAULT_TRAJECTORY_SETTINGS.predictionTicks)),
        solidTicks: Math.min(240, Math.max(5, Number(parsed.solidTicks) || DEFAULT_TRAJECTORY_SETTINGS.solidTicks)),
        transparentTicks: Math.min(240, Math.max(5, Number(parsed.transparentTicks) || DEFAULT_TRAJECTORY_SETTINGS.transparentTicks)),
        thickness: Math.min(75, Math.max(1, Number(parsed.thickness) || DEFAULT_TRAJECTORY_SETTINGS.thickness)),
        opacity: Math.min(1.0, Math.max(0.05, Number(parsed.opacity) || DEFAULT_TRAJECTORY_SETTINGS.opacity)),
        color: typeof parsed.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.color) ? parsed.color : DEFAULT_TRAJECTORY_SETTINGS.color,
        dynamicMode: typeof parsed.dynamicMode === 'boolean' ? parsed.dynamicMode : DEFAULT_TRAJECTORY_SETTINGS.dynamicMode
      };
    }
  } catch (err) {
    console.warn('[BallTrajectoryPredictor] Failed to load settings from localStorage:', err);
  }
  return { ...DEFAULT_TRAJECTORY_SETTINGS };
}

export function saveTrajectorySettings(settings) {
  try {
    localStorage.setItem(TRAJECTORY_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[BallTrajectoryPredictor] Failed to save settings to localStorage:', err);
  }
}

export class BallTrajectoryPredictor {
  /**
   * @param {THREE.Scene} scene - Target 3D scene where the trajectory line will be rendered
   * @param {Object} [initialSettings={}] - Initial configuration overrides
   * @param {number} [ballRadius=91.25] - Ball collision radius in world units (Unreal Units)
   * @param {Object} [physics=null] - RocketSimPhysicsEngine reference
   */
  constructor(scene, initialSettings = {}, ballRadius = 91.25, physics = null) {
    this.scene = scene;
    this.ballRadius = Number(ballRadius) || 91.25;
    this.physics = physics;
    this.settings = {
      ...loadSavedTrajectorySettings(),
      ...initialSettings
    };

    // Preallocated typed buffers for points and vertices
    // 600 ticks max, each tick has 3 coordinates (x, y, z)
    this.maxTicks = 600;
    this.predictedPoints = new Float32Array(this.maxTicks * 3); // Three.js render coordinates (x, z, y)
    this.rawPredictedPoints = new Float32Array(this.maxTicks * 3); // Raw RocketSim native coordinates (x, y, z)
    this.predictionCount = 0;
    this.impactTick = -1;
    this.isActive = false;

    // Movement state tracking for trigger management
    this.wasMovingFast = false;
    this.lastVelX = 0;
    this.lastVelY = 0;
    this.lastVelZ = 0;

    // Segment positions buffer (each segment is 2 points = 6 floats)
    // At most 600 segments = 3600 floats
    this.segmentPositionsBuffer = new Float32Array(this.maxTicks * 6);

    // Setup Three.js LineSegments2 rendering pipeline with worldUnits
    const ballDiameter = (this.ballRadius || 91.25) * 2;
    const clampedPct = Math.min(75, Math.max(1, Number(this.settings.thickness) || 10));
    const worldLinewidth = (clampedPct / 100) * ballDiameter;

    this.geometry = new LineSegmentsGeometry();
    this.material = new LineMaterial({
      color: new THREE.Color(this.settings.color),
      linewidth: worldLinewidth,
      transparent: true,
      opacity: this.settings.opacity,
      depthTest: true,
      depthWrite: false,
      dashed: false,
      worldUnits: true
    });
    this.material.resolution.set(
      typeof window !== 'undefined' ? window.innerWidth : 1920,
      typeof window !== 'undefined' ? window.innerHeight : 1080
    );

    this.lineMesh = new LineSegments2(this.geometry, this.material);
    this.lineMesh.name = 'ball-trajectory-predictor-line';
    this.lineMesh.frustumCulled = false;
    this.lineMesh.visible = false;

    if (this.scene) {
      this.scene.add(this.lineMesh);
    }
  }

  /**
   * Updates ball radius in world units and adjusts 3D line width accordingly.
   * @param {number} radius
   */
  setBallRadius(radius) {
    if (typeof radius === 'number' && radius > 0) {
      this.ballRadius = radius;
      this.syncMaterialProperties();
    }
  }

  /**
   * Sets the physics engine reference.
   * @param {Object} physics
   */
  setPhysicsEngine(physics) {
    this.physics = physics;
    if (physics?.ballRadius) {
      this.setBallRadius(physics.ballRadius);
    }
  }

  /**
   * Synchronizes Three.js LineMaterial uniforms from current settings & ball dimensions.
   */
  syncMaterialProperties() {
    if (!this.material) return;
    this.material.color.set(this.settings.color);
    const ballDiameter = (this.ballRadius || 91.25) * 2;
    const clampedPct = Math.min(75, Math.max(1, Number(this.settings.thickness) || 10));
    this.material.linewidth = (clampedPct / 100) * ballDiameter;
    this.material.opacity = this.settings.opacity;
  }

  /**
   * Updates configuration settings and syncs visual material properties.
   * @param {Partial<typeof DEFAULT_TRAJECTORY_SETTINGS>} newSettings
   */
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    this.syncMaterialProperties();

    if (!this.settings.enabled) {
      this.clear();
    }

    saveTrajectorySettings(this.settings);
  }

  /**
   * Trigger prediction from current ball physics state.
   * @param {Object} [physics] - RocketSimPhysicsEngine instance
   * @param {number} [targetTick] - Current tick
   * @returns {number} Count of predicted ticks
   */
  predictFromCurrentState(physics = null, targetTick = null) {
    const phys = physics || this.physics;
    if (!this.settings.enabled || !phys) {
      return 0;
    }

    const distanceTicks = Math.min(600, Math.max(60, this.settings.predictionTicks));
    const seconds = Math.min(5.0, Math.max(0.5, (distanceTicks + 0.05) / 120.0));

    const count = phys.updateBallPrediction(seconds);
    const rawData = phys.getBallPrediction();

    if (!rawData || count <= 0) {
      this.clear();
      return 0;
    }

    const actualCount = Math.min(count, distanceTicks, this.maxTicks);
    const resolvedTick = targetTick !== null && targetTick !== undefined
      ? targetTick
      : (phys.getHeaderView()?.tickCount ?? 0);

    this.impactTick = resolvedTick;
    this.predictionCount = actualCount;

    // Convert coordinates from RocketSim (X=fwd, Y=right, Z=up) to Three.js (X=x, Y=z, Z=y)
    // Also retain raw RocketSim coordinates for zero-overhead deviation testing
    for (let i = 0; i < actualCount; i++) {
      const srcOffset = i * 6; // posX, posY, posZ, velX, velY, velZ
      const dstOffset = i * 3;
      const x = rawData[srcOffset + 0];
      const y = rawData[srcOffset + 1];
      const z = rawData[srcOffset + 2];

      // Three.js coordinates for rendering
      this.predictedPoints[dstOffset + 0] = x;
      this.predictedPoints[dstOffset + 1] = z; // Three.js height
      this.predictedPoints[dstOffset + 2] = y;

      // Raw RocketSim native coordinates (UU)
      this.rawPredictedPoints[dstOffset + 0] = x;
      this.rawPredictedPoints[dstOffset + 1] = y;
      this.rawPredictedPoints[dstOffset + 2] = z;
    }

    this.isActive = true;
    return actualCount;
  }

  /**
   * Main per-frame update loop.
   * Directly evaluates raw native velocity and position offsets with minimal overhead.
   *
   * @param {number} currentTick - Current physics simulation tick count
   * @param {THREE.Vector3} [liveBallPosition] - Optional live ball position for smooth anchor
   * @param {number} [renderWidth] - Viewport width
   * @param {number} [renderHeight] - Viewport height
   * @param {Object} [physics] - Optional physics engine reference
   */
  update(currentTick, liveBallPosition = null, renderWidth = null, renderHeight = null, physics = null) {
    if (!this.settings.enabled) {
      if (this.lineMesh && this.lineMesh.visible) {
        this.lineMesh.visible = false;
      }
      return;
    }

    const phys = physics || this.physics;

    // Sync viewport resolution for LineMaterial aspect ratio calculation
    if (renderWidth && renderHeight && this.material) {
      this.material.resolution.set(renderWidth, renderHeight);
    }

    if (!phys) {
      return;
    }

    // Direct access to native shared state buffer (Zero allocations, zero conversions)
    // SIM_OFFSETS.BALL = 4: posX[4], posY[5], posZ[6], velX[16], velY[17], velZ[18]
    const stateBuf = phys.state;
    const isSleeping = typeof phys.isBallSleeping === 'function' ? phys.isBallSleeping() : false;

    if (isSleeping || !stateBuf) {
      this.wasMovingFast = false;
      if (this.isActive) this.clear();
      return;
    }

    const rawVelX = stateBuf[16];
    const rawVelY = stateBuf[17];
    const rawVelZ = stateBuf[18];

    // Velocity impulse detection (e.g. car hit ball or sudden direction change)
    const dvX = rawVelX - this.lastVelX;
    const dvY = rawVelY - this.lastVelY;
    const dvZ = rawVelZ - this.lastVelZ;
    const hasImpulse = (dvX > 100 || dvX < -100) || (dvY > 100 || dvY < -100) || (dvZ > 100 || dvZ < -100);

    this.lastVelX = rawVelX;
    this.lastVelY = rawVelY;
    this.lastVelZ = rawVelZ;

    // Check if any velocity component is >= 250 UU/s
    const isFastEnough = (
      (rawVelX >= 250 || rawVelX <= -250) ||
      (rawVelY >= 250 || rawVelY <= -250) ||
      (rawVelZ >= 250 || rawVelZ <= -250)
    );

    // Initial state trigger: only activate when ball is fast enough or receives an impulse
    if (!this.isActive) {
      if (isFastEnough || hasImpulse) {
        this.predictFromCurrentState(phys, currentTick);
        this.wasMovingFast = true;
      }
    } else {
      // Once active, recompute if ball receives a new hit impulse
      if (hasImpulse) {
        this.predictFromCurrentState(phys, currentTick);
      }
    }

    if (!this.isActive || this.predictionCount <= 1) {
      if (this.lineMesh && this.lineMesh.visible) {
        this.lineMesh.visible = false;
      }
      return;
    }

    let elapsed = Math.floor(currentTick - this.impactTick);

    // If all predicted frames have elapsed, ignore and do not recompute
    if (elapsed >= this.predictionCount) {
      this.clear();
      return;
    }

    if (elapsed < 0) {
      this.lineMesh.visible = false;
      return;
    }

    // Direct raw coordinate deviation check (recompute if any coordinate exceeds 5 UU)
    if (elapsed >= 0 && elapsed < this.predictionCount) {
      const predOffset = elapsed * 3;
      const rawPredX = this.rawPredictedPoints[predOffset + 0];
      const rawPredY = this.rawPredictedPoints[predOffset + 1];
      const rawPredZ = this.rawPredictedPoints[predOffset + 2];

      const rawLiveX = stateBuf[4];
      const rawLiveY = stateBuf[5];
      const rawLiveZ = stateBuf[6];

      const diffX = rawLiveX - rawPredX;
      const diffY = rawLiveY - rawPredY;
      const diffZ = rawLiveZ - rawPredZ;

      if ((diffX > 5 || diffX < -5) || (diffY > 5 || diffY < -5) || (diffZ > 5 || diffZ < -5)) {
        this.predictFromCurrentState(phys, currentTick);
        elapsed = 0;
      }
    }

    const solidTicks = Math.max(5, Math.min(240, this.settings.solidTicks));
    const transparentTicks = Math.max(5, Math.min(240, this.settings.transparentTicks));
    const cycleLength = solidTicks + transparentTicks;
    const isDynamic = Boolean(this.settings.dynamicMode);

    const startIndex = Math.max(0, elapsed);
    const endIndex = this.predictionCount - 1;

    let floatCount = 0;

    for (let k = startIndex; k < endIndex; k++) {
      let isSolid = false;
      if (isDynamic) {
        // Dynamic Mode ("Ball pushes line"):
        // Dash cycle phase flows forward relative to live ball position (k - elapsed).
        const deltaFromBall = k - elapsed;
        const phase = deltaFromBall % cycleLength;
        isSolid = phase < solidTicks;
      } else {
        // Static Mode ("Ball follows line"):
        // Dash cycle phase is anchored to absolute predicted tick k from impact.
        const phase = k % cycleLength;
        isSolid = phase < solidTicks;
      }

      if (!isSolid) {
        continue;
      }

      const p0Offset = k * 3;
      const p1Offset = (k + 1) * 3;

      if (k === startIndex && liveBallPosition) {
        this.segmentPositionsBuffer[floatCount++] = liveBallPosition.x;
        this.segmentPositionsBuffer[floatCount++] = liveBallPosition.y;
        this.segmentPositionsBuffer[floatCount++] = liveBallPosition.z;
      } else {
        this.segmentPositionsBuffer[floatCount++] = this.predictedPoints[p0Offset + 0];
        this.segmentPositionsBuffer[floatCount++] = this.predictedPoints[p0Offset + 1];
        this.segmentPositionsBuffer[floatCount++] = this.predictedPoints[p0Offset + 2];
      }

      this.segmentPositionsBuffer[floatCount++] = this.predictedPoints[p1Offset + 0];
      this.segmentPositionsBuffer[floatCount++] = this.predictedPoints[p1Offset + 1];
      this.segmentPositionsBuffer[floatCount++] = this.predictedPoints[p1Offset + 2];
    }

    if (floatCount > 0) {
      const activePositions = this.segmentPositionsBuffer.subarray(0, floatCount);
      this.geometry.setPositions(activePositions);
      this.lineMesh.visible = true;
    } else {
      this.lineMesh.visible = false;
    }
  }

  /**
   * Clears the current trajectory and hides the 3D line.
   */
  clear() {
    this.isActive = false;
    this.predictionCount = 0;
    this.impactTick = -1;
    if (this.lineMesh) {
      this.lineMesh.visible = false;
    }
  }

  /**
   * Cleans up Three.js resources and removes mesh from scene.
   */
  dispose() {
    this.clear();
    if (this.lineMesh && this.scene) {
      this.scene.remove(this.lineMesh);
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    this.lineMesh = null;
  }
}

export default BallTrajectoryPredictor;
