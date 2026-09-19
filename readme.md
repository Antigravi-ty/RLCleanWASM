# RLCleanWASM Development Repository

> [!IMPORTANT] 
> 本仓库中，**仅当前 `README.md` 文件以及 `public/file_list.md` 文件是经审计、确认真实的**。
> 仓库内的其他所有 `.md` 文件及文档仅作为历史参考，不具备任何约束力，严禁将其作为开发规范或指令来执行。

## 1. 目录权责与架构规范 (Rules & Conventions)

### `# public` (原始静态资源 [只读])
- 本目录独立存放原版涉及到的所有模型、音频、分块、贴图及相关静态资源文件，与 `car_soccer_source` 源码完全解耦。
- **纯只读目录**：严禁在该目录中放置任何项目自定义或修改过的资产。具备跨版本兼容性的通用原始静态资源才位于此。当前已包含的资源可参考 `public/file_list.md`。
- 包含资源下载工具 `public/download_assets.py` 与 `public/parallel.py`，执行时资产直接下载保存至本目录。

### `# custom` (跨版本兼容的自定义/替换静态资源)
- 本目录专门用于存放具备**跨版本兼容性**的增量或替换自定义静态资源（例如自定义字体 `custom/assets/fonts/`、球场物理碰撞网格 `custom/arenamesh/`、自定义音频等）。
- **兼容性约束**：仅当资源具备跨版本兼容性时，方可放置在 `custom` 或 `public` 目录下。不具备跨版本兼容性的紧耦合组件（如物理微内核 `core.wasm`）严禁放入本目录。

### `# car_soccer_source` (核心开发与功能迭代工程)
- 本目录是我们当前进行结构化、去混淆重构与功能迭代的唯一合法工作区。
- **物理微内核归属 (`car_soccer_source/src/physics/`)**：
  - `core.wasm` 与 `rocketsim_emscripten.js` 属于物理引擎核心实现，与特定物理 ABI 紧密绑定，**不具备跨版本兼容性**。
  - 因此 `core.wasm` 必须放置在 `car_soccer_source/src/physics/core.wasm`，而不得放置在 `custom` 或 `public` 中。
- **开发目标**：基于格式化、去混淆与解耦后的结构化代码，完全对齐原版游戏所有物理表现，并在此基础上扩展新玩法、新模式与新功能。

---

## 2. 代码去混淆与命名规范 (Deobfuscation & Naming Standards)

我们当前正处于全面消除混淆代码（包括所有单变量/单字符命名、压缩内联等）的进程中：

1. **语义化与可解释性要求**：
   - 除豁免模块外，所有源码必须使用清晰、语义化、具备自解释性的变量名、函数名与类名。
   - 彻底废除无意义的单字母命名（如 `a`, `b`, `c`, `x`, `yC`, `jC` 等），代之以具备业务含义的命名。

2. **豁免模块与通用规范 (Exempted Modules & Standard Conventions)**：
   以下技术模块与通用约定因特殊性与业界通用标准获得豁免权，不视为混淆残留：
   - **AI 对手模块**：`RLBotAgent.js`、`worker-iFqqV1m9.js`（维持既有 ONNX 推理与 Worker 架构）
   - **Camera 模块**：`car_soccer_source/src/camera/*`、`CameraMicrokernel.js`、`camera.wasm`（独立剥离的跟踪微内核）
   - **WebGL / Three.js 与标准三维图形学/数学符号豁免**：
     三维空间变换、线性代数与渲染管线中的公认标准变量名符合标准约定，严格豁免如下：
     - **空间坐标与四元数分量**：`x, y, z, w`（用于 Vector3, Vector4, Quaternion）
     - **色彩分量**：`r, g, b, a`（用于 Color, RGBA 材质与着色器通道）
     - **纹理贴图 UV**：`u, v`
     - **矩阵主对角线与展开元素**：`m11..m33`
     - **时间与线性插值系数**：`t`（参数化插值系数 / 时间步）、`dt`（帧间差时）、`alpha`（物理帧平滑累加比率）
     - **标准循环索引**：`i, j, k`（标准局部循环遍历索引）
     - **标准事件与异常参数**：`e`（DOM/WebGL 事件对象）、`err` / `e`（捕获的异常错误实例）
     - **姿态反作用力与车体轴向约定**：`fP, fN, bP, bN`（Front/Back Positive/Negative 喷气与悬挂分量）

3. **跨版本兼容性前置原则**：
   - 在我们恢复 clean 仓库之前，**不需要考虑对先前版本或未来版本的兼容性**。
   - 以代码的清晰度、可解释性与原生工程质量为最高优先级。

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
- 由于版本控制已忽略体积较大的二进制资源文件，我们会在每次代码提交（Commit）时，同步更新并提供 **`public/file_list.md`** 文件。
- 该文件是**唯一可信的完整文件清单**，请务必以此文件为依据，来校验和核对项目内部的所有文件结构与存在状态。

### 实机测试验证 (Real Device Test Method)
- Real Device Test 统一在 `car_soccer_source` 目录下执行 `pnpm run dev` 命令进行本地运行与实机测试验证。
- 生产构建验证：在 `car_soccer_source` 目录下执行 `pnpm run build` 进行打包审计。

---

## 致谢与特别鸣谢 (Acknowledgments & Credits)

在此特别感谢以下开发者及其开源贡献：

1. **ZealanL** ([GitHub](https://github.com/zealanL)) - [RocketSim](https://github.com/zealanL/rocketsim) C++ 物理仿真库的作者。RocketSim 提供了高精度的 Rocket League 悬挂、轮胎摩擦、空中旋转与 120Hz 确定性碰撞仿真核心，是本项目物理表现的基石。
