/**
 * src/network/NetworkChannel.js
 * High-fidelity Simulated Network Transport Channel.
 * 
 * Simulates real-world bidirectional network conditions between client and server:
 * - Configurable RTT (Round Trip Time) / one-way latency
 * - Gaussian / uniform jitter (packet arrival variation)
 * - Stochastic packet loss rate (0.0 - 1.0)
 * - Deterministic manual packet drop injection for test verification
 */

export class NetworkChannel {
  /**
   * @param {object} [config]
   * @param {number} [config.rttMs=80] Round Trip Time in milliseconds (one-way is rtt/2)
   * @param {number} [config.jitterMs=5] Random jitter in milliseconds
   * @param {number} [config.packetLossRate=0.0] Packet drop probability (0.0 to 1.0)
   */
  constructor(config = {}) {
    this.rttMs = config.rttMs ?? 80;
    this.jitterMs = config.jitterMs ?? 5;
    this.packetLossRate = config.packetLossRate ?? 0.0;
    this.dropNextClientPacket = false;
    this.dropNextServerPacket = false;
    this.clientPacketsToDrop = 0;
    this.clientPacketsToDrop = 0;

    // Queues of scheduled packets
    this.c2sQueue = []; // Client -> Server
    this.s2cQueue = []; // Server -> Client

    this.stats = {
      clientPacketsSent: 0,
      clientPacketsDropped: 0,
      serverPacketsSent: 0,
      serverPacketsDropped: 0
    };
  }

  /**
   * Set latency in RTT milliseconds
   * @param {number} rttMs
   */
  setRtt(rttMs) {
    this.rttMs = Math.max(0, rttMs);
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
  }

  /**
   * Send an input packet from Client to Server
   * @param {object} packet { tick: number, controls: object, ... }
   * @param {number} [nowMs=performance.now()]
   */
  sendClientInput(packet, nowMs = performance.now()) {
    this.stats.clientPacketsSent++;

    if (this.dropNextClientPacket || this.clientPacketsToDrop > 0) {
      if (this.clientPacketsToDrop > 0) {
        this.clientPacketsToDrop--;
      }
      this.dropNextClientPacket = false;
      this.stats.clientPacketsDropped++;
      return false;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.clientPacketsDropped++;
      return false;
    }

    const oneWay = this.rttMs * 0.5;
    const jitter = (Math.random() * 2 - 1) * this.jitterMs;
    const deliverAt = nowMs + Math.max(0, oneWay + jitter);

    this.c2sQueue.push({
      payload: packet,
      deliverAt
    });
    return true;
  }

  /**
   * Send an authoritative state snapshot packet from Server to Client
   * @param {object} packet { serverTick: number, stateSnapshot: Float32Array, ... }
   * @param {number} [nowMs=performance.now()]
   */
  sendServerState(packet, nowMs = performance.now()) {
    this.stats.serverPacketsSent++;

    if (this.dropNextServerPacket) {
      this.dropNextServerPacket = false;
      this.stats.serverPacketsDropped++;
      return false;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.serverPacketsDropped++;
      return false;
    }

    const oneWay = this.rttMs * 0.5;
    const jitter = (Math.random() * 2 - 1) * this.jitterMs;
    const deliverAt = nowMs + Math.max(0, oneWay + jitter);

    this.s2cQueue.push({
      payload: packet,
      deliverAt
    });
    return true;
  }

  /**
   * Receive incoming client packets that have arrived at the server
   * @param {number} [nowMs=performance.now()]
   * @returns {Array<object>}
   */
  receiveServerPackets(nowMs = performance.now()) {
    const delivered = [];
    const remaining = [];

    for (let i = 0; i < this.c2sQueue.length; i++) {
      const item = this.c2sQueue[i];
      if (item.deliverAt <= nowMs) {
        delivered.push(item.payload);
      } else {
        remaining.push(item);
      }
    }

    this.c2sQueue = remaining;
    return delivered;
  }

  /**
   * Receive incoming server packets that have arrived at the client
   * @param {number} [nowMs=performance.now()]
   * @returns {Array<object>}
   */
  receiveClientPackets(nowMs = performance.now()) {
    const delivered = [];
    const remaining = [];

    for (let i = 0; i < this.s2cQueue.length; i++) {
      const item = this.s2cQueue[i];
      if (item.deliverAt <= nowMs) {
        delivered.push(item.payload);
      } else {
        remaining.push(item);
      }
    }

    this.s2cQueue = remaining;
    return delivered;
  }

  /**
   * Force drop the next client input packet for testing misprediction recovery
   */
  forceDropNextInput(count = 5) {
    this.clientPacketsToDrop = count;
    this.dropNextClientPacket = true;
  }

  dropSinglePacket() {
    this.forceDropNextInput(1);
  }

  reset() {
    this.c2sQueue = [];
    this.s2cQueue = [];
    this.dropNextClientPacket = false;
    this.dropNextServerPacket = false;
    this.stats = {
      clientPacketsSent: 0,
      clientPacketsDropped: 0,
      serverPacketsSent: 0,
      serverPacketsDropped: 0
    };
  }
}

export default NetworkChannel;
