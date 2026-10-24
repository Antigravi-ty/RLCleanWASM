/**
 * src/network/multiplayer/MultiplayerSessionManager.js
 * Unified Headless Multiplayer Session Coordinator.
 * Manages host/client WebRTC lifecycles and signaling negotiation without legacy DOM coupling.
 */

import { SignalingProtocolHandler } from './SignalingProtocolHandler.js';
import { HostSessionController } from './HostSessionController.js';
import { ClientSessionController } from './ClientSessionController.js';
import { CAR_COLOR_SLOTS } from '../../config/vehicleConstants.js';
import { roomConnectionProgress } from '../../stores/roomConnectionProgressStore.js';
import {
  loadStoredPlayerName,
  getPreferredColorSlot,
  saveActiveHostOffer,
  clearActiveHostOffer
} from '../../config/uiConfig';

export class MultiplayerSessionManager {
  /**
   * @param {object} callbacks
   * @param {(opts: { playerName: string }) => Promise<void>} callbacks.onHostServer
   * @param {() => Promise<void>} [callbacks.onStopServer]
   * @param {() => Promise<void>} [callbacks.onLeaveServer]
   * @param {(opts: { channel: any, playerName: string, remotePlayerName: string }) => Promise<void>} callbacks.onJoinServer
   * @param {(channel: any, remotePlayerName: string) => Promise<void>} callbacks.onPeerConnected
   * @param {(carIndex: number, slotId: number, hex: string) => void} [callbacks.onColorSelect]
   * @param {(carIndex: number) => Promise<void>} [callbacks.onRemovePlayer]
   * @param {(status: object) => void} [callbacks.onSessionStatusChange]
   */
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.playerName = this._loadPlayerName();

    this.isHosting = false;
    this.roomId = '';
    this.password = '';
    this.joinRoomId = '';
    this.joinPassword = '';

    const savedColorSlot = this._loadPreferredColorSlot();
    this.hostColorSlot = savedColorSlot ?? 3;
    this.hostColorHex = CAR_COLOR_SLOTS[this.hostColorSlot]?.hex || '#42a5f5';

    this.clientColorSlot = savedColorSlot ?? (this.hostColorSlot === 0 ? 3 : 0);
    this.clientColorHex = CAR_COLOR_SLOTS[this.clientColorSlot]?.hex || '#ff7043';

