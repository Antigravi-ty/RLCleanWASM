/**
 * src/network/webrtc/networkSimulator.js
 * Network conditions simulator: latency, jitter, packet loss, RTT measurements, and packet queuing.
 */

export class NetworkSimulator {
  /**
   * @param {object} [options]
   * @param {number} [options.extraLatencyMs=0]
   * @param {number} [options.jitterMs=2]
   * @param {number} [options.packetLossRate=0.0]
   * @param {number} [options.pingIntervalMs=500]
   * @param {boolean} [options.isLoopback=false]
   */
  constructor(options = {}) {
    this.extraLatencyMs = options.extraLatencyMs ?? 0;
    this.jitterMs = options.jitterMs ?? 2;
    this.packetLossRate = options.packetLossRate ?? 0.0;
    this.pingIntervalMs = options.pingIntervalMs ?? 500;
    this.isLoopback = Boolean(options.isLoopback);

    // Simulation queues
    this.inboundQueue = [];
    this.outboundQueue = [];

    // Measured metrics
    this.baseMeasuredRttMs = 0;
    this.measuredRttMs = 0;
    this.measuredJitterMs = 0;
    this.lastPingSentTime = 0;

    this.dropNextPacket = false;
    this.packetsToDrop = 0;
    this.customJitterActive = false;
    this.blackoutUntilMs = 0;
    this.burstDropEnabled = Boolean(options.burstDropEnabled ?? false);
    this.burstPeriodMs = Math.max(1, Math.floor(Number(options.burstPeriodMs) || 2000));
    this.burstDurationMs = Math.max(
      0,
      Math.min(this.burstPeriodMs - 1, Math.floor(Number(options.burstDurationMs) || 750))
    );

    this.stats = {
      packetsSent: 0,
      packetsReceived: 0,
      packetsDropped: 0,
      bytesSent: 0,
      bytesReceived: 0,
      pingsSent: 0,
      pongsReceived: 0
    };
  }

