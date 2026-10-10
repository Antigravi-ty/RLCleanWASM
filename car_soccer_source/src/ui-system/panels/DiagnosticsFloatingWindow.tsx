import React, { useMemo } from 'react';
import { Activity, Cpu, Layers, HardDrive, Zap, AlertTriangle } from 'lucide-react';
import { useTelemetryData, type TelemetrySnapshot } from '../tokens/perfTelemetryStore';

export interface DiagnosticsFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

const SVG_HEIGHT = 44;

export const DiagnosticsFloatingWindow: React.FC<DiagnosticsFloatingWindowProps> = ({
  isLight = false,
  active = true,
}) => {
  const { data: snap, error } = useTelemetryData(180, active);

  if (error || !snap) {
    return (
      <div className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 font-mono select-none ${
        isLight
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-red-950/20 border-red-500/30 text-red-400'
      }`}>
        <div className="flex items-center gap-2 font-bold text-red-500">
          <AlertTriangle className="h-4 w-4" />
          <span>Telemetry Profiler Unavailable</span>
        </div>
        <p className="text-[11px] leading-relaxed opacity-85">
          {error?.message || 'Waiting for live PerformanceProfiler connection...'}
        </p>
      </div>
    );
  }

  // Phase color palette
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'sim':
        return 'bg-amber-500 text-amber-400';
      case 'scene':
        return 'bg-sky-500 text-sky-400';
      case 'camera':
        return 'bg-indigo-500 text-indigo-400';
      case 'prep':
        return 'bg-emerald-500 text-emerald-400';
      case 'bloom':
        return 'bg-fuchsia-500 text-fuchsia-400';
      case 'final':
        return 'bg-rose-500 text-rose-400';
      default:
        return 'bg-neutral-500 text-neutral-400';
    }
  };

  // SVG sparkline path calculations
  const { pointsStr, overSpikesStr, budgetY, ceiling } = useMemo(() => {
    const history = snap.history;
    const len = history.length;
    if (len === 0) {
      return { pointsStr: '', overSpikesStr: '', budgetY: SVG_HEIGHT / 2, ceiling: 33 };
    }

    let calculatedCeiling = snap.budgetMs * 2;
    while (calculatedCeiling < snap.worstMs && calculatedCeiling < snap.budgetMs * 16) {
      calculatedCeiling += snap.budgetMs;
    }
    calculatedCeiling = Math.max(calculatedCeiling, 20);

    const calcY = (val: number) =>
      (SVG_HEIGHT - Math.min(1, Math.max(0, val / calculatedCeiling)) * SVG_HEIGHT).toFixed(1);

    const points: string[] = [];
    const overSpikes: string[] = [];

    for (let i = 0; i < len; i++) {
      const x = ((i / Math.max(1, len - 1)) * 100).toFixed(2);
      const y = calcY(history[i]);
      points.push(`${x},${y}`);
      if (history[i] > snap.budgetMs * 1.02) {
        overSpikes.push(`M ${x} ${SVG_HEIGHT} L ${x} ${y}`);
      }
    }

    const bY = Number(calcY(snap.budgetMs));

    return {
      pointsStr: points.join(' '),
      overSpikesStr: overSpikes.join(' '),
      budgetY: bY,
      ceiling: calculatedCeiling,
    };
  }, [snap.history, snap.budgetMs, snap.worstMs]);

  return (
    <div className="flex flex-col gap-3 h-full select-none text-xs">
      {/* 1. FRAME TIME METRICS */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-colors ${
          isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/70'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[11px] text-neutral-400 uppercase tracking-wider font-mono">
            <Activity className="h-3.5 w-3.5 text-amber-500" />
            <span>Frame Time</span>
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-base font-bold text-amber-500">{snap.frameMs.toFixed(1)}</span>
            <span className="text-[10px] text-neutral-400">ms</span>
            <span className="text-[10px] text-neutral-500 ml-1">({snap.fps} fps)</span>
          </div>
        </div>

        {/* Quantile Breakdown: p50, p95, p99, worst */}
        <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
          <div
            className={`p-1 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">p50</span>
            <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
              {snap.p50.toFixed(1)}ms
            </span>
          </div>
          <div
            className={`p-1 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">p95</span>
            <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
              {snap.p95.toFixed(1)}ms
            </span>
          </div>
          <div
            className={`p-1 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">p99</span>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {snap.p99.toFixed(1)}ms
            </span>
          </div>
          <div
            className={`p-1 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200/80' : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">max</span>
            <span
              className={`text-[11px] font-bold ${
                snap.worstMs > snap.budgetMs * 1.5
                  ? 'text-red-500'
                  : 'text-neutral-700 dark:text-neutral-200'
              }`}
            >
              {snap.worstMs.toFixed(1)}ms
            </span>
          </div>
        </div>
      </div>

      {/* 2. HISTORY PLOT (SPARKLINE CHART) */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-colors ${
          isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/70'
        }`}
      >
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-neutral-400 uppercase tracking-wider font-mono">
            History Plot
          </span>
          <span className="text-[10px] font-mono text-neutral-400">
            Target {snap.budgetMs.toFixed(1)} ms (~{snap.refreshHz} Hz)
          </span>
        </div>

        {/* SVG Sparkline */}
        <div
          className={`relative rounded-lg overflow-hidden border p-1 ${
            isLight ? 'bg-neutral-100/70 border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
          }`}
        >
          <svg
            viewBox={`0 0 100 ${SVG_HEIGHT}`}
            preserveAspectRatio="none"
            className="w-full h-12 overflow-visible"
          >
            {/* Target Budget Line */}
            <line
              x1="0"
              y1={budgetY}
              x2="100"
              y2={budgetY}
              stroke="rgba(245, 158, 11, 0.4)"
              strokeDasharray="2,2"
              strokeWidth="0.8"
            />
            {/* Over Budget Spikes */}
            {overSpikesStr && (
              <path d={overSpikesStr} stroke="rgba(239, 68, 68, 0.6)" strokeWidth="1" />
            )}
            {/* Frame trace polyline */}
            <polyline
              points={pointsStr}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400 px-0.5">
          <span>{snap.historySeconds}s window</span>
          {snap.overBudgetPct > 0 ? (
            <span className="text-red-400 flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              {snap.overBudgetPct}% over budget
            </span>
          ) : (
            <span className="text-emerald-500">100% in budget</span>
          )}
          <span>peak {ceiling.toFixed(0)}ms</span>
        </div>
      </div>

      {/* 3. TIME BREAKDOWN (CPU PHASES) */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-colors ${
          isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/70'
        }`}
      >
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-400 uppercase tracking-wider font-mono">
            <Cpu className="h-3.5 w-3.5 text-sky-500" />
            <span>Time Breakdown (CPU)</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">
            Total {snap.phases.reduce((a, b) => a + b.avgMs, 0).toFixed(2)} ms
          </span>
        </div>

        {/* Phase List with proportion bar */}
        <div className="flex flex-col gap-1.5 font-mono text-[10px]">
          {snap.phases.map((ph) => {
            const pct = Math.round(ph.share * 100);
            return (
              <div key={ph.phase} className="flex items-center gap-2">
                <span className="w-14 truncate text-neutral-400 capitalize">{ph.phase}</span>
                <div
                  className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                    isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${getPhaseColor(ph.phase).split(' ')[0]}`}
                    style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                  />
                </div>
                <span className="w-12 text-right font-semibold text-neutral-700 dark:text-neutral-200">
                  {ph.avgMs.toFixed(2)}ms
                </span>
                <span className="w-8 text-right text-neutral-500 text-[9px]">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SIMULATION & RENDERER GRIDS */}
      <div className="grid grid-cols-2 gap-2">
        {/* Simulation */}
        <div
          className={`p-2 rounded-xl border flex flex-col gap-1 text-[10px] font-mono ${
            isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/70'
          }`}
        >
          <div className="flex items-center gap-1 font-semibold text-neutral-400 uppercase text-[9px]">
            <Zap className="h-3 w-3 text-emerald-500" />
            <span>Simulation</span>
          </div>
          <div className="flex justify-between items-center pt-0.5">
            <span className="text-neutral-400">Tick Rate:</span>
            <span className="font-bold text-emerald-500">{snap.sim.physicsRateHz} Hz</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Ticks/Frame:</span>
            <span className="font-semibold text-neutral-200">{snap.sim.ticksPerFrame}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Dropped/Stall:</span>
            <span
              className={`font-semibold ${
                snap.sim.droppedTicks > 0 ? 'text-red-400' : 'text-neutral-400'
              }`}
            >
              {snap.sim.droppedTicks} / {snap.sim.stalls}
            </span>
          </div>
        </div>

        {/* Renderer */}
        <div
          className={`p-2 rounded-xl border flex flex-col gap-1 text-[10px] font-mono ${
            isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/70'
          }`}
        >
          <div className="flex items-center gap-1 font-semibold text-neutral-400 uppercase text-[9px]">
            <Layers className="h-3 w-3 text-indigo-500" />
            <span>Renderer</span>
          </div>
          <div className="flex justify-between items-center pt-0.5">
            <span className="text-neutral-400">Draw Calls:</span>
            <span className="font-bold text-indigo-400">{snap.renderer.drawCalls}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Triangles:</span>
            <span className="font-semibold text-neutral-200">
              {snap.renderer.triangles.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Geo / Tex:</span>
            <span className="font-semibold text-neutral-400">
              {snap.renderer.geometries} / {snap.renderer.textures}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
