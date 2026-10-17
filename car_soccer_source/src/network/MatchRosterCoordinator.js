import { MATCH_SIGNALS } from './GlobalPayloadCodec.js';
import { CAR_STATE_OFFSETS, CAR_STATE_STRIDE } from '../physics/RocketSimConstants.js';
import {
  CAR_COLOR_SLOTS,
  CAR_VISUAL_IDS,
  HITBOX_INDEX_TO_ID,
  PLAYER_ROLES,
  PLAYER_ROLE_CODES,
  normalizeVisualId,
  encodeVisualIdIndex,
  decodeVisualIdIndex,
  resolveHitboxIndex,
  decodeHitboxIndex,
  encodeHitboxIdIndex,
  decodeHitboxIdIndex,
  resolveVehicleHitboxId,
  packLoadoutSignalParam2,
  unpackLoadoutSignalParam2,
  packLoadoutCommandParam1,
  unpackLoadoutCommandParam1
} from '../config/vehicleConstants.js';
import {
  collectSessionUserRtt,
  buildRosterSnapshot,
  evaluateControlPacket as evaluateControlPacketInternal
} from './MatchControlPacketEvaluator.js';

export {
  CAR_VISUAL_IDS,
  HITBOX_INDEX_TO_ID,
  PLAYER_ROLES,
  PLAYER_ROLE_CODES,
  normalizeVisualId,
  encodeVisualIdIndex,
  decodeVisualIdIndex,
  resolveHitboxIndex,
  decodeHitboxIndex,
  encodeHitboxIdIndex,
  decodeHitboxIdIndex,
  resolveVehicleHitboxId,
  packLoadoutSignalParam2,
  unpackLoadoutSignalParam2,
  packLoadoutCommandParam1,
  unpackLoadoutCommandParam1,
  collectSessionUserRtt,
  buildRosterSnapshot
};

export const MATCH_STATES = Object.freeze({
  LOBBY: 'lobby',
  PREPARE: 'prepare',
  COUNTDOWN: 'countdown',
  KICKOFF: 'kickoff',
  KICKOFF_COUNTDOWN: 'kickoff',
  PLAYING: 'playing',
  GOAL_SCORED: 'goal_scored',
  REPLAY: 'replay',
  GOAL_REPLAY: 'replay',
  PAUSED: 'paused',
  ENDED: 'ended',
  PODIUM: 'podium'
});

export const KICKOFF_SPAWN_PRESETS = Object.freeze([
  { team0: { x: -1950, y: -2460, z: 17, yaw: -0.7854 }, team1: { x: 1950, y: 2460, z: 17, yaw: 2.3562 } },
  { team0: { x: 1950, y: -2460, z: 17, yaw: -2.3562 }, team1: { x: -1950, y: 2460, z: 17, yaw: 0.7854 } },
  { team0: { x: -256, y: -3840, z: 17, yaw: 1.5708 }, team1: { x: 256, y: 3840, z: 17, yaw: -1.5708 } },
  { team0: { x: 256, y: -3840, z: 17, yaw: 1.5708 }, team1: { x: -256, y: 3840, z: 17, yaw: -1.5708 } },
  { team0: { x: 0, y: -4608, z: 17, yaw: 1.5708 }, team1: { x: 0, y: 4608, z: 17, yaw: -1.5708 } }
]);

export function resolveDefaultColorSlotForTeam(team) {
  return team === 0 ? 3 : 0; // 3 = Sky Blue, 0 = Flame Red
}

