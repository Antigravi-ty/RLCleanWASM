import {
  createLocalStorageStore,
  isPlainObject,
  clampNumberOrDefault,
  booleanOrDefault,
  filterArraySlice,
} from '../core/configStorageHydrators.ts';

export const STORAGE_KEY_INPUT_BINDINGS = 'car-soccer.input-bindings.v1';
export const STORAGE_KEY_CONTROLLER_SELECTION = 'car-soccer.controller.v1';
export const STORAGE_KEY_TOUCH_SETTINGS = 'car-soccer.touch-settings.v1';

export const BALL_CONTROL_MODES = Object.freeze([
  'takePossession',
  'startDribble',
  'passBall',
  'launchBall',
]);

export const CAMERA_LOOK_ACTIONS = Object.freeze([
  'cameraLeft',
  'cameraRight',
  'cameraUp',
  'cameraDown',
]);

export const ACTION_GROUPS = Object.freeze([
  'Driving',
  'Aerial',
  'Camera',
  'Ball Control',
  'Session',
]);

export interface InputActionMetadata {
  id: string;
  label: string;
  group: string;
  analog: boolean;
  note: string;
}

export const INPUT_ACTIONS: ReadonlyArray<InputActionMetadata> = Object.freeze([
  {
    id: 'throttleForward',
    label: 'Throttle',
    group: 'Driving',
    analog: true,
    note: 'Drives forward. On keyboard, also noses down in the air.',
  },
  {
    id: 'throttleReverse',
    label: 'Reverse',
    group: 'Driving',
    analog: true,
    note: 'Drives backward. On keyboard, also noses up in the air.',
  },
  {
    id: 'steerLeft',
    label: 'Steer Left',
    group: 'Driving',
    analog: false,
    note: 'Adds to the steering axis. Yaws in the air unless a roll is held.',
  },
  {
    id: 'steerRight',
    label: 'Steer Right',
    group: 'Driving',
    analog: false,
    note: 'Adds to the steering axis. Yaws in the air unless a roll is held.',
  },
  {
    id: 'boost',
    label: 'Boost',
    group: 'Driving',
    analog: false,
    note: 'Burns boost for thrust.',
  },
  {
    id: 'jump',
    label: 'Jump',
    group: 'Driving',
    analog: false,
    note: 'Jumps, flips, and dodges.',
  },
  {
    id: 'powerslide',
    label: 'Powerslide',
    group: 'Driving',
    analog: true,
    note: 'Slides on the ground. Bind Free Air Roll separately to roll in the air.',
  },
  {
    id: 'airRoll',
    label: 'Free Air Roll',
    group: 'Aerial',
    analog: true,
    note: 'Hold to roll with the steering inputs in the air, without powersliding.',
  },
  {
    id: 'airRollLeft',
    label: 'Air Roll Left',
    group: 'Aerial',
    analog: false,
    note: 'Rolls left at a fixed rate while held.',
  },
  {
    id: 'airRollRight',
    label: 'Air Roll Right',
    group: 'Aerial',
    analog: false,
    note: 'Rolls right at a fixed rate while held.',
  },
  {
    id: 'ballCam',
    label: 'Ball Cam',
    group: 'Camera',
    analog: false,
    note: 'Toggles between ball cam and car cam.',
  },
  {
    id: 'rearView',
    label: 'Rear View',
    group: 'Camera',
    analog: false,
    note: 'Looks behind vehicle while held.',
  },
  {
    id: 'cameraLeft',
    label: 'Look Left',
    group: 'Camera',
    analog: true,
    note: 'Looks left while held. Release to return to the follow camera.',
  },
  {
    id: 'cameraRight',
    label: 'Look Right',
    group: 'Camera',
    analog: true,
    note: 'Looks right while held. Release to return to the follow camera.',
  },
  {
    id: 'cameraUp',
    label: 'Look Up',
    group: 'Camera',
    analog: true,
    note: 'Looks upward while held. Release to return to the follow camera.',
  },
  {
    id: 'cameraDown',
    label: 'Look Down',
    group: 'Camera',
    analog: true,
    note: 'Looks downward while held. Release to return to the follow camera.',
  },
  {
    id: 'resetShot',
    label: 'Reset Shot',
    group: 'Session',
    analog: false,
    note: 'Returns car and ball to kickoff.',
  },
  {
    id: 'takePossession',
    label: 'Take Possession',
    group: 'Ball Control',
    analog: false,
    note: 'Places the ball just ahead of your car, matching your velocity.',
  },
  {
    id: 'startDribble',
    label: 'Start Dribble',
    group: 'Ball Control',
    analog: false,
    note: 'Places the ball on your hood, matching your velocity.',
  },
  {
    id: 'passBall',
    label: 'Pass Ball',
    group: 'Ball Control',
    analog: false,
    note: 'Sends the ball toward your car from its current position.',
  },
  {
    id: 'launchBall',
    label: 'Launch Ball',
    group: 'Ball Control',
    analog: false,
    note: 'Pops the ball straight upward from its current position.',
  },
  {
    id: 'toggleSettings',
    label: 'Menu / Cursor',
    group: 'Session',
    analog: false,
    note: 'Browser keys/mouse: show the cursor or return to play. Controller: open settings.',
  },
]);

