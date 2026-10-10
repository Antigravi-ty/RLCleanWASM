import React from 'react';
import { UI_RADIUS } from '../tokens';
import { KeycapBadge } from './KeycapBadge';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcut?: string;
  loading?: boolean;
  isLight?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs min-h-[32px] gap-1.5',
  md: 'px-4 py-2 text-sm min-h-[40px] gap-2',
  lg: 'px-5 py-2.5 text-base min-h-[48px] gap-2.5',
};

/**
 * Standard Accessible Button Primitive
 * Includes native keycap shortcut slot and tactile active press.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  rightIcon,
  shortcut,
  loading = false,
  isLight = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const getVariantStyles = () => {
    if (variant === 'primary') {
      return isLight
        ? 'bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900 shadow-sm'
        : 'bg-white text-neutral-950 hover:bg-neutral-100 border-white shadow-md';
    }
    if (variant === 'danger') {
      return isLight
        ? 'bg-red-600 text-white hover:bg-red-700 border-red-600 shadow-sm'
        : 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/40';
    }
    if (variant === 'outline') {
      return isLight
        ? 'bg-transparent text-neutral-800 hover:bg-neutral-100 border-neutral-300'
        : 'bg-transparent text-neutral-200 hover:bg-neutral-800/60 border-neutral-700';
    }
    if (variant === 'ghost') {
      return isLight
        ? 'bg-transparent text-neutral-700 hover:bg-neutral-200/60 border-transparent'
        : 'bg-transparent text-neutral-300 hover:bg-neutral-800/80 border-transparent';
    }
    // secondary (default)
    return isLight
      ? 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-200/90 shadow-2xs'
      : 'bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-200 border-neutral-700/60 shadow-2xs';
  };

  return (
    <button
      type="button"
      data-component="button"
      data-variant={variant}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium border select-none transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${UI_RADIUS.lg} ${sizeClasses[size]} ${getVariantStyles()} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      {shortcut && (
        <KeycapBadge
          size="sm"
          shortcut={shortcut}
          isLight={variant === 'primary' ? !isLight : isLight}
          className={`ml-auto ${
            variant === 'primary'
              ? isLight
                ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                : 'bg-neutral-200 text-neutral-800 border-neutral-300'
              : ''
          }`}
        />
      )}
    </button>
  );
};
