/**
 * Vehicle Descriptor Schema & Pluggable Registry
 *
 * Provides declarative registration of vehicle 3D visual assets, hitbox spatial
 * registration transforms (scale, aspect compensations, center offsets), wheel anchor
 * coordinates, and boost nozzle geometry. Third-party car models can be registered
 * without touching core assembly or physics code.
 *
 * @typedef {Object} VehicleAlignment
 * @property {number} scale - Global scale factor aligning visual mesh to Unreal Units (uu / cm).
 * @property {number} [scaleX=1] - Longitudinal deformation compensation factor.
 * @property {[number, number, number]} centerOffset - Center-of-mass to pivot offset [x, y, z].
 *
 * @typedef {Object} VehicleModelDescriptor
 * @property {string} id - Unique vehicle identifier (e.g., 'octane', 'flat-car', 'fennec').
 * @property {string} name - Display name.
 * @property {string} hitboxPreset - Target RocketSim hitbox preset (e.g., 'hitbox-octane', 'hitbox-dominus').
 * @property {string} modelUrl - Path or URL to the 3D model asset (GLTF/GLB).
 * @property {VehicleAlignment} alignment - Spatial registration transform aligning visual mesh with hitbox.
 * @property {[number, number, number][]} wheelAnchors - 4 suspension wheel mounting positions [x, y, z].
 * @property {[number, number, number][]} boostOutlets - Boost exhaust outlet coordinates [x, y, z].
 * @property {string[]} [wheelNames] - Hierarchy node names for suspension wheels.
 * @property {string[]} [assetWheelNames] - Node names inside the raw asset file.
 * @property {Object} [colors] - Team color palettes and defaults.
 * @property {Object} [metadata] - Additional car-specific properties.
 */

export const DEFAULT_TEAM_COLORS = [3111891, 13857839];
export const DEFAULT_PLAYER_TEAM_INDEX = 0;

// =============================================================================
// Built-in Vehicle Descriptors
// =============================================================================

export const OCTANE_DESCRIPTOR = {
  id: "octane",
  name: "Octane",
  hitboxPreset: "hitbox-octane",
  modelUrl: "/assets/game-car/model.gltf",
  alignment: {
    scale: 105,
    scaleX: 0.951984748575128,
    centerOffset: [3.3438630034881425, -15, 0]
  },
  wheelNames: [
    "wheel-front-right",
    "wheel-front-left",
    "wheel-rear-right",
    "wheel-rear-left"
  ],
  assetWheelNames: [
    "wheel-front-left",
    "wheel-front-right",
    "wheel-rear-left",
    "wheel-rear-right"
  ],
  wheelAnchors: [
    [48.8139, 26.9291, 12.5],
    [48.8139, -26.9291, 12.5],
    [-36.5145, 28.6221, 15],
    [-36.5145, -28.622, 15]
  ],
  boostOutlets: [
    [-57, 10.25, 20.4278],
    [-57, 10.25, -20.4278]
  ],
  colors: {
    default: {
      primary: 16743716,
      realisticPrimary: 16555020,
      pearl: 16724660
    }
  }
};

export const FLAT_CAR_DESCRIPTOR = {
  id: "flat-car",
  name: "Dominus",
  hitboxPreset: "hitbox-dominus",
  modelUrl: "/assets/flat-car/model.glb",
  alignment: {
    scale: 100,
    scaleX: 1.0,
    centerOffset: [0, 0, 0]
  },
  wheelNames: [
    "wheel-front-right",
    "wheel-front-left",
    "wheel-rear-right",
    "wheel-rear-left"
  ],
  wheelAnchors: [
    [50.3, 31.1, 12],
    [50.3, -31.1, 12],
    [-34.75, 33, 13.5],
    [-34.75, -33, 13.5]
  ],
  suspensionHeights: [-6.2, -6.2, -6.1, -6.1],
  boostOutlets: [
    [-57.16878128051758, 9.5, 5.489756107330322],
    [-57.16878128051758, 9.5, -5.489756107330322]
  ],
  hitboxOffset: {
    length: 130.427,
    width: 85.7799,
    height: 33.8,
    forward: 9,
    up: 15.75
  },
  colors: {
    default: {
      primary: 821500,
      pearl: 9306290
    },
    bot: {
      primary: 16743716,
      realisticPrimary: 13857839,
      pearl: 16760939
    }
  }
};

