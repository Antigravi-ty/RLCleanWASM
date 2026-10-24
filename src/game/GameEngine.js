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
async function bootstrapEngine(options = {}) {
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
      { createClassicBall },
      { applyVehicleMaterials, createCarPaintMaterial }
    ] = await Promise.all([
      import('three'),
      import('../utils/ThreeMonkeyPatches.js'),
      import('../camera/CameraManager.js'),
      import('../entities/BallVisual.js'),
      import('../entities/vehicle/vehiclePaintMaterial.js')
    ]);

    applyThreeMonkeyPatches(THREE);

    activeGameRuntime = await bootstrapGameEngine(host, {
      ...options,
      loader,
      carLoaders: {
        createTruncatedIcosahedronBall: createClassicBall,
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
function destroyEngine() {
  if (activeGameRuntime) {
    activeGameRuntime.destroy();
    activeGameRuntime = null;
  }
}

export {
  bootstrapEngine,
  renderGameFrame,
  destroyEngine,
  activeGameRuntime,
  GameBootstrap,
  bootstrapGameEngine
};

