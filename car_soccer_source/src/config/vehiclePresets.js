/**
 * vehiclePresets.js
 * Standard RocketSim vehicle hitbox presets, visual identifiers, and 3D whitebox car generator.
 * Decoupled from UI layer to eliminate inverted dependencies.
 */

import * as THREE from 'three';
import { createLocalStorageStore, stringOrDefault } from '../utils/StorageHelper.js';

/**
 * 6 standard Rocket League vehicle hitboxes with strict dimensions from RocketSim / Psyonix spec.
 */
export const HITBOX_PRESETS = {
  "hitbox-octane": {
    name: "Octane",
    length: 120.507,
    width: 86.6994,
    height: 38.6591,
    forward: 13.8757,
    up: 20.755
  },
  "hitbox-dominus": {
    name: "Dominus",
    length: 130.427,
    width: 85.7799,
    height: 33.80,
    forward: 9.00,
    up: 15.75
  },
  "hitbox-breakout": {
    name: "Breakout",
    length: 133.992,
    width: 83.021,
    height: 32.80,
    forward: 12.50,
    up: 11.75
  },
  "hitbox-hybrid": {
    name: "Hybrid",
    length: 129.519,
    width: 84.6879,
    height: 36.6591,
    forward: 13.8757,
    up: 20.755
  },
  "hitbox-plank": {
    name: "Batmobile (Plank)",
    length: 131.32,
    width: 87.1704,
    height: 31.8944,
    forward: 9.00857,
    up: 12.0942
  },
  "hitbox-merc": {
    name: "Merc",
    length: 123.22,
    width: 79.2103,
    height: 44.1591,
    forward: 11.3757,
    up: 21.505
  }
};

/**
 * Valid car visual identifier strings.
 */
export const CAR_VISUAL_IDS = [
  "hitbox-octane",
  "hitbox-dominus",
  "hitbox-breakout",
  "hitbox-hybrid",
  "hitbox-plank",
  "hitbox-merc",
  "game-car",
  "flat-car"
];

/**
 * Full options table for visual selection in the Garage dialog.
 */
export const CAR_VISUAL_OPTIONS = [
  { id: "hitbox-octane", label: "Octane (Whitebox)", isPreset: true },
  { id: "hitbox-dominus", label: "Dominus (Whitebox)", isPreset: true },
  { id: "hitbox-breakout", label: "Breakout (Whitebox)", isPreset: true },
  { id: "hitbox-hybrid", label: "Hybrid (Whitebox)", isPreset: true },
  { id: "hitbox-plank", label: "Batmobile/Plank (Whitebox)", isPreset: true },
  { id: "hitbox-merc", label: "Merc (Whitebox)", isPreset: true },
  { id: "game-car", label: "Default Car", isPreset: false },
  { id: "flat-car", label: "Flat Car", isPreset: false }
];

export const STORAGE_KEY_DISPLAY_SETTINGS = "car-soccer.display-settings.v1";

/**
 * Display settings store for car body selection.
 */
export const garageSettingsStore = createLocalStorageStore(
  STORAGE_KEY_DISPLAY_SETTINGS,
  () => ({ vehiclePreset: "game-car" }),
  (target, stored) => {
    target.vehiclePreset = stringOrDefault(stored.vehiclePreset || stored.carVisual, CAR_VISUAL_IDS, target.vehiclePreset);
    target.carVisual = target.vehiclePreset;
  }
);

// Global Three.js dependency container for decoupling
let garageThreeContext = null;
let garageModelLoaders = {
  loadFlatCar: null,
  loadGameCar: null,
  getTeamColor: () => 0x2f7bd3
};

/**
 * Inject Three.js classes and constructors.
 */
export function setGarageThreeContext(context) {
  garageThreeContext = context;
}

export function getGarageThreeContext() {
  return garageThreeContext;
}

/**
 * Inject external GLTF model loader callbacks.
 */
export function setGarageModelLoaders(loaders) {
  Object.assign(garageModelLoaders, loaders);
}

export function getGarageModelLoaders() {
  return garageModelLoaders;
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

  const bodyGeom = new three.BoxGeometry(cfg.length, cfg.height, cfg.width);
  const bodyMat = new three.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.35,
    metalness: 0.2
  });
  bodyMat.name = "paint";
  const rearMat = new three.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.2
  });
  rearMat.name = "whitebox-rear";
  const bottomMat = new three.MeshStandardMaterial({
    color: 0x1f2328, // 深灰色 (Dark grey)
    roughness: 0.85,
    metalness: 0.1
  });
  bottomMat.name = "lower-detail";

  const materials = [
    bodyMat,   // Face 0: +X (Front - team color)
    rearMat,   // Face 1: -X (Rear - White)
    bodyMat,   // Face 2: +Y (Top - team color)
    bottomMat, // Face 3: -Y (Bottom - 深灰色)
    bodyMat,   // Face 4: +Z (Side - team color)
    bodyMat    // Face 5: -Z (Side - team color)
  ];

  const bodyMesh = new three.Mesh(bodyGeom, materials);
  bodyMesh.position.set(cfg.forward, cfg.up, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;

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
