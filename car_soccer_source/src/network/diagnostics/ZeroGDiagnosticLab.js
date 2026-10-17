/**
 * src/network/diagnostics/ZeroGDiagnosticLab.js
 * Pure, Worker-safe controller and telemetry evaluator for the 3-Car Zero-G Network Quality Lab
 * and Lobby Ghost Car collision isolation.
 *
 * Uses native C++ WASM extensions exposed on RocketSimPhysicsEngine:
 * - setCarLinearFactorAndGravity(carIndex, fx, fy, fz, gravityScale)
 * - setCarCollisionMask(carIndex, interactWithBall, interactWithCars)
 */

import { CarStateView } from '../../physics/RocketSimStateViews.js';

export const ZERO_G_ANCHOR_MODES = Object.freeze({
  ZERO_G_LOCKED: '0g_locked',
  Z_HOVER: 'z_hover'
});

export const DIAGNOSTIC_OBSERVATION_TARGETS = Object.freeze({
  PLAYER: 0,
  BOOST_PULSE: 6,
  QE_ROLL: 7
});

const _clientCarView = new CarStateView();
const _serverCarView = new CarStateView();
const _probeClimbState = new Map();

export function getProbeAltitudeControllerState(carIndex = 6) {
  let st = _probeClimbState.get(carIndex);
  if (!st) {
    st = { mode: 'HOLD_Z0', holdTicks: 0, posZ: 500, velZ: 0 };
    _probeClimbState.set(carIndex, st);
  }
  return st;
}

/**
 * Resolves the underlying RocketSimPhysicsEngine from a direct engine, PhysicsEngineManager, or HostServerWorker.
 * @param {object} target
 * @returns {object|null}
 */
export function resolvePhysicsEngine(target) {
  if (!target) return null;
  if (typeof target.setCarLinearFactorAndGravity === 'function') return target;
  if (target.sim && typeof target.sim.setCarLinearFactorAndGravity === 'function') return target.sim;
  if (target.fallbackSim && typeof target.fallbackSim.setCarLinearFactorAndGravity === 'function') return target.fallbackSim;
  return target.sim || null;
}

/**
 * Configures the 2 externalized diagnostic benchmark vehicles outside the stadium right wall
 * (X=4500, Z=500) on dedicated slots (Car 4: Damped Z-Step Boost Probe, Car 5: 0G Q/E Roll Probe)
 * and disables their collision masks against the ball and other vehicles.
 *
 * @param {object} targetSimOrAuthority - RocketSimPhysicsEngine, PhysicsEngineManager, or HostServerWorker
 * @param {Array<object>} fleet - Diagnostic vehicle specifications
 * @param {string} [anchorMode=ZERO_G_ANCHOR_MODES.Z_HOVER]
 */
export function configureZeroGVehiclePhysics(
  targetSimOrAuthority,
  fleet,
  anchorMode = ZERO_G_ANCHOR_MODES.Z_HOVER
) {
  const sim = resolvePhysicsEngine(targetSimOrAuthority);
  if (!sim || !Array.isArray(fleet)) return false;

  for (let i = 0; i < fleet.length; i++) {
    const spec = fleet[i];
    if (typeof targetSimOrAuthority.ensureCar === 'function') {
      targetSimOrAuthority.ensureCar(spec.carIndex, spec.team, 'octane');
    } else if (typeof targetSimOrAuthority.registerCarEntity === 'function') {
      targetSimOrAuthority.registerCarEntity(spec.carIndex, spec.team, 'octane');
    } else if (typeof sim.addCar === 'function') {
      while (sim.numCars <= spec.carIndex) {
        sim.addCar(spec.team, 'octane');
      }
    }

    const pos = spec.spawnPos || { x: 4500, y: i === 0 ? -350 : 350, z: 500 };
    const isBoostAltitudeProbe = spec.profile === 'boost_pulse' || spec.carIndex === 6;

    if (isBoostAltitudeProbe) {
      _probeClimbState.set(spec.carIndex, {
        mode: 'HOLD_Z0',
        holdTicks: 0,
        posZ: pos.z,
        velZ: 0
      });
    }

    const initialState = isBoostAltitudeProbe
      ? {
          pos: [pos.x, pos.y, pos.z],
          forward: [0, 0, 1],
          right: [0, 1, 0],
          up: [-1, 0, 0],
          vel: [0, 0, 0],
          angVel: [0, 0, 0],
          boost: 100
        }
      : {
          pos: [pos.x, pos.y, pos.z],
          forward: [-1, 0, 0],
          right: [0, 1, 0],
          up: [0, 0, 1],
          vel: [0, 0, 0],
          angVel: [0, 0, 0],
          boost: 100
        };

    if (typeof sim.setCarState === 'function') {
      sim.setCarState(spec.carIndex, initialState);
    }

    if (typeof sim.setCarCollisionMask === 'function') {
      sim.setCarCollisionMask(spec.carIndex, false, false);
    }

    if (typeof sim.setCarLinearFactorAndGravity === 'function') {
      if (isBoostAltitudeProbe && anchorMode !== ZERO_G_ANCHOR_MODES.ZERO_G_LOCKED) {
        sim.setCarLinearFactorAndGravity(spec.carIndex, 0, 0, 1, 1.0);
      } else {
        sim.setCarLinearFactorAndGravity(spec.carIndex, 0, 0, 0, 0);
      }
    }
  }

  return true;
}

