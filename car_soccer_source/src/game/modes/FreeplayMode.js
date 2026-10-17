import { BaseGameMode } from './BaseGameMode.js';
import { hudStore } from '../../ui-system/index';

/**
 * FreeplayMode.js
 * Casual practice mode: instant kickoff reset on goal, unlimited boost support,
 * free ball controls and physics experimentation.
 */
export class FreeplayMode extends BaseGameMode {
  constructor(runtime) {
    super('freeplay', runtime);
  }

  onEnter() {
    if (this.runtime.keyboard) {
      this.runtime.keyboard.ballControlEnabled = true;
    }
  }

  onLeave() {
    if (this.runtime.keyboard) {
      this.runtime.keyboard.ballControlEnabled = false;
    }
  }

  update(context) {
    const r = this.runtime;
    const { goalScored, playerCarView } = context;

    if (goalScored && !r.trainingOptions.disableGoalReset) {
      r.resetKickoff();
      r.arena?.resetBallTrail?.();
    }

    if (playerCarView) {
      const isUnlimited = r.trainingOptions.boostOption === 'unlimited';
      hudStore.getState().setBoost(playerCarView.boost, playerCarView.isBoosting, isUnlimited);
    }
  }

  onResetKickoff(seed = -1) {
    const r = this.runtime;
    r.ballTrajectoryPredictor?.clear?.();
    r.physics?.resetKickoff?.(seed);
    r.audioSubsystem?.resetAudio?.();
    r.interpolator?.sync?.();
    r.arena?.resetBallTrail?.();
    r.physics?.resetView?.();
  }
}
