import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { UI_RADIUS } from '../tokens/radius';
import {
  UI_EASING,
  type ContainerTransitionMode,
  type FluidMorphConfig,
  type SequencedStepConfig,
} from '../tokens/easing';

export type { ContainerTransitionMode, FluidMorphConfig, SequencedStepConfig };

export const CONTAINER_TRANSITIONS = UI_EASING.transitions;

export type TransitionPhase = 'idle' | 'fadeOut' | 'resize' | 'fadeIn';

export interface MorphContainerProps {
  /** 区分当前视图或路由的唯一 Key，用于触发时序切换 */
  currentKey?: string;
  /** 目标容器宽度（数字表示 px，或 CSS 字符串） */
  width?: number | string;
  /** 过渡模式：'fluid-morph' (连续流体) 或 'sequenced-step' (三段分步) */
  mode?: ContainerTransitionMode;
  children: React.ReactNode;
  isLight?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** 阶段变迁回调（仅在 sequenced-step 模式下变迁，fluid-morph 常驻 idle） */
  onPhaseChange?: (phase: TransitionPhase) => void;
  /** 流体过渡专用详细参数配置 */
  fluidConfig?: FluidMorphConfig;
  /** 分步过渡专用详细参数配置 */
  stepConfig?: SequencedStepConfig;
  /** 快捷流体时长参数（单位：秒，默认 0.28s） */
  fluidDuration?: number;
  /** 快捷淡出淡入时长参数（单位：秒，默认 0.10s / 100ms） */
  stepFadeDuration?: number;
  /** 快捷尺寸变形时长参数（单位：秒，默认 0.15s / 150ms） */
  stepResizeDuration?: number;
  /** 是否应用模态窗口初始缩放呈现动画 (0.96 -> 1) */
  initialModal?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

/**
 * 统一容器过渡执行引擎 (MorphContainer)
 * 彻底统一并解耦 UI 表现与状态时序：
 * 
 * 1. FluidMorphTransition (流体连续形变模式):
 *    - Framer Motion FLIP 连续形变，内容轻量 cross-fade，不阻断外层 GPU 尺寸形变。
 *    - 默认 0.28s，缓动内置 Apple HIG 物理阻尼曲线 [0.2, 0.8, 0.25, 1]。
 * 
 * 2. SequencedStepTransition (三段时序分步过渡模式):
 *    - Phase 1: Fade Out (旧内容透明度从 100% 平滑淡出至 0%)
 *    - Phase 2: Resize (内容保持 opacity=0 隐藏，外层容器平滑形变尺寸)
 *    - Phase 3: Fade In (新内容透明度从 0% 平滑显现淡入至 100%)
 *    - 严格时序解耦，杜绝整体变灰与半透明残留问题。
 */
export const MorphContainerContext = React.createContext<boolean>(false);
export const useInMorphContainer = () => React.useContext(MorphContainerContext);

export const MorphContainer = forwardRef<HTMLDivElement, MorphContainerProps>(
  (
    {
      currentKey = 'default',
      width,
      mode = 'fluid-morph',
      children,
      isLight = false,
      className = '',
      style = {},
      onPhaseChange,
      fluidConfig,
      stepConfig,
      fluidDuration,
      stepFadeDuration,
      stepResizeDuration,
      initialModal = false,
      onClick,
      ...rest
    },
    ref
  ) => {
    // 解析流体参数
    const activeFluidDuration =
      fluidDuration ?? fluidConfig?.duration ?? UI_EASING.transitions.fluidMorph.duration;
    const activeFluidEase = fluidConfig?.ease ?? UI_EASING.apple;

    // 解析分步参数
    const activeFadeDuration =
      stepFadeDuration ??
      stepConfig?.fadeDuration ??
      UI_EASING.transitions.sequencedStep.fadeOut.duration;
    const activeFadeOutDuration = stepConfig?.fadeOutDuration ?? activeFadeDuration;
    const activeFadeInDuration = stepConfig?.fadeInDuration ?? activeFadeDuration;
    const activeResizeDuration =
      stepResizeDuration ??
      stepConfig?.resizeDuration ??
      UI_EASING.transitions.sequencedStep.resize.duration;
    const activeStepEase = stepConfig?.ease ?? UI_EASING.apple;

    // 格式化宽度值
    const resolveWidth = (val: number | string | undefined): string | undefined => {
      if (val === undefined) return undefined;
      return typeof val === 'number' ? `${val}px` : val;
    };

    // 时序状态维护
    const [displayedContent, setDisplayedContent] = useState<React.ReactNode>(children);
    const [displayedKey, setDisplayedKey] = useState<string>(currentKey);
    const [containerWidth, setContainerWidth] = useState<number | string | undefined>(width);
    const [phase, setPhase] = useState<TransitionPhase>('idle');

    // 追踪最新目标引用，防止闭包失效
    const targetKeyRef = useRef(currentKey);
    const targetContentRef = useRef(children);
    const targetWidthRef = useRef(width);
    const timersRef = useRef<NodeJS.Timeout[]>([]);
    const isFirstMountRef = useRef(true);

    targetKeyRef.current = currentKey;
    targetContentRef.current = children;
    targetWidthRef.current = width;

    const clearAllTimers = () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };

    useEffect(() => {
      onPhaseChange?.(phase);
    }, [phase, onPhaseChange]);

    useEffect(() => {
      return () => {
        clearAllTimers();
      };
    }, []);

    // 核心切换状态机调度
    useEffect(() => {
      // 首次加载直接就绪，不触发无意义退出淡出
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        setDisplayedContent(children);
        setDisplayedKey(currentKey);
        setContainerWidth(width);
        setPhase('idle');
        return;
      }

      if (mode === 'fluid-morph') {
        clearAllTimers();
        setDisplayedContent(children);
        setDisplayedKey(currentKey);
        setContainerWidth(width);
        setPhase('idle');
        return;
      }

      // mode === 'sequenced-step'
      const hasKeyChanged = currentKey !== displayedKey;
      const hasWidthChanged = width !== containerWidth;

      if (hasKeyChanged || hasWidthChanged) {
        clearAllTimers();

        // 阶段 1: 旧内容透明度从 100% 平滑淡出至 0% (Apple Ease)
        setPhase('fadeOut');

        const fadeOutTimer = setTimeout(() => {
          // 阶段 2: 切换新内容，保持隐藏 (opacity: 0)，外层容器平滑形变尺寸 (Apple Ease)
          setDisplayedKey(targetKeyRef.current);
          setDisplayedContent(targetContentRef.current);
          setContainerWidth(targetWidthRef.current);
          setPhase('resize');

          const resizeTimer = setTimeout(() => {
            // 阶段 3: 新内容显现，透明度从 0% 平滑淡入至 100% (Apple Ease)
            setPhase('fadeIn');

            const fadeInTimer = setTimeout(() => {
              setPhase('idle');
            }, activeFadeInDuration * 1000);

            timersRef.current.push(fadeInTimer);
          }, activeResizeDuration * 1000);

          timersRef.current.push(resizeTimer);
        }, activeFadeOutDuration * 1000);

        timersRef.current.push(fadeOutTimer);
      }
    }, [
      currentKey,
      width,
      mode,
      activeFadeOutDuration,
      activeResizeDuration,
      activeFadeInDuration,
    ]);

