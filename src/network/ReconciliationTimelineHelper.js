const BALL_OFFSET = 4;       // SIM_OFFSETS.BALL
const BALL_VEL_OFFSET = 12;  // Within BallStatePod (0..2 pos, 3..11 rotMat, 12..14 vel)
const CAR_BASE_OFFSET = 22;  // SIM_OFFSETS.CARS
const CAR_STRIDE = 40;       // CAR_STATE_STRIDE

function recordEntryCompactSnapshot(reconciler, entry) {
  if (entry && typeof reconciler.sim?.saveCompactState === 'function') {
    entry.stateSnapshot = reconciler.sim.saveCompactState(entry.stateSnapshot);
  }
}

export function evaluateHistoricalSnapshotDelta(reconciler, authSnap, histSnap, numCars) {
  if (!authSnap || !histSnap || authSnap.length < CAR_BASE_OFFSET || histSnap.length < CAR_BASE_OFFSET) {
    return {
      canCompare: false,
      withinTier1: false,
      exceedsHardSnap: false,
      maxPosDelta: Infinity,
      localPosDelta: Infinity
    };
  }

  const ballPosDelta = Math.hypot(
    authSnap[BALL_OFFSET + 0] - histSnap[BALL_OFFSET + 0],
    authSnap[BALL_OFFSET + 1] - histSnap[BALL_OFFSET + 1],
    authSnap[BALL_OFFSET + 2] - histSnap[BALL_OFFSET + 2]
  );
  const ballVelDelta = Math.hypot(
    authSnap[BALL_OFFSET + BALL_VEL_OFFSET + 0] - histSnap[BALL_OFFSET + BALL_VEL_OFFSET + 0],
    authSnap[BALL_OFFSET + BALL_VEL_OFFSET + 1] - histSnap[BALL_OFFSET + BALL_VEL_OFFSET + 1],
    authSnap[BALL_OFFSET + BALL_VEL_OFFSET + 2] - histSnap[BALL_OFFSET + BALL_VEL_OFFSET + 2]
  );

  let maxCarPosDelta = 0;
  let localCarPosDelta = 0;
  let maxCarVelDelta = 0;
  let maxCarRotDelta = 0;
  let maxBoostDelta = 0;
  let discreteMismatch = false;

  const checkCars = Math.min(numCars, 8);
  for (let c = 0; c < checkCars; c++) {
    const base = CAR_BASE_OFFSET + c * CAR_STRIDE;
    if (authSnap.length < base + 25 || histSnap.length < base + 25) break;

    const posDelta = Math.hypot(
      authSnap[base + 0] - histSnap[base + 0],
      authSnap[base + 1] - histSnap[base + 1],
      authSnap[base + 2] - histSnap[base + 2]
    );
    const velDelta = Math.hypot(
      authSnap[base + 12] - histSnap[base + 12],
      authSnap[base + 13] - histSnap[base + 13],
      authSnap[base + 14] - histSnap[base + 14]
    );
    const rotDelta = Math.hypot(
      authSnap[base + 3] - histSnap[base + 3],
      authSnap[base + 4] - histSnap[base + 4],
      authSnap[base + 5] - histSnap[base + 5]
    ) + Math.hypot(
      authSnap[base + 9] - histSnap[base + 9],
      authSnap[base + 10] - histSnap[base + 10],
      authSnap[base + 11] - histSnap[base + 11]
    );
    const boostDelta = Math.abs(authSnap[base + 18] - histSnap[base + 18]);

    if (c === reconciler.localCarIndex) {
      localCarPosDelta = posDelta;
    }
    if (posDelta > maxCarPosDelta) maxCarPosDelta = posDelta;
    if (velDelta > maxCarVelDelta) maxCarVelDelta = velDelta;
    if (rotDelta > maxCarRotDelta) maxCarRotDelta = rotDelta;
    if (boostDelta > maxBoostDelta) maxBoostDelta = boostDelta;

    // Discrete flags: 21 = DEMOED, 22 = HAS_FLIP_OR_JUMP, 24 = IS_FLIPPING
    if (
      Math.round(authSnap[base + 21]) !== Math.round(histSnap[base + 21]) ||
      Math.round(authSnap[base + 22]) !== Math.round(histSnap[base + 22]) ||
      Math.round(authSnap[base + 24]) !== Math.round(histSnap[base + 24])
    ) {
      discreteMismatch = true;
    }
  }

  const maxPosDelta = Math.max(maxCarPosDelta, ballPosDelta);
  const posTol = reconciler.posTolerance ?? 0.5;
  const velTol = reconciler.velTolerance ?? 5.0;
  const rotTol = reconciler.rotTolerance ?? 0.015;
  const ballPosTol = reconciler.ballPosTolerance ?? 1.0;
  const ballVelTol = reconciler.ballVelTolerance ?? 10.0;
  const boostTol = reconciler.boostTolerance ?? 1.0;
  const hardSnapTol = reconciler.hardSnapThreshold ?? 500.0;

  const withinTier1 = !discreteMismatch &&
    maxCarPosDelta <= posTol &&
    ballPosDelta <= ballPosTol &&
    maxCarVelDelta <= velTol &&
    ballVelDelta <= ballVelTol &&
    maxCarRotDelta <= rotTol &&
    maxBoostDelta <= boostTol;

  const exceedsHardSnap = maxPosDelta > hardSnapTol;

  return {
    canCompare: true,
    withinTier1,
    exceedsHardSnap,
    maxPosDelta,
    localPosDelta: (reconciler.localCarIndex >= 0 && reconciler.localCarIndex < checkCars) ? localCarPosDelta : maxCarPosDelta
  };
}

