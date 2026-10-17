/**
 * src/network/diagnostics/NetworkImpairmentSimulator.js
 * Pure, Worker-safe P2P network impairment controller and connection health diagnostic evaluator.
 *
 * Provides:
 * 1. Standardized impairment profiles (Ideal LAN, Wi-Fi Jitter, Cross-Region, 4G Loss,
 *    Congestion Spike, 1.0s Neutral Fallback Probe, 30.0s Disconnect Timeout Probe).
 * 2. Real-time connection quality scoring (0-100 score, A-F grade) based on RTT, jitter,
 *    packet loss rate, and prediction rollback error.
 * 3. Three-stage disconnect/staleness state machine verification aligned with MatchSessionAdmin:
 *    - HEALTHY (< 1000ms since last packet)
 *    - STALE_NEUTRAL (1000ms .. 29999ms -> Server forces NEUTRAL_CONTROLS)
 *    - DISCONNECTED (>= 30000ms -> Server evicts player entity slot)
 */

export const INPUT_STALE_NEUTRAL_THRESHOLD_MS = 1000;
export const SESSION_DISCONNECT_THRESHOLD_MS = 30000;

export const CONNECTION_HEALTH_STATES = Object.freeze({
  HEALTHY: 'HEALTHY',
  STALE_NEUTRAL: 'STALE_NEUTRAL',
  DISCONNECTED: 'DISCONNECTED'
});

export const NETWORK_IMPAIRMENT_PRESETS = Object.freeze({
  IDEAL_LAN: Object.freeze({
    id: 'ideal_lan',
    label: 'Ideal LAN (0ms / 0%)',
    extraLatencyMs: 0,
    jitterMs: 0,
    packetLossPct: 0,
    blackoutMs: 0
  }),
  WIFI_JITTER: Object.freeze({
    id: 'wifi_jitter',
    label: 'Wi-Fi Jitter (30ms / 18ms / 1%)',
    extraLatencyMs: 30,
    jitterMs: 18,
    packetLossPct: 1,
    blackoutMs: 0
  }),
  CROSS_REGION: Object.freeze({
    id: 'cross_region',
    label: 'Cross-Region (75ms / 8ms / 0.5%)',
    extraLatencyMs: 75,
    jitterMs: 8,
    packetLossPct: 0.5,
    blackoutMs: 0
  }),
  CELLULAR_4G: Object.freeze({
    id: 'cellular_4g',
    label: '4G Cellular (110ms / 35ms / 5%)',
    extraLatencyMs: 110,
    jitterMs: 35,
    packetLossPct: 5,
    blackoutMs: 0
  }),
  SEVERE_SPIKE: Object.freeze({
    id: 'severe_spike',
    label: 'Congestion Spike (180ms / 60ms / 12%)',
    extraLatencyMs: 180,
    jitterMs: 60,
    packetLossPct: 12,
    blackoutMs: 0
  }),
  STALE_1S_PROBE: Object.freeze({
    id: 'stale_1s_probe',
    label: '1.2s Blackout (1s Neutral Fallback Probe)',
    extraLatencyMs: 35,
    jitterMs: 5,
    packetLossPct: 0,
    blackoutMs: 1200
  }),
  DISCONNECT_30S_PROBE: Object.freeze({
    id: 'disconnect_30s_probe',
    label: '30s Timeout Sim (Disconnect Evict Probe)',
    extraLatencyMs: 35,
    jitterMs: 5,
    packetLossPct: 0,
    blackoutMs: 30500
  })
});

export const NETWORK_IMPAIRMENT_PRESET_LIST = Object.freeze(
  Object.values(NETWORK_IMPAIRMENT_PRESETS)
);

