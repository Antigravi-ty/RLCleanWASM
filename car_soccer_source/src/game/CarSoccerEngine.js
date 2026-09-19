/**
 * src/game/CarSoccerEngine.js
 * Main Car Soccer Game Engine Entry Point & Subsystem Coordinator (Phase 8.9).
 *
 * Fully modularized, modern, and deobfuscated bootstrap coordinator:
 * - Centralized Three.js Subsystem Context Provider (src/providers/ThreeProvider.js)
 * - Game Runtime Orchestrator & 120Hz Clock (src/game/GameRuntime.js)
 * - Lifecycle Bootstrap & Loading Screen (src/game/GameBootstrap.js)
 * - Standalone entity, audio, physics, camera, input, and effect subsystems
 * - Zero residual dead-code obfuscated abbreviations.
 */

// --- Centralized Three.js Subsystem Context Provider ---
import '../providers/ThreeProvider.js';

// --- Subsystem Integrations ---
import { MatchDialog } from '../ui/MatchDialog.js';
import { CameraController, CameraManager } from '../camera/index.js';
import { setGarageModelLoaders } from '../ui/GarageDialog.js';
import { GLTFLoader } from '../loaders/GLTFLoader.js';
import {
  setBallVisualThreeContext,
  setArenaWorldCarLoaders,
  DEFAULT_TEAM_COLORS,
  createSuspensionUnit,
  createOffroadWheelMesh,
  createSuspensionKnuckle,
  setupCarReactionJets,
  loadGameCarAsset,
  loadFlatCarAsset,
  loadRealisticCarAsset,
  createRealisticCarModel,
  createRealisticCarGimbals,
  assembleRealisticCar,
  createGameCarModel,
  createFlatCarModel,
  createClassicSoccerBall,
  createGameCarWheel,
  createGameCarWheelHardware,
  createFlatCarWheel,
  updateRealisticCockpitGimbal,
  getCarVisualTheme,
  loadRealisticCarShowcase,
  loadGameCarShowcase,
  loadFlatCarShowcase,
  applyVehicleMaterials,
  createCarPaintMaterial,
  REALISTIC_WHEEL_COORDS,
  FLAT_CAR_WHEEL_COORDS,
  OCTANE_WHEEL_COORDS,
  REALISTIC_SUSPENSION_Z,
  FLAT_CAR_SUSPENSION_HEIGHTS,
  OCTANE_BOOST_OUTLETS,
  FLAT_CAR_HITBOX_OFFSET,
  FLAT_CAR_BOOST_OUTLETS,
  DEFAULT_PLAYER_TEAM_INDEX
} from '../entities/index.js';

// --- Game Runtime Orchestrator ---
import { GameRuntime } from './GameRuntime.js';

// --- Lifecycle Bootstrap & Loading Screen ---
import {
  GameBootstrap,
  bootstrapGameEngine
} from './GameBootstrap.js';

// =========================================================================
// 3D Model Loaders & Context Binding
// =========================================================================

// Ensure BallVisual context includes standard GLTFLoader
setBallVisualThreeContext({
  get GLTFLoader() { return GLTFLoader; }
});

// Vehicle model loaders configuration for ArenaWorld and GarageDialog
setArenaWorldCarLoaders({
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
});

setGarageModelLoaders({
  loadFlatCar: loadFlatCarShowcase,
  loadGameCar: loadGameCarShowcase,
  getTeamColor: () => DEFAULT_TEAM_COLORS[DEFAULT_PLAYER_TEAM_INDEX]
});

// =========================================================================
// Game Engine Bootstrap & Lifecycle Coordination
// =========================================================================

let activeGameRuntime = null;

/**
 * Modern bootstrap entry function (deobfuscates historical dB).
 * Starts the application lifecycle, instantiates GameRuntime, and begins rendering.
 * @returns {Promise<GameRuntime>}
 */
async function bootstrapCarSoccerEngine() {
  const host = typeof document !== 'undefined' ? document.querySelector('#app') : null;
  activeGameRuntime = await bootstrapGameEngine(host, {
    carLoaders: {
      createGameCarModel,
      createTruncatedIcosahedronBall: createClassicSoccerBall,
      applyVehicleMaterials,
      createCarPaintMaterial
    },
    CameraControllerClass: CameraManager
  });
  return activeGameRuntime;
}


/**
 * Modern render loop step function (deobfuscates historical wt).
 * Delegates to the active GameRuntime instance to render a single frame.
 * @param {number} timestamp
 */
function renderGameFrame(timestamp) {
  if (activeGameRuntime) {
    activeGameRuntime.renderFrame(timestamp);
  }
}


/**
 * Destroys the active GameRuntime session and frees all WebGL/DOM resources.
 */
function destroyCarSoccerEngine() {
  if (activeGameRuntime) {
    activeGameRuntime.destroy();
    activeGameRuntime = null;
  }
}

// Auto-bootstrap in browser environment if #app container is present
if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
  const appContainer = document.querySelector('#app');
  if (appContainer) {
    bootstrapCarSoccerEngine().catch((err) => {
      console.error('[CarSoccerEngine] Auto-bootstrap failed:', err);
    });
  }
}

export {
  bootstrapCarSoccerEngine,
  renderGameFrame,
  destroyCarSoccerEngine,
  activeGameRuntime,
  GameRuntime,
  GameBootstrap,
  bootstrapGameEngine,
  MatchDialog
};
