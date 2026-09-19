/**
 * EventOscilloscopeHUD.js
 * Floating, draggable, resizable real-time parameter oscilloscope for physics events.
 * 
 * Features:
 * - Dynamic parameter inspection (impulse, relSpeed, coordinates x/y/z, collision normals)
 * - Time window adjustment up to 5s max default, slider + manual input with bound breakthrough
 * - Upper and lower bound sliders + manual number inputs with bound breakthrough
 * - Adjustable reference threshold line drawn across the chart
 * - Bi-directional synchronization with Audio subsystem impulse threshold
 * - Discrete single-point scatter plotting (NO lines connecting points)
 * - Adjustable single-point radius for high visibility
 * - Floating window with draggable title bar, corner resize handle, and adjustable opacity
 */

import {
  getAudioSettings,
  setCarBallHitImpulseThreshold,
  setCarBallHitCooldownMs,
  AUDIO_SETTINGS_CHANGED_EVENT
} from '../audio/GameAudioSubsystem.js';

export const PARAM_PRESETS = Object.freeze({
  impulse: { label: 'Impulse (Force)', defaultMin: 0, defaultMax: 1000, sliderMin: 0, sliderMax: 2000, step: 10 },
  relSpeed: { label: 'Relative Speed', defaultMin: 0, defaultMax: 2500, sliderMin: 0, sliderMax: 4000, step: 25 },
  x: { label: 'Coordinate X', defaultMin: -4096, defaultMax: 4096, sliderMin: -5000, sliderMax: 5000, step: 50 },
  y: { label: 'Coordinate Y', defaultMin: -5120, defaultMax: 5120, sliderMin: -6000, sliderMax: 6000, step: 50 },
  z: { label: 'Coordinate Z', defaultMin: 0, defaultMax: 2048, sliderMin: 0, sliderMax: 3000, step: 20 },
  normalX: { label: 'Normal X', defaultMin: -1, defaultMax: 1, sliderMin: -1, sliderMax: 1, step: 0.05 },
  normalY: { label: 'Normal Y', defaultMin: -1, defaultMax: 1, sliderMin: -1, sliderMax: 1, step: 0.05 },
  normalZ: { label: 'Normal Z', defaultMin: -1, defaultMax: 1, sliderMin: -1, sliderMax: 1, step: 0.05 },
  carIndex: { label: 'Car Index', defaultMin: 0, defaultMax: 4, sliderMin: 0, sliderMax: 10, step: 1 },
  tick: { label: 'Tick Delta', defaultMin: 0, defaultMax: 120, sliderMin: 0, sliderMax: 300, step: 1 },
  hitInterval: { label: 'Hit Interval (ms)', defaultMin: 0, defaultMax: 150, sliderMin: 0, sliderMax: 300, step: 1 }
});

export class EventOscilloscopeHUD {
  /**
   * @param {HTMLElement} container - Parent container (e.g. document.body or #app)
   * @param {Object} options - Custom configuration options
   */
  constructor(container = (typeof document !== 'undefined' ? document.body : null), options = {}) {
    this.container = container;
    this.options = options;

    // State
    this.visible = false;
    this.minimized = false;
    this.controlsCollapsed = false;
    this.currentParam = 'impulse';
    this.timeWindow = 5.0; // seconds
    this.minY = 0;
    this.maxY = 1000;
    this.threshold = 0;
    this.cooldownMs = 40; // milliseconds
    this.pointRadius = 5; // pixels
    this.opacity = 0.88; // 88%

    // Event history buffer: array of { timestamp: number, value: number, event: Object }
    this.history = [];
    this.maxHistoryRetentionMs = 60000; // keep up to 60s in memory

    // DOM Elements
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.rafId = 0;

    // Pointer Drag & Resize State
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.windowStartX = 0;
    this.windowStartY = 0;

    this.isResizing = false;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.windowStartW = 0;
    this.windowStartH = 0;

    // Bound listeners for cleanup
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onAudioSettingsChanged = this._handleAudioSettingsChanged.bind(this);

    this._initThresholdFromAudio();
    this._initDom();
    this._bindEvents();
  }

  _initThresholdFromAudio() {
    try {
      const audioSettings = getAudioSettings();
      if (audioSettings) {
        if (Number.isFinite(audioSettings.carBallHitImpulseThreshold)) {
          this.threshold = audioSettings.carBallHitImpulseThreshold;
        }
        if (Number.isFinite(audioSettings.carBallHitCooldownMs)) {
          this.cooldownMs = audioSettings.carBallHitCooldownMs;
        }
      }
    } catch (e) {}
  }

