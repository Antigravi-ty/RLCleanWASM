import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { FlyingGhostState } from '../tokens/floatingStore';
import { getFloatingWindowIcon } from './FloatingWindowIcon';

export interface FlyingGhostElementProps {
  flight: FlyingGhostState;
  isLight: boolean;
  onComplete: () => void;
}

export const FlyingGhostElement: React.FC<FlyingGhostElementProps> = ({ flight, isLight, onComplete }) => {
  const [isLanded, setIsLanded] = useState(false);

  useEffect(() => {
    if (flight.targetHadStack) {
      const timer = setTimeout(() => {
        onComplete();
      }, 260);
      return () => clearTimeout(timer);
    } else {
      const landTimer = setTimeout(() => {
        setIsLanded(true);
        const finishTimer = setTimeout(() => {
          onComplete();
        }, 120);
        return () => clearTimeout(finishTimer);
      }, 260);
      return () => clearTimeout(landTimer);
    }
  }, [flight.targetHadStack, onComplete]);

  if (flight.targetHadStack) {
    return (
      <motion.div
        key={`flying-absorb-${flight.id}`}
        initial={{
          x: flight.startX,
          y: flight.startY,
          width: flight.startW,
          height: flight.startH,
          borderRadius: 8,
          opacity: 1,
          scale: 1,
        }}
        animate={{
          x: flight.destX,
          y: flight.destY,
          width: 40,
          height: 40,
          borderRadius: 12,
          opacity: [1, 1, 0.8, 0],
          scale: [1, 1.05, 0.95, 0.85],
        }}
        transition={{
          duration: 0.26,
          ease: [0.2, 0.8, 0.25, 1],
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 45,
          pointerEvents: 'none',
        }}
        className={`border backdrop-blur-md overflow-hidden select-none flex items-center justify-center ${
          isLight
            ? 'bg-white/95 border-neutral-300 text-neutral-900 shadow-[0_4px_24px_rgba(0,0,0,0.18)]'
            : 'bg-neutral-850/95 border-neutral-700 text-neutral-100 shadow-[0_4px_24px_rgba(0,0,0,0.7)]'
        }`}
      >
        {getFloatingWindowIcon(flight.preset.category, flight.preset.id)}
      </motion.div>
    );
  }

  return (
    <motion.div
      key={`flying-morph-${flight.id}`}
      initial={{
        x: flight.startX,
        y: flight.startY,
        width: flight.startW,
        height: flight.startH,
        borderRadius: 8,
        opacity: 1,
        scale: 1,
      }}
      animate={{
        x: flight.destX,
        y: flight.destY,
        width: 40,
        height: 40,
        borderRadius: 12,
        opacity: 1,
        scale: 1,
      }}
      transition={{
        duration: 0.26,
        ease: [0.2, 0.8, 0.25, 1],
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 45,
        pointerEvents: 'none',
      }}
      className={`border backdrop-blur-md overflow-hidden select-none flex items-center justify-center ${
        isLight
          ? 'bg-white border-neutral-300 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_16px_rgba(0,0,0,0.12)]'
          : 'bg-neutral-900 border-neutral-700 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_20px_rgba(0,0,0,0.7),0_0_28px_rgba(255,255,255,0.06)]'
      }`}
    >
      {!isLanded ? (
        <motion.div
          key="ghost-flight-icon"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center justify-center"
        >
          {getFloatingWindowIcon(flight.preset.category, flight.preset.id)}
        </motion.div>
      ) : (
        <motion.div
          key="ghost-landed-icon"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          <Layers className="h-5 w-5 text-neutral-900 dark:text-neutral-100" />
        </motion.div>
      )}

      {isLanded && (
        <motion.div
          key="ghost-landed-bubble"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full border flex items-center justify-center font-mono font-bold text-[11px] pointer-events-none select-none ${
            isLight
              ? 'bg-white text-black border-black shadow-xs'
              : 'bg-black text-white border-white shadow-xs'
          }`}
        >
          1
        </motion.div>
      )}
    </motion.div>
  );
};

export interface RestoringWindowGhostProps {
  restoringWindow: {
    id: string;
    startRect: { x: number; y: number; width: number; height: number };
    targetRect: { x: number; y: number; width: number; height: number };
  };
  isLight: boolean;
  targetOpacity: number;
}

export const RestoringWindowGhost: React.FC<RestoringWindowGhostProps> = ({
  restoringWindow,
  isLight,
  targetOpacity,
}) => {
  return (
    <motion.div
      key={`restoring-ghost-${restoringWindow.id}`}
      initial={{
        x: restoringWindow.startRect.x,
        y: restoringWindow.startRect.y,
        width: restoringWindow.startRect.width,
        height: restoringWindow.startRect.height,
        borderRadius: 12,
        opacity: 1,
      }}
      animate={{
        x: restoringWindow.targetRect.x,
        y: restoringWindow.targetRect.y,
        width: restoringWindow.targetRect.width,
        height: restoringWindow.targetRect.height,
        borderRadius: 16,
        opacity: targetOpacity,
      }}
      transition={{
        duration: 0.24,
        ease: [0.2, 0.8, 0.25, 1],
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 45,
        pointerEvents: 'none',
      }}
      className={`border backdrop-blur-md overflow-hidden select-none ${
        isLight
          ? 'bg-white/95 border-neutral-300 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_0_24px_rgba(0,0,0,0.16),0_0_48px_rgba(0,0,0,0.10)]'
          : 'bg-neutral-900/95 border-neutral-700 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85),0_0_35px_rgba(255,255,255,0.08)]'
      }`}
    />
  );
};
