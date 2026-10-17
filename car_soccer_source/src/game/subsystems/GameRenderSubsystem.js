import { useUIStore } from '../../ui-system/index';

/**
 * GameRenderSubsystem.js
 * Encapsulates Three.js rendering passes, BoostBloom occluders,
 * supersonic speed lines, and composer execution.
 */
export class GameRenderSubsystem {
  /**
   * @param {import('../GameRuntime.js').GameRuntime} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    this.lastBloomActive = true;
  }

  update(context) {
    const r = this.runtime;
    const { dt, isMatchActive, isSupersonic, playerCarView } = context;

    if (!r.renderer || !r.composer || !r.camera?.camera) return;

    // 1. Prepare visual ball speed trail
    r.arena?.prepareBallSpeedTrail?.(r.camera.camera);

    // 2. Speed lines pass update
    if (r.speedLinesPass && r.cameraSubsystem) {
      r.speedLinesPass.update(
        dt,
        isSupersonic && r.keyboard?.enabled && isMatchActive,
        r.cameraSubsystem.scratchVelocity,
        r.camera.camera
      );
    }

    // 3. Ball Trajectory Predictor update
    if (r.ballTrajectoryPredictor) {
      const winWidth = r.container ? r.container.clientWidth || window.innerWidth : window.innerWidth;
      const winHeight = r.container ? r.container.clientHeight || window.innerHeight : window.innerHeight;
      const curTick = r.physics?.getHeaderView()?.tickCount ?? 0;
      r.ballTrajectoryPredictor.update(curTick, r.arena?.ball?.position, winWidth, winHeight, r.physics);
    }

    // 4. Power save render freeze evaluation
    const isLiveMenuOpen = r.gameUI && useUIStore.getState().isOpen && !useUIStore.getState().isLivePreviewCollapsed;
    const powerSave = useUIStore.getState().graphics?.menuPowerSave || (useUIStore.getState().pauseRenderingOnMenu ? 'freeze' : '30');
    const shouldSkipGpuRender = isLiveMenuOpen && powerSave === 'freeze';
    context.shouldSkipGpuRender = shouldSkipGpuRender;

    if (shouldSkipGpuRender) {
      return;
    }

    // 5. BoostBloom & Occlusion Passes
    const isBloomActive = Boolean(r.arena?.boostBloomActive || Array.from(r.flipResetVisuals.values()).some(v => v?.bloomActive));
    if (isBloomActive) {
      r.camera.camera.layers.set(0);
      r.applyBloomOccluders();
      try {
        r.boostBloom.render(r.arena.scene, r.camera.camera);
      } finally {
        r.restoreBloomMaterials();
      }
    } else if (this.lastBloomActive) {
      r.boostBloom?.clear?.();
    }
    this.lastBloomActive = isBloomActive;

    if (r.profiler) r.profiler.mark();

    // 6. Composer rendering
    if (r.renderer.shadowMap) r.renderer.shadowMap.needsUpdate = true;
    r.composer.render(dt);
  }

  dispose() {
    // Subsystem resources disposed through main pipeline
  }
}
