/**
 * src/network/HeadlessClient.js
 * Simulated Headless Client 2 for RocketSim multiplayer network testing.
 * 
 * Controls Car 1 (BOT_CAR_INDEX = 1) over an isolated WebRTC/network data channel.
 * Runs as an independent physics and reconciliation engine in the background (no graphics/display):
 * - Maintains its own independent RocketSim physics simulation and PredictionReconciler.
 * - Simulates on a dedicated 120Hz accumulator.
 * - Schedules, predicts, and transmits inputs targeted at authoritative server ticks.
 * - Reconciles authoritative server state snapshots to maintain physical authority.
 */

import { WebRTCChannel } from './WebRTCChannel.js';
import { RocketSimPhysicsEngine } from '../physics/RocketSimPhysicsEngine.js';
import { PredictionReconciler } from './PredictionReconciler.js';

export class HeadlessClient {
  /**
   * @param {import('./AuthoritativeServer.js').AuthoritativeServer} server
   * @param {object} [options]
   * @param {number} [options.carIndex=1]
   * @param {number} [options.rttMs=80]
   * @param {number} [options.jitterMs=5]
   * @param {number} [options.packetLossRate=0.0]
   */
  constructor(server, options = {}) {
    this.server = server;
    this.carIndex = options.carIndex ?? 1;
    this.rttMs = options.rttMs ?? 80;
    this.jitterMs = options.jitterMs ?? 5;
    this.packetLossRate = options.packetLossRate ?? 0.0;
    this.tickDtMs = 1000.0 / 120.0;

    this.active = false;
    this.channel = new WebRTCChannel({
      rttMs: this.rttMs,
      jitterMs: this.jitterMs,
      packetLossRate: this.packetLossRate
    });

    // Independent background physics engine & reconciler
    this.sim = null;
    this.reconciler = null;
    this.accumulator = 0;
    this.fixedTimestep = 1.0 / 120.0;
    this.lastTime = -1;

    // Scheduled inputs: tick -> controls
    this.scheduledInputs = new Map();
    this.lastSentControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };

    this.neutralControls = {
      throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
    };

    this.lastAckedServerTick = -1;
    this.serverTick = 0;
    this.leadTicks = this.calculateLeadTicks(this.rttMs);
    this.totalPacketsSent = 0;
    this.totalPacketsReceived = 0;