  _initDom() {
    if (!this.container || typeof document === 'undefined') return;

    // Inject styles once
    if (!document.getElementById('event-oscilloscope-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'event-oscilloscope-styles';
      styleEl.textContent = `
        .event-oscilloscope {
          position: fixed;
          top: 70px;
          right: 24px;
          width: 440px;
          height: 380px;
          min-width: 320px;
          min-height: 220px;
          z-index: 105;
          display: flex;
          flex-direction: column;
          background: rgba(11, 19, 36, 0.88);
          border: 2px solid rgba(88, 140, 220, 0.5);
          border-radius: 8px;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          color: #e2e8f0;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
          box-sizing: border-box;
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .event-oscilloscope:hover {
          border-color: rgba(99, 160, 255, 0.8);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.15);
        }
        .event-oscilloscope.is-minimized {
          height: 38px !important;
          min-height: 38px !important;
          resize: none !important;
        }
        .event-oscilloscope[hidden] {
          display: none !important;
        }
        .scope-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(18, 30, 56, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          cursor: move;
          flex-shrink: 0;
          height: 38px;
          box-sizing: border-box;
        }
        .scope-header__left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .scope-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e;
          flex-shrink: 0;
        }
        .scope-title {
          font-family: var(--display, inherit);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .scope-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(56, 189, 248, 0.2);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.35);
        }
        .scope-header__actions {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }
        .scope-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 24px;
          padding: 0 7px;
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.12s, color 0.12s;
        }
        .scope-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }
        .scope-btn:active {
          transform: translateY(1px);
        }
        .scope-btn--sync {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.35);
        }
        .scope-btn--sync:hover {
          background: rgba(245, 158, 11, 0.3);
          color: #fef08a;
        }
        .scope-btn--close {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .scope-btn--close:hover {
          background: rgba(239, 68, 68, 0.3);
          color: #fee2e2;
        }
        .scope-controls {
          padding: 8px 12px;
          background: rgba(14, 23, 42, 0.9);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: grid;
          gap: 6px;
          font-size: 11px;
          flex-shrink: 0;
        }
        .scope-controls[hidden] {
          display: none !important;
        }
        .scope-grid-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          align-items: center;
        }
        .scope-control-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .scope-control-item label {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .scope-control-item label span.val-badge {
          color: #38bdf8;
          font-variant-numeric: tabular-nums;
        }
        .scope-dual-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .scope-slider {
          flex: 1;
          height: 16px;
          cursor: pointer;
          accent-color: #38bdf8;
        }
        .scope-input-num {
          width: 62px;
          height: 22px;
          padding: 1px 4px;
          font-size: 11px;
          font-family: inherit;
          color: #f1f5f9;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .scope-input-num:focus {
          outline: none;
          border-color: #38bdf8;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
        }
        .scope-select {
          width: 100%;
          height: 24px;
          padding: 0 6px;
          font-size: 11px;
          font-family: inherit;
          color: #f1f5f9;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          cursor: pointer;
        }
        .scope-select:focus {
          outline: none;
          border-color: #38bdf8;
        }
        .scope-chart-area {
          flex: 1;
          position: relative;
          min-height: 100px;
          overflow: hidden;
          background: radial-gradient(circle at center, rgba(15, 23, 42, 0.4) 0%, rgba(8, 12, 22, 0.9) 100%);
        }
        .scope-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        .scope-corner-handle {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 14px;
          height: 14px;
          cursor: se-resize;
          z-index: 10;
          background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.7) 70%, transparent 70%, transparent 80%, rgba(255, 255, 255, 0.4) 80%);
        }
      `;
      document.head.appendChild(styleEl);
    }

    const root = document.createElement('div');
    root.id = 'hud-event-oscilloscope';
    root.className = 'event-oscilloscope';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Physics Event Oscilloscope');
    root.hidden = true;

    root.innerHTML = `
      <div class="scope-header" data-el="header">
        <div class="scope-header__left">
          <span class="scope-status-dot" data-el="statusDot" title="Live Event Feed Active"></span>
          <span class="scope-title">Physics Oscilloscope</span>
          <span class="scope-badge" data-el="eventCount">0 hits</span>
        </div>
        <div class="scope-header__actions">
          <button class="scope-btn scope-btn--sync" data-el="btnSyncAudio" title="Sync Threshold to Audio Engine">Sync Audio</button>
          <button class="scope-btn" data-el="btnToggleControls" title="Toggle Control Sliders">⚙</button>
          <button class="scope-btn" data-el="btnMinimize" title="Minimize / Expand Window">_</button>
          <button class="scope-btn scope-btn--close" data-el="btnClose" title="Close">✕</button>
        </div>
      </div>

      <div class="scope-controls" data-el="controls">
        <div class="scope-grid-row">
          <div class="scope-control-item">
            <label for="scope-param">Parameter</label>
            <select id="scope-param" class="scope-select" data-el="paramSelect">
              <option value="impulse">Impulse (Collision Force)</option>
              <option value="relSpeed">Relative Speed</option>
              <option value="x">Hit Coordinate X</option>
              <option value="y">Hit Coordinate Y</option>
              <option value="z">Hit Coordinate Z</option>
              <option value="normalX">Contact Normal X</option>
              <option value="normalY">Contact Normal Y</option>
              <option value="normalZ">Contact Normal Z</option>
              <option value="carIndex">Car Index</option>
              <option value="tick">Physics Tick Delta</option>
              <option value="hitInterval">Hit Interval (Debounce ms)</option>
            </select>
          </div>
          <div class="scope-control-item">
            <label>Opacity <span class="val-badge" data-el="opacityVal">88%</span></label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="20" max="100" step="1" value="88" data-el="opacitySlider" />
              <input type="number" class="scope-input-num" min="20" max="100" step="1" value="88" data-el="opacityInput" />
            </div>
          </div>
        </div>

        <div class="scope-grid-row">
          <div class="scope-control-item">
            <label>Time Window <span class="val-badge" data-el="timeVal">5.0s</span></label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="0.5" max="5.0" step="0.1" value="5.0" data-el="timeSlider" />
              <input type="number" class="scope-input-num" min="0.1" step="0.1" value="5.0" data-el="timeInput" />
            </div>
          </div>
          <div class="scope-control-item">
            <label>Point Radius <span class="val-badge" data-el="radiusVal">5px</span></label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="1" max="25" step="0.5" value="5" data-el="radiusSlider" />
              <input type="number" class="scope-input-num" min="1" max="50" step="0.5" value="5" data-el="radiusInput" />
            </div>
          </div>
        </div>

        <div class="scope-grid-row">
          <div class="scope-control-item">
            <label>Upper Bound (Max Y)</label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="10" max="2000" step="10" value="1000" data-el="maxSlider" />
              <input type="number" class="scope-input-num" step="any" value="1000" data-el="maxInput" />
            </div>
          </div>
          <div class="scope-control-item">
            <label>Lower Bound (Min Y)</label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="0" max="1000" step="10" value="0" data-el="minSlider" />
              <input type="number" class="scope-input-num" step="any" value="0" data-el="minInput" />
            </div>
          </div>
        </div>

        <div class="scope-grid-row">
          <div class="scope-control-item">
            <label>Threshold (参考阈值) <span class="val-badge" data-el="thresholdVal">0</span></label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="0" max="1000" step="5" value="0" data-el="thresholdSlider" />
              <input type="number" class="scope-input-num" step="any" value="0" data-el="thresholdInput" />
            </div>
          </div>
          <div class="scope-control-item">
            <label>Audio Cooldown (防抖) <span class="val-badge" data-el="cooldownVal">40ms</span></label>
            <div class="scope-dual-box">
              <input type="range" class="scope-slider" min="0" max="100" step="1" value="40" data-el="cooldownSlider" />
              <input type="number" class="scope-input-num" min="0" max="100" step="1" value="40" data-el="cooldownInput" />
            </div>
          </div>
        </div>
      </div>

      <div class="scope-chart-area" data-el="chartArea">
        <canvas class="scope-canvas" data-el="canvas"></canvas>
        <div class="scope-corner-handle" data-el="resizeHandle" title="Drag to resize"></div>
      </div>
    `;

    this.root = root;
    this.container.appendChild(root);

    this.canvas = root.querySelector('[data-el="canvas"]');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this._applyOpacity(this.opacity);
  }

  _bindEvents() {
    if (!this.root || typeof window === 'undefined') return;

    const query = (selector) => this.root.querySelector(selector);

    // Prevent key and mouse propagation into car controls
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('keydown', (e) => e.stopPropagation());
    this.root.addEventListener('keyup', (e) => e.stopPropagation());

    // Header buttons
    query('[data-el="btnClose"]')?.addEventListener('click', () => this.hide());
    query('[data-el="btnMinimize"]')?.addEventListener('click', () => this.toggleMinimize());
    query('[data-el="btnToggleControls"]')?.addEventListener('click', () => this.toggleControls());
    query('[data-el="btnSyncAudio"]')?.addEventListener('click', () => this.syncThresholdToAudio());

    // Window Dragging via Header
    const header = query('[data-el="header"]');
    if (header) {
      header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const rect = this.root.getBoundingClientRect();
        this.windowStartX = rect.left;
        this.windowStartY = rect.top;
        header.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
      });
    }

