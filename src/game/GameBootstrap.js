/**
 * src/game/GameBootstrap.js
 * Game Engine Lifecycle Bootstrap & Loading Screen Orchestrator.
 *
 * Enforces Fail-Fast POV Camera Microkernel integrity preflight check:
 * - Real-time SHA-256 digest validation of camera.wasm.
 * - Double ABI & linear memory verification.
 * - Startup hard interruption with dedicated fatal error modal on tampering or corruption.
 * - Zero fallback architecture.
 */

import { DualProgressUIAdapter } from '../loader/DualProgressUIAdapter.js';
import { formatMicrokernelErrorHtml } from '../camera/exempt_pov_microkernel/CameraMicrokernel.js';

export { formatMicrokernelErrorHtml };

export const DEFAULT_APP_ICON_URL = '';

/**
 * Creates the stylized brand loading overlay DOM inside the host container.
 * @param {HTMLElement} container Host DOM container (#app)
 * @param {string} [iconUrl] Brand emblem image URL
 * @returns {{ loadingElement: HTMLElement, labelElement: HTMLElement, noteElement: HTMLElement } | null}
 */
export function renderLoadingScreen(container, iconUrl = DEFAULT_APP_ICON_URL) {
  if (!container) return null;

  container.innerHTML = `
  <div id="loading" data-state="loading">
    <h1 class="load__title">ROCKET <span>COMPANION</span></h1>
    <p class="load__label" role="status">Loading game</p>
    <div class="load__rule"></div>
    <p class="load__note"></p>
  </div>
`;

  return {
    loadingElement: container.querySelector('#loading'),
    labelElement: container.querySelector('#loading .load__label'),
    noteElement: container.querySelector('#loading .load__note')
  };
}

/**
 * Updates loading screen status and visual state.
 * @param {object|HTMLElement} loadingRef Loading DOM references object or element
 * @param {object} options
 * @param {'loading'|'ready'|'error'} [options.state]
 * @param {string} [options.label]
 * @param {string} [options.note]
 * @param {boolean} [options.isHtmlNote]
 */
export function updateLoadingState(loadingRef, { state, label, note, isHtmlNote = false } = {}) {
  if (!loadingRef) return;

  const loadingEl = loadingRef.loadingElement || (loadingRef.dataset ? loadingRef : null);
  const labelEl = loadingRef.labelElement || loadingEl?.querySelector?.('.load__label');
  const noteEl = loadingRef.noteElement || loadingEl?.querySelector?.('.load__note');

  if (loadingEl && state) {
    loadingEl.dataset.state = state;
  }
  if (labelEl && label !== undefined) {
    labelEl.textContent = label;
  }
  if (noteEl && note !== undefined) {
    if (isHtmlNote) {
      noteEl.innerHTML = note;
    } else {
      noteEl.textContent = note;
    }
  }
}

/**
 * Binds pointer, touch, and keyboard listeners to track current active input method on container dataset.
 * @param {HTMLElement} container Host DOM container (#app)
 * @returns {() => void} Cleanup function to unbind attached event listeners
 */
export function setupInputMethodDetection(container) {
  if (!container) return () => {};

  const setMethod = (method) => {
    if (container.dataset && container.dataset.inputMethod !== method) {
      container.dataset.inputMethod = method;
    }
  };

  const hasTouch =
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0) ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(any-pointer: coarse)').matches);

  setMethod(hasTouch ? 'touch' : 'mouse');

  if (typeof window === 'undefined') return () => {};

  const onKeyDown = (e) => {
    if (!e.repeat) setMethod('keyboard');
  };

  const onPointerDown = (e) => {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    setMethod(isTouch ? 'touch' : 'mouse');
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });

  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  };
}

/**
 * Handles bootstrap errors with appropriate user-facing diagnostic messages.
 * @param {Error|any} error Caught bootstrap error
 * @param {object|HTMLElement} loadingRef Loading DOM references
 */