function stepAndFillVacantTicks(reconciler, fromTick, toTick) {
  const numCars = Math.min(reconciler.sim.numCars, 8);
  let updatedTick = fromTick;
  const isRedundantEnabled = (reconciler.redundantHistoryCount > 1) || Boolean(reconciler.enableRedundantInputs);
  for (let t = fromTick; t < toTick; t++) {
    const isKickoffMasked = reconciler.kickoffMaskUntilTick > 0 && t < reconciler.kickoffMaskUntilTick;
    const slot = t & reconciler.mask;
    let entry = reconciler.inputHistory[slot];
    if (!entry || entry.tick !== t) {
      entry = { tick: t, cars: new Map() };
      reconciler.inputHistory[slot] = entry;
    }

    let committedLocalCtrl = null;
    for (let c = 0; c < numCars; c++) {
      if (c === reconciler.localCarIndex) {
        let ctrl;
        if (isKickoffMasked) {
          ctrl = { ...reconciler.neutralControls };
          entry.cars.set(c, ctrl);
        } else if (entry.cars.has(c)) {
          ctrl = { ...entry.cars.get(c) };
        } else {
          ctrl = { ...reconciler.getPreviousCommittedControls(t, c) };
          entry.cars.set(c, ctrl);
        }
        committedLocalCtrl = ctrl;
        reconciler.lastLocalControls = { ...ctrl };
        reconciler.clientInputRingBuffer.record(t, c, ctrl);
        reconciler.sim.setControls(c, ctrl);
      } else {
        const rawRemote = isKickoffMasked
          ? reconciler.neutralControls
          : (entry.cars.has(c)
            ? entry.cars.get(c)
            : (reconciler.lastRemoteControls.get(c) || reconciler.neutralControls));
        const remoteCtrl = rawRemote?.controls ? rawRemote.controls : (rawRemote || reconciler.neutralControls);
        entry.cars.set(c, { ...remoteCtrl });
        reconciler.sim.setControls(c, remoteCtrl);
      }
    }

    reconciler.sim.saveStateSlot(t % 256);
    recordEntryCompactSnapshot(reconciler, entry);
    reconciler.sim.stepSilent(1);
    updatedTick = Math.floor(reconciler.sim.getHeaderView().tickCount);

    if (!isRedundantEnabled && typeof reconciler.sendOutboundInputForTick === 'function') {
      reconciler.sendOutboundInputForTick(t, reconciler.localCarIndex, committedLocalCtrl);
    }
  }
  if (isRedundantEnabled && toTick > fromTick && typeof reconciler.sendOutboundInputForTick === 'function') {
    reconciler.sendOutboundInputForTick(toTick - 1, reconciler.localCarIndex);
  }
  return updatedTick;
}

