/**
 * uiConfig.ts
 * Centralized UI and subsystem configuration types, defaults, and LocalStorage hydrators.
 */

import {
  STORAGE_KEYS,
  safeStorage,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  isPlainObject,
  booleanOrDefault,
  clampNumberOrDefault,
  stringOrDefault,
  filterArraySlice,
  createLocalStorageStore,
  type LocalStorageStore,
} from './storageHelpers.ts';
import {
  type DriftwoodsTunerConfig,
  type DriftwoodsPreset,
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig,
} from './driftwoodsConfig.ts';
import {
  CAMERA_SETTINGS_STORAGE_KEY,
  DEFAULT_CAMERA_SETTINGS,
  CAMERA_RANGE_SETTINGS,
  CAMERA_RANGE_SETTINGS_MAP,
  getInitialCamera as getInitialCameraRaw,
} from './cameraDefaults.js';
import {
  MATERIALS_STORAGE_KEY,
  DEFAULT_MATERIALS_CONFIG as DEFAULT_MATERIALS_CONFIG_RAW,
  getMaterialsConfig as getMaterialsConfigRaw,
  setMaterialsConfig as setMaterialsConfigRaw,
  onMaterialsConfigChange as onMaterialsConfigChangeRaw,
  getInitialMaterials as getInitialMaterialsRaw,
} from './materialsConfig.js';
import {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  themeSettingsStore,
  applyThemeToDocument,
  getTheme,
  setTheme,
  onThemeChange,
  getInitialTheme,
} from './themeConfig.js';
import {
  DEFAULT_TRAINING_SETTINGS,
  DEFAULT_GRAPHICS_SETTINGS,
  TRAJECTORY_STORAGE_KEY,
  DEFAULT_TRAJECTORY_CONFIG as DEFAULT_TRAJECTORY_CONFIG_RAW,
  loadSavedTrajectorySettings as loadSavedTrajectorySettingsRaw,
  saveTrajectorySettings as saveTrajectorySettingsRaw,
  getInitialTrajectory as getInitialTrajectoryRaw,
  getInitialGraphics as getInitialGraphicsRaw,
  botSettingsStore,
  getInitialKickoffWsOffset,
  saveKickoffWsOffset,
} from './trainingDefaults.js';
import {
  CAR_VISUAL_IDS,
  STORAGE_KEY_DISPLAY_SETTINGS,
  COLOR_PREFS_KEY,
  COLOR_SLOT_HEX_MAP,
  garageSettingsStore,
  getInitialCar,
  loadStoredColorPrefs as loadStoredColorPrefsRaw,
  getPreferredColorSlot as getPreferredColorSlotRaw,
  getPreferredColorHex as getPreferredColorHexRaw,
  saveStoredColorPrefs as saveStoredColorPrefsRaw,
  loadStoredPlayerName,
  saveStoredPlayerName,
} from './vehiclePresets.js';
import {
  DEFAULT_SIGNALING_URL,
  SIGNALING_ROOM_PREFIX,
  getSignalingUrl,
  setSignalingUrl,
  saveActiveHostOffer,
  loadActiveHostOffer,
  clearActiveHostOffer,
} from './signalingConfig.js';

export {
  safeStorage,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  isPlainObject,
  booleanOrDefault,
  clampNumberOrDefault,
  stringOrDefault,
  filterArraySlice,
  createLocalStorageStore,
  type LocalStorageStore,
  type DriftwoodsTunerConfig,
  type DriftwoodsPreset,
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig,
  CAMERA_SETTINGS_STORAGE_KEY,
  DEFAULT_CAMERA_SETTINGS,
  CAMERA_RANGE_SETTINGS,
  CAMERA_RANGE_SETTINGS_MAP,
  MATERIALS_STORAGE_KEY,
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  themeSettingsStore,
  applyThemeToDocument,
  getTheme,
  setTheme,
  onThemeChange,
  getInitialTheme,
  DEFAULT_TRAINING_SETTINGS,
  DEFAULT_GRAPHICS_SETTINGS,
  TRAJECTORY_STORAGE_KEY,
  botSettingsStore,
  getInitialKickoffWsOffset,
  saveKickoffWsOffset,
  CAR_VISUAL_IDS,
  STORAGE_KEY_DISPLAY_SETTINGS,
  COLOR_PREFS_KEY,
  COLOR_SLOT_HEX_MAP,
  garageSettingsStore,
  getInitialCar,
  loadStoredPlayerName,
  saveStoredPlayerName,
  DEFAULT_SIGNALING_URL,
  SIGNALING_ROOM_PREFIX,
  getSignalingUrl,
  setSignalingUrl,
  saveActiveHostOffer,
  loadActiveHostOffer,
  clearActiveHostOffer,
};