export function assignSessionPlayerSlot(
  admin,
  sessionId,
  playerName = 'Player',
  role = 'player',
  preferredTeam = null,
  loadoutOptions = {},
  colorSlotArg = null
) {
  const normalizedLoadout = (typeof loadoutOptions === 'string' || typeof loadoutOptions === 'number')
    ? { visualId: loadoutOptions, colorSlot: colorSlotArg }
    : (loadoutOptions || {});
  const requestedVisual = decodeVisualIdIndex(normalizedLoadout.visualId ?? normalizedLoadout.visualIndex ?? 'octane');
  const requestedHitboxIndex = (normalizedLoadout.hitboxId !== undefined && normalizedLoadout.hitboxId !== null)
    ? resolveHitboxIndex(normalizedLoadout.hitboxId)
    : (normalizedLoadout.hitboxIndex !== undefined && normalizedLoadout.hitboxIndex !== null)
      ? resolveHitboxIndex(normalizedLoadout.hitboxIndex)
      : resolveHitboxIndex(requestedVisual);
  const requestedHitboxId = decodeHitboxIndex(requestedHitboxIndex);

  if (admin.players.has(sessionId)) {
    const existing = admin.players.get(sessionId);
    if (playerName && playerName !== 'Player') {
      existing.name = playerName;
      const s = admin.sessionManager?.getSession(sessionId);
      if (s) s.playerName = playerName;
    }
    if (normalizedLoadout.visualId !== undefined || normalizedLoadout.visualIndex !== undefined) {
      existing.visualId = requestedVisual;
      existing.visualIndex = encodeVisualIdIndex(requestedVisual);
    }
    if (normalizedLoadout.hitboxId !== undefined || normalizedLoadout.hitboxIndex !== undefined) {
      existing.hitboxId = requestedHitboxId;
      existing.hitboxIndex = requestedHitboxIndex;
    }
    if (typeof normalizedLoadout.colorSlot === 'number') {
      existing.colorSlot = normalizedLoadout.colorSlot;
    }
    return existing;
  }
  if (admin.spectators.has(sessionId) && role === 'spectator') {
    const existing = admin.spectators.get(sessionId);
    if (playerName && playerName !== 'Player') existing.name = playerName;
    return existing;
  }

  if (role === 'spectator' || admin.players.size >= admin.maxPlayers) {
    admin.spectators.set(sessionId, {
      sessionId,
      name: playerName,
      role: 'spectator',
      ready: true,
      arenaLoaded: true
    });
    admin.sessionManager?.registerSession(sessionId, { role: 'spectator', entityId: -1, playerName });
    admin.dispatchSignal(MATCH_SIGNALS.PLAYER_JOINED, admin.matchTick, -1, 2);
    return { entityId: -1, team: -1, role: 'spectator', spawnSlot: -1 };
  }

  let team0Count = 0;
  let team1Count = 0;
  const occupiedSlotsTeam0 = new Set();
  const occupiedSlotsTeam1 = new Set();

  for (const p of admin.players.values()) {
    if (p.team === 0) {
      team0Count++;
      occupiedSlotsTeam0.add(p.spawnSlot);
    } else {
      team1Count++;
      occupiedSlotsTeam1.add(p.spawnSlot);
    }
  }

  const maxPerTeam = Math.max(1, Math.floor(admin.maxPlayers / 2));
  let assignedTeam = preferredTeam;
  if (assignedTeam === 0 && team0Count >= maxPerTeam && team1Count < maxPerTeam) {
    assignedTeam = 1;
  } else if (assignedTeam === 1 && team1Count >= maxPerTeam && team0Count < maxPerTeam) {
    assignedTeam = 0;
  } else if (assignedTeam !== 0 && assignedTeam !== 1) {
    assignedTeam = (team0Count <= team1Count) ? 0 : 1;
  }

  let spawnSlot = 0;
  const targetOccupied = (assignedTeam === 0) ? occupiedSlotsTeam0 : occupiedSlotsTeam1;
  while (targetOccupied.has(spawnSlot) && spawnSlot < KICKOFF_SPAWN_PRESETS.length) {
    spawnSlot++;
  }

  let assignedEntityId = -1;
  const usedEntityIds = new Set(Array.from(admin.players.values()).map((p) => p.entityId));
  for (let i = 0; i < 6; i++) {
    if (!usedEntityIds.has(i)) {
      assignedEntityId = i;
      break;
    }
  }

  const visualIndex = encodeVisualIdIndex(requestedVisual);
  const colorSlot = typeof normalizedLoadout.colorSlot === 'number'
    ? normalizedLoadout.colorSlot
    : resolveDefaultColorSlotForTeam(assignedTeam);

  const isBotSession = sessionId === 'bot' || String(sessionId).startsWith('bot_');
  const playerInfo = {
    sessionId,
    entityId: assignedEntityId,
    carIndex: assignedEntityId,
    team: assignedTeam,
    name: playerName,
    role: 'player',
    spawnSlot,
    visualId: requestedVisual,
    visualIndex,
    hitboxId: requestedHitboxId,
    hitboxIndex: requestedHitboxIndex,
    colorSlot,
    ready: isBotSession,
    arenaLoaded: isBotSession,
    isBot: isBotSession
  };

  admin.players.set(sessionId, playerInfo);
  admin.sessionManager?.registerSession(sessionId, {
    role: 'player',
    entityId: assignedEntityId,
    playerName
  });

  if (admin.physicsManager && assignedEntityId >= 0) {
    admin.physicsManager.registerCarEntity(assignedEntityId, assignedTeam, requestedHitboxId);
    admin.physicsManager.applySignal('HOTSWAP_HITBOX', {
      carIndex: assignedEntityId,
      hitboxType: requestedHitboxId
    });
    const preset = KICKOFF_SPAWN_PRESETS[spawnSlot] || KICKOFF_SPAWN_PRESETS[0];
    const presetCoord = (assignedTeam === 0) ? preset.team0 : preset.team1;
    if (presetCoord && typeof admin.physicsManager.sim?.getCarState === 'function') {
      const cy = Math.cos(presetCoord.yaw);
      const sy = Math.sin(presetCoord.yaw);
      const carState = new Float32Array(CAR_STATE_STRIDE);
      carState[CAR_STATE_OFFSETS.POS] = presetCoord.x;
      carState[CAR_STATE_OFFSETS.POS + 1] = presetCoord.y;
      carState[CAR_STATE_OFFSETS.POS + 2] = presetCoord.z;
      carState[CAR_STATE_OFFSETS.FWD] = cy;
      carState[CAR_STATE_OFFSETS.FWD + 1] = sy;
      carState[CAR_STATE_OFFSETS.FWD + 2] = 0;
      carState[CAR_STATE_OFFSETS.RIGHT] = -sy;
      carState[CAR_STATE_OFFSETS.RIGHT + 1] = cy;
      carState[CAR_STATE_OFFSETS.RIGHT + 2] = 0;
      carState[CAR_STATE_OFFSETS.UP] = 0;
      carState[CAR_STATE_OFFSETS.UP + 1] = 0;
      carState[CAR_STATE_OFFSETS.UP + 2] = 1;
      carState[CAR_STATE_OFFSETS.BOOST] = (admin.state === MATCH_STATES.LOBBY || admin.isTrainingMode) ? 100.0 : 33.33;
      admin.physicsManager.sim.setCarState(assignedEntityId, carState);
    }
    if (admin.state === MATCH_STATES.LOBBY && admin.physicsManager.lobbyGhostCoordinator?.lobbyModeActive) {
      admin.physicsManager.syncLobbyGhostMasks?.();
    }
  }

  admin.dispatchSignal(MATCH_SIGNALS.PLAYER_JOINED, admin.matchTick, assignedEntityId, assignedTeam);
  admin.dispatchSignal(
    MATCH_SIGNALS.PLAYER_LOADOUT_UPDATED,
    admin.matchTick,
    assignedEntityId,
    packLoadoutSignalParam2(visualIndex, colorSlot, requestedHitboxIndex)
  );

  if (admin.autoStartWhenFull && admin.players.size >= admin.maxPlayers && admin.state === MATCH_STATES.LOBBY) {
    admin.initiateMatchPrepare?.();
  }

  return playerInfo;
}

