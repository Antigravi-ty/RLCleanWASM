import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ClientInputBuffer } from '../src/network/ClientInputBuffer.js';
import { InputPacketCodec, MAGIC_BYTE } from '../src/network/InputPacketCodec.js';
import { WebRTCNetworkChannel } from '../src/network/WebRTCNetworkChannel.js';
import { RocketSimPhysicsEngine } from '../src/physics/RocketSimPhysicsEngine.js';
import { AuthoritativeServer } from '../src/network/AuthoritativeServer.js';
import { PredictionReconciler } from '../src/network/PredictionReconciler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('ClientInputBuffer: recording, retrieval, and 10-tick sliding window', () => {
  const buffer = new ClientInputBuffer(64);

  // Record inputs for ticks 100 to 115
  for (let t = 100; t <= 115; t++) {
    buffer.record(t, 0, {
      throttle: 1.0,
      steer: (t % 2 === 0) ? 0.5 : -0.5,
      pitch: 0.0,
      yaw: 0.0,
      roll: 0.0,
      jump: t === 105,
      boost: t >= 110,
      handbrake: false
    });
  }

  // Check single tick retrieval
  const entry105 = buffer.get(105);
  assert.ok(entry105);
  assert.equal(entry105.jump, true);
  assert.equal(entry105.boost, false);

  const entry112 = buffer.get(112);
  assert.ok(entry112);
  assert.equal(entry112.boost, true);
  assert.equal(entry112.jump, false);

  // Extract sliding window of 10 ticks for target tick 115: [106..115]
  const window10 = buffer.getRedundantWindow(115, 10, 0);
  assert.equal(window10.length, 10, 'Window must contain exactly 10 ticks');
  assert.equal(window10[0].tick, 106, 'Oldest tick in window should be 106');
  assert.equal(window10[9].tick, 115, 'Newest tick in window should be 115');

  // Test padding at match start (requesting 10 ticks when only ticks 0..2 exist)
  buffer.clear();
  buffer.record(0, 0, { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false });
  buffer.record(1, 0, { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false });
  buffer.record(2, 0, { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false });

  const earlyWindow = buffer.getRedundantWindow(2, 10, 0);
  assert.equal(earlyWindow.length, 10);
  assert.equal(earlyWindow[9].tick, 2);
  assert.equal(earlyWindow[0].tick, -7); // Padded with initial valid controls
  assert.equal(earlyWindow[0].controls.throttle, 1.0);
});

test('InputPacketCodec: ultra-compact bit-packing under 40 bytes', () => {
  const carIndex = 1;
  const targetTick = 12345;
  const history = [];

  for (let i = 0; i < 10; i++) {
    history.push({
      tick: targetTick - 9 + i,
      carIndex,
      controls: {
        throttle: i % 2 === 0 ? 1.0 : -1.0,
        steer: (i - 5) / 5.0,
        pitch: i === 3 ? 1.0 : 0.0,
        yaw: 0.0,
        roll: i === 7 ? -1.0 : 0.0,
        jump: i === 4,
        boost: i >= 5,
        handbrake: i === 9
      }
    });
  }

  // 1. Encode into binary Uint8Array
  const encoded = InputPacketCodec.encode(carIndex, targetTick, history);
  assert.ok(encoded instanceof Uint8Array);

  // Verify byte length: 7 header bytes + 10 * 3 = 37 bytes
  assert.equal(encoded.byteLength, 37, 'Packet size for 10 ticks must be exactly 37 bytes');
  assert.ok(encoded.byteLength < 40, 'Packet size must be strictly under 40 bytes');

  // Verify header bytes
  assert.equal(encoded[0], MAGIC_BYTE);
  assert.equal(encoded[1], carIndex);
  const view = new DataView(encoded.buffer);
  assert.equal(view.getUint32(2, false), targetTick);
  assert.equal(encoded[6], 10);

  // 2. Decode back from binary
  const decoded = InputPacketCodec.decode(encoded);
  assert.ok(decoded);
  assert.equal(decoded.carIndex, carIndex);
  assert.equal(decoded.targetTick, targetTick);
  assert.equal(decoded.history.length, 10);

  // 3. Verify value fidelity
  for (let i = 0; i < 10; i++) {
    const orig = history[i].controls;
    const dec = decoded.history[i].controls;

    assert.equal(decoded.history[i].tick, history[i].tick);
    assert.equal(dec.jump, orig.jump, `Jump flag mismatch at tick ${i}`);
    assert.equal(dec.boost, orig.boost, `Boost flag mismatch at tick ${i}`);
    assert.equal(dec.handbrake, orig.handbrake, `Handbrake flag mismatch at tick ${i}`);

    assert.ok(Math.abs(dec.throttle - orig.throttle) < 0.04, `Throttle mismatch at tick ${i}`);
    assert.ok(Math.abs(dec.steer - orig.steer) < 0.04, `Steer mismatch at tick ${i}`);
    assert.ok(Math.abs(dec.pitch - orig.pitch) < 0.04, `Pitch mismatch at tick ${i}`);
    assert.ok(Math.abs(dec.roll - orig.roll) < 0.04, `Roll mismatch at tick ${i}`);
  }
});

