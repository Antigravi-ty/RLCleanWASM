import React from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  OctagonAlert, 
  AlertCircle,
  AlertTriangle, 
  Info, 
  Flame,
  X 
} from 'lucide-react';
import { DialogueTone, DialogueButtonVariant } from './dialogueTypes';

export const buildCombinedShadow = (
  tone: DialogueTone,
  isLight: boolean,
  innerGlowBlur: number,
  outerShadowBlur: number
): string => {
  const parts: string[] = [];

  // 1. Inner Glow (inset)
  if (innerGlowBlur > 0) {
    switch (tone) {
      case 'error':
        parts.push(
          isLight
            ? `inset 0 0 ${innerGlowBlur}px rgba(239, 68, 68, 0.16)`
            : `inset 0 0 ${Math.round(innerGlowBlur * 1.2)}px rgba(239, 68, 68, 0.25)`
        );
        break;
      case 'orange':
        parts.push(
          isLight
            ? `inset 0 0 ${innerGlowBlur}px rgba(249, 115, 22, 0.16)`
            : `inset 0 0 ${Math.round(innerGlowBlur * 1.2)}px rgba(249, 115, 22, 0.25)`
        );
        break;
      case 'warning':
        parts.push(
          isLight
            ? `inset 0 0 ${innerGlowBlur}px rgba(234, 179, 8, 0.16)`
            : `inset 0 0 ${Math.round(innerGlowBlur * 1.2)}px rgba(234, 179, 8, 0.25)`
        );
        break;
      case 'info':
      default:
        parts.push(
          isLight
            ? `inset 0 0 ${innerGlowBlur}px rgba(163, 163, 163, 0.18)`
            : `inset 0 0 ${Math.round(innerGlowBlur * 1.2)}px rgba(255, 255, 255, 0.08)`
        );
        break;
    }
  }

  // 2. Omnidirectional 360-degree floating outer shadow
  if (outerShadowBlur > 0) {
    if (isLight) {
      parts.push(
        `0 0 0 1px rgba(0, 0, 0, 0.08)`,
        `0 0 ${outerShadowBlur}px rgba(0, 0, 0, 0.16)`,
        `0 ${Math.round(outerShadowBlur * 0.4)}px ${Math.round(outerShadowBlur * 1.2)}px rgba(0, 0, 0, 0.14)`
      );
    } else {
      parts.push(
        `0 0 0 1px rgba(255, 255, 255, 0.14)`,
        `0 0 ${outerShadowBlur}px rgba(0, 0, 0, 0.85)`,
        `0 ${Math.round(outerShadowBlur * 0.4)}px ${Math.round(outerShadowBlur * 1.2)}px rgba(0, 0, 0, 0.95)`
      );
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'none';
};

const toPascalCase = (str: string): string => {
  return str
    .replace(/[-_ ]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
};

export const getLucideIconComponent = (name: string): React.ComponentType<any> | null => {
  if (!name || typeof name !== 'string') return null;
  const pascal = toPascalCase(name.trim());
  const comp =
    (LucideIcons as Record<string, any>)[pascal] ||
    (LucideIcons as Record<string, any>)[name.trim()] ||
    (LucideIcons.icons as Record<string, any>)?.[pascal] ||
    (LucideIcons.icons as Record<string, any>)?.[name.trim()];
  return comp && (typeof comp === 'function' || typeof comp === 'object') ? comp : null;
};

/**
 * Tone configuration for the 4 levels (Grey, Yellow, Orange, Red)
 */
export const getToneConfig = (tone: DialogueTone, isLight: boolean) => {
  switch (tone) {
    case 'error':
      return {
        defaultIconComponent: OctagonAlert,
        iconContainerClass: isLight
          ? 'bg-red-50 text-red-600 border border-red-200/90'
          : 'bg-red-950/70 text-red-400 border border-red-800/80',
        plainIconColorClass: isLight ? 'text-red-600' : 'text-red-400',
        cardBorderClass: isLight ? 'border-red-300/80' : 'border-red-900/60',
        defaultButtonVariant: 'danger' as DialogueButtonVariant,
      };
    case 'orange':
      return {
        defaultIconComponent: Flame,
        iconContainerClass: isLight
          ? 'bg-orange-50 text-orange-600 border border-orange-200/90'
          : 'bg-orange-950/70 text-orange-400 border border-orange-800/80',
        plainIconColorClass: isLight ? 'text-orange-600' : 'text-orange-400',
        cardBorderClass: isLight ? 'border-orange-300/80' : 'border-orange-900/60',
        defaultButtonVariant: 'primary' as DialogueButtonVariant,
      };
    case 'warning':
      return {
        defaultIconComponent: AlertTriangle,
        iconContainerClass: isLight
          ? 'bg-yellow-50 text-yellow-600 border border-yellow-200/90'
          : 'bg-yellow-950/70 text-yellow-400 border border-yellow-800/80',
        plainIconColorClass: isLight ? 'text-yellow-600' : 'text-yellow-400',
        cardBorderClass: isLight ? 'border-yellow-300/80' : 'border-yellow-900/60',
        defaultButtonVariant: 'primary' as DialogueButtonVariant,
      };
    case 'info':
    default:
      return {
        defaultIconComponent: Info,
        iconContainerClass: isLight
          ? 'bg-neutral-100 text-neutral-600 border border-neutral-300/80'
          : 'bg-neutral-800 text-neutral-300 border border-neutral-700/80',
        plainIconColorClass: isLight ? 'text-neutral-600' : 'text-neutral-400',
        cardBorderClass: isLight ? 'border-neutral-300/80' : 'border-neutral-800/80',
        defaultButtonVariant: 'primary' as DialogueButtonVariant,
      };
  }
};

export const MONO_FONT_STACK = "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace";

export const DEFAULT_TITLES: Record<DialogueTone, string> = {
  error: 'ERROR',
  warning: 'WARNING',
  orange: 'ALERT',
  info: 'INFO',
};

/**
 * Standardized Dialogue Presentation Component
 * Title represents the level attribute (e.g. FATAL ERROR, ERROR, WARNING, ALERT, INFO)
 */
