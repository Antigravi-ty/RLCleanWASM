/**
 * src/loader/LoadingOrchestrator.js
 * Central Task Tracker & Loading Pipeline Orchestrator.
 *
 * Responsibilities:
 * 1. Coordinates asynchronous and synchronous task execution graphs.
 * 2. Bridges "Download First, Parse/Load Later" stages across decoupled modules.
 * 3. Aggregates determinate weighted progress (0..100%, step X/Y) across all stages.
 * 4. Dispatches standardized progress snapshots to observers (Console, UI Progress Bar).
 * 5. Provides shared in-memory data store for passing assets between pipeline stages.
 */

import { TaskStatus, LOADING_STAGES, getStageMeta } from './types.js';
import { LoadingTask } from './LoadingTask.js';
import { StreamDownloadTracker } from './StreamDownloadTracker.js';

export class LoadingOrchestrator {
  constructor(options = {}) {
    this.options = options;
    this.tasks = [];
    this.taskMap = new Map();
    this.observers = new Set();
    this.sharedData = new Map();
    this.downloadTracker = new StreamDownloadTracker(update => this._handleDownloadProgress(update));

    this.currentStep = 0;
    this.totalSteps = 0;
    this.currentStageIndex = 1;
    this.overallRatio = 0.0;
    this.activeTask = null;
    this.isRunning = false;
    this.isCompleted = false;
    this.startTime = 0;
  }

  /**
   * Registers a task into the pipeline.
   * @param {LoadingTask|object} taskConfig
   * @returns {LoadingTask}
   */
  registerTask(taskConfig) {
    const task = taskConfig instanceof LoadingTask ? taskConfig : new LoadingTask(taskConfig);
    if (this.taskMap.has(task.id)) {
      throw new Error(`[LoadingOrchestrator] Duplicate task id: "${task.id}"`);
    }
    this.tasks.push(task);
    this.taskMap.set(task.id, task);
    this.totalSteps = this.tasks.length;
    return task;
  }

  /**
   * Retrieves a task by its unique ID.
   * @param {string} id
   * @returns {LoadingTask|undefined}
   */
  getTask(id) {
    return this.taskMap.get(id);
  }

  /**
   * Subscribes an observer to receive loading lifecycle events.
   * @param {object} observer
   * @returns {() => void} Unsubscribe function
   */
  subscribe(observer) {
    if (observer && typeof observer === 'object') {
      this.observers.add(observer);
    }
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Shared memory store for pipeline stages.
   * Allows pre-downloaded ArrayBuffers or configs to be shared with downstream initializers.
   */
  getShared(key) {
    return this.sharedData.get(key);
  }

  setShared(key, value) {
    this.sharedData.set(key, value);
    return value;
  }

  hasShared(key) {
    return this.sharedData.has(key);
  }

  /**
   * Calculates overall weighted determinate progress in [0.0, 1.0].
   * @returns {number}
   */
  calculateOverallProgress() {
    let accumulated = 0.0;
    const stageGroups = this._groupTasksByStage();

    for (const stageMeta of LOADING_STAGES) {
      const stageTasks = stageGroups.get(stageMeta.index) || [];
      if (stageTasks.length === 0) continue;

      const totalStageTaskWeight = stageTasks.reduce((acc, t) => acc + t.weight, 0);
      let stageCompletedWeight = 0;

      for (const task of stageTasks) {
        if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.SKIPPED) {
          stageCompletedWeight += task.weight;
        } else if (task.status === TaskStatus.RUNNING) {
          stageCompletedWeight += task.weight * task.progress;
        }
      }

      const stageRatio = totalStageTaskWeight > 0 ? (stageCompletedWeight / totalStageTaskWeight) : 0;
      accumulated += stageMeta.weight * stageRatio;
    }

    this.overallRatio = Math.max(0.0, Math.min(1.0, accumulated));
    return this.overallRatio;
  }

  /**
   * Executes the complete loading pipeline stage by stage.
   * @returns {Promise<LoadingOrchestrator>}
   */
  async run() {
    if (this.isRunning) {
      throw new Error('[LoadingOrchestrator] Pipeline is already running.');
    }
    this.isRunning = true;
    this.startTime = performance.now();
    this.totalSteps = this.tasks.length;
    this.currentStep = 0;

    const stageGroups = this._groupTasksByStage();
    const sortedStages = Array.from(stageGroups.keys()).sort((a, b) => a - b);

    try {
      for (const stageIndex of sortedStages) {
        this.currentStageIndex = stageIndex;
        const stageMeta = getStageMeta(stageIndex);
        const stageTasks = stageGroups.get(stageIndex) || [];

        this._emitStageChange({
          stageIndex,
          totalStages: LOADING_STAGES.length,
          stageTitle: stageMeta.title,
          stageDescription: stageMeta.description
        });

        // Execute tasks in this stage according to their dependencies
        await this._executeStageTasks(stageTasks);
      }

      this.isCompleted = true;
      this.isRunning = false;
      this.overallRatio = 1.0;
      const totalDurationMs = performance.now() - this.startTime;

      this._emitComplete({
        totalDurationMs,
        totalSteps: this.totalSteps
      });

      return this;
    } catch (err) {
      this.isRunning = false;
      throw err;
    }
  }

