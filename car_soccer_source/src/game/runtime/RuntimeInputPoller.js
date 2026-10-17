import { useUIStore } from '../../ui-system/index';
import { getEffectiveGamepad } from '../../input/MultiPlatformInput.js';

const BOT_CAR_INDEX = 1;

export function pollRuntimeInputs(runtime, commitPhysicsStep = true) {
  const pad = getEffectiveGamepad();
  const btn8 = pad?.buttons[8]?.pressed ?? false;
  const padId = pad ? JSON.stringify([pad.id, pad.index]) : null;

  if (padId !== runtime.lastGamepadId) {
    runtime.lastGamepadButton8 = btn8;
  }
  runtime.lastGamepadId = padId;

  const isMenuOpen = useUIStore ? useUIStore.getState().isOpen : false;
  const shouldToggleMatch =
    btn8 && !runtime.lastGamepadButton8 && !isMenuOpen;
  if (shouldToggleMatch) {
    if (runtime.gameUI) {
      runtime.gameUI.openMenu('play');
    }
  }
  runtime.lastGamepadButton8 = btn8;

  if (shouldToggleMatch) runtime.gamepad.capturing = true;
  let padReading = runtime.gamepad.read();
  if (shouldToggleMatch) runtime.gamepad.capturing = false;

  if (runtime.gamepadSettingsJustClosed) {
    runtime.gamepadSettingsJustClosed = [0, 1, 8, 9].some(i => pad?.buttons[i]?.pressed);
    if (runtime.gamepadSettingsJustClosed) padReading = runtime.neutralControls;
  }

  const kbReading = runtime.keyboard.read();
  const activeDevice = runtime.gamepad.active() ? 'gamepad' : 'keyboard';
  const rawControls = activeDevice === 'gamepad' ? padReading : kbReading;
  const isFreeCamActive = Boolean(runtime.camera?.isFreeCam);
  const isKickoff = runtime.match?.state?.phase === 'kickoff';
  const effectiveControls = (isFreeCamActive || isKickoff) ? runtime.neutralControls : rawControls;

  const hasFocus =
    typeof document !== 'undefined' && !document.hidden && document.hasFocus();

  runtime.cameraDynamics.lookX = hasFocus
    ? Math.min(Math.max(runtime.keyboard.cameraLook.x + (runtime.gamepadSettingsJustClosed ? 0 : runtime.gamepad.cameraLook.x), -1), 1)
    : 0;
  runtime.cameraDynamics.lookY = hasFocus
    ? Math.min(Math.max(runtime.keyboard.cameraLook.y + (runtime.gamepadSettingsJustClosed ? 0 : runtime.gamepad.cameraLook.y), -1), 1)
    : 0;

  if (!commitPhysicsStep) {
    return true;
  }

  if (runtime.networkReconciler?.shouldSkipLocalStep) {
    runtime.networkReconciler.shouldSkipLocalStep = false;
    return false;
  }

  let car0Controls = effectiveControls;
  if (runtime.networkReconciler) {
    car0Controls = runtime.networkReconciler.sampleAndPredictInput(runtime.playerCarIndex, effectiveControls) || effectiveControls;
  }

  runtime.playerThrottle = car0Controls.throttle;
  runtime.playerControls = car0Controls;
  runtime.physics.setControls(runtime.playerCarIndex, car0Controls);

  if (runtime.authoritativeServer && runtime.isBotMatch && runtime.match?.state?.mode === 'match' && !runtime.isBotPaused) {
    if (isKickoff) {
      runtime.botControls = runtime.neutralControls;
      runtime.authoritativeServer.setCarControls(BOT_CAR_INDEX, runtime.botControls);
      runtime.physics.setControls(BOT_CAR_INDEX, runtime.botControls);
    } else {
      const kickoffControls = runtime.bot?.getKickoffControls?.(runtime.physics.state, runtime.botKickoffStep);
      if (kickoffControls) {
        runtime.botControls = kickoffControls;
        runtime.bot?.overrideControls?.(kickoffControls);
      } else if (runtime.botTickSkip <= 0) {
        runtime.scheduleBotDecision();
      }
      runtime.botKickoffStep++;
      if (!kickoffControls && runtime.botTickSkip > 0) {
        runtime.botTickSkip--;
      }
      runtime.authoritativeServer.setCarControls(BOT_CAR_INDEX, runtime.botControls);
      runtime.physics.setControls(BOT_CAR_INDEX, runtime.botControls);
    }
  } else if (runtime.networkReconciler && runtime.networkReconciler.lastRemoteControls) {
    const numCars = Math.min(runtime.physics.numCars, 8);
    for (let c = 0; c < numCars; c++) {
      if (c !== runtime.playerCarIndex) {
        const remote = runtime.networkReconciler.lastRemoteControls.get(c);
        const remoteCtrl = remote?.controls ? remote.controls : (remote || runtime.neutralControls);
        runtime.physics.setControls(c, remoteCtrl);
      }
    }
  }
  return true;
}
