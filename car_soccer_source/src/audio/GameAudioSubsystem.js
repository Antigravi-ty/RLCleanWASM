/**
 * GameAudioSubsystem.js
 * Unified game audio subsystem for Car Soccer.
 * 
 * Features:
 * - Fixed 10-Slot Audio Pool (`AudioSlotPool`) for zero GC allocations during play
 * - Audio graph protection against focus / blur audio stuttering and stuck voices
 * - 3-Tier Layered Volume System (0% to 500% range):
 *     Layer 1: Vehicle Self Audio (Dodge, Single Jump, Double Jump, Supersonic Enter)
 *     Layer 2: Car-Car Collision Audio (SFX Car Collision vs 1-of-6 Vehicle Detail)
 *     Layer 3: Ball Collision Audio (Car-Ball Hit, Ball-Pitch, Goalpost & Crossbar at 200%)
 * - 0-100ms Adjustable Car-Ball Hit Cooldown Window
 * - External JSON Configuration Export / Import
 * - Full backward compatibility with previous audio APIs
 */

import { validateAssetResponse } from '../game/AssetDiagnostics.js';
import { EMotorSynth } from './EMotorSynth.js';
export { EMotorSynth } from './EMotorSynth.js';
import { SpatialAudioSource, updateAudioListener, calculateDistanceGain } from './SpatialAudioSource.js';
import { PHYSICS_EVENT_TYPES, CAR_ACTION_SUBTYPES } from '../physics/RocketSimConstants.js';

// --- Utility Math & Conversion ---
export function dbToLinear(dB) {
  return Math.pow(10, dB / 20);
}

export function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0));
}

export function clampVolume(v) {
  return Math.min(5.0, Math.max(0, Number(v) || 0));
}

// --- 1. Master Audio Settings & Global Storage ---
export const AUDIO_SETTINGS_KEY = 'car-soccer.audio-settings.v2';
export const AUDIO_SETTINGS_CHANGED_EVENT = 'car-soccer:audio-settings-changed';

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  version: 1,
  masterVolume: 1.0,
  engineVolume: 0.8,
  boostVolume: 0.8,
  vehicleSelfVolume: 1.0,
  carCarCollisionVolume: 1.0,
  ballCollisionVolume: 1.0,
  carCarSoundMode: 'sfx_collision', // 'sfx_collision' | 'vehicle_detail'
  carBallHitCooldownMs: 40,        // 0 - 100 ms
  carBallHitImpulseThreshold: 0,
  logCarBallHitEvents: false
});

function loadAudioSettings() {
  const fallback = { ...DEFAULT_AUDIO_SETTINGS };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY) || localStorage.getItem('car-soccer.audio-settings.v1');
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (Number.isFinite(parsed.masterVolume)) fallback.masterVolume = clampVolume(parsed.masterVolume);
      if (Number.isFinite(parsed.engineVolume)) fallback.engineVolume = clampVolume(parsed.engineVolume);
      if (Number.isFinite(parsed.boostVolume)) fallback.boostVolume = clampVolume(parsed.boostVolume);
      if (Number.isFinite(parsed.vehicleSelfVolume)) fallback.vehicleSelfVolume = clampVolume(parsed.vehicleSelfVolume);
      if (Number.isFinite(parsed.carCarCollisionVolume)) fallback.carCarCollisionVolume = clampVolume(parsed.carCarCollisionVolume);
      if (Number.isFinite(parsed.ballCollisionVolume)) fallback.ballCollisionVolume = clampVolume(parsed.ballCollisionVolume);
      else if (Number.isFinite(parsed.carBallHitVolume)) fallback.ballCollisionVolume = clampVolume(parsed.carBallHitVolume);
      if (parsed.carCarSoundMode === 'sfx_collision' || parsed.carCarSoundMode === 'vehicle_detail') fallback.carCarSoundMode = parsed.carCarSoundMode;
      if (Number.isFinite(parsed.carBallHitCooldownMs)) fallback.carBallHitCooldownMs = Math.min(100, Math.max(0, parsed.carBallHitCooldownMs));
      if (Number.isFinite(parsed.carBallHitImpulseThreshold)) fallback.carBallHitImpulseThreshold = Math.max(0, parsed.carBallHitImpulseThreshold);
      if (typeof parsed.logCarBallHitEvents === 'boolean') fallback.logCarBallHitEvents = parsed.logCarBallHitEvents;
    }
  } catch (e) {}
  return fallback;
}

function saveAudioSettings(settings) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

/**
 * Master Audio Mixer managing master bus volume and connection to destination.
 */
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
    this.volume = Number.isFinite(vol) ? clampVolume(vol) : 1;
    this.apply();
  }

  setActive(active) {
    this.active = Boolean(active);
    this.apply();
  }

  apply() {
    const { context, output } = this;
    const now = context.currentTime;
    const target = this.active ? this.volume : 0;
    const current = output.gain.value;

    output.gain.cancelScheduledValues(now);
    if (target === 0) {
      output.gain.setValueAtTime(0, now);
      if (this.connected) {
        output.disconnect(context.destination);
        this.connected = false;
      }
      return;
    }

    if (context.state === 'running' && this.connected) {
      output.gain.setValueAtTime(current, now);
      output.gain.linearRampToValueAtTime(target, now + 0.02);
    } else {
      output.gain.setValueAtTime(target, now);
    }

    if (!this.connected) {
      output.connect(context.destination);
      this.connected = true;
    }
  }
}

// --- 2. Fixed Web Audio Slot Architecture (10 Slots, Zero GC Pressure) ---
export class AudioSlotPool {
  constructor(context, maxSlots = 10) {
    this.context = context;
    this.maxSlots = maxSlots;
    this.slots = [];
    this._initialized = false;
  }

