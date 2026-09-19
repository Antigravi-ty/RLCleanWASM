/**
 * CameraManager.js
 * Unified Camera Dispatcher & Lifecycle Orchestrator for Car Soccer.
 *
 * Implements strict architectural decoupling:
 * 1. Context-Free Isolation:
 *    Controllers are independent black boxes. No transform history is preserved or passed.
 *    Mode switching is strictly an instant hard cut with zero cross-controller blending.
 * 2. Exclusive Pipeline Takeover:
 *    Lazy evaluation ensures only the currently active controller computes frame updates.
 *    Exactly one controller outputs to the camera in any render frame.
 * 3. Event Delegation & Encapsulation:
 *    Manager delegates events (e.g. ballCam toggle) to the owning controller.
 *    Controller internal state machines handle transitions internally.
 * 4. Extensible Dispatching:
 *    Pre-configured for POV and Rear View, ready for Free/Orbit/Spectator modes.
 */

import { CameraController, SimplePerspectiveCamera, SimpleVector3, resolveCameraClass, resolveVector3Class } from './CameraController.js';
import { RearViewCamera } from './RearViewCamera.js';
import { DEFAULT_CAMERA_SETTINGS } from '../ui/SettingsSheet.js';

export const CAMERA_MODES = Object.freeze({
  POV: 'pov',
  REAR_VIEW: 'rearView'
});

export class CameraManager {
  /**
   * @param {number} aspect - Camera aspect ratio (width / height)
   * @param {object|null} kernel - CameraMicrokernel or RocketSimPhysicsEngine
   * @param {object|null} threeContext - Optional Three.js constructor injection
   * @param {object|null} [options]
   */
  constructor(
    aspect = (typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9),
    kernel = null,
    threeContext = null,
    options = {}
  ) {
    this.threeContext = threeContext;
    this.settings = options.settings || { ...DEFAULT_CAMERA_SETTINGS };

    // Resolve Camera class for shared render camera instance
    const CameraClass = resolveCameraClass(threeContext);
    this._sharedCamera = new CameraClass(this.settings.fov, aspect, 4, 40000);

    // Registered camera controllers map
    this.controllers = new Map();

    // 1. POV Camera Controller (Legacy microkernel-backed Car Cam & Ball Cam)
    const povController = new CameraController(aspect, kernel, threeContext, this._sharedCamera);
    povController.settings = this.settings;
    this.controllers.set(CAMERA_MODES.POV, povController);

    // 2. Rear View Camera Controller (Pure JS detached rear view)
    const rearController = new RearViewCamera(aspect, this.settings, threeContext, this._sharedCamera);
    this.controllers.set(CAMERA_MODES.REAR_VIEW, rearController);

    // Initial active mode
    this.activeMode = CAMERA_MODES.POV;
  }

  /**
   * Get the primary Three.js camera instance used by the renderer and post-processing
   */
  get camera() {
    return this._sharedCamera;
  }

  /**
   * Get current active mode key ('pov' | 'rearView')
   */
  get currentMode() {
    return this.activeMode;
  }

  /**
   * Get currently active camera controller instance
   */
  get activeController() {
    return this.controllers.get(this.activeMode);
  }

  /**
   * Atomic Instant Hard Switch between camera modes.
   * Context-free: does not transfer transforms from previous controller.
   * @param {string} newMode
   */
  setActiveMode(newMode) {
    if (this.activeMode === newMode) return;
    if (!this.controllers.has(newMode)) {
      console.warn(`[CameraManager] Unknown camera mode: ${newMode}`);
      return;
    }

    this.activeMode = newMode;
    const activated = this.controllers.get(newMode);
    if (typeof activated.resetView === 'function') {
      activated.resetView();
    }
  }

  /**
   * Event Delegation: Delegate input action to the appropriate controller.
   * @param {string} actionId
   * @param {any} [eventData]
   */
  handleAction(actionId, eventData = null) {
    if (actionId === 'ballCam') {
      return this.toggleBallCam();
    }
    const current = this.activeController;
    if (typeof current?.handleAction === 'function') {
      return current.handleAction(actionId, eventData);
    }
    return false;
  }

  /**
   * Ball Cam status query (delegated to POV controller)
   */
  get ballCam() {
    return this.controllers.get(CAMERA_MODES.POV)?.ballCam ?? false;
  }

  /**
   * Ball Cam status mutation (delegated to POV controller)
   */
  set ballCam(value) {
    const pov = this.controllers.get(CAMERA_MODES.POV);
    if (pov) {
      pov.ballCam = Boolean(value);
    }
  }

  /**
   * Toggle Ball Cam state on POV controller
   * @returns {boolean} New ballCam state
   */
  toggleBallCam() {
    const pov = this.controllers.get(CAMERA_MODES.POV);
    return pov ? pov.toggleBallCam() : false;
  }

  /**
   * Reset view on active controller
   */
  resetView() {
    const current = this.activeController;
    if (typeof current?.resetView === 'function') {
      current.resetView();
    }
  }

  /**
   * Viewport resize delegation
   */
  resize(width, height) {
    for (const controller of this.controllers.values()) {
      if (typeof controller.resize === 'function') {
        controller.resize(width, height);
      }
    }
    if (this._sharedCamera && height > 0) {
      this._sharedCamera.aspect = width / height;
      this._sharedCamera.updateProjectionMatrix();
    }
  }

  /**
   * Frame Step: Exclusive pipeline takeover with lazy evaluation.
   *
   * @param {object} carObject - 3D vehicle object
   * @param {object} ballObject - 3D ball object
   * @param {number} dt - Delta time
   * @param {object} [extraInfo] - Vehicle physical telemetry
   * @param {object} [inputState] - Optional input queries ({ isRearViewHeld })
   */
  update(carObject, ballObject, dt = 0, extraInfo = null, inputState = null) {
    // 1. Route active mode based on input state
    if (inputState?.isRearViewHeld) {
      this.setActiveMode(CAMERA_MODES.REAR_VIEW);
    } else {
      this.setActiveMode(CAMERA_MODES.POV);
    }

    // 2. Exclusive Execution: ONLY the active controller calculates its pipeline
    const controller = this.activeController;
    if (controller && typeof controller.update === 'function') {
      controller.update(carObject, ballObject, dt, extraInfo);
    }
  }

  dispose() {
    this.destroy();
  }

  destroy() {
    for (const controller of this.controllers.values()) {
      if (typeof controller.dispose === 'function') {
        controller.dispose();
      }
    }
    this.controllers.clear();
    this._sharedCamera = null;
    this.settings = null;
  }
}
