/**
 * TelemetryStage.js
 * Updates speedometer HUD needles, flip availability indicator, and finalizes frame profiling metrics.
 */
import { hudStore } from '../../../ui-system/index';

export class TelemetryStage {
  constructor(runtime) {
    this.runtime = runtime;
  }

  execute(context) {
    const r = this.runtime;
    const { playerCarView } = context;

    if (playerCarView) {
      const hasFlipNow = !playerCarView.isDemoed && Boolean(playerCarView.isOnGround || playerCarView.hasFlipOrJump);
      const carSpeed = playerCarView.isDemoed ? 0 : Math.hypot(playerCarView.velX, playerCarView.velY, playerCarView.velZ);
      const hudState = hudStore?.getState?.();
      hudState?.setHasFlip?.(hasFlipNow);
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
