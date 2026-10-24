/**
 * materialsConfig.js
 * Centralized materials and shader appearance configuration and persistence.
 */

import { safeStorage, STORAGE_KEYS } from './storageHelpers.ts';
import { applyVehiclePaintFinishPreset } from './vehicleTunerConfig.js';

export const MATERIALS_STORAGE_KEY = STORAGE_KEYS.MATERIALS;

export const DEFAULT_MATERIALS_CONFIG = {
  ballStyle: 'football',
  carPaint: 'cartoon',
  paintFinish: 'matte',
  demolishedEffect: 'toon',
  boostVisual: 'gold-rush',
  boostFlameLuminance: 'balanced',
  boostPlumeLuminance: 'min',
};

let activeMaterials = (() => {
  const raw = safeStorage.get(MATERIALS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = { ...DEFAULT_MATERIALS_CONFIG, ...JSON.parse(raw) };
      if (parsed.paintFinish !== 'matte' && parsed.paintFinish !== 'metallic') {
        parsed.paintFinish = 'matte';
      }
      applyVehiclePaintFinishPreset(parsed.paintFinish);
      return parsed;
    } catch (err) {
      console.warn('[materialsConfig] Failed to parse stored materials config:', err);
    }
  }
  applyVehiclePaintFinishPreset(DEFAULT_MATERIALS_CONFIG.paintFinish);
  return { ...DEFAULT_MATERIALS_CONFIG };
})();

const materialsListeners = new Set();

export function getMaterialsConfig() {
  return activeMaterials;
}

export function setMaterialsConfig(partialConfig, persist = true) {
  if (
    partialConfig &&
    (partialConfig.paintFinish === 'matte' || partialConfig.paintFinish === 'metallic')
  ) {
    applyVehiclePaintFinishPreset(partialConfig.paintFinish);
  }
  activeMaterials = { ...activeMaterials, ...partialConfig };
  if (persist) {
    safeStorage.set(MATERIALS_STORAGE_KEY, JSON.stringify(activeMaterials));
  }
  for (const listener of materialsListeners) {
    try {
      listener(activeMaterials);
    } catch (err) {
      console.error('[materialsConfig] materialsConfig listener error:', err);
    }
  }
}

export function onMaterialsConfigChange(listener) {
  materialsListeners.add(listener);
  return () => materialsListeners.delete(listener);
}

export function getInitialMaterials() {
  return getMaterialsConfig() || { ...DEFAULT_MATERIALS_CONFIG };
}
