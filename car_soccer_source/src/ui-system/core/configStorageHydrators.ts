/**
 * configStorageHydrators.ts
 * Single centralized persistence and hydration gateway for all LocalStorage operations
 * across the entire Car Soccer application.
 */

import {
  type DriftwoodsTunerConfig,
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig,
} from './driftwoodsConfig.ts';
import {
  type CameraConfig,
  type TrajectoryConfig,
  type GraphicsConfig,
  type VisualMaterialsConfig,
  type TelemetryConfig,
  type BoostPadTunerConfig,
  type StoredColorPrefs,
  DEFAULT_CAMERA_SETTINGS,
  DEFAULT_MATERIALS_CONFIG,
  MATERIALS_STORAGE_KEY,
  DEFAULT_TRAJECTORY_CONFIG,
  TRAJECTORY_STORAGE_KEY,
  DEFAULT_BOOST_PAD_TUNER_CONFIG,
  DEFAULT_TELEMETRY_CONFIG,
  STORAGE_KEY_DISPLAY_SETTINGS,
  CAR_VISUAL_IDS,
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  DEFAULT_SIGNALING_URL,
  COLOR_PREFS_KEY,
  LEGACY_PREFERRED_COLOR_KEY,
  COLOR_SLOT_HEX_MAP,
} from './configTypes.ts';

export {
  STORAGE_KEY_DISPLAY_SETTINGS,
  MATERIALS_STORAGE_KEY,
  TRAJECTORY_STORAGE_KEY,
  THEME_STORAGE_KEY,
  COLOR_PREFS_KEY,
  LEGACY_PREFERRED_COLOR_KEY,
  COLOR_SLOT_HEX_MAP,
};

export const safeStorage = {
  get: (k: string, fallback: string | null = null): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? fallback : fallback;
    } catch (err) {
      console.warn(`[store:safeStorage] Error reading key "${k}" from localStorage:`, err);
      return fallback;
    }
  },
  getItem: (k: string, fallback: string | null = null): string | null => {
    return safeStorage.get(k, fallback);
  },
  set: (k: string, v: unknown): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, String(v));
    } catch (err) {
      console.warn(`[store:safeStorage] Error writing key "${k}" to localStorage:`, err);
    }
  },
  setItem: (k: string, v: unknown): void => {
    safeStorage.set(k, v);
  },
  remove: (k: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    } catch (err) {
      console.warn(`[store:safeStorage] Error removing key "${k}" from localStorage:`, err);
    }
  },
  removeItem: (k: string): void => {
    safeStorage.remove(k);
  },
};

export function safeLocalStorageGet(key: string): string | null {
  return safeStorage.get(key, null);
}

export function safeLocalStorageSet(key: string, value: string): void {
  safeStorage.set(key, value);
}

export function safeLocalStorageRemove(key: string): void {
  safeStorage.remove(key);
}

export function isPlainObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function booleanOrDefault(val: unknown, fallback: boolean): boolean {
  if (typeof val !== 'boolean' && val !== undefined && val !== null) {
    console.warn('[configStorageHydrators] Non-boolean value in booleanOrDefault, falling back:', { val, fallback });
  }
  return typeof val === 'boolean' ? val : fallback;
}

export function clampNumberOrDefault(
  val: unknown,
  fallback: number,
  constraints: { min?: number; max?: number; integer?: boolean } = {}
): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    if (val !== undefined && val !== null) {
      console.warn('[configStorageHydrators] Non-finite number in clampNumberOrDefault, falling back:', { val, fallback });
    }
    return fallback;
  }
  let num = val;
  if (constraints.integer) num = Math.round(num);
  if (constraints.min !== undefined) num = Math.max(constraints.min, num);
  if (constraints.max !== undefined) num = Math.min(constraints.max, num);
  return num;
}

