import staticAudioConfig from './audioConfig.json' with { type: 'json' };
/**
 * AudioArchitecture.js
 * Clean, decoupled Web Audio System for Rocket League Clean WASM.
 *
 * Implements the 4 core audio engines:
 * 1. StateAudioEngine: Continuous state evaluation (EMotorSynth powertrain, Boost loop,
 *    Ball rolling loop, Ball airborne & falling with 200ms smooth fadeout, Supersonic wind)
 * 2. IncidentAudioEngine: Discrete physics events (0~500ms cooldown, 3-surface normal taxonomy,
 *    steep net impact dual-triggering >= 60 deg, goalpost hit shielding, car collisions & demos)
 * 3. SignalAudioEngine: Match and session lifecycle signals (3-2-1 countdown, kickoff go,
 *    overtime alert, 30s alert, no-boost error chime)
 * 4. UIAudioEngine: UI click and interaction audio
 *
 * Integrated Subsystems:
 * - AudioConfigManager: Unified gain (0% to 500%), thresholds & debounce timing, localStorage persistence
 * - AudioSlotPool: Fixed 10-voice Web Audio slot pool with priority stealing and zero GC allocations
 * - AudioMixer: Master gain bus, destination routing, and window blur / tab switch mute shielding
 */

import {
  INCIDENT_EVENT_TYPES,
  SIGNAL_EVENT_TYPES,
  SURFACE_SUBTYPES,
  PHYSICS_EVENT_TYPES,
  CAR_ACTION_SUBTYPES
} from '../physics/RocketSimConstants.js';
import { EMotorSynth } from './EMotorSynth.js';
export { EMotorSynth } from './EMotorSynth.js';
import {
  SpatialAudioSource,
  updateAudioListener,
  calculateDistanceGain,
  calculateIncidentDistanceGain,
  toAudioCoordinates,
  listenerManager,
  INCIDENT_SPATIAL_CONFIG
} from './SpatialAudioSource.js';
export {
  SpatialAudioSource,
  updateAudioListener,
  calculateDistanceGain,
  calculateIncidentDistanceGain,
  toAudioCoordinates,
  listenerManager,
  INCIDENT_SPATIAL_CONFIG
} from './SpatialAudioSource.js';

// ---------------------------------------------------------------------------
// Audio Asset Definitions (100% Unified under /custom/assets/audio/)
// ---------------------------------------------------------------------------
export const BALL_HIT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/ball_hit/vehicle-body-01.m4a",
  "/custom/assets/audio/ball_hit/vehicle-body-02.m4a",
  "/custom/assets/audio/ball_hit/vehicle-body-03.m4a",
  "/custom/assets/audio/ball_hit/vehicle-body-04.m4a"
]);

export const SIDEWALL_HIT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0200.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0216.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0259.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0378.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0627.m4a"
]);

export const SFX_CAR_COLLISION_FILE = "/custom/assets/audio/sfx_car_collision.m4a";
export const BOOST_COLLECT_FILE = "/custom/assets/audio/boost_collect.m4a";
export const GOAL_SCORED_FILE = "/custom/assets/audio/sfx_goal_poof.m4a";
export const BALL_ROLLING_FILE = "/custom/assets/audio/ballrolling.m4a";
export const BALL_FLYING_FILE = "/custom/assets/audio/ballflying.m4a";
export const SUPERSONIC_STATE_FILE = "/custom/assets/audio/sfx_state_supersonic.m4a";
export const ERROR_NO_BOOST_FILE = "/custom/assets/audio/sfx_error_no_boost.m4a";
export const MATCH_30S_FILE = "/custom/assets/audio/match_30_seconds_left.m4a";
export const MATCH_COUNTDOWN_FILE = "/custom/assets/audio/match_countdown_321.m4a";
export const MATCH_OVERTIME_FILE = "/custom/assets/audio/match_entering_overtime.m4a";
export const MATCH_START_GO_FILE = "/custom/assets/audio/match_start_go.m4a";

// Real device / production vehicle and impact audio assets (mapped from public/file_list.md)
export const JUMP_AUDIO_FILES = Object.freeze([
  "/assets/audio/vehicle/jump-01.wav",
  "/assets/audio/vehicle/jump-02.wav",
  "/assets/audio/vehicle/jump-03.wav",
  "/assets/audio/vehicle/jump-04.wav"
]);

export const DOUBLE_JUMP_AUDIO_FILES = Object.freeze([
  "/assets/audio/vehicle/double-jump-01.wav",
  "/assets/audio/vehicle/double-jump-02.wav",
  "/assets/audio/vehicle/double-jump-03.wav",
  "/assets/audio/vehicle/double-jump-04.wav"
]);

export const DODGE_AUDIO_FILES = Object.freeze([
  "/assets/audio/vehicle/dodge-01.wav",
  "/assets/audio/vehicle/dodge-02.wav",
  "/assets/audio/vehicle/dodge-03.wav",
  "/assets/audio/vehicle/dodge-04.wav"
]);

export const RESET_AUDIO_FILE = "/assets/audio/events/reset.wav";
export const GOALPOST_AUDIO_FILE = "/assets/audio/impacts/surface-body-04.wav";

export const WHEEL_IMPACT_AUDIO_FILES = Object.freeze([
  "/assets/audio/vehicle/wheel-impact-01.wav",
  "/assets/audio/vehicle/wheel-impact-02.wav",
  "/assets/audio/vehicle/wheel-impact-03.wav",
  "/assets/audio/vehicle/wheel-impact-04.wav"
]);

export const BALL_GROUND_HIT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/ball_hit/vehicle-body-01.m4a",
  "/custom/assets/audio/ball_hit/vehicle-body-02.m4a",
  "/custom/assets/audio/ball_hit/vehicle-body-03.m4a"
]);

export const SUPERSONIC_ENTER_AUDIO_FILES = Object.freeze([
  "/assets/audio/vehicle/supersonic-enter-a.wav",
  "/assets/audio/vehicle/supersonic-enter-b.wav",
  "/assets/audio/vehicle/supersonic-enter-c.wav"
]);

export const SUPERSONIC_LOOP_AUDIO_FILE = "/assets/audio/vehicle/supersonic-loop.wav";

export const BOOST_START_AUDIO_FILE = "/assets/audio/boost/start.wav";
export const BOOST_LOOP_AUDIO_FILE = "/assets/audio/boost/loop.wav";
export const BOOST_RELEASE_AUDIO_FILE = "/assets/audio/boost/release.wav";

/**
 * Authoritative incident-to-audio mapping and lifecycle metadata registry.
 */
export const INCIDENT_AUDIO_REGISTRY = Object.freeze({
  [INCIDENT_EVENT_TYPES.CAR_BALL_HIT]: Object.freeze({
    id: "CAR_BALL_HIT",
    name: "Car-Ball Hit",
    category: "Incident",
    primary: Object.freeze([
      "/assets/audio/impacts/vehicle-body-01.wav",
      "/assets/audio/impacts/vehicle-body-02.wav",
      "/assets/audio/impacts/vehicle-body-03.wav",
      "/assets/audio/impacts/vehicle-body-04.wav",
      "/assets/audio/impacts/vehicle-body-05.wav",
      "/assets/audio/impacts/vehicle-body-06.wav"
    ]),
    fallback: BALL_HIT_AUDIO_FILES,
    cooldownKey: "carBallHitCooldownMs",
    volumeKey: "carBallHitVolume",
    defaultPriority: 5
  }),
  [INCIDENT_EVENT_TYPES.CAR_CAR_BUMP]: Object.freeze({
    id: "CAR_CAR_BUMP",
    name: "Car-Car Bump",
    category: "Incident",
    primary: Object.freeze([SFX_CAR_COLLISION_FILE]),
    fallback: Object.freeze([SFX_CAR_COLLISION_FILE]),
    volumeKey: "carCarCollisionVolume",
    defaultPriority: 6
  }),
  [INCIDENT_EVENT_TYPES.CAR_CAR_DEMO]: Object.freeze({
    id: "CAR_CAR_DEMO",
    name: "Car Demolition",
    category: "Incident",
    primary: Object.freeze([GOAL_SCORED_FILE, SFX_CAR_COLLISION_FILE]),
    volumeKey: "carCarCollisionVolume",
    defaultPriority: 9
  }),
  [INCIDENT_EVENT_TYPES.BALL_WORLD_HIT]: Object.freeze({
    id: "BALL_WORLD_HIT",
    name: "Ball-World Collision",
    category: "Incident",
    surfaces: Object.freeze({
      floor: BALL_GROUND_HIT_AUDIO_FILES,
      net: SIDEWALL_HIT_AUDIO_FILES
    }),
    fallback: BALL_HIT_AUDIO_FILES,
    cooldownKey: "incidentCooldownMs",
    volumeKey: "ballWorldHitVolume",
    defaultPriority: 4
  }),
  [INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT]: Object.freeze({
    id: "BALL_GOALPOST_HIT",
    name: "Ball-Goalpost Collision",
    category: "Incident",
    primary: Object.freeze([GOALPOST_AUDIO_FILE]),
    fallback: Object.freeze([BALL_HIT_AUDIO_FILES[3]]),
    cooldownKey: "goalpostHitCooldownMs",
    volumeKey: "goalpostHitVolume",
    defaultPriority: 8
  }),
  [INCIDENT_EVENT_TYPES.CAR_JUMP]: Object.freeze({
    id: "CAR_JUMP",
    name: "Single Jump",
    category: "Incident",
    primary: JUMP_AUDIO_FILES,
    volumeKey: "jumpVolume",
    defaultPriority: 3
  }),
  [INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP]: Object.freeze({
    id: "CAR_DOUBLE_JUMP",
    name: "Double Jump",
    category: "Incident",
    primary: DOUBLE_JUMP_AUDIO_FILES,
    volumeKey: "doubleJumpVolume",
    defaultPriority: 3
  }),
  [INCIDENT_EVENT_TYPES.CAR_DODGE]: Object.freeze({
    id: "CAR_DODGE",
    name: "Dodge / Flip",
    category: "Incident",
    primary: DODGE_AUDIO_FILES,
    volumeKey: "dodgeVolume",
    defaultPriority: 3
  }),
  [INCIDENT_EVENT_TYPES.CAR_SUPERSONIC_ENTER]: Object.freeze({
    id: "CAR_SUPERSONIC_ENTER",
    name: "Supersonic Entry",
    category: "Incident",
    primary: SUPERSONIC_ENTER_AUDIO_FILES,
    loop: SUPERSONIC_LOOP_AUDIO_FILE,
    fallback: Object.freeze([SUPERSONIC_STATE_FILE]),
    volumeKey: "supersonicVolume",
    defaultPriority: 5
  }),
  [INCIDENT_EVENT_TYPES.BOOST_PICKUP]: Object.freeze({
    id: "BOOST_PICKUP",
    name: "Boost Pad Pickup",
    category: "Incident",
    primary: Object.freeze([BOOST_COLLECT_FILE]),
    volumeKey: "boostCollectVolume",
    defaultPriority: 4
  }),
  [INCIDENT_EVENT_TYPES.CAR_BOOST_START]: Object.freeze({
    id: "CAR_BOOST_START",
    name: "Car Boost Start",
    category: "Incident",
    primary: Object.freeze([BOOST_START_AUDIO_FILE]),
    volumeKey: "boostVolume",
    defaultPriority: 6
  }),
  [INCIDENT_EVENT_TYPES.CAR_BOOST_STOP]: Object.freeze({
    id: "CAR_BOOST_STOP",
    name: "Car Boost Stop",
    category: "Incident",
    primary: Object.freeze([BOOST_RELEASE_AUDIO_FILE]),
    volumeKey: "boostVolume",
    defaultPriority: 5
  }),
  [INCIDENT_EVENT_TYPES.GOAL_SCORED]: Object.freeze({
    id: "GOAL_SCORED",
    name: "Goal Scored",
    category: "Incident",
    primary: Object.freeze([GOAL_SCORED_FILE]),
    volumeKey: "goalScoredVolume",
    defaultPriority: 10
  }),
  [INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED]: Object.freeze({
    id: "FLIP_RESET_GAINED",
    name: "Flip Reset Gained",
    category: "Incident",
    primary: Object.freeze([RESET_AUDIO_FILE]),
    fallback: Object.freeze([BOOST_COLLECT_FILE]),
    volumeKey: "flipResetVolume",
    defaultPriority: 7
  })
});

