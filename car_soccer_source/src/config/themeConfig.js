/**
 * themeConfig.js
 * Re-exports centralized game theme configuration and reactive state pipeline from configStorageHydrators.
 */

export {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY
} from '../ui-system/core/configTypes.ts';

export {
  themeSettingsStore,
  applyThemeToDocument,
  getTheme,
  setTheme,
  onThemeChange
} from '../ui-system/core/configStorageHydrators.ts';
