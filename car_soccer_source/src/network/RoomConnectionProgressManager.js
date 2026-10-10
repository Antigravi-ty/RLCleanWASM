/**
 * src/network/RoomConnectionProgressManager.js
 * Room Connection & Multiplayer Lifecycle Progress State Machine.
 *
 * Implements a unified, observable connection progress engine for
 * creating (hosting) and joining multiplayer rooms.
 *
 * Characteristics:
 * 1. Single Progress Bar architecture (appropriate for non-continuous,
 *    unpredictable network/token server handshake latency).
 * 2. Determinate step tracking: currentStep, totalSteps, progressRatio (0.0..1.0).
 * 3. Step naming & status: 'idle' | 'in_progress' | 'completed' | 'error'.
 * 4. Error state flag: `isError` triggers red UI styling on failure.
 * 5. Observer subscription pattern: supports future UI progress bars and HUD adapters.
 */

export const ConnectionStatus = Object.freeze({
  IDLE: 'idle',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ERROR: 'error'
});

export const HOST_CONNECTION_STEPS = Object.freeze([
  { id: 'worker_init', name: 'Initializing 120Hz Authoritative Worker' },
  { id: 'physics_ready', name: 'Configuring Arena & Physics Engine' },
  { id: 'signaling_connect', name: 'Connecting to Token Signaling Server' },
  { id: 'room_register', name: 'Registering Multiplayer Room' },
  { id: 'ready_for_players', name: 'Room Active. Ready for Players (Up to 6)' }
]);

export const JOIN_CONNECTION_STEPS = Object.freeze([
  { id: 'signaling_connect', name: 'Connecting to Token Signaling Server' },
  { id: 'find_room', name: 'Locating Room & Verifying Password' },
  { id: 'webrtc_offer', name: 'Receiving Host Offer & Creating Answer' },
  { id: 'ice_exchange', name: 'Exchanging ICE Candidates & Establishing P2P' },
  { id: 'state_sync', name: 'Synchronizing Game Timeline & State' },
  { id: 'joined_complete', name: 'Connected. Entering Arena' }
]);

export class RoomConnectionProgressManager {
  constructor(options = {}) {
    this.options = options;
    this.status = ConnectionStatus.IDLE;
    this.mode = null; // 'host' | 'join' | 'custom'
    this.steps = [];
    this.currentStepIndex = 0;
    this.currentStepName = '';
    this.error = null;
    this.isError = false;
    this.observers = new Set();
    this.startTime = 0;
    this.endTime = 0;
  }

  get totalSteps() {
    return this.steps.length;
  }

  get currentStep() {
    return this.currentStepIndex;
  }

  get progressRatio() {
    if (this.totalSteps === 0) return 0;
    if (this.status === ConnectionStatus.COMPLETED) return 1.0;
    return Math.max(0, Math.min(1.0, this.currentStepIndex / this.totalSteps));
  }

  get percentage() {
    return Math.round(this.progressRatio * 100);
  }

