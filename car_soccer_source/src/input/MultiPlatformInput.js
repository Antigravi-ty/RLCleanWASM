/**
 * MultiPlatformInput.js
 * Unified multi-platform input facade providing seamless access to Keyboard & Mouse,
 * Gamepad (standard/custom mapping), Mobile Touch controls, and persistent bindings.
 */

export * from "./InputConstants.js";
export * from "./InputBindings.js";
export * from "./KeyboardMouseController.js";
export * from "./GamepadController.js";

import { KeyboardMouseController } from "./KeyboardMouseController.js";
import { GamepadController } from "./GamepadController.js";
import { loadInputBindings, getEffectiveGamepad } from "./InputBindings.js";

/**
 * Unified MultiPlatformInputCoordinator orchestrates polling across all devices,
 * prioritizing active gamepads, and falling back to keyboard/mouse.
 */
export class MultiPlatformInputCoordinator {
  constructor(container, bindings = loadInputBindings()) {
    this.bindings = bindings;
    this.keyboard = new KeyboardMouseController(this.bindings);
    this.gamepad = new GamepadController(this.bindings);

    this.onReset = null;
    this.onBallControl = null;
    this.onBallCamToggle = null;
    this.onSettingsToggle = null;

    const forwardReset = () => this.onReset?.();
    const forwardBallControl = (mode) => this.onBallControl?.(mode);
    const forwardBallCam = () => this.onBallCamToggle?.();
    const forwardSettings = () => this.onSettingsToggle?.();

    this.keyboard.onReset = forwardReset;
    this.keyboard.onBallControl = forwardBallControl;
    this.keyboard.onBallCamToggle = forwardBallCam;
    this.keyboard.onSettingsToggle = forwardSettings;

    this.gamepad.onReset = forwardReset;
    this.gamepad.onBallControl = forwardBallControl;
    this.gamepad.onBallCamToggle = forwardBallCam;
    this.gamepad.onSettingsToggle = forwardSettings;

  }

  setBindings(bindings) {
    this.bindings = bindings;
    this.keyboard.setBindings(bindings);
    this.gamepad.setBindings(bindings);
  }

  get activeDevice() {
    if (this.gamepad.active()) return "gamepad";
    return "keyboard";
  }

  read() {
    const padControls = this.gamepad.read();
    const kbControls = this.keyboard.read();

    const device = this.activeDevice;
    const activeControls = device === "gamepad" ? padControls : kbControls;

    const lookX = Math.max(-1, Math.min(1, this.keyboard.cameraLook.x + this.gamepad.cameraLook.x));
    const lookY = Math.max(-1, Math.min(1, this.keyboard.cameraLook.y + this.gamepad.cameraLook.y));

    return {
      controls: activeControls,
      device,
      cameraLook: { x: lookX, y: lookY }
    };
  }
}