export function removeSessionPlayerSlot(admin, sessionId) {
  const player = admin.players.get(sessionId);
  if (player) {
    const entityId = player.entityId;
    admin.players.delete(sessionId);
    admin.sessionManager?.unregisterSession(sessionId);
    if (admin.physicsManager && entityId >= 0) {
      admin.physicsManager.unregisterCarEntity(entityId);
    }
    admin.dispatchSignal(MATCH_SIGNALS.PLAYER_LEFT, admin.matchTick, entityId, player.team ?? 0);
    admin.skipReplayVotes?.delete(sessionId);
    admin.rematchVotes?.delete(sessionId);
    return;
  }
  if (admin.spectators.has(sessionId)) {
    admin.spectators.delete(sessionId);
    admin.sessionManager?.unregisterSession(sessionId);
    admin.dispatchSignal(MATCH_SIGNALS.PLAYER_LEFT, admin.matchTick, -1, 2);
  }
}

export function updatePlayerLoadout(admin, sessionId, visualIdOrPackedParam1, colorSlot = null, explicitHitbox = null) {
  const player = admin.players.get(sessionId);
  if (!player) return null;

  const unpacked = unpackLoadoutCommandParam1(visualIdOrPackedParam1);
  const visualId = unpacked.visualId;
  const visualIndex = unpacked.visualIndex;
  const hitboxIndex = (explicitHitbox !== null && explicitHitbox !== undefined)
    ? resolveHitboxIndex(explicitHitbox)
    : unpacked.hitboxIndex;
  const hitboxId = decodeHitboxIndex(hitboxIndex);
  let nextColorSlot = player.colorSlot;
  if (typeof colorSlot === 'number') {
    if (colorSlot >= 0 && colorSlot < CAR_COLOR_SLOTS.length) {
      nextColorSlot = colorSlot;
    } else {
      console.warn(`[MatchRosterCoordinator:Fallback] Out-of-range colorSlot ${colorSlot} for session "${sessionId}", keeping slot ${player.colorSlot}.`);
    }
  }

  player.visualId = visualId;
  player.visualIndex = visualIndex;
  player.hitboxId = hitboxId;
  player.hitboxIndex = hitboxIndex;
  player.colorSlot = nextColorSlot;

  const canHotSwapNow =
    admin.state === MATCH_STATES.LOBBY ||
    admin.state === MATCH_STATES.PREPARE ||
    admin.state === MATCH_STATES.KICKOFF ||
    admin.isTrainingMode;

  if (canHotSwapNow && admin.physicsManager && player.entityId >= 0) {
    admin.physicsManager.applySignal('HOTSWAP_HITBOX', {
      carIndex: player.entityId,
      hitboxType: hitboxId
    });
    player.pendingVisualId = null;
  } else {
    player.pendingVisualId = hitboxId;
  }

  const packedLoadout = packLoadoutSignalParam2(visualIndex, nextColorSlot, hitboxIndex);
  admin.dispatchSignal(
    MATCH_SIGNALS.PLAYER_LOADOUT_UPDATED,
    admin.matchTick,
    player.entityId,
    packedLoadout
  );

  return player;
}