  /**
   * Subscribe an observer or callback.
   * @param {Function|object} observer
   * @returns {() => void} Unsubscribe function
   */
  subscribe(observer) {
    if (observer) {
      this.observers.add(observer);
      this._notifyObserver(observer);
    }
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Start host connection workflow
   */
  startHost() {
    this.start('host', HOST_CONNECTION_STEPS);
  }

  /**
   * Start join connection workflow
   */
  startJoin() {
    this.start('join', JOIN_CONNECTION_STEPS);
  }

  /**
   * Generic start method
   * @param {'host'|'join'|string} mode
   * @param {Array<{ id: string, name: string }>} steps
   */
  start(mode, steps = []) {
    this.mode = mode;
    this.steps = [...steps];
    this.status = ConnectionStatus.IN_PROGRESS;
    this.currentStepIndex = 0;
    this.isError = false;
    this.error = null;
    this.startTime = performance.now();
    this.endTime = 0;

    if (this.steps.length > 0) {
      this.currentStepIndex = 1;
      this.currentStepName = this.steps[0].name;
    } else {
      this.currentStepName = '';
    }

    this._emitChange();
  }

  /**
   * Advance to the next step or specific step by ID/index
   * @param {string|number} [stepOrName]
   * @param {string} [customLabel]
   */
  advance(stepOrName, customLabel) {
    if (this.status === ConnectionStatus.ERROR) return;

    if (typeof stepOrName === 'number') {
      this.currentStepIndex = Math.max(1, Math.min(this.totalSteps, stepOrName));
      if (customLabel) {
        this.currentStepName = customLabel;
      } else if (this.steps[this.currentStepIndex - 1]) {
        this.currentStepName = this.steps[this.currentStepIndex - 1].name;
      }
    } else if (typeof stepOrName === 'string') {
      const idx = this.steps.findIndex(s => s.id === stepOrName);
      if (idx !== -1) {
        this.currentStepIndex = idx + 1;
        this.currentStepName = customLabel || this.steps[idx].name;
      } else {
        this.currentStepIndex = Math.min(this.totalSteps, this.currentStepIndex + 1);
        this.currentStepName = stepOrName;
      }
    } else {
      this.currentStepIndex = Math.min(this.totalSteps, this.currentStepIndex + 1);
      if (this.steps[this.currentStepIndex - 1]) {
        this.currentStepName = this.steps[this.currentStepIndex - 1].name;
      }
    }

    if (this.currentStepIndex >= this.totalSteps) {
      this.status = ConnectionStatus.COMPLETED;
      this.endTime = performance.now();
    }

    this._emitChange();
  }

  /**
   * Mark connection as failed with error
   * @param {Error|string} error
   * @param {string} [stepName]
   */
  fail(error, stepName) {
    this.status = ConnectionStatus.ERROR;
    this.isError = true;
    this.error = typeof error === 'string' ? new Error(error) : error;
    if (stepName) {
      this.currentStepName = stepName;
    } else if (this.error?.message) {
      this.currentStepName = `Failed: ${this.error.message}`;
    }
    this.endTime = performance.now();
    this._emitChange();
  }

  /**
   * Mark connection as completed
   * @param {string} [label]
   */
  complete(label) {
    this.currentStepIndex = this.totalSteps;
    this.status = ConnectionStatus.COMPLETED;
    this.isError = false;
    this.error = null;
    this.endTime = performance.now();
    if (label) this.currentStepName = label;
    this._emitChange();
  }

  /**
   * Reset progress state to idle
   */
  reset() {
    this.status = ConnectionStatus.IDLE;
    this.mode = null;
    this.steps = [];
    this.currentStepIndex = 0;
    this.currentStepName = '';
    this.isError = false;
    this.error = null;
    this.startTime = 0;
    this.endTime = 0;
    this._emitChange();
  }

  getState() {
    return {
      status: this.status,
      mode: this.mode,
      currentStep: this.currentStepIndex,
      totalSteps: this.totalSteps,
      stepName: this.currentStepName,
      progressRatio: this.progressRatio,
      percentage: this.percentage,
      isError: this.isError,
      error: this.error,
      durationMs: (this.endTime || performance.now()) - this.startTime
    };
  }

  _emitChange() {
    const state = this.getState();
    for (const obs of this.observers) {
      this._notifyObserver(obs, state);
    }
  }

  _notifyObserver(obs, state = this.getState()) {
    try {
      if (typeof obs === 'function') {
        obs(state);
      } else if (typeof obs.onProgress === 'function') {
        obs.onProgress(state);
      }
      if (state.isError && typeof obs?.onError === 'function') {
        obs.onError(state.error, state);
      }
      if (state.status === ConnectionStatus.COMPLETED && typeof obs?.onComplete === 'function') {
        obs.onComplete(state);
      }
    } catch (e) {
      console.warn('[RoomConnectionProgressManager] Observer error:', e);
    }
  }
}

export const roomConnectionProgress = new RoomConnectionProgressManager();
export default roomConnectionProgress;
