/**
 * src/ui/OnlineDialog.js
 * Comprehensive WebRTC Multiplayer Dialog & Host Room Control Panel.
 * 
 * Flow:
 * - Lobby view: Edit Player Name, view nearby hosts, choose "Host a Server" or "Join a Server".
 * - "Host a Server": Spawns dedicated 120Hz Web Worker on-demand, connects host locally (0ms latency),
 *   opens Host Room Control Panel with 6-color palette picker (occupied slot locking),
 *   step-by-step token copy/paste, and persistent cross-tab auto-discovery.
 * - "Join a Server": Ingests Host Offer Token, selects available team color, generates Answer Token,
 *   supports 1-click nearby auto-join and manual copy/paste handshake.
 * - Non-blocking copyable error cards (zero blocking alerts), live 120Hz status confirmations.
 */

import { P2PWebRTCChannel, encodeSignalToken, decodeSignalToken } from '../network/P2PWebRTCChannel.js';
import { CAR_COLOR_SLOTS, getCarColorSlotById } from '../entities/CarColorConstants.js';

export class OnlineDialog {
  /**
   * @param {HTMLElement} container
   * @param {object} callbacks
   * @param {(opts: { playerName: string }) => Promise<void>} callbacks.onHostServer
   * @param {(opts: { channel: P2PWebRTCChannel, playerName: string, remotePlayerName: string }) => Promise<void>} callbacks.onJoinServer
   * @param {(channel: P2PWebRTCChannel, remotePlayerName: string) => Promise<void>} callbacks.onPeerConnected
   * @param {() => void} callbacks.onOpenNetworkHUD
   * @param {(isOpen: boolean) => void} [callbacks.onOpenChange]
   * @param {() => void} [callbacks.onClose]
   * @param {(carIndex: number, slotId: number, hex: string) => void} [callbacks.onColorSelect]
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.isOpen = false;
    this.view = 'lobby'; // 'lobby' | 'host' | 'join'
    this.playerName = this._loadPlayerName();

    // Active color slots
    // Host defaults to Slot 3 (Blue #42a5f5, Team Blue)
    // Client defaults to Slot 0 (Red #ff7043, Team Orange/Red)
    this.hostColorSlot = 3;
    this.hostColorHex = CAR_COLOR_SLOTS[3].hex;
    this.clientColorSlot = 0;
    this.clientColorHex = CAR_COLOR_SLOTS[0].hex;

    // Active channels
    this.hostP2PChannel = null;
    this.clientP2PChannel = null;

    this.offerToken = '';
    this.answerToken = '';
    this.detectedLocalHost = null;
    this.discoveredHostColorSlot = null;
    this.discoveryHeartbeat = null;
    this.currentError = null;

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
          if (!data) return;

          if (data.type === 'host_available') {
            this.detectedLocalHost = data;
            if (data.colorSlot !== undefined) {
              this.discoveredHostColorSlot = data.colorSlot;
              if (this.clientColorSlot === this.discoveredHostColorSlot) {
                this.clientColorSlot = (this.discoveredHostColorSlot + 3) % 6;
                this.clientColorHex = CAR_COLOR_SLOTS[this.clientColorSlot].hex;
                this.callbacks.onColorSelect?.(1, this.clientColorSlot, this.clientColorHex);
              }
            }
            this._renderLocalHostNotice();
            if (this.view === 'join') {
              this._renderJoinView();
            }
          } else if (data.type === 'query_host' && this.view === 'host' && this.offerToken) {
            // Reply with host availability
            this.discoveryChannel.postMessage({
              type: 'host_available',
              hostName: this.playerName,
              token: this.offerToken,
              colorSlot: this.hostColorSlot,
              colorHex: this.hostColorHex,
              timestamp: Date.now()
            });
          } else if (data.type === 'room_answer' && this.view === 'host' && this.hostP2PChannel) {
            // Auto-accept room answer if token matches
            if (data.answerToken && !this.hostP2PChannel.isOpen && this.hostP2PChannel.pc?.signalingState !== 'stable') {
              console.log('[OnlineDialog] Received auto-discovered room_answer via BroadcastChannel');
              this.hostP2PChannel.acceptAnswerToken(data.answerToken).catch(err => {
                console.warn('[OnlineDialog] Auto-accept answer failed:', err);
              });
            }
          } else if (data.type === 'host_closed') {
            if (this.detectedLocalHost?.hostName === data.hostName) {
              this.detectedLocalHost = null;
              this._renderLocalHostNotice();
            }
          }
        };
      } catch (_) {}
    }

    // Check localStorage active room on initialization
    this._checkLocalStorageRoom();
  }

  _checkLocalStorageRoom() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('car_soccer_active_host');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Date.now() - (data.timestamp || 0) < 10000) {
          this.detectedLocalHost = data;
          if (data.colorSlot !== undefined) {
            this.discoveredHostColorSlot = data.colorSlot;
          }
        }
      }
    } catch (_) {}
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
          user-select: auto;
        }
        .online-overlay[hidden] {
          display: none !important;
        }
        .online-modal {
          background: rgba(13, 17, 23, 0.96);
          border: 1px solid rgba(88, 166, 255, 0.35);
          border-radius: 12px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 0 0 24px rgba(88, 166, 255, 0.15);
          width: 600px;
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
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          line-height: 1;
          transition: background 0.15s, color 0.15s;
        }
        .online-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .online-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .online-btn {
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid transparent;
          transition: all 0.15s ease-in-out;
          text-decoration: none;
        }
        .online-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed !important;
        }
        .online-btn--blue {
          background: #238636;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.1);
        }
        .online-btn--blue:hover:not(:disabled) {
          background: #2ea043;
        }
        .online-btn--purple {
          background: #8957e5;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.1);
        }
        .online-btn--purple:hover:not(:disabled) {
          background: #9e6a03;
        }
        .online-btn--secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #c9d1d9;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .online-btn--secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }
        .online-input {
          background: rgba(1, 4, 9, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 8px 12px;
          color: #ffffff;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .online-input:focus {
          border-color: #58a6ff;
        }
        .online-textarea {
          background: rgba(1, 4, 9, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 8px 10px;
          color: #7ee787;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
          resize: none;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          user-select: text;
        }
        .online-textarea:focus {
          border-color: #58a6ff;
        }
        .online-step-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .online-step-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #c9d1d9;
        }
        .online-step-num {
          background: rgba(88, 166, 255, 0.2);
          color: #58a6ff;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
        }
        .online-step-num--purple {
          background: rgba(163, 113, 247, 0.2);
          color: #d2a8ff;
        }
        .online-step-num--green {
          background: rgba(63, 185, 80, 0.2);
          color: #3fb950;
        }
        .online-status-banner {
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .online-status-banner--success {
          background: rgba(46, 160, 67, 0.15);
          border: 1px solid rgba(46, 160, 67, 0.4);
          color: #3fb950;
        }
        .online-tab-btn {
          position: fixed;
          top: 16px;
          right: 320px;
          background: linear-gradient(135deg, #1f6feb 0%, #238636 100%);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), 0 0 12px rgba(31, 111, 235, 0.35);
          border-radius: 8px;
          padding: 6px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 9990;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .online-tab-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6), 0 0 16px rgba(31, 111, 235, 0.5);
        }

        /* Color palette grid & slot cards */
        .color-palette-title {
          font-size: 11px;
          font-weight: 700;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .color-palette-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          margin-top: 4px;
        }
        .color-swatch-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 4px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.12);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          user-select: none;
        }
        .color-swatch-card:hover:not(.is-occupied):not(.is-selected) {
          border-color: rgba(255, 255, 255, 0.45);
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-1px);
        }
        .color-swatch-card.is-selected {
          border-color: #58a6ff;
          background: rgba(56, 139, 253, 0.18);
          box-shadow: 0 0 10px rgba(56, 139, 253, 0.4);
        }
        .color-swatch-card.is-occupied {
          opacity: 0.45;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }
        .color-circle {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          margin-bottom: 4px;
          border: 2px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #fff;
          font-weight: 900;
        }
        .color-label {
          font-size: 10px;
          font-weight: 700;
          color: #c9d1d9;
          line-height: 1.2;
        }
        .color-team-tag {
          font-size: 8px;
          font-weight: 600;
          opacity: 0.75;
          margin-top: 2px;
        }
        .color-occupied-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #f85149;
          color: #fff;
          font-size: 7px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
        }

        /* Non-blocking copyable error banner */
        .online-error-box {
          background: rgba(248, 81, 73, 0.15);
          border: 1px solid rgba(248, 81, 73, 0.45);
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .online-error-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          color: #f85149;
        }
        .online-error-message {
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 11px;
          color: #ffb4a9;
          word-break: break-word;
          user-select: text;
          background: rgba(0, 0, 0, 0.35);
          padding: 6px 8px;
          border-radius: 4px;
        }
      `;
      document.head.appendChild(style);
    }

    // Floating HUD Trigger Button
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'online-button';
    triggerBtn.className = 'online-tab-btn';
    triggerBtn.setAttribute('title', 'Play Online (WebRTC) [O]');
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
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');

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

    this.dom.btnClose?.addEventListener('click', () => this.close());
  }

  open(view = 'lobby') {
    this.view = view;
    this.currentError = null;
    this._checkLocalStorageRoom();
    this.render();
    if (this.root) {
      this.root.hidden = false;
      if (this.root.style) this.root.style.display = 'flex';
      if (typeof this.root.setAttribute === 'function') this.root.setAttribute('aria-hidden', 'false');
      this.isOpen = true;
    }
    this.callbacks.onOpenChange?.(true);

    // If query host is available, ask nearby hosts to announce
    if (this.discoveryChannel && this.view !== 'host') {
      try {
        this.discoveryChannel.postMessage({ type: 'query_host' });
      } catch (_) {}
    }
  }

  close() {
    this.isOpen = false;
    if (this.root) {
      this.root.hidden = true;
      if (this.root.style) this.root.style.display = 'none';
      if (typeof this.root.setAttribute === 'function') this.root.setAttribute('aria-hidden', 'true');
    }
    this.callbacks.onClose?.();
    this.callbacks.onOpenChange?.(false);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  _showError(title, err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[OnlineDialog] ${title}:`, err);
    this.currentError = { title, message: errorMsg };
    this.render();
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

  _renderErrorBannerHtml() {
    if (!this.currentError) return '';
    return `
      <div class="online-error-box" data-el="errorBox">
        <div class="online-error-header">
          <div style="display:flex;align-items:center;gap:6px;">
            <span>⚠️</span>
            <span>${this.currentError.title}</span>
          </div>
          <button class="online-btn online-btn--secondary" data-el="btnCopyError" style="padding:2px 8px;font-size:10px;">📋 Copy Error</button>
        </div>
        <div class="online-error-message">${this.currentError.message}</div>
      </div>
    `;
  }

  _bindErrorBanner() {
    if (!this.currentError) return;
    const btn = this.dom.content.querySelector('[data-el="btnCopyError"]');
    btn?.addEventListener('click', () => {
      const text = `Error: ${this.currentError.title}\nDetails: ${this.currentError.message}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        btn.textContent = '✅ Copied!';
        setTimeout(() => { if (btn) btn.textContent = '📋 Copy Error'; }, 1500);
      }
    });
  }

  _renderLobbyView() {
    this.dom.badge.textContent = '120Hz P2P';
    this.dom.badge.style.borderColor = 'rgba(88, 166, 255, 0.4)';
    this.dom.badge.style.color = '#58a6ff';

    this.dom.content.innerHTML = `
      ${this._renderErrorBannerHtml()}

      <div>
        <label style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Player Call-Sign / Name</label>
        <div style="display:flex;gap:8px;">
          <input type="text" class="online-input" style="flex:1;" value="${this.playerName}" data-el="inpPlayerName" maxlength="20" placeholder="e.g. Striker-42" />
          <button class="online-btn online-btn--secondary" data-el="btnRandomName">🎲 Random</button>
        </div>
      </div>

      <div id="local-host-notice">
        <!-- Auto-discovery banner injected here -->
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        <div style="background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.25);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:24px;">👑</div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#58a6ff;">Host a Server</div>
            <div style="font-size:11px;color:#8b949e;margin-top:2px;">Runs authoritative 120Hz RocketSim in a dedicated Web Worker on your machine</div>
          </div>
          <button class="online-btn online-btn--blue" data-el="btnHostServer" style="margin-top:auto;">🚀 Create Room</button>
        </div>

        <div style="background:rgba(235,115,0,0.06);border:1px solid rgba(235,115,0,0.25);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:24px;">🎯</div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#ff9b44;">Join a Server</div>
            <div style="font-size:11px;color:#8b949e;margin-top:2px;">Connect with an Offer Token from another tab or host with client-side prediction</div>
          </div>
          <button class="online-btn online-btn--purple" data-el="btnJoinServer" style="margin-top:auto;">🔗 Connect to Host</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="online-btn online-btn--secondary" data-el="btnOpenNetworkHUD" style="flex:1;">📊 Open Network Reconciler HUD</button>
      </div>
    `;

    this._bindErrorBanner();

    const inpName = this.dom.content.querySelector('[data-el="inpPlayerName"]');
    inpName?.addEventListener('input', (e) => {
      this._savePlayerName(e.target.value);
    });

    this.dom.content.querySelector('[data-el="btnRandomName"]')?.addEventListener('click', () => {
      const rand = Math.floor(1000 + Math.random() * 9000);
      this._savePlayerName(`Striker-${rand}`);
      if (inpName) inpName.value = this.playerName;
    });

    this.dom.content.querySelector('[data-el="btnHostServer"]')?.addEventListener('click', () => {
      this._startHosting();
    });

    this.dom.content.querySelector('[data-el="btnJoinServer"]')?.addEventListener('click', () => {
      this.view = 'join';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnOpenNetworkHUD"]')?.addEventListener('click', () => {
      this.callbacks.onOpenNetworkHUD?.();
    });

    this._renderLocalHostNotice();
  }

  _renderLocalHostNotice() {
    const noticeEl = this.dom.content?.querySelector('#local-host-notice');
    if (!noticeEl) return;

    if (!this.detectedLocalHost || (this.detectedLocalHost.timestamp && Date.now() - this.detectedLocalHost.timestamp > 15000)) {
      noticeEl.innerHTML = '';
      return;
    }

    const hostColor = getCarColorSlotById(this.detectedLocalHost.colorSlot ?? 3);

    noticeEl.innerHTML = `
      <div class="online-status-banner online-status-banner--success" style="justify-content:space-between;align-items:center;background:rgba(46, 160, 67, 0.18);border:1px solid #3fb950;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🟢</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#3fb950;">Nearby Host Detected: <b>${this.detectedLocalHost.hostName}</b></div>
            <div style="font-size:11px;color:#c9d1d9;margin-top:1px;">
              Team: <span style="color:${hostColor.hex};font-weight:700;">${hostColor.nameZh} (${hostColor.teamName})</span> &bull; 120Hz Local Tab
            </div>
          </div>
        </div>
        <button class="online-btn online-btn--blue" data-el="btnInstantJoin" style="padding:6px 14px;font-size:12px;font-weight:700;">⚡ 1-Click Join</button>
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

  _renderColorPickerHtml(selectedSlotId, occupiedSlotId = null, role = 'host') {
    const swatchesHtml = CAR_COLOR_SLOTS.map(slot => {
      const isSelected = slot.id === selectedSlotId;
      const isOccupied = occupiedSlotId !== null && occupiedSlotId !== undefined && slot.id === occupiedSlotId;
      const teamTag = slot.team === 0 ? '蓝队' : '红/橙队';

      return `
        <div class="color-swatch-card ${isSelected ? 'is-selected' : ''} ${isOccupied ? 'is-occupied' : ''}"
             data-slot-id="${slot.id}"
             title="${slot.nameZh} (${slot.nameEn}) - ${slot.teamName}${isOccupied ? ' [已占用]' : ''}">
          <div class="color-circle" style="background:${slot.hex};">
            ${isSelected ? '✓' : ''}
          </div>
          <div class="color-label">${slot.nameZh} ${slot.nameEn}</div>
          <div class="color-team-tag" style="color:${slot.team === 0 ? '#58a6ff' : '#ff9b44'};">[${teamTag}]</div>
          ${isOccupied ? `<span class="color-occupied-badge">已占用</span>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div>
        <div class="color-palette-title">
          <span>🎨 Car Color Customization (${role === 'host' ? 'Host: Car 0' : 'Client: Car 1'})</span>
          <span style="color:${CAR_COLOR_SLOTS[selectedSlotId].hex};font-weight:700;">
            ${CAR_COLOR_SLOTS[selectedSlotId].nameZh} (${CAR_COLOR_SLOTS[selectedSlotId].hex})
          </span>
        </div>
        <div class="color-palette-grid">
          ${swatchesHtml}
        </div>
      </div>
    `;
  }

  _bindColorPicker(role = 'host') {
    const cards = this.dom.content.querySelectorAll('.color-swatch-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('is-occupied')) return;
        const slotId = Number(card.dataset.slotId);
        const slot = getCarColorSlotById(slotId);

        if (role === 'host') {
          this.hostColorSlot = slot.id;
          this.hostColorHex = slot.hex;
          this.callbacks.onColorSelect?.(0, slot.id, slot.hex);
          if (this.hostP2PChannel?.isOpen) {
            this.hostP2PChannel.sendColorChange(slot.id, slot.hex, 0);
          }
          this._updateActiveRoomStorage();
          this._renderHostView();
        } else {
          this.clientColorSlot = slot.id;
          this.clientColorHex = slot.hex;
          this.callbacks.onColorSelect?.(1, slot.id, slot.hex);
          if (this.clientP2PChannel?.isOpen) {
            this.clientP2PChannel.sendColorChange(slot.id, slot.hex, 1);
          }
          this._renderJoinView();
        }
      });
    });
  }

  _updateActiveRoomStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const roomData = {
        hostName: this.playerName,
        token: this.offerToken,
        colorSlot: this.hostColorSlot,
        colorHex: this.hostColorHex,
        timestamp: Date.now()
      };
      localStorage.setItem('car_soccer_active_host', JSON.stringify(roomData));
    } catch (_) {}
  }

  async _startHosting() {
    this.view = 'host';
    this.currentError = null;
    this.render();

    try {
      // 1. Tell GameRuntime to spin up dedicated AuthoritativeServerWorker client on-demand
      if (this.callbacks.onHostServer) {
        await this.callbacks.onHostServer({ playerName: this.playerName });
      }

      // Apply Host initial car color to Car 0
      this.callbacks.onColorSelect?.(0, this.hostColorSlot, this.hostColorHex);

      // 2. Create WebRTC channel for peer invites
      this.hostP2PChannel = new P2PWebRTCChannel({
        role: 'host',
        playerName: this.playerName,
        colorSlot: this.hostColorSlot,
        colorHex: this.hostColorHex,
        extraLatencyMs: 0
      });

      this.hostP2PChannel.onConnected = async () => {
        console.log('[OnlineDialog] Host peer connected:', this.hostP2PChannel.peerName || 'Player 2');
        if (this.callbacks.onPeerConnected) {
          await this.callbacks.onPeerConnected(this.hostP2PChannel, this.hostP2PChannel.peerName || 'Player 2');
        }
        // Apply opponent car color if specified by peer
        if (this.hostP2PChannel.peerColorHex) {
          this.callbacks.onColorSelect?.(1, this.hostP2PChannel.peerColorSlot, this.hostP2PChannel.peerColorHex);
        }
        this._updateHostPeerStatus('connected');
      };

      this.hostP2PChannel.onDisconnected = () => {
        console.log('[OnlineDialog] Host peer disconnected');
        this._updateHostPeerStatus('disconnected');
      };

      this.hostP2PChannel.onColorChange = (msg) => {
        console.log('[OnlineDialog] Opponent changed color:', msg);
        this.callbacks.onColorSelect?.(msg.carIndex ?? 1, msg.slotId, msg.hex);
        this._renderHostView();
      };

      // 3. Generate self-contained Offer Token
      this.offerToken = await this.hostP2PChannel.createOfferToken({
        hostColorSlot: this.hostColorSlot,
        hostColorHex: this.hostColorHex
      });
      this._renderHostView();

      // Write to localStorage for cross-tab discovery
      this._updateActiveRoomStorage();

      // Start periodic discovery heartbeat
      if (this.discoveryHeartbeat) clearInterval(this.discoveryHeartbeat);
      this.discoveryHeartbeat = setInterval(() => {
        if (this.view !== 'host' || !this.offerToken) {
          clearInterval(this.discoveryHeartbeat);
          return;
        }
        this._updateActiveRoomStorage();
        if (this.discoveryChannel) {
          try {
            this.discoveryChannel.postMessage({
              type: 'host_available',
              hostName: this.playerName,
              token: this.offerToken,
              colorSlot: this.hostColorSlot,
              colorHex: this.hostColorHex,
              timestamp: Date.now()
            });
          } catch (_) {}
        }
      }, 1000);

    } catch (err) {
      this._showError('Failed to host server', err);
      this.view = 'lobby';
      this.render();
    }
  }

  _renderHostView() {
    this.dom.badge.textContent = 'HOST (120Hz WORKER)';
    this.dom.badge.style.borderColor = '#a371f7';
    this.dom.badge.style.color = '#d2a8ff';

    const isConnected = this.hostP2PChannel?.isOpen;
    const opponentColorSlot = isConnected ? (this.hostP2PChannel?.peerColorSlot ?? null) : null;
    const opponentColor = opponentColorSlot !== null ? getCarColorSlotById(opponentColorSlot) : getCarColorSlotById(this.clientColorSlot);
    const myColor = getCarColorSlotById(this.hostColorSlot);

    this.dom.content.innerHTML = `
      ${this._renderErrorBannerHtml()}

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;">Room Host Control Panel</div>
          <div style="font-size:12px;color:#8b949e;">Server physics running in dedicated background worker thread</div>
        </div>
        <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(56,139,253,0.1);border:1px solid rgba(56,139,253,0.3);padding:10px;border-radius:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;">Player 1 (Host · Car 0)</div>
            <div style="width:12px;height:12px;border-radius:50%;background:${myColor.hex};border:1px solid #fff;"></div>
          </div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">${this.playerName}</div>
          <div style="font-size:11px;color:#3fb950;margin-top:2px;">● Local Loopback (0ms latency)</div>
        </div>

        <div style="background:rgba(235,115,0,0.1);border:1px solid rgba(235,115,0,0.3);padding:10px;border-radius:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:10px;font-weight:700;color:#ff9b44;text-transform:uppercase;">Player 2 (Opponent · Car 1)</div>
            ${isConnected ? `<div style="width:12px;height:12px;border-radius:50%;background:${opponentColor.hex};border:1px solid #fff;"></div>` : ''}
          </div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;" data-el="txtPeerStatus">
            ${isConnected ? (this.hostP2PChannel?.peerName || 'Connected Player') : 'Waiting for connection...'}
          </div>
          <div style="font-size:11px;color:${isConnected ? '#3fb950' : '#8b949e'};margin-top:2px;" data-el="txtPeerSub">
            ${isConnected ? '● Connected via WebRTC 120Hz' : '○ Standby for Answer Token'}
          </div>
        </div>
      </div>

      ${this._renderColorPickerHtml(this.hostColorSlot, isConnected ? opponentColorSlot : null, 'host')}

      ${isConnected ? `
        <div class="online-status-banner online-status-banner--success">
          <span style="font-size:18px;">🎉</span>
          <div>
            <b>Player 2 Connected!</b> Real-time 120Hz match active.
            <div style="font-size:11px;color:#c9d1d9;font-weight:400;margin-top:2px;">Both cars initialized in the 3D stadium. Ready to play!</div>
          </div>
        </div>
      ` : `
        <div class="online-step-box">
          <div class="online-step-header">
            <span class="online-step-num ${this.offerToken ? 'online-step-num--green' : ''}">1</span>
            <span>Copy Offer Token and send to Player 2 (or use Auto-Discovery on nearby tab)</span>
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
        <button class="online-btn online-btn--blue" data-el="btnEnterArena" style="flex:1;">🚗 Enter Arena</button>
      </div>
    `;

    this._bindErrorBanner();
    this._bindColorPicker('host');

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
      const btn = this.dom.content.querySelector('[data-el="btnConfirmAnswer"]');

      if (!token) {
        this._showError('Input Missing', 'Please paste the Answer Token received from Player 2 into Step 2.');
        return;
      }
      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = '⏳ Connecting...';
        }
        await this.hostP2PChannel.acceptAnswerToken(token);
        if (btn) btn.textContent = '✅ Answer Accepted';
      } catch (err) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔗 Connect';
        }
        this._showError('Failed to connect with Answer Token', err);
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
    // Only mark host color as occupied IF host has connected, broadcasted, or offer token was ingested
    const occupiedHostColorSlot = this.clientP2PChannel?.peerColorSlot ?? this.discoveredHostColorSlot ?? null;
    const hostColor = occupiedHostColorSlot !== null ? getCarColorSlotById(occupiedHostColorSlot) : null;
    const myColor = getCarColorSlotById(this.clientColorSlot);

    this.dom.content.innerHTML = `
      ${this._renderErrorBannerHtml()}

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;">Join a Server (WebRTC)</div>
          <div style="font-size:12px;color:#8b949e;">Connect to Host as Car 1 with real-time prediction reconciler</div>
        </div>
        <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(235,115,0,0.1);border:1px solid rgba(235,115,0,0.3);padding:10px;border-radius:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:10px;font-weight:700;color:#ff9b44;text-transform:uppercase;">Your Seat (Car 1)</div>
            <div style="width:12px;height:12px;border-radius:50%;background:${myColor.hex};border:1px solid #fff;"></div>
          </div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">${this.playerName}</div>
          <div style="font-size:11px;color:${isConnected ? '#3fb950' : '#8b949e'};margin-top:2px;">
            ${isConnected ? '● Connected via WebRTC 120Hz' : '○ Waiting for Connection'}
          </div>
        </div>

        <div style="background:rgba(56,139,253,0.1);border:1px solid rgba(56,139,253,0.3);padding:10px;border-radius:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;">Host (Car 0)</div>
            ${hostColor ? `<div style="width:12px;height:12px;border-radius:50%;background:${hostColor.hex};border:1px solid #fff;"></div>` : ''}
          </div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">
            ${this.clientP2PChannel?.peerName || this.detectedLocalHost?.hostName || 'Standby for Host...'}
          </div>
          <div style="font-size:11px;color:${isConnected ? '#3fb950' : '#8b949e'};margin-top:2px;">
            ${isConnected ? '● Synchronized at 120Hz' : (occupiedHostColorSlot !== null ? '○ Offer Ingested' : '○ Standby for Handshake')}
          </div>
        </div>
      </div>

      ${this._renderColorPickerHtml(this.clientColorSlot, occupiedHostColorSlot, 'client')}

      ${isConnected ? `
        <div class="online-status-banner online-status-banner--success">
          <span style="font-size:18px;">🎉</span>
          <div>
            <b>Connected to Host!</b> Physics timeline synchronized at 120Hz.
            <div style="font-size:11px;color:#c9d1d9;font-weight:400;margin-top:2px;">Authoritative snapshots streaming. Click "Enter Arena" to start!</div>
          </div>
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
        <button class="online-btn online-btn--blue" data-el="btnEnterArena" style="flex:1;">🚗 Enter Arena</button>
      </div>
    `;

    this._bindErrorBanner();
    this._bindColorPicker('client');

    this.dom.content.querySelector('[data-el="btnBackLobby"]')?.addEventListener('click', () => {
      this.view = 'lobby';
      this.render();
    });

    const txtOffer = this.dom.content.querySelector('[data-el="txtOfferInput"]');
    if (txtOffer) {
      const onOfferChanged = () => {
        const val = txtOffer.value?.trim();
        if (val && val.startsWith('RL_OFFER_')) {
          try {
            const data = decodeSignalToken(val);
            if (data && data.hostColorSlot !== undefined && this.discoveredHostColorSlot !== data.hostColorSlot) {
              this.discoveredHostColorSlot = data.hostColorSlot;
              if (this.clientColorSlot === this.discoveredHostColorSlot) {
                this.clientColorSlot = (this.discoveredHostColorSlot + 3) % 6;
                this.clientColorHex = CAR_COLOR_SLOTS[this.clientColorSlot].hex;
                this.callbacks.onColorSelect?.(1, this.clientColorSlot, this.clientColorHex);
              }
              this._renderJoinView();
            }
          } catch (_) {}
        }
      };
      txtOffer.addEventListener('input', onOfferChanged);
      txtOffer.addEventListener('paste', () => setTimeout(onOfferChanged, 50));
    }

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
      this._showError('Input Missing', 'Please paste the Offer Token from the Host into Step 1 first.');
      return;
    }

    try {
      try {
        const offerData = decodeSignalToken(offer);
        if (offerData && offerData.hostColorSlot !== undefined) {
          this.discoveredHostColorSlot = offerData.hostColorSlot;
          if (this.clientColorSlot === this.discoveredHostColorSlot) {
            this.clientColorSlot = (this.discoveredHostColorSlot + 3) % 6;
            this.clientColorHex = CAR_COLOR_SLOTS[this.clientColorSlot].hex;
            this.callbacks.onColorSelect?.(1, this.clientColorSlot, this.clientColorHex);
          }
        }
      } catch (_) {}

      this.clientP2PChannel = new P2PWebRTCChannel({
        role: 'client',
        playerName: this.playerName,
        colorSlot: this.clientColorSlot,
        colorHex: this.clientColorHex,
        extraLatencyMs: 0
      });

      this.clientP2PChannel.onConnected = async () => {
        console.log('[OnlineDialog] Client WebRTC channel connected with host!');
        if (this.callbacks.onJoinServer) {
          await this.callbacks.onJoinServer({
            channel: this.clientP2PChannel,
            playerName: this.playerName,
            remotePlayerName: this.clientP2PChannel.peerName || 'Host'
          });
        }
        // Apply host car color if specified by host
        if (this.clientP2PChannel.peerColorHex) {
          this.callbacks.onColorSelect?.(0, this.clientP2PChannel.peerColorSlot, this.clientP2PChannel.peerColorHex);
        }
        // Apply client car color
        this.callbacks.onColorSelect?.(1, this.clientColorSlot, this.clientColorHex);
        this._renderJoinView();
      };

      this.clientP2PChannel.onDisconnected = () => {
        console.log('[OnlineDialog] Client disconnected from host');
        this._renderJoinView();
      };

      this.clientP2PChannel.onColorChange = (msg) => {
        console.log('[OnlineDialog] Remote host changed color:', msg);
        this.callbacks.onColorSelect?.(msg.carIndex ?? 0, msg.slotId, msg.hex);
        this._renderJoinView();
      };

      this.answerToken = await this.clientP2PChannel.acceptOfferAndCreateAnswer(offer, {
        clientColorSlot: this.clientColorSlot,
        clientColorHex: this.clientColorHex
      });

      if (this.clientP2PChannel.peerColorSlot !== undefined && this.clientP2PChannel.peerColorSlot === this.clientColorSlot) {
        const altSlot = CAR_COLOR_SLOTS.find(s => s.id !== this.clientP2PChannel.peerColorSlot) || CAR_COLOR_SLOTS[0];
        this.clientColorSlot = altSlot.id;
        this.clientColorHex = altSlot.hex;
        this.callbacks.onColorSelect?.(1, altSlot.id, altSlot.hex);
        if (this.clientP2PChannel.isOpen) {
          this.clientP2PChannel.sendColorChange(altSlot.id, altSlot.hex, 1);
        }
      }

      // Auto-broadcast room answer for instant local tab pairing
      if (this.discoveryChannel) {
        try {
          this.discoveryChannel.postMessage({
            type: 'room_answer',
            answerToken: this.answerToken,
            clientName: this.playerName,
            clientColorSlot: this.clientColorSlot,
            clientColorHex: this.clientColorHex
          });
        } catch (_) {}
      }

      this._renderJoinView();
    } catch (err) {
      this._showError('Failed to generate answer', err);
    }
  }

  destroy() {
    try {
      if (this.discoveryHeartbeat) clearInterval(this.discoveryHeartbeat);
      if (this.view === 'host' && this.discoveryChannel) {
        this.discoveryChannel.postMessage({ type: 'host_closed', hostName: this.playerName });
        localStorage.removeItem('car_soccer_active_host');
      }
    } catch (_) {}

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
