import * as THREE from 'three';
/**
 * PovCameraController.js
 * Exempt Black Box: Decoupled POV Camera Controller
 *
 * Implements high-fidelity 3rd-person follow camera and Ball-Cam controller for RocketSim.
 * Integrates directly with standalone camera microkernel (camera.wasm).
 *
 * Architecture Note:
 * - Strictly zero fallback. All legacy fallback paths (stepFallbackView) have been deleted.
 * - Microkernel output failure triggers immediate fail-fast termination.
 */

import { DEFAULT_CAMERA_SETTINGS } from '../../ui/SettingsSheet.js';
import {
  CameraMicrokernel,
  loadCameraMicrokernel,
  getCachedCameraMicrokernel,
  TOTAL_VIEW_BUFFER_SIZE as KERNEL_VIEW_SIZE
} from './CameraMicrokernel.js';

// RocketSim Camera View Buffer Constants
export const CAMERA_INPUT_SIZE = 32;
export const CAMERA_POS_OFFSET = 32;
export const CAMERA_DIR_OFFSET = 35;
export const CAMERA_UP_OFFSET = 38;
export const CAMERA_FOV_OFFSET = 41;
export const TOTAL_VIEW_BUFFER_SIZE = 42;

// Extra info bitmask flags for RocketSim kernel
export const CAMERA_FLAG_ON_GROUND = 1;
export const CAMERA_FLAG_GROUND_NORMAL = 2;
export const CAMERA_FLAG_VELOCITY = 4;
export const CAMERA_FLAG_SUPERSONIC = 8;

// RocketSim 32-Float64 Camera Input Buffer Indices
export const CAMERA_INPUT_INDICES = {
  DT: 0,
  BALL_CAM: 1,
  CAR_POS_X: 2,
  CAR_POS_Y: 3,
  CAR_POS_Z: 4,
  CAR_QUAT_X: 5,
  CAR_QUAT_Y: 6,
  CAR_QUAT_Z: 7,
  CAR_QUAT_W: 8,
  BALL_POS_X: 9,
  BALL_POS_Y: 10,
  BALL_POS_Z: 11,
  FLAGS: 12,
  ON_GROUND: 13,
  GROUND_NORMAL_X: 14,
  GROUND_NORMAL_Y: 15,
  GROUND_NORMAL_Z: 16,
  VELOCITY_X: 17,
  VELOCITY_Y: 18,
  VELOCITY_Z: 19,
  SUPERSONIC: 20,
  FOV: 21,
  DISTANCE: 22,
  HEIGHT: 23,
  ANGLE_DEG: 24,
  STIFFNESS: 25,
  TRANSITION_SPEED: 26,
  ASPECT: 27,
  LOOK_X: 28,
  LOOK_Y: 29,
  SWIVEL_SPEED: 30,
  INVERT_SWIVEL: 31
};

// Fallback lightweight Vector3 for environments without Three.js loaded
export class SimpleVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  normalize() {
    const len = Math.hypot(this.x, this.y, this.z);
    if (len > 0.00001) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }
  clone() {
    return new SimpleVector3(this.x, this.y, this.z);
  }
}

// Fallback lightweight PerspectiveCamera for headless testing
export class SimplePerspectiveCamera {
  constructor(fov = 110, aspect = 16 / 9, near = 4, far = 40000) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.position = new SimpleVector3();
    this.up = new SimpleVector3(0, 1, 0);
    this.target = new SimpleVector3();
    this.isCamera = true;
    this.isPerspectiveCamera = true;
    this.layers = {
      mask: 1,
      test(layers) {
        return (this.mask & (layers?.mask ?? 1)) !== 0;
      },
      isEnabled(channel) {
        return (this.mask & (1 << channel)) !== 0;
      },
      set(channel) {
        this.mask = (1 << channel) | 0;
      },
      enable(channel) {
        this.mask |= (1 << channel) | 0;
      },
      disable(channel) {
        this.mask &= ~(1 << channel) | 0;
      }
    };
  }
  lookAt(target) {
    this.target.copy(target);
  }
  updateProjectionMatrix() {
    // No-op for headless mock
  }
}

// Context injection for Three.js dependencies
let cameraThreeContext = {
  PerspectiveCamera: null,
  Vector3: null
};

export function setCameraThreeContext(context) {
  cameraThreeContext = { ...cameraThreeContext, ...context };
}

export function resolveVector3Class(customContext) {
  return customContext?.Vector3 || cameraThreeContext?.Vector3 || THREE.Vector3 || SimpleVector3;
}

