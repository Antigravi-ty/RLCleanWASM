/**
 * src/network/AuthoritativeServer.js
 * Authoritative Server simulation runner for multiplayer RocketSim WASM.
 * 
 * Runs a standalone 120Hz physics arena decoupled from render frame rate:
 * - Supports multi-client connections (WebRTC / simulated UDP channels).
 * - Collects, bit-unpacks, and buffers incoming client input packets per carIndex.
 * - Anti-Cheat Gap Locking: Server physics runs with immutable past; missing ticks sealed.
 * - Advances physics with authoritative player inputs (with dead-reckoning extrapolation on drop).
 * - Decoupled fixed 120Hz accumulator step.
 * - Broadcasts authoritative state snapshots back to all connected clients with zero-GC buffers
 *   and echoed client timestamps for continuous RTT measurement.
 */

import { RocketSimPhysicsEngine } from '../physics/RocketSimPhysicsEngine.js';
import { InputPacketCodec } from './InputPacketCodec.js';

export class AuthoritativeServer {
  /**
   * @param {import('./NetworkChannel.js').NetworkChannel|import('./WebRTCChannel.js').WebRTCChannel} [channel=null]
   * @param {object} [options={}]
   * @param {number} [options.snapshotInterval=2] Authoritative snapshots sent every N ticks (2 = 60Hz at 120Hz physics)
   */
  constructor(channel = null, options = {}) {
    this.channels = [];
    if (channel) {
      this.channels.push(channel);
    }
    this.options = options;
    this.sim = null;
    this.active = false;

    this.snapshotInterval = options.snapshotInterval ?? 1;
    this.fixedTimestep = 1.0 / 120.0;
    this.fixedTimestepMs = 1000.0 / 120.0;
    this.accumulator = 0;
    this.lastTime = -1;

    // Buffer for client inputs: tick -> Map<carIndex, controls>
    this.clientInputBuffer = new Map();
    this.lastReceivedControls = new Map(); // carIndex -> controls
    this.lastProcessedTick = -1;
    this.clientLastTimestamps = new Map(); // carIndex -> timestamp
    this.furthestReceivedTick = new Map(); // carIndex -> max tick received
    this.lockedGaps = new Map();           // carIndex -> Set<tick> sealed against retroactive injection

    // Snapshot memory pool for zero-GC serialization
    this.snapshotPoolSize = 32;
    this.snapshotPool = [];
    this.snapshotPoolIndex = 0;

    this.neutralControls = {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jump: false,
      boost: false,
      handbrake: false
    };
  }

  get channel() {
    return this.channels[0] || null;
  }

  set channel(ch) {
    if (ch) {
      if (!this.channels.includes(ch)) {
        this.channels.unshift(ch);
      }
    }
  }

  setServerReportRate(hz) {
    if (hz >= 120) this.snapshotInterval = 1;
    else if (hz >= 60) this.snapshotInterval = 2;
    else if (hz >= 40) this.snapshotInterval = 3;
    else if (hz >= 30) this.snapshotInterval = 4;
    else this.snapshotInterval = Math.max(1, Math.round(120 / hz));
  }

  get serverReportRate() {
    return Math.round(120 / Math.max(1, this.snapshotInterval));
  }

  addClientChannel(channel) {
    if (channel && !this.channels.includes(channel)) {
      this.channels.push(channel);
    }
  }

  removeClientChannel(channel) {
    const idx = this.channels.indexOf(channel);
    if (idx !== -1) {
      this.channels.splice(idx, 1);
    }
  }

  async init(config = {}) {
    this.sim = new RocketSimPhysicsEngine();
    await this.sim.init({ freshInstance: true, isolated: true, ...config });
    this.sim.addCar(0, 0); // Blue host car (Car 0)
    this.active = true;
    for (let c = 0; c < 6; c++) {
      this.lastReceivedControls.set(c, { ...this.neutralControls });
    }

    // Pre-allocate snapshot buffers for zero-GC transmission
    const snapSize = this.sim.getStateSnapshotSize();
    this.snapshotPool = Array.from({ length: this.snapshotPoolSize }, () => new Float32Array(snapSize));

    return this;
  }

  /**
   * Ensure a specific car index exists on the authoritative server
   * @param {number} carIndex
   * @param {number} [team=1]
   */
  ensureCar(carIndex, team = 1) {
    if (!this.sim) return;
    while (this.sim.numCars <= carIndex) {
      this.sim.addCar(team, 'default');
    }
  }

  _getSnapshotBuffer() {
    if (this.snapshotPool.length === 0) {
      const snapSize = this.sim ? this.sim.getStateSnapshotSize() : 424;
      return new Float32Array(snapSize);
    }
    const buf = this.snapshotPool[this.snapshotPoolIndex % this.snapshotPool.length];
    this.snapshotPoolIndex++;
    return buf;
  }

