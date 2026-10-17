/**
 * ArenaVehicleAnimator.js
 * Vehicle attitude thrusters (RCS jets), jump/dodge burst logic,
 * and per-frame boost visual emitter propagation.
 */

export function setJetFlame(flame, active, intensity) {
  if (!flame) return;
  flame.visible = active;
  if (active) {
    const s = Math.min(2, intensity);
    flame.scale.set(1 + 0.4 * Math.min(s, 1), 6 + 13 * s, 1 + 0.4 * Math.min(s, 1));
  }
}

export function setJet(jet, active, intensity = 1) {
  if (!jet) return;
  if (Array.isArray(jet)) {
    for (const j of jet) setJetFlame(j, active, intensity);
    return;
  }
  setJetFlame(jet, active, intensity);
}

/**
 * Updates reaction control thrusters (jets) for roll, pitch, yaw and jump.
 */
export function updateCarAirJets(jets, carIndex, carControls, currCar, actualDelta, state) {
  if (!jets) return;

  const inAir = currCar.isOnGround ? 0 : 1;
  const roll = carControls?.roll ?? 0;
  const yaw = carControls?.yaw ?? 0;
  const pitch = carControls?.pitch ?? 0;
  const rollPos = inAir * Math.max(0, roll);
  const rollNeg = inAir * Math.max(0, -roll);
  const yawPos = inAir * Math.max(0, yaw);
  const yawNeg = inAir * Math.max(0, -yaw);
  const isFlipping = currCar.isFlipping;

  if (isFlipping && !state.flipPrev[carIndex]) {
    state.dodgeBurst[carIndex] = 0.22;
    state.dodgeRoll[carIndex] = roll;
    state.dodgeYaw[carIndex] = yaw;
    state.dodgePitch[carIndex] = pitch;
  }
  state.flipPrev[carIndex] = isFlipping;

  let burstFactor = 0;
  if (state.dodgeBurst[carIndex] > 0) {
    state.dodgeBurst[carIndex] -= actualDelta;
    burstFactor = 2 * Math.max(0, state.dodgeBurst[carIndex] / 0.22);
  }

  const bRollPos = burstFactor * Math.max(0, state.dodgeRoll[carIndex]);
  const bRollNeg = burstFactor * Math.max(0, -state.dodgeRoll[carIndex]);
  const bYawPos = burstFactor * Math.max(0, state.dodgeYaw[carIndex]);
  const bYawNeg = burstFactor * Math.max(0, -state.dodgeYaw[carIndex]);
  const bPitchPos = burstFactor * Math.max(0, state.dodgePitch[carIndex]);
  const bPitchNeg = burstFactor * Math.max(0, -state.dodgePitch[carIndex]);

  const rollNet = Math.max(rollNeg, bRollNeg) - Math.max(rollPos, bRollPos);
  setJet(jets.roll.fP, Math.max(0, rollNet));
  setJet(jets.roll.bP, Math.max(0, rollNet));
  setJet(jets.roll.fN, Math.max(0, -rollNet));
  setJet(jets.roll.bN, Math.max(0, -rollNet));

  const yawNet = Math.max(yawNeg, bYawNeg) - Math.max(yawPos, bYawPos);
  setJet(jets.yaw.fP, Math.max(0, -yawNet));
  setJet(jets.yaw.fN, Math.max(0, yawNet));
  setJet(jets.yaw.bP, Math.max(0, -yawNet));
  setJet(jets.yaw.bN, Math.max(0, yawNet));

  const pitchBackNet = Math.max(inAir * Math.max(0, pitch), bPitchPos) - Math.max(inAir * Math.max(0, -pitch), bPitchNeg);
  setJet(jets.pitchBack, Math.max(0, pitchBackNet));
  setJet(jets.pitchFront, Math.max(0, -pitchBackNet));

  const isJumping = carControls?.jump ?? false;
  const isAirInput = inAir === 1 && (roll !== 0 || yaw !== 0 || pitch !== 0);
  if (isJumping && !state.jumpPrev[carIndex] && !isAirInput) {
    state.jumpTimer[carIndex] = 0;
  }
  state.jumpPrev[carIndex] = isJumping;
  if (isFlipping) state.jumpTimer[carIndex] = -1;

  let jumpActive = 0;
  if (state.jumpTimer[carIndex] >= 0) {
    state.jumpTimer[carIndex] += actualDelta;
    const jumpElapsed = state.jumpTimer[carIndex];
    const upwardVel = currCar.velZ > 0 || jumpElapsed < 0.05;
    if (jumpElapsed <= 0.2 && upwardVel && (isJumping || jumpElapsed < 0.07)) {
      jumpActive = 1;
    } else {
      state.jumpTimer[carIndex] = -1;
    }
  }
  setJet(jets.jump, jumpActive, 2);
}

/**
 * Propagates boost emitter particles and sound triggers.
 */
export function updateBoostVisuals(cars, carBoosts, currState, throttle, delta, opponentThrottle = 0, activeVisuals = true, controls = null, opponentControls = null, playerCarIndex = 0, headerView = null, currCarView = null, carControlsResolver = null) {
  const header = headerView?.attach(currState);
  const numCars = header ? header.numCars : cars.length;
  const localCarIdx = playerCarIndex ?? 0;

  for (let carIndex = 0; carIndex < cars.length; carIndex++) {
    if (!cars[carIndex]) continue;
    if (carIndex >= numCars) continue;
    const carView = currCarView?.attachCar(currState, carIndex);
    const isLocalCar = carIndex === localCarIdx;
    const carCtrl = typeof carControlsResolver === 'function'
      ? carControlsResolver(carIndex)
      : (carIndex === 0 ? controls : opponentControls);
    const isBoosting = activeVisuals && ((carView && carView.isBoosting) || Boolean(carCtrl?.boost && carView && carView.boost > 0));
    const isAudibleActive = isLocalCar;
    const currentThrottle = isLocalCar ? throttle : (carCtrl?.throttle ?? opponentThrottle);
    for (const emitter of carBoosts[carIndex] ?? []) {
      emitter.setSpatial?.(!isAudibleActive);
      emitter.update?.(isBoosting, activeVisuals && currentThrottle > 0.01, cars[carIndex].visible, delta, activeVisuals);
    }
  }
}
