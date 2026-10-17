import { getTheme } from '../../../config/themeConfig.js';
import { getMaterialsConfig } from '../../../config/materialsConfig.js';
import {
  ARCADE_DRIVE_COUNT,
  ARCADE_TRAIL_COUNT,
  ARCADE_BOOST_COLOR_HEX
} from './boostCurves.js';
import * as THREE from 'three';
import { ArcadeBoostParticleMesh } from './arcadeParticleMesh.js';
import {
  createArcadeBoostFlameConeGeometry,
  createArcadeBoostFlameConeMaterial,
  createNozzleFlash
} from './arcadeConeVisual.js';
import { RealisticBoostEmitter } from './realisticBoostEmitter.js';
import { ArcadeParticlePhysics } from './arcadeParticlePhysics.js';

export class VehicleBoostEmitter {
  setSpatial(isSpatial) {}

  constructor(scene, carRoot, nozzleLocal, isPrimary = true, isBot = false) {
    const { Group, Mesh, PointLight, Color, Vector3 } = THREE;

    this.car = carRoot;
    this.nozzleLocal = nozzleLocal.clone ? nozzleLocal.clone() : new Vector3(nozzleLocal.x, nozzleLocal.y, nozzleLocal.z);
    this.cone = new Group();
    this.coneMaterials = [];
    this.drive = null;
    this.trail = null;
    this.nozzleFlash = null;
    this.light = null;

    this.theme = getTheme();
    this.elapsed = 0;
    this.coneOpacity = 0;

    // Build arcade drive puffs
    this.drive = new ArcadeBoostParticleMesh(ARCADE_DRIVE_COUNT, true, 5);
    this.drive.mesh.layers?.enable?.(1);
    this.drive.mesh.visible = false;
    carRoot.add(this.drive.mesh);

    // Build arcade boost trail puffs
    this.trail = new ArcadeBoostParticleMesh(ARCADE_TRAIL_COUNT, false, 4);
    this.trail.mesh.layers?.enable?.(1);
    this.trail.mesh.visible = false;
    scene.add(this.trail.mesh);

    this.physics = new ArcadeParticlePhysics(this.drive, this.trail, this.nozzleLocal);

    // Build arcade flame cone
    this.cone.position.copy(this.nozzleLocal);
    this.cone.layers?.enable?.(1);
    this.cone.visible = false;
    this.cone.name = "boost-flame";
    carRoot.add(this.cone);

    const flameMat = createArcadeBoostFlameConeMaterial();
    const flameMesh = new Mesh(createArcadeBoostFlameConeGeometry(11), flameMat);
    flameMesh.layers?.enable?.(1);
    flameMesh.frustumCulled = false;
    this.coneMaterials.push(flameMat);
    this.cone.add(flameMesh);

    // Build nozzle flash
    const flashPos = this.nozzleLocal.clone ? this.nozzleLocal.clone() : new Vector3(this.nozzleLocal.x, this.nozzleLocal.y, this.nozzleLocal.z);
    flashPos.x -= 2;
    this.nozzleFlash = createNozzleFlash(flashPos);
    this.nozzleFlash.layers?.enable?.(1);
    this.nozzleFlash.visible = false;
    carRoot.add(this.nozzleFlash);

    // Point Light
    const flameColor = new Color(ARCADE_BOOST_COLOR_HEX);
    this.light = new PointLight(flameColor, 0, 300, 2);
    const lightPos = this.nozzleLocal.clone ? this.nozzleLocal.clone() : new Vector3(this.nozzleLocal.x, this.nozzleLocal.y, this.nozzleLocal.z);
    lightPos.x -= 10;
    this.light.position.copy(lightPos);
    carRoot.add(this.light);

    // Realistic branch
    this.realistic = new RealisticBoostEmitter(scene, carRoot, this.nozzleLocal, this.light);

    this._scratchWorldNozzle = new Vector3();
  }

  get bloomActive() {
    if (this.theme === "realistic") {
      return this.realistic.bloomActive;
    }
    return this.coneOpacity > 0.002 || this.physics.driveParticlesActive || this.physics.trailParticlesActive;
  }

  async preload() {
    await Promise.all([
      this.realistic?.preload?.()
    ]);
  }

  disposeAudio() {}

  update(boosting, driving, visible, dt, isFocused = true) {
    const { MathUtils } = THREE;
    const isBoosting = boosting && visible;
    const isDriving = driving && !boosting && visible;
    this.elapsed += dt;

    let currentTheme = getTheme();
    try {
      const mats = getMaterialsConfig();
      if (mats?.boostVisual) {
        currentTheme = mats.boostVisual;
      }
    } catch (err) {
      console.warn('[VehicleBoostEmitter] Error accessing materials configuration for boostVisual:', err);
    }

    if (this.theme !== currentTheme) {
      this.resetVisual();
      this.realistic.reset();
      this.theme = currentTheme;
    }

    if (currentTheme === "realistic") {
      this.realistic.update(boosting, driving, visible, dt);
      return;
    }

    if (this.light) {
      this.light.color.setHex?.(ARCADE_BOOST_COLOR_HEX);
    }

    const dampSpeed = isBoosting ? 28 : 16;
    this.coneOpacity = MathUtils.damp(this.coneOpacity, isBoosting ? 1 : 0, dampSpeed, dt);
    this.cone.visible = this.coneOpacity > 0.002;

    for (const mat of this.coneMaterials) {
      if (mat.uniforms) {
        mat.uniforms.time.value = this.elapsed;
        mat.uniforms.opacity.value = this.coneOpacity;
      }
    }

    if (this.nozzleFlash) {
      this.nozzleFlash.visible = this.cone.visible;
      if (this.nozzleFlash.material?.uniforms?.intensity) {
        this.nozzleFlash.material.uniforms.intensity.value = this.coneOpacity;
      }
    }

    if (this.light) {
      this.light.intensity = this.coneOpacity * (380 + 25 * Math.sin(this.elapsed * 24));
    }

    if (isDriving) {
      this.physics.spawnDrive(dt);
    } else {
      this.physics.driveSpawnAccumulator = 0;
    }

    if (isBoosting) {
      this.car.updateMatrixWorld?.();
      this._scratchWorldNozzle.copy(this.nozzleLocal);
      this.car.localToWorld?.(this._scratchWorldNozzle);
      this.physics.spawnTrailByDistance(this._scratchWorldNozzle, dt);
    } else {
      this.physics.hasPreviousNozzle = false;
      this.physics.spawnRemainder = 0;
    }

    if (this.physics.driveParticlesActive) {
      const active = this.physics.updateDrive(dt);
      this.drive.mesh.visible = active;
      this.drive.markDirty();
    }

    if (this.physics.trailParticlesActive) {
      const active = this.physics.updateTrail(dt);
      this.trail.mesh.visible = active;
      this.trail.markDirty();
    }
  }

  resetVisual() {
    this.physics.reset();
    this.coneOpacity = 0;
    this.cone.visible = false;
    if (this.nozzleFlash) this.nozzleFlash.visible = false;
  }
}
