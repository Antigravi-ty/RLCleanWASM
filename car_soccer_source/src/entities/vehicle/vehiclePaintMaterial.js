import { OCTANE_DEFAULT_COLORS } from './vehicleDescriptors.js';
import * as THREE from 'three';
import { createMultiThemeMaterial, registerThemeSubtree, createCelShadedToonMaterial } from '../../effects/ThemeMaterialPipeline.js';

const carPaintCache = new Map();

/**
 * Creates dual-theme vehicle paint and hardware materials.
 * Includes realistic anodized pearl clearcoat shader and arcade toon material.
 */
export function createCarPaintMaterial(teamColor, options = OCTANE_DEFAULT_COLORS) {
  let opts = options;
  let color = teamColor;

  if (typeof color === "number" && (!opts || opts === OCTANE_DEFAULT_COLORS)) {
    opts = { primary: color, realisticPrimary: color, pearl: color };
  } else if (typeof color === "object" && color !== null && (!opts || opts === OCTANE_DEFAULT_COLORS)) {
    opts = color;
  }
  if (!opts) opts = OCTANE_DEFAULT_COLORS;

  const primary = opts.primary;
  const realisticPrimary = opts.realisticPrimary ?? primary;
  const pearl = opts.pearl ?? primary;
  const cacheKey = `${primary}/${realisticPrimary}/${pearl}`;

  const cached = carPaintCache.get(cacheKey);
  if (cached) return cached;

  const { Color, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial } = THREE;
  const multiThemeMaterial = createMultiThemeMaterial;
  const cloneMaterial = createCelShadedToonMaterial;

  const pearlColor = new Color(pearl);
  const realisticPearlPaint = new MeshPhysicalMaterial({
    name: "Realistic / anodized pearl paint",
    color: realisticPrimary,
    roughness: 0.17,
    metalness: 0.76,
    clearcoat: 1,
    clearcoatRoughness: 0.11,
    sheen: 0.7,
    sheenColor: pearlColor,
    sheenRoughness: 0.24,
    envMapIntensity: 1.4
  });

  realisticPearlPaint.onBeforeCompile = (shader) => {
    shader.uniforms.pearlColor = { value: pearlColor };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float pearlFresnel = pow(
          1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 1.35
        );
        float pearlBlend = 0.82 * smoothstep(0.12, 0.72, pearlFresnel);
        diffuseColor.rgb = mix(diffuseColor.rgb, pearlColor, pearlBlend);`
      )
      .replace(
        "uniform vec3 diffuse;",
        `uniform vec3 diffuse;\nuniform vec3 pearlColor;`
      );
  };
  realisticPearlPaint.customProgramCacheKey = () => "game-car-anodized-pearl";

  const arcadePaint = cloneMaterial ? cloneMaterial({
    name: "Arcade / body paint",
    color: primary
  }) : new MeshStandardMaterial({
    name: "Arcade / body paint",
    color: primary
  });

  const bodyMaterial = (typeof multiThemeMaterial === "function")
    ? multiThemeMaterial(arcadePaint, realisticPearlPaint)
    : realisticPearlPaint;

  const arcadeWheelMetal = cloneMaterial ? cloneMaterial({ color: 3754339 }) : new MeshStandardMaterial({ color: 3754339 });
  const realisticWheelMetal = new MeshPhysicalMaterial({
    color: 2435633,
    roughness: 0.24,
    metalness: 0.94,
    clearcoat: 0.32,
    clearcoatRoughness: 0.18
  });

  const arcadeTire = cloneMaterial ? cloneMaterial({ color: 1119000 }) : new MeshStandardMaterial({ color: 1119000 });
  const realisticTire = new MeshStandardMaterial({
    color: 1119000,
    roughness: 0.92,
    metalness: 0.02
  });

  const arcadeLowerDetail = cloneMaterial ? cloneMaterial({ color: 1514274 }) : new MeshStandardMaterial({ color: 1514274 });
  const realisticLowerDetail = new MeshStandardMaterial({
    color: 1514274,
    roughness: 0.4,
    metalness: 0.78
  });

  const palette = {
    wheelMetal: (typeof multiThemeMaterial === "function") ? multiThemeMaterial(arcadeWheelMetal, realisticWheelMetal) : realisticWheelMetal,
    tire: (typeof multiThemeMaterial === "function") ? multiThemeMaterial(arcadeTire, realisticTire) : realisticTire,
    lowerDetail: (typeof multiThemeMaterial === "function") ? multiThemeMaterial(arcadeLowerDetail, realisticLowerDetail) : realisticLowerDetail,
    lamps: new MeshBasicMaterial({ color: 14153727, toneMapped: false }),
    tailLamps: new MeshBasicMaterial({ color: 13970226, toneMapped: false }),
    body: bodyMaterial
  };

  carPaintCache.set(cacheKey, palette);
  return palette;
}

/**
 * Maps original submesh material name to the themed vehicle palette.
 */
export function mapVehicleMaterial(mat, palette, mesh) {
  const name = (mesh?.userData?.originalMaterialName) || (mat?.name) || "";
  switch (name) {
    case "wheel-metal":
    case "Arcade / wheel metal":
    case "Realistic / wheel metal":
      return palette.wheelMetal;
    case "tire":
    case "Arcade / tire":
    case "Realistic / tire":
      return palette.tire;
    case "lower-detail":
    case "Arcade / lower detail":
    case "Realistic / lower detail":
    case "glass":
      return palette.lowerDetail;
    case "lamps":
      return palette.lamps;
    case "tail-lamps":
      return palette.tailLamps;
    case "body-shell":
    case "body-fill":
    case "paint":
    case "Arcade / body paint":
    case "Realistic / anodized pearl paint":
      return palette.body;
    default:
      if (mesh?.name && (mesh.name.includes("body") || mesh.name.includes("shell") || mesh.name.includes("paint"))) {
        return palette.body;
      }
      if (name.startsWith("Arcade / reset") || name.startsWith("Realistic / reset") || mat?.uniforms) {
        return mat;
      }
      return palette.lowerDetail;
  }
}

/**
 * Recursively applies vehicle paint & hardware materials across a submesh hierarchy.
 */
export function applyVehicleMaterials(root, palette) {
  const { Mesh } = THREE;
  const markMatrixDirty = registerThemeSubtree;
  root.traverse?.(node => {
    let parent = node;
    while (parent) {
      if (
        parent.name === "flip-reset-indicator" ||
        parent.name === "realistic-reset-pulse" ||
        parent.name === "car-hitbox" ||
        parent.name?.startsWith("whitebox-")
      ) {
        return;
      }
      parent = parent.parent;
    }
    if (node instanceof Mesh || node.isMesh) {
      if (Array.isArray(node.material) && node.material.some(m => m?.name === "whitebox-rear")) {
        return;
      }
      if (!node.userData.originalMaterialName && node.material) {
        node.userData.originalMaterialName = Array.isArray(node.material)
          ? (node.material[0]?.name || "")
          : (node.material.name || "");
      }
      node.material = Array.isArray(node.material)
        ? node.material.map(mat => mapVehicleMaterial(mat, palette, node))
        : mapVehicleMaterial(node.material, palette, node);
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  if (typeof markMatrixDirty === "function") {
    markMatrixDirty(root);
  }
}

/**
 * Deep clones a vehicle mesh hierarchy and applies custom paint.
 */
export function cloneVehicleMeshWithPaint(mesh, teamColor, colorOptions) {
  const cloned = mesh.clone ? mesh.clone(true) : mesh;
  const palette = createCarPaintMaterial(teamColor, colorOptions);
  applyVehicleMaterials(cloned, palette);
  return cloned;
}
