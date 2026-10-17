/**
 * DiagnosticsTestVehicles.js
 * Pure, zero-dependency deterministic control generators and Zero-G anchor coordinator
 * for the 3 Lobby Network Quality Diagnostic Vehicles (Zero-G / Warmup Network Preview Lab):
 *
 * 1. BOOST_PULSE (Car 1): Periodic boost pulse (unpredictable discrete impulse behavior)
 *    - Fires boost for 15 ticks every 60 ticks (2 Hz pulse at 120Hz tick rate).
 *    - Allows clients to visually & numerically inspect discrete impulse packet loss and rollback.
 * 2. QE_ROLL (Car 2): Continuous Q/E air-roll (predictable constant angular velocity behavior)
 *    - Applies steady roll (+1.0 Q / -1.0 E) to diagnose interpolation smoothness & jitter.
 * 3. SINE_STEER (Car 3): Sinusoidal left-right weaving / yaw-pitch oscillation
 *    - Applies smooth sinusoidal steering/yaw/pitch to diagnose extrapolation lead-tick accuracy.
 */

import {
  ZERO_G_ANCHOR_MODES,
  DIAGNOSTIC_OBSERVATION_TARGETS,
  getProbeAltitudeControllerState,
  configureZeroGVehiclePhysics,
  releaseZeroGVehiclePhysics,
  setLobbyGhostCarIsolation,
  enforceZeroGFleetConstraints,
  sampleDiagnosticFleetTelemetry
} from './diagnostics/ZeroGDiagnosticLab.js';

export {
  ZERO_G_ANCHOR_MODES,
  DIAGNOSTIC_OBSERVATION_TARGETS,
  getProbeAltitudeControllerState,
  configureZeroGVehiclePhysics,
  releaseZeroGVehiclePhysics,
  setLobbyGhostCarIsolation,
  enforceZeroGFleetConstraints,
  sampleDiagnosticFleetTelemetry
};

export const DIAGNOSTIC_VEHICLE_PROFILES = Object.freeze({
  BOOST_PULSE: 'boost_pulse',
  QE_ROLL: 'qe_roll',
  SINE_STEER: 'sine_steer'
});

export const DEFAULT_DIAGNOSTIC_FLEET = Object.freeze([
  Object.freeze({
    carIndex: 6,
    team: 1,
    profile: DIAGNOSTIC_VEHICLE_PROFILES.BOOST_PULSE,
    label: 'Car 7: Boost Altitude Probe (Z0=500 -> Z1=800 Damped)',
    baseAltitudeZ: 500,
    peakAltitudeZ: 800,
    spawnPos: Object.freeze({ x: 4500, y: -350, z: 500 })
  }),
  Object.freeze({
    carIndex: 7,
    team: 0,
    profile: DIAGNOSTIC_VEHICLE_PROFILES.QE_ROLL,
    label: 'Car 8: QE Air-Roll Probe (3s Periodic Roll Switch)',
    spawnPos: Object.freeze({ x: 4500, y: 350, z: 500 })
  })
]);

/**
 * Generates deterministic 120Hz controls for a diagnostic vehicle profile at `tick`.
 *
 * @param {string} profile - One of DIAGNOSTIC_VEHICLE_PROFILES
 * @param {number} tick - Authoritative 120Hz simulation tick
 * @param {object} [options={}]
 * @returns {object} Standard 8-channel RocketSim CarControls object
 */
