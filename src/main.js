import { MinimumProgressLoader } from './loader/MinimumProgressLoader.js';
import { isVerboseLogEnabled } from './loader/ConsoleProgressObserver.js';

async function bootApplication() {
  const host = typeof document !== 'undefined' ? document.querySelector('#app') : null;
  const loader = new MinimumProgressLoader(host);
  loader.mount();

  import('./styles/game.css').catch((err) => {
    console.warn('[Engine] Non-fatal stylesheet stream warning:', err);
  });

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
      totalSteps: 8,
      stageIndex: 1,
      totalStages: 6,
      overallPercent: 2,
      taskType: 'indeterminate',
      category: 'Bootstrap Core',
      hint: 'Streaming and linking core runtime & 3D subsystems...'
    });

    const [
      { bootstrapEngine },
      { mountGameUI }
    ] = await Promise.all([
      import('./game/GameBootstrap.js'),
      import('./ui-system/index.tsx')
    ]);

    await bootstrapEngine({ loader, mountUI: mountGameUI });

    if (isVerboseLogEnabled()) {
      console.log('[Engine] Rocket Companion Engine online — Free Play ready.');
    }
  } catch (err) {
    console.error('[Engine] Fatal bootstrap failure:', err);
    loader.onError({
      taskId: 'bootstrap',
      taskName: 'Engine Bootstrap',
      error: err,
      isCritical: true
    });
  }
}

bootApplication();
