# 豁免黑盒专区 (Exempt POV Microkernel Zone)

> **固化不可修改的外部黑盒模型 (Immutable External Black-Box POV Camera Model)**
> 
> 本目录为 RocketSim POV 相机微内核的专属受控黑盒专区。
> 根据系统架构契约，POV Camera 属于外部固化黑盒微内核，具有以下严格规范：
> 
> 1. **不可篡改与强哈希比对 (Tampering Prohibited & Strong Hash Check)**:
>    - 物理 WASM 文件 `camera.wasm` 的标准 SHA-256 值为：
>      `b8adc96e73372d0f53346499fb150b576fb08deb0494d8f7f7e989d9daea0854`
>    - 加载期实时通过 Web Crypto API (`crypto.subtle.digest('SHA-256', buffer)`) 进行字节流强校验。
>    - 若哈希不符或加载失败，立即抛出阻断级异常：
>      `[FATAL] POV Camera Microkernel hash mismatch or missing! Tampering detected.`
> 
> 2. **严格 ABI 与线性内存契约 (Strict ABI & Linear Memory Contract)**:
>    - 强制检查 `memory`, `getViewPtr`, `stepView`, `resetView` 四个导出符号。
>    - 严格检查 `getViewPtr()` 返回的指针必须为 8 字节对齐且落在 WASM 有效线性内存段内（容纳 42 个 Float64）。
> 
> 3. **零回退契约 (Zero Fallback Architecture)**:
>    - 彻底删除所有纯 JS 模拟或启发式兜底方法（如历史遗留的 `stepFallbackView`）。
>    - 严禁 RocketSim 物理核心 (`core.wasm`) 兜底 POV 相机。
>    - 微内核缺失或损坏时，游戏启动在首屏前置校验中立即中断，展示专属报错弹层，严禁进入主游戏循环。
