import {
  REALISTIC_DRIVE_COUNT,
  REALISTIC_DRIVE_LIFE,
  REALISTIC_DRIVE_RATE,
  REALISTIC_TRAIL_COUNT,
  REALISTIC_TRAIL_LIFE,
  REALISTIC_TRAIL_INTERVAL,
  REALISTIC_MAX_PARTICLES_PER_FRAME,
  CURVE_SCALE,
  CURVE_OPACITY,
  CURVE_VELOCITY,
  CURVE_DRIVE_SIZE,
  CURVE_DRIVE_COLOR,
  CURVE_DRIVE_OPACITY,
  CURVE_DYNAMIC_X,
  CURVE_DYNAMIC_Y,
  CURVE_DYNAMIC_Z,
  CURVE_DYNAMIC_W,
  evalCurveLut
} from './boostCurves.js';
import * as THREE from 'three';

/**
 * Realistic Boost particle state machine, distance-based spawning, and physics updates.
 */
export class RealisticParticlePhysics {
  constructor(driveMesh, trailMesh, nozzleLocal) {
    const { Vector3 } = THREE;
    this.drive = driveMesh;
    this.trail = trailMesh;
    this.nozzleLocal = nozzleLocal;

    this.driveAge = new Float32Array(REALISTIC_DRIVE_COUNT).fill(Infinity);
    this.driveBaseSize = new Float32Array(REALISTIC_DRIVE_COUNT * 2);
    this.driveVelocity = new Float32Array(REALISTIC_DRIVE_COUNT * 3);
    this.driveHead = 0;
    this.driveSpawnAccumulator = 0;
    this.driveParticlesActive = false;

    this.trailAge = new Float32Array(REALISTIC_TRAIL_COUNT).fill(Infinity);
    this.trailBaseSize = new Float32Array(REALISTIC_TRAIL_COUNT * 2);
    this.trailAcceleration = new Float32Array(REALISTIC_TRAIL_COUNT);
    this.trailVelocity = new Float32Array(REALISTIC_TRAIL_COUNT * 3);
    this.trailHead = 0;
    this.trailParticlesActive = false;

    this.previousNozzle = new Vector3();
    this.hasPreviousNozzle = false;
    this.spawnRemainder = 0;

    this._scratchB = new Vector3();
    this._scratchC = new Vector3();
    this._scratchD = new Vector3();
  }

  reset() {
    this.driveAge.fill(Infinity);
    this.trailAge.fill(Infinity);
    this.drive.opacity.fill(0);
    this.trail.opacity.fill(0);
    this.drive.markDirty();
    this.trail.markDirty();
    this.drive.mesh.visible = false;
    this.trail.mesh.visible = false;
    this.driveParticlesActive = false;
    this.trailParticlesActive = false;
    this.hasPreviousNozzle = false;
    this.spawnRemainder = 0;
    this.driveSpawnAccumulator = 0;
  }

  spawnDrive(dt) {
    this.driveSpawnAccumulator += dt * REALISTIC_DRIVE_RATE;
    if (!Number.isFinite(this.driveAge[(this.driveHead + REALISTIC_DRIVE_COUNT - 1) % REALISTIC_DRIVE_COUNT])) {
      this.driveSpawnAccumulator = Math.max(this.driveSpawnAccumulator, 1);
    }
    let spawned = 0;
    while (this.driveSpawnAccumulator >= 1 && spawned < REALISTIC_MAX_PARTICLES_PER_FRAME) {
      this.driveSpawnAccumulator -= 1;
      const head = this.driveHead;
      this.driveHead = (head + 1) % REALISTIC_DRIVE_COUNT;
      const pIdx = head * 3;
      const sIdx = head * 2;

      this.drive.offsets[pIdx] = this.nozzleLocal.x;
      this.drive.offsets[pIdx + 1] = this.nozzleLocal.y;
      this.drive.offsets[pIdx + 2] = this.nozzleLocal.z;

      this.driveVelocity[pIdx] = -(50 + Math.random() * 50);
      this.driveVelocity[pIdx + 1] = -5 + Math.random() * 10;
      this.driveVelocity[pIdx + 2] = -5 + Math.random() * 10;

      this.driveBaseSize[sIdx] = 6.5 + Math.random() * 6;
      this.driveBaseSize[sIdx + 1] = this.driveBaseSize[sIdx];

      this.drive.rotations[head] = Math.random() * Math.PI * 2;
      this.driveAge[head] = 0;
      this.driveParticlesActive = true;
      spawned++;
    }
  }

  spawnTrailByDistance(pos, dt) {
    const { MathUtils } = THREE;
    if (!this.hasPreviousNozzle) {
      this.previousNozzle.copy(pos);
      this.hasPreviousNozzle = true;
      return;
    }

    this._scratchB.copy(this.previousNozzle);
    this._scratchC.subVectors(pos, this._scratchB);
    const dist = this._scratchC.length();
    if (dist < 1e-4) return;
    this._scratchC.divideScalar(dist);

    if (dist > 600) {
      this.previousNozzle.copy(pos);
      this.spawnRemainder = 0;
      return;
    }

    const rem = this.spawnRemainder;
    const step = (Math.random() * 4) / REALISTIC_TRAIL_INTERVAL;
    const progress = rem + dist * step;
    const count = Math.floor(progress);
    const capped = Math.min(count, REALISTIC_MAX_PARTICLES_PER_FRAME);

    this.spawnRemainder = progress - count;

    if (step > 0) {
      for (let i = 0; i < capped; i++) {
        const t = (i + 1 - rem) / step;
        this._scratchD.copy(this._scratchB).addScaledVector(this._scratchC, MathUtils.clamp(t, 0, dist));
        this.spawnTrailParticle(this._scratchD);
      }
    }
    this.previousNozzle.copy(pos);
  }