/**
 * Computes a normalized connection quality score (0..100) and letter grade ('A'..'F').
 *
 * @param {object} metrics
 * @param {number} [metrics.rttMs=0]
 * @param {number} [metrics.jitterMs=0]
 * @param {number} [metrics.packetLossPct=0]
 * @param {number} [metrics.lastErrorUu=0]
 * @param {number} [metrics.packetAgeMs=0]
 * @returns {{ score: number, grade: string, healthState: string, neutralFallbackActive: boolean, disconnectEvicted: boolean }}
 */
export function evaluateConnectionQuality(metrics = {}) {
  const rttMs = Math.max(0, Number(metrics.rttMs) || 0);
  const jitterMs = Math.max(0, Number(metrics.jitterMs) || 0);
  const packetLossPct = Math.max(0, Number(metrics.packetLossPct) || 0);
  const lastErrorUu = Math.max(0, Number(metrics.lastErrorUu) || 0);
  const packetAgeMs = Math.max(0, Number(metrics.packetAgeMs) || 0);

  let healthState = CONNECTION_HEALTH_STATES.HEALTHY;
  if (packetAgeMs >= SESSION_DISCONNECT_THRESHOLD_MS) {
    healthState = CONNECTION_HEALTH_STATES.DISCONNECTED;
  } else if (packetAgeMs >= INPUT_STALE_NEUTRAL_THRESHOLD_MS) {
    healthState = CONNECTION_HEALTH_STATES.STALE_NEUTRAL;
  }

  if (healthState === CONNECTION_HEALTH_STATES.DISCONNECTED) {
    return {
      score: 0,
      grade: 'F',
      healthState,
      neutralFallbackActive: true,
      disconnectEvicted: true
    };
  }

  const rttPenalty = Math.min(40, (rttMs / 250) * 40);
  const jitterPenalty = Math.min(25, (jitterMs / 50) * 25);
  const lossPenalty = Math.min(30, packetLossPct * 2.5);
  const errorPenalty = Math.min(15, (lastErrorUu / 120) * 15);
  const stalePenalty = healthState === CONNECTION_HEALTH_STATES.STALE_NEUTRAL
    ? Math.min(50, 25 + ((packetAgeMs - INPUT_STALE_NEUTRAL_THRESHOLD_MS) / 5000) * 25)
    : 0;

  const rawScore = 100 - rttPenalty - jitterPenalty - lossPenalty - errorPenalty - stalePenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let grade = 'A';
  if (score < 40) grade = 'F';
  else if (score < 58) grade = 'D';
  else if (score < 74) grade = 'C';
  else if (score < 88) grade = 'B';

  return {
    score,
    grade,
    healthState,
    neutralFallbackActive: healthState !== CONNECTION_HEALTH_STATES.HEALTHY,
    disconnectEvicted: false
  };
}

export class NetworkImpairmentSimulator {
  constructor(options = {}) {
    this.activePresetId = options.presetId || NETWORK_IMPAIRMENT_PRESETS.IDEAL_LAN.id;
    this.extraLatencyMs = Math.max(0, Number(options.extraLatencyMs) || 0);
    this.jitterMs = Math.max(0, Number(options.jitterMs) || 0);
    this.packetLossPct = Math.max(0, Math.min(100, Number(options.packetLossPct) || 0));
    this.burstDropEnabled = Boolean(options.burstDropEnabled ?? false);
    this.burstPeriodMs = Math.max(1, Math.floor(Number(options.burstPeriodMs) || 2000));
    this.burstDurationMs = Math.max(
      0,
      Math.min(this.burstPeriodMs - 1, Math.floor(Number(options.burstDurationMs) || 750))
    );

    this.lastPacketTimestampMs = options.nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.blackoutStartMs = 0;
    this.blackoutUntilMs = 0;
    this.simulatedStaleAgeOffsetMs = 0;
  }

  /**
   * Records arrival of a valid packet and clears any synthetic stale age offset if not in blackout.
   * @param {number} [nowMs]
   */
  recordPacketReceived(nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    if (this.blackoutUntilMs > nowMs) {
      return;
    }
    this.lastPacketTimestampMs = nowMs;
    this.simulatedStaleAgeOffsetMs = 0;
  }