// ---------------------------------------------------------------------------
// Console Log Physics Event Catalog
// ---------------------------------------------------------------------------
export const CONSOLE_LOG_EVENT_CATALOG = Object.freeze([
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
  { type: 0x89, hex: '0x89', id: 'REPLAY_END', name: 'Replay End', category: 'Signal' }
]);

export function createDefaultLogEventFilter() {
  const filter = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    filter[item.hex] = true;
  }
  return filter;
}

// ---------------------------------------------------------------------------
// Math & Coordinate Utilities
// ---------------------------------------------------------------------------
export function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export function clampVolume(v) {
  return Math.max(0, Math.min(5.0, Number(v) || 0));
}

export function dbToLinear(dB) {
  return Math.pow(10, dB / 20);
}



// ---------------------------------------------------------------------------
// 1. Audio Configuration Manager
// ---------------------------------------------------------------------------
export const AUDIO_SETTINGS_KEY = "car-soccer.audio-architecture.v1";
export const AUDIO_CONFIG_STORAGE_KEY = AUDIO_SETTINGS_KEY;
export const AUDIO_SETTINGS_CHANGED_EVENT = "car-soccer:audio-settings-changed";

export const DEFAULT_AUDIO_CONFIG = Object.freeze({
  ...staticAudioConfig,
  logEventFilter: createDefaultLogEventFilter()
});

export const DEFAULT_AUDIO_SETTINGS = DEFAULT_AUDIO_CONFIG;

export class AudioConfigManager {
  constructor() {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.listeners = new Set();
    this.load();
  }

  load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY) || localStorage.getItem("car-soccer.audio-settings.v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && Number.isFinite(v)) {
            this.config[k] = Math.max(0, Math.min(5.0, v));
          } else if (typeof v === 'boolean' || typeof v === 'string') {
            this.config[k] = v;
          } else if (k === "logEventFilter" && v && typeof v === "object") {
            this.config[k] = { ...v };
          }
        }
      }
    } catch (e) {
      console.warn('[AudioConfigManager] Failed to load config:', e);
    }
  }

  save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.config));
    } catch (e) {}
    this.notify();
  }

  get(key) {
    return this.config[key] ?? DEFAULT_AUDIO_CONFIG[key] ?? 1.0;
  }

  set(key, value) {
    if (typeof value === 'number') {
      this.config[key] = Math.max(0, Math.min(5.0, value));
    } else {
      this.config[key] = value;
    }
    this.save();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try { cb(this.config); } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUDIO_SETTINGS_CHANGED_EVENT, { detail: this.config }));
    }
  }

  exportJson() {
    return JSON.stringify(this.config, null, 2);
  }

  importJson(jsonOrObj) {
    try {
      const obj = typeof jsonOrObj === 'string' ? JSON.parse(jsonOrObj) : jsonOrObj;
      if (!obj || typeof obj !== 'object') return false;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          this.config[k] = Math.max(0, Math.min(5.0, v));
        } else if (typeof v === 'boolean' || typeof v === 'string') {
          this.config[k] = v;
        } else if (k === "logEventFilter" && v && typeof v === "object") {
          this.config[k] = { ...v };
        }
      }
      this.save();
      return true;
    } catch (e) {
      return false;
    }
  }

  reset() {
    this.config = { ...DEFAULT_AUDIO_CONFIG };
    this.save();
  }
}

export const audioConfig = new AudioConfigManager();

// Helper setters and getters for UI bindings
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
  audioConfig.set('logEventFilter', createDefaultLogEventFilter());
  audioConfig.set('logAllEvents', true);
}

export function deselectAllEventLogs() {
  const empty = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    empty[item.hex] = false;
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
  if (!cfg.logEventFilter) return true;
  return cfg.logEventFilter[hex] !== false;
}

export function resetAudioSettings() { audioConfig.reset(); }
export function exportAudioSettingsJson() { return audioConfig.exportJson(); }
export function importAudioSettingsJson(json) { return audioConfig.importJson(json); }

// ---------------------------------------------------------------------------
// 2. AudioMixer & Master Context Routing
// ---------------------------------------------------------------------------
export class AudioMixer {
  constructor(context) {
    this.context = context;
    this.input = context.createGain();
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.volume = 1;
    this.active = false;
    this.connected = false;
    this.input.connect(this.output);
  }

  setVolume(vol) {
    this.volume = clampVolume(vol);
    this.apply();
  }

  setActive(active) {
    this.active = Boolean(active);
    this.apply();
  }

  flush() {
    if (!this.context) return;
    const now = this.context.currentTime;
    try {
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setValueAtTime(0, now);
    } catch (e) {}
  }

  apply() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const target = this.active ? this.volume : 0;
    const current = this.output.gain.value;

    try {
      this.output.gain.cancelScheduledValues(now);
      if (target === 0) {
        this.output.gain.setValueAtTime(0, now);
        if (this.connected) {
          this.output.disconnect(this.context.destination);
          this.connected = false;
        }
        return;
      }

      if (!this.connected) {
        this.output.gain.setValueAtTime(0, now);
        this.output.connect(this.context.destination);
        this.connected = true;
      }

      if (this.context.state === "running") {
        this.output.gain.setValueAtTime(Math.min(current, target), now);
        this.output.gain.linearRampToValueAtTime(target, now + 0.05);
      } else {
        this.output.gain.setValueAtTime(target, now);
      }
    } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// 3. AudioSlotPool (Zero-GC, 10-Voice Web Audio Slot Pool)
// ---------------------------------------------------------------------------
export class AudioSlotPool {
  constructor(context, maxSlots = 10) {
    this.context = context;
    this.maxSlots = maxSlots;
    this.slots = [];
    this._initialized = false;
    this._scratchPos = { x: 0, y: 0, z: 0 };
  }

  init() {
    if (this._initialized || !this.context) return;
    const ctx = this.context;
    const dest = getMasterAudioInput();
    listenerManager.setContext(ctx);

    for (let i = 0; i < this.maxSlots; i++) {
      const gainNode = ctx.createGain();

      // 3D Omnidirectional Panner Node (equalpower preserves high-frequency crispness without HRTF pinna notch filtering)
      const panner3D = ctx.createPanner();
      panner3D.panningModel = 'equalpower';
      panner3D.distanceModel = 'inverse';
      panner3D.rolloffFactor = 0; // Distance gain handled explicitly via smoothstep
      panner3D.coneInnerAngle = 360;
      panner3D.coneOuterAngle = 360;
      panner3D.channelCount = 1;
      panner3D.channelCountMode = 'explicit';
      panner3D.channelInterpretation = 'speakers';
      if (dest) panner3D.connect(dest);

      // 2D Stereo fallback Panner Node (for non-spatial broadcast signals & UI clicks)
      let panner2D = null;
      if (typeof ctx.createStereoPanner === 'function') {
        panner2D = ctx.createStereoPanner();
        if (dest) panner2D.connect(dest);
      }

      this.slots.push({
        id: i,
        gainNode,
        panner3D,
        panner2D,
        currentMode: null, // 'spatial' | 'stereo'
        inUse: false,
        sourceNode: null,
        startTime: 0,
        priority: 0,
        onEnded: null
      });
    }
    this._initialized = true;
  }

  acquireSlot(priority = 1) {
    if (!this._initialized) this.init();

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.inUse) {
        slot.inUse = true;
        slot.priority = priority;
        slot.startTime = performance.now();
        return slot;
      }
    }

    // Steal oldest slot with <= priority
    let candidate = null;
    let oldestTime = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.priority <= priority && slot.startTime < oldestTime) {
        oldestTime = slot.startTime;
        candidate = slot;
      }
    }

    if (candidate) {
      this.releaseSlot(candidate);
      candidate.inUse = true;
      candidate.priority = priority;
      candidate.startTime = performance.now();
      return candidate;
    }

    return null;
  }

  releaseSlot(slot) {
    if (!slot) return;
    if (slot.sourceNode) {
      try {
        slot.sourceNode.onended = null;
        slot.sourceNode.stop();
        slot.sourceNode.disconnect();
      } catch (e) {}
      slot.sourceNode = null;
    }
    slot.inUse = false;
    slot.priority = 0;
    slot.startTime = 0;
    if (slot.onEnded) {
      try { slot.onEnded(); } catch (e) {}
      slot.onEnded = null;
    }
  }

  playBuffer(buffer, options = {}) {
    if (!buffer) return null;
    const ctx = this.context;
    if (!ctx || ctx.state === "closed") return null;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const baseVolume = options.volume ?? 1.0;
    const playbackRate = options.playbackRate ?? 1.0;
    const priority = options.priority ?? 1;

    const slot = this.acquireSlot(priority);
    if (!slot) return null;

    const now = ctx.currentTime;
    try {
      slot.gainNode.gain.cancelScheduledValues(now);

      const audioPos = options.position ? toAudioCoordinates(this._scratchPos, options.position) : null;

      if (audioPos) {
        // Spatial 3D HRTF playback from emission coordinates (x, y, z)
        if (slot.currentMode !== 'spatial') {
          try { slot.gainNode.disconnect(); } catch (e) {}
          slot.gainNode.connect(slot.panner3D);
          slot.currentMode = 'spatial';
        }

        if (slot.panner3D.positionX) {
          slot.panner3D.positionX.setValueAtTime(audioPos.x, now);
          slot.panner3D.positionY.setValueAtTime(audioPos.y, now);
          slot.panner3D.positionZ.setValueAtTime(audioPos.z, now);
        } else if (typeof slot.panner3D.setPosition === 'function') {
          slot.panner3D.setPosition(audioPos.x, audioPos.y, audioPos.z);
        }

        // Calculate distance from emitter point to camera listener
        const dx = audioPos.x - listenerManager.position.x;
        const dy = audioPos.y - listenerManager.position.y;
        const dz = audioPos.z - listenerManager.position.z;
        const distance = Math.hypot(dx, dy, dz);
        const distGain = calculateIncidentDistanceGain(distance);
        const effectiveGain = Math.max(0, Math.min(5.0, baseVolume * distGain));
        slot.gainNode.gain.setValueAtTime(effectiveGain, now);
      } else {
        // Non-spatial 2D stereo playback (signals, UI clicks)
        if (slot.currentMode !== 'stereo') {
          try { slot.gainNode.disconnect(); } catch (e) {}
          if (slot.panner2D) {
            slot.gainNode.connect(slot.panner2D);
          } else {
            const dest = getMasterAudioInput();
            if (dest) slot.gainNode.connect(dest);
          }
          slot.currentMode = 'stereo';
        }

        if (slot.panner2D && slot.panner2D.pan) {
          const pan = options.pan ?? 0.0;
          slot.panner2D.pan.cancelScheduledValues(now);
          slot.panner2D.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
        }

        slot.gainNode.gain.setValueAtTime(Math.max(0, Math.min(5.0, baseVolume)), now);
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.setValueAtTime(playbackRate, now);
      src.connect(slot.gainNode);

      slot.sourceNode = src;
      slot.onEnded = options.onEnded ?? null;

      src.onended = () => {
        if (slot.sourceNode === src) {
          this.releaseSlot(slot);
        }
      };

      src.start(now);
      return slot;
    } catch (e) {
      this.releaseSlot(slot);
      return null;
    }
  }

  silenceAll() {
    for (let i = 0; i < this.slots.length; i++) {
      this.releaseSlot(this.slots[i]);
    }
  }
}

