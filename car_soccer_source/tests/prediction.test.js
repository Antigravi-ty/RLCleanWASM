import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Multiplayer Client Prediction & Authoritative Server Reconciliation', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const { PredictionReconciler } = await import('../src/network/PredictionReconciler.js');
  const { AuthoritativeServer } = await import('../src/network/AuthoritativeServer.js');

  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));

  RocketSimPhysicsEngine.cachedCollisionData = chunks;

  // 1. Setup simulated network channel (80ms RTT, 0ms jitter initially)
  const channel = new NetworkChannel({ rttMs: 80, jitterMs: 0, packetLossRate: 0.0 });

  // 2. Setup Authoritative Server
  const server = new AuthoritativeServer(channel, { snapshotInterval: 2 });
  await server.init();

  // 3. Setup Client
  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);

  // Sync initial state and timeline lead
  const reconciler = new PredictionReconciler(clientSim, channel);
  reconciler.syncTimeline(server.sim.saveState(), 0);

  let simulatedTimeMs = 1000.0;
  const tickDtMs = 1000.0 / 120.0; // 8.333 ms per tick

  // Simulate 240 ticks (2.0 seconds)
  for (let i = 0; i < 240; i++) {
    simulatedTimeMs += tickDtMs;

    const ctrl = {
      throttle: 1.0,
      steer: (i % 60) > 30 ? 0.6 : -0.6,
      pitch: -0.3,
      yaw: (i % 60) > 30 ? 0.6 : -0.6,
      roll: 0.0,
      jump: (i % 40) > 25,
      boost: (i % 50) < 30,
      handbrake: false
    };

    // Inject deliberate packet drop on tick 60 to cause a misprediction
    if (i === 60) {
      channel.forceDropNextInput();
    }

    // Client records & predicts
    reconciler.sampleAndPredictInput(0, ctrl, simulatedTimeMs);
    clientSim.setControls(0, ctrl);
    clientSim.step(1);

    // Server ticks
    server.tick(simulatedTimeMs);

    // Client reconciles incoming authoritative snapshots
    reconciler.reconcile(simulatedTimeMs);
    reconciler.updateSmoothing(tickDtMs / 1000.0);
  }

  // Verify that the intentional packet drop at tick 60 was detected and corrected
  assert.ok(reconciler.totalCorrections >= 1, 'Reconciler must have executed at least 1 correction');
  assert.ok(reconciler.maxCorrectionDelta > 0.05, 'Max correction delta should reflect the dropped input divergence');

  // Advance time by another 150ms with zero input to allow in-flight packets to deliver and settle
  for (let i = 0; i < 25; i++) {
    simulatedTimeMs += tickDtMs;
    const idleCtrl = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    reconciler.sampleAndPredictInput(0, idleCtrl, simulatedTimeMs);
    clientSim.setControls(0, idleCtrl);
    clientSim.step(1);
    server.tick(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
    reconciler.updateSmoothing(tickDtMs / 1000.0);
  }

  // Advance server by the remaining timeline lead ticks so server catches up to the identical tick as client
  const clientTick = Math.floor(clientSim.getHeaderView().tickCount);
  const serverTick = Math.floor(server.sim.getHeaderView().tickCount);
  const leadDiff = clientTick - serverTick;
  for (let k = 0; k < leadDiff; k++) {
    simulatedTimeMs += tickDtMs;
    server.tick(simulatedTimeMs);
  }

  // Client car position and server car position must now be 100% bit-exact at the identical tick
  const clientCar = clientSim.getCarStateView(0);
  const serverCar = server.sim.getCarStateView(0);
  const finalDistance = Math.hypot(clientCar.posX - serverCar.posX, clientCar.posY - serverCar.posY, clientCar.posZ - serverCar.posZ);

  console.log(`Final distance between client predicted and server authoritative car: ${finalDistance.toFixed(6)} UU`);
  assert.ok(finalDistance < 0.001, `Client and server must converge to within 0.001 UU (got ${finalDistance})`);

  server.destroy();
  clientSim.destroy();
});

