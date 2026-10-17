import { REALISTIC_DETAIL_NAMES } from './vehicleDescriptors.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let cachedRealisticCarAsset = null;

/**
 * Loads realistic car details from /assets/realistic-car/details.glb
 */
export async function loadRealisticCarAsset() {
  if (cachedRealisticCarAsset) return cachedRealisticCarAsset;
  
  if (!GLTFLoader) return null;
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/assets/realistic-car/details.glb");

  const details = {};
  for (const name of REALISTIC_DETAIL_NAMES) {
    const obj = gltf.scene.getObjectByName?.(name);
    if (!obj) throw new Error(`Realistic car asset is missing ${name}`);
    details[name] = obj;
  }
  cachedRealisticCarAsset = details;
  return cachedRealisticCarAsset;
}

/**
 * Attaches external GLB realistic car details onto procedural frame and gimbal models.
 */
export function assembleRealisticCar(asset, frameModel, gimbalModel, teamColor) {
  const { Mesh } = THREE;
  const targets = {
    "frame-details": frameModel.group,
    "fixed-details": gimbalModel.visual,
    "roll-details": gimbalModel.rollRing,
    "cradle-details": gimbalModel.cradle,
    "seat-details": gimbalModel.seat
  };

  const matCache = new Map();
  const updateMat = (mat) => {
    if (mat.name !== "realistic-team") return mat;
    let cloned = matCache.get(mat);
    if (!cloned) {
      cloned = mat.clone ? mat.clone() : { ...mat };
      cloned.color?.setHex?.(teamColor);
      matCache.set(mat, cloned);
    }
    return cloned;
  };

  for (const name of REALISTIC_DETAIL_NAMES) {
    const detailClone = asset[name].clone ? asset[name].clone(true) : asset[name];
    if (name === "frame-details") {
      detailClone.position.copy(frameModel.powertrainMount);
    } else if (name === "roll-details" || name === "cradle-details" || name === "seat-details") {
      detailClone.position.set(0, 0, 0);
    }

    detailClone.traverse?.(child => {
      if (child instanceof Mesh || child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = Array.isArray(child.material)
          ? child.material.map(updateMat)
          : updateMat(child.material);
      }
    });

    targets[name]?.add(detailClone);
  }
}

/**
 * Aligns a cylinder mesh between two 3D spatial points.
 */
export function alignCylinderBetweenPoints(mesh, p1, p2) {
  const { Vector3 } = THREE;
  mesh.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
  const dir = new Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
  const len = dir.length();
  dir.divideScalar(len || 1);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
  mesh.scale.set(1, len, 1);
}

/**
 * Updates suspension coil spring and shock absorber alignment.
 */
export function updateSuspensionUnitSpring(susUnit, knuckleY) {
  const { Vector3 } = THREE;
  const dir = new Vector3(0, knuckleY - susUnit.top.y, susUnit.botZ - susUnit.top.z);
  const len = dir.length();
  dir.divideScalar(len || 1);
  susUnit.group.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), dir);
  susUnit.spring.scale.y = len / susUnit.built;
  const shaftLen = Math.max(1, len - susUnit.bodyLen * 0.5);
  susUnit.shaft.scale.y = shaftLen;
  susUnit.shaft.position.y = -shaftLen / 2;
  susUnit.body.position.y = -(len - susUnit.bodyLen / 2);
}
