# Agent Guide — Car Soccer Modern UI System (`ui-system`)

This document defines the architecture, design tokens, component registry, and modification rules for AI Agents working on the Car Soccer UI.

---

## 1. UI 重构演进核心法则 (Migration & Refactoring Strategy)

项目处于从旧版原生 DOM UI 向基于 UIStorybook 的现代 React `ui-system` 渐进式重构的进程中。为了杜绝功能反复、事件冲突与视觉退化，所有 Agent 必须严格遵守以下法则：

- **旧版功能维持原样 (Zero Modification to Legacy)**：未被完整替换的旧版原生 DOM 菜单（如 `SettingsSheet.js`、`OnlineDialog.js`）必须完全保持现有状态与可用性。已验证替换的模块（如 `GarageDialog.js`、`MatchDialog.js`）按规划干净下线删除。
  - **严禁提前劫持原有按键**：例如 HUD 右上角原生的设置齿轮按键（`#settings-button`）在全新设置菜单完全验证并就绪前，必须正常唤起原版 `SettingsSheet`，严禁用半成品进行覆盖或阻止冒泡。
  - **旧版代码只删不改**：旧版文件（`src/ui/*.js`）在演进过程中**只允许被整体删除**，严禁在旧版文件中缝缝补补或反向耦合新版逻辑。
- **新版 UI 步步为营 (Step-by-Step Replacement)**：
  - 新增功能统一收拢在 `src/ui-system/` 全新目录内。
  - **新版 UI 绝不直接调用旧版组件**：新版 Pause Menu 中的 Settings、Play 必须纯净自洽，以 `In Development` 占位符展示；绝不允许关闭新菜单去唤起旧版组件。
  - **未完成功能统一展示 In Development**：尚未实现或未接入引擎的模块（如 Play 对战模式、未完成的配置项），必须统一使用 `UnderConstructionPlaceholder` 组件展示“开发中 (In Development)”，与车库中的 Player Anthem / Player Name 保持一致，坚决杜绝把未经测试的假控件或半成品直接放上去。
  - **完成一个，验证一个，替换一个，删除一个**：在新版完成某一功能的像素级对齐（UIStorybook 规范）与引擎数据闭环后，切换入口并物理删除对应的旧版代码。

### 1.2 资源、状态与表现层的彻底解耦 (State & DOM Decoupling)
- **纯数据单向流 (Single Source of Truth)**：
  - 游戏内的全部配置与运行时状态（车辆预设、色盘优先级、相机参数、画质分级、弹道预测等）完全沉淀为纯数据 Store（如 `useUIStore` 与 `config/vehiclePresets.js`）。
  - `GameRuntime` 与引擎层只订阅 Store 的数据变化来驱动 Three.js 和 WASM 物理层，不再依赖 DOM 读取状态。
- **样式与选择器作用域物理隔离 (Style & Scope Isolation)**：
  - 旧版样式表（`game.css`）中的未分层全局重置（如 `* { margin: 0; padding: 0 }`）已配置排除选择器（`:not([data-ui-element], [role="tablist"], ...)`），严禁破坏这一隔离规则导致 Tailwind 实用类 padding 被覆盖。
  - 现代 UI 测量工具（`UIInspector.ts`）与选择器查询必须限定在当前激活的 `[data-ui-element="menu-shell"]` 容器内，严禁在 `document` 全局随意抓取选择器。

---

## 2. Technical Stack & Architectural Rationale

| Layer | Technology | Rationale & Architectural Rule |
|---|---|---|
| **Headless Behavior** | Radix UI Primitives (`@radix-ui/react-*`) | **Zero style black-box**: Supplies ARIA logic, focus traps, and modal layering. Its `Portal` mounts without scale drift. |
| **Motion & Morphing** | Framer Motion (`MorphContainer`) | **Unified Morphing Engine**: Layer 1 opens/closes instantly; sub-menu transitions utilize Apple HIG cubic-bezier `FluidMorphTransition` (0.28s) or `SequencedStepTransition` (100ms fade-out + 150ms resize + 100ms fade-in). |
| **Styling & Layout** | Tailwind CSS v4 & SimpleUI Tokens | Tokenized paddings (`UI_SPACING`), border radii (`UI_RADIUS`), and semantic themes (`ACCENT_THEMES`). |
| **Live Preview Paradigm**| `LivePreviewShell` + `useUIStore` | When tuning spatial parameters (e.g. Ball Trajectory), pressing **TAB** initiates sequenced step transition: content fades out -> container resizes & docks to right edge -> pill (`<` + `TAB`) appears. Smooth morph provides visual stowage guidance while unpausing live simulation. |
| **Floating Telemetry**  | `FloatingWindowManager` + `floatingStore` | Draggable, resizable diagnostic cards with sequenced minimization into the top-right Stack bubble. |
| **State & Engine Bridge** | Zustand (`useUIStore`) | **Single Source of Truth**: Unified store managing Camera, Graphics, Audio, Vehicle, Gameplay, and Trajectory settings with bi-directional bridge to `GameRuntime`. |

---

## 3. Component Architecture (Presentational vs State Hub)