test('Client Timeline Lead Zero-Desync and Multi-Car Prediction Verification', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const { PredictionReconciler } = await import('../src/network/PredictionReconciler.js');
  const { AuthoritativeServer } = await import('../src/network/AuthoritativeServer.js');

  const channel = new NetworkChannel({ rttMs: 80, jitterMs: 0, packetLossRate: 0.0 });
  const server = new AuthoritativeServer(channel, { snapshotInterval: 2 });
  await server.init();
  server.sim.addCar(1, 0); // Add second car (orange team)

  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);
  clientSim.addCar(1, 0);

  let simulatedTimeMs = 1000.0;

  const reconciler = new PredictionReconciler(clientSim, channel, { localCarIndex: 0, enableSmoothing: false });
  reconciler.syncTimeline(server.sim.saveState(), 0, simulatedTimeMs - 200);
  const tickDtMs = 1000.0 / 120.0;

  // Run 180 ticks under clean network conditions
  for (let i = 0; i < 180; i++) {
    simulatedTimeMs += tickDtMs;

    const ctrl0 = {
      throttle: 1.0,
      steer: (i % 50) > 25 ? 0.5 : -0.5,
      pitch: 0.0,
      yaw: 0.0,
      roll: 0.0,
      jump: false,
      boost: (i % 60) < 30,
      handbrake: false
    };

    reconciler.sampleAndPredictInput(0, ctrl0, simulatedTimeMs);
    clientSim.setControls(0, ctrl0);
    clientSim.step(1);

    server.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Under clean conditions with timeline lead, client prediction must be 100% bit-exact (0 corrections)
  assert.equal(reconciler.totalCorrections, 0, `Expected 0 corrections with timeline lead under zero packet loss, got ${reconciler.totalCorrections}`);
  assert.equal(reconciler.maxCorrectionDelta, 0, 'Max correction delta should be strictly 0');

  // Now test dropped packet burst recovery:
  // Client makes an abrupt steering & boosting jump while 5 consecutive packets are dropped
  for (let i = 0; i < 60; i++) {
    if (i < 5) channel.forceDropNextInput();
    simulatedTimeMs += tickDtMs;
    const ctrl0 = {
      throttle: 1.0,
      steer: -1.0,
      pitch: 0.0,
      yaw: 0.0,
      roll: 0.0,
      jump: true,
      boost: true,
      handbrake: true
    };

    reconciler.sampleAndPredictInput(0, ctrl0, simulatedTimeMs);
    clientSim.setControls(0, ctrl0);
    clientSim.step(1);

    server.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  assert.ok(reconciler.totalCorrections >= 1, 'Packet drop must trigger at least 1 reconciliation');

  server.destroy();
  clientSim.destroy();
});

test('GDC Redundant Input Packing Immunity to Packet Drops', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const { PredictionReconciler } = await import('../src/network/PredictionReconciler.js');
  const { AuthoritativeServer } = await import('../src/network/AuthoritativeServer.js');

  const channel = new NetworkChannel({ rttMs: 80, jitterMs: 0, packetLossRate: 0.0 });
  const server = new AuthoritativeServer(channel, { snapshotInterval: 2 });
  await server.init();

  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);

  // Enable redundant input packing
  const reconciler = new PredictionReconciler(clientSim, channel, {
    localCarIndex: 0,
    enableSmoothing: false,
    enableRedundantInputs: true,
    redundantHistoryTicks: 12
  });
  reconciler.syncTimeline(server.sim.saveState(), 0);

  let simulatedTimeMs = 1000.0;
  const tickDtMs = 1000.0 / 120.0;

  // Run with intentional dropped packet while steering and accelerating
  for (let i = 0; i < 180; i++) {
    simulatedTimeMs += tickDtMs;

    const ctrl = {
      throttle: 1.0,
      steer: (i % 60) > 30 ? 0.6 : -0.6,
      pitch: -0.3,
      yaw: 0.0,
      roll: 0.0,
      jump: (i % 40) > 25,
      boost: (i % 50) < 30,
      handbrake: false
    };

    // Inject intentional single packet drop at tick 60
    if (i === 60) {
      channel.dropSinglePacket();
    }

    reconciler.sampleAndPredictInput(0, ctrl, simulatedTimeMs);
    clientSim.setControls(0, ctrl);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Redundant historical inputs sent on tick 61 backfilled tick 60, resulting in 0 corrections!
  assert.equal(reconciler.totalCorrections, 0, `Redundant inputs must prevent misprediction, got ${reconciler.totalCorrections} corrections`);
  assert.equal(reconciler.maxCorrectionDelta, 0, 'Correction delta must be 0 with redundant input backfill');

  server.destroy();
  clientSim.destroy();
});