export function switchPlayerRoleOrTeam(admin, sessionId, targetRole, targetTeam = 0) {
  const currentPlayer = admin.players.get(sessionId);
  const currentSpec = admin.spectators.get(sessionId);
  const playerName = currentPlayer?.name || currentSpec?.name || 'Player';
  const visualId = currentPlayer?.visualId || 'game-car';
  const hitboxId = currentPlayer?.hitboxId || visualId;
  const colorSlot = currentPlayer?.colorSlot ?? resolveDefaultColorSlotForTeam(targetTeam);

  if (targetRole === 'spectator' || targetRole === 2) {
    if (currentPlayer) {
      removeSessionPlayerSlot(admin, sessionId);
    }
    const specSlot = assignSessionPlayerSlot(admin, sessionId, playerName, 'spectator', null, { visualId, hitboxId, colorSlot });
    admin.dispatchSignal(
      MATCH_SIGNALS.PLAYER_SLOT_UPDATED,
      admin.matchTick,
      65535,
      PLAYER_ROLE_CODES.SPECTATOR
    );
    if (admin.dataHandler && sessionId && sessionId !== 'host') {
      admin.dataHandler.sendPacket(sessionId, JSON.stringify({
        type: 'handshake_response',
        entityId: -1,
        team: -1,
        role: 'spectator',
        roomId: admin.roomId,
        gameMode: admin.gameMode,
        matchTick: admin.matchTick,
        serverFrame: admin.matchTick,
        roster: buildRosterSnapshot(admin),
        state: admin.state,
        isHost: false
      }));
    }
    return specSlot;
  }

  const maxPerTeam = Math.max(1, Math.floor(admin.maxPlayers / 2));
  let teamCount = 0;
  for (const [sid, p] of admin.players.entries()) {
    if (sid !== sessionId && p.team === targetTeam) {
      teamCount++;
    }
  }
  if (teamCount >= maxPerTeam) {
    console.warn(`[MatchRosterCoordinator] Team ${targetTeam} is full (${teamCount}/${maxPerTeam}); keeping session "${sessionId}" in current slot.`);
    return currentPlayer || currentSpec || null;
  }

  if (currentPlayer && currentPlayer.team === targetTeam) {
    return currentPlayer;
  }

  if (currentPlayer || currentSpec) {
    removeSessionPlayerSlot(admin, sessionId);
  }
  const updated = assignSessionPlayerSlot(admin, sessionId, playerName, 'player', targetTeam, {
    visualId,
    hitboxId,
    colorSlot: resolveDefaultColorSlotForTeam(targetTeam)
  });

  if (updated && updated.entityId >= 0) {
    admin.dispatchSignal(
      MATCH_SIGNALS.PLAYER_SLOT_UPDATED,
      admin.matchTick,
      updated.entityId,
      updated.team
    );
    if (admin.dataHandler && sessionId && sessionId !== 'host') {
      admin.dataHandler.sendPacket(sessionId, JSON.stringify({
        type: 'handshake_response',
        entityId: updated.entityId,
        team: updated.team,
        spawnSlot: updated.spawnSlot,
        visualId: updated.visualId,
        visualIndex: updated.visualIndex,
        hitboxId: updated.hitboxId,
        hitboxIndex: updated.hitboxIndex,
        colorSlot: updated.colorSlot,
        roomId: admin.roomId,
        gameMode: admin.gameMode,
        matchTick: admin.matchTick,
        serverFrame: admin.matchTick,
        roster: buildRosterSnapshot(admin),
        state: admin.state,
        isHost: false
      }));
    }
  }
  return updated;
}

export function evaluateControlPacket(admin, channelId, packetType, packetData) {
  return evaluateControlPacketInternal(admin, channelId, packetType, packetData, updatePlayerLoadout);
}
