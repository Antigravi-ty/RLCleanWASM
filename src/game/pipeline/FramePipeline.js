import { FrameContext } from './FrameContext.js';

/**
 * FramePipeline.js
 * High-performance 120Hz deterministic execution pipeline.
 * Executes decoupled pipeline stages sequentially with zero garbage generation.
 */
export class FramePipeline {
  /**
   * @param {object} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    this.context = new FrameContext(runtime);
    this.stages = [];
  }

  /**
   * Register a new stage in the execution order
   * @param {{ name: string, execute: (context: FrameContext) => void }} stage
   * @returns {this}
   */
  addStage(stage) {
    this.stages.push(stage);
    return this;
  }

  /**
   * Advance one full 120Hz frame through the registered pipeline stages.
   * @param {number} timestamp
   */
  execute(timestamp) {
    const r = this.runtime;
    if (r.profiler) r.profiler.frameStart();

    const dt = Math.min((timestamp - r.lastTimestamp) / 1000, 0.1);
    r.lastTimestamp = timestamp;

    this.context.reset(timestamp, dt);

    for (let i = 0; i < this.stages.length; i++) {
      this.stages[i].execute(this.context);
    }

    return !this.context.shouldSkipGpuRender;
  }
}