  init() {
    if (this._initialized || !this.context) return;
    const ctx = this.context;
    const dest = getMasterAudioInput();

    for (let i = 0; i < this.maxSlots; i++) {
      const gainNode = ctx.createGain();
      let pannerNode = null;
      if (typeof ctx.createStereoPanner === 'function') {
        pannerNode = ctx.createStereoPanner();
        gainNode.connect(pannerNode);
        if (dest) pannerNode.connect(dest);
      } else {
        if (dest) gainNode.connect(dest);
      }

      this.slots.push({
        id: i,
        gainNode,
        pannerNode,
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

    // 1. Try to acquire an unused slot
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.inUse) {
        slot.inUse = true;
        slot.priority = priority;
        slot.startTime = performance.now();
        return slot;
      }
    }

    // 2. All slots are in use: steal the oldest slot with <= priority
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
    if (!ctx || ctx.state !== 'running') return null;

    const volume = options.volume ?? 1.0;
    const pan = options.pan ?? 0.0;
    const playbackRate = options.playbackRate ?? 1.0;
    const priority = options.priority ?? 1;

    const slot = this.acquireSlot(priority);
    if (!slot) return null;

    const now = ctx.currentTime;
    slot.gainNode.gain.cancelScheduledValues(now);
    slot.gainNode.gain.setValueAtTime(volume, now);

    if (slot.pannerNode) {
      slot.pannerNode.pan.cancelScheduledValues(now);
      slot.pannerNode.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
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

    try {
      src.start(now);
    } catch (e) {
      this.releaseSlot(slot);
      return null;
    }
    return slot;
  }

  silenceAll() {
    for (let i = 0; i < this.slots.length; i++) {
      this.releaseSlot(this.slots[i]);
    }
  }
}

// Global audio subsystem singleton state
const audioSubsystemState = {
  settings: loadAudioSettings(),
  context: null,
  mixer: null,
  slotPool: null
};

if (typeof window !== 'undefined') {
  const syncActive = () => {
    const active = !document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true);
    if (audioSubsystemState.mixer) {
      audioSubsystemState.mixer.setActive(active);
    }
    if (!active && audioSubsystemState.slotPool) {
      audioSubsystemState.slotPool.silenceAll();
    }
  };

  window.addEventListener('focus', syncActive);
  window.addEventListener('blur', syncActive);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', syncActive);
  }
  window.addEventListener('pagehide', () => {
    audioSubsystemState.mixer?.setActive(false);
    audioSubsystemState.slotPool?.silenceAll();
  });
  window.addEventListener('pageshow', syncActive);
  window.addEventListener('storage', event => {
    if (event.key === AUDIO_SETTINGS_KEY || event.key === null) {
      audioSubsystemState.settings = loadAudioSettings();
      audioSubsystemState.mixer?.setVolume(audioSubsystemState.settings.masterVolume);
      window.dispatchEvent(new Event(AUDIO_SETTINGS_CHANGED_EVENT));
    }
  });
}

/**
 * Returns current audio settings
 */
export function getAudioSettings() {
  return audioSubsystemState.settings;
}

/**
 * Returns or initializes the global Web Audio context.
 */
export function getAudioContext() {
  if (!audioSubsystemState.context) {
    const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    audioSubsystemState.context = ctx;
    const mixer = new AudioMixer(ctx);
    mixer.setVolume(audioSubsystemState.settings.masterVolume);
    const active = typeof document !== 'undefined' ? (!document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true)) : true;
    mixer.setActive(active);
    audioSubsystemState.mixer = mixer;
    audioSubsystemState.slotPool = new AudioSlotPool(ctx, 10);
  }
  return audioSubsystemState.context;
}

/**
 * Returns the fixed audio slot pool
 */
export function getAudioSlotPool() {
  getAudioContext();
  return audioSubsystemState.slotPool;
}

/**
 * Returns the master mixer input node.
 */
export function getMasterAudioInput() {
  getAudioContext();
  return audioSubsystemState.mixer?.input ?? null;
}

function notifyAudioSettingsChanged() {
  saveAudioSettings(audioSubsystemState.settings);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUDIO_SETTINGS_CHANGED_EVENT));
  }
}

// --- Audio Settings Setters ---
export function setMasterVolume(vol) {
  if (!Number.isFinite(vol)) return;
  const clamped = clampVolume(vol);
  audioSubsystemState.settings.masterVolume = clamped;
  audioSubsystemState.mixer?.setVolume(clamped);
  notifyAudioSettingsChanged();
}

export function setEngineVolume(vol) {
  if (!Number.isFinite(vol)) return;
  audioSubsystemState.settings.engineVolume = clampVolume(vol);
  notifyAudioSettingsChanged();
}

export function setBoostVolume(vol) {
  if (!Number.isFinite(vol)) return;
  audioSubsystemState.settings.boostVolume = clampVolume(vol);
  notifyAudioSettingsChanged();
}

export function setVehicleSelfVolume(vol) {
  if (!Number.isFinite(vol)) return;
  audioSubsystemState.settings.vehicleSelfVolume = clampVolume(vol);
  notifyAudioSettingsChanged();
}

export function setCarCarCollisionVolume(vol) {
  if (!Number.isFinite(vol)) return;
  audioSubsystemState.settings.carCarCollisionVolume = clampVolume(vol);
  notifyAudioSettingsChanged();
}

export function setBallCollisionVolume(vol) {
  if (!Number.isFinite(vol)) return;
  audioSubsystemState.settings.ballCollisionVolume = clampVolume(vol);
  notifyAudioSettingsChanged();
}

export function setCarCarSoundMode(mode) {
  if (mode !== 'sfx_collision' && mode !== 'vehicle_detail') return;
  audioSubsystemState.settings.carCarSoundMode = mode;
  notifyAudioSettingsChanged();
}

