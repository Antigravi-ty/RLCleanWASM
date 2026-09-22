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

import { verifyCameraMicrokernelIntegrity } from '../camera/exempt_pov_microkernel/index.js';

export const DEFAULT_APP_ICON_URL = '/assets/app-icon-512-DPODCpjJ.png';

/**
 * Creates the stylized brand loading overlay DOM inside the host container.
 * @param {HTMLElement} container Host DOM container (#app)
 * @param {string} [iconUrl] Brand emblem image URL
 * @returns {{ loadingElement: HTMLElement, labelElement: HTMLElement, noteElement: HTMLElement } | null}\n */
export function renderLoadingScreen(container, iconUrl = DEFAULT_APP_ICON_URL) {
  if (!container) return null;

  container.innerHTML = `
  <div id="loading" data-state="loading">
    <div class="load__emblem"><img src="${iconUrl}" width="512" height="512" alt="Orange car chasing a soccer ball" fetchpriority="high" /></div>
    <h1 class="load__title">CAR <span>SOCCER</span></h1>
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
 * Formats dedicated actionable fatal error modal for POV Camera Microkernel failures.
 * @param {Error|any} error Caught microkernel error
 * @returns {string} Styled HTML modal
 */
export function formatMicrokernelErrorHtml(error) {
  const message = error instanceof Error ? error.message : String(error);
  return `
  <div class="microkernel-fatal-modal" style="text-align:left;line-height:1.6;font-size:13px;max-width:640px;background:rgba(20,5,8,0.96);padding:20px;border-radius:12px;border:2px solid #ef4444;box-shadow:0 16px 40px rgba(239,68,68,0.35);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fecaca;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="font-size:26px;">🛑</span>
      <div>
        <h3 style="color:#f87171;font-weight:800;margin:0;font-size:16px;letter-spacing:0.5px;">POV Camera Microkernel Tampering Detected</h3>
        <p style="margin:2px 0 0 0;font-size:11px;color:#fca5a5;opacity:0.85;">Microkernel Integrity Check Failed &bull; Startup Blocked &bull; Zero Fallback</p>
      </div>
    </div>
    <div style="background:#2e080d;border-left:4px solid #ef4444;padding:10px 14px;border-radius:6px;margin-bottom:12px;">
      <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;color:#fee2e2;font-weight:600;word-break:break-word;">
        ${message}
      </p>
    </div>
    <div style="font-size:12px;color:#cbd5e1;margin-bottom:12px;">
      <p style="margin:0 0 6px 0;"><strong>Contract Specification:</strong> POV Camera is an external immutable black box microkernel, requiring an untampered WASM binary (<code>camera.wasm</code>) and standard ABI exports.</p>
      <ul style="margin:4px 0 4px 18px;padding:0;font-size:11px;color:#cbd5e1;">
        <li>Standard SHA-256 Digest: <code>b8adc96e73372d0f53346499fb150b576fb08deb0494d8f7f7e989d9daea0854</code></li>
        <li>Required ABI Symbols: <code>memory</code>, <code>getViewPtr</code>, <code>stepView</code>, <code>resetView</code></li>
        <li>Strict Fallback Prohibition: Pure JS emulation fallback (<code>stepFallbackView</code>) has been completely removed.</li>
      </ul>
    </div>
    <div style="padding:8px 12px;background:#180608;border-radius:6px;border:1px dashed #7f1d1d;font-size:11px;color:#fca5a5;">
      ⚠️ Engine startup has been permanently halted. Please verify that <code>custom/assets/camera/camera.wasm</code> is intact and reload the page.
    </div>
  </div>
  `;
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
    console.error('[CarSoccerEngine POV Microkernel Security Error]', error);
    return;
  }

  updateLoadingState(loadingRef, {
    state: 'error',
    label: error && error.isAssetError ? 'Assets Required' : 'Failed to start',
    note: error && error.isAssetError ? error.message : (error instanceof Error ? error.message : String(error)),
    isHtmlNote: Boolean(error && error.isAssetError)
  });
  console.error('[CarSoccerEngine Bootstrap Error]', error);
}

/**
 * Lifecycle orchestrator for the Car Soccer Engine bootstrap process.
 */
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
      this.loadingRefs = renderLoadingScreen(this.container, this.iconUrl);
      this.cleanupInput = setupInputMethodDetection(this.container);
    }
  }

  /**
   * Instantiates, initializes, and starts the GameRuntime with preflight microkernel check.
   * @returns {Promise<GameRuntime>}
   */
  async start() {
    this.prepareDOM();

    try {
      const { GameRuntime } = await import('./GameRuntime.js');
      const {
        buildEngineLoadingPipeline,
        ConsoleProgressObserver,
        DualProgressUIAdapter
      } = await import('../loader/index.js');

      this.runtime = new GameRuntime(this.container, this.options);

      const orchestrator = buildEngineLoadingPipeline(this.runtime, this.options);

      // 1. Structured console telemetry (Step X of Y, Stage, Duration)
      const consoleObserver = new ConsoleProgressObserver();
      orchestrator.subscribe(consoleObserver);

      // 2. Dual progress UI adapter (DOM loading screen & future custom UI hooks)
      const uiAdapter = new DualProgressUIAdapter(this.container);
      if (this.customProgressBar) {
        uiAdapter.registerCustomUI(this.customProgressBar);
      }
      orchestrator.subscribe(uiAdapter);

      // Run orchestrated pipeline (Preflight -> Diagnostics -> Physics -> Scene -> Audio -> Shaders -> Ignition)
      await orchestrator.run();

      return this.runtime;
    } catch (err) {
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