// ---------------------------------------------------------------------------
// Global Audio Subsystem State & Lifecycle
// ---------------------------------------------------------------------------
const subsystemState = {
  context: null,
  masterMixer: null,
  slotPool: null,
  buffers: new Map(),
  loading: null,
  loaded: false
};

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!subsystemState.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = new AudioContextClass({ latencyHint: "interactive" });
    subsystemState.context = ctx;
    listenerManager.setContext(ctx);

    const master = new AudioMixer(ctx);
    master.setVolume(audioConfig.get('masterVolume'));
    master.setActive(true);
    subsystemState.masterMixer = master;

    subsystemState.slotPool = new AudioSlotPool(ctx, 10);
    subsystemState.slotPool.init();

    const onAudioReady = () => {
      if (ctx.state === "running") {
        master.setActive(true);
        master.apply();
        audioEngine.stateEngine._startLoops();
      }
    };

    // User interaction audio unlock
    const unlock = () => {
      if (ctx.state === "suspended") {
        ctx.resume().then(onAudioReady).catch(() => {});
      } else if (ctx.state === "running") {
        onAudioReady();
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true, capture: true });
    window.addEventListener("keydown", unlock, { passive: true, capture: true });
    window.addEventListener("touchstart", unlock, { passive: true, capture: true });
    window.addEventListener("click", unlock, { passive: true, capture: true });

    if (typeof document !== "undefined") {
      document.addEventListener("pointerdown", unlock, { passive: true, capture: true });
      document.addEventListener("keydown", unlock, { passive: true, capture: true });
      document.addEventListener("touchstart", unlock, { passive: true, capture: true });
      document.addEventListener("click", unlock, { passive: true, capture: true });
    }

    if (typeof ctx.addEventListener === "function") {
      ctx.addEventListener("statechange", () => {
        if (ctx.state === "running") {
          onAudioReady();
        }
      });
    }

    // Focus / Visibility shielding
    const handleFocus = (hasFocus) => {
      const continueOnBlur = audioConfig.get('continueAudioOnLostFocus');
      if (continueOnBlur) {
        master.setActive(true);
      } else {
        if (!hasFocus) {
          master.setActive(false);
          subsystemState.slotPool.silenceAll();
          audioEngine.stateEngine.silenceAll();
        } else {
          // Regaining focus without background audio permitted:
          // Immediately flush output and clear all voice slots to avoid audio pops
          master.flush();
          subsystemState.slotPool.silenceAll();
          audioEngine.stateEngine.silenceAll();
          master.setActive(true);
        }
      }
    };
    window.addEventListener("focus", () => handleFocus(true));
    window.addEventListener("blur", () => handleFocus(false));
    document.addEventListener("visibilitychange", () => {
      handleFocus(!document.hidden);
    });

    audioConfig.subscribe((cfg) => {
      master.setVolume(cfg.masterVolume ?? 1.0);
    });
  }
  return subsystemState.context;
}

export function getMasterAudioInput() {
  getAudioContext();
  return subsystemState.masterMixer ? subsystemState.masterMixer.input : null;
}

export function getAudioSlotPool() {
  getAudioContext();
  return subsystemState.slotPool;
}

export function setAudioSlotPool(pool) {
  subsystemState.slotPool = pool;
}


// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4a. BallAudioEmitter: Real-time 3D Ball Spatial Audio & State Loops
// ---------------------------------------------------------------------------
export const BALL_AUDIO_CONFIG = Object.freeze({
  FLYING_FADE_OUT_SECONDS: 0.08, // Configurable short fade-out (50ms - 100ms)
  FLYING_DOWNWARD_VZ_THRESHOLD: -25.0, // Downward vertical velocity component threshold in UU/s
  FLYING_MIN_HEIGHT: 25.0, // Minimum height above ground to be considered airborne
  ROLLING_SPEED_THRESHOLD: 25.0, // Minimum surface rolling speed in UU/s
  ROLLING_FADE_OUT_SECONDS: 0.05 // 50ms fast fade out when leaving surface
});

export class BallAudioEmitter {
  constructor(context = null, destinationNode = null) {
    this.context = context;
    this.destinationNode = destinationNode;
    this.position = { x: 0, y: 0, z: 0 };
    this._scratchAudioPos = { x: 0, y: 0, z: 0 };
    this.initialized = false;

    this.ballPanner = null;
    this.rollingGain = null;
    this.rollingSource = null;
    this.flyingGain = null;
    this.flyingSource = null;

    this.ballRollingBuffer = null;
    this.ballFlyingBuffer = null;

    this._wasFallingDownward = false;
    this._wasRolling = false;
    this._lastPos = { x: 0, y: 0, z: 0 };
    this._lastTime = 0;
  }

  init(buffers = {}) {
    if (buffers.ballRolling) this.ballRollingBuffer = buffers.ballRolling;
    if (buffers.ballFlying) this.ballFlyingBuffer = buffers.ballFlying;

    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    this.context = ctx;
    const dest = this.destinationNode || getMasterAudioInput();

    if (!this.initialized) {
      // 3D Spatial Panner dedicated to the ball (equalpower preserves crisp audio spectrum)
      this.ballPanner = ctx.createPanner();
      this.ballPanner.panningModel = 'equalpower';
      this.ballPanner.distanceModel = 'inverse';
      this.ballPanner.rolloffFactor = 0;
      this.ballPanner.coneInnerAngle = 360;
      this.ballPanner.coneOuterAngle = 360;
      this.ballPanner.channelCount = 1;
      this.ballPanner.channelCountMode = 'explicit';
      this.ballPanner.channelInterpretation = 'speakers';
      if (dest) this.ballPanner.connect(dest);

      // Rolling loop pipeline
      this.rollingGain = ctx.createGain();
      this.rollingGain.gain.setValueAtTime(0, ctx.currentTime);
      this.rollingGain.connect(this.ballPanner);

      // Flying loop pipeline
      this.flyingGain = ctx.createGain();
      this.flyingGain.gain.setValueAtTime(0, ctx.currentTime);
      this.flyingGain.connect(this.ballPanner);

      this.initialized = true;
    }

    this._startLoops();
  }

  _startLoops() {
    const ctx = this.context || getAudioContext();
    if (!this.initialized || !ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (this.ballRollingBuffer && !this.rollingSource) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.ballRollingBuffer;
        src.loop = true;
        src.connect(this.rollingGain);
        src.start(now);
        src.onended = () => { if (this.rollingSource === src) this.rollingSource = null; };
        this.rollingSource = src;
      } catch (e) {}
    }

    if (this.ballFlyingBuffer && !this.flyingSource) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.ballFlyingBuffer;
        src.loop = true;
        src.connect(this.flyingGain);
        src.start(now);
        src.onended = () => { if (this.flyingSource === src) this.flyingSource = null; };
        this.flyingSource = src;
      } catch (e) {}
    }
  }

  silenceAll() {
    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (this.rollingGain) {
        this.rollingGain.gain.cancelScheduledValues(now);
        this.rollingGain.gain.setValueAtTime(0, now);
      }
      if (this.flyingGain) {
        this.flyingGain.gain.cancelScheduledValues(now);
        this.flyingGain.gain.setValueAtTime(0, now);
      }
    } catch (e) {}
    this._wasFallingDownward = false;
    this._wasRolling = false;
  }

  update(ballMeshOrView, camera, physics) {
    if (!this.initialized) return;
    if ((this.ballRollingBuffer && !this.rollingSource) || (this.ballFlyingBuffer && !this.flyingSource)) {
      this._startLoops();
    }
    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (!ballMeshOrView) {
      this.silenceAll();
      return;
    }

    // 1. Position extraction: Map to RocketSim coords (px: width, py: length, pz: height)
    let px = 0, py = 0, pz = 93.15;
    if (ballMeshOrView.position) {
      // Three.js coordinates (X: width, Y: height, Z: length)
      px = ballMeshOrView.position.x;
      py = ballMeshOrView.position.z;
      pz = ballMeshOrView.position.y;
    } else if (Number.isFinite(ballMeshOrView.posX) && Number.isFinite(ballMeshOrView.posY) && Number.isFinite(ballMeshOrView.posZ)) {
      px = ballMeshOrView.posX;
      py = ballMeshOrView.posY;
      pz = ballMeshOrView.posZ;
    } else if (physics?.ballState) {
      px = physics.ballState.posX ?? 0;
      py = physics.ballState.posY ?? 0;
      pz = physics.ballState.posZ ?? 93.15;
    }

    // 2. Velocity extraction (Live from physics engine)
    let vx = 0, vy = 0, vz = 0;
    if (physics?.ballState) {
      vx = physics.ballState.velX ?? 0;
      vy = physics.ballState.velY ?? 0;
      vz = physics.ballState.velZ ?? 0;
    } else if (ballMeshOrView.velX !== undefined) {
      vx = ballMeshOrView.velX;
      vy = ballMeshOrView.velY;
      vz = ballMeshOrView.velZ;
    } else if (ballMeshOrView.velocity) {
      vx = ballMeshOrView.velocity.x ?? 0;
      vy = ballMeshOrView.velocity.z ?? 0;
      vz = ballMeshOrView.velocity.y ?? 0;
    } else if (this._lastTime > 0) {
      const dt = Math.max(0.001, now - this._lastTime);
      vx = (px - this._lastPos.x) / dt;
      vy = (py - this._lastPos.y) / dt;
      vz = (pz - this._lastPos.z) / dt;
    }
    this._lastPos.x = px;
    this._lastPos.y = py;
    this._lastPos.z = pz;
    this._lastTime = now;

    // 3. Update spatial panner position in real time
    // Convert RocketSim coords to Web Audio / Three.js audio coords (X, Z->Y, Y->Z)
    const audioPos = toAudioCoordinates(this._scratchAudioPos, { posX: px, posY: py, posZ: pz });
    let distAtten = 1.0;
    if (audioPos && listenerManager.hasListener) {
      const dx = audioPos.x - listenerManager.position.x;
      const dy = audioPos.y - listenerManager.position.y;
      const dz = audioPos.z - listenerManager.position.z;
      const dist = Math.hypot(dx, dy, dz);
      distAtten = calculateIncidentDistanceGain(dist);

      if (this.ballPanner) {
        if (this.ballPanner.positionX) {
          this.ballPanner.positionX.setValueAtTime(audioPos.x, now);
          this.ballPanner.positionY.setValueAtTime(audioPos.y, now);
          this.ballPanner.positionZ.setValueAtTime(audioPos.z, now);
        } else if (typeof this.ballPanner.setPosition === 'function') {
          this.ballPanner.setPosition(audioPos.x, audioPos.y, audioPos.z);
        }
      }
    }

    const master = audioConfig.get('masterVolume');
    const rollingSettingVol = audioConfig.get('ballRollingVolume');
    const flyingSettingVol = audioConfig.get('ballFlyingVolume');

    // 4. Surface contact detection (floor: 93.15, ceiling: 2048, sidewalls: ±4096, endwalls: ±5120)
    const isOnGround = physics ? (Boolean(physics.ballOnGround) || (typeof physics.getBallOnGround === 'function' && physics.getBallOnGround())) : false;
    const heightAboveFloor = pz - 93.15;
    const isNearFloor = heightAboveFloor <= 15.0;
    const isNearCeiling = pz >= (2048 - 93.15 - 20.0);
    const isNearSideWall = Math.abs(px) >= (4096 - 93.15 - 20.0);
    const isNearEndWall = Math.abs(py) >= (5120 - 93.15 - 20.0);
    const isContactingSurface = isOnGround || isNearFloor || isNearCeiling || isNearSideWall || isNearEndWall;

    const totalSpeed = Math.hypot(vx, vy, vz);
    const surfaceSpeed = Math.hypot(vx, vy);

    // 5. Rolling audio logic:
    // Plays when ball is in contact with surface and rolling
    let targetRollingGain = 0;
    if (isContactingSurface && (totalSpeed > BALL_AUDIO_CONFIG.ROLLING_SPEED_THRESHOLD || surfaceSpeed > BALL_AUDIO_CONFIG.ROLLING_SPEED_THRESHOLD)) {
      const speedFactor = Math.min(1.0, Math.max(0.1, totalSpeed / 1800.0));
      targetRollingGain = rollingSettingVol * master * distAtten * speedFactor;
      if (this.rollingSource && this.rollingSource.playbackRate) {
        const rate = 0.85 + 0.35 * Math.min(1.0, totalSpeed / 2000.0);
        this.rollingSource.playbackRate.setValueAtTime(rate, now);
      }
    }

    try {
      if (this.rollingGain) {
        if (targetRollingGain > 0) {
          this.rollingGain.gain.setTargetAtTime(targetRollingGain, now, 0.04);
        } else if (this._wasRolling) {
          this.rollingGain.gain.cancelScheduledValues(now);
          this.rollingGain.gain.setValueAtTime(this.rollingGain.gain.value, now);
          this.rollingGain.gain.linearRampToValueAtTime(0, now + BALL_AUDIO_CONFIG.ROLLING_FADE_OUT_SECONDS);
        } else {
          this.rollingGain.gain.setTargetAtTime(0, now, 0.04);
        }
      }
    } catch (e) {}
    this._wasRolling = targetRollingGain > 0;

    // 6. Flying (downward aerial fall) audio logic:
    const isAirborne = !isContactingSurface && heightAboveFloor > BALL_AUDIO_CONFIG.FLYING_MIN_HEIGHT;
    const isFallingDownward = isAirborne && (vz < BALL_AUDIO_CONFIG.FLYING_DOWNWARD_VZ_THRESHOLD);

    try {
      if (this.flyingGain) {
        if (isFallingDownward) {
          const fallSpeedFactor = Math.min(1.0, Math.max(0.15, Math.abs(vz) / 1400.0));
          const targetFlyingGain = flyingSettingVol * master * distAtten * fallSpeedFactor;
          this.flyingGain.gain.cancelScheduledValues(now);
          this.flyingGain.gain.setTargetAtTime(targetFlyingGain, now, 0.04);
          if (this.flyingSource && this.flyingSource.playbackRate) {
            const rate = 0.9 + 0.3 * Math.min(1.0, Math.abs(vz) / 2000.0);
            this.flyingSource.playbackRate.setValueAtTime(rate, now);
          }
        } else if (this._wasFallingDownward && !isFallingDownward) {
          // Immediately fade out over short duration (80ms)
          this.flyingGain.gain.cancelScheduledValues(now);
          this.flyingGain.gain.setValueAtTime(this.flyingGain.gain.value, now);
          this.flyingGain.gain.linearRampToValueAtTime(0, now + BALL_AUDIO_CONFIG.FLYING_FADE_OUT_SECONDS);
        } else if (!isFallingDownward && this.flyingGain.gain.value > 0.001) {
          this.flyingGain.gain.cancelScheduledValues(now);
          this.flyingGain.gain.linearRampToValueAtTime(0, now + BALL_AUDIO_CONFIG.FLYING_FADE_OUT_SECONDS);
        }
      }
    } catch (e) {}
    this._wasFallingDownward = isFallingDownward;
  }
}


