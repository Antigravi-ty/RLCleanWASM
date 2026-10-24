import { safeLocalStorageGet, safeLocalStorageSet } from './storageHelpers';

export interface NameTagConfig {
  enabled: boolean;
  pillWidth: number;
  pillHeight: number;
  borderWidth: number;
  fontSize: number;
  maxChars: number;
  opacity: number;
  bgOpacity: number;
  verticalOffsetUu: number;
  cameraScaleFactor: number;
  blueBgColor: string;
  blueBorderColor: string;
  blueTextColor: string;
  orangeBgColor: string;
  orangeBorderColor: string;
  orangeTextColor: string;
  showOnLocalCar: boolean;
  previewNames: string[];
}

export interface NameTagCarEntry {
  carIndex: number;
  name: string;
  team: 0 | 1;
}

export interface NameTagRuntimeState {
  isTunerArenaActive: boolean;
  isMultiplayerOrMultiCarMode: boolean;
  kickoffPermutationIndex: number;
  carEntries: NameTagCarEntry[];
  onEnterTunerArena: (() => void) | null;
  onExitTunerArena: (() => void) | null;
  onReshuffleKickoffPositions: (() => void) | null;
}

const STORAGE_KEY = 'rc_name_tag_config_v1';

export const DEFAULT_NAME_TAG_CONFIG: NameTagConfig = {
  enabled: true,
  pillWidth: 240,
  pillHeight: 54,
  borderWidth: 3.5,
  fontSize: 25,
  maxChars: 16,
  opacity: 0.94,
  bgOpacity: 0.86,
  verticalOffsetUu: 88,
  cameraScaleFactor: 0.11,
  blueBgColor: '#0c2d48',
  blueBorderColor: '#38bdf8',
  blueTextColor: '#f0f9ff',
  orangeBgColor: '#431407',
  orangeBorderColor: '#fb923c',
  orangeTextColor: '#fff7ed',
  showOnLocalCar: false,
  previewNames: [
    'AlphaStriker',
    'QuantumApex',
    'CyberneticOctane_RL',
    'BlazeVortex',
    'HyperNova_99',
    'ShadowFennecPro',
  ],
};

function sanitizeConfig(raw: Partial<NameTagConfig> | null | undefined): NameTagConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const previewNames = Array.isArray(src.previewNames) && src.previewNames.length === 6
    ? src.previewNames.map((n, idx) => String(n || DEFAULT_NAME_TAG_CONFIG.previewNames[idx]))
    : [...DEFAULT_NAME_TAG_CONFIG.previewNames];

  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_NAME_TAG_CONFIG.enabled,
    pillWidth: Math.max(100, Math.min(460, Number(src.pillWidth) || DEFAULT_NAME_TAG_CONFIG.pillWidth)),
    pillHeight: Math.max(28, Math.min(120, Number(src.pillHeight) || DEFAULT_NAME_TAG_CONFIG.pillHeight)),
    borderWidth: Math.max(0, Math.min(12, Number.isFinite(Number(src.borderWidth)) ? Number(src.borderWidth) : DEFAULT_NAME_TAG_CONFIG.borderWidth)),
    fontSize: Math.max(12, Math.min(48, Number(src.fontSize) || DEFAULT_NAME_TAG_CONFIG.fontSize)),
    maxChars: Math.max(4, Math.min(32, Math.round(Number(src.maxChars) || DEFAULT_NAME_TAG_CONFIG.maxChars))),
    opacity: Math.max(0.1, Math.min(1.0, Number.isFinite(Number(src.opacity)) ? Number(src.opacity) : DEFAULT_NAME_TAG_CONFIG.opacity)),
    bgOpacity: Math.max(0.0, Math.min(1.0, Number.isFinite(Number(src.bgOpacity)) ? Number(src.bgOpacity) : DEFAULT_NAME_TAG_CONFIG.bgOpacity)),
    verticalOffsetUu: Math.max(30, Math.min(240, Number(src.verticalOffsetUu) || DEFAULT_NAME_TAG_CONFIG.verticalOffsetUu)),
    cameraScaleFactor: Math.max(0.04, Math.min(0.3, Number(src.cameraScaleFactor) || DEFAULT_NAME_TAG_CONFIG.cameraScaleFactor)),
    blueBgColor: typeof src.blueBgColor === 'string' && src.blueBgColor.startsWith('#') ? src.blueBgColor : DEFAULT_NAME_TAG_CONFIG.blueBgColor,
    blueBorderColor: typeof src.blueBorderColor === 'string' && src.blueBorderColor.startsWith('#') ? src.blueBorderColor : DEFAULT_NAME_TAG_CONFIG.blueBorderColor,
    blueTextColor: typeof src.blueTextColor === 'string' && src.blueTextColor.startsWith('#') ? src.blueTextColor : DEFAULT_NAME_TAG_CONFIG.blueTextColor,
    orangeBgColor: typeof src.orangeBgColor === 'string' && src.orangeBgColor.startsWith('#') ? src.orangeBgColor : DEFAULT_NAME_TAG_CONFIG.orangeBgColor,
    orangeBorderColor: typeof src.orangeBorderColor === 'string' && src.orangeBorderColor.startsWith('#') ? src.orangeBorderColor : DEFAULT_NAME_TAG_CONFIG.orangeBorderColor,
    orangeTextColor: typeof src.orangeTextColor === 'string' && src.orangeTextColor.startsWith('#') ? src.orangeTextColor : DEFAULT_NAME_TAG_CONFIG.orangeTextColor,
    showOnLocalCar: typeof src.showOnLocalCar === 'boolean' ? src.showOnLocalCar : DEFAULT_NAME_TAG_CONFIG.showOnLocalCar,
    previewNames,
  };
}

let currentConfig: NameTagConfig = (() => {
  try {
    const raw = safeLocalStorageGet(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NAME_TAG_CONFIG, previewNames: [...DEFAULT_NAME_TAG_CONFIG.previewNames] };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return sanitizeConfig(parsed);
  } catch {
    return { ...DEFAULT_NAME_TAG_CONFIG, previewNames: [...DEFAULT_NAME_TAG_CONFIG.previewNames] };
  }
})();

let runtimeState: NameTagRuntimeState = {
  isTunerArenaActive: false,
  isMultiplayerOrMultiCarMode: false,
  kickoffPermutationIndex: 0,
  carEntries: [],
  onEnterTunerArena: null,
  onExitTunerArena: null,
  onReshuffleKickoffPositions: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // Ignore listener errors
    }
  }
}

export function getNameTagConfig(): NameTagConfig {
  return currentConfig;
}

export function updateNameTagConfig(patch: Partial<NameTagConfig>): NameTagConfig {
  currentConfig = sanitizeConfig({ ...currentConfig, ...patch });
  try {
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(currentConfig));
  } catch {
    // Ignore storage errors
  }
  notifyListeners();
  return currentConfig;
}

export function resetNameTagConfig(): NameTagConfig {
  currentConfig = sanitizeConfig(DEFAULT_NAME_TAG_CONFIG);
  try {
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(currentConfig));
  } catch {
    // Ignore storage errors
  }
  notifyListeners();
  return currentConfig;
}

export function getNameTagRuntimeState(): NameTagRuntimeState {
  return runtimeState;
}

export function setNameTagRuntimeState(patch: Partial<NameTagRuntimeState>): NameTagRuntimeState {
  runtimeState = { ...runtimeState, ...patch };
  notifyListeners();
  return runtimeState;
}

export function subscribeNameTagConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