    // Window Resizing via Corner Handle
    const cornerHandle = query('[data-el="resizeHandle"]');
    if (cornerHandle) {
      cornerHandle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        const rect = this.root.getBoundingClientRect();
        this.windowStartW = rect.width;
        this.windowStartH = rect.height;
        cornerHandle.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
      });
    }

    // Parameter Selector
    const paramSelect = query('[data-el="paramSelect"]');
    paramSelect?.addEventListener('change', () => {
      this.setParameter(paramSelect.value);
    });

    // Dual-input helper for slider + numeric input with bound breakthrough
    const setupDualInput = (sliderEl, inputEl, valBadgeEl, onUpdate) => {
      if (!sliderEl || !inputEl) return;

      sliderEl.addEventListener('input', () => {
        const val = parseFloat(sliderEl.value);
        inputEl.value = String(val);
        if (valBadgeEl) valBadgeEl.textContent = `${val}`;
        onUpdate(val);
      });

      const handleManualInput = () => {
        const val = parseFloat(inputEl.value);
        if (!Number.isFinite(val)) return;

        // Dynamic breakthrough expansion
        if (val > parseFloat(sliderEl.max)) {
          sliderEl.max = String(Math.ceil(val * 1.2));
        }
        if (val < parseFloat(sliderEl.min)) {
          sliderEl.min = String(Math.floor(val * 0.8));
        }

        sliderEl.value = String(val);
        if (valBadgeEl) valBadgeEl.textContent = `${val}`;
        onUpdate(val);
      };

      inputEl.addEventListener('input', handleManualInput);
      inputEl.addEventListener('change', handleManualInput);
    };

    // 1. Time Window: default up to 5.0s, manual input breaks through
    const timeSlider = query('[data-el="timeSlider"]');
    const timeInput = query('[data-el="timeInput"]');
    const timeVal = query('[data-el="timeVal"]');
    setupDualInput(timeSlider, timeInput, timeVal, (v) => {
      this.timeWindow = Math.max(0.1, v);
      if (timeVal) timeVal.textContent = `${this.timeWindow.toFixed(1)}s`;
    });

    // 2. Point Radius
    const radiusSlider = query('[data-el="radiusSlider"]');
    const radiusInput = query('[data-el="radiusInput"]');
    const radiusVal = query('[data-el="radiusVal"]');
    setupDualInput(radiusSlider, radiusInput, radiusVal, (v) => {
      this.pointRadius = Math.max(0.5, v);
      if (radiusVal) radiusVal.textContent = `${this.pointRadius}px`;
    });

    // 3. Upper Bound (Max Y)
    const maxSlider = query('[data-el="maxSlider"]');
    const maxInput = query('[data-el="maxInput"]');
    setupDualInput(maxSlider, maxInput, null, (v) => {
      this.maxY = v;
      if (this.maxY <= this.minY) {
        this.maxY = this.minY + 1;
        maxInput.value = String(this.maxY);
      }
      this._syncThresholdSliderRange();
    });

    // 4. Lower Bound (Min Y)
    const minSlider = query('[data-el="minSlider"]');
    const minInput = query('[data-el="minInput"]');
    setupDualInput(minSlider, minInput, null, (v) => {
      this.minY = v;
      if (this.minY >= this.maxY) {
        this.minY = this.maxY - 1;
        minInput.value = String(this.minY);
      }
      this._syncThresholdSliderRange();
    });

    // 5. Threshold
    const threshSlider = query('[data-el="thresholdSlider"]');
    const threshInput = query('[data-el="thresholdInput"]');
    const threshVal = query('[data-el="thresholdVal"]');
    setupDualInput(threshSlider, threshInput, threshVal, (v) => {
      this.threshold = v;
      if (threshVal) threshVal.textContent = String(v);
      if (this.currentParam === 'impulse') {
        try {
          setCarBallHitImpulseThreshold(v);
        } catch (e) {}
      }
    });

    // 5b. Hit Audio Cooldown (0-100ms)
    const cooldownSlider = query('[data-el="cooldownSlider"]');
    const cooldownInput = query('[data-el="cooldownInput"]');
    const cooldownVal = query('[data-el="cooldownVal"]');
    setupDualInput(cooldownSlider, cooldownInput, cooldownVal, (v) => {
      this.cooldownMs = Math.min(100, Math.max(0, Math.round(v)));
      if (cooldownVal) cooldownVal.textContent = `${this.cooldownMs}ms`;
      try {
        setCarBallHitCooldownMs(this.cooldownMs);
      } catch (e) {}
    });

    // 6. Opacity
    const opSlider = query('[data-el="opacitySlider"]');
    const opInput = query('[data-el="opacityInput"]');
    const opVal = query('[data-el="opacityVal"]');
    setupDualInput(opSlider, opInput, opVal, (v) => {
      const alpha = Math.max(0.2, Math.min(1.0, v / 100));
      this.opacity = alpha;
      this._applyOpacity(alpha);
      if (opVal) opVal.textContent = `${Math.round(alpha * 100)}%`;
    });

    // Listen to external audio settings changes
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, this._onAudioSettingsChanged);

    // Observe canvas resizing
    if (typeof ResizeObserver !== 'undefined' && this.canvas) {
      this.resizeObserver = new ResizeObserver(() => this._resizeCanvas());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  _handlePointerMove(e) {
    if (this.isDragging && this.root) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const rect = this.root.getBoundingClientRect();

      let targetX = this.windowStartX + dx;
      let targetY = this.windowStartY + dy;

      targetX = Math.max(0, Math.min(winW - rect.width, targetX));
      targetY = Math.max(0, Math.min(winH - 40, targetY));

      this.root.style.left = `${targetX}px`;
      this.root.style.top = `${targetY}px`;
      this.root.style.right = 'auto';
    } else if (this.isResizing && this.root) {
      const dw = e.clientX - this.resizeStartX;
      const dh = e.clientY - this.resizeStartY;
      const newW = Math.max(280, this.windowStartW + dw);
      const newH = Math.max(200, this.windowStartH + dh);

      this.root.style.width = `${newW}px`;
      this.root.style.height = `${newH}px`;
      this._resizeCanvas();
    }
  }

  _handlePointerUp() {
    this.isDragging = false;
    this.isResizing = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
    }
  }

  _handleAudioSettingsChanged() {
    try {
      const audioSettings = getAudioSettings();
      if (!audioSettings) return;

      if (this.currentParam === 'impulse' && Number.isFinite(audioSettings.carBallHitImpulseThreshold)) {
        const val = audioSettings.carBallHitImpulseThreshold;
        if (this.threshold !== val) {
          this.threshold = val;
          const threshInput = this.root?.querySelector('[data-el="thresholdInput"]');
          const threshSlider = this.root?.querySelector('[data-el="thresholdSlider"]');
          const threshVal = this.root?.querySelector('[data-el="thresholdVal"]');
          if (threshInput) threshInput.value = String(val);
          if (threshSlider) threshSlider.value = String(val);
          if (threshVal) threshVal.textContent = String(val);
        }
      }

      if (Number.isFinite(audioSettings.carBallHitCooldownMs)) {
        const cd = audioSettings.carBallHitCooldownMs;
        if (this.cooldownMs !== cd) {
          this.cooldownMs = cd;
          const cdInput = this.root?.querySelector('[data-el="cooldownInput"]');
          const cdSlider = this.root?.querySelector('[data-el="cooldownSlider"]');
          const cdVal = this.root?.querySelector('[data-el="cooldownVal"]');
          if (cdInput) cdInput.value = String(cd);
          if (cdSlider) cdSlider.value = String(cd);
          if (cdVal) cdVal.textContent = `${cd}ms`;
        }
      }
    } catch (e) {}
  }

  _applyOpacity(alpha) {
    if (!this.root) return;
    this.root.style.backgroundColor = `rgba(11, 19, 36, ${alpha})`;
    this.root.style.backdropFilter = `blur(${Math.round(alpha * 12)}px)`;
    this.root.style.webkitBackdropFilter = `blur(${Math.round(alpha * 12)}px)`;
  }

  _syncThresholdSliderRange() {
    const threshSlider = this.root?.querySelector('[data-el="thresholdSlider"]');
    if (threshSlider) {
      threshSlider.min = String(this.minY);
      threshSlider.max = String(this.maxY);
    }
  }

  setParameter(param) {
    if (!PARAM_PRESETS[param]) return;
    this.currentParam = param;
    const preset = PARAM_PRESETS[param];

    this.minY = preset.defaultMin;
    this.maxY = preset.defaultMax;

    // Update controls
    const minInput = this.root?.querySelector('[data-el="minInput"]');
    const minSlider = this.root?.querySelector('[data-el="minSlider"]');
    const maxInput = this.root?.querySelector('[data-el="maxInput"]');
    const maxSlider = this.root?.querySelector('[data-el="maxSlider"]');
    const threshSlider = this.root?.querySelector('[data-el="thresholdSlider"]');
    const threshInput = this.root?.querySelector('[data-el="thresholdInput"]');

    if (minSlider) {
      minSlider.min = String(preset.sliderMin);
      minSlider.max = String(preset.sliderMax);
      minSlider.step = String(preset.step);
      minSlider.value = String(this.minY);
    }
    if (minInput) minInput.value = String(this.minY);

    if (maxSlider) {
      maxSlider.min = String(preset.sliderMin);
      maxSlider.max = String(preset.sliderMax);
      maxSlider.step = String(preset.step);
      maxSlider.value = String(this.maxY);
    }
    if (maxInput) maxInput.value = String(this.maxY);

    if (threshSlider) {
      threshSlider.min = String(this.minY);
      threshSlider.max = String(this.maxY);
      threshSlider.step = String(preset.step);
    }

    if (param === 'impulse') {
      this._initThresholdFromAudio();
      if (threshInput) threshInput.value = String(this.threshold);
      if (threshSlider) threshSlider.value = String(this.threshold);
    }
  }

  syncThresholdToAudio() {
    try {
      setCarBallHitImpulseThreshold(this.threshold);
      const btn = this.root?.querySelector('[data-el="btnSyncAudio"]');
      if (btn) {
        const origText = btn.textContent;
        btn.textContent = 'Synced!';
        setTimeout(() => { if (btn) btn.textContent = origText; }, 1200);
      }
    } catch (e) {}
  }

  toggleMinimize() {
    this.minimized = !this.minimized;
    if (this.root) {
      this.root.classList.toggle('is-minimized', this.minimized);
      const btn = this.root.querySelector('[data-el="btnMinimize"]');
      if (btn) btn.textContent = this.minimized ? '□' : '_';
    }
  }

  toggleControls() {
    this.controlsCollapsed = !this.controlsCollapsed;
    const controls = this.root?.querySelector('[data-el="controls"]');
    if (controls) {
      controls.hidden = this.controlsCollapsed;
    }
  }

  show() {
    this.visible = true;
    if (this.root) {
      this.root.hidden = false;
      this._resizeCanvas();
    }
  }

  hide() {
    this.visible = false;
    if (this.root) {
      this.root.hidden = true;
    }
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Adds a physics collision event to the oscilloscope data stream.
   * @param {Object} event PhysicsEvent object from RocketSim ring buffer
   */
  addEvent(event) {
    if (!event) return;

    const now = performance.now();
    const prevItem = this.history[this.history.length - 1];
    const hitInterval = prevItem ? Math.min(1000, Math.round(now - prevItem.timestamp)) : 100;
    const clonedEvent = { ...event, hitInterval, rejectedByCooldown: (hitInterval < this.cooldownMs) };

    this.history.push({
      timestamp: now,
      event: clonedEvent
    });

    // Prune stale history
    const cutoff = now - this.maxHistoryRetentionMs;
    while (this.history.length > 0 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }

    // Flash live feed dot
    const dot = this.root?.querySelector('[data-el="statusDot"]');
    if (dot) {
      dot.style.boxShadow = '0 0 12px #38bdf8';
      dot.style.backgroundColor = '#38bdf8';
      setTimeout(() => {
        if (dot) {
          dot.style.boxShadow = '0 0 6px #22c55e';
          dot.style.backgroundColor = '#22c55e';
        }
      }, 150);
    }
  }

  _resizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /**
   * Renders the real-time oscilloscope chart.
   * Called each frame in GameRuntime loop.
   */
  update() {
    if (!this.visible || this.minimized || !this.ctx || !this.canvas) return;

    const now = performance.now();
    const windowMs = this.timeWindow * 1000;
    const cutoff = now - windowMs;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    if (w <= 0 || h <= 0) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Margins
    const padL = 46;
    const padR = 16;
    const padT = 16;
    const padB = 26;

    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);

    const minY = this.minY;
    const maxY = this.maxY;
    const rangeY = Math.max(0.0001, maxY - minY);

    // 1. Plot Background
    ctx.fillStyle = 'rgba(7, 12, 22, 0.7)';
    ctx.fillRect(padL, padT, plotW, plotH);

    // 2. Horizontal Grid & Y-Axis Labels
    const numYDivisions = 4;
    ctx.font = '10px tabular-nums, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= numYDivisions; i++) {
      const frac = i / numYDivisions;
      const yVal = minY + (1 - frac) * rangeY;
      const py = padT + frac * plotH;

      // Grid line
      ctx.beginPath();
      ctx.strokeStyle = i === 0 || i === numYDivisions ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#94a3b8';
      const labelText = Math.abs(yVal) >= 100 ? yVal.toFixed(0) : yVal.toFixed(1);
      ctx.fillText(labelText, padL - 6, py);
    }

    // 3. Vertical Grid & Time Labels (-timeWindow to 0s)
    const timeStepSec = this.timeWindow <= 2 ? 0.5 : this.timeWindow <= 5 ? 1.0 : 2.0;
    const totalSteps = Math.floor(this.timeWindow / timeStepSec);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let s = 0; s <= totalSteps; s++) {
      const secOffset = s * timeStepSec;
      const frac = 1 - (secOffset / this.timeWindow);
      const px = padL + frac * plotW;

      ctx.beginPath();
      ctx.strokeStyle = s === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = s === 0 ? '#38bdf8' : '#64748b';
      const label = s === 0 ? 'NOW' : `-${secOffset.toFixed(1)}s`;
      ctx.fillText(label, px, padT + plotH + 6);
    }

    // 4. Threshold Line (Reference Line)
    if (this.threshold >= minY && this.threshold <= maxY) {
      const threshFrac = (this.threshold - minY) / rangeY;
      const ty = padT + (1 - threshFrac) * plotH;

      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(padL, ty);
      ctx.lineTo(padL + plotW, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Threshold Label
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 9.5px tabular-nums, sans-serif';
      ctx.fillText(`Threshold: ${this.threshold.toFixed(1)}`, padL + 6, ty - 3);
    }

    // 5. Render Discrete Points (NO Connecting Lines)
    // Filter active points within [now - windowMs, now]
    let activePointsCount = 0;
    const radius = this.pointRadius;
    const param = this.currentParam;

    ctx.save();
    // Clip to plot rect so oversized points don't bleed out of bounds
    ctx.beginPath();
    ctx.rect(padL, padT - radius, plotW, plotH + radius * 2);
    ctx.clip();

    for (let i = 0; i < this.history.length; i++) {
      const item = this.history[i];
      if (item.timestamp < cutoff) continue;
      activePointsCount++;

      // Compute value for current parameter
      const val = Number(item.event[param] ?? 0);
      const timeFrac = (item.timestamp - cutoff) / windowMs; // 0 = oldest, 1 = right now
      const px = padL + timeFrac * plotW;

      const yFrac = (val - minY) / rangeY;
      const py = padT + (1 - yFrac) * plotH;

      // Render individual single point (Circle)
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);

      const meetsThreshold = val >= this.threshold;
      ctx.fillStyle = meetsThreshold ? '#38bdf8' : '#fb7185';
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    // 6. Update badge count
    const countBadge = this.root?.querySelector('[data-el="eventCount"]');
    if (countBadge) {
      countBadge.textContent = `${activePointsCount} hits`;
    }

    ctx.restore();
  }

  destroy() {
    this.hide();
    if (typeof window !== 'undefined') {
      window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, this._onAudioSettingsChanged);
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.root?.remove();
    this.root = null;
    this.history = [];
  }
}
