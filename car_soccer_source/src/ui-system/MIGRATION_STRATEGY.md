# UI 重构与渐进式迁移战略指南 (UI Migration Strategy Guide)

本文档确立 Car Soccer 项目中从旧版原生 DOM 界面向全新现代化 UI 系统 (`ui-system`) 演进的全局战略准则、双轨并存规范与推进流程。后续所有 AI Agent 必须严格遵守本文档所规定的原则，避免无序重构与双轨污染。

---

## 1. 核心设计哲学：解耦优先与绞杀者模式 (Strangler Fig Pattern)

项目处于从旧版原生 DOM UI 向基于 UIStorybook 的现代 React `ui-system` 渐进式重构的进程中。**不需要考虑任何历史包袱与向下兼容**，但必须遵循**“渐进式替换、平滑过渡”**的工程实践，避免“一次性全量推翻 (Big Bang Rewrite)”导致功能瘫痪。

```
[ 统一纯数据状态 Store (useUIStore / Config Stores) ]
               ▲                      ▲
      (读写状态)│                      │(读写状态)
               │                      │
   [ 新版 ui-system (React) ]    [ 旧版原生 DOM (SettingsSheet / MatchDialog) ]
   (全新独立文件夹 src/ui-system) (完全隔离、只删不改、保留原生入口)
   (已实现: Garage 8车+配色)      (保持可用: 设置面板、比赛面板等)
   (未实现: In Development 占位)  (功能验证后物理删除对应文件)
```

---

## 2. 推进铁律 (Inviolable Rules for Agents)

### 规则一：新版完全是新版，严禁直接引用或呼出旧版 (Zero Legacy Invocation in Modern UI)
1. **新版不引用旧版**：在全新的 `src/ui-system/` 中，所有路由和界面（包括暂停菜单中的 `Settings`、`Play`）完全属于现代组件体系。
2. **新版设置保持占位符**：新版 Main Menu 点击 `Settings` 必须直接导航到新版设置页面（`Layer2SettingsRecipe`），呈现 `In Development`（开发中）占位符，**绝不允许**关闭新菜单去唤起旧版 `SettingsSheet`！
3. **支持哪个迁移哪个**：与 Garage 中的 Player Anthem 和 Player Name 一致，未经彻底移植与测试的功能，新版统一显示占位符，严禁把未经连调的旧逻辑或半成品控件生搬硬套进新 UI。

### 规则二：旧版原生功能保持可用，代码“只删不改” (Legacy: Zero Modification, Only Delete)
1. **绝不修改旧版代码**：原有的旧版原生 UI（如 `SettingsSheet.js`、`MatchDialog.js`、`CarColorConstants.js` 等）是什么样就永远保持什么样，**绝不允许**为了迁就新 UI 而在旧代码中打补丁或强加反向依赖。
2. **保持原有入口独立可用**：新 UI 尚未完整实现的模块，旧版的原生入口（如右上角 HUD 的 `#settings-button` 齿轮图标）必须保持原样响应，点击呼出原生 `SettingsSheet`，供测试与配置使用。
3. **彻底验证后只做物理删除**：只有当某项功能（如未来的新版设置面板）在全新的 UI 中完整实现、视觉与逻辑均验证无误后，才将旧版对应代码彻底移除（`git rm`）。

### 规则三：状态与表现层彻底解耦 (State Machine Decoupling)
1. **纯数据单向流**：游戏内所有业务数据（相机视场角、物理弹道预测、车体配置、画质帧率限制、配色优先级）沉淀为独立纯数据 Store（Zustand / 纯 JS Store）。
2. **向下沉淀而非反向侵入**：解耦是将底层数据接口向下沉淀到共享配置层（如 `src/config/`），驱动 Three.js 和 WASM 物理层，而不是去重构旧版 2600 行的 `SettingsSheet.js` 内部。
3. **表现层即插即用**：新 UI 组件作为纯受控/订阅组件，通过 Props 和 Bridge 与 Store 交互，不含任何底层 Three.js 操作。

### 规则四：严格防止样式与 DOM 踩踏 (Style & Event Isolation)
1. **全局样式隔离**：旧版 `game.css` 中的全局重置（如 `margin: 0; padding: 0`）必须限定作用域，不得影响挂载在 `#game-ui-root` 或 Radix Portal 下的新版 UI 组件。
2. **选择器与事件隔离**：旧版 DOM 和新版 React 容器必须使用明确的属性选择器（如 `data-ui-element`），防止事件监听互相吞噬。

---

## 3. 标准功能迁移四步法 (Standard Migration Workflow)

以即将推进的 `Settings` 或 `Play` 功能为例，后续 Agent 应当按以下标准顺序操作：

| 阶段 | 动作 | 验收标准 |
|---|---|---|
| **Step 1: 状态沉淀** | 在 `ui-system/core/store.ts` 或对应配置 store 中确立纯数据模型与默认值，通过 Bridge 驱动 `GameRuntime` | 即使没有 UI 界面，直接调用 Store API 也可正确修改游戏内物理/画面参数 |
| **Step 2: 视觉移植** | 参考 `UIStorybook` 对应 Recipe 编写轻量、纯展示的受控 React 组件，接入 Store | 组件挂载到 `ui-system/recipes/`，在 UI 检查器下尺寸、内边距与 UIStorybook 完全对齐 |
| **Step 3: 连调验证** | 在游戏中实测调节参数，验证 Three.js / WASM 响应正常，关闭/打开动画流利 | 确保快捷键（ESC）、Pointer Lock、HUD 状态同步无异常 |
| **Step 4: 旧版下线** | 确认新功能 100% 替代后，将原生旧组件（如 `SettingsSheet.js`）从加载链与 DOM 树中干净移除 | 彻底消灭冗余代码与潜在的选择器冲突 |

