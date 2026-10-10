import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { MorphContainerContext } from './transitions';

export interface MorphingShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: number; // target width in px
  height?: number; // target height in px
  currentKey?: string;
  children: React.ReactNode;
  isLight?: boolean;
  onBack?: () => void;
  isLayer1?: boolean;
  isDockState?: boolean;
  isContentVisible?: boolean;
  isPillContentVisible?: boolean;
  onExpandDock?: () => void;
  isShaking?: boolean;
  backdropDuration?: number;
  inspectorSlot?: React.ReactNode;
  className?: string;
}

/**
 * MorphingShell
 * Single-Container Decoupled Stage Architecture referencing UIStorybook commit 108dde1.
 *
 * Core architectural principles:
 * 1. Absolute geometric coordinate projection:
 *    Interpolates (x, y, width, height, borderRadius) directly without Framer Motion FLIP layout scale,
 *    completely eliminating scale distortions and jitter ("高度抽动，宽度抽动").
 * 2. Unified Stage Container:
 *    Standard menus and Live Preview share the exact same physical container.
 *    On Live Preview collapse, the container glides seamlessly to the right screen edge as a dock pill.
 * 3. Apple Sheet Shake Wrapper:
 *    Isolates shake translation to an outer transient wrapper with 360ms auto-reset,
 *    never remounting the container or resetting inner tab/form states.
 * 4. Transparent backdrop during Live Preview dock:
 *    Allows full input penetration to the 3D car soccer simulation.
 */
export const MorphingShell: React.FC<MorphingShellProps> = ({
  open,
  onOpenChange,
  width = 460,
  height,
  currentKey = 'default',
  children,
  isLight = false,
  onBack,
  isLayer1 = false,
  isDockState = false,
  isContentVisible = true,
  isPillContentVisible = false,
  onExpandDock,
  isShaking = false,
  backdropDuration = 250,
  inspectorSlot,
  className = '',
}) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isPillHovered, setIsPillHovered] = useState(false);

  // Measure window viewport dimensions
  const [stageSize, setStageSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Geometry calculations
  const dockW = 88;
  const dockH = 38;
  const expandedW = width;
  const expandedH = height || (isLayer1 ? 510 : 540);

  const xExpanded = Math.max(16, Math.round((stageSize.width - expandedW) / 2));
  const yExpanded = Math.max(16, Math.round((stageSize.height - expandedH) / 2));

  const xDock = Math.max(16, Math.round(stageSize.width - 16 - dockW));
  const yDock = Math.max(16, Math.round((stageSize.height - dockH) / 2));

  const targetX = isDockState ? xDock : xExpanded;
  const targetY = isDockState ? yDock : yExpanded;
  const targetW = isDockState ? dockW : expandedW;
  const targetH = isDockState ? dockH : expandedH;
  const targetRadius = isDockState ? 12 : 16;

  // If not open and not docked, do not render modal shell
  if (!open && !isDockState) {
    return null;
  }

  return (
    <>
      {/* 1. Backdrop Dimming Mask (Transparent for Layer 1 or Dock State) */}
      <div
        className="fixed inset-0 pointer-events-none backdrop-blur-none z-10"
        style={{
          backgroundColor:
            isLayer1 || isDockState ? 'transparent' : 'rgba(0, 0, 0, 0.65)',
          transition: `background-color ${backdropDuration}ms cubic-bezier(0.2, 0.8, 0.25, 1)`,
        }}
      />

      {/* 2. Layer 1 Click-outside Dismiss Barrier */}
      {isLayer1 && !isDockState && (
        <div
          className="fixed inset-0 z-20 pointer-events-auto cursor-pointer"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* 
        3. Outer Apple Sheet Shake Wrapper:
        Isolates shake translation without remounting or resetting inner container state.
      */}
      <motion.div
        key="decoupled-menu-stage-wrapper"
        animate={isShaking ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="fixed inset-0 pointer-events-none z-30"
      >
        <MorphContainerContext.Provider value={true}>
          <motion.div
            ref={shellRef}
            data-ui-element="menu-shell"
            data-morph-container="true"
            data-panel="container"
            initial={false}
            animate={{
              x: targetX,
              y: targetY,
              width: targetW,
              height: targetH,
              borderRadius: targetRadius,
              opacity: 1,
            }}
            transition={{
              x: { duration: 0.28, ease: [0.2, 0.8, 0.25, 1] },
              y: { duration: 0.28, ease: [0.2, 0.8, 0.25, 1] },
              width: { duration: 0.28, ease: [0.2, 0.8, 0.25, 1] },
              height: { duration: 0.28, ease: [0.2, 0.8, 0.25, 1] },
              borderRadius: { duration: 0.28, ease: [0.2, 0.8, 0.25, 1] },
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
            }}
            className={`pointer-events-auto select-none transition-shadow overflow-hidden flex flex-col ${
              isDockState
                ? isLight
                  ? 'border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_0_16px_rgba(0,0,0,0.15)] cursor-pointer'
                  : 'border border-neutral-700 bg-neutral-900 hover:bg-neutral-850 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_18px_rgba(255,255,255,0.08)] cursor-pointer'
                : isLight
                ? 'border border-neutral-300/80 bg-neutral-50/98 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_0_24px_rgba(0,0,0,0.16),0_0_48px_rgba(0,0,0,0.10)]'
                : 'border border-neutral-700/60 bg-neutral-900/98 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85),0_0_35px_rgba(255,255,255,0.08)]'
            } ${className}`}
            onClick={isDockState ? onExpandDock : undefined}
            onMouseEnter={() => isDockState && setIsPillHovered(true)}
            onMouseLeave={() => setIsPillHovered(false)}
          >
            {/* Mode A: Collapsed Live Preview Dock Pill */}
            {isDockState ? (
              <div
                className={`w-full h-full flex items-center justify-between px-3 cursor-pointer select-none transition-opacity duration-150 ${
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
            ) : (
              /* Mode B: Expanded Menu Content */
              <div
                className={`w-full h-full flex flex-col transition-opacity ${
                  isContentVisible
                    ? 'opacity-100 pointer-events-auto duration-150'
                    : 'opacity-0 pointer-events-none duration-100'
                }`}
              >
                <motion.div
                  key={currentKey}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.25, 1] }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  {children}
                </motion.div>
              </div>
            )}
          </motion.div>
        </MorphContainerContext.Provider>
      </motion.div>

      {/* Top inspector slot */}
      {!isDockState && inspectorSlot}
    </>
  );
};
