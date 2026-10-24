import React from 'react';

export interface CubicBezierGraphProps {
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  isLight?: boolean;
}

/**
 * CubicBezierGraph
 * Visualizes CSS cubic-bezier(p1x, p1y, p2x, p2y) curve with dynamic overshoot support.
 * Automatically expands vertical coordinate bounds when control points overshoot above 1.0 or below 0.0.
 */
export const CubicBezierGraph: React.FC<CubicBezierGraphProps> = ({
  p1x,
  p1y,
  p2x,
  p2y,
  isLight = false,
}) => {
  // Graph viewport dimensions
  const width = 280;
  const height = 150;
  const paddingX = 28;
  const paddingY = 24;

  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  // Dynamic vertical scaling to accommodate overshoot (above 1 or below 0)
  const minY = Math.min(-0.25, p1y - 0.15, p2y - 0.15);
  const maxY = Math.max(1.25, p1y + 0.15, p2y + 0.15);
  const rangeY = maxY - minY;

  // Map normalized coordinates (0..1, Y inverted for SVG) to SVG pixel space
  const mapX = (x: number) => paddingX + Math.max(0, Math.min(1, x)) * innerW;
  const mapY = (y: number) => paddingY + (1.0 - (y - minY) / rangeY) * innerH;

  const p0Screen = { x: mapX(0), y: mapY(0) };
  const p1Screen = { x: mapX(p1x), y: mapY(p1y) };
  const p2Screen = { x: mapX(p2x), y: mapY(p2y) };
  const p3Screen = { x: mapX(1), y: mapY(1) };

  // SVG Cubic Bezier Path
  const curvePath = `M ${p0Screen.x.toFixed(1)},${p0Screen.y.toFixed(1)} C ${p1Screen.x.toFixed(1)},${p1Screen.y.toFixed(1)} ${p2Screen.x.toFixed(1)},${p2Screen.y.toFixed(1)} ${p3Screen.x.toFixed(1)},${p3Screen.y.toFixed(1)}`;

  const hasOvershootTop = p1y > 1.0 || p2y > 1.0;
  const hasOvershootBottom = p1y < 0.0 || p2y < 0.0;

  return (
    <div
      className={`relative w-full rounded-xl border flex flex-col items-center select-none overflow-hidden p-2 transition-colors ${
        isLight
          ? 'bg-neutral-50/90 border-neutral-300 text-neutral-800'
          : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-200'
      }`}
    >
      <div className="flex items-center justify-between w-full px-1 mb-1 font-mono text-[10px]">
        <span className="font-semibold text-amber-500">
          cubic-bezier({p1x.toFixed(2)}, {p1y.toFixed(2)}, {p2x.toFixed(2)}, {p2y.toFixed(2)})
        </span>
        {(hasOvershootTop || hasOvershootBottom) && (
          <span className="px-1.5 py-0.2 rounded border text-[9px] font-bold bg-pink-500/10 text-pink-400 border-pink-500/30">
            {hasOvershootTop && hasOvershootBottom ? 'Dual Overshoot' : hasOvershootTop ? 'Peak Overshoot' : 'Undershoot'}
          </span>
        )}
      </div>

      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="curveGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* 0 to 1 Unit Square Reference Area */}
        <rect
          x={mapX(0)}
          y={mapY(1)}
          width={innerW}
          height={mapY(0) - mapY(1)}
          fill={isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'}
          stroke={isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'}
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Horizontal Baseline (Y = 0) */}
        <line
          x1={paddingX - 10}
          y1={p0Screen.y}
          x2={width - paddingX + 10}
          y2={p0Screen.y}
          stroke={isLight ? '#cbd5e1' : '#475569'}
          strokeWidth="1"
        />
        <text
          x={paddingX - 14}
          y={p0Screen.y + 3}
          fontSize="9"
          textAnchor="end"
          fill={isLight ? '#64748b' : '#94a3b8'}
          className="font-mono"
        >
          0.0
        </text>

        {/* Horizontal Topline (Y = 1.0) */}
        <line
          x1={paddingX - 10}
          y1={p3Screen.y}
          x2={width - paddingX + 10}
          y2={p3Screen.y}
          stroke={isLight ? '#cbd5e1' : '#475569'}
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <text
          x={paddingX - 14}
          y={p3Screen.y + 3}
          fontSize="9"
          textAnchor="end"
          fill={isLight ? '#64748b' : '#94a3b8'}
          className="font-mono"
        >
          1.0
        </text>

        {/* Diagonal Reference Line (Linear Easing) */}
        <line
          x1={p0Screen.x}
          y1={p0Screen.y}
          x2={p3Screen.x}
          y2={p3Screen.y}
          stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Handle 1: P0 to P1 */}
        <line
          x1={p0Screen.x}
          y1={p0Screen.y}
          x2={p1Screen.x}
          y2={p1Screen.y}
          stroke="#f59e0b"
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* Handle 2: P3 to P2 */}
        <line
          x1={p3Screen.x}
          y1={p3Screen.y}
          x2={p2Screen.x}
          y2={p2Screen.y}
          stroke="#ec4899"
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* Cubic Bezier Curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="url(#curveGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* P0 Anchor */}
        <circle cx={p0Screen.x} cy={p0Screen.y} r="3" fill="#64748b" />

        {/* P3 Anchor */}
        <circle cx={p3Screen.x} cy={p3Screen.y} r="3" fill="#64748b" />

        {/* P1 Control Point Dot */}
        <circle
          cx={p1Screen.x}
          cy={p1Screen.y}
          r="4.5"
          fill="#f59e0b"
          stroke={isLight ? '#ffffff' : '#18181b'}
          strokeWidth="1.5"
          className="shadow-sm"
        />

        {/* P2 Control Point Dot */}
        <circle
          cx={p2Screen.x}
          cy={p2Screen.y}
          r="4.5"
          fill="#ec4899"
          stroke={isLight ? '#ffffff' : '#18181b'}
          strokeWidth="1.5"
          className="shadow-sm"
        />
      </svg>
    </div>
  );
};
