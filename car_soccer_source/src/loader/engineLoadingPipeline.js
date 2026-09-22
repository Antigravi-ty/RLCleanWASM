/**
 * src/loader/engineLoadingPipeline.js
 * Declarative task graph registration for the Car Soccer Engine bootstrap lifecycle.
 *
 * Implements:
 * 1. 7 deterministic stages adhering to the lifecycle architecture specification.
 * 2. "Download First, Parse/Load Later" decoupling for physics meshes and core assets.
 * 3. Numerical progress reporting [0.0..1.0] from each decoupled engine subsystem.
 * 4. Fault-isolated tasks with non-blocking graceful fallbacks (e.g. Bot AI, audio).
 */

import { LoadingOrchestrator } from './LoadingOrchestrator.js';
import { LoadingTask } from './LoadingTask.js';
import { verifyCameraMicrokernelIntegrity } from '../camera/exempt_pov_microkernel/index.js';
import { auditRequiredAssets, formatMissingAssetsHtml } from '../game/AssetDiagnostics.js';

/**
 * Builds and configures the standard game engine loading pipeline.
 * @param {GameRuntime} runtime
 * @param {object} [options={}]
 * @returns {LoadingOrchestrator}
 */
export function buildEngineLoadingPipeline(runtime, options = {}) {
  const orchestrator = new LoadingOrchestrator(options);

  // =========================================================================
  // Stage 1: Security Preflight (POV Camera Microkernel Integrity)
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'preflight.camera_microkernel',
      name: 'Verify Camera Microkernel Integrity',
      stage: 1,
      stageName: 'Security Preflight',
      weight: 1.0,
      critical: true,
      run: async (ctx) => {
        ctx.reportProgress(0.2, 'Checking SHA-256 and ABI contract...');
        await verifyCameraMicrokernelIntegrity(options);
        ctx.reportProgress(1.0, 'POV camera microkernel verified');
      }
    })
  );

  // =========================================================================
  // Stage 2: Static Asset Diagnostics & HTTP Validation
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'diagnostics.static_assets',
      name: 'Audit Static Assets & Headers',
      stage: 2,
      stageName: 'Asset Diagnostics',
      weight: 1.0,
      critical: true,
      run: async (ctx) => {
        ctx.reportProgress(0.3, 'Auditing asset availability and binary headers...');
        const { missingCritical, missingNonCritical } = await auditRequiredAssets();

        if (missingCritical && missingCritical.length > 0) {
          const err = new Error(formatMissingAssetsHtml(missingCritical));
          err.isAssetError = true;
          throw err;
        }

        const isWorkerMissing = Boolean(
          missingNonCritical && missingNonCritical.some(m => m.path === '/assets/ai-opponent-worker.js')
        );
        runtime.isAiWorkerMissing = isWorkerMissing;
        if (isWorkerMissing) {
          console.warn('[LoadingPipeline] AI opponent worker missing. Normal game loading will proceed; fallback heuristic bot will be used.');
          runtime.bot?.enableFallbackMode?.('AI opponent worker is missing');
        }

        ctx.reportProgress(1.0, 'Asset diagnostics passed');
      }
    })
  );

  // =========================================================================
  // Stage 3: Physics & Collision Mesh (Download First, Initialize Later)
  // =========================================================================

  // 3.1 Download collision manifest
  orchestrator.registerTask(
    new LoadingTask({
      id: 'physics.manifest.fetch',
      name: 'Fetch Arena Collision Manifest',
      stage: 3,
      stageName: 'Physics & Collision Mesh',
      weight: 0.15,
      critical: true,
      run: async (ctx) => {
        ctx.reportProgress(0.2, 'Requesting /custom/arenamesh/manifest.json');
        const manifestRes = await fetch('/custom/arenamesh/manifest.json');
        if (!manifestRes.ok) throw new Error(`[Physics] Failed to fetch collision manifest: HTTP ${manifestRes.status}`);
        const chunkFilenames = await manifestRes.json();
        ctx.setShared('meshFilenames', chunkFilenames);
        ctx.reportProgress(1.0, `Discovered ${chunkFilenames.length} arena mesh chunks`);
      }
    })
  );

  // 3.2 Stream 16 collision mesh chunks concurrently with byte tracking
  orchestrator.registerTask(
    new LoadingTask({
      id: 'physics.mesh.stream',
      name: 'Stream 16 Arena Mesh Chunks',
      stage: 3,
      stageName: 'Physics & Collision Mesh',
      weight: 0.45,
      dependencies: ['physics.manifest.fetch'],
      critical: true,
      run: async (ctx) => {
        const filenames = ctx.getShared('meshFilenames') || [];
        const total = filenames.length;
        let completed = 0;

        const chunks = await Promise.all(
          filenames.map(async (chunkFile, idx) => {
            const url = `/custom/arenamesh/${chunkFile}`;
            const buffer = await ctx.downloadTracker.fetchBuffer(url);
            completed++;
            ctx.reportProgress(completed / total, `Chunk ${completed}/${total} (${chunkFile})`);
            return new Uint8Array(buffer);
          })
        );

        ctx.setShared('collisionChunks', chunks);
        ctx.reportProgress(1.0, 'All collision mesh chunks downloaded');
      }
    })
  );

  // 3.3 Initialize RocketSim WASM & assemble collision space in heap
  orchestrator.registerTask(
    new LoadingTask({
      id: 'physics.engine.init',
      name: 'Initialize RocketSim WASM & Arena',
      stage: 3,
      stageName: 'Physics & Collision Mesh',
      weight: 0.40,
      dependencies: ['physics.mesh.stream', 'preflight.camera_microkernel'],
      critical: true,
      run: async (ctx) => {
        ctx.reportProgress(0.2, 'Allocating WASM heap & compiling rigid-body physics...');
        const collisionData = ctx.getShared('collisionChunks');
        await runtime.setupPhysics({ collisionData });
        ctx.reportProgress(1.0, 'Arena collision space created & player car allocated');
      }
    })
  );

  // =========================================================================
  // Stage 4: 3D Geometry, Models & UI Controls
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'geometry.scene.build',
      name: 'Stream 3D Stadium, Vehicle & Pad Geometries',
      stage: 4,
      stageName: '3D Geometry & Assets',
      weight: 1.0,
      dependencies: ['physics.engine.init'],
      critical: true,
      run: async (ctx) => {
        await runtime.setupScene((ratio, detail) => {
          ctx.reportProgress(ratio, detail);
        });
        ctx.reportProgress(1.0, '3D scene graph & UI overlays mounted');
      }
    })
  );

  // =========================================================================
  // Stage 5: Audio Decoders, WebFonts & AI Agent Policies
  // =========================================================================

  // 5.1 Concurrency-controlled audio pool decoding
  orchestrator.registerTask(
    new LoadingTask({
      id: 'subsystems.audio.pool',
      name: 'Decode 41-Channel Audio Buffer Pool',
      stage: 5,
      stageName: 'Audio, Fonts & AI Agent',
      weight: 0.60,
      critical: false,
      run: async (ctx) => {
        await runtime.setupAudio((loaded, total, file) => {
          const filename = file ? file.split('/').pop() : '';
          ctx.reportProgress(loaded / total, `Decoded ${loaded}/${total} audio buffers (${filename})`);
        });
        ctx.reportProgress(1.0, 'Audio architecture online');
      }
    })
  );

  // 5.2 Web font preloading
  orchestrator.registerTask(
    new LoadingTask({
      id: 'subsystems.fonts',
      name: 'Preload Web Fonts (Archivo, Lilita One)',
      stage: 5,
      stageName: 'Audio, Fonts & AI Agent',
      weight: 0.15,
      critical: false,
      run: async (ctx) => {
        if (typeof document !== 'undefined' && document.fonts) {
          const fontList = ['400 16px Archivo', '500 16px Archivo', '700 16px Archivo', '400 20px "Lilita One"'];
          let loaded = 0;
          await Promise.all(
            fontList.map(async f => {
              try {
                await document.fonts.load(f);
              } catch (_) {}
              loaded++;
              ctx.reportProgress(loaded / fontList.length, `Loaded font ${f}`);
            })
          );
        }
        ctx.reportProgress(1.0, 'Web fonts preloaded');
      }
    })
  );

  // 5.3 Non-blocking Bot AI policy preload with 3.5s strict timeout
  orchestrator.registerTask(
    new LoadingTask({
      id: 'subsystems.bot.policies',
      name: 'Preload AI Bot Policies (Seer, Necto, Nexto)',
      stage: 5,
      stageName: 'Audio, Fonts & AI Agent',
      weight: 0.25,
      critical: false,
      timeoutMs: 4000,
      run: async (ctx) => {
        await runtime.setupBot((loaded, total, botId) => {
          ctx.reportProgress(loaded / total, `Bot policy: ${botId}`);
        });
        ctx.reportProgress(1.0, 'AI policies ready or gracefully deferred');
      }
    })
  );

  // =========================================================================
  // Stage 6: Shader Pipeline Prewarming & GPU Material Compilation
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'shaders.prewarm',
      name: 'Prewarm Shaders & Composite Passes',
      stage: 6,
      stageName: 'Shader Pipeline Prewarming',
      weight: 1.0,
      dependencies: ['geometry.scene.build'],
      critical: true,
      run: async (ctx) => {
        await runtime.setupShaders((ratio, theme) => {
          ctx.reportProgress(ratio, `Prewarming materials for theme: ${theme}`);
        });
        ctx.reportProgress(1.0, 'All visual shaders compiled into GPU cache');
      }
    })
  );

  // =========================================================================
  // Stage 7: Engine Ignition & 120Hz Clock Start
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'ignition.clock_scheduler',
      name: 'Ignite 120Hz Clock & Synchronize First Frame',
      stage: 7,
      stageName: 'Engine Ignition',
      weight: 1.0,
      dependencies: ['shaders.prewarm', 'subsystems.audio.pool'],
      critical: true,
      run: async (ctx) => {
        ctx.reportProgress(0.5, 'Synchronizing physics interpolator and rendering frame 0...');
        runtime.ignite();
        ctx.reportProgress(1.0, 'Engine ignition complete. Simulation running at 120Hz.');
      }
    })
  );

  return orchestrator;
}
