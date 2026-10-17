import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellDot, Layers } from 'lucide-react';
import {
  QuickNotificationDrawer,
  MONO_FONT_STACK,
} from '../primitives/QuickNotification';
import {
  useQuickNotificationStore,
  QuickNotificationItem,
} from '../tokens/quickNotificationStore';

/**
 * Sequenced lifecycle states for the Notification Icon UI:
 * - 'hidden': completely unmounted
 * - 'spawning': generation animation in progress
 * - 'visible': idle & interactive
 * - 'exiting_window': Step 1: active or stack drawer is collapsing
 * - 'exiting_bubble': Step 2: counter bubble is shrinking/fading
 * - 'exiting_bell': Step 3a: bell icon is fading/shrinking
 * - 'exiting_container': Step 3b: 40x40 container is shrinking to center 0x0
 */
export type NotificationIconLifecycle =
  | 'hidden'
  | 'spawning'
  | 'visible'
  | 'exiting_window'
  | 'exiting_bubble'
  | 'exiting_bell'
  | 'exiting_container';

export interface QuickNotificationSystemProps {
  isLight?: boolean;
  className?: string;
  absolute?: boolean;
  /**
   * Optional Slot 1 (Far Right) custom content (e.g. FloatingStackIcon, user avatar, custom utility button):
   * - undefined / null / false: Nothing is rendered in Slot 1. Zero empty spacers or redundant DOM.
   * - true: Renders fallback stack icon demo placeholder (40px).
   * - React.ReactNode: Custom component rendered to the right of the notification icon.
   * Defaults to undefined.
   */
  slotRight?: React.ReactNode | boolean;
  /**
   * Controlled active notification. If provided, overrides store.activeNotification.
   */
  activeNotification?: QuickNotificationItem | null;
  /**
   * Controlled ongoing background notification. If provided, overrides store.activeOngoingTask.
   */
  ongoingNotification?: QuickNotificationItem | null;
  /**
   * Optional live preview draft (e.g. from control panel). Takes precedence over activeNotification.
   */
  previewNotification?: QuickNotificationItem | null;
  /**
   * Controlled unread stack. If provided, overrides store.unreadStack.
   */
  unreadStack?: QuickNotificationItem[];
  /**
   * Controlled unread stack tray open/close state. If provided, overrides store.isStackOpen.
   */
  isStackOpen?: boolean;
  /**
   * Optional external handlers for controlled mode
   */
  onAction?: () => void;
  onCollapse?: () => void;
  onIgnore?: () => void;
  onResolveFromStack?: (id: string) => void;
  onDismissFromStack?: (id: string) => void;
  onToggleStack?: () => void;
  onStackOpenChange?: (open: boolean) => void;
  /**
   * Observer callback for UI presentation lifecycle changes
   */
  onLifecycleChange?: (lifecycle: NotificationIconLifecycle) => void;
}

