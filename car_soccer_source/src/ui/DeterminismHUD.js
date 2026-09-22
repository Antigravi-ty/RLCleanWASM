/**
 * src/ui/DeterminismHUD.js
 * Real-time HUD and Interactive Control Panel for Dual-Arena Determinism Verification.
 * 
 * Displays:
 * - Determinism Status Badge (100% BIT-EXACT vs DESYNC)
 * - Ground Truth vs Reconciliation Tick Counters
 * - Total Rollbacks performed & rollback depth
 * - Real-time Car ΔPos, Car ΔVel, Car ΔAngVel, Ball ΔPos
 * - Peak/Max observed deltas
 * - Interactive controls for rollback frequency and depth
 */

export class DeterminismHUD {
  /**
   * @param {HTMLElement} container Parent DOM container (e.g. document.body)
   * @param {import('../physics/DeterminismHarness.js').DeterminismHarness} harness
   */
  constructor(container = (typeof document !== 'undefined' ? document.body : null), harness = null) {
    this.container = container;
    this.harness = harness;
    this.visible = false;
    this.minimized = false;
    this.root = null;
    this.dom = {};

    if (typeof document !== 'undefined') {
      this.initDOM();
      if (this.harness) {
        this.harness.onMetricsUpdated = (metrics) => this.update(metrics);
      }
    }
  }