  /**
   * Internal execution of all tasks within a single stage.
   * Resolves internal dependency chains, executing independent tasks concurrently.
   * @param {LoadingTask[]} tasks
   */
  async _executeStageTasks(tasks) {
    const pending = new Set(tasks);
    const completedInStage = new Set();

    while (pending.size > 0) {
      // Find tasks whose dependencies are satisfied
      const readyTasks = Array.from(pending).filter(task => {
        return task.dependencies.every(depId => {
          const depTask = this.taskMap.get(depId);
          return depTask && (depTask.status === TaskStatus.COMPLETED || depTask.status === TaskStatus.SKIPPED);
        });
      });

      if (readyTasks.length === 0) {
        // Dependency cycle or unfulfilled external dependency
        const unresolved = Array.from(pending).map(t => `${t.id} -> [${t.dependencies.join(', ')}]`);
        throw new Error(`[LoadingOrchestrator] Unresolved task dependencies in Stage ${this.currentStageIndex}: ${unresolved.join('; ')}`);
      }

      // Execute ready tasks in parallel
      await Promise.all(
        readyTasks.map(async task => {
          pending.delete(task);
          this.currentStep++;
          this.activeTask = task;

          const stepInfo = {
            taskId: task.id,
            taskName: task.name,
            step: this.currentStep,
            totalSteps: this.totalSteps,
            stageIndex: this.currentStageIndex,
            totalStages: LOADING_STAGES.length,
            overallPercent: this.calculateOverallProgress() * 100
          };

          this._emitTaskStart(stepInfo);

          const context = {
            downloadTracker: this.downloadTracker,
            getShared: key => this.getShared(key),
            setShared: (key, val) => this.setShared(key, val),
            hasShared: key => this.hasShared(key),
            reportTaskProgress: (taskId, progress, detail) => {
              this._handleTaskProgress(taskId, progress, detail);
            }
          };

          try {
            await task.execute(context);
            completedInStage.add(task.id);

            const completeInfo = {
              ...stepInfo,
              overallPercent: this.calculateOverallProgress() * 100,
              durationMs: task.durationMs,
              status: task.status
            };
            this._emitTaskComplete(completeInfo);
          } catch (err) {
            this._emitError({
              taskId: task.id,
              taskName: task.name,
              error: err,
              isCritical: task.critical
            });
            if (task.critical) {
              throw err;
            }
          }
        })
      );
    }
  }

  _groupTasksByStage() {
    const map = new Map();
    for (const task of this.tasks) {
      if (!map.has(task.stage)) {
        map.set(task.stage, []);
      }
      map.get(task.stage).push(task);
    }
    return map;
  }

  _handleTaskProgress(taskId, taskProgress, detail) {
    const task = this.taskMap.get(taskId);
    if (!task) return;

    const overallPercent = this.calculateOverallProgress() * 100;

    const progressEvent = {
      taskId: task.id,
      taskName: task.name,
      step: this.currentStep,
      totalSteps: this.totalSteps,
      stageIndex: this.currentStageIndex,
      totalStages: LOADING_STAGES.length,
      taskProgress,
      detail,
      overallPercent,
      bytes: {
        loadedBytes: this.downloadTracker.loadedBytes,
        totalBytes: this.downloadTracker.totalBytes
      }
    };

    for (const obs of this.observers) {
      if (typeof obs.onTaskProgress === 'function') {
        obs.onTaskProgress(progressEvent);
      }
      if (typeof obs.onOverallProgress === 'function') {
        obs.onOverallProgress({
          overallRatio: this.overallRatio,
          currentStep: this.currentStep,
          totalSteps: this.totalSteps,
          activeTaskName: task.name,
          stageTitle: getStageMeta(this.currentStageIndex).title
        });
      }
    }
  }

  _handleDownloadProgress(streamUpdate) {
    for (const obs of this.observers) {
      if (typeof obs.onByteStreamProgress === 'function') {
        obs.onByteStreamProgress(streamUpdate);
      }
    }
  }

  _emitStageChange(data) {
    for (const obs of this.observers) {
      if (typeof obs.onStageChange === 'function') {
        obs.onStageChange(data);
      }
    }
  }

  _emitTaskStart(data) {
    for (const obs of this.observers) {
      if (typeof obs.onTaskStart === 'function') {
        obs.onTaskStart(data);
      }
    }
  }

  _emitTaskComplete(data) {
    for (const obs of this.observers) {
      if (typeof obs.onTaskComplete === 'function') {
        obs.onTaskComplete(data);
      }
    }
  }

  _emitError(data) {
    for (const obs of this.observers) {
      if (typeof obs.onError === 'function') {
        obs.onError(data);
      }
    }
  }

  _emitComplete(data) {
    for (const obs of this.observers) {
      if (typeof obs.onComplete === 'function') {
        obs.onComplete(data);
      }
    }
  }
}