    this.metrics = {
      carIndex: this.carIndex,
      rttMs: this.rttMs,
      leadTicks: this.leadTicks,
      serverTick: 0,
      lastAckedServerTick: -1,
      scheduledQueueSize: 0,
      totalPacketsSent: 0
    };
  }

  /**
   * Initialize isolated headless physics simulation and prediction reconciler
   * @param {object} [config]
   */
  async init(config = {}) {
    if (!this.sim) {
      this.sim = new RocketSimPhysicsEngine();
      await this.sim.init({ freshInstance: true, isolated: true, ...config });
      this.sim.addCar(0, 0);
      this.sim.addCar(1, 1);
      this.reconciler = new PredictionReconciler(this.sim, this.channel, {
        localCarIndex: this.carIndex,
        enableRedundantInputs: true,
        redundantHistoryTicks: 12
      });
      if (this.server?.sim) {
        const snap = this.server.sim.saveState();
        const sTick = Math.floor(this.server.sim.getHeaderView().tickCount);
        this.reconciler.syncTimeline(snap, sTick);
      }
    }
    return this;
  }

  /**
   * Calculate required timeline lead ticks based on network latency
   * @param {number} [rttMs]
   * @returns {number}
   */
  calculateLeadTicks(rttMs = this.rttMs) {
    const oneWayMs = rttMs * 0.5;
    const jitterBufferTicks = 2;
    return Math.max(1, Math.ceil(oneWayMs / this.tickDtMs) + jitterBufferTicks);
  }

  /**
   * Set latency in RTT milliseconds
   * @param {number} rttMs
   */
  setRtt(rttMs) {
    this.rttMs = Math.max(0, rttMs);
    this.channel.setRtt(this.rttMs);
    this.leadTicks = this.calculateLeadTicks(this.rttMs);
    if (this.reconciler) {
      this.reconciler.leadTicks = this.reconciler.calculateLeadTicks(this.rttMs);
    }
    this.metrics.rttMs = this.rttMs;
    this.metrics.leadTicks = this.leadTicks;
  }

  setLatency(latencyMs) {
    this.setRtt(Math.max(0, latencyMs * 2));
  }

  get latencyMs() {
    return Math.round(this.rttMs * 0.5);
  }

  /**
   * Set packet loss rate (0.0 - 1.0)
   * @param {number} rate
   */
  setPacketLossRate(rate) {
    this.packetLossRate = Math.min(1.0, Math.max(0.0, rate));
    this.channel.setPacketLossRate(this.packetLossRate);
  }

  /**
   * Activate the headless client and connect to the authoritative server
   */
  connect() {
    if (this.active) return;
    this.active = true;
    if (this.server) {
      this.server.ensureCar(this.carIndex, 1);
      this.server.addClientChannel(this.channel);
    }
    if (this.reconciler && this.server?.sim) {
      const snap = this.server.sim.saveState();
      const sTick = Math.floor(this.server.sim.getHeaderView().tickCount);
      this.reconciler.syncTimeline(snap, sTick);
    }
  }

  /**
   * Disconnect the headless client
   */
  disconnect() {
    this.active = false;
    if (this.server) {
      this.server.removeClientChannel(this.channel);
    }
    this.scheduledInputs.clear();
  }

  /**
   * Queue replicated controls for a future authoritative tick
   * @param {number} tick
   * @param {object} controls
   */
  scheduleInput(tick, controls) {
    this.scheduledInputs.set(tick, { ...controls });
    // Clean old inputs older than 240 ticks
    if (this.scheduledInputs.size > 512) {
      for (const t of this.scheduledInputs.keys()) {
        if (t < tick - 240) this.scheduledInputs.delete(t);
      }
    }
  }

  /**
   * Transmit scheduled input for the target tick to AuthoritativeServer
   * @param {number} targetTick
   * @param {number} [nowMs=performance.now()]
   */
  transmitInputForTick(targetTick, nowMs = performance.now()) {
    if (!this.active) return;

    let controls = this.scheduledInputs.get(targetTick);
    if (!controls) {
      controls = this.lastSentControls;
    } else {
      this.lastSentControls = { ...controls };
    }

    // Redundant Input Packing for Headless Client
    const redundantInputs = [];
    const historyLimit = Math.min(12, targetTick);
    for (let r = 0; r <= historyLimit; r++) {
      const pastTick = targetTick - r;
      if (this.scheduledInputs.has(pastTick)) {
        redundantInputs.push({
          tick: pastTick,
          controls: this.scheduledInputs.get(pastTick)
        });
      }
    }

    const sent = this.channel.sendClientInput({
      tick: targetTick,
      carIndex: this.carIndex,
      controls: { ...controls },
      redundantInputs,
      timestamp: nowMs
    }, nowMs);

    if (sent) {
      this.totalPacketsSent++;
      this.metrics.totalPacketsSent = this.totalPacketsSent;
    }
  }

  /**
   * Advance headless simulation on decoupled 120Hz fixed accumulator
   * @param {number} [nowMs=performance.now()]
   */
  update(nowMs = performance.now()) {
    if (!this.active) return;

    this.pollServerState(nowMs);

    if (this.lastTime < 0) {
      this.lastTime = nowMs;
      return;
    }

    const dt = Math.min((nowMs - this.lastTime) / 1000.0, 0.25);
    this.lastTime = nowMs;
    this.accumulator += dt;

    while (this.accumulator >= this.fixedTimestep) {
      this.accumulator -= this.fixedTimestep;
      this.tick(nowMs);
    }
  }

  /**
   * Execute single 120Hz tick for the headless client simulation
   * @param {number} [nowMs=performance.now()]
   */
  tick(nowMs = performance.now()) {
    if (!this.active) return;

    const currentTick = this.sim
      ? Math.floor(this.sim.getHeaderView().tickCount)
      : (this.serverTick + this.leadTicks);

    let controls = this.scheduledInputs.get(currentTick);
    if (!controls) {
      controls = this.lastSentControls;
    } else {
      this.lastSentControls = { ...controls };
    }

    if (this.sim && this.reconciler) {
      this.reconciler.sampleAndPredictInput(this.carIndex, controls, nowMs);
      this.sim.setControls(this.carIndex, controls);
      this.sim.step(1);
    } else {
      this.transmitInputForTick(currentTick, nowMs);
    }
  }

  /**
   * Process incoming authoritative state snapshots from server
   * @param {number} [nowMs=performance.now()]
   */
  pollServerState(nowMs = performance.now()) {
    if (!this.active) return;

    if (this.reconciler) {
      this.reconciler.reconcile(nowMs);
      this.serverTick = this.reconciler.metrics.serverTick;
      this.lastAckedServerTick = this.reconciler.lastAckedServerTick;
      this.metrics.serverTick = this.serverTick;
      this.metrics.lastAckedServerTick = this.lastAckedServerTick;
      this.metrics.scheduledQueueSize = this.scheduledInputs.size;
      return;
    }

    const incomingPackets = this.channel.receiveClientPackets(nowMs);
    if (!incomingPackets || incomingPackets.length === 0) return;

    for (const packet of incomingPackets) {
      if (packet.serverTick > this.lastAckedServerTick) {
        this.lastAckedServerTick = packet.serverTick;
        this.serverTick = packet.serverTick;
        this.totalPacketsReceived++;
      }
    }

    this.metrics.serverTick = this.serverTick;
    this.metrics.lastAckedServerTick = this.lastAckedServerTick;
    this.metrics.scheduledQueueSize = this.scheduledInputs.size;
  }

  reset() {
    this.scheduledInputs.clear();
    this.lastSentControls = { ...this.neutralControls };
    this.lastAckedServerTick = -1;
    this.serverTick = 0;
    this.totalPacketsSent = 0;
    this.totalPacketsReceived = 0;
    this.accumulator = 0;
    this.lastTime = -1;
    this.channel.reset();
    if (this.reconciler) {
      this.reconciler.resetStats();
      if (this.server?.sim && this.sim) {
        const snap = this.server.sim.saveState();
        const sTick = Math.floor(this.server.sim.getHeaderView().tickCount);
        this.reconciler.syncTimeline(snap, sTick);
      }
    }
  }

  destroy() {
    this.disconnect();
    this.channel.destroy?.();
    if (this.sim) {
      this.sim.destroy?.();
      this.sim = null;
    }
    this.reconciler = null;
  }
}

export default HeadlessClient;
