import { roomConnectionProgress, ConnectionStatus } from '../network/index.js';
import { WebSocketSignalingClient } from "../network/WebSocketSignalingClient.js";
import { getSignalingUrl, setSignalingUrl, SIGNALING_ROOM_PREFIX } from "../network/SignalingConfig.js";
/**
 * src/ui/OnlineDialog.js
 * Comprehensive WebRTC Multiplayer Dialog & Host Room Control Panel.
 * 
 * Flow:
 * - Lobby view: Edit Player Name, vehicle color picker, view nearby hosts, choose "Host a Server" or "Join a Server".
 * - "Host a Server": Spawns dedicated 120Hz Web Worker on-demand, connects host locally (0ms latency),
 *   opens Host Room Control Panel with 6-color palette picker (occupied slot locking),
 *   step-by-step token copy/paste, persistent cross-tab auto-discovery, and safe Stop Server action.
 * - "Join a Server": Ingests Host Offer Token, selects available team color, generates Answer Token,
 *   supports 1-click nearby auto-join and manual copy/paste handshake.
 * - Safe lifecycle: Prevents duplicate server creation when dialog is closed and reopened.
 * - Dynamic color updates: Synchronizes colors across host and player seamlessly in real time.
 * - Non-blocking copyable error cards, live 120Hz status confirmations.
 */

import { P2PWebRTCChannel, encodeSignalToken, decodeSignalToken } from '../network/P2PWebRTCChannel.js';
import { CAR_COLOR_SLOTS, getCarColorSlotById } from '../entities/CarColorConstants.js';

export class OnlineDialog {
  /**
   * @param {HTMLElement} container
   * @param {object} callbacks
   * @param {(opts: { playerName: string }) => Promise<void>} callbacks.onHostServer
   * @param {() => Promise<void>} [callbacks.onStopServer]
   * @param {() => Promise<void>} [callbacks.onLeaveServer]
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

    // Active color slots (Load saved preferred color if available)
    const savedColorSlot = this._loadPreferredColorSlot();
    this.hostColorSlot = savedColorSlot ?? 3; // Default Blue
    this.hostColorHex = CAR_COLOR_SLOTS[this.hostColorSlot].hex;

    this.clientColorSlot = savedColorSlot ?? (this.hostColorSlot === 0 ? 3 : 0);
    this.clientColorHex = CAR_COLOR_SLOTS[this.clientColorSlot].hex;

    // Active channels and server tracking
    this.isHosting = false;
    this.hostP2PChannel = null;
    this.clientP2PChannel = null;

    this.offerToken = '';
    this.answerToken = '';
    this.clientOfferInput = '';
    this.detectedLocalHost = null;

    this.roomProgressUnsub = roomConnectionProgress.subscribe(() => {
      if (this.isOpen) {
        this._updateProgressBar();
      }
    });
    this.discoveredHostColorSlot = null;
    this.discoveredHostName = '';
    this.discoveryHeartbeat = null;
    this.currentError = null;
    this.hostRoomId = String(Math.floor(1000 + Math.random() * 9000));
    this.hostPassword = '';
    this.joinRoomId = '';
    this.joinPassword = '';
    this.roomId = this.hostRoomId;
    this.password = '';
    this.roomEstablished = false;
    this.signalingClient = null;
    this.signalingStatus = "idle";
    this.joinRoomInput = "";

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

  _loadPreferredColorSlot() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('car-soccer:preferred-color');
      if (saved !== null && saved !== undefined && saved !== '') {
        const slot = Number(saved);
        if (slot >= 0 && slot < CAR_COLOR_SLOTS.length) return slot;
      }
    }
    return null;
  }

  _savePreferredColorSlot(slotId) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('car-soccer:preferred-color', String(slotId));
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
              if (this.view === 'join' && this.clientColorSlot === this.discoveredHostColorSlot) {
                this.clientColorSlot = (this.discoveredHostColorSlot + 1) % CAR_COLOR_SLOTS.length;
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
            const answerToken = data.answerToken || data.token;
            if (answerToken && !this.hostP2PChannel.isOpen && this.hostP2PChannel.pc?.signalingState !== 'stable') {
              console.log('[OnlineDialog] Received auto-discovered room_answer via BroadcastChannel');
              this.hostP2PChannel.acceptAnswerToken(answerToken).then(() => {
                this._renderHostView();
              }).catch(err => {
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
      const savedHost = localStorage.getItem('car_soccer_active_host_room');
      if (savedHost && this.isHosting) {
        const parsed = JSON.parse(savedHost);
        if (parsed?.roomId) this.roomId = parsed.roomId;
        if (parsed?.password !== undefined) this.password = parsed.password;
      }
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
          width: 620px;
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
          background: #1f6feb;
          color: #ffffff;
        }
        .online-btn--blue:hover:not(:disabled) {
          background: #388bfd;
        }
        .online-btn--purple {
          background: #8957e5;
          color: #ffffff;
        }
        .online-btn--purple:hover:not(:disabled) {
          background: #a371f7;
        }
        .online-btn--danger {
          background: #da3633;
          color: #ffffff;
        }
        .online-btn--danger:hover:not(:disabled) {
          background: #f85149;
        }
        .online-btn--secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #c9d1d9;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .online-btn--secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }
        .online-input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #ffffff;
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .online-input:focus {
          border-color: #58a6ff;
        }
        .online-textarea {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #ffffff;
          padding: 8px 12px;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, monospace;
          width: 100%;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
        }
        .online-step-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
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

  /**
   * Opens online dialog.
   * If a server is actively running, defaults to 'host' view instead of allowing duplicate server creation.
   * @param {'lobby'|'host'|'join'} [view]
   */
  open(view = null) {
    if (!view) {
      if (this.isHosting) {
        this.view = 'host';
      } else if (this.clientP2PChannel && (this.clientP2PChannel.isOpen || this.answerToken)) {
        this.view = 'join';
      } else {
        this.view = 'lobby';
      }
    } else {
      this.view = view;
    }

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
    roomConnectionProgress.fail(err, title);
    this.render();
  }

