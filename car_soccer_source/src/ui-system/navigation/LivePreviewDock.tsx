import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { UI_EASING } from '../tokens/easing';

export interface LivePreviewDockProps {
  isLight?: boolean;
  isCollapsed: boolean;
  onExpand: () => void;
  className?: string;
  /** Positioning mode: inside container (absolute, default) or whole window (fixed) */
  absolute?: boolean;
}

/**
 * LivePreviewDock
 * Sleek minimal dock pill placed on the right-middle edge of the stage container:
 * - Left: '<' chevron icon (optical leftward nudge on hover)
 * - Middle: vertical divider line
 * - Right: KeycapBadge displaying 'TAB'
 * - Clean tactile Apple spring motion
 * - Ambient 4-sided uniform out-glow with subtle perimeter border (no title)
 */
export const LivePreviewDock: React.FC<LivePreviewDockProps> = ({
  isLight = false,
  isCollapsed,
  onExpand,
  className = '',
  absolute = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <AnimatePresence>
      {isCollapsed && (
        <motion.div
          key="live-preview-dock"
          initial={{ opacity: 0, scale: 0.92, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.92, x: 20 }}
          transition={UI_EASING.spring.tactile}
          className={`${
            absolute
              ? 'absolute top-1/2 -translate-y-1/2 right-3'
              : 'fixed top-1/2 -translate-y-1/2 right-4'
          } z-30 pointer-events-auto flex items-center select-none ${className}`}
        >
          <button
            type="button"
            onClick={onExpand}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="展开 Live Preview 面板 (TAB)"
            className={`group flex items-center gap-2 py-1.5 px-3 rounded-xl border cursor-pointer select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              isLight
                ? 'bg-white/95 hover:bg-white text-neutral-900 border-neutral-300 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_0_16px_rgba(0,0,0,0.15)]'
                : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-100 border-neutral-700 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_18px_rgba(255,255,255,0.08)]'
            }`}
          >
            {/* Animated Chevron: shifts leftward on hover */}
            <motion.div
              animate={{ x: isHovered ? -2.5 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className={`flex items-center justify-center shrink-0 ${
                isLight ? 'text-neutral-900' : 'text-neutral-100'
              }`}
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            </motion.div>

            {/* Vertical Divider */}
            <div className={`h-3.5 w-px ${isLight ? 'bg-neutral-200' : 'bg-neutral-700'}`} />

            {/* Keycap Badge */}
            <KeycapBadge shortcut="TAB" size="sm" isLight={isLight} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
