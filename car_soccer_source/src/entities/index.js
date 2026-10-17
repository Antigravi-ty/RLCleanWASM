export * from "./BallTrajectoryPredictor.js";
/**
 * entities/index.js
 * Unified export point for 3D game entities, arena visual systems, and post-processing elements.
 */

export * from "./BallLocatorArrow.js";
export * from "./DemolitionEffect.js";
export * from "./BoostPadSystem.js";
export * from "./SpeedTrail.js";
export * from "./BallVisual.js";
export * from "./ArenaWorld.js";
export * from "./stadium/index.ts";
export * from "./VehicleAssembly.js";
export * from "./VehicleBoostEmitter.js";
export * from "./CarColorConstants.js";

// Explicit disambiguation for star-exported symbols shared across submodules
export {
  OCTANE_BOOST_OUTLETS,
  FLAT_CAR_BOOST_OUTLETS,
  DEFAULT_TEAM_COLORS
} from "./VehicleAssembly.js";

export {
  updateSuspensionUnitSpring
} from "./ArenaWorld.js";