export function setCarBallHitCooldownMs(ms) {
  if (!Number.isFinite(ms)) return;
  audioSubsystemState.settings.carBallHitCooldownMs = Math.min(100, Math.max(0, Math.round(ms)));
  notifyAudioSettingsChanged();
}

export function setCarBallHitImpulseThreshold(val) {
  if (!Number.isFinite(val)) return;
  audioSubsystemState.settings.carBallHitImpulseThreshold = Math.max(0, val);
  notifyAudioSettingsChanged();
}

export function setLogCarBallHitEvents(enabled) {
  audioSubsystemState.settings.logCarBallHitEvents = Boolean(enabled);
  notifyAudioSettingsChanged();
}

// Backward compatibility aliases
export function setCarBallHitVolume(vol) {
  setBallCollisionVolume(vol);
}

export function setCarBallHitSoundMode(mode) {
  // Ignored since single sound was removed and strictly randomized among 4 vehicle body wavs
}

export function getCarBallHitSoundMode() {
  return 'random';
}

/**
 * Resets audio settings to hardcoded and file defaults
 */
export function resetAudioSettings() {
  audioSubsystemState.settings = { ...DEFAULT_AUDIO_SETTINGS };
  audioSubsystemState.mixer?.setVolume(audioSubsystemState.settings.masterVolume);
  notifyAudioSettingsChanged();
}

/**
 * Exports current audio configuration as a clean JSON string
 */
export function exportAudioSettingsJson() {
  return JSON.stringify(audioSubsystemState.settings, null, 2);
}

/**
 * Imports audio configuration from a JSON string or object
 */
export function importAudioSettingsJson(jsonOrObj) {
  try {
    const data = typeof jsonOrObj === 'string' ? JSON.parse(jsonOrObj) : jsonOrObj;
    if (!data || typeof data !== 'object') return false;

    if (Number.isFinite(data.masterVolume)) audioSubsystemState.settings.masterVolume = clampVolume(data.masterVolume);
    if (Number.isFinite(data.engineVolume)) audioSubsystemState.settings.engineVolume = clampVolume(data.engineVolume);
    if (Number.isFinite(data.boostVolume)) audioSubsystemState.settings.boostVolume = clampVolume(data.boostVolume);
    if (Number.isFinite(data.vehicleSelfVolume)) audioSubsystemState.settings.vehicleSelfVolume = clampVolume(data.vehicleSelfVolume);
    if (Number.isFinite(data.carCarCollisionVolume)) audioSubsystemState.settings.carCarCollisionVolume = clampVolume(data.carCarCollisionVolume);
    if (Number.isFinite(data.ballCollisionVolume)) audioSubsystemState.settings.ballCollisionVolume = clampVolume(data.ballCollisionVolume);
    if (data.carCarSoundMode === 'sfx_collision' || data.carCarSoundMode === 'vehicle_detail') audioSubsystemState.settings.carCarSoundMode = data.carCarSoundMode;
    if (Number.isFinite(data.carBallHitCooldownMs)) audioSubsystemState.settings.carBallHitCooldownMs = Math.min(100, Math.max(0, data.carBallHitCooldownMs));
    if (Number.isFinite(data.carBallHitImpulseThreshold)) audioSubsystemState.settings.carBallHitImpulseThreshold = Math.max(0, data.carBallHitImpulseThreshold);
    if (typeof data.logCarBallHitEvents === 'boolean') audioSubsystemState.settings.logCarBallHitEvents = data.logCarBallHitEvents;

    audioSubsystemState.mixer?.setVolume(audioSubsystemState.settings.masterVolume);
    notifyAudioSettingsChanged();
    return true;
  } catch (e) {
    console.error('[AudioConfig] Failed to import configuration:', e);
    return false;
  }
}

// Helper to calculate stereo pan from 3D coords relative to camera
function computePanFromCoords(pos, camera) {
  if (!pos || !camera || !camera.position) return 0;
  const camPos = camera.position;
  const dx = (pos.x ?? 0) - camPos.x;
  const dy = (pos.z ?? 0) - camPos.y; // Y/Z swap between Three & Unreal
  const dz = (pos.y ?? 0) - camPos.z;
  const dist = Math.hypot(dx, dy, dz) || 1;

  if (camera.matrixWorld) {
    const m = camera.matrixWorld.elements;
    const rx = m[0], ry = m[1], rz = m[2];
    const rLen = Math.hypot(rx, ry, rz) || 1;
    return Math.max(-1, Math.min(1, (dx * rx + dy * ry + dz * rz) / (rLen * dist)));
  }
  return 0;
}

// --- 3. Vehicle Action Audio (Jump, Double Jump, Dodge) ---
export const VEHICLE_ACTION_AUDIO_BASE_PATH = '/assets/audio/vehicle';
export const VEHICLE_ACTION_SOUNDS = {
  jump: ['jump-01', 'jump-02', 'jump-03', 'jump-04'],
  dodge: ['dodge-01', 'dodge-02', 'dodge-03', 'dodge-04'],
  doubleJump: ['double-jump-01', 'double-jump-02', 'double-jump-03', 'double-jump-04'],
  wheelImpact: ['wheel-impact-01', 'wheel-impact-02', 'wheel-impact-03', 'wheel-impact-04']
};

export class VehicleActionAudio {
  constructor() {
    this.context = null;
    this.buffers = new Map();
    this.loading = new Map();
    this.lastIndex = new Map();
    this.lastActionTimes = new Map();
  }

  getContext() {
    return this.context || (this.context = getAudioContext()), this.context;
  }

  async preload() {
    if (typeof window === 'undefined') return;
    await Promise.all(Object.keys(VEHICLE_ACTION_SOUNDS).map(async key => {
      await this.load(key);
    }));
  }

  load(key) {
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);

    const pending = this.loading.get(key);
    if (pending) return pending;

    if (typeof window === 'undefined') return Promise.resolve([]);

