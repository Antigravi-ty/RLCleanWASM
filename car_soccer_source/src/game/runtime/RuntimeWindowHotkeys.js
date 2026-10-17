import { useUIStore } from '../../ui-system/index';
import { floatingStore } from '../../ui-system/tokens/floatingStore';
import { NETWORK_DIAGNOSTICS_PRESET } from '../../ui-system/tokens/floatingPresets';
import { networkDiagnosticsStore } from '../../ui-system/tokens/networkDiagnosticsStore';

function isEditableFormElement(el) {
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'].includes(type);
  }
  return false;
}

function isNetworkDiagnosticsWindowPresent() {
  const windows = floatingStore.getSnapshot()?.windows || [];
  return windows.some(
    (w) => w.id === NETWORK_DIAGNOSTICS_PRESET.id || w.id === 'network-diagnostics'
  );
}

export function createRuntimeWindowKeyDownHandler(runtime) {
  return (evt) => {
    if (evt.defaultPrevented) return;

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isOutsideEditableUI =
      !isEditableFormElement(evt.target) &&
      !isEditableFormElement(activeEl);

    if (isNetworkDiagnosticsWindowPresent()) {
      // Hotkey 8: Intermittent burst packet drop toggle (when Network Diagnostics window exists)
      if (
        (evt.code === 'Digit8' || evt.code === 'Numpad8' || evt.key === '8') &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey &&
        !evt.shiftKey
      ) {
        if (isOutsideEditableUI) {
          evt.preventDefault();
          if (!runtime.networkReconciler) {
            runtime.enableNetworkPrediction(false).then(() => {
              networkDiagnosticsStore.setSession(runtime.networkReconciler, runtime.networkChannel, runtime);
              networkDiagnosticsStore.toggleBurstDrop();
            });
          } else {
            networkDiagnosticsStore.toggleBurstDrop();
          }
          return;
        }
      }

      // Hotkey 9: Simulated latency decrease (by configured adjustStepMs, default -50ms)
      if (
        (evt.code === 'Digit9' || evt.code === 'Numpad9' || evt.key === '9') &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey
      ) {
        if (isOutsideEditableUI) {
          evt.preventDefault();
          runtime.adjustSimulatedLatency(-1);
          return;
        }
      }

      // Hotkey 0: Simulated latency increase (by configured adjustStepMs, default +50ms)
      if (
        (evt.code === 'Digit0' || evt.code === 'Numpad0' || evt.key === '0') &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey
      ) {
        if (isOutsideEditableUI) {
          evt.preventDefault();
          runtime.adjustSimulatedLatency(1);
          return;
        }
      }
    }

    // Escape key: defer to GameUIRoot when modern UI store is active so ESC steps back one level at a time
    if (evt.code === 'Escape') {
      if (typeof useUIStore?.getState === 'function') {
        return;
      }
      if (isOutsideEditableUI) {
        evt.preventDefault();
        if (runtime.gameUI) {
          runtime.gameUI.openMenu('main-menu');
        }
        return;
      }
    }
  };
}
