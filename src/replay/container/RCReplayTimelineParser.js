/**
 * src/replay/container/RCReplayTimelineParser.js
 * Three-Timeline Replay Parser & Range Cursor Architecture for V2 RC Replays:
 *   - Timeline 1 (Track A): StateInputTimeline (120Hz 448-float State + 64B 8-car Input)
 *   - Timeline 2 (Track B): IncidentTimeline   (64B PhysicsEvent Stream with O(log N) range queries)
 *   - Timeline 3 (Track C): SignalTimeline     (64B Match Signal Stream with O(log N) range queries & HUD state evaluation)
 */

import {
  STATE_BUFFER_FLOATS,
  INCIDENT_EVENT_TYPES,
  MATCH_SIGNALS,
} from '../../physics/RocketSimConstants.js';
import { resolveReplayAudioCueForSignal } from '../ReplayRingBuffer.js';

export const INCIDENT_TYPE_LABELS = Object.freeze({
  [INCIDENT_EVENT_TYPES.CAR_BALL_HIT]: 'Car-Ball Hit',
  [INCIDENT_EVENT_TYPES.CAR_CAR_BUMP]: 'Car Bump',
  [INCIDENT_EVENT_TYPES.CAR_CAR_DEMO]: 'Demolition',
  [INCIDENT_EVENT_TYPES.BALL_WORLD_HIT]: 'Ball-World Hit',
  [INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT]: 'Goalpost/Crossbar',
  [INCIDENT_EVENT_TYPES.CAR_JUMP]: 'Jump',
  [INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP]: 'Double Jump',
  [INCIDENT_EVENT_TYPES.CAR_DODGE]: 'Dodge/Flip',
  [INCIDENT_EVENT_TYPES.CAR_SUPERSONIC_ENTER]: 'Supersonic',
  [INCIDENT_EVENT_TYPES.BOOST_PICKUP]: 'Boost Pickup',
  [INCIDENT_EVENT_TYPES.BOOST_SPAWN]: 'Boost Spawn',
  [INCIDENT_EVENT_TYPES.CAR_BOOST_START]: 'Boost Start',
  [INCIDENT_EVENT_TYPES.CAR_BOOST_STOP]: 'Boost Stop',
  [INCIDENT_EVENT_TYPES.GOAL_SCORED]: 'Goal Scored',
  [INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED]: 'Flip Reset',
  [INCIDENT_EVENT_TYPES.BALL_STATE_CHANGE]: 'Ball State',
  [INCIDENT_EVENT_TYPES.POSSESSION_CHANGE]: 'Possession',
});

export const SIGNAL_TYPE_LABELS = Object.freeze({
  [MATCH_SIGNALS.MATCH_STARTED]: 'Match Started',
  [MATCH_SIGNALS.KICKOFF_WILL_START]: 'Kickoff Countdown',
  [MATCH_SIGNALS.KICKOFF_START]: 'Kickoff Go',
  [MATCH_SIGNALS.SCORE_UPDATED]: 'Score Updated',
  [MATCH_SIGNALS.GOAL_REPLAY_WILL_START]: 'Goal Replay',
  [MATCH_SIGNALS.MATCH_PAUSED]: 'Match Paused',
  [MATCH_SIGNALS.COUNTDOWN_10S]: '10s Countdown',
  [MATCH_SIGNALS.OVERTIME_START]: 'Overtime Start',
  [MATCH_SIGNALS.MATCH_ENDED]: 'Match Ended',
  [MATCH_SIGNALS.PODIUM_START]: 'Podium Start',
  [MATCH_SIGNALS.TIME_ALERT_60S]: '60s Remaining',
  [MATCH_SIGNALS.TIME_ALERT_30S]: '30s Remaining',
  [MATCH_SIGNALS.CLOCK_UPDATED_SECONDS]: 'Clock Tick',
  [MATCH_SIGNALS.MATCH_RESUMED]: 'Match Resumed',
  [MATCH_SIGNALS.MATCH_WILL_RESUME]: 'Resume Countdown',
});

function lowerBoundByFrameIndex(events, targetFrame) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((events[mid].frameIndex ?? 0) < targetFrame) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function upperBoundByFrameIndex(events, targetFrame) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((events[mid].frameIndex ?? 0) <= targetFrame) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function lowerBoundByTick(events, targetTick) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((events[mid].tick ?? 0) < targetTick) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function upperBoundByTick(events, targetTick) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((events[mid].tick ?? 0) <= targetTick) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Timeline 1: Fixed-Stride 120Hz State (448 floats) + User Input (8-car controls) Timeline.
 */
