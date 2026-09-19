/**
 * src/network/AsymmetricInputCoordinator.js
 * Asymmetric Network Latency & Isolated Input Replication Coordinator.
 * 
 * Manages input distribution between Real Client (Car 0) and Headless Client 2 (Car 1):
 * - Isolates User Input: Headless client replicates jump (including hold & double-jump)
 *   and aerial controls (pitch, yaw, roll, air roll, boost) while strictly ignoring ground
 *   controls (throttle, steer, handbrake remain neutral).
 * - Asymmetric Timeline Scheduling:
 *   1. If Real Client latency >= Headless Client latency:
 *      Real client responds immediately to user inputs; tells Headless Client to execute
 *      the replicated aerial/jump at the exact identical authoritative tick.
 *   2. If Real Client latency < Headless Client latency:
 *      The higher-latency Headless Client determines the future target tick; Real Client
 *      schedules its local input to execute at the matching future frame ID.
 *   This exposes predictable vs non-predictable physical glitch corrections under asymmetric ping.
 */

export class AsymmetricInputCoordinator {
  /**
   * @param {import('./PredictionReconciler.js').PredictionReconciler} reconciler
   * @param {import('./HeadlessClient.js').HeadlessClient} headlessClient
   */
  constructor(reconciler, headlessClient) {
    this.reconciler = reconciler;
    this.headlessClient = headlessClient;

    // Queue of future local inputs for Real Client when headless client has higher latency
    this.scheduledLocalInputs = new Map(); // tick -> controls

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

    this.lastRealControls = { ...this.neutralControls };
  }

  /**
   * Filter and isolate aerial & jump controls for Headless Client 2
   * Ignores ground throttle and steer
   * @param {object} userControls
   * @returns {object}
   */
  filterHeadlessControls(userControls) {
    return {
      throttle: 0,
      steer: 0,
      pitch: userControls.pitch ?? 0,
      yaw: userControls.yaw ?? 0,
      roll: userControls.roll ?? 0,
      jump: Boolean(userControls.jump),
      boost: Boolean(userControls.boost),
      handbrake: false
    };
  }

  /**
   * Coordinate and dispatch user inputs across Real Client and Headless Client
   * @param {object} rawUserControls
   * @param {number} [nowMs=performance.now()]
   * @returns {{ car0Controls: object, car1Controls: object, targetTick: number, leader: 'real' | 'headless' }}
   */
  coordinate(rawUserControls, nowMs = performance.now()) {
    if (!this.reconciler) {
      return {
        car0Controls: rawUserControls,
        car1Controls: this.neutralControls,
        targetTick: 0,
        leader: 'real'
      };
    }

    const realLead = this.reconciler.leadTicks ?? 2;
    const headlessLead = this.headlessClient?.leadTicks ?? 2;
    const isHeadlessActive = Boolean(this.headlessClient && this.headlessClient.active);

    const currentClientTick = Math.floor(this.reconciler.sim.getHeaderView().tickCount);
    const headlessAerialControls = this.filterHeadlessControls(rawUserControls);

    let effectiveCar0Controls = null;
    let targetTick = currentClientTick;
    let leader = 'real';

    if (!isHeadlessActive) {
      // Normal single client operation
      effectiveCar0Controls = rawUserControls;
      this.reconciler.sampleAndPredictInput(0, effectiveCar0Controls, nowMs);
      return {
        car0Controls: effectiveCar0Controls,
        car1Controls: this.neutralControls,
        targetTick,
        leader
      };
    }

    if (realLead >= headlessLead) {
      // Real Client has larger or equal latency: Real Client is the LEADER
      leader = 'real';
      targetTick = currentClientTick;
      effectiveCar0Controls = rawUserControls;

      // Real client executes immediately
      this.reconciler.sampleAndPredictInput(0, effectiveCar0Controls, nowMs);

      // Instruct headless client to execute at identical authoritative target tick
      this.headlessClient.scheduleInput(targetTick, headlessAerialControls);
      this.headlessClient.transmitInputForTick(targetTick, nowMs);
    } else {
      // Headless Client has larger latency: Headless Client is the LEADER
      leader = 'headless';
      const deltaLead = headlessLead - realLead;
      targetTick = currentClientTick + deltaLead;

      // Higher-latency Headless Client transmits immediately for future targetTick
      this.headlessClient.scheduleInput(targetTick, headlessAerialControls);
      this.headlessClient.transmitInputForTick(targetTick, nowMs);

      // Real Client schedules local input for when it reaches future targetTick
      this.scheduledLocalInputs.set(targetTick, { ...rawUserControls });

      // Consume input scheduled for currentClientTick, or fallback
      if (this.scheduledLocalInputs.has(currentClientTick)) {
        effectiveCar0Controls = this.scheduledLocalInputs.get(currentClientTick);
        this.scheduledLocalInputs.delete(currentClientTick);
      } else {
        effectiveCar0Controls = this.lastRealControls;
      }

      this.reconciler.sampleAndPredictInput(0, effectiveCar0Controls, nowMs);
    }

    this.lastRealControls = { ...effectiveCar0Controls };

    // Clean old scheduled local inputs
    if (this.scheduledLocalInputs.size > 256) {
      for (const t of this.scheduledLocalInputs.keys()) {
        if (t < currentClientTick - 120) this.scheduledLocalInputs.delete(t);
      }
    }

    return {
      car0Controls: effectiveCar0Controls,
      car1Controls: headlessAerialControls,
      targetTick,
      leader
    };
  }

  getLeaderInfo() {
    const realLead = this.reconciler?.leadTicks ?? 2;
    const headlessLead = this.headlessClient?.leadTicks ?? 2;
    return {
      leader: realLead >= headlessLead ? 'Real Client' : 'Headless Client 2',
      realLead,
      headlessLead,
      deltaTicks: Math.abs(realLead - headlessLead),
      isHeadlessActive: Boolean(this.headlessClient?.active)
    };
  }

  reset() {
    this.scheduledLocalInputs.clear();
    this.lastRealControls = { ...this.neutralControls };
  }
}

export default AsymmetricInputCoordinator;