  /**
   * Applies a named impairment preset to this simulator and optionally to a target transport channel.
   * @param {string} presetId
   * @param {object} [channel=null]
   * @param {number} [nowMs]
   * @returns {object} Applied preset configuration
   */
  applyPreset(presetId, channel = null, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    const found = NETWORK_IMPAIRMENT_PRESET_LIST.find((p) => p.id === presetId)
      || NETWORK_IMPAIRMENT_PRESETS[presetId]
      || NETWORK_IMPAIRMENT_PRESETS.IDEAL_LAN;

    this.activePresetId = found.id;
    this.setImpairment({
      extraLatencyMs: found.extraLatencyMs,
      jitterMs: found.jitterMs,
      packetLossPct: found.packetLossPct
    }, channel);

    if (found.blackoutMs > 0) {
      this.triggerBlackout(found.blackoutMs, channel, nowMs);
      if (found.blackoutMs >= SESSION_DISCONNECT_THRESHOLD_MS) {
        this.simulatedStaleAgeOffsetMs = SESSION_DISCONNECT_THRESHOLD_MS + 250;
      } else if (found.blackoutMs >= INPUT_STALE_NEUTRAL_THRESHOLD_MS) {
        this.simulatedStaleAgeOffsetMs = INPUT_STALE_NEUTRAL_THRESHOLD_MS + 200;
      }
    } else {
      this.clearBlackout(channel, nowMs);
    }

    return found;
  }

  /**
   * Updates latency, jitter, random drop, and periodic burst drop parameters on both this instance and a target channel.
   * @param {object} params
   * @param {object} [channel=null]
   */
  setImpairment(params = {}, channel = null) {
    if (params.extraLatencyMs !== undefined) {
      const val = Number(params.extraLatencyMs);
      if (!Number.isFinite(val)) {
        throw new Error(`[NetworkImpairmentSimulator] Non-finite extraLatencyMs: ${params.extraLatencyMs}`);
      }
      this.extraLatencyMs = Math.max(0, Math.min(500, Math.round(val)));
    }

    if (params.jitterMs !== undefined) {
      const val = Number(params.jitterMs);
      if (!Number.isFinite(val)) {
        throw new Error(`[NetworkImpairmentSimulator] Non-finite jitterMs: ${params.jitterMs}`);
      }
      this.jitterMs = Math.max(0, Math.min(200, Math.round(val)));
    }

    if (params.packetLossPct !== undefined) {
      const val = Number(params.packetLossPct);
      if (!Number.isFinite(val)) {
        throw new Error(`[NetworkImpairmentSimulator] Non-finite packetLossPct: ${params.packetLossPct}`);
      }
      this.packetLossPct = Math.max(0, Math.min(100, Number(val.toFixed(1))));
    }

    if (params.burstDropEnabled !== undefined) {
      this.burstDropEnabled = Boolean(params.burstDropEnabled);
    }

    if (params.burstPeriodMs !== undefined) {
      const val = Math.floor(Number(params.burstPeriodMs) || 2000);
      this.burstPeriodMs = Math.max(1, val);
    }

    if (params.burstDurationMs !== undefined) {
      const val = Math.floor(Number(params.burstDurationMs) || 0);
      this.burstDurationMs = Math.max(0, Math.min(this.burstPeriodMs - 1, val));
    } else if (this.burstDurationMs >= this.burstPeriodMs) {
      this.burstDurationMs = Math.max(0, this.burstPeriodMs - 1);
    }

    this.syncToChannel(channel);
  }