  initDOM() {
    const styleId = 'determinism-hud-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .det-hud {
          position: fixed;
          top: 80px;
          right: 20px;
          width: 380px;
          background: rgba(13, 17, 23, 0.94);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(56, 139, 253, 0.4);
          border-radius: 10px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
          color: #e6edf3;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 12px;
          z-index: 99999;
          user-select: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: border-color 0.2s ease;
        }
        .det-hud--desync {
          border-color: #f85149 !important;
          box-shadow: 0 0 20px rgba(248, 81, 73, 0.5) !important;
        }
        .det-header {
          padding: 10px 14px;
          background: rgba(22, 27, 34, 0.9);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: grab;
        }
        .det-header:active {
          cursor: grabbing;
        }
        .det-title {
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #58a6ff;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .det-status-badge {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .det-status-badge--exact {
          background: rgba(46, 160, 67, 0.25);
          color: #3fb950;
          border: 1px solid #2ea043;
          box-shadow: 0 0 8px rgba(46, 160, 67, 0.4);
        }
        .det-status-badge--desync {
          background: rgba(248, 81, 73, 0.25);
          color: #f85149;
          border: 1px solid #f85149;
          box-shadow: 0 0 10px rgba(248, 81, 73, 0.6);
          animation: detBlink 0.5s infinite alternate;
        }
        @keyframes detBlink {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }
        .det-actions {
          display: flex;
          gap: 6px;
        }
        .det-btn-icon {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #8b949e;
          border-radius: 4px;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 11px;
        }
        .det-btn-icon:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #c9d1d9;
        }
        .det-body {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .det-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 12px;
          background: rgba(1, 4, 9, 0.5);
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .det-cell-label {
          color: #8b949e;
        }
        .det-cell-value {
          text-align: right;
          font-weight: 600;
          color: #e6edf3;
        }
        .det-cell-value--green {
          color: #3fb950 !important;
        }
        .det-cell-value--red {
          color: #f85149 !important;
        }
        .det-section-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #7d8590;
          margin-bottom: 4px;
        }
        .det-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .det-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .det-slider-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .det-slider-wrap input[type="range"] {
          width: 130px;
        }
        .det-btn-row {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .det-btn {
          flex: 1;
          background: #21262d;
          border: 1px solid rgba(240, 246, 252, 0.1);
          border-radius: 6px;
          color: #c9d1d9;
          padding: 5px 8px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
          text-align: center;
        }
        .det-btn:hover {
          background: #30363d;
          color: #ffffff;
        }
        .det-btn--accent {
          background: #1f6feb;
          border-color: #388bfd;
          color: #ffffff;
        }
        .det-btn--accent:hover {
          background: #388bfd;
        }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.id = 'hud-determinism';
    root.className = 'det-hud';
    root.hidden = true;

    root.innerHTML = `
      <div class="det-header" data-el="header">
        <div class="det-title">
          <span>DUAL-ARENA</span>
          <span class="det-status-badge det-status-badge--exact" data-el="statusBadge">100% BIT-EXACT</span>
        </div>
        <div class="det-actions">
          <button class="det-btn-icon" data-el="btnMinimize" title="Minimize / Expand">_</button>
          <button class="det-btn-icon" data-el="btnClose" title="Close">✕</button>
        </div>
      </div>
      <div class="det-body" data-el="body">
        <div>
          <div class="det-section-title">Delta Comparison (Truth vs Reconciled)</div>
          <div class="det-grid">
            <span class="det-cell-label">Car ΔPos:</span>
            <span class="det-cell-value det-cell-value--green" data-el="valCarDeltaPos">0.00000000 UU</span>
            <span class="det-cell-label">Car ΔVel:</span>
            <span class="det-cell-value det-cell-value--green" data-el="valCarDeltaVel">0.00000000 UU/s</span>
            <span class="det-cell-label">Car ΔAngVel:</span>
            <span class="det-cell-value det-cell-value--green" data-el="valCarDeltaAngVel">0.00000000</span>
            <span class="det-cell-label">Ball ΔPos:</span>
            <span class="det-cell-value det-cell-value--green" data-el="valBallDeltaPos">0.00000000 UU</span>
            <span class="det-cell-label">Max Observed ΔPos:</span>
            <span class="det-cell-value det-cell-value--green" data-el="valMaxDeltaPos">0.00000000 UU</span>
          </div>
        </div>

        <div>
          <div class="det-section-title">Reconciliation Stats</div>
          <div class="det-grid">
            <span class="det-cell-label">Sim Tick:</span>
            <span class="det-cell-value" data-el="valTick">0</span>
            <span class="det-cell-label">Total Rollbacks:</span>
            <span class="det-cell-value" data-el="valTotalRollbacks">0</span>
            <span class="det-cell-label">Rollback Depth:</span>
            <span class="det-cell-value" data-el="valDepth">15 ticks (125ms)</span>
            <span class="det-cell-label">Rollback Latency:</span>
            <span class="det-cell-value" data-el="valLatency">0.00 ms</span>
          </div>
        </div>

        <div class="det-controls">
          <div class="det-section-title">Interactive Rollback Controls</div>
          <div class="det-row">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" data-el="chkPeriodic" checked />
              <span>Periodic Rollbacks</span>
            </label>
            <span style="color: #8b949e; font-size: 11px;" data-el="txtInterval">Every 30 ticks</span>
          </div>

          <div class="det-row">
            <span class="det-cell-label">Interval:</span>
            <div class="det-slider-wrap">
              <input type="range" data-el="sliderInterval" min="10" max="120" step="5" value="30" />
              <span data-el="valSliderInterval">30t</span>
            </div>
          </div>

          <div class="det-row">
            <span class="det-cell-label">Depth:</span>
            <div class="det-slider-wrap">
              <input type="range" data-el="sliderDepth" min="1" max="60" step="1" value="15" />
              <span data-el="valSliderDepth">15t</span>
            </div>
          </div>

          <div class="det-btn-row">
            <button class="det-btn det-btn--accent" data-el="btnInstantRollback">Rollback 15t</button>
            <button class="det-btn det-btn--accent" data-el="btnDeepRollback">Deep 60t</button>
            <button class="det-btn" data-el="btnResetStats">Reset</button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(root);
    this.root = root;

    // Cache elements
    this.dom = {
      header: root.querySelector('[data-el="header"]'),
      body: root.querySelector('[data-el="body"]'),
      statusBadge: root.querySelector('[data-el="statusBadge"]'),
      btnMinimize: root.querySelector('[data-el="btnMinimize"]'),
      btnClose: root.querySelector('[data-el="btnClose"]'),
      valCarDeltaPos: root.querySelector('[data-el="valCarDeltaPos"]'),
      valCarDeltaVel: root.querySelector('[data-el="valCarDeltaVel"]'),
      valCarDeltaAngVel: root.querySelector('[data-el="valCarDeltaAngVel"]'),
      valBallDeltaPos: root.querySelector('[data-el="valBallDeltaPos"]'),
      valMaxDeltaPos: root.querySelector('[data-el="valMaxDeltaPos"]'),
      valTick: root.querySelector('[data-el="valTick"]'),
      valTotalRollbacks: root.querySelector('[data-el="valTotalRollbacks"]'),
      valDepth: root.querySelector('[data-el="valDepth"]'),
      valLatency: root.querySelector('[data-el="valLatency"]'),
      chkPeriodic: root.querySelector('[data-el="chkPeriodic"]'),
      txtInterval: root.querySelector('[data-el="txtInterval"]'),
      sliderInterval: root.querySelector('[data-el="sliderInterval"]'),
      valSliderInterval: root.querySelector('[data-el="valSliderInterval"]'),
      sliderDepth: root.querySelector('[data-el="sliderDepth"]'),
      valSliderDepth: root.querySelector('[data-el="valSliderDepth"]'),
      btnInstantRollback: root.querySelector('[data-el="btnInstantRollback"]'),
      btnDeepRollback: root.querySelector('[data-el="btnDeepRollback"]'),
      btnResetStats: root.querySelector('[data-el="btnResetStats"]')
    };

    this.bindEvents();
  }

  bindEvents() {
    this.dom.btnClose.addEventListener('click', () => this.hide());
    this.dom.btnMinimize.addEventListener('click', () => this.toggleMinimize());

    this.dom.chkPeriodic.addEventListener('change', (e) => {
      if (this.harness) {
        this.harness.periodicRollback = e.target.checked;
      }
    });

    this.dom.sliderInterval.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.dom.valSliderInterval.textContent = `${val}t`;
      this.dom.txtInterval.textContent = `Every ${val} ticks`;
      if (this.harness) {
        this.harness.rollbackInterval = val;
      }
    });

    this.dom.sliderDepth.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.dom.valSliderDepth.textContent = `${val}t`;
      this.dom.btnInstantRollback.textContent = `Rollback ${val}t`;
      if (this.harness) {
        this.harness.rollbackDepth = val;
      }
    });

    this.dom.btnInstantRollback.addEventListener('click', () => {
      if (this.harness) {
        this.harness.executeRollback(this.harness.rollbackDepth);
      }
    });

    this.dom.btnDeepRollback.addEventListener('click', () => {
      if (this.harness) {
        this.harness.executeRollback(60);
      }
    });

    this.dom.btnResetStats.addEventListener('click', () => {
      if (this.harness) {
        this.harness.resetStats();
      }
    });

    // Make window draggable
    this.makeDraggable(this.dom.header);
  }

  makeDraggable(handle) {
    let startX = 0, startY = 0, initialX = 0, initialY = 0;
    const onMouseDown = (e) => {
      if (e.target.closest('.det-actions')) return;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.root.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.root.style.left = `${Math.max(10, initialX + dx)}px`;
      this.root.style.top = `${Math.max(10, initialY + dy)}px`;
      this.root.style.right = 'auto';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  update(metrics) {
    if (!this.visible || !metrics) return;

    const isExact = metrics.isBitExact;

    if (isExact) {
      this.dom.statusBadge.className = 'det-status-badge det-status-badge--exact';
      this.dom.statusBadge.textContent = '100% BIT-EXACT';
      this.root.classList.remove('det-hud--desync');
    } else {
      this.dom.statusBadge.className = 'det-status-badge det-status-badge--desync';
      this.dom.statusBadge.textContent = 'DESYNC DETECTED';
      this.root.classList.add('det-hud--desync');
    }

    const fmt = (num, unit = '') => `${num.toFixed(8)} ${unit}`.trim();

    this.dom.valCarDeltaPos.textContent = fmt(metrics.carDeltaPos, 'UU');
    this.dom.valCarDeltaPos.className = `det-cell-value ${metrics.carDeltaPos === 0 ? 'det-cell-value--green' : 'det-cell-value--red'}`;

    this.dom.valCarDeltaVel.textContent = fmt(metrics.carDeltaVel, 'UU/s');
    this.dom.valCarDeltaVel.className = `det-cell-value ${metrics.carDeltaVel === 0 ? 'det-cell-value--green' : 'det-cell-value--red'}`;

    this.dom.valCarDeltaAngVel.textContent = fmt(metrics.carDeltaAngVel);
    this.dom.valCarDeltaAngVel.className = `det-cell-value ${metrics.carDeltaAngVel === 0 ? 'det-cell-value--green' : 'det-cell-value--red'}`;

    this.dom.valBallDeltaPos.textContent = fmt(metrics.ballDeltaPos, 'UU');
    this.dom.valBallDeltaPos.className = `det-cell-value ${metrics.ballDeltaPos === 0 ? 'det-cell-value--green' : 'det-cell-value--red'}`;

    this.dom.valMaxDeltaPos.textContent = fmt(metrics.maxDeltaPos, 'UU');
    this.dom.valMaxDeltaPos.className = `det-cell-value ${metrics.maxDeltaPos === 0 ? 'det-cell-value--green' : 'det-cell-value--red'}`;

    this.dom.valTick.textContent = `${metrics.tickA} (B: ${metrics.tickB})`;
    this.dom.valTotalRollbacks.textContent = `${metrics.totalRollbacks}`;
    this.dom.valDepth.textContent = `${metrics.currentDepth || this.harness?.rollbackDepth || 15}t (${((metrics.currentDepth || 15) * 8.333).toFixed(1)}ms)`;
    this.dom.valLatency.textContent = `${metrics.lastRollbackDurationMs.toFixed(2)} ms`;
  }

  show() {
    this.visible = true;
    if (this.root) this.root.hidden = false;
  }

  hide() {
    this.visible = false;
    if (this.root) this.root.hidden = true;
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  toggleMinimize() {
    this.minimized = !this.minimized;
    if (this.dom.body) {
      this.dom.body.hidden = this.minimized;
    }
    this.dom.btnMinimize.textContent = this.minimized ? '□' : '_';
  }

  destroy() {
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }
}

export default DeterminismHUD;
