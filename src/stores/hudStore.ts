import { create } from 'zustand';
import { formatBindingDisplayName, loadInputBindings } from '../config/InputBindings.js';

export type HudFlipStatus = 'grounded' | 'countdown' | 'unlimited' | 'none';

export interface HudStoreState {
  // Ball Camera
  ballCamActive: boolean;
  ballCamShortcut: string | null;
  onToggleBallCam: (() => void) | null;

  // Boost, Flip & Speed Inventory
  boostAmount: number;
  isBoosting: boolean;
  isUnlimited: boolean;
  hasFlip: boolean;
  flipStatus: HudFlipStatus;
  flipRemainingSeconds: number;
  carSpeed: number;

  // Match & Scoreboard State
  blueScore: number;
  orangeScore: number;
  remainingSeconds: number;
  overtimeSeconds: number;
  isOvertime: boolean;
  isPaused?: boolean;
  kickoffCountdown: number; // 0: inactive, 1..3: countdown ticks
  matchPhase: 'warmup' | 'prepare' | 'kickoff' | 'playing' | 'goal' | 'replay' | 'paused' | 'ended' | 'podium' | 'freeplay';
  winner?: number | string | null; // 0/'BLUE': Blue, 1/'ORANGE': Orange, 2/'DRAW': Draw
  winReason?: string | null;

  // Replay Timeline Scrubbing & Goal Telemetry State
  replayProgress: number;
  replayFrameIndex: number;
  replayTotalFrames: number;
  replayPaused: boolean;
  replayPersistent: boolean;
  replaySpeed: number;
  replayCameraMode: 'director' | 'pov';
  replayScorerName: string | null;
  replayScorerTeam: number | null;
  replayBallSpeedKph: number | null;
  replayAssistName: string | null;
  onReplaySeekNormalized?: ((progress01: number) => void) | null;
  onReplayTogglePause?: (() => void) | null;
  onReplayCycleSpeed?: (() => void) | null;
  onReplayToggleCameraMode?: (() => void) | null;

  // Mutator Actions
  setBallCamActive: (active: boolean) => void;
  setBallCamShortcut: (shortcut: string | null) => void;
  syncBindings: (bindings: any) => void;
  setOnToggleBallCam: (fn: (() => void) | null) => void;
  toggleBallCam: () => void;
  setBoost: (amount: number, isBoosting?: boolean, isUnlimited?: boolean) => void;
  setHasFlip: (hasFlip: boolean, flipStatus?: HudFlipStatus, flipRemainingSeconds?: number) => void;
  setCarSpeed: (speed: number) => void;
  setReplayState: (state: Partial<{
    replayProgress: number;
    replayFrameIndex: number;
    replayTotalFrames: number;
    replayPaused: boolean;
    replayPersistent: boolean;
    replaySpeed: number;
    replayCameraMode: 'director' | 'pov';
    replayScorerName: string | null;
    replayScorerTeam: number | null;
    replayBallSpeedKph: number | null;
    replayAssistName: string | null;
    onReplaySeekNormalized: ((progress01: number) => void) | null;
    onReplayTogglePause: (() => void) | null;
    onReplayCycleSpeed: (() => void) | null;
    onReplayToggleCameraMode: (() => void) | null;
  }>) => void;
  setMatchState: (state: Partial<{
    blueScore: number;
    orangeScore: number;
    remainingSeconds: number;
    overtimeSeconds: number;
    isOvertime: boolean;
    isPaused?: boolean;
    kickoffCountdown: number;
    matchPhase: 'warmup' | 'prepare' | 'kickoff' | 'playing' | 'goal' | 'replay' | 'paused' | 'ended' | 'podium' | 'freeplay';
    winner?: number | string | null;
    winReason?: string | null;
    replayScorerName?: string | null;
    replayScorerTeam?: number | null;
    replayBallSpeedKph?: number | null;
    replayAssistName?: string | null;
  }>) => void;
}

/**
 * Extracts the first bound key or button display name for ballCam action.
 * Returns null if no binding is present, or formatted uppercase name (e.g. 'SPACE', 'C', 'L SHIFT', 'Y').
 */
export function extractFirstBallCamShortcut(bindings: any): string | null {
  if (!bindings) return 'SPACE';
  const kList = bindings.keyboard?.ballCam;
  if (Array.isArray(kList) && kList.length > 0 && kList[0]) {
    const name = formatBindingDisplayName(kList[0]);
    if (name) return name.toUpperCase();
  }
  const pList = bindings.pad?.ballCam;
  if (Array.isArray(pList) && pList.length > 0 && pList[0]) {
    const name = formatBindingDisplayName(pList[0]);
    if (name) return name.toUpperCase();
  }
  return null;
}

