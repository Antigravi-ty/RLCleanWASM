import {
  createLocalStorageStore,
  isPlainObject,
  clampNumberOrDefault,
  booleanOrDefault,
  filterArraySlice,
} from './storageHelpers.ts';
import {
  STORAGE_KEY_INPUT_BINDINGS,
  STORAGE_KEY_CONTROLLER_SELECTION,
  STORAGE_KEY_TOUCH_SETTINGS,
  BALL_CONTROL_MODES,
  CAMERA_LOOK_ACTIONS,
  ACTION_GROUPS,
  INPUT_ACTIONS,
  KEY_DISPLAY_NAMES,
  MOUSE_BUTTON_NAMES,
  XBOX_BUTTON_NAMES,
  PLAYSTATION_BUTTON_NAMES,
  AXIS_NAMES,
  TRIGGER_ANALOG_THRESHOLD,
  ACTIVITY_EPSILON,
  CAMERA_LOOK_DEADZONE,
} from './InputConstants.js';
import {
  createDefaultKeyboardBindings,
  createDefaultGamepadBindings,
  createDefaultInputBindings,
  areBindingsEqual,
  getBindingCategory,
  validateBinding,
  assignBinding,
  removeBinding,
  resetDeviceBindings,
  resetAxisBindings,
  formatKeyDisplayName,
  formatAxisName,
  formatAxisDirectionName,
  detectControllerType,
  formatBindingDisplayName,
  getActionLabel,
} from './inputBindingValidators.ts';

export {
  STORAGE_KEY_INPUT_BINDINGS,
  STORAGE_KEY_CONTROLLER_SELECTION,
  STORAGE_KEY_TOUCH_SETTINGS,
  BALL_CONTROL_MODES,
  CAMERA_LOOK_ACTIONS,
  ACTION_GROUPS,
  INPUT_ACTIONS,
  KEY_DISPLAY_NAMES,
  MOUSE_BUTTON_NAMES,
  XBOX_BUTTON_NAMES,
  PLAYSTATION_BUTTON_NAMES,
  AXIS_NAMES,
  TRIGGER_ANALOG_THRESHOLD,
  ACTIVITY_EPSILON,
  CAMERA_LOOK_DEADZONE,
  createDefaultKeyboardBindings,
  createDefaultGamepadBindings,
  createDefaultInputBindings,
  areBindingsEqual,
  getBindingCategory,
  validateBinding,
  assignBinding,
  removeBinding,
  resetDeviceBindings,
  resetAxisBindings,
  formatKeyDisplayName,
  formatAxisName,
  formatAxisDirectionName,
  detectControllerType,
  formatBindingDisplayName,
  getActionLabel,
};

function migrateAxisConfig(targetAxis, loadedAxis) {
  if (isPlainObject(loadedAxis)) {
    targetAxis.axis = clampNumberOrDefault(loadedAxis.axis, targetAxis.axis, { min: 0, max: 15, integer: true });
    targetAxis.invert = booleanOrDefault(loadedAxis.invert, targetAxis.invert);
  }
}

