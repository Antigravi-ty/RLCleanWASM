import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Square,
  PlusSquare,
  MinusSquare,
  Trash2,
  Shield,
  Crosshair,
  Layers,
} from 'lucide-react';
import {
  useGoalBarrierStore,
  type GoalBarrierPresetId,
} from '../../stores/goalBarrierStore';
import {
  type GoalBarrierSelectionMode,
  type GoalBarrierTargetGoal,
  type NormalizedRect,
  GOAL_BARRIER_WIDTH_UU,
  GOAL_BARRIER_HEIGHT_UU,
  clamp01,
  normalizeRect,
} from '../../config/goalBarrierConfig';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { SliderControl } from '../primitives/SliderControl';

export interface GoalBarrierFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

interface DragState {
  startU: number;
  startV: number;
  currU: number;
  currV: number;
  snappedStart: boolean;
  snappedCurr: boolean;
}

export const GoalBarrierFloatingWindow: React.FC<GoalBarrierFloatingWindowProps> = ({
  isLight = false,
}) => {
  const {
    enabled,
    selectionMode,
    targetGoal,
    opacity,
    decomposition,
    setEnabled,
    setSelectionMode,
    setTargetGoal,
    setOpacity,
    commitRect,
    applyPreset,
    clearBarrier,
  } = useGoalBarrierStore();

  const goalBoxRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverSnapPoint, setHoverSnapPoint] = useState<{
    u: number;
    v: number;
    isClamped: boolean;
  } | null>(null);

  const resolveGoalCoords = useCallback((clientX: number, clientY: number) => {
    const el = goalBoxRef.current;
    if (!el) {
      return { u: 0, v: 0, isClamped: false };
    }
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const rawU = (clientX - rect.left) / w;
    const rawV = (clientY - rect.top) / h;
    const isClamped = rawU < 0 || rawU > 1 || rawV < 0 || rawV > 1;
    return {
      u: clamp01(rawU),
      v: clamp01(rawV),
      isClamped,
    };
  }, []);

  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = resolveGoalCoords(e.clientX, e.clientY);
    setDragState({
      startU: pt.u,
      startV: pt.v,
      currU: pt.u,
      currV: pt.v,
      snappedStart: pt.isClamped,
      snappedCurr: pt.isClamped,
    });
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    const pt = resolveGoalCoords(e.clientX, e.clientY);
    setHoverSnapPoint(pt);
  };

  const handleStageMouseLeave = () => {
    if (!dragState) {
      setHoverSnapPoint(null);
    }
  };

  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (ev: MouseEvent) => {
      const pt = resolveGoalCoords(ev.clientX, ev.clientY);
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currU: pt.u,
              currV: pt.v,
              snappedCurr: pt.isClamped,
            }
          : null
      );
      setHoverSnapPoint(pt);
    };

    const handleWindowMouseUp = (ev: MouseEvent) => {
      const pt = resolveGoalCoords(ev.clientX, ev.clientY);
      const finalRect = normalizeRect(dragState.startU, dragState.startV, pt.u, pt.v);
      if (finalRect) {
        commitRect(finalRect);
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState, resolveGoalCoords, commitRect]);

  const previewRect: NormalizedRect | null = dragState
    ? {
        u0: Math.min(dragState.startU, dragState.currU),
        v0: Math.min(dragState.startV, dragState.currV),
        u1: Math.max(dragState.startU, dragState.currU),
        v1: Math.max(dragState.startV, dragState.currV),
      }
    : null;

  const coveragePct = (decomposition.coverageRatio * 100).toFixed(1);
  const quadCount = decomposition.mergedRects.length;

  const modeButtons: Array<{
    id: GoalBarrierSelectionMode;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
  }> = [
    {
      id: 'new',
      label: 'New Selection',
      icon: <Square className="h-3.5 w-3.5" />,
      activeClass: isLight
        ? 'bg-sky-600 border-sky-600 text-white'
        : 'bg-sky-500/25 border-sky-400/60 text-sky-300',
    },
    {
      id: 'add',
      label: 'Add',
      icon: <PlusSquare className="h-3.5 w-3.5" />,
      activeClass: isLight
        ? 'bg-emerald-600 border-emerald-600 text-white'
        : 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300',
    },
    {
      id: 'subtract',
      label: 'Subtract',
      icon: <MinusSquare className="h-3.5 w-3.5" />,
      activeClass: isLight
        ? 'bg-rose-600 border-rose-600 text-white'
        : 'bg-rose-500/25 border-rose-400/60 text-rose-300',
    },
  ];

  const presets: Array<{ id: GoalBarrierPresetId; label: string }> = [
    { id: 'full', label: 'Full Barrier' },
    { id: 'top-corners-open', label: 'Top Corners Open' },
    { id: 'bottom-corners-open', label: 'Low Corners Open' },
    { id: 'center-slot', label: 'Center Slot Open' },
  ];

  return (
    <div className="flex flex-col gap-2.5 select-none">
      {/* Top Status & Master Toggle Bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
          isLight
            ? 'bg-neutral-50 border-neutral-200'
            : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="h-4 w-4 text-sky-400 shrink-0" />
          <div className="flex flex-col leading-tight min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs truncate">Goal Mouth Barrier</span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-semibold ${
                  enabled && quadCount > 0
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : isLight
                    ? 'bg-neutral-200 border-neutral-300 text-neutral-600'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}
              >
                {enabled && quadCount > 0 ? `${coveragePct}% Blocked` : 'Inactive'}
              </span>
            </div>
            <span className={`text-[10px] mt-0.5 truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {quadCount} Disjoint {quadCount === 1 ? 'Quad' : 'Quads'} · Goalpost Ping Audio
            </span>
          </div>
        </div>

        <ToggleSwitch
          checked={Boolean(enabled && quadCount > 0)}
          onCheckedChange={(checked) => {
            if (checked && quadCount === 0) {
              applyPreset('full');
            } else {
              setEnabled(checked);
            }
          }}
          isLight={isLight}
          variant="neutral"
        />
      </div>

      {/* Boolean Operation Toolbar: New Selection | Add | Subtract | Clear */}
      <div className="grid grid-cols-4 gap-1.5">
        {modeButtons.map((btn) => {
          const isSelected = selectionMode === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => setSelectionMode(btn.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer active:scale-95 ${
                isSelected
                  ? btn.activeClass
                  : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
                  : 'bg-neutral-800/80 hover:bg-neutral-750 border-neutral-700 text-neutral-300'
              }`}
            >
              {btn.icon}
              <span className="truncate">{btn.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={clearBarrier}
          disabled={quadCount === 0}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all ${
            quadCount === 0
              ? 'opacity-40 cursor-not-allowed border-neutral-700/40 bg-neutral-800/30 text-neutral-500'
              : isLight
              ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700 cursor-pointer active:scale-95'
              : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 cursor-pointer active:scale-95'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          <span>Clear</span>
        </button>
      </div>

      {/* Interactive 2D Goal Canvas with Outer Snap Margin */}
      <div
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseLeave={handleStageMouseLeave}
        className={`relative p-6 rounded-xl border cursor-crosshair overflow-hidden transition-colors ${
          isLight
            ? 'bg-neutral-100/90 border-neutral-300'
            : 'bg-neutral-950/90 border-neutral-800'
        }`}
      >
        {/* Outer Snap Zone Label */}
        <div className="absolute top-1.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none text-[9px] font-mono opacity-65">
          <span className="flex items-center gap-1">
            <Crosshair className="h-2.5 w-2.5 text-amber-400" />
            <span>OUTER SNAP ZONE (Drag from outside to snap to corner/edge)</span>
          </span>
          <span>1792 × 644 UU</span>
        </div>

        {/* Valid Goal Aperture Box (Aspect Ratio ~ 2.78 : 1) */}
        <div
          ref={goalBoxRef}
          style={{ aspectRatio: `${GOAL_BARRIER_WIDTH_UU} / ${GOAL_BARRIER_HEIGHT_UU}` }}
          className={`relative w-full mt-2 rounded-t-2xl border-2 transition-colors ${
            isLight
              ? 'bg-neutral-900/95 border-neutral-400 shadow-inner'
              : 'bg-neutral-900/90 border-neutral-500/80 shadow-inner'
          }`}
        >
          {/* Background Goal Net Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)',
              backgroundSize: '12.5% 25%',
            }}
          />

          {/* Center Crosshair Guides */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 pointer-events-none" />

          {/* Decomposed Active Barrier Rectangles */}
          {decomposition.mergedRects.map((r, idx) => (
            <div
              key={`${r.u0}-${r.v0}-${r.u1}-${r.v1}-${idx}`}
              style={{
                left: `${r.u0 * 100}%`,
                top: `${r.v0 * 100}%`,
                width: `${(r.u1 - r.u0) * 100}%`,
                height: `${(r.v1 - r.v0) * 100}%`,
              }}
              className={`absolute pointer-events-none transition-opacity ${
                enabled
                  ? 'bg-sky-500/40 border border-sky-400/50'
                  : 'bg-neutral-500/25 border border-neutral-400/30'
              }`}
            />
          ))}

          {/* Exact Perimeter & Hole Contour Segments SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {decomposition.contourSegments.map((seg, idx) => (
              <line
                key={idx}
                x1={seg.u0 * 100}
                y1={seg.v0 * 100}
                x2={seg.u1 * 100}
                y2={seg.v1 * 100}
                stroke={enabled ? '#38bdf8' : '#9ca3af'}
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* Active Rubber-Band Selection Preview */}
          {previewRect && (
            <div
              style={{
                left: `${previewRect.u0 * 100}%`,
                top: `${previewRect.v0 * 100}%`,
                width: `${(previewRect.u1 - previewRect.u0) * 100}%`,
                height: `${(previewRect.v1 - previewRect.v0) * 100}%`,
              }}
              className={`absolute pointer-events-none border-2 ${
                selectionMode === 'subtract'
                  ? 'bg-rose-500/35 border-rose-400'
                  : 'bg-emerald-400/35 border-emerald-300'
              }`}
            >
              <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono text-white whitespace-nowrap">
                {selectionMode === 'subtract' ? '-' : '+'}{' '}
                {Math.round((previewRect.u1 - previewRect.u0) * GOAL_BARRIER_WIDTH_UU)}×
                {Math.round((previewRect.v1 - previewRect.v0) * GOAL_BARRIER_HEIGHT_UU)} UU
              </div>
            </div>
          )}

          {/* Snap-to-Extremity Reticle Indicator */}
          {hoverSnapPoint && (
            <div
              style={{
                left: `${hoverSnapPoint.u * 100}%`,
                top: `${hoverSnapPoint.v * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
            >
              <div
                className={`w-3 h-3 rounded-full border-2 transition-transform ${
                  hoverSnapPoint.isClamped
                    ? 'border-amber-400 bg-amber-400/40 scale-125 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                    : 'border-white/80 bg-white/20 scale-100'
                }`}
              />
            </div>
          )}

          {/* Goal Line Ground Indicator */}
          <div className="absolute inset-x-0 -bottom-0.5 h-1 bg-amber-500/60 pointer-events-none" />
        </div>

        {/* Bottom Coordinate Readout */}
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono opacity-75 pointer-events-none">
          <span>
            {hoverSnapPoint
              ? `Cursor: X=${Math.round((0.5 - hoverSnapPoint.u) * GOAL_BARRIER_WIDTH_UU)} Z=${Math.round(
                  (1 - hoverSnapPoint.v) * GOAL_BARRIER_HEIGHT_UU
                )} UU${hoverSnapPoint.isClamped ? ' [SNAPPED TO EDGE]' : ''}`
              : 'Drag inside or from outer zone to draw rectangle'}
          </span>
          <span>Mode: {selectionMode.toUpperCase()}</span>
        </div>
      </div>

      {/* Quick Presets Row */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-70 px-0.5">
          <Layers className="h-3 w-3 text-sky-400" />
          <span>Quick Templates</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer active:scale-95 truncate ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target Goal & Visual Opacity Controls */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
          isLight
            ? 'bg-neutral-50 border-neutral-200'
            : 'bg-neutral-850/70 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold">Target Goal</span>
          <div className="w-56">
            <SegmentedSwitch<GoalBarrierTargetGoal>
              value={targetGoal}
              onValueChange={setTargetGoal}
              size="sm"
              fullWidth
              isLight={isLight}
              options={[
                { value: 'both', label: 'Both Goals' },
                { value: 'orange', label: 'Orange (+Y)' },
                { value: 'blue', label: 'Blue (-Y)' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-1 border-t border-neutral-500/15">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold">Barrier Visual Opacity</span>
            <span className="font-mono text-[10px] text-sky-400">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <SliderControl
            value={Math.round(opacity * 100)}
            min={10}
            max={100}
            step={5}
            onChange={(val) => setOpacity(val / 100)}
            isLight={isLight}
          />
        </div>
      </div>
    </div>
  );
};
