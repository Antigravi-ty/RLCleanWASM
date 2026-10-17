/**
 * RuntimeOnlineRosterSync.js
 * Roster snapshot hydration and remote peer vehicle lifecycle synchronization
 * for RuntimeNetworkManager.
 */

import { CAR_COLOR_SLOTS } from '../../entities/CarColorConstants.js';
import { useUIStore } from '../../ui-system/index';
import {
  spawnRuntimeDiagnosticTestFleet,
  despawnRuntimeDiagnosticTestFleet
} from './RuntimeNetworkDiagnosticsHelper.js';

export async function applyRuntimeRosterSnapshot(runtime, roster) {
  const r = runtime;
  if (!roster || !Array.isArray(roster.players)) return;

  await r.arena?.ensureOpponent?.();
  for (const p of roster.players) {
    const cIdx = p.entityId;
    if (typeof cIdx !== 'number' || cIdx < 0 || cIdx >= 8) continue;
    const preset = p.visualId || 'octane';
    const hitbox = p.hitboxId || preset;
    const team = p.team ?? (cIdx % 2);

    r.networkReconciler?.setCarVisualPreset?.(cIdx, preset);

    while (r.physics && r.physics.numCars <= cIdx) {
      const nextIdx = r.physics.numCars;
      r.physics.addCar(nextIdx === cIdx ? team : (nextIdx % 2), r.networkReconciler?.carVisualPresets?.get(nextIdx) || 'octane');
    }
    if (r.arena) {
      if (typeof r.arena.ensureCar === 'function') {
        r.arena.ensureCar(cIdx, team, 'game-car');
      } else {
        while (r.arena.cars.length <= cIdx) {
          r.arena.addCar(r.arena.cars.length % 2, 'game-car');
        }
      }
      if (r.arena.cars[cIdx]) {
        r.arena.cars[cIdx].visible = true;
      }
    }

    if (r.entityManager) {
      r.entityManager.hotSwapVehicle(cIdx, { visual: preset, hitbox });
    } else {
      r.arena?.swapCarVisual?.(cIdx, preset);
      r.physics?.setCarHitbox?.(cIdx, hitbox);
    }

    if (p.colorSlot > 0) {
      const slotObj = CAR_COLOR_SLOTS.find((s) => s.id === p.colorSlot);
      if (slotObj) {
        r.arena?.setCarColor?.(cIdx, slotObj.hex);
      }
    } else {
      r.arena?.setCarTeam?.(cIdx, team);
    }
  }
}

