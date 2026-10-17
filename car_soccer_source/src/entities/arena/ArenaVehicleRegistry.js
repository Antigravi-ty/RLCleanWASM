/**
 * ArenaVehicleRegistry.js
 * Vehicle entity lifecycle management: state storage, in-place visual swapping,
 * paint customization, and opponent instantiation.
 */

import * as THREE from 'three';
import { VehicleBoostEmitter } from '../VehicleBoostEmitter.js';
import { DemolitionEffect } from '../DemolitionEffect.js';
import { getWheelSpecsForVisual, setupCarReactionJets } from '../VehicleSuspensionSystem.js';
import { DEFAULT_TEAM_COLORS, OCTANE_BOOST_OUTLETS, BOT_CAR_INDEX } from './ArenaConstants.js';
import { buildVehicleModel, buildVehicleWheels, removeCarMeshes } from './VehicleFactory.js';
import { applyVehiclePaint } from './VehiclePaint.js';
import { createDefaultVehicleLoaders } from './VehicleLoaders.js';

export class ArenaVehicleRegistry {
  constructor(arenaScene, onRenderTreeChanged) {
    this.scene = arenaScene;
    this.onRenderTreeChanged = onRenderTreeChanged;

    this.cars = [];
    this.vehiclePresets = [];
    this.carHitboxes = [];
    this.carHitboxesVisible = true;
    this.carGimbals = [];
    this.carSuspension = [];
    this.carWheels = [];
    this.carWheelSpecs = [];
    this.wheelSpin = [];
    this.carBoosts = [];
    this.carDemolitions = [];
    this.carJets = [];
    this.carColors = [];

    // Jump & Dodge animation trackers
    this.jumpPrev = [];
    this.jumpTimer = [];
    this.flipPrev = [];
    this.dodgeBurst = [];
    this.dodgeRoll = [];
    this.dodgeYaw = [];
    this.dodgePitch = [];

    // Preloaded model assets
    this.gameCarAsset = null;
    this.flatCarAsset = null;
    this.realisticCarAsset = null;

    this.carLoaders = createDefaultVehicleLoaders();
  }

  get assets() {
    return {
      game: this.gameCarAsset,
      flat: this.flatCarAsset,
      realistic: this.realisticCarAsset
    };
  }

  addCar(teamIndex = 0, visualOrOptions = "game-car", targetIndex = null) {
    let visual = "game-car";
    let resolvedTargetIndex = targetIndex;
    if (visualOrOptions && typeof visualOrOptions === "object") {
      visual = visualOrOptions.visual || visualOrOptions.preset || "game-car";
      if (typeof visualOrOptions.targetIndex === "number") {
        resolvedTargetIndex = visualOrOptions.targetIndex;
      }
    } else if (typeof visualOrOptions === "string" && visualOrOptions.length > 0) {
      visual = visualOrOptions;
    }

    const carRoot = new THREE.Group();
    const slot = (typeof resolvedTargetIndex === 'number' && resolvedTargetIndex >= 0)
      ? resolvedTargetIndex
      : this.cars.length;

    while (this.cars.length < slot) {
      const idx = this.cars.length;
      this.cars[idx] = null;
      this.vehiclePresets[idx] = null;
      this.carHitboxes[idx] = null;
      this.carGimbals[idx] = null;
      this.carWheels[idx] = null;
      this.carWheelSpecs[idx] = null;
      this.wheelSpin[idx] = [0, 0, 0, 0];
      this.carSuspension[idx] = [];
      this.carJets[idx] = null;
      this.jumpPrev[idx] = false;
      this.jumpTimer[idx] = -1;
      this.flipPrev[idx] = false;
      this.dodgeBurst[idx] = 0;
      this.dodgeRoll[idx] = 0;
      this.dodgeYaw[idx] = 0;
      this.dodgePitch[idx] = 0;
      this.carBoosts[idx] = null;
      this.carDemolitions[idx] = null;
    }

    if (this.cars[slot]) {
      this.removeCar(slot);
    }

    const isBot = slot === BOT_CAR_INDEX;
    const resolvedTeam = typeof teamIndex === 'number' ? teamIndex : (slot % 2);
    const teamColor = this.carLoaders.teamColors?.[resolvedTeam] ?? DEFAULT_TEAM_COLORS[resolvedTeam % 2];

    const { carModel, carHitbox, carGimbal, boostOutlets } = buildVehicleModel(
      visual, teamColor, isBot, this.assets, this.carLoaders, this.carHitboxesVisible
    );
    carRoot.add(carModel, carHitbox);

    let wheelSpecs = getWheelSpecsForVisual(visual);
    if (!visual.startsWith("hitbox-") && visual !== "flat-car" && visual !== "realistic" && this.carLoaders.wheelSpecs?.game) {
      wheelSpecs = this.carLoaders.wheelSpecs.game;
    }

    const wheels = buildVehicleWheels(carRoot, visual, teamColor, wheelSpecs, this.assets, this.carLoaders);
    const defaultOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const emitters = (boostOutlets || defaultOutlets).map((pos, p) => new VehicleBoostEmitter(this.scene, carRoot, pos, p === 0, isBot));

    const demoEffect = new DemolitionEffect();
    if (demoEffect.object) this.scene.add(demoEffect.object);

    if (!this.carTeams) this.carTeams = [];
    this.carTeams[slot] = resolvedTeam;
    this.carHitboxes[slot] = carHitbox;
    this.carGimbals[slot] = carGimbal;
    this.carWheels[slot] = wheels;
    this.carWheelSpecs[slot] = wheelSpecs;
    this.wheelSpin[slot] = [0, 0, 0, 0];
    this.carSuspension[slot] = [];
    this.carJets[slot] = carGimbal ? setupCarReactionJets(carGimbal) : null;
    this.jumpPrev[slot] = false;
    this.jumpTimer[slot] = -1;
    this.flipPrev[slot] = false;
    this.dodgeBurst[slot] = 0;
    this.dodgeRoll[slot] = 0;
    this.dodgeYaw[slot] = 0;
    this.dodgePitch[slot] = 0;
    this.carBoosts[slot] = emitters;
    this.carDemolitions[slot] = demoEffect;
    this.cars[slot] = carRoot;
    this.vehiclePresets[slot] = visual;

    this.scene.add(carRoot);
    if (this.carColors && this.carColors[slot] !== undefined && this.carColors[slot] !== null) {
      this.setCarColor(slot, this.carColors[slot]);
    }
    this.onRenderTreeChanged?.();
    return carRoot;
  }

