import React, { useMemo, useState, useEffect } from 'react';
import { Activity, Zap, RefreshCw, Filter, Sliders, Volume2, Trash2 } from 'lucide-react';
import {
  useEventStreamData,
  eventStreamStore,
  type EventParamType,
} from '../tokens/eventStreamStore';

export interface EventStreamOBFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

const SVG_HEIGHT = 120;

export const EventStreamOBFloatingWindow: React.FC<EventStreamOBFloatingWindowProps> = ({
  isLight = false,
  active = true,
}) => {
  const state = useEventStreamData();
  const [filter, setFilter] = useState<'all' | 'car-ball' | 'car-world'>('all');
  const [now, setNow] = useState(() => performance.now());

  // Continuous animation frame loop to advance real-time timeline smoothly
  useEffect(() => {
    let animId: number;
    const tick = () => {
      setNow(performance.now());
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const windowMs = state.timeWindowSec * 1000;
  const startMs = now - windowMs;

  // Filter events within current time window
  const visibleEvents = useMemo(() => {
    return state.events.filter((e) => {
      if (e.timestamp < startMs) return false;
      if (filter === 'car-ball' && e.type !== 1) return false;
      if (filter === 'car-world' && e.type !== 2) return false;
      return true;
    });
  }, [state.events, startMs, filter]);

  // Scatter plot calculations
  const { points, thresholdY, maxObserved } = useMemo(() => {
    const range = Math.max(1, state.maxY - state.minY);
    let maxVal = 0;

    const pts = visibleEvents.map((e) => {
      const relTime = (e.timestamp - startMs) / windowMs; // 0..1
      const x = Math.max(0, Math.min(100, relTime * 100));
      const normalizedY = Math.max(0, Math.min(1, (e.value - state.minY) / range));
      const y = SVG_HEIGHT - normalizedY * (SVG_HEIGHT - 16) - 8;
      if (e.value > maxVal) maxVal = e.value;
      return { x, y, val: e.value, type: e.type, id: `${e.timestamp}-${e.value}` };
    });

    const threshNorm = Math.max(0, Math.min(1, (state.threshold - state.minY) / range));
    const tY = SVG_HEIGHT - threshNorm * (SVG_HEIGHT - 16) - 8;

    return { points: pts, thresholdY: tY, maxObserved: maxVal };
  }, [visibleEvents, startMs, windowMs, state.maxY, state.minY, state.threshold]);

  const lastEvent = state.events[state.events.length - 1];

  return (
    <div className="flex flex-col gap-2.5 h-full select-none text-xs">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <select
            value={state.activeParam}
            onChange={(e) => eventStreamStore.setActiveParam(e.target.value as EventParamType)}
            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold outline-none cursor-pointer transition-colors ${
              isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 border-neutral-700 text-neutral-200'
            }`}
          >
            <option value="impulse">Impulse (Force)</option>
            <option value="relSpeed">Relative Speed</option>
            <option value="normalRelVel">Normal Rel Vel</option>
            <option value="speed">Speed</option>
            <option value="z">Coordinate Z</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-sky-500 text-white font-bold'
                  : isLight
                  ? 'bg-neutral-200 text-neutral-600'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('car-ball')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === 'car-ball'
                  ? 'bg-amber-500 text-white font-bold'
                  : isLight
                  ? 'bg-neutral-200 text-neutral-600'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              Ball
            </button>
            <button
              type="button"
              onClick={() => setFilter('car-world')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === 'car-world'
                  ? 'bg-purple-500 text-white font-bold'
                  : isLight
                  ? 'bg-neutral-200 text-neutral-600'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              World
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => eventStreamStore.clearEvents()}
          title="Clear event history"
          className={`p-1 rounded-lg border transition-all cursor-pointer ${
            isLight
              ? 'hover:bg-neutral-200 border-neutral-300 text-neutral-600'
              : 'hover:bg-neutral-800 border-neutral-700 text-neutral-400'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 2. Scatter Plot Viewport */}
      <div
        className={`relative w-full rounded-xl border p-2 flex flex-col justify-between overflow-hidden ${
          isLight ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-neutral-950 border-neutral-800 text-white'
        }`}
        style={{ height: `${SVG_HEIGHT}px` }}
      >
        <svg
          viewBox={`0 0 100 ${SVG_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* Threshold Line */}
          <line
            x1="0"
            y1={thresholdY}
            x2="100"
            y2={thresholdY}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.85"
          />

          {/* Scatter points */}
          {points.map((pt) => {
            const color = pt.type === 1 ? '#38bdf8' : '#a855f7';
            return (
              <circle
                key={pt.id}
                cx={pt.x}
                cy={pt.y}
                r="1.8"
                fill={color}
                opacity="0.9"
              />
            );
          })}
        </svg>

        {/* Top-Right Label: Max Bound */}
        <div className="flex justify-between items-start text-[9px] font-mono text-neutral-400 z-10 pointer-events-none">
          <span>Y-Max: {state.maxY}</span>
          <span className="text-amber-400">Audio Thresh: {Math.round(state.threshold)}</span>
        </div>

        {/* Bottom Label: Time Window */}
        <div className="flex justify-between items-end text-[9px] font-mono text-neutral-400 z-10 pointer-events-none">
          <span>-{state.timeWindowSec.toFixed(1)}s</span>
          <span>Now</span>
        </div>
      </div>

      {/* 3. Stat Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Total Hits</span>
          <span className="text-sm font-mono font-bold text-sky-400">{state.totalHits}</span>
        </div>

        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Last Value</span>
          <span className="text-sm font-mono font-bold text-amber-400">
            {lastEvent ? lastEvent.value.toFixed(1) : '0.0'}
          </span>
        </div>

        <div
          className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-850/60 border-neutral-700/60'
          }`}
        >
          <span className="text-[10px] text-neutral-400 font-mono">Peak In-View</span>
          <span className="text-sm font-mono font-bold text-emerald-400">
            {maxObserved.toFixed(1)}
          </span>
        </div>
      </div>

      {/* 4. Controls: Threshold & Time Window Sliders */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 font-mono text-[11px] ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Volume2 className="h-3.5 w-3.5 text-amber-500" />
            <span>Audio Threshold:</span>
          </div>
          <span className="font-bold text-amber-500">{Math.round(state.threshold)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={state.maxY}
          step="10"
          value={state.threshold}
          onChange={(e) => eventStreamStore.setThreshold(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-neutral-400">Time Window:</span>
          <span className="font-bold text-neutral-200">{state.timeWindowSec.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={state.timeWindowSec}
          onChange={(e) => eventStreamStore.setTimeWindow(Number(e.target.value))}
          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
      </div>
    </div>
  );
};