export async function onRuntimeRemotePlayerConnected(runtime, channel, remotePlayerName = 'Player 2', assignedCarIndex = null) {
  const r = runtime;
  if (r.authoritativeServer) {
    if (!(r.remotePeerCarMap instanceof Map)) {
      r.remotePeerCarMap = new Map();
    }
    const channelId = r.authoritativeServer.addClientChannel(channel);
    let targetCarIndex = assignedCarIndex;
    if (typeof targetCarIndex !== 'number' || targetCarIndex < 1) {
      const existingPeers = useUIStore?.getState?.()?.onlineSession?.connectedPeers || [];
      const usedCarIndices = new Set([
        ...existingPeers.map((p) => p.carIndex).filter((idx) => typeof idx === 'number'),
        ...r.remotePeerCarMap.values()
      ]);
      for (let i = 1; i < 6; i++) {
        if (!usedCarIndices.has(i)) {
          targetCarIndex = i;
          break;
        }
      }
      if (typeof targetCarIndex !== 'number') targetCarIndex = 1;
    }
    r.remotePeerCarMap.set(channelId || `peer_${targetCarIndex}`, targetCarIndex);
    if (channel) {
      channel.carIndex = targetCarIndex;
    }

    const team = targetCarIndex % 2;
    const peerVisualId = channel?.visualId || 'octane';
    const peerColorSlot = channel?.colorSlot ?? 0;
    r.authoritativeServer.ensureCar(targetCarIndex, team, peerVisualId);
    r.authoritativeServer.notifyPlayerJoined(targetCarIndex, remotePlayerName, 'player', channelId, peerVisualId, peerColorSlot);

    await r.arena.ensureOpponent();
    if (typeof r.arena.ensureCar === 'function') {
      r.arena.ensureCar(targetCarIndex, team, 'game-car');
    } else {
      while (r.arena.cars.length <= targetCarIndex) {
        r.arena.addCar(r.arena.cars.length % 2, 'game-car');
      }
      if (!r.arena.cars[targetCarIndex]) {
        r.arena.addCar(team, 'game-car', targetCarIndex);
      }
    }
    const isLobby = Boolean(
      r.networkManager?.lobbyGhostCoordinator?.lobbyModeActive ||
      r.match?.state?.mode !== 'match' ||
      r.match?.state?.phase === 'lobby'
    );
    if (r.arena.cars[targetCarIndex]) {
      r.arena.cars[targetCarIndex].visible = !isLobby;
    }
    while (r.physics.numCars <= targetCarIndex) {
      r.physics.addCar(r.physics.numCars % 2, peerVisualId);
    }
    r.physics.setCarHitbox(targetCarIndex, peerVisualId);
    if (isLobby) {
      r.authoritativeServer?.setGhostCarConfig?.(targetCarIndex, false, false, 0);
      r.physics?.setCarCollisionMask?.(targetCarIndex, false, false);
      if (r.arena.cars[targetCarIndex]) {
        r.arena.cars[targetCarIndex].visible = false;
      }
    } else if (r.networkManager?.lobbyGhostCoordinator?.lobbyModeActive) {
      r.networkManager.setLobbyGhostMode(true);
    }
    if (r.interpolator) {
      r.interpolator.sync(performance.now());
    }
    if (channel) {
      channel.onColorChange = (msg) => {
        const cIdx = msg.carIndex ?? targetCarIndex;
        r.setCarColor(cIdx, msg.hex, false);
      };
      channel.onDiagnosticFleetToggle = (enabled, anchorMode) => {
        if (enabled) {
          spawnRuntimeDiagnosticTestFleet(r, { anchorMode });
        } else {
          despawnRuntimeDiagnosticTestFleet(r);
        }
      };
    }
    if (useUIStore && typeof useUIStore.getState === 'function') {
      const existingPeers = (useUIStore.getState().onlineSession?.connectedPeers || []).filter((p) => p.carIndex !== targetCarIndex);
      const ping = Math.round(channel?.measuredRttMs || 15);
      useUIStore.getState().setOnlineSession({
        connectedPeers: [...existingPeers, { id: channel?.peerId || `peer_${targetCarIndex}`, name: remotePlayerName, carIndex: targetCarIndex, pingMs: ping }]
      });
    }
    return targetCarIndex;
  }
  return assignedCarIndex;
}

export async function removeRuntimeRemotePlayer(runtime, carIndex) {
  const r = runtime;
  if (carIndex === r.playerCarIndex) return;

  if (r.remotePeerCarMap instanceof Map) {
    for (const [k, v] of r.remotePeerCarMap.entries()) {
      if (v === carIndex) r.remotePeerCarMap.delete(k);
    }
  }

  if (r.arena) {
    r.arena.removeCar?.(carIndex);
  }
  if (r.flipResetVisuals?.has?.(carIndex)) {
    r.flipResetVisuals.get(carIndex).stopVisual?.();
    r.flipResetVisuals.delete(carIndex);
  }

  if (r.authoritativeServer) {
    r.authoritativeServer.removeCar?.(carIndex);
  }

  if (useUIStore && typeof useUIStore.getState === 'function') {
    const peers = useUIStore.getState().onlineSession?.connectedPeers || [];
    useUIStore.getState().setOnlineSession({
      connectedPeers: peers.filter((p) => p.carIndex !== carIndex)
    });
  }
}