  _renderProgressBarHtml() {
    const state = roomConnectionProgress.getState();
    if (state.status === ConnectionStatus.IDLE) return '';
    const barColor = state.isError ? '#f85149' : (state.status === ConnectionStatus.COMPLETED ? '#2ea043' : '#58a6ff');
    const bgTrack = state.isError ? 'rgba(248,81,73,0.15)' : 'rgba(88,166,255,0.15)';
    return `
      <div class="online-progress-card" data-el="progressCard" style="background:${bgTrack};border:1px solid ${barColor};border-radius:8px;padding:10px 14px;margin-bottom:12px;transition:all 0.3s ease;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;font-weight:700;color:${barColor};">
          <span data-el="progressStepName">${state.isError ? '⚠️ ' : ''}${state.stepName || 'Connecting...'}</span>
          <span data-el="progressPercentage">${state.percentage}% (${state.currentStep}/${state.totalSteps})</span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
          <div data-el="progressBarFill" style="height:100%;width:${state.percentage}%;background:${barColor};transition:width 0.25s ease, background-color 0.25s ease;"></div>
        </div>
      </div>
    `;
  }

  _updateProgressBar() {
    const card = this.dom.content?.querySelector('[data-el="progressCard"]');
    if (!card) {
      if (this.view === 'host') this._renderHostView();
      else if (this.view === 'join') this._renderJoinView();
      return;
    }
    const state = roomConnectionProgress.getState();
    const barColor = state.isError ? '#f85149' : (state.status === ConnectionStatus.COMPLETED ? '#2ea043' : '#58a6ff');
    const bgTrack = state.isError ? 'rgba(248,81,73,0.15)' : 'rgba(88,166,255,0.15)';
    card.style.background = bgTrack;
    card.style.borderColor = barColor;
    const nameEl = card.querySelector('[data-el="progressStepName"]');
    if (nameEl) {
      nameEl.style.color = barColor;
      nameEl.textContent = (state.isError ? '⚠️ ' : '') + (state.stepName || 'Connecting...');
    }
    const percEl = card.querySelector('[data-el="progressPercentage"]');
    if (percEl) {
      percEl.style.color = barColor;
      percEl.textContent = `${state.percentage}% (${state.currentStep}/${state.totalSteps})`;
    }
    const fillEl = card.querySelector('[data-el="progressBarFill"]');
    if (fillEl) {
      fillEl.style.width = `${state.percentage}%`;
      fillEl.style.backgroundColor = barColor;
    }
  }

