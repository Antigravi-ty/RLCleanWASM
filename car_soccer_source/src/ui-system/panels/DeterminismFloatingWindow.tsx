import React, { useEffect } from 'react';
import { Target, CheckCircle2, AlertOctagon, RotateCcw, Play, Pause, Sliders } from 'lucide-react';
import { useDeterminismData, determinismStore } from '../tokens/determinismStore';

export interface DeterminismFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const DeterminismFloatingWindow: React.FC<DeterminismFloatingWindowProps> = ({
  isLight = false,
  active = true,
}) => {
  const { metrics, periodicRollback, rollbackInterval, rollbackDepth, active: harnessActive } =
    useDeterminismData();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('car-soccer:ensure-determinism'));
  }, []);

  const isExact = metrics.isBitExact;

  return (
    <div className="flex flex-col gap-2.5 h-full select-none text-xs">
      {/* 1. Status Banner */}
      <div
        className={`p-2.5 rounded-xl border flex items-center justify-between font-mono transition-colors ${
          isExact
            ? isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
            : isLight
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-rose-950/30 border-rose-500/40 text-rose-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {isExact ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertOctagon className="h-4 w-4 text-rose-500 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="font-bold text-xs uppercase tracking-wide">
              {isExact ? '100% BIT-EXACT DETERMINISTIC' : 'DESYNC DETECTED'}
            </span>
            <span className="text-[10px] opacity-75">
              {isExact
                ? 'Parallel RocketSim arena states identical down to IEEE-754 bit'
                : 'Divergence identified between Ground Truth & Rollback Arena'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => determinismStore.resetMaxDeltas()}
          className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
            isLight
              ? 'hover:bg-neutral-200 border-neutral-300 text-neutral-700'
              : 'hover:bg-neutral-800 border-neutral-700 text-neutral-300'
          }`}
        >
          Reset Peaks
        </button>
      </div>

      {/* 2. Tick Counters & Rollback Frequency */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Sim Tick A / B</span>
          <span className="text-sm font-mono font-bold text-sky-400">
            #{metrics.tickA} / #{metrics.tickB}
          </span>
        </div>

        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Total Rollbacks</span>
          <span className="text-sm font-mono font-bold text-amber-400">
            {metrics.totalRollbacks}
          </span>
        </div>

        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Last Rollback Time</span>
          <span className="text-sm font-mono font-bold text-emerald-400">
            {metrics.lastRollbackDurationMs.toFixed(2)} ms
          </span>
        </div>
      </div>

      {/* 3. Bit-Exact Physical State Delta Inspection */}
      <div
        className={`p-2.5 rounded-xl border font-mono text-[11px] flex flex-col gap-1.5 ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
          State Drift Metrics
        </span>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Car ΔPos:</span>
            <span className={metrics.carDeltaPos > 0.001 ? 'text-rose-400 font-bold' : 'text-neutral-200'}>
              {metrics.carDeltaPos.toExponential(2)} m
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Peak ΔPos:</span>
            <span className="text-neutral-200">{metrics.maxDeltaPos.toExponential(2)} m</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Car ΔVel:</span>
            <span className={metrics.carDeltaVel > 0.001 ? 'text-rose-400 font-bold' : 'text-neutral-200'}>
              {metrics.carDeltaVel.toExponential(2)} m/s
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Peak ΔVel:</span>
            <span className="text-neutral-200">{metrics.maxDeltaVel.toExponential(2)} m/s</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Ball ΔPos:</span>
            <span className={metrics.ballDeltaPos > 0.001 ? 'text-rose-400 font-bold' : 'text-neutral-200'}>
              {metrics.ballDeltaPos.toExponential(2)} m
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Car ΔAngVel:</span>
            <span className="text-neutral-200">{metrics.carDeltaAngVel.toExponential(2)} rad/s</span>
          </div>
        </div>
      </div>

      {/* 4. Interactive Rollback Simulation Controls */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 font-mono text-[11px] ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Rollback Depth ({rollbackDepth} ticks):</span>
          <button
            type="button"
            onClick={() => determinismStore.triggerManualRollback()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-[10px] cursor-pointer transition-all active:scale-95 shadow-2xs"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Rollback {rollbackDepth} Ticks</span>
          </button>
        </div>

        <input
          type="range"
          min="1"
          max="60"
          value={rollbackDepth}
          onChange={(e) => determinismStore.setRollbackDepth(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => determinismStore.togglePeriodic()}
              className={`p-1 rounded-lg text-[10px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                periodicRollback
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              {periodicRollback ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              <span>Auto Rollback ({periodicRollback ? 'ON' : 'OFF'})</span>
            </button>
          </div>
          <span className="text-neutral-400 text-[10px]">Interval: every {rollbackInterval} ticks</span>
        </div>
      </div>
    </div>
  );
};
