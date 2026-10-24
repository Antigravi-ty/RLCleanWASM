import { safeStorage } from './storageHelpers.ts';
import {
  CONSOLE_LOG_EVENT_CATALOG,
  BOOST_AUDIO_VARIATIONS,
  DEFAULT_BOOST_VARIATION,
  createDefaultLogEventFilter,
  clamp01,
  clampVolume,
  dbToLinear,
  AUDIO_SETTINGS_KEY,
  AUDIO_SETTINGS_CHANGED_EVENT,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_AUDIO_SETTINGS,
} from './audioConstants.js';

export {
  CONSOLE_LOG_EVENT_CATALOG,
  BOOST_AUDIO_VARIATIONS,
  DEFAULT_BOOST_VARIATION,
  createDefaultLogEventFilter,
  clamp01,
  clampVolume,
  dbToLinear,
  AUDIO_SETTINGS_KEY,
  AUDIO_SETTINGS_CHANGED_EVENT,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_AUDIO_SETTINGS,
};

export class AudioConfigManager {
  constructor() {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.subscribers = new Set();
    this.load();
  }

  load() {
    try {
      const raw = safeStorage.getItem(AUDIO_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if ((!parsed.version || parsed.version < 3) && parsed.boostCollectVolume === 1.0) {
          parsed.boostCollectVolume = DEFAULT_AUDIO_CONFIG.boostCollectVolume;
        }
        this.config = {
          ...DEFAULT_AUDIO_CONFIG,
          ...parsed,
          version: DEFAULT_AUDIO_CONFIG.version,
          logEventFilter: {
            ...createDefaultLogEventFilter(),
            ...(parsed.logEventFilter || {}),
          },
        };
      }
    } catch (e) {
      console.warn('[AudioConfigManager] Failed to load audio config from storage:', e);
    }
  }

  save() {
    safeStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.config));
    this.notify();
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    if (typeof value === 'number') {
      this.config[key] = key.endsWith('Volume') ? clampVolume(value) : value;
    } else {
      this.config[key] = value;
    }
    this.save();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const sub of this.subscribers) {
      try {
        sub(this.config);
      } catch (e) {
        console.error('[AudioConfigManager] Subscriber error:', e);
      }
    }
  }

  exportJson() {
    return JSON.stringify(this.config, null, 2);
  }

  importJson(jsonOrObj) {
    try {
      const parsed = typeof jsonOrObj === 'string' ? JSON.parse(jsonOrObj) : jsonOrObj;
      if (typeof parsed !== 'object' || !parsed) return false;
      this.config = {
        ...DEFAULT_AUDIO_CONFIG,
        ...parsed,
        logEventFilter: {
          ...createDefaultLogEventFilter(),
          ...(parsed.logEventFilter || {}),
        },
      };
      this.save();
      return true;
    } catch (e) {
      console.error('[AudioConfigManager] Failed to import audio config:', e);
      return false;
    }
  }

  reset() {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.save();
  }
}

export const audioConfig = new AudioConfigManager();

export function getAudioSettings() {
  return audioConfig.config;
}

export function setCarBallSoundMode(mode) { audioConfig.set('carBallSoundMode', mode); }
export function setCarCarSoundMode(mode) { audioConfig.set('carCarSoundMode', mode); }
export function setBoostStartVariation(variationId) { audioConfig.set('boostStartVariation', variationId); }
export function setBoostLoopVariation(variationId) { audioConfig.set('boostLoopVariation', variationId); }
export function setBoostEndVariation(variationId) { audioConfig.set('boostEndVariation', variationId); }
export function setAllBoostAudioVariations(variationId) {
  audioConfig.config.boostStartVariation = variationId;
  audioConfig.config.boostLoopVariation = variationId;
  audioConfig.config.boostEndVariation = variationId;
  audioConfig.save();
}
export function setCarBallHitCooldownMs(ms) { audioConfig.set('carBallHitCooldownMs', ms); }
export function setGoalpostHitCooldownMs(ms) { audioConfig.set('goalpostHitCooldownMs', ms); }
export function setCarBallHitImpulseThreshold(val) { audioConfig.set('carBallHitImpulseThreshold', val); }
export function setGoalpostHitThreshold(val) { audioConfig.set('goalpostHitThreshold', val); }

export function setEventLogFilterItem(hexCode, enabled) {
  const key = String(hexCode).toLowerCase();
  const current = audioConfig.config.logEventFilter || createDefaultLogEventFilter();
  const updated = {
    ...current,
    [key]: Boolean(enabled),
  };
  audioConfig.set('logEventFilter', updated);
  const hasAnyChecked = Object.values(updated).some(Boolean);
  if (hasAnyChecked && !audioConfig.get('logAllEvents')) {
    audioConfig.set('logAllEvents', true);
  }
}

export function selectAllEventLogs() {
  const allTrue = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    allTrue[item.hex.toLowerCase()] = true;
  }
  audioConfig.set('logEventFilter', allTrue);
  audioConfig.set('logAllEvents', true);
}

export function deselectAllEventLogs() {
  const empty = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    empty[item.hex.toLowerCase()] = false;
  }
  audioConfig.set('logEventFilter', empty);
  audioConfig.set('logAllEvents', false);
}

export function isEventLogEnabled(eventType) {
  const cfg = audioConfig.config;
  if (!cfg) return false;
  if (cfg.logCarBallHitEvents && eventType === 0x01) return true;
  if (!cfg.logAllEvents) return false;
  const hex = '0x' + eventType.toString(16).padStart(2, '0').toLowerCase();
  if (!cfg.logEventFilter) return false;
  return Boolean(cfg.logEventFilter[hex]);
}

export function exportAudioSettingsJson() { return audioConfig.exportJson(); }

const audioDiagnosticsProvider = {
  collectReport: null,
  dumpToConsole: null,
  playTestTone: null,
  forceRecovery: null,
};

export function registerAudioDiagnosticsProvider(handlers = {}) {
  Object.assign(audioDiagnosticsProvider, handlers);
}

export function collectAudioDiagnosticReport() {
  if (typeof audioDiagnosticsProvider.collectReport === 'function') {
    return audioDiagnosticsProvider.collectReport();
  }
  return {
    rootCauses: [],
    browser: {},
    context: { state: 'uninitialized', sampleRate: 0, currentTime: 0, clockAdvancing: false },
    master: { rms: 0, dbfs: -120 },
    pool: { activeVoices: 0, maxSlots: 0 },
    loops: {},
    emotor: {},
  };
}

export function dumpAudioDiagnosticsToConsole(label) {
  if (typeof audioDiagnosticsProvider.dumpToConsole === 'function') {
    return audioDiagnosticsProvider.dumpToConsole(label);
  }
  return collectAudioDiagnosticReport();
}

export async function playAudioDiagnosticTestTone(options = {}) {
  if (typeof audioDiagnosticsProvider.playTestTone === 'function') {
    return audioDiagnosticsProvider.playTestTone(options);
  }
  return { ok: false, reason: 'Audio diagnostics provider not initialized' };
}

export async function forceAudioRecovery() {
  if (typeof audioDiagnosticsProvider.forceRecovery === 'function') {
    return audioDiagnosticsProvider.forceRecovery();
  }
  return { ok: false, stateAfter: 'uninitialized', clockAdvancing: false };
}
