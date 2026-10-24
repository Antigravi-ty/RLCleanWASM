import { EMotorSynth } from '../../audio/EMotorSynth.js';
import { getAudioContext, getMasterAudioInput, subsystemState, registerAudioRuntime } from '../../audio/audioContext.js';
import { getAudioSettings, audioConfig } from '../../config/audioConfig.js';
import { gameAudio, gameAudioEngine } from '../../audio/GameAudioEngineFacade.js';
import { updateAudioListener, SpatialAudioSource } from '../../audio/SpatialAudioSource.js';
import { CarStateView } from '../../physics/RocketSimStateViews.js';
import { INCIDENT_EVENT_TYPES } from '../../physics/RocketSimConstants.js';

/**
 * GameAudioSubsystem.js
 * Encapsulates multi-car procedural EMotorSynth synthesis, spatial audio bus tracking,
 * vehicle listeners, ball acoustics, and lifecycle game sound effects.
 */
export class GameAudioSubsystem {
  /**
   * @param {object} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    this.engineSynths = [];
    this.audioCoordinator = runtime.audioCoordinator;
    this._lobbyCarViews = Array.from({ length: 8 }, () => new CarStateView());
    this._prevTestCarBoosting = { 6: false, 7: false };
    registerAudioRuntime(runtime);
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

    const testCarAudioEnabled = Boolean(r.testCarAudioEnabled);
    const isLobbyDualWorld = Boolean(r.networkReconciler?.lobbyDualWorldMode);
    const lobbyState = isLobbyDualWorld ? r.networkReconciler.lobbyCurrAuthoritativeState : null;
    const lobbyNumCars = lobbyState ? Math.min(8, Math.max(0, Math.round(lobbyState[1] || 0))) : 0;
    const effectiveNumCars = Math.max(numCarsInArena, testCarAudioEnabled ? lobbyNumCars : 0);

    const resolveCarView = (i) => {
      if ((i === 6 || i === 7) && !testCarAudioEnabled) {
        return null;
      }
      if (isLobbyDualWorld && i !== activeCar) {
        if (i >= 1 && i < 6) {
          return null;
        }
        if (lobbyState && i < lobbyNumCars) {
          const view = this._lobbyCarViews[i].attachCar(lobbyState, i);
          if (view.posZ <= -200 || view.posX < -5000 || view.isDemoed) {
            return null;
          }
          return view;
        }
        return null;
      }
      const cView = r.interpolator?.getCurrCarStateView(i);
      if (!cView || cView.posZ <= -200 || cView.posX < -5000) {
        return null;
      }
      return cView;
    };

    // Emit boost start/end incidents for remote test cars on Client when testCarAudioEnabled is true
    if (isLobbyDualWorld && lobbyState && gameAudioEngine) {
      for (const testIdx of [6, 7]) {
        const view = testCarAudioEnabled ? resolveCarView(testIdx) : null;
        const nowBoosting = Boolean(view && view.isBoosting && !view.isDemoed);
        const wasBoosting = Boolean(this._prevTestCarBoosting[testIdx]);
        if (nowBoosting !== wasBoosting) {
          this._prevTestCarBoosting[testIdx] = nowBoosting;
          if (testCarAudioEnabled && view) {
            gameAudioEngine.handleEvent({
              type: nowBoosting ? INCIDENT_EVENT_TYPES.CAR_BOOST_START : INCIDENT_EVENT_TYPES.CAR_BOOST_STOP,
              carIndex: testIdx,
              carPosX: view.posX,
              carPosY: view.posY,
              carPosZ: view.posZ,
              x: view.posX,
              y: view.posY,
              z: view.posZ
            }, r.camera);
          }
        }
      }
    } else {
      this._prevTestCarBoosting[6] = false;
      this._prevTestCarBoosting[7] = false;
    }

    // 3. Multi-car Procedural EMotorSynth Engine Audio
    const audioCtx = getAudioContext();
    const masterInput = getMasterAudioInput();

    while (this.engineSynths.length < Math.max(2, effectiveNumCars)) {
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
      const carView = i < effectiveNumCars ? resolveCarView(i) : null;
      const isCarValid = Boolean(carView);

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

      let carPos;
      if (isThisActiveCar && activeCarMesh) {
        carPos = activeCarMesh.position;
      } else if (r.arena?.cars?.[i]?.visible && r.arena?.cars?.[i]?.position) {
        carPos = r.arena.cars[i].position;
      } else {
        if (!this._scratchCarAudioPos) {
          this._scratchCarAudioPos = { x: 0, y: 0, z: 0 };
        }
        this._scratchCarAudioPos.x = -carView.posX;
        this._scratchCarAudioPos.y = carView.posZ;
        this._scratchCarAudioPos.z = carView.posY;
        carPos = this._scratchCarAudioPos;
      }

      const forwardSpeed = carView ? carView.forwardSpeed : 0;
      const alive = isCarValid && !carView.isDemoed;
      const audible = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));

      if (entry.spatialBus && carPos) {
        entry.spatialBus.setPosition(carPos);
        entry.spatialBus.setEnabled(alive && audible);
      }

      if (entry.synth) {
        entry.synth.setVolume(engineVol);
        if (!this._scratchSynthParams) {
          this._scratchSynthParams = { forwardSpeed: 0, alive: true, audible: true };
        }
        this._scratchSynthParams.forwardSpeed = forwardSpeed;
        this._scratchSynthParams.alive = alive;
        this._scratchSynthParams.audible = audible;
        entry.synth.update(this._scratchSynthParams);
      }
    }

    // 4. Supersonic & Boost loops
    const isAudibleActive = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));
    if (subsystemState?.lastTelemetry) {
      let activeSynths = 0;
      for (let i = 0; i < this.engineSynths.length; i++) {
        if (this.engineSynths[i]?.synth?.active) activeSynths++;
      }
      const t = subsystemState.lastTelemetry;
      t.updatedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      t.contextCurrentTime = audioCtx ? audioCtx.currentTime : 0;
      t.isMatchActive = Boolean(isMatchActive);
      t.hasBlockingOverlay = Boolean(hasBlockingOverlay);
      if (!Array.isArray(t.blockingOverlays)) {
        t.blockingOverlays = [];
      } else {
        t.blockingOverlays.length = 0;
      }
      if (r.openOverlays && r.openOverlays.size > 0) {
        for (const overlayName of r.openOverlays) {
          t.blockingOverlays.push(overlayName);
        }
      }
      t.continueOnBlur = Boolean(continueOnBlur);
      t.isHidden = Boolean(isHidden);
      t.isAudibleActive = Boolean(isAudibleActive);
      t.activeCar = activeCar;
      t.effectiveNumCars = effectiveNumCars;
      t.engineSynthsCount = this.engineSynths.length;
      t.activeEngineSynths = activeSynths;
    }

    if (gameAudioEngine) {
      gameAudioEngine.updateSupersonic(isSupersonic, isAudibleActive);
      gameAudioEngine.updateBoost(playerCarView?.isBoosting && !playerCarView?.isDemoed, isAudibleActive);

      // 5. Multi-car Dynamic Spatial Audio Tracking (positions, loops, emitters)
      if (typeof gameAudioEngine.updateVehicles === 'function') {
        if (!this._scratchVehiclePos) {
          this._scratchVehiclePos = { posX: 0, posY: 0, posZ: 0 };
        }
        if (!this._scratchVehicleUpdateOpts) {
          this._scratchVehicleUpdateOpts = {
            activeCarIndex: 0,
            numCars: 0,
            getCarPos: (i) => {
              const cView = resolveCarView(i);
              if (cView && Number.isFinite(cView.posX) && Number.isFinite(cView.posY) && Number.isFinite(cView.posZ)) {
                this._scratchVehiclePos.posX = cView.posX;
                this._scratchVehiclePos.posY = cView.posY;
                this._scratchVehiclePos.posZ = cView.posZ;
                return this._scratchVehiclePos;
              }
              return (i === this._scratchVehicleUpdateOpts.activeCarIndex && this.runtime.arena?.car)
                ? this.runtime.arena.car.position
                : this.runtime.arena?.cars?.[i]?.position;
            },
            getCarState: (i) => resolveCarView(i),
            isMatchActive: true,
            hasBlockingOverlay: false,
            continueOnBlur: false,
            isHidden: false
          };
        }
        const vOpts = this._scratchVehicleUpdateOpts;
        vOpts.activeCarIndex = activeCar;
        vOpts.numCars = effectiveNumCars;
        vOpts.isMatchActive = isMatchActive;
        vOpts.hasBlockingOverlay = hasBlockingOverlay;
        vOpts.continueOnBlur = continueOnBlur;
        vOpts.isHidden = isHidden;
        gameAudioEngine.updateVehicles(vOpts);
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
