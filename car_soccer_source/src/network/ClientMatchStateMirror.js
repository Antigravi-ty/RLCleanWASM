/**
 * ClientMatchStateMirror.js
 * Client-side match state mirror and bot-fill policy helper for MatchSessionAdmin.
 */

import {
  DEFAULT_MATCH_DURATION_SECONDS,
  KICKOFF_COUNTDOWN_SECONDS,
} from './MatchLifecycleStepRunner.js';
import { MATCH_STATES } from './MatchRosterCoordinator.js';

export const MATCH_MODES = Object.freeze({ FREEPLAY: 'freeplay', MATCH: 'match' });
export const MATCH_PHASES = Object.freeze({
  PLAYING: 'playing',
  KICKOFF: 'kickoff',
  GOAL: 'goal',
  REPLAY: 'replay',
  PAUSED: 'paused',
  ENDED: 'ended',
  PODIUM: 'podium',
});

export const DEFAULT_MATCH_STATE = Object.freeze({
  mode: MATCH_MODES.FREEPLAY,
  phase: MATCH_PHASES.PLAYING,
  blueScore: 0,
  orangeScore: 0,
  remainingSeconds: DEFAULT_MATCH_DURATION_SECONDS,
  overtime: false,
  overtimeSeconds: 0,
  countdown: 0,
  winner: null,
  winReason: null,
  scorer: null,
  paused: false,
});

export class ClientMatchStateMirror {
  constructor() {
    this.state = { ...DEFAULT_MATCH_STATE };
  }

  start() {
    Object.assign(this.state, {
      mode: MATCH_MODES.MATCH,
      phase: MATCH_PHASES.KICKOFF,
      blueScore: 0,
      orangeScore: 0,
      remainingSeconds: DEFAULT_MATCH_DURATION_SECONDS,
      overtime: false,
      overtimeSeconds: 0,
      countdown: KICKOFF_COUNTDOWN_SECONDS,
      winner: null,
      winReason: null,
      scorer: null,
      paused: false,
    });
  }

  leave() {
    this.state.mode = MATCH_MODES.FREEPLAY;
    this.state.phase = MATCH_PHASES.PLAYING;
    this.state.paused = false;
  }
}

export function setSessionBotFillMode(admin, botFillMode = 'no_bots') {
  const valid = ['no_bots', 'auto_fill', 'bots_vs_humans', 'custom'];
  if (valid.includes(botFillMode)) {
    admin.botFillMode = botFillMode;
  }
  if (admin.botFillMode === 'no_bots' && admin.state === MATCH_STATES.LOBBY) {
    for (const [sid, p] of Array.from(admin.players.entries())) {
      if (p.isBot && sid !== 'bot') {
        admin.removePlayerSession(sid);
      }
    }
  }
}

export function addSessionBotPlayer(admin, preferredTeam = 1, botName = null, visualId = 'octane') {
  if (admin.players.size >= 6) return null;
  let botIdx = 1;
  while (admin.players.has(`bot_${botIdx}`)) {
    botIdx++;
  }
  const sid = `bot_${botIdx}`;
  const resolvedName = botName || `Bot ${botIdx}`;
  return admin.assignPlayerSlot(sid, resolvedName, 'player', preferredTeam, visualId);
}

export function applySessionBotFillPolicy(admin) {
  const maxPerTeam = Math.max(1, Math.floor(admin.maxPlayers / 2));
  if (admin.botFillMode === 'no_bots') {
    for (const [sid, p] of Array.from(admin.players.entries())) {
      if (p.isBot && sid !== 'bot') {
        admin.removePlayerSession(sid);
      }
    }
    return;
  }

  if (admin.botFillMode === 'custom') {
    return;
  }

  for (const [sid, p] of Array.from(admin.players.entries())) {
    if (p.isBot && String(sid).startsWith('bot_fill_')) {
      admin.removePlayerSession(sid);
    }
  }

  if (admin.botFillMode === 'bots_vs_humans') {
    for (const [sid, p] of Array.from(admin.players.entries())) {
      if (!p.isBot && p.team !== 0) {
        admin.switchPlayerRoleOrTeam(sid, 'player', 0);
      }
    }
    let orangeCount = 0;
    for (const p of admin.players.values()) {
      if (p.team === 1) orangeCount++;
    }
    let fillSeq = 1;
    while (orangeCount < maxPerTeam && admin.players.size < admin.maxPlayers) {
      const sid = `bot_fill_${fillSeq++}`;
      admin.assignPlayerSlot(sid, `Bot ${fillSeq - 1}`, 'player', 1, 'octane');
      orangeCount++;
    }
    return;
  }

  if (admin.botFillMode === 'auto_fill') {
    let blueCount = 0;
    let orangeCount = 0;
    for (const p of admin.players.values()) {
      if (p.team === 0) blueCount++;
      else if (p.team === 1) orangeCount++;
    }
    let fillSeq = 1;
    while (blueCount < maxPerTeam && admin.players.size < admin.maxPlayers) {
      const sid = `bot_fill_${fillSeq++}`;
      admin.assignPlayerSlot(sid, `Bot ${fillSeq - 1}`, 'player', 0, 'octane');
      blueCount++;
    }
    while (orangeCount < maxPerTeam && admin.players.size < admin.maxPlayers) {
      const sid = `bot_fill_${fillSeq++}`;
      admin.assignPlayerSlot(sid, `Bot ${fillSeq - 1}`, 'player', 1, 'octane');
      orangeCount++;
    }
  }
}
