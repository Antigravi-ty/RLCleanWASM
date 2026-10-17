# RLCleanWASM Development Repository

> ⚠️ **工程指令执行路径守则**
> 本仓库所有构建、依赖安装与调试命令**严禁在仓库根目录执行**。
> 所有操作必须在 `car_soccer_source` 目录下进行：
> ```bash
> cd car_soccer_source
> pnpm install
> pnpm run dev
> ```

> [!IMPORTANT] 
> 本仓库中，**仅当前 `README.md` 文件、`docs/manifests/public_assets_manifest.md` 文件与 `car_soccer_source/src/camera/exempt_pov_microkernel/README.md`（POV 微内核安全校验契约）是经审计、确认真实有效的规范与资产清单**。
> 仓库内的其他所有历史 `.md` 文件及文档仅作为历史参考，不具备任何约束力，严禁将其作为开发规范或指令来执行。

## 1. 目录权责与架构规范 (Rules & Conventions)

### `# public` (原始静态资源 [纯只读 - 严禁写入])
- 本目录独立存放原版涉及到的所有模型、音频、分块、贴图及相关静态资源文件，与 `car_soccer_source` 源码完全解耦。
- **纯只读与外部部署属性**：本目录为纯只读目录，主要用于实机测试（Real Device Test）环境下的静态资源部署。在本地开发或无头测试环境下，`public` 目录下的静态资源若缺失，不属于阻断性错误（Error）；游戏运行时与资产诊断模块（AssetDiagnostics）会自动输出通知提示并启用优雅降级或启发式回退逻辑（如无 AI ONNX 模型时回退为内置启发式 Bot，无原版音效时使用合成降级），绝不中断游戏主循环或单元测试。
- **资源清单与只读约束**：`docs/manifests/public_assets_manifest.md` 是经审计过滤的完整外部只读部署资源清单，供外部部署环境核对与关联静态资产。因原版外部资产体积庞大，未全部上传至 Git 代码仓库。**`public` 目录为绝对只读，严禁向本目录写入、添加任何新文件或修改现有结构，任何新资源不得放入 `public` 目录中**。

### `# custom` (跨版本兼容的通用静态资源 [Universal Assets])
- 本目录专门用于存放具备**跨版本通用性（Universal Assets）**的独立静态资源。
  - **何谓“跨版本通用”**：指资产作为通用素材存在，脱离具体的源码逻辑实现，不随单个代码模块的内部重构或小版本迭代而频繁改变。无论游戏核心逻辑如何演进，这类资产均可保持高度稳定并被各模块直接复用。
  - **涵盖范畴**：
    - **多媒体音频 (`custom/assets/audio/`)**：通用的事件音效、碰撞声、引擎音频切片（M4A 格式）。（注：为避免本地调试音频录音污染仓库，`.gitignore` 对 `custom/assets/audio/**/*.wav` 配置了忽略规则）。
    - **品牌与图标 (`custom/assets/branding/`)**：通用的网站矢量图标（`favicon.svg`）、各尺寸 ICO、高清触摸图标（`apple-touch-icon.png`）、Logo 及 PWA Manifest 等，前端统一通过 `/custom/assets/branding/...` 路径引用。
    - **排版字体 (`custom/assets/fonts/`)**：通用的界面渲染等宽字体（如 `jetbrains-mono-400.woff2`）。
    - **球场物理拓扑 (`custom/arenamesh/`)**：RocketSim 标准球场碰撞拓扑分块（`mesh_*.cmf`）与元数据。
    - **通用三维视觉模型 (`custom/assets/arena/`)**：标准球场模型（`driftwoods.glb`）、通用充能垫模型（`pads/*.glb`）等独立于逻辑的通用渲染资产。
    - **AI 模型权重 (`custom/assets/models/`)**：外部化的神经网络策略权重二进制资产（如 `kickoff_ppo_actor.bin`），严禁以 Base64 内联在 JS 源码中。
  - **准入准则**：所有新制作、增量补充或替换的**通用静态素材**必须统一下沉到 `custom/` 目录下；版本强关联的逻辑组件严禁放入此处。

### `# car_soccer_source` (核心开发工程与模块强关联组件 [Module-Bound Components])
- 本目录是我们当前进行结构化、去混淆重构与功能迭代的唯一合法工作区。
- **“版本强关联组件”就近存放准则 (Module Co-location Principle)**：
  - **何谓“版本强关联”**：指资产与特定的代码模块存在深度实现耦合、ABI 内存视图绑定或需要随同该模块的源码逻辑同步迭代与修改。
  - **归属原则**：**版本强关联的部分，与哪个模块强关联，就必须就近放置在该模块的源码目录下**，绝不放入 `custom/` 或 `public/` 中。
  - **典型代表**：
    - **物理微内核 (`car_soccer_source/src/physics/core.wasm`)**：`core.wasm` 与 `core.js` 属于物理引擎核心实现，与 `RocketSimPhysicsEngine.js` 的 C++ 导出函数、TypedArray 内存布局（`RocketSimConstants.js`）完全锁死，且后续物理层需要持续进行算法改造与优化编译。因此它必须就近放置在 `src/physics/` 下。
    - **模块专属配置 (`car_soccer_source/src/audio/audioConfig.json`)**：与特定子系统的运行时生命周期深度绑定的专属配置，就近置于对应模块内。