export function modulateReconcilerClockPacing(reconciler, currentClientTick, currentDelta, targetDelta) {
  let updatedClientTick = currentClientTick;
  const serverTick = currentClientTick - currentDelta;
  const targetClientTick = serverTick + targetDelta;

  if (reconciler.forceTargetAlign) {
    reconciler.forceTargetAlign = false;
    if (currentDelta > targetDelta) {
      updatedClientTick = Math.max(serverTick, targetClientTick);
      reconciler.sim.restoreStateSlot(updatedClientTick % 256);
    } else if (currentDelta < targetDelta) {
      updatedClientTick = stepAndFillVacantTicks(reconciler, currentClientTick, targetClientTick);
    }
    reconciler.shouldSkipLocalStep = false;
    return updatedClientTick;
  }

  if (reconciler.clockPacingMode === 'legacy') {
    const skipThreshold = targetDelta + reconciler.skipThresholdOffset;
    const catchupThreshold = targetDelta + reconciler.catchupThresholdOffset;

    if (currentDelta > skipThreshold) {
      updatedClientTick = Math.max(serverTick, targetClientTick);
      reconciler.sim.restoreStateSlot(updatedClientTick % 256);
      reconciler.shouldSkipLocalStep = false;
    } else if (currentDelta < catchupThreshold) {
      updatedClientTick = stepAndFillVacantTicks(reconciler, currentClientTick, targetClientTick);
      reconciler.shouldSkipLocalStep = false;
    } else {
      reconciler.shouldSkipLocalStep = false;
    }
  } else {
    const deadband = Math.max(2, Math.ceil(reconciler.leadTicks * 0.4));
    const skipThreshold = targetDelta + deadband;
    const catchupThreshold = Math.max(1, targetDelta - deadband);

    if (currentDelta > skipThreshold) {
      reconciler.interpolator?.setPhysicsRate?.(119);
      if (currentDelta > skipThreshold + 4) {
        updatedClientTick = Math.max(serverTick, targetClientTick);
        reconciler.sim.restoreStateSlot(updatedClientTick % 256);
      }
      reconciler.shouldSkipLocalStep = false;
    } else if (currentDelta < catchupThreshold) {
      reconciler.interpolator?.setPhysicsRate?.(121);
      reconciler.shouldSkipLocalStep = false;
      if (currentDelta <= 0 || currentDelta < catchupThreshold - 2) {
        updatedClientTick = stepAndFillVacantTicks(reconciler, currentClientTick, targetClientTick);
      }
    } else {
      reconciler.interpolator?.setPhysicsRate?.(120);
      reconciler.shouldSkipLocalStep = false;
    }
  }

  return updatedClientTick;
}

