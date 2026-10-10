import { useSyncExternalStore } from 'react';

export interface LivePreviewState {
  /** Active live preview ID (e.g. 'ball-trajectory-predictor') or null if none active */
  activePreviewId: string | null;
  /** Whether the preview is currently collapsed to the right-middle dock pill */
  isCollapsed: boolean;
  /** Custom label for the collapsed dock badge */
  dockLabel?: string;
}

let state: LivePreviewState = {
  activePreviewId: null,
  isCollapsed: false,
  dockLabel: 'Ball Trajectory Predictor',
};

const listeners = new Set<() => void>();
const notify = () => {
  listeners.forEach((l) => l());
};

export const livePreviewStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Register or enter a Live Preview session */
  enterPreview: (previewId: string, dockLabel = 'Ball Trajectory Predictor') => {
    state = {
      activePreviewId: previewId,
      isCollapsed: false,
      dockLabel,
    };
    notify();
  },
  /** Toggle collapse/expand state via Tab key or click */
  toggleCollapse: () => {
    if (!state.activePreviewId) return;
    state = {
      ...state,
      isCollapsed: !state.isCollapsed,
    };
    notify();
  },
  /** Set explicit collapse state */
  setCollapsed: (collapsed: boolean) => {
    if (!state.activePreviewId) return;
    state = {
      ...state,
      isCollapsed: collapsed,
    };
    notify();
  },
  /** Exit Live Preview session completely */
  exitPreview: () => {
    state = {
      activePreviewId: null,
      isCollapsed: false,
      dockLabel: undefined,
    };
    notify();
  },
};

export const useLivePreviewStore = () => {
  const snapshot = useSyncExternalStore(livePreviewStore.subscribe, livePreviewStore.getSnapshot);
  return {
    activePreviewId: snapshot.activePreviewId,
    isCollapsed: snapshot.isCollapsed,
    dockLabel: snapshot.dockLabel,
    enterPreview: livePreviewStore.enterPreview,
    toggleCollapse: livePreviewStore.toggleCollapse,
    setCollapsed: livePreviewStore.setCollapsed,
    exitPreview: livePreviewStore.exitPreview,
  };
};
