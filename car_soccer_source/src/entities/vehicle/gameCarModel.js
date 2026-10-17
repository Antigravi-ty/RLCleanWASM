import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  OCTANE_SCALE,
  OCTANE_SCALE_X,
  OCTANE_OFFSET_X,
  OCTANE_OFFSET_Y,
  OCTANE_WHEEL_NAMES,
  OCTANE_ASSET_WHEEL_NAMES
} from './vehicleDescriptors.js';
import { findMeshObjectByName, detachOctaneWheelHardware } from './vehicleMeshUtils.js';
import { createCarPaintMaterial, applyVehicleMaterials } from './vehiclePaintMaterial.js';

let cachedGameCarAsset = null;

/**
 * Loads Octane model from /assets/game-car/model.gltf
 */
export async function loadGameCarAsset() {
  if (cachedGameCarAsset) return cachedGameCarAsset;
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/assets/game-car/model.gltf");
  gltf.scene.updateMatrixWorld?.(true);

  const body = findMeshObjectByName(gltf.scene, "game-car-body");
  const wheels = OCTANE_ASSET_WHEEL_NAMES.map(name => findMeshObjectByName(gltf.scene, name));
  const wheelHardware = detachOctaneWheelHardware(body, wheels);

  cachedGameCarAsset = {
    body,
    wheels,
    wheelHardware
  };
  return cachedGameCarAsset;
}

/**
 * Creates Octane (game-car) root hierarchy.
 */
export function createGameCarModel(asset, teamColor, colorOptions) {
  const { Group } = THREE;
  const root = new Group();
  root.name = "game-car";
  root.scale.setScalar?.(OCTANE_SCALE);

  const shell = new Group();
  shell.name = "game-car-shell";
  if (shell.scale) shell.scale.x = OCTANE_SCALE_X;
  if (shell.position) shell.position.set(OCTANE_OFFSET_X / OCTANE_SCALE, OCTANE_OFFSET_Y / OCTANE_SCALE, 0);

  const bodyClone = asset.body.clone ? asset.body.clone(true) : asset.body;
  const palette = createCarPaintMaterial(teamColor, colorOptions);
  applyVehicleMaterials(bodyClone, palette);

  shell.add(bodyClone);
  root.add(shell);
  return root;
}

/**
 * Creates Octane wheel group.
 */
export function createGameCarWheel(asset, wheelIndex, teamColor) {
  const colorVal = (typeof teamColor === "number") ? teamColor : undefined;
  const { Group } = THREE;
  const wheelGroup = new Group();
  wheelGroup.name = OCTANE_WHEEL_NAMES[wheelIndex];
  wheelGroup.scale.setScalar?.(OCTANE_SCALE);

  const wheelClone = asset.wheels[wheelIndex].clone ? asset.wheels[wheelIndex].clone(true) : asset.wheels[wheelIndex];
  wheelClone.position?.set(0, 0, 0);

  applyVehicleMaterials(wheelClone, createCarPaintMaterial(colorVal));
  wheelGroup.add(wheelClone);
  return wheelGroup;
}

/**
 * Creates Octane wheel suspension hardware.
 */
export function createGameCarWheelHardware(asset, wheelIndex, teamColor) {
  const colorVal = (typeof teamColor === "number") ? teamColor : undefined;
  const hw = asset.wheelHardware[wheelIndex];
  const hwClone = hw.clone ? hw.clone(true) : hw;

  applyVehicleMaterials(hwClone, createCarPaintMaterial(colorVal));
  return hwClone;
}
