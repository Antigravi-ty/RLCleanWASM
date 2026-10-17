import { DEFAULT_CAMERA_SETTINGS } from '../../config/cameraDefaults.js';
import {
  type DriftwoodsTunerConfig,
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig
} from '../../entities/stadium/driftwoods/DriftwoodsConfigurator';
import { getMaterialsConfig } from '../../config/materialsConfig.js';
import {
  type CameraConfig,
  type TrajectoryConfig,
  type GraphicsConfig,
  type VisualMaterialsConfig,
  type TelemetryConfig,
  type BoostPadTunerConfig,
  DEFAULT_MATERIALS_CONFIG,
  DEFAULT_TRAJECTORY_CONFIG,
  DEFAULT_BOOST_PAD_TUNER_CONFIG,
  DEFAULT_TELEMETRY_CONFIG
} from './configTypes';

export const safeStorage = {
  get: (k: string, fallback: string | null = null): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? fallback : fallback;
    } catch (err) {
      console.warn(`[store:safeStorage] Error reading key "${k}" from localStorage:`, err);
      return fallback;
    }
  },
  set: (k: string, v: unknown): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, String(v));
    } catch (err) {
      console.warn(`[store:safeStorage] Error writing key "${k}" to localStorage:`, err);
    }
  }
};

export const getInitialCar = (): string => {
  const raw = safeStorage.get('car-soccer.display-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.vehiclePreset) return parsed.vehiclePreset;
      if (parsed?.carVisual) return parsed.carVisual;
    } catch (err) {
      console.warn('[store] Failed to parse stored display settings JSON, resetting to default car:', err);
    }
  }
  return 'game-car';
};

export const getInitialMargin = (): number => {
  const val = safeStorage.get('simpleui-safe-area-margin');
  if (val !== null) {
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) return Math.min(10, Math.max(-5, num));
  }
  return 0;
};

export const getInitialUiScale = (): number => {
  const val = safeStorage.get('car-soccer.ui-scale.v1');
  if (val !== null) {
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) return Math.min(200, Math.max(50, num));
  }
  return 100;
};

export const getInitialSafeAreaHud = (): boolean => {
  return safeStorage.get('simpleui-safe-area-visible') === 'true';
};

export const getInitialTheme = (): 'dark' | 'light' => {
  const saved = safeStorage.get('car-soccer.ui-theme.v1');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
};

export const getInitialCamera = (): CameraConfig => {
  const raw = safeStorage.get('car-soccer.camera-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CAMERA_SETTINGS, ...parsed };
    } catch (err) {
      console.warn('[store] Failed to parse stored camera settings JSON, resetting to defaults:', err);
    }
  }
  return { ...DEFAULT_CAMERA_SETTINGS };
};

export const getInitialTrajectory = (): TrajectoryConfig => {
  const raw = safeStorage.get('car_soccer_ball_trajectory_config_v3') ||
              safeStorage.get('car_soccer_ball_trajectory_config_v2');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_TRAJECTORY_CONFIG,
        ...parsed,
        duration: parsed.predictionTicks ? Number((parsed.predictionTicks / 120).toFixed(1)) : DEFAULT_TRAJECTORY_CONFIG.duration
      };
    } catch (err) {
      console.warn('[store] Failed to parse stored trajectory settings JSON, resetting to defaults:', err);
    }
  }
  return { ...DEFAULT_TRAJECTORY_CONFIG };
};

export const getInitialGraphics = (): GraphicsConfig => {
  const raw = safeStorage.get('car-soccer.graphics-settings.v2') ||
              safeStorage.get('car-soccer.graphics-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        renderScale: parsed.renderScale ?? 50,
        limitFps: parsed.limitFps ?? true,
        maxFps: Math.max(15, Math.min(240, parsed.maxFps ?? 120)),
        showStadium: parsed.showStadium ?? true,
        pauseRenderingOnMenu: parsed.pauseRenderingOnMenu ?? true,
        menuPowerSave: parsed.menuPowerSave ?? (parsed.pauseRenderingOnMenu ? 'freeze' : '30'),
      };
    } catch (err) {
      console.warn('[store] Failed to parse stored graphics settings JSON, resetting to defaults:', err);
    }
  }
  return {
    renderScale: 50,
    limitFps: true,
    maxFps: 120,
    showStadium: true,
    pauseRenderingOnMenu: true,
    menuPowerSave: '30',
  };
};

export const getInitialMaterials = (): VisualMaterialsConfig => {
  return (getMaterialsConfig() as VisualMaterialsConfig) || { ...DEFAULT_MATERIALS_CONFIG };
};

export const getInitialTelemetry = (): TelemetryConfig => {
  const raw = safeStorage.get('car-soccer.telemetry-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TELEMETRY_CONFIG, ...parsed };
    } catch (err) {
      console.warn('[store] Failed to parse stored telemetry settings JSON, resetting to defaults:', err);
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
    console.warn('[store] Failed to check developer mode URL params:', err);
    return false;
  }
};

export const getInitialBoostPadTuner = (): BoostPadTunerConfig => {
  const raw = safeStorage.get('car-soccer.boost-pad-tuner.v1');
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
      console.warn('[store] Failed to parse stored boost pad tuner JSON:', err);
    }
  }
  return { ...DEFAULT_BOOST_PAD_TUNER_CONFIG };
};

export const getInitialDriftwoodsTuner = (): DriftwoodsTunerConfig => {
  const raw = safeStorage.get('car-soccer.driftwoods-tuner.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return mergeDriftwoodsConfig(DEFAULT_DRIFTWOODS_CONFIG, parsed);
    } catch (err) {
      console.warn('[store] Failed to parse stored driftwoods tuner JSON:', err);
    }
  }
  return cloneDriftwoodsConfig(DEFAULT_DRIFTWOODS_CONFIG);
};

export const getInitialInputBufferTarget = (): number => {
  const raw = safeStorage.get('car-soccer.input-buffer-target.v1');
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
  const raw = safeStorage.get('car-soccer.input-buffer-threshold.v1');
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
      console.warn('[store] Failed to parse stored input buffer threshold JSON:', err);
    }
  }
  return [Math.max(-alpha, -2), Math.min(alpha, 2)];
};
