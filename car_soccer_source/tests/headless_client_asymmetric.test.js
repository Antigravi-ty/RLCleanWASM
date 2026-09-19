import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('WebRTCChannel Loopback & Microtask Fallback Transport', async () => {
  const { WebRTCChannel } = await import('../src/network/WebRTCChannel.js');
  const channel = new WebRTCChannel({ rttMs: 40, jitterMs: 0, packetLossRate: 0.0 });

  const now = 1000.0;
  channel.sendClientInput({ tick: 10, controls: { jump: true } }, now);

  // At now (before deliverAt = 1000 + 20 = 1020), no packet delivered
  const deliveredEarly = channel.receiveServerPackets(now + 10);
  assert.equal(deliveredEarly.length, 0, 'Packet should not arrive before delivery time');

  // At now + 20ms, packet delivered
  const deliveredOnTime = channel.receiveServerPackets(now + 20);
  assert.equal(deliveredOnTime.length, 1, 'Packet must arrive at deliverAt');
  assert.equal(deliveredOnTime[0].tick, 10);
  assert.equal(deliveredOnTime[0].controls.jump, true);

  // Test packet drop injection
  channel.forceDropNextInput(1);
  const sent = channel.sendClientInput({ tick: 11, controls: { jump: false } }, now + 25);
  assert.equal(sent, false, 'Packet should be marked dropped');
  const deliveredDropped = channel.receiveServerPackets(now + 100);
  assert.equal(deliveredDropped.length, 0, 'Dropped packet must never be delivered');

  channel.destroy();
});

test('Asymmetric Input Coordinator: Ground Isolation & Leader Switching', async () => {
  const { AsymmetricInputCoordinator } = await import('../src/network/AsymmetricInputCoordinator.js');

  const mockReconciler = {
    leadTicks: 5, // High latency for Real Client (e.g. 80ms RTT)
    sim: {
      getHeaderView: () => ({ tickCount: 100 })
    },
    sampleAndPredictInput: () => {}
  };

  const mockHeadless = {
    active: true,
    leadTicks: 2, // Low latency for Headless Client (e.g. 20ms RTT)
    scheduled: new Map(),
    scheduleInput(t, ctrl) {
      this.scheduled.set(t, ctrl);
    },
    transmitInputForTick(t) {}
  };

  const coordinator = new AsymmetricInputCoordinator(mockReconciler, mockHeadless);

  // 1. Verify Ground Controls Isolation
  const userControls = {
    throttle: 1.0,
    steer: -0.8,
    pitch: 0.5,
    yaw: -0.3,
    roll: 1.0,
    jump: true,
    boost: true,
    handbrake: true
  };

  const headlessFiltered = coordinator.filterHeadlessControls(userControls);
  assert.equal(headlessFiltered.throttle, 0, 'Headless car throttle must be strictly 0 (ground isolated)');
  assert.equal(headlessFiltered.steer, 0, 'Headless car steer must be strictly 0 (ground isolated)');
  assert.equal(headlessFiltered.handbrake, false, 'Headless car handbrake must be strictly false');
  assert.equal(headlessFiltered.pitch, 0.5, 'Headless car pitch must replicate user input');
  assert.equal(headlessFiltered.roll, 1.0, 'Headless car roll must replicate user air roll');
  assert.equal(headlessFiltered.jump, true, 'Headless car jump must replicate user jump');

  // 2. Case A: Real Client has higher latency (realLead = 5 >= headlessLead = 2) -> Real Client is LEADER
  const resA = coordinator.coordinate(userControls, 1000);
  assert.equal(resA.leader, 'real', 'Real Client must be leader when its latency/lead is higher');
  assert.equal(resA.targetTick, 100, 'Target tick must match Real Client current tick');
  assert.equal(resA.car0Controls.throttle, 1.0, 'Car 0 retains full user throttle');
  assert.ok(mockHeadless.scheduled.has(100), 'Headless client must have scheduled input for tick 100');
  assert.equal(mockHeadless.scheduled.get(100).jump, true, 'Headless client received jump for tick 100');
  assert.equal(mockHeadless.scheduled.get(100).throttle, 0, 'Headless scheduled input has 0 throttle');

  // 3. Case B: Headless Client has higher latency (realLead = 2 < headlessLead = 6) -> Headless Client is LEADER
  mockReconciler.leadTicks = 2;
  mockHeadless.leadTicks = 6;
  const deltaLead = 6 - 2; // 4 ticks future lead

  const resB = coordinator.coordinate(userControls, 1000);
  assert.equal(resB.leader, 'headless', 'Headless client must be leader when its latency/lead is higher');
  assert.equal(resB.targetTick, 100 + deltaLead, `Target tick must be scheduled ${deltaLead} ticks in future`);
  assert.ok(mockHeadless.scheduled.has(104), 'Headless client must transmit for tick 104');
  assert.ok(coordinator.scheduledLocalInputs.has(104), 'Real client must schedule local input for future tick 104');
});

