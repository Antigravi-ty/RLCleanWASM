/**
 * BallTrajectoryPredictorHUD.js
 * Standalone UI menu, floating control panel, and HUD toolbar integration
 * for the Ball Trajectory Predictor subsystem.
 */

import { renderIcon } from "./Icons.js";
import {
  DEFAULT_TRAJECTORY_SETTINGS,
  loadSavedTrajectorySettings,
  saveTrajectorySettings
} from "../entities/BallTrajectoryPredictor.js";

export class BallTrajectoryPredictorHUD {
  /**
   * @param {HTMLElement} container - DOM container (e.g. #app or document.body)
   * @param {Object} options
   * @param {import("../entities/BallTrajectoryPredictor.js").BallTrajectoryPredictor} options.predictor
   * @param {Object} options.physics - RocketSimPhysicsEngine instance
   * @param {Function} [options.onOverlayChange] - (name, isOpen) => void
   */
  constructor(container, options = {}) {
    this.container = container;
    this.predictor = options.predictor;
    this.physics = options.physics;
    this.onOverlayChange = options.onOverlayChange;

    this.settings = { ...loadSavedTrajectorySettings() };
    this.isOpen = false;
    this.dragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

    this.initDOM();
    this.bindEvents();
    this.syncFormValues();
  }

