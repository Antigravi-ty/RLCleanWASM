import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('DedicatedServerWorkerClient: lifecycle, channel binding, decoupled pacing & kickoff reset', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { NetworkChannel } = await import('../src/network/NetworkChannel.js');
  const { DedicatedServerWorkerClient } = await import('../src/network/DedicatedServerWorkerClient.js');

  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));

  RocketSimPhysicsEngine.cachedCollisionData = chunks;

  // 1. Setup channel and client proxy
  const channel = new NetworkChannel({ rttMs: 0, jitterMs: 0, packetLossRate: 0.0 });
  const server = new DedicatedServerWorkerClient(channel, { snapshotInterval: 2 });

  await server.init();
  assert.ok(server.active, 'Server should be active after init');

  // 2. Ensure car can be added
  server.ensureCar(1, 1);
  assert.ok(server.sim.numCars >= 1, 'Server should track active cars');

  // 3. Unlimited boost flag propagation
  server.sim.setUnlimitedBoost(true);
  assert.equal(server.sim.isUnlimitedBoost, true, 'Unlimited boost flag should be set');

  // 4. State saving and restoring
  const initialSnap = server.sim.saveState();
  assert.ok(initialSnap instanceof Float32Array, 'Snapshot should be a Float32Array');
  assert.equal(initialSnap.length, server.sim.getStateSnapshotSize(), 'Snapshot length should match getStateSnapshotSize()');

  // 5. Send client input through bound channel
  const testInput = {
    tick: 1,
    carIndex: 0,
    controls: { throttle: 1.0, steer: 0.5, pitch: 0, yaw: 0, roll: 0, jump: false, boost: true, handbrake: false }
  };
  const sent = channel.sendClientInput(testInput);
  assert.equal(sent, true, 'Channel should send client input successfully');

  // 6. Decoupled update execution (does not crash or stall)
  for (let i = 0; i < 5; i++) {
    server.update(1000 + i * 8.333);
  }

  // 7. Reset kickoff handling
  server.sim.resetKickoff(42);
  server.clientInputBuffer.clear();
  server.lastReceivedControls.clear();

  // 8. Clean destruction
  server.destroy();
  assert.equal(server.active, false, 'Server should be deactivated upon destruction');
});