export type ActiveMenuRoute =
  | 'main-menu'
  | 'play'
  | 'bot-difficulty'
  | 'self-training'
  | 'custom-training'
  | 'static-training-pack'
  | 'static-training-pack-session'
  | 'online-warmup'
  | 'room-host-control'
  | 'garage'
  | 'settings'
  | 'audio-eq'
  | 'trajectory'
  | 'camera'
  | 'training'
  | 'keybindings'
  | 'advanced-controller'
  | 'advanced-audio'
  | 'event-and-triggerer'
  | 'exp-multi-bots-config'
  | 'dev-sandboxes'
  | 'dev-active-tuners'
  | 'dev-calibrated-presets'
  | 'dev-under-development';

export const ROUTE_PARENT_MAP: Record<ActiveMenuRoute, ActiveMenuRoute | null> = {
  'main-menu': null,
  'play': 'main-menu',
  'bot-difficulty': 'play',
  'self-training': 'play',
  'custom-training': 'self-training',
  'static-training-pack': 'self-training',
  'static-training-pack-session': 'static-training-pack',
  'online-warmup': 'play',
  'room-host-control': 'main-menu',
  'garage': 'main-menu',
  'settings': 'main-menu',
  'audio-eq': 'settings',
  'trajectory': 'settings',
  'camera': 'settings',
  'training': 'settings',
  'keybindings': 'settings',
  'advanced-controller': 'keybindings',
  'advanced-audio': 'dev-active-tuners',
  'event-and-triggerer': 'settings',
  'exp-multi-bots-config': 'dev-sandboxes',
  'dev-sandboxes': 'settings',
  'dev-active-tuners': 'settings',
  'dev-calibrated-presets': 'settings',
  'dev-under-development': 'settings',
};

export type ContainerTransitionMode = 'fluid-morph' | 'sequenced-step';

export function calculateSettingsSafeScale(windowWidth: number, windowHeight: number, safeAreaMargin: number): number {
  const marginW = windowWidth * (safeAreaMargin / 100);
  const marginH = windowHeight * (safeAreaMargin / 100);
  const Wsafe = Math.max(100, windowWidth - marginW * 2);
  const Hsafe = Math.max(100, windowHeight - marginH * 2);
  const maxAllowedW = Math.max(100, Wsafe - 32);
  const maxAllowedH = Math.max(100, Hsafe - 32);
  return Math.max(50, Math.floor(Math.min(maxAllowedW / 680, maxAllowedH / 540) * 100));
}

export interface ViewportMetrics {
  scaleFactor: number;
  renderWidth: number;
  renderHeight: number;
  isPortrait: boolean;
  isPillarboxed: boolean;
  pillarboxWidth: number;
  safeMarginPct: number;
}

export interface CameraConfig {
  cameraShake: boolean;
  fov: number;
  distance: number;
  height: number;
  angleDeg: number;
  stiffness: number;
  swivelSpeed: number;
  transitionSpeed: number;
  invertSwivel: boolean;
}

export type MenuPowerSaveOption = 'freeze' | '15' | '30' | 'match';

export interface GraphicsConfig {
  renderScale: number;
  limitFps: boolean;
  maxFps: number;
  showStadium: boolean;
  pauseRenderingOnMenu: boolean;
  menuPowerSave: MenuPowerSaveOption;
}

