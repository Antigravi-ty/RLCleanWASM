/**
 * Vehicle Descriptor Schema & Pluggable Registry
 * Re-exports descriptors and registry from src/config/vehicleTunerConfig.js along with derived constants.
 */

import {
  DEFAULT_TEAM_COLORS,
  DEFAULT_PLAYER_TEAM_INDEX,
  GLOBAL_VEHICLE_SURFACE_MATERIALS,
  GLOBAL_VEHICLE_LAMPS_CONFIG,
  FENNEC_DESCRIPTOR,
  INSIDIO_DESCRIPTOR,
  registerVehicleDescriptor,
  getVehicleDescriptor,
  getAllVehicleDescriptors,
  hasVehicleDescriptor,
} from '../../config/vehicleTunerConfig.js';

export {
  DEFAULT_TEAM_COLORS,
  DEFAULT_PLAYER_TEAM_INDEX,
  GLOBAL_VEHICLE_SURFACE_MATERIALS,
  GLOBAL_VEHICLE_LAMPS_CONFIG,
  FENNEC_DESCRIPTOR,
  INSIDIO_DESCRIPTOR,
  registerVehicleDescriptor,
  getVehicleDescriptor,
  getAllVehicleDescriptors,
  hasVehicleDescriptor,
};

export const OCTANE_WHEEL_NAMES = FENNEC_DESCRIPTOR.wheelNames;
export const OCTANE_WHEEL_COORDS = FENNEC_DESCRIPTOR.wheelAnchors;
export const OCTANE_BOOST_OUTLETS = FENNEC_DESCRIPTOR.boostOutlets;
export const OCTANE_DEFAULT_COLORS = FENNEC_DESCRIPTOR.colors.default;
export const OCTANE_SUSPENSION_Z = 17;
