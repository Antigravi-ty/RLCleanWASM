/**
 * materialsConfig.js
 * Centralized materials and shader appearance configuration.
 * Decoupled from React / Zustand UI store to allow headless simulation and standalone rendering.
 */

import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/StorageHelper.js';

export const DEFAULT_MATERIALS_CONFIG = Object.freeze({
  ballStyle: 'arcade',
  carPaint: 'arcade',
  stadiumScenery: 'realistic',
  demolishedEffect: 'arcade',
  boostVisual: 'realistic',
  boostFlameLuminance: 'balanced',
  boostPlumeLuminance: 'min',
});

export const MATERIALS_STORAGE_KEY = 'car-soccer.visual-materials.v1';

let activeMaterials = { ...DEFAULT_MATERIALS_CONFIG };

// Load initial config from localStorage
try {
  const raw = safeLocalStorageGet(MATERIALS_STORAGE_KEY);
  if (raw) {
    activeMaterials = { ...DEFAULT_MATERIALS_CONFIG, ...JSON.parse(raw) };
  }
} catch (err) {
  console.warn('[materialsConfig] Failed to parse stored materials config:', err);
}

const listeners = new Set();

/**
 * Returns current visual materials configuration snapshot.
 * @returns {typeof DEFAULT_MATERIALS_CONFIG}
 */
export function getMaterialsConfig() {
  return activeMaterials;
}

/**
 * Updates visual materials configuration.
 * @param {Partial<typeof DEFAULT_MATERIALS_CONFIG>} partialConfig
 * @param {boolean} [persist=true]
 */
export function setMaterialsConfig(partialConfig, persist = true) {
  activeMaterials = { ...activeMaterials, ...partialConfig };
  if (persist) {
    try {
      safeLocalStorageSet(MATERIALS_STORAGE_KEY, JSON.stringify(activeMaterials));
    } catch (err) {
      console.warn('[materialsConfig] Failed to save materials config:', err);
    }
  }
  for (const listener of listeners) {
    try {
      listener(activeMaterials);
    } catch (err) {
      console.error('[materialsConfig] listener error:', err);
    }
  }
}

/**
 * Subscribes to materials configuration changes.
 * @param {(config: typeof DEFAULT_MATERIALS_CONFIG) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function onMaterialsConfigChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
