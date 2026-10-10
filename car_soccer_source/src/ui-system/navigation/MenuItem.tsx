import React, { useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { UI_SPACING, UI_RADIUS } from '../tokens';
import { KeycapBadge } from '../primitives/KeycapBadge';

export interface MenuItemProps {
  id?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  shortcut?: string;
  rightElement?: React.ReactNode;
  hasArrow?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  isLight?: boolean;
  onClick?: () => void;
  autoFocus?: boolean;
  className?: string;
}

/**
 * MenuItem
 * Implements SimpleUI standard menu item ergonomics:
 * - Touch & cursor padding: px-4 py-3 (16px horizontal, 12px vertical, min-h-[52px])
 * - Optical leading icon box (w-9 h-9, rounded-lg)
 * - Structured title & description hierarchy
 * - Keycap shortcut integration and navigation chevron
 */
export const MenuItem: React.FC<MenuItemProps> = ({
  id,
  icon,
  iconBgColor,
  iconColor,
  title,
  subtitle,
  badge,
  shortcut,
  rightElement,
  hasArrow = false,
  disabled = false,
  variant = 'secondary',
  isLight = false,
  onClick,
  autoFocus = false,
  className = '',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [autoFocus]);

  const isPrimary = variant === 'primary';

  const getVariantStyles = () => {
    if (variant === 'primary') {
      return isLight
        ? 'bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900 shadow-sm'
        : 'bg-white text-neutral-950 hover:bg-neutral-100 border-white shadow-md';
    }
    if (variant === 'danger') {
      return isLight
        ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
        : 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border-red-900/60';
    }
    // secondary (default)
    return isLight
      ? 'bg-white hover:bg-neutral-100/90 text-neutral-800 border-neutral-200/90 shadow-2xs'
      : 'bg-neutral-900/60 hover:bg-neutral-800/80 text-neutral-200 border-neutral-800/80 shadow-2xs';
  };

  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      data-ui-element="menu-item"
      data-menu-item="true"
      className={`group relative flex items-center justify-between w-full min-h-[52px] ${UI_SPACING.menu.item} ${UI_RADIUS.lg} border font-medium text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 active:scale-[0.985] cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none ${getVariantStyles()} ${className}`}
    >
      {/* Left grouping */}
      <div className={`flex items-center ${UI_SPACING.menu.iconGap} min-w-0`}>
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
              iconBgColor ||
              (isLight
                ? isPrimary
                  ? 'bg-white/20 text-white'
                  : 'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200'
                : isPrimary
                ? 'bg-neutral-900/20 text-neutral-950'
                : 'bg-neutral-800 text-neutral-200 group-hover:bg-neutral-700')
            } ${iconColor || ''}`}
          >
            {icon}
          </div>
        )}
        <div className="flex flex-col items-start leading-tight text-left min-w-0">
          <span className="font-semibold tracking-tight truncate w-full">{title}</span>
          {subtitle && (
            <span
              className={`text-xs font-normal mt-0.5 truncate w-full ${
                isPrimary
                  ? isLight
                    ? 'text-neutral-300'
                    : 'text-neutral-600'
                  : isLight
                  ? 'text-neutral-500'
                  : 'text-neutral-400'
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right grouping */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {badge}
        {shortcut && (
          <KeycapBadge
            size="sm"
            shortcut={shortcut}
            isLight={isPrimary ? !isLight : isLight}
          />
        )}
        {rightElement}
        {hasArrow && (
          <ChevronRight
            className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
              isPrimary
                ? isLight
                  ? 'text-neutral-300'
                  : 'text-neutral-600'
                : isLight
                ? 'text-neutral-400 group-hover:text-neutral-700'
                : 'text-neutral-500 group-hover:text-neutral-300'
            }`}
          />
        )}
      </div>
    </button>
  );
};
