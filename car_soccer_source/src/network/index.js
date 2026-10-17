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
  KICKOFF_SPAWN_PRESETS,
  ReplayRingBuffer,
  REPLAY_BUFFER_MODES,
  COUNTUP_REPLAY_DURATION_SECONDS,
  COUNTUP_REPLAY_CAPACITY_TICKS,
  COUNTDOWN_REPLAY_DURATION_SECONDS,
  COUNTDOWN_REPLAY_CAPACITY_TICKS
} from './MatchSessionAdmin.js';

export {
  assignSessionPlayerSlot,
  removeSessionPlayerSlot,
  updatePlayerLoadout,
  switchPlayerRoleOrTeam,
  encodeVisualIdIndex,
  decodeVisualIdIndex,
  encodeHitboxIdIndex,
  decodeHitboxIdIndex,
  packLoadoutSignalParam2,
  unpackLoadoutSignalParam2,
  packLoadoutCommandParam1,
  unpackLoadoutCommandParam1
} from './MatchRosterCoordinator.js';

export {
  VEHICLE_HITBOX_ARCHETYPES,
  VEHICLE_VISUAL_MODELS,
  PLAYER_ROLES,
  encodeRoleIndex,
  decodeRoleIndex,
  resolveVehicleHitboxId
} from '../config/vehicleConstants.js';

export {
  getExpectedAckPeerIds,
  dispatchMatchSignal,
  handleClientSignalAcks,
  handleClientCommands,
  handleClientCommand,
  checkSkipReplayVotes,
  checkRematchReady,
  initiateMatchPrepare,
  checkArenaLoadedBarrier
} from './MatchCommandCoordinator.js';

export {
  PhysicsEngineManager,
  MAX_INPUT_BUFFER_TICKS,
  NEUTRAL_CONTROLS
} from './PhysicsEngineManager.js';

export {
  EstablishedSessionManager,
  PeerSession,
  CLIENT_HEADER_SIZE,
  HEADER_SESSION_SIGNAL_FLAG,
  INPUT_STALE_NEUTRAL_TIMEOUT_MS,
  SESSION_DISCONNECT_TIMEOUT_MS
} from './EstablishedSessionManager.js';

export {
  SignalEventBuffer,
  DEFAULT_SIGNAL_BUFFER_CAPACITY,
  DEFAULT_SIGNAL_LIFETIME_TICKS,
  SIGNAL_WIRE_STRIDE
} from './SignalEventBuffer.js';

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

export {
  DIAGNOSTIC_VEHICLE_PROFILES,
  DEFAULT_DIAGNOSTIC_FLEET,
  computeDiagnosticVehicleControls,
  DiagnosticsTestVehicleController
} from './DiagnosticsTestVehicles.js';

export {
  HOST_WORKER_MSG_TYPES,
  createWorkerEnvelope
} from './HostWorkerProtocol.js';

export {
  HostWorkerMessageRouter,
  routeProtocolMessageInWorker,
  buildWorkerRoomStateSummary
} from './HostWorkerMessageRouter.js';

export {
  LobbyGhostCarCoordinator,
  DEFAULT_GHOST_OPACITY,
  LOBBY_COLLISION_MODES,
  LOBBY_GHOST_MODES
} from './LobbyGhostCarCoordinator.js';

export {
  handleAuthoritativeWorkerMessage,
  getAuthoritativeWorkerState
} from './AuthoritativeServerWorker.js';

