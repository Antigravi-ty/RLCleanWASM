/**
 * materialsConfig.js
 * Re-exports centralized materials and shader appearance configuration from configStorageHydrators.
 */

export {
  DEFAULT_MATERIALS_CONFIG,
  MATERIALS_STORAGE_KEY
} from '../ui-system/core/configTypes.ts';

export {
  getMaterialsConfig,
  setMaterialsConfig,
  onMaterialsConfigChange
} from '../ui-system/core/configStorageHydrators.ts';