export function computeDiagnosticVehicleControls(profile, tick, options = {}) {
  const safeTick = Math.max(0, Math.floor(tick || 0));

  switch (profile) {
    case DIAGNOSTIC_VEHICLE_PROFILES.BOOST_PULSE: {
      const z0 = options.baseAltitudeZ ?? 500;
      const z1 = options.peakAltitudeZ ?? 800;
      const st = getProbeAltitudeControllerState(options.carIndex ?? 6);
      const posZ = Number.isFinite(options.posZ) ? options.posZ : st.posZ;
      const velZ = Number.isFinite(options.velZ) ? options.velZ : st.velZ;
      const mode = options.climbMode || st.mode;

      let isBoosting = false;
      if (options.anchorMode === ZERO_G_ANCHOR_MODES.ZERO_G_LOCKED) {
        const periodTicks = options.periodTicks || 60;
        const dutyTicks = options.dutyTicks || 15;
        isBoosting = (safeTick % periodTicks) < dutyTicks;
      } else {
        const targetZ = (mode === 'CLIMB_Z1' || mode === 'HOLD_Z1') ? z1 : z0;
        const diffZ = targetZ - posZ;

        if (velZ > 0) {
          // Braking distance under gravity (-650 uu/s^2)
          const predPeak = posZ + (velZ * velZ) / 1300;
          if (predPeak < targetZ - 10) {
            isBoosting = true;
          } else if (predPeak >= targetZ) {
            isBoosting = false;
          } else {
            isBoosting = diffZ > 0 && velZ < 250;
          }
        } else {
          // Falling under gravity; braking with boost (+410 net uu/s^2)
          const brakeDist = (velZ * velZ) / 820;
          if (posZ - brakeDist <= targetZ || (diffZ > 5 && velZ < -15)) {
            isBoosting = true;
          }
        }

        // Fine hover duty cycle around target altitude
        if (Math.abs(diffZ) <= 18 && Math.abs(velZ) <= 45) {
          isBoosting = (safeTick % 5) < 3; // ~60% duty cycle matches gravity/boost ratio
        }
      }

      return {
        throttle: isBoosting ? 1.0 : 0.0,
        steer: 0.0,
        pitch: 0.0,
        yaw: 0.0,
        roll: 0.0,
        jump: false,
        boost: isBoosting,
        handbrake: false
      };
    }

    case DIAGNOSTIC_VEHICLE_PROFILES.QE_ROLL: {
      const reverseEveryTicks = options.reverseEveryTicks || 360; // Flip Q/E every 3s at 120Hz
      const rollDir = Math.floor(safeTick / reverseEveryTicks) % 2 === 0 ? 1.0 : -1.0;
      return {
        throttle: 0.0,
        steer: 0.0,
        pitch: 0.0,
        yaw: 0.0,
        roll: rollDir,
        jump: false,
        boost: false,
        handbrake: false
      };
    }

    case DIAGNOSTIC_VEHICLE_PROFILES.SINE_STEER: {
      const periodTicks = options.periodTicks || 120; // 1.0s full sine wave at 120Hz
      const angle = (safeTick * 2 * Math.PI) / periodTicks;
      const steerVal = Number(Math.sin(angle).toFixed(4));
      const pitchVal = Number((0.45 * Math.cos(angle * 0.5)).toFixed(4));
      return {
        throttle: options.throttle ?? 0.6,
        steer: steerVal,
        pitch: pitchVal,
        yaw: steerVal,
        roll: 0.0,
        jump: false,
        boost: false,
        handbrake: false
      };
    }

    default:
      console.warn(`[DiagnosticsTestVehicles:Fallback] Unknown profile "${profile}", returning neutral controls.`);
      return {
        throttle: 0.0,
        steer: 0.0,
        pitch: 0.0,
        yaw: 0.0,
        roll: 0.0,
        jump: false,
        boost: false,
        handbrake: false
      };
  }
}

/**
 * Coordinates the externalized deterministic diagnostic vehicles for network quality inspection.
 */
export class DiagnosticsTestVehicleController {
  constructor(fleet = DEFAULT_DIAGNOSTIC_FLEET, options = {}) {
    this.fleet = fleet;
    this.enabled = false;
    this.anchorMode = options.anchorMode || ZERO_G_ANCHOR_MODES.Z_HOVER;
  }

  /**
   * Locks all diagnostic vehicles into their externalized 0G / Z-Hover anchors and disables collision masks.
   * @param {object} target - RocketSimPhysicsEngine, PhysicsEngineManager, or HostServerWorker
   * @param {string} [anchorMode=this.anchorMode]
   */
  configurePhysics(target, anchorMode = this.anchorMode) {
    this.anchorMode = anchorMode || ZERO_G_ANCHOR_MODES.Z_HOVER;
    return configureZeroGVehiclePhysics(target, this.fleet, this.anchorMode);
  }

  /**
   * Releases 0G linear factor locks and parks diagnostic vehicle slots on `target`.
   * @param {object} target
   */
  releasePhysics(target) {
    return releaseZeroGVehiclePhysics(target, this.fleet);
  }

  /**
   * Computes a map of `{ carIndex, profile, controls }` for the given tick.
   * @param {number} tick
   * @returns {Array<{carIndex: number, profile: string, controls: object}>}
   */
  stepTick(tick) {
    const outputs = [];
    for (let i = 0; i < this.fleet.length; i++) {
      const spec = this.fleet[i];
      const controls = computeDiagnosticVehicleControls(spec.profile, tick, {
        carIndex: spec.carIndex,
        baseAltitudeZ: spec.baseAltitudeZ ?? 500,
        peakAltitudeZ: spec.peakAltitudeZ ?? 800,
        anchorMode: this.anchorMode
      });
      outputs.push({
        carIndex: spec.carIndex,
        team: spec.team,
        profile: spec.profile,
        controls
      });
    }
    return outputs;
  }

  /**
   * Applies the diagnostic vehicle controls and 0G/boost constraints to a PhysicsEngineManager,
   * RocketSimPhysicsEngine, or HostServerWorker.
   * @param {object} target
   * @param {number} tick
   */
  applyToAuthority(target, tick) {
    if (!target) return [];
    enforceZeroGFleetConstraints(target, this.fleet, this.anchorMode);
    const batch = this.stepTick(tick);
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (typeof target.setDirectCarControls === 'function') {
        target.setDirectCarControls(item.carIndex, item.controls);
      } else if (typeof target.setCarControls === 'function') {
        target.setCarControls(item.carIndex, item.controls);
      } else if (typeof target.setControls === 'function') {
        target.setControls(item.carIndex, item.controls);
      }
    }
    return batch;
  }
}