export function replayAndEvaluateCorrection(reconciler, packet, serverTick, currentClientTick, prePositions, numCars) {
  reconciler.sim.saveStateSlot?.(currentClientTick % 256);
  const currentSlot = currentClientTick & reconciler.mask;
  let currentEntry = reconciler.inputHistory[currentSlot];
  if (!currentEntry || currentEntry.tick !== currentClientTick) {
    currentEntry = { tick: currentClientTick, cars: new Map() };
    reconciler.inputHistory[currentSlot] = currentEntry;
  }
  recordEntryCompactSnapshot(reconciler, currentEntry);

  // Check historical compact state snapshot at serverTick for 3-Tier Tolerance evaluation
  const serverSlot = serverTick & reconciler.mask;
  const serverEntry = reconciler.inputHistory[serverSlot];
  const histSnap = (serverEntry && serverEntry.tick === serverTick) ? serverEntry.stateSnapshot : null;
  const evalResult = evaluateHistoricalSnapshotDelta(reconciler, packet.stateSnapshot, histSnap, numCars);

  if (evalResult.canCompare) {
    reconciler.metrics.historicalPosDelta = evalResult.localPosDelta;

    // Tier 1 (Deadband No-Op): Historical delta is within tolerance -> skip rollback & resimulation completely
    if (evalResult.withinTier1) {
      reconciler.skippedCorrections = (reconciler.skippedCorrections || 0) + 1;
      reconciler.metrics.skippedCorrections = reconciler.skippedCorrections;
      reconciler.metrics.reconcileTier = 1;
      reconciler.metrics.lastCorrectionDelta = evalResult.localPosDelta;
      reconciler.metrics.smoothingMagnitude = Math.hypot(
        reconciler.visualSmoothingOffset.x,
        reconciler.visualSmoothingOffset.y,
        reconciler.visualSmoothingOffset.z
      );
      return;
    }
  }

  const isTier3HistoricalHardSnap = Boolean(evalResult.canCompare && evalResult.exceedsHardSnap);

  // Tier 2 (Rollback + Resimulate + Micro-Snap) & Tier 3 (Hard Snap)
  if (serverTick < currentClientTick && (currentClientTick - serverTick) < 256) {
    reconciler.sim.restoreStateSlot?.(serverTick % 256);
  }
  reconciler.sim.restoreState(packet.stateSnapshot);

  for (let t = Math.max(0, serverTick - 16); t < serverTick; t++) {
    if (!reconciler.clientInputRingBuffer.get(t)) {
      const prevCtrl = (reconciler.kickoffMaskUntilTick > 0 && t < reconciler.kickoffMaskUntilTick)
        ? { ...reconciler.neutralControls }
        : reconciler.getPreviousCommittedControls(t, reconciler.localCarIndex);
      reconciler.clientInputRingBuffer.record(t, reconciler.localCarIndex, prevCtrl);
    }
  }

  for (let t = serverTick; t < currentClientTick; t++) {
    const isKickoffMasked = reconciler.kickoffMaskUntilTick > 0 && t < reconciler.kickoffMaskUntilTick;
    const slot = t & reconciler.mask;
    let entry = reconciler.inputHistory[slot];
    if (!entry || entry.tick !== t) {
      entry = { tick: t, cars: new Map() };
      reconciler.inputHistory[slot] = entry;
    }

    for (let c = 0; c < numCars; c++) {
      if (c === reconciler.localCarIndex) {
        let ctrl;
        if (isKickoffMasked) {
          ctrl = { ...reconciler.neutralControls };
          entry.cars.set(c, ctrl);
        } else if (entry.cars.has(c)) {
          ctrl = entry.cars.get(c);
        } else {
          ctrl = { ...reconciler.getPreviousCommittedControls(t, c) };
          entry.cars.set(c, ctrl);
        }
        reconciler.sim.setControls(c, ctrl);
        reconciler.clientInputRingBuffer.record(t, c, ctrl);
      } else {
        const rawRemote = isKickoffMasked
          ? reconciler.neutralControls
          : (reconciler.lastRemoteControls.get(c)
            || (entry.cars.has(c) ? entry.cars.get(c) : reconciler.neutralControls));
        const remoteCtrl = rawRemote?.controls ? rawRemote.controls : (rawRemote || reconciler.neutralControls);
        entry.cars.set(c, { ...remoteCtrl });
        reconciler.sim.setControls(c, remoteCtrl);
      }
    }

    reconciler.sim.saveStateSlot(t % 256);
    recordEntryCompactSnapshot(reconciler, entry);
    reconciler.sim.stepSilent(1);
  }
  reconciler.sim.saveStateSlot(currentClientTick % 256);
  recordEntryCompactSnapshot(reconciler, currentEntry);

  let maxDelta = 0;
  let localDelta = 0;
  for (let c = 0; c < numCars; c++) {
    const postCar = reconciler.sim.getCarStateView(c);
    const carDelta = Math.hypot(
      prePositions[c].x - postCar.posX,
      prePositions[c].y - postCar.posY,
      prePositions[c].z - postCar.posZ
    );
    if (c === reconciler.localCarIndex) {
      localDelta = carDelta;
    }
    if (carDelta > maxDelta) {
      maxDelta = carDelta;
    }
  }

  const delta = (reconciler.localCarIndex >= 0 && reconciler.localCarIndex < numCars) ? localDelta : maxDelta;
  const hardSnapTol = reconciler.hardSnapThreshold ?? 500.0;
  const isTier3HardSnap = isTier3HistoricalHardSnap || maxDelta > hardSnapTol;

  reconciler.metrics.reconcileTier = isTier3HardSnap ? 3 : 2;
  if (isTier3HardSnap) {
    reconciler.hardSnapCount = (reconciler.hardSnapCount || 0) + 1;
    reconciler.metrics.hardSnapCount = reconciler.hardSnapCount;
    reconciler.visualSmoothingOffset.x = 0;
    reconciler.visualSmoothingOffset.y = 0;
    reconciler.visualSmoothingOffset.z = 0;
  }

  if (delta > 0.05) {
    reconciler.totalCorrections++;
    reconciler.metrics.totalCorrections = reconciler.totalCorrections;
    reconciler.metrics.lastCorrectionDelta = delta;
    if (delta > reconciler.maxCorrectionDelta) {
      reconciler.maxCorrectionDelta = delta;
      reconciler.metrics.maxCorrectionDelta = delta;
    }

    if (reconciler.enableSmoothing && !isTier3HardSnap) {
      const postCar0 = reconciler.sim.getCarStateView(reconciler.localCarIndex);
      reconciler.visualSmoothingOffset.x += (prePositions[reconciler.localCarIndex].x - postCar0.posX);
      reconciler.visualSmoothingOffset.y += (prePositions[reconciler.localCarIndex].y - postCar0.posY);
      reconciler.visualSmoothingOffset.z += (prePositions[reconciler.localCarIndex].z - postCar0.posZ);

      const maxOffset = 300.0;
      const currentOffsetLen = Math.hypot(
        reconciler.visualSmoothingOffset.x,
        reconciler.visualSmoothingOffset.y,
        reconciler.visualSmoothingOffset.z
      );
      if (currentOffsetLen > maxOffset) {
        const factor = maxOffset / currentOffsetLen;
        reconciler.visualSmoothingOffset.x *= factor;
        reconciler.visualSmoothingOffset.y *= factor;
        reconciler.visualSmoothingOffset.z *= factor;
      }
    }
  } else {
    reconciler.metrics.lastCorrectionDelta = delta;
  }

  reconciler.metrics.smoothingMagnitude = Math.hypot(
    reconciler.visualSmoothingOffset.x,
    reconciler.visualSmoothingOffset.y,
    reconciler.visualSmoothingOffset.z
  );
}