  spawnTrailParticle(pos) {
    const head = this.trailHead;
    this.trailHead = (head + 1) % REALISTIC_TRAIL_COUNT;
    const pIdx = head * 3;
    const sIdx = head * 2;

    this.trail.offsets[pIdx] = pos.x;
    this.trail.offsets[pIdx + 1] = pos.y;
    this.trail.offsets[pIdx + 2] = pos.z;

    this.trailVelocity[pIdx] = 0;
    this.trailVelocity[pIdx + 1] = 0;
    this.trailVelocity[pIdx + 2] = 0;

    this.trailAcceleration[head] = 15 + Math.random() * 15;
    this.trailBaseSize[sIdx] = 35 + Math.random() * 15;
    this.trailBaseSize[sIdx + 1] = this.trailBaseSize[sIdx];

    this.trail.rotations[head] = Math.random() * Math.PI * 2;
    this.trailAge[head] = 0;
    this.trailParticlesActive = true;
  }

  updateDrive(dt) {
    let active = false;
    for (let i = 0; i < REALISTIC_DRIVE_COUNT; i++) {
      this.driveAge[i] += dt;
      const progress = this.driveAge[i] / REALISTIC_DRIVE_LIFE;
      const pIdx = i * 3;
      const sIdx = i * 2;

      if (progress >= 1) {
        this.drive.opacity[i] = 0;
        this.drive.sizes[sIdx] = this.drive.sizes[sIdx + 1] = 0;
        continue;
      }

      active = true;
      this.drive.offsets[pIdx] += this.driveVelocity[pIdx] * dt;
      this.drive.offsets[pIdx + 1] += this.driveVelocity[pIdx + 1] * dt;
      this.drive.offsets[pIdx + 2] += this.driveVelocity[pIdx + 2] * dt;

      const sizeScale = evalCurveLut(CURVE_DRIVE_SIZE, progress);
      this.drive.sizes[sIdx] = this.driveBaseSize[sIdx] * sizeScale;
      this.drive.sizes[sIdx + 1] = this.driveBaseSize[sIdx + 1] * sizeScale;

      this.drive.opacity[i] = evalCurveLut(CURVE_DRIVE_OPACITY, progress);
      this.drive.colorScale[i] = evalCurveLut(CURVE_DRIVE_COLOR, progress);

      const dIdx = i * 4;
      this.drive.dynamic[dIdx] = evalCurveLut(CURVE_DYNAMIC_X, progress);
      this.drive.dynamic[dIdx + 1] = evalCurveLut(CURVE_DYNAMIC_Y, progress);
      this.drive.dynamic[dIdx + 2] = 1;
      this.drive.dynamic[dIdx + 3] = evalCurveLut(CURVE_DYNAMIC_W, progress);
    }
    this.driveParticlesActive = active;
    return active;
  }

  updateTrail(dt) {
    let active = false;
    for (let i = 0; i < REALISTIC_TRAIL_COUNT; i++) {
      this.trailAge[i] += dt;
      const progress = this.trailAge[i] / REALISTIC_TRAIL_LIFE;
      const pIdx = i * 3;
      const sIdx = i * 2;

      if (progress >= 1) {
        this.trail.opacity[i] = 0;
        this.trail.sizes[sIdx] = this.trail.sizes[sIdx + 1] = 0;
        continue;
      }

      active = true;
      const velScale = evalCurveLut(CURVE_VELOCITY, progress);
      this.trailVelocity[pIdx + 2] += this.trailAcceleration[i] * dt;
      this.trail.offsets[pIdx] += this.trailVelocity[pIdx] * velScale * dt;
      this.trail.offsets[pIdx + 1] += this.trailVelocity[pIdx + 1] * velScale * dt;
      this.trail.offsets[pIdx + 2] += this.trailVelocity[pIdx + 2] * velScale * dt;

      this.trail.sizes[sIdx] = this.trailBaseSize[sIdx] * evalCurveLut(CURVE_SCALE, progress);
      this.trail.sizes[sIdx + 1] = this.trailBaseSize[sIdx + 1];
      this.trail.opacity[i] = evalCurveLut(CURVE_OPACITY, progress);
      this.trail.colorScale[i] = 1;

      const dIdx = i * 4;
      this.trail.dynamic[dIdx] = evalCurveLut(CURVE_DYNAMIC_X, progress);
      this.trail.dynamic[dIdx + 1] = evalCurveLut(CURVE_DYNAMIC_Y, progress);
      this.trail.dynamic[dIdx + 2] = 1;
      this.trail.dynamic[dIdx + 3] = evalCurveLut(CURVE_DYNAMIC_Z, progress);
    }
    this.trailParticlesActive = active;
    return active;
  }
}
