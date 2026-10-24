import React, { useMemo } from 'react';
import { TrendingUp, ArrowDown, Clock, MoveVertical } from 'lucide-react';

export interface OrbTrajectoryChartProps {
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  durationMs: number;
  dropDistance: number;
  isLight?: boolean;
}

export function computeOrbTrajectoryExtrema(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  durationMs: number,
  dropDistance: number
) {
  const clampX1 = Math.min(1, Math.max(0, p1x));
  const clampX2 = Math.min(1, Math.max(0, p2x));

  const evalX = (u: number) => {
    const oneMinusU = 1.0 - u;
    return (
      3 * oneMinusU * oneMinusU * u * clampX1 +
      3 * oneMinusU * u * u * clampX2 +
      u * u * u
    );
  };

  const evalY = (u: number) => {
    const oneMinusU = 1.0 - u;
    return (
      3 * oneMinusU * oneMinusU * u * p1y +
      3 * oneMinusU * u * u * p2y +
      u * u * u
    );
  };

  // Derivative dy/du = 3 * (A*u^2 + B*u + C)
  const A = 1.0 - 3.0 * p2y + 3.0 * p1y;
  const B = 2.0 * (p2y - 2.0 * p1y);
  const C = p1y;

  const candidateU = [0.0, 1.0];

  if (Math.abs(A) < 1e-7) {
    if (Math.abs(B) > 1e-7) {
      const u = -C / B;
      if (u > 0.0 && u < 1.0) candidateU.push(u);
    }
  } else {
    const disc = B * B - 4.0 * A * C;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const u1 = (-B - sqrtDisc) / (2.0 * A);
      const u2 = (-B + sqrtDisc) / (2.0 * A);
      if (u1 > 0.0 && u1 < 1.0) candidateU.push(u1);
      if (u2 > 0.0 && u2 < 1.0) candidateU.push(u2);
    }
  }

  let minY = 0.0;
  let maxY = 1.0;
  let uForMinY = 0.0;
  let uForMaxY = 1.0;

  for (const u of candidateU) {
    const yVal = evalY(u);
    if (yVal < minY) {
      minY = yVal;
      uForMinY = u;
    }
    if (yVal > maxY) {
      maxY = yVal;
      uForMaxY = u;
    }
  }

  // Displacement relative to base height: DeltaY(u) = - evalY(u) * dropDistance
  const peakRiseUu = minY < 0 ? -minY * dropDistance : 0;
  const peakTimeMs = evalX(uForMinY) * durationMs;

  const lowestPlungeUu = maxY > 1.0 ? -maxY * dropDistance : -dropDistance;
  const lowestTimeMs = evalX(uForMaxY) * durationMs;

  const finalDropUu = -dropDistance;

  return {
    minY,
    maxY,
    uForMinY,
    uForMaxY,
    peakRiseUu,
    peakTimeMs,
    lowestPlungeUu,
    lowestTimeMs,
    finalDropUu,
    evalX,
    evalY,
  };
}

