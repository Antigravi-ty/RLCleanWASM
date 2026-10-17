export const MINIMUM_LOADER_HTML = `
  <div class="hig-loader-backdrop">
    <div class="hig-glow hig-glow-top"></div>
    <div class="hig-glow hig-glow-bottom"></div>
  </div>

  <div class="hig-loader-content">
    <!-- Top Header: Brand & Identity -->
    <div class="hig-brand-header">
      <div class="hig-emblem-badge">
        <span class="hig-emblem-text">RL</span>
      </div>
      <div class="hig-brand-meta">
        <h1 class="hig-brand-title">CAR SOCCER</h1>
        <span class="hig-brand-sub">HIGH-PERFORMANCE WASM RUNTIME</span>
      </div>
    </div>

    <!-- Center: Dual Progress Bar Core -->
    <div class="hig-dual-card">
      <!-- 1. Layer One: Overall Pipeline Progress -->
      <div class="hig-layer hig-layer-overall">
        <div class="hig-layer-header">
          <div class="hig-layer-meta">
            <span class="hig-stage-badge" id="hig-stage-indicator">STAGE 1 OF 7</span>
            <span class="hig-separator">•</span>
            <span class="hig-stage-name" id="hig-stage-title">Security Preflight</span>
          </div>
          <span class="hig-overall-pct" id="hig-overall-percent">0%</span>
        </div>
        <div class="hig-track hig-track-primary">
          <div class="hig-fill hig-fill-primary" id="hig-primary-fill" style="width: 0%;"></div>
        </div>
      </div>

      <!-- 2. Layer Two: Active Micro-Step Progress -->
      <div class="hig-layer hig-layer-micro">
        <div class="hig-layer-header">
          <span class="hig-task-title" id="hig-task-name">Initializing Bootstrap Runtime...</span>
          <span class="hig-task-status-badge" id="hig-task-status-badge">INDETERMINATE</span>
        </div>

        <!-- Lower Progress Bar Track: Switches between Determinate Fill and Indeterminate Shimmer -->
        <div class="hig-track hig-track-secondary" id="hig-secondary-track">
          <div class="hig-fill hig-fill-secondary hig-shimmer" id="hig-secondary-fill" style="width: 100%;"></div>
        </div>

        <!-- Micro Metrics Subtext (Bytes, Speed or Hint) -->
        <div class="hig-micro-footer">
          <span class="hig-micro-detail" id="hig-micro-detail">Verifying POV Camera Microkernel SHA-256 and linear memory...</span>
          <span class="hig-micro-rate" id="hig-micro-rate"></span>
        </div>
      </div>

      <!-- Error Alert Container (Hidden by default) -->
      <div class="hig-error-card" id="hig-error-card" style="display: none;">
        <div class="hig-error-header">
          <span class="hig-error-code" id="hig-error-code">ERR_BOOTSTRAP_FAILURE</span>
          <span class="hig-error-badge">Fatal Pipeline Error</span>
        </div>
        <h4 class="hig-error-title" id="hig-error-title">Startup Pipeline Interrupted</h4>
        <p class="hig-error-message" id="hig-error-message"></p>
        <pre class="hig-error-tech" id="hig-error-tech"></pre>
      </div>
    </div>

    <!-- Bottom Footer: System Telemetry Meta -->
    <div class="hig-brand-footer">
      <div class="hig-telemetry-pill">
        <span class="hig-telemetry-dot"></span>
        <span class="hig-telemetry-label" id="hig-telemetry-label">WASM SIMD 128-bit • WebGL2 Core • 120Hz Clock</span>
      </div>
    </div>
  </div>
`;

export const MINIMUM_LOADER_CSS = `
  #minimum-engine-loader {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: #09090b;
    color: #f4f4f5;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    user-select: none;
    overflow: hidden;
    transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hig-loader-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .hig-glow {
    position: absolute;
    border-radius: 9999px;
    filter: blur(100px);
    opacity: 0.15;
  }
  .hig-glow-top {
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    width: 480px;
    height: 260px;
    background: #f59e0b;
  }
  .hig-glow-bottom {
    bottom: 20%;
    left: 50%;
    transform: translateX(-50%);
    width: 540px;
    height: 280px;
    background: #0284c7;
  }
  .hig-loader-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 580px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }
  .hig-brand-header {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .hig-emblem-badge {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);
  }
  .hig-emblem-text {
    font-weight: 900;
    font-size: 20px;
    color: #09090b;
    letter-spacing: -0.5px;
  }
  .hig-brand-meta {
    display: flex;
    flex-direction: column;
  }
  .hig-brand-title {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -0.5px;
    margin: 0;
    color: #ffffff;
  }
  .hig-brand-sub {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: #71717a;
    text-transform: uppercase;
  }
  .hig-dual-card {
    width: 100%;
    background: rgba(18, 18, 22, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .hig-layer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hig-layer-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: 12px;
  }
  .hig-layer-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .hig-stage-badge {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #a1a1aa;
  }
  .hig-separator {
    color: #52525b;
  }
  .hig-stage-name {
    font-size: 12px;
    font-weight: 700;
    color: #e4e4e7;
  }
  .hig-overall-pct {
    font-size: 13px;
    font-weight: 800;
    color: #f59e0b;
    font-variant-numeric: tabular-nums;
  }
  .hig-track {
    width: 100%;
    border-radius: 9999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
    position: relative;
  }
  .hig-track-primary {
    height: 6px;
  }
  .hig-track-secondary {
    height: 4px;
  }
  .hig-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hig-fill-primary {
    background: #f59e0b;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
  }
  .hig-fill-secondary {
    background: #38bdf8;
  }
  .hig-task-title {
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 380px;
  }
  .hig-task-status-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
    letter-spacing: 0.5px;
  }
  .hig-task-status-badge.determinate {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
  }
  .hig-micro-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #71717a;
  }
  .hig-micro-detail {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400px;
  }
  .hig-micro-rate {
    color: #a1a1aa;
    font-variant-numeric: tabular-nums;
    shrink: 0;
  }
  @keyframes hig-shimmer-anim {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .hig-shimmer {
    width: 100% !important;
    background: linear-gradient(90deg, 
      rgba(56, 189, 248, 0.15) 0%, 
      rgba(56, 189, 248, 0.85) 50%, 
      rgba(56, 189, 248, 0.15) 100%
    );
    background-size: 200% 100%;
    animation: hig-shimmer-anim 1.5s infinite linear;
  }
  .hig-error-card {
    margin-top: 10px;
    padding: 16px;
    border-radius: 12px;
    background: rgba(46, 8, 13, 0.95);
    border: 1px solid #ef4444;
    box-shadow: 0 12px 32px rgba(239, 68, 68, 0.25);
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: hig-error-pop 0.2s ease-out;
  }
  @keyframes hig-error-pop {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }
  .hig-error-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hig-error-code {
    font-size: 10px;
    font-weight: 800;
    color: #f87171;
    letter-spacing: 0.5px;
  }
  .hig-error-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  .hig-error-title {
    font-size: 13px;
    font-weight: 800;
    color: #fecaca;
    margin: 0;
  }
  .hig-error-message {
    font-size: 11px;
    line-height: 1.5;
    color: #cbd5e1;
    margin: 0;
  }
  .hig-error-tech {
    margin: 4px 0 0 0;
    padding: 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #fee2e2;
    font-size: 10px;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  .hig-brand-footer {
    display: flex;
    align-items: center;
  }
  .hig-telemetry-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    font-size: 10px;
    color: #71717a;
  }
  .hig-telemetry-dot {
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }
`;