export const REALISTIC_BUGGY_DESCRIPTOR = {
  id: "realistic-car",
  name: "Space-Frame Buggy",
  hitboxPreset: "hitbox-octane",
  modelUrl: "/assets/realistic-car/details.glb",
  alignment: {
    scale: 1.0,
    scaleX: 1.0,
    centerOffset: [0, 0, 0]
  },
  wheelAnchors: [
    [63.88, 34, 13],
    [63.88, -34, 13],
    [-36.12, 34, 16],
    [-36.12, -34, 16]
  ],
  suspensionZ: 17,
  tireWidth: 16,
  dimensions: {
    length: 120.507,
    width: 86.6994,
    height: 38.6591,
    centerForward: 13.8757,
    centerUp: 20.755,
    gimbalOuterRadius: 22,
    gimbalInnerRadius: 20,
    gimbalCenterX: 8.8757,
    gimbalCenterY: 15.755,
    minSteerVelocity: 100,
    seatYawRate: 5.5
  },
  detailNames: [
    "frame-details",
    "fixed-details",
    "roll-details",
    "cradle-details",
    "seat-details"
  ]
};

// =============================================================================
// Registry API for Extensible Vehicle Ecosystem
// =============================================================================

const vehicleRegistry = new Map([
  ["octane", OCTANE_DESCRIPTOR],
  ["game-car", OCTANE_DESCRIPTOR],
  ["flat-car", FLAT_CAR_DESCRIPTOR],
  ["dominus", FLAT_CAR_DESCRIPTOR],
  ["realistic-car", REALISTIC_BUGGY_DESCRIPTOR],
  ["buggy", REALISTIC_BUGGY_DESCRIPTOR]
]);

export function registerVehicleDescriptor(descriptor) {
  if (!descriptor || !descriptor.id) {
    throw new Error("Vehicle descriptor must include a valid unique 'id'");
  }
  vehicleRegistry.set(descriptor.id, descriptor);
  if (descriptor.aliases && Array.isArray(descriptor.aliases)) {
    for (const alias of descriptor.aliases) {
      vehicleRegistry.set(alias, descriptor);
    }
  }
}

export function getVehicleDescriptor(id) {
  return vehicleRegistry.get(id) || null;
}

export function getAllVehicleDescriptors() {
  const unique = new Set(vehicleRegistry.values());
  return Array.from(unique);
}

export function hasVehicleDescriptor(id) {
  return vehicleRegistry.has(id);
}

// =============================================================================
// Legacy Direct Constants (Full backwards compatibility)
// =============================================================================

export const OCTANE_SCALE = OCTANE_DESCRIPTOR.alignment.scale;
export const OCTANE_SCALE_X = OCTANE_DESCRIPTOR.alignment.scaleX;
export const OCTANE_OFFSET_X = OCTANE_DESCRIPTOR.alignment.centerOffset[0];
export const OCTANE_OFFSET_Y = OCTANE_DESCRIPTOR.alignment.centerOffset[1];

export const OCTANE_WHEEL_NAMES = OCTANE_DESCRIPTOR.wheelNames;
export const OCTANE_ASSET_WHEEL_NAMES = OCTANE_DESCRIPTOR.assetWheelNames;
export const OCTANE_WHEEL_COORDS = OCTANE_DESCRIPTOR.wheelAnchors;
export const OCTANE_BOOST_OUTLETS = OCTANE_DESCRIPTOR.boostOutlets;
export const OCTANE_DEFAULT_COLORS = OCTANE_DESCRIPTOR.colors.default;

export const FLAT_CAR_DEFAULT_COLORS = FLAT_CAR_DESCRIPTOR.colors.default;
export const FLAT_CAR_BOT_COLORS = FLAT_CAR_DESCRIPTOR.colors.bot;
export const FLAT_CAR_HITBOX_OFFSET = FLAT_CAR_DESCRIPTOR.hitboxOffset;
export const FLAT_CAR_WHEEL_COORDS = FLAT_CAR_DESCRIPTOR.wheelAnchors;
export const FLAT_CAR_SUSPENSION_HEIGHTS = FLAT_CAR_DESCRIPTOR.suspensionHeights;
export const FLAT_CAR_BOOST_OUTLETS = FLAT_CAR_DESCRIPTOR.boostOutlets;
export const FLAT_CAR_WHEEL_NAMES = FLAT_CAR_DESCRIPTOR.wheelNames;

export const REALISTIC_WHEEL_COORDS = REALISTIC_BUGGY_DESCRIPTOR.wheelAnchors;
export const REALISTIC_SUSPENSION_Z = REALISTIC_BUGGY_DESCRIPTOR.suspensionZ;
export const REALISTIC_TIRE_WIDTH = REALISTIC_BUGGY_DESCRIPTOR.tireWidth;
export const REALISTIC_DIMENSIONS = REALISTIC_BUGGY_DESCRIPTOR.dimensions;
export const REALISTIC_DETAIL_NAMES = REALISTIC_BUGGY_DESCRIPTOR.detailNames;
