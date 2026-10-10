import React, { useRef } from 'react';
import { UI_SPACING } from '../tokens';

export interface MenuContainerProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * MenuContainer
 * Roving keyboard focus manager for SimpleUI menus:
 * - ArrowDown / ArrowUp traverses interactive items
 * - Home / End keys jump to first / last items
 * - Tokenized gap (gap-2.5) with clean zero container padding
 */
export const MenuContainer: React.FC<MenuContainerProps> = ({
  children,
  className = '',
  ariaLabel = 'Navigation Menu',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
      role="menu"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      data-ui-element="menu-container"
      data-menu-container="true"
      className={`flex flex-col ${UI_SPACING.menu.gap} ${UI_SPACING.menu.container} w-full transition-colors ${className}`}
    >
      {children}
    </div>
  );
};

export const MenuDivider: React.FC<{ isLight?: boolean; className?: string }> = ({
  isLight = false,
  className = '',
}) => {
  return (
    <hr
      className={`border-none h-px my-1.5 w-full ${
        isLight ? 'bg-neutral-200' : 'bg-neutral-800'
      } ${className}`}
    />
  );
};

export const MenuSectionTitle: React.FC<{
  children: React.ReactNode;
  isLight?: boolean;
  className?: string;
}> = ({ children, isLight = false, className = '' }) => {
  return (
    <div
      className={`px-1 py-1 text-[11px] font-bold uppercase tracking-wider select-none ${
        isLight ? 'text-neutral-500' : 'text-neutral-400'
      } ${className}`}
    >
      {children}
    </div>
  );
};