export function syncReconcilerTimeline(reconciler, serverSnapshot, serverTick = 0, nowMs = performance.now()) {
  if (serverSnapshot) {
    reconciler.sim.restoreState(serverSnapshot);
  }
  const effectiveRtt = reconciler._resolveEffectiveRtt();
  reconciler.leadTicks = reconciler.calculateLeadTicks(effectiveRtt);
  const isLocalChannel = effectiveRtt <= 2;
  const maxOneWayTicks = reconciler.clockPacingMode === 'legacy' ? 64 : 25;
  const oneWayTicks = isLocalChannel ? 0 : Math.max(1, Math.min(maxOneWayTicks, Math.ceil(effectiveRtt * 0.5 / reconciler.tickDtMs)));
  const targetDelta = reconciler.leadTicks + oneWayTicks;

  for (let t = Math.max(0, serverTick - 16); t < serverTick; t++) {
    if (!reconciler.clientInputRingBuffer.get(t)) {
      const prevCtrl = (reconciler.kickoffMaskUntilTick > 0 && t < reconciler.kickoffMaskUntilTick)
        ? { ...reconciler.neutralControls }
        : reconciler.getPreviousCommittedControls(t, reconciler.localCarIndex);
      reconciler.clientInputRingBuffer.record(t, reconciler.localCarIndex, prevCtrl);
    }
  }

  const numCars = Math.min(reconciler.sim.numCars, 8);
  const isRedundantEnabled = (reconciler.redundantHistoryCount > 1) || Boolean(reconciler.enableRedundantInputs);
  for (let t = serverTick; t < serverTick + targetDelta; t++) {
    const isKickoffMasked = reconciler.kickoffMaskUntilTick > 0 && t < reconciler.kickoffMaskUntilTick;
    const slot = t & reconciler.mask;
    let entry = reconciler.inputHistory[slot];
    if (!entry || entry.tick !== t) {
      entry = { tick: t, cars: new Map() };
      reconciler.inputHistory[slot] = entry;
    }

    let committedLocalCtrl = null;
    for (let c = 0; c < numCars; c++) {
      if (c === reconciler.localCarIndex) {
        let ctrl;
        if (isKickoffMasked) {
          ctrl = { ...reconciler.neutralControls };
          entry.cars.set(c, ctrl);
        } else if (entry.cars.has(c)) {
          ctrl = { ...entry.cars.get(c) };
        } else {
          ctrl = { ...reconciler.getPreviousCommittedControls(t, c) };
          entry.cars.set(c, ctrl);
        }
        committedLocalCtrl = ctrl;
        reconciler.lastLocalControls = { ...ctrl };
        reconciler.clientInputRingBuffer.record(t, c, ctrl);
        reconciler.sim.setControls(c, ctrl);
      } else {
        const rawRemote = isKickoffMasked
          ? reconciler.neutralControls
          : (entry.cars.has(c)
            ? entry.cars.get(c)
            : (reconciler.lastRemoteControls.get(c) || reconciler.neutralControls));
        const remoteCtrl = rawRemote?.controls ? rawRemote.controls : (rawRemote || reconciler.neutralControls);
        entry.cars.set(c, { ...remoteCtrl });
        reconciler.sim.setControls(c, remoteCtrl);
      }
    }

    reconciler.sim.saveStateSlot(t % 256);
    recordEntryCompactSnapshot(reconciler, entry);
    reconciler.sim.stepSilent(1);

    if (!isRedundantEnabled) {
      reconciler.sendOutboundInputForTick(t, reconciler.localCarIndex, committedLocalCtrl, nowMs);
    }
  }
  if (isRedundantEnabled && targetDelta > 0) {
    reconciler.sendOutboundInputForTick(serverTick + targetDelta - 1, reconciler.localCarIndex, null, nowMs);
  }

  const currentClientTick = Math.floor(reconciler.sim.getHeaderView().tickCount);
  reconciler.lastAckedServerTick = serverTick;
  reconciler.isTimelineSynchronized = true;
  reconciler.shouldSkipLocalStep = false;
  reconciler.lastHardResyncTime = nowMs;
  reconciler.hardSnapCount = (reconciler.hardSnapCount || 0) + 1;
  reconciler.visualSmoothingOffset = { x: 0, y: 0, z: 0 };

  reconciler.sim.saveStateSlot(currentClientTick % 256);
  const currentSlot = currentClientTick & reconciler.mask;
  let currentEntry = reconciler.inputHistory[currentSlot];
  if (!currentEntry || currentEntry.tick !== currentClientTick) {
    currentEntry = { tick: currentClientTick, cars: new Map() };
    reconciler.inputHistory[currentSlot] = currentEntry;
  }
  recordEntryCompactSnapshot(reconciler, currentEntry);

  reconciler.metrics.reconcileTier = 3;
  reconciler.metrics.hardSnapCount = reconciler.hardSnapCount;
  reconciler.metrics.clientTick = currentClientTick;
  reconciler.metrics.serverTick = serverTick;
  reconciler.metrics.leadTicks = reconciler.leadTicks;
  reconciler.notifyMetricsUpdated();
}