  static clonePayload(packet) {
    if (packet instanceof Uint8Array) {
      return new Uint8Array(packet);
    }
    if (packet instanceof ArrayBuffer) {
      return packet.slice(0);
    }
    if (ArrayBuffer.isView(packet)) {
      return new Uint8Array(packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength));
    }
    return packet;
  }

  clonePayload(packet) {
    return NetworkSimulator.clonePayload(packet);
  }

  getPayloadByteLength(packet) {
    if (!packet) return 0;
    if (typeof packet.byteLength === 'number') return packet.byteLength;
    if (typeof packet === 'string') return packet.length;
    return 0;
  }

  setExtraLatency(extraLatencyMs) {
    const val = Number(extraLatencyMs);
    if (!Number.isFinite(val)) {
      throw new Error(`[P2PWebRTCChannel] setExtraLatency called with non-finite value: ${extraLatencyMs}`);
    }
    this.extraLatencyMs = Math.max(0, val);
    if (this.isLoopback) {
      this.measuredRttMs = this.extraLatencyMs * 2;
    } else if (this.stats.pongsReceived > 0 || this.baseMeasuredRttMs > 0) {
      this.measuredRttMs = this.baseMeasuredRttMs + this.extraLatencyMs * 2;
    } else if (this.measuredRttMs > 0) {
      this.measuredRttMs = this.extraLatencyMs * 2;
    }
  }

  setLatency(latencyMs) {
    this.setExtraLatency(latencyMs);
  }

  get latencyMs() {
    return Math.round(this.rttMs * 0.5);
  }

  setRtt(rttMs) {
    const val = Number(rttMs);
    if (!Number.isFinite(val)) {
      throw new Error(`[P2PWebRTCChannel] setRtt called with non-finite value: ${rttMs}`);
    }
    this.setExtraLatency(Math.round(val * 0.5));
  }

  get rttMs() {
    if (this.isLoopback) {
      return Math.round(this.extraLatencyMs * 2);
    }
    if (this.measuredRttMs > 0) {
      if (!Number.isFinite(this.measuredRttMs)) {
        throw new Error(`[P2PWebRTCChannel] measuredRttMs corrupted to non-finite: ${this.measuredRttMs}`);
      }
      return Math.round(this.measuredRttMs);
    }
    const derived = this.extraLatencyMs * 2;
    if (!Number.isFinite(derived)) {
      throw new Error(`[P2PWebRTCChannel] extraLatencyMs corrupted to non-finite: ${this.extraLatencyMs}`);
    }
    return Math.round(derived);
  }

  set rttMs(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) {
      throw new Error(`[P2PWebRTCChannel] set rttMs called with non-finite value: ${val}`);
    }
    this.measuredRttMs = Math.max(0, num);
    this.baseMeasuredRttMs = this.isLoopback ? 0 : Math.max(0, this.measuredRttMs - this.extraLatencyMs * 2);
  }

  setPacketLossRate(rate) {
    this.packetLossRate = Math.min(1.0, Math.max(0.0, Number(rate) || 0));
  }

  setBurstDrop(periodMs = this.burstPeriodMs, durationMs = this.burstDurationMs, enabled = this.burstDropEnabled) {
    const safePeriod = Math.max(1, Math.floor(Number(periodMs) || 2000));
    const safeDuration = Math.max(0, Math.min(safePeriod - 1, Math.floor(Number(durationMs) || 0)));
    this.burstPeriodMs = safePeriod;
    this.burstDurationMs = safeDuration;
    if (enabled !== undefined) {
      this.burstDropEnabled = Boolean(enabled);
    }
  }

  setBurstDropEnabled(enabled) {
    this.burstDropEnabled = Boolean(enabled);
    return this.burstDropEnabled;
  }

  toggleBurstDrop(forceEnabled) {
    this.burstDropEnabled = forceEnabled !== undefined ? Boolean(forceEnabled) : !this.burstDropEnabled;
    if (this.burstDropEnabled && this.burstDurationMs <= 0) {
      this.burstDurationMs = Math.min(this.burstPeriodMs - 1, Math.max(1, Math.floor(this.burstPeriodMs * 0.375)));
    }
    return this.burstDropEnabled;
  }

  isInPeriodicBurstDropWindow(nowMs = performance.now()) {
    if (this.burstDropEnabled && this.burstPeriodMs > 0 && this.burstDurationMs > 0) {
      const clampedDuration = Math.min(this.burstDurationMs, this.burstPeriodMs - 1);
      const phase = ((nowMs % this.burstPeriodMs) + this.burstPeriodMs) % this.burstPeriodMs;
      return phase < clampedDuration;
    }
    return false;
  }

  setJitter(jitterMs) {
    const val = Number(jitterMs);
    if (!Number.isFinite(val)) {
      throw new Error(`[P2PWebRTCChannel] setJitter called with non-finite value: ${jitterMs}`);
    }
    this.jitterMs = Math.max(0, Math.min(200, val));
    this.customJitterActive = this.jitterMs > 0;
  }

  triggerBlackout(durationMs, nowMs = performance.now()) {
    const dur = Math.max(0, Number(durationMs) || 0);
    this.blackoutUntilMs = dur > 0 ? nowMs + dur : 0;
  }

  clearBlackout() {
    this.blackoutUntilMs = 0;
  }

  forceDropNextInput(count = 5) {
    this.packetsToDrop = count;
    this.dropNextPacket = true;
  }

  dropSinglePacket() {
    this.forceDropNextInput(1);
  }

  shouldDropOnSend(nowMs = performance.now()) {
    if (this.blackoutUntilMs > nowMs) {
      this.stats.packetsDropped++;
      return true;
    }

    if (this.isInPeriodicBurstDropWindow(nowMs)) {
      this.stats.packetsDropped++;
      return true;
    }

    if (this.dropNextPacket || this.packetsToDrop > 0) {
      if (this.packetsToDrop > 0) this.packetsToDrop--;
      this.dropNextPacket = false;
      this.stats.packetsDropped++;
      return true;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.packetsDropped++;
      return true;
    }

    return false;
  }

  shouldDropOnReceive(nowMs = performance.now()) {
    if (this.blackoutUntilMs > nowMs) {
      this.stats.packetsDropped++;
      return true;
    }

    if (this.isInPeriodicBurstDropWindow(nowMs)) {
      this.stats.packetsDropped++;
      return true;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.packetsDropped++;
      return true;
    }
    return false;
  }

  calculateDelay() {
    return (this.extraLatencyMs > 0 || this.customJitterActive)
      ? Math.max(0, this.extraLatencyMs + (Math.random() * 2 - 1) * this.jitterMs)
      : 0;
  }

  scheduleSend(packet, transmitFn, nowMs = performance.now()) {
    this.stats.packetsSent++;
    if (this.shouldDropOnSend(nowMs)) return false;

    const cloned = this.clonePayload(packet);
    const byteLen = this.getPayloadByteLength(cloned);

    const doTransmit = () => {
      const dispatched = transmitFn(cloned);
      if (dispatched !== false && byteLen > 0) {
        this.stats.bytesSent += byteLen;
      }
      return dispatched !== false;
    };

    const delay = this.calculateDelay();
    if (delay > 0) {
      const deliverAt = nowMs + delay;
      const entry = { payload: cloned, deliverAt };
      this.outboundQueue.push(entry);
      setTimeout(() => {
        const idx = this.outboundQueue.indexOf(entry);
        if (idx !== -1) this.outboundQueue.splice(idx, 1);
        doTransmit();
      }, delay);
      return true;
    }

    return doTransmit();
  }

  receivePayload(payload, onDeliver, nowMs = performance.now()) {
    if (!payload) return false;
    const cloned = this.clonePayload(payload);
    if (cloned instanceof ArrayBuffer || cloned instanceof Uint8Array) {
      this.stats.bytesReceived += cloned.byteLength;
    }

    if (this.shouldDropOnReceive(nowMs)) return false;

    const delay = this.calculateDelay();
    const deliverAt = delay > 0 ? nowMs + delay : 0;

    if (deliverAt === 0) {
      this.inboundQueue.push(cloned);
      onDeliver?.(cloned);
    } else {
      this.inboundQueue.push({ payload: cloned, deliverAt });
      setTimeout(() => {
        onDeliver?.(cloned);
      }, delay);
    }
    return true;
  }

  handlePong(sendTime, now = performance.now()) {
    if (typeof sendTime !== 'number' || !Number.isFinite(sendTime)) {
      throw new Error(`[P2PWebRTCChannel] Received invalid pong sendTime: ${sendTime}. Expected finite number.`);
    }
    const sample = Math.max(0, now - sendTime);
    const simulatedRtt = this.extraLatencyMs * 2;
    const baseSample = this.isLoopback ? 0 : Math.max(0, sample - simulatedRtt);
    this.stats.pongsReceived++;
    if (this.stats.pongsReceived === 1 && this.measuredRttMs === 0) {
      this.baseMeasuredRttMs = baseSample;
      this.measuredRttMs = this.baseMeasuredRttMs + simulatedRtt;
    } else {
      const prevRtt = this.baseMeasuredRttMs + simulatedRtt;
      const diff = Math.abs(sample - prevRtt);
      this.baseMeasuredRttMs = this.isLoopback ? 0 : (this.baseMeasuredRttMs * 0.85 + baseSample * 0.15);
      this.measuredRttMs = this.baseMeasuredRttMs + simulatedRtt;
      this.measuredJitterMs = this.measuredJitterMs * 0.85 + diff * 0.15;
    }
  }

  drainInboundQueue(nowMs = performance.now()) {
    const delivered = [];
    const remaining = [];

    for (let i = 0; i < this.inboundQueue.length; i++) {
      const item = this.inboundQueue[i];
      if (item && item.deliverAt !== undefined) {
        if (item.deliverAt <= nowMs) {
          delivered.push(item.payload);
        } else {
          remaining.push(item);
        }
      } else {
        delivered.push(item);
      }
    }

    this.inboundQueue.length = 0;
    if (remaining.length > 0) {
      this.inboundQueue.push(...remaining);
    }
    return delivered;
  }

  reset() {
    this.inboundQueue.length = 0;
    this.outboundQueue.length = 0;
    this.baseMeasuredRttMs = 0;
    this.measuredRttMs = 0;
    this.measuredJitterMs = 0;
    this.lastPingSentTime = 0;
    this.dropNextPacket = false;
    this.packetsToDrop = 0;
    this.customJitterActive = false;
    this.blackoutUntilMs = 0;
    this.stats = {
      packetsSent: 0,
      packetsReceived: 0,
      packetsDropped: 0,
      bytesSent: 0,
      bytesReceived: 0,
      pingsSent: 0,
      pongsReceived: 0
    };
  }
}