export interface VisualMaterialsConfig {
  ballStyle: 'football' | 'rocket-league';
  carPaint: 'cartoon' | 'anodized';
  paintFinish?: 'matte' | 'metallic';
  demolishedEffect: 'toon' | 'smoke';
  boostVisual: 'cartoon' | 'gold-rush';
  boostFlameLuminance: 'balanced' | 'dynamic';
  boostPlumeLuminance: 'min' | 'balanced' | 'dynamic' | 'hdr';
}

export const DEFAULT_MATERIALS_CONFIG = DEFAULT_MATERIALS_CONFIG_RAW as VisualMaterialsConfig;
export const getMaterialsConfig = getMaterialsConfigRaw as () => VisualMaterialsConfig;
export const setMaterialsConfig = setMaterialsConfigRaw as (partial: Partial<VisualMaterialsConfig>, persist?: boolean) => void;
export const onMaterialsConfigChange = onMaterialsConfigChangeRaw as (listener: (config: VisualMaterialsConfig) => void) => () => void;
export const getInitialMaterials = getInitialMaterialsRaw as () => VisualMaterialsConfig;
export const getInitialCamera = getInitialCameraRaw as () => CameraConfig;
export const getInitialGraphics = getInitialGraphicsRaw as () => GraphicsConfig;

export interface StoredColorPrefs {
  primaryTeam: 'blue' | 'orange';
  blueOrder: number[];
  orangeOrder: number[];
}

export const loadStoredColorPrefs = loadStoredColorPrefsRaw as () => StoredColorPrefs;
export const getPreferredColorSlot = getPreferredColorSlotRaw as (prefs?: StoredColorPrefs) => number;
export const getPreferredColorHex = getPreferredColorHexRaw as (prefs?: StoredColorPrefs) => string;
export const saveStoredColorPrefs = saveStoredColorPrefsRaw as (nextPrefs: StoredColorPrefs) => number;

export interface AudioConfig {
  masterVolume: number;
  engineVolume: number;
  boostVolume: number;
  continueAudioOnLostFocus?: boolean;
  bassGain: number;
  midGain: number;
  trebleGain: number;
  hrtfEnabled: boolean;
}

export interface GameplayConfig {
  goalRestart: boolean;
  unlimitedBoost: boolean;
  showCarHitbox: boolean;
  ballCamIndicator: boolean;
}

export interface TrajectoryConfig {
  enabled: boolean;
  predictionTicks: number;
  solidTicks: number;
  transparentTicks: number;
  thickness: number;
  opacity: number;
  color: string;
  dynamicMode: boolean;
  duration?: number;
}

export const DEFAULT_TRAJECTORY_CONFIG = DEFAULT_TRAJECTORY_CONFIG_RAW as TrajectoryConfig;
export const loadSavedTrajectorySettings = loadSavedTrajectorySettingsRaw as () => TrajectoryConfig;
export const saveTrajectorySettings = saveTrajectorySettingsRaw as (settings: Partial<TrajectoryConfig>) => void;
export const getInitialTrajectory = getInitialTrajectoryRaw as () => TrajectoryConfig;