// 4. Category 1: StateAudioEngine (Continuous State Loops)
// ---------------------------------------------------------------------------
export class StateAudioEngine {
  constructor() {
    this.ballEmitter = new BallAudioEmitter();
    this.supersonicBuffer = null;
    this.supersonicSource = null;
    this.supersonicGain = null;
    this.supersonicPanner = null;

    this.boostBuffer = null;
    this.boostSource = null;
    this.boostGain = null;
    this.boostPanner = null;

    this.initialized = false;
    this.isPlaying = false;
  }

  get ballRollingBuffer() { return this.ballEmitter?.ballRollingBuffer ?? null; }
  set ballRollingBuffer(val) { if (this.ballEmitter) this.ballEmitter.ballRollingBuffer = val; }

  get ballFlyingBuffer() { return this.ballEmitter?.ballFlyingBuffer ?? null; }
  set ballFlyingBuffer(val) { if (this.ballEmitter) this.ballEmitter.ballFlyingBuffer = val; }

  get rollingSource() { return this.ballEmitter?.rollingSource ?? null; }
  set rollingSource(val) { if (this.ballEmitter) this.ballEmitter.rollingSource = val; }

  get flyingSource() { return this.ballEmitter?.flyingSource ?? null; }
  set flyingSource(val) { if (this.ballEmitter) this.ballEmitter.flyingSource = val; }

  get rollingGain() { return this.ballEmitter?.rollingGain ?? null; }
  set rollingGain(val) { if (this.ballEmitter) this.ballEmitter.rollingGain = val; }

  get flyingGain() { return this.ballEmitter?.flyingGain ?? null; }
  set flyingGain(val) { if (this.ballEmitter) this.ballEmitter.flyingGain = val; }

  get ballPanner() { return this.ballEmitter?.ballPanner ?? null; }
  set ballPanner(val) { if (this.ballEmitter) this.ballEmitter.ballPanner = val; }

  get rollingPanner() { return this.ballEmitter?.ballPanner ?? null; }
  set rollingPanner(val) { if (this.ballEmitter) this.ballEmitter.ballPanner = val; }

  get flyingPanner() { return this.ballEmitter?.ballPanner ?? null; }
  set flyingPanner(val) { if (this.ballEmitter) this.ballEmitter.ballPanner = val; }

  init(buffers = {}) {
    const ctx = getAudioContext();
    const dest = getMasterAudioInput();
    if (!ctx) return;

    this.ballEmitter.init(buffers);

    if (!this.initialized) {
      // Supersonic loop pipeline
      this.supersonicGain = ctx.createGain();
      this.supersonicGain.gain.setValueAtTime(0, ctx.currentTime);
      if (typeof ctx.createStereoPanner === "function") {
        this.supersonicPanner = ctx.createStereoPanner();
        this.supersonicGain.connect(this.supersonicPanner);
        if (dest) this.supersonicPanner.connect(dest);
      } else {
        if (dest) this.supersonicGain.connect(dest);
      }

      // Boost loop pipeline
      this.boostGain = ctx.createGain();
      this.boostGain.gain.setValueAtTime(0, ctx.currentTime);
      if (typeof ctx.createStereoPanner === "function") {
        this.boostPanner = ctx.createStereoPanner();
        this.boostGain.connect(this.boostPanner);
        if (dest) this.boostPanner.connect(dest);
      } else {
        if (dest) this.boostGain.connect(dest);
      }

      this.initialized = true;
    }

    if (buffers.ballRolling) this.ballRollingBuffer = buffers.ballRolling;
    if (buffers.ballFlying) this.ballFlyingBuffer = buffers.ballFlying;
    if (buffers.supersonicLoop || buffers.supersonic) this.supersonicBuffer = buffers.supersonicLoop || buffers.supersonic;
    if (buffers.boostLoop || buffers.boost) this.boostBuffer = buffers.boostLoop || buffers.boost;

    this._startLoops();
  }

