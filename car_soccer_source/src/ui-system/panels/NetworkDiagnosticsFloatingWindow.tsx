import React, { useState, useEffect } from 'react';
import { Router, Wifi, Zap, Copy, Check, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNetworkDiagnosticsData, networkDiagnosticsStore } from '../tokens/networkDiagnosticsStore';

export interface NetworkDiagnosticsFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const NetworkDiagnosticsFloatingWindow: React.FC<NetworkDiagnosticsFloatingWindowProps> = ({
  isLight = false,
  active = true,
}) => {
  const { metrics } = useNetworkDiagnosticsData();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('car-soccer:ensure-network-diagnostics'));
  }, []);

  const handleCopyJSON = async () => {
    try {
      const dump = networkDiagnosticsStore.getDiagnosticDump();
      await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy to clipboard', e);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 h-full select-none text-xs">
      {/* 1. Network Status & RTT Latency Header */}
      <div
        className={`p-2.5 rounded-xl border flex items-center justify-between font-mono transition-colors ${
          metrics.connected
            ? isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
            : isLight
            ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
            : 'bg-neutral-850 border-neutral-700 text-neutral-300'
        }`}
      >
        <div className="flex items-center gap-2">
          {metrics.connected ? (
            <Wifi className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <Router className="h-4 w-4 text-neutral-400 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="font-bold text-xs uppercase tracking-wide">
              {metrics.connected ? 'ACTIVE SESSION CONNECTED' : 'LOCAL SIMULATION REPLICATION'}
            </span>
            <span className="text-[10px] opacity-75">
              {metrics.connected
                ? 'Authoritative WebRTC peer connection established'
                : 'Loopback peer channel with client prediction & rollback reconciler'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyJSON}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : isLight
              ? 'hover:bg-neutral-200 border-neutral-300 text-neutral-700'
              : 'hover:bg-neutral-800 border-neutral-700 text-neutral-300'
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied JSON' : 'Copy Dump'}</span>
        </button>
      </div>

      {/* 2. Key Metrics Grid: RTT, Lead Ticks, Corrections */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">RTT Latency</span>
          <span className={`text-sm font-mono font-bold ${
            metrics.rttMs > 100 ? 'text-rose-400' : metrics.rttMs > 50 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {metrics.rttMs.toFixed(1)} ms
          </span>
        </div>

        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Lead Ticks</span>
          <span className="text-sm font-mono font-bold text-sky-400">
            +{metrics.clientLeadTicks} ticks
          </span>
        </div>

        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Reconciled</span>
          <span className="text-sm font-mono font-bold text-violet-400">
            {metrics.corrections} fixes
          </span>
        </div>
      </div>

      {/* 3. Detailed Pacing Breakdown */}
      <div
        className={`p-2.5 rounded-xl border font-mono text-[11px] flex flex-col gap-1.5 ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
          Authoritative Tick Synchronization
        </span>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Server Tick:</span>
            <span className="text-neutral-200">#{metrics.serverTick}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Client Tick:</span>
            <span className="text-neutral-200">#{metrics.clientTick}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Delta Ticks:</span>
            <span className="text-neutral-200">+{metrics.deltaTicks}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Mispredictions:</span>
            <span className={metrics.mispredictions > 0 ? 'text-amber-400' : 'text-neutral-200'}>
              {metrics.mispredictions}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Network Stress Injection Sliders */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 font-mono text-[11px] ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Extra Simulated Latency:</span>
          <span className="font-bold text-amber-400">+{metrics.extraLatencyMs} ms</span>
        </div>
        <input
          type="range"
          min="0"
          max="300"
          step="10"
          value={metrics.extraLatencyMs}
          onChange={(e) => networkDiagnosticsStore.setExtraLatency(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-neutral-400">Packet Loss Rate:</span>
          <span className="font-bold text-rose-400">{metrics.packetLossPct}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={metrics.packetLossPct}
          onChange={(e) => networkDiagnosticsStore.setPacketLoss(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
            <span>Burst Drop Simulation:</span>
          </div>
          <button
            type="button"
            onClick={() => networkDiagnosticsStore.triggerBurstDrop()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-[10px] border border-rose-500/30 cursor-pointer transition-all active:scale-95"
          >
            <Zap className="h-3 w-3" />
            <span>Drop {metrics.burstDropCount} Packets (Key 8)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