  ensureCar(carIndex, teamIndex = null, visualOrOptions = "game-car") {
    if (typeof carIndex !== 'number' || carIndex < 0) return null;
    const resolvedTeam = typeof teamIndex === 'number' ? teamIndex : (this.carTeams?.[carIndex] ?? (carIndex % 2));
    let visual = "game-car";
    if (visualOrOptions && typeof visualOrOptions === "object") {
      visual = visualOrOptions.visual || visualOrOptions.preset || this.vehiclePresets?.[carIndex] || "game-car";
    } else if (typeof visualOrOptions === "string" && visualOrOptions.length > 0) {
      visual = visualOrOptions;
    } else if (this.vehiclePresets?.[carIndex]) {
      visual = this.vehiclePresets[carIndex];
    }

    if (!this.cars[carIndex]) {
      this.addCar(resolvedTeam, visual, carIndex);
    } else {
      if (this.vehiclePresets[carIndex] !== visual) {
        this.swapCarVisual(carIndex, visual);
      }
      if (typeof teamIndex === 'number') {
        this.setCarTeam(carIndex, teamIndex);
      }
    }
    if (this.cars[carIndex]) {
      this.cars[carIndex].visible = true;
    }
    return this.cars[carIndex];
  }

  setCarTeam(carIndex, teamIndex) {
    if (typeof carIndex !== 'number' || carIndex < 0) return;
    if (!this.carTeams) this.carTeams = [];
    this.carTeams[carIndex] = teamIndex;
    const teamColor = this.carLoaders.teamColors?.[teamIndex] ?? DEFAULT_TEAM_COLORS[teamIndex % 2];
    if (this.cars?.[carIndex] && (this.carColors?.[carIndex] === undefined || this.carColors?.[carIndex] === null)) {
      applyVehiclePaint(this.cars[carIndex], this.vehiclePresets?.[carIndex], teamColor);
      this.onRenderTreeChanged?.();
    }
  }

  swapCarVisual(carIndex, newVisual) {
    if (!this.cars || carIndex < 0 || carIndex >= this.cars.length) return false;
    const carRoot = this.cars[carIndex];
    if (!carRoot) return false;
    const resolvedVisual = (newVisual && typeof newVisual === 'object')
      ? (newVisual.visual || newVisual.preset || 'game-car')
      : String(newVisual || 'game-car');

    const isBot = carIndex === BOT_CAR_INDEX;
    const teamIndex = this.carTeams?.[carIndex] ?? (carIndex % 2);
    const teamColor = this.carLoaders.teamColors?.[teamIndex] ?? DEFAULT_TEAM_COLORS[teamIndex % 2];

    removeCarMeshes(carRoot);

    const { carModel, carHitbox, boostOutlets } = buildVehicleModel(
      resolvedVisual, teamColor, isBot, this.assets, this.carLoaders, this.carHitboxesVisible
    );
    carRoot.add(carModel, carHitbox);
    this.carHitboxes[carIndex] = carHitbox;

    let wheelSpecs = getWheelSpecsForVisual(resolvedVisual);
    if (!resolvedVisual.startsWith("hitbox-") && resolvedVisual !== "flat-car" && resolvedVisual !== "realistic" && this.carLoaders.wheelSpecs?.game) {
      wheelSpecs = this.carLoaders.wheelSpecs.game;
    }
    this.carWheelSpecs[carIndex] = wheelSpecs;

    const wheels = this.carWheels[carIndex];
    if (wheels && wheelSpecs) {
      for (let i = 0; i < wheels.length && i < wheelSpecs.length; i++) {
        wheels[i].steer.position.set(wheelSpecs[i][0], -6.0, wheelSpecs[i][1]);
      }
    }

    const emitterList = this.carBoosts[carIndex];
    if (emitterList && boostOutlets) {
      for (let p = 0; p < emitterList.length && p < boostOutlets.length; p++) {
        if (emitterList[p]?.offset) emitterList[p].offset.copy(boostOutlets[p]);
      }
    }

    this.vehiclePresets[carIndex] = resolvedVisual;
    if (this.carColors && this.carColors[carIndex] !== undefined && this.carColors[carIndex] !== null) {
      this.setCarColor(carIndex, this.carColors[carIndex]);
    }

    this.onRenderTreeChanged?.();
    return true;
  }

