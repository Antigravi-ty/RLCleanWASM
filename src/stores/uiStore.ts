import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/storageHelpers';
import {
  ViewportMetrics,
  safeStorage,
  getInitialMargin,
  getInitialUiScale,
  getInitialSafeAreaHud,
} from '../config/uiConfig';

export type { ViewportMetrics };

export interface UIState {
  safeAreaMargin: number; // -5 to +10
  uiScale: number; // 50 to 200 (%)
  showSafeAreaHud: boolean;
  portraitDismissed: boolean;
  metrics: ViewportMetrics;

  setUiScale: (scale: number) => void;
  setSafeAreaMargin: (margin: number) => void;
  setShowSafeAreaHud: (show: boolean) => void;
  dismissPortraitGate: () => void;
  setMetrics: (metrics: ViewportMetrics) => void;
}

export const useUIStore = create<UIState>((set) => ({
  safeAreaMargin: getInitialMargin(),
  uiScale: getInitialUiScale(),
  showSafeAreaHud: getInitialSafeAreaHud(),
  portraitDismissed: false,
  metrics: {
    scaleFactor: 1,
    renderWidth: 1920,
    renderHeight: 1080,
    isPortrait: false,
    isPillarboxed: false,
    pillarboxWidth: 0,
    safeMarginPct: 0,
  },

  setUiScale: (scale) => {
    const clamped = Math.min(200, Math.max(50, Math.round(scale)));
    safeStorage.set(STORAGE_KEYS.UI_SCALE, clamped);
    set({ uiScale: clamped });
  },

  setSafeAreaMargin: (pct) => {
    const clamped = Math.min(10, Math.max(-5, Math.round(pct)));
    set({ safeAreaMargin: clamped });
    safeStorage.set(STORAGE_KEYS.SAFE_AREA_MARGIN, clamped);
  },

  setShowSafeAreaHud: (show) => {
    set({ showSafeAreaHud: show });
    safeStorage.set(STORAGE_KEYS.SAFE_AREA_VISIBLE, show);
  },

  dismissPortraitGate: () => set({ portraitDismissed: true }),

  setMetrics: (metrics) => set({ metrics }),
}));
