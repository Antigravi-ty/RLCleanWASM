/**
 * DevTestLabReplayHelper.js
 * Bench 3 (State Replay Recording, Scrubbing & Hotkeys O / P / [ / ]) helper for DeveloperTestLabMode.
 */

import { useDevTestLabStore } from '../../ui-system/tokens/devTestLabStore';
import { useUIStore } from '../../ui-system/index';

export const MAX_TAS_FRAMES = 18000; // 150 seconds @ 120Hz

export function bindDevTestLabReplayHotkeys(mode) {
  if (typeof window === 'undefined') return;
  unbindDevTestLabReplayHotkeys(mode);

  mode._keyDownHandler = (evt) => {
    if (mode.runtime?.match?.state?.mode !== 'dev-test-lab') return;
    if (useUIStore.getState().isOpen) return;
    const tag = evt.target?.tagName?.toUpperCase?.() || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const noMods = !evt.ctrlKey && !evt.shiftKey && !evt.altKey && !evt.metaKey;
    if ((evt.code === 'KeyO' || evt.key === 'o' || evt.key === 'O') && noMods) {
      if (!evt.repeat) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        useDevTestLabStore.getState().setActiveTab('tas-replay');
        mode.startTasRecording();
      }
      return;
    }

    if ((evt.code === 'KeyP' || evt.key === 'p' || evt.key === 'P') && noMods) {
      if (!evt.repeat) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        mode.stopTasRecording();
      }
      return;
    }

    if (evt.code === 'BracketLeft' || evt.key === '[') {
      if (useDevTestLabStore.getState().activeTab !== 'tas-replay') return;
      evt.preventDefault();
      if (!evt.repeat) mode.beginTasScrub('rewinding');
      return;
    }

    if (evt.code === 'BracketRight' || evt.key === ']') {
      if (useDevTestLabStore.getState().activeTab !== 'tas-replay') return;
      evt.preventDefault();
      if (!evt.repeat) mode.beginTasScrub('forwarding');
    }
  };

  mode._keyUpHandler = (evt) => {
    if (mode.runtime?.match?.state?.mode !== 'dev-test-lab') return;
    if (evt.code === 'BracketLeft' || evt.key === '[' || evt.code === 'BracketRight' || evt.key === ']') {
      if (useDevTestLabStore.getState().activeTab !== 'tas-replay') return;
      evt.preventDefault();
      mode.pauseTasScrub();
    }
  };

  window.addEventListener('keydown', mode._keyDownHandler, true);
  window.addEventListener('keyup', mode._keyUpHandler, true);
}

export function unbindDevTestLabReplayHotkeys(mode) {
  if (typeof window === 'undefined') return;
  if (mode._keyDownHandler) {
    window.removeEventListener('keydown', mode._keyDownHandler, true);
    mode._keyDownHandler = null;
  }
  if (mode._keyUpHandler) {
    window.removeEventListener('keyup', mode._keyUpHandler, true);
    mode._keyUpHandler = null;
  }
}

export function applyTasFrameAtCursor(mode) {
  const r = mode.runtime;
  if (!r?.physics || mode.tasFrames.length === 0) return;
  const idx = Math.max(0, Math.min(mode.tasFrames.length - 1, Math.floor(mode.tasCursor)));
  const entry = mode.tasFrames[idx];
  if (!entry) return;

  if (entry.arenaSnap) {
    r.physics.restoreState(entry.arenaSnap);
  } else if (entry.renderState) {
    r.physics.state.set(entry.renderState);
  }
  if (r.interpolator) {
    r.interpolator.prevState.set(r.physics.state);
    r.interpolator.currState.set(r.physics.state);
    r.interpolator.alpha = 0;
  }
}

export function recordTasFrameAfterTick(mode, store) {
  const r = mode.runtime;
  if (store.activeTab !== 'tas-replay' || store.tasState !== 'recording' || !r?.physics) return;
  if (mode.tasFrames.length < MAX_TAS_FRAMES) {
    mode.tasFrames.push({
      arenaSnap: r.physics.saveState(),
      renderState: r.physics.state.slice(),
      controls: { ...r.playerControls },
    });
    r.physics.recordReplayFrame?.();
    mode.tasCursor = mode.tasFrames.length - 1;
    if (mode.tasFrames.length % 6 === 0) {
      store.updateLiveTelemetry({
        tasRecordedFrames: mode.tasFrames.length,
        tasCursorFrame: mode.tasCursor,
      });
    }
  } else {
    mode.stopTasRecording();
  }
}
