/**
 * src/network/MatchControlPacketEvaluator.js
 * Handshake response assembly, RTT telemetry collection, and JSON control packet evaluation
 * for MatchSessionAdmin / MatchRosterCoordinator.
 */

export function collectSessionUserRtt(sessionManager) {
  const playersRtt = [null, null, null, null, null, null];
  const spectatorsRtt = [];

  if (!sessionManager) {
    return { players: playersRtt, spectators: spectatorsRtt };
  }

  const sessions = sessionManager.getAllSessions();
  for (const session of sessions) {
    if (session.role === 'player' && session.entityId >= 0 && session.entityId < 6) {
      playersRtt[session.entityId] = Math.round(session.rttMs || 0);
    } else if (session.role === 'spectator') {
      spectatorsRtt.push({
        id: spectatorsRtt.length,
        rtt: Math.round(session.rttMs || 0)
      });
    }
  }

  return {
    players: playersRtt,
    spectators: spectatorsRtt
  };
}

export function buildRosterSnapshot(admin) {
  const players = [];
  for (const p of admin.players.values()) {
    players.push({
      sessionId: p.sessionId,
      entityId: p.entityId,
      team: p.team,
      name: p.name,
      spawnSlot: p.spawnSlot,
      visualId: p.visualId,
      visualIndex: p.visualIndex,
      hitboxId: p.hitboxId,
      hitboxIndex: p.hitboxIndex,
      colorSlot: p.colorSlot,
      ready: Boolean(p.ready),
      arenaLoaded: Boolean(p.arenaLoaded)
    });
  }
  const spectators = [];
  for (const s of admin.spectators.values()) {
    spectators.push({
      sessionId: s.sessionId,
      name: s.name,
      role: 'spectator'
    });
  }
  return { players, spectators };
}

export function evaluateControlPacket(admin, channelId, packetType, packetData, updatePlayerLoadoutFn) {
  if (!packetData) return null;
  const type = packetData.type || packetType;

  if (type === 'join' || type === 'join_training' || type === 'token' || type === 'handshake_request') {
    const playerName = packetData.playerName || packetData.clientName || 'Player';
    const role = packetData.role || 'player';
    const preferredTeam = packetData.preferredTeam ?? null;
    const playerInfo = admin.assignPlayerSlot(channelId, playerName, role, preferredTeam, {
      visualId: packetData.visualId || packetData.carVisual || 'game-car',
      hitboxId: packetData.hitboxId || packetData.carHitbox || null,
      colorSlot: packetData.colorSlot
    });

    if (admin.dataHandler) {
      const initialSnap = admin.physicsManager?.sim?.saveState ? Array.from(admin.physicsManager.sim.saveState()) : null;
      admin.dataHandler.sendPacket(channelId, JSON.stringify({
        type: 'handshake_response',
        entityId: playerInfo.entityId,
        team: playerInfo.team,
        spawnSlot: playerInfo.spawnSlot,
        visualId: playerInfo.visualId,
        visualIndex: playerInfo.visualIndex,
        hitboxId: playerInfo.hitboxId,
        hitboxIndex: playerInfo.hitboxIndex,
        colorSlot: playerInfo.colorSlot,
        roomId: admin.roomId,
        gameMode: admin.gameMode,
        matchTick: admin.matchTick,
        serverFrame: admin.matchTick,
        initialSnapshot: initialSnap,
        roster: buildRosterSnapshot(admin),
        state: admin.state,
        isHost: false
      }));
    }
    return playerInfo;
  }

  if (type === 'color_change' || type === 'loadout_change') {
    if (packetData.visualId !== undefined || packetData.slotId !== undefined || packetData.hitboxId !== undefined) {
      if (typeof updatePlayerLoadoutFn === 'function') {
        updatePlayerLoadoutFn(
          admin,
          channelId,
          packetData.visualId ?? 'game-car',
          packetData.slotId,
          packetData.hitboxId ?? null
        );
      } else {
        admin.updatePlayerLoadout?.(
          channelId,
          packetData.visualId ?? 'game-car',
          packetData.slotId,
          packetData.hitboxId ?? null
        );
      }
    }
    if (admin.dataHandler) {
      admin.dataHandler.broadcast(JSON.stringify(packetData), (id) => id !== channelId);
    }
    return null;
  }

  if (type === 'client_command' && typeof packetData.commandType === 'number') {
    admin.handleClientCommand?.(channelId, packetData);
    return null;
  }

  if (type === 'ping') {
    if (typeof packetData.rtt === 'number') {
      const session = admin.sessionManager?.getSession(channelId);
      if (session) {
        session.updateRtt(packetData.rtt);
      }
    }
    if (admin.dataHandler) {
      admin.dataHandler.sendPacket(channelId, JSON.stringify({
        type: 'pong',
        sendTime: packetData.sendTime || Date.now(),
        serverTime: Date.now()
      }));
    }
    return null;
  }

  if (type === 'leave') {
    admin.removePlayerSession(channelId);
    return null;
  }

  return null;
}
