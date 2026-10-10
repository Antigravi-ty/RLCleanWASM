import React, { useEffect, useRef } from 'react';
import { useUIStore, ViewportMetrics } from './store';
import { SafeAreaHud } from './SafeAreaHud';
import { TelemetryHUD } from '../hud/TelemetryHUD';
import { InGameHUD } from '../hud/InGameHUD';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface GameViewportProps {
  children: React.ReactNode;
}

export const GameViewport: React.FC<GameViewportProps> = ({ children }) => {
  const safeAreaMargin = useUIStore((s) => s.safeAreaMargin);
  const renderScale = useUIStore((s) => s.renderScale);
  const metrics = useUIStore((s) => s.metrics);
  const setMetrics = useUIStore((s) => s.setMetrics);
  const portraitDismissed = useUIStore((s) => s.portraitDismissed);
  const dismissPortraitGate = useUIStore((s) => s.dismissPortraitGate);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const computeAndApply = () => {
      if (typeof window === 'undefined') return;

      const Wwin = window.innerWidth;
      const Hwin = window.innerHeight;

      // 1. Safe Area Margin (-5% to +10%)
      const marginW = Wwin * (safeAreaMargin / 100);
      const marginH = Hwin * (safeAreaMargin / 100);
      const Wsafe = Math.max(100, Wwin - marginW * 2);
      const Hsafe = Math.max(100, Hwin - marginH * 2);

      // 2. 18:9 aspect ratio clamp (max width is Hsafe * 2.0)
      const maxRenderW = Hsafe * 2.0;
      const Wrender = Math.min(Wsafe, maxRenderW);
      const Hrender = Hsafe;

      const isPillarboxed = Wsafe > maxRenderW;
      const pillarboxWidth = isPillarboxed ? (Wsafe - Wrender) / 2 : 0;
      const isPortrait = Wsafe < Hsafe;

      // SimpleUI standard: baseScale = Wrender / DESIGN_STANDARD_WIDTH (1280)
      // Dynamic canvas scaling follows viewport width percentage * user renderScale percentage
      const baseScale = Wrender / 1280;
      const scaleFactor = Number((baseScale * (renderScale / 100)).toFixed(3));

      const newMetrics: ViewportMetrics = {
        scaleFactor,
        renderWidth: Wrender,
        renderHeight: Hrender,
        isPortrait,
        isPillarboxed,
        pillarboxWidth,
        safeMarginPct: safeAreaMargin
      };

      setMetrics(newMetrics);

      // 3. Inject CSS Variables onto Document Root (SimpleUI architecture)
      const root = document.documentElement;
      root.style.setProperty('--ui-scale', String(scaleFactor));
      root.style.setProperty('--ui-render-width', `${Math.round(Wrender)}px`);
      root.style.setProperty('--ui-render-height', `${Math.round(Hrender)}px`);
      root.style.setProperty('--ui-pillarbox-width', `${Math.round(pillarboxWidth)}px`);
      root.style.setProperty('--ui-safe-margin', `${safeAreaMargin}%`);
    };

    computeAndApply();
    window.addEventListener('resize', computeAndApply);
    return () => window.removeEventListener('resize', computeAndApply);
  }, [safeAreaMargin, renderScale, setMetrics]);

  return (
    <div
      ref={viewportRef}
      id="game-ui-viewport-host"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
    >
      {/* Telemetry HUD & Boundary guides */}
      <SafeAreaHud />

      {/* Modern In-Game Telemetry Bar */}
      <TelemetryHUD />

      {/* Modern In-Game Match HUD: Ball Camera & Circular Boost Gauge */}
      <InGameHUD />

      {/* Main UI Children (MenuShell, etc.) */}
      {children}

      {/* SimpleUI Portrait Orientation Barrier */}
      {metrics.isPortrait && !portraitDismissed && (
        <div className="fixed inset-0 z-[100000] pointer-events-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-6 select-none">
          <div className="max-w-xs w-full bg-neutral-900 border border-neutral-700/80 rounded-2xl p-6 text-center shadow-2xl flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="h-3 w-3" />
              <span>Landscape Recommended</span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">Use it at your own risk</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Car Soccer is engineered for horizontal desktop/laptop displays (up to 18:9).
            </p>
            <button
              type="button"
              onClick={dismissPortraitGate}
              className="mt-2 w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>I got it, proceed anyway</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