export class StateInputTimeline {
  constructor({
    bytes,
    frameCount = 0,
    stride = 1856,
    stateBytes = 1792,
    tickRate = 120,
    frames = [],
    frameSlots = [],
  }) {
    this.bytes = bytes || new Uint8Array(0);
    this.frameCount = frameCount;
    this.stride = stride;
    this.stateBytes = stateBytes;
    this.tickRate = tickRate;
    this.frames = frames;
    this.frameSlots = frameSlots;
    this.startTick = frameCount > 0 ? frameSlots[0]?.tick ?? 0 : 0;
    this.endTick = frameCount > 0 ? frameSlots[frameCount - 1]?.tick ?? 0 : 0;
  }

  get count() {
    return this.frameCount;
  }

  getSnapshotAt(frameIndex) {
    if (this.frameCount <= 0) return null;
    const idx = Math.max(0, Math.min(this.frameCount - 1, Math.floor(frameIndex)));
    return this.frames[idx] || null;
  }

  getControlsAt(frameIndex) {
    if (this.frameCount <= 0) return [];
    const idx = Math.max(0, Math.min(this.frameCount - 1, Math.floor(frameIndex)));
    return this.frameSlots[idx]?.controls || this.frames[idx]?.controls || [];
  }

  getFrameAt(frameIndex) {
    if (this.frameCount <= 0) return null;
    const idx = Math.max(0, Math.min(this.frameCount - 1, Math.floor(frameIndex)));
    return this.frameSlots[idx] || null;
  }

  findFrameIndexByTick(targetTick) {
    if (this.frameCount <= 0) return 0;
    let lo = 0;
    let hi = this.frameCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const midTick = this.frameSlots[mid]?.tick ?? mid;
      if (midTick === targetTick) return mid;
      if (midTick < targetTick) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.max(0, Math.min(this.frameCount - 1, lo));
  }
}

/**
 * Timeline 2: Chronological 64B PhysicsEvent (Incident) Timeline.
 */
export class IncidentTimeline {
  constructor({ bytes, events = [], byFrameMap = new Map(), frameCount = 0 }) {
    this.bytes = bytes || new Uint8Array(0);
    this.events = events
      .slice()
      .sort((a, b) => (a.frameIndex ?? 0) - (b.frameIndex ?? 0) || (a.tick ?? 0) - (b.tick ?? 0));
    this.byFrameMap = byFrameMap;
    this.frameCount = frameCount;
  }

  get count() {
    return this.events.length;
  }

  getEventsAtFrame(frameIndex) {
    return this.byFrameMap.get(Math.floor(frameIndex)) || [];
  }

  getEventsInFrameRange(startFrameInclusive, endFrameInclusive) {
    if (this.events.length === 0) return [];
    const loFrame = Math.min(startFrameInclusive, endFrameInclusive);
    const hiFrame = Math.max(startFrameInclusive, endFrameInclusive);
    const startIdx = lowerBoundByFrameIndex(this.events, loFrame);
    const endIdx = upperBoundByFrameIndex(this.events, hiFrame);
    if (startIdx >= endIdx) return [];
    return this.events.slice(startIdx, endIdx);
  }

  getEventsInTickRange(startTickInclusive, endTickInclusive) {
    if (this.events.length === 0) return [];
    const loTick = Math.min(startTickInclusive, endTickInclusive);
    const hiTick = Math.max(startTickInclusive, endTickInclusive);
    const startIdx = lowerBoundByTick(this.events, loTick);
    const endIdx = upperBoundByTick(this.events, hiTick);
    if (startIdx >= endIdx) return [];
    return this.events.slice(startIdx, endIdx);
  }

  getEventCountsByType() {
    const counts = {};
    for (let i = 0; i < this.events.length; i++) {
      const t = this.events[i]?.type ?? 0;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }

  getTimelineMarkers(maxMarkers = 160) {
    if (this.events.length === 0) return [];
    // Prioritize high-significance gameplay incidents for visual timeline ticks
    const highPriority = new Set([
      INCIDENT_EVENT_TYPES.GOAL_SCORED,
      INCIDENT_EVENT_TYPES.CAR_CAR_DEMO,
      INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED,
      INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT,
      INCIDENT_EVENT_TYPES.CAR_BALL_HIT,
      INCIDENT_EVENT_TYPES.CAR_CAR_BUMP,
    ]);

    const filtered = [];
    const seenFrameType = new Set();
    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i];
      if (!ev || !highPriority.has(ev.type)) continue;
      const key = `${ev.frameIndex}:${ev.type}`;
      if (seenFrameType.has(key)) continue;
      seenFrameType.add(key);
      filtered.push({
        frameIndex: ev.frameIndex ?? 0,
        tick: ev.tick ?? 0,
        type: ev.type,
        carIndex: ev.carIndex ?? 0,
        team: ev.team ?? 0,
        label: INCIDENT_TYPE_LABELS[ev.type] || `Incident 0x${ev.type.toString(16)}`,
      });
    }

