import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsStateInterpolator } from '../src/physics/PhysicsStateInterpolator.js';
import { PhysicsRateHUD } from '../src/ui/PhysicsRateHUD.js';
import { SpeedometerHUD } from '../src/ui/SpeedometerHUD.js';
import { GameAudioEngine } from '../src/audio/GameAudioSubsystem.js';

test('PhysicsStateInterpolator: physicsRate clamping & default', () => {
  const dummySim = {
    state: new Float32Array(40),
    step: () => {}
  };
  const interpolator = new PhysicsStateInterpolator(dummySim);

  assert.equal(interpolator.physicsRate, 120, 'Default physics rate should be 120');

  // Test valid steps: 118, 119, 120, 121, 122
  assert.equal(interpolator.setPhysicsRate(118), 118);
  assert.equal(interpolator.physicsRate, 118);

  // Test clamp minimum to 118
  assert.equal(interpolator.setPhysicsRate(117), 118);
  assert.equal(interpolator.setPhysicsRate(100), 118);

  // Test clamp maximum to 122
  assert.equal(interpolator.setPhysicsRate(122), 122);
  assert.equal(interpolator.setPhysicsRate(123), 122);
  assert.equal(interpolator.setPhysicsRate(130), 122);

  // Intermediate values
  assert.equal(interpolator.setPhysicsRate(119), 119);
  assert.equal(interpolator.setPhysicsRate(121), 121);
});

test('PhysicsStateInterpolator: speedFactor accumulator scaling', () => {
  const dummySim = {
    state: new Float32Array(40),
    step(ticks) {
      this.totalSteps += ticks;
    },
    totalSteps: 0
  };

  const runSimulationSeconds = (rate, seconds = 10.0, frameDeltaMs = 1000 / 60) => {
    dummySim.totalSteps = 0;
    const interpolator = new PhysicsStateInterpolator(dummySim);
    interpolator.setPhysicsRate(rate);

    let currentTime = 0;
    interpolator.sync(currentTime);

    const numFrames = Math.round((seconds * 1000) / frameDeltaMs);
    for (let f = 1; f <= numFrames; f++) {
      currentTime = f * frameDeltaMs;
      interpolator.update(currentTime);
    }
    return dummySim.totalSteps;
  };

  const steps120 = runSimulationSeconds(120, 10.0);
  const steps121 = runSimulationSeconds(121, 10.0);
  const steps119 = runSimulationSeconds(119, 10.0);
  const steps122 = runSimulationSeconds(122, 10.0);
  const steps118 = runSimulationSeconds(118, 10.0);

  // Over 10 seconds at 60 FPS:
  // 120 Hz -> ~1200 ticks
  // 121 Hz -> ~1210 ticks (10 more ticks)
  // 119 Hz -> ~1190 ticks (10 fewer ticks)
  // 122 Hz -> ~1220 ticks
  // 118 Hz -> ~1180 ticks
  assert.ok(Math.abs(steps120 - 1200) <= 1, `Rate 120 should produce ~1200 steps in 10s, got ${steps120}`);
  assert.ok(Math.abs(steps121 - 1210) <= 1, `Rate 121 should produce ~1210 steps, got ${steps121}`);
  assert.ok(Math.abs(steps119 - 1190) <= 1, `Rate 119 should produce ~1190 steps, got ${steps119}`);
  assert.ok(Math.abs(steps122 - 1220) <= 1, `Rate 122 should produce ~1220 steps, got ${steps122}`);
  assert.ok(Math.abs(steps118 - 1180) <= 1, `Rate 118 should produce ~1180 steps, got ${steps118}`);

  assert.ok(steps122 > steps121 && steps121 > steps120 && steps120 > steps119 && steps119 > steps118,
    'Tick progression should be strictly monotonically increasing with physicsRate');
});

test('GameAudioSubsystem: handleBallWorldHit suppresses pitch grass events (surfaceTag === 1)', () => {
  let playCalled = false;
  const dummySlotPool = {
    playBuffer: () => { playCalled = true; }
  };

  const audioEngine = new GameAudioEngine();
  audioEngine.ballHitBuffers = [new ArrayBuffer(16)];

  // Event with surfaceTag 1 (pitch grass)
  playCalled = false;
  audioEngine.handleBallWorldHit({ surfaceTag: 1, pos: [0, 0, 0] }, null);
  assert.equal(playCalled, false, 'Should immediately return and NOT play sfx when surfaceTag === 1');

  // Event with surfaceTag 2 (wall/ceiling)
  audioEngine.lastBallWorldHitTimestamp = 0; // reset throttle
  const originalGetPool = globalThis.getAudioSlotPool;
  globalThis.getAudioSlotPool = () => dummySlotPool;
  try {
    audioEngine.handleBallWorldHit({ surfaceTag: 2, pos: [0, 0, 0] }, null);
    assert.ok(audioEngine.lastBallWorldHitTimestamp > 0, 'Should proceed past surfaceTag check for surfaceTag === 2');
  } finally {
    if (originalGetPool) {
      globalThis.getAudioSlotPool = originalGetPool;
    } else {
      delete globalThis.getAudioSlotPool;
    }
  }
});

test('PhysicsRateHUD & SpeedometerHUD UI text updates', () => {
  // Mock DOM in Node environment
  const elements = [];
  const mockDoc = {
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        style: {},
        children: [],
        parentElement: null,
        appendChild(child) {
          this.children.push(child);
          child.parentElement = this;
          return child;
        },
        removeChild(child) {
          this.children = this.children.filter(c => c !== child);
          child.parentElement = null;
        },
        remove() {
          if (this.parentElement) {
            this.parentElement.removeChild(this);
          }
        },
        textContent: ''
      };
      elements.push(el);
      return el;
    },
    body: {
      children: [],
      appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter(c => c !== child);
        child.parentElement = null;
      }
    }
  };

  const origHadDoc = 'document' in globalThis;
  const origDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    const rateHUD = new PhysicsRateHUD(mockDoc.body, 120);
    assert.equal(rateHUD.root.textContent, 'Phy:120.0', 'HUD should display initial rate as Phy:120.0');

    rateHUD.update(121);
    assert.equal(rateHUD.root.textContent, 'Phy:121.0', 'HUD should update to Phy:121.0');

    rateHUD.update(118);
    assert.equal(rateHUD.root.textContent, 'Phy:118.0', 'HUD should update to Phy:118.0');

    rateHUD.destroy();
    assert.equal(rateHUD.root, null, 'Root should be null after destroy');

    const speedometer = new SpeedometerHUD(mockDoc.body);
    assert.equal(speedometer.phyRateLabel.textContent, 'Phy:120.0');
    speedometer.updatePhysicsRate(122);
    assert.equal(speedometer.phyRateLabel.textContent, 'Phy:122.0');
    speedometer.destroy();
  } finally {
    if (origHadDoc) {
      globalThis.document = origDoc;
    } else {
      delete globalThis.document;
    }
  }
});
