import { useSyncExternalStore } from 'react';
import type { PresetConfig } from './floatingPresets';

export interface FloatingWindowItem {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  width?: number;
  height?: number;
  isMinimized: boolean;
  position?: { x: number; y: number };
  resizable?: boolean;
}

export interface FlyingGhostState {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  destX: number;
  destY: number;
  preset: PresetConfig;
  targetHadStack: boolean;
}

export interface FloatingWindowState {
  /** Map of registered floating windows */
  windows: FloatingWindowItem[];
  /** Order of windows for z-index layering (last is on top) */
  windowOrder: string[];
  /** Whether the stack tray dropdown in top-right is open */
  isStackTrayOpen: boolean;
  /** Whether the stack icon itself in top-right is dismissed by user (when window count == 0) */
  isStackDismissed: boolean;
  /** Currently active (focused) restored window id */
  focusedWindowId: string | null;
  /** Currently active spawning flight animation to top-right Stack */
  activeFlight: FlyingGhostState | null;
  /** Counter signal to trigger animated batch minimization of all open windows */
  batchMinimizeSignal: number;
}

let state: FloatingWindowState = {
  windows: [],
  windowOrder: [],
  isStackTrayOpen: false,
  isStackDismissed: true,
  focusedWindowId: null,
  activeFlight: null,
  batchMinimizeSignal: 0,
};

const listeners = new Set<() => void>();
const notify = () => {
  listeners.forEach((l) => l());
};

