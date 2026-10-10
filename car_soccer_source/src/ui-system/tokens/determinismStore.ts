import { useSyncExternalStore } from 'react';

export interface DeterminismMetrics {
  tickA: number;
  tickB: number;
  totalRollbacks: number;
  currentDepth: number;
  lastRollbackDurationMs: number;
  carDeltaPos: number;
  carDeltaVel: number;
  carDeltaAngVel: number;
  ballDeltaPos: number;
  maxDeltaPos: number;
  maxDeltaVel: number;
  maxDeltaBall: number;
  isBitExact: boolean;
}

export interface DeterminismState {
  metrics: DeterminismMetrics;
  periodicRollback: boolean;
  rollbackInterval: number;
  rollbackDepth: number;
  active: boolean;
  harnessRef: any | null;
}

let state: DeterminismState = {
  metrics: {
    tickA: 0,
    tickB: 0,
    totalRollbacks: 0,
    currentDepth: 0,
    lastRollbackDurationMs: 0,
    carDeltaPos: 0,
    carDeltaVel: 0,
    carDeltaAngVel: 0,
    ballDeltaPos: 0,
    maxDeltaPos: 0,
    maxDeltaVel: 0,
    maxDeltaBall: 0,
    isBitExact: true,
  },
  periodicRollback: true,
  rollbackInterval: 30,
  rollbackDepth: 15,
  active: false,
  harnessRef: null,
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

export const determinismStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setHarness: (harness: any) => {
    state = {
      ...state,
      harnessRef: harness,
      active: Boolean(harness),
      periodicRollback: harness?.periodicRollback ?? state.periodicRollback,
      rollbackInterval: harness?.rollbackInterval ?? state.rollbackInterval,
      rollbackDepth: harness?.rollbackDepth ?? state.rollbackDepth,
    };
    if (harness) {
      harness.onMetricsUpdated = (m: DeterminismMetrics) => {
        state = { ...state, metrics: { ...m } };
        notify();
      };
    }
    notify();
  },

  updateMetrics: (m: Partial<DeterminismMetrics>) => {
    state = { ...state, metrics: { ...state.metrics, ...m } };
    notify();
  },

  togglePeriodic: () => {
    const next = !state.periodicRollback;
    if (state.harnessRef) {
      state.harnessRef.periodicRollback = next;
    }
    state = { ...state, periodicRollback: next };
    notify();
  },

  triggerManualRollback: (depth?: number) => {
    const d = depth ?? state.rollbackDepth;
    if (state.harnessRef?.triggerManualRollback) {
      state.harnessRef.triggerManualRollback(d);
    }
  },

  setRollbackDepth: (depth: number) => {
    if (state.harnessRef) {
      state.harnessRef.rollbackDepth = depth;
    }
    state = { ...state, rollbackDepth: depth };
    notify();
  },

  resetDeltas: () => {
    if (state.harnessRef?.resetMaxDeltas) {
      state.harnessRef.resetMaxDeltas();
    }
    state = {
      ...state,
      metrics: {
        ...state.metrics,
        maxDeltaPos: 0,
        maxDeltaVel: 0,
        maxDeltaBall: 0,
        isBitExact: true,
      },
    };
    notify();
  },

  resetMaxDeltas: () => {
    determinismStore.resetDeltas();
  },
};

export const useDeterminismData = () => {
  return useSyncExternalStore(determinismStore.subscribe, determinismStore.getSnapshot);
};
