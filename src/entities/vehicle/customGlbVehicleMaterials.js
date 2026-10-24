/**
 * customGlbVehicleMaterials.js
 * Builds and applies surface slot materials (Standard, Toon, PBR Multi-Layer)
 * and front/rear lamp materials to custom GLB vehicle hierarchies (Fennec, Insidio).
 */

import * as THREE from 'three';
import {
  FENNEC_DESCRIPTOR,
  getVehicleDescriptor,
} from './vehicleDescriptors.js';
import {
  createCarPaintMaterial,
  getVehicleReceiveShadows,
} from './vehiclePaintMaterial.js';
import {
  vehicleTunerRuntimeFlags,
  buildCustomToonRampTexture,
} from './vehicleTunerState.js';

export function buildSurfaceSlotMaterial(slotConfig, teamColor) {
  const rawMode = slotConfig.mode || 'standard';
  const mode = (rawMode === 'standard' || rawMode === 'toon' || rawMode === 'pbr')
    ? rawMode
    : 'standard';

  const isBodySlot = slotConfig.slotName === 'body' || slotConfig.slotName === 'body-shell';
  const useDirectColor = Boolean(vehicleTunerRuntimeFlags.colorOverride) || !isBodySlot || typeof teamColor !== 'number';
  const resolvedColor = useDirectColor
    ? new THREE.Color(slotConfig.color || '#42a5f5')
    : new THREE.Color(teamColor);

  if (mode === 'toon') {
    const rampTex = buildCustomToonRampTexture(
      slotConfig.toonSteps ?? 4,
      slotConfig.toonShadowMin ?? 0.11,
      slotConfig.toonHighlightMax ?? 1.0,
      Boolean(slotConfig.toonSmooth)
    );
    return new THREE.MeshToonMaterial({
      name: `Toon / ${slotConfig.slotName}`,
      color: resolvedColor,
      gradientMap: rampTex,
    });
  }

  if (mode === 'pbr') {
    const pearlColor = new THREE.Color(slotConfig.pearlColor || slotConfig.color || '#ffffff');
    const pbrMat = new THREE.MeshPhysicalMaterial({
      name: `PBR Multi-Layer / ${slotConfig.slotName}`,
      color: resolvedColor,
      metalness: slotConfig.metalness ?? 0.76,
      roughness: slotConfig.roughness ?? 0.17,
      clearcoat: slotConfig.clearcoat ?? 1.0,
      clearcoatRoughness: slotConfig.clearcoatRoughness ?? 0.11,
      sheen: slotConfig.sheen ?? 0.7,
      sheenColor: pearlColor,
      sheenRoughness: 0.24,
      envMapIntensity: slotConfig.envMapIntensity ?? 1.4,
    });

    pbrMat.onBeforeCompile = (shader) => {
      shader.uniforms.pearlColor = { value: pearlColor };
      shader.uniforms.uPearlFresnelPower = { value: 1.35 };
      shader.uniforms.uPearlBlendStrength = { value: 0.82 };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float pearlFresnel = pow(
            1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), max(0.1, uPearlFresnelPower)
          );
          float pearlBlend = uPearlBlendStrength * smoothstep(0.12, 0.72, pearlFresnel);
          diffuseColor.rgb = mix(diffuseColor.rgb, pearlColor, pearlBlend);`
        )
        .replace(
          'uniform vec3 diffuse;',
          'uniform vec3 diffuse;\nuniform vec3 pearlColor;\nuniform float uPearlFresnelPower;\nuniform float uPearlBlendStrength;'
        );
    };
    pbrMat.customProgramCacheKey = () => `custom-vehicle-pbr-pearl-${slotConfig.slotName}`;
    return pbrMat;
  }

  return new THREE.MeshStandardMaterial({
    name: `Standard Single-Layer / ${slotConfig.slotName}`,
    color: resolvedColor,
    metalness: slotConfig.metalness ?? 0.0,
    roughness: slotConfig.roughness ?? 0.5,
    envMapIntensity: slotConfig.envMapIntensity ?? 1.0,
  });
}

export function applyCustomGlbVehicleMaterials(root, vehicleId, teamColor) {
  const descriptor = getVehicleDescriptor(vehicleId) || FENNEC_DESCRIPTOR;
  const palette = createCarPaintMaterial(teamColor, descriptor.colors?.default);
  const surfaceConfigs = descriptor.surfaceMaterials || {};
  const lampsCfg = descriptor.lampsConfig || FENNEC_DESCRIPTOR.lampsConfig;

  const frontBaseColor = new THREE.Color(lampsCfg.frontColor || '#d8eeff')
    .multiplyScalar(lampsCfg.frontIntensity ?? 2.5);
  const frontLampMaterial = new THREE.MeshBasicMaterial({
    name: 'FrontBulb',
    color: frontBaseColor,
    toneMapped: Boolean(lampsCfg.frontToneMapped),
  });

  const tailIdleColor = new THREE.Color(lampsCfg.tailIdleColor || '#5c0a0a')
    .multiplyScalar(lampsCfg.tailIdleIntensity ?? 0.85);
  const tailLampMaterial = new THREE.MeshBasicMaterial({
    name: 'BackBulb',
    color: tailIdleColor,
    toneMapped: Boolean(lampsCfg.tailToneMapped),
  });

  const prevCustomMats = root.userData.customDisposables;
  if (Array.isArray(prevCustomMats)) {
    for (const oldMat of prevCustomMats) {
      oldMat?.dispose?.();
    }
  }

  const slotMaterialMap = new Map();
  for (const [slotKey, slotCfg] of Object.entries(surfaceConfigs)) {
    slotMaterialMap.set(
      slotKey.toLowerCase(),
      buildSurfaceSlotMaterial(slotCfg, teamColor)
    );
  }
  if (!slotMaterialMap.has('body-shell') && slotMaterialMap.has('body')) {
    slotMaterialMap.set('body-shell', slotMaterialMap.get('body'));
  }

  const tailLampMaterials = [];

  root.traverse?.((node) => {
    if (!node.isMesh) return;
    if (node.name === 'boost-nozzle-gizmo' || node.name === 'car-hitbox' || node.name === 'car-hitbox-wireframe') {
      return;
    }

    const origMatName = (
      node.userData.originalMaterialName ||
      (Array.isArray(node.material) ? node.material[0]?.name : node.material?.name) ||
      ''
    ).trim();
    node.userData.originalMaterialName = origMatName;
    const lowerName = origMatName.toLowerCase();

    if (lowerName === 'frontbulb' || lowerName === 'front-lamps' || lowerName === 'lamps-front') {
      node.material = frontLampMaterial;
      node.castShadow = false;
      node.receiveShadow = false;
      return;
    }

    if (lowerName === 'backbulb' || lowerName === 'tail-lamps' || lowerName === 'lamps-rear') {
      node.material = tailLampMaterial;
      node.castShadow = false;
      node.receiveShadow = false;
      if (!tailLampMaterials.includes(tailLampMaterial)) {
        tailLampMaterials.push(tailLampMaterial);
      }
      return;
    }

    if (slotMaterialMap.has(lowerName)) {
      node.material = slotMaterialMap.get(lowerName);
    } else if (lowerName.includes('body') || lowerName.includes('shell')) {
      node.material = palette.body;
    } else {
      node.material = palette.lowerDetail;
    }

    node.castShadow = true;
    node.receiveShadow = getVehicleReceiveShadows();
  });

  root.userData.vehicleId = descriptor.id;
  root.userData.tailLampMaterials = tailLampMaterials;
  root.userData.frontLampMaterial = frontLampMaterial;
  root.userData.customDisposables = [
    frontLampMaterial,
    tailLampMaterial,
    ...slotMaterialMap.values(),
  ];
  if (typeof teamColor === 'number') {
    root.userData.teamColor = teamColor;
  }
}