  _renderPlayerSlotHtml(carIndex, defaultLabel, name, colorHex, isConnected, rttMs) {
    const isHostCar = carIndex === 0;
    const teamColor = (carIndex % 2 === 0) ? '#58a6ff' : '#ff9b44';
    const bg = isConnected ? ((carIndex % 2 === 0) ? 'rgba(56,139,253,0.12)' : 'rgba(235,115,0,0.12)') : 'rgba(255,255,255,0.02)';
    const border = isConnected ? ((carIndex % 2 === 0) ? 'rgba(56,139,253,0.4)' : 'rgba(235,115,0,0.4)') : 'rgba(255,255,255,0.08)';

    const kickBtn = (!isHostCar && isConnected) ? `
      <button class="online-btn online-btn--danger" data-action="kick-player" data-car-index="${carIndex}" style="padding:2px 8px;font-size:10px;margin-left:6px;">✕ Kick</button>
    ` : '';

    return `
      <div style="background:${bg};border:1px solid ${border};padding:8px 10px;border-radius:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:10px;font-weight:700;color:${teamColor};text-transform:uppercase;">Car ${carIndex} · ${defaultLabel}</div>
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${colorHex};border:1px solid #fff;"></div>
            ${kickBtn}
          </div>
        </div>
        <div style="font-size:13px;font-weight:700;color:${isConnected ? '#ffffff' : '#6e7681'};margin-top:2px;">
          ${isConnected ? name : '○ Waiting for player...'}
        </div>
        <div style="font-size:10px;color:${isConnected ? '#3fb950' : '#484f58'};margin-top:2px;">
          ${isConnected ? (isHostCar ? '● Local Loopback (0ms)' : `● Connected (${rttMs ?? 0}ms PING)`) : 'Empty Slot'}
        </div>
      </div>
    `;
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
    if (this.dom.badge) {
      this.dom.badge.textContent = '120Hz P2P';
      this.dom.badge.style.borderColor = 'rgba(88, 166, 255, 0.4)';
      this.dom.badge.style.color = '#58a6ff';
    }

    const activeHostBanner = this.isHosting ? `
      <div style="background:rgba(46,160,67,0.15);border:1px solid #3fb950;border-radius:8px;padding:12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;color:#3fb950;display:flex;align-items:center;gap:6px;">
            <span>🟢</span> <span>Dedicated Server Running (120Hz Worker)</span>
          </div>
          <div style="font-size:11px;color:#c9d1d9;margin-top:2px;">
            You are hosting room "${this.playerName}". Active and ready for opponents.
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="online-btn online-btn--blue" data-el="btnResumeHost" style="padding:6px 12px;font-size:11px;">👑 Return to Room</button>
          <button class="online-btn online-btn--danger" data-el="btnStopHostingLobby" style="padding:6px 12px;font-size:11px;">⏹️ Stop Server</button>
        </div>
      </div>
    ` : '';

    this.dom.content.innerHTML = `
      ${this._renderErrorBannerHtml()}
      ${activeHostBanner}

      <div>
        <label style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Player Call-Sign / Name</label>
        <div style="display:flex;gap:8px;">
          <input type="text" class="online-input" style="flex:1;" value="${this.playerName}" data-el="inpPlayerName" maxlength="20" placeholder="e.g. Striker-42" />
          <button class="online-btn online-btn--secondary" data-el="btnRandomName">🎲 Random</button>
        </div>
      </div>

      ${this._renderColorPickerHtml(this.hostColorSlot, null, 'lobby')}

      <div id="local-host-notice">
        <!-- Auto-discovery banner injected here -->
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        <div style="background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.25);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:24px;">👑</div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#58a6ff;">${this.isHosting ? 'Host Room Active' : 'Host a Server'}</div>
            <div style="font-size:11px;color:#8b949e;margin-top:2px;">
              ${this.isHosting ? 'Your server is already running in a dedicated Web Worker.' : 'Runs authoritative 120Hz RocketSim in a dedicated Web Worker on your machine'}
            </div>
          </div>
          ${this.isHosting ? `
            <button class="online-btn online-btn--blue" data-el="btnHostServer" style="margin-top:auto;">👑 Return to Room</button>
          ` : `
            <button class="online-btn online-btn--blue" data-el="btnHostServer" style="margin-top:auto;">🚀 Create Room</button>
          `}
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

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;font-size:11px;margin-top:4px;">
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px;">
          <span style="font-weight:600;color:#8b949e;">🌐 Signaling Server:</span>
          <span style="color:#58a6ff;font-family:monospace;" data-el="txtCurrentSignalingUrl">${getSignalingUrl()}</span>
        </div>
        <button class="online-btn online-btn--secondary" data-el="btnEditSignalingUrl" style="padding:2px 8px;font-size:10px;white-space:nowrap;">⚙️ Configure</button>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="online-btn online-btn--secondary" data-el="btnOpenNetworkHUD" style="flex:1;">📊 Open Network Reconciler HUD</button>
      </div>
    `;

    this._bindErrorBanner();
    this._bindColorPicker('lobby');

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
      this.view = 'host';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnResumeHost"]')?.addEventListener('click', () => {
      this.view = 'host';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnStopHostingLobby"]')?.addEventListener('click', () => {
      this.stopHosting();
    });

    this.dom.content.querySelector('[data-el="btnJoinServer"]')?.addEventListener('click', () => {
      this.view = 'join';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnOpenNetworkHUD"]')?.addEventListener('click', () => {
      this.callbacks.onOpenNetworkHUD?.();
    });

    this.dom.content.querySelector('[data-el="btnEditSignalingUrl"]')?.addEventListener('click', () => {
      const current = getSignalingUrl();
      const entered = window.prompt ? window.prompt("Enter Cloudflare WebSocket Signaling URL:", current) : current;
      if (entered !== null && entered !== undefined) {
        setSignalingUrl(entered);
        this._renderLobbyView();
      }
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
      <div class="online-status-banner online-status-banner--success" style="justify-content:space-between;align-items:center;background:rgba(46, 160, 67, 0.18);border:1px solid #3fb950;margin-top:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🟢</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#3fb950;">Nearby Host Detected: <b>${this.detectedLocalHost.hostName}</b></div>
            <div style="font-size:11px;color:#c9d1d9;margin-top:1px;">
              Team: <span style="color:${hostColor.hex};font-weight:700;">${hostColor.nameEn} (${hostColor.teamNameEn})</span> &bull; 120Hz Local Tab
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
      const teamTag = slot.team === 0 ? 'Blue Team' : 'Orange/Red Team';

      return `
        <div class="color-swatch-card ${isSelected ? 'is-selected' : ''} ${isOccupied ? 'is-occupied' : ''}"
             data-slot-id="${slot.id}"
             title="${slot.nameEn} - ${slot.teamNameEn}${isOccupied ? ' [Occupied]' : ''}">
          <div class="color-circle" style="background:${slot.hex};">
            ${isSelected ? '✓' : ''}
          </div>
          <div class="color-label">${slot.nameEn}</div>
          <div class="color-team-tag" style="color:${slot.team === 0 ? '#58a6ff' : '#ff9b44'};">[${teamTag}]</div>
          ${isOccupied ? `<span class="color-occupied-badge">Occupied</span>` : ''}
        </div>
      `;
    }).join('');

    let titleText = 'Car Color Customization';
    if (role === 'host') titleText += ' (Host: Car 0)';
    else if (role === 'client') titleText += ' (Client: Car 1)';
    else titleText += ' (Your Vehicle Preference)';

    return `
      <div>
        <div class="color-palette-title">
          <span>🎨 ${titleText}</span>
          <span style="color:${CAR_COLOR_SLOTS[selectedSlotId].hex};font-weight:700;">
            ${CAR_COLOR_SLOTS[selectedSlotId].nameEn} (${CAR_COLOR_SLOTS[selectedSlotId].hex})
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

        this._savePreferredColorSlot(slot.id);

        if (role === 'lobby') {
          this.hostColorSlot = slot.id;
          this.hostColorHex = slot.hex;
          this.clientColorSlot = slot.id;
          this.clientColorHex = slot.hex;
          this.callbacks.onColorSelect?.(0, slot.id, slot.hex);
          this.callbacks.onColorSelect?.(1, slot.id, slot.hex);
          this._renderLobbyView();
          return;
        }

        if (role === 'host') {
          this.hostColorSlot = slot.id;
          this.hostColorHex = slot.hex;
          this.callbacks.onColorSelect?.(0, slot.id, slot.hex);

          if (this.hostP2PChannel) {
            this.offerToken = this.hostP2PChannel.updateOfferTokenColor(slot.id, slot.hex);
          }

          this._updateActiveRoomStorage();

          if (this.discoveryChannel && this.isHosting) {
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

          this._renderHostView();
        } else {
          this.clientColorSlot = slot.id;
          this.clientColorHex = slot.hex;
          this.callbacks.onColorSelect?.(1, slot.id, slot.hex);

          if (this.clientP2PChannel) {
            this.clientP2PChannel.setColor(slot.id, slot.hex);
            if (this.clientP2PChannel.isOpen) {
              this.clientP2PChannel.sendColorChange(slot.id, slot.hex, 1);
            }
          }

          this._renderJoinView();
        }
      });
    });
  }

  _updateActiveRoomStorage() {
    if (typeof localStorage === 'undefined' || !this.isHosting) return;
    try {
      const roomData = {
        hostName: this.playerName,
        roomId: this.roomId,
        password: this.password,
        token: this.offerToken,
        colorSlot: this.hostColorSlot,
        colorHex: this.hostColorHex,
        timestamp: Date.now()
      };
      localStorage.setItem('car_soccer_active_host', JSON.stringify(roomData));
      localStorage.setItem('car_soccer_active_host_room', JSON.stringify({
        roomId: this.roomId,
        password: this.password,
        isHosting: true
      }));
    } catch (_) {}
  }

  async _startHosting(roomId = null, password = '') {
    this.roomId = (roomId || this.hostRoomId || String(Math.floor(1000 + Math.random() * 9000))).trim();
    this.password = password !== undefined && password !== null ? String(password) : (this.hostPassword || '');
    this.hostRoomId = this.roomId;
    this.hostPassword = this.password;
    this.view = 'host';
    this.currentError = null;
    this.roomEstablished = false;
    this.signalingStatus = 'connecting';
    roomConnectionProgress.startHost();
    this.render();

    try {
      roomConnectionProgress.advance('worker_init', 'Initializing 120Hz Authoritative Worker');
      // 1. Tell GameRuntime to spin up dedicated AuthoritativeServerWorker client on-demand
      if (this.callbacks.onHostServer) {
        await this.callbacks.onHostServer({ playerName: this.playerName });
      }
      roomConnectionProgress.advance('physics_ready', 'Configuring Arena & Physics Engine');

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
        // Send host color immediately to peer
        this.hostP2PChannel.sendColorChange(this.hostColorSlot, this.hostColorHex, 0);

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
        const cIdx = msg.carIndex ?? 1;
        if (msg.slotId !== undefined) {
          this.hostP2PChannel.peerColorSlot = msg.slotId;
        }
        if (msg.hex !== undefined) {
          this.hostP2PChannel.peerColorHex = msg.hex;
        }
        this.callbacks.onColorSelect?.(cIdx, msg.slotId, msg.hex);
        this._renderHostView();
      };

      // 3. Generate self-contained Offer Token with unified room ID and initial color
      this.offerToken = await this.hostP2PChannel.createOfferToken({
        roomId: this.roomId,
        hostColorSlot: this.hostColorSlot,
        hostColorHex: this.hostColorHex
      });
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(this.roomId).catch(() => {});
        }
      } catch (_) {}

      this.isHosting = true;
      roomConnectionProgress.complete('Room Active. Ready for Players (Up to 6)');
      this._initHostSignaling();
      this._renderHostView();

      // Write to localStorage for cross-tab discovery
      this._updateActiveRoomStorage();

      // Start periodic discovery heartbeat
      if (this.discoveryHeartbeat) clearInterval(this.discoveryHeartbeat);
      this.discoveryHeartbeat = setInterval(() => {
        if (this.view !== 'host' || !this.offerToken || !this.isHosting) {
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
      this.isHosting = false;
      this.roomEstablished = false;
      this._showError('Failed to host server', err);
      this.view = 'host';
      this.render();
    }
  }

  _initHostSignaling() {
    const sigUrl = getSignalingUrl();
    try {
      if (this.signalingClient) {
        try { this.signalingClient.close(); } catch (_) {}
      }
      this.signalingClient = new WebSocketSignalingClient(sigUrl, {
        roomId: this.roomId,
        password: this.password,
        role: 'host',
        playerName: this.playerName
      });
      this.signalingStatus = 'connecting';
      this.roomEstablished = false;

      this.signalingClient.on('open', () => {
        console.log('[OnlineDialog] Host signaling server connection established!');
        this.signalingStatus = 'connected';
        this.roomEstablished = true;
        if (this.view === 'host') this._renderHostView();
      });

      this.signalingClient.on('error', (err) => {
        console.warn('[OnlineDialog] Signaling connection notice:', err?.message || err);
        this.signalingStatus = 'error';
        if (this.view === 'host') this._renderHostView();
      });

      this.signalingClient.on('peer_joined', async ({ peerId, name }) => {
        console.log(`[OnlineDialog] Peer joined room via signaling: ${name} (${peerId})`);
        try {
          const offerToken = await this.hostP2PChannel.createOfferToken({
            roomId: this.roomId,
            hostColorSlot: this.hostColorSlot,
            hostColorHex: this.hostColorHex
          });
          this.signalingClient.sendOffer(peerId, offerToken);
        } catch (err) {
          console.error('[OnlineDialog] Failed to send offer to peer:', err);
        }
      });

      this.signalingClient.on('answer', async ({ sdp, fromPeerId }) => {
        console.log(`[OnlineDialog] Received answer from peer ${fromPeerId}`);
        try {
          await this.hostP2PChannel.acceptAnswerToken(sdp);
          if (this.view === 'host') this._renderHostView();
        } catch (err) {
          console.error('[OnlineDialog] Failed to accept answer from peer:', err);
        }
      });

      this.signalingClient.on('candidate', ({ candidate }) => {
        if (candidate && this.hostP2PChannel) {
          this.hostP2PChannel.addIceCandidate(candidate);
        }
      });

      if (this.hostP2PChannel) {
        this.hostP2PChannel.onIceCandidate = (cand) => {
          this.signalingClient?.sendCandidate(null, cand);
        };
      }

      this.signalingClient.connect().catch((err) => {
        console.warn('[OnlineDialog] Signaling server offline/unreachable, fallback to manual tokens:', err?.message);
        this.signalingStatus = 'error';
        if (this.view === 'host') this._renderHostView();
      });
    } catch (err) {
      console.warn('[OnlineDialog] Signaling init failed:', err);
      this.signalingStatus = 'error';
    }
  }

  async _joinWithRoomId(roomId, password = '') {
    const cleanRoomId = (roomId || '').trim();
    if (!cleanRoomId) {
      this._showError('Room ID Missing', 'Please enter a valid Room ID to join.');
      return;
    }
    this.joinRoomId = cleanRoomId;
    this.joinPassword = password !== undefined && password !== null ? String(password) : (this.joinPassword || '');
    this.joinRoomInput = cleanRoomId;
    this.currentError = null;
    this.signalingStatus = 'connecting';
    roomConnectionProgress.startJoin();
    this._renderJoinView();

    try {
      roomConnectionProgress.advance('signaling_connect', 'Connecting to Token Signaling Server');
      let chosenColorSlot = this.clientColorSlot;
      let chosenColorHex = this.clientColorHex;

      this.clientP2PChannel = new P2PWebRTCChannel({
        role: 'client',
        playerName: this.playerName,
        colorSlot: chosenColorSlot,
        colorHex: chosenColorHex,
        extraLatencyMs: 0
      });

      this.clientP2PChannel.onConnected = async () => {
        console.log('[OnlineDialog] Client connected to host via fast signaling!');
        roomConnectionProgress.advance('state_sync', 'Synchronizing Game Timeline & State');
        if (this.callbacks.onJoinServer) {
          await this.callbacks.onJoinServer({
            channel: this.clientP2PChannel,
            playerName: this.playerName,
            remotePlayerName: this.clientP2PChannel.peerName || 'Host'
          });
        }
        roomConnectionProgress.complete('Connected. Entering Arena');
        this._renderJoinView();
      };

      const sigUrl = getSignalingUrl();
      if (this.signalingClient) {
        try { this.signalingClient.close(); } catch (_) {}
      }
      this.signalingClient = new WebSocketSignalingClient(sigUrl, {
        roomId: cleanRoomId,
        password: this.joinPassword,
        role: 'client',
        playerName: this.playerName
      });

      this.signalingClient.on('open', () => {
        this.signalingStatus = 'connected';
        this._renderJoinView();
      });

      this.signalingClient.on('error', (err) => {
        console.warn('[OnlineDialog] Client signaling error:', err);
        this.signalingStatus = 'error';
        this._renderJoinView();
      });

      this.signalingClient.on('offer', async ({ sdp }) => {
        console.log('[OnlineDialog] Received host offer via signaling, creating answer...');
        try {
          const answer = await this.clientP2PChannel.acceptOfferAndCreateAnswer(sdp, {
            clientColorSlot: chosenColorSlot,
            clientColorHex: chosenColorHex
          });
          this.signalingClient.sendAnswer(answer);
          this.answerToken = answer;
          this._renderJoinView();
        } catch (err) {
          this._showError('Failed to accept host offer', err);
        }
      });

      this.signalingClient.on('candidate', ({ candidate }) => {
        if (candidate && this.clientP2PChannel) {
          this.clientP2PChannel.addIceCandidate(candidate);
        }
      });

      this.clientP2PChannel.onIceCandidate = (cand) => {
        this.signalingClient?.sendCandidate(null, cand);
      };

      await this.signalingClient.connect();
      this._renderJoinView();
    } catch (err) {
      this.signalingStatus = 'error';
      this._showError('Failed to connect via Signaling', err);
      this._renderJoinView();
    }
  }

  async stopHosting() {
    console.log('[OnlineDialog] Stopping authoritative server worker and closing room...');
    this.isHosting = false;
    this.roomEstablished = false;
    this.signalingStatus = 'idle';
    if (this.discoveryHeartbeat) {
      clearInterval(this.discoveryHeartbeat);
      this.discoveryHeartbeat = null;
    }
    if (this.discoveryChannel) {
      try {
        this.discoveryChannel.postMessage({
          type: 'host_closed',
          hostName: this.playerName
        });
      } catch (_) {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('car_soccer_active_host');
        localStorage.removeItem('car_soccer_active_host_room');
      } catch (_) {}
    }
    if (this.signalingClient) {
      try { this.signalingClient.close(); } catch (_) {}
      this.signalingClient = null;
    }
    if (this.hostP2PChannel) {
      try { this.hostP2PChannel.destroy(); } catch (_) {}
      this.hostP2PChannel = null;
    }
    this.offerToken = '';

    if (this.callbacks.onStopServer) {
      await this.callbacks.onStopServer();
    }

    this.view = 'lobby';
    this.render();
  }

  _renderHostView() {
    if (this.dom.badge) {
      this.dom.badge.textContent = 'HOST (120Hz WORKER)';
      this.dom.badge.style.borderColor = '#a371f7';
      this.dom.badge.style.color = '#d2a8ff';
    }

    // --- State A: Setup before hosting ---
    if (!this.isHosting) {
      this.dom.content.innerHTML = `
        ${this._renderErrorBannerHtml()}

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:16px;font-weight:700;color:#ffffff;">Host a Server</div>
            <div style="font-size:12px;color:#8b949e;">Configure your Room ID and optional password</div>
          </div>
          <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
        </div>

        <div style="background:linear-gradient(135deg, rgba(88,166,255,0.18) 0%, rgba(163,113,247,0.18) 100%);border:2px solid #58a6ff;border-radius:10px;padding:16px 18px;margin:12px 0;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
          <div>
            <div style="font-size:12px;font-weight:800;color:#58a6ff;text-transform:uppercase;letter-spacing:1px;">⚡ Create Room</div>
            <div style="font-size:12px;color:#c9d1d9;margin-top:2px;">A 4-digit Room ID is generated by default. You can edit it to any characters:</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:#8b949e;display:block;margin-bottom:4px;">Room ID</label>
              <div style="display:flex;gap:6px;">
                <input type="text" class="online-input" style="flex:1;font-size:15px;font-weight:800;letter-spacing:1px;" placeholder="Room ID" value="${this.hostRoomId || ''}" data-el="inpHostRoomId" />
                <button class="online-btn online-btn--secondary" data-el="btnRandomHostRoomId" title="Generate 4 random digits">🎲</button>
              </div>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#8b949e;display:block;margin-bottom:4px;">Password (Optional)</label>
              <input type="text" class="online-input" style="width:100%;font-size:14px;" placeholder="Leave empty for none" value="${this.hostPassword || ''}" data-el="inpHostPassword" />
            </div>
          </div>

          <div style="margin-top:14px;">
            <button class="online-btn online-btn--blue" data-el="btnConfirmHost" style="width:100%;font-size:15px;font-weight:800;padding:10px 18px;background:#238636;border-color:#2ea043;">🚀 Host Room</button>
          </div>
        </div>

        ${this._renderColorPickerHtml(this.hostColorSlot, null, 'host')}

        <details style="margin-top:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 12px;">
          <summary style="cursor:pointer;color:#8b949e;font-size:12px;text-decoration:underline;">Have problems? Try manual pair ICE tokens</summary>
          <div style="margin-top:10px;font-size:12px;color:#8b949e;">
            Manual token exchange will become available once the room is created above.
          </div>
        </details>
      `;

      this._bindErrorBanner();
      this._bindColorPicker('host');

      this.dom.content.querySelector('[data-el="btnBackLobby"]')?.addEventListener('click', () => {
        this.view = 'lobby';
        this.render();
      });

      const inpRoom = this.dom.content.querySelector('[data-el="inpHostRoomId"]');
      if (inpRoom) {
        inpRoom.addEventListener('input', (e) => {
          this.hostRoomId = e.target.value;
        });
      }

      this.dom.content.querySelector('[data-el="btnRandomHostRoomId"]')?.addEventListener('click', () => {
        this.hostRoomId = String(Math.floor(1000 + Math.random() * 9000));
        if (inpRoom) inpRoom.value = this.hostRoomId;
      });

      const inpPass = this.dom.content.querySelector('[data-el="inpHostPassword"]');
      if (inpPass) {
        inpPass.addEventListener('input', (e) => {
          this.hostPassword = e.target.value;
        });
      }

      this.dom.content.querySelector('[data-el="btnConfirmHost"]')?.addEventListener('click', () => {
        const rId = (inpRoom?.value || this.hostRoomId || '').trim();
        const pwd = (inpPass?.value !== undefined ? inpPass.value : this.hostPassword) || '';
        this._startHosting(rId, pwd);
      });
      return;
    }

    // --- State B: Active Server Running ---
    const isConnected = this.hostP2PChannel?.isOpen;
    const hasPeer = isConnected || !!this.hostP2PChannel?.peerName;
    const peerName = this.hostP2PChannel?.peerName || (isConnected ? 'Player 2' : 'Waiting for connection...');
    const opponentColorSlot = this.hostP2PChannel?.peerColorSlot ?? null;
    const opponentColor = opponentColorSlot !== null ? getCarColorSlotById(opponentColorSlot) : getCarColorSlotById(this.clientColorSlot);
    const myColor = getCarColorSlotById(this.hostColorSlot);

    const displayRoomId = this.roomId.startsWith(SIGNALING_ROOM_PREFIX)
      ? this.roomId.slice(SIGNALING_ROOM_PREFIX.length)
      : this.roomId;

    let roomStatusColor = '#8b949e';
    let roomStatusText = '○ Standby';
    if (isConnected) {
      roomStatusColor = '#3fb950';
      roomStatusText = '🎉 Opponent connected! Real-time 120Hz match active.';
    } else if (this.roomEstablished && this.signalingStatus === 'connected') {
      roomStatusColor = '#3fb950';
      roomStatusText = '🟢 Room established successfully, waiting for guest...';
    } else if (this.signalingStatus === 'connecting') {
      roomStatusColor = '#e3b341';
      roomStatusText = '⏳ Connecting to signaling server...';
    } else if (this.signalingStatus === 'error') {
      roomStatusColor = '#f85149';
      roomStatusText = '⚠️ Signaling server offline (Use manual tokens below)';
    }

    this.dom.content.innerHTML = `
      ${this._renderErrorBannerHtml()}
      ${this._renderProgressBarHtml()}

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;">Room Host Control Panel</div>
          <div style="font-size:12px;color:#8b949e;">Authoritative 120Hz physics worker thread active</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
          <button class="online-btn online-btn--danger" data-el="btnStopHosting" style="font-size:11px;padding:6px 12px;">⏹️ Stop Server</button>
        </div>
      </div>

      <!-- Prominent Room Code Card -->
      <div style="background:linear-gradient(135deg, rgba(88,166,255,0.2) 0%, rgba(163,113,247,0.2) 100%);border:2px solid #58a6ff;border-radius:10px;padding:14px 18px;margin-bottom:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:gap:10px;">
          <div>
            <div style="font-size:11px;font-weight:800;color:#58a6ff;text-transform:uppercase;letter-spacing:1px;">⚡ Active Room &bull; Room ID</div>
            <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:2px;margin:4px 0;" data-el="txtRoomId">${displayRoomId}</div>
            <div style="font-size:12px;color:#c9d1d9;">${this.password ? `Password: <b>${this.password}</b> &bull; ` : ''}Share this Room ID with your friends to join directly!</div>
            <div style="font-size:12px;margin-top:6px;font-weight:700;color:${roomStatusColor};" data-el="txtSignalingStatusText">
              ${roomStatusText}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="online-btn online-btn--blue" data-el="btnCopyRoomId" style="font-size:14px;font-weight:800;padding:10px 18px;white-space:nowrap;background:#238636;border-color:#2ea043;">📋 Copy Room ID</button>
          </div>
        </div>
      </div>

            <!-- 6-Player Roster Grid (3v3) -->
      <div style="margin-top:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:700;color:#c9d1d9;text-transform:uppercase;letter-spacing:0.5px;">Match Roster (3v3 · 6 Players Max)</div>
          <div style="font-size:11px;color:#8b949e;">5s Global PING Refresh Active</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <!-- Blue Team (0, 2, 4) -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="font-size:11px;font-weight:800;color:#58a6ff;letter-spacing:0.5px;padding-bottom:2px;border-bottom:1px solid rgba(88,166,255,0.3);">
              BLUE TEAM
            </div>
            ${this._renderPlayerSlotHtml(0, 'Host', this.playerName, myColor.hex, true, 0)}
            ${this._renderPlayerSlotHtml(2, 'Slot 3', null, '#58a6ff', false, null)}
            ${this._renderPlayerSlotHtml(4, 'Slot 5', null, '#58a6ff', false, null)}
          </div>

          <!-- Orange Team (1, 3, 5) -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="font-size:11px;font-weight:800;color:#ff9b44;letter-spacing:0.5px;padding-bottom:2px;border-bottom:1px solid rgba(255,155,68,0.3);">
              ORANGE TEAM
            </div>
            ${this._renderPlayerSlotHtml(1, 'Opponent', isConnected ? peerName : null, opponentColor.hex, isConnected, Math.round(this.hostP2PChannel?.rttMs || 0))}
            ${this._renderPlayerSlotHtml(3, 'Slot 4', null, '#ff9b44', false, null)}
            ${this._renderPlayerSlotHtml(5, 'Slot 6', null, '#ff9b44', false, null)}
          </div>
        </div>
      </div>

      ${this._renderColorPickerHtml(this.hostColorSlot, isConnected ? opponentColorSlot : null, 'host')}

      ${isConnected ? `
        <div class="online-status-banner online-status-banner--success">
          <span style="font-size:18px;">🎉</span>
          <div>
            <b>Player 2 Connected!</b> Real-time 120Hz match active.
            <div style="font-size:11px;color:#c9d1d9;font-weight:400;margin-top:2px;">Both cars initialized in the stadium. Ready to play!</div>
          </div>
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="online-btn online-btn--secondary" data-el="btnOpenNetworkHUD" style="flex:1;">📊 Network Diagnostics</button>
        <button class="online-btn online-btn--blue" data-el="btnEnterArena" style="flex:1;">🚗 Enter Arena</button>
      </div>

      <details style="margin-top:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 12px;">
        <summary style="cursor:pointer;color:#8b949e;font-size:12px;text-decoration:underline;">Have problems? Try manual pair ICE tokens</summary>
        <div style="margin-top:10px;">
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
        </div>
      </details>
    `;

    this._bindErrorBanner();
    this._bindColorPicker('host');

    this.dom.content.querySelector('[data-el="btnBackLobby"]')?.addEventListener('click', () => {
      this.view = 'lobby';
      this.render();
    });

    this.dom.content.querySelectorAll('[data-action="kick-player"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const carIdx = parseInt(btn.dataset.carIndex, 10);
        if (!Number.isNaN(carIdx)) {
          if (this.callbacks.onRemovePlayer) {
            await this.callbacks.onRemovePlayer(carIdx);
          }
          this._renderHostView();
        }
      });
    });

    this.dom.content.querySelector('[data-el="btnStopHosting"]')?.addEventListener('click', () => {
      this.stopHosting();
    });

    this.dom.content.querySelector('[data-el="btnCopyRoomId"]')?.addEventListener('click', () => {
      if (displayRoomId && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(displayRoomId);
        const btn = this.dom.content.querySelector('[data-el="btnCopyRoomId"]');
        if (btn) {
          btn.textContent = '✅ Copied!';
          setTimeout(() => { if (btn) btn.textContent = '📋 Copy Room ID'; }, 1500);
        }
      }
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
        this._renderHostView();
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
    if (this.dom.badge) {
      this.dom.badge.textContent = 'JOIN SERVER';
      this.dom.badge.style.borderColor = '#58a6ff';
      this.dom.badge.style.color = '#58a6ff';
    }

    const isConnected = this.clientP2PChannel?.isOpen;
    const occupiedHostColorSlot = this.clientP2PChannel?.peerColorSlot ?? this.discoveredHostColorSlot ?? null;
    const hostColor = occupiedHostColorSlot !== null ? getCarColorSlotById(occupiedHostColorSlot) : null;
    const myColor = getCarColorSlotById(this.clientColorSlot);

    let joinStatusColor = '#8b949e';
    let joinStatusText = '○ Enter Room ID and Password to connect';
    if (isConnected) {
      joinStatusColor = '#3fb950';
      joinStatusText = '🎉 Connected to Host! 120Hz transport active.';
    } else if (this.signalingStatus === 'connected') {
      joinStatusColor = '#3fb950';
      joinStatusText = '● Signaling Online. Waiting for host offer...';
    } else if (this.signalingStatus === 'connecting') {
      joinStatusColor = '#e3b341';
      joinStatusText = '⏳ Connecting to signaling server and host...';
    } else if (this.signalingStatus === 'error') {
      joinStatusColor = '#f85149';
      joinStatusText = '⚠️ Signaling offline or room not found';
    }

    this.dom.content.innerHTML = `
      ${this._renderErrorBannerHtml()}
      ${this._renderProgressBarHtml()}

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#ffffff;">Join a Server (WebRTC)</div>
          <div style="font-size:12px;color:#8b949e;">Connect to Host as Car 1 with real-time prediction reconciler</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="online-btn online-btn--secondary" data-el="btnBackLobby" style="font-size:11px;">← Lobby</button>
          ${isConnected ? `<button class="online-btn online-btn--danger" data-el="btnLeaveMatch" style="font-size:11px;padding:6px 12px;">Leave Match</button>` : ''}
        </div>
      </div>

      <!-- Prominent Fast Connect via Room ID & Password -->
      <div style="background:linear-gradient(135deg, rgba(235,115,0,0.18) 0%, rgba(163,113,247,0.18) 100%);border:2px solid #ff9b44;border-radius:10px;padding:16px 18px;margin-bottom:14px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <div>
          <div style="font-size:12px;font-weight:800;color:#ff9b44;text-transform:uppercase;letter-spacing:1px;">⚡ Connect via Room ID & Password</div>
          <div style="font-size:12px;color:#c9d1d9;margin-top:2px;">Enter the Host's Room ID and optional Password to join directly:</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#8b949e;display:block;margin-bottom:4px;">Room ID</label>
            <input type="text" class="online-input" style="width:100%;font-size:15px;font-weight:800;letter-spacing:1px;" placeholder="e.g. 1234" value="${this.joinRoomId || ''}" data-el="inpJoinRoomId" />
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#8b949e;display:block;margin-bottom:4px;">Password (Optional)</label>
            <input type="text" class="online-input" style="width:100%;font-size:14px;" placeholder="Leave empty if none" value="${this.joinPassword || ''}" data-el="inpJoinPassword" />
          </div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:11px;font-weight:600;color:${joinStatusColor};" data-el="txtSignalingStatus">
            ${joinStatusText}
          </div>
          <button class="online-btn online-btn--blue" data-el="btnJoinWithRoomId" style="font-size:15px;font-weight:800;padding:10px 22px;white-space:nowrap;background:#238636;border-color:#2ea043;">🚀 Join Room</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(235,115,0,0.1);border:1px solid rgba(235,115,0,0.3);padding:10px;border-radius:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:10px;font-weight:700;color:#ff9b44;text-transform:uppercase;">Your Seat (Car 1)</div>
            <div style="width:12px;height:12px;border-radius:50%;background:${myColor.hex};border:1px solid #fff;"></div>
          </div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">${this.playerName}</div>
          <div style="font-size:11px;color:${isConnected ? '#3fb950' : '#8b949e'};margin-top:2px;">
            ${isConnected ? '● Connected via 120Hz Transport' : '○ Waiting for Connection'}
          </div>
        </div>

        <div style="background:rgba(56,139,253,0.1);border:1px solid rgba(56,139,253,0.3);padding:10px;border-radius:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;">Host (Car 0)</div>
            ${hostColor ? `<div style="width:12px;height:12px;border-radius:50%;background:${hostColor.hex};border:1px solid #fff;"></div>` : ''}
          </div>
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px;">
            ${this.clientP2PChannel?.peerName || this.discoveredHostName || this.detectedLocalHost?.hostName || 'Standby for Host...'}
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
            <div style="font-size:11px;color:#c9d1d9;font-weight:400;margin-top:2px;">Authoritative snapshots streaming. Click "Enter Arena" to play!</div>
          </div>
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="online-btn online-btn--secondary" data-el="btnOpenNetworkHUD" style="flex:1;">📊 Network Diagnostics</button>
        <button class="online-btn online-btn--blue" data-el="btnEnterArena" style="flex:1;">🚗 Enter Arena</button>
      </div>

      <details style="margin-top:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 12px;">
        <summary style="cursor:pointer;color:#8b949e;font-size:12px;text-decoration:underline;">Have problems? Try manual pair ICE tokens</summary>
        <div style="margin-top:10px;">
          <div class="online-step-box">
            <div class="online-step-header">
              <span class="online-step-num">1</span>
              <span>Paste the Host's Offer Token here</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <textarea class="online-textarea" rows="2" placeholder="Paste Host Offer Token here..." data-el="txtOfferInput">${this.clientOfferInput || ''}</textarea>
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
        </div>
      </details>
    `;

    this._bindErrorBanner();
    this._bindColorPicker('client');

    const inpJoinRoom = this.dom.content.querySelector('[data-el="inpJoinRoomId"]');
    if (inpJoinRoom) {
      inpJoinRoom.addEventListener('input', (e) => {
        this.joinRoomId = e.target.value;
      });
      inpJoinRoom.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._joinWithRoomId(this.joinRoomId, this.joinPassword);
        }
      });
    }

    const inpJoinPass = this.dom.content.querySelector('[data-el="inpJoinPassword"]');
    if (inpJoinPass) {
      inpJoinPass.addEventListener('input', (e) => {
        this.joinPassword = e.target.value;
      });
      inpJoinPass.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._joinWithRoomId(this.joinRoomId, this.joinPassword);
        }
      });
    }

    this.dom.content.querySelector('[data-el="btnJoinWithRoomId"]')?.addEventListener('click', () => {
      this._joinWithRoomId(this.joinRoomId, this.joinPassword);
    });

    this.dom.content.querySelector('[data-el="btnBackLobby"]')?.addEventListener('click', () => {
      this.view = 'lobby';
      this.render();
    });

    this.dom.content.querySelector('[data-el="btnLeaveMatch"]')?.addEventListener('click', async () => {
      if (this.clientP2PChannel) {
        try { this.clientP2PChannel.destroy(); } catch (_) {}
        this.clientP2PChannel = null;
      }
      this.answerToken = '';
      if (this.callbacks.onLeaveServer) {
        await this.callbacks.onLeaveServer();
      }
      this.view = 'lobby';
      this.render();
    });

    const txtOffer = this.dom.content.querySelector('[data-el="txtOfferInput"]');
    if (txtOffer) {
      txtOffer.addEventListener('input', () => {
        this.clientOfferInput = txtOffer.value;
      });
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
    const offer = (inp?.value || this.clientOfferInput || '').trim();
    if (!offer) {
      this._showError('Input Missing', 'Please paste the Offer Token from the Host into Step 1 first.');
      return;
    }
    this.clientOfferInput = offer;

    try {
      // 1. Upfront pre-parsing of the host offer token
      let offerData = null;
      try {
        offerData = decodeSignalToken(offer);
      } catch (err) {
        console.warn('[OnlineDialog] Could not decode offer token:', err);
      }

      const hostSlot = offerData?.hostColorSlot;
      const hostName = offerData?.hostName || offerData?.playerName || 'Host';

      // 2. Check for color collision: fallback to next color slot
      let chosenColorSlot = this.clientColorSlot;
      let chosenColorHex = this.clientColorHex;

      if (hostSlot !== undefined && chosenColorSlot === hostSlot) {
        chosenColorSlot = (chosenColorSlot + 1) % CAR_COLOR_SLOTS.length;
        chosenColorHex = CAR_COLOR_SLOTS[chosenColorSlot].hex;
      }

      // 3. Instantiate client channel with the chosen (or fallback) color
      this.clientP2PChannel = new P2PWebRTCChannel({
        role: 'client',
        playerName: this.playerName,
        colorSlot: chosenColorSlot,
        colorHex: chosenColorHex,
        extraLatencyMs: 0
      });

      this.clientP2PChannel.onConnected = async () => {
        console.log('[OnlineDialog] Client WebRTC channel connected with host!');
        if (this.callbacks.onJoinServer) {
          await this.callbacks.onJoinServer({
            channel: this.clientP2PChannel,
            playerName: this.playerName,
            remotePlayerName: this.clientP2PChannel.peerName || hostName
          });
        }
        // Send client color immediately to host
        this.clientP2PChannel.sendColorChange(this.clientColorSlot, this.clientColorHex, 1);

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
        const cIdx = msg.carIndex ?? 0;
        if (msg.slotId !== undefined) {
          this.clientP2PChannel.peerColorSlot = msg.slotId;
          this.discoveredHostColorSlot = msg.slotId;
        }
        if (msg.hex !== undefined) {
          this.clientP2PChannel.peerColorHex = msg.hex;
        }
        this.callbacks.onColorSelect?.(cIdx, msg.slotId, msg.hex);
        this._renderJoinView();
      };

      // 4. Accept offer and generate answer token
      this.answerToken = await this.clientP2PChannel.acceptOfferAndCreateAnswer(offer, {
        clientColorSlot: chosenColorSlot,
        clientColorHex: chosenColorHex
      });

      // 5. Update discovered host info, resolved client color, and UI cards only after answer token is created
      if (hostSlot !== undefined) {
        this.discoveredHostColorSlot = hostSlot;
      }
      this.discoveredHostName = hostName;
      this.clientColorSlot = chosenColorSlot;
      this.clientColorHex = chosenColorHex;
      this.callbacks.onColorSelect?.(1, this.clientColorSlot, this.clientColorHex);

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
      if (this.isHosting && this.discoveryChannel) {
        this.discoveryChannel.postMessage({ type: 'host_closed', hostName: this.playerName });
        localStorage.removeItem('car_soccer_active_host');
      }
    } catch (_) {}

    try { this.hostP2PChannel?.destroy(); } catch (_) {}
    try { this.clientP2PChannel?.destroy(); } catch (_) {}
    try { this.signalingClient?.close(); } catch (_) {}
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
