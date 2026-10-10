import React from 'react';
import { KeycapBadge } from '../primitives/KeycapBadge';

export interface BallCameraIndicatorProps {
  /** 是否启用球视角 (Ball Cam Active) */
  active?: boolean;
  /** 快捷键提示，默认 'SPACE' */
  shortcut?: string | null;
  /** 主标题文字，默认 'BALL CAM' */
  label?: string;
  /** 底部动作提示文字，默认 'TO TOGGLE' */
  actionText?: string;
  /** 主题样式：明亮/暗黑 */
  isLight?: boolean;
  /** 点击切换回调 */
  onToggle?: () => void;
  /** 附加 className */
  className?: string;
}

/**
 * BallCameraIndicator
 * 纯正 Rocket League 风格的球视角 HUD 指示器：
 * 1. 整体容器左右结构：左侧为跨越两行高度的动态大红标，右侧为文本块。
 * 2. 右侧文本块上下分两半并严格左对齐：
 *    - 上半：较大字体的 BALL CAM 状态标题。
 *    - 下半：PRESS [KEY] TO TOGGLE 操作指引。
 * 3. 采用 UIStorybook 统一的毛玻璃质感与 KeycapBadge 键位规范。
 */
export const BallCameraIndicator: React.FC<BallCameraIndicatorProps> = ({
  active = true,
  shortcut = 'SPACE',
  label = 'BALL CAM',
  actionText = 'TO TOGGLE',
  isLight = false,
  onToggle,
  className = '',
}) => {
  return (
    <div
      data-ui-element="hud-ball-camera-indicator"
      onClick={onToggle}
      className={`select-none pointer-events-auto transition-all cursor-pointer group active:scale-95 inline-flex ${className}`}
      title="点击或按键切换球视角 (Toggle Ball Camera)"
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-150 shadow-lg ${
          isLight
            ? active
              ? 'bg-white/95 border-neutral-300/90 text-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)]'
              : 'bg-white/70 border-neutral-200 text-neutral-400 shadow-sm opacity-60'
            : active
            ? 'bg-neutral-950/90 border-neutral-800 text-white shadow-[0_4px_25px_rgba(0,0,0,0.7)]'
            : 'bg-neutral-900/60 border-neutral-800/60 text-neutral-500 shadow-none opacity-50'
        } backdrop-blur-md`}
      >
        {/* 左侧：跨越两行高度的动态发光大红标 */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div
            className={`w-5 h-5 rounded-full transition-all duration-150 ${
              active
                ? 'bg-red-500 shadow-[0_0_12px_#ef4444,0_0_3px_#ffffff]'
                : isLight
                ? 'bg-neutral-300'
                : 'bg-neutral-700'
            }`}
          />
          {active && (
            <div className="absolute w-7 h-7 rounded-full bg-red-500/25 animate-ping pointer-events-none" />
          )}
        </div>

        {/* 右侧：上下两半结构，严格左对齐 */}
        <div className="flex flex-col items-start text-left leading-tight">
          {/* 上半：较大字体的 BALL CAM */}
          <span
            className={`text-sm font-black tracking-wider font-mono uppercase transition-colors ${
              active
                ? isLight
                  ? 'text-neutral-900'
                  : 'text-white'
                : isLight
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }`}
          >
            {label}
          </span>

          {/* 下半：PRESS [KEY] TO TOGGLE，左对齐 */}
          {shortcut ? (
            <div
              className={`flex items-center gap-1.5 text-[10px] font-mono tracking-tight mt-0.5 transition-opacity ${
                active ? 'opacity-85' : 'opacity-50'
              } ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}
            >
              <span>PRESS</span>
              <KeycapBadge shortcut={shortcut} size="sm" isLight={isLight} />
              <span>{actionText}</span>
            </div>
          ) : (
            <span
              className={`text-[10px] font-mono tracking-tight mt-0.5 transition-opacity ${
                active ? 'opacity-70' : 'opacity-40'
              } ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}
            >
              {active ? 'CAMERA LOCKED ON BALL' : 'FREE COCKPIT VIEW'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
