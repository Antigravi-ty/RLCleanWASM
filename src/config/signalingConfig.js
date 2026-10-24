/**
 * signalingConfig.js
 * Centralized configuration and LocalStorage persistence for WebSocket Signaling Worker and Host Offers.
 */

import { safeStorage, STORAGE_KEYS } from './storageHelpers.ts';

export const DEFAULT_SIGNALING_URL = 'wss://unstable.test.breadguy.link/ws';
export const SIGNALING_ROOM_PREFIX = 'WEBRLROOM09211744-';

let _memorySignalingUrl = null;

export function getSignalingUrl() {
  const custom = safeStorage.get(STORAGE_KEYS.SIGNALING_URL);
  if (custom && custom.trim()) {
    return custom.trim();
  }
  return _memorySignalingUrl || DEFAULT_SIGNALING_URL;
}

export function setSignalingUrl(url) {
  const clean = url && typeof url === 'string' && url.trim() ? url.trim() : null;
  _memorySignalingUrl = clean;
  if (clean) {
    safeStorage.set(STORAGE_KEYS.SIGNALING_URL, clean);
  } else {
    safeStorage.remove(STORAGE_KEYS.SIGNALING_URL);
  }
}

export function saveActiveHostOffer(offerInfo) {
  safeStorage.set(
    STORAGE_KEYS.ACTIVE_HOST,
    JSON.stringify({
      ...offerInfo,
      timestamp: offerInfo.timestamp ?? Date.now(),
    })
  );
}

export function loadActiveHostOffer() {
  const raw = safeStorage.get(STORAGE_KEYS.ACTIVE_HOST);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[SignalingConfig] Failed to parse active host offer:', err);
    return null;
  }
}

export function clearActiveHostOffer() {
  safeStorage.remove(STORAGE_KEYS.ACTIVE_HOST);
}
