/**
 * VehicleFactory.js
 * Instantiates vehicle body meshes, whitebox fallback models,
 * hitbox debug wireframes, and wheel attachment hierarchies.
 */

import * as THREE from 'three';
import { HITBOX_PRESETS, createWhiteboxCarModel } from '../../config/vehiclePresets.js';
import { createOffroadWheelMesh } from '../VehicleSuspensionSystem.js';
import {
  DEFAULT_TEAM_COLORS,
  OCTANE_BOOST_OUTLETS,
  FLAT_CAR_BOOST_OUTLETS,
  OCTANE_HITBOX_PRESET
} from './ArenaConstants.js';
import { createCarHitboxWireframe } from './ArenaMath.js';

/**
 * Builds vehicle 3D mesh model, hitbox wireframe, and boost outlet vectors.
 */
export function buildVehicleModel(visual, teamColor, isBot, assets, loaders, carHitboxesVisible) {
  const isHitbox = visual.startsWith("hitbox-");
  const isRealistic = visual === "realistic";
  const isFlat = visual === "flat-car";

  let carModel = null;
  let carHitbox = null;
  let carGimbal = null;
  let boostOutlets = null;

  if (isHitbox) {
    const preset = HITBOX_PRESETS[visual] || HITBOX_PRESETS["hitbox-octane"];
    try {
      carModel = createWhiteboxCarModel(visual, teamColor);
    } catch (err) {
      console.error('[VehicleFactory] Failed to instantiate car model:', err, { visual, teamColor });
      carModel = new THREE.Group();
    }
    carModel.name = "car-body-mesh";
    carHitbox = createCarHitboxWireframe(preset);
    carHitbox.name = "car-hitbox-wireframe";
    carHitbox.visible = carHitboxesVisible;
    boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    return { carModel, carHitbox, carGimbal, boostOutlets };
  }

  if (isRealistic && loaders.createRealisticCarModel) {
    const realisticGroup = new THREE.Group();
    realisticGroup.name = "realistic-car";
    const model = loaders.createRealisticCarModel(teamColor);
    realisticGroup.add(model.group);
    const gimbals = loaders.createRealisticCarGimbals ? loaders.createRealisticCarGimbals() : null;
    if (assets.realistic && loaders.assembleRealisticCar) {
      loaders.assembleRealisticCar(assets.realistic, model, gimbals, teamColor);
    }
    carModel = realisticGroup;
    if (gimbals?.hitbox) {
      gimbals.hitbox.visible = carHitboxesVisible;
      carHitbox = gimbals.hitbox;
      carGimbal = gimbals;
    } else {
      carHitbox = createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
      carHitbox.visible = carHitboxesVisible;
    }
    boostOutlets = [model.boostOutlet || new THREE.Vector3(-57, 10.25, 0)];
    return { carModel, carHitbox, carGimbal, boostOutlets };
  }

  if (isFlat && loaders.createFlatCarModel && assets.flat) {
    carModel = loaders.createFlatCarModel(assets.flat, teamColor);
    const hitboxPreset = HITBOX_PRESETS["hitbox-dominus"] || OCTANE_HITBOX_PRESET;
    carHitbox = createCarHitboxWireframe(hitboxPreset);
    boostOutlets = FLAT_CAR_BOOST_OUTLETS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  } else if (loaders.createGameCarModel && assets.game) {
    const theme = loaders.getCarVisualTheme ? loaders.getCarVisualTheme(visual) : undefined;
    carModel = loaders.createGameCarModel(assets.game, teamColor, isBot ? theme : undefined);
    carHitbox = createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
    boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  } else {
    try {
      carModel = createWhiteboxCarModel("hitbox-octane", teamColor);
    } catch (err) {
      console.error('[VehicleFactory] Failed to instantiate fallback model:', err, { teamColor });
      carModel = new THREE.Group();
    }
    carHitbox = createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
    boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  }

  carModel.name = "car-body-mesh";
  carHitbox.name = "car-hitbox-wireframe";
  carHitbox.visible = carHitboxesVisible;
  return { carModel, carHitbox, carGimbal, boostOutlets };
}

/**
 * Builds wheels (steer and spin groups) for the car hierarchy.
 */
export function buildVehicleWheels(carRoot, visual, teamColor, wheelSpecs, assets, loaders) {
  const isHitbox = visual.startsWith("hitbox-");
  const isRealistic = visual === "realistic";
  const isFlat = visual === "flat-car";
  const wheels = [];

  if (isHitbox || !assets.game) {
    const wheelGeom = new THREE.CylinderGeometry(13.5, 13.5, 9, 16);
    wheelGeom.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 2171169, roughness: 0.9, metalness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const [specX, specZ] = wheelSpecs[i] || [0, 0];
      const steerGroup = new THREE.Group();
      steerGroup.position.set(specX, -6.0, specZ);
      const spinGroup = new THREE.Group();
      const wm = new THREE.Mesh(wheelGeom, wheelMat);
      wm.castShadow = true;
      spinGroup.add(wm);
      steerGroup.add(spinGroup);
      carRoot.add(steerGroup);
      wheels.push({ steer: steerGroup, spin: spinGroup });
    }
    return wheels;
  }

  for (let i = 0; i < wheelSpecs.length; i++) {
    const [specX, specZ, specRadius] = wheelSpecs[i];
    const steerGroup = new THREE.Group();
    const restY = isFlat ? (loaders.suspensionSpecs?.flatY?.[i] ?? -6.2) : (specRadius - 17);
    steerGroup.position.set(specX, restY, specZ);
    const spinGroup = new THREE.Group();

    let wheelMesh;
    if (isRealistic) {
      wheelMesh = createOffroadWheelMesh(specRadius, 16, {
        tire: new THREE.MeshStandardMaterial({ color: 1447965, roughness: 0.96 }),
        rim: new THREE.MeshStandardMaterial({ color: 1909033, roughness: 0.3, metalness: 0.9 })
      });
    } else if (isFlat && loaders.createFlatCarWheel && assets.flat) {
      wheelMesh = loaders.createFlatCarWheel(assets.flat, i, teamColor);
    } else if (loaders.createGameCarWheel && assets.game) {
      wheelMesh = loaders.createGameCarWheel(assets.game, i, teamColor);
      if (loaders.createGameCarWheelHardware) {
        steerGroup.add(loaders.createGameCarWheelHardware(assets.game, i, teamColor));
      }
    } else {
      wheelMesh = new THREE.Group();
    }

    spinGroup.add(wheelMesh);
    steerGroup.add(spinGroup);
    carRoot.add(steerGroup);
    wheels.push({ steer: steerGroup, spin: spinGroup });
  }

  return wheels;
}

/**
 * Removes and disposes previous vehicle body and hitbox meshes.
 */
export function removeCarMeshes(carRoot) {
  const toRemove = [];
  for (const child of carRoot.children) {
    if (
      child.name === "car-body-mesh" ||
      child.name === "car-hitbox-wireframe" ||
      child.name === "realistic-car" ||
      child.name?.startsWith("whitebox-")
    ) {
      toRemove.push(child);
    }
  }
  for (const child of toRemove) {
    carRoot.remove(child);
    child.traverse?.(node => {
      if (node.geometry) node.geometry.dispose?.();
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m => m?.dispose?.());
      }
    });
  }
}
