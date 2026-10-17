/**
 * src/game/CarSoccerEngine.js
 * Main Car Soccer Game Engine Entry Point & Subsystem Coordinator (Phase 8.9).
 *
 * Fully modularized, modern bootstrap coordinator:
 * - Game Runtime Orchestrator & 120Hz Clock (src/game/GameRuntime.js)
 * - Lifecycle Bootstrap & Loading Screen (src/game/GameBootstrap.js)
 * - Standalone entity, audio, physics, camera, input, and effect subsystems
 * - Subsystem coordinator and lifecycle management.
 */

// --- Runtime Environment Compatibility ---
import * as THREE from 'three';
import { applyThreeMonkeyPatches } from '../utils/ThreeMonkeyPatches.js';

applyThreeMonkeyPatches(THREE);

// --- Subsystem Integrations ---
import { CameraManager } from '../camera/index.js';
import {
  createGameCarModel,
  createClassicSoccerBall,
  applyVehicleMaterials,
  createCarPaintMaterial
} from '../entities/index.js';

// --- Lifecycle Bootstrap & Loading Screen ---
import {
  GameBootstrap,
  bootstrapGameEngine
} from './GameBootstrap.js';

// =========================================================================
// Game Engine Bootstrap & Lifecycle Coordination
// =========================================================================

let activeGameRuntime = null;

/**
 * Modern bootstrap entry function.
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
 * Modern render loop step function.
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
  GameBootstrap,
  bootstrapGameEngine
};
