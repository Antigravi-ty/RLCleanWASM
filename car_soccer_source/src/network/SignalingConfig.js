/**
 * src/network/SignalingConfig.js
 * Centralized Configuration for WebSocket Signaling Worker.
 */

export const DEFAULT_SIGNALING_URL = 'wss://unstable.test.breadguy.link/ws';
export const SIGNALING_ROOM_PREFIX = 'WEBRLROOM09211744-';

let _memorySignalingUrl = null;

/**
 * Retrieves the effective signaling server URL (checks localStorage first, falls back to memory / default)
 * @returns {string}
 */
export function getSignalingUrl() {
  if (typeof localStorage !== 'undefined') {
    try {
      const custom = localStorage.getItem('car_soccer_signaling_url');
      if (custom && custom.trim()) {
        return custom.trim();
      }
    } catch (_) {}
  }
  return _memorySignalingUrl || DEFAULT_SIGNALING_URL;
}

/**
 * Persists a customized signaling server URL to localStorage & in-memory cache
 * @param {string|null} url
 */
export function setSignalingUrl(url) {
  const clean = url && typeof url === 'string' && url.trim() ? url.trim() : null;
  _memorySignalingUrl = clean;
  if (typeof localStorage !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem('car_soccer_signaling_url', clean);
      } else {
        localStorage.removeItem('car_soccer_signaling_url');
      }
    } catch (_) {}
  }
}
