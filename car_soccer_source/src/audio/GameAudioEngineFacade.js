import { audioConfig } from './audioConfig.js';
import { getAudioSlotPool, registerAudioEngine } from './audioContext.js';
import { StateAudioEngine } from './StateAudioEngine.js';
import { VehicleAudioManager } from './VehicleAudioManager.js';
import { IncidentAudioEngine } from './IncidentAudioEngine.js';
import { SignalAudioEngine } from './SignalAudioEngine.js';
import { UIAudioEngine } from './UIAudioEngine.js';
import { loadAudioAssets } from './audioAssetLoader.js';

export class GameAudioEngineFacade {
  constructor() {
    this.stateEngine = new StateAudioEngine();
    this.ballEngine = this.stateEngine.ballEmitter;
    this.vehicleManager = new VehicleAudioManager();
    this.incidentEngine = new IncidentAudioEngine(this.vehicleManager);
    this.signalEngine = new SignalAudioEngine();
    this.uiEngine = new UIAudioEngine();

    this.loading = false;
    this.loaded = false;

    registerAudioEngine(this);

    audioConfig.subscribe(() => {
      const panModel = audioConfig.get('spatialPanningModel') || 'equalpower';
      this.vehicleManager?.updatePanningModel?.(panModel);
      this.ballEngine?.updatePanningModel?.(panModel);
      getAudioSlotPool()?.updatePanningModel?.(panModel);
    });
  }

  async preload(onProgress = null) {
    if (this.loaded || this.loading || typeof window === "undefined") return;
    this.loading = true;
    try {
      await loadAudioAssets(this, onProgress);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  handleEvent(event, camera = null) {
    this.incidentEngine.handleEvent(event, camera);
  }

  updateBallAudio(ballViewOrMesh, camera, physics) {
    this.ballEngine.update(ballViewOrMesh, camera, physics);
  }

  updateVehicles(context) {
    this.vehicleManager.update(context);
  }

  updateSupersonic(isSupersonic, isMatchActive = true) {
    const emitter = this.vehicleManager.getEmitter(this.vehicleManager.activeCarIndex);
    if (emitter) {
      if (typeof emitter.updateSupersonic === 'function') {
        emitter.updateSupersonic(isSupersonic, isMatchActive);
      } else {
        emitter.updateState({ isSupersonic, isAlive: true, audible: isMatchActive });
      }
    }
  }

  updateBoost(isBoosting, isMatchActive = true) {
    const emitter = this.vehicleManager.getEmitter(this.vehicleManager.activeCarIndex);
    if (emitter) {
      if (typeof emitter.updateBoost === 'function') {
        emitter.updateBoost(isBoosting, isMatchActive);
      } else {
        emitter.updateState({ isBoosting, isAlive: true, audible: isMatchActive });
      }
    }
  }

  handleSignal(signalType) {
    this.signalEngine.handleSignal(signalType);
  }

  play(key, volMult = 1.0, minInterval = 0) {
    this.signalEngine.play(key, volMult, minInterval);
  }

  playDirect(key, volMult = 1.0, minInterval = 0) {
    this.signalEngine.play(key, volMult, minInterval);
  }

  silenceAll() {
    this.ballEngine.silenceAll();
    this.vehicleManager.silenceAll();
    this.stateEngine.silenceAll();
    const pool = getAudioSlotPool();
    if (pool) pool.silenceAll();
  }

  onFocusRegained() {
    this.silenceAll();
  }

  stopContinuousAudio() {
    this.silenceAll();
  }
}

export const audioEngine = new GameAudioEngineFacade();
export const gameAudioEngine = audioEngine;
export const gameAudio = audioEngine;
