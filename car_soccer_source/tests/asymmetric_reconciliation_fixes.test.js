import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Asymmetric Reconciliation: Jump Release Hold Consistency and Zero Double-Jump Glitch', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const { PredictionReconciler } = await import('../src/network/PredictionReconciler.js');
  const { AuthoritativeServer } = await import('../src/network/AuthoritativeServer.js');

  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));
  RocketSimPhysicsEngine.cachedCollisionData = chunks;

  // Real client has 100ms RTT (higher latency)
  const channel = new NetworkChannel({ rttMs: 100, jitterMs: 0, packetLossRate: 0.0 });
  const server = new AuthoritativeServer(channel, { snapshotInterval: 2 });
  await server.init();

  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);

  const reconciler = new PredictionReconciler(clientSim, channel, {
    localCarIndex: 0,
    enableRedundantInputs: true,
    redundantHistoryTicks: 12
  });
  reconciler.syncTimeline(server.sim.saveState(), 0);

  let simulatedTimeMs = 1000.0;
  const tickDtMs = 1000.0 / 120.0;

  // 1. Initial 30 ticks of idle ground simulation
  for (let i = 0; i < 30; i++) {
    simulatedTimeMs += tickDtMs;
    const idleCtrl = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    reconciler.sampleAndPredictInput(0, idleCtrl, simulatedTimeMs);
    clientSim.setControls(0, idleCtrl);
    clientSim.step(1);
    server.tick(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Verify steady-state clock sync: shouldSkipLocalStep must not be stuck true
  assert.equal(reconciler.shouldSkipLocalStep, false, 'Steady state clock sync should not pause frame');

  // 2. Player presses and holds jump for 15 ticks (Single Jump ascent)
  for (let i = 0; i < 15; i++) {
    simulatedTimeMs += tickDtMs;
    const jumpCtrl = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: true, boost: false, handbrake: false };
    reconciler.sampleAndPredictInput(0, jumpCtrl, simulatedTimeMs);
    clientSim.setControls(0, jumpCtrl);
    clientSim.step(1);
    server.tick(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // 3. Player releases jump (jump: false) while airborne
  for (let i = 0; i < 30; i++) {
    simulatedTimeMs += tickDtMs;
    const releaseCtrl = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    reconciler.sampleAndPredictInput(0, releaseCtrl, simulatedTimeMs);
    clientSim.setControls(0, releaseCtrl);
    clientSim.step(1);
    server.tick(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Advance server by remaining lead ticks so server matches client tick
  const clientTick = Math.floor(clientSim.getHeaderView().tickCount);
  const serverTick = Math.floor(server.sim.getHeaderView().tickCount);
  const leadDiff = clientTick - serverTick;
  for (let k = 0; k < leadDiff; k++) {
    simulatedTimeMs += tickDtMs;
    server.tick(simulatedTimeMs);
  }

  // Verify that jump release did NOT trigger a secondary double-jump or divergence
  const serverCar = server.sim.getCarStateView(0);
  const clientCar = clientSim.getCarStateView(0);
  const dist = Math.hypot(
    serverCar.posX - clientCar.posX,
    serverCar.posY - clientCar.posY,
    serverCar.posZ - clientCar.posZ
  );

  console.log(`Jump release post-landing distance: ${dist.toFixed(6)} UU`);
  assert.ok(dist < 0.001, `Client and server car positions must be bit-exact after jump release (dist=${dist})`);
});

test('Burst Packet Drop: forceDropNextInput drops configured packet burst count and resumes', async (t) => {
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const channel = new NetworkChannel({ rttMs: 40, jitterMs: 0, packetLossRate: 0.0 });

  channel.forceDropNextInput(10);

  let droppedCount = 0;
  let deliveredCount = 0;

  for (let i = 0; i < 20; i++) {
    const sent = channel.sendClientInput({ tick: i, carIndex: 0, controls: {} }, 1000 + i * 8.33);
    if (!sent) droppedCount++;
    else deliveredCount++;
  }

  assert.equal(droppedCount, 10, 'Exactly 10 packets should be dropped in the burst');
  assert.equal(deliveredCount, 10, 'Subsequent 10 packets should be delivered after the burst');
});

test('Latency vs RTT calibration: 2x relationship and max latency up to 500ms', async (t) => {
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const { WebRTCNetworkChannel } = await import('../src/network/WebRTCNetworkChannel.js');
  const { HeadlessClient } = await import('../src/network/HeadlessClient.js');

  const ch1 = new NetworkChannel({ rttMs: 80 });
  assert.equal(ch1.latencyMs, 40, 'Latency should be half of RTT (40ms vs 80ms)');

  ch1.setLatency(500);
  assert.equal(ch1.rttMs, 1000, 'Setting 500ms latency should set 1000ms RTT');
  assert.equal(ch1.latencyMs, 500, 'Latency getter should return 500ms');

  const ch2 = new WebRTCNetworkChannel({ rttMs: 100 });
  assert.equal(ch2.latencyMs, 50, 'WebRTC channel latency should be half of RTT');
  ch2.setLatency(250);
  assert.equal(ch2.rttMs, 500, 'Setting 250ms latency should set 500ms RTT');

  const mockServer = {
    addClientChannel: () => {},
    sim: { getHeaderView: () => ({ tickCount: 0 }) }
  };
  const headless = new HeadlessClient(mockServer, { rttMs: 80 });
  headless.setLatency(500);
  assert.equal(headless.rttMs, 1000, 'Headless client setLatency(500) sets 1000ms RTT');
  assert.equal(headless.latencyMs, 500);
});
