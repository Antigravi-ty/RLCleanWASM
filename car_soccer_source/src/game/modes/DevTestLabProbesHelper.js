/**
 * DevTestLabProbesHelper.js
 * Implements the 2-vehicle predictive & non-predictive diagnostic probe state machine:
 *
 * 1. Car A (Slot 6 - Unpredictable Boost Altitude Loop):
 *    - Has standard gravity (gravityScale = 1.0), horizontal XY translation locked (fx=0, fy=0, fz=1).
 *    - Placed strictly inside the arena at (-2500, -400, Z0=500).
 *    - Note on physics: A 100 UU boost climb (500 -> 600) followed by free-fall below 500 builds
 *      downward velocity Vz ≈ -445 uu/s, which requires ~290 UU of full-boost braking distance
 *      (since net upward boost accel is 991.67 - 650 = +341.67 uu/s²). Setting base altitude
 *      Z0 = 500 (peak Z1 = 600) keeps the recovery trough at Z ≈ 210 UU (well above the floor Z=17).
 *    - Phase 'CLIMB_TO_PEAK': Holds boost continuously until Z >= 600, then releases boost.
 *    - Phase 'FALL_BELOW_BASE': Falls naturally under gravity until Z < 500.
 *    - Phase 'RECOVER_AND_HOLD': Uses energy-based stopping altitude prediction
 *      (stoppingZ = Z + Vz² / (2*g) when rising) to settle into [500 - 10, 500 + 10] with
 *      zero positive-feedback overshoot, holding steady for 1.0 second (120 ticks @ 120Hz)
 *      before repeating 'CLIMB_TO_PEAK'.
 *
 * 2. Car B (Slot 7 - Predictable 0G Q/E Roll):
 *    - Zero gravity (gravityScale = 0.0), XYZ translation locked (fx=0, fy=0, fz=0).
 *    - Placed inside the arena at (-2500, +400, 550), alternating Q (+1.0) and E (-1.0) roll.
 */

export const PROBE_BOOST_SLOT = 6;
export const PROBE_QE_SLOT = 7;

export function createProbeControllerState(baseZ = 500, peakZ = 600) {
  return {
    phase: 'CLIMB_TO_PEAK', // 'CLIMB_TO_PEAK' | 'FALL_BELOW_BASE' | 'RECOVER_AND_HOLD'
    baseZ,
    peakZ,
    toleranceZ: 10,
    targetHoldTicks: 120, // 1.0s @ 120Hz
    holdCounter: 0,
    lastZ: baseZ,
    lastVz: 0,
    rollDir: 1,
    tickCounter: 0,
  };
}

export function getProbeSpawnCoordinates(baseZ = 500) {
  // Strictly inside stadium bounds (clear of walls & floor raycast issues)
  return {
    boostPos: { x: -2500, y: -400, z: baseZ },
    qePos: { x: -2500, y: 400, z: baseZ + 50 },
  };
}

