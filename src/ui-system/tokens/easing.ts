/**
 * Motion & Physics Easing Presets
 * Apple HIG cubic-bezier & Framer Motion spring presets
 */
export const UI_EASING = {
  // Apple HIG standard transition curve: [0.2, 0.8, 0.25, 1]
  apple: [0.2, 0.8, 0.25, 1] as const,
  
  // Spring configurations for Framer Motion
  spring: {
    tactile: {
      type: 'spring' as const,
      stiffness: 450,
      damping: 32,
      mass: 0.8,
    },
    bouncy: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
    },
    smooth: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 28,
    },
    instant: {
      duration: 0.12,
      ease: [0.2, 0.8, 0.25, 1] as const,
    },
  },

  // Standard Container Transition Presets
  transitions: {
    // 1. Fluid Morph Transition
    fluidMorph: {
      name: 'FluidMorphTransition' as const,
      displayName: 'Fluid Morph',
      description: 'Apple HIG fluid continuous morphing: window dimensions and content smoothly interpolate via Apple Ease curve without intermediate pauses',
      duration: 0.28,
      ease: [0.2, 0.8, 0.25, 1] as const,
    },

    // 2. Sequenced Step Container Transition
    sequencedStep: {
      name: 'SequencedStepTransition' as const,
      displayName: 'Sequenced Step',
      description: 'Apple HIG three-stage sequenced container transition: 100ms fade-out -> 150ms resize -> 100ms fade-in, all with Apple Ease',
      fadeOut: {
        duration: 0.10, // 100ms
        ms: 100,
        ease: [0.2, 0.8, 0.25, 1] as const,
      },
      resize: {
        duration: 0.15, // 150ms
        ms: 150,
        ease: [0.2, 0.8, 0.25, 1] as const,
      },
      fadeIn: {
        duration: 0.10, // 100ms
        ms: 100,
        ease: [0.2, 0.8, 0.25, 1] as const,
      },
      totalDuration: 0.35, // 350ms
      totalMs: 350,
    },
  },
} as const;

export type ContainerTransitionMode = 'fluid-morph' | 'sequenced-step';

/**
 * Fluid morph configuration
 */
export interface FluidMorphConfig {
  /** Animation duration in seconds (default 0.28s) */
  duration?: number;
  /** Easing curve (default Apple HIG [0.2, 0.8, 0.25, 1]) */
  ease?: readonly [number, number, number, number];
}

/**
 * Sequenced step transition configuration
 */
export interface SequencedStepConfig {
  /** Fade duration in seconds (default 0.10s) */
  fadeDuration?: number;
  /** Outgoing content fade duration */
  fadeOutDuration?: number;
  /** Incoming content fade duration */
  fadeInDuration?: number;
  /** Container resize duration (default 0.15s) */
  resizeDuration?: number;
  /** Easing curve (default Apple HIG [0.2, 0.8, 0.25, 1]) */
  ease?: readonly [number, number, number, number];
}

export interface ContainerTransitionParams {
  fluid?: FluidMorphConfig;
  step?: SequencedStepConfig;
}
