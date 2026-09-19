/**
 * src/ui/NetworkReconciliationHUD.js
 * Real-time HUD & Network Stress Testing Controller for Multiplayer Prediction & Headless Client Replication.
 * 
 * Displays:
 * - Real Client Ping (RTT), Lead Ticks, Tick vs Authoritative Server Tick (+delta ticks)
 * - 120Hz Server and Client Report Rates
 * - Dynamic Asymmetric Latency Lead & Input Leader Indicator
 * - Isolated Input Replication Status (Jump Hold & Aerial Air Roll Synced)
 * - Reconciliation Corrections / Misprediction Glitches & Visual Smoothing
 * - Interactive sliders for Latency (default 0ms extra), Loss, and Burst Drop
 * - 1-Click "Copy Diagnostic Data" button for rapid troubleshooting
 * - Fully closable via [✕] button, footer close button, or Escape key
 */

export class NetworkReconciliationHUD {
  /**
   * @param {HTMLElement} container Parent container
   * @param {import('../network/PredictionReconciler.js').PredictionReconciler} reconciler
   * @param {import('../network/NetworkChannel.js').NetworkChannel} channel
   * @param {import('../network/HeadlessClient.js').HeadlessClient} [headlessClient]
   * @param {import('../network/AsymmetricInputCoordinator.js').AsymmetricInputCoordinator} [coordinator]
   */
  constructor(container = (typeof document !== 'undefined' ? document.body : null), reconciler = null, channel = null, headlessClient = null, coordinator = null) {
    this.container = container;
    this.reconciler = reconciler;
    this.channel = channel;
    this.headlessClient = headlessClient;
    this.coordinator = coordinator;
    this.visible = false;
    this.minimized = false;
    this.root = null;
    this.dom = {};
    this.adjustStepMs = 10;
    this.burstDropCount = 5;

    if (typeof document !== 'undefined') {
      this.initDOM();
      if (this.reconciler) {
        this.reconciler.onMetricsUpdated = (m) => this.update(m);
      }
    }
  }

  setHeadlessClient(headlessClient, coordinator) {
    this.headlessClient = headlessClient;
    this.coordinator = coordinator;
  }