  /**
   * Synchronizes current impairment settings onto a P2PWebRTCChannel, HostLoopbackChannel, or NetworkSimulator.
   * @param {object} channel
   */
  syncToChannel(channel) {
    if (!channel) return;
    if (typeof channel.setExtraLatency === 'function') {
      channel.setExtraLatency(this.extraLatencyMs);
    } else {
      channel.extraLatencyMs = this.extraLatencyMs;
    }

    if (typeof channel.setJitter === 'function') {
      channel.setJitter(this.jitterMs);
    } else if (channel.simulator && typeof channel.simulator.setJitter === 'function') {
      channel.simulator.setJitter(this.jitterMs);
    } else {
      channel.jitterMs = this.jitterMs;
      if (channel.simulator) {
        channel.simulator.jitterMs = this.jitterMs;
      }
    }

    const lossRate = this.packetLossPct / 100.0;
    if (typeof channel.setPacketLossRate === 'function') {
      channel.setPacketLossRate(lossRate);
    } else {
      channel.packetLossRate = lossRate;
    }
    channel.simulatedPacketLossPct = this.packetLossPct;

    if (typeof channel.setBurstDrop === 'function') {
      channel.setBurstDrop(this.burstPeriodMs, this.burstDurationMs, this.burstDropEnabled);
    } else if (channel.simulator && typeof channel.simulator.setBurstDrop === 'function') {
      channel.simulator.setBurstDrop(this.burstPeriodMs, this.burstDurationMs, this.burstDropEnabled);
    } else {
      channel.burstPeriodMs = this.burstPeriodMs;
      channel.burstDurationMs = this.burstDurationMs;
      channel.burstDropEnabled = this.burstDropEnabled;
    }
  }

  /**
   * Injects a temporary total packet blackout window to test 1s neutral fallback or 30s disconnect detection.
   * @param {number} durationMs
   * @param {object} [channel=null]
   * @param {number} [nowMs]
   */
  triggerBlackout(durationMs, channel = null, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    const dur = Math.max(0, Number(durationMs) || 0);
    this.blackoutStartMs = nowMs;
    this.blackoutUntilMs = nowMs + dur;

    const sim = channel?.simulator || channel;
    if (sim && typeof sim.triggerBlackout === 'function') {
      sim.triggerBlackout(dur, nowMs);
    } else if (channel?.forceDropNextInput) {
      const approxPackets = Math.max(1, Math.ceil((dur / 1000) * 120));
      channel.forceDropNextInput(approxPackets);
    }
  }

  clearBlackout(channel = null, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    this.blackoutStartMs = 0;
    this.blackoutUntilMs = 0;
    this.simulatedStaleAgeOffsetMs = 0;
    this.lastPacketTimestampMs = nowMs;

    const sim = channel?.simulator || channel;
    if (sim && typeof sim.clearBlackout === 'function') {
      sim.clearBlackout();
    }
    this.syncToChannel(channel);
  }

  /**
   * Computes current link health and staleness diagnostics at `nowMs`.
   * @param {object} [metrics={}]
   * @param {number} [nowMs]
   */
  getHealthSnapshot(metrics = {}, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    const isBlackoutActive = this.blackoutUntilMs > nowMs;
    const rawElapsedMs = Math.max(0, nowMs - this.lastPacketTimestampMs);
    const blackoutElapsedMs = isBlackoutActive ? Math.max(0, nowMs - this.blackoutStartMs) : 0;
    const packetAgeMs = Math.round(Math.max(rawElapsedMs, blackoutElapsedMs, this.simulatedStaleAgeOffsetMs));

    const evaluation = evaluateConnectionQuality({
      rttMs: metrics.rttMs ?? this.extraLatencyMs * 2,
      jitterMs: metrics.jitterMs ?? this.jitterMs,
      packetLossPct: metrics.packetLossPct ?? this.packetLossPct,
      lastErrorUu: metrics.lastErrorUu ?? 0,
      packetAgeMs
    });

    return {
      presetId: this.activePresetId,
      extraLatencyMs: this.extraLatencyMs,
      jitterMs: this.jitterMs,
      packetLossPct: this.packetLossPct,
      packetAgeMs,
      isBlackoutActive,
      ...evaluation
    };
  }
}
