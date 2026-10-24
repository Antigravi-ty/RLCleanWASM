/**
 * atmosphereFxConfig.js
 * Pure configuration defaults and runtime state for Driftwoods Wall FX and Arena Shadow Lighting.
 */

export const DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG = {
  // 1. 3D Sphere-Wall Intersection Ring (Applies to Glass Walls Mesh)
  circleEnabled: true,
  circleRadius: 500,
  circleVerticalExtendUu: 0,
  circleThickness: 5,
  circleColor: '#d6d6d6',
  circleUseTeamColor: true,
  circleOpacity: 0.75,
  circlePreviewOrbit: false,
  circleShowSpherePreview: false,

  // 2. Wall Proximity Pulse Wave (Independent Virtual Sphere, Applies to Shield Hexes & Optional Solid Walls)
  pulseEnabled: true,
  pulseSphereRadius: 4000,
  pulseVerticalExtendUu: 0,

  // Pulse Direction: 'inward' | 'outward'
  pulseDirection: 'inward',

  // Sphere Edge Fade
  pulseFadeShrinkPct: 50,
  pulseFadeRangeUu: -2000,
  pulseFadeBezierP1X: 0.5,
  pulseFadeBezierP1Y: 0.0,
  pulseFadeBezierP2X: 1.0,
  pulseFadeBezierP2Y: 0.0,

  // Steady / Static Override Mode
  pulseSteadyMode: 'wave', // 'wave' | 'solid-override' | 'static-ring'
  pulseStaticPositionPct: 47,
  pulseStaticBandWidthPct: 5,

  // Pulse Wave Timing & Speed
  pulseIntervalSec: 1,
  pulseSpeedRadiusPct: 50,

  // Split 2-Half Pulse Wave Gradient
  pulseRiseDurationSec: 0.01,
  pulseFallDurationSec: 0.2,
  pulseDurationSec: 0.21,
  pulseRiseBezierP1X: 0.33,
  pulseRiseBezierP1Y: 0.33,
  pulseRiseBezierP2X: 0.67,
  pulseRiseBezierP2Y: 0.67,
  pulseFallBezierP1X: 0.0,
  pulseFallBezierP1Y: 0.5,
  pulseFallBezierP2X: 0.0,
  pulseFallBezierP2Y: 1.01,

  // Appearance
  pulseIntensity: 1,
  pulseColor: '#ffffff',
  pulseMultiplyTeamColor: true,
  pulseOpacity: 0.92,
  pulsePreviewOrbit: false,
  pulseShowSpherePreview: false,

  // 3. Half-Field Team Split & Center White Line (Applies to Shield Hexes Mesh)
  teamGradientEnabled: true,
  centerLineWidth: 5,
  teamTransitionWidth: 1000,
  teamColorStrength: 0.8,
  blueTeamColor: '#0089ff',
  blueTeamAlpha: 0.85,
  orangeTeamColor: '#ff5200',
  orangeTeamAlpha: 0.85,
  centerLineColor: '#ffffff',
  centerLineAlpha: 0,
  previewBallNearWall: false,
  circleApplyToWalls: true,
  circleApplyToHexes: false,
  pulseApplyToHexes: true,
  pulseApplyToWalls: false,
  teamApplyToHexes: true,
  teamApplyToWalls: false,
};

export const experimentalWallFxRuntimeConfig = {
  ...DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG,
};

export function getExperimentalWallFxConfig() {
  return { ...experimentalWallFxRuntimeConfig };
}

export function setExperimentalWallFxRuntimeConfig(patch = {}) {
  if (!patch) return experimentalWallFxRuntimeConfig;
  Object.assign(experimentalWallFxRuntimeConfig, patch);
  if (
    patch.pulseRiseDurationSec !== undefined ||
    patch.pulseFallDurationSec !== undefined
  ) {
    experimentalWallFxRuntimeConfig.pulseDurationSec = Number(
      (
        Math.max(0.0001, Number(experimentalWallFxRuntimeConfig.pulseRiseDurationSec ?? 0.01)) +
        Math.max(0.0001, Number(experimentalWallFxRuntimeConfig.pulseFallDurationSec ?? 0.2))
      ).toFixed(5)
    );
  }
  return { ...experimentalWallFxRuntimeConfig };
}

export const DEFAULT_SUN_OFFSET_X = 3033;
export const DEFAULT_SUN_OFFSET_Y = 3942;
export const DEFAULT_SUN_OFFSET_Z = 535;
export const DEFAULT_SUN_DISTANCE = 5002;
export const DEFAULT_SUN_AZIMUTH_DEG = 10;
export const DEFAULT_SUN_ELEVATION_DEG = 52;

