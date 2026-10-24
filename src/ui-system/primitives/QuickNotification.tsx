import React from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { CircleSlash, Bell, Check, ThumbsDown, RotateCcw } from 'lucide-react';

export type QuickNotificationGlowLevel = 'none' | 'info' | 'warning' | 'orange' | 'error';
export type QuickNotificationType = 'temporary' | 'persistent' | 'ongoing' | 'background';

export type QuickNotificationButtonVariant =
  | 'green'   // Accept - Green
  | 'red'     // Reject - Red
  | 'amber'   // Warning / Retry - Amber
  | 'neutral' // Neutral Monochrome
  | 'sky'     // Info / Sky Blue
  | 'purple'; // Special / Purple

export type QuickNotificationButtonFormat = 'icon-only' | 'text-only' | 'icon-text';

export interface QuickNotificationButtonConfig {
  key?: string;
  label?: string;
  icon?: string | React.ReactNode;
  format?: QuickNotificationButtonFormat;
  color?: QuickNotificationButtonVariant;
  dismissOnClick?: boolean;
  onClick?: () => void;
}

export interface QuickNotificationProps {
  id?: string;
  content: React.ReactNode;
  tone?: QuickNotificationGlowLevel;
  icon?: string | React.ReactNode;
  type?: QuickNotificationType;
  duration?: number; // Duration in milliseconds for temporary
  buttons?: QuickNotificationButtonConfig[];
  /** Legacy single button support */
  actionButton?: { label: string; onClick?: () => void };
  onAction?: (btnKey?: string) => void;
  onCollapse?: () => void; // Collapse to unread stack
  onIgnore?: () => void; // Mandatory for temporary/persistent (completely dismiss without counting)
  isLight?: boolean;
  className?: string;
  remainingProgress?: number; // 0 to 1 for temporary notification progress bar
  progress?: number | 'indeterminate'; // 0 to 1 (or 0 to 100), or 'indeterminate' for ongoing/background task
  isSpinningIcon?: boolean; // optional spinning animation for leading icon
  isStackedItem?: boolean; // When rendered in the dropdown stack
}

export const MONO_FONT_STACK = "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace";

/**
 * Custom Collapse to Right Icon
 * As requested: An icon equivalent to Lucide's Upload icon rotated 90° counter-clockwise,
 * with the arrow direction flipped so it points rightwards into the right tray/bracket:
 * [->] represents "collapsing into the notification icon/stack on the right".
 */
export const CollapseToRightIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'h-3.5 w-3.5',
  size = 14,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Right tray / bracket (Upload's bottom tray rotated 90° CCW to the right side) */}
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    {/* Arrow pointing rightwards directly into the right tray (arrow opposite direction) */}
    <polyline points="11 7 16 12 11 17" />
    <line x1="3" y1="12" x2="16" y2="12" />
  </svg>
);