export function resolveCameraClass(customContext) {
  if (customContext?.PerspectiveCamera) return customContext.PerspectiveCamera;
  if (cameraThreeContext.PerspectiveCamera) return cameraThreeContext.PerspectiveCamera;
  if (typeof THREE !== 'undefined' && THREE.PerspectiveCamera) return THREE.PerspectiveCamera;
  return SimplePerspectiveCamera;
}

/**
 * PovCameraController
 * Dedicated controller driving POV perspective and Ball-Cam exclusively via the WASM microkernel.
 */
export class PovCameraController {
  /**
   * @param {number} aspect - Camera aspect ratio (width / height)
   * @param {object|null} kernel - CameraMicrokernel or RocketSimPhysicsEngine instance
   * @param {object|null} threeContext - Optional Three.js constructor injections
   * @param {object|null} existingCamera - Optional existing camera instance
   */
  constructor(
    aspect = (typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9),
    kernel = null,
    threeContext = null,
    existingCamera = null
  ) {
    const Vector3Class = resolveVector3Class(threeContext);
    const CameraClass = resolveCameraClass(threeContext);

    this.settings = { ...DEFAULT_CAMERA_SETTINGS };
    this._ballCam = true;
    this.input = new Float64Array(CAMERA_INPUT_SIZE);
    this.direction = new Vector3Class();
    this.target = new Vector3Class();

    // Prefer dedicated camera microkernel instance, nested physics cameraKernel, or cached singleton
    this.kernel = (kernel && kernel.cameraKernel) ? kernel.cameraKernel : (kernel || getCachedCameraMicrokernel());

    this.camera = existingCamera || new CameraClass(this.settings.fov, aspect, 4, 40000);

    this.resetView();
  }

  /**
   * Reset internal camera smoothing and perspective filters
   */
  resetView() {
    const viewKernel = this._resolveKernel();
    if (viewKernel && typeof viewKernel.resetView === 'function') {
      viewKernel.resetView();
    }
  }

  /**
   * Resolves active CameraMicrokernel
   * @private
   */
  _resolveKernel() {
    if (this.kernel && typeof this.kernel.stepView === 'function') {
      return this.kernel;
    }
    if (this.kernel && this.kernel.cameraKernel && typeof this.kernel.cameraKernel.stepView === 'function') {
      return this.kernel.cameraKernel;
    }
    const cached = getCachedCameraMicrokernel();
    if (cached && typeof cached.stepView === 'function') {
      this.kernel = cached;
      return cached;
    }
    return null;
  }

  /**
   * Get Ball Cam active status
   */
  get ballCam() {
    return this._ballCam;
  }

  /**
   * Set Ball Cam active status
   */
  set ballCam(value) {
    this._ballCam = Boolean(value);
  }

  /**
   * Toggle Ball Cam state
   * @returns {boolean} New ballCam state
   */
  toggleBallCam() {
    this._ballCam = !this._ballCam;
    return this._ballCam;
  }