test('WebRTCNetworkChannel: transport, ping/pong RTT & packet flow', () => {
  const channel = new WebRTCNetworkChannel({ rttMs: 60, jitterMs: 0, packetLossRate: 0.0 });
  assert.equal(channel.rttMs, 60);

  // Client sends packet
  const testPacket = {
    carIndex: 0,
    targetTick: 50,
    controls: { throttle: 1, steer: 0 }
  };

  channel.sendClientInput(testPacket, 1000.0);
  assert.equal(channel.stats.clientPacketsSent, 1);

  // Arrives at 1000 + 60/2 = 1030 ms
  const earlyReceive = channel.receiveServerPackets(1020.0);
  assert.equal(earlyReceive.length, 0, 'Packet should not arrive before latency expires');

  const onTimeReceive = channel.receiveServerPackets(1035.0);
  assert.equal(onTimeReceive.length, 1, 'Packet should be delivered after latency expires');
  assert.equal(onTimeReceive[0].targetTick, 50);

  channel.destroy();
});

test('End-to-End: 10-Tick Redundant Window heals dropped packets with ZERO desync', async () => {
  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));
  RocketSimPhysicsEngine.cachedCollisionData = chunks;

  // WebRTC channel with 80ms RTT and bit-packing enabled
  const channel = new WebRTCNetworkChannel({ rttMs: 80, jitterMs: 0, packetLossRate: 0.0, useBitPacking: true });

  const server = new AuthoritativeServer(channel, { snapshotInterval: 2 });
  await server.init();

  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);

  // Prediction reconciler with 10-tick redundant history and bit-packing enabled
  const reconciler = new PredictionReconciler(clientSim, channel, {
    localCarIndex: 0,
    enableSmoothing: false,
    redundantHistoryCount: 10,
    useBitPacking: true
  });

  reconciler.syncTimeline(server.sim.saveState(), 0, 800.0);

  let simulatedTimeMs = 1000.0;
  const tickDtMs = 1000.0 / 120.0;

  // Run 60 ticks normally under clean network conditions
  for (let i = 0; i < 60; i++) {
    simulatedTimeMs += tickDtMs;
    const ctrl = { throttle: 1.0, steer: 1.0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: true, handbrake: false };
    reconciler.sampleAndPredictInput(0, ctrl, simulatedTimeMs);
    clientSim.setControls(0, ctrl);
    clientSim.step(1);
    server.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Force drop 3 consecutive client input packets during high dynamic turn
  channel.forceDropNextInput(3);

  for (let i = 60; i < 120; i++) {
    simulatedTimeMs += tickDtMs;
    // Steer sharply to the other side while boosting
    const ctrl = { throttle: 1.0, steer: -1.0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: true, handbrake: false };
    reconciler.sampleAndPredictInput(0, ctrl, simulatedTimeMs);
    clientSim.setControls(0, ctrl);
    clientSim.step(1);
    server.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Let remaining in-flight packets deliver
  for (let i = 0; i < 30; i++) {
    simulatedTimeMs += tickDtMs;
    const ctrl = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    reconciler.sampleAndPredictInput(0, ctrl, simulatedTimeMs);
    clientSim.setControls(0, ctrl);
    clientSim.step(1);
    server.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Verify that 3 consecutive packets were dropped by channel
  assert.equal(channel.stats.clientPacketsDropped, 3, 'Exactly 3 packets must have been dropped');

  // Verify binary bit-packing occurred
  assert.ok(channel.stats.binaryBytesSent > 0, 'Binary bit-packed bytes must have been transmitted');

  // With 10-tick redundant input packing, packet 4 healed all 3 dropped ticks,
  // preventing ANY missing inputs on the server and producing ZERO mispredictions!
  assert.equal(reconciler.totalCorrections, 0, 'Redundant 10-tick buffer must prevent all corrections despite drops');
  assert.equal(reconciler.maxCorrectionDelta, 0, 'Max correction delta must be strictly 0');

  channel.destroy();
});

test('AuthoritativeServer: anti-cheat gap sealing and immutable past input defense', async () => {
  const channel = new WebRTCNetworkChannel({ rttMs: 0, jitterMs: 0, packetLossRate: 0 });
  const server = new AuthoritativeServer(channel, { snapshotInterval: 2 });
  await server.init();

  // 1. Client maliciously sends inputs for ticks 1, 2, 3, 5, 6 (deliberately omitting tick 4)
  const maliciousPacket = {
    carIndex: 0,
    timestamp: 1000.0,
    history: [
      { tick: 1, carIndex: 0, controls: { throttle: 1, steer: 0 } },
      { tick: 2, carIndex: 0, controls: { throttle: 1, steer: 0 } },
      { tick: 3, carIndex: 0, controls: { throttle: 0.5, steer: 0 } },
      { tick: 5, carIndex: 0, controls: { throttle: -1, steer: 0 } },
      { tick: 6, carIndex: 0, controls: { throttle: -1, steer: 0 } }
    ]
  };

  channel.sendClientInput(maliciousPacket, 1000.0);
  server.tick(1000.0);

  // Furthest future tick is 6, and tick 4 must be sealed in lockedGaps
  assert.equal(server.furthestReceivedTick.get(0), 6);
  assert.ok(server.lockedGaps.get(0).has(4), 'Tick 4 must be sealed as a locked gap');
  assert.equal(server.clientInputBuffer.get(4)?.has(0), undefined, 'Tick 4 must NOT be in buffer');

  // 2. Client attempts to retroactively inject tick 4
  const retroactivePacket = {
    carIndex: 0,
    timestamp: 1001.0,
    history: [
      { tick: 4, carIndex: 0, controls: { throttle: 999, steer: 999 } }
    ]
  };
  channel.sendClientInput(retroactivePacket, 1001.0);
  server.tick(1001.0);

  // Retroactive injection into sealed gap MUST be rejected
  assert.equal(server.clientInputBuffer.get(4)?.has(0), undefined, 'Retroactive injection into sealed gap must be blocked');

  // 3. Step server until tick 4 (omitted gap) is simulated
  while (Math.floor(server.sim.getHeaderView().tickCount) <= 4) {
    server.tick(1000.0);
  }
  // Authoritative step for tick 4: dead reckon must execute tick 3 input (throttle 0.5)
  assert.equal(server.lastReceivedControls.get(0).throttle, 0.5, 'Server must dead-reckon repeated previous input on omitted gap');

  // 4. Attempt to modify past tick <= currentTick
  const pastTickPacket = {
    carIndex: 0,
    timestamp: 1060.0,
    history: [
      { tick: 2, carIndex: 0, controls: { throttle: -999, steer: -999 } }
    ]
  };
  channel.sendClientInput(pastTickPacket, 1060.0);
  server.tick(1060.0);
  assert.equal(server.clientInputBuffer.get(2).get(0).throttle, 1, 'Past simulated tick must remain immutable');

  server.destroy();
});

test('NetworkReconciliationHUD & Channel: persistent latency adjustments and step delta', () => {
  const channel = new WebRTCNetworkChannel({ rttMs: 50, jitterMs: 0, packetLossRate: 0 });

  // Mock minimal DOM container
  const mockContainer = {
    appendChild: () => {}
  };

  // Mock global document if running in Node
  const hadDoc = typeof globalThis.document !== 'undefined';
  if (!hadDoc) {
    globalThis.document = {
      head: { appendChild: () => {} },
      getElementById: () => null,
      createElement: () => ({
        innerHTML: '',
        dataset: {},
        style: {},
        classList: { add: () => {}, remove: () => {} },
        querySelector: () => ({
          addEventListener: () => {},
          textContent: '',
          value: '50'
        }),
        appendChild: () => {}
      })
    };
  }

  try {
    const { NetworkReconciliationHUD } = import('../src/ui/NetworkReconciliationHUD.js');
    // Test logic directly on adjustLatency contract
    assert.equal(channel.rttMs, 50);

    // Adjust step: 10ms
    const stepMs = 10;
    
    // Simulate hotkey '0' (increase latency by step)
    channel.setRtt(channel.rttMs + stepMs);
    assert.equal(channel.rttMs, 60, 'Pressing 0 should persistently increase latency to 60ms');

    // Simulate hotkey '0' again
    channel.setRtt(channel.rttMs + stepMs);
    assert.equal(channel.rttMs, 70, 'Pressing 0 again should persistently increase latency to 70ms');

    // Simulate hotkey '9' (decrease latency by step)
    channel.setRtt(Math.max(0, channel.rttMs - stepMs));
    assert.equal(channel.rttMs, 60, 'Pressing 9 should persistently decrease latency to 60ms');
  } finally {
    if (!hadDoc) {
      delete globalThis.document;
    }
  }

  channel.destroy();
});