    const ctx = this.getContext();
    const files = VEHICLE_ACTION_SOUNDS[key] || [];
    const promise = Promise.all(files.map(async file => {
      const url = `${VEHICLE_ACTION_AUDIO_BASE_PATH}/${file}.wav`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
      return ctx.decodeAudioData(await res.arrayBuffer());
    })).then(buffers => {
      this.buffers.set(key, buffers);
      return buffers;
    }).catch(err => {
      console.warn(`Car ${key} audio could not be loaded:`, err);
      const empty = [];
      this.buffers.set(key, empty);
      return empty;
    }).finally(() => {
      this.loading.delete(key);
    });

    this.loading.set(key, promise);
    return promise;
  }

  async play(key, baseVolume = 1.0, pan = 0) {
    this.lastActionTimes.set(key, performance.now());
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (e) {}
    const buffers = await this.load(key);
    if (!buffers || buffers.length === 0 || ctx.state !== 'running') return;

    const lastIdx = this.lastIndex.get(key) ?? -1;
    let idx = Math.floor(Math.random() * buffers.length);
    if (buffers.length > 1 && idx === lastIdx) {
      idx = (idx + 1 + Math.floor(Math.random() * (buffers.length - 1))) % buffers.length;
    }
    this.lastIndex.set(key, idx);

    const settings = getAudioSettings();
    const layerVol = settings.vehicleSelfVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const finalVol = Math.max(0, Math.min(5.0, baseVolume * layerVol * master));

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(buffers[idx], {
        volume: finalVol,
        pan,
        priority: 2
      });
    }
  }
}

// --- 4. Supersonic Audio Controller ---
export const SUPERSONIC_AUDIO_BASE_PATH = '/assets/audio/vehicle';

export const SUPERSONIC_CONFIG = {
  LOOP_START: 5802 / 24000,
  LOOP_END: 106283 / 24000,
  LOOP_GAIN: Math.pow(10, 6 / 20) * 0.045,
  ENTRY_GAIN: Math.pow(10, -15 / 20),
  ENTRY_TRACKS: ['supersonic-enter-a', 'supersonic-enter-b', 'supersonic-enter-c']
};

export class SupersonicAudio {
  constructor() {
    this.context = null;
    this.buffer = null;
    this.entries = [];
    this.loading = null;
    this.mode = 'unloaded';
    this.loadError = null;

    this.source = null;
    this.gain = null;
    this.entrySource = null;
    this.entryGain = null;
    this.lastEntry = -1;

    this.previousSupersonic = false;
    this.entryDeadline = 0;
    this.wanted = false;
    this.applied = false;
    this.unlocked = false;
    this.resumePending = false;
    this.stopAt = 0;

    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlocked = true;
        if (this.context?.state === 'suspended') {
          this.context.resume().catch(() => {});
        }
        this.prepare();
      };

      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.silence();
        });
      }
      window.addEventListener('blur', () => this.silence());
    }
  }

  getContext() {
    return this.context || (this.context = getAudioContext()), this.context;
  }

  async preload() {
    if (this.mode !== 'unloaded') return this.buffer;
    if (this.loading) return this.loading;

    if (typeof window === 'undefined') return Promise.resolve(null);

    const ctx = this.getContext();
    if (!ctx) return Promise.resolve(null);

    const fetchClip = async url => {
      const res = await fetch(url);
      const check = validateAssetResponse(res, url, 'audio');
      if (!check.ok) throw check.error;
      try {
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (decErr) {
        throw new Error(`[Supersonic Audio Error] Failed to decode ${url}: ${decErr.message}`);
      }
    };

    this.loading = (async () => {
      try {
        const loopPromise = fetchClip(`${SUPERSONIC_AUDIO_BASE_PATH}/supersonic-loop.wav`);
        const entryPromises = SUPERSONIC_CONFIG.ENTRY_TRACKS.map(trackName =>
          fetchClip(`${SUPERSONIC_AUDIO_BASE_PATH}/${trackName}.wav`)
        );
        const [loop, ...entries] = await Promise.all([loopPromise, ...entryPromises]);
        this.buffer = loop;
        this.entries = entries;
        this.mode = 'rich';
        return loop;
      } catch (loadErr) {
        this.mode = 'none';
        this.loadError = loadErr;
        console.error('[SupersonicAudio Error] Failed to load supersonic audio assets from ' + SUPERSONIC_AUDIO_BASE_PATH, loadErr);
        throw loadErr;
      }
    })().finally(() => {
      this.loading = null;
    });

    return this.loading;
  }

  async prepare() {
    if (this.mode === 'none') return;
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended' && !this.resumePending) {
      this.resumePending = true;
      ctx.resume().catch(() => {}).finally(() => {
        this.resumePending = false;
      });
    }

    try {
      await this.preload();
    } catch (e) {
      return;
    }

    if (!this.unlocked || !this.wanted || ctx?.state !== 'running') return;

    if (this.mode === 'rich') {
      if (this.source || !this.buffer) return;

      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = this.buffer;
      src.loop = true;
      src.loopStart = SUPERSONIC_CONFIG.LOOP_START;
      src.loopEnd = SUPERSONIC_CONFIG.LOOP_END;

      const settings = getAudioSettings();
      const layerVol = settings.vehicleSelfVolume ?? 1.0;
      const master = settings.masterVolume ?? 1.0;
      const targetGain = SUPERSONIC_CONFIG.LOOP_GAIN * layerVol * master;

      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.2);

      src.connect(gain).connect(getMasterAudioInput());
      src.start();

      this.source = src;
      this.gain = gain;
      this.applied = true;
      this.stopAt = 0;
      this.playPendingEntry();
    }
  }

  playPendingEntry() {
    const ctx = this.context;
    if (!this.unlocked || !this.entryDeadline || !ctx || ctx.state !== 'running' || this.entries.length === 0) return;

    const validTime = performance.now() <= this.entryDeadline;
    this.entryDeadline = 0;
    if (!validTime || !this.wanted) return;

    this.playEntrySound();
  }

  playEntrySound(pan = 0) {
    if (this.entries.length === 0) return;

    // Pick 1-of-3 non-consecutive
    let idx = 0;
    if (this.lastEntry < 0) {
      idx = Math.floor(Math.random() * this.entries.length);
    } else {
      idx = (this.lastEntry + 1 + Math.floor(Math.random() * (this.entries.length - 1))) % this.entries.length;
    }
    this.lastEntry = idx;

    const settings = getAudioSettings();
    const layerVol = settings.vehicleSelfVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const finalGain = SUPERSONIC_CONFIG.ENTRY_GAIN * layerVol * master;

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(this.entries[idx], {
        volume: finalGain,
        pan,
        priority: 4
      });
    }
  }

  update(isSupersonic, userActive = false, audible = true) {
    if (userActive) this.unlocked = true;

    const activeInTab = audible && (typeof document === 'undefined' || (!document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true)));
    const enteringSupersonic = Boolean(isSupersonic && !this.previousSupersonic && activeInTab);
    this.wanted = Boolean(isSupersonic && activeInTab);

    if (enteringSupersonic) {
      this.entryDeadline = performance.now() + 500;
    }
    this.previousSupersonic = Boolean(isSupersonic);

    if (!activeInTab || !isSupersonic) {
      this.entryDeadline = 0;
    }
    if (!activeInTab) {
      this.stopEntry();
    }

    if (this.unlocked && this.mode === 'unloaded' && !this.loading) {
      this.prepare();
    }

    if (this.mode === 'rich') {
      if (this.unlocked && (!this.buffer || (this.wanted && !this.source))) {
        this.prepare();
      }
      this.playPendingEntry();

      const ctx = this.context;
      if (ctx && this.gain) {
        if (this.wanted !== this.applied) {
          const now = ctx.currentTime;
          const currentGain = this.gain.gain.value;
          const settings = getAudioSettings();
          const layerVol = settings.vehicleSelfVolume ?? 1.0;
          const master = settings.masterVolume ?? 1.0;
          const targetGain = this.wanted ? SUPERSONIC_CONFIG.LOOP_GAIN * layerVol * master : 0;

          this.gain.gain.cancelScheduledValues(now);
          this.gain.gain.setValueAtTime(currentGain, now);
          this.gain.gain.linearRampToValueAtTime(targetGain, now + 0.2);
          this.applied = this.wanted;
          this.stopAt = this.wanted ? 0 : now + 0.21;
        }
        if (this.stopAt && ctx.currentTime >= this.stopAt) {
          this.stopLoop();
        }
      }
    }
  }

  stopLoop() {
    this.source?.stop();
    this.source?.disconnect();
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
    this.applied = false;
    this.stopAt = 0;
  }

  stopEntry() {
    this.entrySource?.stop();
    this.entrySource?.disconnect();
    this.entryGain?.disconnect();
    this.entrySource = null;
    this.entryGain = null;
  }

  silence() {
    this.wanted = false;
    this.entryDeadline = 0;
    this.stopLoop();
    this.stopEntry();
  }
}