  _startLoops() {
    const ctx = getAudioContext();
    if (!this.initialized || !ctx || ctx.state === "closed") return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Ball loop management delegated to BallAudioEmitter
    if (this.ballEmitter && typeof this.ballEmitter._startLoops === "function") {
      this.ballEmitter._startLoops();
    }

    if (this.supersonicBuffer && !this.supersonicSource) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.supersonicBuffer;
        src.loop = true;
        src.connect(this.supersonicGain);
        src.start(now);
        src.onended = () => { if (this.supersonicSource === src) this.supersonicSource = null; };
        this.supersonicSource = src;
      } catch (e) {}
    }

    if (this.boostBuffer && !this.boostSource) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.boostBuffer;
        src.loop = true;
        src.connect(this.boostGain);
        src.start(now);
        src.onended = () => { if (this.boostSource === src) this.boostSource = null; };
        this.boostSource = src;
      } catch (e) {}
    }

    this.isPlaying = Boolean(
      (this.rollingSource || !this.ballRollingBuffer) &&
      (this.flyingSource || !this.ballFlyingBuffer) &&
      (this.supersonicSource || !this.supersonicBuffer) &&
      (this.boostSource || !this.boostBuffer) &&
      (this.rollingSource || this.flyingSource || this.supersonicSource || this.boostSource)
    );
  }

  silenceAll() {
    this.ballEmitter.silenceAll();
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (this.supersonicGain) {
        this.supersonicGain.gain.cancelScheduledValues(now);
        this.supersonicGain.gain.setValueAtTime(0, now);
      }
      if (this.boostGain) {
        this.boostGain.gain.cancelScheduledValues(now);
        this.boostGain.gain.setValueAtTime(0, now);
      }
    } catch (e) {}
  }

  /**
   * Continuous ball rolling & falling state monitoring (delegated to real-time 3D BallAudioEmitter).
   */
  updateBallAudio(ballViewOrMesh, camera, physics) {
    if (!this.initialized) return;
    this.ballEmitter.update(ballViewOrMesh, camera, physics);
  }

  /**
   * Continuous Supersonic loop audio state monitoring.
   */
  updateSupersonic(isSupersonic, isMatchActive = true) {
    if (!this.initialized) return;
    if (this.supersonicBuffer && !this.supersonicSource) this._startLoops();
    const ctx = getAudioContext();
    if (!ctx || !this.supersonicGain) return;

    const now = ctx.currentTime;
    const master = audioConfig.get('masterVolume');
    const supersonicVol = audioConfig.get('supersonicVolume');
    const targetGain = (isSupersonic && isMatchActive) ? Math.max(0, Math.min(5.0, supersonicVol * master * 0.75)) : 0;

    try {
      this.supersonicGain.gain.setTargetAtTime(targetGain, now, 0.05);
    } catch (e) {}
  }

  /**
   * Continuous Boost loop audio state monitoring.
   * State-driven: plays when isBoosting is true, immediately stops (gain = 0) when false.
   */
  updateBoost(isBoosting, isMatchActive = true) {
    if (!this.initialized) return;
    if (this.boostBuffer && !this.boostSource) this._startLoops();
    const ctx = getAudioContext();
    if (!ctx || !this.boostGain) return;

    const now = ctx.currentTime;
    const master = audioConfig.get('masterVolume') ?? 1.0;
    const boostVol = audioConfig.get('boostLoopVolume') ?? audioConfig.get('boostVolume') ?? 0.8;
    const shouldPlay = Boolean(isBoosting && isMatchActive);

    try {
      this.boostGain.gain.cancelScheduledValues(now);
      if (shouldPlay) {
        const targetGain = Math.max(0, Math.min(5.0, boostVol * master));
        this.boostGain.gain.setValueAtTime(targetGain, now);
      } else {
        // Immediately silence on boost release
        this.boostGain.gain.setValueAtTime(0, now);
      }
    } catch (e) {}
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4b. VehicleAudioEmitter & VehicleAudioManager: Multi-car Real-time Audio
// ---------------------------------------------------------------------------
export class VehicleAudioEmitter {
  constructor(carIndex, context = null, destinationNode = null) {
    this.carIndex = carIndex;
    this.context = context;
    this.destinationNode = destinationNode;
    this.isSelf = false;
    this.position = { x: 0, y: 0, z: 0 };
    this._scratchAudioPos = { x: 0, y: 0, z: 0 };
    this.initialized = false;

    // Web Audio node chain
    this.inputGain = null;
    this.panner3D = null;
    this.selfGain = null;
    this.distanceGain = null;

    // Continuous loop pipelines
    this.boostLoopSource = null;
    this.boostLoopGain = null;
    this.supersonicLoopSource = null;
    this.supersonicLoopGain = null;

    this.boostLoopBuffer = null;
    this.supersonicLoopBuffer = null;

    // Track active one-shot source nodes
    this.activeSources = new Set();

    this.init();
  }

  init() {
    if (this.initialized) return;
    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    this.context = ctx;
    const dest = this.destinationNode || getMasterAudioInput();

    // 1. Spatial Panner for remote / opponent cars (equalpower for zero high-frequency coloration)
    this.panner3D = ctx.createPanner();
    this.panner3D.panningModel = 'equalpower';
    this.panner3D.distanceModel = 'inverse';
    this.panner3D.rolloffFactor = 0;
    this.panner3D.coneInnerAngle = 360;
    this.panner3D.coneOuterAngle = 360;
    this.panner3D.channelCount = 1;
    this.panner3D.channelCountMode = 'explicit';
    this.panner3D.channelInterpretation = 'speakers';

    // Intermediate gain for distance attenuation
    this.distanceGain = ctx.createGain();
    this.distanceGain.gain.setValueAtTime(1.0, ctx.currentTime);
    this.panner3D.connect(this.distanceGain);
    if (dest) this.distanceGain.connect(dest);

    // 2. Direct Self-Vehicle bus for local active player car:
    // Centered, punchy, crisp, invariant level (never lags behind during fast dodges/flips)
    this.selfGain = ctx.createGain();
    this.selfGain.gain.setValueAtTime(1.0, ctx.currentTime);
    if (dest) this.selfGain.connect(dest);

    // 3. Central input node for all vehicle audio sources
    this.inputGain = ctx.createGain();
    this.inputGain.gain.setValueAtTime(1.0, ctx.currentTime);
    if (this.isSelf) {
      this.inputGain.connect(this.selfGain);
    } else {
      this.inputGain.connect(this.panner3D);
    }

    // 4. Boost loop pipeline -> inputGain
    this.boostLoopGain = ctx.createGain();
    this.boostLoopGain.gain.setValueAtTime(0, ctx.currentTime);
    this.boostLoopGain.connect(this.inputGain);

    // 5. Supersonic loop pipeline -> inputGain
    this.supersonicLoopGain = ctx.createGain();
    this.supersonicLoopGain.gain.setValueAtTime(0, ctx.currentTime);
    this.supersonicLoopGain.connect(this.inputGain);

    this.initialized = true;
    this._startLoops();
  }

  setSelf(isSelf) {
    const val = Boolean(isSelf);
    if (this.isSelf === val) return;
    this.isSelf = val;
    if (!this.inputGain) return;
    try {
      this.inputGain.disconnect();
      if (this.isSelf) {
        if (this.selfGain) this.inputGain.connect(this.selfGain);
      } else {
        if (this.panner3D) this.inputGain.connect(this.panner3D);
      }
    } catch (e) {}
  }

  setBuffers({ boostLoop, supersonicLoop }) {
    if (boostLoop) this.boostLoopBuffer = boostLoop;
    if (supersonicLoop) this.supersonicLoopBuffer = supersonicLoop;
    this._startLoops();
  }

  _startLoops() {
    const ctx = this.context || getAudioContext();
    if (!this.initialized || !ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (this.boostLoopBuffer && !this.boostLoopSource) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.boostLoopBuffer;
        src.loop = true;
        src.connect(this.boostLoopGain);
        src.start(now);
        src.onended = () => { if (this.boostLoopSource === src) this.boostLoopSource = null; };
        this.boostLoopSource = src;
      } catch (e) {}
    }

    if (this.supersonicLoopBuffer && !this.supersonicLoopSource) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.supersonicLoopBuffer;
        src.loop = true;
        src.connect(this.supersonicLoopGain);
        src.start(now);
        src.onended = () => { if (this.supersonicLoopSource === src) this.supersonicLoopSource = null; };
        this.supersonicLoopSource = src;
      } catch (e) {}
    }
  }

  updatePosition(pos) {
    if (!pos) return;
    const audioPos = toAudioCoordinates(this._scratchAudioPos, pos);
    if (!audioPos) return;

    this.position.x = audioPos.x;
    this.position.y = audioPos.y;
    this.position.z = audioPos.z;

    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (!this.isSelf && this.panner3D) {
      try {
        if (this.panner3D.positionX) {
          this.panner3D.positionX.setValueAtTime(audioPos.x, now);
          this.panner3D.positionY.setValueAtTime(audioPos.y, now);
          this.panner3D.positionZ.setValueAtTime(audioPos.z, now);
        } else if (typeof this.panner3D.setPosition === 'function') {
          this.panner3D.setPosition(audioPos.x, audioPos.y, audioPos.z);
        }

        if (listenerManager.hasListener && this.distanceGain) {
          const dx = audioPos.x - listenerManager.position.x;
          const dy = audioPos.y - listenerManager.position.y;
          const dz = audioPos.z - listenerManager.position.z;
          const dist = Math.hypot(dx, dy, dz);
          const atten = calculateIncidentDistanceGain(dist);
          this.distanceGain.gain.setValueAtTime(atten, now);
        }
      } catch (e) {}
    } else if (this.isSelf && this.selfGain) {
      const master = audioConfig.get('masterVolume');
      const selfVol = audioConfig.get('vehicleSelfVolume');
      this.selfGain.gain.setValueAtTime(master * selfVol, now);
    }
  }

  updateState({ isBoosting = false, isSupersonic = false, isAlive = true, audible = true }) {
    if (!this.initialized) return;
    if ((this.boostLoopBuffer && !this.boostLoopSource) || (this.supersonicLoopBuffer && !this.supersonicLoopSource)) {
      this._startLoops();
    }
    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const master = audioConfig.get('masterVolume');
    const selfMult = this.isSelf ? audioConfig.get('vehicleSelfVolume') : 1.0;

    if (this.boostLoopGain) {
      const boostSettingVol = audioConfig.get('boostLoopVolume') * audioConfig.get('boostVolume');
      const targetBoostGain = (isBoosting && isAlive && audible) ? (boostSettingVol * master * selfMult) : 0;
      try {
        this.boostLoopGain.gain.setTargetAtTime(targetBoostGain, now, 0.035);
      } catch (e) {}
    }

    if (this.supersonicLoopGain) {
      const superSettingVol = audioConfig.get('supersonicVolume');
      const targetSuperGain = (isSupersonic && isAlive && audible) ? (superSettingVol * master * selfMult) : 0;
      try {
        this.supersonicLoopGain.gain.setTargetAtTime(targetSuperGain, now, 0.05);
      } catch (e) {}
    }
  }

  playAction(buffer, options = {}) {
    if (!buffer) return;
    const ctx = this.context || getAudioContext();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const baseVolume = options.volume ?? 1.0;
    const playbackRate = options.playbackRate ?? 1.0;

    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.setValueAtTime(playbackRate, now);

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(baseVolume, now);

      src.connect(voiceGain);
      voiceGain.connect(this.inputGain);

      src.start(now);
      this.activeSources.add(src);
      src.onended = () => {
        this.activeSources.delete(src);
        try {
          src.disconnect();
          voiceGain.disconnect();
        } catch (e) {}
      };
    } catch (e) {}
  }

  silenceAll() {
    const ctx = this.context || getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (this.boostLoopGain) {
        this.boostLoopGain.gain.cancelScheduledValues(now);
        this.boostLoopGain.gain.setValueAtTime(0, now);
      }
      if (this.supersonicLoopGain) {
        this.supersonicLoopGain.gain.cancelScheduledValues(now);
        this.supersonicLoopGain.gain.setValueAtTime(0, now);
      }
      for (const src of this.activeSources) {
        try { src.stop(now); src.disconnect(); } catch (e) {}
      }
      this.activeSources.clear();
    } catch (e) {}
  }

  dispose() {
    this.silenceAll();
    try {
      if (this.boostLoopSource) { this.boostLoopSource.stop(); this.boostLoopSource.disconnect(); }
      if (this.supersonicLoopSource) { this.supersonicLoopSource.stop(); this.supersonicLoopSource.disconnect(); }
      this.inputGain?.disconnect();
      this.panner3D?.disconnect();
      this.distanceGain?.disconnect();
      this.selfGain?.disconnect();
    } catch (e) {}
  }
}

export class VehicleAudioManager {
  constructor() {
    this.emitters = new Map();
    this.buffers = {
      jump: [],
      doubleJump: [],
      dodge: [],
      boostStart: null,
      boostLoop: null,
      boostRelease: null,
      supersonicEnter: [],
      supersonicLoop: null,
      reset: null,
      wheelImpact: [],
      carCollision: null
    };

    this.lastJumpSoundIdx = -1;
    this.lastDoubleJumpSoundIdx = -1;
    this.lastDodgeSoundIdx = -1;
    this.lastSupersonicEnterSoundIdx = -1;
    this.lastWheelImpactSoundIdx = -1;
    this.activeCarIndex = 0;
  }

  getEmitter(carIndex = 0) {
    if (!this.emitters.has(carIndex)) {
      const emitter = new VehicleAudioEmitter(carIndex);
      emitter.setSelf(carIndex === this.activeCarIndex);
      emitter.setBuffers({
        boostLoop: this.buffers.boostLoop,
        supersonicLoop: this.buffers.supersonicLoop
      });
      this.emitters.set(carIndex, emitter);
    }
    return this.emitters.get(carIndex);
  }

  setBuffers(bufs = {}) {
    Object.assign(this.buffers, bufs);
    for (const emitter of this.emitters.values()) {
      emitter.setBuffers({
        boostLoop: this.buffers.boostLoop,
        supersonicLoop: this.buffers.supersonicLoop
      });
    }
  }

  update({ activeCarIndex = 0, numCars = 1, getCarPos = null, getCarState = null, isMatchActive = true, hasBlockingOverlay = false, continueOnBlur = false, isHidden = false }) {
    this.activeCarIndex = activeCarIndex;
    const totalCars = Math.max(1, numCars);

    for (let i = 0; i < totalCars; i++) {
      const emitter = this.getEmitter(i);
      const isSelf = (i === activeCarIndex);
      emitter.setSelf(isSelf);

      if (getCarPos) {
        const pos = getCarPos(i);
        if (pos) emitter.updatePosition(pos);
      }

      const carState = getCarState ? getCarState(i) : null;
      const isBoosting = Boolean(carState?.isBoosting);
      const isSupersonic = Boolean(carState?.isSupersonic);
      const isAlive = !carState?.isDemoed;
      const audible = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));