export const KEY_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  Space: 'Space',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  CapsLock: 'Caps',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
});

export const MOUSE_BUTTON_NAMES: Readonly<Record<number, string>> = Object.freeze({
  0: 'L Mouse',
  1: 'M Mouse',
  2: 'R Mouse',
  3: 'Mouse 4',
  4: 'Mouse 5',
});

export const XBOX_BUTTON_NAMES: ReadonlyArray<string> = Object.freeze([
  'A', 'B', 'X', 'Y',
  'LB', 'RB', 'LT', 'RT',
  'View', 'Menu',
  'L Stick', 'R Stick',
  'D-Up', 'D-Down', 'D-Left', 'D-Right',
  'Guide',
]);

export const PLAYSTATION_BUTTON_NAMES: ReadonlyArray<string> = Object.freeze([
  'Cross', 'Circle', 'Square', 'Triangle',
  'L1', 'R1', 'L2', 'R2',
  'Share', 'Options',
  'L3', 'R3',
  'D-Up', 'D-Down', 'D-Left', 'D-Right',
  'PS',
]);

export const AXIS_NAMES: ReadonlyArray<string> = Object.freeze([
  'L Stick X',
  'L Stick Y',
  'R Stick X',
  'R Stick Y',
]);

export const TRIGGER_ANALOG_THRESHOLD = 0.5;
export const ACTIVITY_EPSILON = 0.05;
export const CAMERA_LOOK_DEADZONE = 0.3;

export function createDefaultKeyboardBindings(): Record<string, any[]> {
  return {
    throttleForward: [{ kind: 'key', code: 'KeyW' }],
    throttleReverse: [{ kind: 'key', code: 'KeyS' }],
    steerLeft: [{ kind: 'key', code: 'KeyA' }],
    steerRight: [{ kind: 'key', code: 'KeyD' }],
    boost: [
      { kind: 'mouse', button: 0 },
      { kind: 'key', code: 'Period' },
    ],
    jump: [
      { kind: 'mouse', button: 2 },
      { kind: 'key', code: 'Slash' },
    ],
    powerslide: [
      { kind: 'key', code: 'ShiftLeft' },
      { kind: 'key', code: 'ShiftRight' },
    ],
    airRoll: [],
    airRollLeft: [{ kind: 'key', code: 'KeyQ' }],
    airRollRight: [{ kind: 'key', code: 'KeyE' }],
    ballCam: [{ kind: 'key', code: 'Space' }],
    rearView: [
      { kind: 'mouse', button: 1 },
      { kind: 'key', code: 'KeyR' },
    ],
    cameraLeft: [{ kind: 'key', code: 'KeyZ' }],
    cameraRight: [{ kind: 'key', code: 'KeyC' }],
    cameraUp: [],
    cameraDown: [],
    takePossession: [{ kind: 'key', code: 'Digit1' }],
    startDribble: [{ kind: 'key', code: 'Digit2' }],
    passBall: [{ kind: 'key', code: 'Digit3' }],
    launchBall: [{ kind: 'key', code: 'Digit4' }],
    resetShot: [{ kind: 'key', code: 'Backspace' }],
    toggleSettings: [{ kind: 'key', code: 'Escape' }],
  };
}

