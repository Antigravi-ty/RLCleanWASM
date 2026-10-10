import React, { useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useUIStore } from '../core/store';
import { UI_SPACING, UI_RADIUS } from '../tokens/spacing';

export interface MenuItemProps {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  rightElement?: React.ReactNode;
  hasArrow?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  autoFocus?: boolean;
}

export interface MenuContainerProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * MenuContainer
 * Implements SimpleUI layout standard:
 * In SimpleUI, a menu group is NEVER bare (padding: 0). It has strict container-level padding
 * (p-2 = 8px) to ensure hovered/focused items do not flush against the outer borders or clip visual radii.
 */
export const MenuContainer: React.FC<MenuContainerProps> = ({
  children,
  className = '',
  ariaLabel = 'Navigation Menu'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Roving keyboard navigation for menu items (ArrowUp / ArrowDown / Home / End)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const focusable = Array.from(
      containerRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    );
    if (!focusable.length) return;

    const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % focusable.length;
      focusable[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + focusable.length) % focusable.length;
      focusable[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusable[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      focusable[focusable.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      data-ui-element="menu-container"
      role="menu"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex flex-col gap-2 p-2 w-full rounded-2xl transition-colors ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * MenuItem
 * Implements SimpleUI and Apple HIG menu item ergonomics:
 * - Generous item padding: px-4 py-3 (16px horizontal, 12px vertical)
 * - Minimum touch target: min-h-[52px]
 * - Structured left slot (Icon + Stacked Title/Subtitle)
 * - Right accessory slot (Badge, Keyboard shortcut, or Arrow)
 */
export const MenuItem: React.FC<MenuItemProps> = ({
  id,
  icon,
  title,
  subtitle,
  badge,
  rightElement,
  hasArrow,
  disabled = false,
  variant = 'secondary',
  onClick,
  autoFocus
}) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [autoFocus]);

  const getVariantStyles = () => {
    if (variant === 'primary') {
      return isLight
        ? 'bg-neutral-200/90 hover:bg-neutral-300 text-neutral-900 border-neutral-300/90 shadow-sm'
        : 'bg-neutral-800/90 hover:bg-neutral-700/90 text-white border-neutral-700/60 shadow-md';
    }
    if (variant === 'danger') {
      return isLight
        ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
        : 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border-red-900/60';
    }
    // secondary (default)
    return isLight
      ? 'bg-neutral-100/90 hover:bg-neutral-200/90 text-neutral-800 border-neutral-200/90 shadow-xs'
      : 'bg-neutral-800/60 hover:bg-neutral-700/80 text-neutral-200 border-neutral-700/50 shadow-xs';
  };

  return (
    <button
      ref={buttonRef}
      id={id}
      data-ui-element="menu-item"
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex items-center justify-between w-full min-h-[52px] px-4 py-3 ${UI_RADIUS.lg} border font-medium text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.985] cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${getVariantStyles()}`}
    >
      {/* Left grouping */}
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              isLight
                ? 'bg-white/90 text-neutral-800 shadow-2xs group-hover:bg-white'
                : 'bg-neutral-700/70 text-neutral-100 shadow-2xs group-hover:bg-neutral-700'
            }`}
          >
            {icon}
          </div>
        )}
        <div className="flex flex-col items-start leading-tight text-left min-w-0">
          <span className="tracking-wide font-medium truncate w-full text-sm">{title}</span>
          {subtitle && (
            <span
              className={`text-[11px] font-normal truncate w-full mt-0.5 ${
                isLight ? 'text-neutral-500' : 'text-neutral-400'
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right grouping */}
      <div className="flex items-center gap-2.5 shrink-0 ml-3">
        {badge && (
          <span
            className={`inline-flex items-center justify-center min-w-[32px] h-6 px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-medium tracking-wide transition-colors ${
              isLight
                ? 'bg-neutral-100/95 text-neutral-600 border-neutral-300/90 shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]'
                : 'bg-neutral-900/80 text-neutral-300 border-neutral-700/70 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]'
            }`}
          >
            {badge}
          </span>
        )}
        {rightElement}
        {hasArrow && (
          <ChevronRight
            className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
              isLight ? 'text-neutral-400 group-hover:text-neutral-700' : 'text-neutral-500 group-hover:text-neutral-300'
            }`}
          />
        )}
      </div>
    </button>
  );
};

export const MenuDivider: React.FC<{ className?: string }> = ({ className = '' }) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';
  return (
    <hr
      className={`border-none h-px my-1.5 w-full ${
        isLight ? 'bg-neutral-200' : 'bg-neutral-800'
      } ${className}`}
    />
  );
};

export const MenuSectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';
  return (
    <div
      className={`px-4 py-1 text-[11px] font-bold uppercase tracking-wider select-none ${
        isLight ? 'text-neutral-500' : 'text-neutral-400'
      }`}
    >
      {children}
    </div>
  );
};