export const floatingStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Add a new floating window (default: restored or minimized depending on parameters) */
  spawnWindow: (item: Omit<FloatingWindowItem, 'isMinimized'> & { startMinimized?: boolean }) => {
    const existing = state.windows.find((w) => w.id === item.id);
    if (existing) {
      // If already exists, restore it and focus it
      const nextOrder = state.windowOrder.filter((id) => id !== item.id).concat(item.id);
      state = {
        ...state,
        windows: state.windows.map((w) => (w.id === item.id ? { ...w, isMinimized: false } : w)),
        windowOrder: nextOrder,
        isStackDismissed: false,
        focusedWindowId: item.id,
        isStackTrayOpen: false,
      };
      notify();
      return;
    }

    const defaultPos = {
      x: 40 + (state.windows.length % 5) * 32,
      y: 40 + (state.windows.length % 5) * 32,
    };

    const newItem: FloatingWindowItem = {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      category: item.category,
      width: item.width ?? 440,
      height: item.height ?? 300,
      isMinimized: item.startMinimized ?? false,
      position: item.position ?? defaultPos,
      resizable: item.resizable ?? true,
    };

    const nextOrder = newItem.isMinimized
      ? state.windowOrder
      : state.windowOrder.filter((id) => id !== newItem.id).concat(newItem.id);

    state = {
      ...state,
      windows: [...state.windows, newItem],
      windowOrder: nextOrder,
      isStackDismissed: false,
      focusedWindowId: newItem.isMinimized ? state.focusedWindowId : newItem.id,
    };
    notify();
  },
  /** Bring window to top of stacking order */
  bringToFront: (id: string) => {
    if (state.focusedWindowId === id && state.windowOrder[state.windowOrder.length - 1] === id) {
      return;
    }
    const nextOrder = state.windowOrder.filter((item) => item !== id).concat(id);
    state = {
      ...state,
      windowOrder: nextOrder,
      focusedWindowId: id,
    };
    notify();
  },
  /** Update recorded window position */
  updatePosition: (id: string, position: { x: number; y: number }) => {
    state = {
      ...state,
      windows: state.windows.map((w) => (w.id === id ? { ...w, position } : w)),
    };
    notify();
  },
  /** Update recorded window dimensions */
  updateSize: (id: string, size: { width: number; height: number }) => {
    state = {
      ...state,
      windows: state.windows.map((w) => (w.id === id ? { ...w, width: size.width, height: size.height } : w)),
    };
    notify();
  },
  /** Minimize a window to the top-right stack icon */
  minimizeWindow: (id: string) => {
    state = {
      ...state,
      windows: state.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
      windowOrder: state.windowOrder.filter((winId) => winId !== id),
      isStackDismissed: false,
      isStackTrayOpen: false,
      focusedWindowId: state.focusedWindowId === id ? null : state.focusedWindowId,
    };
    notify();
  },
  /** Restore a window from the stack tray */
  restoreWindow: (id: string) => {
    const nextOrder = state.windowOrder.filter((winId) => winId !== id).concat(id);
    state = {
      ...state,
      windows: state.windows.map((w) => (w.id === id ? { ...w, isMinimized: false } : w)),
      windowOrder: nextOrder,
      focusedWindowId: id,
      isStackTrayOpen: false,
    };
    notify();
  },
  /** Close and destroy a window permanently */
  closeWindow: (id: string) => {
    const nextWindows = state.windows.filter((w) => w.id !== id);
    const nextOrder = state.windowOrder.filter((wId) => wId !== id);
    const remainingMinimized = nextWindows.filter((w) => w.isMinimized).length;
    state = {
      ...state,
      windows: nextWindows,
      windowOrder: nextOrder,
      isStackTrayOpen: remainingMinimized > 0 ? state.isStackTrayOpen : false,
      focusedWindowId: state.focusedWindowId === id ? null : state.focusedWindowId,
    };
    notify();
  },
  /** Toggle stack tray list dropdown */
  toggleStackTray: () => {
    const minimizedCount = state.windows.filter((w) => w.isMinimized).length;
    if (minimizedCount === 0) return;
    state = {
      ...state,
      isStackTrayOpen: !state.isStackTrayOpen,
    };
    notify();
  },
  setStackTrayOpen: (open: boolean) => {
    const minimizedCount = state.windows.filter((w) => w.isMinimized).length;
    if (open && minimizedCount === 0) return;
    state = {
      ...state,
      isStackTrayOpen: open,
    };
    notify();
  },
  /** Dismiss stack icon only when 0 minimized windows remain */
  dismissStack: () => {
    const minimizedCount = state.windows.filter((w) => w.isMinimized).length;
    if (minimizedCount === 0) {
      state = {
        ...state,
        isStackDismissed: true,
        isStackTrayOpen: false,
      };
      notify();
    }
  },
  /** Reset or clear all windows */
  clearAll: () => {
    state = {
      windows: [],
      windowOrder: [],
      isStackTrayOpen: false,
      isStackDismissed: true,
      focusedWindowId: null,
      activeFlight: null,
    };
    notify();
  },
  /** Start flying animation from source button to top-right Stack */
  spawnWithFlight: (preset: PresetConfig, sourceEl: HTMLElement, containerEl: HTMLElement) => {
    const srcRect = sourceEl.getBoundingClientRect();
    const contRect = containerEl.getBoundingClientRect();

    const startX = Math.round(srcRect.left - contRect.left);
    const startY = Math.round(srcRect.top - contRect.top);
    const startW = Math.round(srcRect.width);
    const startH = Math.round(srcRect.height);

    // Resolve exact Stack Icon position if present in DOM, otherwise fallback to top-right
    let destX = Math.max(16, Math.round(contRect.width - 56));
    let destY = 16;
    if (typeof document !== 'undefined') {
      const stackEl = document.querySelector('[data-ui-element="stack-icon"]');
      if (stackEl) {
        const sRect = stackEl.getBoundingClientRect();
        destX = Math.round(sRect.left - contRect.left);
        destY = Math.round(sRect.top - contRect.top);
      }
    }

    const minimizedCount = state.windows.filter((w) => w.isMinimized).length;
    // Stack icon is already present if not dismissed or holding minimized items
    const hasStack = !(state.isStackDismissed && minimizedCount === 0);

    const flightId = `${preset.id}-${Date.now()}`;

    state = {
      ...state,
      activeFlight: {
        id: flightId,
        startX,
        startY,
        startW,
        startH,
        destX,
        destY,
        preset,
        targetHadStack: hasStack,
      },
    };
    notify();
  },
  /** Batch minimize all currently open floating windows with 3-phase collective collapse animation */
  triggerBatchMinimize: () => {
    const hasOpen = state.windows.some((w) => !w.isMinimized);
    if (!hasOpen) return;
    state = {
      ...state,
      batchMinimizeSignal: state.batchMinimizeSignal + 1,
      isStackDismissed: false, // Ensure stack icon appears at top-right to receive collapsed windows
      isStackTrayOpen: false,
    };
    notify();
  },
  /** Minimize all currently open floating windows into the stack icon (defaults to animation) */
  minimizeAllWindows: (immediate = false) => {
    const hasOpen = state.windows.some((w) => !w.isMinimized);
    if (!hasOpen) return;
    if (!immediate) {
      floatingStore.triggerBatchMinimize();
      return;
    }
    state = {
      ...state,
      windows: state.windows.map((w) => ({ ...w, isMinimized: true })),
      windowOrder: [],
      focusedWindowId: null,
      isStackTrayOpen: false,
      isStackDismissed: false,
    };
    notify();
  },
  /** Complete flying animation and commit minimized window into store */
  completeFlight: () => {
    if (!state.activeFlight) return;
    const { preset } = state.activeFlight;

    const isSingleton = preset.singleton ?? false;
    const winId = isSingleton ? preset.id : `${preset.id}-${Date.now().toString().slice(-4)}`;

    // If singleton already exists, minimize it and focus it
    const existingIndex = state.windows.findIndex((w) => w.id === winId);
    let nextWindows = state.windows;

    if (existingIndex >= 0) {
      nextWindows = state.windows.map((w, idx) =>
        idx === existingIndex ? { ...w, isMinimized: true } : w
      );
    } else {
      const newItem: FloatingWindowItem = {
        id: winId,
        title: preset.title,
        category: preset.category,
        width: preset.width,
        height: preset.height,
        isMinimized: true,
        resizable: preset.resizable,
        position: {
          x: 40 + (state.windows.length % 5) * 32,
          y: 40 + (state.windows.length % 5) * 32,
        },
      };
      nextWindows = [...state.windows, newItem];
    }

    state = {
      ...state,
      windows: nextWindows,
      isStackDismissed: false,
      activeFlight: null,
    };
    notify();
  },
  cancelFlight: () => {
    if (!state.activeFlight) return;
    state = {
      ...state,
      activeFlight: null,
    };
    notify();
  },
};