export function stringOrDefault(val: unknown, allowed: readonly string[] | Set<string>, fallback: string): string {
  if (typeof val === 'string') {
    if (Array.isArray(allowed) && allowed.includes(val)) return val;
    if (allowed instanceof Set && allowed.has(val)) return val;
  }
  if (val !== undefined && val !== null) {
    console.warn('[configStorageHydrators] Disallowed string in stringOrDefault, falling back:', { val, fallback });
  }
  return fallback;
}

export function filterArraySlice<T>(val: unknown, filterFn: (item: any) => boolean, maxLen: number): T[] | null {
  return Array.isArray(val) ? (val.filter(filterFn).slice(0, maxLen) as T[]) : null;
}

export interface LocalStorageStore<T> {
  key: string;
  defaults: () => T;
  load: () => T;
  get: () => T;
  loadInto: (target: T) => T;
  save: (data: T) => void;
  clear: () => void;
}

export function createLocalStorageStore<T extends Record<string, any>>(
  key: string,
  defaultFactory: () => T,
  migrateFn?: (target: T, loaded: any) => void
): LocalStorageStore<T> {
  const load = (): T => {
    const defaults = defaultFactory();
    const raw = safeStorage.get(key);
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw);
      if (isPlainObject(parsed)) {
        if (migrateFn) {
          migrateFn(defaults, parsed);
        } else {
          Object.assign(defaults, parsed);
        }
        return defaults;
      }
      return defaultFactory();
    } catch (err) {
      console.warn(`[configStorageHydrators] Corrupted stored settings for key "${key}", using defaults:`, err);
      return defaultFactory();
    }
  };

  return {
    key,
    defaults: defaultFactory,
    load,
    get: load,
    loadInto(target: T) {
      return Object.assign(target, load());
    },
    save(data: T) {
      try {
        safeStorage.set(key, JSON.stringify(data));
      } catch (err) {
        console.warn(`[configStorageHydrators] Failed to stringify settings for key "${key}":`, err);
      }
    },
    clear() {
      safeStorage.remove(key);
    },
  };
}

// --- Centralized Subsystem Storage Stores ---

export const garageSettingsStore = createLocalStorageStore<{ vehiclePreset: string; carVisual?: string }>(
  STORAGE_KEY_DISPLAY_SETTINGS,
  () => ({ vehiclePreset: 'game-car' }),
  (target, stored) => {
    target.vehiclePreset = stringOrDefault(
      stored.vehiclePreset || stored.carVisual,
      CAR_VISUAL_IDS,
      target.vehiclePreset
    );
    target.carVisual = target.vehiclePreset;
  }
);

export const botSettingsStore = createLocalStorageStore<{ botId: string }>(
  'car-soccer.bot-settings.v1',
  () => ({ botId: 'nexto' }),
  (target, source) => {
    target.botId = stringOrDefault(source.botId, ['seer', 'necto', 'nexto'], target.botId);
  }
);

export const themeSettingsStore = createLocalStorageStore<{ theme: string }>(
  THEME_STORAGE_KEY,
  () => ({ theme: DEFAULT_THEME }),
  (target, source) => {
    target.theme = stringOrDefault(source.theme, THEMES, target.theme);
  }
);

let activeGameTheme = themeSettingsStore.load().theme;
const gameThemeListeners = new Set<(theme: string) => void>();

export function applyThemeToDocument(): void {
  if (typeof document !== 'undefined' && document.documentElement?.dataset) {
    document.documentElement.dataset.theme = activeGameTheme;
  }
}

export function getTheme(): string {
  return activeGameTheme;
}

export function setTheme(theme: string, options: { persist?: boolean } = {}): void {
  if (!THEMES.includes(theme)) return;
  const changed = theme !== activeGameTheme;
  activeGameTheme = theme;
  applyThemeToDocument();
  if (options.persist !== false) {
    themeSettingsStore.save({ theme });
  }
  if (changed) {
    for (const listener of gameThemeListeners) {
      try {
        listener(theme);
      } catch (err) {
        console.error('[ThemeConfig] listener threw error:', err);
      }
    }
  }
}

