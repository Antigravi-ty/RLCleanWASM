/**
 * VehicleLoaders.js
 * Default asset loaders & wheel/suspension specs for vehicles.
 */

import {
  OCTANE_WHEEL_COORDS,
  OCTANE_SUSPENSION_Z,
} from '../vehicle/vehicleDescriptors.js';
import {
  loadCustomGlbCarAsset,
  createCustomGlbCarModel,
  createProceduralSportWheel,
} from '../vehicle/customGlbCarModel.js';
import {
  DEFAULT_TEAM_COLORS,
} from './ArenaConstants.js';

export function createDefaultVehicleLoaders() {
  return {
    loadCustomGlbCarAsset,
    createCustomGlbCarModel,
    createProceduralSportWheel,
    wheelSpecs: {
      game: OCTANE_WHEEL_COORDS,
    },
    suspensionSpecs: {
      octaneZ: OCTANE_SUSPENSION_Z,
    },
    teamColors: DEFAULT_TEAM_COLORS,
  };
}
