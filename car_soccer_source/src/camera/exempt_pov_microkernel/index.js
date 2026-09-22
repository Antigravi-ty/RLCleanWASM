/**
 * index.js
 * Exempt Black Box: Controlled Adapter Entry (Exempt POV Microkernel Controlled Adapter)
 *
 * Exposes strictly controlled adapters for the immutable external POV Camera Microkernel (camera.wasm).
 * Encapsulates the WASM binary SHA-256 verification and strict ABI contract check.
 */

export {
  CameraMicrokernel,
  loadCameraMicrokernel,
  getCachedCameraMicrokernel,
  clearCachedCameraMicrokernel,
  verifyCameraMicrokernelIntegrity,
  formatMicrokernelErrorHtml,
  computeSha256,
  EXPECTED_CAMERA_WASM_HASH,
  CAMERA_VIEW_BUFFER_FLOATS,
  CAMERA_VIEW_BUFFER_BYTES
} from './CameraMicrokernel.js';

export {
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
} from './PovCameraController.js';

export { default } from './CameraMicrokernel.js';
