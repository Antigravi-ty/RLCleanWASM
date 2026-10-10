import { create } from 'zustand';
import { formatBindingDisplayName, loadInputBindings } from '../../input/InputBindings.js';

export interface HudStoreState {
  // Ball Camera
  ballCamActive: boolean;
  ballCamShortcut: string | null;
  onToggleBallCam: (() => void) | null;

  // Boost Inventory
  boostAmount: number;
  isBoosting: boolean;
  isUnlimited: boolean;

  // Mutator Actions
  setBallCamActive: (active: boolean) => void;
  setBallCamShortcut: (shortcut: string | null) => void;
  syncBindings: (bindings: any) => void;
  setOnToggleBallCam: (fn: (() => void) | null) => void;
  toggleBallCam: () => void;
  setBoost: (amount: number, isBoosting?: boolean, isUnlimited?: boolean) => void;
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
  } catch {
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
}));

export const hudStore = useHudStore;