  initDOM() {
    const styleId = 'net-reconcile-hud-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .net-hud {
          position: fixed;
          top: 70px;
          left: 20px;
          width: 410px;
          max-width: calc(100vw - 40px);
          max-height: calc(100vh - 90px);
          background: rgba(13, 17, 23, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(163, 113, 247, 0.45);
          border-radius: 10px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
          color: #e6edf3;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 12px;
          z-index: 99999;
          user-select: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          pointer-events: auto;
        }
        .net-header {
          padding: 10px 14px;
          background: rgba(22, 27, 34, 0.92);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: grab;
        }
        .net-header:active {
          cursor: grabbing;
        }
        .net-title {
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #d2a8ff;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .net-badge {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: rgba(163, 113, 247, 0.25);
          color: #d2a8ff;
          border: 1px solid #a371f7;
          box-shadow: 0 0 8px rgba(163, 113, 247, 0.4);
        }
        .net-actions {
          display: flex;
          gap: 6px;
        }
        .net-btn-icon {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #c9d1d9;
          border-radius: 4px;
          padding: 3px 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          line-height: 1;
        }
        .net-btn-icon:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }
        .net-btn-icon--close:hover {
          background: #da3633;
          border-color: #f85149;
          color: #ffffff;
        }
        .net-body {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
        }
        .net-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px 12px;
          background: rgba(1, 4, 9, 0.5);
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .net-cell-label {
          color: #8b949e;
        }
        .net-cell-value {
          text-align: right;
          font-weight: 600;
          color: #e6edf3;
        }
        .net-cell-value--purple {
          color: #d2a8ff !important;
        }
        .net-cell-value--green {
          color: #3fb950 !important;
        }
        .net-cell-value--amber {
          color: #d29922 !important;
        }
        .net-cell-value--cyan {
          color: #58a6ff !important;
        }
        .net-section-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #7d8590;
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .net-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .net-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .net-slider-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .net-slider-wrap input[type="range"] {
          width: 125px;
          cursor: pointer;
        }
        .net-btn-row {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .net-btn {
          flex: 1;
          background: #21262d;
          border: 1px solid rgba(240, 246, 252, 0.15);
          border-radius: 6px;
          color: #c9d1d9;
          padding: 6px 10px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
          text-align: center;
          transition: background 0.15s, color 0.15s;
        }
        .net-btn:hover {
          background: #30363d;
          color: #ffffff;
        }
        .net-btn--accent {
          background: #8957e5;
          border-color: #a371f7;
          color: #ffffff;
        }
        .net-btn--accent:hover {
          background: #a371f7;
        }
        .net-btn--copy {
          background: #1f6feb;
          border-color: #388bfd;
          color: #ffffff;
        }
        .net-btn--copy:hover {
          background: #388bfd;
        }
        .net-status-box {
          background: rgba(110, 64, 201, 0.15);
          border: 1px solid rgba(163, 113, 247, 0.3);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          line-height: 1.4;
          color: #d2a8ff;
        }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.id = 'hud-network-reconcile';
    root.className = 'net-hud';
    root.hidden = true;

    root.innerHTML = `
      <div class="net-header" data-el="header">
        <div class="net-title">
          <span>NETWORK CONTROLLER</span>
          <span class="net-badge" data-el="badge">120Hz SYNC</span>
        </div>
        <div class="net-actions">
          <button class="net-btn-icon" data-el="btnMinimize" title="Minimize / Expand">_</button>
          <button class="net-btn-icon net-btn-icon--close" data-el="btnClose" title="Close Panel (Esc / Shift+P)">✕</button>
        </div>
      </div>
      <div class="net-body" data-el="body">
        <div>
          <div class="net-section-title">
            <span>Multiplayer Synchronization</span>
            <span style="font-size:9px;color:#58a6ff" data-el="txtRates">Server: 120Hz · Client: 120Hz</span>
          </div>
          <div class="net-grid">
            <span class="net-cell-label">Client RTT Latency:</span>
            <span class="net-cell-value net-cell-value--purple" data-el="valRtt">0 ms (RTT 0 ms)</span>
            <span class="net-cell-label">Client / Server Tick:</span>
            <span class="net-cell-value net-cell-value--green" data-el="valTicks">0 / 0 (+0 ticks)</span>
            <span class="net-cell-label">Client Timeline Lead:</span>
            <span class="net-cell-value net-cell-value--cyan" data-el="valLead">0 ticks</span>
            <span class="net-cell-label">Report Rates (S / C):</span>
            <span class="net-cell-value" data-el="valReportRates">120 Hz / 120 Hz</span>
            <span class="net-cell-label">Packet Loss Rate:</span>
            <span class="net-cell-value" data-el="valLoss">0.0 %</span>
            <span class="net-cell-label">Opponent / Peer:</span>
            <span class="net-cell-value" data-el="valHeadlessRtt">0 ms (RTT 0 ms)</span>
          </div>
        </div>

        <div class="net-status-box" data-el="boxStatus">
          <b>P2P Protocol:</b> 120Hz fixed-timestep authoritative loop. Past is immutable (zero server rewind). Press <b>Esc</b> or click <b>✕</b> to close.
        </div>

        <div>
          <div class="net-section-title">Reconciliation & Glitch Exposure</div>
          <div class="net-grid">
            <span class="net-cell-label">Corrections:</span>
            <span class="net-cell-value net-cell-value--green" data-el="valCorrections">0</span>
            <span class="net-cell-label">Last Error Delta:</span>
            <span class="net-cell-value" data-el="valLastError">0.00 UU</span>
            <span class="net-cell-label">Max Correction:</span>
            <span class="net-cell-value" data-el="valMaxError">0.00 UU</span>
            <span class="net-cell-label">Visual Smoothing:</span>
            <span class="net-cell-value net-cell-value--amber" data-el="valSmoothing">OFF (0.00)</span>
          </div>
        </div>

        <div class="net-controls">
          <div class="net-section-title">Latency & Loss Configuration</div>

          <div class="net-row">
            <span class="net-cell-label">Extra Latency [9 / 0]:</span>
            <div class="net-slider-wrap">
              <input type="range" data-el="sliderRtt" min="0" max="500" step="5" value="0" />
              <span data-el="txtSliderRtt" style="min-width:120px;text-align:right">+0ms (RTT 0ms)</span>
            </div>
          </div>

          <div class="net-row">
            <span class="net-cell-label">Peer Extra Latency:</span>
            <div class="net-slider-wrap">
              <input type="range" data-el="sliderHeadlessRtt" min="0" max="500" step="5" value="0" />
              <span data-el="txtSliderHeadlessRtt" style="min-width:120px;text-align:right">+0ms (RTT 0ms)</span>
            </div>
          </div>

          <div class="net-row">
            <span class="net-cell-label">Adjust Step (Latency):</span>
            <div class="net-slider-wrap">
              <input type="range" data-el="sliderStep" min="5" max="50" step="5" value="10" />
              <span data-el="txtSliderStep" style="min-width:120px;text-align:right">10ms (RTT 20ms)</span>
            </div>
          </div>

          <div class="net-row">
            <span class="net-cell-label">Drop Burst Count [8]:</span>
            <div class="net-slider-wrap">
              <input type="range" data-el="sliderBurstDrop" min="1" max="30" step="1" value="5" />
              <span data-el="txtSliderBurstDrop" style="min-width:44px;text-align:right">5 pkts</span>
            </div>
          </div>

          <div class="net-row">
            <span class="net-cell-label">Visual Smoothing:</span>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#8b949e">
              <input type="checkbox" data-el="chkSmoothing" />
              <span style="font-size:11px">Enable (Default OFF)</span>
            </label>
          </div>

          <div class="net-row">
            <span class="net-cell-label">Redundant Inputs:</span>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#58a6ff">
              <input type="checkbox" data-el="chkRedundant" checked />
              <span style="font-size:11px">GDC (12-tick redundant, Default ON)</span>
            </label>
          </div>

          <div class="net-row">
            <span class="net-cell-label">Packet Loss:</span>
            <div class="net-slider-wrap">
              <input type="range" data-el="sliderLoss" min="0" max="25" step="1" value="0" />
              <span data-el="txtSliderLoss">0%</span>
            </div>
          </div>

          <div class="net-btn-row">
            <button class="net-btn net-btn--accent" data-el="btnDropBurst" title="Drop packet burst (Hotkey 8)">Drop Burst (5) [8]</button>
            <button class="net-btn" data-el="btnReset">Reset Stats</button>
          </div>

          <div class="net-btn-row">
            <button class="net-btn net-btn--copy" data-el="btnCopyDiagnostics" title="Copy full diagnostics JSON to clipboard">📋 Copy Diagnostics</button>
            <button class="net-btn" data-el="btnCloseBottom" title="Close Network Controller">✕ Close Panel</button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(root);
    this.root = root;

    this.dom = {
      header: root.querySelector('[data-el="header"]'),
      body: root.querySelector('[data-el="body"]'),
      btnMinimize: root.querySelector('[data-el="btnMinimize"]'),
      btnClose: root.querySelector('[data-el="btnClose"]'),
      btnCloseBottom: root.querySelector('[data-el="btnCloseBottom"]'),
      btnCopyDiagnostics: root.querySelector('[data-el="btnCopyDiagnostics"]'),
      txtRates: root.querySelector('[data-el="txtRates"]'),
      valRtt: root.querySelector('[data-el="valRtt"]'),
      valHeadlessRtt: root.querySelector('[data-el="valHeadlessRtt"]'),
      valLoss: root.querySelector('[data-el="valLoss"]'),
      valTicks: root.querySelector('[data-el="valTicks"]'),
      valLead: root.querySelector('[data-el="valLead"]'),
      valReportRates: root.querySelector('[data-el="valReportRates"]'),
      valCorrections: root.querySelector('[data-el="valCorrections"]'),
      valLastError: root.querySelector('[data-el="valLastError"]'),
      valMaxError: root.querySelector('[data-el="valMaxError"]'),
      valSmoothing: root.querySelector('[data-el="valSmoothing"]'),
      chkSmoothing: root.querySelector('[data-el="chkSmoothing"]'),
      chkRedundant: root.querySelector('[data-el="chkRedundant"]'),
      sliderRtt: root.querySelector('[data-el="sliderRtt"]'),
      txtSliderRtt: root.querySelector('[data-el="txtSliderRtt"]'),
      sliderStep: root.querySelector('[data-el="sliderStep"]'),
      txtSliderStep: root.querySelector('[data-el="txtSliderStep"]'),
      sliderHeadlessRtt: root.querySelector('[data-el="sliderHeadlessRtt"]'),
      txtSliderHeadlessRtt: root.querySelector('[data-el="txtSliderHeadlessRtt"]'),
      sliderLoss: root.querySelector('[data-el="sliderLoss"]'),
      txtSliderLoss: root.querySelector('[data-el="txtSliderLoss"]'),
      sliderBurstDrop: root.querySelector('[data-el="sliderBurstDrop"]'),
      txtSliderBurstDrop: root.querySelector('[data-el="txtSliderBurstDrop"]'),
      btnDropBurst: root.querySelector('[data-el="btnDropBurst"]'),
      btnReset: root.querySelector('[data-el="btnReset"]'),
      boxStatus: root.querySelector('[data-el="boxStatus"]')
    };

    this.bindEvents();
  }

  bindEvents() {
    this.dom.btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    this.dom.btnCloseBottom.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    this.dom.btnMinimize.addEventListener('click', () => this.toggleMinimize());

    this.dom.sliderRtt.addEventListener('input', (e) => {
      const extraLatency = parseInt(e.target.value, 10);
      const extraRtt = extraLatency * 2;
      this.dom.txtSliderRtt.textContent = `+${extraLatency}ms (RTT ${extraRtt}ms)`;
      if (this.channel?.setExtraLatency) {
        this.channel.setExtraLatency(extraLatency);
      } else if (this.channel?.setRtt) {
        this.channel.setRtt(extraRtt);
      }
      if (this.reconciler) {
        const totalRtt = this.channel?.rttMs ?? extraRtt;
        this.reconciler.leadTicks = this.reconciler.calculateLeadTicks(totalRtt);
      }
      this.syncLatencyValues();
    });

    this.dom.sliderHeadlessRtt.addEventListener('input', (e) => {
      const latency = parseInt(e.target.value, 10);
      const rtt = latency * 2;
      this.dom.txtSliderHeadlessRtt.textContent = `+${latency}ms (RTT ${rtt}ms)`;
      if (this.headlessClient?.setExtraLatency) {
        this.headlessClient.setExtraLatency(latency);
      } else if (this.headlessClient?.setRtt) {
        this.headlessClient.setRtt(rtt);
      }
      this.syncLatencyValues();
    });

    this.dom.sliderStep.addEventListener('input', (e) => {
      this.adjustStepMs = parseInt(e.target.value, 10);
      this.dom.txtSliderStep.textContent = `${this.adjustStepMs}ms (RTT ${this.adjustStepMs * 2}ms)`;
    });

    this.dom.chkSmoothing.addEventListener('change', (e) => {
      if (this.reconciler) {
        this.reconciler.enableSmoothing = e.target.checked;
      }
    });

    this.dom.chkRedundant?.addEventListener('change', (e) => {
      if (this.reconciler) {
        this.reconciler.enableRedundantInputs = e.target.checked;
      }
      if (this.headlessClient) {
        this.headlessClient.enableRedundantInputs = e.target.checked;
      }
    });

    this.dom.sliderLoss.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.dom.txtSliderLoss.textContent = `${val}%`;
      if (this.channel) this.channel.setPacketLossRate(val / 100.0);
      if (this.headlessClient) this.headlessClient.setPacketLossRate(val / 100.0);
    });

    this.dom.sliderBurstDrop?.addEventListener('input', (e) => {
      this.burstDropCount = parseInt(e.target.value, 10);
      if (this.dom.txtSliderBurstDrop) {
        this.dom.txtSliderBurstDrop.textContent = `${this.burstDropCount} pkts`;
      }
      if (this.dom.btnDropBurst) {
        this.dom.btnDropBurst.textContent = `Drop Burst (${this.burstDropCount}) [8]`;
      }
    });

    this.dom.btnDropBurst?.addEventListener('click', () => {
      this.dropPacketBurst();
    });

    this.dom.btnCopyDiagnostics?.addEventListener('click', () => {
      this.copyDiagnostics();
    });

    this.dom.btnReset.addEventListener('click', () => {
      if (this.reconciler) this.reconciler.resetStats();
      if (this.channel) this.channel.reset();
      if (this.headlessClient) this.headlessClient.reset();
      if (this.coordinator) this.coordinator.reset();
    });

    this.makeDraggable(this.dom.header);
  }

  copyDiagnostics() {
    const metrics = this.reconciler?.metrics || {};
    const configuredRtt = this.channel?.rttMs ?? 0;
    const realMeasuredRtt = this.channel?.measuredRttMs ?? 0;
    const extraLatency = Math.round(configuredRtt * 0.5);
    const clientTick = metrics.clientTick ?? 0;
    const serverTick = metrics.serverTick ?? 0;
    const leadDelta = clientTick - serverTick;

    const data = {
      timestamp: new Date().toISOString(),
      mode: this.headlessClient ? 'headless-simulation' : 'cross-tab-p2p',
      clientTick,
      serverTick,
      leadTicks: metrics.leadTicks ?? 0,
      tickLeadDelta: leadDelta,
      measuredRttMs: Number(realMeasuredRtt.toFixed(2)),
      configuredRttMs: configuredRtt,
      simulatedExtraLatencyMs: extraLatency,
      packetLossRate: this.channel?.packetLossRate ?? 0,
      dropBurstCount: this.burstDropCount ?? 5,
      serverReportRateHz: 120,
      clientReportRateHz: 120,
      correctionsTotal: metrics.totalCorrections ?? 0,
      lastCorrectionErrorUU: Number((metrics.lastCorrectionDelta ?? 0).toFixed(4)),
      maxCorrectionErrorUU: Number((metrics.maxCorrectionDelta ?? 0).toFixed(4)),
      visualSmoothing: this.reconciler?.enableSmoothing ?? false,
      redundantInputs: this.reconciler?.enableRedundantInputs ?? true,
      packetsSent: this.channel?.stats?.packetsSent ?? this.channel?.stats?.clientPacketsSent ?? 0,
      packetsDropped: this.channel?.stats?.packetsDropped ?? this.channel?.stats?.clientPacketsDropped ?? 0
    };

    const text = JSON.stringify(data, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (this.dom.btnCopyDiagnostics) {
          const orig = this.dom.btnCopyDiagnostics.textContent;
          this.dom.btnCopyDiagnostics.textContent = '✅ Copied!';
          setTimeout(() => {
            if (this.dom.btnCopyDiagnostics) this.dom.btnCopyDiagnostics.textContent = orig;
          }, 1500);
        }
      }).catch(err => {
        console.warn('[NetworkReconciliationHUD] Failed to copy diagnostics:', err);
      });
    }
    return data;
  }

  adjustLatency(direction) {
    const step = this.adjustStepMs || 10;
    this.adjustLatencyMs(direction * step);
  }

  adjustLatencyMs(deltaLatencyMs) {
    if (!this.channel) return;
    const currentRtt = this.channel.rttMs ?? 0;
    const currentLatency = Math.round(currentRtt * 0.5);
    const newLatency = Math.max(0, Math.min(500, currentLatency + deltaLatencyMs));
    const newRtt = newLatency * 2;
    if (this.channel.setExtraLatency) {
      this.channel.setExtraLatency(newLatency);
    } else {
      this.channel.setRtt(newRtt);
    }
    if (this.reconciler) {
      this.reconciler.leadTicks = this.reconciler.calculateLeadTicks(newRtt);
    }
    this.syncLatencyValues();
  }

  adjustRtt(deltaMs) {
    this.adjustLatencyMs(Math.round(deltaMs * 0.5));
  }

  syncLatencyValues() {
    const realRtt = this.channel?.rttMs ?? 0;
    const extraLatency = Math.round(realRtt * 0.5);
    if (this.dom?.sliderRtt) {
      this.dom.sliderRtt.value = extraLatency;
      this.dom.txtSliderRtt.textContent = `+${extraLatency}ms (RTT ${realRtt}ms)`;
    }
    if (this.dom?.valRtt) {
      const measured = this.channel?.measuredRttMs ? `${this.channel.measuredRttMs.toFixed(1)}ms` : `${realRtt}ms`;
      this.dom.valRtt.textContent = `${measured} (+${extraLatency}ms extra)`;
    }
  }

  dropPacketBurst(count = null) {
    const pkts = Math.max(1, Math.min(30, count ?? this.burstDropCount ?? 5));
    if (this.channel) {
      this.channel.forceDropNextInput?.(pkts);
    }
    if (this.dom?.badge) {
      const originalBadge = this.dom.badge.textContent;
      this.dom.badge.textContent = `DROPPED ${pkts} PKTS`;
      this.dom.badge.style.background = '#da3633';
      setTimeout(() => {
        if (this.dom?.badge) {
          this.dom.badge.textContent = originalBadge || '120Hz SYNC';
          this.dom.badge.style.background = 'rgba(163, 113, 247, 0.25)';
        }
      }, 1200);
    }
  }

  dropSinglePacket() {
    this.dropPacketBurst(this.burstDropCount ?? 5);
  }

  makeDraggable(handle) {
    let startX = 0, startY = 0, initialX = 0, initialY = 0;
    const onMouseDown = (e) => {
      if (e.target.closest('.net-actions')) return;
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
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  show() {
    if (this.root) {
      this.root.hidden = false;
      this.visible = true;
    }
  }

  hide() {
    if (this.root) {
      this.root.hidden = true;
      this.visible = false;
    }
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  toggleMinimize() {
    this.minimized = !this.minimized;
    this.dom.body.style.display = this.minimized ? 'none' : 'flex';
    this.dom.btnMinimize.textContent = this.minimized ? '+' : '_';
  }

  update(metrics) {
    if (!this.visible || this.minimized) return;

    const realRtt = metrics.rttMs ?? (this.channel?.rttMs ?? 0);
    const measuredRtt = this.channel?.measuredRttMs ? this.channel.measuredRttMs.toFixed(1) : Math.round(realRtt * 0.5);
    const extraLatency = Math.round(realRtt * 0.5);
    this.dom.valRtt.textContent = `${measuredRtt} ms (+${extraLatency}ms extra)`;
    this.dom.valLoss.textContent = `${((this.channel?.packetLossRate ?? 0) * 100).toFixed(1)} %`;

    const clientTick = metrics.clientTick ?? 0;
    const serverTick = metrics.serverTick ?? 0;
    const leadDelta = clientTick - serverTick;
    const sign = leadDelta >= 0 ? '+' : '';
    this.dom.valTicks.textContent = `${clientTick} / ${serverTick} (${sign}${leadDelta} ticks)`;

    this.dom.valLead.textContent = `${metrics.leadTicks ?? 0} ticks`;
    this.dom.valCorrections.textContent = `${metrics.totalCorrections ?? 0}`;
    this.dom.valLastError.textContent = `${(metrics.lastCorrectionDelta ?? 0).toFixed(2)} UU`;
    this.dom.valMaxError.textContent = `${(metrics.maxCorrectionDelta ?? 0).toFixed(2)} UU`;

    if (this.headlessClient) {
      const hRtt = this.headlessClient.rttMs ?? 0;
      const hLatency = Math.round(hRtt * 0.5);
      this.dom.valHeadlessRtt.textContent = `${hLatency} ms (RTT ${hRtt} ms)`;
    }

    if (this.reconciler?.enableSmoothing) {
      this.dom.valSmoothing.textContent = `${(metrics.smoothingMagnitude ?? 0).toFixed(2)} UU`;
      this.dom.valSmoothing.className = 'net-cell-value net-cell-value--amber';
    } else {
      this.dom.valSmoothing.textContent = 'OFF (0.00)';
      this.dom.valSmoothing.className = 'net-cell-value';
    }
  }

  destroy() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}

export default NetworkReconciliationHUD;
