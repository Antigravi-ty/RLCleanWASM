import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X } from 'lucide-react';
import { useFloatingStore, FloatingWindowItem } from '../tokens/floatingStore';
import { UI_EASING } from '../tokens/easing';
import { dialogue } from '../primitives/Dialogue';
import { OPACITY_MANAGER_PRESET, DEV_TEST_LAB_PRESET } from '../tokens/floatingPresets';
import { useUIStore } from '../core/store';
import { getFloatingWindowIcon } from './FloatingWindowIcon';
import { FlyingGhostElement, RestoringWindowGhost } from './FloatingStackGhostPortals';

export interface FloatingStackIconProps {
  isLight?: boolean;
  className?: string;
  absolute?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  isMenuOpen?: boolean;
  blockedTooltipText?: string;
  onBlockedClick?: () => void;
}

const getWindowIcon = (category?: string, id?: string) => getFloatingWindowIcon(category, id);

export const FloatingStackIcon: React.FC<FloatingStackIconProps> = ({
  isLight = false,
  className = '',
  absolute = true,
  containerRef,
  isMenuOpen = false,
  blockedTooltipText,
  onBlockedClick,
}) => {
  const {
    windows,
    isStackTrayOpen,
    isStackDismissed,
    minimizedCount,
    activeFlight,
    completeFlight,
    toggleStackTray,
    setStackTrayOpen,
    restoreWindow,
    closeWindow,
    dismissStack,
    opacity,
  } = useFloatingStore();

  const targetOpacity = Math.max(0.01, Math.min(1, (opacity ?? 30) / 100));

  const [isStackHovered, setIsStackHovered] = useState(false);
  const [hoveredWindowId, setHoveredWindowId] = useState<string | null>(null);
  const [bounceTrigger, setBounceTrigger] = useState(0);

  const [restoringWindow, setRestoringWindow] = useState<{
    id: string;
    startRect: { x: number; y: number; width: number; height: number };
    targetRect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  useEffect(() => {
    if (isMenuOpen && isStackTrayOpen) {
      setStackTrayOpen(false);
    }
  }, [isMenuOpen, isStackTrayOpen, setStackTrayOpen]);

  const isStackVisible = !(isStackDismissed && minimizedCount === 0);

  if (!isStackVisible && !activeFlight) {
    return null;
  }

  if (windows.length === 0 && isStackDismissed && !activeFlight) {
    return null;
  }

  const minimizedWindows = windows.filter((w) => w.isMinimized);
  const portalContainer =
    containerRef?.current ||
    (typeof document !== 'undefined'
      ? document.getElementById('game-ui-viewport-host') || document.body
      : null);

  const handleRestoreClick = (win: FloatingWindowItem, e: React.MouseEvent<HTMLButtonElement>) => {
    const btnEl = e.currentTarget;
    const containerEl = portalContainer;
    if (!containerEl) {
      restoreWindow(win.id);
      return;
    }

    const bRect = btnEl.getBoundingClientRect();
    const cRect = containerEl.getBoundingClientRect();

    const startX = Math.round(bRect.left - cRect.left);
    const startY = Math.round(bRect.top - cRect.top);
    const startW = Math.round(bRect.width);
    const startH = Math.round(bRect.height);

    const targetX = win.position?.x ?? 40;
    const targetY = win.position?.y ?? 40;
    const targetW = win.width ?? 440;
    const targetH = win.height ?? 300;

    setRestoringWindow({
      id: win.id,
      startRect: { x: startX, y: startY, width: startW, height: startH },
      targetRect: { x: targetX, y: targetY, width: targetW, height: targetH },
    });

    setTimeout(() => {
      restoreWindow(win.id);
      setRestoringWindow(null);
    }, 240);
  };

  return (
    <>
      {isStackVisible && (
        <div
          data-ui-element="stack-icon-wrapper"
          className={`${
            absolute ? 'absolute' : 'fixed'
          } z-[60] pointer-events-auto select-none flex flex-col items-end ${className}`}
          style={{
            top: absolute ? '1rem' : 'calc(1rem + var(--ui-safe-margin-y, 0px))',
            right: absolute ? '1rem' : 'calc(1.5rem + var(--ui-safe-margin-x, 0px))',
          }}
        >
          <div
            className="relative"
            onMouseEnter={() => setIsStackHovered(true)}
            onMouseLeave={() => setIsStackHovered(false)}
          >
            <motion.button
              data-ui-element="stack-icon"
              key={`stack-btn-${bounceTrigger}`}
              animate={bounceTrigger > 0 ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.25, 1] }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isMenuOpen) {
                  onBlockedClick?.();
                  return;
                }
                toggleStackTray();
              }}
              aria-label="Floating Diagnostic Window Stack"
              className={`relative h-10 w-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:scale-95 opacity-100 ${
                isLight
                  ? 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_16px_rgba(0,0,0,0.12)]'
                  : 'bg-neutral-900 hover:bg-neutral-850 border-neutral-700 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_20px_rgba(0,0,0,0.7),0_0_28px_rgba(255,255,255,0.06)]'
              }`}
            >
              <Layers className="h-5 w-5 text-neutral-900 dark:text-neutral-100" />
            </motion.button>

            <AnimatePresence>
              {minimizedCount > 0 && (
                <motion.div
                  key={`stack-bubble-${minimizedCount}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.25, 1], opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full border flex items-center justify-center font-mono font-bold text-[11px] pointer-events-none select-none ${
                    isLight
                      ? 'bg-white text-black border-black shadow-xs'
                      : 'bg-black text-white border-white shadow-xs'
                  }`}
                >
                  {minimizedCount}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {minimizedCount === 0 && isStackHovered && !isMenuOpen && (
                <motion.button
                  key="dismiss-stack-btn"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.25, 1], opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissStack();
                  }}
                  title="Close Stack Icon"
                  className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full border border-red-600 bg-red-500 text-white flex items-center justify-center shadow-xs cursor-pointer z-10 outline-none select-none"
                >
                  <X className="h-3 w-3 stroke-[3]" />
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isMenuOpen && isStackHovered && (
                <motion.div
                  key="blocked-menu-tooltip"
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute top-full mt-2.5 right-0 px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap shadow-xl pointer-events-none select-none z-50 flex items-center gap-1.5 font-medium backdrop-blur-md ${
                    isLight
                      ? 'bg-neutral-900/95 text-neutral-100 border-neutral-700 shadow-neutral-900/25'
                      : 'bg-neutral-850/95 text-neutral-100 border-neutral-650 shadow-black/60'
                  }`}
                >
                  <span className="text-amber-400 text-xs shrink-0">⚠️</span>
                  <span>{blockedTooltipText || 'Please close settings window first'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isStackTrayOpen && !isMenuOpen && (
              <motion.div
                key="stack-tray-list"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={UI_EASING.spring.tactile}
                className="mt-2 flex flex-col items-end gap-1.5 z-50 max-h-80 overflow-y-auto pl-12 pr-1 py-1"
              >
                {minimizedWindows.length === 0 ? null : (
                  minimizedWindows.map((win) => {
                    if (restoringWindow && win.id !== restoringWindow.id) {
                      return null;
                    }

                    const isThisItemRestoring = restoringWindow?.id === win.id;
                    const isHovered = hoveredWindowId === win.id && !restoringWindow;

                    return (
                      <div
                        key={win.id}
                        onMouseEnter={() => !restoringWindow && setHoveredWindowId(win.id)}
                        onMouseLeave={() => setHoveredWindowId(null)}
                        className={`relative flex items-center justify-end w-full pl-10 ${
                          isThisItemRestoring ? 'opacity-0 pointer-events-none' : ''
                        }`}
                        style={{ minHeight: '34px' }}
                      >
                        <motion.button
                          type="button"
                          onClick={(e) => handleRestoreClick(win, e)}
                          animate={{ x: isHovered ? -34 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none backdrop-blur-md transition-colors ${
                            isLight
                              ? 'bg-white/95 hover:bg-neutral-50 border-neutral-300 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_16px_rgba(0,0,0,0.12)]'
                              : 'bg-neutral-900/95 hover:bg-neutral-850 border-neutral-700 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(0,0,0,0.7),0_0_24px_rgba(255,255,255,0.06)]'
                          }`}
                          title="Restore window"
                        >
                          {getWindowIcon(win.category, win.id)}
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {win.title}
                          </span>
                        </motion.button>

                        <AnimatePresence>
                          {isHovered && (
                            <motion.button
                              type="button"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (win.id === OPACITY_MANAGER_PRESET.id || win.id === 'opacity-manager') {
                                  dialogue.show({
                                    tone: 'info',
                                    title: 'CONFIRM CLOSE',
                                    content: 'Are you sure you want to close Floating Window Opacity?\nYou can restore it at any time from Settings > Advanced.',
                                    buttons: [
                                      {
                                        label: 'Confirm',
                                        variant: 'primary',
                                        onClick: () => {
                                          closeWindow(win.id);
                                        },
                                      },
                                      {
                                        label: 'Cancel',
                                        variant: 'outline',
                                      },
                                    ],
                                  });
                                  return;
                                }
                                if (win.id === DEV_TEST_LAB_PRESET.id || win.id === 'dev-test-lab-controller') {
                                  closeWindow(win.id);
                                  const uiState = useUIStore.getState();
                                  if (uiState.matchMode === 'dev-test-lab') {
                                    uiState.bridge.onReturnToFreeplay?.();
                                  }
                                  return;
                                }
                                closeWindow(win.id);
                              }}
                              title="Close window"
                              className="absolute right-0 h-6 w-6 rounded-md bg-transparent hover:bg-red-500/15 text-red-500 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                              <X className="h-3.5 w-3.5 stroke-[2.5]" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeFlight && portalContainer && createPortal(
        <FlyingGhostElement
          flight={activeFlight}
          isLight={isLight}
          onComplete={() => {
            if (activeFlight.targetHadStack) {
              setBounceTrigger((k) => k + 1);
            }
            completeFlight();
          }}
        />,
        portalContainer
      )}

      {restoringWindow && portalContainer && createPortal(
        <RestoringWindowGhost
          restoringWindow={restoringWindow}
          isLight={isLight}
          targetOpacity={targetOpacity}
        />,
        portalContainer
      )}
    </>
  );
};