export function setupDevTestLabProbes(physics, arena, baseZ = 500, peakZ = 600) {
  if (!physics) return null;
  const coords = getProbeSpawnCoordinates(baseZ);

  while (physics.numCars <= PROBE_QE_SLOT) {
    physics.addCar(physics.numCars % 2, 'octane');
  }

  // Park intermediate slots 1..5 in the underground inactive zone so ArenaWorldUpdater hides them
  for (let idx = 1; idx < PROBE_BOOST_SLOT; idx++) {
    physics.setCarLinearFactorAndGravity?.(idx, 0, 0, 0, 0);
    physics.setCarCollisionMask?.(idx, false, false);
    physics.setCarState?.(idx, {
      pos: [-5500, idx * 300, -500],
      vel: [0, 0, 0],
      angVel: [0, 0, 0],
      boost: 0,
      isOnGround: false,
    });
    if (arena?.cars?.[idx]) {
      arena.cars[idx].visible = false;
    }
  }

  // Ensure visual meshes exist in ArenaWorld for Slot 6 & Slot 7
  if (arena && typeof arena.ensureCar === 'function') {
    arena.ensureCar(PROBE_BOOST_SLOT, 1, 'game-car');
    arena.ensureCar(PROBE_QE_SLOT, 0, 'game-car');
    if (arena.cars[PROBE_BOOST_SLOT]) arena.cars[PROBE_BOOST_SLOT].visible = true;
    if (arena.cars[PROBE_QE_SLOT]) arena.cars[PROBE_QE_SLOT].visible = true;
  }

  // Car A (Slot 6): Pitched straight up (+Z nose) in mid-air so rocket boost pushes along +Z against gravity
  physics.setCarCollisionMask?.(PROBE_BOOST_SLOT, false, false);
  physics.setCarState?.(PROBE_BOOST_SLOT, {
    pos: [coords.boostPos.x, coords.boostPos.y, coords.boostPos.z],
    forward: [0, 0, 1],
    right: [0, 1, 0],
    up: [-1, 0, 0],
    vel: [0, 0, 0],
    angVel: [0, 0, 0],
    boost: 100,
    isOnGround: false,
  });
  physics.setCarLinearFactorAndGravity?.(PROBE_BOOST_SLOT, 0, 0, 1, 1.0);

  // Car B (Slot 7): 0G QE Roll probe facing forward in mid-air
  physics.setCarCollisionMask?.(PROBE_QE_SLOT, false, false);
  physics.setCarState?.(PROBE_QE_SLOT, {
    pos: [coords.qePos.x, coords.qePos.y, coords.qePos.z],
    forward: [1, 0, 0],
    right: [0, 1, 0],
    up: [0, 0, 1],
    vel: [0, 0, 0],
    angVel: [0, 0, 0],
    boost: 100,
    isOnGround: false,
  });
  physics.setCarLinearFactorAndGravity?.(PROBE_QE_SLOT, 0, 0, 0, 0.0);

  return createProbeControllerState(baseZ, peakZ);
}

/**
 * Completely removes all probe/filler cars (Slots 1..7) from the WASM physics engine
 * and hides their Three.js meshes so they never linger or respawn on kickoff.
 */
export function parkDevTestLabProbes(physics, arena) {
  if (!physics) return;
  for (let slot = 1; slot < 8; slot++) {
    if (slot < physics.numCars) {
      physics.setCarLinearFactorAndGravity?.(slot, 1, 1, 1, 1);
      physics.setCarCollisionMask?.(slot, true, true);
    }
    if (arena?.cars?.[slot]) {
      arena.cars[slot].visible = false;
    }
  }
  while (physics.numCars > 1) {
    physics.removeCar(physics.numCars - 1);
  }
}

