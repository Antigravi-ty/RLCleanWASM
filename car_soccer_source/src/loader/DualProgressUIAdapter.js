/**
 * src/loader/DualProgressUIAdapter.js
 * Bridges LoadingOrchestrator events to DOM-based loading overlays and future UI progress bars.
 *
 * Designed to conform with Apple Human Interface Guidelines (HIG) Determinate Progress specs:
 * 1. Stage Progress (Top indicator): Reflects game lifecycle milestones (0% -> 100%).
 * 2. Asset Stream Progress (Bottom indicator): Tracks real-time network bytes or subtask progress.
 * 3. Future UI Hook: External custom UI widgets can attach via registerCustomUI().
 */

export class DualProgressUIAdapter {
  /**
   * @param {HTMLElement} [container] Host DOM container (#app)
   */
  constructor(container = null) {
    this.container = container || (typeof document !== 'undefined' ? document.querySelector('#app') : null);
    this.customUI = null;
    this.stageRatio = 0.0;
    this.byteRatio = 0.0;
    this.displayStageRatio = 0.0;
    this.displayByteRatio = 0.0;
    this.animFrame = null;
  }

  /**
   * Allows future custom UI modules to register and receive structured progress events.
   * @param {object} customUI Custom UI progress bar component
   */
  registerCustomUI(customUI) {
    this.customUI = customUI;
  }

  onStageChange({ stageIndex, totalStages, stageTitle, stageDescription }) {
    if (this.customUI?.onStageChange) {
      this.customUI.onStageChange({ stageIndex, totalStages, stageTitle, stageDescription });
    }

    if (typeof document === 'undefined') return;
    const labelEl = document.querySelector('#loading .load__label, #hig-stage-title');
    const noteEl = document.querySelector('#loading .load__note, #hig-stage-desc');
    if (labelEl) labelEl.textContent = stageTitle;
    if (noteEl) noteEl.textContent = stageDescription;
  }

  onTaskStart({ taskId, taskName, step, totalSteps, stageIndex, totalStages, overallPercent }) {
    if (this.customUI?.onTaskStart) {
      this.customUI.onTaskStart({ taskId, taskName, step, totalSteps, stageIndex, totalStages, overallPercent });
    }

    if (typeof document === 'undefined') return;
    const noteEl = document.querySelector('#loading .load__note, #hig-stage-desc');
    if (noteEl) {
      noteEl.textContent = `[${step}/${totalSteps}] ${taskName}...`;
    }
  }

  onTaskProgress({ taskId, taskName, step, totalSteps, stageIndex, totalStages, overallPercent, taskProgress, detail, bytes }) {
    this.stageRatio = overallPercent / 100;

    if (this.customUI?.onProgress) {
      this.customUI.onProgress({
        taskId,
        taskName,
        step,
        totalSteps,
        overallPercent,
        taskProgress,
        detail,
        bytes
      });
    }

    if (typeof document === 'undefined') return;
    const fillEl = document.querySelector('#hig-stage-fill, #loading .load__rule');
    const pctEl = document.querySelector('#hig-stage-percent');
    if (fillEl) {
      fillEl.style.width = `${Math.min(100, Math.max(0, overallPercent)).toFixed(1)}%`;
    }
    if (pctEl) {
      pctEl.textContent = `${Math.round(overallPercent)}%`;
    }
    if (detail) {
      const streamInfo = document.querySelector('#hig-detail-stream');
      if (streamInfo) streamInfo.textContent = detail;
    }
  }

  onByteStreamProgress({ overallRatio, loadedBytes, totalBytes, activeUrl, currentLoaded, currentTotal }) {
    this.byteRatio = overallRatio;

    if (this.customUI?.onByteStream) {
      this.customUI.onByteStream({ overallRatio, loadedBytes, totalBytes, activeUrl, currentLoaded, currentTotal });
    }

    if (typeof document === 'undefined') return;
    const byteFill = document.querySelector('#hig-byte-fill');
    const bytePct = document.querySelector('#hig-byte-percent');
    const streamInfo = document.querySelector('#hig-detail-stream');

    if (byteFill) {
      byteFill.style.width = `${(overallRatio * 100).toFixed(1)}%`;
    }
    if (bytePct) {
      bytePct.textContent = `${Math.round(overallRatio * 100)}%`;
    }
    if (streamInfo && totalBytes > 0) {
      const loadedMB = (loadedBytes / (1024 * 1024)).toFixed(2);
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
      const filename = activeUrl ? activeUrl.split('/').pop() : '';
      streamInfo.textContent = `Streaming ${filename} (${loadedMB} MB / ${totalMB} MB)`;
    }
  }

  onTaskComplete(data) {
    if (this.customUI?.onTaskComplete) {
      this.customUI.onTaskComplete(data);
    }
  }

  onError(data) {
    if (this.customUI?.onError) {
      this.customUI.onError(data);
    }
  }

  onComplete(data) {
    if (this.customUI?.onComplete) {
      this.customUI.onComplete(data);
    }

    if (typeof document === 'undefined') return;
    const overlay = document.querySelector('#loading, #loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.35s ease';
      setTimeout(() => overlay.remove(), 350);
    }
  }
}