// --- 5. Golden Boost Audio (Car Nozzle Emitter) ---
export const BOOST_AUDIO_BASE_PATH = '/assets/audio/boost';
const boostBufferCache = new WeakMap();

export class BoostAudio {
  constructor(spatial = false) {
    this.context = null;
    this.buffers = null;
    this.loading = null;
    this.generation = 0;
    this.boosting = false;
    this.startSource = null;
    this.loopSource = null;
    this.spatial = spatial;
    this.spatialBus = null;
    this.position = { x: 0, y: 0, z: 0, copy(p) { if (p) { this.x = p.x; this.y = p.y; this.z = p.z; } return this; } };
    this.enabled = true;
    this.voices = new Set();
  }

  getContext() {
    if (!this.context) {
      this.context = getAudioContext();
      if (this.spatial && !this.spatialBus && this.context) {
        this.spatialBus = new SpatialAudioSource(this.context, getMasterAudioInput());
        this.spatialBus.setPosition(this.position);
        this.spatialBus.setEnabled(this.enabled);
      }
    }
    return this.context;
  }

  setSpatial(spatial) {
    if (this.spatial === spatial) return;
    this.spatial = spatial;
    if (!spatial && this.spatialBus) {
      this.spatialBus.dispose();
      this.spatialBus = null;
    } else if (spatial && !this.spatialBus && this.context) {
      this.spatialBus = new SpatialAudioSource(this.context, getMasterAudioInput());
      this.spatialBus.setPosition(this.position);
      this.spatialBus.setEnabled(this.enabled);
    }
  }

  updateSpatial(pos, enabled) {
    if (this.spatial) {
      this.position.copy(pos);
      this.enabled = enabled;
      this.spatialBus?.setPosition(pos);
      this.spatialBus?.setEnabled(enabled);
    }
  }

  async preload() {
    if (typeof window === 'undefined') return;
    const bufs = await this.load();
    if (bufs.length !== 3) throw new Error('Golden Boost audio is unavailable');
  }

  load() {
    if (this.buffers) return Promise.resolve(this.buffers);
    if (this.loading) return this.loading;

    if (typeof window === 'undefined') return Promise.resolve([]);

    const ctx = this.getContext();
    const files = [`${BOOST_AUDIO_BASE_PATH}/start.wav`, `${BOOST_AUDIO_BASE_PATH}/loop.wav`, `${BOOST_AUDIO_BASE_PATH}/release.wav`];

    let cached = boostBufferCache.get(ctx);
    if (!cached) {
      cached = Promise.all(files.map(async url => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
        return ctx.decodeAudioData(await res.arrayBuffer());
      }));
      boostBufferCache.set(ctx, cached);
    }

