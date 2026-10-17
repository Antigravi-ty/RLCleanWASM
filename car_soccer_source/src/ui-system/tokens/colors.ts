/**
 * Semantic Color Constants
 * Provides unified theme tokens across Light & Dark surfaces
 */
export type AccentColor = 'amber' | 'neutral' | 'sky';

export interface AccentThemeToken {
  name: string;
  badge: string;
  accent: string;
  accentHover: string;
  text: string;
  ring: string;
  border: string;
  subtle: string;
  activeItemLight: string;
  activeItemDark: string;
}

export const ACCENT_THEMES: Record<AccentColor, AccentThemeToken> = {
  amber: {
    name: 'Warm Amber / Orange',
    badge: 'bg-amber-500 text-white',
    accent: 'bg-amber-500 text-white',
    accentHover: 'hover:bg-amber-600',
    text: 'text-amber-500 dark:text-amber-400',
    ring: 'ring-amber-500/50 focus-visible:ring-amber-500',
    border: 'border-amber-500',
    subtle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    activeItemLight: 'bg-amber-50 text-amber-800 font-semibold shadow-2xs border border-amber-200/80',
    activeItemDark: 'bg-amber-500/15 text-amber-300 font-semibold shadow-xs border border-amber-500/40',
  },
  neutral: {
    name: 'Neutral Monochrome',
    badge: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950',
    accent: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950',
    accentHover: 'hover:bg-neutral-800 dark:hover:bg-neutral-100',
    text: 'text-neutral-900 dark:text-neutral-100',
    ring: 'ring-neutral-400 dark:ring-neutral-500 focus-visible:ring-neutral-400',
    border: 'border-neutral-900 dark:border-white',
    subtle: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700',
    activeItemLight: 'bg-neutral-100 text-neutral-900 font-semibold shadow-2xs border border-neutral-300',
    activeItemDark: 'bg-neutral-800 text-neutral-100 font-semibold shadow-xs border border-neutral-700',
  },
  sky: {
    name: 'Classic Sky',
    badge: 'bg-sky-500 text-white',
    accent: 'bg-sky-500 text-white',
    accentHover: 'hover:bg-sky-600',
    text: 'text-sky-500 dark:text-sky-400',
    ring: 'ring-sky-500/50 focus-visible:ring-sky-500',
    border: 'border-sky-500',
    subtle: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    activeItemLight: 'bg-sky-50 text-sky-700 font-semibold shadow-2xs border border-sky-100',
    activeItemDark: 'bg-sky-500/15 text-sky-300 font-semibold shadow-xs border border-sky-500/40',
  },
};

export const UI_THEME = {
  light: {
    bgApp: 'bg-white',
    bgPanel: 'bg-white',
    bgSurface: 'bg-[#fafafa]',
    bgSubtle: 'bg-neutral-100/60',
    bgMuted: 'bg-neutral-200/50',
    textPrimary: 'text-neutral-900',
    textSecondary: 'text-neutral-600',
    textMuted: 'text-neutral-400',
    border: 'border-neutral-200/80',
    borderStrong: 'border-neutral-300',
    accent: 'bg-amber-500 text-white',
    ring: 'ring-amber-500',
  },
  dark: {
    bgApp: 'bg-neutral-950',
    bgPanel: 'bg-neutral-900',
    bgSurface: 'bg-neutral-900',
    bgSubtle: 'bg-neutral-800/80',
    bgMuted: 'bg-neutral-800',
    textPrimary: 'text-neutral-50',
    textSecondary: 'text-neutral-300',
    textMuted: 'text-neutral-400',
    border: 'border-neutral-700/80',
    borderStrong: 'border-neutral-600',
    accent: 'bg-amber-500 text-white',
    ring: 'ring-amber-400',
  },
} as const;
