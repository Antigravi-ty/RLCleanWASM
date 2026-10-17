import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T extends string | number = string> {
  value: T;
  label: string;
  description?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownMenuProps<T extends string | number = string> {
  /**
   * Standard Trigger Label (used when custom `trigger` is not provided).
   */
  label?: React.ReactNode;
  /**
   * Optional icon on the left side of the default trigger button.
   */
  icon?: React.ReactNode;
  /**
   * Custom trigger element (Universal Nesting: can be a Button, Card, Badge, or any ReactNode).
   */
  trigger?: React.ReactNode;
  /**
   * Standard option items list (for Select / Preset menu usage).
   */
  options?: DropdownOption<T>[];
  value?: T;
  onChange?: (val: T, option: DropdownOption<T>) => void;
  /**
   * Arbitrary nested children rendered inside the dropdown popover container.
   * Can be combined with `options` or used standalone to embed sliders, charts, or entire panels!
   */
  children?: React.ReactNode;
  /**
   * Popover alignment relative to trigger.
   */
  align?: 'left' | 'right';
  /**
   * Width class or pixel width for the dropdown surface.
   */
  menuWidthClass?: string;
  /**
   * Controlled open state (optional).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Whether clicking inside custom `children` should keep the dropdown open (defaults to true).
   */
  keepOpenOnChildClick?: boolean;
  isLight?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * DropdownMenu
 * Standardized, zero-coupling Dropdown & Composable Popover primitive.
 * Replaces ad-hoc `<select>` and manual dropdown state across RLCleanWASM panels,
 * while adhering to the Universal Nesting philosophy: any component tree (sliders,
 * precision digit pickers, live telemetry charts, panels) can be nested inside `trigger` or `children`.
 */
export const DropdownMenu = <T extends string | number = string>({
  label,
  icon,
  trigger,
  options,
  value,
  onChange,
  children,
  align = 'left',
  menuWidthClass = 'w-64',
  open: controlledOpen,
  onOpenChange,
  keepOpenOnChildClick = true,
  isLight = false,
  disabled = false,
  className = '',
}: DropdownMenuProps<T>) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (disabled) return;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedOption = options?.find((o) => o.value === value);
  const displayLabel = label ?? selectedOption?.label ?? 'Select...';

  return (
    <div
      ref={containerRef}
      data-component="dropdown-menu"
      className={`relative inline-block text-left select-none ${className}`}
    >
      {/* Trigger Slot */}
      {trigger ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!isOpen);
          }}
          className={disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
        >
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!isOpen);
          }}
          className={`w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none ${
            isLight
              ? 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800 shadow-2xs'
              : 'bg-neutral-800/90 hover:bg-neutral-800 border-neutral-700 text-neutral-100 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {(icon || selectedOption?.icon) && (
              <span className="shrink-0">{icon ?? selectedOption?.icon}</span>
            )}
            <span className="truncate font-mono">{displayLabel}</span>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      {/* Popover Surface */}
      {isOpen && (
        <div
          onClick={(e) => {
            if (keepOpenOnChildClick) {
              e.stopPropagation();
            }
          }}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 ${menuWidthClass} rounded-xl border p-1.5 z-50 flex flex-col gap-1 transition-colors ${
            isLight
              ? 'bg-white/98 border-neutral-200 text-neutral-900 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.1)]'
              : 'bg-neutral-900/98 border-neutral-700/90 text-neutral-100 shadow-[0_10px_36px_rgba(0,0,0,0.75),0_0_1px_rgba(255,255,255,0.15)]'
          }`}
        >
          {/* Option Items */}
          {options && options.length > 0 && (
            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {options.map((opt) => {
                const isSelected = value !== undefined && opt.value === value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange?.(opt.value, opt);
                      setOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                      isSelected
                        ? isLight
                          ? 'bg-amber-500/15 text-amber-900 font-semibold'
                          : 'bg-amber-500/15 text-amber-300 font-semibold'
                        : isLight
                        ? 'hover:bg-neutral-100 text-neutral-800'
                        : 'hover:bg-neutral-800 text-neutral-200'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0 mt-0.5">{opt.icon}</span>}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono">{opt.label}</span>
                          {opt.badge && <span className="shrink-0">{opt.badge}</span>}
                        </div>
                        {opt.description && (
                          <span
                            className={`text-[10px] truncate mt-0.5 ${
                              isLight ? 'text-neutral-500' : 'text-neutral-400'
                            }`}
                          >
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Arbitrary Composable Children Slot */}
          {children && (
            <div
              className={
                options && options.length > 0
                  ? `pt-1.5 mt-0.5 border-t ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`
                  : ''
              }
            >
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
