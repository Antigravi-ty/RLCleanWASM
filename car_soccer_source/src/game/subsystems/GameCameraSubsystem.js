import * as THREE from 'three';
import { hudStore } from '../../ui-system/index';

/**
 * GameCameraSubsystem.js
 * Encapsulates camera dynamics tracking, rear view input detection,
 * ball camera target follow, and HUD arrow orientation.
 */
export class GameCameraSubsystem {
  /**
   * @param {import('../GameRuntime.js').GameRuntime} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    this.scratchGroundNormal = new THREE.Vector3(0, 0, 0);
    this.scratchVelocity = new THREE.Vector3(0, 0, 0);

    this.cameraDynamics = {
      onGround: false,
      groundNormal: this.scratchGroundNormal,
      velocity: this.scratchVelocity,
      supersonic: false,
      lookX: 0,
      lookY: 0
    };

    this.cameraInputState = {
      isRearViewHeld: false
    };
  }

  update(context) {
    const r = this.runtime;
    const { dt, activeCar, activeCarMesh, playerCarView } = context;

    const obsTargetIdx = (
      typeof r.diagnosticObservationTarget === 'number' &&
      r.diagnosticObservationTarget > 0 &&
      r.arena?.cars?.[r.diagnosticObservationTarget]?.visible
    )
      ? r.diagnosticObservationTarget
      : activeCar;

    const targetMesh = obsTargetIdx !== activeCar ? r.arena.cars[obsTargetIdx] : activeCarMesh;
    const targetView = obsTargetIdx !== activeCar
      ? r.interpolator?.getCurrCarStateView(obsTargetIdx)
      : playerCarView;

    if (!r.camera || !targetView) return;

    // 1. Calculate vehicle dynamic forces & orientation
    this.cameraDynamics.onGround = targetView.isOnGround;
    this.cameraDynamics.supersonic = targetView.isSupersonic;
    this.cameraDynamics.carView = targetView;
    this.scratchGroundNormal.set(
      targetView.groundNormalX,
      targetView.groundNormalZ,
      targetView.groundNormalY
    );
    this.scratchVelocity.set(
      targetView.velX,
      targetView.velZ,
      targetView.velY
    );
    this.cameraDynamics.velocity = this.scratchVelocity;

    // 2. Poll Rear View key/gamepad press
    const isRearViewHeld = (r.keyboard?.held?.('rearView') || r.gamepad?.pressed?.('rearView')) ?? false;
    this.cameraInputState.isRearViewHeld = isRearViewHeld;

    // 3. Advance camera orientation & position
    r.camera.update(targetMesh, r.arena?.ball, dt, this.cameraDynamics, this.cameraInputState);

    // 4. Update Ball Locator HUD Arrow
    if (r.arena?.ball) {
      r.arena.updateBallLocatorArrow(r.camera.ballCam, obsTargetIdx, r.arena.ball, targetMesh);
    }

    // 5. Sync Ball Cam state to HUD Store
    hudStore.getState().setBallCamActive(r.camera.ballCam);
  }

  dispose() {
    this.scratchGroundNormal = null;
    this.scratchVelocity = null;
    this.cameraDynamics = null;
  }
}
