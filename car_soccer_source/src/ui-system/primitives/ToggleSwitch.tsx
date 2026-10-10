import React from 'react';
import { motion } from 'framer-motion';
import { UI_EASING } from '../tokens';

export type ToggleVariant = 'green' | 'black' | 'neutral' | 'orange' | 'amber';

export interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  isLight?: boolean;
  /**
   * Visual color variant仿照 Apple 设计:
   * - 'green': Classic Apple iOS green (#34C759 / emerald-500)
   * - 'black' / 'neutral': High-contrast Apple monochrome black/white
   * - 'orange': Warm orange
   * - 'amber': Golden amber
   * Defaults to 'green', avoiding harsh blue.
   */
  variant?: ToggleVariant;
  className?: string;
}

/**
 * ToggleSwitch
 * Apple HIG tactile switch toggle with smooth spring thumb physics:
 * - Emulates Apple's signature green and monochrome black switch designs.
 * - Supports 'green', 'black', 'orange', and 'amber' variants (no blue).
 * - High accessibility with keyboard space/enter toggling and neutral focus rings.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  isLight = false,
  variant = 'green',
  className = '',
}) => {
  // Compute background and thumb styles based on variant & light mode
  const getCheckedStyles = () => {
    switch (variant) {
      case 'black':
      case 'neutral':
        return {
          track: isLight
            ? 'bg-neutral-900 border-neutral-900'
            : 'bg-white border-white',
          thumb: isLight
            ? 'bg-white shadow-md'
            : 'bg-neutral-900 shadow-md',
        };
      case 'orange':
        return {
          track: 'bg-orange-500 border-orange-600',
          thumb: 'bg-white shadow-md',
        };
      case 'amber':
        return {
          track: 'bg-amber-500 border-amber-600',
          thumb: 'bg-white shadow-md',
        };
      case 'green':
      default:
        // Classic Apple HIG Switch Green
        return {
          track: 'bg-emerald-500 border-emerald-600',
          thumb: 'bg-white shadow-md',
        };
    }
  };

  const { track: checkedTrack, thumb: checkedThumb } = getCheckedStyles();

  return (
    <label
      data-component="toggle-switch"
      className={`flex items-center justify-between gap-4 cursor-pointer select-none ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col text-left leading-tight min-w-0">
          {label && (
            <span className={`text-sm font-semibold truncate ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
              {label}
            </span>
          )}
          {description && (
            <span className={`text-xs mt-0.5 truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {description}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 cursor-pointer ${
          checked
            ? checkedTrack
            : isLight
            ? 'bg-neutral-300 border-neutral-300'
            : 'bg-neutral-800 border-neutral-700'
        }`}
      >
        <motion.span
          className={`inline-block h-4 w-4 rounded-full pointer-events-none transition-colors ${
            checked ? checkedThumb : 'bg-white shadow-md'
          }`}
          initial={false}
          animate={{ x: checked ? 22 : 3 }}
          transition={UI_EASING.spring.tactile}
        />
      </button>
    </label>
  );
};
