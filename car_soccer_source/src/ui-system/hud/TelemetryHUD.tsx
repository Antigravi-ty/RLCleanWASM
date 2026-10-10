import React from 'react';
import { MonitorPlay, Ruler, Gauge, Router } from 'lucide-react';
import { useUIStore, type TelemetryConfig } from '../core/store';
import { useTelemetryData, type TelemetrySnapshot } from '../tokens/perfTelemetryStore';

export interface TelemetryHUDProps {
  config?: TelemetryConfig;
  snapshot?: TelemetrySnapshot | null;
  renderScale?: number;
  isLight?: boolean;
  className?: string;
}

/**
 * Modern In-Game Telemetry HUD
 * Aligned with UIStorybook Match HUD NetworkDiagnosticsHUD standard.
 * Positioned in the top-left corner, displaying decoupled live metrics:
 * 1. FPS & Screen Refresh Rate (lucide: monitor-play, e.g. 120hz or 120/120hz)
 * 2. Viewport Render Scale (lucide: ruler, e.g. 50%) - throws Error if data is unavailable/NaN
 * 3. Physical Simulation Rate (lucide: gauge, e.g. 120.0, range 118-122 with 1 decimal place, no unit)
 * 4. Network Latency & RTT Offset (lucide: router, e.g. 0ms(+0))
 */
export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  config: propConfig,
  snapshot: propSnapshot,
  renderScale: propRenderScale,
  isLight: propIsLight,
  className = '',
}) => {
  const storeTelemetry = useUIStore((s) => s.telemetry);
  const storeRenderScale = useUIStore((s) => s.graphics?.renderScale);
  const storeTheme = useUIStore((s) => s.theme);

  const config = propConfig || storeTelemetry;
  const isLight = propIsLight !== undefined ? propIsLight : storeTheme === 'light';
  const renderScale = propRenderScale !== undefined ? propRenderScale : storeRenderScale;

  // Master toggle check: if master toggle is off, render nothing
  const isAlwaysShow = config.alwaysShow;

  const polled = useTelemetryData(180, isAlwaysShow && !propSnapshot);
  const snap = propSnapshot !== undefined ? propSnapshot : polled.data;

  if (!isAlwaysShow || !snap) {
    return null;
  }

  // Determine visibility for each metric based on display mode
  // ('always': show, 'off': hide, 'on_demand': infrastructure pending, hide for now)
  // Rule: If FPS is off, Screen Refresh Rate must also be off.
  const showFps = config.fpsMode === 'always';
  const showRefreshRate = showFps && config.refreshRateMode === 'always';
  const showRenderScale = config.renderScaleMode === 'always';
  const showPhysicsRate = config.physicsRateMode === 'always';
  const showLatency = config.latencyMode === 'always';

  // If all metrics are turned off, do not render an empty pill
  if (!showFps && !showRenderScale && !showPhysicsRate && !showLatency) {
    return null;
  }

  // Strict validation: if renderScale is enabled but unavailable/NaN, throw explicit error as requested
  if (showRenderScale) {
    if (typeof renderScale !== 'number' || Number.isNaN(renderScale)) {
      throw new Error(`[TelemetryHUD] renderScale is unavailable or NaN: ${renderScale}`);
    }
  }

  const isHighPing = (snap.latency?.baseMs ?? 0) > 80;

  const bgBorderClass = isLight
    ? 'bg-white/85 border-neutral-300/80 text-neutral-800 backdrop-blur-md shadow-md'
    : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 backdrop-blur-md shadow-md';

  // Build rendered items array to cleanly insert dividers
  const items: React.ReactNode[] = [];

  // 1. FPS & Screen Refresh Rate
  // If refresh rate is on: displays "{fps} / {refreshHz} hz"; if off: displays "{fps} hz"
  if (showFps) {
    items.push(
      <div key="fps" className="flex items-center gap-1">
        <MonitorPlay className={`h-3 w-3 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
        <span className={`font-bold tabular-nums ${isLight ? 'text-neutral-900' : 'text-white'}`}>
          {snap.fps}
        </span>
        {showRefreshRate && (
          <>
            <span className={isLight ? 'text-neutral-400' : 'text-neutral-500'}>/</span>
            <span className={`tabular-nums ${isLight ? 'text-neutral-600' : 'text-neutral-300'}`}>
              {snap.refreshHz}
            </span>
          </>
        )}
        <span className={`text-[9px] uppercase ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          hz
        </span>
      </div>
    );
  }

  // 2. Render Scale
  if (showRenderScale) {
    items.push(
      <div key="scale" className="flex items-center gap-1">
        <Ruler className={`h-3 w-3 ${isLight ? 'text-sky-600' : 'text-sky-400'}`} />
        <span className={`font-bold tabular-nums ${isLight ? 'text-neutral-900' : 'text-white'}`}>
          {Math.round(renderScale!)}%
        </span>
      </div>
    );
  }

  // 3. Physics Simulation Rate (strictly 118.0 - 122.0, always 1 decimal place, no unit)
  if (showPhysicsRate) {
    const rawPhy = snap.sim?.physicsRateHz ?? 120;
    const clampedPhysicsRate = Math.max(118, Math.min(122, Math.round(rawPhy)));
    items.push(
      <div key="physics" className="flex items-center gap-1">
        <Gauge className={`h-3 w-3 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
        <span className={`font-bold tabular-nums ${isLight ? 'text-neutral-900' : 'text-white'}`}>
          {clampedPhysicsRate.toFixed(1)}
        </span>
      </div>
    );
  }

  // 4. Network Latency & Simulated Latency Offset
  if (showLatency) {
    const baseMs = snap.latency?.baseMs ?? 0;
    const extraMs = snap.latency?.extraMs ?? 0;
    items.push(
      <div key="latency" className="flex items-center gap-1">
        <Router
          className={`h-3 w-3 ${
            isHighPing
              ? isLight
                ? 'text-amber-600'
                : 'text-amber-400'
              : isLight
              ? 'text-emerald-600'
              : 'text-emerald-400'
          }`}
        />
        <span className={`font-bold tabular-nums ${isLight ? 'text-neutral-900' : 'text-white'}`}>
          {baseMs}ms(+{extraMs})
        </span>
      </div>
    );
  }

  return (
    <div
      data-ui-element="hud-telemetry-bar"
      className={`fixed top-4 left-4 z-40 select-none pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-mono transition-colors ${bgBorderClass} ${className}`}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && (
            <span className={isLight ? 'text-neutral-300' : 'text-neutral-700'}>|</span>
          )}
          {item}
        </React.Fragment>
      ))}
    </div>
  );
};
