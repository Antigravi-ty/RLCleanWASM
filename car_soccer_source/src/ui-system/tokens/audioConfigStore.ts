import staticAudioConfig from './audioConfig.json' with { type: 'json' };
import { safeStorage } from '../core/configStorageHydrators.ts';

export interface ConsoleLogEventCatalogItem {
  type: number;
  hex: string;
  id: string;
  name: string;
  category: 'Incident' | 'Signal';
}

export const CONSOLE_LOG_EVENT_CATALOG: ReadonlyArray<ConsoleLogEventCatalogItem> = Object.freeze([
  { type: 0x01, hex: '0x01', id: 'CAR_BALL_HIT', name: 'Car-Ball Hit', category: 'Incident' },
  { type: 0x02, hex: '0x02', id: 'CAR_CAR_BUMP', name: 'Car-Car Bump', category: 'Incident' },
  { type: 0x03, hex: '0x03', id: 'CAR_CAR_DEMO', name: 'Car Demolition', category: 'Incident' },
  { type: 0x04, hex: '0x04', id: 'BALL_WORLD_HIT', name: 'Ball-World Collision', category: 'Incident' },
  { type: 0x05, hex: '0x05', id: 'BALL_GOALPOST_HIT', name: 'Ball-Goalpost Collision', category: 'Incident' },
  { type: 0x06, hex: '0x06', id: 'CAR_JUMP', name: 'Single Jump', category: 'Incident' },
  { type: 0x07, hex: '0x07', id: 'CAR_DOUBLE_JUMP', name: 'Double Jump', category: 'Incident' },
  { type: 0x08, hex: '0x08', id: 'CAR_DODGE', name: 'Dodge / Flip', category: 'Incident' },
  { type: 0x09, hex: '0x09', id: 'CAR_SUPERSONIC_ENTER', name: 'Supersonic Entry', category: 'Incident' },
  { type: 0x0A, hex: '0x0a', id: 'BOOST_PICKUP', name: 'Boost Pad Pickup', category: 'Incident' },
  { type: 0x0B, hex: '0x0b', id: 'BOOST_SPAWN', name: 'Boost Pad Respawn', category: 'Incident' },
  { type: 0x0C, hex: '0x0c', id: 'CAR_BOOST_START', name: 'Car Boost Start', category: 'Incident' },
  { type: 0x0D, hex: '0x0d', id: 'CAR_BOOST_STOP', name: 'Car Boost Stop', category: 'Incident' },
  { type: 0x0E, hex: '0x0e', id: 'GOAL_SCORED', name: 'Goal Scored', category: 'Incident' },
  { type: 0x0F, hex: '0x0f', id: 'FLIP_RESET_GAINED', name: 'Flip Reset Gained', category: 'Incident' },
  { type: 0x10, hex: '0x10', id: 'BALL_STATE_CHANGE', name: 'Ball State Change', category: 'Incident' },
  { type: 0x11, hex: '0x11', id: 'POSSESSION_CHANGE', name: 'Possession Change', category: 'Incident' },

  { type: 0x80, hex: '0x80', id: 'MATCH_START', name: 'Match Start', category: 'Signal' },
  { type: 0x81, hex: '0x81', id: 'KICKOFF_PREPARE', name: 'Kickoff Prepare', category: 'Signal' },
  { type: 0x82, hex: '0x82', id: 'KICKOFF_GO', name: 'Kickoff Go', category: 'Signal' },
  { type: 0x83, hex: '0x83', id: 'COUNTDOWN_TICK', name: 'Countdown Tick', category: 'Signal' },
  { type: 0x84, hex: '0x84', id: 'MATCH_PAUSE', name: 'Match Pause', category: 'Signal' },
  { type: 0x85, hex: '0x85', id: 'MATCH_RESUME', name: 'Match Resume', category: 'Signal' },
  { type: 0x86, hex: '0x86', id: 'OVERTIME_START', name: 'Overtime Start', category: 'Signal' },
  { type: 0x87, hex: '0x87', id: 'MATCH_END', name: 'Match End', category: 'Signal' },
  { type: 0x88, hex: '0x88', id: 'REPLAY_START', name: 'Replay Start', category: 'Signal' },
  { type: 0x89, hex: '0x89', id: 'REPLAY_END', name: 'Replay End', category: 'Signal' },
]);

export function createDefaultLogEventFilter(): Record<string, boolean> {
  const filter: Record<string, boolean> = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    filter[item.hex.toLowerCase()] = false;
  }
  return filter;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export function clampVolume(v: number): number {
  return Math.max(0, Math.min(5.0, Number(v) || 0));
}

export function dbToLinear(dB: number): number {
  return Math.pow(10, dB / 20);
}

export const AUDIO_SETTINGS_KEY = 'car-soccer.audio-architecture.v1';
export const AUDIO_CONFIG_STORAGE_KEY = AUDIO_SETTINGS_KEY;
export const AUDIO_SETTINGS_CHANGED_EVENT = 'car-soccer:audio-settings-changed';

export const DEFAULT_AUDIO_CONFIG: Record<string, any> = Object.freeze({
  ...staticAudioConfig,
  carBallSoundMode: 'vehicle_body',
  carCarSoundMode: 'vehicle_detail',
  boostCollectVolume: 2.0,
  endgameVolume: 2.0,
  countdown10sVolume: 1.0,
  spatialPanningModel: 'equalpower',
  distanceModel: 'smoothstep',
  distanceUnitScale: 0.01,
  rolloffMinDistance: 400.0,
  rolloffMaxDistance: 13000.0,
  minAudibleGainFloor: 0.15,
  airAbsorptionDamping: 0.0,
  logEventFilter: createDefaultLogEventFilter(),
});

