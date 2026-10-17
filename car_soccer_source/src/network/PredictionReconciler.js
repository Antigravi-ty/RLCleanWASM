import { LocalClientInputBuffer } from './LocalClientInputBuffer.js';
import { drainAndParseServerPackets, dumpNetworkPacket } from './PacketDumpDiagnostics.js';
import {
  modulateReconcilerClockPacing,
  replayAndEvaluateCorrection,
  syncReconcilerTimeline
} from './ReconciliationTimelineHelper.js';
import {
  acknowledgeReconcilerSignal,
  acknowledgeReconcilerServerSignals,
  enqueueReconcilerClientCommand,
  collectPiggybackAcksAndCommands,
  sendReconcilerOutboundInputForTick,
  flushReconcilerPendingControlPackets
} from './ReconcilerControlMessenger.js';

export class PredictionReconciler {
  /**
   * @param {import('../physics/RocketSimPhysicsEngine.js').RocketSimPhysicsEngine} clientSim
   * @param {object} channel
   * @param {object} [options]
   */
  constructor(clientSim, channel, options = {}) {
    this.sim = clientSim;
    this.channel = channel;
    this.options = options;

    this.localCarIndex = options.localCarIndex ?? 0;
    this.capacity = 1024;
    this.mask = this.capacity - 1;

    this.inputHistory = new Array(this.capacity);
    this.clientInputRingBuffer = new LocalClientInputBuffer(256);
    this.redundantHistoryCount = options.redundantHistoryCount ?? (options.enableRedundantBuffer ? 10 : 1);
    this.useBitPacking = options.useBitPacking ?? false;
    this.lastLocalControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };
    this.lastRemoteControls = new Map();
    this.neutralControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };

    this.lastAckedServerTick = -1;
    this.totalCorrections = 0;
    this.maxCorrectionDelta = 0;

    this.tickDtMs = 1000.0 / 120.0;
    this.inputBufferTarget = options.inputBufferTarget ?? 3;
    this.catchupThresholdOffset = options.catchupThresholdOffset ?? -2;
    this.skipThresholdOffset = options.skipThresholdOffset ?? 2;
    this.forceTargetAlign = false;
    this.leadTicks = this.calculateLeadTicks();
    this.isTimelineSynchronized = false;

    this.enableSmoothing = options.enableSmoothing ?? false;
    this.visualSmoothingOffset = { x: 0, y: 0, z: 0 };
    this.smoothingDecayRate = 18.0;
    this.enableRedundantInputs = options.enableRedundantInputs ?? false;
    this.redundantHistoryTicks = options.redundantHistoryTicks ?? 12;
    this.shouldSkipLocalStep = false;
    this.interpolator = options.interpolator || null;
    this.clockPacingMode = options.clockPacingMode || 'legacy';

    this.lastHardResyncTime = 0;
    this.onHardResync = options.onHardResync || null;

    this._lastProcessedClientTimestamp = 0;
    this.measuredRtt = 0;
    this.lastReceivedPacketRaw = null;
    this.lastParsedPacket = null;
    this.pendingDumpNextPacket = false;
    this._onNextDumpResolve = null;

    this.pendingSignalAcks = new Map();
    this.pendingClientCommands = new Map();
    this.nextClientCommandId = 0;
    this.kickoffMaskUntilTick = -1;
    this.carVisualPresets = new Map();

    this.metrics = {
      clientTick: 0,
      serverTick: 0,
      leadTicks: this.leadTicks,
      rttMs: 0,
      totalCorrections: 0,
      lastCorrectionDelta: 0,
      maxCorrectionDelta: 0,
      smoothingMagnitude: 0
    };

    this.onMetricsUpdated = null;
    this._metricsListeners = new Set();
  }

  _resolveEffectiveRtt() {
    if (this.channel?.isLoopback) {
      return Math.max(0, Math.round((this.channel.extraLatencyMs ?? 0) * 2));
    }
    if (Number.isFinite(this.measuredRtt) && this.measuredRtt > 0) {
      return this.measuredRtt;
    }
    return Math.max(0, typeof this.channel?.rttMs === 'number' && Number.isFinite(this.channel.rttMs) ? this.channel.rttMs : 0);
  }

  setClockPacingMode(mode) {
    if (mode !== 'csts' && mode !== 'legacy') {
      throw new Error(`[PredictionReconciler] Unknown clock pacing mode: ${mode}. Expected 'csts' or 'legacy'.`);
    }
    this.clockPacingMode = mode;
    if (mode === 'legacy') {
      this.interpolator?.setPhysicsRate?.(120);
    }
  }

  setInputBufferTarget(target) {
    if (typeof target === 'number' && Number.isFinite(target) && target >= 1) {
      const rounded = Math.max(1, Math.min(6, Math.round(target)));
      if (rounded !== this.inputBufferTarget) {
        this.forceTargetAlign = true;
      }
      this.inputBufferTarget = rounded;
      const effectiveRtt = this._resolveEffectiveRtt();
      this.leadTicks = this.calculateLeadTicks(effectiveRtt);
      this.metrics.leadTicks = this.leadTicks;
      this.notifyMetricsUpdated();
    }
  }

  setInputBufferThresholds(catchupOffset, skipOffset) {
    if (typeof catchupOffset === 'number' && Number.isFinite(catchupOffset)) {
      this.catchupThresholdOffset = Math.min(0, Math.round(catchupOffset));
    }
    if (typeof skipOffset === 'number' && Number.isFinite(skipOffset)) {
      this.skipThresholdOffset = Math.max(0, Math.round(skipOffset));
    }
    this.notifyMetricsUpdated();
  }

  addMetricsListener(fn) {
    if (typeof fn === 'function') {
      this._metricsListeners.add(fn);
      return () => this._metricsListeners.delete(fn);
    }
    return () => {};
  }

  setEnableSmoothing(enabled) {
    this.enableSmoothing = Boolean(enabled);
    this.metrics.enableSmoothing = this.enableSmoothing;
    if (!this.enableSmoothing) {
      this.visualSmoothingOffset = { x: 0, y: 0, z: 0 };
      this.metrics.smoothingMagnitude = 0;
    }
    this.notifyMetricsUpdated();
  }

  notifyMetricsUpdated() {
    const rawRtt = this._resolveEffectiveRtt();
    if (!Number.isFinite(rawRtt)) {
      throw new Error(`[PredictionReconciler] Channel rttMs is non-finite: ${rawRtt}`);
    }
    this.metrics.rttMs = rawRtt;
    this.metrics.enableSmoothing = this.enableSmoothing;
    this.metrics.rollbackWindow = this.inputHistory?.length || 0;
    if (this.onMetricsUpdated) {
      try {
        this.onMetricsUpdated(this.metrics);
      } catch (err) {
        console.error('[PredictionReconciler] Error in onMetricsUpdated callback:', err);
      }
    }
    for (const listener of this._metricsListeners) {
      try {
        listener(this.metrics);
      } catch (err) {
        console.error('[PredictionReconciler] Error in metrics listener:', err);
      }
    }
  }

  get clientReportRate() {
    return 120;
  }

  get serverTick() {
    return this.lastAckedServerTick >= 0 ? this.lastAckedServerTick : (this.metrics?.serverTick ?? 0);
  }

  calculateLeadTicks(rttMs = this._resolveEffectiveRtt()) {
    if (rttMs <= 2) {
      return Math.max(1, this.inputBufferTarget);
    }
    const oneWayMs = rttMs * 0.5;
    const jitterBufferTicks = this.inputBufferTarget;
    const computed = Math.ceil(oneWayMs / this.tickDtMs) + jitterBufferTicks;
    const maxLead = this.clockPacingMode === 'legacy' ? (this.options.maxLeadTicks ?? 72) : (this.options.maxLeadTicks ?? 30);
    return Math.max(this.inputBufferTarget, Math.min(maxLead, computed));
  }

  getPreviousCommittedControls(tick, carIndex = this.localCarIndex) {
    for (let t = tick - 1; t >= Math.max(0, tick - 64); t--) {
      const entry = this.inputHistory[t & this.mask];
      if (entry && entry.tick === t && entry.cars.has(carIndex)) {
        return { ...entry.cars.get(carIndex) };
      }
    }
    if (carIndex === this.localCarIndex) {
      return { ...this.lastLocalControls };
    }
    const remote = this.lastRemoteControls.get(carIndex);
    return { ...(remote?.controls ? remote.controls : (remote || this.neutralControls)) };
  }

  acknowledgeSignal(signalId, signalType, repeatCount = 8) {
    acknowledgeReconcilerSignal(this, signalId, signalType, repeatCount);
  }

  acknowledgeServerSignals(signals) {
    acknowledgeReconcilerServerSignals(this, signals);
  }

  enqueueClientCommand(commandType, param1 = 0, param2 = 0, maxSends = 60) {
    return enqueueReconcilerClientCommand(this, commandType, param1, param2, maxSends);
  }

  queueClientCommand(commandType, param1 = 0, param2 = 0, maxSends = 240) {
    return this.enqueueClientCommand(commandType, param1, param2, maxSends);
  }

  resolveClientCommandAck(commandId) {
    if (typeof commandId !== 'number' || commandId <= 0) return;
    this.pendingClientCommands?.delete(commandId);
  }

  setKickoffMaskUntilTick(targetTick) {
    this.kickoffMaskUntilTick = typeof targetTick === 'number' ? targetTick : -1;
  }

  setCarVisualPreset(carIndex, visualId) {
    if (!this.carVisualPresets) this.carVisualPresets = new Map();
    if (typeof carIndex === 'number' && carIndex >= 0 && visualId) {
      this.carVisualPresets.set(carIndex, visualId);
    }
  }

  _collectPiggybackAcksAndCommands() {
    return collectPiggybackAcksAndCommands(this);
  }

  sendOutboundInputForTick(tick, carIndex = this.localCarIndex, controls = null, nowMs = performance.now()) {
    sendReconcilerOutboundInputForTick(this, tick, carIndex, controls, nowMs);
  }

  flushPendingControlPackets(nowMs = performance.now()) {
    flushReconcilerPendingControlPackets(this, nowMs);
  }

  syncTimeline(serverSnapshot, serverTick = 0, nowMs = performance.now()) {
    syncReconcilerTimeline(this, serverSnapshot, serverTick, nowMs);
  }

  sampleAndPredictInput(carIndex, controls, nowMs = performance.now()) {
    const currentTick = Math.floor(this.sim.getHeaderView().tickCount);
    const isKickoffMasked = this.kickoffMaskUntilTick > 0 && currentTick < this.kickoffMaskUntilTick;
    const effectiveControls = isKickoffMasked ? this.neutralControls : controls;
    const slot = currentTick & this.mask;

    let entry = this.inputHistory[slot];
    if (!entry || entry.tick !== currentTick) {
      entry = { tick: currentTick, cars: new Map() };
      this.inputHistory[slot] = entry;
    }

    let committedControls;
    if (isKickoffMasked) {
      committedControls = { ...this.neutralControls };
      entry.cars.set(carIndex, committedControls);
    } else if (entry.cars.has(carIndex)) {
      committedControls = { ...entry.cars.get(carIndex) };
    } else {
      committedControls = { ...effectiveControls };
      entry.cars.set(carIndex, committedControls);
    }

    if (carIndex === this.localCarIndex) {
      this.lastLocalControls = { ...committedControls };
    }

    this.clientInputRingBuffer.record(currentTick, carIndex, committedControls);
    this.sendOutboundInputForTick(currentTick, carIndex, committedControls, nowMs);

    this.sim.saveStateSlot(currentTick % 256);
    this.metrics.clientTick = currentTick;
    if (currentTick % 2 === 0) {
      this.notifyMetricsUpdated();
    }

    return committedControls;
  }

  reconcile(nowMs = performance.now()) {
    let incomingPackets = null;
    if (typeof this.channel?.receiveClientPackets === 'function') {
      incomingPackets = this.channel.receiveClientPackets(nowMs);
    } else if (typeof this.channel?.receiveServerPackets === 'function') {
      incomingPackets = this.channel.receiveServerPackets(nowMs);
    } else if (Array.isArray(this.channel?.inboundQueue)) {
      incomingPackets = this.channel.inboundQueue.splice(0);
    }
    if (!incomingPackets || incomingPackets.length === 0) return;

    const packet = drainAndParseServerPackets(this, incomingPackets, nowMs);
    if (!packet) return;

    const serverTick = packet.serverTick;
    if (serverTick <= this.lastAckedServerTick && serverTick > 0) return;
    this.lastAckedServerTick = serverTick;
    this.metrics.serverTick = serverTick;
    this.metrics.rttMs = this.channel?.rttMs ?? 0;
    this.metrics.leadTicks = this.leadTicks;

    const serverCarCount = packet.acknowledgedControls?.length || 1;
    while (this.sim.numCars < serverCarCount) {
      const nextCarIdx = this.sim.numCars;
      const preset = this.carVisualPresets.get(nextCarIdx) || 'octane';
      this.sim.addCar(nextCarIdx % 2, preset);
    }

    if (packet.acknowledgedControls && Array.isArray(packet.acknowledgedControls)) {
      for (const item of packet.acknowledgedControls) {
        if (!item) continue;
        const carIdx = typeof item.carIndex === 'number' ? item.carIndex : -1;
        const ctrl = item.controls || item;
        if (carIdx >= 0 && carIdx !== this.localCarIndex) {
          this.lastRemoteControls.set(carIdx, { ...ctrl });
        }
      }
    }

    this.lastParsedPacket = packet;
    if (this.pendingDumpNextPacket) {
      this.pendingDumpNextPacket = false;
      const dumped = this.dumpPacket(packet);
      if (typeof this._onNextDumpResolve === 'function') {
        this._onNextDumpResolve(dumped);
        this._onNextDumpResolve = null;
      }
    }

    const effectiveRtt = this._resolveEffectiveRtt();
    this.leadTicks = this.calculateLeadTicks(effectiveRtt);
    const isLocalChannel = effectiveRtt <= 2;
    const maxOneWayTicks = this.clockPacingMode === 'legacy' ? 64 : 25;
    const oneWayTicks = isLocalChannel ? 0 : Math.max(1, Math.min(maxOneWayTicks, Math.ceil(effectiveRtt * 0.5 / this.tickDtMs)));
    const targetDelta = this.leadTicks + oneWayTicks;

    let currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
    const currentDelta = currentClientTick - serverTick;
    const desyncDistance = Math.abs(currentDelta - targetDelta);
    const rollbackDepth = currentClientTick - serverTick;
    const maxRollbackFrames = this.options.maxRollbackFrames ?? 180;

    const shouldHardResync = !this.isTimelineSynchronized ||
      (rollbackDepth > maxRollbackFrames) ||
      (rollbackDepth < 0) ||
      (desyncDistance > maxRollbackFrames);

    if (shouldHardResync) {
      const timeSinceLastSnap = nowMs - this.lastHardResyncTime;
      if (timeSinceLastSnap > 300 || !this.isTimelineSynchronized) {
        console.log(`[PredictionReconciler] Timeline sync aligned (currentDelta: ${currentDelta}, target: ${targetDelta}, rollbackDepth: ${rollbackDepth}). Snapping timeline to server tick ${serverTick}.`);
        this.syncTimeline(packet.stateSnapshot, serverTick, nowMs);
        if (typeof this.onHardResync === 'function') {
          this.onHardResync();
        }
      }
      return;
    }

    currentClientTick = modulateReconcilerClockPacing(this, currentClientTick, currentDelta, targetDelta);

    const numCars = Math.min(this.sim.numCars, 8);
    const prePositions = [];
    let hasNaN = false;
    for (let c = 0; c < numCars; c++) {
      const car = this.sim.getCarStateView(c);
      if (Number.isNaN(car.posX) || Number.isNaN(car.posY) || Number.isNaN(car.posZ)) {
        hasNaN = true;
        break;
      }
      prePositions[c] = { x: car.posX, y: car.posY, z: car.posZ };
    }

    if (hasNaN) {
      console.error('[PredictionReconciler] NaN detected in vehicle coordinates! Forcing full state reset.');
      this.syncTimeline(packet.stateSnapshot, serverTick, nowMs);
      if (typeof this.onHardResync === 'function') this.onHardResync();
      return;
    }

    replayAndEvaluateCorrection(this, packet, serverTick, currentClientTick, prePositions, numCars);
    this.metrics.clientTick = currentClientTick;
    this.notifyMetricsUpdated();
  }

  updateSmoothing(deltaSeconds) {
    if (!this.enableSmoothing || deltaSeconds <= 0) {
      this.visualSmoothingOffset.x = 0;
      this.visualSmoothingOffset.y = 0;
      this.visualSmoothingOffset.z = 0;
      return this.visualSmoothingOffset;
    }

    const decay = Math.exp(-this.smoothingDecayRate * deltaSeconds);
    this.visualSmoothingOffset.x *= decay;
    this.visualSmoothingOffset.y *= decay;
    this.visualSmoothingOffset.z *= decay;

    if (Math.abs(this.visualSmoothingOffset.x) < 0.001) this.visualSmoothingOffset.x = 0;
    if (Math.abs(this.visualSmoothingOffset.y) < 0.001) this.visualSmoothingOffset.y = 0;
    if (Math.abs(this.visualSmoothingOffset.z) < 0.001) this.visualSmoothingOffset.z = 0;

    return this.visualSmoothingOffset;
  }

  triggerDumpNextPacket() {
    this.pendingDumpNextPacket = true;
    return new Promise((resolve) => {
      this._onNextDumpResolve = resolve;
    });
  }

  dumpPacket(packetOrRaw = null) {
    const item = packetOrRaw || this.lastParsedPacket || this.lastReceivedPacketRaw;
    return dumpNetworkPacket(item);
  }

  resetStats() {
    this.totalCorrections = 0;
    this.maxCorrectionDelta = 0;
    this.visualSmoothingOffset = { x: 0, y: 0, z: 0 };
    this.metrics.totalCorrections = 0;
    this.metrics.lastCorrectionDelta = 0;
    this.metrics.maxCorrectionDelta = 0;
    this.metrics.smoothingMagnitude = 0;
  }
}

export default PredictionReconciler;
