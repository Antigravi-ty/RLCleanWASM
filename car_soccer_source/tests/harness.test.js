import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Dual-Arena Determinism Harness Side-by-Side Verification', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { DeterminismHarness } = await import('../src/physics/DeterminismHarness.js');

  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));

  RocketSimPhysicsEngine.cachedCollisionData = chunks;

  const simA = new RocketSimPhysicsEngine();
  await simA.init({ freshInstance: true });
  simA.addCar(0, 0);

  const harness = new DeterminismHarness(simA);
  await harness.init();

  assert.equal(harness.active, true, 'Harness should be active');
  assert.notEqual(harness.simB, null, 'Arena B should be initialized');

  // Run 240 ticks with dynamic player controls & periodic rollbacks
  for (let tick = 0; tick < 240; tick++) {
    const ctrl = {
      throttle: 1.0,
      steer: (tick % 60) > 30 ? 0.7 : -0.7,
      pitch: (tick % 100) > 50 ? -1.0 : 0.0,
      yaw: 0.0,
      roll: 0.0,
      jump: (tick % 30) > 15,
      boost: (tick % 80) < 40,
      handbrake: (tick % 40) < 10
    };

    simA.setControls(0, ctrl);
    simA.step(1);
  }

  assert.equal(harness.metrics.tickA, 240, 'Tick A should be 240');
  assert.equal(harness.metrics.tickB, 240, 'Tick B should be 240');
  assert.ok(harness.metrics.totalRollbacks >= 7, 'Should have executed at least 7 periodic rollbacks');
  assert.equal(harness.metrics.carDeltaPos, 0, 'Car Delta Pos must be strictly 0');
  assert.equal(harness.metrics.ballDeltaPos, 0, 'Ball Delta Pos must be strictly 0');
  assert.equal(harness.metrics.maxDeltaPos, 0, 'Max Observed Delta Pos must be strictly 0');
  assert.equal(harness.metrics.isBitExact, true, 'State must be strictly bit-exact');

  harness.destroy();
});

test('Dual-Arena Harness Bug Fixes Verification: Unlimited Boost, ResetKickoff, Multi-Substeps', async (t) => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const { DeterminismHarness } = await import('../src/physics/DeterminismHarness.js');

  const simA = new RocketSimPhysicsEngine();
  await simA.init({ freshInstance: true });
  simA.addCar(0, 0);

  // Test Bug 1: Unlimited Boost enabled prior to harness init
  simA.setUnlimitedBoost(true);

  const harness = new DeterminismHarness(simA, { rollbackInterval: 20, rollbackDepth: 15 });
  await harness.init();

  // 1. Advance 150 ticks using multi-substep stepping (simA.step(2) and step(3)) with constant boosting
  for (let tick = 0; tick < 60; tick++) {
    const boostCtrl = {
      throttle: 1.0,
      steer: 0.3,
      pitch: 0.0,
      yaw: 0.0,
      roll: 0.0,
      jump: false,
      boost: true,
      handbrake: false
    };
    simA.setControls(0, boostCtrl);
    simA.step(2); // Multi-substep stepping (Bug 3 & 5)
  }

  assert.equal(harness.metrics.isBitExact, true, 'Must remain 100% bit-exact with unlimited boost and multi-substepping');
  assert.equal(harness.metrics.maxDeltaPos, 0, 'Max Delta Pos must be strictly 0 under unlimited boost');

  // 2. Test Bug 2: Kickoff Reset followed immediately by periodic rollbacks
  simA.resetKickoff();
  assert.equal(harness.metrics.isBitExact, true, 'Must remain bit-exact immediately after kickoff reset');

  for (let tick = 0; tick < 50; tick++) {
    const driveCtrl = {
      throttle: 1.0,
      steer: -0.5,
      pitch: 0.0,
      yaw: 0.0,
      roll: 0.0,
      jump: tick % 20 > 10,
      boost: false,
      handbrake: false
    };
    simA.setControls(0, driveCtrl);
    simA.step(1);
  }

  assert.equal(harness.metrics.isBitExact, true, 'Must remain bit-exact after kickoff reset with rollbacks');
  assert.equal(harness.metrics.maxDeltaPos, 0, 'Max Delta Pos must stay strictly 0');

  harness.destroy();
  simA.destroy();
});
