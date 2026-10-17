import './utils/ConsoleLoggerEnhancer.js';
import { MinimumProgressLoader } from './loader/MinimumProgressLoader.js';

/**
 * main.js
 * Application bootstrap entry point.
 * Strictly mounts and paints the zero-dependency minimal loading screen FIRST,
 * then streams styles and dynamically boots the engine pipeline.
 */

async function bootApplication() {
  const host = typeof document !== 'undefined' ? document.querySelector('#app') : null;
  const loader = new MinimumProgressLoader(host);
  loader.mount();

  // 1. Stream game styles in parallel without blocking the loader paint
  import('./styles/game.css').catch((err) => {
    console.warn('[CarSoccer] Non-fatal stylesheet stream warning:', err);
  });

  // 2. Yield two animation frames so the browser paints the minimal loader animation
  //    before downloading, parsing, or evaluating heavy engine/3D/UI module graphs.
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });
  }

  try {
    loader.onTaskStart({
      taskId: 'bootstrap.module_graph',
      taskName: 'Loading Engine Core Modules...',
      step: 1,
      totalSteps: 10,
      stageIndex: 1,
      totalStages: 6,
      overallPercent: 2,
      taskType: 'indeterminate',
      category: 'Bootstrap Core',
      hint: 'Streaming and linking core runtime & 3D subsystems...'
    });

    const { bootstrapCarSoccerEngine } = await import('./game/CarSoccerEngine.js');
    await bootstrapCarSoccerEngine({ loader });
    console.log('[CarSoccer] Official Car Soccer Engine online — Free Play ready.');
  } catch (err) {
    console.error('[CarSoccer] Fatal bootstrap failure:', err);
    loader.onError({
      taskId: 'bootstrap',
      taskName: 'Engine Bootstrap',
      error: err,
      isCritical: true
    });
  }
}

bootApplication();

