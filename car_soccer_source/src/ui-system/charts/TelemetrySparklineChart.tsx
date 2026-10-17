import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Activity, AlertTriangle, Pause, Play, Cpu } from 'lucide-react';

export interface TelemetryPhaseItem {
  phase: string;
  avgMs: number;
  share: number;
  color?: string;
}

export interface TelemetrySparklineChartProps {
  history: number[];
  budgetMs?: number;
  refreshHz?: number;
  phases?: TelemetryPhaseItem[];
  title?: string;
  height?: number;
  compact?: boolean;
  showQuantiles?: boolean;
  showFreezeControl?: boolean;
  isLight?: boolean;
  className?: string;
}

const PHASE_COLORS: Record<string, string> = {
  sim: '#f59e0b',
  scene: '#0ea5e9',
  camera: '#6366f1',
  prep: '#10b981',
  bloom: '#d946ef',
  final: '#f43f5e',
};

export const TelemetrySparklineChart: React.FC<TelemetrySparklineChartProps> = ({
  history,
  budgetMs = 8.33,
  refreshHz = 120,
  phases,
  title = 'Frame Time Telemetry',
  height = 112,
  compact = false,
  showQuantiles = true,
  showFreezeControl = true,
  isLight = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(360);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [frozenHistory, setFrozenHistory] = useState<number[] | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeHistory = isFrozen && frozenHistory ? frozenHistory : history;

  const toggleFreeze = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFrozen) {
      setFrozenHistory([...history]);
      setIsFrozen(true);
    } else {
      setFrozenHistory(null);
      setIsFrozen(false);
    }
  };

  // Observe container width for crisp 1:1 DPR canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(160, Math.floor(entry.contentRect.width));
        setCanvasWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute quantiles & ceiling with memoization
  const stats = useMemo(() => {
    const len = activeHistory.length;
    if (len === 0) {
      return {
        currentMs: 0,
        fps: refreshHz,
        p50: 0,
        p95: 0,
        p99: 0,
        worstMs: 0,
        overBudgetCount: 0,
        overBudgetPct: 0,
        ceiling: Math.max(20, budgetMs * 2.5),
      };
    }

    const sorted = [...activeHistory].sort((a, b) => a - b);
    const currentMs = activeHistory[len - 1];
    const worstMs = sorted[len - 1];
    const p50 = sorted[Math.floor(len * 0.5)];
    const p95 = sorted[Math.floor(len * 0.95)];
    const p99 = sorted[Math.floor(len * 0.99)];

    let overCount = 0;
    for (let i = 0; i < len; i++) {
      if (activeHistory[i] > budgetMs * 1.02) overCount++;
    }

    let ceiling = Math.ceil(budgetMs * 2);
    while (ceiling < worstMs * 1.1 && ceiling < budgetMs * 12) {
      ceiling += Math.ceil(budgetMs);
    }
    ceiling = Math.max(ceiling, 18);

    return {
      currentMs,
      fps: currentMs > 0.1 ? Math.min(999, Math.round(1000 / currentMs)) : refreshHz,
      p50,
      p95,
      p99,
      worstMs,
      overBudgetCount: overCount,
      overBudgetPct: Math.round((overCount / len) * 100),
      ceiling,
    };
  }, [activeHistory, budgetMs, refreshHz]);

  // High-DPI Canvas Draw Pass
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padLeft = 36;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 18;
    const plotW = Math.max(10, canvasWidth - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

    ctx.clearRect(0, 0, canvasWidth, height);

    const mapX = (idx: number, total: number) =>
      padLeft + (total > 1 ? (idx / (total - 1)) * plotW : 0);
    const mapY = (ms: number) =>
      padTop + (1 - Math.min(1, Math.max(0, ms / stats.ceiling))) * plotH;

    // 1. Horizontal Grid Lines & Y-Axis Labels
    const gridLevels = [0, budgetMs, stats.ceiling];
    ctx.font = '10px "SF Mono", "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const lvl of gridLevels) {
      const y = Math.round(mapY(lvl)) + 0.5;
      const isBudget = Math.abs(lvl - budgetMs) < 0.05;
      ctx.beginPath();
      if (isBudget) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.75)' : 'rgba(245, 158, 11, 0.65)';
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
      }
      ctx.lineWidth = 1;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(canvasWidth - padRight, y);
      ctx.stroke();

      ctx.fillStyle = isBudget
        ? isLight
          ? '#b45309'
          : '#fbbf24'
        : isLight
        ? '#64748b'
        : '#94a3b8';
      ctx.fillText(`${lvl.toFixed(lvl === budgetMs ? 1 : 0)}`, padLeft - 5, y);
    }
    ctx.setLineDash([]);

    const len = activeHistory.length;
    if (len > 0) {
      const baseY = mapY(0);

      // 2. Over-budget red spike vertical bars
      ctx.strokeStyle = isLight ? 'rgba(220, 38, 38, 0.32)' : 'rgba(244, 63, 94, 0.38)';
      ctx.lineWidth = Math.max(1.5, plotW / Math.max(40, len));
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const val = activeHistory[i];
        if (val > budgetMs * 1.02) {
          const x = mapX(i, len);
          const y = mapY(val);
          ctx.moveTo(x, baseY);
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 3. Subtle Area Fill under trace
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, isLight ? 'rgba(14, 165, 233, 0.22)' : 'rgba(56, 189, 248, 0.22)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const x = mapX(i, len);
        const y = mapY(activeHistory[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(mapX(len - 1, len), baseY);
      ctx.lineTo(mapX(0, len), baseY);
      ctx.closePath();
      ctx.fill();

      // 4. Crisp Polyline Trace
      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const x = mapX(i, len);
        const y = mapY(activeHistory[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 5. Interactive Crosshair & Locked Sample Dot
      if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < len) {
        const hx = mapX(hoverIndex, len);
        const hVal = activeHistory[hoverIndex];
        const hy = mapY(hVal);
        const isSpike = hVal > budgetMs * 1.02;

        ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hx, padTop);
        ctx.lineTo(hx, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isSpike ? '#f43f5e' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isLight ? '#ffffff' : '#09090b';
        ctx.stroke();
      }
    }

    // 6. X-Axis Footer Labels
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '9px "SF Mono", "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`-${(activeHistory.length / Math.max(1, refreshHz)).toFixed(1)}s`, padLeft, height - 6);
    ctx.textAlign = 'center';
    ctx.fillText(`Target ${budgetMs.toFixed(2)}ms (${refreshHz}Hz)`, padLeft + plotW / 2, height - 6);
    ctx.textAlign = 'right';
    ctx.fillText(isFrozen ? 'FROZEN' : 'Now', canvasWidth - padRight, height - 6);
  }, [activeHistory, budgetMs, refreshHz, canvasWidth, height, isLight, stats.ceiling, hoverIndex, isFrozen]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const padLeft = 36;
    const padRight = 10;
    const plotW = Math.max(10, rect.width - padLeft - padRight);
    const relX = e.clientX - rect.left - padLeft;
    const ratio = Math.max(0, Math.min(1, relX / plotW));
    if (activeHistory.length > 0) {
      const idx = Math.round(ratio * (activeHistory.length - 1));
      setHoverIndex(idx);
    }
  };

  const inspectedValue =
    hoverIndex !== null && activeHistory[hoverIndex] !== undefined ? activeHistory[hoverIndex] : null;
  const inspectedDelta = inspectedValue !== null ? inspectedValue - budgetMs : null;

  return (
    <div
      ref={containerRef}
      data-component="telemetry-sparkline-chart"
      className={`p-3 rounded-xl border flex flex-col gap-2.5 select-none transition-colors ${
        isLight
          ? 'bg-white border-neutral-200 text-neutral-800 shadow-2xs'
          : 'bg-neutral-900/90 border-neutral-800 text-neutral-100'
      } ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
          <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>{title}</span>
          {isFrozen && (
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-500 border border-amber-500/30 uppercase">
              Snapshot Frozen
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono">
          {inspectedValue !== null ? (
            <div
              className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1.5 ${
                inspectedValue > budgetMs * 1.02
                  ? 'bg-rose-500/15 text-rose-500 border-rose-500/30 font-bold'
                  : isLight
                  ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
                  : 'bg-neutral-800 text-neutral-200 border-neutral-700'
              }`}
            >
              <span>Sample #{hoverIndex}:</span>
              <strong>{inspectedValue.toFixed(2)}ms</strong>
              <span className="text-[10px] opacity-80">
                ({inspectedDelta! >= 0 ? `+${inspectedDelta!.toFixed(2)}` : inspectedDelta!.toFixed(2)}ms)
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-amber-500 tabular-nums">
                {stats.currentMs.toFixed(2)}
              </span>
              <span className="text-[10px] text-neutral-400">ms</span>
              <span className="text-[10px] text-neutral-500 tabular-nums">({stats.fps} fps)</span>
            </div>
          )}

          {showFreezeControl && (
            <button
              type="button"
              onClick={toggleFreeze}
              title={isFrozen ? 'Resume live telemetry stream' : 'Freeze frame history to inspect spikes'}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
                isFrozen
                  ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                  : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
              }`}
            >
              {isFrozen ? <Play className="h-2.5 w-2.5 fill-current" /> : <Pause className="h-2.5 w-2.5" />}
              <span>{isFrozen ? 'Resume' : 'Freeze'}</span>
            </button>
          )}
        </div>
      </div>

      {/* High-DPI Canvas Plot */}
      <div
        className={`relative rounded-lg border overflow-hidden ${
          isLight ? 'bg-neutral-50/90 border-neutral-200/90' : 'bg-neutral-950/90 border-neutral-800'
        }`}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${height}px`, display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          className="cursor-crosshair"
        />
      </div>

      {/* Quantile Breakdown Chips */}
      {showQuantiles && !compact && (
        <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
          <div
            className={`p-1.5 rounded-lg border ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">p50</span>
            <span className="text-[11px] font-bold tabular-nums">{stats.p50.toFixed(2)}ms</span>
          </div>
          <div
            className={`p-1.5 rounded-lg border ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">p95</span>
            <span className="text-[11px] font-bold tabular-nums">{stats.p95.toFixed(2)}ms</span>
          </div>
          <div
            className={`p-1.5 rounded-lg border ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">p99</span>
            <span className="text-[11px] font-bold text-amber-500 tabular-nums">
              {stats.p99.toFixed(2)}ms
            </span>
          </div>
          <div
            className={`p-1.5 rounded-lg border ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <span className="text-[9px] text-neutral-400 block">Peak</span>
            <span
              className={`text-[11px] font-bold tabular-nums ${
                stats.worstMs > budgetMs * 1.2 ? 'text-rose-500' : ''
              }`}
            >
              {stats.worstMs.toFixed(2)}ms
            </span>
          </div>
          <div
            className={`p-1.5 rounded-lg border ${
              stats.overBudgetCount > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            }`}
          >
            <span className="text-[9px] opacity-80 block">Budget</span>
            <span className="text-[11px] font-bold tabular-nums flex items-center justify-center gap-0.5">
              {stats.overBudgetCount > 0 ? (
                <>
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  <span>{stats.overBudgetPct}% Over</span>
                </>
              ) : (
                <span>100% OK</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Optional CPU Phase Breakdown */}
      {phases && phases.length > 0 && !compact && (
        <div
          className={`pt-2 border-t flex flex-col gap-1.5 font-mono text-[10px] ${
            isLight ? 'border-neutral-200' : 'border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="flex items-center gap-1 font-semibold uppercase">
              <Cpu className="h-3 w-3 text-sky-500" />
              <span>CPU Phase Breakdown</span>
            </span>
            <span className="tabular-nums">
              Total {phases.reduce((a, b) => a + b.avgMs, 0).toFixed(2)} ms
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
            {phases.map((ph) => {
              const pct = Math.round(ph.share * 100);
              const barColor = ph.color || PHASE_COLORS[ph.phase] || '#94a3b8';
              return (
                <div key={ph.phase} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: barColor }}
                  />
                  <span className="w-12 truncate capitalize text-neutral-400">{ph.phase}</span>
                  <div
                    className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                      isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                    }`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(4, pct))}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  <span className="w-11 text-right font-semibold tabular-nums">
                    {ph.avgMs.toFixed(2)}ms
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
