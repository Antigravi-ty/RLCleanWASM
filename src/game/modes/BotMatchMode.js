import { BaseGameMode } from './BaseGameMode.js';
import { hudStore } from '../../stores/hudStore';
import { useAppStore } from '../../stores/appStore';
import { audioConfig } from '../../config/audioConfig.js';
import {
  ReplayTimelineController,
  applyReplayFrameToEngine,
  applyDirectorReplayCamera
} from '../../replay/ReplayTimelineController.js';
import { PodiumCelebrationController } from './PodiumCelebrationController.js';

/**
 * BotMatchMode.js
 * Competitive match mode with authoritative match rules, 256MB WASM Replay Timeline Scrubbing,
 * Goal Replay highlight camera, and Post-Match Podium Showcase celebrations.
 */
export class BotMatchMode extends BaseGameMode {
  constructor(runtime) {
    super('match', runtime);
    this.replayController = new ReplayTimelineController({ engine: runtime?.physics || null });
    this.podiumController = new PodiumCelebrationController(runtime);
    if (runtime) {
      runtime.replayTimelineController = this.replayController;
      runtime.podiumController = this.podiumController;
    }
  }

  _ensureControllers() {
    const r = this.runtime;
    if (!r) return;
    if (r.physics && this.replayController.engine !== r.physics) {
      this.replayController.attach(r.physics);
    }
    if (!r.replayTimelineController) {
      r.replayTimelineController = this.replayController;
    }
    if (!r.podiumController) {
      r.podiumController = this.podiumController;
    }
  }

  update(context) {
    const r = this.runtime;
    const { playerCarView, dt } = context;
    this._ensureControllers();

    const phase = r.match?.state?.phase || 'playing';

    // 1. Evaluate pause state
    const continueOnBlur = audioConfig.get('continueAudioOnLostFocus');
    const isHidden = typeof document !== 'undefined' && (!document.hasFocus() || document.hidden);
    const shouldPauseOnHidden = !continueOnBlur && isHidden;
    const blockingOverlays = Array.from(r.openOverlays).filter(n => n !== 'trajectory');
    const hasBlockingOverlay = blockingOverlays.length > 0;
    const isTrajectoryOnly = r.openOverlays.has('trajectory') && !hasBlockingOverlay;

    const isMenuOpen = useAppStore ? useAppStore.getState().isOpen : false;
    const isOnlineSession = Boolean(useAppStore?.getState?.()?.onlineSession?.roomId);
    const shouldPauseMatch = !isOnlineSession &&
      ((r.isCursorBrowsing && !isTrajectoryOnly) || hasBlockingOverlay || shouldPauseOnHidden || r.isBotPaused || isMenuOpen);

    if (!isOnlineSession && shouldPauseMatch !== r.match.state.paused) {
      r.match.state.paused = shouldPauseMatch;
      if (r.authoritativeServer) {
        r.authoritativeServer.pauseMatch(shouldPauseMatch);
      }
    }

    // 2. Handle Goal Replay timeline progression & scrubbing or Post-Match Podium physics
    if (phase === 'replay') {
      if (!this.replayController.isActive) {
        this.replayController.beginReplaySession({
          scoringTeam: r.match?.state?.scorer ?? 0
        });
      }
      r.goalReplayCameraOverrideActive = true;
      const isCustomScrubbing =
        this.replayController.isScrubbing ||
        this.replayController.isPaused ||
        Math.abs(this.replayController.playbackSpeed - 1.0) > 0.01;
      const stepRes = this.replayController.stepPlayback(
        dt ?? (1 / 120),
        r.interpolator,
        isCustomScrubbing
      );
      if (!isCustomScrubbing && r.networkReconciler?.lastParsedPacket?.stateSnapshot) {
        applyReplayFrameToEngine(
          r.physics,
          r.networkReconciler.lastParsedPacket.stateSnapshot,
          r.interpolator
        );
      }
      applyDirectorReplayCamera(
        r.camera,
        r.interpolator,
        stepRes.progress,
        this.replayController.scoringTeam,
        dt ?? 0.016,
        0,
        this.replayController.directorCameraState
      );
      hudStore.getState().setReplayState?.({
        replayProgress: stepRes.progress,
        replayFrameIndex: stepRes.frameIndex,
        replayTotalFrames: stepRes.totalFrames,
        replayPaused: this.replayController.isPaused,
        replayPersistent: this.replayController.isPersistent,
        replaySpeed: this.replayController.playbackSpeed
      });
    } else if (this.replayController.isActive) {
      this.replayController.endReplaySession();
      r.goalReplayCameraOverrideActive = false;
      hudStore.getState().setReplayState?.({
        replayPaused: false,
        replayPersistent: false
      });
    }

    if (phase === 'podium' || phase === 'ended') {
      this.podiumController.update(context);
      this.podiumController.updateCamera(r.camera, dt ?? 0.016);
    } else if (this.podiumController.isActive) {
      this.podiumController.exitPodium();
    }

    // 3. Sync match state to HUD (score, time, countdown, phase)
    if (!r.networkReconciler) {
      hudStore.getState().setMatchState({
        blueScore: r.match.state.blueScore,
        orangeScore: r.match.state.orangeScore,
        remainingSeconds: Math.ceil(r.match.state.remainingSeconds),
        kickoffCountdown: r.match.state.phase === 'kickoff' ? Math.ceil(r.match.state.countdown) : 0,
        matchPhase: r.match.state.phase
      });
    }

    if (playerCarView) {
      hudStore.getState().setBoost(playerCarView.boost, playerCarView.isBoosting, false);
    }
  }

  onLeave() {
    if (this.runtime) {
      this.runtime.goalReplayCameraOverrideActive = false;
    }
    this.replayController?.endReplaySession?.();
    this.podiumController?.exitPodium?.();
  }

  onResetKickoff(seed = -1) {
    const r = this.runtime;
    this.replayController?.endReplaySession?.();
    this.podiumController?.exitPodium?.();
    r.ballTrajectoryPredictor?.clear?.();
    r.physics?.resetKickoff?.(seed);
    r.audioSubsystem?.resetAudio?.();
    r.resetBotState?.();

    if (r.authoritativeServer) {
      r.authoritativeServer.sim?.resetKickoff?.(seed);
      r.authoritativeServer.sim?.pollGoal?.();
      r.authoritativeServer.clientInputBuffer?.clear?.();
      r.authoritativeServer.lastReceivedControls?.clear?.();
    }
    if (r.networkReconciler) {
      const sSnap = r.authoritativeServer ? r.authoritativeServer.sim.saveCompactState() : r.physics.saveCompactState();
      const sTick = r.authoritativeServer ? Math.floor(r.authoritativeServer.sim.getHeaderView().tickCount) : 0;
      r.networkReconciler.syncTimeline(sSnap, sTick);
    }

    for (const v of r.flipResetVisuals.values()) v.update(0, false);

    r.arena?.resetBallTrail?.();
    r.camera?.resetView?.();
    r.interpolator?.sync?.();
  }
}