export const DEFAULT_AUDIO_SETTINGS = DEFAULT_AUDIO_CONFIG;

export class AudioConfigManager {
  config: Record<string, any>;
  subscribers: Set<(config: Record<string, any>) => void>;

  constructor() {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.subscribers = new Set();
    this.load();
  }

  load(): void {
    try {
      const raw = safeStorage.getItem(AUDIO_SETTINGS_KEY) || safeStorage.getItem('car-soccer.audio-settings.v2');
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

  save(): void {
    safeStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.config));
    this.notify();
  }

  get(key: string): any {
    return this.config[key];
  }

  set(key: string, value: any): void {
    if (typeof value === 'number') {
      this.config[key] = key.endsWith('Volume') ? clampVolume(value) : value;
    } else {
      this.config[key] = value;
    }
    this.save();
  }

  subscribe(callback: (config: Record<string, any>) => void): () => boolean {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(): void {
    for (const sub of this.subscribers) {
      try {
        sub(this.config);
      } catch (e) {
        console.error('[AudioConfigManager] Subscriber error:', e);
      }
    }
  }

  exportJson(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importJson(jsonOrObj: string | Record<string, any>): boolean {
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

  reset(): void {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.save();
  }
}

export const audioConfig = new AudioConfigManager();

export function getAudioSettings(): Record<string, any> {
  return audioConfig.config;
}

export function setMasterVolume(vol: number) { audioConfig.set('masterVolume', vol); }
export function setEngineVolume(vol: number) { audioConfig.set('engineVolume', vol); }
export function setBoostVolume(vol: number) { audioConfig.set('boostVolume', vol); }
export function setVehicleSelfVolume(vol: number) { audioConfig.set('vehicleSelfVolume', vol); }
export function setJumpVolume(vol: number) { audioConfig.set('jumpVolume', vol); }
export function setDoubleJumpVolume(vol: number) { audioConfig.set('doubleJumpVolume', vol); }
export function setDodgeVolume(vol: number) { audioConfig.set('dodgeVolume', vol); }
export function setSupersonicVolume(vol: number) { audioConfig.set('supersonicVolume', vol); }
export function setCarCarCollisionVolume(vol: number) { audioConfig.set('carCarCollisionVolume', vol); }
export function setBallCollisionVolume(vol: number) { audioConfig.set('ballCollisionVolume', vol); }
export function setCarBallHitVolume(vol: number) { audioConfig.set('carBallHitVolume', vol); }
export function setBallWorldHitVolume(vol: number) { audioConfig.set('ballWorldHitVolume', vol); }
export function setGoalpostHitVolume(vol: number) { audioConfig.set('goalpostHitVolume', vol); }
export function setBallRollingVolume(vol: number) { audioConfig.set('ballRollingVolume', vol); }
export function setBallFlyingVolume(vol: number) { audioConfig.set('ballFlyingVolume', vol); }
export function setGoalScoredVolume(vol: number) { audioConfig.set('goalScoredVolume', vol); }
export function setFlipResetVolume(vol: number) { audioConfig.set('flipResetVolume', vol); }
export function setBoostCollectVolume(vol: number) { audioConfig.set('boostCollectVolume', vol); }
export function setBallFloorHitVolume(vol: number) { audioConfig.set('ballFloorHitVolume', vol); }
export function setBallNetHitVolume(vol: number) { audioConfig.set('ballNetHitVolume', vol); }
export function setBallRampHitVolume(vol: number) { audioConfig.set('ballRampHitVolume', vol); }
export function setIncidentCooldownMs(ms: number) { audioConfig.set('incidentCooldownMs', ms); }
export function setNetDualTriggerAngleDeg(deg: number) { audioConfig.set('netDualTriggerAngleDeg', deg); }
export function setCarBallSoundMode(mode: string) { audioConfig.set('carBallSoundMode', mode); }
export function setCarCarSoundMode(mode: string) { audioConfig.set('carCarSoundMode', mode); }
export function setCarBallHitCooldownMs(ms: number) { audioConfig.set('carBallHitCooldownMs', ms); }
export function setGoalpostHitCooldownMs(ms: number) { audioConfig.set('goalpostHitCooldownMs', ms); }
export function setCarBallHitImpulseThreshold(val: number) { audioConfig.set('carBallHitImpulseThreshold', val); }
export function setGoalpostHitThreshold(val: number) { audioConfig.set('goalpostHitThreshold', val); }
export function setContinueAudioOnLostFocus(enabled: boolean) { audioConfig.set('continueAudioOnLostFocus', enabled); }
export function setLogAllEvents(enabled: boolean) { audioConfig.set('logAllEvents', enabled); }
export function setLogCarBallHitEvents(enabled: boolean) { audioConfig.set('logCarBallHitEvents', enabled); }

export function setLogEventFilter(filter: Record<string, boolean>) {
  audioConfig.set('logEventFilter', { ...filter });
}

export function setEventLogFilterItem(hexCode: string, enabled: boolean) {
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
  const allTrue: Record<string, boolean> = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    allTrue[item.hex.toLowerCase()] = true;
  }
  audioConfig.set('logEventFilter', allTrue);
  audioConfig.set('logAllEvents', true);
}

export function deselectAllEventLogs() {
  const empty: Record<string, boolean> = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    empty[item.hex.toLowerCase()] = false;
  }
  audioConfig.set('logEventFilter', empty);
  audioConfig.set('logAllEvents', false);
}

export function isEventLogEnabled(eventType: number): boolean {
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
export function importAudioSettingsJson(json: string | Record<string, any>) { return audioConfig.importJson(json); }
