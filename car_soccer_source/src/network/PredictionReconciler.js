/**
 * src/network/PredictionReconciler.js
 * High-precision Client Prediction & Server Reconciliation Subsystem.
 * 
 * Features:
 * 1. Client Timeline Lead: Runs client simulation ahead of server by OneWayDelay + JitterBuffer
 *    so client inputs arrive at server buffer in advance, eliminating input underruns.
 * 2. Multi-Entity Prediction & Replay: Supports up to 6 cars and the ball during rollback resimulation.
 * 3. Dead-Reckoning Extrapolation: Extrapolates remote player inputs during rollback catch-up.
 * 4. Configurable Visual Smoothing: Exponential decay smoothing toggleable (default OFF for early dev).
 * 5. Diagnostic Instrumentation: Rich console logging upon stall, spiral-of-death, or divergence.
 */

import { ClientInputBuffer } from './ClientInputBuffer.js';
import { InputPacketCodec } from './InputPacketCodec.js';

export class PredictionReconciler {
  /**
   * @param {import('../physics/RocketSimPhysicsEngine.js').RocketSimPhysicsEngine} clientSim
   * @param {import('./NetworkChannel.js').NetworkChannel} channel
   * @param {object} [options]
   */
  constructor(clientSim, channel, options = {}) {
    this.sim = clientSim;
    this.channel = channel;
    this.options = options;

    this.localCarIndex = options.localCarIndex ?? 0;
    this.capacity = 1024;
    this.mask = this.capacity - 1;

    // Ring buffer storing inputs: index -> { tick: number, cars: Map<number, object> }
    this.inputHistory = new Array(this.capacity);
    this.clientInputRingBuffer = new ClientInputBuffer(64);
    this.redundantHistoryCount = options.redundantHistoryCount ?? (options.enableRedundantBuffer ? 10 : 1);
    this.useBitPacking = options.useBitPacking ?? false;
    this.lastLocalControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };
    this.lastRemoteControls = new Map(); // carIndex -> controls
    this.neutralControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };

    this.lastAckedServerTick = -1;
    this.totalCorrections = 0;
    this.maxCorrectionDelta = 0;

    // Timeline lead state
    this.tickDtMs = 1000.0 / 120.0;
    this.leadTicks = this.calculateLeadTicks();
    this.isTimelineSynchronized = false;

    // Visual Error Smoothing (default OFF per user preference for raw glitch diagnosis)
    this.enableSmoothing = options.enableSmoothing ?? false;
    this.visualSmoothingOffset = { x: 0, y: 0, z: 0 };
    this.smoothingDecayRate = 18.0;
    this.enableRedundantInputs = options.enableRedundantInputs ?? false;
    this.redundantHistoryTicks = options.redundantHistoryTicks ?? 12;
    this.shouldSkipLocalStep = false;

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
  }

  /**
   * Calculate required timeline lead ticks based on network latency
   * @param {number} [rttMs]
   * @returns {number}
   */
  get clientReportRate() {
    return 120;
  }

  calculateLeadTicks(rttMs = this.channel?.rttMs || 80) {
    const oneWayMs = rttMs * 0.5;
    const jitterBufferTicks = 2;
    return Math.max(1, Math.ceil(oneWayMs / this.tickDtMs) + jitterBufferTicks);
  }

  /**
   * Establish initial timeline synchronization with server state
   * Advances client simulation by leadTicks ahead of server
   * @param {Float32Array} serverSnapshot
   * @param {number} [serverTick=0]
   */
  syncTimeline(serverSnapshot, serverTick = 0, nowMs = performance.now()) {
    this.sim.restoreState(serverSnapshot);
    this.leadTicks = this.calculateLeadTicks();

    // Prime the pipeline for the initial lead ticks with neutral inputs
    for (let t = serverTick; t < serverTick + this.leadTicks; t++) {
      const slot = t & this.mask;
      this.inputHistory[slot] = {
        tick: t,
        cars: new Map([[this.localCarIndex, { ...this.neutralControls }]])
      };
      this.clientInputRingBuffer.record(t, this.localCarIndex, this.neutralControls);
      this.channel.sendClientInput({
        tick: t,
        carIndex: this.localCarIndex,
        controls: { ...this.neutralControls },
        timestamp: nowMs
      }, nowMs);
      this.sim.stepSilent(1);
    }

    const currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
    this.lastAckedServerTick = serverTick;
    this.isTimelineSynchronized = true;

    // Prime snapshot slots
    for (let s = 0; s < 256; s++) {
      this.sim.saveStateSlot(s);
    }

    this.metrics.clientTick = currentClientTick;
    this.metrics.serverTick = serverTick;
    this.metrics.leadTicks = this.leadTicks;
  }

  /**
   * Record local input and send packet to authoritative server
   * @param {number} carIndex
   * @param {object} controls
   * @param {number} [nowMs=performance.now()]
   */
  sampleAndPredictInput(carIndex, controls, nowMs = performance.now()) {
    const currentTick = Math.floor(this.sim.getHeaderView().tickCount);
    const slot = currentTick & this.mask;

    if (!this.inputHistory[slot] || this.inputHistory[slot].tick !== currentTick) {
      this.inputHistory[slot] = { tick: currentTick, cars: new Map() };
    }
    this.inputHistory[slot].cars.set(carIndex, { ...controls });

    if (carIndex === this.localCarIndex) {
      this.lastLocalControls = { ...controls };
    }

    // Record into redundant ring buffer
    this.clientInputRingBuffer.record(currentTick, carIndex, controls);

    const isRedundantEnabled = (this.redundantHistoryCount > 1) || Boolean(this.enableRedundantInputs);
    if (isRedundantEnabled) {
      const historyLimit = Math.max(this.redundantHistoryCount, this.redundantHistoryTicks || 10);
      const redundantWindow = this.clientInputRingBuffer.getRedundantWindow(
        currentTick,
        historyLimit,
        carIndex
      );

      let outboundPacket = {
        tick: currentTick,
        targetTick: currentTick,
        carIndex,
        controls: { ...controls },
        history: redundantWindow,
        redundantInputs: redundantWindow,
        timestamp: nowMs
      };

      if (this.useBitPacking) {
        outboundPacket = InputPacketCodec.encode(carIndex, currentTick, redundantWindow);
      }

      this.channel.sendClientInput(outboundPacket, nowMs);
    } else {
      this.channel.sendClientInput({
        tick: currentTick,
        carIndex,
        controls: { ...controls },
        timestamp: nowMs
      }, nowMs);
    }

    // Save snapshot slot for quick local rollback
    this.sim.saveStateSlot(currentTick % 256);
    this.metrics.clientTick = currentTick;
  }

  /**
   * Process all incoming authoritative state packets from server and perform reconciliation if needed
   * @param {number} [nowMs=performance.now()]
   */
  reconcile(nowMs = performance.now()) {
    const incomingPackets = this.channel.receiveClientPackets(nowMs);
    if (!incomingPackets || incomingPackets.length === 0) return;

    for (const packet of incomingPackets) {
      const serverTick = packet.serverTick;
      if (serverTick <= this.lastAckedServerTick) continue; // Drop stale packets

      this.lastAckedServerTick = serverTick;
      this.metrics.serverTick = serverTick;
      this.metrics.rttMs = this.channel.rttMs;
      this.metrics.leadTicks = this.leadTicks;

      // Ingest acknowledged remote controls from server
      if (packet.acknowledgedControls && Array.isArray(packet.acknowledgedControls)) {
        for (let c = 0; c < packet.acknowledgedControls.length; c++) {
          if (c !== this.localCarIndex) {
            this.lastRemoteControls.set(c, { ...packet.acknowledgedControls[c] });
          }
        }
      }

      let currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
      const rollbackDepth = currentClientTick - serverTick;

      if (!this.isTimelineSynchronized || Math.abs(rollbackDepth) > 120) {
        console.log(`[PredictionReconciler] Timeline sync aligned (depth: ${rollbackDepth} ticks). Snapping timeline to server tick ${serverTick}.`);
        this.syncTimeline(packet.stateSnapshot, serverTick, nowMs);
        this.shouldSkipLocalStep = false;
        continue;
      }

      // Diagnostic check & fast-forward if server tick has overtaken client
      if (serverTick > currentClientTick) {
        this.sim.restoreState(packet.stateSnapshot);
        for (let k = 0; k < this.leadTicks; k++) {
          const t = serverTick + k;
          this.sampleAndPredictInput(this.localCarIndex, this.lastLocalControls, nowMs);
          this.sim.stepSilent(1);
        }
        this.shouldSkipLocalStep = false;
        continue;
      }

      // Maintain Target Timeline Lead against server transit time and clock drift (Legacy Hard Sync)
      const oneWayTicks = Math.max(1, Math.ceil((this.channel?.rttMs ?? 80) * 0.5 / this.tickDtMs));
      const targetDelta = this.leadTicks + oneWayTicks;
      const currentDelta = currentClientTick - serverTick;

      if (currentDelta < targetDelta - 3) {
        // Slow: multi-step fast-forward (glitch catch-up)
        const catchUpTicks = Math.min(targetDelta - currentDelta, 12);
        for (let k = 0; k < catchUpTicks; k++) {
          const t = currentClientTick + k;
          this.sampleAndPredictInput(this.localCarIndex, this.lastLocalControls, nowMs);
          this.sim.stepSilent(1);
        }
        currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
        this.shouldSkipLocalStep = false;
      } else if (currentDelta > targetDelta + 4) {
        // Fast: wait/pause next local physics step to let authoritative server catch up
        this.shouldSkipLocalStep = true;
      } else {
        this.shouldSkipLocalStep = false;
      }

      // Check pre-correction state of all active cars
      const numCars = Math.min(this.sim.numCars, 6);
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

      // Diagnostic NaN guard
      if (hasNaN) {
        console.error('[PredictionReconciler] NaN detected in vehicle coordinates! Forcing full state reset.');
        this.sim.restoreState(packet.stateSnapshot);
        continue;
      }

      // Restore authoritative server state
      this.sim.restoreState(packet.stateSnapshot);

      // Replay unacknowledged inputs across all cars from serverTick up to currentClientTick
      for (let t = serverTick; t < currentClientTick; t++) {
        const slot = t & this.mask;
        const entry = this.inputHistory[slot];
        const isEntryValid = entry && entry.tick === t;

        for (let c = 0; c < numCars; c++) {
          if (c === this.localCarIndex) {
            const ctrl = (isEntryValid && entry.cars.has(c))
              ? entry.cars.get(c)
              : this.lastLocalControls;
            this.sim.setControls(c, ctrl);
          } else {
            // Extrapolate remote player input
            const remoteCtrl = (isEntryValid && entry.cars.has(c))
              ? entry.cars.get(c)
              : (this.lastRemoteControls.get(c) || this.neutralControls);
            this.sim.setControls(c, remoteCtrl);
          }
        }

        this.sim.stepSilent(1);
        this.sim.saveStateSlot(t % 256);
      }

      // Calculate physical correction offset across all active cars
      let maxDelta = 0;
      let localDelta = 0;
      for (let c = 0; c < numCars; c++) {
        const postCar = this.sim.getCarStateView(c);
        const carDelta = Math.hypot(
          prePositions[c].x - postCar.posX,
          prePositions[c].y - postCar.posY,
          prePositions[c].z - postCar.posZ
        );
        if (c === this.localCarIndex) {
          localDelta = carDelta;
        }
        if (carDelta > maxDelta) {
          maxDelta = carDelta;
        }
      }

      const delta = maxDelta;
      if (delta > 0.05) { // Correction threshold > 0.05 UU
        this.totalCorrections++;
        this.metrics.totalCorrections = this.totalCorrections;
        this.metrics.lastCorrectionDelta = delta;
        if (delta > this.maxCorrectionDelta) {
          this.maxCorrectionDelta = delta;
          this.metrics.maxCorrectionDelta = delta;
        }

        if (this.enableSmoothing) {
          // Accumulate visual smoothing offset for local car
          const postCar0 = this.sim.getCarStateView(this.localCarIndex);
          this.visualSmoothingOffset.x += (prePositions[this.localCarIndex].x - postCar0.posX);
          this.visualSmoothingOffset.y += (prePositions[this.localCarIndex].y - postCar0.posY);
          this.visualSmoothingOffset.z += (prePositions[this.localCarIndex].z - postCar0.posZ);

          const maxOffset = 300.0;
          const currentOffsetLen = Math.hypot(this.visualSmoothingOffset.x, this.visualSmoothingOffset.y, this.visualSmoothingOffset.z);
          if (currentOffsetLen > maxOffset) {
            const factor = maxOffset / currentOffsetLen;
            this.visualSmoothingOffset.x *= factor;
            this.visualSmoothingOffset.y *= factor;
            this.visualSmoothingOffset.z *= factor;
          }
        }
      }
    }

    if (this.onMetricsUpdated) {
      this.metrics.smoothingMagnitude = Math.hypot(this.visualSmoothingOffset.x, this.visualSmoothingOffset.y, this.visualSmoothingOffset.z);
      this.onMetricsUpdated(this.metrics);
    }
  }

  /**
   * Update visual smoothing decay each render frame
   * @param {number} deltaSeconds Frame delta time in seconds
   * @returns {{ x: number, y: number, z: number }} Current visual smoothing offset to add to vehicle mesh
   */
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
