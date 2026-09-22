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

import { InputPacketCodec } from './InputPacketCodec.js';
import { EstablishedSessionManager } from './EstablishedSessionManager.js';
import { GlobalPayloadCodec } from './GlobalPayloadCodec.js';
import { GameStateView } from '../physics/RocketSimConstants.js';

/**
 * Embedded sliding window ring buffer for recent client inputs.
 */
class LocalClientInputBuffer {
  constructor(capacity = 128) {
    this.capacity = capacity;
    this.mask = capacity - 1;
    this.slots = new Array(capacity);
    this.neutralControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };
  }
  record(tick, carIndex, controls) {
    this.slots[tick & this.mask] = {
      tick,
      carIndex,
      controls: { ...controls }
    };
  }
  get(tick) {
    const entry = this.slots[tick & this.mask];
    return (entry && entry.tick === tick) ? entry.controls : null;
  }
  getRedundantWindow(targetTick, count = 10, carIndex = 0) {
    const window = [];
    const startTick = targetTick - count + 1;
    let fallback = this.neutralControls;
    for (let t = startTick; t <= targetTick; t++) {
      const entry = this.get(t);
      if (entry) { fallback = entry; break; }
    }
    for (let t = startTick; t <= targetTick; t++) {
      const controls = this.get(t) || fallback;
      window.push({ tick: t, carIndex, controls: { ...controls } });
      fallback = controls;
    }
    return window;
  }
  clear() {
    this.slots.fill(undefined);
  }
}

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

    // Ring buffer storing inputs: index -> { tick: number, cars: Map<number, object> }
    this.inputHistory = new Array(this.capacity);
    this.clientInputRingBuffer = new LocalClientInputBuffer(128);
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

    this.lastHardResyncTime = 0;
    this.onHardResync = options.onHardResync || null;

    this.measuredRtt = 0;
    this.lastReceivedPacketRaw = null;
    this.lastParsedPacket = null;
    this.pendingDumpNextPacket = false;
    this._onNextDumpResolve = null;

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

  calculateLeadTicks(rttMs = this.channel?.rttMs ?? 0) {
    if (rttMs <= 2) {
      return 2;
    }
    const oneWayMs = rttMs * 0.5;
    const jitterBufferTicks = 2;
    const computed = Math.ceil(oneWayMs / this.tickDtMs) + jitterBufferTicks;
    const maxLead = this.options.maxLeadTicks ?? 60;
    return Math.max(2, Math.min(maxLead, computed));
  }

  /**
   * Establish initial timeline synchronization with server state
   * Advances client simulation by leadTicks ahead of server
   * @param {Float32Array} serverSnapshot
   * @param {number} [serverTick=0]
   */
  syncTimeline(serverSnapshot, serverTick = 0, nowMs = performance.now()) {
    if (serverSnapshot) {
      this.sim.restoreState(serverSnapshot);
    }
    const effectiveRtt = this.measuredRtt > 0 ? this.measuredRtt : Math.max(0, this.channel?.rttMs ?? 0);
    this.leadTicks = this.calculateLeadTicks(effectiveRtt);
    const isLocalChannel = effectiveRtt <= 2;
    const oneWayTicks = isLocalChannel ? 0 : Math.max(1, Math.min(45, Math.ceil(effectiveRtt * 0.5 / this.tickDtMs)));
    const targetDelta = this.leadTicks + oneWayTicks;

    // Fast-forward timeline silently by targetDelta using unacknowledged or neutral inputs
    for (let t = serverTick; t < serverTick + targetDelta; t++) {
      const slot = t & this.mask;
      const entry = this.inputHistory[slot];
      const ctrl = (entry && entry.tick === t && entry.cars.has(this.localCarIndex))
        ? entry.cars.get(this.localCarIndex)
        : this.lastLocalControls;

      this.inputHistory[slot] = {
        tick: t,
        cars: new Map([[this.localCarIndex, { ...ctrl }]])
      };
      this.clientInputRingBuffer.record(t, this.localCarIndex, ctrl);
      this.sim.setControls(this.localCarIndex, ctrl);
      this.sim.stepSilent(1);
    }

    const currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
    this.lastAckedServerTick = serverTick;
    this.isTimelineSynchronized = true;
    this.shouldSkipLocalStep = false;
    this.lastHardResyncTime = nowMs;

    this.sim.saveStateSlot(currentClientTick % 256);

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
      const historyLimit = Math.max(
        this.redundantHistoryCount,
        this.redundantHistoryTicks || 10,
        Math.ceil((this.channel?.rttMs || 0) / this.tickDtMs) + 4
      );
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

      // Bit-pack redundant input packet conforming to target network architecture
      outboundPacket = InputPacketCodec.encode(carIndex, currentTick, redundantWindow, nowMs);

      if (typeof this.channel?.sendClientInput === "function") {
        this.channel.sendClientInput(outboundPacket, nowMs);
      } else if (typeof this.channel?.send === "function") {
        this.channel.send(outboundPacket, nowMs);
      }
    } else {
      const singleWindow = [{ tick: currentTick, carIndex, controls: { ...controls } }];
      const outboundPacket = InputPacketCodec.encode(carIndex, currentTick, singleWindow, nowMs);
      if (typeof this.channel?.sendClientInput === "function") {
        this.channel.sendClientInput(outboundPacket, nowMs);
      } else if (typeof this.channel?.send === "function") {
        this.channel.send(outboundPacket, nowMs);
      }
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
    let incomingPackets = null;
    if (typeof this.channel?.receiveClientPackets === "function") {
      incomingPackets = this.channel.receiveClientPackets(nowMs);
    } else if (Array.isArray(this.channel?.inboundQueue)) {
      incomingPackets = this.channel.inboundQueue.splice(0);
    }
    if (!incomingPackets || incomingPackets.length === 0) return;

    // Drain all packets: process telemetry/signals and retain ONLY the latest physics snapshot
    let latestPacket = null;
    for (const rawItem of incomingPackets) {
      let packet = null;

      // Check if binary datagram containing 17-byte client header + GlobalPayload
      if (rawItem instanceof Uint8Array || rawItem instanceof ArrayBuffer) {
        this.lastReceivedPacketRaw = rawItem;
        const clientHeader = EstablishedSessionManager.parseClientPacket(rawItem);
        if (clientHeader) {
          this.metrics.inputBufferSize = clientHeader.inputBufferSize;

          // Track per-packet RTT from echoed client send timestamp
          if (clientHeader.clientTimestamp > 0) {
            const sampleRtt = Math.max(0, nowMs - clientHeader.clientTimestamp);
            if (sampleRtt < 10000) {
              if (this.measuredRtt === 0) {
                this.measuredRtt = sampleRtt;
              } else {
                this.measuredRtt = this.measuredRtt * 0.85 + sampleRtt * 0.15;
              }
              if (this.channel) {
                if (typeof this.channel.rttMs !== 'undefined') {
                  this.channel.measuredRttMs = this.measuredRtt;
                }
              }
            }
          }

          const globalPayload = GlobalPayloadCodec.decode(clientHeader.globalPayloadSlice);
          if (globalPayload) {
            if (globalPayload.signals && globalPayload.signals.length > 0) {
              this.onSignals?.(globalPayload.signals);
            }
            if (globalPayload.allUserRtt) {
              this.metrics.allUserRtt = globalPayload.allUserRtt;
            }
            if (globalPayload.hasPhysics && globalPayload.physics) {
              packet = {
                serverTick: globalPayload.physics.tick,
                stateSnapshot: globalPayload.physics.stateSnapshot,
                acknowledgedControls: globalPayload.physics.acknowledgedControls,
                timestamp: clientHeader.serverTimestamp,
                clientHeader,
                globalPayload,
                rawBytes: rawItem
              };
            }
          }
        }
      } else if (rawItem) {
        let parsedItem = rawItem;
        if (typeof rawItem === 'string') {
          try { parsedItem = JSON.parse(rawItem); } catch (_) {}
        }
        if (parsedItem && typeof parsedItem === "object") {
          if (parsedItem.serverTick !== undefined) {
            packet = parsedItem;
          } else if (parsedItem.type === "handshake_response") {
            this.onHandshakeResponse?.(parsedItem);
            continue;
          }
        }
      }

      if (packet && (!latestPacket || packet.serverTick > latestPacket.serverTick)) {
        latestPacket = packet;
      }
    }

    if (!latestPacket) return;
    const packet = latestPacket;
    const serverTick = packet.serverTick;

    if (serverTick <= this.lastAckedServerTick) return; // Drop stale packets
    this.lastAckedServerTick = serverTick;
    this.metrics.serverTick = serverTick;
    this.metrics.rttMs = this.channel?.rttMs ?? 0;
    this.metrics.leadTicks = this.leadTicks;

    // Dynamically ensure simulation has sufficient car entities before restoring state
    const serverCarCount = packet.acknowledgedControls?.length || 1;
    while (this.sim.numCars < serverCarCount) {
      this.sim.addCar(this.sim.numCars % 2, "default");
    }

    // Ingest acknowledged remote controls from server
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
      if (typeof this._onNextDumpResolve === "function") {
        this._onNextDumpResolve(dumped);
        this._onNextDumpResolve = null;
      }
    }

    const effectiveRtt = this.measuredRtt > 0 ? this.measuredRtt : Math.max(0, this.channel?.rttMs ?? 0);
    this.leadTicks = this.calculateLeadTicks(effectiveRtt);
    const isLocalChannel = effectiveRtt <= 2;
    const oneWayTicks = isLocalChannel ? 0 : Math.max(1, Math.min(45, Math.ceil(effectiveRtt * 0.5 / this.tickDtMs)));
    const targetDelta = this.leadTicks + oneWayTicks;

    let currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
    const currentDelta = currentClientTick - serverTick;
    const desyncDistance = Math.abs(currentDelta - targetDelta);
    const rollbackDepth = currentClientTick - serverTick;
    const maxRollbackFrames = this.options.maxRollbackFrames ?? 120;

    // Hard Resync condition:
    // 1. First synchronization
    // 2. Client behind server (rollbackDepth < 0)
    // 3. Rollback depth exceeds maxRollbackFrames (90 ticks / ~750ms) to cap CPU overhead
    // 4. Excessive desync distance (> maxRollbackFrames)
    const shouldHardResync = !this.isTimelineSynchronized ||
      (rollbackDepth < 0) ||
      (rollbackDepth > maxRollbackFrames) ||
      (desyncDistance > maxRollbackFrames);

    if (shouldHardResync) {
      const timeSinceLastSnap = nowMs - this.lastHardResyncTime;
      if (timeSinceLastSnap > 300 || !this.isTimelineSynchronized) {
        console.log(`[PredictionReconciler] Timeline sync aligned (currentDelta: ${currentDelta}, target: ${targetDelta}, rollbackDepth: ${rollbackDepth}). Snapping timeline to server tick ${serverTick}.`);
        this.syncTimeline(packet.stateSnapshot, serverTick, nowMs);
        if (typeof this.onHardResync === "function") {
          this.onHardResync();
        }
      }
      return;
    }

    // Steady-state clock pacing: absorb minor network jitter with +/- 3 ticks deadband
    const skipThreshold = targetDelta + 3;
    const catchupThreshold = targetDelta - 3;

    if (currentDelta > skipThreshold) {
      // Fast: wait/pause next local physics step to let authoritative server catch up
      this.shouldSkipLocalStep = true;
    } else if (currentDelta < catchupThreshold) {
      // Slow: step extra ticks immediately to close lead deficit smoothly
      const deficit = Math.min(targetDelta - currentDelta, 6);
      for (let s = 0; s < deficit; s++) {
        const slot = currentClientTick & this.mask;
        const entry = this.inputHistory[slot];
        const ctrl = (entry && entry.tick === currentClientTick && entry.cars.has(this.localCarIndex))
          ? entry.cars.get(this.localCarIndex)
          : this.lastLocalControls;
        this.sim.setControls(this.localCarIndex, ctrl);
        this.sim.stepSilent(1);
        currentClientTick = Math.floor(this.sim.getHeaderView().tickCount);
      }
      this.shouldSkipLocalStep = false;
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
      console.error("[PredictionReconciler] NaN detected in vehicle coordinates! Forcing full state reset.");
      this.syncTimeline(packet.stateSnapshot, serverTick, nowMs);
      if (typeof this.onHardResync === "function") this.onHardResync();
      return;
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
          const rawRemote = (isEntryValid && entry.cars.has(c))
            ? entry.cars.get(c)
            : (this.lastRemoteControls.get(c) || this.neutralControls);
          const remoteCtrl = rawRemote?.controls ? rawRemote.controls : (rawRemote || this.neutralControls);
          this.sim.setControls(c, remoteCtrl);
        }
      }

      this.sim.stepSilent(1);
    }
    this.sim.saveStateSlot(currentClientTick % 256);

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

  /**
   * Triggers asynchronous capture and console inspection of the very next incoming network packet
   * @returns {Promise<object>}
   */
  triggerDumpNextPacket() {
    this.pendingDumpNextPacket = true;
    return new Promise((resolve) => {
      this._onNextDumpResolve = resolve;
    });
  }

  /**
   * Pretty-prints and parses a complete network datagram to console
   * @param {object|Uint8Array} [packetOrRaw=null]
   * @returns {object|null}
   */
  dumpPacket(packetOrRaw = null) {
    const item = packetOrRaw || this.lastParsedPacket || this.lastReceivedPacketRaw;
    if (!item) {
      console.warn("[NetworkPacket] No network packet available to inspect.");
      return null;
    }

    let parsed = null;
    if (item.clientHeader && item.globalPayload) {
      parsed = item;
    } else if (item instanceof Uint8Array || item instanceof ArrayBuffer) {
      const clientHeader = EstablishedSessionManager.parseClientPacket(item);
      const globalPayload = clientHeader?.globalPayloadSlice ? GlobalPayloadCodec.decode(clientHeader.globalPayloadSlice) : null;
      parsed = { clientHeader, globalPayload, rawBytes: item };
    } else if (typeof item === 'object') {
      parsed = item;
    }

    const output = {
      inspectionTimestamp: performance.now(),
      summary: {},
      clientHeader: null,
      signals: [],
      allUserRtt: null,
      physics: null
    };

    if (parsed.clientHeader) {
      const ch = parsed.clientHeader;
      const roundTripMs = ch.clientTimestamp > 0 ? (performance.now() - ch.clientTimestamp).toFixed(2) + " ms" : "N/A";
      output.clientHeader = {
        clientTimestamp: ch.clientTimestamp,
        serverTimestamp: ch.serverTimestamp,
        inputBufferSize: ch.inputBufferSize,
        inferredRoundTrip: roundTripMs
      };
      output.summary.inputBufferSize = ch.inputBufferSize;
      output.summary.inferredRtt = roundTripMs;
    }

    const gp = parsed.globalPayload;
    if (gp) {
      if (gp.signals && gp.signals.length > 0) {
        output.signals = gp.signals;
        output.summary.signalsCount = gp.signals.length;
      }
      if (gp.allUserRtt) {
        output.allUserRtt = gp.allUserRtt;
        output.summary.playersRtt = gp.allUserRtt.players;
      }
      if (gp.hasPhysics && gp.physics) {
        const phy = gp.physics;
        output.summary.serverTick = phy.tick;
        output.physics = {
          tick: phy.tick,
          acknowledgedControls: phy.acknowledgedControls,
          cars: [],
          ball: null
        };

        if (phy.stateSnapshot && phy.stateSnapshot.length > 0) {
          try {
            const gv = new GameStateView();
            gv.attach(phy.stateSnapshot);
            output.physics.ball = {
              pos: { x: +gv.ball.posX.toFixed(2), y: +gv.ball.posY.toFixed(2), z: +gv.ball.posZ.toFixed(2) },
              vel: { x: +gv.ball.velX.toFixed(2), y: +gv.ball.velY.toFixed(2), z: +gv.ball.velZ.toFixed(2) },
              angVel: { x: +gv.ball.angVelX.toFixed(2), y: +gv.ball.angVelY.toFixed(2), z: +gv.ball.angVelZ.toFixed(2) }
            };
            const activeCars = Math.min(8, Math.max(1, gv.header.numCars || 2));
            for (let i = 0; i < activeCars; i++) {
              const car = gv.getCar(i);
              output.physics.cars.push({
                carIndex: i,
                pos: { x: +car.posX.toFixed(2), y: +car.posY.toFixed(2), z: +car.posZ.toFixed(2) },
                vel: { x: +car.velX.toFixed(2), y: +car.velY.toFixed(2), z: +car.velZ.toFixed(2) },
                fwd: { x: +car.fwdX.toFixed(2), y: +car.fwdY.toFixed(2), z: +car.fwdZ.toFixed(2) },
                boost: +car.boost.toFixed(1),
                onGround: Boolean(car.isOnGround),
                supersonic: Boolean(car.isSupersonic)
              });
            }
          } catch (e) {
            output.physics.rawSnapshotLength = phy.stateSnapshot.length;
          }
        }
      }
    }

    try {
      console.group(`%c[NETWORK PACKET DUMP]%c ServerTick: ${output.summary.serverTick ?? 'N/A'} | InputBuffer: ${output.summary.inputBufferSize ?? 'N/A'} | InferredRTT: ${output.summary.inferredRtt ?? 'N/A'}`, 'background:#1f6feb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold', 'color:#58a6ff;font-weight:bold');
      console.log('Complete Parsed Datagram:', output);
      if (output.clientHeader) {
        console.log('17-byte Client Header:', output.clientHeader);
      }
      if (output.physics) {
        console.log('Authoritative Physics Tick:', output.physics.tick);
        if (output.physics.acknowledgedControls?.length) {
          console.table(output.physics.acknowledgedControls.map(a => ({ carIndex: a.carIndex, ...a.controls })));
        }
        if (output.physics.cars?.length) {
          console.table(output.physics.cars);
        }
        if (output.physics.ball) {
          console.log('Authoritative Ball State:', output.physics.ball);
        }
      }
      if (output.signals?.length) {
        console.table(output.signals);
      }
      console.groupEnd();
    } catch (_) {}

    return output;
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