  /**
   * Advance server physics simulation by accumulated delta time
   * @param {number} [nowMs=performance.now()]
   */
  update(nowMs = performance.now()) {
    if (!this.active || !this.sim) return;

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
   * Single discrete 120Hz simulation tick
   * @param {number} [nowMs=performance.now()]
   */
  tick(nowMs = performance.now()) {
    if (!this.active || !this.sim) return;

    const currentTick = Math.floor(this.sim.getHeaderView().tickCount);

    // 1. Ingest arriving client packets from all connected client channels
    const candidateInputs = [];
    for (let chIdx = 0; chIdx < this.channels.length; chIdx++) {
      const ch = this.channels[chIdx];
      const incomingPackets = ch.receiveServerPackets(nowMs);
      for (const rawPacket of incomingPackets) {
        const packet = (rawPacket instanceof Uint8Array || rawPacket instanceof ArrayBuffer)
          ? InputPacketCodec.decode(rawPacket)
          : rawPacket;

        if (!packet) continue;

        const carIdx = packet.carIndex ?? 0;
        if (packet.timestamp !== undefined) {
          this.clientLastTimestamps.set(carIdx, packet.timestamp);
        }

        if (Array.isArray(packet.history)) {
          for (const item of packet.history) {
            if (item.tick !== undefined && item.controls) {
              candidateInputs.push({
                tick: item.tick,
                carIndex: item.carIndex ?? carIdx,
                controls: item.controls
              });
            }
          }
        } else if (Array.isArray(packet.redundantInputs)) {
          for (const item of packet.redundantInputs) {
            if (item.tick !== undefined && item.controls) {
              candidateInputs.push({
                tick: item.tick,
                carIndex: item.carIndex ?? carIdx,
                controls: item.controls
              });
            }
          }
        } else if (packet.tick !== undefined && packet.controls) {
          candidateInputs.push({
            tick: packet.tick,
            carIndex: carIdx,
            controls: packet.controls
          });
        }
      }
    }

    // Sort candidate inputs strictly by tick ascending
    candidateInputs.sort((a, b) => a.tick - b.tick);

    for (const item of candidateInputs) {
      const { tick, carIndex: carIdx, controls } = item;

      // Anti-Cheat Rule 1: Strictly discard any past input (past is immutable, zero rollback on server)
      if (tick < currentTick) continue;

      if (!this.lockedGaps.has(carIdx)) {
        this.lockedGaps.set(carIdx, new Set());
      }
      const carLockedGaps = this.lockedGaps.get(carIdx);

      // Anti-Cheat Rule 2: Reject retroactive injection into sealed/omitted gaps behind furthest horizon
      if (carLockedGaps.has(tick)) {
        continue;
      }

      if (!this.furthestReceivedTick.has(carIdx)) {
        this.furthestReceivedTick.set(carIdx, tick);
      } else {
        const furthest = this.furthestReceivedTick.get(carIdx);
        if (tick > furthest) {
          // Seal any omitted ticks between furthest + 1 and tick - 1 that lack input
          for (let g = furthest + 1; g < tick; g++) {
            if (!this.clientInputBuffer.get(g)?.has(carIdx)) {
              carLockedGaps.add(g);
            }
          }
          this.furthestReceivedTick.set(carIdx, tick);
        }
      }

      // Idempotent insertion into future input slots
      if (!this.clientInputBuffer.has(tick)) {
        this.clientInputBuffer.set(tick, new Map());
      }
      if (!this.clientInputBuffer.get(tick).has(carIdx)) {
        this.clientInputBuffer.get(tick).set(carIdx, controls);
      }
    }

    const tickInputs = this.clientInputBuffer.get(currentTick);

    // 2. Lookup input for all active cars
    const numCars = Math.min(this.sim.numCars, 6);
    const acknowledgedControls = [];

    for (let c = 0; c < numCars; c++) {
      let ctrl = null;
      if (tickInputs && tickInputs.has(c)) {
        ctrl = tickInputs.get(c);
        this.lastReceivedControls.set(c, { ...ctrl });
      } else if (this.lastReceivedControls.has(c)) {
        // Dead-reckoning input continuation on transient drop (matches Rocket League server behavior)
        ctrl = this.lastReceivedControls.get(c);
      } else {
        ctrl = this.neutralControls;
      }
      this.sim.setControls(c, ctrl);
      acknowledgedControls.push({ ...ctrl });
    }

    // Clean old inputs from buffer
    if (this.clientInputBuffer.size > 256) {
      for (const t of this.clientInputBuffer.keys()) {
        if (t < currentTick - 120) this.clientInputBuffer.delete(t);
      }
    }

    // 3. Authoritative step
    this.sim.step(1);
    const postTick = Math.floor(this.sim.getHeaderView().tickCount);
    this.lastProcessedTick = postTick;

    // Check goal reset
    if (this.sim.pollGoal() !== 0) {
      this.sim.resetKickoff();
      this.clientInputBuffer.clear();
      this.lastReceivedControls.clear();
      for (let c = 0; c < 6; c++) {
        this.lastReceivedControls.set(c, { ...this.neutralControls });
      }
      this.clientLastTimestamps.clear();
      this.furthestReceivedTick.clear();
      this.lockedGaps.clear();
    }

    // 4. Broadcast state snapshot to all connected clients
    if (postTick % this.snapshotInterval === 0) {
      const snapBuf = this._getSnapshotBuffer();
      this.sim.saveState(snapBuf);

      const packet = {
        serverTick: postTick,
        stateSnapshot: snapBuf,
        acknowledgedControls,
        timestamp: nowMs,
        lastReceivedClientTimestamp: this.clientLastTimestamps.get(0) ?? nowMs,
        globalInputBufferStatus: Object.fromEntries(this.furthestReceivedTick)
      };

      for (let chIdx = 0; chIdx < this.channels.length; chIdx++) {
        this.channels[chIdx].sendServerState(packet, nowMs);
      }
    }
  }

  destroy() {
    this.active = false;
    this.clientInputBuffer.clear();
    this.lastReceivedControls.clear();
    this.clientLastTimestamps.clear();
    this.furthestReceivedTick.clear();
    this.lockedGaps.clear();
    if (this.sim) {
      this.sim.destroy();
      this.sim = null;
    }
    this.channels = [];
    this.snapshotPool = [];
  }
}

export default AuthoritativeServer;
