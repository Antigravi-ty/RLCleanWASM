/**
 * ArenaLighting.js
 * Directional sunlight rigs, hemisphere environmental lighting,
 * and texel-snapped dynamic shadow frustum tracking for vehicles and the ball.
 */

import * as THREE from 'three';

export class ArenaLightingManager {
  constructor(scene) {
    this.scene = scene;
    this.shadowFocus = new THREE.Vector3();

    this.carSunTarget = new THREE.Group();
    this.ballSunTarget = new THREE.Group();
    this.opponentSunTarget = new THREE.Group();
    this.opponentSun = null;

    this.carSun = this.makeSubjectSun(this.carSunTarget, 260);
    this.ballSun = this.makeSubjectSun(this.ballSunTarget, 190);
    this.scene.add(this.carSunTarget, this.ballSunTarget, this.carSun, this.ballSun);

    this.hemiLight = new THREE.HemisphereLight(13164543, 2569000, 1.15);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(8956671, 0.35);
    this.keyLight.position.set(-2000, 2000, -2000);
    this.scene.add(this.keyLight);

    this._shadowDir = new THREE.Vector3(2500, 4000, 1500).normalize();
    this._shadowX = new THREE.Vector3(0, 1, 0).cross(this._shadowDir).normalize();
    this._shadowY = new THREE.Vector3().crossVectors(this._shadowDir, this._shadowX).normalize();
    this._sunOffset = new THREE.Vector3(2500, 4000, 1500);
  }

  makeSubjectSun(targetGroup, frustumSize) {
    const sun = new THREE.DirectionalLight(16777215, 1);
    sun.position.set(2500, 4000, 1500);
    sun.castShadow = true;
    sun.target = targetGroup;
    sun.shadow.camera.left = -frustumSize;
    sun.shadow.camera.right = frustumSize;
    sun.shadow.camera.top = frustumSize;
    sun.shadow.camera.bottom = -frustumSize;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 8500;
    return sun;
  }

  ensureOpponentSun() {
    if (!this.opponentSun) {
      this.opponentSun = this.makeSubjectSun(this.opponentSunTarget, 260);
      this.opponentSun.visible = false;
      this.scene.add(this.opponentSun, this.opponentSunTarget);
    }
    return this.opponentSun;
  }

  updateSubjectShadow(sun, targetGroup, worldPos, frustumSize = 260) {
    const texelSize = (frustumSize * 2) / 1024;
    const snappedX = Math.round(worldPos.dot(this._shadowX) / texelSize) * texelSize;
    const snappedY = Math.round(worldPos.dot(this._shadowY) / texelSize) * texelSize;
    const depthZ = worldPos.dot(this._shadowDir);

    this.shadowFocus
      .copy(this._shadowX)
      .multiplyScalar(snappedX)
      .addScaledVector(this._shadowY, snappedY)
      .addScaledVector(this._shadowDir, depthZ);

    targetGroup.position.copy(this.shadowFocus);
    sun.position.copy(this.shadowFocus).add(this._sunOffset);
    targetGroup.updateMatrixWorld?.();
  }

  updateShadows(cars, ball) {
    if (cars[0]) {
      this.updateSubjectShadow(this.carSun, this.carSunTarget, cars[0].position, 260);
    }
    if (this.opponentSun && this.opponentSun.visible && cars[1]?.visible) {
      this.updateSubjectShadow(this.opponentSun, this.opponentSunTarget, cars[1].position, 260);
    }
    if (ball) {
      this.updateSubjectShadow(this.ballSun, this.ballSunTarget, ball.position, 190);
    }
  }

  updateSunIntensities(numCars) {
    if (this.opponentSun) {
      this.opponentSun.visible = numCars > 1;
      this.carSun.intensity = this.ballSun.intensity = this.opponentSun.visible ? 2 / 3 : 1;
      this.opponentSun.intensity = 2 / 3;
    }
  }

  dispose() {
    this.carSun?.dispose?.();
    this.ballSun?.dispose?.();
    this.opponentSun?.dispose?.();
    this.keyLight?.dispose?.();
    this.hemiLight?.dispose?.();
  }
}