- **开发目标**：基于格式化、去混淆与解耦后的结构化代码，完全对齐原版游戏所有物理表现，并在此基础上扩展新玩法、新模式与新功能。

---

## 2. 代码去混淆与命名规范 (Deobfuscation & Naming Standards)

我们当前正处于全面消除混淆代码（包括所有单变量/单字符命名、压缩内联等）的进程中：

1. **语义化与可解释性要求**：
   - 除豁免模块外，所有源码必须使用清晰、语义化、具备自解释性的变量名、函数名与类名。
   - 彻底废除无意义的单字母命名（如 `a`, `b`, `c`, `x`, `yC`, `jC` 等），代之以具备业务含义的命名。

2. **豁免模块与通用规范 (Exempted Modules & Standard Conventions)**：
   以下技术模块与通用约定因特殊性与业界通用标准获得豁免权，不视为混淆残留：
   - **AI 对手模块**：`RLBotAgent.js`、`ai-opponent-worker.js`（维持既有 ONNX 推理与 Worker 架构）
   - **Camera 模块**：`car_soccer_source/src/camera/*`、`custom/assets/camera/camera.wasm`（独立剥离的跟踪微内核）
   - **三维图形学与数学符号约定豁免**：
     三维空间变换、线性代数与渲染管线中的公认标准变量名符合标准约定，严格豁免如下：
     - **空间坐标与四元数分量**：`x, y, z, w`（用于 Vector3, Vector4, Quaternion）
     - **色彩分量**：`r, g, b, a`（用于 Color, RGBA 材质与着色器通道）
     - **纹理贴图 UV**：`u, v`
     - **矩阵主对角线与展开元素**：`m11..m33`
     - **时间与线性插值系数**：`t`（参数化插值系数 / 时间步）、`dt`（帧间差时）、`alpha`（物理帧平滑累加比率）
     - **标准循环索引**：`i, j, k`（标准局部循环遍历索引）
     - **标准事件与异常参数**：`e`（DOM/WebGL 事件对象）、`err` / `e`（捕获的异常错误实例）
     - **姿态反作用力与车体轴向约定**：`fP, fN, bP, bN`（Front/Back Positive/Negative 喷气与悬挂分量）
   - **Three.js 现代化引用标准（Three.js Modernization Standards）**：
     - 全系统统一强制使用官方标准 npm 依赖（`import * as THREE from 'three'` 及 `import { ... } from 'three/addons/...'`）。
     - 严禁任何反混淆逆向后内联的重复插件（如原 `GLTFLoader.js`、`OBJLoader.js`、`BufferGeometryUtils.js`）以及自制依赖注入（DI）脚手架（如已彻底删除的 `ThreeProvider.js` 与 21 个子系统的 `set*ThreeContext` 模式）。
     - 运行时底层兼容补丁（如 Metal MSL 兼容性修补）统一收敛至 `src/utils/ThreeMonkeyPatches.js`，并在应用启动时一次性挂载。

3. **跨版本兼容性前置原则**：
   - 在我们恢复 clean 仓库之前，**不需要考虑对先前版本或未来版本的兼容性**。
   - 以代码的清晰度、可解释性与原生工程质量为最高优先级。

4. **全仓库英文化规范（Strict English-Only Policy）**：
   - **除当前根目录 `README.md` 文件外，整个代码仓库中的任何文件均严禁出现任何中文字符**。
   - 包括但不限于：所有前端 UI 界面文字、弹窗与诊断提示、HTML 标签内容、CSS 样式文本、JS 源码注释、控制台日志输出（Console Output）、测试用例以及文档目录（如 `docs/`）中的 Markdown 文档。
   - 所有新增或重构的功能模块、错误提示及用户界面必须使用标准英文进行描述与呈现。