    // ──────────────────────────────────────────────────────────────────────────
    // 容器外壳样式计算：确保容器具有常驻底板背景与边框，在整个时序过渡中背景透明度永不改变
    // ──────────────────────────────────────────────────────────────────────────
    const hasCustomBg = className.includes('bg-');
    const hasCustomBorder = className.includes('border');
    const hasCustomRadius = className.includes('rounded-');

    const defaultBgClass = isLight
      ? 'bg-neutral-50/98 text-neutral-900'
      : 'bg-neutral-900/98 text-neutral-100';
    const defaultBorderClass = isLight
      ? 'border border-neutral-300/80 ring-1 ring-black/5'
      : 'border border-neutral-700/60 ring-1 ring-white/10';

    const containerStyleClasses = [
      'relative overflow-hidden',
      !hasCustomRadius && UI_RADIUS.xl,
      !hasCustomBg && defaultBgClass,
      !hasCustomBorder && defaultBorderClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // ──────────────────────────────────────────────────────────────────────────
    // 1. 流体连续形变模式渲染 (Fluid Morph)
    // 连续 layout 插值，无阻塞式 exit wait，与 MorphingShell 体验完全对齐
    // ──────────────────────────────────────────────────────────────────────────
    if (mode === 'fluid-morph') {
      const renderWidth = resolveWidth(width);
      return (
        <MorphContainerContext.Provider value={true}>
          <motion.div
            ref={ref}
            layout
            initial={initialModal ? { opacity: 0, scale: 0.96 } : false}
            animate={{
              opacity: 1,
              scale: 1,
              width: renderWidth,
            }}
            exit={initialModal ? { opacity: 0, scale: 0.96 } : undefined}
            transition={{
              layout: {
                duration: activeFluidDuration,
                ease: activeFluidEase,
              },
              width: {
                duration: activeFluidDuration,
                ease: activeFluidEase,
              },
              opacity: {
                duration: initialModal ? 0.2 : activeFluidDuration,
                ease: activeFluidEase,
              },
              scale: {
                duration: 0.22,
                ease: activeFluidEase,
              },
            }}
            style={style}
            className={containerStyleClasses}
            onClick={onClick}
            {...rest}
          >
            {/* 流体内层通过轻量淡入过渡，消除突变感，同时绝不阻断外层尺寸流动 */}
            <motion.div
              key={currentKey}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: activeFluidDuration * 0.6,
                ease: activeFluidEase,
              }}
              className="w-full flex flex-col"
            >
              {children}
            </motion.div>
          </motion.div>
        </MorphContainerContext.Provider>
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. 三段时序分步过渡模式渲染 (Sequenced Step)
    // 严格三段时序：100ms fadeOut (100% -> 0%) -> 150ms resize (0% 隐藏，容器平滑形变) -> 100ms fadeIn (0% -> 100%)
    // 容器背景、边框及阴影全程常驻稳定（透明度绝不降低），仅 content 区域进行时序淡入淡出
    // ──────────────────────────────────────────────────────────────────────────
    const renderWidth = resolveWidth(containerWidth);
    const contentOpacity = phase === 'fadeOut' || phase === 'resize' ? 0 : 1;

    const easeCss = `cubic-bezier(${activeStepEase.join(',')})`;

    return (
      <MorphContainerContext.Provider value={true}>
        <motion.div
          ref={ref}
          layout
          initial={initialModal ? { opacity: 0, scale: 0.96 } : false}
          animate={{
            opacity: 1,
            scale: 1,
            width: renderWidth,
          }}
          exit={initialModal ? { opacity: 0, scale: 0.96 } : undefined}
          transition={{
            width: {
              duration: activeResizeDuration,
              ease: activeStepEase,
            },
            layout: {
              duration: activeResizeDuration,
              ease: activeStepEase,
            },
            opacity: {
              duration: 0.18,
              ease: activeStepEase,
            },
            scale: {
              duration: 0.22,
              ease: activeStepEase,
            },
          }}
          style={style}
          className={containerStyleClasses}
          onClick={onClick}
          {...rest}
        >
          {/* 容器壳体背景在过渡全流程保持常驻，仅 content 区域执行分步淡出与淡入 */}
          <div
            style={{
              opacity: contentOpacity,
              transition:
                phase === 'fadeOut'
                  ? `opacity ${activeFadeOutDuration}s ${easeCss}`
                  : phase === 'fadeIn'
                  ? `opacity ${activeFadeInDuration}s ${easeCss}`
                  : 'none',
            }}
            className="w-full flex flex-col"
          >
            {displayedContent}
          </div>
        </motion.div>
      </MorphContainerContext.Provider>
    );
  }
);

MorphContainer.displayName = 'MorphContainer';

/**
 * 保持向前兼容的别名导出
 */
export const SequencedContainer = MorphContainer;
export type SequencedContainerProps = MorphContainerProps;