test('Headless Client 2 & Real Client Multi-Vehicle Simulation & Asymmetric Sync', async () => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { WebRTCChannel } = await import('../src/network/WebRTCChannel.js');
  const { PredictionReconciler } = await import('../src/network/PredictionReconciler.js');
  const { AuthoritativeServer } = await import('../src/network/AuthoritativeServer.js');
  const { HeadlessClient } = await import('../src/network/HeadlessClient.js');
  const { AsymmetricInputCoordinator } = await import('../src/network/AsymmetricInputCoordinator.js');

  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));
  RocketSimPhysicsEngine.cachedCollisionData = chunks;

  // Setup Real Client Channel (80ms RTT)
  const client0Channel = new WebRTCChannel({ rttMs: 80, jitterMs: 0, packetLossRate: 0.0 });
  const server = new AuthoritativeServer(client0Channel, { snapshotInterval: 2 });
  await server.init();

  // Add Car 1 to server
  server.ensureCar(1, 1);

  // Setup Real Client local simulation with 2 cars (Car 0 = local, Car 1 = remote)
  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);
  clientSim.addCar(1, 0);

  const reconciler = new PredictionReconciler(clientSim, client0Channel, {
    localCarIndex: 0,
    enableSmoothing: false // Disable smoothing to observe pure physical state
  });
  reconciler.syncTimeline(server.sim.saveState(), 0);

  // Setup Headless Client 2 (Car 1) with lower latency (30ms RTT)
  const headlessClient = new HeadlessClient(server, { carIndex: 1, rttMs: 30, jitterMs: 0 });
  headlessClient.connect();

  const coordinator = new AsymmetricInputCoordinator(reconciler, headlessClient);

  let simulatedTimeMs = 1000.0;
  const tickDtMs = 1000.0 / 120.0;

  // Simulate 60 ticks of neutral ground driving
  for (let i = 0; i < 60; i++) {
    simulatedTimeMs += tickDtMs;
    const rawInput = { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    const { car0Controls } = coordinator.coordinate(rawInput, simulatedTimeMs);

    clientSim.setControls(0, car0Controls);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    headlessClient.pollServerState(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Verify Car 0 moved forward while Car 1 remained stationary on ground (because throttle was isolated!)
  const car0Pre = clientSim.getCarStateView(0);
  const car1Pre = clientSim.getCarStateView(1);
  assert.ok(Math.abs(car0Pre.posX) > 50 || Math.abs(car0Pre.posY) > 50, 'Car 0 should have driven forward with throttle');
  assert.ok(Math.abs(car1Pre.velX) < 1.0 && Math.abs(car1Pre.velY) < 1.0, 'Car 1 should not drive because throttle is 0');

  // Now trigger JUMP and AIR ROLL for 15 ticks (Jump Hold & Aerial maneuver)
  for (let i = 0; i < 15; i++) {
    simulatedTimeMs += tickDtMs;
    const jumpInput = {
      throttle: 1.0,
      steer: 0,
      pitch: -0.5,
      yaw: 0,
      roll: 1.0,
      jump: true,
      boost: false,
      handbrake: false
    };
    const { car0Controls } = coordinator.coordinate(jumpInput, simulatedTimeMs);

    clientSim.setControls(0, car0Controls);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    headlessClient.pollServerState(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Advance simulation by 30 ticks to allow server snapshots to arrive and reconcile
  for (let i = 0; i < 30; i++) {
    simulatedTimeMs += tickDtMs;
    const idleInput = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    const { car0Controls } = coordinator.coordinate(idleInput, simulatedTimeMs);

    clientSim.setControls(0, car0Controls);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    headlessClient.pollServerState(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // On the server, both Car 0 and Car 1 jumped into the air!
  const serverCar0 = server.sim.getCarStateView(0);
  const serverCar1 = server.sim.getCarStateView(1);
  assert.ok(serverCar0.posZ > 30.0, `Server Car 0 must be airborne after jump (got ${serverCar0.posZ})`);
  assert.ok(serverCar1.posZ > 30.0, `Server Car 1 must be airborne after replicated jump (got ${serverCar1.posZ})`);

  // And in client prediction, Car 1 must also be airborne and reconciled
  const clientCar1 = clientSim.getCarStateView(1);
  assert.ok(clientCar1.posZ > 30.0, `Client Car 1 must be airborne after reconciliation (got ${clientCar1.posZ})`);

  // Clean up
  headlessClient.destroy();
  server.destroy();
  clientSim.destroy();
  client0Channel.destroy();
});

test('dropSinglePacket() drops strictly 1 packet without continuous loss', async () => {
  const { WebRTCChannel } = await import('../src/network/WebRTCChannel.js');
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');

  for (const ChannelClass of [WebRTCChannel, NetworkChannel]) {
    const channel = new ChannelClass({ rttMs: 20, jitterMs: 0, packetLossRate: 0.0 });
    const now = 1000.0;

    channel.dropSinglePacket();

    // Packet 1: Must be dropped
    const sent1 = channel.sendClientInput({ seq: 1 }, now);
    assert.equal(sent1, false, 'First packet must be dropped');

    // Packet 2: Must NOT be dropped (single drop semantics)
    const sent2 = channel.sendClientInput({ seq: 2 }, now);
    assert.equal(sent2, true, 'Subsequent packet must NOT be dropped');

    // Packet 3: Must NOT be dropped
    const sent3 = channel.sendClientInput({ seq: 3 }, now);
    assert.equal(sent3, true, 'Third packet must NOT be dropped');

    channel.destroy?.();
  }
});

test('Asymmetric Latency: Real Client High Latency causes 100% unpredicted jump correction glitch from Server Sync', async () => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { WebRTCChannel } = await import('../src/network/WebRTCChannel.js');
  const { PredictionReconciler } = await import('../src/network/PredictionReconciler.js');
  const { AuthoritativeServer } = await import('../src/network/AuthoritativeServer.js');
  const { HeadlessClient } = await import('../src/network/HeadlessClient.js');
  const { AsymmetricInputCoordinator } = await import('../src/network/AsymmetricInputCoordinator.js');

  // Setup Real Client Channel with HIGH latency (240ms RTT / 120ms one-way)
  const client0Channel = new WebRTCChannel({ rttMs: 240, jitterMs: 0, packetLossRate: 0.0 });
  const server = new AuthoritativeServer(client0Channel, { snapshotInterval: 2 });
  await server.init();
  server.ensureCar(1, 1);

  // Real Client simulation with Car 0 (local) and Car 1 (remote visual entity)
  const clientSim = new RocketSimPhysicsEngine();
  await clientSim.init({ freshInstance: true, isolated: true });
  clientSim.addCar(0, 0);
  clientSim.addCar(1, 0);

  const reconciler = new PredictionReconciler(clientSim, client0Channel, {
    localCarIndex: 0,
    enableSmoothing: false
  });
  reconciler.syncTimeline(server.sim.saveState(), 0);

  // Headless Client 2 running in background as independent physics & reconciliation engine with LOW latency (30ms RTT)
  const headlessClient = new HeadlessClient(server, { carIndex: 1, rttMs: 30, jitterMs: 0 });
  await headlessClient.init();
  headlessClient.connect();

  assert.ok(headlessClient.sim, 'Headless client must possess independent physics engine');
  assert.ok(headlessClient.reconciler, 'Headless client must possess independent reconciler');

  const coordinator = new AsymmetricInputCoordinator(reconciler, headlessClient);

  let simulatedTimeMs = 1000.0;
  const tickDtMs = 1000.0 / 120.0;

  // Simulate 30 ticks of driving
  for (let i = 0; i < 30; i++) {
    simulatedTimeMs += tickDtMs;
    const rawInput = { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    const { car0Controls } = coordinator.coordinate(rawInput, simulatedTimeMs);

    // Real client ONLY sets controls on local Car 0 (Car 1 controls are strictly NOT cheated/dispatched)
    clientSim.setControls(0, car0Controls);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    headlessClient.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  assert.equal(reconciler.totalCorrections, 0, 'No corrections before unpredicted jump');

  // Now trigger jump: Real Client Latency (240ms RTT) >> Headless Latency (30ms RTT)
  // Both clients target the same authoritative frame ID via asymmetric coordinator
  for (let i = 0; i < 15; i++) {
    simulatedTimeMs += tickDtMs;
    const jumpInput = { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: true, boost: false, handbrake: false };
    const { car0Controls, targetTick } = coordinator.coordinate(jumpInput, simulatedTimeMs);

    // Real client predicts local Car 0 jumping, but Car 1 is remote and cannot be predicted!
    clientSim.setControls(0, car0Controls);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    headlessClient.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // Real Client local simulation before server snapshots arrive:
  // Car 0 is airborne (predicted), Car 1 is still on the ground (cannot be predicted)
  const clientCar0Mid = clientSim.getCarStateView(0);
  const clientCar1Mid = clientSim.getCarStateView(1);
  assert.ok(clientCar0Mid.posZ > 30.0, 'Real client predicts Car 0 airborne');

  // Advance simulation to let server snapshots arrive at high-latency Real Client
  for (let i = 0; i < 40; i++) {
    simulatedTimeMs += tickDtMs;
    const idleInput = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    const { car0Controls } = coordinator.coordinate(idleInput, simulatedTimeMs);

    clientSim.setControls(0, car0Controls);
    clientSim.step(1);

    server.tick(simulatedTimeMs);
    headlessClient.update(simulatedTimeMs);
    reconciler.reconcile(simulatedTimeMs);
  }

  // When server snapshot arrives, Real Client reconciler detects the unpredicted jump glitch on Car 1
  assert.ok(reconciler.totalCorrections >= 1, `Must detect 100% unpredicted jump correction glitch (got ${reconciler.totalCorrections})`);
  assert.ok(reconciler.maxCorrectionDelta > 10.0, `Correction delta must reflect Car 1 jumping from ground into air (got ${reconciler.maxCorrectionDelta} UU)`);

  // And in client simulation, Car 1 is now airborne purely from server sync
  const clientCar1Post = clientSim.getCarStateView(1);
  assert.ok(clientCar1Post.posZ > 30.0, `Car 1 must be airborne after authoritative server sync (got ${clientCar1Post.posZ})`);

  headlessClient.destroy();
  server.destroy();
  clientSim.destroy();
  client0Channel.destroy();
});
