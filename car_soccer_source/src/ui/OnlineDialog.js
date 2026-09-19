/**
 * src/ui/OnlineDialog.js
 * Comprehensive WebRTC Multiplayer Dialog & Host Room Control Panel.
 * 
 * Flow:
 * - Lobby view: Edit Player Name (or random UUID), choose "Host a Server" or "Join a Server".
 * - "Host a Server": Spawns dedicated 120Hz Web Worker on-demand, connects host locally (0ms extra latency),
 *   opens Host Room Control Panel with Step-by-Step manual signaling token copy/paste and BroadcastChannel auto-discovery.
 * - "Join a Server": Ingests Host Offer Token, generates Answer Token, guides user through copy/paste handshake.
 * - Live connection status, 1-click token copying, peer connection confirmation, and network controller launcher.
 */

import { P2PWebRTCChannel, encodeSignalToken, decodeSignalToken } from '../network/P2PWebRTCChannel.js';

export class OnlineDialog {
  /**
   * @param {HTMLElement} container
   * @param {object} callbacks
   * @param {(opts: { playerName: string }) => Promise<void>} callbacks.onHostServer
   * @param {(opts: { channel: P2PWebRTCChannel, playerName: string, remotePlayerName: string }) => Promise<void>} callbacks.onJoinServer
   * @param {() => void} callbacks.onOpenNetworkHUD
   * @param {() => void} [callbacks.onClose]
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.isOpen = false;
    this.view = 'lobby'; // 'lobby' | 'host' | 'join'
    this.playerName = this._loadPlayerName();

    // Active channels
    this.hostP2PChannel = null;
    this.clientP2PChannel = null;

    this.offerToken = '';
    this.answerToken = '';
    this.detectedLocalHost = null;

    this.root = null;
    this.dom = {};

    this._initBroadcastDiscovery();
    this.initDOM();
  }

  _loadPlayerName() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('car-soccer:player-name');
      if (saved && saved.trim()) return saved.trim();
    }
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `Striker-${rand}`;
  }

  _savePlayerName(name) {
    this.playerName = (name || 'Player').trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('car-soccer:player-name', this.playerName);
    }
  }

  _initBroadcastDiscovery() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.discoveryChannel = new BroadcastChannel('car_soccer_online_discovery');
        this.discoveryChannel.onmessage = (e) => {
          const data = e.data;
          if (data?.type === 'host_available') {
            this.detectedLocalHost = data;
            this._renderLocalHostNotice();
          }
        };
      } catch (_) {}
    }
  }

  initDOM() {
    const styleId = 'online-dialog-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .online-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 7, 13, 0.78);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 99990;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          user-select: none;
        }
        .online-modal {
          background: rgba(13, 17, 23, 0.96);
          border: 1px solid rgba(88, 166, 255, 0.35);
          border-radius: 12px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 0 0 24px rgba(88, 166, 255, 0.15);
          width: 580px;
          max-width: 95vw;
          max-height: 90vh;
          overflow-y: auto;
          color: #e6edf3;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .online-header {
          padding: 16px 20px;
          background: rgba(22, 27, 34, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .online-header-title {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #58a6ff;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .online-header-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: rgba(88, 166, 255, 0.15);
          color: #58a6ff;
          border: 1px solid rgba(88, 166, 255, 0.4);
          padding: 2px 7px;
          border-radius: 4px;
        }
        .online-close-btn {
          background: transparent;
          border: none;
          color: #8b949e;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          line-height: 1;
        }
        .online-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .online-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .online-card-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .online-mode-card {
          background: rgba(22, 27, 34, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: pointer;
          transition: transform 0.15s, border-color 0.15s, background 0.15s;
        }
        .online-mode-card:hover {
          transform: translateY(-2px);
          border-color: #58a6ff;
          background: rgba(88, 166, 255, 0.08);
        }
        .online-mode-card--accent:hover {
          border-color: #a371f7;
          background: rgba(163, 113, 247, 0.08);
        }
        .online-card-icon {
          font-size: 24px;
        }
        .online-card-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
        }
        .online-card-desc {
          font-size: 12px;
          color: #8b949e;
          line-height: 1.4;
        }
        .online-step-box {
          background: rgba(22, 27, 34, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .online-step-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
        }
        .online-step-num {
          background: #388bfd;
          color: #ffffff;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
        }
        .online-step-num--green {
          background: #2ea043;
        }
        .online-step-num--purple {
          background: #8957e5;
        }
        .online-textarea {
          width: 100%;
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #58a6ff;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 11px;
          padding: 8px;
          resize: none;
          box-sizing: border-box;
        }
        .online-textarea:focus {
          outline: 1px solid #58a6ff;
          border-color: #58a6ff;
        }
        .online-input {
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #ffffff;
          padding: 8px 12px;
          font-size: 13px;
          width: 100%;
          box-sizing: border-box;
        }
        .online-input:focus {
          outline: 1px solid #58a6ff;
        }
        .online-btn {
          background: #238636;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.15s;
        }
        .online-btn:hover {
          background: #2ea043;
        }
        .online-btn--blue {
          background: #1f6feb;
        }
        .online-btn--blue:hover {
          background: #388bfd;
        }
        .online-btn--purple {
          background: #8957e5;
        }
        .online-btn--purple:hover {
          background: #a371f7;
        }
        .online-btn--secondary {
          background: #21262d;
          color: #c9d1d9;
          border: 1px solid rgba(240, 246, 252, 0.1);
        }
        .online-btn--secondary:hover {
          background: #30363d;
          color: #ffffff;
        }
        .online-btn--danger {
          background: #da3633;
        }
        .online-btn--danger:hover {
          background: #f85149;
        }
        .online-status-banner {
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .online-status-banner--info {
          background: rgba(56, 139, 253, 0.15);
          border: 1px solid rgba(56, 139, 253, 0.35);
          color: #79c0ff;
        }
        .online-status-banner--success {
          background: rgba(46, 160, 67, 0.15);
          border: 1px solid rgba(46, 160, 67, 0.35);
          color: #56d364;
        }
        .online-tab-btn {
          position: fixed;
          right: max(24px, var(--safe-right, 24px));
          bottom: calc(max(26px, var(--safe-bottom, 26px)) + 84px);
          z-index: 40;
          display: flex;
          align-items: center;
          gap: 10px;
          width: 190px;
          min-height: 60px;
          padding: 10px 16px;
          border: 3px solid #000000;
          border-radius: 10px;
          background: #58a6ff;
          color: #000000;
          box-shadow: 0 5px 0 #000000;
          cursor: pointer;
          transition: transform 0.15s, background 0.15s;
          font-family: var(--sans, sans-serif);
          text-align: left;
        }
        .online-tab-btn:hover {
          transform: translateY(-2px);
          background: #79c0ff;
        }
        .online-tab-btn:active {
          transform: translateY(2px);
        }
      `;
      document.head.appendChild(style);
    }

    // Trigger button on main HUD
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'online-button';
    triggerBtn.className = 'online-tab-btn';
    triggerBtn.type = 'button';
    triggerBtn.setAttribute('aria-label', 'Play Online');
    triggerBtn.innerHTML = `
      <div style="font-size:22px;">🌐</div>
      <div>
        <div style="font-size:16px;font-weight:900;line-height:1;letter-spacing:0.02em;">PLAY ONLINE</div>
        <div style="font-size:10px;font-weight:700;opacity:0.85;margin-top:2px;">CROSS-TAB WEBRTC</div>
      </div>
      <div style="margin-left:auto;font-size:9px;font-weight:800;opacity:0.75;background:rgba(0,0,0,0.15);padding:2px 4px;border-radius:3px;">[O]</div>
    `;
    triggerBtn.addEventListener('click', () => this.open());
    this.container.appendChild(triggerBtn);
    this.triggerBtn = triggerBtn;

    // Modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'online-overlay';
    overlay.className = 'online-overlay';
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="online-modal" data-el="modal">
        <div class="online-header">
          <div class="online-header-title">
            <span>🌐 MULTIPLAYER ARENA</span>
            <span class="online-header-badge" data-el="badge">120Hz P2P</span>
          </div>
          <button class="online-close-btn" data-el="btnClose" title="Close (Esc)">✕</button>
        </div>
        <div class="online-body" data-el="content">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    this.container.appendChild(overlay);
    this.root = overlay;

    this.dom = {
      modal: overlay.querySelector('[data-el="modal"]'),
      content: overlay.querySelector('[data-el="content"]'),
      badge: overlay.querySelector('[data-el="badge"]'),
      btnClose: overlay.querySelector('[data-el="btnClose"]')
    };

    this.dom.btnClose.addEventListener('click', () => this.close());
  }

  open(view = 'lobby') {
    this.view = view;
    this.render();
    if (this.root) {
      this.root.hidden = false;
      this.isOpen = true;
    }
  }

  close() {
    if (this.root) {
      this.root.hidden = true;
      this.isOpen = false;
    }
    this.callbacks.onClose?.();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  render() {
    if (!this.dom.content) return;
    if (this.view === 'lobby') {
      this._renderLobbyView();
    } else if (this.view === 'host') {
      this._renderHostView();
    } else if (this.view === 'join') {
      this._renderJoinView();
    }
  }

  _renderLobbyView() {
    this.dom.badge.textContent = '120Hz P2P';
    this.dom.badge.style.borderColor = 'rgba(88, 166, 255, 0.4)';
    this.dom.badge.style.color = '#58a6ff';

    this.dom.content.innerHTML = `
      <div>
        <label style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Player Call-Sign / Name</label>
        <input type="text" class="online-input" data-el="inpPlayerName" value="${this.playerName}" maxlength="24" placeholder="Enter player name..." />
      </div>

      <div class="online-card-grid">
        <div class="online-mode-card online-mode-card--accent" data-el="cardHost">
          <div class="online-card-icon">🛡️</div>
          <div class="online-card-title">HOST A SERVER</div>
          <div class="online-card-desc">
            Instantiates a dedicated <b>120Hz Web Worker</b> server on-demand. Tab throttling immune. Auto-joins as Car 0 (0ms local latency).
          </div>
          <button class="online-btn online-btn--purple" style="margin-top:auto;">Start Hosting</button>
        </div>

        <div class="online-mode-card" data-el="cardJoin">
          <div class="online-card-icon">🔗</div>
          <div class="online-card-title">JOIN A SERVER</div>
          <div class="online-card-desc">
            Connects to an existing Host via manual WebRTC tokens or instant BroadcastChannel cross-tab discovery. Plays as Car 1.
          </div>
          <button class="online-btn online-btn--blue" style="margin-top:auto;">Join Game</button>
        </div>
      </div>

      <div id="local-host-notice"></div>

      <div class="online-status-banner online-status-banner--info">
        <span>⚡</span>
        <div><b>Pure Peer-to-Peer:</b> Direct WebRTC RTCDataChannel (unreliable/unordered UDP) at 120Hz report rates. No 3rd-party signaling servers required.</div>
      </div>
    `;

    const inpName = this.dom.content.querySelector('[data-el="inpPlayerName"]');
    inpName?.addEventListener('input', (e) => {
      this._savePlayerName(e.target.value);
    });

    this.dom.content.querySelector('[data-el="cardHost"]')?.addEventListener('click', () => {
      this._startHosting();
    });

    this.dom.content.querySelector('[data-el="cardJoin"]')?.addEventListener('click', () => {
      this.view = 'join';
      this.render();
    });

    this._renderLocalHostNotice();
  }

  _renderLocalHostNotice() {
    const noticeEl = this.dom.content.querySelector('#local-host-notice');
    if (!noticeEl || !this.detectedLocalHost) return;

    noticeEl.innerHTML = `
      <div class="online-status-banner online-status-banner--success" style="justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>🎉</span>
          <div>Found nearby Host: <b>${this.detectedLocalHost.hostName}</b> (Local Tab)</div>
        </div>
        <button class="online-btn online-btn--blue" data-el="btnInstantJoin" style="padding:4px 10px;font-size:11px;">⚡ 1-Click Join</button>
      </div>
    `;

    noticeEl.querySelector('[data-el="btnInstantJoin"]')?.addEventListener('click', () => {
      this.view = 'join';
      this.render();
      const inp = this.dom.content.querySelector('[data-el="txtOfferInput"]');
      if (inp) {
        inp.value = this.detectedLocalHost.token;
      }
      this._handleGenerateAnswer();
    });
  }

  async _startHosting() {
    this.view = 'host';
    this.render();

    try {
      // 1. Tell GameRuntime to spin up dedicated AuthoritativeServerWorker client on-demand!
      if (this.callbacks.onHostServer) {
        await this.callbacks.onHostServer({ playerName: this.playerName });
      }

      // 2. Create WebRTC channel for peer invites
      this.hostP2PChannel = new P2PWebRTCChannel({
        role: 'host',
        playerName: this.playerName,
        extraLatencyMs: 0
      });

      this.hostP2PChannel.onConnected = () => {
        this._updateHostPeerStatus('connected');
      };

      this.hostP2PChannel.onDisconnected = () => {
        this._updateHostPeerStatus('disconnected');
      };

      // 3. Generate self-contained Offer Token
      this.offerToken = await this.hostP2PChannel.createOfferToken();
      this._renderHostView();

      // Broadcast discovery advertisement
      if (this.discoveryChannel) {
        this.discoveryChannel.postMessage({
          type: 'host_available',
          hostName: this.playerName,
          token: this.offerToken
        });
      }
    } catch (err) {
      console.error('[OnlineDialog] Failed to host server:', err);
      alert('Failed to host server: ' + err.message);
      this.view = 'lobby';
      this.render();
    }
  }

  _renderHostView() {
    this.dom.badge.textContent = 'HOST (120Hz WORKER)';
    this.dom.badge.style.borderColor = '#a371f7';
    this.dom.badge.style.color = '#d2a8ff';

    const isConnected = this.hostP2PChannel?.isOpen;

    this.dom.content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;">Room Host Control Panel</div>
          <div style="font-size:12px;color:#8b949e;">Server physics running in dedicated background worker thread</div>
        </div>
        <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(56,139,253,0.1);border:1px solid rgba(56,139,253,0.3);padding:10px;border-radius:6px;">
          <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;">Player 1 (Host · Car 0)</div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">${this.playerName}</div>
          <div style="font-size:11px;color:#3fb950;margin-top:2px;">● Local Loopback (0ms latency)</div>
        </div>

        <div style="background:rgba(235,115,0,0.1);border:1px solid rgba(235,115,0,0.3);padding:10px;border-radius:6px;">
          <div style="font-size:10px;font-weight:700;color:#ff9b44;text-transform:uppercase;">Player 2 (Opponent · Car 1)</div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;" data-el="txtPeerStatus">
            ${isConnected ? (this.hostP2PChannel?.peerName || 'Connected Player') : 'Waiting for connection...'}
          </div>
          <div style="font-size:11px;color:${isConnected ? '#3fb950' : '#8b949e'};margin-top:2px;" data-el="txtPeerSub">
            ${isConnected ? '● Connected via WebRTC 120Hz' : '○ Standby for Answer Token'}
          </div>
        </div>
      </div>

      ${isConnected ? `
        <div class="online-status-banner online-status-banner--success">
          <span>🎉</span>
          <div><b>Player 2 Connected!</b> Real-time 120Hz match active.</div>
        </div>
      ` : `
        <div class="online-step-box">
          <div class="online-step-header">
            <span class="online-step-num ${this.offerToken ? 'online-step-num--green' : ''}">1</span>
            <span>Copy Offer Token and send to Player 2</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <textarea class="online-textarea" rows="2" readonly data-el="txtOfferToken">${this.offerToken || 'Generating Offer token...'}</textarea>
            <button class="online-btn online-btn--blue" data-el="btnCopyOffer" style="white-space:nowrap;">📋 Copy Offer</button>
          </div>
        </div>

        <div class="online-step-box">
          <div class="online-step-header">
            <span class="online-step-num online-step-num--purple">2</span>
            <span>Paste Player 2's Answer Token below & Connect</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <textarea class="online-textarea" rows="2" placeholder="Paste Player 2's Answer Token here..." data-el="txtAnswerInput"></textarea>
            <button class="online-btn online-btn--purple" data-el="btnConfirmAnswer" style="white-space:nowrap;">🔗 Connect</button>
          </div>
        </div>
      `}

      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="online-btn online-btn--secondary" data-el="btnOpenNetworkHUD" style="flex:1;">📊 Network Diagnostics</button>
        <button class="online-btn online-btn--blue" data-el="btnEnterArena" style="flex:1;">🚗 Enter Field</button>
      </div>
    `;

    this.dom.content.querySelector('[data-el="btnBackLobby"]')?.addEventListener('click', () => {
      this.view = 'lobby';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnCopyOffer"]')?.addEventListener('click', () => {
      if (this.offerToken && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(this.offerToken);
        const btn = this.dom.content.querySelector('[data-el="btnCopyOffer"]');
        if (btn) {
          btn.textContent = '✅ Copied!';
          setTimeout(() => { if (btn) btn.textContent = '📋 Copy Offer'; }, 1500);
        }
      }
    });

    this.dom.content.querySelector('[data-el="btnConfirmAnswer"]')?.addEventListener('click', async () => {
      const inp = this.dom.content.querySelector('[data-el="txtAnswerInput"]');
      const token = inp?.value?.trim();
      if (!token) {
        alert('Please paste the Answer Token received from Player 2');
        return;
      }
      try {
        await this.hostP2PChannel.acceptAnswerToken(token);
        const btn = this.dom.content.querySelector('[data-el="btnConfirmAnswer"]');
        if (btn) btn.textContent = '⏳ Connecting...';
      } catch (err) {
        alert('Failed to connect with Answer Token: ' + err.message);
      }
    });

    this.dom.content.querySelector('[data-el="btnOpenNetworkHUD"]')?.addEventListener('click', () => {
      this.callbacks.onOpenNetworkHUD?.();
    });

    this.dom.content.querySelector('[data-el="btnEnterArena"]')?.addEventListener('click', () => {
      this.close();
    });
  }

  _updateHostPeerStatus(status) {
    if (this.view === 'host') {
      this._renderHostView();
    }
  }

  _renderJoinView() {
    this.dom.badge.textContent = 'JOIN SERVER';
    this.dom.badge.style.borderColor = '#58a6ff';
    this.dom.badge.style.color = '#58a6ff';

    const isConnected = this.clientP2PChannel?.isOpen;

    this.dom.content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;">Join a Server (WebRTC)</div>
          <div style="font-size:12px;color:#8b949e;">Connect to Host as Car 1 (Orange Team)</div>
        </div>
        <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
      </div>

      <div style="background:rgba(235,115,0,0.1);border:1px solid rgba(235,115,0,0.3);padding:10px;border-radius:6px;">
        <div style="font-size:10px;font-weight:700;color:#ff9b44;text-transform:uppercase;">Your Seat (Car 1 · Orange Team)</div>
        <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">${this.playerName}</div>
      </div>

      ${isConnected ? `
        <div class="online-status-banner online-status-banner--success">
          <span>🎉</span>
          <div><b>Connected to Host!</b> Physics timeline synchronized at 120Hz.</div>
        </div>
      ` : `
        <div class="online-step-box">
          <div class="online-step-header">
            <span class="online-step-num">1</span>
            <span>Paste the Host's Offer Token here</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <textarea class="online-textarea" rows="2" placeholder="Paste Host Offer Token here..." data-el="txtOfferInput"></textarea>
            <button class="online-btn online-btn--blue" data-el="btnGenerateAnswer" style="white-space:nowrap;">⚡ Generate Answer</button>
          </div>
        </div>

        <div class="online-step-box" data-el="boxAnswerStep" style="${this.answerToken ? '' : 'opacity:0.6;pointer-events:none;'}">
          <div class="online-step-header">
            <span class="online-step-num ${this.answerToken ? 'online-step-num--green' : ''}">2</span>
            <span>Copy this Answer Token and send it back to the Host</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <textarea class="online-textarea" rows="2" readonly data-el="txtAnswerToken">${this.answerToken || 'Click "Generate Answer" above...'}</textarea>
            <button class="online-btn online-btn--purple" data-el="btnCopyAnswer" style="white-space:nowrap;">📋 Copy Answer</button>
          </div>
        </div>
      `}

      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="online-btn online-btn--secondary" data-el="btnOpenNetworkHUD" style="flex:1;">📊 Network Diagnostics</button>
        <button class="online-btn online-btn--blue" data-el="btnEnterArena" style="flex:1;">🚗 Enter Field</button>
      </div>
    `;

    this.dom.content.querySelector('[data-el="btnBackLobby"]')?.addEventListener('click', () => {
      this.view = 'lobby';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnGenerateAnswer"]')?.addEventListener('click', () => {
      this._handleGenerateAnswer();
    });

    this.dom.content.querySelector('[data-el="btnCopyAnswer"]')?.addEventListener('click', () => {
      if (this.answerToken && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(this.answerToken);
        const btn = this.dom.content.querySelector('[data-el="btnCopyAnswer"]');
        if (btn) {
          btn.textContent = '✅ Copied!';
          setTimeout(() => { if (btn) btn.textContent = '📋 Copy Answer'; }, 1500);
        }
      }
    });

    this.dom.content.querySelector('[data-el="btnOpenNetworkHUD"]')?.addEventListener('click', () => {
      this.callbacks.onOpenNetworkHUD?.();
    });

    this.dom.content.querySelector('[data-el="btnEnterArena"]')?.addEventListener('click', () => {
      this.close();
    });
  }

  async _handleGenerateAnswer() {
    const inp = this.dom.content.querySelector('[data-el="txtOfferInput"]');
    const offer = inp?.value?.trim();
    if (!offer) {
      alert('Please paste the Offer Token from the Host first');
      return;
    }

    try {
      this.clientP2PChannel = new P2PWebRTCChannel({
        role: 'client',
        playerName: this.playerName,
        extraLatencyMs: 0
      });

      this.clientP2PChannel.onConnected = async () => {
        if (this.callbacks.onJoinServer) {
          await this.callbacks.onJoinServer({
            channel: this.clientP2PChannel,
            playerName: this.playerName,
            remotePlayerName: 'Host'
          });
        }
        this._renderJoinView();
      };

      this.answerToken = await this.clientP2PChannel.acceptOfferAndCreateAnswer(offer);
      this._renderJoinView();
    } catch (err) {
      console.error('[OnlineDialog] Failed to generate answer:', err);
      alert('Failed to generate answer: ' + err.message);
    }
  }

  destroy() {
    try { this.hostP2PChannel?.destroy(); } catch (_) {}
    try { this.clientP2PChannel?.destroy(); } catch (_) {}
    try { this.discoveryChannel?.close(); } catch (_) {}
    if (this.triggerBtn?.parentElement) {
      this.triggerBtn.parentElement.removeChild(this.triggerBtn);
    }
    if (this.root?.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }
}

export default OnlineDialog;
