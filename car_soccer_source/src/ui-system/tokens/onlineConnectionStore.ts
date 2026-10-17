export const ConnectionStatus = Object.freeze({
  IDLE: 'idle',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ERROR: 'error',
});

export interface ConnectionStep {
  id: string;
  name: string;
}

export const HOST_CONNECTION_STEPS: ReadonlyArray<ConnectionStep> = Object.freeze([
  { id: 'worker_init', name: 'Initializing 120Hz Authoritative Worker' },
  { id: 'physics_ready', name: 'Configuring Arena & Physics Engine' },
  { id: 'signaling_connect', name: 'Connecting to Token Signaling Server' },
  { id: 'room_register', name: 'Registering Multiplayer Room' },
  { id: 'ready_for_players', name: 'Room Active. Ready for Players (Up to 6)' },
]);

export const JOIN_CONNECTION_STEPS: ReadonlyArray<ConnectionStep> = Object.freeze([
  { id: 'signaling_connect', name: 'Connecting to Token Signaling Server' },
  { id: 'find_room', name: 'Locating Room & Verifying Password' },
  { id: 'webrtc_offer', name: 'Receiving Host Offer & Creating Answer' },
  { id: 'ice_exchange', name: 'Exchanging ICE Candidates & Establishing P2P' },
  { id: 'state_sync', name: 'Synchronizing Game Timeline & State' },
  { id: 'joined_complete', name: 'Connected. Entering Arena' },
]);

export class RoomConnectionProgressManager {
  options: Record<string, any>;
  status: string;
  mode: string | null;
  steps: ConnectionStep[];
  currentStepIndex: number;
  currentStepName: string;
  error: Error | null;
  isError: boolean;
  observers: Set<any>;
  startTime: number;
  endTime: number;

  constructor(options: Record<string, any> = {}) {
    this.options = options;
    this.status = ConnectionStatus.IDLE;
    this.mode = null;
    this.steps = [];
    this.currentStepIndex = 0;
    this.currentStepName = '';
    this.error = null;
    this.isError = false;
    this.observers = new Set();
    this.startTime = 0;
    this.endTime = 0;
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get currentStep(): number {
    return this.currentStepIndex;
  }

  get progressRatio(): number {
    if (this.totalSteps === 0) return 0;
    if (this.status === ConnectionStatus.COMPLETED) return 1.0;
    return Math.max(0, Math.min(1.0, this.currentStepIndex / this.totalSteps));
  }

  get percentage(): number {
    return Math.round(this.progressRatio * 100);
  }

  subscribe(observer: any): () => void {
    if (observer) {
      this.observers.add(observer);
      this._notifyObserver(observer);
    }
    return () => {
      this.observers.delete(observer);
    };
  }

  startHost(): void {
    this.start('host', HOST_CONNECTION_STEPS);
  }

  startJoin(): void {
    this.start('join', JOIN_CONNECTION_STEPS);
  }

  start(mode: string, steps: ReadonlyArray<ConnectionStep> = []): void {
    this.mode = mode;
    this.steps = [...steps];
    this.status = ConnectionStatus.IN_PROGRESS;
    this.currentStepIndex = 0;
    this.isError = false;
    this.error = null;
    this.startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.endTime = 0;

    if (this.steps.length > 0) {
      this.currentStepIndex = 1;
      this.currentStepName = this.steps[0].name;
    } else {
      this.currentStepName = '';
    }

    this._emitChange();
  }

  advance(stepOrName?: string | number, customLabel?: string): void {
    if (this.status === ConnectionStatus.ERROR) return;

    if (typeof stepOrName === 'number') {
      this.currentStepIndex = Math.max(1, Math.min(this.totalSteps, stepOrName));
      if (customLabel) {
        this.currentStepName = customLabel;
      } else if (this.steps[this.currentStepIndex - 1]) {
        this.currentStepName = this.steps[this.currentStepIndex - 1].name;
      }
    } else if (typeof stepOrName === 'string') {
      const idx = this.steps.findIndex((s) => s.id === stepOrName);
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
      this.endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    this._emitChange();
  }

  fail(error: Error | string, stepName?: string): void {
    this.status = ConnectionStatus.ERROR;
    this.isError = true;
    this.error = typeof error === 'string' ? new Error(error) : error;
    if (stepName) {
      this.currentStepName = stepName;
    } else if (this.error?.message) {
      this.currentStepName = `Failed: ${this.error.message}`;
    }
    this.endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._emitChange();
  }

  complete(label?: string): void {
    this.currentStepIndex = this.totalSteps;
    this.status = ConnectionStatus.COMPLETED;
    this.isError = false;
    this.error = null;
    this.endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (label) this.currentStepName = label;
    this._emitChange();
  }

  reset(): void {
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
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
      durationMs: (this.endTime || now) - this.startTime,
    };
  }

  _emitChange(): void {
    const state = this.getState();
    for (const obs of this.observers) {
      this._notifyObserver(obs, state);
    }
  }

  _notifyObserver(obs: any, state = this.getState()): void {
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

export async function testSignalingConnectivity(
  endpointUrl: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; rttMs: number; error: string | null }> {
  const wsUrl = endpointUrl || 'wss://unstable.test.breadguy.link/ws';
  const separator = wsUrl.includes('?') ? '&' : '?';
  const testUrl = `${wsUrl}${separator}ping_test=1&t=${Date.now()}`;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return new Promise((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let sock: WebSocket | null = null;

    const finish = (result: { ok: boolean; rttMs: number; error: string | null }) => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      if (sock) {
        try {
          if (sock.readyState === 0) {
            const pendingSock = sock;
            pendingSock.onopen = () => {
              try {
                pendingSock.close(1000, 'Diagnostic probe finished');
              } catch (err) {
                console.warn('[testSignalingConnectivity] Diagnostic probe close error on open:', err);
              }
            };
            pendingSock.onerror = null;
            pendingSock.onclose = null;
          } else if (sock.readyState === 1) {
            sock.close(1000, 'Diagnostic probe finished');
          }
        } catch (err) {
          console.warn('[testSignalingConnectivity] Diagnostic probe close error:', err);
        }
      }
      resolve(result);
    };

    timer = setTimeout(() => {
      finish({
        ok: false,
        rttMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
        error: `Connection timed out after ${timeoutMs}ms (server unreachable or cold start)`,
      });
    }, timeoutMs);

    try {
      const WebSocketConstructor = typeof WebSocket !== 'undefined' ? WebSocket : null;
      if (!WebSocketConstructor) {
        return finish({ ok: false, rttMs: 0, error: 'WebSocket is not supported in this environment' });
      }
      sock = new WebSocketConstructor(testUrl);
      sock.onopen = () => {
        const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        finish({ ok: true, rttMs, error: null });
      };
      sock.onerror = () => {
        const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        finish({ ok: false, rttMs, error: 'WebSocket connection failed (network unreachable or TLS error)' });
      };
      sock.onclose = (ev) => {
        if (!resolved) {
          const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
          finish({ ok: false, rttMs, error: `Connection closed immediately by server (code ${ev.code})` });
        }
      };
    } catch (err: any) {
      console.warn('[testSignalingConnectivity] Unexpected failure:', err);
      finish({ ok: false, rttMs: 0, error: err?.message || String(err) });
    }
  });
}