export function stepDevTestLabProbes(physics, probeState) {
  if (!physics || !probeState || physics.numCars <= PROBE_QE_SLOT) return null;

  const coords = getProbeSpawnCoordinates(probeState.baseZ);
  const boostView = physics.getCarStateView(PROBE_BOOST_SLOT);
  const qeView = physics.getCarStateView(PROBE_QE_SLOT);
  if (!boostView || !qeView) return null;

  probeState.tickCounter++;
  const curZ = boostView.posZ;
  const curVz = boostView.velZ;
  probeState.lastZ = curZ;
  probeState.lastVz = curVz;

  // Keep fuel full
  boostView.boost = 100;
  qeView.boost = 100;

  // If Car 6's nose ever tilts away from straight up (+Z), re-align its orientation while preserving Z & Vz
  if (boostView.fwdZ < 0.995 || Math.abs(boostView.posX - coords.boostPos.x) > 5) {
    physics.setCarState?.(PROBE_BOOST_SLOT, {
      pos: [coords.boostPos.x, coords.boostPos.y, curZ],
      forward: [0, 0, 1],
      right: [0, 1, 0],
      up: [-1, 0, 0],
      vel: [0, 0, curVz],
      angVel: [0, 0, 0],
      boost: 100,
      isOnGround: false,
    });
  }

  let shouldBoost = false;
  const z0 = probeState.baseZ; // 500
  const z1 = probeState.peakZ; // 600
  const tol = probeState.toleranceZ; // 10

  if (probeState.phase === 'CLIMB_TO_PEAK') {
    // 1. Continuously hold boost from baseZ (500) until reaching peakZ (600)
    if (curZ < z1) {
      shouldBoost = true;
    } else {
      shouldBoost = false;
      probeState.phase = 'FALL_BELOW_BASE';
      probeState.holdCounter = 0;
    }
  } else if (probeState.phase === 'FALL_BELOW_BASE') {
    // 2. Release boost and fall naturally under gravity until dropping below baseZ (500)
    shouldBoost = false;
    if (curZ < z0) {
      probeState.phase = 'RECOVER_AND_HOLD';
      probeState.holdCounter = 0;
      shouldBoost = true;
    }
  } else if (probeState.phase === 'RECOVER_AND_HOLD') {
    // 3. Recover to baseZ (500) and pulse-tap boost to hold within 500 ± 10 for 1.0s (120 ticks).
    // Energy-based stopping altitude: if we cut boost while rising (curVz > 0), gravity (650 uu/s²)
    // brings the car to rest at apexZ = curZ + curVz² / (2 * 650).
    // Cutting boost as soon as apexZ >= z0 guarantees the car decelerates to Vz = 0 right at z0 = 500
    // with zero positive-feedback overshoot!
    if (curVz > 0) {
      const coastApexZ = curZ + (curVz * curVz) / (2 * 650.0);
      shouldBoost = coastApexZ < z0;
    } else {
      // Falling or stationary: boost if below or predicted to drop below z0
      const predictedZ = curZ + curVz * 0.08;
      shouldBoost = predictedZ < z0;
    }

    if (Math.abs(curZ - z0) <= tol && Math.abs(curVz) <= 45) {
      probeState.holdCounter++;
      if (probeState.holdCounter >= probeState.targetHoldTicks) {
        // 1.0s stable hold achieved -> re-anchor cleanly at Z=z0, Vz=0 and start next climb cycle
        physics.setCarState?.(PROBE_BOOST_SLOT, {
          pos: [coords.boostPos.x, coords.boostPos.y, z0],
          forward: [0, 0, 1],
          right: [0, 1, 0],
          up: [-1, 0, 0],
          vel: [0, 0, 0],
          angVel: [0, 0, 0],
          boost: 100,
          isOnGround: false,
        });
        probeState.phase = 'CLIMB_TO_PEAK';
        probeState.holdCounter = 0;
        shouldBoost = true;
      }
    } else if (Math.abs(curZ - z0) > tol * 1.5) {
      probeState.holdCounter = 0;
    }
  }

  // Safety guard if probe ever drifts out of bounds
  if (!Number.isFinite(curZ) || curZ < 80 || curZ > 1200) {
    physics.setCarState?.(PROBE_BOOST_SLOT, {
      pos: [coords.boostPos.x, coords.boostPos.y, z0],
      forward: [0, 0, 1],
      right: [0, 1, 0],
      up: [-1, 0, 0],
      vel: [0, 0, 0],
      angVel: [0, 0, 0],
      boost: 100,
      isOnGround: false,
    });
    probeState.phase = 'CLIMB_TO_PEAK';
    probeState.holdCounter = 0;
  }

  const boostControls = {
    throttle: shouldBoost ? 1.0 : 0.0,
    steer: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    jump: false,
    boost: shouldBoost,
    handbrake: false,
  };
  physics.setControls(PROBE_BOOST_SLOT, boostControls);

  // Car B (Slot 7): Q/E Roll reversal every 240 ticks (2.0s)
  const rollDir = Math.floor(probeState.tickCounter / 240) % 2 === 0 ? 1.0 : -1.0;
  probeState.rollDir = rollDir;
  const qeControls = {
    throttle: 0,
    steer: 0,
    pitch: 0,
    yaw: 0,
    roll: rollDir,
    jump: false,
    boost: false,
    handbrake: false,
  };
  physics.setControls(PROBE_QE_SLOT, qeControls);

  return {
    boostControls,
    qeControls,
    posZ: curZ,
    velZ: curVz,
    phase: probeState.phase,
    holdCounter: probeState.holdCounter,
    rollDir,
  };
}
