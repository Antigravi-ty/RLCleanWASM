import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('RocketSim WASM Core Rollback Determinism', async (t) => {
  const coreModule = await import('../src/physics/core.js');
  const mod = await coreModule.default();

  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  const chunks = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));
  const totalBytes = chunks.reduce((a, b) => a + b.length, 0);

  const dataPtr = mod._malloc(totalBytes);
  const sizesPtr = mod._malloc(chunks.length * 4);
  let off = 0;
  chunks.forEach((chunk, i) => {
    mod.HEAPU8.set(chunk, dataPtr + off);
    mod.HEAP32[(sizesPtr >> 2) + i] = chunk.length;
    off += chunk.length;
  });
  const initRes = mod._physics_init(dataPtr, sizesPtr, chunks.length);
  mod._free(dataPtr);
  mod._free(sizesPtr);

  assert.equal(initRes, 1, 'RocketSim init should return 1');
  assert.equal(mod._physics_createArena(), 1, 'CreateArena should return 1');

  const car0 = mod._physics_addCar(0, 0);
  const car1 = mod._physics_addCar(1, 0);
  assert.equal(car0, 0);
  assert.equal(car1, 1);

  const statePtr = mod._physics_getStatePtr();
  const controlsPtr = mod._physics_getControlsPtr();

  // 1. Initial simulation with steering and jumping
  const c0 = (controlsPtr >> 2) + 0 * 8;
  const c1 = (controlsPtr >> 2) + 1 * 8;

  mod.HEAPF32[c0 + 0] = 1.0;
  mod.HEAPF32[c0 + 1] = -0.3;
  mod.HEAPF32[c0 + 5] = 1.0;
  mod.HEAPF32[c0 + 6] = 1.0;

  mod.HEAPF32[c1 + 0] = 0.8;
  mod.HEAPF32[c1 + 1] = 0.5;

  for (let i = 0; i < 60; i++) {
    mod._physics_step(1);
  }

  assert.equal(mod.HEAPF32[statePtr >> 2], 60, 'Tick should be 60');

  // Save to slot 0
  assert.equal(mod._physics_saveStateSlot(0), 1, 'SaveStateSlot 0 should succeed');

  // 2. Forward simulation to tick 120 (Run A)
  mod.HEAPF32[c0 + 2] = -1.0;
  mod.HEAPF32[c0 + 5] = 1.0;
  mod.HEAPF32[c1 + 6] = 1.0;

  for (let i = 0; i < 60; i++) {
    mod._physics_step(1);
  }

  assert.equal(mod.HEAPF32[statePtr >> 2], 120, 'Tick should be 120');
  const stateA = new Float32Array(mod.HEAPF32.buffer, statePtr, 424).slice();

  // 3. Rollback to tick 60
  assert.equal(mod._physics_restoreStateSlot(0), 1, 'RestoreStateSlot 0 should succeed');
  assert.equal(mod.HEAPF32[statePtr >> 2], 60, 'Restored tick must be 60');

  // 4. Resimulate to tick 120 with stepSilent and identical inputs (Run B)
  mod.HEAPF32[c0 + 0] = 1.0;
  mod.HEAPF32[c0 + 1] = -0.3;
  mod.HEAPF32[c0 + 2] = -1.0;
  mod.HEAPF32[c0 + 5] = 1.0;
  mod.HEAPF32[c0 + 6] = 1.0;

  mod.HEAPF32[c1 + 0] = 0.8;
  mod.HEAPF32[c1 + 1] = 0.5;
  mod.HEAPF32[c1 + 6] = 1.0;

  for (let i = 0; i < 60; i++) {
    mod._physics_stepSilent(1);
  }

  assert.equal(mod.HEAPF32[statePtr >> 2], 120, 'Tick should be 120');
  const stateB = new Float32Array(mod.HEAPF32.buffer, statePtr, 424).slice();

  // 5. Assert 100% bit-exact float equality across all 424 floats
  let maxDiff = 0;
  for (let i = 0; i < 424; i++) {
    const diff = Math.abs(stateA[i] - stateB[i]);
    if (diff > maxDiff) maxDiff = diff;
    assert.equal(stateA[i], stateB[i], `Float mismatch at state offset ${i}: Run A = ${stateA[i]}, Run B = ${stateB[i]}`);
  }

  assert.equal(maxDiff, 0, 'Max difference across all floats must be strictly 0');
});
