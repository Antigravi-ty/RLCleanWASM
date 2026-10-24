/**
 * vehiclePresets.js
 * Standard RocketSim vehicle hitbox presets, visual identifiers, and 3D whitebox car generator.
 * Decoupled from UI layer to eliminate inverted dependencies.
 */

import * as THREE from 'three';
import {
  STORAGE_KEYS,
  safeStorage,
  createLocalStorageStore,
  stringOrDefault
} from './storageHelpers.ts';
import {
  HITBOX_PRESETS,
  CAR_VISUAL_IDS,
  CAR_VISUAL_OPTIONS,
  CAR_VISUAL_CATALOG,
  HITBOX_INDEX_TO_ID,
  normalizeVisualId,
  encodeVisualIdIndex,
  decodeVisualIdIndex,
  resolveHitboxIndex,
  decodeHitboxIndex
} from './vehicleConstants.js';
import { GLOBAL_VEHICLE_SURFACE_MATERIALS } from './vehicleTunerConfig.js';

export {
  HITBOX_PRESETS,
  CAR_VISUAL_IDS,
  CAR_VISUAL_OPTIONS,
  CAR_VISUAL_CATALOG,
  HITBOX_INDEX_TO_ID,
  normalizeVisualId,
  encodeVisualIdIndex,
  decodeVisualIdIndex,
  resolveHitboxIndex,
  decodeHitboxIndex,
};
export const STORAGE_KEY_DISPLAY_SETTINGS = STORAGE_KEYS.DISPLAY_SETTINGS;
export const COLOR_PREFS_KEY = STORAGE_KEYS.COLOR_PREFS;

export const COLOR_SLOT_HEX_MAP = Object.freeze({
  0: '#ff7043',
  1: '#66bb6a',
  2: '#ffc107',
  3: '#42a5f5',
  4: '#fd6e9d',
  5: '#ba68c8',
});

export const garageSettingsStore = createLocalStorageStore(
  STORAGE_KEY_DISPLAY_SETTINGS,
  () => ({ vehiclePreset: 'fennec' }),
  (target, stored) => {
    target.vehiclePreset = stringOrDefault(
      stored.vehiclePreset || stored.carVisual,
      CAR_VISUAL_IDS,
      target.vehiclePreset
    );
    target.carVisual = target.vehiclePreset;
  }
);

export function getInitialCar() {
  return garageSettingsStore.load().vehiclePreset || 'fennec';
}

export function loadStoredColorPrefs() {
  try {
    const raw = safeStorage.get(COLOR_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.blueOrder) && Array.isArray(parsed.orangeOrder)) {
        return {
          primaryTeam: parsed.primaryTeam === 'blue' ? 'blue' : 'orange',
          blueOrder: parsed.blueOrder,
          orangeOrder: parsed.orangeOrder,
        };
      }
    }
  } catch (err) {
    console.warn('[vehiclePresets] Failed to load stored color preferences:', err);
  }
  return {
    primaryTeam: 'orange',
    orangeOrder: [2, 4, 0],
    blueOrder: [1, 5, 3],
  };
}

export function getPreferredColorSlot(prefs) {
  const effective = prefs ?? loadStoredColorPrefs();
  const slot = effective.primaryTeam === 'blue' ? effective.blueOrder?.[0] : effective.orangeOrder?.[0];
  return typeof slot === 'number' && COLOR_SLOT_HEX_MAP[slot] !== undefined ? slot : 2;
}

export function getPreferredColorHex(prefs) {
  const slot = getPreferredColorSlot(prefs);
  return COLOR_SLOT_HEX_MAP[slot] || '#ffc107';
}

export function saveStoredColorPrefs(nextPrefs) {
  const activeSlotId = getPreferredColorSlot(nextPrefs);
  safeStorage.set(COLOR_PREFS_KEY, JSON.stringify(nextPrefs));
  return activeSlotId;
}

export function loadStoredPlayerName(fallback) {
  const saved = safeStorage.get(STORAGE_KEYS.PLAYER_NAME);
  if (saved && saved.trim()) {
    return saved.trim().substring(0, 24);
  }
  return fallback ?? `Striker-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function saveStoredPlayerName(name) {
  const trimmed = String(name || '').trim();
  if (trimmed) {
    safeStorage.set(STORAGE_KEYS.PLAYER_NAME, trimmed);
  }
}


/**
 * Constructs a procedural 3D whitebox car body based on a RocketSim hitbox preset.
 * Includes colored team faces and rear orientation indicator.
 */
export function createWhiteboxCarModel(presetId, teamColor = 0x0088ff, three = THREE) {
  const cfg = HITBOX_PRESETS[presetId] || HITBOX_PRESETS["hitbox-octane"];
  if (!three || !three.Group || !three.BoxGeometry || !three.MeshStandardMaterial || !three.Mesh) {
    throw new Error("[Garage] Three.js context required to build procedural car model.");
  }

  const root = new three.Group();
  root.name = `whitebox-${cfg.name}`;

  const bodySlot = GLOBAL_VEHICLE_SURFACE_MATERIALS?.body;
  const bodyGeom = new three.BoxGeometry(cfg.length, cfg.height, cfg.width);
  const bodyMat = new three.MeshStandardMaterial({
    color: teamColor,
    roughness: bodySlot?.roughness ?? 0.85,
    metalness: bodySlot?.metalness ?? 0.5
  });
  bodyMat.name = "paint";
  const rearMat = new three.MeshStandardMaterial({
    color: 0xffffff,
    roughness: bodySlot?.roughness ?? 0.85,
    metalness: bodySlot?.metalness ?? 0.5
  });
  rearMat.name = "whitebox-rear";
  const bottomMat = new three.MeshStandardMaterial({
    color: 0x1f2328, // Dark grey
    roughness: 0.85,
    metalness: 0.1
  });
  bottomMat.name = "lower-detail";

  const materials = [
    bodyMat,   // Face 0: +X (Front - team color)
    rearMat,   // Face 1: -X (Rear - White)
    bodyMat,   // Face 2: +Y (Top - team color)
    bottomMat, // Face 3: -Y (Bottom - Dark grey)
    bodyMat,   // Face 4: +Z (Side - team color)
    bodyMat    // Face 5: -Z (Side - team color)
  ];

  const bodyMesh = new three.Mesh(bodyGeom, materials);
  bodyMesh.position.set(cfg.forward, cfg.up, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = false;

  if (three.EdgesGeometry && three.LineBasicMaterial && three.LineSegments) {
    const edgesGeom = new three.EdgesGeometry(bodyGeom);
    const wireMat = new three.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85
    });
    const wireMesh = new three.LineSegments(edgesGeom, wireMat);
    bodyMesh.add(wireMesh);
  }

  root.add(bodyMesh);
  return root;
}
