/**
 * src/network/index.js
 * Unified Barrel Export for Car Soccer Network Subsystem.
 */

export {
  NetworkDataHandler,
  PACKET_TYPES
} from './NetworkDataHandler.js';

export {
  MatchSessionAdmin,
  MATCH_STATES,
  KICKOFF_SPAWN_PRESETS
} from './MatchSessionAdmin.js';

export {
  PhysicsEngineManager,
  MAX_INPUT_BUFFER_TICKS,
  NEUTRAL_CONTROLS
} from './PhysicsEngineManager.js';

export {
  EstablishedSessionManager,
  PeerSession,
  CLIENT_HEADER_SIZE
} from './EstablishedSessionManager.js';

export {
  GlobalPayloadCodec,
  PAYLOAD_FLAGS,
  MATCH_SIGNALS,
  SIGNAL_NAMES
} from './GlobalPayloadCodec.js';

export {
  InputPacketCodec,
  MAGIC_BYTE
} from './InputPacketCodec.js';

export {
  HostServerWorker
} from './HostServerWorker.js';

export {
  PredictionReconciler
} from './PredictionReconciler.js';

export {
  P2PWebRTCChannel,
  encodeSignalToken,
  decodeSignalToken,
  injectLoopbackCandidate,
  injectLoopbackIntoSdp,
  ensureValidSdp,
  injectLoopback,
  getLoopbackPortFromCandidates,
  packSdp,
  unpackSdp,
  pack,
  unpack
} from "./P2PWebRTCChannel.js";

export {
  WebSocketSignalingClient
} from './WebSocketSignalingClient.js';

export {
  DEFAULT_SIGNALING_URL,
  getSignalingUrl,
  setSignalingUrl
} from './SignalingConfig.js';

export {
  RoomConnectionProgressManager,
  roomConnectionProgress,
  ConnectionStatus,
  HOST_CONNECTION_STEPS,
  JOIN_CONNECTION_STEPS
} from './RoomConnectionProgressManager.js';