export const QuickNotificationSystem: React.FC<QuickNotificationSystemProps> = ({
  isLight = false,
  className = '',
  absolute = true,
  slotRight,
  activeNotification: controlledActive,
  ongoingNotification: controlledOngoing,
  previewNotification,
  unreadStack: controlledUnread,
  isStackOpen: controlledIsStackOpen,
  onAction,
  onCollapse,
  onIgnore,
  onResolveFromStack,
  onDismissFromStack,
  onToggleStack,
  onStackOpenChange,
  onLifecycleChange,
}) => {
  const store = useQuickNotificationStore();

  // 1. High priority: User interactive notification (temporary or persistent)
  const effectiveUserActive =
    previewNotification ??
    (controlledActive !== undefined ? controlledActive : store.activeNotification);

  // 2. Low priority: Background ongoing task (lazy-loading, background sync, non-dismissible)
  const effectiveOngoing =
    controlledOngoing !== undefined ? controlledOngoing : store.activeOngoingTask;

  // Preemption hierarchy: User active notification covers/supersedes ongoing notification!
  // When user active finishes or is collapsed/ignored, ongoing notification automatically restores!
  const effectiveActive = effectiveUserActive ?? effectiveOngoing;

  const effectiveUnread =
    controlledUnread !== undefined
      ? controlledUnread
      : [...store.preemptedPersistentStack, ...store.unreadStack];

  const totalCount = (effectiveActive ? 1 : 0) + effectiveUnread.length;

  // Local state fallback for controlled mode unread stack opening
  const [localStackOpen, setLocalStackOpen] = useState(false);
  const effectiveIsStackOpen =
    controlledIsStackOpen !== undefined
      ? controlledIsStackOpen
      : controlledUnread !== undefined
      ? localStackOpen
      : store.isStackOpen;

  const handleToggleStack = () => {
    if (onToggleStack) {
      onToggleStack();
    } else if (onStackOpenChange) {
      onStackOpenChange(!effectiveIsStackOpen);
    } else if (controlledUnread !== undefined) {
      setLocalStackOpen((prev) => !prev);
    } else {
      store.toggleStack();
    }
  };

  // Internal presentation lifecycle state machine
  const [lifecycle, setLifecycle] = useState<NotificationIconLifecycle>(() =>
    totalCount > 0 ? 'visible' : 'hidden'
  );

  // Store timers in ref so they are cleaned up on unmount
  const timersRef = useRef<any[]>([]);
  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const prevCountRef = useRef(totalCount);
  const prevUnreadRef = useRef(effectiveUnread.length);

  // Notify external observers when lifecycle changes
  useEffect(() => {
    onLifecycleChange?.(lifecycle);
  }, [lifecycle, onLifecycleChange]);

  // Manage UI presentation transitions purely within the view layer
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = totalCount;
    prevUnreadRef.current = effectiveUnread.length;

    // Transition 1: From 0 notifications to 1+ notifications -> Spawn icon
    if (prevCount === 0 && totalCount > 0) {
      clearTimers();
      if (lifecycle === 'hidden' || lifecycle.startsWith('exiting')) {
        setLifecycle('spawning');
        const t = setTimeout(() => {
          setLifecycle('visible');
        }, 260);
        timersRef.current.push(t);
      } else {
        setLifecycle('visible');
      }
      return;
    }

    // Transition 2: From 1+ notifications to 0 notifications -> Run sequenced reverse exit
    if (prevCount > 0 && totalCount === 0) {
      clearTimers();
      // Step 1: Active or stacked drawer window finishes collapsing (260ms)
      setLifecycle('exiting_window');

      const t1 = setTimeout(() => {
        // Step 2: Bell icon fades and scales down (140ms)
        setLifecycle('exiting_bell');

        const t2 = setTimeout(() => {
          // Step 3: Container shrinks to 0x0 at center (220ms)
          setLifecycle('exiting_container');

          const t3 = setTimeout(() => {
            setLifecycle('hidden');
          }, 220);
          timersRef.current.push(t3);
        }, 140);
        timersRef.current.push(t2);
      }, 260);
      timersRef.current.push(t1);
      return;
    }

    // If notifications are active and not in exit/spawn, ensure visible
    if (totalCount > 0 && lifecycle !== 'spawning' && !lifecycle.startsWith('exiting')) {
      setLifecycle('visible');
    }
  }, [totalCount, effectiveUnread.length, lifecycle]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => clearTimers();
  }, []);

  const isIconMounted = lifecycle !== 'hidden';
  const isContainerShrunk = lifecycle === 'exiting_container';
  const isBellFaded = lifecycle === 'exiting_bell' || lifecycle === 'exiting_container';
  const isBubbleVisible = effectiveUnread.length > 0;

  const hasSlotRight = Boolean(slotRight);

  const defaultRightStyle = hasSlotRight
    ? (absolute ? '1rem' : 'calc(1.5rem + var(--ui-safe-margin-x, 0px))')
    : (absolute ? 'calc(1rem + 2.5rem + 0.625rem)' : 'calc(1.5rem + 2.5rem + 0.625rem + var(--ui-safe-margin-x, 0px))');
  const defaultTopStyle = absolute ? '1rem' : 'calc(1rem + var(--ui-safe-margin-y, 0px))';

  return (
    <div
      className={`${
        absolute ? 'absolute' : 'fixed'
      } z-[900] select-none flex flex-col items-end pointer-events-auto ${className}`}
      style={{
        top: defaultTopStyle,
        right: defaultRightStyle,
      }}
    >
      {/* ──────────────────────────────────────────────────────────────────
          Top Bar Cluster:
          [ Active Drawer (pulling out to the left) ]
          [ Notification Icon (Slot 2) ]
          [ Gap 10px (only when slotRight is present) ]
          [ Slot 1 (Far Right - only rendered when slotRight is provided) ]
         ────────────────────────────────────────────────────────────────── */}
      <div className="h-10 flex items-center gap-2.5 relative">
        {/* Active Notification Drawer (Appears only when effectiveActive is present) */}
        <AnimatePresence mode="wait">
          {effectiveActive && (
            <motion.div
              key={`active-drawer-${effectiveActive.id}`}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{
                duration: 0.26,
                ease: [0.2, 0.8, 0.25, 1],
              }}
              style={{ overflow: 'hidden' }}
              className="flex items-center justify-end py-3 px-1 -my-3 -mx-1"
            >
              <motion.div
                initial={{ x: 60, opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 60, opacity: 0 }}
                transition={{
                  duration: 0.26,
                  ease: [0.2, 0.8, 0.25, 1],
                }}
              >
                <QuickNotificationDrawer
                  id={effectiveActive.id}
                  content={effectiveActive.content}
                  tone={effectiveActive.tone}
                  icon={effectiveActive.icon}
                  type={effectiveActive.type}
                  duration={effectiveActive.duration}
                  buttons={effectiveActive.buttons}
                  actionButton={effectiveActive.actionButton}
                  remainingProgress={effectiveActive.remainingProgress}
                  progress={effectiveActive.progress}
                  isSpinningIcon={effectiveActive.isSpinningIcon}
                  isLight={isLight}
                  onAction={() => {
                    if (onAction) onAction();
                    else store.resolveActive();
                  }}
                  onCollapse={() => {
                    if (onCollapse) onCollapse();
                    else store.collapseActive();
                  }}
                  onIgnore={() => {
                    if (onIgnore) onIgnore();
                    else store.ignoreActive();
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Icon (Slot 2) */}
        {isIconMounted && (
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <AnimatePresence>
              {isIconMounted && (
                <motion.div
                  key="notification-icon-wrapper"
                  initial={
                    lifecycle === 'spawning'
                      ? { scale: 0, opacity: 0 }
                      : { scale: 1, opacity: 1 }
                  }
                  animate={
                    isContainerShrunk
                      ? { scale: 0, opacity: 0 }
                      : { scale: 1, opacity: 1 }
                  }
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    duration: 0.22,
                    ease: [0.2, 0.8, 0.25, 1],
                  }}
                  className="relative w-10 h-10 flex items-center justify-center"
                >
                  {/* Bell Button */}
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStack();
                    }}
                    title={
                      effectiveUnread.length > 0
                        ? `View Unread Notifications (${effectiveUnread.length})`
                        : 'Notification Center'
                    }
                    aria-label="Quick Notifications"
                    className={`relative h-10 w-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:scale-95 z-30 ${
                      isLight
                        ? 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_16px_rgba(0,0,0,0.12)]'
                        : 'bg-neutral-900 hover:bg-neutral-850 border-neutral-700 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_20px_rgba(0,0,0,0.7),0_0_28px_rgba(255,255,255,0.06)]'
                    }`}
                  >
                    <motion.div
                      initial={
                        lifecycle === 'spawning'
                          ? { opacity: 0, scale: 0.6 }
                          : { opacity: 1, scale: 1 }
                      }
                      animate={
                        isBellFaded
                          ? { opacity: 0, scale: 0.6 }
                          : { opacity: 1, scale: 1 }
                      }
                      transition={{
                        duration: 0.14,
                        ease: 'easeOut',
                        delay: lifecycle === 'spawning' ? 0.08 : 0,
                      }}
                      className="flex items-center justify-center"
                    >
                      <BellDot className="h-5 w-5 text-neutral-900 dark:text-neutral-100" />
                    </motion.div>
                  </motion.button>

                  {/* Top-Right Unread Counter Bubble */}
                  <AnimatePresence>
                    {isBubbleVisible && (
                      <motion.div
                        key={`notif-bubble-${effectiveUnread.length}`}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.16, ease: 'easeIn' },
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        style={{ fontFamily: MONO_FONT_STACK }}
                        className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full border flex items-center justify-center font-mono font-bold text-[11px] pointer-events-none select-none z-40 ${
                          isLight
                            ? 'bg-white text-black border-black shadow-xs'
                            : 'bg-black text-white border-white shadow-xs'
                        }`}
                      >
                        {effectiveUnread.length}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Slot 1 (Far Right): Decoupled Custom Slot. Rendered ONLY when slotRight is provided */}
        {hasSlotRight && (
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            {slotRight === true ? (
              <div
                className={`h-10 w-10 flex items-center justify-center rounded-xl border select-none transition-all cursor-default ${
                  isLight
                    ? 'bg-white border-neutral-300 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_16px_rgba(0,0,0,0.12)]'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_20px_rgba(0,0,0,0.7),0_0_28px_rgba(255,255,255,0.06)]'
                }`}
                title="Slot 1 (Stack Icon)"
              >
                <Layers className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
              </div>
            ) : (
              slotRight
            )}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          Unread Notifications Dropdown Stack Tray
          Drawers pull out horizontally from right to left with zero scrollbar
         ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {effectiveIsStackOpen && effectiveUnread.length > 0 && (
          <motion.div
            key="unread-stack-tray"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className={`mt-2.5 flex flex-col items-end gap-2 z-40 max-h-[460px] overflow-y-auto overflow-x-hidden p-2 ${
              hasSlotRight ? 'pr-[50px]' : 'pr-0.5'
            } [&::-webkit-scrollbar]:hidden`}
          >
            {effectiveUnread.map((item) => (
              <div key={`stacked-row-${item.id}`} className="flex justify-end w-full">
                <motion.div
                  key={`stacked-drawer-${item.id}`}
                  layout="position"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.8, 0.25, 1] }}
                  style={{ overflow: 'hidden' }}
                  className="flex justify-end py-3 px-1 -my-3 -mx-1"
                >
                  <motion.div
                    initial={{ x: 60, opacity: 0.6 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 60, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.2, 0.8, 0.25, 1] }}
                  >
                    <QuickNotificationDrawer
                      id={item.id}
                      content={item.content}
                      tone={item.tone}
                      icon={item.icon}
                      type={item.type}
                      buttons={item.buttons}
                      actionButton={item.actionButton}
                      isStackedItem={true}
                      isLight={isLight}
                      onAction={() => {
                        if (onResolveFromStack) onResolveFromStack(item.id);
                        else store.resolveFromStack(item.id);
                      }}
                      onIgnore={() => {
                        if (onDismissFromStack) onDismissFromStack(item.id);
                        else store.dismissFromStack(item.id);
                      }}
                    />
                  </motion.div>
                </motion.div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
