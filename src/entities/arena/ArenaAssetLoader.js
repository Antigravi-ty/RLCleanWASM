import { loadBallAsset } from '../BallVisual.js';
import { loadDriftwoodsStadium } from '../stadium/driftwoods/DriftwoodsStadiumLoader.js';
import { getAllVehicleDescriptors, hasVehicleDescriptor } from '../vehicle/vehicleDescriptors.js';

export async function loadBallAssetInto(ballGroup) {
  try {
    const ballAsset = await loadBallAsset();
    ballGroup.add(ballAsset);
  } catch (err) {
    console.warn("Ball asset failed to load, keeping default procedural mesh:", err);
  }
}

export async function loadCarAndPadAssets(vehicleRegistry, boostPadSystem) {
  const loaders = vehicleRegistry.carLoaders;
  if (loaders.loadCustomGlbCarAsset) {
    for (const desc of getAllVehicleDescriptors()) {
      try {
        const asset = await loaders.loadCustomGlbCarAsset(desc.id);
        vehicleRegistry.setCustomVehicleAsset?.(desc.id, asset);
      } catch (e) {
        console.warn(`Custom vehicle asset "${desc.id}" failed to load:`, e);
      }
    }
  }

  if (Array.isArray(vehicleRegistry.cars)) {
    for (let i = 0; i < vehicleRegistry.cars.length; i++) {
      const preset = vehicleRegistry.vehiclePresets?.[i];
      if (vehicleRegistry.cars[i] && hasVehicleDescriptor(preset)) {
        vehicleRegistry.swapCarVisual?.(i, preset);
      }
    }
  }

  let padTemplates = null;
  try {
    const glbTemplates = await boostPadSystem.loadTemplates();
    if (glbTemplates) padTemplates = glbTemplates;
  } catch (err) {
    console.warn("Authentic GLB boost pads failed to load:", err);
  }

  return padTemplates;
}

export async function loadArenaStadiumMeshes() {
  try {
    const driftwoodsStadium = await loadDriftwoodsStadium().catch((err) => {
      console.warn("Driftwoods stadium load failed:", err);
      return null;
    });
    return { driftwoodsStadium };
  } catch (err) {
    console.warn("loadArena skipped:", err);
    return {};
  }
}