export function onThemeChange(callback: (theme: string) => void): () => void {
  gameThemeListeners.add(callback);
  try {
    callback(activeGameTheme);
  } catch (err) {
    console.error('[ThemeConfig] callback threw error:', err);
  }
  return () => {
    gameThemeListeners.delete(callback);
  };
}

let activeMaterials: VisualMaterialsConfig = (() => {
  const raw = safeStorage.get(MATERIALS_STORAGE_KEY);
  if (raw) {
    try {
      return { ...DEFAULT_MATERIALS_CONFIG, ...JSON.parse(raw) };
    } catch (err) {
      console.warn('[configStorageHydrators] Failed to parse stored materials config:', err);
    }
  }
  return { ...DEFAULT_MATERIALS_CONFIG };
})();

const materialsListeners = new Set<(config: VisualMaterialsConfig) => void>();

export function getMaterialsConfig(): VisualMaterialsConfig {
  return activeMaterials;
}

export function setMaterialsConfig(partialConfig: Partial<VisualMaterialsConfig>, persist = true): void {
  activeMaterials = { ...activeMaterials, ...partialConfig };
  if (persist) {
    safeStorage.set(MATERIALS_STORAGE_KEY, JSON.stringify(activeMaterials));
  }
  for (const listener of materialsListeners) {
    try {
      listener(activeMaterials);
    } catch (err) {
      console.error('[configStorageHydrators] materialsConfig listener error:', err);
    }
  }
}

export function onMaterialsConfigChange(listener: (config: VisualMaterialsConfig) => void): () => void {
  materialsListeners.add(listener);
  return () => materialsListeners.delete(listener);
}

// --- Unified Color Preferences & Player Name Persistence ---

export function loadStoredColorPrefs(): StoredColorPrefs {
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
    const legacySlot =
      safeStorage.get(LEGACY_PREFERRED_COLOR_KEY) ?? safeStorage.get('car_soccer_preferred_color_slot');
    if (legacySlot !== null) {
      const slot = Number(legacySlot);
      if ([2, 4, 0].includes(slot)) {
        const rest = [2, 4, 0].filter((s) => s !== slot);
        return { primaryTeam: 'orange', blueOrder: [1, 5, 3], orangeOrder: [slot, ...rest] };
      } else if ([1, 5, 3].includes(slot)) {
        const rest = [1, 5, 3].filter((s) => s !== slot);
        return { primaryTeam: 'blue', blueOrder: [slot, ...rest], orangeOrder: [2, 4, 0] };
      }
    }
  } catch (err) {
    console.warn('[configStorageHydrators] Failed to load stored color preferences:', err);
  }
  return {
    primaryTeam: 'orange',
    orangeOrder: [2, 4, 0],
    blueOrder: [1, 5, 3],
  };
}

export function getPreferredColorSlot(prefs?: StoredColorPrefs): number {
  const effective = prefs ?? loadStoredColorPrefs();
  const slot = effective.primaryTeam === 'blue' ? effective.blueOrder?.[0] : effective.orangeOrder?.[0];
  return typeof slot === 'number' && COLOR_SLOT_HEX_MAP[slot] !== undefined ? slot : 2;
}

export function getPreferredColorHex(prefs?: StoredColorPrefs): string {
  const slot = getPreferredColorSlot(prefs);
  return COLOR_SLOT_HEX_MAP[slot] || '#ffc107';
}

export function saveStoredColorPrefs(nextPrefs: StoredColorPrefs): number {
  const activeSlotId = getPreferredColorSlot(nextPrefs);
  safeStorage.set(COLOR_PREFS_KEY, JSON.stringify(nextPrefs));
  safeStorage.set(LEGACY_PREFERRED_COLOR_KEY, String(activeSlotId));
  return activeSlotId;
}