      emitter.updateState({
        isBoosting,
        isSupersonic,
        isAlive,
        audible
      });
    }
  }

  handleCarEvent(event) {
    if (!event) return;
    const carIndex = event.carIndex ?? event.primaryId ?? 0;
    const emitter = this.getEmitter(carIndex);
    if (event.posX !== undefined || event.x !== undefined) {
      emitter.updatePosition(event);
    }

    const master = audioConfig.get('masterVolume');
    const selfMult = emitter.isSelf ? audioConfig.get('vehicleSelfVolume') : 1.0;

    const actionSubType = event.actionSubType ?? event.subType ?? 0;

    switch (event.type) {
      case INCIDENT_EVENT_TYPES.CAR_JUMP:
      case 0x06: {
        const vol = audioConfig.get('jumpVolume') * master * selfMult;
        const list = this.buffers.jump;
        if (list && list.length > 0) {
          let idx = Math.floor(Math.random() * list.length);
          if (list.length > 1 && idx === this.lastJumpSoundIdx) idx = (idx + 1) % list.length;
          this.lastJumpSoundIdx = idx;
          emitter.playAction(list[idx], { volume: vol });
        } else if (this.buffers.carCollision) {
          emitter.playAction(this.buffers.carCollision, { volume: vol * 0.4, playbackRate: 1.4 });
        }
        break;
      }

      case INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP:
      case 0x07: {
        const vol = audioConfig.get('doubleJumpVolume') * master * selfMult;
        const list = this.buffers.doubleJump;
        if (list && list.length > 0) {
          let idx = Math.floor(Math.random() * list.length);
          if (list.length > 1 && idx === this.lastDoubleJumpSoundIdx) idx = (idx + 1) % list.length;
          this.lastDoubleJumpSoundIdx = idx;
          emitter.playAction(list[idx], { volume: vol });
        } else if (this.buffers.carCollision) {
          emitter.playAction(this.buffers.carCollision, { volume: vol * 0.4, playbackRate: 1.7 });
        }
        break;
      }

      case INCIDENT_EVENT_TYPES.CAR_DODGE:
      case 0x08: {
        const vol = audioConfig.get('dodgeVolume') * master * selfMult;
        const list = this.buffers.dodge;
        if (list && list.length > 0) {
          let idx = Math.floor(Math.random() * list.length);
          if (list.length > 1 && idx === this.lastDodgeSoundIdx) idx = (idx + 1) % list.length;
          this.lastDodgeSoundIdx = idx;
          emitter.playAction(list[idx], { volume: vol });
        } else if (this.buffers.carCollision) {
          emitter.playAction(this.buffers.carCollision, { volume: vol * 0.4, playbackRate: 1.2 });
        }
        break;
      }

      case PHYSICS_EVENT_TYPES.CAR_ACTION: {
        if (actionSubType === 1) { // SINGLE_JUMP
          this.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_JUMP });
        } else if (actionSubType === 2) { // DOUBLE_JUMP
          this.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP });
        } else if (actionSubType === 3) { // DODGE
          this.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_DODGE });
        }
        break;
      }

      case INCIDENT_EVENT_TYPES.CAR_BOOST_START:
      case 0x0B: {
        const vol = audioConfig.get('boostVolume') * audioConfig.get('boostStartStopVolume') * master * selfMult;
        const buf = this.buffers.boostStart || this.buffers.boostLoop;
        if (buf) {
          emitter.playAction(buf, { volume: vol });
        }
        break;
      }

      case INCIDENT_EVENT_TYPES.CAR_BOOST_STOP:
      case 0x0C: {
        const vol = audioConfig.get('boostVolume') * audioConfig.get('boostStartStopVolume') * master * selfMult * 0.8;
        const buf = this.buffers.boostRelease;
        if (buf) {
          emitter.playAction(buf, { volume: vol });
        }
        break;
      }

      case INCIDENT_EVENT_TYPES.CAR_SUPERSONIC_ENTER:
      case PHYSICS_EVENT_TYPES.CAR_SUPERSONIC_ENTER:
      case 0x0A: {
        const vol = audioConfig.get('supersonicVolume') * master * selfMult;
        const enterList = this.buffers.supersonicEnter;
        if (enterList && enterList.length > 0) {
          let idx = Math.floor(Math.random() * enterList.length);
          if (enterList.length > 1 && idx === this.lastSupersonicEnterSoundIdx) idx = (idx + 1) % enterList.length;
          this.lastSupersonicEnterSoundIdx = idx;
          emitter.playAction(enterList[idx], { volume: vol });
        } else if (this.buffers.supersonicLoop) {
          emitter.playAction(this.buffers.supersonicLoop, { volume: vol, playbackRate: 1.1 });
        }
        break;
      }

      case INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED:
      case PHYSICS_EVENT_TYPES.FLIP_RESET_GAINED:
      case 0x0F:
      case 0x0D: {
        const vol = audioConfig.get('flipResetVolume') * master * selfMult;
        if (this.buffers.reset) {
          emitter.playAction(this.buffers.reset, { volume: vol, playbackRate: 1.0 });
        } else {
          console.error('[AudioArchitecture] Missing flip reset audio asset (buffers.reset is null or empty)!', {
            carIndex,
            eventType: event.type
          });
        }
        break;
      }

      default:
        break;
    }
  }

  silenceAll() {
    for (const emitter of this.emitters.values()) {
      emitter.silenceAll();
    }
  }
}


// 5. Category 2: IncidentAudioEngine (Discrete Physics Incidents)
// ---------------------------------------------------------------------------
export class IncidentAudioEngine {
  constructor(vehicleManager = null) {
    this.vehicleManager = vehicleManager;
    this.buffers = {
      ballHit: [],
      sidewallHit: [],
      carCollision: null,
      goalpost: null,
      boostCollect: null,
      goalScored: null,
      supersonic: null,
      jump: [],
      doubleJump: [],
      dodge: [],
      reset: null,
      wheelImpact: [],
      groundHit: [],
      boostStart: null,
      boostRelease: null,
      supersonicEnter: []
    };

    this.lastCarBallHitTimestamp = 0;
    this.lastBallWorldHitTimestamp = 0;
    this.lastGoalpostHitTimestamp = 0;
    this.lastCarCollisionTimestamp = 0;
    this.lastBallHitSoundIdx = -1;
    this.lastSidewallHitSoundIdx = -1;
    this.lastGroundHitSoundIdx = -1;
    this.lastJumpSoundIdx = -1;
    this.lastDoubleJumpSoundIdx = -1;
    this.lastDodgeSoundIdx = -1;
    this.lastWheelImpactSoundIdx = -1;
    this.lastSupersonicEnterSoundIdx = -1;
  }

  setBuffers(bufs) {
    Object.assign(this.buffers, bufs);
  }