export function createDefaultGamepadBindings(): Record<string, any[]> {
  return {
    throttleForward: [{ kind: 'padButton', index: 7 }],
    throttleReverse: [{ kind: 'padAxis', axis: 1, dir: 1 }],
    steerLeft: [],
    steerRight: [],
    boost: [{ kind: 'padButton', index: 5 }],
    jump: [{ kind: 'padButton', index: 2 }],
    powerslide: [{ kind: 'padButton', index: 6 }],
    airRoll: [{ kind: 'padButton', index: 6 }],
    airRollLeft: [{ kind: 'padButton', index: 0 }],
    airRollRight: [],
    ballCam: [{ kind: 'padButton', index: 3 }],
    rearView: [],
    cameraLeft: [{ kind: 'padAxis', axis: 2, dir: -1 }],
    cameraRight: [{ kind: 'padAxis', axis: 2, dir: 1 }],
    cameraUp: [{ kind: 'padAxis', axis: 3, dir: -1 }],
    cameraDown: [{ kind: 'padAxis', axis: 3, dir: 1 }],
    takePossession: [{ kind: 'padButton', index: 13 }],
    startDribble: [{ kind: 'padButton', index: 12 }],
    passBall: [{ kind: 'padButton', index: 14 }],
    launchBall: [{ kind: 'padButton', index: 15 }],
    resetShot: [
      { kind: 'padButton', index: 11 },
      { kind: 'padButton', index: 8 },
    ],
    toggleSettings: [{ kind: 'padButton', index: 9 }],
  };
}

export function createDefaultInputBindings(): Record<string, any> {
  return {
    keyboard: createDefaultKeyboardBindings(),
    pad: createDefaultGamepadBindings(),
    axes: {
      steer: { axis: 0, invert: false },
      pitch: { axis: 1, invert: false },
      deadzone: 0.12,
      triggerThreshold: 0.15,
    },
  };
}

export function areBindingsEqual(a: any, b: any): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'key' && b.kind === 'key') return a.code === b.code;
  if (a.kind === 'mouse' && b.kind === 'mouse') return a.button === b.button;
  if (a.kind === 'padButton' && b.kind === 'padButton') return a.index === b.index;
  if (a.kind === 'padAxis' && b.kind === 'padAxis') return a.axis === b.axis && a.dir === b.dir;
  return false;
}

export function getBindingCategory(binding: { kind: string }): 'keyboard' | 'pad' {
  return binding.kind === 'key' || binding.kind === 'mouse' ? 'keyboard' : 'pad';
}

export function validateBinding(b: any): boolean {
  if (!isPlainObject(b)) return false;
  switch (b.kind) {
    case 'key':
      return typeof b.code === 'string' && b.code.length > 0;
    case 'mouse':
      return Number.isInteger(b.button) && b.button >= 0;
    case 'padButton':
      return Number.isInteger(b.index) && b.index >= 0;
    case 'padAxis':
      return Number.isInteger(b.axis) && b.axis >= 0 && (b.dir === 1 || b.dir === -1);
    default:
      return false;
  }
}

export function assignBinding(
  bindings: any,
  device: 'keyboard' | 'pad',
  action: string,
  slot: number,
  newBinding: any
): { changed: boolean } {
  const currentSlots = bindings[device][action];
  if (
    getBindingCategory(newBinding) !== device ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot > currentSlots.length ||
    slot >= 2
  ) {
    return { changed: false };
  }
  if (currentSlots.some((existing: any) => areBindingsEqual(existing, newBinding))) {
    return { changed: false };
  }
  if (slot < currentSlots.length) {
    currentSlots[slot] = newBinding;
  } else {
    currentSlots.push(newBinding);
  }
  return { changed: true };
}

export function removeBinding(bindings: any, device: 'keyboard' | 'pad', action: string, slot: number): void {
  const list = bindings[device][action];
  if (slot >= 0 && slot < list.length) {
    list.splice(slot, 1);
  }
}

export function resetDeviceBindings(bindings: any, device: 'keyboard' | 'pad'): void {
  bindings[device] = device === 'keyboard' ? createDefaultKeyboardBindings() : createDefaultGamepadBindings();
}

export function resetAxisBindings(bindings: any): void {
  bindings.axes = createDefaultInputBindings().axes;
}

