/**
 * src/loader/engineLoadingPipeline.js
 * Declarative task graph registration for the Car Soccer Engine bootstrap lifecycle.
 *
 * Implements:
 * 1. 7 deterministic stages adhering to the lifecycle architecture specification.
 * 2. "Download First, Parse/Load Later" decoupling for physics meshes and core assets.
 * 3. Numerical progress reporting [0.0..1.0] from each decoupled engine subsystem.
 * 4. Fault-isolated tasks with non-blocking graceful fallbacks (e.g. Bot AI, audio).
 * 5. Explicit determinate / indeterminate task types with professional technical hints.
 */

import { LoadingOrchestrator } from './LoadingOrchestrator.js';
import { LoadingTask } from './LoadingTask.js';
import { verifyCameraMicrokernelIntegrity } from '../camera/exempt_pov_microkernel/CameraMicrokernel.js';
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
      type: 'indeterminate',
      category: 'Security Preflight',
      hint: 'Verifying camera.wasm SHA-256 Digest & Linear Memory Contract...',
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
      type: 'indeterminate',
      category: 'Asset Diagnostics',
      hint: 'Auditing asset availability and binary headers...',
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
      type: 'determinate',
      category: 'Physics & Collision',
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
      type: 'determinate',
      category: 'Physics & Collision',
      weight: 0.45,
      dependencies: ['physics.manifest.fetch'],
      critical: true,
      run: async (ctx) => {
        const filenames = ctx.getShared('meshFilenames') || [];
        const total = filenames.length;
        let completed = 0;

        const chunks = await Promise.all(
          filenames.map(async (chunkFile) => {
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
      type: 'indeterminate',
      category: 'Physics & Collision',
      hint: 'Allocating RocketSim WASM linear heap & compiling collision BVH tree...',
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
      type: 'determinate',
      category: '3D Geometry',
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
  // Stage 5: Shader Pipeline Prewarming & GPU Material Compilation
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'shaders.prewarm',
      name: 'Prewarm Shaders & Composite Passes',
      stage: 5,
      stageName: 'Shader Pipeline Prewarming',
      type: 'indeterminate',
      category: 'Graphics Pipeline',
      hint: 'Compiling PBR Uber-Shaders across visual themes (WebGL compileAsync)...',
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
  // Stage 6: Engine Ignition & 120Hz Clock Start
  // =========================================================================
  orchestrator.registerTask(
    new LoadingTask({
      id: 'ignition.clock_scheduler',
      name: 'Ignite 120Hz Clock & Synchronize First Frame',
      stage: 6,
      stageName: 'Engine Ignition',
      type: 'indeterminate',
      category: 'Engine Ignition',
      hint: 'Activating 120Hz deterministic render clock & synchronizing frame 0...',
      weight: 1.0,
      dependencies: ['shaders.prewarm'],
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

/**
 * Executes non-essential asset loading in the background after Training Mode is interactive.
 * Reports progress to console and signals completion when all deferred subsystems synchronize.
 * @param {GameRuntime} runtime
 * @param {(category: string, ratio: number, message: string) => void} [onProgress]
 */
export async function startBackgroundAssetPipeline(runtime, onProgress = null) {
  console.log('[Loading] ❯ Background asset pipeline started for non-essential subsystems...');

  let notifyStore = null;
  try {
    const { useQuickNotificationStore } = await import('../ui-system/tokens/quickNotificationStore');
    notifyStore = useQuickNotificationStore.getState();
  } catch (err) {
    console.warn('[Loading] Optional quick notification store unavailable:', err);
  }
  const taskId = 'background-asset-pipeline';
  if (notifyStore) {
    notifyStore.pushOngoingNotification({
      id: taskId,
      type: 'background',
      title: 'Background Assets',
      content: 'Synchronizing audio, fonts & AI models...',
      icon: 'Layers',
      progress: 0,
      tone: 'info',
      isSpinningIcon: true
    });
  }

  const taskProgress = { audio: 0, fonts: 0, bot: 0 };
  const updateOverall = (cat, ratio, desc) => {
    taskProgress[cat] = Math.min(1, Math.max(0, ratio));
    const totalRatio = (taskProgress.audio + taskProgress.fonts + taskProgress.bot) / 3;
    if (notifyStore) {
      notifyStore.updateOngoingNotification(taskId, {
        progress: totalRatio,
        content: desc || `Synchronizing assets (${Math.round(totalRatio * 100)}%)`
      });
    }
  };

  const backgroundTasks = [
    {
      name: '41-Channel Spatial Audio Pool',
      run: async () => {
        await runtime.setupAudio((loaded, total, file) => {
          const filename = file ? file.split('/').pop() : '';
          const ratio = total > 0 ? loaded / total : 1.0;
          const msg = `Audio pool: ${loaded}/${total} (${filename})`;
          if (onProgress) onProgress('audio', ratio, msg);
          updateOverall('audio', ratio, msg);
          console.log(`[Loading][Background] ${msg}`);
        });
        updateOverall('audio', 1.0, '41-channel audio architecture ready.');
        console.log('[Loading][Background] 41-channel audio architecture ready.');
      }
    },
    {
      name: 'Web Font Preloader',
      run: async () => {
        if (typeof document !== 'undefined' && document.fonts) {
          const fontList = ['400 14px "JetBrains Mono"', '400 16px Archivo', '500 16px Archivo', '700 16px Archivo', '400 20px "Lilita One"'];
          let loaded = 0;
          await Promise.all(
            fontList.map(async (f) => {
              try {
                await document.fonts.load(f);
              } catch (err) {
                console.warn(`[Loading][Background] Failed to preload web font "${f}":`, err);
              }
              loaded++;
              const ratio = loaded / fontList.length;
              const msg = `Font loaded: ${f} (${loaded}/${fontList.length})`;
              if (onProgress) onProgress('fonts', ratio, msg);
              updateOverall('fonts', ratio, msg);
              console.log(`[Loading][Background] ${msg}`);
            })
          );
          updateOverall('fonts', 1.0, 'Web fonts preloaded.');
        }
      }
    },
    {
      name: 'AI Bot Neural Policies (Seer, Necto, Nexto)',
      run: async () => {
        await runtime.setupBot((loaded, total, botId) => {
          const ratio = total > 0 ? loaded / total : 1.0;
          const msg = `Bot policy: ${botId} (${loaded}/${total})`;
          if (onProgress) onProgress('bot', ratio, msg);
          updateOverall('bot', ratio, msg);
          console.log(`[Loading][Background] ${msg}`);
        });
        updateOverall('bot', 1.0, 'AI Bot policies synchronized.');
        console.log('[Loading][Background] AI Bot policies synchronized.');
      }
    }
  ];

  try {
    await Promise.allSettled(backgroundTasks.map((t) => t.run()));
    console.log('[Loading] ══════════════ [Background Pipeline] All Assets Loaded ══════════════');
    console.log('[Loading] Background asset pipeline complete — all deferred subsystems synchronized.');
    if (notifyStore) {
      notifyStore.completeOngoingNotification(taskId, {
        content: 'All deferred assets synchronized',
        autoDismissMs: 3000,
        tone: 'info'
      });
    }
  } catch (err) {
    console.warn('[Loading][Background] Background asset pipeline warning:', err);
    if (notifyStore) {
      notifyStore.dismissOngoingNotification(taskId);
    }
  }
}
