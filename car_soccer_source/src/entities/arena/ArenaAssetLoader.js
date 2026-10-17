/**
 * ArenaAssetLoader.js
 * Asynchronous asset loading orchestrator for soccer ball, vehicle models,
 * boost pad models (GLB or fallback OBJ), and stadium geometry batches.
 */

import { loadBallAsset } from '../BallVisual.js';
import { loadDriftwoodsStadium } from '../stadium/driftwoods/DriftwoodsStadiumLoader.js';

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
  if (loaders.loadGameCarAsset) {
    try { vehicleRegistry.gameCarAsset = await loaders.loadGameCarAsset(); } catch (e) { console.warn("Game car asset failed to load:", e); }
  }
  if (loaders.loadFlatCarAsset) {
    try { vehicleRegistry.flatCarAsset = await loaders.loadFlatCarAsset(); } catch (e) { console.warn("Flat car asset failed to load:", e); }
  }
  if (loaders.loadRealisticCarAsset) {
    try { vehicleRegistry.realisticCarAsset = await loaders.loadRealisticCarAsset(); } catch (e) { console.warn("Realistic car asset failed to load:", e); }
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
