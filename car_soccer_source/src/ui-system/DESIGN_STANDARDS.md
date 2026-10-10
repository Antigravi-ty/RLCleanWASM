# UI System Design Standards & Architecture Guide

## 1. 核心设计原则 (Core Principles)

在对 RLCleanWASM 菜单系统进行演进与迭代时，我们以 UIStorybook 作为视觉原型参考，但针对实际游戏内体验进行了工程解耦与规范统一，避免盲目照搬原型中未完善或冗余的实现。

---

## 2. 三段式复合布局模型 (3-Stage Compound Panel Model)

### 为什么不完全照搬 UIStorybook？
在 UIStorybook 原型中，部分面板（例如 Ball Trajectory Predictor）的 `PanelContent` 硬编码了固定高度（如 `h-[380px]`），而设置主面板则硬编码了 `h-[400px]`。由于外层 `MorphingShell` 统一高度为 540px，硬编码高度导致内容区域与底部 Footer 之间出现断层，Footer 悬浮在半空中，视觉观感异常且不统一。

### 统一标准：三段式弹性约束
所有面板组件（`PanelContainer`、`PanelHeader`、`PanelContent`、`PanelFooter`）必须遵循以下结构规则：
- **顶栏 (Header)**：`shrink-0`，固定于容器顶端，严禁被压缩或推挤。
- **底栏 (Footer)**：`shrink-0 mt-auto`，严格锚定在容器底边，与底部边缘保持统一的 padding 间距。
- **中段内容 (Content)**：`flex-1 min-h-0 overflow-y-auto`，剩多少用多少。无论窗口尺寸或内外边距如何变动，内容区自动撑满顶栏与底栏之间的全部垂直空间，内容溢出时在此区域内独立滚动。

---

## 3. 面板标题栏规范 (Minimalist Panel Header)

1. **移除冗余的 Level Badge**：
   - 不在 Keybindings 显示 `<Badge>Level 3</Badge>`，不在 Advanced Controller 显示 `<Badge>Level 4</Badge>`。
   - 层级概念是开发实现的内部逻辑，对玩家而言是干扰视觉重心的无用噪点。
2. **移除标题下方的 Subtitle / Description**：
   - 保持所有面板 Header 仅有返回键、大写标题文本（如 `KEY BINDINGS`、`ADVANCED CONTROLLER`、`TRAJECTORY PREDICTOR`）以及右侧操作区。
   - 其他 Settings 页面与 Trajectory 页面均无副标题描述，统一采用纯粹、凝练的极简设计语言。

---

## 4. 底栏指示器规范 (Clean Panel Footer)

1. **移除无用的右下角指示器**：
   - 移除 `ESC to Back`、`TAB to Live Preview` 等冗余的底栏右下角指示标。
   - 弹窗的 ESC 返回逻辑以及快捷键在全局有明确行为，不需要在各子页面底角反复提示。
2. **底栏语义与功能**：
   - 底栏仅用于动态说明（如鼠标悬停时的实时参数解释）或重置操作（如 `Reset Defaults`）。

---

## 5. 即时状态呈现 (Direct State Reflection, No Toasts)

- 在按键改键、解绑、或是摇杆通道配置时，**不弹出任何已绑定/已解除的浮动横幅或 Toast 提示**。
- 按键绑定结果会直接实时反映在当前槽位的按键卡片（Keycap Badge）上；删除时卡片立即消失；操作即所见，界面自身即是状态反馈。

---

## 6. 同尺寸层级切换动画 (Route Morphing Animation)

- 当用户在同等几何尺寸的路由之间切换时（例如 Level 3 Keybindings 与 Level 4 Advanced Controller 均为 560px 宽度、540px 高度），外层外壳尺寸不会发生补间。
- 为保证切换流畅感，`MorphingShell` 内部对子路由包裹基于 `currentKey` 的微动过渡动效（`opacity` 渐变与 `y: 4px` 微平移，耗时 180ms，曲线 `cubic-bezier(0.2, 0.8, 0.25, 1)`），提供如丝般顺滑的跨页面切换体验。

---

## 7. 真实按键系统接入规范 (Full Game Action Remapping)

1. **完整动作覆盖**：
   - 必须完整覆盖 `InputConstants.js` 中定义的全部 22 项核心操作：
     - **Driving**: `throttleForward`, `throttleReverse`, `steerLeft`, `steerRight`, `boost`, `jump`, `powerslide`
     - **Aerial**: `airRoll`, `airRollLeft`, `airRollRight`
     - **Camera**: `ballCam`, `rearView`, `cameraLeft`, `cameraRight`, `cameraUp`, `cameraDown`
     - **Ball Control**: `takePossession`, `startDribble`, `passBall`, `launchBall`
     - **Session**: `resetShot`, `toggleSettings`
2. **输入响应与双向同步**：
   - 所有改键、解绑、重置默认值以及摇杆高级配置均直接通过 `InputBindings.js` (`assignBinding`, `removeBinding`, `resetDeviceBindings`, `saveInputBindings`) 保存至 LocalStorage。
   - 同时通过 `bridge.onBindingsChange` 实时通知 `gameRuntime.keyboard` 与 `gameRuntime.gamepad` 的 `setBindings()`，做到真正的读写闭环，杜绝静态 Mock。
