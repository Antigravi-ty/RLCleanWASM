import {
  ARCADE_DRIVE_COUNT,
  ARCADE_DRIVE_LIFE,
  ARCADE_DRIVE_SPAWN_RATE,
  ARCADE_TRAIL_COUNT,
  ARCADE_TRAIL_LIFE,
  ARCADE_TRAIL_DISTANCE,
  ARCADE_MAX_PARTICLES_PER_FRAME
} from './boostCurves.js';
import * as THREE from 'three';

/**
 * Arcade Boost particle state machine, distance-based spawning, and physics updates.
 */
export class ArcadeParticlePhysics {
  constructor(driveMesh, trailMesh, nozzleLocal) {
    const { Vector3 } = THREE;
    this.drive = driveMesh;
    this.trail = trailMesh;
    this.nozzleLocal = nozzleLocal;

    this.driveAge = new Float32Array(ARCADE_DRIVE_COUNT).fill(Infinity);
    this.driveBaseSize = new Float32Array(ARCADE_DRIVE_COUNT * 2);
    this.driveVelocity = new Float32Array(ARCADE_DRIVE_COUNT * 3);
    this.driveHead = 0;
    this.driveSpawnAccumulator = 0;
    this.driveParticlesActive = false;

    this.trailAge = new Float32Array(ARCADE_TRAIL_COUNT).fill(Infinity);
    this.trailBaseSize = new Float32Array(ARCADE_TRAIL_COUNT * 2);
    this.trailAcceleration = new Float32Array(ARCADE_TRAIL_COUNT);
    this.trailVelocity = new Float32Array(ARCADE_TRAIL_COUNT * 3);
    this.trailHead = 0;
    this.trailParticlesActive = false;

    this.previousNozzle = new Vector3();
    this.hasPreviousNozzle = false;
    this.spawnRemainder = 0;

    this._scratchPrevNozzle = new Vector3();
    this._scratchDelta = new Vector3();
    this._scratchParticlePos = new Vector3();
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
    this.driveSpawnAccumulator += dt * ARCADE_DRIVE_SPAWN_RATE;
    if (!Number.isFinite(this.driveAge[(this.driveHead + ARCADE_DRIVE_COUNT - 1) % ARCADE_DRIVE_COUNT])) {
      this.driveSpawnAccumulator = Math.max(this.driveSpawnAccumulator, 1);
    }
    let spawned = 0;
    while (this.driveSpawnAccumulator >= 1 && spawned < ARCADE_MAX_PARTICLES_PER_FRAME) {
      this.driveSpawnAccumulator -= 1;
      const head = this.driveHead;
      this.driveHead = (head + 1) % ARCADE_DRIVE_COUNT;
      const pIdx = head * 3;
      const sIdx = head * 2;

      this.drive.offsets[pIdx] = this.nozzleLocal.x;
      this.drive.offsets[pIdx + 1] = this.nozzleLocal.y;
      this.drive.offsets[pIdx + 2] = this.nozzleLocal.z;

      this.driveVelocity[pIdx] = -(50 + Math.random() * 50);
      this.driveVelocity[pIdx + 1] = -5 + Math.random() * 10;
      this.driveVelocity[pIdx + 2] = -5 + Math.random() * 10;

      this.driveBaseSize[sIdx] = 6 + Math.random() * 3;
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

    this._scratchPrevNozzle.copy(this.previousNozzle);
    this._scratchDelta.subVectors(pos, this._scratchPrevNozzle);
    const dist = this._scratchDelta.length();
    if (dist < 1e-4) return;
    this._scratchDelta.divideScalar(dist);

    if (dist > 600) {
      this.previousNozzle.copy(pos);
      this.spawnRemainder = 0;
      return;
    }

    const rem = this.spawnRemainder;
    const invInterval = 1 / ARCADE_TRAIL_DISTANCE;
    const progress = rem + dist * invInterval;
    const count = Math.floor(progress);
    const capped = Math.min(count, ARCADE_MAX_PARTICLES_PER_FRAME);

    this.spawnRemainder = progress - count;

    for (let i = 0; i < capped; i++) {
      const t = (i + 1 - rem) / invInterval;
      this._scratchParticlePos.copy(this._scratchPrevNozzle).addScaledVector(this._scratchDelta, MathUtils.clamp(t, 0, dist));
      this.spawnTrailParticle(this._scratchParticlePos);
    }
    this.previousNozzle.copy(pos);
  }

  spawnTrailParticle(pos) {
    const head = this.trailHead;
    this.trailHead = (head + 1) % ARCADE_TRAIL_COUNT;
    const pIdx = head * 3;
    const sIdx = head * 2;

    this.trail.offsets[pIdx] = pos.x;
    this.trail.offsets[pIdx + 1] = pos.y;
    this.trail.offsets[pIdx + 2] = pos.z;

    this.trailVelocity[pIdx] = 0;
    this.trailVelocity[pIdx + 1] = 0;
    this.trailVelocity[pIdx + 2] = 0;

    this.trailAcceleration[head] = 15 + Math.random() * 15;
    this.trailBaseSize[sIdx] = 16 + Math.random() * 6;
    this.trailBaseSize[sIdx + 1] = this.trailBaseSize[sIdx];

    this.trail.rotations[head] = Math.random() * Math.PI * 2;
    this.trailAge[head] = 0;
    this.trailParticlesActive = true;
  }

  updateDrive(dt) {
    let active = false;
    for (let i = 0; i < ARCADE_DRIVE_COUNT; i++) {
      this.driveAge[i] += dt;
      const progress = this.driveAge[i] / ARCADE_DRIVE_LIFE;
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

      const scale = (1 + progress * 1.5) * (1 - progress * progress);
      this.drive.sizes[sIdx] = this.driveBaseSize[sIdx] * scale;
      this.drive.sizes[sIdx + 1] = this.driveBaseSize[sIdx + 1] * scale;
      this.drive.opacity[i] = 0.5 * (1 - progress);
      this.drive.life[i] = progress;
    }
    this.driveParticlesActive = active;
    return active;
  }

  updateTrail(dt) {
    const { MathUtils } = THREE;
    let active = false;
    for (let i = 0; i < ARCADE_TRAIL_COUNT; i++) {
      this.trailAge[i] += dt;
      const progress = this.trailAge[i] / ARCADE_TRAIL_LIFE;
      const pIdx = i * 3;
      const sIdx = i * 2;

      if (progress >= 1) {
        this.trail.opacity[i] = 0;
        this.trail.sizes[sIdx] = this.trail.sizes[sIdx + 1] = 0;
        continue;
      }

      active = true;
      this.trailVelocity[pIdx + 1] += this.trailAcceleration[i] * dt;
      this.trail.offsets[pIdx + 1] += this.trailVelocity[pIdx + 1] * dt;

      const scale = (0.65 + 0.6 * Math.sin(progress * Math.PI)) * (1 - progress * progress);
      this.trail.sizes[sIdx] = this.trailBaseSize[sIdx] * scale;
      this.trail.sizes[sIdx + 1] = this.trailBaseSize[sIdx + 1] * scale;
      this.trail.opacity[i] = 0.9 * (1 - MathUtils.smoothstep(progress, 0.65, 1));
      this.trail.life[i] = progress;
    }
    this.trailParticlesActive = active;
    return active;
  }
}