  initDOM() {
    // 1. Inject trigger button into .hud-tools
    const hudTools = this.container.querySelector(".hud-tools");
    const triggerBtnHtml = `
      <button id="trajectory-button" class="hud-tool" type="button"
              aria-label="Toggle Ball Trajectory Predictor Menu" title="Ball Trajectory Predictor (P)">
        <span data-el="trajectoryIcon">${renderIcon("trajectory", 22)}</span>
      </button>
    `;

    if (hudTools) {
      const settingsBtn = hudTools.querySelector("#settings-button");
      if (settingsBtn) {
        settingsBtn.insertAdjacentHTML("beforebegin", triggerBtnHtml);
      } else {
        hudTools.insertAdjacentHTML("beforeend", triggerBtnHtml);
      }
    } else {
      this.container.insertAdjacentHTML("beforeend", `<div class="hud-tools">${triggerBtnHtml}</div>`);
    }

    this.triggerBtn = this.container.querySelector("#trajectory-button");

    // 2. Inject floating modal dialog overlay
    const overlayHtml = `
      <div id="trajectory-overlay" class="trajectory-overlay" hidden aria-hidden="true">
        <section id="trajectory-dialog" class="trajectory-panel" role="dialog" aria-modal="false" aria-labelledby="trajectory-title" tabindex="-1">
          <header class="trajectory-panel__head" data-drag-handle>
            <div class="trajectory-panel__ident">
              <span class="trajectory-panel__icon">${renderIcon("trajectory", 24)}</span>
              <h2 id="trajectory-title">Ball Trajectory Predictor</h2>
              <span class="trajectory-status-badge" data-status-badge>Active</span>
            </div>
            <div class="trajectory-panel__head-actions">
              <button class="trajectory-panel__close" type="button" data-action="close" aria-label="Close menu">
                ${renderIcon("x", 20)}
              </button>
            </div>
          </header>

          <div class="trajectory-panel__body">
            <!-- Master Toggle -->
            <div class="trajectory-field trajectory-field--toggle">
              <label class="trajectory-toggle-label" for="traj-enabled">
                <input type="checkbox" id="traj-enabled" class="trajectory-checkbox" ${this.settings.enabled ? "checked" : ""} />
                <span class="trajectory-toggle-text">
                  <strong>Enable Ball Trajectory Predictor</strong>
                  <small>Predicts 3D ball path using RocketSim physics (linear velocity >= 250 UU/s, deviation > 5 UU)</small>
                </span>
              </label>
            </div>

            <!-- Trajectory Mode Selector -->
            <div class="trajectory-field trajectory-field--mode">
              <label class="trajectory-toggle-label" for="traj-dynamic-mode">
                <input type="checkbox" id="traj-dynamic-mode" class="trajectory-checkbox" ${this.settings.dynamicMode ? "checked" : ""} />
                <span class="trajectory-toggle-text">
                  <strong data-mode-label>${this.settings.dynamicMode ? "Dynamic Pattern (Ball Pushes Line)" : "Static Pattern (Ball Follows Line)"}</strong>
                  <small data-mode-desc>${this.settings.dynamicMode ? "Dashed segments flow forward dynamically with the ball" : "Trajectory line remains stationary as the ball travels along it"}</small>
                </span>
              </label>
            </div>

            <hr class="trajectory-divider" />

            <!-- Prediction Distance Slider -->
            <div class="trajectory-control-group">
              <div class="trajectory-control-header">
                <label for="traj-dist-slider">Prediction Distance</label>
                <div class="trajectory-control-readout">
                  <span class="trajectory-badge" data-readout="distance">${this.settings.predictionTicks} ticks (${(this.settings.predictionTicks / 120).toFixed(2)}s)</span>
                  <input type="number" id="traj-dist-num" min="60" max="600" step="1" value="${this.settings.predictionTicks}" class="trajectory-num-input" />
                </div>
              </div>
              <input type="range" id="traj-dist-slider" min="60" max="600" step="1" value="${this.settings.predictionTicks}" class="trajectory-slider" />
              <div class="trajectory-slider-range-hint"><span>60 ticks (0.5s)</span><span>600 ticks (5.0s max)</span></div>
            </div>

            <!-- Solid Segment Slider -->
            <div class="trajectory-control-group">
              <div class="trajectory-control-header">
                <label for="traj-solid-slider">Solid Line Duration</label>
                <div class="trajectory-control-readout">
                  <span class="trajectory-badge" data-readout="solid">${this.settings.solidTicks} ticks (${(this.settings.solidTicks / 120 * 1000).toFixed(0)}ms)</span>
                  <input type="number" id="traj-solid-num" min="5" max="240" step="1" value="${this.settings.solidTicks}" class="trajectory-num-input" />
                </div>
              </div>
              <input type="range" id="traj-solid-slider" min="5" max="240" step="1" value="${this.settings.solidTicks}" class="trajectory-slider" />
              <div class="trajectory-slider-range-hint"><span>5 ticks (min)</span><span>240 ticks (max)</span></div>
            </div>

            <!-- Transparent Gap Slider -->
            <div class="trajectory-control-group">
              <div class="trajectory-control-header">
                <label for="traj-trans-slider">Transparent Gap Duration</label>
                <div class="trajectory-control-readout">
                  <span class="trajectory-badge" data-readout="transparent">${this.settings.transparentTicks} ticks (${(this.settings.transparentTicks / 120 * 1000).toFixed(0)}ms)</span>
                  <input type="number" id="traj-trans-num" min="5" max="240" step="1" value="${this.settings.transparentTicks}" class="trajectory-num-input" />
                </div>
              </div>
              <input type="range" id="traj-trans-slider" min="5" max="240" step="1" value="${this.settings.transparentTicks}" class="trajectory-slider" />
              <div class="trajectory-slider-range-hint"><span>5 ticks (min)</span><span>240 ticks (max)</span></div>
              <div class="trajectory-cycle-summary" data-cycle-summary>
                Cycle: ${this.settings.solidTicks + this.settings.transparentTicks} ticks (${Math.round(this.settings.solidTicks / (this.settings.solidTicks + this.settings.transparentTicks) * 100)}% solid)
              </div>
            </div>

            <hr class="trajectory-divider" />

            <!-- Line Thickness & Opacity (Side-by-side) -->
            <div class="trajectory-row">
              <div class="trajectory-control-group" style="flex:1;">
                <div class="trajectory-control-header">
                  <label for="traj-thickness-slider">Thickness (% of Ball Diameter)</label>
                  <div class="trajectory-control-readout">
                    <span class="trajectory-badge" data-readout="thickness">${this.settings.thickness}%</span>
                    <input type="number" id="traj-thickness-num" min="1" max="75" step="1" value="${this.settings.thickness}" class="trajectory-num-input" />
                  </div>
                </div>
                <input type="range" id="traj-thickness-slider" min="1" max="75" step="1" value="${this.settings.thickness}" class="trajectory-slider" />
                <div class="trajectory-slider-range-hint"><span>1%</span><span>75% (max)</span></div>
              </div>

              <div class="trajectory-control-group" style="flex:1;">
                <div class="trajectory-control-header">
                  <label for="traj-opacity-slider">Opacity</label>
                  <input type="number" id="traj-opacity-num" min="0.05" max="1.0" step="0.05" value="${this.settings.opacity}" class="trajectory-num-input" />
                </div>
                <input type="range" id="traj-opacity-slider" min="0.05" max="1.0" step="0.05" value="${this.settings.opacity}" class="trajectory-slider" />
                <div class="trajectory-slider-range-hint"><span>5%</span><span>100%</span></div>
              </div>
            </div>

            <!-- Line Color & Presets -->
            <div class="trajectory-control-group">
              <div class="trajectory-control-header">
                <label for="traj-color-picker">Line Color</label>
                <div class="trajectory-color-wrapper">
                  <input type="color" id="traj-color-picker" value="${this.settings.color}" class="trajectory-color-picker" />
                  <span class="trajectory-color-code" data-color-code>${this.settings.color}</span>
                </div>
              </div>
              <div class="trajectory-color-swatches">
                <button type="button" class="trajectory-swatch" data-color="#000000" style="background:#000000;border:1px solid rgba(255,255,255,0.4);" title="Pure Black"></button>
                <button type="button" class="trajectory-swatch" data-color="#00f0ff" style="background:#00f0ff;" title="Electric Cyan"></button>
                <button type="button" class="trajectory-swatch" data-color="#39ff14" style="background:#39ff14;" title="Neon Lime"></button>
                <button type="button" class="trajectory-swatch" data-color="#fbbf24" style="background:#fbbf24;" title="Golden Amber"></button>
                <button type="button" class="trajectory-swatch" data-color="#f97316" style="background:#f97316;" title="Vibrant Orange"></button>
                <button type="button" class="trajectory-swatch" data-color="#ec4899" style="background:#ec4899;" title="Hot Pink"></button>
                <button type="button" class="trajectory-swatch" data-color="#ffffff" style="background:#ffffff;" title="Pure White"></button>
              </div>
            </div>

            <hr class="trajectory-divider" />

            <!-- Action Buttons -->
            <div class="trajectory-actions">
              <button type="button" class="trajectory-btn trajectory-btn--primary" data-action="test-predict">
                <span>🎯 Trigger Test Now</span>
              </button>
              <button type="button" class="trajectory-btn trajectory-btn--secondary" data-action="reset-defaults">
                <span>🔄 Reset Defaults</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    `;

    this.container.insertAdjacentHTML("beforeend", overlayHtml);
    this.overlay = this.container.querySelector("#trajectory-overlay");
    this.dialog = this.container.querySelector("#trajectory-dialog");

    // Inject Stylesheet
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById("trajectory-predictor-styles")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "trajectory-predictor-styles";
    styleEl.textContent = `
      .trajectory-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        pointer-events: none;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        padding: max(72px, var(--safe-top, 24px)) max(24px, var(--safe-right, 24px)) 24px;
        box-sizing: border-box;
      }
      .trajectory-overlay[hidden] {
        display: none !important;
      }
      .trajectory-panel {
        pointer-events: auto;
        width: 380px;
        max-width: calc(100vw - 32px);
        background: rgba(12, 18, 32, 0.92);
        border: 1.5px solid rgba(56, 189, 248, 0.4);
        border-radius: 12px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: #e2e8f0;
        font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        font-size: 13px;
        overflow: hidden;
        user-select: none;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .trajectory-panel:focus-within {
        border-color: rgba(56, 189, 248, 0.8);
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.25);
      }
      .trajectory-panel__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: rgba(18, 28, 48, 0.95);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        cursor: move;
        flex-shrink: 0;
      }
      .trajectory-panel__ident {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .trajectory-panel__icon {
        color: #38bdf8;
        display: flex;
        align-items: center;
      }
      .trajectory-panel__ident h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #f8fafc;
        white-space: nowrap;
      }
      .trajectory-status-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .trajectory-status-badge.is-disabled {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
        border-color: rgba(239, 68, 68, 0.4);
      }
      .trajectory-panel__close {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .trajectory-panel__close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .trajectory-panel__body {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: calc(85vh - 60px);
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(56, 189, 248, 0.4) transparent;
      }
      .trajectory-field--toggle {
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
      }
      .trajectory-toggle-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
      }
      .trajectory-checkbox {
        width: 18px;
        height: 18px;
        margin-top: 2px;
        accent-color: #38bdf8;
        cursor: pointer;
        flex-shrink: 0;
      }
      .trajectory-toggle-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .trajectory-toggle-text strong {
        font-size: 13px;
        color: #f1f5f9;
      }
      .trajectory-toggle-text small {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.35;
      }
      .trajectory-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.55);
        margin: 4px 0 2px 0;
      }
      .trajectory-divider {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }
      .trajectory-control-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .trajectory-control-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .trajectory-control-header label {
        font-weight: 600;
        font-size: 12px;
        color: #cbd5e1;
      }
      .trajectory-control-readout {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .trajectory-badge {
        font-size: 11px;
        font-weight: 600;
        color: #38bdf8;
        font-variant-numeric: tabular-nums;
      }
      .trajectory-num-input {
        width: 62px;
        padding: 3px 6px;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        color: #f8fafc;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .trajectory-num-input:focus {
        outline: none;
        border-color: #38bdf8;
        background: rgba(0, 0, 0, 0.6);
      }
      .trajectory-slider {
        width: 100%;
        height: 6px;
        appearance: none;
        -webkit-appearance: none;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 3px;
        outline: none;
        cursor: pointer;
        margin: 4px 0 2px;
      }
      .trajectory-slider::-webkit-slider-thumb {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #38bdf8;
        box-shadow: 0 0 6px rgba(56, 189, 248, 0.8);
        cursor: pointer;
        border: 2px solid #0f172a;
        transition: transform 0.1s ease;
      }
      .trajectory-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }
      .trajectory-slider-range-hint {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #64748b;
      }
      .trajectory-cycle-summary {
        font-size: 11px;
        color: #38bdf8;
        font-style: italic;
        margin-top: 2px;
      }
      .trajectory-row {
        display: flex;
        gap: 12px;
      }
      .trajectory-color-wrapper {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .trajectory-color-picker {
        appearance: none;
        -webkit-appearance: none;
        border: none;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        cursor: pointer;
        background: none;
        padding: 0;
      }
      .trajectory-color-picker::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      .trajectory-color-picker::-webkit-color-swatch {
        border: 1.5px solid rgba(255, 255, 255, 0.3);
        border-radius: 6px;
      }
      .trajectory-color-code {
        font-size: 11px;
        font-weight: 700;
        font-family: monospace;
        color: #94a3b8;
      }
      .trajectory-color-swatches {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }
      .trajectory-swatch {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
      }
      .trajectory-swatch:hover {
        transform: scale(1.15);
        box-shadow: 0 0 8px currentColor;
      }
      .trajectory-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }
      .trajectory-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.1s ease;
        border: none;
      }
      .trajectory-btn:active {
        transform: translateY(1px);
      }
      .trajectory-btn--primary {
        background: #0284c7;
        color: #fff;
        border: 1px solid #38bdf8;
      }
      .trajectory-btn--primary:hover {
        background: #0369a1;
      }
      .trajectory-btn--secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .trajectory-btn--secondary:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
      }
    `;
    document.head.appendChild(styleEl);
  }

