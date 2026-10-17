import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  FLAT_CAR_WHEEL_NAMES,
  FLAT_CAR_DEFAULT_COLORS,
  FLAT_CAR_BOT_COLORS
} from './vehicleDescriptors.js';
import { cloneVehicleMeshWithPaint } from './vehiclePaintMaterial.js';

let cachedFlatCarAsset = null;

/**
 * Loads Dominus (flat-car) model from /assets/flat-car/model.glb
 */
export async function loadFlatCarAsset() {
  if (cachedFlatCarAsset) return cachedFlatCarAsset;
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/assets/flat-car/model.glb");

  const getPart = (name) => {
    const obj = gltf.scene.getObjectByName?.(name);
    if (!obj) throw new Error(`Flat Car asset is missing ${name}`);
    return obj;
  };

  cachedFlatCarAsset = {
    body: getPart("flat-car-body"),
    wheels: FLAT_CAR_WHEEL_NAMES.map(getPart)
  };
  return cachedFlatCarAsset;
}

/**
 * Creates Dominus (flat-car) root hierarchy.
 */
export function createFlatCarModel(asset, teamColor) {
  const { Group } = THREE;
  const root = new Group();
  root.name = "flat-car";
  root.scale.setScalar?.(100);
  root.add(cloneVehicleMeshWithPaint(asset.body, teamColor, FLAT_CAR_DEFAULT_COLORS));
  return root;
}

/**
 * Creates Dominus wheel group.
 */
export function createFlatCarWheel(asset, wheelIndex, teamColor) {
  const colorVal = (typeof teamColor === "number") ? teamColor : undefined;
  const { Group } = THREE;
  const wheelGroup = new Group();
  wheelGroup.name = FLAT_CAR_WHEEL_NAMES[wheelIndex];
  wheelGroup.scale.setScalar?.(100);

  const wheelMesh = cloneVehicleMeshWithPaint(asset.wheels[wheelIndex], colorVal, FLAT_CAR_DEFAULT_COLORS);
  wheelMesh.position?.set(0, 0, 0);
  wheelGroup.add(wheelMesh);
  return wheelGroup;
}

/**
 * Returns color settings for car visual modes.
 */
export function getCarVisualTheme(visualId) {
  return visualId === "flat-car" ? FLAT_CAR_BOT_COLORS : FLAT_CAR_DEFAULT_COLORS;
}
