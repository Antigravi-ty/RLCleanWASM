/**
 * CameraController.js
 * Controlled Adapter facade redirecting to the immutable POV Camera Microkernel zone.
 *
 * Microkernel implementation has been moved and consolidated to:
 * src/camera/exempt_pov_microkernel/
 */

export {
  CameraMicrokernel,
  loadCameraMicrokernel,
  getCachedCameraMicrokernel,
  clearCachedCameraMicrokernel,
  verifyCameraMicrokernelIntegrity,
  computeSha256,
  EXPECTED_CAMERA_WASM_HASH,
  CAMERA_VIEW_BUFFER_FLOATS,
  CAMERA_VIEW_BUFFER_BYTES,
  PovCameraController,
  CameraController,
  POVCameraController,
  CAMERA_INPUT_SIZE,
  CAMERA_POS_OFFSET,
  CAMERA_DIR_OFFSET,
  CAMERA_UP_OFFSET,
  CAMERA_FOV_OFFSET,
  TOTAL_VIEW_BUFFER_SIZE,
  CAMERA_FLAG_ON_GROUND,
  CAMERA_FLAG_GROUND_NORMAL,
  CAMERA_FLAG_VELOCITY,
  CAMERA_FLAG_SUPERSONIC,
  CAMERA_INPUT_INDICES,
  SimpleVector3,
  SimplePerspectiveCamera,
  setCameraThreeContext,
  resolveVector3Class,
  resolveCameraClass
} from './exempt_pov_microkernel/index.js';

export { CameraManager, CAMERA_MODES } from './CameraManager.js';
export { RearViewCamera } from './RearViewCamera.js';
export { default } from './exempt_pov_microkernel/index.js';
