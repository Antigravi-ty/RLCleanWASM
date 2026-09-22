/**
 * src/loader/ConsoleProgressObserver.js
 * Developer-friendly structured console logger for the Loading Pipeline.
 *
 * Formats:
 * [Loading][Stage 3/7][Step 8/26][34.5%] Physics & Arena Mesh: Streaming RocketSim WASM (1.2 MB / 8.4 MB)
 */

export class ConsoleProgressObserver {
  constructor(options = {}) {
    this.prefix = options.prefix || '[Loading]';
    this.minIntervalMs = options.minIntervalMs ?? 120;
    this.lastLogTime = 0;
    this.lastLoggedPercent = -1;
  }

  onStageChange({ stageIndex, totalStages, stageTitle, stageDescription }) {
    console.log(
      `${this.prefix} ══════════════ [Stage ${stageIndex}/${totalStages}] ${stageTitle} ══════════════\n` +
      `${this.prefix} ${stageDescription}`
    );
  }

  onTaskStart({ taskId, taskName, step, totalSteps, stageIndex, totalStages, overallPercent }) {
    console.log(
      `${this.prefix}[Stage ${stageIndex}/${totalStages}][Step ${step}/${totalSteps}][${overallPercent.toFixed(1)}%] ❯ Started: ${taskName}`
    );
  }

  onTaskProgress({ taskId, taskName, step, totalSteps, stageIndex, totalStages, overallPercent, taskProgress, detail, bytes }) {
    const now = performance.now();
    const currentPct = Math.floor(overallPercent);

    // Throttle progress logs to avoid console spam while keeping real-time responsiveness
    if (now - this.lastLogTime < this.minIntervalMs && currentPct === this.lastLoggedPercent) {
      return;
    }
    this.lastLogTime = now;
    this.lastLoggedPercent = currentPct;

    let extra = '';
    if (bytes && bytes.totalBytes > 0) {
      const loadedMB = (bytes.loadedBytes / (1024 * 1024)).toFixed(2);
      const totalMB = (bytes.totalBytes / (1024 * 1024)).toFixed(2);
      extra = ` (${loadedMB} MB / ${totalMB} MB)`;
    } else if (detail) {
      extra = ` (${detail})`;
    }

    console.log(
      `${this.prefix}[Stage ${stageIndex}/${totalStages}][Step ${step}/${totalSteps}][${overallPercent.toFixed(1)}%]   ↳ ${taskName}: ${(taskProgress * 100).toFixed(0)}%${extra}`
    );
  }

  onTaskComplete({ taskId, taskName, step, totalSteps, stageIndex, totalStages, overallPercent, durationMs, status }) {
    const dur = durationMs ? `${durationMs.toFixed(0)}ms` : '';
    const statusMark = status === 'skipped' ? '⚠️ Skipped' : '✔ Done';
    console.log(
      `${this.prefix}[Stage ${stageIndex}/${totalStages}][Step ${step}/${totalSteps}][${overallPercent.toFixed(1)}%] ${statusMark}: ${taskName} ${dur ? `(${dur})` : ''}`
    );
  }

  onError({ taskId, taskName, error, isCritical }) {
    if (isCritical) {
      console.error(
        `${this.prefix} 🛑 FATAL ERROR in "${taskName}" (${taskId}):`,
        error
      );
    } else {
      console.warn(
        `${this.prefix} ⚠️ Non-fatal issue in "${taskName}" (${taskId}), continuing with fallback:`,
        error?.message || error
      );
    }
  }

  onComplete({ totalDurationMs, totalSteps }) {
    console.log(
      `${this.prefix} 🚀 All ${totalSteps} loading steps complete in ${(totalDurationMs / 1000).toFixed(2)}s. Launching game!`
    );
  }
}