```
[ UI Layer (ui-system/recipes & navigation) ]
         ↑ Pure Props & Event Callbacks (onClick, onChange, onBack)
         ↓
[ State Hub (ui-system/core/store.ts: useUIStore) ]  ← Single Source of Truth
         ↑ Reactive Subscription & Bridge Actions
         ↓
[ Game Engine Runtime (Three.js / Camera / Audio / RocketSim WASM) ]
```

### 3.1 File Organization & Agent Friendliness
All UI files are strictly kept under **20KB** for optimal LLM context ingestion:
- `tokens/`: Design tokens (`spacing.ts`, `radius.ts`, `easing.ts`, `colors.ts`, `livePreviewStore.ts`, `floatingStore.ts`)
- `primitives/`: Atomic controls (`Button`, `Badge`, `KeycapBadge`, `SegmentedSwitch`, `SliderControl`, `ToggleSwitch`, `UnderlineTabs`, `UnderConstructionPlaceholder`)
- `layout/`: Structural stacks (`VStack`, `HStack`, `GridStack`, `Card`, `PanelContainer`, `PanelHeader`, `PanelContent`, `PanelFooter`)
- `navigation/`: Transitions & shells (`MorphingShell`, `MorphContainer`, `LivePreviewShell`, `LivePreviewDock`, `FloatingWindowManager`, `FloatingStackIcon`)
- `recipes/`: Product-standard menu views (`Layer1MainMenuRecipe`, `Layer2PlayRecipe`, `Layer2GarageRecipe`, `Layer2SettingsRecipe`, `Layer3AudioDetailRecipe`, `Layer3BallTrajectoryRecipe`, `KeybindingRecipe`)
- `core/`: State & viewport engine (`store.ts`, `GameViewport.tsx`, `SafeAreaHud.tsx`, `MenuShell.tsx`, `UIInspector.ts`)

---

## 4. UIStorybook 视觉与布局对齐基准 (UIStorybook Layout Metrics)

UIStorybook（`https://github.com/Antigravi-ty/UIStorybook`）作为视觉与布局规范的 Single Reference Design。在移植和调优时，需保证 `generateLayoutReport` 导出的快照数据与 UIStorybook 完全匹配：

### 4.1 Garage (Layer 2 菜单规范)
- **Menu Container**: Width `680px` (Max-W `680px`), padding `0px`, overflow `hidden`.
- **Panel Header**: Height `76px ~ 78px`, padding `top=20px right=24px bottom=16px left=24px`.
- **Underline Tabs Wrapper**: `data-ui-element="tabs-wrapper"` 必须保持 `px-6 pt-2`，确保 Tablist 宽度为 `630.3px` (容器 678.3px - 左右各 24px)。
- **Tab Buttons**: 4 个选项卡，尺寸 `157.6px × 39.1px`，Padding `top=10px right=16px bottom=10px left=16px` (`py-2.5 px-4`)。
- **Panel Content (Body)**: 固定高度 `h-[400px]`，Padding `top=20px right=24px bottom=20px left=24px`。
- **Vehicle Option Cards (8 items)**: 4 列 2 行网格，单个 Card 尺寸 `150.1px × 76px`，`min-h-[76px]`，Padding `top=14px right=14px bottom=14px left=14px` (`p-3.5`)。
- **Panel Footer**: Height `~53px`，Padding `top=16px right=24px bottom=16px left=24px`。

---

## 5. Fast Modification Matrix for Agents

When implementing or extending features, ONLY touch the mapped files:

| Goal | Target File | Notes |
|---|---|---|
| Add new menu route | `core/store.ts` & `core/MenuShell.tsx` | Add route ID to `ActiveMenuRoute` union and route width map |
| Adjust Camera settings | `core/store.ts` (`updateCamera`) | Syncs with `src/config/cameraDefaults.js` and updates Three.js projection |
| Add new vehicle | `src/config/vehiclePresets.js` | Add preset with dimensions; automatically reflects in `Layer2GarageRecipe` |
| Customize Live Preview | `recipes/Layer3BallTrajectoryRecipe.tsx` | Handled via `onCollapsePreview` and `livePreviewStore` |
| Add Diagnostic Floating Window | `tokens/floatingStore.ts` (`spawnWindow`) | Rendered automatically by `FloatingWindowManager` |
| Viewport Aspect Ratio / Safe Area | `core/GameViewport.tsx` | Enforces 18:9 clamp and 1:1 portrait gate |

---

## 6. How to Add a New Panel / Recipe (Step-by-Step)

1. **Step 1: Register Route in `core/store.ts`**
   ```ts
   export type ActiveMenuRoute = ... | 'my-new-panel';
   ```
2. **Step 2: Create Pure Presentational Recipe in `recipes/MyNewRecipe.tsx`**
   Use standard `PanelContainer`, `PanelHeader`, `PanelContent`, and atomic primitives. Pass all data via Props and events via callbacks.
   If sub-features are not ready, use `<UnderConstructionPlaceholder />`.
3. **Step 3: Mount in `core/MenuShell.tsx`**
   Add route width mapping and render `{activeRoute === 'my-new-panel' && <MyNewRecipe ... />}` inside `MorphingShell`.