    if (filtered.length <= maxMarkers) return filtered;
    const step = filtered.length / maxMarkers;
    const sampled = [];
    for (let i = 0; i < maxMarkers; i++) {
      sampled.push(filtered[Math.floor(i * step)]);
    }
    return sampled;
  }
}

/**
 * Timeline 3: Chronological 64B Authoritative Match Signal Timeline.
 */
export class SignalTimeline {
  constructor({
    bytes,
    recordedEvents = [],
    synthesizedEvents = [],
    byFrameMap = new Map(),
    frameCount = 0,
    isCountUp = false,
  }) {
    this.bytes = bytes || new Uint8Array(0);
    this.recordedEvents = recordedEvents
      .slice()
      .sort((a, b) => (a.frameIndex ?? 0) - (b.frameIndex ?? 0) || (a.tick ?? 0) - (b.tick ?? 0));
    this.synthesizedEvents = synthesizedEvents
      .slice()
      .sort((a, b) => (a.frameIndex ?? 0) - (b.frameIndex ?? 0) || (a.tick ?? 0) - (b.tick ?? 0));
    this.events =
      this.recordedEvents.length > 0 ? this.recordedEvents : this.synthesizedEvents;
    this.byFrameMap = byFrameMap;
    this.frameCount = frameCount;
    this.isCountUp = isCountUp;
  }

  get recordedCount() {
    return this.recordedEvents.length;
  }

  get synthesizedCount() {
    return this.recordedEvents.length > 0 ? 0 : this.synthesizedEvents.length;
  }

  get count() {
    return this.events.length;
  }

  getEventsAtFrame(frameIndex) {
    return this.byFrameMap.get(Math.floor(frameIndex)) || [];
  }

  getEventsInFrameRange(startFrameInclusive, endFrameInclusive) {
    if (this.events.length === 0) return [];
    const loFrame = Math.min(startFrameInclusive, endFrameInclusive);
    const hiFrame = Math.max(startFrameInclusive, endFrameInclusive);
    const startIdx = lowerBoundByFrameIndex(this.events, loFrame);
    const endIdx = upperBoundByFrameIndex(this.events, hiFrame);
    if (startIdx >= endIdx) return [];
    return this.events.slice(startIdx, endIdx);
  }

  getAudioCuesInFrameRange(startFrameInclusive, endFrameInclusive, isCountUpOverride = null) {
    const sigs = this.getEventsInFrameRange(startFrameInclusive, endFrameInclusive);
    if (sigs.length === 0) return [];
    const countUp = isCountUpOverride !== null ? isCountUpOverride : this.isCountUp;
    const cues = [];
    for (let i = 0; i < sigs.length; i++) {
      const cue = resolveReplayAudioCueForSignal(sigs[i], countUp);
      if (cue) cues.push(cue);
    }
    return cues;
  }

  evaluateMatchStateAtFrame(frameIndex, matchInfo = {}) {
    let blueScore = 0;
    let orangeScore = 0;
    let remainingSeconds = null;
    let isOvertime = false;
    let matchPhase = 'playing';

    const sigsUpToFrame = this.getEventsInFrameRange(0, Math.max(0, Math.floor(frameIndex)));
    for (let i = 0; i < sigsUpToFrame.length; i++) {
      const sig = sigsUpToFrame[i];
      if (!sig) continue;
      switch (sig.signalType) {
        case MATCH_SIGNALS.KICKOFF_WILL_START:
          matchPhase = 'kickoff';
          break;
        case MATCH_SIGNALS.KICKOFF_START:
          matchPhase = isOvertime ? 'overtime' : 'playing';
          break;
        case MATCH_SIGNALS.SCORE_UPDATED:
          blueScore = sig.param1 ?? blueScore;
          orangeScore = sig.param2 ?? orangeScore;
          matchPhase = 'goal';
          break;
        case MATCH_SIGNALS.GOAL_REPLAY_WILL_START:
          matchPhase = 'replay';
          break;
        case MATCH_SIGNALS.CLOCK_UPDATED_SECONDS:
        case MATCH_SIGNALS.COUNTDOWN_10S:
        case MATCH_SIGNALS.TIME_ALERT_60S:
        case MATCH_SIGNALS.TIME_ALERT_30S:
          remainingSeconds = sig.param1 ?? remainingSeconds;
          if (sig.signalType === MATCH_SIGNALS.CLOCK_UPDATED_SECONDS && sig.param2 === 1) {
            isOvertime = true;
          }
          break;
        case MATCH_SIGNALS.OVERTIME_START:
          isOvertime = true;
          matchPhase = 'overtime';
          break;
        case MATCH_SIGNALS.MATCH_ENDED:
        case MATCH_SIGNALS.PODIUM_START:
          matchPhase = 'podium';
          break;
        default:
          break;
      }
    }

    return {
      blueScore,
      orangeScore,
      remainingSeconds,
      isOvertime,
      matchPhase,
      finalBlueScore: matchInfo.blueScore ?? blueScore,
      finalOrangeScore: matchInfo.orangeScore ?? orangeScore,
    };
  }

