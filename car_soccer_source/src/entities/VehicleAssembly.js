/**
 * src/entities/VehicleAssembly.js
 * Facade preserving legacy entry point. Concrete implementation and submodules
 * have been decoupled into `src/entities/vehicle/**`.
 *
 * Adheres to Rule 1 (Facade Preserving) and Rule 3 (< 300 lines / < 20KB).
 */

export {
  DEFAULT_TEAM_COLORS,
  DEFAULT_PLAYER_TEAM_INDEX,
  OCTANE_DESCRIPTOR,
  FLAT_CAR_DESCRIPTOR,
  REALISTIC_BUGGY_DESCRIPTOR,
  registerVehicleDescriptor,
  getVehicleDescriptor,
  getAllVehicleDescriptors,
  hasVehicleDescriptor,
  OCTANE_SCALE,
  OCTANE_SCALE_X,
  OCTANE_OFFSET_X,
  OCTANE_OFFSET_Y,
  OCTANE_WHEEL_NAMES,
  OCTANE_ASSET_WHEEL_NAMES,
  OCTANE_WHEEL_COORDS,
  OCTANE_BOOST_OUTLETS,
  OCTANE_DEFAULT_COLORS,
  FLAT_CAR_DEFAULT_COLORS,
  FLAT_CAR_BOT_COLORS,
  FLAT_CAR_HITBOX_OFFSET,
  FLAT_CAR_WHEEL_COORDS,
  FLAT_CAR_SUSPENSION_HEIGHTS,
  FLAT_CAR_BOOST_OUTLETS,
  FLAT_CAR_WHEEL_NAMES,
  REALISTIC_WHEEL_COORDS,
  REALISTIC_SUSPENSION_Z,
  REALISTIC_TIRE_WIDTH,
  REALISTIC_DIMENSIONS,
  REALISTIC_DETAIL_NAMES
} from './vehicle/vehicleDescriptors.js';

export {
  findMeshObjectByName,
  findMeshByMaterialName,
  getOctaneTransformMatrix,
  detachOctaneWheelHardware
} from './vehicle/vehicleMeshUtils.js';

export {
  createCarPaintMaterial,
  mapVehicleMaterial,
  applyVehicleMaterials,
  cloneVehicleMeshWithPaint
} from './vehicle/vehiclePaintMaterial.js';

export {
  loadGameCarAsset,
  createGameCarModel,
  createGameCarWheel,
  createGameCarWheelHardware
} from './vehicle/gameCarModel.js';

export {
  loadFlatCarAsset,
  createFlatCarModel,
  createFlatCarWheel,
  getCarVisualTheme
} from './vehicle/flatCarModel.js';

export {
  normalizeAngle,
  approachAngle,
  updateRealisticCockpitGimbal
} from './vehicle/realisticCockpitSolver.js';

export {
  createRealisticCarGimbals
} from './vehicle/realisticCockpitGimbal.js';

export {
  lerpPolyline,
  createRearJetCluster,
  createRealisticCarModel
} from './vehicle/realisticBuggyFrame.js';

export {
  loadRealisticCarAsset,
  assembleRealisticCar,
  alignCylinderBetweenPoints,
  updateSuspensionUnitSpring
} from './vehicle/realisticCarAssembly.js';

export {
  loadRealisticCarShowcase,
  loadGameCarShowcase,
  loadFlatCarShowcase
} from './vehicle/vehicleShowcases.js';