export function loadStoredPlayerName(fallback?: string): string {
  const saved = safeStorage.get('car-soccer:player-name') ?? safeStorage.get('car_soccer_player_name');
  if (saved && saved.trim()) {
    return saved.trim().substring(0, 24);
  }
  return fallback ?? `Striker-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function saveStoredPlayerName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) {
    safeStorage.set('car-soccer:player-name', trimmed);
  }
}

// --- Signaling URL & Active Host Offer Persistence ---

let _memorySignalingUrl: string | null = null;

export function getSignalingUrl(): string {
  const custom = safeStorage.get('car_soccer_signaling_url');
  if (custom && custom.trim()) {
    return custom.trim();
  }
  return _memorySignalingUrl || DEFAULT_SIGNALING_URL;
}

export function setSignalingUrl(url: string | null): void {
  const clean = url && typeof url === 'string' && url.trim() ? url.trim() : null;
  _memorySignalingUrl = clean;
  if (clean) {
    safeStorage.set('car_soccer_signaling_url', clean);
  } else {
    safeStorage.remove('car_soccer_signaling_url');
  }
}

export function saveActiveHostOffer(offerInfo: { roomId: string; token: string; timestamp?: number }): void {
  safeStorage.set(
    'car_soccer_active_host',
    JSON.stringify({
      ...offerInfo,
      timestamp: offerInfo.timestamp ?? Date.now(),
    })
  );
}

export function loadActiveHostOffer(): { roomId?: string; token?: string; timestamp?: number } | null {
  const raw = safeStorage.get('car_soccer_active_host');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[configStorageHydrators] Failed to parse active host offer:', err);
    return null;
  }
}

export function clearActiveHostOffer(): void {
  safeStorage.remove('car_soccer_active_host');
}

// --- Trajectory Persistence ---

export function loadSavedTrajectorySettings(): TrajectoryConfig {
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
      console.warn('[configStorageHydrators] Failed to load trajectory settings:', err);
    }
  }
  return { ...DEFAULT_TRAJECTORY_CONFIG };
}

export function saveTrajectorySettings(settings: Partial<TrajectoryConfig>): void {
  safeStorage.set(TRAJECTORY_STORAGE_KEY, JSON.stringify(settings));
}

// --- UI Store Hydrators ---

export const getInitialCar = (): string => {
  return garageSettingsStore.load().vehiclePreset || 'game-car';
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
  const raw =
    safeStorage.get('car_soccer_ball_trajectory_config_v3') ||
    safeStorage.get('car_soccer_ball_trajectory_config_v2');
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
      console.warn('[store] Failed to parse stored trajectory settings JSON, resetting to defaults:', err);
    }
  }
  return { ...DEFAULT_TRAJECTORY_CONFIG };
};

export const getInitialGraphics = (): GraphicsConfig => {
  const raw =
    safeStorage.get('car-soccer.graphics-settings.v2') ||
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
  return getMaterialsConfig() || { ...DEFAULT_MATERIALS_CONFIG };
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

export const getInitialFloatingOpacity = (): number => {
  const raw = safeStorage.get('car-soccer.floating-window-opacity.v1');
  if (raw !== null) {
    const num = parseInt(raw, 10);
    if (!Number.isNaN(num)) return Math.min(100, Math.max(1, num));
  }
  return 30;
};

export const saveFloatingOpacity = (opacity: number): void => {
  const clamped = Math.min(100, Math.max(1, Math.round(opacity)));
  safeStorage.set('car-soccer.floating-window-opacity.v1', String(clamped));
};

export const getInitialKickoffWsOffset = (): number => {
  const raw = safeStorage.get('car-soccer.kickoff-ws-offset-pct.v1');
  if (raw !== null) {
    const val = Number(raw);
    if (Number.isFinite(val)) {
      return Math.max(0, Math.min(50, Math.round(val)));
    }
  }
  return 10;
};

export const saveKickoffWsOffset = (offsetPct: number): void => {
  const clamped = Math.max(0, Math.min(50, Math.round(offsetPct)));
  safeStorage.set('car-soccer.kickoff-ws-offset-pct.v1', String(clamped));
};