  handleEvent(event, camera = null) {
    if (!event) return;
    const type = event.type;

    switch (type) {
      case INCIDENT_EVENT_TYPES.CAR_BALL_HIT:
      case PHYSICS_EVENT_TYPES.CAR_BALL_HIT:
        this.handleCarBallHit(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.CAR_CAR_BUMP:
      case INCIDENT_EVENT_TYPES.CAR_CAR_COLLISION:
      case PHYSICS_EVENT_TYPES.CAR_CAR_COLLISION:
        this.handleCarCarCollision(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.CAR_CAR_DEMO:
      case PHYSICS_EVENT_TYPES.CAR_DEMO:
        this.handleCarCarDemo(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.BALL_WORLD_HIT:
      case PHYSICS_EVENT_TYPES.BALL_WORLD_HIT:
        this.handleBallWorldHit(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT:
      case PHYSICS_EVENT_TYPES.BALL_GOALPOST_HIT:
        this.handleBallGoalpostHit(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.CAR_JUMP:
      case INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP:
      case INCIDENT_EVENT_TYPES.CAR_DODGE:
      case PHYSICS_EVENT_TYPES.CAR_ACTION:
      case 0x06:
      case 0x07:
      case 0x08:
        if (this.vehicleManager) {
          this.vehicleManager.handleCarEvent(event);
        } else {
          this.handleCarAction(event, camera);
        }
        break;

      case INCIDENT_EVENT_TYPES.CAR_SUPERSONIC_ENTER:
      case PHYSICS_EVENT_TYPES.CAR_SUPERSONIC_ENTER:
      case 0x0A:
        if (this.vehicleManager) {
          this.vehicleManager.handleCarEvent(event);
        } else {
          this.handleSupersonicEnter(event, camera);
        }
        break;

      case INCIDENT_EVENT_TYPES.BOOST_PICKUP:
      case PHYSICS_EVENT_TYPES.BOOST_PICKUP:
        this.handleBoostPickup(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.CAR_BOOST_START:
      case 0x0B:
        if (this.vehicleManager) {
          this.vehicleManager.handleCarEvent(event);
        } else {
          this.handleBoostStart(event, camera);
        }
        break;

      case INCIDENT_EVENT_TYPES.CAR_BOOST_STOP:
      case 0x0C:
        if (this.vehicleManager) {
          this.vehicleManager.handleCarEvent(event);
        } else {
          this.handleBoostStop(event, camera);
        }
        break;

      case INCIDENT_EVENT_TYPES.GOAL_SCORED:
        this.handleGoalScored(event, camera);
        break;

      case INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED:
      case PHYSICS_EVENT_TYPES.FLIP_RESET_GAINED:
      case 0x0F:
      case 0x0D:
        if (this.vehicleManager) {
          this.vehicleManager.handleCarEvent(event);
        } else {
          this.handleFlipReset(event, camera);
        }
        break;

      default:
        break;
    }
  }

  handleCarBallHit(event, camera) {
    const now = performance.now();
    const cooldownMs = audioConfig.get('carBallHitCooldownMs');
    if (now - this.lastCarBallHitTimestamp < cooldownMs) return;

    const threshold = audioConfig.get('carBallHitImpulseThreshold');
    const impulse = Number.isFinite(event.impulse) ? event.impulse : (event.relSpeed ?? 0);
    if (impulse < threshold) return;

    this.lastCarBallHitTimestamp = now;
    const pool = getAudioSlotPool();
    if (!pool) return;

    const hitList = this.buffers.ballHit;
    if (!hitList || hitList.length === 0) return;

    let idx = Math.floor(Math.random() * hitList.length);
    if (hitList.length > 1 && idx === this.lastBallHitSoundIdx) {
      idx = (idx + 1) % hitList.length;
    }
    this.lastBallHitSoundIdx = idx;

    const master = audioConfig.get('masterVolume');
    const hitVol = audioConfig.get('carBallHitVolume');
    const layerVol = audioConfig.get('ballCollisionVolume');
    const volume = Math.max(0, Math.min(5.0, hitVol * layerVol * master));

    pool.playBuffer(hitList[idx], {
      volume,
      position: event,
      priority: 5
    });
  }

  handleCarCarCollision(event, camera) {
    const now = performance.now();
    if (now - this.lastCarCollisionTimestamp < 40) return;
    this.lastCarCollisionTimestamp = now;

    const pool = getAudioSlotPool();
    if (!pool || !this.buffers.carCollision) return;

    const master = audioConfig.get('masterVolume');
    const carVol = audioConfig.get('carCarCollisionVolume');
    const volume = Math.max(0, Math.min(5.0, carVol * master));

    pool.playBuffer(this.buffers.carCollision, {
      volume,
      position: event,
      priority: 6
    });
  }

  handleCarCarDemo(event, camera) {
    const pool = getAudioSlotPool();
    if (!pool) return;

    const buf = this.buffers.goalScored || this.buffers.carCollision;
    if (!buf) return;

    const master = audioConfig.get('masterVolume');
    const carVol = audioConfig.get('carCarCollisionVolume');
    const volume = Math.max(0, Math.min(5.0, 1.5 * carVol * master));

    pool.playBuffer(buf, {
      volume,
      position: event,
      playbackRate: 0.85,
      priority: 9
    });
  }

  handleBallWorldHit(event, camera) {
    if (!event) return;

    if (event.isCrossbar || event.surfaceTag === SURFACE_SUBTYPES.GOALPOST || event.surfaceTag === SURFACE_SUBTYPES.CROSSBAR) {
      this.handleBallGoalpostHit(event, camera);
      return;
    }

    const now = performance.now();
    const cooldownMs = audioConfig.get('incidentCooldownMs');
    if (now - this.lastBallWorldHitTimestamp < cooldownMs) return;

    // Audio shielding against weak rolling buzz
    const floorThreshold = audioConfig.get('ballGroundHitThreshold');
    const wallThreshold = audioConfig.get('ballWallHitThreshold');
    const threshold = (event.surfaceTag === 1 || event.surfaceTag === SURFACE_SUBTYPES.FLOOR) ? floorThreshold : wallThreshold;
    const impactVal = Number.isFinite(event.normalRelVel) ? event.normalRelVel : null;
    if (impactVal !== null && impactVal < threshold) return;

    this.lastBallWorldHitTimestamp = now;
    const pool = getAudioSlotPool();
    if (!pool) return;

    const master = audioConfig.get('masterVolume');
    const worldVol = audioConfig.get('ballWorldHitVolume');
    const layerVol = audioConfig.get('ballCollisionVolume');

    // 1. Floor / Ground pitch: Normal collision using custom 1, 2, 3 (strictly NEVER vehicle-body-04)
    if (event.surfaceTag === 1 || event.surfaceTag === SURFACE_SUBTYPES.FLOOR) {
      const groundList = (this.buffers.groundHit && this.buffers.groundHit.length > 0)
        ? this.buffers.groundHit
        : (this.buffers.ballHit ? this.buffers.ballHit.slice(0, 3) : []);
      if (!groundList || groundList.length === 0) return;
      let idx = Math.floor(Math.random() * groundList.length);
      if (groundList.length > 1 && idx === this.lastGroundHitSoundIdx) {
        idx = (idx + 1) % groundList.length;
      }
      this.lastGroundHitSoundIdx = idx;
      const floorVol = audioConfig.get('ballFloorHitVolume');
      const volume = Math.max(0, Math.min(5.0, floorVol * layerVol * master));
      pool.playBuffer(groundList[idx], { volume, position: event, priority: 3 });
      return;
    }

    // 2. Field Net / Sidewalls / Ceiling / Backboard / Corner 45:
    // Random draw from /custom/assets/audio/sidewallhit/
    const isNetSurface = (event.surfaceTag === SURFACE_SUBTYPES.SIDE_WALL ||
                          event.surfaceTag === SURFACE_SUBTYPES.CEILING ||
                          event.surfaceTag === SURFACE_SUBTYPES.BACKBOARD ||
                          event.surfaceTag === SURFACE_SUBTYPES.CORNER_45 ||
                          event.surfaceTag === 3 || event.surfaceTag === 2 || event.surfaceTag === 4 || event.surfaceTag === 5);

    if (isNetSurface) {
      const sidewallList = (this.buffers.sidewallHit && this.buffers.sidewallHit.length > 0)
        ? this.buffers.sidewallHit
        : (this.buffers.groundHit && this.buffers.groundHit.length > 0 ? this.buffers.groundHit : this.buffers.ballHit.slice(0, 3));
      if (sidewallList && sidewallList.length > 0) {
        let netIdx = Math.floor(Math.random() * sidewallList.length);
        if (sidewallList.length > 1 && netIdx === this.lastSidewallHitSoundIdx) {
          netIdx = (netIdx + 1) % sidewallList.length;
        }
        this.lastSidewallHitSoundIdx = netIdx;
        const netVol = audioConfig.get('ballNetHitVolume');
        const netVolume = Math.max(0, Math.min(5.0, netVol * layerVol * master));
        pool.playBuffer(sidewallList[netIdx], { volume: netVolume, position: event, priority: 5 });
      }
      return;
    }

    // 3. Ramps & Transition Curves
    const rampVol = audioConfig.get('ballRampHitVolume');
    const volume = Math.max(0, Math.min(5.0, rampVol * layerVol * master));
    const bufList = (this.buffers.groundHit && this.buffers.groundHit.length > 0)
      ? this.buffers.groundHit
      : (this.buffers.ballHit ? this.buffers.ballHit.slice(0, 3) : this.buffers.sidewallHit);
    if (bufList && bufList.length > 0) {
      const idx = Math.floor(Math.random() * bufList.length);
      pool.playBuffer(bufList[idx], { volume, position: event, priority: 4 });
    }
  }

  handleBallGoalpostHit(event, camera) {
    const now = performance.now();
    const cooldownMs = audioConfig.get('goalpostHitCooldownMs');
    if (now - this.lastGoalpostHitTimestamp < cooldownMs) return;

    const threshold = audioConfig.get('goalpostHitThreshold');
    const impactVal = Math.abs(event.normalRelVel || event.impulse || event.speed || 0);
    if (impactVal < threshold) return;

    this.lastGoalpostHitTimestamp = now;
    const pool = getAudioSlotPool();
    if (!pool) return;

    const postBuf = this.buffers.goalpost || (this.buffers.ballHit && this.buffers.ballHit[3]) || null;
    if (!postBuf) return;

    const master = audioConfig.get('masterVolume');
    const postVol = audioConfig.get('goalpostHitVolume');
    const layerVol = audioConfig.get('ballCollisionVolume');
    const volume = Math.max(0, Math.min(5.0, postVol * layerVol * master));

    pool.playBuffer(postBuf, {
      volume,
      position: event,
      priority: 8
    });
  }

  handleCarAction(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent(event);
    }
  }

  handleJump(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_JUMP });
    }
  }

  handleDoubleJump(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP });
    }
  }

  handleDodge(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_DODGE });
    }
  }

  handleSupersonicEnter(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_SUPERSONIC_ENTER });
    }
  }

  handleBoostStart(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_BOOST_START });
    }
  }

  handleBoostStop(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.CAR_BOOST_STOP });
    }
  }

  handleBoostPickup(event, camera) {
    const pool = getAudioSlotPool();
    if (!pool || !this.buffers.boostCollect) return;

    const master = audioConfig.get('masterVolume');
    const boostVol = audioConfig.get('boostCollectVolume') * audioConfig.get('boostVolume');

    const isBig = Boolean(event.isBig);
    const volumeMult = isBig ? 1.25 : 0.85;
    const playbackRate = isBig ? 0.95 : 1.15;
    const finalVol = Math.max(0, Math.min(5.0, volumeMult * master * boostVol));

    pool.playBuffer(this.buffers.boostCollect, {
      volume: finalVol,
      position: event,
      playbackRate,
      priority: 4
    });
  }

  handleGoalScored(event, camera) {
    const pool = getAudioSlotPool();
    if (!pool || !this.buffers.goalScored) return;

    const master = audioConfig.get('masterVolume');
    const goalVol = audioConfig.get('goalScoredVolume');
    const volume = Math.max(0, Math.min(5.0, goalVol * master));

    pool.playBuffer(this.buffers.goalScored, {
      volume,
      position: event,
      priority: 10
    });
  }

  handleFlipReset(event, camera) {
    if (this.vehicleManager) {
      this.vehicleManager.handleCarEvent({ ...event, type: INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED });
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Category 3: SignalAudioEngine (Match Lifecycle Signals)
// ---------------------------------------------------------------------------
export class SignalAudioEngine {
  constructor() {
    this.signalBuffers = new Map();
    this.lastPlayTime = new Map();
  }

  setBuffer(signalKey, buffer) {
    this.signalBuffers.set(signalKey, buffer);
  }

  handleSignal(signalType) {
    let key = null;
    switch (signalType) {
      case SIGNAL_EVENT_TYPES.COUNTDOWN_TICK:
        key = "match_countdown_321";
        break;
      case SIGNAL_EVENT_TYPES.KICKOFF_GO:
      case SIGNAL_EVENT_TYPES.MATCH_START:
        key = "match_start_go";
        break;
      case SIGNAL_EVENT_TYPES.TIME_ALERT_30S:
        key = "match_30_seconds_left";
        break;
      case SIGNAL_EVENT_TYPES.OVERTIME_START:
        key = "match_entering_overtime";
        break;
      default:
        break;
    }
    if (key) {
      this.play(key, 1.0);
    }
  }

  play(key, volMult = 1.0, minInterval = 0) {
    const now = performance.now();
    if (minInterval > 0) {
      const last = this.lastPlayTime.get(key) || 0;
      if (now - last < minInterval) return;
    }
    this.lastPlayTime.set(key, now);

    const buf = this.signalBuffers.get(key);
    const pool = getAudioSlotPool();
    if (!buf || !pool) return;

    const master = audioConfig.get('masterVolume');
    const sigVol = audioConfig.get('signalVolume');
    const volume = Math.max(0, Math.min(5.0, volMult * sigVol * master));

    pool.playBuffer(buf, {
      volume,
      priority: 8
    });
  }
}

// ---------------------------------------------------------------------------
// 7. Category 4: UIAudioEngine (UI Clicks & Menu Audio)
// ---------------------------------------------------------------------------
export class UIAudioEngine {
  playClick(volume = 1.0) {
    const pool = getAudioSlotPool();
    const buf = subsystemState.buffers.get("sfx_error_no_boost");
    if (!pool || !buf) return;
    const master = audioConfig.get('masterVolume');
    pool.playBuffer(buf, {
      volume: Math.max(0, Math.min(5.0, volume * master * 0.3)),
      playbackRate: 2.0,
      priority: 1
    });
  }
}

// ---------------------------------------------------------------------------
// 8. Unified Audio Engine Facade (Central Subsystem Coordinator)
// ---------------------------------------------------------------------------
export class GameAudioEngineFacade {
  constructor() {
    this.stateEngine = new StateAudioEngine();
    this.ballEngine = this.stateEngine.ballEmitter;
    this.vehicleManager = new VehicleAudioManager();
    this.incidentEngine = new IncidentAudioEngine(this.vehicleManager);
    this.signalEngine = new SignalAudioEngine();
    this.uiEngine = new UIAudioEngine();

    this.loading = false;
    this.loaded = false;
  }

  async preload(onProgress = null) {
    if (this.loaded || this.loading || typeof window === "undefined") return;
    this.loading = true;
    const ctx = getAudioContext();
    if (!ctx) return;

    const fetchBuf = async (url, fallbackUrl = null) => {
      try {
        let res = await fetch(url);
        if (!res.ok && fallbackUrl) {
          res = await fetch(fallbackUrl);
        }
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (e) {
        if (fallbackUrl) {
          try {
            const res = await fetch(fallbackUrl);
            if (res.ok) {
              return await ctx.decodeAudioData(await res.arrayBuffer());
            }
          } catch (e2) {}
        }
        return null;
      }
    };

    try {
      const audioDescriptors = [
        { url: BALL_HIT_AUDIO_FILES[0] },
        { url: BALL_HIT_AUDIO_FILES[1] },
        { url: BALL_HIT_AUDIO_FILES[2] },
        { url: BALL_HIT_AUDIO_FILES[3] },
        { url: SIDEWALL_HIT_AUDIO_FILES[0] },
        { url: SIDEWALL_HIT_AUDIO_FILES[1] },
        { url: SIDEWALL_HIT_AUDIO_FILES[2] },
        { url: SIDEWALL_HIT_AUDIO_FILES[3] },
        { url: SIDEWALL_HIT_AUDIO_FILES[4] },
        { url: SFX_CAR_COLLISION_FILE },
        { url: BOOST_COLLECT_FILE },
        { url: GOAL_SCORED_FILE },
        { url: BALL_ROLLING_FILE },
        { url: BALL_FLYING_FILE },
        { url: SUPERSONIC_STATE_FILE },
        { url: ERROR_NO_BOOST_FILE },
        { url: MATCH_30S_FILE },
        { url: MATCH_COUNTDOWN_FILE },
        { url: MATCH_OVERTIME_FILE },
        { url: MATCH_START_GO_FILE },
        { url: JUMP_AUDIO_FILES[0] },
        { url: JUMP_AUDIO_FILES[1] },
        { url: JUMP_AUDIO_FILES[2] },
        { url: JUMP_AUDIO_FILES[3] },
        { url: DOUBLE_JUMP_AUDIO_FILES[0] },
        { url: DOUBLE_JUMP_AUDIO_FILES[1] },
        { url: DOUBLE_JUMP_AUDIO_FILES[2] },
        { url: DOUBLE_JUMP_AUDIO_FILES[3] },
        { url: DODGE_AUDIO_FILES[0] },
        { url: DODGE_AUDIO_FILES[1] },
        { url: DODGE_AUDIO_FILES[2] },
        { url: DODGE_AUDIO_FILES[3] },
        { url: RESET_AUDIO_FILE },
        { url: GOALPOST_AUDIO_FILE, fallback: BALL_HIT_AUDIO_FILES[3] },
        { url: WHEEL_IMPACT_AUDIO_FILES[0] },
        { url: WHEEL_IMPACT_AUDIO_FILES[1] },
        { url: WHEEL_IMPACT_AUDIO_FILES[2] },
        { url: WHEEL_IMPACT_AUDIO_FILES[3] },
        { url: SUPERSONIC_ENTER_AUDIO_FILES[0] },
        { url: SUPERSONIC_ENTER_AUDIO_FILES[1] },
        { url: SUPERSONIC_ENTER_AUDIO_FILES[2] },
        { url: SUPERSONIC_LOOP_AUDIO_FILE },
        { url: BOOST_START_AUDIO_FILE },
        { url: BOOST_LOOP_AUDIO_FILE },
        { url: BOOST_RELEASE_AUDIO_FILE }
      ];

      const poolLimit = 6;
      let completedCount = 0;
      const totalCount = audioDescriptors.length;
      let cursor = 0;
      const results = new Array(totalCount);

      const worker = async () => {
        while (cursor < totalCount) {
          const idx = cursor++;
          const desc = audioDescriptors[idx];
          results[idx] = await fetchBuf(desc.url, desc.fallback);
          completedCount++;
          if (typeof onProgress === "function") {
            onProgress(completedCount, totalCount, desc.url);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(poolLimit, totalCount) }, () => worker())
      );

      const [
        ballHit0, ballHit1, ballHit2, ballHit3,
        side0, side1, side2, side3, side4,
        carCollision,
        boostCollect,
        goalPoof,
        ballRolling,
        ballFlying,
        supersonic,
        errorNoBoost,
        match30s,
        matchCountdown,
        matchOvertime,
        matchStartGo,
        jump0, jump1, jump2, jump3,
        djump0, djump1, djump2, djump3,
        dodge0, dodge1, dodge2, dodge3,
        resetBuf,
        goalpostBuf,
        wimp0, wimp1, wimp2, wimp3,
        supersonicEnter0, supersonicEnter1, supersonicEnter2,
        supersonicLoop,
        boostStart, boostLoop, boostRelease
      ] = results;

      const ballHitBuffers = [ballHit0, ballHit1, ballHit2, ballHit3].filter(Boolean);
      // Custom 1, 2, 3 only for ground hits (never vehicle-body-04)
      const groundHitBuffers = ballHitBuffers.slice(0, 3);
      const sidewallHitBuffers = [side0, side1, side2, side3, side4].filter(Boolean);
      const jumpBuffers = [jump0, jump1, jump2, jump3].filter(Boolean);
      const doubleJumpBuffers = [djump0, djump1, djump2, djump3].filter(Boolean);
      const dodgeBuffers = [dodge0, dodge1, dodge2, dodge3].filter(Boolean);
      const wheelImpactBuffers = [wimp0, wimp1, wimp2, wimp3].filter(Boolean);
      const supersonicEnterBuffers = [supersonicEnter0, supersonicEnter1, supersonicEnter2].filter(Boolean);

      // Save into global buffer registry
      subsystemState.buffers.set("car_collision", carCollision);
      subsystemState.buffers.set("boost_collect", boostCollect);
      subsystemState.buffers.set("sfx_goal_poof", goalPoof);
      subsystemState.buffers.set("ballrolling", ballRolling);
      subsystemState.buffers.set("ballflying", ballFlying);
      subsystemState.buffers.set("sfx_state_supersonic", supersonic);
      subsystemState.buffers.set("sfx_error_no_boost", errorNoBoost);
      subsystemState.buffers.set("match_30_seconds_left", match30s);
      subsystemState.buffers.set("match_countdown_321", matchCountdown);
      subsystemState.buffers.set("match_entering_overtime", matchOvertime);
      subsystemState.buffers.set("match_start_go", matchStartGo);
      if (resetBuf) subsystemState.buffers.set("reset", resetBuf);
      if (goalpostBuf) subsystemState.buffers.set("goalpost", goalpostBuf);
      if (boostStart) subsystemState.buffers.set("boost_start", boostStart);
      if (boostLoop) subsystemState.buffers.set("boost_loop", boostLoop);
      if (boostRelease) subsystemState.buffers.set("boost_release", boostRelease);
      if (supersonicLoop) subsystemState.buffers.set("supersonic_loop", supersonicLoop);
      jumpBuffers.forEach((b, i) => subsystemState.buffers.set(`jump_${i}`, b));
      doubleJumpBuffers.forEach((b, i) => subsystemState.buffers.set(`double_jump_${i}`, b));
      dodgeBuffers.forEach((b, i) => subsystemState.buffers.set(`dodge_${i}`, b));
      wheelImpactBuffers.forEach((b, i) => subsystemState.buffers.set(`wheel_impact_${i}`, b));
      supersonicEnterBuffers.forEach((b, i) => subsystemState.buffers.set(`supersonic_enter_${i}`, b));

      // Distribute to Vehicle Manager (Multi-Car Dynamic Emitters)
      this.vehicleManager.setBuffers({
        jump: jumpBuffers,
        doubleJump: doubleJumpBuffers,
        dodge: dodgeBuffers,
        reset: resetBuf,
        wheelImpact: wheelImpactBuffers,
        boostStart,
        boostLoop,
        boostRelease,
        supersonicEnter: supersonicEnterBuffers,
        supersonicLoop: supersonicLoop || supersonic,
        carCollision
      });

      // Distribute to Incident Engine (World Incidents)
      this.incidentEngine.setBuffers({
        ballHit: ballHitBuffers,
        groundHit: groundHitBuffers,
        sidewallHit: sidewallHitBuffers,
        carCollision,
        goalpost: goalpostBuf || ballHitBuffers[3] || ballHitBuffers[0] || null,
        boostCollect,
        goalScored: goalPoof,
        supersonic,
        jump: jumpBuffers,
        doubleJump: doubleJumpBuffers,
        dodge: dodgeBuffers,
        reset: resetBuf,
        wheelImpact: wheelImpactBuffers,
        boostStart,
        boostRelease,
        supersonicEnter: supersonicEnterBuffers
      });

      // Distribute to State Engine
      this.stateEngine.init({
        ballRolling,
        ballFlying,
        supersonic,
        supersonicLoop,
        boostLoop
      });

      // Distribute to Signal Engine
      this.signalEngine.setBuffer("match_countdown_321", matchCountdown);
      this.signalEngine.setBuffer("match_start_go", matchStartGo);
      this.signalEngine.setBuffer("match_30_seconds_left", match30s);
      this.signalEngine.setBuffer("match_entering_overtime", matchOvertime);
      this.signalEngine.setBuffer("sfx_goal_poof", goalPoof);
      this.signalEngine.setBuffer("sfx_error_no_boost", errorNoBoost);
      this.signalEngine.setBuffer("boost_collect", boostCollect);

      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  handleEvent(event, camera = null) {
    this.incidentEngine.handleEvent(event, camera);
  }

  updateBallAudio(ballViewOrMesh, camera, physics) {
    this.ballEngine.update(ballViewOrMesh, camera, physics);
  }

  updateVehicles(context) {
    this.vehicleManager.update(context);
  }

  updateSupersonic(isSupersonic, isMatchActive = true) {
    const emitter = this.vehicleManager.getEmitter(this.vehicleManager.activeCarIndex);
    emitter.updateState({ isSupersonic, isAlive: true, audible: isMatchActive });
    this.stateEngine.updateSupersonic(isSupersonic, isMatchActive);
  }

  updateBoost(isBoosting, isMatchActive = true) {
    const emitter = this.vehicleManager.getEmitter(this.vehicleManager.activeCarIndex);
    emitter.updateState({ isBoosting, isAlive: true, audible: isMatchActive });
    this.stateEngine.updateBoost(isBoosting, isMatchActive);
  }

  handleSignal(signalType) {
    this.signalEngine.handleSignal(signalType);
  }

  play(key, volMult = 1.0, minInterval = 0) {
    this.signalEngine.play(key, volMult, minInterval);
  }

  silenceAll() {
    this.ballEngine.silenceAll();
    this.vehicleManager.silenceAll();
    this.stateEngine.silenceAll();
    const pool = getAudioSlotPool();
    if (pool) pool.silenceAll();
  }

  onFocusRegained() {
    this.silenceAll();
  }

  stopContinuousAudio() {
    this.silenceAll();
  }
}

export const audioEngine = new GameAudioEngineFacade();
export const gameAudioEngine = audioEngine;
export const gameAudio = audioEngine;
// ---------------------------------------------------------------------------
// 9. Surface Taxonomy Debug Mesh Colorizer

// ---------------------------------------------------------------------------
export function applySurfaceTaxonomyColoring(arenaWorld, enabled = true, floorNz = 0.8, netNz = 0.05, THREE = null) {
  if (!arenaWorld) return;
  const contextThree = THREE || globalThis.THREE;

  const targetMeshes = [];
  if (arenaWorld.boundary) arenaWorld.boundary.traverse(child => { if (child.isMesh) targetMeshes.push(child); });
  if (arenaWorld.stadium) arenaWorld.stadium.traverse(child => { if (child.isMesh) targetMeshes.push(child); });

  for (const mesh of targetMeshes) {
    if (enabled) {
      if (!mesh.userData._originalMaterial) {
        mesh.userData._originalMaterial = mesh.material;
      }
      if (!contextThree) continue;

      const geom = mesh.geometry;
      if (!geom || !geom.attributes.position || !geom.attributes.normal) continue;

      const count = geom.attributes.position.count;
      const normals = geom.attributes.normal.array;
      const positions = geom.attributes.position.array;

      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const ny = normals[i * 3 + 1];
        const py = positions[i * 3 + 1];
        const px = positions[i * 3 + 0];
        const pz = positions[i * 3 + 2];

        const isNearGoal = Math.abs(pz) >= 4950;
        const isGoalpost = isNearGoal && ((Math.abs(py - 642) < 80 && Math.abs(px) <= 950) || (Math.abs(Math.abs(px) - 893) < 80 && py <= 700));

        if (isGoalpost) {
          // Crimson Red (#ff4757)
          colors[i * 3 + 0] = 1.0;
          colors[i * 3 + 1] = 0.28;
          colors[i * 3 + 2] = 0.34;
        } else if (ny >= floorNz) {
          // Floor: Emerald Green (#2ecc71)
          colors[i * 3 + 0] = 0.18;
          colors[i * 3 + 1] = 0.80;
          colors[i * 3 + 2] = 0.44;
        } else if (ny <= netNz) {
          // Field Net / Ceiling / Sidewall: Neon Cyan (#00d2ff)
          colors[i * 3 + 0] = 0.0;
          colors[i * 3 + 1] = 0.82;
          colors[i * 3 + 2] = 1.0;
        } else {
          // Ramps / Transition Curves: Warm Orange (#ff9f43)
          colors[i * 3 + 0] = 1.0;
          colors[i * 3 + 1] = 0.62;
          colors[i * 3 + 2] = 0.26;
        }
      }

      geom.setAttribute('color', new contextThree.BufferAttribute(colors, 3));
      mesh.material = new contextThree.MeshBasicMaterial({
        vertexColors: true,
        wireframe: false,
        side: contextThree.DoubleSide
      });
    } else {
      if (mesh.userData._originalMaterial) {
        mesh.material = mesh.userData._originalMaterial;
        delete mesh.userData._originalMaterial;
      }
      if (mesh.geometry?.getAttribute('color')) {
        mesh.geometry.deleteAttribute('color');
      }
    }
  }
}