function getInitialBallCamShortcut(): string | null {
  if (typeof window === 'undefined') return 'SPACE';
  try {
    const initialBindings = loadInputBindings();
    return extractFirstBallCamShortcut(initialBindings) ?? 'SPACE';
  } catch (err) {
    console.warn('[hudStore] Failed to parse input bindings for ball-cam shortcut, falling back to SPACE:', err);
    return 'SPACE';
  }
}

/**
 * useHudStore / hudStore
 * High-performance decoupled Zustand state store for Match HUD elements.
 * Features zero-allocation dirty checking to ensure minimum React re-renders.
 */
export const useHudStore = create<HudStoreState>((set, get) => ({
  ballCamActive: true,
  ballCamShortcut: getInitialBallCamShortcut(),
  onToggleBallCam: null,

  boostAmount: 100,
  isBoosting: false,
  isUnlimited: true,
  hasFlip: true,
  flipStatus: 'grounded',
  flipRemainingSeconds: 1.25,
  carSpeed: 0,

  blueScore: 0,
  orangeScore: 0,
  remainingSeconds: 300,
  overtimeSeconds: 0,
  isOvertime: false,
  isPaused: false,
  kickoffCountdown: 0,
  matchPhase: 'warmup',
  winner: null,
  winReason: null,

  replayProgress: 0,
  replayFrameIndex: 0,
  replayTotalFrames: 360,
  replayPaused: false,
  replayPersistent: false,
  replaySpeed: 1.0,
  replayCameraMode: 'director',
  replayScorerName: null,
  replayScorerTeam: null,
  replayBallSpeedKph: null,
  replayAssistName: null,
  onReplaySeekNormalized: null,
  onReplayTogglePause: null,
  onReplayCycleSpeed: null,
  onReplayToggleCameraMode: null,

  setBallCamActive: (active: boolean) => {
    if (get().ballCamActive === active) return;
    set({ ballCamActive: active });
  },

  setBallCamShortcut: (shortcut: string | null) => {
    if (get().ballCamShortcut === shortcut) return;
    set({ ballCamShortcut: shortcut });
  },

  syncBindings: (bindings: any) => {
    const shortcut = extractFirstBallCamShortcut(bindings);
    if (get().ballCamShortcut === shortcut) return;
    set({ ballCamShortcut: shortcut });
  },

  setOnToggleBallCam: (fn: (() => void) | null) => {
    set({ onToggleBallCam: fn });
  },

  toggleBallCam: () => {
    const fn = get().onToggleBallCam;
    if (typeof fn === 'function') {
      fn();
    }
  },

  setBoost: (amount: number, isBoosting = false, isUnlimited = false) => {
    const clamped = Math.max(0, Math.min(100, Math.round(amount)));
    const cur = get();
    if (
      cur.boostAmount === clamped &&
      cur.isBoosting === isBoosting &&
      cur.isUnlimited === isUnlimited
    ) {
      return;
    }
    set({
      boostAmount: clamped,
      isBoosting,
      isUnlimited,
    });
  },

  setHasFlip: (
    hasFlip: boolean,
    flipStatus: HudFlipStatus = hasFlip ? 'grounded' : 'none',
    flipRemainingSeconds = hasFlip ? 1.25 : 0
  ) => {
    const val = Boolean(hasFlip);
    const roundedRem = Math.max(0, Math.round((Number(flipRemainingSeconds) || 0) * 100) / 100);
    const cur = get();
    if (
      cur.hasFlip === val &&
      cur.flipStatus === flipStatus &&
      Math.abs(cur.flipRemainingSeconds - roundedRem) < 0.005
    ) {
      return;
    }
    set({
      hasFlip: val,
      flipStatus,
      flipRemainingSeconds: roundedRem,
    });
  },

  setCarSpeed: (rawSpeed: number) => {
    const v = Math.max(0, Math.min(2300, Math.round(Math.abs(rawSpeed || 0) * 10) / 10));
    if (Math.abs(v - get().carSpeed) < 0.2) return;
    set({ carSpeed: v });
  },

  setReplayState: (partialReplay) => {
    const cur = get();
    let hasChanges = false;
    for (const [k, v] of Object.entries(partialReplay)) {
      if ((cur as any)[k] !== v) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) {
      set(partialReplay);
    }
  },

  setMatchState: (partialState) => {
    const cur = get();
    let hasChanges = false;
    for (const [k, v] of Object.entries(partialState)) {
      if ((cur as any)[k] !== v) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) {
      set(partialState);
    }
  },
}));

export const hudStore = useHudStore;