  bindEvents() {
    // 1. HUD Tool Trigger Button
    this.triggerBtn?.addEventListener("click", () => this.toggle());

    // 2. Close Button
    this.dialog?.querySelector('[data-action="close"]')?.addEventListener("click", () => this.hide());

    // 3. Draggable Header
    const head = this.dialog?.querySelector("[data-drag-handle]");
    if (head) {
      head.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button, input")) return;
        this.dragState.isDragging = true;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;
        const rect = this.dialog.getBoundingClientRect();
        this.dragState.initialLeft = rect.left;
        this.dragState.initialTop = rect.top;
        head.setPointerCapture(e.pointerId);
      });

      head.addEventListener("pointermove", (e) => {
        if (!this.dragState.isDragging) return;
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - this.dialog.offsetWidth - 10, this.dragState.initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - this.dialog.offsetHeight - 10, this.dragState.initialTop + dy));
        this.dialog.style.position = "fixed";
        this.dialog.style.left = `${newLeft}px`;
        this.dialog.style.top = `${newTop}px`;
        this.dialog.style.right = "auto";
        this.dialog.style.bottom = "auto";
      });

      const stopDrag = (e) => {
        if (this.dragState.isDragging) {
          this.dragState.isDragging = false;
          try { head.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      head.addEventListener("pointerup", stopDrag);
      head.addEventListener("pointercancel", stopDrag);
    }

    // 4. Form inputs binding
    const enabledInput = this.dialog.querySelector("#traj-enabled");
    const dynamicModeInput = this.dialog.querySelector("#traj-dynamic-mode");
    const distSlider = this.dialog.querySelector("#traj-dist-slider");
    const distNum = this.dialog.querySelector("#traj-dist-num");
    const solidSlider = this.dialog.querySelector("#traj-solid-slider");
    const solidNum = this.dialog.querySelector("#traj-solid-num");
    const transSlider = this.dialog.querySelector("#traj-trans-slider");
    const transNum = this.dialog.querySelector("#traj-trans-num");
    const thicknessSlider = this.dialog.querySelector("#traj-thickness-slider");
    const thicknessNum = this.dialog.querySelector("#traj-thickness-num");
    const opacitySlider = this.dialog.querySelector("#traj-opacity-slider");
    const opacityNum = this.dialog.querySelector("#traj-opacity-num");
    const colorPicker = this.dialog.querySelector("#traj-color-picker");

    enabledInput?.addEventListener("change", () => {
      this.settings.enabled = enabledInput.checked;
      this.onSettingChanged();
    });

    dynamicModeInput?.addEventListener("change", () => {
      this.settings.dynamicMode = dynamicModeInput.checked;
      this.onSettingChanged();
    });

    // Distance
    distSlider?.addEventListener("input", () => {
      distNum.value = distSlider.value;
      this.settings.predictionTicks = Number(distSlider.value);
      this.onSettingChanged();
    });
    distNum?.addEventListener("input", () => {
      const val = Math.min(600, Math.max(60, Number(distNum.value) || 60));
      distSlider.value = val;
      this.settings.predictionTicks = val;
      this.onSettingChanged();
    });

    // Solid Ticks
    solidSlider?.addEventListener("input", () => {
      solidNum.value = solidSlider.value;
      this.settings.solidTicks = Number(solidSlider.value);
      this.onSettingChanged();
    });
    solidNum?.addEventListener("input", () => {
      const val = Math.min(240, Math.max(5, Number(solidNum.value) || 5));
      solidSlider.value = val;
      this.settings.solidTicks = val;
      this.onSettingChanged();
    });

    // Transparent Ticks
    transSlider?.addEventListener("input", () => {
      transNum.value = transSlider.value;
      this.settings.transparentTicks = Number(transSlider.value);
      this.onSettingChanged();
    });
    transNum?.addEventListener("input", () => {
      const val = Math.min(240, Math.max(5, Number(transNum.value) || 5));
      transSlider.value = val;
      this.settings.transparentTicks = val;
      this.onSettingChanged();
    });

    // Thickness
    thicknessSlider?.addEventListener("input", () => {
      thicknessNum.value = thicknessSlider.value;
      this.settings.thickness = Number(thicknessSlider.value);
      this.onSettingChanged();
    });
    thicknessNum?.addEventListener("input", () => {
      const val = Math.min(75, Math.max(1, Number(thicknessNum.value) || 1));
      thicknessSlider.value = val;
      this.settings.thickness = val;
      this.onSettingChanged();
    });

    // Opacity
    opacitySlider?.addEventListener("input", () => {
      opacityNum.value = opacitySlider.value;
      this.settings.opacity = Number(opacitySlider.value);
      this.onSettingChanged();
    });
    opacityNum?.addEventListener("input", () => {
      const val = Math.min(1.0, Math.max(0.05, Number(opacityNum.value) || 0.05));
      opacitySlider.value = val;
      this.settings.opacity = val;
      this.onSettingChanged();
    });

    // Color
    colorPicker?.addEventListener("input", () => {
      this.settings.color = colorPicker.value;
      this.onSettingChanged();
    });

    // Swatches
    this.dialog.querySelectorAll(".trajectory-swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        const color = btn.getAttribute("data-color");
        if (color) {
          this.settings.color = color;
          colorPicker.value = color;
          this.onSettingChanged();
        }
      });
    });

    // 5. Action Buttons
    this.dialog.querySelector('[data-action="test-predict"]')?.addEventListener("click", () => {
      this.triggerTestPrediction();
    });

    this.dialog.querySelector('[data-action="reset-defaults"]')?.addEventListener("click", () => {
      this.resetToDefaults();
    });

    // 6. Global keyboard shortcut (KeyP or Shift+T)
    window.addEventListener("keydown", (e) => {
      // Avoid hotkey trigger when typing in inputs/textareas
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        return;
      }
      if ((e.code === "KeyP" && !e.ctrlKey && !e.altKey && !e.metaKey) ||
          (e.code === "KeyT" && e.shiftKey)) {
        e.preventDefault();
        this.toggle();
      } else if (e.code === "Escape" && this.isOpen) {
        e.preventDefault();
        this.hide();
      }
    });
  }

  syncFormValues() {
    if (!this.dialog) return;
    const { enabled, dynamicMode, predictionTicks, solidTicks, transparentTicks, thickness, opacity, color } = this.settings;

    const setVal = (id, val) => {
      const el = this.dialog.querySelector(id);
      if (el) el.value = val;
    };
    const setChecked = (id, checked) => {
      const el = this.dialog.querySelector(id);
      if (el) el.checked = checked;
    };

    setChecked("#traj-enabled", enabled);
    setChecked("#traj-dynamic-mode", dynamicMode);
    setVal("#traj-dist-slider", predictionTicks);
    setVal("#traj-dist-num", predictionTicks);
    setVal("#traj-solid-slider", solidTicks);
    setVal("#traj-solid-num", solidTicks);
    setVal("#traj-trans-slider", transparentTicks);
    setVal("#traj-trans-num", transparentTicks);
    setVal("#traj-thickness-slider", thickness);
    setVal("#traj-thickness-num", thickness);
    setVal("#traj-opacity-slider", opacity);
    setVal("#traj-opacity-num", opacity);
    setVal("#traj-color-picker", color);

    this.updateLabelsAndBadges();
  }

  updateLabelsAndBadges() {
    if (!this.dialog) return;
    const { enabled, dynamicMode, predictionTicks, solidTicks, transparentTicks, color } = this.settings;

    // Status badge
    const badge = this.dialog.querySelector("[data-status-badge]");
    if (badge) {
      badge.textContent = enabled ? "Active" : "Disabled";
      badge.classList.toggle("is-disabled", !enabled);
    }

    // Mode texts
    const modeLabel = this.dialog.querySelector("[data-mode-label]");
    const modeDesc = this.dialog.querySelector("[data-mode-desc]");
    if (modeLabel) {
      modeLabel.textContent = dynamicMode
        ? "Dynamic Pattern (Ball Pushes Line)"
        : "Static Pattern (Ball Follows Line)";
    }
    if (modeDesc) {
      modeDesc.textContent = dynamicMode
        ? "Dashed segments flow forward dynamically with the ball"
        : "Trajectory line remains stationary as the ball travels along it";
    }

    // Distance readout
    const distBadge = this.dialog.querySelector('[data-readout="distance"]');
    if (distBadge) {
      distBadge.textContent = `${predictionTicks} ticks (${(predictionTicks / 120).toFixed(2)}s)`;
    }

    // Solid readout
    const solidBadge = this.dialog.querySelector('[data-readout="solid"]');
    if (solidBadge) {
      solidBadge.textContent = `${solidTicks} ticks (${(solidTicks / 120 * 1000).toFixed(0)}ms)`;
    }

    // Transparent readout
    const transBadge = this.dialog.querySelector('[data-readout="transparent"]');
    if (transBadge) {
      transBadge.textContent = `${transparentTicks} ticks (${(transparentTicks / 120 * 1000).toFixed(0)}ms)`;
    }

    // Thickness readout
    const thicknessBadge = this.dialog.querySelector('[data-readout="thickness"]');
    if (thicknessBadge) {
      thicknessBadge.textContent = `${this.settings.thickness}%`;
    }

    // Cycle summary
    const cycleSummary = this.dialog.querySelector("[data-cycle-summary]");
    if (cycleSummary) {
      const cycle = solidTicks + transparentTicks;
      const duty = Math.round((solidTicks / cycle) * 100);
      cycleSummary.textContent = `Cycle: ${cycle} ticks (${duty}% solid, ${100 - duty}% gap)`;
    }

    // Color code
    const colorCode = this.dialog.querySelector("[data-color-code]");
    if (colorCode) {
      colorCode.textContent = color.toUpperCase();
    }
  }

  onSettingChanged() {
    this.updateLabelsAndBadges();
    saveTrajectorySettings(this.settings);
    if (this.predictor) {
      this.predictor.updateSettings(this.settings);
    }
  }

  triggerTestPrediction() {
    if (this.predictor && this.physics) {
      const count = this.predictor.predictFromCurrentState(this.physics);
      console.log(`[BallTrajectoryPredictor] Manual test prediction generated: ${count} ticks.`);
    }
  }

  resetToDefaults() {
    this.settings = { ...DEFAULT_TRAJECTORY_SETTINGS };
    this.syncFormValues();
    this.onSettingChanged();
  }

  show() {
    if (!this.overlay) return;
    this.overlay.hidden = false;
    this.overlay.removeAttribute("aria-hidden");
    this.isOpen = true;
    this.syncFormValues();

    if (this.onOverlayChange) {
      this.onOverlayChange("trajectory", true);
    }
  }

  hide() {
    if (!this.overlay) return;
    this.overlay.hidden = true;
    this.overlay.setAttribute("aria-hidden", "true");
    this.isOpen = false;

    if (this.onOverlayChange) {
      this.onOverlayChange("trajectory", false);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    this.triggerBtn?.remove();
    this.overlay?.remove();
    const styleEl = document.getElementById("trajectory-predictor-styles");
    styleEl?.remove();
  }
}

export default BallTrajectoryPredictorHUD;
