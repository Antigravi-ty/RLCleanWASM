/**
 * DriftwoodsStadiumLoader.js
 * Loads the Driftwoods stadium 3D GLB scene and aligns ground UV coordinates.
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Loads the Driftwoods stadium GLB model.
 */
export async function loadDriftwoodsStadium() {
  const loader = new GLTFLoader();
  let gltf = null;
  const candidatePaths = [
    '/custom/assets/arena/driftwoods.glb',
    '/assets/arena/stadium/driftwoods.glb'
  ];

  for (const path of candidatePaths) {
    try {
      gltf = await loader.loadAsync(path);
      if (gltf?.scene) break;
    } catch (err) {
      console.warn(`[DriftwoodsStadiumLoader] Failed to load Driftwoods arena GLTF from "${path}":`, err);
    }
  }

  if (!gltf?.scene) {
    console.error('[DriftwoodsStadiumLoader] All Driftwoods arena candidate paths failed to load:', candidatePaths);
    return null;
  }

  const stadium = gltf.scene;
  stadium.name = 'Stadium / Driftwoods Arena';
  stadium.scale.setScalar(100);

  stadium.traverse((obj) => {
    if (obj.name === 'BoostPads_Combined_Base') {
      obj.visible = false;
    }
    if (obj.isMesh) {
      if (obj.name === 'BoostPads_Combined_Base') {
        obj.visible = false;
      }
      obj.castShadow = false;
      obj.receiveShadow = true;
      if (obj.name === 'Woods_Field_Ground') {
        alignWoodsFieldGroundTexture(obj);
      }
    }
  });

  return stadium;
}

/**
 * Automatically inspects and aligns Woods_Field_Ground texture mapping.
 */
export function alignWoodsFieldGroundTexture(mesh) {
  if (!mesh?.geometry?.attributes?.position || !mesh?.geometry?.attributes?.uv) return;
  const pos = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;

  const lineUMin = 0.192871;
  const lineUMax = 0.806640;
  const lineVMin = 0.082113;
  const lineVMax = 0.915665;

  let minX = Infinity, maxX = -Infinity;
  let minU = Infinity, maxU = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let minV = Infinity, maxV = -Infinity;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = uv.getX(i);
    const v = uv.getY(i);

    if (y < 0.05) {
      if (x < minX) { minX = x; minU = u; }
      if (x > maxX) { maxX = x; maxU = u; }
      if (Math.abs(x) < 8.95) {
        if (z < minZ) { minZ = z; minV = v; }
        if (z > maxZ) { maxZ = z; maxV = v; }
      }
    }
  }

  if (Math.abs(minU - lineUMin) < 0.005 && Math.abs(maxU - lineUMax) < 0.005) {
    return;
  }

  const repeatX = (lineUMax - lineUMin) / (maxU - minU);
  const offsetX = lineUMin - minU * repeatX;
  const repeatY = (lineVMax - lineVMin) / (maxV - minV);
  const offsetY = lineVMin - minV * repeatY;

  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatX + offsetX, uv.getY(i) * repeatY + offsetY);
  }
  uv.needsUpdate = true;
}
