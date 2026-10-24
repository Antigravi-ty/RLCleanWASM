/**
 * VehiclePaint.js
 * Vehicle paint color updates for whitebox test chassis and authentic car bodies.
 */

import {
  createCarPaintMaterial,
  applyVehicleMaterials
} from '../vehicle/vehiclePaintMaterial.js';
import {
  applyCustomGlbVehicleMaterials
} from '../vehicle/customGlbCarModel.js';
import {
  hasVehicleDescriptor,
  GLOBAL_VEHICLE_SURFACE_MATERIALS
} from '../vehicle/vehicleDescriptors.js';

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
    const bodySlot = GLOBAL_VEHICLE_SURFACE_MATERIALS?.body;
    carRoot.traverse(node => {
      if (node.isMesh && node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => {
          if (material && material.name === "paint") {
            if (num !== undefined && num !== null) material.color?.set?.(num);
            if (bodySlot) {
              material.metalness = bodySlot.metalness ?? 0.5;
              material.roughness = bodySlot.roughness ?? 0.85;
              material.needsUpdate = true;
            }
          } else if (material && material.name === "whitebox-rear" && bodySlot) {
            material.metalness = bodySlot.metalness ?? 0.5;
            material.roughness = bodySlot.roughness ?? 0.85;
            material.needsUpdate = true;
          }
        });
      }
    });
    return;
  }

  if (hasVehicleDescriptor(preset)) {
    const bodyMesh = carRoot.children?.find(c => c.name === "car-body-mesh") || carRoot;
    applyCustomGlbVehicleMaterials(bodyMesh, preset, num);
    const palette = createCarPaintMaterial(num, undefined);
    for (const child of carRoot.children || []) {
      if (child.name === "car-wheel-steer") {
        applyVehicleMaterials(child, palette);
      }
    }
    return;
  }

  const palette = createCarPaintMaterial(num, undefined);
  applyVehicleMaterials(carRoot, palette);
}