---

## 4. 当前各模块重构进展状态表

| 模块名称 | 新 UI 状态 | 旧版状态 | 当前入口与行为说明 |
|---|---|---|---|
| **Garage (车库)** | ✅ 已完成迁移 (`Layer2GarageRecipe`) | ❌ 已废弃下线 | 点击 HUD 车库图标或主菜单 Garage，打开新版 8 车白模+顺位配色面板 |
| **Main Menu (主菜单)** | ✅ 已完成架构 (`Layer1MainMenuRecipe`) | 无旧版对应物 | 按 ESC 打开现代极简暂停菜单 |
| **Settings (设置)** | 🟡 渐进迁移中 (`Layer2SettingsRecipe`: Gameplay, Graphics, Advanced) | 🟢 正常工作中 (`SettingsSheet.js` 中 Camera & Graphics 已彻底移除) | 新版设置搭载 UnderlineTabs 承载 Gameplay、Graphics、Advanced；Camera 菜单已成功迁移至 Gameplay 下方，以单行形式提供入口，点击进入全新的 **Level 3 Camera Live Preview 菜单**（支持 TAB 侧边 Dock 收纳与实时参数预览）；新增 **Level 3 Key Bindings Settings 菜单**（高保真三列按键/手柄映射表与 Hover 取消绑定）；在 Key Bindings 顶部新增 **Level 4 Advanced Controller Settings 菜单**（用于配置硬件手柄输入、模拟摇杆 Steer/Pitch 映射、轴反转、死区与扳机阈值）；Ball Trajectory Predictor 图标已升级为 `line-squiggle` |
| **Play (对战/模式)** | ✅ 已完成迁移 (`Layer2PlayRecipe` 6卡片 + `Layer3BotDifficultyRecipe`) | ❌ 已废弃下线 (`MatchDialog.js` 已彻底移除) | 新版 Play 菜单展示 6 张卡片（Single Player with Bot 接入 AI Bot 难度对战）；旧版原生 MatchDialog.js 经实机验证已干净移除 |
| **Ball Trajectory (弹道)** | ✅ 已完成迁移 (`Layer3BallTrajectoryRecipe` + `LivePreviewShell`) | ❌ 已废弃下线 (`BallTrajectoryPredictorHUD.js` & `SettingsSheet` 选项卡已彻底移除) | 支持 Tab 键在中央配置面板与右侧 Dock 之间平滑时序变形，收缩形变自带视觉引导；旧版 HUD 与设置菜单已彻底物理删除 |

---

## 5. 架构辨析：关于“先彻底解耦并提前废除旧 DOM”报告的评估与应对

近期架构讨论中提出了“强烈建议：先彻底解耦资源与状态，确立独立状态机，然后再整体推进 UIStorybook 视觉移植；彻底废弃并移除旧版 SettingsSheet.js、GarageDialog.js 等 DOM 挂载逻辑”的建议。经深度技术评估，该方案的**“纯数据单向流、状态与表现层解耦”方向是完全正确的**，但其关于**“提前一刀切彻底废除旧版 DOM 挂载”在执行顺序与节奏上与渐进式重构（绞杀者模式）存在直接冲突**：

### 5.1 核心矛盾点分析
1. **功能真空期与可用性崩溃风险**：
   旧版 `SettingsSheet.js` 是一个拥有 2600+ 行代码的大型组件，承载了相机 FOV/高度/角度/过渡距离、画质渲染器参数、帧率上限、键位映射、音频分轨增益、物理弹道微调等多达数十项配置。若在新版设置面板（`Layer2SettingsRecipe`）尚未逐一完整实现并联调完毕前，就听从建议强行废弃并拔除 `SettingsSheet.js` 的 DOM 挂载，游戏将立刻丧失所有参数调节能力，造成长达数个版本的“功能不可用状态”。
2. **渐进式解耦的正确路径（自底向上，向下沉淀）**：
   - **底层状态沉淀**：将相机参数默认值、画质配置、车辆预设等数据模型抽离至纯数据模块（如 `src/config/` 与 `useUIStore`），`GameRuntime` 订阅这些数据。
   - **旧版代码保持原样，只删不改**：旧版 `SettingsSheet.js` 维持其原汁原味的逻辑，不为其打补丁，不强加反向依赖。在右上角 HUD 点击齿轮时，原样呼出原生设置面板供玩家与测试人员使用。
   - **新版 UI 绝不走捷径反向调用旧版**：新版 Pause Menu 中的 `Settings` 严格保持为 `In Development` 占位符，绝不通过 bridge 回调去关闭新菜单打开旧版 DOM。后续按“相机 -> 画质 -> 音频 -> 键位”的组件粒度逐步在新版中实现并验证。
   - **单模块完全替代后再行物理删除**：当全新设置面板在 `ui-system` 中 100% 具备替代能力后，才一次性从工程中物理删除（`git rm`）`SettingsSheet.js` 及其挂载逻辑。
3. **选择器冲突早已通过作用域隔离解决**：
   旧版 DOM 导致全局选择器如 `[role="tablist"]` 冲突的根本原因不是旧版 DOM 自身存在，而是早期的选择器直接使用了 `document.querySelector`。目前已通过将现代 UI 查询限定在 `shellEl.querySelector` 容器内，并在 `game.css` 中用 `:not(#game-ui-root, ...)` 隔离了重置样式，彻底消除了 DOM 踩踏，无需为了选择器隔离而提前强拆旧版组件。