export const useFloatingStore = () => {
  const snapshot = useSyncExternalStore(floatingStore.subscribe, floatingStore.getSnapshot);
  const minimizedCount = snapshot.windows.filter((w) => w.isMinimized).length;
  const totalCount = snapshot.windows.length;

  return {
    windows: snapshot.windows,
    windowOrder: snapshot.windowOrder,
    isStackTrayOpen: snapshot.isStackTrayOpen,
    isStackDismissed: snapshot.isStackDismissed,
    focusedWindowId: snapshot.focusedWindowId,
    activeFlight: snapshot.activeFlight,
    batchMinimizeSignal: snapshot.batchMinimizeSignal,
    minimizedCount,
    totalCount,
    spawnWindow: floatingStore.spawnWindow,
    spawnWithFlight: floatingStore.spawnWithFlight,
    completeFlight: floatingStore.completeFlight,
    cancelFlight: floatingStore.cancelFlight,
    bringToFront: floatingStore.bringToFront,
    updatePosition: floatingStore.updatePosition,
    updateSize: floatingStore.updateSize,
    minimizeWindow: floatingStore.minimizeWindow,
    minimizeAllWindows: floatingStore.minimizeAllWindows,
    triggerBatchMinimize: floatingStore.triggerBatchMinimize,
    restoreWindow: floatingStore.restoreWindow,
    closeWindow: floatingStore.closeWindow,
    toggleStackTray: floatingStore.toggleStackTray,
    setStackTrayOpen: floatingStore.setStackTrayOpen,
    dismissStack: floatingStore.dismissStack,
    clearAll: floatingStore.clearAll,
  };
};
