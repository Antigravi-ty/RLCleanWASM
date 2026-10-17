import {
  PHYSICS_EVENT_TYPES,
  INCIDENT_EVENT_TYPES
} from '../../../physics/RocketSimConstants.js';
import { eventStreamStore } from '../../../ui-system/tokens/eventStreamStore';
import { isEventLogEnabled, gameAudioEngine } from '../../../audio/AudioArchitecture.js';

/**
 * SimulationStage.js
 * Advances deterministic 120Hz physics accumulator, network reconciliation,
 * and processes native debounced collision events.
 */
export class SimulationStage {
  constructor(runtime) {
    this.runtime = runtime;
  }

  execute(context) {
    const r = this.runtime;
    const { timestamp } = context;

    const isMatchEnded =
      r.match.state.mode === 'match' &&
      (r.match.state.phase === 'ended' || r.match.state.phase === 'podium');

    // 1. Advance Physics Interpolator accumulator
    if (r.match.state.paused || isMatchEnded) {
      r.interpolator.sync(timestamp);
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
          if (r.match.state.mode === 'kickoff-training' || r.match.state.mode === 'dev-test-lab') {
            return r.modeManager.getActiveMode()?.onBeforePhysicsTick?.();
          }
        },
        isLocalSinglePlayerBotMatch
          ? () => r.stepBot()
          : (r.match.state.mode === 'kickoff-training')
            ? () => r.modeManager.getActiveMode()?.onStepPhysicsTick?.()
            : (r.match.state.mode === 'dev-test-lab')
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
      if (r.interpolator) {
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
    context.isMatchActive =
      r.match.state.mode === 'freeplay' ||
      r.match.state.mode === 'kickoff-training' ||
      r.match.state.mode === 'dev-test-lab' ||
      (!r.match.state.paused && (
        r.match.state.phase === 'playing' ||
        r.match.state.phase === 'kickoff' ||
        r.match.state.phase === 'goal'
      ));

    // 5. Read Native Collision Events
    if (r.physics) {
      const ballPosY = Math.abs(r.physics.getBallStateView?.()?.posY || 0);
      if (ballPosY < 5000 && r.match.state.phase !== 'goal') {
        r._clientGoalIncidentLatched = false;
      }

      r.physics.readEvents((event) => {
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
          }
        }

        if (isEventLogEnabled(event.type)) {
          console.log(`[Physics Incident 0x${event.type.toString(16).padStart(2, '0')}]`, event);
        }

        eventStreamStore.addEvent(event);

        if (event.type === PHYSICS_EVENT_TYPES.FLIP_RESET_GAINED || event.type === INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED) {
          const visual = r.getFlipResetVisual(event.carIndex);
          if (visual) {
            visual.play();
          }
        }

        if (gameAudioEngine) {
          gameAudioEngine.handleEvent(event, r.camera);
        }
      });
    }

    if (r.profiler) r.profiler.mark();
  }
}
