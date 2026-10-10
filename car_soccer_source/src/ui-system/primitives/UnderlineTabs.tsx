import React, { useRef, useId } from 'react';
import { motion } from 'framer-motion';
import { UI_EASING } from '../tokens';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface UnderlineTabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  id?: string;
  isLight?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /**
   * If true, tabs expand to fill the full container width with symmetric equal spacing (Apple symmetric switch style).
   * Defaults to true.
   */
  fullWidth?: boolean;
  /**
   * Color class for the sliding underline indicator.
   * Defaults to warm orange/amber ('bg-amber-500'), avoiding harsh blue.
   */
  indicatorColor?: string;
}

/**
 * UnderlineTabs
 * Apple / Linear style navigation tabs with a fluid sliding underline indicator.
 * - Defaults to warm orange/amber bottom line (avoiding blue).
 * - Full-width symmetric distribution across available width by default.
 * - Width-invariant typography: active bold state uses hidden font reservation so tab width NEVER jitters or expands.
 * - Scoped layoutId via useId() allows multiple instances to coexist safely without layout jumping.
 * - Supports keyboard arrow keys (ArrowLeft / ArrowRight) for seamless roving focus.
 */
export const UnderlineTabs: React.FC<UnderlineTabsProps> = ({
  items,
  activeId,
  onChange,
  id,
  isLight = false,
  className = '',
  size = 'md',
  fullWidth = true,
  indicatorColor = 'bg-amber-500',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const instanceId = id || reactId;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = items.filter((item) => !item.disabled);
    const currentIndex = enabledItems.findIndex((item) => item.id === activeId);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (currentIndex + 1) % enabledItems.length;
      onChange(enabledItems[next].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
      onChange(enabledItems[prev].id);
    }
  };

  const sizeClasses = {
    sm: 'text-xs py-2 px-3 gap-1.5',
    md: 'text-sm py-2.5 px-4 gap-2',
    lg: 'text-base py-3 px-5 gap-2.5',
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={`relative flex items-center border-b ${
        fullWidth ? 'w-full' : ''
      } ${
        isLight ? 'border-neutral-200' : 'border-neutral-800'
      } ${className}`}
    >
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={`relative flex items-center transition-colors duration-150 outline-none select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              fullWidth ? 'flex-1 min-w-0 justify-center' : 'shrink-0'
            } ${sizeClasses[size]}`}
          >
            {tab.icon && (
              <span
                className={`shrink-0 transition-colors ${
                  isActive
                    ? isLight
                      ? 'text-neutral-900'
                      : 'text-white'
                    : isLight
                    ? 'text-neutral-400 group-hover:text-neutral-600'
                    : 'text-neutral-500 group-hover:text-neutral-300'
                }`}
              >
                {tab.icon}
              </span>
            )}

            {/* Zero-shift text wrapper: permanent bold ghost reservation ensures exact constant width */}
            <span className="relative inline-flex flex-col items-center justify-center truncate">
              <span
                className={`truncate transition-colors ${
                  isActive
                    ? isLight
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : isLight
                    ? 'text-neutral-500 hover:text-neutral-800 font-medium'
                    : 'text-neutral-400 hover:text-neutral-200 font-medium'
                }`}
              >
                {tab.label}
              </span>
              <span
                className="invisible h-0 font-semibold select-none pointer-events-none truncate"
                aria-hidden="true"
              >
                {tab.label}
              </span>
            </span>

            {tab.badge && <span className="shrink-0 ml-1">{tab.badge}</span>}

            {/* Sliding Underline Indicator: Warm orange/amber by default, uniquely scoped */}
            {isActive && (
              <motion.div
                layoutId={`underline-tabs-active-indicator-${instanceId}`}
                className={`absolute bottom-0 left-0 right-0 h-[2px] ${indicatorColor} rounded-full`}
                transition={UI_EASING.spring.tactile}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
