import { useSyncExternalStore } from 'react';
import { AccentColor, ACCENT_THEMES, AccentThemeToken } from './colors';
import { safeStorage } from '../core/configStorageHydrators';

export interface AccentThemeState {
  accent: AccentColor;
  tokens: AccentThemeToken;
}

const getInitialAccent = (): AccentColor => {
  const saved = safeStorage.get('ui-storybook-accent-theme');
  if (saved === 'amber' || saved === 'neutral' || saved === 'sky') {
    return saved;
  }
  // Default to warm amber, avoiding harsh blue
  return 'amber';
};

const initialAccent = getInitialAccent();

let state: AccentThemeState = {
  accent: initialAccent,
  tokens: ACCENT_THEMES[initialAccent],
};

const listeners = new Set<() => void>();
const notify = () => {
  listeners.forEach((l) => l());
};

export const accentStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setAccent: (accent: AccentColor) => {
    state = {
      accent,
      tokens: ACCENT_THEMES[accent] || ACCENT_THEMES.amber,
    };
    safeStorage.set('ui-storybook-accent-theme', accent);
    notify();
  },
};

export const useAccentStore = () => {
  const snapshot = useSyncExternalStore(accentStore.subscribe, accentStore.getSnapshot);
  return {
    accent: snapshot.accent,
    tokens: snapshot.tokens,
    setAccent: accentStore.setAccent,
  };
};
