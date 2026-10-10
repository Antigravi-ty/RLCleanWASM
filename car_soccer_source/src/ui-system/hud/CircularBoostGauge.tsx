import React from 'react';

export interface CircularBoostGaugeProps {
  /** 当前推进量数值 (0 ~ 100) */
  amount: number;
  /** 表盘外圈直径尺寸 (单位 px，默认 148) */
  size?: number;
  /** 明暗主题 */
  isLight?: boolean;
  /** 自定义 className */
  className?: string;
}

/**
 * 推进量四色分段映射算法：
 * - 0  ~ 24  ：红色 (Red - #ef4444)
 * - 25 ~ 60  ：黄色 (Yellow - #f59e0b)
 * - 61 ~ 96  ：绿色 (Green - #10b981)
 * - 97 ~ 100 ：浅蓝 (Sky Blue - #0ea5e9)
 */
export const getBoostSegmentColor = (amount: number): {
  color: string;
  segmentName: 'red' | 'yellow' | 'green' | 'sky';
  rangeLabel: string;
} => {
  const val = Math.max(0, Math.min(100, Math.round(amount)));
  if (val <= 24) {
    return { color: '#ef4444', segmentName: 'red', rangeLabel: '0-24 (危急·红)' };
  }
  if (val <= 60) {
    return { color: '#f59e0b', segmentName: 'yellow', rangeLabel: '25-60 (警戒·黄)' };
  }
  if (val <= 96) {
    return { color: '#10b981', segmentName: 'green', rangeLabel: '61-96 (充足·绿)' };
  }
  return { color: '#0ea5e9', segmentName: 'sky', rangeLabel: '97-100 (充盈·浅蓝)' };
};

/**
 * 等宽字体族配置：优先 SF Mono，其次 JetBrains Mono
 */
const MONO_FONT_FAMILY = "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace";

/**
 * CircularBoostGauge
 * 极简轻量级圆形推进量表盘：
 * 1. 结构极度精简，专为高频数值更新设计，移除所有点火/喷射特效与冗余背景层。
 * 2. 核心文字全部采用统一等宽字体 (优先 SF Mono，其次 JetBrains Mono)。
 * 3. 内置严格的四色分段引擎：0~24 红 -> 25~60 黄 -> 61~96 绿 -> 97~100 浅蓝。
 */
export const CircularBoostGauge: React.FC<CircularBoostGaugeProps> = ({
  amount = 100,
  size = 148,
  isLight = false,
  className = '',
}) => {
  const clampedAmount = Math.max(0, Math.min(100, Math.round(amount)));
  const { color } = getBoostSegmentColor(clampedAmount);

  // SVG 环形几何参数 (270度弧度)
  const radius = 54;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const sweepAngle = 270;
  const arcTotal = (sweepAngle / 360) * circumference;
  const progressOffset = arcTotal - (clampedAmount / 100) * arcTotal;

  return (
    <div
      data-ui-element="hud-circular-boost-gauge"
      className={`relative select-none pointer-events-auto flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontFamily: MONO_FONT_FAMILY,
      }}
    >
      <div
        className={`relative w-full h-full flex flex-col items-center justify-center p-3 rounded-full border transition-colors ${
          isLight
            ? 'bg-white/90 border-neutral-300/80 shadow-lg'
            : 'bg-neutral-950/85 border-neutral-800/80 shadow-xl'
        }`}
      >
        {/* SVG 环形进度条 (-225度起始旋转) */}
        <svg className="w-full h-full transform -rotate-[225deg]" viewBox="0 0 136 136">
          {/* 背景底轨 */}
          <circle
            cx="68"
            cy="68"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcTotal} ${circumference}`}
            strokeLinecap="round"
            className={isLight ? 'text-neutral-200' : 'text-neutral-800'}
          />

          {/* 前景激活填充弧：0ms 瞬时响应，颜色随分段实时变化 */}
          <circle
            cx="68"
            cy="68"
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcTotal} ${circumference}`}
            strokeLinecap="round"
            strokeDashoffset={progressOffset}
            style={{
              transition: 'stroke 100ms ease, stroke-dashoffset 0ms',
            }}
          />
        </svg>

        {/* 表盘中央纯净数字读数与 BOOST 标签：严格等宽字体 */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ fontFamily: MONO_FONT_FAMILY }}
        >
          <span
            className="text-4xl font-black tracking-tighter tabular-nums transition-colors leading-none"
            style={{
              color,
              fontFamily: MONO_FONT_FAMILY,
            }}
          >
            {clampedAmount}
          </span>

          <span
            className={`text-[10px] font-bold tracking-widest uppercase mt-1 ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}
            style={{ fontFamily: MONO_FONT_FAMILY }}
          >
            BOOST
          </span>
        </div>
      </div>
    </div>
  );
};