    this.loading = cached.then(bufs => {
      this.buffers = bufs;
      return bufs;
    }).catch(err => {
      console.warn('Golden Boost audio could not be loaded', err);
      return [];
    });

    return this.loading;
  }

  play(buffer, volume, startTime, loop = false) {
    const ctx = this.getContext();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.loop = loop;

    const settings = getAudioSettings();
    const boostVol = settings.boostVolume ?? 0.8;
    const master = settings.masterVolume ?? 1.0;
    gain.gain.setValueAtTime(volume * 0.5 * boostVol * master, startTime);

    const dest = this.spatialBus?.input ?? getMasterAudioInput();
    src.connect(gain).connect(dest);

    const voice = { source: src, gain };
    this.voices.add(voice);
    src.addEventListener('ended', () => {
      src.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    }, { once: true });
    src.start(startTime);
    return voice;
  }

  setBoosting(isBoosting) {
    if (isBoosting === this.boosting) return;
    this.boosting = isBoosting;
    const gen = ++this.generation;
    if (isBoosting) {
      this.start(gen);
    } else {
      this.stop(gen);
    }
  }

  async start(gen) {
    const ctx = this.getContext();
    try {
      await ctx.resume();
    } catch (e) {}
    const bufs = await this.load();
    if (!this.boosting || !this.enabled || gen !== this.generation || bufs.length !== 3) return;

    const now = ctx.currentTime;
    this.stopCurrentVoices(now);
    this.startSource = this.play(bufs[0], dbToLinear(-3), now);
    this.loopSource = this.play(bufs[1], dbToLinear(-2), now + 0.3, true);
  }

  async stop(gen) {
    const ctx = this.context;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.stopCurrentVoices(now);

    const bufs = await this.load();
    if (this.boosting || !this.enabled || gen !== this.generation || bufs.length !== 3) return;

    try {
      await ctx.resume();
    } catch (e) {}
    if (!this.boosting && this.enabled && gen === this.generation) {
      this.play(bufs[2], dbToLinear(-8), ctx.currentTime);
    }
  }

  stopCurrentVoices(time) {
    this.fadeAndStop(this.loopSource, time, 0.1);
    this.fadeAndStop(this.startSource, time, 0.3);
    this.loopSource = null;
    this.startSource = null;
  }

  fadeAndStop(voice, time, duration) {
    if (voice) {
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, time);
      voice.gain.gain.linearRampToValueAtTime(0, time + duration);
      try {
        voice.source.stop(time + duration);
      } catch (e) {}
    }
  }

  dispose() {
    this.boosting = false;
    this.enabled = false;
    this.generation++;
    for (const v of this.voices) {
      try {
        v.source.stop();
      } catch (e) {}
      v.source.disconnect();
      v.gain.disconnect();
    }
    this.voices.clear();
    this.startSource = this.loopSource = null;
    this.spatialBus?.dispose();
    this.spatialBus = null;
  }
}

// --- 6. Flip Reset Event Audio ---
export const FLIP_RESET_AUDIO_PATH = '/assets/audio/events/reset.wav';

export class FlipResetAudio {
  constructor() {
    this.context = null;
    this.buffer = null;
    this.loading = null;
    this.load();
  }

  getContext() {
    return this.context || (this.context = getAudioContext()), this.context;
  }

  async preload() {
    if (!await this.load()) throw new Error('Flip reset audio is unavailable');
  }