const toPascalCase = (str: string): string => {
  return str
    .replace(/[-_ ]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
};

export const getLucideIcon = (name: string, size = 14): React.ReactNode => {
  if (!name || typeof name !== 'string') return null;
  const pascal = toPascalCase(name.trim());
  const comp =
    (LucideIcons as Record<string, any>)[pascal] ||
    (LucideIcons as Record<string, any>)[name.trim()] ||
    (LucideIcons.icons as Record<string, any>)?.[pascal] ||
    (LucideIcons.icons as Record<string, any>)?.[name.trim()];

  if (comp && (typeof comp === 'function' || typeof comp === 'object')) {
    const IconComp = comp;
    return <IconComp size={size} className="shrink-0" />;
  }
  return <Bell size={size} className="shrink-0" />;
};

/**
 * Color palette class resolver for action buttons
 */
export const getButtonColorClass = (
  color: QuickNotificationButtonVariant = 'neutral',
  isLight = false
): string => {
  switch (color) {
    case 'green':
      return isLight
        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700/60 shadow-2xs'
        : 'bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400/40 shadow-2xs';
    case 'red':
      return isLight
        ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700/60 shadow-2xs'
        : 'bg-red-500 hover:bg-red-600 text-white border border-red-400/40 shadow-2xs';
    case 'amber':
      return isLight
        ? 'bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold border border-amber-600/50 shadow-2xs'
        : 'bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold border border-amber-400/40 shadow-2xs';
    case 'sky':
      return isLight
        ? 'bg-sky-600 hover:bg-sky-700 text-white border border-sky-700/60 shadow-2xs'
        : 'bg-sky-500 hover:bg-sky-600 text-white border border-sky-400/40 shadow-2xs';
    case 'purple':
      return isLight
        ? 'bg-purple-600 hover:bg-purple-700 text-white border border-purple-700/60 shadow-2xs'
        : 'bg-purple-500 hover:bg-purple-600 text-white border border-purple-400/40 shadow-2xs';
    case 'neutral':
    default:
      return isLight
        ? 'bg-neutral-900 hover:bg-black text-white border border-neutral-800 shadow-2xs'
        : 'bg-neutral-100 hover:bg-white text-neutral-900 font-bold border border-neutral-200 shadow-2xs';
  }
};

/**
 * Styling lookup for the 4 inner glow levels + 1 none level
 */
export const getQuickNotificationStyles = (
  tone: QuickNotificationGlowLevel,
  isLight: boolean
) => {
  switch (tone) {
    case 'error':
      return {
        containerClass: isLight
          ? 'bg-red-50/95 text-neutral-900 border-red-300/80 shadow-[inset_0_0_24px_rgba(239,68,68,0.18),0_4px_16px_rgba(239,68,68,0.12)]'
          : 'bg-neutral-900/95 text-neutral-100 border-red-600/70 shadow-[inset_0_0_28px_rgba(239,68,68,0.22),0_4px_20px_rgba(0,0,0,0.6)]',
        iconClass: isLight ? 'text-red-600' : 'text-red-400',
        progressBarClass: isLight ? 'bg-red-500' : 'bg-red-400',
      };
    case 'orange':
      return {
        containerClass: isLight
          ? 'bg-orange-50/95 text-neutral-900 border-orange-300/80 shadow-[inset_0_0_24px_rgba(249,115,22,0.18),0_4px_16px_rgba(249,115,22,0.12)]'
          : 'bg-neutral-900/95 text-neutral-100 border-orange-600/70 shadow-[inset_0_0_28px_rgba(249,115,22,0.22),0_4px_20px_rgba(0,0,0,0.6)]',
        iconClass: isLight ? 'text-orange-600' : 'text-orange-400',
        progressBarClass: isLight ? 'bg-orange-500' : 'bg-orange-400',
      };
    case 'warning':
      return {
        containerClass: isLight
          ? 'bg-yellow-50/95 text-neutral-900 border-yellow-300/80 shadow-[inset_0_0_24px_rgba(234,179,8,0.18),0_4px_16px_rgba(234,179,8,0.12)]'
          : 'bg-neutral-900/95 text-neutral-100 border-yellow-600/70 shadow-[inset_0_0_28px_rgba(234,179,8,0.22),0_4px_20px_rgba(0,0,0,0.6)]',
        iconClass: isLight ? 'text-yellow-600' : 'text-yellow-400',
        progressBarClass: isLight ? 'bg-yellow-500' : 'bg-yellow-400',
      };
    case 'info':
      return {
        containerClass: isLight
          ? 'bg-neutral-50/95 text-neutral-900 border-neutral-300/80 shadow-[inset_0_0_24px_rgba(163,163,163,0.16),0_4px_16px_rgba(0,0,0,0.06)]'
          : 'bg-neutral-900/95 text-neutral-100 border-neutral-700/80 shadow-[inset_0_0_28px_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.6)]',
        iconClass: isLight ? 'text-neutral-600' : 'text-neutral-400',
        progressBarClass: isLight ? 'bg-neutral-500' : 'bg-neutral-400',
      };
    case 'none':
    default:
      return {
        containerClass: isLight
          ? 'bg-white/95 text-neutral-900 border-neutral-300 shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
          : 'bg-neutral-900/95 text-neutral-100 border-neutral-750 shadow-[0_4px_20px_rgba(0,0,0,0.6)]',
        iconClass: isLight ? 'text-neutral-700' : 'text-neutral-300',
        progressBarClass: isLight ? 'bg-neutral-600' : 'bg-neutral-300',
      };
  }
};

/**
 * QuickNotificationDrawer
 * Presentational horizontal drawer component.
 * Features:
 * - Monospace typography (SF Mono > JetBrains Mono)
 * - Inner glow styling (5 levels including 'none')
 * - Leading icon
 * - Dynamic content container
 * - Business action buttons (supports accept, reject, custom, icon-only, icon+text)
 * - Mandatory Ignore button (gray circle-slash)
 * - Mandatory Collapse button strictly on the far-right for persistent notifications (black in light mode)
 */
export const QuickNotificationDrawer: React.FC<QuickNotificationProps> = ({
  content,
  tone = 'none',
  icon = 'bell',
  type = 'temporary',
  duration = 3000,
  buttons,
  actionButton,
  onAction,
  onCollapse,
  onIgnore,
  isLight = false,
  className = '',
  remainingProgress,
  progress,
  isSpinningIcon,
  isStackedItem = false,
}) => {
  const isOngoing = type === 'ongoing' || type === 'background';
  const styles = getQuickNotificationStyles(tone, isLight);

  const iconElement =
    typeof icon === 'string'
      ? getLucideIcon(icon, 15)
      : (icon ?? <Bell size={15} className="shrink-0" />);

  const shouldSpin =
    isSpinningIcon ??
    (isOngoing &&
      typeof icon === 'string' &&
      (icon.includes('loader') || icon.includes('refresh') || icon.includes('spin')));

  // Normalize buttons: combine buttons array and legacy actionButton
  const resolvedButtons: QuickNotificationButtonConfig[] = buttons
    ? buttons
    : actionButton
    ? [{ label: actionButton.label, onClick: actionButton.onClick, format: 'text-only', color: 'neutral' }]
    : [];

  return (
    <div
      style={{ fontFamily: MONO_FONT_STACK }}
      className={`relative h-10 px-3 rounded-xl border flex items-center gap-2.5 backdrop-blur-md select-none font-mono text-xs whitespace-nowrap overflow-hidden transition-colors ${
        styles.containerClass
      } ${className}`}
    >
      {/* 1. Leading Icon */}
      <div
        className={`flex items-center justify-center shrink-0 ${styles.iconClass} ${
          shouldSpin ? 'animate-spin' : ''
        }`}
      >
        {iconElement}
      </div>

      {/* 2. Notification Body Content */}
      <div className="flex items-center text-xs font-mono tracking-tight font-medium overflow-hidden pr-1">
        <span className="truncate">{content}</span>
      </div>

      {/* 3. Action Buttons & Controls Area */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0 pl-1">
        {/* Dynamic Business Action Buttons (Accept, Reject, Retry, etc.) */}
        {resolvedButtons.map((btn, idx) => {
          const btnFormat = btn.format || (btn.icon && btn.label ? 'icon-text' : btn.icon ? 'icon-only' : 'text-only');
          const btnColorClass = getButtonColorClass(btn.color, isLight);
          const btnIcon = typeof btn.icon === 'string' ? getLucideIcon(btn.icon, 13) : btn.icon;

          return (
            <button
              key={btn.key || `btn-${idx}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                btn.onClick?.();
                if (btn.dismissOnClick !== false) {
                  onAction?.(btn.key);
                }
              }}
              title={btn.label}
              className={`h-6 rounded-md flex items-center justify-center gap-1 font-mono text-[11px] font-semibold transition-all cursor-pointer active:scale-95 ${
                btnFormat === 'icon-only' ? 'w-6 px-0' : 'px-2'
              } ${btnColorClass}`}
            >
              {btnIcon && <span className="shrink-0">{btnIcon}</span>}
              {btnFormat !== 'icon-only' && btn.label && <span>{btn.label}</span>}
            </button>
          );
        })}

        {/* Mandatory Ignore Button for temporary & persistent notifications (NEVER shown for ongoing tasks) */}
        {!isOngoing && onIgnore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIgnore();
            }}
            title="Dismiss notification"
            aria-label="Ignore notification"
            className={`h-6 w-6 rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-90 bg-transparent ${
              isLight
                ? 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/40'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40'
            }`}
          >
            <CircleSlash className="h-3.5 w-3.5 stroke-[2.2]" />
          </button>
        )}

        {/* 
          Mandatory Collapse Button for Persistent notifications:
          STRICTLY POSITIONED ON THE VERY RIGHTMOST! (NEVER shown for ongoing tasks)
          Transparent background, emphasized dark icon (deep black in light mode, crisp white in dark mode)
        */}
        {!isOngoing && type === 'persistent' && !isStackedItem && onCollapse && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCollapse();
            }}
            title="Remind me later (collapse to stack)"
            aria-label="Collapse notification"
            className={`h-6 w-6 rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-90 bg-transparent ${
              isLight
                ? 'text-neutral-900 hover:text-black hover:bg-neutral-200/50'
                : 'text-neutral-100 hover:text-white hover:bg-neutral-800/50'
            }`}
          >
            <CollapseToRightIcon size={14} />
          </button>
        )}
      </div>

      {/* 4a. Subtle Remaining Time Progress Bar for Temporary Notifications */}
      {type === 'temporary' && remainingProgress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200/30 dark:bg-neutral-800/40 overflow-hidden pointer-events-none">
          <div
            className={`h-full transition-all duration-75 ease-linear ${styles.progressBarClass}`}
            style={{ width: `${Math.max(0, Math.min(1, remainingProgress)) * 100}%` }}
          />
        </div>
      )}

      {/* 4b. Determinate or Indeterminate Progress Bar for Ongoing / Background Notifications */}
      {isOngoing && progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200/30 dark:bg-neutral-800/40 overflow-hidden pointer-events-none">
          {progress === 'indeterminate' ? (
            <div className="relative w-full h-full overflow-hidden">
              <div
                className={`absolute inset-0 opacity-25 animate-pulse ${styles.progressBarClass}`}
              />
              <motion.div
                className={`absolute top-0 bottom-0 w-2/5 rounded-full ${styles.progressBarClass}`}
                animate={{ x: ['-100%', '300%'] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: 'easeInOut',
                }}
              />
            </div>
          ) : (
            <div
              className={`h-full transition-all duration-150 ease-out ${styles.progressBarClass}`}
              style={{
                width: `${
                  Math.max(
                    0,
                    Math.min(1, typeof progress === 'number' && progress > 1 ? progress / 100 : Number(progress) || 0)
                  ) * 100
                }%`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
