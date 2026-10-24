import {
  PHYSICS_EVENT_TYPES,
  INCIDENT_EVENT_TYPES
} from '../../../physics/RocketSimConstants.js';
import { eventStreamStore } from '../../../stores/eventStreamStore';
import { isEventLogEnabled } from '../../../config/audioConfig.js';
import { gameAudioEngine } from '../../../audio/GameAudioEngineFacade.js';

/**
 * SimulationStage.js
 * Advances deterministic 120Hz physics accumulator, network reconciliation,
 * and processes native debounced collision events.
 */
export class SimulationStage {
  constructor(runtime) {
    this.runtime = runtime;
    this._carActionStates = new Map();
    this._lastSeenPhysicsTick = -1;
  }

  resetActionStates() {
    this._carActionStates.clear();
    this._lastSeenPhysicsTick = -1;
    if (gameAudioEngine?.incidentEngine) {
      const inc = gameAudioEngine.incidentEngine;
      inc.lastCarBallHitTimestamp = 0;
      inc.lastCarCollisionTimestamp = 0;
      if (inc.worldImpactHandler) {
        inc.worldImpactHandler.lastGoalpostHitTimestamp = 0;
        inc.worldImpactHandler.lastBallWorldHitTimestamp = 0;
      }
    }
    if (gameAudioEngine?.vehicleManager) {
      gameAudioEngine.vehicleManager._lastFlipResetMsByCar?.clear?.();
    }
  }

  resetCarActionStates() {
    this.resetActionStates();
  }

  _getCarActionState(carIdx) {
    let st = this._carActionStates.get(carIdx);
    if (!st) {
      st = {
        boostLatched: false,
        hasSingleJumped: false,
        jumpReleasedSinceSingleJump: true,
        hasAirJumped: false,
        lastBoostTick: -100,
        lastJumpTick: -100,
        lastAirJumpTick: -100,
        lastFlipResetTick: -1000,
        lastFlipResetTimeMs: -1000
      };
      this._carActionStates.set(carIdx, st);
    }
    return st;
  }

