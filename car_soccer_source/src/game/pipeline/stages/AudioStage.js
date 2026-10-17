import { audioConfig } from '../../../audio/AudioArchitecture.js';

/**
 * AudioStage.js
 * Evaluates focus policies and executes the GameAudioSubsystem tick.
 */
export class AudioStage {
  constructor(runtime) {
    this.runtime = runtime;
  }

  execute(context) {
    const r = this.runtime;

    const continueOnBlur = audioConfig.get('continueAudioOnLostFocus');
    const isHidden = typeof document !== 'undefined' && (!document.hasFocus() || document.hidden);
    const blockingOverlays = Array.from(r.openOverlays).filter(n => n !== 'trajectory');
    const hasBlockingOverlay = blockingOverlays.length > 0;

    context.continueOnBlur = continueOnBlur;
    context.isHidden = isHidden;
    context.hasBlockingOverlay = hasBlockingOverlay;

    r.audioSubsystem?.update?.(context);

    if (r.profiler) r.profiler.mark();
  }
}
