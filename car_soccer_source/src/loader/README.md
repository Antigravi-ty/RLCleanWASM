# Loading Subsystem & Task Orchestrator

This directory contains the decoupled, modular loading pipeline and task orchestrator subsystem for **Car Soccer**.

It replaces the legacy monolithic `init()` sequence with a deterministic, dependency-aware directed acyclic graph (DAG) of asynchronous loading tasks, conforming to Apple Human Interface Guidelines (HIG) determinate progress standards.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                      UI / Observer Layer                               │
│  - ConsoleProgressObserver (Step X of Y, overall percent, task status)  │
│  - DualProgressUIAdapter   (Stage progress + Asset byte stream)        │
│  - Custom UI Progress Bar  (External pluggable UI component)           │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Event Emitter
┌───────────────────────────────────┴────────────────────────────────────┐
│                    LoadingOrchestrator & TaskTracker                   │
│  - LoadingTask: Atomic unit (id, stage, weight, deps, timeout, run)    │
│  - DAG Scheduler: Resolves dependencies & executes concurrent batches  │
│  - ProgressAggregator: Computes weighted overall percentage (0%..100%) │
│  - Shared Memory Bus: Stores pre-downloaded buffers across phases      │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Dispatches & Coordinates
┌───────────────────────────────────┴────────────────────────────────────┐
│                      Decoupled Subsystem Modules                       │
│  - StreamDownloadTracker: Byte-accurate ReadableStream chunk monitoring│
│  - POV Camera Microkernel: SHA-256 + ABI preflight check               │
│  - RocketSim Physics: Mesh chunks & WASM memory initialization         │
│  - ArenaWorld: 3D models (stadium, ball, vehicles, pads) streaming     │
│  - Audio Subsystem: 41-buffer pool with concurrency-limited decoding   │
│  - Bot AI Agent: Non-blocking parallel preloading with 3.5s timeout    │
│  - WebGL Shaders: GPU compileAsync prewarming across visual themes     │
│  - Engine Ignition: 120Hz deterministic render clock activation        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Lifecycle Stages & Task Graph

| Stage | Name | Weight | Primary Tasks | Concurrency |
|---|---|---|---|---|
| **Stage 1** | Security Preflight | 10% | `preflight.camera_microkernel` | Standalone Fail-Fast |
| **Stage 2** | Asset Diagnostics | 5% | `diagnostics.static_assets` | Asset Availability & Binary Header Audit |
| **Stage 3** | Physics & Collision Mesh | 25% | `physics.manifest.fetch`<br>`physics.wasm.stream`<br>`physics.mesh.stream`<br>`physics.engine.init` | Download 16 `.cmf` chunks in parallel &rarr; Init WASM Heap & Collision Arena |
| **Stage 4** | 3D Geometry & Assets | 25% | `geometry.scene.build` | Stadium, Ball, Vehicles, Boost Pads & UI overlays |
| **Stage 5** | Audio, Fonts & Bot AI | 15% | `subsystems.audio.pool`<br>`subsystems.fonts`<br>`subsystems.bot.policies` | Concurrency pool (6) audio decode, web fonts, parallel bot policies |
| **Stage 6** | Shader Prewarming | 15% | `shaders.prewarm` | Multi-theme `renderer.compileAsync` & Bloom passes |
| **Stage 7** | Engine Ignition | 5% | `ignition.clock_scheduler` | Synchronize physics state, first frame render, 120Hz clock start |

---

## "Download First, Parse/Load Later" Pattern

To prevent network stalls, TCP queue deadlocks, and main thread freezing, the loading pipeline strictly separates asset download from instantiation:

1. **Download Phase**:
   Assets (such as 16 arena collision chunks, 3D glTF/GLB models, and audio files) are streamed via `StreamDownloadTracker`, which tracks exact bytes read via `ReadableStream`.
2. **Buffer Handover**:
   The downloaded `ArrayBuffer` instances are saved into the orchestrator's shared context (`ctx.setShared('key', buffer)`).
3. **Module Execution Phase**:
   Once all dependencies are ready, the orchestrator triggers the target subsystem (e.g. `RocketSimPhysicsEngine.init({ collisionData })`), which consumes the in-memory buffers directly without issuing network requests.

---

## Numerical Progress Reporting Contract

Every subsystem module returns numerical progress updates back to the orchestrator:

```javascript
// Inside a LoadingTask run function:
ctx.reportProgress(0.45, 'Loaded 7 of 16 collision mesh chunks');
```

The `LoadingOrchestrator` aggregates task progress with stage weights, producing:
- `currentStep` / `totalSteps` (e.g. Step 8 of 14)
- `stageIndex` / `totalStages` (e.g. Stage 3 of 7)
- `overallPercent` (smooth, strictly monotonic 0.0% &rarr; 100.0%)

---

## Future Custom UI Progress Bar Integration Guide

When the dedicated custom loading UI is ready, it can be hooked into the pipeline in one line without modifying the engine runtime.

### Step 1: Create a Custom Progress Bar Component
Implement any subset of the standardized observer callbacks:

```javascript
// MyCustomProgressBar.js
export class MyCustomProgressBar {
  constructor(domElement) {
    this.root = domElement;
    this.stageBar = domElement.querySelector('.my-stage-progress-bar');
    this.byteBar = domElement.querySelector('.my-byte-progress-bar');
    this.titleText = domElement.querySelector('.my-title');
    this.statusText = domElement.querySelector('.my-status');
  }

  // Called when lifecycle stage transitions (1..7)
  onStageChange({ stageIndex, totalStages, stageTitle, stageDescription }) {
    if (this.titleText) this.titleText.textContent = stageTitle;
    if (this.statusText) this.statusText.textContent = stageDescription;
  }

  // Called when a task starts
  onTaskStart({ taskId, taskName, step, totalSteps, overallPercent }) {
    if (this.statusText) {
      this.statusText.textContent = `[${step}/${totalSteps}] ${taskName}...`;
    }
  }

  // Called continuously with weighted overall progress
  onProgress({ overallPercent, taskProgress, detail, bytes }) {
    if (this.stageBar) {
      this.stageBar.style.width = `${overallPercent.toFixed(1)}%`;
    }
  }

  // Called on byte streaming events (content-length tracking)
  onByteStream({ overallRatio, loadedBytes, totalBytes, activeUrl }) {
    if (this.byteBar) {
      this.byteBar.style.width = `${(overallRatio * 100).toFixed(1)}%`;
    }
  }

  // Called when entire loading lifecycle completes
  onComplete({ totalDurationMs, totalSteps }) {
    this.root.classList.add('loading--finished');
    setTimeout(() => this.root.remove(), 400);
  }

  // Called on fatal or non-fatal errors
  onError({ taskId, taskName, error, isCritical }) {
    if (isCritical) {
      this.statusText.textContent = `Error: ${error.message}`;
    }
  }
}
```

### Step 2: Register with GameBootstrap
Attach your component to `bootstrap` before or during engine startup:

```javascript
import { GameBootstrap } from './game/GameBootstrap.js';
import { MyCustomProgressBar } from './ui/MyCustomProgressBar.js';

const app = document.querySelector('#app');
const bootstrap = new GameBootstrap(app);

// Hook custom UI component:
const customUI = new MyCustomProgressBar(document.querySelector('#custom-loading-ui'));
bootstrap.registerCustomProgressBar(customUI);

await bootstrap.start();
```