/**
 * Restores standard 3D linear motion, normal gravity, and parks released diagnostic slots.
 *
 * @param {object} targetSimOrAuthority
 * @param {Array<object>} fleet
 */
export function releaseZeroGVehiclePhysics(targetSimOrAuthority, fleet) {
  const sim = resolvePhysicsEngine(targetSimOrAuthority);
  if (!sim || !Array.isArray(fleet)) return false;

  for (let i = 0; i < fleet.length; i++) {
    const spec = fleet[i];
    _probeClimbState.delete(spec.carIndex);
    if (typeof targetSimOrAuthority.unregisterCarEntity === 'function') {
      targetSimOrAuthority.unregisterCarEntity(spec.carIndex);
      continue;
    }
    if (typeof sim.setCarLinearFactorAndGravity === 'function') {
      sim.setCarLinearFactorAndGravity(spec.carIndex, 0, 0, 0, 0);
    }
    if (typeof sim.setCarCollisionMask === 'function') {
      sim.setCarCollisionMask(spec.carIndex, false, false);
    }
    if (typeof sim.setCarState === 'function') {
      sim.setCarState(spec.carIndex, {
        pos: [-5500, spec.carIndex * 300, -500],
        vel: [0, 0, 0],
        angVel: [0, 0, 0],
        boost: 0
      });
    }
  }
  return true;
}

/**
 * Configures Lobby Ghost Car collision isolation on a specific vehicle slot.
 * When `isGhost` is true, the vehicle can drive and fly freely across the stadium
 * without colliding with the soccer ball or other vehicles.
 *
 * @param {object} targetSimOrAuthority
 * @param {number} carIndex
 * @param {boolean} isGhost
 * @param {boolean} [interactWithBallWhenGhost=false]
 */
export function setLobbyGhostCarIsolation(
  targetSimOrAuthority,
  carIndex = 0,
  isGhost = true,
  interactWithBallWhenGhost = false
) {
  const sim = resolvePhysicsEngine(targetSimOrAuthority);
  if (!sim || typeof sim.setCarCollisionMask !== 'function') return false;
  if (isGhost) {
    return sim.setCarCollisionMask(carIndex, Boolean(interactWithBallWhenGhost), false);
  }
  return sim.setCarCollisionMask(carIndex, true, true);
}

/**
 * Maintains boost level at 100 for the Boost Altitude Probe (Car 7 / Idx 6), tracks its
 * Z0=500 -> Z1=800 state machine with PD altitude tracking, and keeps
 * Probe B (Car 8 / Idx 7) anchored at its external observation pedestal.
 *
 * @param {object} targetSimOrAuthority
 * @param {Array<object>} fleet
 * @param {string} [anchorMode=ZERO_G_ANCHOR_MODES.Z_HOVER]
 */
