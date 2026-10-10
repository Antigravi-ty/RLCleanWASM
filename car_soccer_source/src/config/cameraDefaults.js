/**
 * cameraDefaults.js
 * Default camera settings, range bounds, and configuration groups for 3D camera controllers.
 * Decoupled from UI layer to eliminate inverted dependencies.
 */

export const CAMERA_SETTINGS_STORAGE_KEY = "car-soccer.camera-settings.v1";

export const DEFAULT_CAMERA_SETTINGS = Object.freeze({
  cameraShake: false,
  fov: 110,
  distance: 270,
  height: 90,
  angleDeg: -4,
  stiffness: 1,
  swivelSpeed: 10,
  transitionSpeed: 1.9,
  invertSwivel: true
});

export const CAMERA_RANGE_SETTINGS = Object.freeze([
  { key: "fov", label: "Field of View", min: 60, max: 110, step: 1, decimals: 0, suffix: "°" },
  { key: "distance", label: "Distance", min: 100, max: 400, step: 10, decimals: 2 },
  { key: "height", label: "Height", min: 40, max: 200, step: 10, decimals: 2 },
  { key: "angleDeg", label: "Angle", min: -15, max: 0, step: 1, decimals: 2, suffix: "°" },
  { key: "stiffness", label: "Stiffness", min: 0, max: 1, step: 0.05, decimals: 2 },
  { key: "swivelSpeed", label: "Swivel Speed", min: 1, max: 10, step: 0.1, decimals: 2 },
  { key: "transitionSpeed", label: "Transition Speed", min: 1, max: 2, step: 0.1, decimals: 2 }
]);

export const CAMERA_RANGE_SETTINGS_MAP = new Map(CAMERA_RANGE_SETTINGS.map(i => [i.key, i]));
