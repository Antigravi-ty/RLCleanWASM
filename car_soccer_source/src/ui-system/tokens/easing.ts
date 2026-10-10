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
    // 1. 标准流体连续形变过渡 (Fluid Morph Transition)
    fluidMorph: {
      name: 'FluidMorphTransition' as const,
      displayName: '流体连续形变 (Fluid Morph)',
      description: 'Apple HIG 标准流体连续形变：窗口宽高与内容通过 Apple Ease 曲线同步平滑连续插值，无中间分步停顿',
      duration: 0.28,
      ease: [0.2, 0.8, 0.25, 1] as const,
    },

    // 2. 标准三段时序分步容器过渡 (Sequenced Step Container Transition)
    sequencedStep: {
      name: 'SequencedStepTransition' as const,
      displayName: '三段时序分步过渡 (Sequenced Step)',
      description: 'Apple HIG 标准三阶段分步容器过渡：100ms 旧内容淡出 -> 150ms 容器尺寸变形 -> 100ms 新内容显现淡入，全程采用 Apple Ease',
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
 * 流体连续形变参数配置
 * 默认采用 Apple HIG 曲线 [0.2, 0.8, 0.25, 1]，只需传入时间参数 duration (默认 0.28s)
 */
export interface FluidMorphConfig {
  /** 动画持续时间（单位：秒），默认 0.28s */
  duration?: number;
  /** 缓动曲线，默认采用 Apple HIG 曲线 [0.2, 0.8, 0.25, 1] */
  ease?: readonly [number, number, number, number];
}

/**
 * 三段时序分步过渡参数配置
 * 包含淡入/淡出时间与容器尺寸变化时间两类核心参数
 */
export interface SequencedStepConfig {
  /** 淡入/淡出时长（单位：秒），默认 0.10s (100ms) */
  fadeDuration?: number;
  /** 旧内容独立淡出时长（若未指定则使用 fadeDuration） */
  fadeOutDuration?: number;
  /** 新内容独立淡入时长（若未指定则使用 fadeDuration） */
  fadeInDuration?: number;
  /** 容器尺寸变形时长（单位：秒），默认 0.15s (150ms) */
  resizeDuration?: number;
  /** 缓动曲线，默认采用 Apple HIG 曲线 [0.2, 0.8, 0.25, 1] */
  ease?: readonly [number, number, number, number];
}

export interface ContainerTransitionParams {
  fluid?: FluidMorphConfig;
  step?: SequencedStepConfig;
}