export function handleBootstrapError(error, loadingRef) {
  const isMicrokernel = Boolean(
    error?.isMicrokernelError ||
    (error?.message && (
      error.message.includes('POV Camera Microkernel') ||
      error.message.includes('camera.wasm')
    ))
  );

  if (isMicrokernel) {
    updateLoadingState(loadingRef, {
      state: 'error',
      label: 'Microkernel Verification Failed',
      note: formatMicrokernelErrorHtml(error),
      isHtmlNote: true
    });
    console.error('[POV Microkernel Security Error]', error);
    return;
  }

  updateLoadingState(loadingRef, {
    state: 'error',
    label: error && error.isAssetError ? 'Assets Required' : 'Failed to start',
    note: error && error.isAssetError ? error.message : (error instanceof Error ? error.message : String(error)),
    isHtmlNote: Boolean(error && error.isAssetError)
  });
  console.error('[Bootstrap Error]', error);
}

export class GameBootstrap {
  /**
   * @param {HTMLElement} [container] Host element (defaults to #app)
   * @param {object} [options] Configuration and asset loader callbacks
   */
  constructor(container, options = {}) {
    this.container = container || (typeof document !== 'undefined' ? document.querySelector('#app') : null);
    this.options = options;
    this.loadingRefs = null;
    this.cleanupInput = null;
    this.runtime = null;
    this.iconUrl = options.iconUrl || DEFAULT_APP_ICON_URL;
    this.customProgressBar = options.customProgressBar || null;
  }

  /**
   * Allows external caller or future UI layer to attach a custom progress bar component.
   * @param {object} customUI Component implementing onProgress, onStageChange, onByteStream, etc.
   */
  registerCustomProgressBar(customUI) {
    this.customProgressBar = customUI;
  }

  /**
   * Prepares DOM, loading screen, and input event listeners.
   */
  prepareDOM() {
    if (this.container) {
      this.cleanupInput = setupInputMethodDetection(this.container);
    }
  }

  /**
   * Instantiates, initializes, and starts the GameRuntime with preflight microkernel check.
   * @returns {Promise<GameRuntime>}
   */
  async start() {
    this.prepareDOM();

    // 1. Mount or attach dual progress UI adapter & MinimumProgressLoader FIRST
    const uiAdapter = new DualProgressUIAdapter(this.container, this.options.loader || null);
    if (this.customProgressBar) {
      uiAdapter.registerCustomUI(this.customProgressBar);
    }

    try {
      const [
        { buildEngineLoadingPipeline, startBackgroundAssetPipeline },
        { ConsoleProgressObserver },
        { GameRuntime }
      ] = await Promise.all([
        import('../loader/engineLoadingPipeline.js'),
        import('../loader/ConsoleProgressObserver.js'),
        import('./GameRuntime.js')
      ]);

      // 2. Instantiate runtime and orchestrator
      this.runtime = new GameRuntime(this.container, this.options);
      const orchestrator = buildEngineLoadingPipeline(this.runtime, this.options);

      // 3. Structured console telemetry (Step X of Y, Stage, Duration)
      const consoleObserver = new ConsoleProgressObserver();
      orchestrator.subscribe(consoleObserver);
      orchestrator.subscribe(uiAdapter);

      // 4. Run orchestrated pipeline
      await orchestrator.run();

      console.log('[Loading] ══════════════ [Training Mode] Essential Pipeline Complete ══════════════');
      console.log('[Loading] Training Mode Essential Resources ready — Player can now play.');

      // 5. Trigger background asset downloads asynchronously without blocking gameplay
      startBackgroundAssetPipeline(this.runtime).catch((err) => {
        console.warn('[Loading] Background asset pipeline unhandled rejection:', err);
      });

      return this.runtime;
    } catch (err) {
      uiAdapter.onError({
        taskId: 'bootstrap',
        taskName: 'Engine Lifecycle Bootstrap',
        error: err,
        isCritical: true
      });
      handleBootstrapError(err, this.loadingRefs);
      throw err;
    }
  }

  /**
   * Stops active runtime and unbinds listeners.
   */
  stop() {
    if (this.runtime) {
      this.runtime.stop();
    }
    if (this.cleanupInput) {
      this.cleanupInput();
      this.cleanupInput = null;
    }
  }

  /**
   * Advances a single render frame on the active runtime.
   * @param {number} timestamp
   */
  renderFrame(timestamp) {
    if (this.runtime) {
      this.runtime.renderFrame(timestamp);
    }
  }
}

/**
 * Standard bootstrap helper function.
 * @param {HTMLElement} [container]
 * @param {object} [options]
 * @returns {Promise<GameRuntime>}
 */
export async function bootstrapGameEngine(container, options = {}) {
  const bootstrap = new GameBootstrap(container, options);
  return await bootstrap.start();
}