export function formatKeyDisplayName(code: string): string {
  const custom = KEY_DISPLAY_NAMES[code];
  if (custom) return custom;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function formatAxisName(axis: number): string {
  return AXIS_NAMES[axis] ?? `Axis ${axis}`;
}

export function formatAxisDirectionName(axis: number, dir: number): string {
  const stick = axis < 2 ? 'L Stick' : 'R Stick';
  return axis % 2 === 0
    ? `${stick} ${dir > 0 ? 'Right' : 'Left'}`
    : `${stick} ${dir > 0 ? 'Down' : 'Up'}`;
}

export function detectControllerType(id?: string | null): 'playstation' | 'xbox' {
  return id && /playstation|dualshock|dualsense|sony|054c/i.test(id) ? 'playstation' : 'xbox';
}

export function formatBindingDisplayName(binding: any, controllerType: 'playstation' | 'xbox' = 'xbox'): string {
  if (!binding) return '';
  switch (binding.kind) {
    case 'key':
      return formatKeyDisplayName(binding.code);
    case 'mouse':
      return MOUSE_BUTTON_NAMES[binding.button] ?? `Mouse ${binding.button + 1}`;
    case 'padButton': {
      const names = controllerType === 'playstation' ? PLAYSTATION_BUTTON_NAMES : XBOX_BUTTON_NAMES;
      return names[binding.index] ?? `Button ${binding.index}`;
    }
    case 'padAxis':
      return formatAxisDirectionName(binding.axis, binding.dir);
    default:
      return '';
  }
}

export function getActionLabel(actionId: string): string {
  const found = INPUT_ACTIONS.find((a) => a.id === actionId);
  return found ? found.label : actionId;
}

function migrateAxisConfig(targetAxis: any, loadedAxis: any): void {
  if (isPlainObject(loadedAxis)) {
    targetAxis.axis = clampNumberOrDefault(loadedAxis.axis, targetAxis.axis, { min: 0, max: 15, integer: true });
    targetAxis.invert = booleanOrDefault(loadedAxis.invert, targetAxis.invert);
  }
}

export const inputBindingsStore = createLocalStorageStore(
  STORAGE_KEY_INPUT_BINDINGS,
  createDefaultInputBindings,
  (target: any, loaded: any) => {
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

    for (const dev of ['keyboard', 'pad'] as const) {
      const devObj = isPlainObject(loaded[dev]) ? loaded[dev] : {};
      for (const act of INPUT_ACTIONS) {
        const slots = filterArraySlice(devObj[act.id], validateBinding, 2);
        if (slots) {
          target[dev][act.id] = slots.filter((b: any) => getBindingCategory(b) === dev);
        }
      }

      if (!Object.hasOwn(devObj, 'airRoll')) {
        if (dev === 'pad') {
          target[dev].airRoll = target[dev].powerslide.map((b: any) => ({ ...b }));
        } else {
          target[dev].airRoll = [];
        }
      }

      for (const act of [...BALL_CONTROL_MODES, ...CAMERA_LOOK_ACTIONS]) {
        if (!Array.isArray(devObj[act])) {
          target[dev][act] = target[dev][act].filter(
            (b: any) =>
              !(
                b.kind === 'padAxis' &&
                (CAMERA_LOOK_ACTIONS as readonly string[]).includes(act) &&
                (b.axis === target.axes.steer.axis || b.axis === target.axes.pitch.axis)
              ) &&
              !INPUT_ACTIONS.some(
                (other) =>
                  other.id !== act &&
                  Array.isArray(devObj[other.id]) &&
                  target[dev][other.id].some((o: any) => areBindingsEqual(b, o))
              )
          );
        }
      }
    }
  }
);

export function loadInputBindings(): Record<string, any> {
  return inputBindingsStore.load();
}

export function saveInputBindings(bindings: Record<string, any>): void {
  inputBindingsStore.save(bindings);
}

export const controllerSelectionStore = createLocalStorageStore(
  STORAGE_KEY_CONTROLLER_SELECTION,
  () => ({ id: null as string | null, index: null as number | null }),
  (target: any, loaded: any) => {
    if (typeof loaded.id === 'string' && loaded.id.length > 0) target.id = loaded.id;
    if (typeof loaded.index === 'number' && Number.isFinite(loaded.index) && loaded.index >= 0) {
      target.index = clampNumberOrDefault(loaded.index, 0, { min: 0, integer: true });
    }
  }
);

let cachedSelectedController: { id: string | null; index: number | null } | undefined;
export const ignoredControllerIndices = new Set<number>();

export function getConnectedGamepads(): (Gamepad | null)[] {
  try {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return navigator.getGamepads() ?? [];
  } catch (err) {
    console.warn('[InputBindings] Failed to query gamepads via navigator.getGamepads:', err);
    return [];
  }
}

export function getSelectedController(): { id: string | null; index: number | null } {
  if (!cachedSelectedController) {
    cachedSelectedController = controllerSelectionStore.load();
  }
  return { ...cachedSelectedController };
}

export function setSelectedController(controller: { id: string; index: number } | null): void {
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

export function getEffectiveGamepad(): Gamepad | null {
  const sel = getSelectedController();
  const pads = getConnectedGamepads().filter((g): g is Gamepad => !!(g && g.connected));
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
