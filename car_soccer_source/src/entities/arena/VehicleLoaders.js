/**
 * VehicleLoaders.js
 * Default vehicle assembly functions, wheel spec coordinates, and suspension dimensions.
 */

import {
  loadGameCarAsset,
  loadFlatCarAsset,
  loadRealisticCarAsset,
  createRealisticCarModel,
  createRealisticCarGimbals,
  assembleRealisticCar,
  createGameCarModel,
  createFlatCarModel,
  createGameCarWheel,
  createGameCarWheelHardware,
  createFlatCarWheel,
  updateRealisticCockpitGimbal,
  getCarVisualTheme,
  REALISTIC_WHEEL_COORDS,
  FLAT_CAR_WHEEL_COORDS,
  OCTANE_WHEEL_COORDS,
  REALISTIC_SUSPENSION_Z,
  FLAT_CAR_SUSPENSION_HEIGHTS,
  FLAT_CAR_HITBOX_OFFSET
} from '../VehicleAssembly.js';
import {
  DEFAULT_TEAM_COLORS,
  OCTANE_BOOST_OUTLETS,
  FLAT_CAR_BOOST_OUTLETS
} from './ArenaConstants.js';

export function createDefaultVehicleLoaders() {
  return {
    loadGameCarAsset,
    loadFlatCarAsset,
    loadRealisticCarAsset,
    createRealisticCarModel,
    createRealisticCarGimbals,
    assembleRealisticCar,
    createGameCarModel,
    createFlatCarModel,
    createGameCarWheel,
    createGameCarWheelHardware,
    createFlatCarWheel,
    updateRealisticCockpitGimbal,
    getCarVisualTheme,
    wheelSpecs: {
      realistic: REALISTIC_WHEEL_COORDS,
      flat: FLAT_CAR_WHEEL_COORDS,
      game: OCTANE_WHEEL_COORDS
    },
    suspensionSpecs: {
      realisticZ: REALISTIC_SUSPENSION_Z,
      flatY: FLAT_CAR_SUSPENSION_HEIGHTS
    },
    hitboxOffsets: {
      realistic: OCTANE_BOOST_OUTLETS,
      flat: FLAT_CAR_HITBOX_OFFSET,
      flatJets: FLAT_CAR_BOOST_OUTLETS
    },
    teamColors: DEFAULT_TEAM_COLORS
  };
}