    this.hostController = null;
    this.clientController = null;
    this.signalingHandler = null;
  }

  _updateSessionStatus(status) {
    if (typeof this.callbacks.onSessionStatusChange === 'function') {
      try {
        this.callbacks.onSessionStatusChange(status);
      } catch (err) {
        console.warn('[MultiplayerSessionManager] Error in onSessionStatusChange callback:', err);
      }
    }
  }

  _loadPlayerName() {
    return loadStoredPlayerName('Player').substring(0, 16);
  }

  _loadPreferredColorSlot() {
    const idx = getPreferredColorSlot();
    return idx >= 0 && idx < CAR_COLOR_SLOTS.length ? idx : null;
  }

  get hostP2PChannel() {
    return this.hostController?.channel || null;
  }

  get clientP2PChannel() {
    return this.clientController?.channel || null;
  }

  get signalingClient() {
    return this.signalingHandler?.client || null;
  }

  async startHosting(roomId = null, password = '', roomConfig = {}) {
    this.roomId = (roomId || String(Math.floor(1000 + Math.random() * 9000))).trim();
    this.password = String(password || '');
    this.isHosting = true;

    roomConnectionProgress.startHost();
    roomConnectionProgress.advance('worker_init', 'Initializing Authoritative Server Worker');

    if (this.callbacks.onHostServer) {
      await this.callbacks.onHostServer({
        playerName: this.playerName,
        roomId: this.roomId,
        ...roomConfig,
      });
    }

    roomConnectionProgress.advance('physics_ready', 'Configuring Arena & Physics');
    this.callbacks.onColorSelect?.(0, this.hostColorSlot, this.hostColorHex);

    this.hostController = new HostSessionController({
      roomId: this.roomId,
      playerName: this.playerName,
      colorSlot: this.hostColorSlot,
      colorHex: this.hostColorHex,
    }, {
      onPeerConnected: async (channel, peerName, peerId, role) => {
        let assignedCarIdx;
        if (this.callbacks.onPeerConnected) {
          assignedCarIdx = await this.callbacks.onPeerConnected(channel, peerName, peerId, role);
          if (typeof assignedCarIdx === 'number' && assignedCarIdx >= 0) {
            channel.carIndex = assignedCarIdx;
          }
        }
        this._updateSessionStatus({
          connectedPeers: this.hostController?.getConnectedPeerList?.() || [
            { id: peerId || channel.peerId || 'peer-1', name: peerName, carIndex: assignedCarIdx, pingMs: 0 }
          ],
        });
        return assignedCarIdx;
      },
      onPeerDisconnected: (peerId, channel) => {
        if (typeof channel?.carIndex === 'number' && channel.carIndex > 0) {
          this.callbacks.onRemovePlayer?.(channel.carIndex);
        }
        this._updateSessionStatus({
          connectedPeers: this.hostController?.getConnectedPeerList?.() || []
        });
      },
      onColorChange: (carIdx, slotId, hex) => {
        this.callbacks.onColorSelect?.(carIdx, slotId, hex);
      },
      onIceCandidate: (cand, targetPeerId) => {
        if (this.signalingHandler) {
          this.signalingHandler.sendCandidate(targetPeerId || null, cand);
        }
      },
    });

    const offerToken = await this.hostController.initializeChannel();

    saveActiveHostOffer({
      roomId: this.roomId,
      token: offerToken,
      colorSlot: this.hostColorSlot,
      colorHex: this.hostColorHex,
      playerName: this.playerName,
      timestamp: Date.now(),
    });

    this.initHostSignaling();
    roomConnectionProgress.complete('Room Active. Ready for Players');
    return offerToken;
  }

  initHostSignaling() {
    if (!this.isHosting) return;
    this.signalingHandler = new SignalingProtocolHandler({
      roomId: this.roomId,
      password: this.password,
      role: 'host',
      playerName: this.playerName,
    }, {
      onOpen: () => {
        this._updateSessionStatus({ signalingConnected: true, roomId: this.roomId });
      },
      onClose: () => {
        if (this.isHosting) {
          this.signalingHandler.scheduleReconnect(3000, () => this.initHostSignaling());
        }
      },
      onError: () => {
        this._updateSessionStatus({ signalingConnected: false });
        if (this.isHosting) {
          this.signalingHandler?.scheduleReconnect(3000, () => this.initHostSignaling());
        }
      },
      onPeerJoined: ({ peerId, name, peerName, role }) => {
        this.hostController?.dispatchOfferToPeer(peerId, name || peerName, this.signalingHandler, role || 'player');
      },
      onRoomInfo: ({ participants }) => {
        if (!Array.isArray(participants) || !this.isHosting) return;
        for (const p of participants) {
          if (p?.peerId && p.peerId !== this.signalingHandler?.peerId) {
            this.hostController?.dispatchOfferToPeer(p.peerId, p.peerName || p.name, this.signalingHandler, p.role || 'player');
          }
        }
      },
      onRequestOffer: ({ fromPeerId, name, senderName, role }) => {
        this.hostController?.dispatchOfferToPeer(fromPeerId, name || senderName, this.signalingHandler, role || 'player');
      },
      onAnswer: async ({ sdp, fromPeerId }) => {
        try {
          await this.hostController?.handleAnswer(sdp, fromPeerId || null);
        } catch (err) {
          console.error('[MultiplayerSessionManager] Error accepting peer answer:', err);
          throw err;
        }
      },
      onCandidate: ({ candidate, fromPeerId }) => {
        this.hostController?.handleRemoteCandidate(candidate, fromPeerId || null);
      },
    });

    this.signalingHandler.connect().catch((err) => {
      console.warn('[MultiplayerSessionManager] Signaling connection notice:', err?.message || err);
      if (this.isHosting) {
        console.log('[MultiplayerSessionManager] Host signaling attempt failed, scheduling reconnect in 3s...');
        this.signalingHandler?.scheduleReconnect(3000, () => this.initHostSignaling());
      }
    });
  }

  async joinRoom(roomId, password = '', timeoutMs = 10000) {
    const cleanRoomId = (roomId || '').trim();
    if (!cleanRoomId) {
      throw new Error('[MultiplayerSessionManager] Room ID is required to join');
    }

    this.joinRoomId = cleanRoomId;
    this.joinPassword = String(password || '');

    roomConnectionProgress.startJoin();
    roomConnectionProgress.advance('signaling_connect', 'Connecting to Token Signaling Server');

    return new Promise(async (resolve, reject) => {
      let settled = false;
      let timer = null;

      const finishSuccess = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(true);
      };

      const finishFailure = (err) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        roomConnectionProgress.fail(err);
        this.leaveSession?.();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const ch = this.clientP2PChannel;
          if (ch && (ch.connected || ch.isOpen)) {
            finishSuccess();
          } else if (this.signalingHandler?.status === 'connected') {
            finishFailure(new Error(`Connected to signaling server, but Host in room "${cleanRoomId}" did not respond within ${Math.round(timeoutMs / 1000)}s. Please check room code or ensure Host is online.`));
          } else {
            finishFailure(new Error(`Join room connection timed out after ${Math.round(timeoutMs / 1000)}s (Signaling server unreachable or slow)`));
          }
        }, timeoutMs);
      }

      this.clientController = new ClientSessionController({
        roomId: cleanRoomId,
        playerName: this.playerName,
        colorSlot: this.clientColorSlot,
        colorHex: this.clientColorHex,
      }, {
        onConnected: async (channel, peerName) => {
          roomConnectionProgress.advance('state_sync', 'Synchronizing Game Timeline & State');
          this._updateSessionStatus({
            signalingConnected: true,
            connectedPeers: [{ id: 'host', name: peerName, pingMs: 0 }],
          });
          if (this.callbacks.onJoinServer) {
            await this.callbacks.onJoinServer({
              channel,
              playerName: this.playerName,
              remotePlayerName: peerName,
            });
          }
          roomConnectionProgress.complete('Connected. Entering Arena');
          finishSuccess();
        },
        onDisconnected: () => {
          this._updateSessionStatus({ connectedPeers: [] });
          if (!settled) {
            finishFailure(new Error('P2P channel disconnected'));
          }
        },
        onIceCandidate: (cand) => {
          if (this.signalingHandler) {
            this.signalingHandler.sendCandidate(null, cand);
          }
        },
      });

      try {
        await this.clientController.initializeChannel();
      } catch (e) {
        console.error('[MultiplayerSessionManager] Failed to initialize client channel:', e);
        return finishFailure(e);
      }

      this.signalingHandler = new SignalingProtocolHandler({
        roomId: cleanRoomId,
        password: this.joinPassword,
        role: 'client',
        playerName: this.playerName,
      }, {
        onOpen: () => {
          this._updateSessionStatus({ signalingConnected: true, roomId: cleanRoomId });
          roomConnectionProgress.advance('find_room', 'Connected to Signaling. Awaiting Host Offer');
          this.signalingHandler.send({
            type: 'request_offer',
            fromPeerId: this.signalingHandler.peerId,
            name: this.playerName,
          });
        },
        onError: () => {
          if (!this.clientP2PChannel?.connected) {
            this._updateSessionStatus({ signalingConnected: false });
          }
        },
        onRoomInfo: ({ participants }) => {
          if (!Array.isArray(participants)) return;
          for (const p of participants) {
            if (p?.peerId && p.peerId !== this.signalingHandler?.peerId) {
              this.signalingHandler.send({
                type: 'request_offer',
                targetPeerId: p.peerId,
                fromPeerId: this.signalingHandler.peerId,
                name: this.playerName,
              });
            }
          }
        },
        onOffer: async ({ sdp, fromPeerId }) => {
          try {
            roomConnectionProgress.advance('webrtc_offer', 'Receiving Host Offer & Creating Answer');
            await this.clientController.handleOffer(sdp, fromPeerId, this.signalingHandler);
          } catch (err) {
            console.error('[MultiplayerSessionManager] Error handling host offer:', err);
            finishFailure(err);
          }
        },
        onCandidate: ({ candidate }) => {
          roomConnectionProgress.advance('ice_exchange', 'Exchanging ICE Candidates & Establishing P2P');
          this.clientController.handleRemoteCandidate(candidate);
        },
      });

      try {
        await this.signalingHandler.connect(timeoutMs);
      } catch (sigErr) {
        console.warn('[MultiplayerSessionManager] Signaling connection notice:', sigErr?.message || sigErr);
        const ch = this.clientP2PChannel;
        if (!ch || (!ch.connected && !ch.isOpen)) {
          finishFailure(sigErr);
        }
      }
    });
  }

  async stopHosting() {
    this.isHosting = false;
    if (this.signalingHandler) {
      this.signalingHandler.cleanup();
      this.signalingHandler = null;
    }
    if (this.hostController) {
      this.hostController.cleanup();
      this.hostController = null;
    }
    clearActiveHostOffer();
    if (this.callbacks.onStopServer) {
      await this.callbacks.onStopServer();
    }
  }

  async leaveSession() {
    if (this.signalingHandler) {
      this.signalingHandler.cleanup();
      this.signalingHandler = null;
    }
    if (this.clientController) {
      this.clientController.cleanup();
      this.clientController = null;
    }
    if (this.callbacks.onLeaveServer) {
      await this.callbacks.onLeaveServer();
    }
  }

  reconnectSignaling() {
    if (this.signalingHandler) {
      this.signalingHandler.connect().catch((err) => {
        console.warn('[MultiplayerSessionManager] Reconnect error:', err);
      });
    }
  }
}

export default MultiplayerSessionManager;
