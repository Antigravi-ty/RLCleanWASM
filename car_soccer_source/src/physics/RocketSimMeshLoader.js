/**
 * RocketSimMeshLoader.js
 * Arena collision mesh loader and vehicle hitbox preset helpers for RocketSim WASM.
 */

import { validateAssetResponse } from '../utils/AssetResponseValidator.js';
import { resolveHitboxIndex } from '../config/vehicleConstants.js';

export const PLAYER_CAR_INDEX = 0;
export const BOT_CAR_INDEX = 1;

export function getTeamAssignment(isFlatCar) {
  return isFlatCar
    ? { playerTeam: 0, botTeam: 1 }
    : { playerTeam: 1, botTeam: 0 };
}

/**
 * Resolves standard 6 Rocket League hitbox preset indices for WASM bridge:
 * 0: Octane, 1: Dominus, 2: Plank (Batmobile), 3: Breakout, 4: Hybrid, 5: Merc
 * @param {string|number} hitboxType
 * @returns {number}
 */
export function getHitboxIndex(hitboxType) {
  return resolveHitboxIndex(hitboxType);
}

export async function fetchArenaCollisionMeshes(cachedCollisionData = null) {
  if (cachedCollisionData) return cachedCollisionData;

  const manifestUrl = '/custom/arenamesh/manifest.json';
  const manifestRes = await fetch(manifestUrl);
  const manifestCheck = validateAssetResponse(manifestRes, manifestUrl, 'json');
  if (!manifestCheck.ok) throw manifestCheck.error;

  const chunkFilenames = await manifestRes.json();
  return Promise.all(
    chunkFilenames.map(async (chunkFile) => {
      const chunkPath = `/custom/arenamesh/${chunkFile}`;
      const chunkRes = await fetch(chunkPath);
      const chunkCheck = validateAssetResponse(chunkRes, chunkPath, 'cmf');
      if (!chunkCheck.ok) throw chunkCheck.error;
      return new Uint8Array(await chunkRes.arrayBuffer());
    })
  );
}

export function initWasmCollisionMeshes(module, collisionData) {
  const totalBytes = collisionData.reduce((acc, chunk) => acc + chunk.length, 0);
  const dataPtr = module._malloc(totalBytes);
  const sizesPtr = module._malloc(collisionData.length * 4);

  let byteOffset = 0;
  collisionData.forEach((chunk, idx) => {
    module.HEAPU8.set(chunk, dataPtr + byteOffset);
    module.HEAP32[sizesPtr / 4 + idx] = chunk.length;
    byteOffset += chunk.length;
  });

  const initResult = module._physics_init(dataPtr, sizesPtr, collisionData.length);
  module._free(dataPtr);
  module._free(sizesPtr);

  if (initResult !== 1) {
    throw new Error('Physics initialization failed — check collision meshes');
  }
}
