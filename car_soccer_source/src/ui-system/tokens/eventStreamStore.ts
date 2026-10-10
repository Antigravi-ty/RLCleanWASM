import { useSyncExternalStore } from 'react';
import {
  setCarBallHitImpulseThreshold,
  setGoalpostHitThreshold,
  setCarBallHitCooldownMs,
  setGoalpostHitCooldownMs,
} from '../../audio/AudioArchitecture.js';

export interface PhysicsEventRecord {
  timestamp: number;
  type: number;
  value: number;
  impulse: number;
  relSpeed: number;
  normalRelVel: number;
  speed: number;
  x: number;
  y: number;
  z: number;
  carIndex: number;
  tick?: number;
}

export type EventParamType = 'impulse' | 'relSpeed' | 'normalRelVel' | 'speed' | 'z';

export interface EventStreamState {
  events: PhysicsEventRecord[];
  activeParam: EventParamType;
  timeWindowSec: number;
  threshold: number;
  cooldownMs: number;
  eventFilter: 'all' | 'car-ball' | 'car-world';
  minY: number;
  maxY: number;
  totalHits: number;
}

let state: EventStreamState = {
  events: [],
  activeParam: 'impulse',
  timeWindowSec: 4.0,
  threshold: 300,
  cooldownMs: 40,
  eventFilter: 'all',
  minY: 0,
  maxY: 1200,
  totalHits: 0,
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

export const eventStreamStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  addEvent: (raw: any) => {
    const now = performance.now();
    let impulse = Number(raw.impulse ?? raw.force ?? 0);
    const relSpeed = Number(raw.relSpeed ?? 0);
    const normalRelVel = Number(raw.normalRelVel ?? 0);
    const speed = Number(raw.speed ?? 0);
    if ((!impulse || impulse === 0) && (normalRelVel || speed || relSpeed)) {
      impulse = Math.abs(normalRelVel || speed || relSpeed || 0);
    }
    const z = Number(raw.z ?? raw.pos?.[2] ?? 0);
    const x = Number(raw.x ?? raw.pos?.[0] ?? 0);
    const y = Number(raw.y ?? raw.pos?.[1] ?? 0);
    const type = Number(raw.type ?? 0);

    let val = impulse;
    if (state.activeParam === 'relSpeed') val = relSpeed;
    else if (state.activeParam === 'normalRelVel') val = normalRelVel;
    else if (state.activeParam === 'speed') val = speed;
    else if (state.activeParam === 'z') val = z;

    const record: PhysicsEventRecord = {
      timestamp: now,
      type,
      value: val,
      impulse,
      relSpeed,
      normalRelVel,
      speed,
      x,
      y,
      z,
      carIndex: Number(raw.carIndex ?? 0),
      tick: raw.tick,
    };

    // Filter window: keep up to 15 seconds in memory
    const cutoff = now - 15000;
    const kept = state.events.filter((e) => e.timestamp >= cutoff);
    kept.push(record);

    state = {
      ...state,
      events: kept,
      totalHits: state.totalHits + 1,
    };
    notify();
  },

  setParam: (param: EventParamType) => {
    let minY = 0;
    let maxY = 1200;
    let threshold = state.threshold;

    if (param === 'impulse') {
      minY = 0;
      maxY = 1200;
      threshold = 300;
    } else if (param === 'relSpeed' || param === 'normalRelVel' || param === 'speed') {
      minY = 0;
      maxY = 3000;
      threshold = 800;
    } else if (param === 'z') {
      minY = 0;
      maxY = 2048;
      threshold = 200;
    }

    state = { ...state, activeParam: param, minY, maxY, threshold };
    notify();
  },

  setTimeWindow: (sec: number) => {
    state = { ...state, timeWindowSec: Math.max(1, Math.min(10, sec)) };
    notify();
  },

  setThreshold: (val: number) => {
    state = { ...state, threshold: val };
    try {
      setCarBallHitImpulseThreshold(val);
      setGoalpostHitThreshold(val * 0.85);
    } catch {
      // Audio engine might not be booted yet
    }
    notify();
  },

  setCooldownMs: (ms: number) => {
    state = { ...state, cooldownMs: ms };
    try {
      setCarBallHitCooldownMs(ms);
      setGoalpostHitCooldownMs(ms);
    } catch {}
    notify();
  },

  setFilter: (f: 'all' | 'car-ball' | 'car-world') => {
    state = { ...state, eventFilter: f };
    notify();
  },

  clearEvents: () => {
    state = { ...state, events: [], totalHits: 0 };
    notify();
  },
};

export const useEventStreamData = () => {
  return useSyncExternalStore(eventStreamStore.subscribe, eventStreamStore.getSnapshot);
};
