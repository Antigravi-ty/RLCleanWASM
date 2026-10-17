import { gameAudioEngine, gameAudio } from '../../audio/AudioArchitecture.js';
import { hudStore } from '../../ui-system/index';

/**
 * RuntimeAudioCoordinator
 * Manages game lifecycle audio triggers, SFX dispatching, and engine synth state.
 */
export class RuntimeAudioCoordinator {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async setupAudio(onProgress = null) {
    const r = this.runtime;
    await Promise.all([
      gameAudioEngine.preload(onProgress),
      r.flipResetVisual?.preloadAudio?.(),
      r.arena?.prepareAssets?.()
    ]);
  }

  triggerGameAudioEvents(goalScored, curBoost, isSupersonic, curr) {
    const r = this.runtime;
    const audio = r.options.gameAudio || gameAudio;
    if (!audio) return;

    // 1. Goal scored poof SFX
    const isGoalNow = goalScored || (r.match.state.mode === 'match' && r.match.state.phase === 'goal');
    if (isGoalNow && !r.audioLastGoalScored && !r.networkReconciler) {
      audio.play('sfx_goal_poof', 1.0);
    }
    r.audioLastGoalScored = isGoalNow;

    // In authoritative sessions (single-player bot & multiplayer matches with reconciler),
    // once KICKOFF_WILL_START sets r.lastKickoffTargetFrame, the client autonomously progresses
    // the 3-2-1 HUD countdown and audio latches against the synchronized server tick clock,
    // even after KICKOFF_WILL_START is acknowledged and retired from the wire.
    if (r.networkReconciler) {
      if (r.match?.state?.phase === 'kickoff' && typeof r.lastKickoffTargetFrame === 'number' && r.lastKickoffTargetFrame > 0) {
        const currentTick = r.networkReconciler.lastAckedServerTick >= 0
          ? r.networkReconciler.lastAckedServerTick
          : (r.networkReconciler.serverTick ?? 0);
        const remainingTicks = Math.max(0, r.lastKickoffTargetFrame - currentTick);
        const displaySec = remainingTicks > 0 ? Math.min(3, Math.ceil(remainingTicks / 120)) : 0;

        if (r.match.state.countdown !== displaySec) {
          r.match.state.countdown = displaySec;
          hudStore.getState().setMatchState({
            matchPhase: 'kickoff',
            kickoffCountdown: displaySec
          });
        }

        if (!r.latchedKickoffSeconds) {
          r.latchedKickoffSeconds = new Set();
        }
        if (remainingTicks <= 360 && remainingTicks > 240 && !r.latchedKickoffSeconds.has(3)) {
          r.latchedKickoffSeconds.add(3);
          audio.play('match_countdown_321', 1.0);
        } else if (remainingTicks <= 240 && remainingTicks > 120 && !r.latchedKickoffSeconds.has(2)) {
          r.latchedKickoffSeconds.add(2);
          audio.play('match_countdown_321', 1.0);
        } else if (remainingTicks <= 120 && remainingTicks > 0 && !r.latchedKickoffSeconds.has(1)) {
          r.latchedKickoffSeconds.add(1);
          audio.play('match_countdown_321', 1.0);
        } else if (currentTick >= r.lastKickoffTargetFrame + 12) {
          console.warn(
            `[RuntimeAudioCoordinator:Fallback] Authoritative KICKOFF_START signal not observed by tick ${currentTick} (target=${r.lastKickoffTargetFrame}); releasing local kickoff lock.`
          );
          r.networkReconciler.setKickoffMaskUntilTick?.(-1);
          r.lastKickoffTargetFrame = -1;
          r.latchedKickoffSeconds?.clear();
          r.match.state.phase = 'playing';
          r.match.state.countdown = 0;
          hudStore.getState().setMatchState({
            matchPhase: 'playing',
            kickoffCountdown: 0
          });
          audio.play('match_start_go', 1.0);
        }
      }
    } else {
      // 2. Match 30 seconds left SFX
      if (r.match.state.mode === 'match' && !r.match.state.overtime && r.match.state.phase === 'playing') {
        if (
          r.audioLastRemainingSec > 30 &&
          r.match.state.remainingSeconds <= 30 &&
          r.match.state.remainingSeconds > 0
        ) {
          audio.play('match_30_seconds_left', 1.0, 10000);
        }
      }

      // 2b. Match 10 seconds countdown SFX (repeats each second for 10..1)
      if (r.match.state.mode === 'match' && !r.match.state.overtime && r.match.state.phase === 'playing') {
        const remSec = Math.ceil(r.match.state.remainingSeconds);
        if (remSec <= 10 && remSec >= 1 && remSec !== r.audioLast10sCountdown) {
          r.audioLast10sCountdown = remSec;
          audio.play('match_countdown_10s', 1.0);
        } else if (remSec > 10 || remSec <= 0) {
          r.audioLast10sCountdown = -1;
        }
      }

      // 3. Match entering overtime SFX
      if (r.match.state.mode === 'match' && r.match.state.overtime && !r.audioLastOvertime) {
        audio.play('match_entering_overtime', 1.0, 10000);
      }

      // 4. Kickoff countdown 321 SFX
      if (r.match.state.mode === 'match' && r.match.state.phase === 'kickoff') {
        const currentCount = Math.ceil(r.match.state.countdown);
        if (currentCount >= 1 && currentCount <= 3 && currentCount !== r.audioLastCountdown) {
          r.audioLastCountdown = currentCount;
          audio.play('match_countdown_321', 1.0);
        }
      } else {
        r.audioLastCountdown = -1;
      }

      // 5. Match start / kickoff Go! SFX
      if (r.match.state.mode === 'match' && r.audioLastPhase === 'kickoff' && r.match.state.phase === 'playing') {
        audio.play('match_start_go', 1.0);
      }

      r.audioLastRemainingSec = r.match.state.remainingSeconds;
      r.audioLastOvertime = r.match.state.overtime;
      r.audioLastPhase = r.match.state.phase;
    }

    // Out of boost SFX
    const isBoostPressed = Boolean(r.playerControls && r.playerControls.boost);
    if (isBoostPressed && !r.audioLastBoostPressed && curBoost <= 0.001) {
      audio.play('sfx_error_no_boost', 0.85);
    }
    r.audioLastBoostPressed = isBoostPressed;
  }

  resetAudio() {
    const r = this.runtime;
    for (const eng of r.engineSynths) {
      eng.synth?.reset();
      eng.spatialBus?.setEnabled(false);
    }
    r.audioLastGoalScored = false;
    r.audioLastCountdown = -1;
    r.audioLast10sCountdown = -1;
    r.audioLastBoostPressed = false;
  }
}