export const inputBindingsStore = createLocalStorageStore(
  STORAGE_KEY_INPUT_BINDINGS,
  createDefaultInputBindings,
  (target, loaded) => {
    const loadedAxes = loaded.axes;
    if (isPlainObject(loadedAxes)) {
      migrateAxisConfig(target.axes.steer, loadedAxes.steer);
      migrateAxisConfig(target.axes.pitch, loadedAxes.pitch);
      target.axes.deadzone = clampNumberOrDefault(loadedAxes.deadzone, target.axes.deadzone, { min: 0, max: 0.5 });
      target.axes.triggerThreshold = clampNumberOrDefault(loadedAxes.triggerThreshold, target.axes.triggerThreshold, {
        min: 0.02,
        max: 0.9,
      });
    }

    for (const dev of ['keyboard', 'pad'] ) {
      const devObj = isPlainObject(loaded[dev]) ? loaded[dev] : {};
      for (const act of INPUT_ACTIONS) {
        const slots = filterArraySlice(devObj[act.id], validateBinding, 2);
        if (slots) {
          target[dev][act.id] = slots.filter((b) => getBindingCategory(b) === dev);
        }
      }

      if (!Object.hasOwn(devObj, 'airRoll')) {
        if (dev === 'pad') {
          target[dev].airRoll = target[dev].powerslide.map((b) => ({ ...b }));
        } else {
          target[dev].airRoll = [];
        }
      }

      for (const act of [...BALL_CONTROL_MODES, ...CAMERA_LOOK_ACTIONS]) {
        if (!Array.isArray(devObj[act])) {
          target[dev][act] = target[dev][act].filter(
            (b) =>
              !(
                b.kind === 'padAxis' &&
                CAMERA_LOOK_ACTIONS.includes(act) &&
                (b.axis === target.axes.steer.axis || b.axis === target.axes.pitch.axis)
              ) &&
              !INPUT_ACTIONS.some(
                (other) =>
                  other.id !== act &&
                  Array.isArray(devObj[other.id]) &&
                  target[dev][other.id].some((o) => areBindingsEqual(b, o))
              )
          );
        }
      }
    }
  }
);

export function loadInputBindings() {
  return inputBindingsStore.load();
}

export function saveInputBindings(bindings) {
  inputBindingsStore.save(bindings);
}

export const controllerSelectionStore = createLocalStorageStore(
  STORAGE_KEY_CONTROLLER_SELECTION,
  () => ({ id: null, index: null }),
  (target, loaded) => {
    if (typeof loaded.id === 'string' && loaded.id.length > 0) target.id = loaded.id;
    if (typeof loaded.index === 'number' && Number.isFinite(loaded.index) && loaded.index >= 0) {
      target.index = clampNumberOrDefault(loaded.index, 0, { min: 0, integer: true });
    }
  }
);

let cachedSelectedController;
export const ignoredControllerIndices = new Set();

export function getConnectedGamepads() {
  try {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return navigator.getGamepads() ?? [];
  } catch (err) {
    console.warn('[InputBindings] Failed to query gamepads via navigator.getGamepads:', err);
    return [];
  }
}

export function getSelectedController() {
  if (!cachedSelectedController) {
    cachedSelectedController = controllerSelectionStore.load();
  }
  return { ...cachedSelectedController };
}

export function setSelectedController(controller) {
  const prev = getSelectedController();
  const next = controller ? { id: controller.id, index: controller.index } : { id: null, index: null };

  if (!(prev.id === next.id && prev.index === next.index)) {
    cachedSelectedController = next;
    ignoredControllerIndices.clear();
    if (controller) {
      for (const gp of getConnectedGamepads()) {
        if (gp && gp.connected && gp.id === controller.id && gp.index !== controller.index) {
          ignoredControllerIndices.add(gp.index);
        }
      }
    }
    controllerSelectionStore.save(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('controllerselectionchanged'));
    }
  }
}

export function getEffectiveGamepad() {
  const sel = getSelectedController();
  const pads = getConnectedGamepads().filter((g) => !!(g && g.connected));
  if (sel.id === null) {
    return pads.find((g) => g.mapping === 'standard') ?? pads[0] ?? null;
  }
  const matchingId = pads.filter((g) => g.id === sel.id);
  const exact = matchingId.find((g) => g.index === sel.index);
  if (exact) {
    for (const g of matchingId) {
      if (g.index !== exact.index) ignoredControllerIndices.add(g.index);
    }
    return exact;
  }
  const available = matchingId.filter((g) => !ignoredControllerIndices.has(g.index));
  if (available.length !== 1) return null;
  const single = available[0];
  cachedSelectedController = { id: single.id, index: single.index };
  controllerSelectionStore.save(cachedSelectedController);
  return single;
}
