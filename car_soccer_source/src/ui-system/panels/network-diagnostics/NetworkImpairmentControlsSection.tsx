import React, { useState, useEffect } from 'react';
import { Zap, Eye, RotateCcw, Bug, Activity } from 'lucide-react';
import {
  useNetworkDiagnosticsData,
  networkDiagnosticsStore,
  NETWORK_IMPAIRMENT_PRESET_LIST,
} from '../../tokens/networkDiagnosticsStore';

export interface NetworkImpairmentControlsSectionProps {
  isLight?: boolean;
}

export const NetworkImpairmentControlsSection: React.FC<NetworkImpairmentControlsSectionProps> = ({
  isLight = false,
}) => {
  const { metrics } = useNetworkDiagnosticsData();
  const [periodInput, setPeriodInput] = useState<string>(String(metrics.burstPeriodMs ?? 1000));
  const [durationInput, setDurationInput] = useState<string>(String(metrics.burstDurationMs ?? 0));
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);

  useEffect(() => {
    if (!isEditingPeriod) {
      setPeriodInput(String(metrics.burstPeriodMs ?? 1000));
    }
  }, [metrics.burstPeriodMs, isEditingPeriod]);

  useEffect(() => {
    if (!isEditingDuration) {
      setDurationInput(String(metrics.burstDurationMs ?? 0));
    }
  }, [metrics.burstDurationMs, isEditingDuration]);

  const commitBurstPeriodInput = () => {
    setIsEditingPeriod(false);
    const parsed = parseInt(periodInput, 10);
    const nextPeriod = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1000;
    networkDiagnosticsStore.setBurstPeriodMs(nextPeriod);
    setPeriodInput(String(nextPeriod));
  };

  const commitBurstDurationInput = () => {
    setIsEditingDuration(false);
    const parsed = parseInt(durationInput, 10);
    const maxAllowed = Math.max(0, (metrics.burstPeriodMs || 1000) - 1);
    const nextDuration = Number.isFinite(parsed)
      ? Math.max(0, Math.min(maxAllowed, parsed))
      : 0;
    networkDiagnosticsStore.setBurstDurationMs(nextDuration);
    setDurationInput(String(nextDuration));
  };

  return (
    <div
      className={`p-2 rounded-xl border flex flex-col gap-1.5 font-mono text-[11px] ${
        isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
          Network Impairment Presets & Disconnect Probes
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {NETWORK_IMPAIRMENT_PRESET_LIST.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => networkDiagnosticsStore.applyImpairmentPreset(preset.id)}
            className={`px-1.5 py-0.5 rounded border text-[10px] cursor-pointer transition-colors ${
              metrics.impairmentPresetId === preset.id
                ? 'bg-amber-500 text-black font-bold border-amber-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
            }`}
          >
            {preset.id === 'ideal_lan'
              ? 'LAN 0ms'
              : preset.id === 'wifi_jitter'
              ? 'Wi-Fi Jitter'
              : preset.id === 'cross_region'
              ? 'Cross-Region'
              : preset.id === 'cellular_4g'
              ? '4G Loss'
              : preset.id === 'severe_spike'
              ? 'Congestion'
              : preset.id === 'stale_1s_probe'
              ? '1s Stale Probe'
              : '30s Disconnect'}
          </button>
        ))}
      </div>

      {/* Extra Latency Slider */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-neutral-400">Extra Latency (0~500ms):</span>
        <span className="font-bold text-amber-400">+{metrics.extraLatencyMs} ms</span>
      </div>
      <input
        type="range"
        min="0"
        max="500"
        step={metrics.adjustStepMs}
        value={metrics.extraLatencyMs}
        onChange={(e) => networkDiagnosticsStore.setExtraLatency(Number(e.target.value))}
        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />

      {/* Jitter Slider */}
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">Simulated Jitter (0~100ms):</span>
        <span className="font-bold text-cyan-400">±{metrics.jitterMs} ms</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={metrics.jitterMs}
        onChange={(e) => networkDiagnosticsStore.setJitter(Number(e.target.value))}
        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />

      {/* Random Drop Slider (0~100%) */}
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">Random Drop (0~100%):</span>
        <span className="font-bold text-rose-400">{metrics.packetLossPct}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={metrics.packetLossPct}
        onChange={(e) => networkDiagnosticsStore.setPacketLoss(Number(e.target.value))}
        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
      />

      {/* Periodic / Intermittent Burst Drop Controls */}
      <div className="pt-1 border-t border-neutral-700/50 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-neutral-400">Intermittent Burst Drop (Key 8):</span>
          <button
            type="button"
            onClick={() => networkDiagnosticsStore.toggleBurstDrop()}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
              metrics.burstDropEnabled
                ? 'bg-rose-500 text-black border-rose-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
          >
            <Zap className="h-3 w-3" />
            <span>{metrics.burstDropEnabled ? 'ENABLED' : 'DISABLED'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-neutral-400">Burst Drop Period (1~5s / ms):</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={periodInput}
              onFocus={() => setIsEditingPeriod(true)}
              onChange={(e) => setPeriodInput(e.target.value)}
              onBlur={commitBurstPeriodInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitBurstPeriodInput();
                  e.currentTarget.blur();
                }
              }}
              className="w-16 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-right font-mono text-[10px] text-amber-300 focus:outline-none focus:border-amber-400"
            />
            <span className="text-[10px] text-neutral-400">ms</span>
          </div>
        </div>
        <input
          type="range"
          min="1000"
          max="5000"
          step="1000"
          value={Math.min(5000, Math.max(1000, Math.round((metrics.burstPeriodMs || 2000) / 1000) * 1000))}
          onChange={(e) => networkDiagnosticsStore.setBurstPeriodMs(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-neutral-400">
            Burst Drop Duration ({metrics.burstDurationPct}% / max {Math.max(0, (metrics.burstPeriodMs || 2000) - 1)}ms):
          </span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={durationInput}
              onFocus={() => setIsEditingDuration(true)}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={commitBurstDurationInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitBurstDurationInput();
                  e.currentTarget.blur();
                }
              }}
              className="w-16 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-right font-mono text-[10px] text-rose-300 focus:outline-none focus:border-rose-400"
            />
            <span className="text-[10px] text-neutral-400">ms</span>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="99"
          step="1"
          value={metrics.burstDurationPct}
          onChange={(e) => networkDiagnosticsStore.setBurstDurationPct(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
        />
      </div>

      {/* Adjust Step Controls */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-neutral-400">Step (Keys 9 / 0):</span>
        <div className="flex items-center gap-1">
          {[5, 10, 25, 50].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => networkDiagnosticsStore.setAdjustStep(step)}
              className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                metrics.adjustStepMs === step
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
            >
              {step}ms
            </button>
          ))}
        </div>
      </div>

      {/* Visual Smoothing & Reset Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-700/50">
        <button
          type="button"
          onClick={() => networkDiagnosticsStore.setVisualSmoothing(!metrics.visualSmoothing)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
            metrics.visualSmoothing
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-neutral-800 border-neutral-700 text-neutral-400'
          }`}
        >
          <Eye className="h-3 w-3" />
          <span>Smoothing: {metrics.visualSmoothing ? 'ON' : 'OFF'}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => networkDiagnosticsStore.resetLatency()}
            className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-[10px] font-medium cursor-pointer transition-colors"
          >
            Reset Link
          </button>
          <button
            type="button"
            onClick={() => networkDiagnosticsStore.resetStats()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-[10px] font-medium cursor-pointer transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Stats</span>
          </button>
        </div>
      </div>

      {/* Packet Capture & Burst Drop Actions */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => networkDiagnosticsStore.dumpNextPacket()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 text-[10px] font-semibold cursor-pointer transition-colors"
          >
            <Bug className="h-3 w-3" />
            <span>Dump Next</span>
          </button>
          <button
            type="button"
            onClick={() => networkDiagnosticsStore.dumpLatestPacket()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 text-[10px] font-semibold cursor-pointer transition-colors"
          >
            <Activity className="h-3 w-3" />
            <span>Dump Latest</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => networkDiagnosticsStore.toggleBurstDrop()}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[10px] border cursor-pointer transition-all active:scale-95 ${
            metrics.burstDropEnabled
              ? 'bg-rose-500 text-black border-rose-400'
              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/30'
          }`}
        >
          <Zap className="h-3 w-3" />
          <span>{metrics.burstDropEnabled ? 'Burst Drop: ON (Key 8)' : 'Burst Drop: OFF (Key 8)'}</span>
        </button>
      </div>
    </div>
  );
};
