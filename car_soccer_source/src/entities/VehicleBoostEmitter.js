/**
 * src/entities/VehicleBoostEmitter.js
 * Facade preserving legacy entry point. Concrete implementation and submodules
 * have been decoupled into `src/entities/vehicle/boost/**`.
 *
 * Adheres to Rule 1 (Facade Preserving) and Rule 3 (< 300 lines / < 20KB).
 */

export {
  evalCurveLut,
  REALISTIC_DRIVE_COUNT,
  REALISTIC_DRIVE_LIFE,
  REALISTIC_DRIVE_RATE,
  REALISTIC_TRAIL_COUNT,
  REALISTIC_TRAIL_LIFE,
  REALISTIC_TRAIL_INTERVAL,
  REALISTIC_MAX_PARTICLES_PER_FRAME,
  ARCADE_DRIVE_COUNT,
  ARCADE_DRIVE_LIFE,
  ARCADE_DRIVE_SPAWN_RATE,
  ARCADE_TRAIL_COUNT,
  ARCADE_TRAIL_LIFE,
  ARCADE_TRAIL_DISTANCE,
  ARCADE_MAX_PARTICLES_PER_FRAME,
  ARCADE_BOOST_COLOR_HEX
} from './vehicle/boost/boostCurves.js';

export {
  RealisticBoostParticleMesh
} from './vehicle/boost/realisticParticleMesh.js';

export {
  setupBoostTexture,
  loadGoldenBoostTextures,
  createRealisticBoostConeGeometry,
  createRealisticBoostConeMaterial
} from './vehicle/boost/realisticConeVisual.js';

export {
  RealisticParticlePhysics
} from './vehicle/boost/realisticParticlePhysics.js';

export {
  RealisticBoostEmitter
} from './vehicle/boost/realisticBoostEmitter.js';

export {
  ArcadeBoostParticleMesh
} from './vehicle/boost/arcadeParticleMesh.js';

export {
  createArcadeBoostFlameConeGeometry,
  createArcadeBoostFlameConeMaterial,
  createNozzleFlash,
  createBoostFlare
} from './vehicle/boost/arcadeConeVisual.js';

export {
  ArcadeParticlePhysics
} from './vehicle/boost/arcadeParticlePhysics.js';

export {
  VehicleBoostEmitter
} from './vehicle/boost/vehicleBoostEmitter.js';
