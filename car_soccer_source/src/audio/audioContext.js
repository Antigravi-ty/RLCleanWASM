import { AudioMixer } from './AudioMixer.js';
import { AudioSlotPool } from './AudioSlotPool.js';
import { audioConfig } from './audioConfig.js';
import { listenerManager } from './SpatialAudioSource.js';

export const subsystemState = {
  context: null,
  masterMixer: null,
  slotPool: null,
  buffers: new Map(),
  loading: null,
  loaded: false,
  audioEngine: null
};

export function registerAudioEngine(engine) {
  subsystemState.audioEngine = engine;
}

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!subsystemState.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    let ctx;
    try {
      ctx = new AudioContextClass({ latencyHint: 0 });
    } catch (_) {
      console.warn('[AudioArchitecture:getAudioContext] Failed latencyHint 0, fallback to interactive:', _);
      try {
        ctx = new AudioContextClass({ latencyHint: "interactive" });
      } catch (__) {
        console.warn('[AudioArchitecture:getAudioContext] Failed latencyHint interactive, fallback to default:', __);
        ctx = new AudioContextClass();
      }
    }
    subsystemState.context = ctx;
    listenerManager.setContext(ctx);

    const master = new AudioMixer(ctx);
    master.setVolume(audioConfig.get('masterVolume'));
    master.setActive(true);
    subsystemState.masterMixer = master;

    subsystemState.slotPool = new AudioSlotPool(ctx, 10, master.input);
    subsystemState.slotPool.init(master.input);

    const onAudioReady = () => {
      if (ctx.state === "running") {
        master.setActive(true);
        master.apply();
        subsystemState.audioEngine?.stateEngine?._startLoops?.();
      }
    };

    // User interaction audio unlock
    const unlock = () => {
      if (ctx.state === "suspended") {
        ctx.resume().then(onAudioReady).catch((err) => console.warn('[AudioArchitecture] AudioContext unlock resume failed/blocked:', err));
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
        if (subsystemState.slotPool) subsystemState.slotPool.isMuted = false;
        master.setActive(true);
      } else {
        if (!hasFocus) {
          master.setActive(false);
          if (subsystemState.slotPool) {
            subsystemState.slotPool.isMuted = true;
            subsystemState.slotPool.silenceAll();
          }
          subsystemState.audioEngine?.silenceAll?.();
        } else {
          // Regaining focus without background audio permitted:
          // Immediately flush output, unblock buffer reception, and clear all voice slots to avoid audio pops & latency
          master.flush();
          if (subsystemState.slotPool) {
            subsystemState.slotPool.silenceAll();
            subsystemState.slotPool.isMuted = false;
          }
          subsystemState.audioEngine?.silenceAll?.();
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
