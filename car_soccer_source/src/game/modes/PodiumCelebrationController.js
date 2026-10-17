/**
 * PodiumCelebrationController.js
 * Post-Match Podium Showcase & Celebration Controller.
 *
 * Orchestrates Rocket League-style post-match podium celebrations:
 * - Arranges active cars on symmetrical V-formation pedestals facing the showcase camera.
 * - Locks horizontal X/Y translation via `engine.setCarLinearFactorAndGravity(carIndex, 0, 0, 1, 1)`
 *   so vehicles cannot drive off the podium while retaining Z-axis jumping, double-jumping,
 *   dodging, air-roll spins, and boost plume effects.
 * - Drives celebratory AI bot stunts and smooth Podium Showcase camera framing.
 */

import * as THREE from 'three';
import { FIXED_TIMESTEP, MAX_PHYSICS_SUBSTEPS } from '../../physics/RocketSimConstants.js';
import {
  PODIUM_FORMATION_SPOTS,
  PODIUM_CAMERA_POSE,
  applyPodiumFormationToEngine,
  releasePodiumLocksOnEngine
} from '../../replay/PodiumPhysicsHelper.js';

export {
  PODIUM_FORMATION_SPOTS,
  PODIUM_CAMERA_POSE,
  applyPodiumFormationToEngine,
  releasePodiumLocksOnEngine
};

export class PodiumCelebrationController {
  /**
   * @param {import('../GameRuntime.js').GameRuntime} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    this.isActive = false;
    this.winningTeam = 0;
    this.winReason = 'SCORE';
    this.elapsedSeconds = 0;
    this.accumulator = 0;
    this.podiumTick = 0;

    this._cameraPos = new THREE.Vector3();
    this._cameraLookAt = new THREE.Vector3();
  }

  /**
   * Activates Post-Match Podium mode, places cars onto podium pedestals,
   * and locks horizontal X/Y translation (`setCarLinearFactorAndGravity(c, 0, 0, 1, 1)`).
   *
   * @param {number|string} [winningTeam=0] - 0 / 'BLUE', 1 / 'ORANGE', or 2 / 'DRAW'
   * @param {string} [winReason='SCORE']
   */
  enterPodium(winningTeam = 0, winReason = 'SCORE') {
    const r = this.runtime;
    const resolvedTeam = winningTeam === 'ORANGE' || winningTeam === 1
      ? 1
      : (winningTeam === 'DRAW' || winningTeam === 2 ? 2 : 0);

    this.isActive = true;
    this.winningTeam = resolvedTeam;
    this.winReason = winReason || 'SCORE';
    this.elapsedSeconds = 0;
    this.accumulator = 0;
    this.podiumTick = 0;

    if (r?.physics) {
      applyPodiumFormationToEngine(r.physics, resolvedTeam);
      r.interpolator?.sync?.();
    }
    r?.arena?.resetBallTrail?.();
  }

  /**
   * Exits Podium mode and restores full 3D movement (`setCarLinearFactorAndGravity(c, 1, 1, 1, 1)`).
   */
  exitPodium() {
    if (!this.isActive) return;
    this.isActive = false;
    this.accumulator = 0;
    this.podiumTick = 0;
    if (this.runtime?.physics) {
      releasePodiumLocksOnEngine(this.runtime.physics);
    }
  }

  /**
   * Generates rhythmic celebratory jump, spin, and boost controls for AI bots on the podium.
   * @param {number} tick
   * @param {number} carIndex
   */
  _computeBotCelebrationControls(tick, carIndex = 1) {
    const phase = (tick + carIndex * 45) % 240;
    const isJumpPulse = phase === 10 || phase === 11 || phase === 32 || phase === 33;
    const isAirborneSpin = phase > 12 && phase < 150;
    const isBoosting = isAirborneSpin && (phase % 16 < 11);

    return {
      throttle: 1.0,
      steer: Math.sin(tick * 0.05 + carIndex),
      pitch: isAirborneSpin ? 0.65 : 0.0,
      yaw: isAirborneSpin ? 0.85 : 0.0,
      roll: isAirborneSpin ? (carIndex % 2 === 0 ? 1.0 : -1.0) : 0.0,
      jump: isJumpPulse,
      boost: isBoosting,
      handbrake: false
    };
  }

