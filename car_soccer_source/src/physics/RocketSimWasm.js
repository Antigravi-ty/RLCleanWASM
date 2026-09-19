/**
 * RocketSim WebAssembly Bridge Loader
 * Loads core physics WASM microkernel (core.wasm) located directly in physics module.
 * Provides complete backward compatibility and first-class secondary development support.
 */
import loadDirectRocketSimWasm from './core.js';

let cachedInstance = null;

export async function loadRocketSimWasmModule(moduleArg = {}) {
  const isIsolated = moduleArg.freshInstance || moduleArg.isolated;
  if (cachedInstance && !isIsolated) {
    return cachedInstance;
  }

  const options = { ...moduleArg };
  const userLocateFile = options.locateFile;
  options.locateFile = (path, scriptDirectory) => {
    // Direct physics simulation wasm binary strictly to core.wasm
    const target = 'core.wasm';
    if (userLocateFile) {
      return userLocateFile(target, scriptDirectory);
    }
    return new URL('./' + target, import.meta.url).href;
  };

  const Module = await loadDirectRocketSimWasm(options);

  // Expose semantic physics methods.
  // Note: POV Camera is strictly decoupled into exempt_pov_microkernel (camera.wasm).
  // Core.wasm is strictly dedicated to rigid-body collision and vehicular simulation.

  Module.physics_init = Module.physics_init || Module._physics_init;
  Module.physics_createArena = Module.physics_createArena || Module._physics_createArena;
  Module.physics_step = Module.physics_step || Module._physics_step;
  Module.physics_stepSilent = Module.physics_stepSilent || Module._physics_stepSilent;
  Module.physics_saveStateSlot = Module.physics_saveStateSlot || Module._physics_saveStateSlot;
  Module.physics_restoreStateSlot = Module.physics_restoreStateSlot || Module._physics_restoreStateSlot;
  Module.physics_saveState = Module.physics_saveState || Module._physics_saveState;
  Module.physics_restoreState = Module.physics_restoreState || Module._physics_restoreState;
  Module.physics_getStateSnapshotSize = Module.physics_getStateSnapshotSize || Module._physics_getStateSnapshotSize;
  Module.physics_resetKickoff = Module.physics_resetKickoff || Module._physics_resetKickoff;
  Module.physics_clearGoalFlag = Module.physics_clearGoalFlag || Module._physics_clearGoalFlag;
  Module.physics_controlBall = Module.physics_controlBall || Module._physics_controlBall;
  Module.physics_setUnlimitedBoost = Module.physics_setUnlimitedBoost || Module._physics_setUnlimitedBoost;
  Module.physics_getStatePtr = Module.physics_getStatePtr || Module._physics_getStatePtr;
  Module.physics_getStateSize = Module.physics_getStateSize || Module._physics_getStateSize;
  Module.physics_getControlsPtr = Module.physics_getControlsPtr || Module._physics_getControlsPtr;
  Module.physics_getPadInfoPtr = Module.physics_getPadInfoPtr || Module._physics_getPadInfoPtr;
  Module.physics_addCar = Module.physics_addCar || Module._physics_addCar;
  Module.physics_getCarConfig = Module.physics_getCarConfig || Module._physics_getCarConfig;
  Module.physics_setCarState = Module.physics_setCarState || Module._physics_setCarState;
  Module.physics_setBallState = Module.physics_setBallState || Module._physics_setBallState;
  Module.physics_getBallOnGround = Module.physics_getBallOnGround || Module._physics_getBallOnGround;
  Module.physics_getBallRadius = Module.physics_getBallRadius || Module._physics_getBallRadius;

  if (!isIsolated) {
    cachedInstance = Module;
  }
  return Module;
}

export default loadRocketSimWasmModule;