export const OrbTrajectoryChart: React.FC<OrbTrajectoryChartProps> = ({
  p1x,
  p1y,
  p2x,
  p2y,
  durationMs,
  dropDistance,
  isLight = false,
}) => {
  const extrema = useMemo(
    () => computeOrbTrajectoryExtrema(p1x, p1y, p2x, p2y, durationMs, dropDistance),
    [p1x, p1y, p2x, p2y, durationMs, dropDistance]
  );

  // SVG chart dimensions
  const width = 310;
  const height = 160;
  const paddingL = 40;
  const paddingR = 24;
  const paddingT = 20;
  const paddingB = 26;

  const innerW = width - paddingL - paddingR;
  const innerH = height - paddingT - paddingB;

  // Vertical bounds in uu
  // Max height above baseline
  const topDeltaY = Math.max(30, extrema.peakRiseUu * 1.15);
  // Lowest height below baseline
  const bottomDeltaY = Math.min(-dropDistance * 1.15, extrema.lowestPlungeUu * 1.15);
  const rangeY = topDeltaY - bottomDeltaY;

  const mapX = (tMs: number) => paddingL + Math.min(1, Math.max(0, tMs / Math.max(1, durationMs))) * innerW;
  const mapY = (deltaY: number) => paddingT + (1.0 - (deltaY - bottomDeltaY) / rangeY) * innerH;

  // Sample trajectory points
  const numSamples = 60;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= numSamples; i++) {
    const u = i / numSamples;
    const tMs = extrema.evalX(u) * durationMs;
    const deltaY = -extrema.evalY(u) * dropDistance;
    points.push({ x: mapX(tMs), y: mapY(deltaY) });
  }

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, '');

  // Key reference coordinates
  const yBaselineScreen = mapY(0);
  const yFinalScreen = mapY(-dropDistance);
  const peakScreen = {
    x: mapX(extrema.peakTimeMs),
    y: mapY(extrema.peakRiseUu),
  };
  const endScreen = {
    x: mapX(durationMs),
    y: yFinalScreen,
  };

  const hasPeak = extrema.peakRiseUu > 0.5;

  return (
    <div
      className={`relative w-full rounded-xl border flex flex-col items-center select-none overflow-hidden p-2.5 transition-colors ${
        isLight
          ? 'bg-neutral-50/90 border-neutral-300 text-neutral-800'
          : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-200'
      }`}
    >
      {/* Top Header Status */}
      <div className="flex items-center justify-between w-full px-1 mb-1 font-mono text-[10px]">
        <div className="flex items-center gap-1 font-semibold text-amber-500">
          <MoveVertical className="h-3 w-3" />
          <span>Orb Vertical Trajectory Chart</span>
        </div>
        <span className="px-1.5 py-0.5 rounded border text-[9px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/30">
          {hasPeak ? `Peak Leap (+${extrema.peakRiseUu.toFixed(1)} uu)` : 'Direct Drop'}
        </span>
      </div>

      {/* SVG Canvas */}
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="orbTrajectoryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="35%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <linearGradient id="orbAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Shaded Area Under Curve */}
        <path
          d={`${pathD} L ${endScreen.x.toFixed(1)},${yBaselineScreen.toFixed(1)} L ${mapX(0).toFixed(1)},${yBaselineScreen.toFixed(1)} Z`}
          fill="url(#orbAreaGradient)"
        />

        {/* Baseline (0 uu, Initial Floating Height) */}
        <line
          x1={paddingL - 6}
          y1={yBaselineScreen}
          x2={width - paddingR + 6}
          y2={yBaselineScreen}
          stroke={isLight ? '#94a3b8' : '#64748b'}
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
        <text
          x={paddingL - 8}
          y={yBaselineScreen + 3}
          fontSize="9"
          textAnchor="end"
          fill={isLight ? '#64748b' : '#94a3b8'}
          className="font-mono font-bold"
        >
          0 uu
        </text>

        {/* Final Drop Line (-dropDistance uu) */}
        <line
          x1={paddingL - 6}
          y1={yFinalScreen}
          x2={width - paddingR + 6}
          y2={yFinalScreen}
          stroke={isLight ? '#cbd5e1' : '#334155'}
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <text
          x={paddingL - 8}
          y={yFinalScreen + 3}
          fontSize="9"
          textAnchor="end"
          fill={isLight ? '#94a3b8' : '#64748b'}
          className="font-mono"
        >
          -{dropDistance.toFixed(0)}
        </text>

        {/* Trajectory Stroke Curve */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#orbTrajectoryGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start Point */}
        <circle cx={mapX(0)} cy={yBaselineScreen} r="3.5" fill="#f59e0b" />

        {/* Peak Leap Annotation Dot */}
        {hasPeak && (
          <g>
            {/* Vertical guide from baseline to peak */}
            <line
              x1={peakScreen.x}
              y1={yBaselineScreen}
              x2={peakScreen.x}
              y2={peakScreen.y}
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.7"
            />
            <circle
              cx={peakScreen.x}
              cy={peakScreen.y}
              r="4.5"
              fill="#f59e0b"
              stroke={isLight ? '#ffffff' : '#18181b'}
              strokeWidth="1.5"
            />
            {/* Peak label badge */}
            <text
              x={peakScreen.x}
              y={Math.max(12, peakScreen.y - 7)}
              fontSize="9"
              textAnchor="middle"
              fill="#f59e0b"
              className="font-mono font-bold drop-shadow-sm"
            >
              +{extrema.peakRiseUu.toFixed(1)} uu ({extrema.peakTimeMs.toFixed(0)}ms)
            </text>
          </g>
        )}

        {/* End Drop Point */}
        <circle
          cx={endScreen.x}
          cy={endScreen.y}
          r="4.5"
          fill="#38bdf8"
          stroke={isLight ? '#ffffff' : '#18181b'}
          strokeWidth="1.5"
        />
        <text
          x={endScreen.x - 4}
          y={endScreen.y - 8}
          fontSize="9"
          textAnchor="end"
          fill="#38bdf8"
          className="font-mono font-bold"
        >
          -{dropDistance.toFixed(0)} uu
        </text>

        {/* X Axis Time Labels */}
        <text
          x={mapX(0)}
          y={height - 8}
          fontSize="9"
          textAnchor="start"
          fill={isLight ? '#64748b' : '#94a3b8'}
          className="font-mono"
        >
          0ms
        </text>
        <text
          x={mapX(durationMs)}
          y={height - 8}
          fontSize="9"
          textAnchor="end"
          fill={isLight ? '#64748b' : '#94a3b8'}
          className="font-mono"
        >
          {durationMs.toFixed(0)}ms
        </text>
      </svg>

      {/* Summary Metrics Chips */}
      <div className="grid grid-cols-4 gap-1.5 w-full mt-2 font-mono text-[10px]">
        <div
          className={`p-1.5 rounded-lg border flex flex-col items-center ${
            isLight ? 'bg-amber-500/10 border-amber-300/60' : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <span className="text-[9px] text-neutral-400 flex items-center gap-0.5">
            <TrendingUp className="h-2.5 w-2.5 text-amber-500" />
            Peak Lift
          </span>
          <span className="font-bold text-amber-500">
            +{extrema.peakRiseUu.toFixed(1)} uu
          </span>
        </div>

        <div
          className={`p-1.5 rounded-lg border flex flex-col items-center ${
            isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-800/60 border-neutral-700'
          }`}
        >
          <span className="text-[9px] text-neutral-400 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5 text-amber-400" />
            Peak Time
          </span>
          <span className="font-bold text-neutral-200">
            {extrema.peakTimeMs.toFixed(1)} ms
          </span>
        </div>

        <div
          className={`p-1.5 rounded-lg border flex flex-col items-center ${
            isLight ? 'bg-sky-500/10 border-sky-300/60' : 'bg-sky-500/10 border-sky-500/30'
          }`}
        >
          <span className="text-[9px] text-neutral-400 flex items-center gap-0.5">
            <ArrowDown className="h-2.5 w-2.5 text-sky-400" />
            Final Drop
          </span>
          <span className="font-bold text-sky-400">
            -{dropDistance.toFixed(1)} uu
          </span>
        </div>

        <div
          className={`p-1.5 rounded-lg border flex flex-col items-center ${
            isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-800/60 border-neutral-700'
          }`}
        >
          <span className="text-[9px] text-neutral-400 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5 text-neutral-400" />
            Duration
          </span>
          <span className="font-bold text-neutral-200">
            {durationMs.toFixed(0)} ms
          </span>
        </div>
      </div>
    </div>
  );
};
