/**
 * VehiclePaint.js
 * Vehicle paint color updates for whitebox test chassis and authentic car bodies.
 */

import { createCarPaintMaterial, applyVehicleMaterials } from '../VehicleAssembly.js';

export function applyVehiclePaint(carRoot, preset, colorVal) {
  if (!carRoot) return;

  const num = typeof colorVal === "string" ? parseInt(colorVal.replace("#", ""), 16) : colorVal;

  let isWhitebox =
    preset?.startsWith("hitbox-") ||
    carRoot.name?.startsWith("whitebox-") ||
    carRoot.children?.some(c => c.name?.startsWith("whitebox-"));

  if (!isWhitebox) {
    carRoot.traverse(node => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        if (mats.some(m => m?.name === "whitebox-rear")) isWhitebox = true;
      }
    });
  }

  if (isWhitebox) {
    carRoot.traverse(node => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m => {
          if (m && m.name === "paint") m.color?.set?.(num);
        });
      }
    });
    return;
  }

  const palette = createCarPaintMaterial(num, undefined);
  applyVehicleMaterials(carRoot, palette);
}
