/**
 * TelemetryStage.js
 * Updates speedometer HUD needles, flip availability indicator (with countdown & unlimited state),
 * and finalizes frame profiling metrics.
 */
import { hudStore } from '../../../stores/hudStore';

export class TelemetryStage {
  constructor(runtime) {
    this.runtime = runtime;
  }

  execute(context) {
    const r = this.runtime;
    const { playerCarView } = context;

    if (playerCarView) {
      const hasFlipNow = !playerCarView.isDemoed && Boolean(playerCarView.isOnGround || playerCarView.hasFlipOrJump);
      let flipStatus = 'none';
      let flipRemainingSeconds = 0;

      if (hasFlipNow) {
        if (playerCarView.isOnGround) {
          flipStatus = 'grounded';
          flipRemainingSeconds = 1.25;
        } else if (!playerCarView.isJumping && playerCarView.airTimeSinceJump <= 0.0001) {
          flipStatus = 'unlimited';
          flipRemainingSeconds = 1.25;
        } else {
          flipStatus = 'countdown';
          flipRemainingSeconds = Math.max(0, 1.25 - playerCarView.airTimeSinceJump);
        }
      }

      const carSpeed = playerCarView.isDemoed ? 0 : Math.hypot(playerCarView.velX, playerCarView.velY, playerCarView.velZ);
      const hudState = hudStore?.getState?.();
      hudState?.setHasFlip?.(hasFlipNow, flipStatus, flipRemainingSeconds);
      hudState?.setCarSpeed?.(carSpeed);
    }

    if (r.profiler) {
      r.profiler.mark();
      r.profiler.frameEnd(
        r.interpolator?.lastTicks ?? 0,
        r.interpolator?.lastDropped ?? 0,
        r.interpolator?.lastStalled ?? false
      );
    }
  }
}