  getTimelineMarkers(maxMarkers = 120) {
    if (this.events.length === 0) return [];
    const markers = [];
    for (let i = 0; i < this.events.length; i++) {
      const sig = this.events[i];
      if (!sig) continue;
      // Skip every-second clock ticks in visual markers unless they are 60s/30s/10s alerts
      if (
        sig.signalType === MATCH_SIGNALS.CLOCK_UPDATED_SECONDS &&
        sig.param1 !== 60 &&
        sig.param1 !== 30 &&
        sig.param1 > 10
      ) {
        continue;
      }
      markers.push({
        frameIndex: sig.frameIndex ?? 0,
        tick: sig.tick ?? sig.frameId ?? 0,
        type: sig.signalType,
        param1: sig.param1 ?? 0,
        param2: sig.param2 ?? 0,
        synthesized: Boolean(sig.synthesized),
        label:
          SIGNAL_TYPE_LABELS[sig.signalType] ||
          `Signal 0x${(sig.signalType || 0).toString(16)}`,
      });
    }
    if (markers.length <= maxMarkers) return markers;
    const step = markers.length / maxMarkers;
    const sampled = [];
    for (let i = 0; i < maxMarkers; i++) {
      sampled.push(markers[Math.floor(i * step)]);
    }
    return sampled;
  }
}

/**
 * Synthesizes fallback Track C signals from Track B GOAL_SCORED incidents and matchInfo
 * when a replay container was recorded with 0 explicit Track C signals (e.g. legacy exp-multi-bots replays).
 */
export function synthesizeFallbackSignalsFromIncidents(incidents, frameSlots, matchInfo = {}) {
  const frameCount = Array.isArray(frameSlots) ? frameSlots.length : 0;
  if (frameCount <= 0) return [];

  const synthesized = [];
  let nextSignalId = 1;

  // 1. Match Start signal at frame 0
  synthesized.push({
    signalId: nextSignalId++,
    signalType: MATCH_SIGNALS.MATCH_STARTED,
    type: MATCH_SIGNALS.MATCH_STARTED,
    frameId: frameSlots[0]?.tick ?? 0,
    tick: frameSlots[0]?.tick ?? 0,
    param1: 0,
    param2: 0,
    frameIndex: 0,
    synthesized: true,
  });

  // 2. Scan Track B for GOAL_SCORED incidents (deduplicated per goal celebration window)
  let runningBlue = 0;
  let runningOrange = 0;
  let lastGoalFrame = -240;

  for (let i = 0; i < incidents.length; i++) {
    const inc = incidents[i];
    if (!inc || inc.type !== INCIDENT_EVENT_TYPES.GOAL_SCORED) continue;
    const fIdx = Math.max(0, Math.min(frameCount - 1, inc.frameIndex ?? 0));
    if (fIdx - lastGoalFrame < 60) continue; // Deduplicate dual WASM + mode GOAL_SCORED on same frame
    lastGoalFrame = fIdx;

    const scoringTeam = inc.team === 1 || (inc.y ?? inc.posY ?? 0) < 0 ? 1 : 0;
    if (scoringTeam === 0) runningBlue++;
    else runningOrange++;

    synthesized.push({
      signalId: nextSignalId++,
      signalType: MATCH_SIGNALS.SCORE_UPDATED,
      type: MATCH_SIGNALS.SCORE_UPDATED,
      frameId: inc.tick ?? frameSlots[fIdx]?.tick ?? fIdx,
      tick: inc.tick ?? frameSlots[fIdx]?.tick ?? fIdx,
      param1: runningBlue,
      param2: runningOrange,
      frameIndex: fIdx,
      synthesized: true,
    });
  }

  // 3. Match End signal at final frame if matchInfo has a score or non-freeplay mode
  if (frameCount > 1 && matchInfo.mode !== 'freeplay' && matchInfo.mode !== 'training') {
    const lastIdx = frameCount - 1;
    const winnerCode =
      matchInfo.winner === 'blue' ? 0 : matchInfo.winner === 'orange' ? 1 : 2;
    synthesized.push({
      signalId: nextSignalId++,
      signalType: MATCH_SIGNALS.MATCH_ENDED,
      type: MATCH_SIGNALS.MATCH_ENDED,
      frameId: frameSlots[lastIdx]?.tick ?? lastIdx,
      tick: frameSlots[lastIdx]?.tick ?? lastIdx,
      param1: winnerCode,
      param2: matchInfo.winReason ?? 0,
      frameIndex: lastIdx,
      synthesized: true,
    });
  }

  return synthesized;
}
