import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { useUIStore } from '../core/store';

export type LivePreviewAnimPhase =
  | 'expanded'
  | 'collapsing_content'
  | 'collapsing_resize'
  | 'collapsed'
  | 'expanding_content'
  | 'expanding_resize';

export interface LivePreviewShellProps {
  isLight?: boolean;
  onBack?: () => void;
  inspectorSlot?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * LivePreviewShell
 * Reference implementation faithful to UIStorybook commit 5c244ae (LivePreviewSimulationPage).
 *
 * Core interactive paradigm:
 * 1. Sequenced Step Transition:
 *    - Collapse: Content fades out (110ms) -> Container resizes & docks to right-middle (260ms) -> Pill content fades in (110ms)
 *    - Expand: Pill content fades out (90ms) -> Container resizes back to center (260ms) -> Recipe content fades in (110ms)
 * 2. Visual guidance:
 *    The smooth container resize animation guides the player's eye directly to the right edge,
 *    demonstrating where the window is stowed and indicating the Tab shortcut / click restoration.
 * 3. Decoupled inputs:
 *    When collapsed/collapsing, backdrop becomes pointer-events-none with 100% transparent background,
 *    allowing game simulation to run and inputs to penetrate to Three.js canvas.
 */
export const LivePreviewShell: React.FC<LivePreviewShellProps> = ({
  isLight = false,
  onBack,
  inspectorSlot,
  children,
}) => {
  const isCollapsed = useUIStore((s) => s.isLivePreviewCollapsed);
  const setLivePreviewCollapsed = useUIStore((s) => s.setLivePreviewCollapsed);

  const [animPhase, setAnimPhase] = useState<LivePreviewAnimPhase>(
    isCollapsed ? 'collapsed' : 'expanded'
  );
  const [isPillHovered, setIsPillHovered] = useState(false);
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sequenced collapse handler
  const handleTriggerCollapse = () => {
    clearTimers();
    // Step 1: Content vanishes (110ms)
    setAnimPhase('collapsing_content');
    const t1 = setTimeout(() => {
      // Step 2: Container resizes to right-middle (260ms)
      setAnimPhase('collapsing_resize');
      const t2 = setTimeout(() => {
        // Step 3: Pill content shows up (110ms)
        setAnimPhase('collapsed');
      }, 260);
      timersRef.current.push(t2);
    }, 110);
    timersRef.current.push(t1);
  };

  // Sequenced expand handler
  const handleTriggerExpand = () => {
    clearTimers();
    // Step 1: Pill content vanishes (90ms)
    setAnimPhase('expanding_content');
    const t1 = setTimeout(() => {
      // Step 2: Container resizes from right-middle back to center (260ms)
      setAnimPhase('expanding_resize');
      const t2 = setTimeout(() => {
        // Step 3: Recipe content shows up (110ms)
        setAnimPhase('expanded');
      }, 260);
      timersRef.current.push(t2);
    }, 90);
    timersRef.current.push(t1);
  };

  // Sync external isCollapsed changes from store (e.g. TAB key / Escape key)
  useEffect(() => {
    if (isCollapsed) {
      if (
        animPhase === 'expanded' ||
        animPhase === 'expanding_content' ||
        animPhase === 'expanding_resize'
      ) {
        handleTriggerCollapse();
      }
    } else {
      if (
        animPhase === 'collapsed' ||
        animPhase === 'collapsing_content' ||
        animPhase === 'collapsing_resize'
      ) {
        handleTriggerExpand();
      }
    }
  }, [isCollapsed]);

  const isDockState =
    animPhase === 'collapsed' ||
    animPhase === 'collapsing_resize' ||
    animPhase === 'expanding_content';
  const isContentVisible = animPhase === 'expanded';
  const isPillContentVisible = animPhase === 'collapsed';

  const expandedW = 480;
  const expandedH = Math.min(540, Math.round(viewportSize.height * 0.9));
  const dockW = 88;
  const dockH = 38;

  const xExpanded = Math.max(16, Math.round((viewportSize.width - expandedW) / 2));
  const yExpanded = Math.max(16, Math.round((viewportSize.height - expandedH) / 2));

  const xDock = Math.max(16, Math.round(viewportSize.width - 16 - dockW));
  const yDock = Math.max(16, Math.round((viewportSize.height - dockH) / 2));

  return (
    <>
      {/* 
        Backdrop Overlay:
        Darkened when expanded to focus parameter tuning.
        Smoothly fades to transparent and becomes pointer-events-none when collapsing/collapsed
        so game background is 100% visible and responsive to inputs.
      */}
      <div
        className={`fixed inset-0 z-[490] select-none transition-colors duration-260 ${
          isDockState ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        style={{
          backgroundColor: isDockState ? 'transparent' : 'rgba(0, 0, 0, 0.65)',
        }}
      />

      {/* 
        Single Morphing Container executing Sequenced Step Transition:
        Interpolates smoothly between expanded center rect (480x540, 16px radius)
        and right-middle dock rect (88x38, 12px radius).
      */}
      <motion.div
        initial={false}
        animate={
          isDockState
            ? {
                x: xDock,
                y: yDock,
                width: dockW,
                height: dockH,
                borderRadius: 12,
              }
            : {
                x: xExpanded,
                y: yExpanded,
                width: expandedW,
                height: expandedH,
                borderRadius: 16,
              }
        }
        transition={{
          duration: 0.28,
          ease: [0.2, 0.8, 0.25, 1],
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
        }}
        className={`select-none z-[500] transition-shadow overflow-hidden pointer-events-auto ${
          isDockState
            ? isLight
              ? 'border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_0_16px_rgba(0,0,0,0.15)] cursor-pointer'
              : 'border border-neutral-700 bg-neutral-900 hover:bg-neutral-850 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_18px_rgba(255,255,255,0.08)] cursor-pointer'
            : isLight
            ? 'border border-neutral-300 bg-white text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_0_24px_rgba(0,0,0,0.16),0_0_48px_rgba(0,0,0,0.10)]'
            : 'border border-neutral-700 bg-neutral-900 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85),0_0_35px_rgba(255,255,255,0.08)]'
        }`}
        onClick={isDockState ? () => setLivePreviewCollapsed(false) : undefined}
        onMouseEnter={() => isDockState && setIsPillHovered(true)}
        onMouseLeave={() => setIsPillHovered(false)}
      >
        {/* Phase 1 & 3: Content inside Expanded Container (Unmounted when in dock state to fully decouple) */}
        {!isDockState && (
          <div
            className={`transition-opacity duration-110 w-full h-full overflow-hidden flex flex-col ${
              isContentVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isContentVisible && children}
          </div>
        )}

        {/* Collapsed Pill Content: '<' | TAB (Strictly centered inside container, decoupled from expanded content) */}
        {isDockState && (
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center gap-2 px-2.5 transition-opacity duration-110 ${
              isPillContentVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <motion.div
              animate={{ x: isPillHovered ? -2.5 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className={`flex items-center justify-center shrink-0 ${
                isLight ? 'text-neutral-900' : 'text-neutral-100'
              }`}
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            </motion.div>

            <div className={`h-3.5 w-px ${isLight ? 'bg-neutral-200' : 'bg-neutral-700'}`} />

            <KeycapBadge shortcut="TAB" size="sm" isLight={isLight} />
          </div>
        )}
      </motion.div>

      {/* Top inspector slot */}
      {!isDockState && inspectorSlot}
    </>
  );
};
