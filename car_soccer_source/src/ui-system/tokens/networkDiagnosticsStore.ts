import { useSyncExternalStore } from 'react';

export interface NetworkMetrics {
  rttMs: number;
  clientLeadTicks: number;
  serverTick: number;
  clientTick: number;
  deltaTicks: number;
  mispredictions: number;
  corrections: number;
  packetLossPct: number;
  extraLatencyMs: number;
  burstDropCount: number;
  connected: boolean;
}

export interface NetworkDiagnosticsState {
  metrics: NetworkMetrics;
  reconcilerRef: any | null;
  channelRef: any | null;
  runtimeRef: any | null;
}

let state: NetworkDiagnosticsState = {
  metrics: {
    rttMs: 0,
    clientLeadTicks: 0,
    serverTick: 0,
    clientTick: 0,
    deltaTicks: 0,
    mispredictions: 0,
    corrections: 0,
    packetLossPct: 0,
    extraLatencyMs: 0,
    burstDropCount: 5,
    connected: false,
  },
  reconcilerRef: null,
  channelRef: null,
  runtimeRef: null,
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

export const networkDiagnosticsStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setSession: (reconciler: any, channel: any, runtime?: any) => {
    state = {
      ...state,
      reconcilerRef: reconciler,
      channelRef: channel,
      runtimeRef: runtime ?? state.runtimeRef,
    };
    if (reconciler) {
      reconciler.onMetricsUpdated = (m: Partial<NetworkMetrics>) => {
        state = {
          ...state,
          metrics: {
            ...state.metrics,
            ...m,
            extraLatencyMs: channel?.extraLatencyMs ?? state.metrics.extraLatencyMs,
            packetLossPct: channel?.simulatedPacketLossPct ?? state.metrics.packetLossPct,
            connected: Boolean(channel),
          },
        };
        notify();
      };
    }
    notify();
  },

  setExtraLatency: (ms: number) => {
    const val = Math.max(0, Math.min(500, ms));
    if (state.channelRef) {
      state.channelRef.extraLatencyMs = val;
    }
    state = {
      ...state,
      metrics: { ...state.metrics, extraLatencyMs: val },
    };
    notify();
  },

  setPacketLoss: (pct: number) => {
    const val = Math.max(0, Math.min(100, pct));
    if (state.channelRef) {
      state.channelRef.simulatedPacketLossPct = val;
    }
    state = {
      ...state,
      metrics: { ...state.metrics, packetLossPct: val },
    };
    notify();
  },

  triggerBurstDrop: (count?: number) => {
    const cnt = count ?? state.metrics.burstDropCount;
    if (state.runtimeRef?.dropPacketBurst) {
      state.runtimeRef.dropPacketBurst(cnt);
    } else if (state.channelRef?.dropBurst) {
      state.channelRef.dropBurst(cnt);
    }
  },

  copyDiagnostics: () => {
    const m = state.metrics;
    const text = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        rttMs: m.rttMs,
        leadTicks: m.clientLeadTicks,
        serverTick: m.serverTick,
        clientTick: m.clientTick,
        deltaTicks: m.deltaTicks,
        mispredictions: m.mispredictions,
        corrections: m.corrections,
        simulatedExtraLatencyMs: m.extraLatencyMs,
        simulatedLossPct: m.packetLossPct,
      },
      null,
      2
    );
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  },
};

export const useNetworkDiagnosticsData = () => {
  return useSyncExternalStore(networkDiagnosticsStore.subscribe, networkDiagnosticsStore.getSnapshot);
};