  /**
   * Steps podium celebration physics and input polling during `matchPhase === 'podium'`.
   * @param {object} context
   */
  update(context) {
    const r = this.runtime;
    if (!r || !r.physics) return;

    if (!this.isActive) {
      const w = r.match?.state?.winner ?? 0;
      this.enterPodium(w, r.match?.state?.winReason || 'SCORE');
    }

    const dt = Math.min(Math.max(context?.dt ?? FIXED_TIMESTEP, 0), 0.1);
    this.elapsedSeconds += dt;
    this.accumulator += dt;

    // Read live player celebration controls (jump, boost, pitch, yaw, roll)
    const kbReading = r.keyboard?.read?.() || r.neutralControls;
    const padReading = r.gamepad?.read?.() || r.neutralControls;
    const activeDevice = r.gamepad?.active?.() ? 'gamepad' : 'keyboard';
    const playerControls = activeDevice === 'gamepad' ? padReading : kbReading;

    r.playerControls = playerControls;
    r.playerThrottle = playerControls.throttle || 0;

    let substeps = Math.floor(this.accumulator / FIXED_TIMESTEP);
    this.accumulator = Math.max(0, this.accumulator - substeps * FIXED_TIMESTEP);
    if (substeps > MAX_PHYSICS_SUBSTEPS) {
      substeps = MAX_PHYSICS_SUBSTEPS;
    }

    const numCars = Math.min(r.physics.numCars || 1, 6);
    for (let i = 0; i < substeps; i++) {
      this.podiumTick++;
      r.physics.setControls(r.playerCarIndex, playerControls);

      if (r.networkReconciler) {
        r.networkReconciler.sendOutboundInputForTick?.(
          Math.floor(r.physics.getHeaderView().tickCount),
          r.playerCarIndex,
          playerControls
        );
      }

      for (let c = 0; c < numCars; c++) {
        if (c === r.playerCarIndex) continue;
        if (r.authoritativeServer || (!r.networkReconciler && c === 1)) {
          const botCtrl = this._computeBotCelebrationControls(this.podiumTick, c);
          r.botControls = botCtrl;
          r.physics.setControls(c, botCtrl);
          r.authoritativeServer?.setCarControls?.(c, botCtrl);
        }
      }

      // Only step local physics directly when NOT driven by an active networkReconciler
      if (!r.networkReconciler) {
        if (r.interpolator) {
          r.interpolator.prevState.set(r.interpolator.currState);
        }
        r.physics.step(1);
        if (r.interpolator) {
          r.interpolator.currState.set(r.physics.state);
        }
      }
    }

    if (r.interpolator && !r.networkReconciler) {
      r.interpolator.alpha = Math.min(1.0, this.accumulator / FIXED_TIMESTEP);
    }
  }

  /**
   * Positions the Three.js camera in front of the Podium Showcase pedestals.
   * Note: Three.js coordinate mapping from Unreal is (X -> X, Z -> Y [up], Y -> Z [forward]).
   *
   * @param {import('../../camera/CameraManager.js').CameraManager} cameraManager
   * @param {number} [dt=0.016]
   */
  updateCamera(cameraManager, dt = 0.016) {
    const cam = cameraManager?.camera;
    if (!cam) return;

    const sway = Math.sin(this.elapsedSeconds * 0.45) * 55.0;
    const desiredX = PODIUM_CAMERA_POSE.eyeX + sway;
    const desiredY = PODIUM_CAMERA_POSE.eyeZ; // Unreal Z -> Three.js Y (up)
    const desiredZ = PODIUM_CAMERA_POSE.eyeY; // Unreal Y -> Three.js Z

    const targetX = PODIUM_CAMERA_POSE.targetX;
    const targetY = PODIUM_CAMERA_POSE.targetZ; // Unreal Z -> Three.js Y (up)
    const targetZ = PODIUM_CAMERA_POSE.targetY; // Unreal Y -> Three.js Z

    const blend = Math.min(1.0, Math.max(0.08, dt * 6.0));
    if (this.elapsedSeconds <= dt * 1.5) {
      this._cameraPos.set(desiredX, desiredY, desiredZ);
      this._cameraLookAt.set(targetX, targetY, targetZ);
    } else {
      this._cameraPos.x += (desiredX - this._cameraPos.x) * blend;
      this._cameraPos.y += (desiredY - this._cameraPos.y) * blend;
      this._cameraPos.z += (desiredZ - this._cameraPos.z) * blend;
      this._cameraLookAt.set(targetX, targetY, targetZ);
    }

    cam.position.copy(this._cameraPos);
    cam.lookAt(this._cameraLookAt);
  }
}

export default PodiumCelebrationController;
