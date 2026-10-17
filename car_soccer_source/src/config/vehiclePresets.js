/**
 * vehiclePresets.js
 * Standard RocketSim vehicle hitbox presets, visual identifiers, and 3D whitebox car generator.
 * Decoupled from UI layer to eliminate inverted dependencies.
 */

import * as THREE from 'three';
import {
  STORAGE_KEY_DISPLAY_SETTINGS,
  garageSettingsStore
} from '../ui-system/core/configStorageHydrators.ts';
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
  STORAGE_KEY_DISPLAY_SETTINGS,
  garageSettingsStore
};

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
