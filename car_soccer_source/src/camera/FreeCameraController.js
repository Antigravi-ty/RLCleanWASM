/**
 * FreeCameraController.js
 * Decoupled, high-performance Free Flying Camera Controller for Car Soccer & Stadium Tuning.
 *
 * Controls:
 * - Movement: WASD (Forward, Strafe Left, Backward, Strafe Right relative to view direction)
 * - Elevation: I (Up / Elevate), M (Down / Lower) [Also Space / Q as aliases]
 * - Boost: Hold Shift to accelerate movement (2.5x speed)
 * - Look: Mouse drag (left or right click and drag anywhere on viewport)
 * - FOV: Configurable via UI tuner slider and programmatic setter
 */

import { SimplePerspectiveCamera, SimpleVector3, resolveCameraClass, resolveVector3Class } from './CameraController.js';
import { useUIStore } from '../ui-system/core/store.ts';

export class FreeCameraController {
  /**
   * @param {number} aspect - Viewport aspect ratio
   * @param {object} [settings] - Camera settings reference
   * @param {object|null} [threeContext] - Optional Three.js context
   * @param {object|null} [existingCamera] - Shared PerspectiveCamera instance
   */
  constructor(
    aspect = (typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9),
    settings = null,
    threeContext = null,
    existingCamera = null
  ) {
    this.Vector3Class = resolveVector3Class(threeContext);
    const CameraClass = resolveCameraClass(threeContext);

    this.settings = settings || {};
    this._fov = 80;

    // Use shared camera if provided, else create standalone
    this.camera = existingCamera || new CameraClass(this._fov, aspect, 4, 40000);

    // Dynamic vectors for calculations
    // Initial spectator overview coordinates overlooking the pitch
    this.camPosition = new this.Vector3Class(0, 1600, -3600);
    this.forward = new this.Vector3Class(0, 0, 1);
    this.planarForward = new this.Vector3Class(0, 0, 1);
    this.right = new this.Vector3Class(1, 0, 0);
    this.up = new this.Vector3Class(0, 1, 0);
    this.target = new this.Vector3Class(0, 0, 0);
    this.moveVector = new this.Vector3Class(0, 0, 0);

    this.yaw = 0;
    this.pitch = -0.35;
    this.syncOrientationVectors();

    this.moveSpeed = 2400; // world units per second
    this.boostMultiplier = 2.5;
    this.mouseSensitivity = 0.0026;

    this.isFreeCamActive = false;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.activeKeys = new Set();

    this.boundKeyDown = this._onKeyDown.bind(this);
    this.boundKeyUp = this._onKeyUp.bind(this);
    this.boundPointerDown = this._onPointerDown.bind(this);
    this.boundPointerMove = this._onPointerMove.bind(this);
    this.boundPointerUp = this._onPointerUp.bind(this);
    this.boundBlur = this._onBlur.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('pointerdown', this.boundPointerDown);
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
      window.addEventListener('blur', this.boundBlur);
    }
  }

  get fov() {
    return this._fov;
  }

  set fov(val) {
    const num = Number(val);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      this._fov = Math.max(10, Math.min(140, num));
      if (this.camera) {
        this.camera.fov = this._fov;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  /**
   * Called when switching into Free Cam mode.
   * Retains its own last coordinates and view direction (persists across activations).
   */
  onActivate() {
    this.isFreeCamActive = true;
    if (this.camera) {
      this.syncOrientationVectors();
      this.camera.position.copy(this.camPosition);
      this.target.copy(this.camPosition).add(this.forward);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.target);
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Reset position to default stadium spectator overview coordinates
   */
  resetToDefaultOverview() {
    this.camPosition.set(0, 1600, -3600);
    this.yaw = 0;
    this.pitch = -0.35;
    this.syncOrientationVectors();
    if (this.camera) {
      this.camera.position.copy(this.camPosition);
      this.target.copy(this.camPosition).add(this.forward);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.target);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Called when switching out of Free Cam mode.
   */
  onDeactivate() {
    this.isFreeCamActive = false;
    this.isDragging = false;
    this.activeKeys.clear();
  }

  resetView() {
    this.onActivate();
  }

  syncOrientationVectors() {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);

    // View direction vector (forward)
    this.forward.set(-sy * cp, sp, -cy * cp).normalize();

    // Horizontal planar forward vector (pure XZ plane, zero vertical Y displacement)
    this.planarForward.set(-sy, 0, -cy).normalize();

    // Horizontal right vector (perpendicular to yaw heading)
    this.right.set(cy, 0, -sy).normalize();
  }

  _isTargetInUI(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'button, input, select, textarea, [role="button"], [role="switch"], [role="dialog"], [role="tab"], .floating-window, #game-ui-root, .hud-tools'
      )
    );
  }

  _onKeyDown(e) {
    if (!this.isFreeCamActive) return;

    // Do not capture keys while user is typing in form inputs
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    const code = e.code;

    // FOV adjustment shortcuts: Minus (-) decreases FOV by 5 deg, Equal (= / +) increases FOV by 5 deg
    if (code === 'Minus' || e.key === '-' || e.key === '_') {
      e.preventDefault();
      const newFov = Math.max(10, Math.min(140, this._fov - 5));
      this.fov = newFov;
      useUIStore.setState({ freeCamFov: newFov });
      return;
    }
    if (code === 'Equal' || e.key === '=' || e.key === '+') {
      e.preventDefault();
      const newFov = Math.max(10, Math.min(140, this._fov + 5));
      this.fov = newFov;
      useUIStore.setState({ freeCamFov: newFov });
      return;
    }

    const tracked = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyI', 'KeyM', 'Space', 'KeyQ', 'ShiftLeft', 'ShiftRight'];
    if (tracked.includes(code)) {
      this.activeKeys.add(code);
      if (code === 'KeyI' || code === 'KeyM') {
        e.preventDefault();
      }
    }
  }

  _onKeyUp(e) {
    this.activeKeys.delete(e.code);
  }

  _onPointerDown(e) {
    if (!this.isFreeCamActive) return;
    if (this._isTargetInUI(e.target)) return;

    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  _onPointerMove(e) {
    if (!this.isFreeCamActive || !this.isDragging) return;

    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;

    // Clamp pitch to avoid gimbal lock / flipping upside down
    const maxPitch = (Math.PI / 2) - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.syncOrientationVectors();
  }

  _onPointerUp() {
    this.isDragging = false;
  }

  _onBlur() {
    this.activeKeys.clear();
    this.isDragging = false;
  }

  resize(width, height) {
    if (this.camera && height > 0) {
      this.camera.aspect = width / height;
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Per-frame physics/render step update
   */
  update(carObject, ballObject, dt = 0, extraInfo = null) {
    if (!this.isFreeCamActive) return;

    const safeDt = Math.max(0.001, Math.min(0.1, dt || (1 / 60)));

    let speed = this.moveSpeed;
    if (this.activeKeys.has('ShiftLeft') || this.activeKeys.has('ShiftRight')) {
      speed *= this.boostMultiplier;
    }

    this.moveVector.set(0, 0, 0);

    // WASD: Forward / Backward horizontally along camera yaw heading, Strafe Left / Right
    if (this.activeKeys.has('KeyW')) {
      this.moveVector.add(this.planarForward);
    }
    if (this.activeKeys.has('KeyS')) {
      this.moveVector.sub(this.planarForward);
    }
    if (this.activeKeys.has('KeyD')) {
      this.moveVector.add(this.right);
    }
    if (this.activeKeys.has('KeyA')) {
      this.moveVector.sub(this.right);
    }

    // I and M for vertical elevation (I = Up, M = Down)
    if (this.activeKeys.has('KeyI') || this.activeKeys.has('Space')) {
      this.moveVector.y += 1.0;
    }
    if (this.activeKeys.has('KeyM') || this.activeKeys.has('KeyQ')) {
      this.moveVector.y -= 1.0;
    }

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize();
      this.camPosition.addScaledVector(this.moveVector, speed * safeDt);
    }

    this.camera.position.copy(this.camPosition);
    this.target.copy(this.camPosition).add(this.forward);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);

    if (Math.abs(this.camera.fov - this._fov) > 0.01) {
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    this.isFreeCamActive = false;
    this.activeKeys.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
      window.removeEventListener('pointerdown', this.boundPointerDown);
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
      window.removeEventListener('blur', this.boundBlur);
    }
    this.camera = null;
    this.settings = null;
  }
}
