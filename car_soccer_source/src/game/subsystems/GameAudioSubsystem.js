import {
  EMotorSynth,
  getAudioContext,
  getMasterAudioInput,
  getAudioSettings,
  gameAudio,
  gameAudioEngine,
  audioConfig
} from '../../audio/AudioArchitecture.js';
import { updateAudioListener, SpatialAudioSource } from '../../audio/SpatialAudioSource.js';

/**
 * GameAudioSubsystem.js
 * Encapsulates multi-car procedural EMotorSynth synthesis, spatial audio bus tracking,
 * vehicle listeners, ball acoustics, and lifecycle game sound effects.
 */
export class GameAudioSubsystem {
  /**
   * @param {import('../GameRuntime.js').GameRuntime} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    this.engineSynths = [];
    this.audioCoordinator = runtime.audioCoordinator;
  }

  resetAudio() {
    return this.audioCoordinator?.resetAudio?.();
  }

  triggerGameAudioEvents(goalScored, curBoost, isSupersonic, curr) {
    return this.audioCoordinator?.triggerGameAudioEvents?.(goalScored, curBoost, isSupersonic, curr);
  }

  update(context) {
    const r = this.runtime;
    const { dt, activeCar, activeCarMesh, playerCarView, numCarsInArena, isMatchActive, hasBlockingOverlay, continueOnBlur, isHidden, goalScored, curBoost, isSupersonic } = context;

    if (!r.camera?.camera) return;

    // 1. Update 3D Audio Listener
    updateAudioListener(r.camera.camera);

    // 2. Update Ball Spatial Acoustics
    if (gameAudioEngine && typeof gameAudioEngine.updateBallAudio === 'function' && r.arena?.ball) {
      gameAudioEngine.updateBallAudio(r.arena.ball, r.camera, r.physics);
    }

    // 3. Multi-car Procedural EMotorSynth Engine Audio
    const audioCtx = getAudioContext();
    const masterInput = getMasterAudioInput();

    while (this.engineSynths.length < Math.max(2, numCarsInArena)) {
      const carIndex = this.engineSynths.length;
      const isSpatial = carIndex !== activeCar;
      let spatialBus = null;
      let synth = null;
      if (audioCtx) {
        if (isSpatial) {
          spatialBus = new SpatialAudioSource(audioCtx, masterInput);
          synth = new EMotorSynth(audioCtx, spatialBus.input);
        } else {
          synth = new EMotorSynth(audioCtx, masterInput);
        }
      }
      this.engineSynths.push({
        synth,
        spatialBus,
        spatial: isSpatial,
        position: { x: 0, y: 0, z: 0 }
      });
    }

    const settings = getAudioSettings();
    const engineVol = (settings.engineVolume ?? 0.8) * (settings.masterVolume ?? 1.0);

    for (let i = 0; i < this.engineSynths.length; i++) {
      const entry = this.engineSynths[i];
      const isThisActiveCar = i === activeCar;
      const isCarValid = i < numCarsInArena;

      if (entry.spatial === isThisActiveCar && entry.synth?.outputNode) {
        entry.spatial = !isThisActiveCar;
        try {
          entry.synth.outputNode.disconnect();
          if (entry.spatial) {
            if (!entry.spatialBus && audioCtx) {
              entry.spatialBus = new SpatialAudioSource(audioCtx, masterInput);
            }
            if (entry.spatialBus) {
              entry.synth.outputNode.connect(entry.spatialBus.input);
            }
          } else {
            entry.synth.outputNode.connect(masterInput);
          }
        } catch (e) {
          console.warn('[GameAudioSubsystem] Spatial audio routing update failed:', e);
        }
      }

      if (!isCarValid) {
        entry.synth?.silence();
        entry.spatialBus?.setEnabled(false);
        continue;
      }

      const carPos =
        isThisActiveCar && activeCarMesh
          ? activeCarMesh.position
          : r.arena?.cars?.[i]?.position;

      const carView = r.interpolator?.getCurrCarStateView(i);
      const forwardSpeed = carView ? carView.forwardSpeed : 0;
      const alive = isCarValid && (carView ? !carView.isDemoed : true);
      const audible = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));

      if (entry.spatialBus && carPos) {
        entry.spatialBus.setPosition(carPos);
        entry.spatialBus.setEnabled(alive && audible);
      }

      if (entry.synth) {
        entry.synth.setVolume(engineVol);
        entry.synth.update({
          forwardSpeed,
          alive,
          audible
        });
      }
    }

    // 4. Supersonic & Boost loops
    const isAudibleActive = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));
    if (gameAudioEngine) {
      gameAudioEngine.updateSupersonic(isSupersonic, isAudibleActive);
      gameAudioEngine.updateBoost(playerCarView?.isBoosting && !playerCarView?.isDemoed, isAudibleActive);

      // 5. Multi-car Dynamic Spatial Audio Tracking (positions, loops, emitters)
      if (typeof gameAudioEngine.updateVehicles === 'function') {
        gameAudioEngine.updateVehicles({
          activeCarIndex: activeCar,
          numCars: numCarsInArena,
          getCarPos: (i) => {
            const cView = r.interpolator?.getCurrCarStateView(i);
            if (cView && Number.isFinite(cView.posX) && Number.isFinite(cView.posY) && Number.isFinite(cView.posZ)) {
              return { posX: cView.posX, posY: cView.posY, posZ: cView.posZ };
            }
            return (i === activeCar && activeCarMesh) ? activeCarMesh.position : r.arena?.cars?.[i]?.position;
          },
          getCarState: (i) => r.interpolator?.getCurrCarStateView(i),
          isMatchActive,
          hasBlockingOverlay,
          continueOnBlur,
          isHidden
        });
      }
    }

    // 6. Game lifecycle audio triggers (countdown, goals, overtimes)
    this.triggerGameAudioEvents(goalScored, curBoost, isSupersonic, r.interpolator?.currState);
  }

  dispose() {
    for (const eng of this.engineSynths) {
      eng.synth?.dispose?.();
      eng.spatialBus?.dispose?.();
    }
    this.engineSynths.length = 0;
  }
}