  removeCar(carIndex) {
    if (!this.cars || carIndex < 0 || carIndex >= this.cars.length) return false;
    const carRoot = this.cars[carIndex];
    if (carRoot) {
      this.scene.remove(carRoot);
      carRoot.traverse(node => {
        if (node.geometry) node.geometry.dispose?.();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => m?.dispose?.());
        }
      });
    }

    if (this.carDemolitions?.[carIndex]) {
      const demo = this.carDemolitions[carIndex];
      if (demo.object) this.scene.remove(demo.object);
      demo.dispose?.();
    }
    if (this.carBoosts?.[carIndex]) {
      this.carBoosts[carIndex].forEach(emitter => emitter.dispose?.());
    }

    this.cars[carIndex] = null;
    this.vehiclePresets[carIndex] = null;
    this.carHitboxes[carIndex] = null;
    this.carGimbals[carIndex] = null;
    this.carSuspension[carIndex] = null;
    this.carWheels[carIndex] = null;
    this.carWheelSpecs[carIndex] = null;
    this.carBoosts[carIndex] = null;
    this.carDemolitions[carIndex] = null;
    this.carJets[carIndex] = null;

    this.onRenderTreeChanged?.();
    return true;
  }

  setCarColor(carIndex, colorVal) {
    if (!this.carColors) this.carColors = [];
    const num = typeof colorVal === "string" ? parseInt(colorVal.replace("#", ""), 16) : colorVal;
    this.carColors[carIndex] = num;
    const carRoot = this.cars[carIndex];
    if (!carRoot) return;

    applyVehiclePaint(carRoot, this.vehiclePresets?.[carIndex], num);
    this.onRenderTreeChanged?.();
  }

  setCarHitboxesVisible(visible) {
    this.carHitboxesVisible = visible;
    for (const hitboxMesh of this.carHitboxes) {
      if (hitboxMesh) hitboxMesh.visible = visible;
    }
  }

  setCarGhostOpacity(carIndex, isGhost = true, opacity = 0.70) {
    const carRoot = this.cars?.[carIndex];
    if (!carRoot) return false;
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    carRoot.traverse?.((node) => {
      if (!node?.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of mats) {
        if (!mat) continue;
        if (mat.userData === undefined) mat.userData = {};
        if (mat.userData._origTransparent === undefined) {
          mat.userData._origTransparent = Boolean(mat.transparent);
          mat.userData._origOpacity = typeof mat.opacity === 'number' ? mat.opacity : 1.0;
        }
        if (isGhost && clampedOpacity < 1.0) {
          mat.transparent = true;
          mat.opacity = clampedOpacity;
        } else {
          mat.transparent = mat.userData._origTransparent;
          mat.opacity = mat.userData._origOpacity;
        }
        mat.needsUpdate = true;
      }
    });
    this.onRenderTreeChanged?.();
    return true;
  }

  clearAllGhostOpacities() {
    for (let i = 0; i < this.cars.length; i++) {
      if (this.cars[i]) this.setCarGhostOpacity(i, false, 1.0);
    }
  }

  async ensureOpponent(ensureOpponentSunFn) {
    if (!this.cars[1]) {
      if (!this.gameCarAsset && this.carLoaders.loadGameCarAsset) {
        try {
          this.gameCarAsset = await this.carLoaders.loadGameCarAsset();
        } catch (err) {
          console.warn("Opponent game car asset load skipped:", err);
        }
      }
      ensureOpponentSunFn?.();
      this.addCar(1, "game-car", 1);
    }
  }

  dispose() {
    for (const carList of this.carBoosts) {
      if (Array.isArray(carList)) {
        for (const emitter of carList) emitter?.dispose?.();
      }
    }
    for (const car of this.cars) {
      if (car) {
        car.traverse?.(obj => {
          if (obj.geometry?.dispose) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => m?.dispose?.());
          }
        });
      }
    }
  }
}
