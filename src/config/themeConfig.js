/**
 * themeConfig.js
 * Centralized game theme configuration and reactive state pipeline.
 */

import { safeStorage, createLocalStorageStore, stringOrDefault, STORAGE_KEYS, UI_THEME_STORAGE_KEY } from './storageHelpers.ts';

export const THEMES = Object.freeze(['realistic', 'arcade']);
export const DEFAULT_THEME = 'arcade';
export const THEME_STORAGE_KEY = STORAGE_KEYS.GAME_THEME;
export { UI_THEME_STORAGE_KEY };

export const themeSettingsStore = createLocalStorageStore(
  THEME_STORAGE_KEY,
  () => ({ theme: DEFAULT_THEME }),
  (target, source) => {
    target.theme = stringOrDefault(source.theme, THEMES, target.theme);
  }
);

let activeGameTheme = themeSettingsStore.load().theme;
const gameThemeListeners = new Set();

export function applyThemeToDocument() {
  if (typeof document !== 'undefined' && document.documentElement?.dataset) {
    document.documentElement.dataset.theme = activeGameTheme;
  }
}

export function getTheme() {
  return activeGameTheme;
}

export function setTheme(theme, options = {}) {
  if (!THEMES.includes(theme)) return;
  const changed = theme !== activeGameTheme;
  activeGameTheme = theme;
  applyThemeToDocument();
  if (options.persist !== false) {
    themeSettingsStore.save({ theme });
  }
  if (changed) {
    for (const listener of gameThemeListeners) {
      try {
        listener(theme);
      } catch (err) {
        console.error('[ThemeConfig] listener threw error:', err);
      }
    }
  }
}

export function onThemeChange(callback) {
  gameThemeListeners.add(callback);
  try {
    callback(activeGameTheme);
  } catch (err) {
    console.error('[ThemeConfig] callback threw error:', err);
  }
  return () => {
    gameThemeListeners.delete(callback);
  };
}

export function getInitialTheme() {
  const saved = safeStorage.get(UI_THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}
