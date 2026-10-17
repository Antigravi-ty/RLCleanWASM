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

import {
  GameBootstrap,
  bootstrapGameEngine
} from './GameBootstrap.js';

// =========================================================================
// Game Engine Bootstrap & Lifecycle Coordination
// =========================================================================

let activeGameRuntime = null;
let activeBootstrapPromise = null;

/**
 * Modern bootstrap entry function.
 * Dynamically loads 3D subsystems after the minimal loading screen is mounted,
 * instantiates GameRuntime, and begins rendering.
 * @param {object} [options={}]
 * @returns {Promise<GameRuntime>}
 */
async function bootstrapCarSoccerEngine(options = {}) {
  if (activeGameRuntime) {
    return activeGameRuntime;
  }
  if (activeBootstrapPromise) {
    return activeBootstrapPromise;
  }

  activeBootstrapPromise = (async () => {
    const host = options.container || (typeof document !== 'undefined' ? document.querySelector('#app') : null);
    const loader = options.loader || host?.__minimumProgressLoader || null;

    if (loader) {
      loader.onTaskProgress({
        overallPercent: 4,
        detail: 'Initializing Three.js WebGL core & entity factories...'
      });
    }

    const [
      THREE,
      { applyThreeMonkeyPatches },
      { CameraManager },
      {
        createGameCarModel,
        createClassicSoccerBall,
        applyVehicleMaterials,
        createCarPaintMaterial
      }
    ] = await Promise.all([
      import('three'),
      import('../utils/ThreeMonkeyPatches.js'),
      import('../camera/index.js'),
      import('../entities/index.js')
    ]);

    applyThreeMonkeyPatches(THREE);

    activeGameRuntime = await bootstrapGameEngine(host, {
      ...options,
      loader,
      carLoaders: {
        createGameCarModel,
        createTruncatedIcosahedronBall: createClassicSoccerBall,
        applyVehicleMaterials,
        createCarPaintMaterial
      },
      CameraControllerClass: CameraManager
    });
    return activeGameRuntime;
  })();

  try {
    return await activeBootstrapPromise;
  } finally {
    activeBootstrapPromise = null;
  }
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

export {
  bootstrapCarSoccerEngine,
  renderGameFrame,
  destroyCarSoccerEngine,
  activeGameRuntime,
  GameBootstrap,
  bootstrapGameEngine
};