  execute(context) {
    const r = this.runtime;
    const { timestamp } = context;

    const isMatchEnded =
      (r.match.state.mode === 'match' || r.match.state.mode === 'exp-multi-bots') &&
      (r.match.state.phase === 'ended' || r.match.state.phase === 'podium');
    const isGoalReplay =
      (r.match.state.mode === 'match' ||
        r.match.state.mode === 'exp-multi-bots' ||
        r.match.state.mode === 'freeplay' ||
        r.match.state.mode === 'static-training-pack') &&
      r.match.state.phase === 'replay';

    // 1. Advance Physics Interpolator accumulator
    if (r.match.state.paused || isMatchEnded || isGoalReplay) {
      if (!isGoalReplay && !r.podiumController?.isActive) {
        r.interpolator.sync(timestamp);
      }
    } else {
      const isLocalSinglePlayerBotMatch = Boolean(
        r.isBotMatch &&
        r.match.state.mode === 'match' &&
        !r.authoritativeServer &&
        !r.networkReconciler
      );

      r.interpolator.update(
        timestamp,
        () => {
          r.pollInputs();
          if (r.diagnosticsFleetController?.enabled && r.physics && !r.networkReconciler) {
            const cTick = Math.floor(r.physics.getHeaderView().tickCount);
            r.diagnosticsFleetController.applyToAuthority(r.physics, cTick);
          }
          if (
            r.match.state.mode === 'freeplay' ||
            r.match.state.mode === 'kickoff-training' ||
            r.match.state.mode === 'dev-test-lab' ||
            r.match.state.mode === 'exp-multi-bots' ||
            r.match.state.mode === 'static-training-pack'
          ) {
            return r.modeManager.getActiveMode()?.onBeforePhysicsTick?.();
          }
        },
        isLocalSinglePlayerBotMatch
          ? () => r.stepBot()
          : (r.match.state.mode === 'kickoff-training')
            ? () => r.modeManager.getActiveMode()?.onStepPhysicsTick?.()
            : (r.match.state.mode === 'freeplay' ||
               r.match.state.mode === 'dev-test-lab' ||
               r.match.state.mode === 'exp-multi-bots' ||
               r.match.state.mode === 'static-training-pack')
              ? () => {
                  r.physics.step(1);
                  r.modeManager.getActiveMode()?.onAfterPhysicsTick?.();
                  return true;
                }
              : undefined
      );
    }

    // 2. Poll Goal Event (only directly poll & clear WASM goal flag when not driven by authoritative network reconciler)
    const activeSim = r.physics;
    if (r.networkReconciler) {
      context.goalScored = r.match.state.phase === 'goal';
    } else {
      context.goalScored = activeSim.pollGoal() !== 0;
    }

    // 3. Network Prediction & Authoritative Server update
    if (r.networkReconciler) {
      const now = performance.now();
      if (r.authoritativeServer) {
        if (r.diagnosticsFleetController?.enabled && !r.authoritativeServer.isWorker) {
          const sTick = Math.floor(r.authoritativeServer.sim?.getHeaderView?.()?.tickCount ?? 0);
          r.diagnosticsFleetController.applyToAuthority(r.authoritativeServer, sTick);
        }
        r.authoritativeServer.update(now);
      }
      const tickBeforeReconcile = Math.floor(r.physics.getHeaderView().tickCount);
      r.networkReconciler.reconcile(now);
      if (r.match.state.paused || isMatchEnded) {
        r.networkReconciler.flushPendingControlPackets?.(now);
      }
      const tickAfterReconcile = Math.floor(r.physics.getHeaderView().tickCount);
      if (
        r.interpolator &&
        !isGoalReplay &&
        !r.networkReconciler.lobbyDualWorldMode &&
        !r.networkReconciler.replayPlaybackMode
      ) {
        r.interpolator.currState.set(r.physics.state);
        if (
          tickAfterReconcile !== tickBeforeReconcile ||
          (r.networkReconciler.metrics.lastCorrectionDelta > 0.05 && !r.networkReconciler.enableSmoothing)
        ) {
          r.interpolator.prevState.set(r.physics.state);
        }
      }
    }

    // 4. Update isMatchActive flag
    const isReplayPaused = Boolean(
      isGoalReplay && r.modeManager?.getActiveMode()?.replayController?.isPaused
    );
    context.isMatchActive =
      !isReplayPaused &&
      (r.match.state.mode === 'freeplay' ||
        r.match.state.mode === 'kickoff-training' ||
        r.match.state.mode === 'dev-test-lab' ||
        r.match.state.mode === 'exp-multi-bots' ||
        r.match.state.mode === 'static-training-pack' ||
        (!r.match.state.paused && (
          r.match.state.phase === 'playing' ||
          r.match.state.phase === 'kickoff' ||
          r.match.state.phase === 'goal'
        )));

    // 5. Read Native Collision Events
    if (r.physics) {
      const currentTick = Math.floor(r.physics.getHeaderView?.()?.tickCount ?? 0);
      if (this._lastSeenPhysicsTick >= 0 && currentTick < this._lastSeenPhysicsTick) {
        this.resetActionStates();
      }
      this._lastSeenPhysicsTick = currentTick;

      const ballPosY = Math.abs(r.physics.getBallStateView?.()?.posY || 0);
      if (ballPosY < 5000 && r.match.state.phase !== 'goal') {
        r._clientGoalIncidentLatched = false;
      }

      const nCars = Math.min(8, r.physics.numCars || 1);
      for (let c = 0; c < nCars; c++) {
        const st = this._getCarActionState(c);
        const cv = r.physics.getCarStateView?.(c);
        const isLocal = c === r.playerCarIndex;
        const ctrlBase = c * 8;
        const jumpCtrl = isLocal
          ? Boolean(r.playerControls?.jump)
          : (r.physics.controlsView ? r.physics.controlsView[ctrlBase + 5] >= 0.5 : false);
        const boostCtrl = isLocal
          ? Boolean(r.playerControls?.boost)
          : (r.physics.controlsView ? r.physics.controlsView[ctrlBase + 6] >= 0.5 : false);

        if (!jumpCtrl) {
          st.jumpReleasedSinceSingleJump = true;
        }
        if (cv?.isOnGround && !cv?.isJumping && !cv?.isFlipping) {
          st.hasSingleJumped = false;
          st.hasAirJumped = false;
        }
        if (!boostCtrl && !cv?.isBoosting) {
          st.boostLatched = false;
        }
      }

      r.physics.readEvents((event) => {
        const evtCarIdx = event.carIndex ?? event.primaryId ?? -1;
        if ((evtCarIdx === 6 || evtCarIdx === 7) && !r.testCarAudioEnabled) {
          return;
        }
        if (
          r.networkReconciler?.lobbyDualWorldMode &&
          evtCarIdx >= 0 &&
          evtCarIdx < 65535 &&
          evtCarIdx !== r.playerCarIndex
        ) {
          return;
        }

        if (evtCarIdx >= 0 && evtCarIdx < 8) {
          const st = this._getCarActionState(evtCarIdx);
          const cv = r.physics.getCarStateView?.(evtCarIdx);
          const isLocal = evtCarIdx === r.playerCarIndex;
          const ctrlBase = evtCarIdx * 8;
          const boostCtrl = isLocal
            ? Boolean(r.playerControls?.boost)
            : (r.physics.controlsView ? r.physics.controlsView[ctrlBase + 6] >= 0.5 : false);

          if (event.type === INCIDENT_EVENT_TYPES.CAR_BOOST_START || event.type === INCIDENT_EVENT_TYPES.BOOST_START) {
            if (st.boostLatched || (event.tick > 0 && Math.abs(event.tick - st.lastBoostTick) < 4)) {
              return;
            }
            st.boostLatched = true;
            st.lastBoostTick = event.tick || 0;
          } else if (event.type === INCIDENT_EVENT_TYPES.CAR_BOOST_STOP || event.type === INCIDENT_EVENT_TYPES.BOOST_END) {
            if (boostCtrl && (cv?.boost ?? 0) > 0.5) {
              return;
            }
            st.boostLatched = false;
          } else if (event.type === INCIDENT_EVENT_TYPES.CAR_JUMP) {
            if (st.hasSingleJumped || (event.tick > 0 && Math.abs(event.tick - st.lastJumpTick) < 6)) {
              return;
            }
            st.hasSingleJumped = true;
            st.jumpReleasedSinceSingleJump = false;
            st.lastJumpTick = event.tick || 0;
          } else if (
            event.type === INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP ||
            event.type === INCIDENT_EVENT_TYPES.CAR_DODGE
          ) {
            if (
              st.hasAirJumped ||
              (st.hasSingleJumped && !st.jumpReleasedSinceSingleJump) ||
              (event.tick > 0 && Math.abs(event.tick - st.lastAirJumpTick) < 6)
            ) {
              return;
            }
            st.hasAirJumped = true;
            st.lastAirJumpTick = event.tick || 0;
          } else if (event.type === INCIDENT_EVENT_TYPES.CAR_LANDED) {
            st.hasSingleJumped = false;
            st.hasAirJumped = false;
          }
        }

        if (event.type === INCIDENT_EVENT_TYPES.GOAL_SCORED || event.type === 0x0E) {
          if (r._clientGoalIncidentLatched || isMatchEnded || r.match.state.phase === 'replay') {
            return;
          }
          r._clientGoalIncidentLatched = true;
        }

        if (event.type === PHYSICS_EVENT_TYPES.FLIP_RESET_GAINED || event.type === INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED) {
          const targetCarIdx = typeof event.carIndex === 'number' && event.carIndex >= 0 ? event.carIndex : r.playerCarIndex;
          const bv = r.physics.getBallStateView?.();
          const cv = r.physics.getCarStateView?.(targetCarIdx);
          if (bv && cv) {
            const distToBall = Math.hypot(cv.posX - bv.posX, cv.posY - bv.posY, cv.posZ - bv.posZ);
            const isUpsideDown = cv.upZ < -0.2;
            const isAirborne = cv.posZ > 45.0 && cv.posZ < 1995.0;
            const isValidBallReset = distToBall <= 260.0 && (isAirborne || isUpsideDown);
            if (!isValidBallReset) {
              return;
            }
            const st = this._getCarActionState(targetCarIdx);
            st.hasAirJumped = false;
            st.jumpReleasedSinceSingleJump = true;

            const nowMs = performance.now();
            const tickDelta =
              event.tick > 0 && st.lastFlipResetTick > 0
                ? Math.abs(event.tick - st.lastFlipResetTick)
                : Infinity;
            const timeDeltaMs = nowMs - st.lastFlipResetTimeMs;
            if (tickDelta < 60 || timeDeltaMs < 500) {
              return;
            }
            st.lastFlipResetTick = event.tick || 0;
            st.lastFlipResetTimeMs = nowMs;
          }
        }

        if (isEventLogEnabled(event.type)) {
          console.log(`[Physics Incident 0x${event.type.toString(16).padStart(2, '0')}]`, event);
        }

        eventStreamStore.addEvent(event);
        r.modeManager?.getActiveMode()?.onPhysicsEvent?.(event);

        if (event.type === PHYSICS_EVENT_TYPES.FLIP_RESET_GAINED || event.type === INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED) {
          const targetCarIdx = typeof event.carIndex === 'number' && event.carIndex >= 0 ? event.carIndex : r.playerCarIndex;
          const visual = r.getFlipResetVisual(targetCarIdx);
          if (visual) {
            visual.play();
          }
        }

        if (event.isGoalBarrierHit) {
          r.arena?.triggerGoalBarrierImpact?.(event.x, event.y, event.z);
        }

        if (gameAudioEngine) {
          gameAudioEngine.handleEvent(event, r.camera);
        }
      });
    }

    if (r.profiler) r.profiler.mark();
  }
}