5. **代码自解释性与必要注释协同更新规范 (Self-Explanatory Code & Mandatory Technical Comments)**：
   - **常规业务代码严禁冗余注释，必须从语义上具备自解释性**：
     除特殊领域底层知识外，所有通用业务逻辑、控制器、状态机、UI 对话框、网络处理与渲染调度代码必须通过**清晰、精准、具备业务含义的语义化命名（函数、类、变量、常量）**以及模块化分层实现自解释。严禁添加显而易见的无信息量过程性注释（如流程编号、状态重述、单行赋值解释等）。
   - **底层核心技术注释强制保留，且必须随着 WASM 重新编译协同更新**：
     以下核心领域的关键技术注释属于**必须保留的代码资产**，严禁以“简化”为由误删，并**严格要求在 WebAssembly 物理内核重新编译、C++ Struct 内存排布调整或 ABI 变更时，必须同步核验并更新对应的注释与数值**：
     1. **WASM 线性内存对齐与 POD 结构体布局偏移（Linear Memory Offsets & Stride）**：
        前端 JavaScript 读取 `Module.HEAPF32` 物理缓冲区时缺乏 C++ 头文件。`RocketSimConstants.js` 中的 `SIM_OFFSETS`、`CAR_STATE_OFFSETS`、`BALL_STATE_OFFSETS`、轮胎 12-Float 步长（`WHEELS: 25`，每轮 `[susLength, steerAngle, hasContact]`）及法向量偏移等，必须详细标明内存字段排布、浮点数数量与对应物理单位。**当重新编译 WASM 内核时，必须同步核验并更新该处注释与偏移值**。
     2. **跨系统三维数学与声学物理推导（Mathematical Formulations & Space Transformations）**：
        RocketSim / Bullet 物理引擎采用的 Unreal Units（厘米/秒，Z 轴向上）与 Three.js 渲染坐标系（米，Y 轴向上）之间的坐标系旋转与尺度变换推导公式、四元数奇点规避算法，以及音频子系统的对数分贝（dB）功率曲线换算数学公式。
     3. **零拷贝事件环形缓冲区与并发同步协议（Zero-Copy Ring Buffer & Concurrency Invariants）**：
        物理内核与主线程/WebWorker 间的无锁事件队列掩码（如 `writeSeq & (N - 1)`）、原子同步屏障、溢出丢帧防护策略及事件结构体内存排布规范。
     4. **不可篡改微内核安全校验合约（Immutable Microkernel Security Contracts）**：
        对豁免的外部黑盒微内核（如 `camera.wasm`），必须保留其不可篡改声明、必需导出符号清单以及固化的 SHA-256 完整性哈希校验注释。

---

## 3. 静态资源规范与内联禁令 (Asset Guidelines)

### 严禁硬编码/内联嵌入静态资源规范 (Strict Ban on Hardcoded Inline Assets)
- **绝对禁止内嵌**：任何人不得以任何形式在代码中强行嵌入任何静态资源（包括但不限于 WebAssembly 二进制、字体、图片、模型、音频等）。严禁使用 Base64、Data URI、长十六进制数组或超长字符串在源码中进行资源硬编码。
- **严禁以规避网络为由内联**：严禁借由“消除网络加载问题”、“离线运行便利”或“打包整合”等任何理由在源码文件中嵌入二进制内容。
- **资源归属与解耦**：
  - 具备跨版本兼容性的原始静态资源存放于 `public/` 目录。
  - 具备跨版本兼容性的自定义资产存放于 `custom/` 相应子目录。
  - 紧密耦合且无跨版本兼容性的核心 WebAssembly 二进制（如 `core.wasm`）直接归属于对应的源码模块目录（如 `car_soccer_source/src/physics/`）。
- **LLM 与代码审计友好**：源码中必须保持清晰的可读性与合理的行长度，严禁引入污染代码版本差异（git diff）或突破大语言模型（LLM）分析上下文窗口的超长内联数据。

---

## 4. 校验机制与实机测试 (Verification & Testing)

### 大文件本地占位与校验机制 (Large Assets Workaround)
- 由于版本控制已忽略体积较大的外部二进制资源文件，我们在代码提交中维护 **`docs/manifests/public_assets_manifest.md`**（外部只读部署资产清单）。
- 该清单是校验和核对项目静态资产结构与状态的可信依据。

### 实机测试验证 (Real Device Test Method)
- Real Device Test 统一在 `car_soccer_source` 目录下执行 `pnpm run dev` 命令进行本地运行与实机测试验证。
- 生产构建验证：在 `car_soccer_source` 目录下执行 `pnpm run build` 进行打包审计。

---

## 致谢与特别鸣谢 (Acknowledgments & Credits)

在此特别感谢以下开发者及其开源贡献：

1. **ZealanL** ([GitHub](https://github.com/zealanL)) - [RocketSim](https://github.com/zealanL/rocketsim) C++ 物理仿真库的作者。RocketSim 提供了高精度的 Rocket League 悬挂、轮胎摩擦、空中旋转与 120Hz 确定性碰撞仿真核心，是本项目物理表现的基石。