export interface BoostPadTunerConfig {
  bottomOpacity: number;
  topOpacity: number;
  midpoint: number;
  topCutoff?: number;
  power: number;
  glowIntensity: number;
  glowColor: string;
  coreColor: string;
  glowHeightOffsetBig?: number;
  glowHeightOffsetSmall?: number;
  orbRadius: number;
  orbHeightOffset: number;
  orbEmissiveIntensity: number;
  orbColor: string;
  topColor: string;
  topInactiveColor?: string;
  sideColor: string;
  sideFollowsBase: boolean;
  baseColor: string;
  baseRoughness?: number;
  baseMetalness?: number;
  sideRoughness?: number;
  sideMetalness?: number;
  topRoughness?: number;
  topMetalness?: number;
  padHeightOffset?: number;
  shadowEnabled: boolean;
  shadowRadius: number;
  shadowIntensity: number;
  shadowDistanceScale: number;
  refillEnabled: boolean;
  bigRefillThreshold: number;
  smallRefillThreshold: number;
  refillGlowColor?: string;
  refillGlowIntensity?: number;
  collectDuration: number;
  bezierP1X: number;
  bezierP1Y: number;
  bezierP2X: number;
  bezierP2Y: number;
  ballSquashFactor?: number;
  flashEnabled?: boolean;
  flashColor?: string;
  flashDuration?: number;
  flashMode?: 'on_demand' | 'consistent';
  orbCollectDuration: number;
  orbDropDistance: number;
  orbBezierP1X: number;
  orbBezierP1Y: number;
  orbBezierP2X: number;
  orbBezierP2Y: number;
  rotBigMid: number;
  rotBigCorner: number;
  rotSmallAxisY0: number;
  rotSmallAxisY1: number;
  rotSmallAxisY2: number;
  rotSmallAxisX0: number;
  rotSmallQuadA: number;
  rotSmallQuadB: number;
  rotSmallQuadC: number;
  rotSmallQuadD: number;
  rotSmallQuadE: number;
}

export const DEFAULT_BOOST_PAD_TUNER_CONFIG: BoostPadTunerConfig = {
  bottomOpacity: 0.08,
  topOpacity: 0,
  midpoint: 0.35,
  topCutoff: 0.35,
  power: 1,
  glowIntensity: 5,
  glowColor: '#d97e00',
  coreColor: '#ffe750',
  glowHeightOffsetBig: -0.01,
  glowHeightOffsetSmall: -0.05,
  orbRadius: 15,
  orbHeightOffset: 70,
  orbEmissiveIntensity: 5,
  orbColor: '#ffaa00',
  topColor: '#d2bb18',
  topInactiveColor: '#1c2026',
  sideColor: '#000000',
  sideFollowsBase: true,
  baseColor: '#888888',
  baseRoughness: 1,
  baseMetalness: 1,
  sideRoughness: 1,
  sideMetalness: 1,
  topRoughness: 1,
  topMetalness: 0,
  padHeightOffset: 7.5,
  shadowEnabled: true,
  shadowRadius: 10,
  shadowIntensity: 1,
  shadowDistanceScale: 0.012,
  refillEnabled: true,
  bigRefillThreshold: 3,
  smallRefillThreshold: 1,
  collectDuration: 300,
  bezierP1X: 0,
  bezierP1Y: -3,
  bezierP2X: 0,
  bezierP2Y: 1,
  orbCollectDuration: 200,
  orbDropDistance: 175,
  orbBezierP1X: 0,
  orbBezierP1Y: -1.15,
  orbBezierP2X: 0,
  orbBezierP2Y: 1,
  rotBigMid: -30,
  rotBigCorner: 15,
  rotSmallAxisY0: 0,
  rotSmallAxisY1: 0,
  rotSmallAxisY2: 60,
  rotSmallAxisX0: 30,
  rotSmallQuadA: 30,
  rotSmallQuadB: 30,
  rotSmallQuadC: -30,
  rotSmallQuadD: 30,
  rotSmallQuadE: 30,
};

export type TelemetryDisplayMode = 'off' | 'on_demand' | 'always';
export type ClockPacingMode = 'csts' | 'legacy';

export interface TelemetryConfig {
  alwaysShow: boolean;
  fpsMode: TelemetryDisplayMode;
  refreshRateMode: TelemetryDisplayMode;
  renderScaleMode: TelemetryDisplayMode;
  physicsRateMode: TelemetryDisplayMode;
  latencyMode: TelemetryDisplayMode;
}

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  alwaysShow: true,
  fpsMode: 'always',
  refreshRateMode: 'always',
  renderScaleMode: 'always',
  physicsRateMode: 'always',
  latencyMode: 'always',
};

export const getInitialMargin = (): number => {
  const val = safeStorage.get(STORAGE_KEYS.SAFE_AREA_MARGIN);
  if (val !== null) {
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) return Math.min(10, Math.max(-5, num));
  }
  return 0;
};

