/**
 * src/config/trainingDefaults.js
 * Default settings for offline freeplay, training modes, trajectory prediction, and graphics.
 */

import { safeStorage, createLocalStorageStore, stringOrDefault, STORAGE_KEYS } from './storageHelpers.ts';

export const DEFAULT_TRAINING_SETTINGS = Object.freeze({
  disableGoalReset: false,
  boostOption: 'unlimited',
  showCarHitbox: true,
});

export const DEFAULT_GRAPHICS_SETTINGS = Object.freeze({
  showStadium: true,
  limitFps: true,
  maxFps: 120,
  renderScale: 50,
});

export const TRAJECTORY_STORAGE_KEY = STORAGE_KEYS.TRAJECTORY;

export const DEFAULT_TRAJECTORY_CONFIG = {
  enabled: true,
  predictionTicks: 600,
  solidTicks: 50,
  transparentTicks: 20,
  thickness: 10,
  opacity: 0.5,
  color: '#000000',
  dynamicMode: true,
  duration: 5.0,
};

export function loadSavedTrajectorySettings() {
  const raw = safeStorage.get(TRAJECTORY_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_TRAJECTORY_CONFIG.enabled,
        predictionTicks: Math.min(600, Math.max(60, Number(parsed.predictionTicks) || DEFAULT_TRAJECTORY_CONFIG.predictionTicks)),
        solidTicks: Math.min(240, Math.max(5, Number(parsed.solidTicks) || DEFAULT_TRAJECTORY_CONFIG.solidTicks)),
        transparentTicks: Math.min(240, Math.max(5, Number(parsed.transparentTicks) || DEFAULT_TRAJECTORY_CONFIG.transparentTicks)),
        thickness: Math.min(75, Math.max(1, Number(parsed.thickness) || DEFAULT_TRAJECTORY_CONFIG.thickness)),
        opacity: Math.min(1.0, Math.max(0.05, Number(parsed.opacity) || DEFAULT_TRAJECTORY_CONFIG.opacity)),
        color: typeof parsed.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.color) ? parsed.color : DEFAULT_TRAJECTORY_CONFIG.color,
        dynamicMode: typeof parsed.dynamicMode === 'boolean' ? parsed.dynamicMode : DEFAULT_TRAJECTORY_CONFIG.dynamicMode,
      };
    } catch (err) {
      console.warn('[trainingDefaults] Failed to load trajectory settings:', err);
    }
  }
  return { ...DEFAULT_TRAJECTORY_CONFIG };
}

export function saveTrajectorySettings(settings) {
  safeStorage.set(TRAJECTORY_STORAGE_KEY, JSON.stringify(settings));
}

export function getInitialTrajectory() {
  const raw = safeStorage.get(TRAJECTORY_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_TRAJECTORY_CONFIG,
        ...parsed,
        duration: parsed.predictionTicks
          ? Number((parsed.predictionTicks / 120).toFixed(1))
          : DEFAULT_TRAJECTORY_CONFIG.duration,
      };
    } catch (err) {
      console.warn('[trainingDefaults] Failed to parse stored trajectory settings JSON, resetting to defaults:', err);
    }
  }
  return { ...DEFAULT_TRAJECTORY_CONFIG };
}

export function getInitialGraphics() {
  const raw = safeStorage.get(STORAGE_KEYS.GRAPHICS_SETTINGS);
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
      console.warn('[trainingDefaults] Failed to parse stored graphics settings JSON, resetting to defaults:', err);
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
}

export const botSettingsStore = createLocalStorageStore(
  STORAGE_KEYS.BOT_SETTINGS,
  () => ({ botId: 'nexto' }),
  (target, source) => {
    target.botId = stringOrDefault(source.botId, ['seer', 'necto', 'nexto'], target.botId);
  }
);

export function getInitialKickoffWsOffset() {
  const raw = safeStorage.get(STORAGE_KEYS.KICKOFF_WS_OFFSET_PCT);
  if (raw !== null) {
    const val = Number(raw);
    if (Number.isFinite(val)) {
      return Math.max(0, Math.min(50, Math.round(val)));
    }
  }
  return 10;
}

export function saveKickoffWsOffset(offsetPct) {
  const clamped = Math.max(0, Math.min(50, Math.round(offsetPct)));
  safeStorage.set(STORAGE_KEYS.KICKOFF_WS_OFFSET_PCT, String(clamped));
}

export const KICKOFF_SPAWNS = [
  { index: 0, key: '1', id: 'left-front',  label: '1 · Left Diagonal',  shortLabel: 'LF', x: -2048.0, y: -2560.0 },
  { index: 1, key: '2', id: 'left-back',   label: '2 · Left Back',      shortLabel: 'LB', x: -256.0,  y: -3840.0 },
  { index: 2, key: '3', id: 'center-back', label: '3 · Center Back',    shortLabel: 'CB', x: 0.0,     y: -4608.0 },
  { index: 3, key: '4', id: 'right-back',  label: '4 · Right Back',     shortLabel: 'RB', x: 256.0,   y: -3840.0 },
  { index: 4, key: '5', id: 'right-front', label: '5 · Right Diagonal', shortLabel: 'RF', x: 2048.0,  y: -2560.0 },
];
