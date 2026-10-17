import { useEffect } from 'react';
import {
  saveInputBindings,
  assignBinding,
  getEffectiveGamepad,
} from '../../tokens/inputBindingsStore';
import type { ListeningTarget } from './KeybindingSlots';

export function cloneBindingsMap(bindings: any) {
  const clone = {
    keyboard: { ...bindings.keyboard },
    pad: { ...bindings.pad },
    axes: { ...bindings.axes },
  };
  for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
  for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];
  return clone;
}

export function useKeybindingCapture(
  listeningTarget: ListeningTarget | null,
  bindings: any,
  bridge: any,
  setBindings: (next: any) => void,
  setListeningTarget: (target: ListeningTarget | null) => void
) {
  useEffect(() => {
    if (!listeningTarget) return;

    const commitAssignedBinding = (device: 'keyboard' | 'pad', payload: any) => {
      const clone = cloneBindingsMap(bindings);
      const res = assignBinding(
        clone,
        device,
        listeningTarget.actionId,
        listeningTarget.slot,
        payload
      );
      if (res.changed) {
        saveInputBindings(clone);
        bridge.onBindingsChange?.(clone);
        setBindings(clone);
      }
      setListeningTarget(null);
    };

    if (listeningTarget.device === 'keyboard') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Escape' || e.key === 'Escape') {
          (e as any).__keybindingCaptureHandled = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setListeningTarget(null);
          return;
        }
        (e as any).__keybindingCaptureHandled = true;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        commitAssignedBinding('keyboard', { kind: 'key', code: e.code });
      };

      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        commitAssignedBinding('keyboard', { kind: 'mouse', button: e.button });
      };

      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('mousedown', handleMouseDown, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('mousedown', handleMouseDown, true);
      };
    } else {
      let animId: number;
      let prevButtons: boolean[] = [];
      let prevAxes: number[] = [];

      const initialPad = getEffectiveGamepad();
      if (initialPad) {
        prevButtons = (initialPad.buttons ?? []).map((b: any) => b.pressed);
        prevAxes = [...(initialPad.axes ?? [])];
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Escape' || e.key === 'Escape') {
          (e as any).__keybindingCaptureHandled = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setListeningTarget(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown, true);

      const pollGamepad = () => {
        const pad = getEffectiveGamepad();
        if (pad) {
          for (let i = 0; i < pad.buttons.length; i++) {
            const pressed = pad.buttons[i]?.pressed ?? false;
            if (pressed && !prevButtons[i]) {
              commitAssignedBinding('pad', { kind: 'padButton', index: i });
              return;
            }
            prevButtons[i] = pressed;
          }

          for (let a = 0; a < pad.axes.length; a++) {
            const val = pad.axes[a] ?? 0;
            const prevVal = prevAxes[a] ?? 0;
            prevAxes[a] = val;
            if (Math.abs(val) > 0.7 && (Math.abs(prevVal) <= 0.7 || Math.sign(prevVal) !== Math.sign(val))) {
              commitAssignedBinding('pad', { kind: 'padAxis', axis: a, dir: val > 0 ? 1 : -1 });
              return;
            }
          }
        }
        animId = requestAnimationFrame(pollGamepad);
      };

      animId = requestAnimationFrame(pollGamepad);
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [listeningTarget, bindings, bridge, setBindings, setListeningTarget]);
}