  load() {
    if (this.buffer) return Promise.resolve(this.buffer);
    if (this.loading) return this.loading;

    if (typeof window === 'undefined') return Promise.resolve(null);

    const ctx = this.getContext();
    this.loading = fetch(FLIP_RESET_AUDIO_PATH).then(res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${FLIP_RESET_AUDIO_PATH}`);
      return res.arrayBuffer();
    }).then(buf => ctx.decodeAudioData(buf)).then(audioBuf => {
      this.buffer = audioBuf;
      return audioBuf;
    }).catch(err => {
      console.warn('Flip reset audio could not be loaded', err);
      return null;
    });

    return this.loading;
  }

  play() {
    if (!this.buffer) return;
    const settings = getAudioSettings();
    const layerVol = settings.vehicleSelfVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const finalVol = 0.78 * layerVol * master;

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(this.buffer, {
        volume: finalVol,
        priority: 3
      });
    }
  }
}

// --- 7. Custom Game Audio Manager & Match Announcements ---
export class GameAudioManager {
  constructor() {
    this.buffers = new Map();
    this.soundDefs = {
      boost_collect: '/custom/assets/audio/boost_collect.wav',
      match_30_seconds_left: '/custom/assets/audio/match_30_seconds_left.wav',
      match_countdown_321: '/custom/assets/audio/match_countdown_321.wav',
      match_entering_overtime: '/custom/assets/audio/match_entering_overtime.wav',
      match_start_go: '/custom/assets/audio/match_start_go.wav',
      sfx_error_no_boost: '/custom/assets/audio/sfx_error_no_boost.wav',
      sfx_goal_poof: '/custom/assets/audio/sfx_goal_poof.wav',
      sfx_state_supersonic: '/custom/assets/audio/sfx_state_supersonic.wav'
    };
    this.lastPlayTime = new Map();
  }

  async loadAll() {
    if (typeof window === 'undefined') return;
    for (const [key, url] of Object.entries(this.soundDefs)) {
      this.loadSound(key, url);
    }
  }

  async loadSound(key, url) {
    if (typeof window === 'undefined') return null;
    if (this.buffers.has(key)) return this.buffers.get(key);
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const ctx = getAudioContext();
      const data = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(data);
      this.buffers.set(key, buf);
      return buf;
    } catch (e) {
      console.warn(`[GameAudio] Failed to load ${key}:`, (e && e.message) || e);
      return null;
    }
  }

  play(key, volMult = 1.0, minInterval = 0) {
    const now = performance.now();
    if (minInterval > 0) {
      const last = this.lastPlayTime.get(key) || 0;
      if (now - last < minInterval) return;
    }
    this.lastPlayTime.set(key, now);

    const buf = this.buffers.get(key);
    if (!buf) {
      if (this.soundDefs[key]) this.loadSound(key, this.soundDefs[key]);
      return;
    }

    const settings = getAudioSettings();
    const master = settings.masterVolume ?? 1.0;
    const boostVol = settings.boostVolume ?? 0.8;
    const finalVol = Math.max(0, Math.min(5.0, volMult * master * boostVol));

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(buf, {
        volume: finalVol,
        priority: 3
      });
    }
  }
}

export const gameAudio = new GameAudioManager();
gameAudio.loadAll();

export const boostCollectAudio = {
  play: () => gameAudio.play('boost_collect', 1.0, 100),
  load: () => gameAudio.loadAll()
};

// --- 8. Complete Event-Driven Game Audio Engine ---
export const BALL_HIT_AUDIO_FILES = Object.freeze([
  '/custom/assets/audio/ball_hit/vehicle-body-01.wav',
  '/custom/assets/audio/ball_hit/vehicle-body-02.wav',
  '/custom/assets/audio/ball_hit/vehicle-body-03.wav',
  '/custom/assets/audio/ball_hit/vehicle-body-04.wav'
]);

export const CAR_COLLISION_DETAIL_FILES = Object.freeze([
  '/assets/audio/impacts/vehicle-detail-01.wav',
  '/assets/audio/impacts/vehicle-detail-02.wav',
  '/assets/audio/impacts/vehicle-detail-03.wav',
  '/assets/audio/impacts/vehicle-detail-04.wav',
  '/assets/audio/impacts/vehicle-detail-05.wav',
  '/assets/audio/impacts/vehicle-detail-06.wav'
]);

export const SFX_CAR_COLLISION_FILE = '/custom/assets/audio/sfx_car_collision.wav';
export const GOALPOST_AUDIO_FILE = '/assets/audio/impacts/vehicle-hard-04.wav';
export const BOOST_COLLECT_FILE = '/custom/assets/audio/boost_collect.wav';

/**
 * Unified Event-Driven Audio Engine
 * Coordinates sound synthesis for all physics events from the ring buffer.
 */
export class GameAudioEngine {
  constructor() {
    this.context = null;

    // Audio Buffers
    this.ballHitBuffers = [];
    this.carCollisionBuffers = [];
    this.sfxCarCollisionBuffer = null;
    this.goalpostBuffer = null;
    this.boostCollectBuffer = null;

    // State Tracking
    this.lastCarBallHitTimestamp = 0;
    this.lastBallWorldHitTimestamp = 0;
    this.lastCarCollisionTimestamp = 0;
    this.lastSupersonicIdx = -1;
    this.lastBallHitSoundIdx = -1;

    // Load state
    this.loading = false;
    this.loaded = false;
  }

  getContext() {
    return this.context || (this.context = getAudioContext()), this.context;
  }

  async preload() {
    if (this.loaded || this.loading || typeof window === 'undefined') return;
    this.loading = true;
    const ctx = this.getContext();

    const fetchBuf = async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (e) {
        console.warn('[GameAudioEngine] Failed to load sound:', url, e);
        return null;
      }
    };

    try {
      // 1. Ball Hit 4 files
      this.ballHitBuffers = (await Promise.all(BALL_HIT_AUDIO_FILES.map(fetchBuf))).filter(Boolean);

      // 2. Car collision details (6 files) & SFX collision
      this.carCollisionBuffers = (await Promise.all(CAR_COLLISION_DETAIL_FILES.map(fetchBuf))).filter(Boolean);
      this.sfxCarCollisionBuffer = await fetchBuf(SFX_CAR_COLLISION_FILE);

      // 3. Goalpost buffer
      this.goalpostBuffer = await fetchBuf(GOALPOST_AUDIO_FILE);

      // 4. Boost collect buffer
      this.boostCollectBuffer = await fetchBuf(BOOST_COLLECT_FILE);

      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Dispatches a physics event directly to appropriate audio handlers
   */
  handleEvent(event, camera = null) {
    if (!event) return;
    switch (event.type) {
      case PHYSICS_EVENT_TYPES.CAR_BALL_HIT:
        this.handleCarBallHit(event, camera);
        break;
      case PHYSICS_EVENT_TYPES.CAR_CAR_COLLISION:
        this.handleCarCarCollision(event, camera);
        break;
      case PHYSICS_EVENT_TYPES.BALL_WORLD_HIT:
        this.handleBallWorldHit(event, camera);
        break;
      case PHYSICS_EVENT_TYPES.BALL_GOALPOST_HIT:
        this.handleBallGoalpostHit(event, camera);
        break;
      case PHYSICS_EVENT_TYPES.CAR_ACTION:
        this.handleCarAction(event, camera);
        break;
      case PHYSICS_EVENT_TYPES.CAR_SUPERSONIC_ENTER:
        this.handleSupersonicEnter(event, camera);
        break;
      case PHYSICS_EVENT_TYPES.BOOST_PICKUP:
        this.handleBoostPickup(event, camera);
        break;
    }
  }

  // 1. Car-Ball Hit
  handleCarBallHit(event, camera) {
    const settings = getAudioSettings();
    const now = performance.now();

    // 0-100ms Cooldown Debounce Window Check
    const cooldownMs = settings.carBallHitCooldownMs ?? 40;
    if (now - this.lastCarBallHitTimestamp < cooldownMs) {
      return;
    }

    const impulse = Number.isFinite(event.impulse) ? event.impulse : (event.relSpeed ?? 0);
    const threshold = settings.carBallHitImpulseThreshold ?? 0;
    if (impulse < threshold) {
      return;
    }

    if (this.ballHitBuffers.length === 0) {
      this.preload();
      return;
    }

    this.lastCarBallHitTimestamp = now;

    // Strictly randomize among 4 vehicle body wavs (non-consecutive if possible)
    let idx = Math.floor(Math.random() * this.ballHitBuffers.length);
    if (this.ballHitBuffers.length > 1 && idx === this.lastBallHitSoundIdx) {
      idx = (idx + 1 + Math.floor(Math.random() * (this.ballHitBuffers.length - 1))) % this.ballHitBuffers.length;
    }
    this.lastBallHitSoundIdx = idx;

    const layerVol = settings.ballCollisionVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const volume = Math.max(0, Math.min(5.0, 1.0 * layerVol * master));
    const pan = computePanFromCoords(event, camera);

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(this.ballHitBuffers[idx], {
        volume,
        pan,
        priority: 5
      });
    }
  }

  // 2. Car-Car Collision
  handleCarCarCollision(event, camera) {
    const settings = getAudioSettings();
    const now = performance.now();
    if (now - this.lastCarCollisionTimestamp < 40) return;
    this.lastCarCollisionTimestamp = now;

    const layerVol = settings.carCarCollisionVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const volume = Math.max(0, Math.min(5.0, 1.0 * layerVol * master));
    const pan = computePanFromCoords(event, camera);
    const pool = getAudioSlotPool();
    if (!pool) return;

    if (settings.carCarSoundMode === 'vehicle_detail' && this.carCollisionBuffers.length > 0) {
      // 1-of-6 random detail
      const idx = Math.floor(Math.random() * this.carCollisionBuffers.length);
      pool.playBuffer(this.carCollisionBuffers[idx], { volume, pan, priority: 6 });
    } else if (this.sfxCarCollisionBuffer) {
      pool.playBuffer(this.sfxCarCollisionBuffer, { volume, pan, priority: 6 });
    } else {
      this.preload();
    }
  }

  // 3. Ball-World (Pitch / Arena floor & walls)
  handleBallWorldHit(event, camera) {
    // Mute ground bounce / roll on pitch grass (surfaceTag 1 = pitch, 2 = wall/ceiling)
    if (event?.surfaceTag === 1) return;

    const settings = getAudioSettings();
    const now = performance.now();
    if (now - this.lastBallWorldHitTimestamp < 40) return;
    this.lastBallWorldHitTimestamp = now;

    if (this.ballHitBuffers.length === 0) {
      this.preload();
      return;
    }

    // Shares 4 random hits with car-ball hit
    const idx = Math.floor(Math.random() * this.ballHitBuffers.length);
    const layerVol = settings.ballCollisionVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const volume = Math.max(0, Math.min(5.0, 0.8 * layerVol * master));
    const pan = computePanFromCoords(event, camera);

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(this.ballHitBuffers[idx], { volume, pan, priority: 3 });
    }
  }

  // 4. Ball-Goalpost & Crossbar
  handleBallGoalpostHit(event, camera) {
    const settings = getAudioSettings();
    const pool = getAudioSlotPool();
    if (!pool) return;

    if (!this.goalpostBuffer) {
      this.preload();
      return;
    }

    // STRICT REQUIREMENT: strictly vehicle-hard-04.wav, volume at 200% (2x ballCollisionVolume)
    const layerVol = settings.ballCollisionVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const volume = Math.max(0, Math.min(5.0, 2.0 * layerVol * master)); // 2x layer volume
    const pan = computePanFromCoords(event, camera);

    pool.playBuffer(this.goalpostBuffer, {
      volume,
      pan,
      priority: 8 // High priority
    });
  }

  // 5. Car Action (Single Jump, Double Jump, Dodge)
  handleCarAction(event, camera) {
    const subType = event.actionSubType || event.subType;
    let key = 'jump';
    let pan = computePanFromCoords(event, camera);

    if (subType === CAR_ACTION_SUBTYPES.DOUBLE_JUMP) {
      key = 'doubleJump';
    } else if (subType === CAR_ACTION_SUBTYPES.DODGE) {
      key = 'dodge';
      pan = 0; // Dodge: constant sound at trigger position without spatial direction calculation
    }

    vehicleActionAudio.play(key, 0.7, pan);
  }

  // 6. Supersonic Enter
  handleSupersonicEnter(event, camera) {
    const pan = computePanFromCoords(event, camera);
    supersonicAudio.playEntrySound(pan);
  }

  // 7. Boost Pickup
  handleBoostPickup(event, camera) {
    const pool = getAudioSlotPool();
    if (!pool) return;

    if (!this.boostCollectBuffer) {
      this.preload();
      return;
    }

    const settings = getAudioSettings();
    const master = settings.masterVolume ?? 1.0;
    const boostVol = settings.boostVolume ?? 0.8;
    const pan = computePanFromCoords(event, camera);

    // Big Pad vs Small Pad differentiation
    const isBig = Boolean(event.isBig);
    const volumeMult = isBig ? 1.25 : 0.85;
    const playbackRate = isBig ? 0.95 : 1.15;
    const finalVol = Math.max(0, Math.min(5.0, volumeMult * master * boostVol));

    pool.playBuffer(this.boostCollectBuffer, {
      volume: finalVol,
      pan,
      playbackRate,
      priority: 4
    });
  }
}

export const gameAudioEngine = new GameAudioEngine();
gameAudioEngine.preload();

// Existing instance exports for backwards compatibility
export const vehicleActionAudio = new VehicleActionAudio();
export const supersonicAudio = new SupersonicAudio();

// Backward compatibility adapter for legacy BallHitAudio callers
export class BallHitAudio {
  play(event, camera = null) {
    gameAudioEngine.handleCarBallHit(event, camera);
  }
  preload() {
    return gameAudioEngine.preload();
  }
  reset() {}
}
export const ballHitAudio = new BallHitAudio();
