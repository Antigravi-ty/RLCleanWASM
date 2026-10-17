/**
 * SignalingConfig.js
 * Re-exports centralized configuration for WebSocket Signaling Worker from configStorageHydrators.
 */

export {
  DEFAULT_SIGNALING_URL,
  SIGNALING_ROOM_PREFIX
} from '../ui-system/core/configTypes.ts';

export {
  getSignalingUrl,
  setSignalingUrl
} from '../ui-system/core/configStorageHydrators.ts';