export const getInitialUiScale = (): number => {
  const val = safeStorage.get(STORAGE_KEYS.UI_SCALE);
  if (val !== null) {
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) return Math.min(200, Math.max(50, num));
  }
  return 100;
};

export const getInitialSafeAreaHud = (): boolean => {
  return safeStorage.get(STORAGE_KEYS.SAFE_AREA_VISIBLE) === 'true';
};

export const getInitialTelemetry = (): TelemetryConfig => {
  const raw = safeStorage.get(STORAGE_KEYS.TELEMETRY_SETTINGS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TELEMETRY_CONFIG, ...parsed };
    } catch (err) {
      console.warn('[uiConfig] Failed to parse stored telemetry settings JSON, resetting to defaults:', err);
    }
  }
  return { ...DEFAULT_TELEMETRY_CONFIG };
};

export const getInitialDeveloperMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1';
  } catch (err) {
    console.warn('[uiConfig] Failed to check developer mode URL params:', err);
    return false;
  }
};

export const getInitialBoostPadTuner = (): BoostPadTunerConfig => {
  const raw = safeStorage.get(STORAGE_KEYS.BOOST_PAD_TUNER);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.collectDuration !== undefined && parsed.collectDuration <= 1.0) {
        parsed.collectDuration = Math.round(parsed.collectDuration * 1000);
      }
      if (parsed.orbCollectDuration !== undefined && parsed.orbCollectDuration <= 1.0) {
        parsed.orbCollectDuration = Math.round(parsed.orbCollectDuration * 1000);
      }
      return { ...DEFAULT_BOOST_PAD_TUNER_CONFIG, ...parsed };
    } catch (err) {
      console.warn('[uiConfig] Failed to parse stored boost pad tuner JSON:', err);
    }
  }
  return { ...DEFAULT_BOOST_PAD_TUNER_CONFIG };
};

export const getInitialDriftwoodsTuner = (): DriftwoodsTunerConfig => {
  const raw = safeStorage.get(STORAGE_KEYS.DRIFTWOODS_TUNER);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return mergeDriftwoodsConfig(DEFAULT_DRIFTWOODS_CONFIG, parsed);
    } catch (err) {
      console.warn('[uiConfig] Failed to parse stored driftwoods tuner JSON:', err);
    }
  }
  return cloneDriftwoodsConfig(DEFAULT_DRIFTWOODS_CONFIG);
};

export const getInitialInputBufferTarget = (): number => {
  const raw = safeStorage.get(STORAGE_KEYS.INPUT_BUFFER_TARGET);
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
      return parsed;
    }
  }
  return 3;
};

export const getInitialInputBufferThreshold = (): [number, number] => {
  const alpha = getInitialInputBufferTarget();
  const raw = safeStorage.get(STORAGE_KEYS.INPUT_BUFFER_THRESHOLD);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 2) {
        const rawCatchup = Number(parsed[0]);
        const rawSkip = Number(parsed[1]);
        if (Number.isFinite(rawCatchup) && Number.isFinite(rawSkip)) {
          const catchup = Math.max(-alpha, Math.min(0, Math.round(rawCatchup)));
          const skip = Math.min(alpha, Math.max(0, Math.round(rawSkip)));
          return [catchup || 0, skip || 0];
        }
      }
    } catch (err) {
      console.warn('[uiConfig] Failed to parse stored input buffer threshold JSON:', err);
    }
  }
  return [Math.max(-alpha, -2), Math.min(alpha, 2)];
};

export const getInitialFloatingOpacity = (): number => {
  const raw = safeStorage.get(STORAGE_KEYS.FLOATING_OPACITY);
  if (raw !== null) {
    const num = parseInt(valOrString(raw), 10);
    if (!Number.isNaN(num)) return Math.min(100, Math.max(1, num));
  }
  return 75;
};

function valOrString(v: string): string { return v; }

export const saveFloatingOpacity = (opacity: number): void => {
  const clamped = Math.min(100, Math.max(1, Math.round(opacity)));
  safeStorage.set(STORAGE_KEYS.FLOATING_OPACITY, String(clamped));
};