export function enforceZeroGFleetConstraints(
  targetSimOrAuthority,
  fleet,
  anchorMode = ZERO_G_ANCHOR_MODES.Z_HOVER
) {
  const sim = resolvePhysicsEngine(targetSimOrAuthority);
  if (!sim || !sim.state || !Array.isArray(fleet)) return;

  for (let i = 0; i < fleet.length; i++) {
    const spec = fleet[i];
    if (sim.numCars !== undefined && spec.carIndex >= sim.numCars) continue;

    const view = typeof sim.getCarStateView === 'function'
      ? sim.getCarStateView(spec.carIndex)
      : _clientCarView.attachCar(sim.state, spec.carIndex);

    if (!view) continue;

    const isBoostAltitudeProbe = spec.profile === 'boost_pulse' || spec.carIndex === 6;
    if (isBoostAltitudeProbe && anchorMode !== ZERO_G_ANCHOR_MODES.ZERO_G_LOCKED) {
      const targetX = spec.spawnPos?.x ?? 4500;
      const targetY = spec.spawnPos?.y ?? -350;
      const z0 = spec.baseAltitudeZ ?? (spec.spawnPos?.z ?? 500);
      const z1 = spec.peakAltitudeZ ?? 800;
      const curZ = view.posZ;
      const curVz = view.velZ;
      const st = getProbeAltitudeControllerState(spec.carIndex);
      st.posZ = curZ;
      st.velZ = curVz;

      // State machine: HOLD_Z0 (1.5s) -> CLIMB_Z1 -> HOLD_Z1 (1.5s) -> FALL_Z0 -> repeat
      if (st.mode === 'HOLD_Z0') {
        if (Math.abs(curZ - z0) <= 25 && Math.abs(curVz) <= 60) {
          st.holdTicks++;
          if (st.holdTicks >= 180) { // 1.5 seconds at 120Hz
            st.mode = 'CLIMB_Z1';
            st.holdTicks = 0;
          }
        } else {
          st.holdTicks = Math.max(0, st.holdTicks - 1);
        }
      } else if (st.mode === 'CLIMB_Z1') {
        if (curZ >= z1 - 15 && Math.abs(curVz) <= 50) {
          st.mode = 'HOLD_Z1';
          st.holdTicks = 0;
        }
      } else if (st.mode === 'HOLD_Z1') {
        if (Math.abs(curZ - z1) <= 25 && Math.abs(curVz) <= 60) {
          st.holdTicks++;
          if (st.holdTicks >= 180) { // 1.5 seconds at 120Hz
            st.mode = 'FALL_Z0';
            st.holdTicks = 0;
          }
        } else {
          st.holdTicks = Math.max(0, st.holdTicks - 1);
        }
      } else if (st.mode === 'FALL_Z0') {
        if (curZ <= z0 + 15 && Math.abs(curVz) <= 50) {
          st.mode = 'HOLD_Z0';
          st.holdTicks = 0;
        }
      }

      // Always refill boost reserve directly in state view to prevent fuel depletion
      if (view.boost < 80) {
        view.boost = 100;
      }

      // Extreme runaway safety protection only (never clamp during normal smooth flight)
      if (curZ < 100 || curZ > 1400 || !Number.isFinite(curZ) || Math.abs(view.posX - targetX) > 200) {
        sim.setCarState?.(spec.carIndex, {
          pos: [targetX, targetY, z0],
          forward: [0, 0, 1],
          right: [0, 1, 0],
          up: [-1, 0, 0],
          vel: [0, 0, 0],
          angVel: [0, 0, 0],
          boost: 100
        });
        st.mode = 'HOLD_Z0';
        st.holdTicks = 0;
      }
    } else {
      // Probe B (QE Roll): maintain fuel at 100
      if (view.boost < 80) {
        view.boost = 100;
      }
    }
  }
}

/**
 * Samples live kinematic and angular telemetry for the 3 diagnostic vehicles,
 * optionally comparing client state against an authoritative server state buffer.
 *
 * @param {object} clientSim - Client RocketSimPhysicsEngine
 * @param {Float32Array|null} [serverSnapshot=null] - Optional authoritative snapshot
 * @param {Array<object>} [fleet=[]]
 * @returns {Array<object>}
 */
export function sampleDiagnosticFleetTelemetry(clientSim, serverStateBuffer = null, fleet = []) {
  if (!clientSim || !clientSim.state || !Array.isArray(fleet)) return [];
  const results = [];
  const hasServerStateBuf =
    serverStateBuffer instanceof Float32Array &&
    serverStateBuffer.length === clientSim.state.length;

  for (let i = 0; i < fleet.length; i++) {
    const spec = fleet[i];
    if (clientSim.numCars !== undefined && spec.carIndex >= clientSim.numCars) continue;

    _clientCarView.attachCar(clientSim.state, spec.carIndex);
    const posX = _clientCarView.posX;
    const posY = _clientCarView.posY;
    const posZ = _clientCarView.posZ;
    const angSpeed = Math.hypot(_clientCarView.angVelX, _clientCarView.angVelY, _clientCarView.angVelZ);
    const isBoosting = Boolean(_clientCarView.isBoosting);

    let posDriftUu = 0;
    let angVelErrorRad = 0;
    if (hasServerStateBuf) {
      _serverCarView.attachCar(serverStateBuffer, spec.carIndex);
      posDriftUu = Math.hypot(
        posX - _serverCarView.posX,
        posY - _serverCarView.posY,
        posZ - _serverCarView.posZ
      );
      angVelErrorRad = Math.hypot(
        _clientCarView.angVelX - _serverCarView.angVelX,
        _clientCarView.angVelY - _serverCarView.angVelY,
        _clientCarView.angVelZ - _serverCarView.angVelZ
      );
    } else if (spec.spawnPos) {
      posDriftUu = Math.hypot(posX - spec.spawnPos.x, posY - spec.spawnPos.y);
    }

    results.push({
      carIndex: spec.carIndex,
      profile: spec.profile,
      label: spec.label,
      pos: [Number(posX.toFixed(1)), Number(posY.toFixed(1)), Number(posZ.toFixed(1))],
      angSpeedRad: Number(angSpeed.toFixed(2)),
      isBoosting,
      posDriftUu: Number(posDriftUu.toFixed(2)),
      angVelErrorRad: Number(angVelErrorRad.toFixed(2))
    });
  }

  return results;
}