  /**
   * Resize camera aspect ratio
   */
  resize(width, height) {
    if (this.camera && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Step camera physics using the external WASM microkernel and update camera transform.
   *
   * @param {object} carObject - Car 3D object (position {x, y, z} and quaternion {x, y, z, w})
   * @param {object} ballObject - Ball 3D object (position {x, y, z})
   * @param {number} dt - Frame delta time in seconds
   * @param {object} [extraInfo] - Vehicle physical telemetry
   */
  update(carObject, ballObject, dt = 0, extraInfo = null) {
    if (!carObject) return;

    const s = this.input;
    s[CAMERA_INPUT_INDICES.DT] = dt;
    s[CAMERA_INPUT_INDICES.BALL_CAM] = this._ballCam ? 1 : 0;
    s[CAMERA_INPUT_INDICES.CAR_POS_X] = carObject.position?.x ?? 0;
    s[CAMERA_INPUT_INDICES.CAR_POS_Y] = carObject.position?.y ?? 0;
    s[CAMERA_INPUT_INDICES.CAR_POS_Z] = carObject.position?.z ?? 0;
    s[CAMERA_INPUT_INDICES.CAR_QUAT_X] = carObject.quaternion?.x ?? 0;
    s[CAMERA_INPUT_INDICES.CAR_QUAT_Y] = carObject.quaternion?.y ?? 0;
    s[CAMERA_INPUT_INDICES.CAR_QUAT_Z] = carObject.quaternion?.z ?? 0;
    s[CAMERA_INPUT_INDICES.CAR_QUAT_W] = carObject.quaternion?.w ?? 1;

    s[CAMERA_INPUT_INDICES.BALL_POS_X] = ballObject?.position?.x ?? 0;
    s[CAMERA_INPUT_INDICES.BALL_POS_Y] = ballObject?.position?.y ?? 0;
    s[CAMERA_INPUT_INDICES.BALL_POS_Z] = ballObject?.position?.z ?? 0;

    let flags = 0;
    if (extraInfo?.onGround !== undefined) flags |= CAMERA_FLAG_ON_GROUND;
    if (extraInfo?.groundNormal) flags |= CAMERA_FLAG_GROUND_NORMAL;
    if (extraInfo?.velocity) flags |= CAMERA_FLAG_VELOCITY;
    if (extraInfo?.supersonic !== undefined) flags |= CAMERA_FLAG_SUPERSONIC;
    s[CAMERA_INPUT_INDICES.FLAGS] = flags;

    s[CAMERA_INPUT_INDICES.ON_GROUND] = (extraInfo && extraInfo.onGround) ? 1 : 0;
    s[CAMERA_INPUT_INDICES.GROUND_NORMAL_X] = extraInfo?.groundNormal?.x ?? 0;
    s[CAMERA_INPUT_INDICES.GROUND_NORMAL_Y] = extraInfo?.groundNormal?.y ?? 0;
    s[CAMERA_INPUT_INDICES.GROUND_NORMAL_Z] = extraInfo?.groundNormal?.z ?? 0;
    s[CAMERA_INPUT_INDICES.VELOCITY_X] = extraInfo?.velocity?.x ?? 0;
    s[CAMERA_INPUT_INDICES.VELOCITY_Y] = extraInfo?.velocity?.y ?? 0;
    s[CAMERA_INPUT_INDICES.VELOCITY_Z] = extraInfo?.velocity?.z ?? 0;
    s[CAMERA_INPUT_INDICES.SUPERSONIC] = (extraInfo && extraInfo.supersonic) ? 1 : 0;

    s[CAMERA_INPUT_INDICES.FOV] = this.settings.fov;
    s[CAMERA_INPUT_INDICES.DISTANCE] = this.settings.distance;
    s[CAMERA_INPUT_INDICES.HEIGHT] = this.settings.height;
    s[CAMERA_INPUT_INDICES.ANGLE_DEG] = this.settings.angleDeg;
    s[CAMERA_INPUT_INDICES.STIFFNESS] = this.settings.stiffness;
    s[CAMERA_INPUT_INDICES.TRANSITION_SPEED] = this.settings.transitionSpeed;
    s[CAMERA_INPUT_INDICES.ASPECT] = this.camera?.aspect ?? (16 / 9);
    s[CAMERA_INPUT_INDICES.LOOK_X] = extraInfo?.lookX ?? 0;
    s[CAMERA_INPUT_INDICES.LOOK_Y] = extraInfo?.lookY ?? 0;
    s[CAMERA_INPUT_INDICES.SWIVEL_SPEED] = this.settings.swivelSpeed;
    s[CAMERA_INPUT_INDICES.INVERT_SWIVEL] = this.settings.invertSwivel ? 1 : 0;

    const viewKernel = this._resolveKernel();
    if (!viewKernel || typeof viewKernel.stepView !== 'function') {
      throw new Error('[FATAL] POV Camera Microkernel required: missing microkernel instance. Pure JS fallback is permanently removed.');
    }

    const output = viewKernel.stepView(s);
    if (!output || output.length < TOTAL_VIEW_BUFFER_SIZE) {
      throw new Error('[FATAL] POV Camera Microkernel output missing or invalid. Pure JS fallback (stepFallbackView) is permanently removed.');
    }

    // 1. Position from camera microkernel
    this.camera.position.set(
      output[CAMERA_POS_OFFSET],
      output[CAMERA_POS_OFFSET + 1],
      output[CAMERA_POS_OFFSET + 2]
    );

    // 2. Direction from camera microkernel
    this.direction.set(
      output[CAMERA_DIR_OFFSET],
      output[CAMERA_DIR_OFFSET + 1],
      output[CAMERA_DIR_OFFSET + 2]
    );

    // 3. Up vector from camera microkernel
    this.camera.up.set(
      output[CAMERA_UP_OFFSET],
      output[CAMERA_UP_OFFSET + 1],
      output[CAMERA_UP_OFFSET + 2]
    );

    // 4. Target lookAt = camera position + forward direction
    this.target.copy(this.camera.position).add(this.direction);
    this.camera.lookAt(this.target);

    // 5. Dynamic FOV update
    const targetFov = output[CAMERA_FOV_OFFSET];
    if (typeof targetFov === 'number' && Math.abs(this.camera.fov - targetFov) > 0.001) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    this.destroy();
  }

  destroy() {
    this.kernel = null;
    this.input = null;
    this.direction = null;
    this.target = null;
    this.camera = null;
  }
}

// Aliases
export const CameraController = PovCameraController;
export const POVCameraController = PovCameraController;
export default PovCameraController;