export const DEFAULT_SHADOW_CONFIG = {
  mode: 'single-sun', // 'single-sun' | 'multi' | 'off'
  sharpness: 'sharp', // 'sharp' (BasicShadowMap) | 'pcf' (PCFShadowMap) | 'soft' (PCFSoftShadowMap)
  mapSize: 2048, // 1024 | 2048 | 3072 | 4096
  singleSunFrustumRadius: 1100,
  shadowBias: -0.0001,
  carsReceiveShadows: false,

  // Primary Directional Sun Light
  sunOffsetX: DEFAULT_SUN_OFFSET_X,
  sunOffsetY: DEFAULT_SUN_OFFSET_Y,
  sunOffsetZ: DEFAULT_SUN_OFFSET_Z,
  sunAzimuthDeg: DEFAULT_SUN_AZIMUTH_DEG,
  sunElevationDeg: DEFAULT_SUN_ELEVATION_DEG,
  sunDistance: DEFAULT_SUN_DISTANCE,
  sunColor: '#ffffff',
  sunIntensity: 1,

  // Secondary Fill / Key Directional Light
  keyLightEnabled: true,
  keyLightMode: 'fixed', // 'fixed' | 'opposite-sun' | 'custom'
  keyLightAzimuthDeg: -135,
  keyLightElevationDeg: 35.3,
  keyLightColor: '#88aadf',
  keyLightIntensity: 0.5,

  // Hemisphere Ambient Light
  hemiLightEnabled: true,
  hemiSkyColor: '#c8e0ff',
  hemiGroundColor: '#2732c8',
  hemiIntensity: 1,

  // 3D Light Source Position & Ray Visualizer
  showLightGizmo: false,
  lightRayOrigin: 'car', // 'car' | 'camera' | 'ball' | 'origin'
  showKeyLightGizmo: false,
  lightGizmoDepthTest: false,
};

export const shadowRuntimeConfig = {
  ...DEFAULT_SHADOW_CONFIG,
};

export function normalizeShadowLightingPatch(currentConfig, patch = {}) {
  if (!patch) return { ...currentConfig };
  const merged = { ...currentConfig, ...patch };

  const hasSphericalPatch =
    patch.sunAzimuthDeg !== undefined ||
    patch.sunElevationDeg !== undefined ||
    patch.sunDistance !== undefined;
  const hasCartesianPatch =
    patch.sunOffsetX !== undefined ||
    patch.sunOffsetY !== undefined ||
    patch.sunOffsetZ !== undefined;

  if (hasSphericalPatch && !hasCartesianPatch) {
    const azRad = ((Number(merged.sunAzimuthDeg) || 0) * Math.PI) / 180;
    const elDeg = Math.max(1, Math.min(89, Number(merged.sunElevationDeg) ?? DEFAULT_SUN_ELEVATION_DEG));
    const elRad = (elDeg * Math.PI) / 180;
    const dist = Math.max(500, Number(merged.sunDistance) || DEFAULT_SUN_DISTANCE);
    const cosEl = Math.cos(elRad);
    merged.sunElevationDeg = Number(elDeg.toFixed(1));
    merged.sunDistance = Math.round(dist);
    merged.sunOffsetX = Math.round(dist * cosEl * Math.cos(azRad));
    merged.sunOffsetY = Math.round(dist * Math.sin(elRad));
    merged.sunOffsetZ = Math.round(dist * cosEl * Math.sin(azRad));
  } else if (hasCartesianPatch) {
    const ox = Number(merged.sunOffsetX) || 0;
    const oy = Math.max(50, Number(merged.sunOffsetY) || 50);
    const oz = Number(merged.sunOffsetZ) || 0;
    const dist = Math.max(100, Math.hypot(ox, oy, oz));
    const azDeg = (Math.atan2(oz, ox) * 180) / Math.PI;
    const elDeg = (Math.asin(Math.max(-1, Math.min(1, oy / dist))) * 180) / Math.PI;
    merged.sunOffsetX = Math.round(ox);
    merged.sunOffsetY = Math.round(oy);
    merged.sunOffsetZ = Math.round(oz);
    merged.sunDistance = Math.round(dist);
    merged.sunAzimuthDeg = Number(azDeg.toFixed(1));
    merged.sunElevationDeg = Number(elDeg.toFixed(1));
  }

  return merged;
}

export function getShadowConfig() {
  return { ...shadowRuntimeConfig };
}

export function updateShadowRuntimeConfig(patch = {}) {
  if (!patch) return shadowRuntimeConfig;
  const next = normalizeShadowLightingPatch(shadowRuntimeConfig, patch);
  Object.assign(shadowRuntimeConfig, next);
  return { ...shadowRuntimeConfig };
}
