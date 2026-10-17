import {
  AUDIO_SETTINGS_KEY,
  AUDIO_CONFIG_STORAGE_KEY,
  AUDIO_SETTINGS_CHANGED_EVENT,
  DEFAULT_AUDIO_CONFIG,
  clamp01,
  clampVolume
} from './audioConstants.js';
import {
  CONSOLE_LOG_EVENT_CATALOG,
  createDefaultLogEventFilter
} from './audioRegistry.js';

export class AudioConfigManager {
  constructor() {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.subscribers = new Set();
    this.load();
  }

  load() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY) || localStorage.getItem("car-soccer.audio-settings.v2");
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
            ...(parsed.logEventFilter || {})
          }
        };
      }
    } catch (e) {
      console.warn('[AudioConfigManager] Failed to load audio config from localStorage:', e);
    }
  }

  save() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('[AudioConfigManager] Failed to save audio config to localStorage:', e);
    }
    this.notify();
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    if (typeof value === "number") {
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUDIO_SETTINGS_CHANGED_EVENT, { detail: this.config }));
    }
  }

  exportJson() {
    return JSON.stringify(this.config, null, 2);
  }

  importJson(jsonOrObj) {
    try {
      const parsed = typeof jsonOrObj === "string" ? JSON.parse(jsonOrObj) : jsonOrObj;
      if (typeof parsed !== "object" || !parsed) return false;
      this.config = {
        ...DEFAULT_AUDIO_CONFIG,
        ...parsed,
        logEventFilter: {
          ...createDefaultLogEventFilter(),
          ...(parsed.logEventFilter || {})
        }
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

export function setMasterVolume(vol) { audioConfig.set('masterVolume', vol); }
export function setEngineVolume(vol) { audioConfig.set('engineVolume', vol); }
export function setBoostVolume(vol) { audioConfig.set('boostVolume', vol); }
export function setVehicleSelfVolume(vol) { audioConfig.set('vehicleSelfVolume', vol); }
export function setJumpVolume(vol) { audioConfig.set('jumpVolume', vol); }
export function setDoubleJumpVolume(vol) { audioConfig.set('doubleJumpVolume', vol); }
export function setDodgeVolume(vol) { audioConfig.set('dodgeVolume', vol); }
export function setSupersonicVolume(vol) { audioConfig.set('supersonicVolume', vol); }
export function setCarCarCollisionVolume(vol) { audioConfig.set('carCarCollisionVolume', vol); }
export function setBallCollisionVolume(vol) { audioConfig.set('ballCollisionVolume', vol); }
export function setCarBallHitVolume(vol) { audioConfig.set('carBallHitVolume', vol); }
export function setBallWorldHitVolume(vol) { audioConfig.set('ballWorldHitVolume', vol); }
export function setGoalpostHitVolume(vol) { audioConfig.set('goalpostHitVolume', vol); }
export function setBallRollingVolume(vol) { audioConfig.set('ballRollingVolume', vol); }
export function setBallFlyingVolume(vol) { audioConfig.set('ballFlyingVolume', vol); }
export function setGoalScoredVolume(vol) { audioConfig.set('goalScoredVolume', vol); }
export function setFlipResetVolume(vol) { audioConfig.set('flipResetVolume', vol); }
export function setBoostCollectVolume(vol) { audioConfig.set('boostCollectVolume', vol); }
export function setBallFloorHitVolume(vol) { audioConfig.set('ballFloorHitVolume', vol); }
export function setBallNetHitVolume(vol) { audioConfig.set('ballNetHitVolume', vol); }
export function setBallRampHitVolume(vol) { audioConfig.set('ballRampHitVolume', vol); }
export function setIncidentCooldownMs(ms) { audioConfig.set('incidentCooldownMs', ms); }
export function setNetDualTriggerAngleDeg(deg) { audioConfig.set('netDualTriggerAngleDeg', deg); }
export function setCarBallSoundMode(mode) { audioConfig.set('carBallSoundMode', mode); }
export function setCarCarSoundMode(mode) { audioConfig.set('carCarSoundMode', mode); }
export function setCarBallHitCooldownMs(ms) { audioConfig.set('carBallHitCooldownMs', ms); }
export function setGoalpostHitCooldownMs(ms) { audioConfig.set('goalpostHitCooldownMs', ms); }
export function setCarBallHitImpulseThreshold(val) { audioConfig.set('carBallHitImpulseThreshold', val); }
export function setGoalpostHitThreshold(val) { audioConfig.set('goalpostHitThreshold', val); }
export function setContinueAudioOnLostFocus(enabled) { audioConfig.set('continueAudioOnLostFocus', enabled); }
export function setLogAllEvents(enabled) { audioConfig.set('logAllEvents', enabled); }
export function setLogCarBallHitEvents(enabled) { audioConfig.set('logCarBallHitEvents', enabled); }

export function setLogEventFilter(filter) {
  audioConfig.set('logEventFilter', { ...filter });
}

export function setEventLogFilterItem(hexCode, enabled) {
  const key = String(hexCode).toLowerCase();
  const current = audioConfig.config.logEventFilter || createDefaultLogEventFilter();
  const updated = {
    ...current,
    [key]: Boolean(enabled)
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

export function resetAudioSettings() { audioConfig.reset(); }
export function exportAudioSettingsJson() { return audioConfig.exportJson(); }
export function importAudioSettingsJson(json) { return audioConfig.importJson(json); }
