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
    const deadband = Math.max(4, Math.ceil(reconciler.leadTicks * 0.4));
    const skipThreshold = targetDelta + deadband;
    const catchupThreshold = targetDelta - deadband;

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
      if (currentDelta < catchupThreshold - 4) {
        updatedClientTick = stepAndFillVacantTicks(reconciler, currentClientTick, currentClientTick + 1);
      }
    } else {
      reconciler.interpolator?.setPhysicsRate?.(120);
      reconciler.shouldSkipLocalStep = false;
    }
  }

  return updatedClientTick;
}

export function replayAndEvaluateCorrection(reconciler, packet, serverTick, currentClientTick, prePositions, numCars) {
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
          : (entry.cars.has(c)
            ? entry.cars.get(c)
            : (reconciler.lastRemoteControls.get(c) || reconciler.neutralControls));
        const remoteCtrl = rawRemote?.controls ? rawRemote.controls : (rawRemote || reconciler.neutralControls);
        entry.cars.set(c, { ...remoteCtrl });
        reconciler.sim.setControls(c, remoteCtrl);
      }
    }

    reconciler.sim.saveStateSlot(t % 256);
    reconciler.sim.stepSilent(1);
  }
  reconciler.sim.saveStateSlot(currentClientTick % 256);

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
  if (delta > 0.05) {
    reconciler.totalCorrections++;
    reconciler.metrics.totalCorrections = reconciler.totalCorrections;
    reconciler.metrics.lastCorrectionDelta = delta;
    if (delta > reconciler.maxCorrectionDelta) {
      reconciler.maxCorrectionDelta = delta;
      reconciler.metrics.maxCorrectionDelta = delta;
    }

    if (reconciler.enableSmoothing) {
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

  reconciler.sim.saveStateSlot(currentClientTick % 256);

  reconciler.metrics.clientTick = currentClientTick;
  reconciler.metrics.serverTick = serverTick;
  reconciler.metrics.leadTicks = reconciler.leadTicks;
  reconciler.notifyMetricsUpdated();
}
