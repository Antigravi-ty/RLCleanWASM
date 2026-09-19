# 移除的 Serial 机制与 Wheel Impact / Flip Reset 实现档案

## 1. 概述与背景 (Overview)

在早期的 RocketSim WASM 与 Web 端集成架构中，前端音效与视觉特效通过轮询共享内存中单调递增的 `Serial` 计数器（如 `jumpSerial`, `dodgeSerial`, `wheelImpactSerial`, `flipResetSerial` 等）来触发。

为了彻底抛弃历史包袱，使整套物理与渲染/音频管道**全面转向零拷贝事件环形缓冲区（Event Ring Buffer）**，我们已经完全移除了 C++ `CarStatePOD` 和 JavaScript 中所有 `Serial` 相关的内存字段及轮询机制。

其中：
- `CAR_ACTION`（跳跃、二段跳、翻滚翻转）、`CAR_SUPERSONIC_ENTER`、`CAR_BALL_HIT`、`CAR_CAR_COLLISION`、`BALL_WORLD_HIT`、`BALL_GOALPOST_HIT`、`BOOST_PICKUP` 等均已完整接入 Native Event Ring Buffer。
- **Wheel Impact（车轮着陆落地减震）** 与 **Flip Reset（四轮触球重置翻滚）** 暂时未扩展为底层 Ring Buffer Event。为了避免残留不合理的 Serial 轮询代码，其 Serial 相关代码已从核心代码库中剥离。

本文档将这两个特性的原始实现逻辑、音频算法与完整代码扣出归档，以便未来通过 Native Event Ring Buffer 或其他解耦方式重新恢复这两个效果。

---

## 2. 车轮落地减震 (Wheel Impact) 实现档案

### 2.1 C++ 物理层原始检测逻辑 (`RocketSimBridge.cpp`)
车辆在空中飞行后四轮着陆时，且垂直下砸速度绝对值超过阈值（200 uu/s）时触发：

```cpp
// 追踪变量声明 (原 CarTracker 结构体中)
float wheelImpactSerial = 0.0f;
float wheelImpactSpeed = 0.0f;
bool prevOnGround = true;

// 物理步进每 tick 判定逻辑 (原 _physics_step 中)
if (cs.isOnGround && !tracker.prevOnGround && std::abs(cs.vel.z) > 200.0f) {
    tracker.wheelImpactSerial += 1.0f;
    tracker.wheelImpactSpeed = std::abs(cs.vel.z);
}
tracker.prevOnGround = cs.isOnGround;

// 拷贝到共享内存 CarStatePOD (原 offset 44, 45)
cPod.wheelImpactSerial = tracker.wheelImpactSerial;
cPod.wheelImpactSpeed = tracker.wheelImpactSpeed;
```

### 2.2 前端消费与音频处理逻辑 (`GameAudioSubsystem.js` / `VehicleActionAudio`)

#### 音频资源定义
音频文件路径位于 `/assets/audio/vehicle/`：
```javascript
export const VEHICLE_ACTION_AUDIO_BASE_PATH = '/assets/audio/vehicle';
export const VEHICLE_ACTION_SOUNDS = {
  // ...
  wheelImpact: ['wheel-impact-01', 'wheel-impact-02', 'wheel-impact-03', 'wheel-impact-04']
};
```

#### 原状态轮询与音量衰减计算逻辑
```javascript
// 在 VehicleActionAudio.update(state) 中:
if (current.wheelImpactSerial !== this.previous.wheelImpactSerial && state.wheelImpactSpeed >= 50) {
  // 根据下砸速度计算非线性增益曲线 (2000 uu/s 归一化)
  const normSpeed = Math.max(0, Math.min(1, state.wheelImpactSpeed / 2000));
  const gainMult = Math.pow(10, (-4.582 * (1 - normSpeed)) / 20); // dbToLinear(-4.582 * (1 - normSpeed))
  this.play('wheelImpact', 0.3 * gainMult);
}
```

#### 原前端 GameRuntime 帧循环驱动
```javascript
// 在 GameRuntime.js 渲染帧更新中:
this.actionAudio.update({
  // ...
  wheelImpactSerial: playerCarView.wheelImpactSerial,
  wheelImpactSpeed: playerCarView.wheelImpactSpeed,
  audible: !playerCarView.isDemoed
});
```

### 2.3 未来恢复指引 (Future Restoration Guide)
未来若需重新接入车轮着陆减震音效，推荐按以下方案接入统一事件总线：
1. **C++ 扩展子类型**：在 `PhysicsEvent` 中扩展 `CAR_ACTION_WHEEL_LANDING = 3`，并在 `ev.carAction.impactSpeed = std::abs(cs.vel.z)` 中携带冲击速度。
2. **事件派发**：在 `_physics_step()` 检测到 `cs.isOnGround && !tracker.prevOnGround && std::abs(cs.vel.z) > 150.0f` 时直接调用 `PushPhysicsEvent(ev)`。
3. **前端消费**：在 `gameAudioEngine.handleCarAction(event, camera)` 中增加对 `CAR_ACTION_WHEEL_LANDING` 的分支处理，计算声像（Pan）与速度衰减后调用 `vehicleActionAudio.play('wheelImpact', 0.3 * gainMult, pan)`。

---

## 3. 翻滚重置 (Flip Reset) 实现档案

### 3.1 C++ 物理层原始检测逻辑 (`RocketSimBridge.cpp`)
Flip Reset 是 Rocket League 的核心技巧。当车辆在空中四轮同时触球（或特殊表面）使四轮悬挂全部被压缩时，RocketSim 会重置车辆的翻转状态：

```cpp
// RocketSim 原生判定函数: !isOnGround && HasFlipOrJump() && !hasJumped
bool hasFlipReset = cs.HasFlipReset();
if (hasFlipReset && !tracker.prevHadFlipReset) {
    tracker.flipResetSerial += 1.0f;
}
tracker.prevHadFlipReset = hasFlipReset;

// 拷贝到共享内存 CarStatePOD (原 offset 25)
cPod.flipResetSerial = tracker.flipResetSerial;
```

### 3.2 前端特效驱动逻辑 (`FlipResetVisual.js`)

#### 视觉粒子与炫光组件
`FlipResetVisual` 挂载在车辆 Mesh 下方，由以下要素构成：
1. **底部星形与光环**：`core`（八角星几何体）+ `ring`（环状光圈），使用加法混合与 Bloom 发光。
2. **写实光晕效果**：`softRing` + `softCore` + `softDome`（写实风格下的半球形淡光波）。
3. **粒子飞溅 (Sparks)**：`sparks`（60 个向外放射的粒子点云）。

#### 触发与播放代码
```javascript
// 在 FlipResetVisual.js 中:
play(playSound = true) {
  this.elapsed = 0;
  this.root.visible = true;
  this.seedSparks();
  if (playSound) {
    this.audio.play();
  }
  this.updateVisual();
}

seedSparks() {
  for (let e = 0; e < RESET_SPARKS_COUNT; e += 1) {
    const idx = e * 3;
    const angle = ((e + Math.random() * 0.25) / RESET_SPARKS_COUNT) * Math.PI * 2;
    const radius = 42 + Math.random() * 8;
    const speed = 100 + Math.random() * 60;
    const height = -4 + Math.random() * 8;

    this.sparkOrigins[idx] = Math.cos(angle) * radius;
    this.sparkOrigins[idx + 1] = height;
    this.sparkOrigins[idx + 2] = Math.sin(angle) * radius;

    this.sparkVelocities[idx] = Math.cos(angle) * speed;
    this.sparkVelocities[idx + 1] = 25 + Math.random() * 45;
    this.sparkVelocities[idx + 2] = Math.sin(angle) * speed;

    this.sparkPositions[idx] = this.sparkOrigins[idx];
    this.sparkPositions[idx + 1] = this.sparkOrigins[idx + 1];
    this.sparkPositions[idx + 2] = this.sparkOrigins[idx + 2];
  }
  if (this.sparksGeometry?.attributes?.position) {
    this.sparksGeometry.attributes.position.needsUpdate = true;
  }
}
```

### 3.3 前端音频处理逻辑 (`FlipResetAudio` in `GameAudioSubsystem.js`)
```javascript
export const FLIP_RESET_AUDIO_PATH = '/assets/audio/events/reset.wav';

export class FlipResetAudio {
  constructor() {
    this.context = null;
    this.buffer = null;
    this.loading = null;
    this.load();
  }

  getContext() {
    return this.context || (this.context = getAudioContext()), this.context;
  }

  async preload() {
    if (!await this.load()) throw new Error('Flip reset audio is unavailable');
  }

  load() {
    if (this.buffer) return Promise.resolve(this.buffer);
    if (this.loading) return this.loading;
    if (typeof window === 'undefined') return Promise.resolve(null);

    const ctx = this.getContext();
    this.loading = fetch(FLIP_RESET_AUDIO_PATH).then(res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${FLIP_RESET_AUDIO_PATH}`);
      return res.arrayBuffer();
    }).then(buf => ctx.decodeAudioData(buf)).then(audioBuf => {
      this.buffer = audioBuf;
      return audioBuf;
    }).catch(err => {
      console.warn('Flip reset audio could not be loaded', err);
      return null;
    });

    return this.loading;
  }

  play() {
    if (!this.buffer) return;
    const settings = getAudioSettings();
    const layerVol = settings.vehicleSelfVolume ?? 1.0;
    const master = settings.masterVolume ?? 1.0;
    const finalVol = 0.78 * layerVol * master;

    const pool = getAudioSlotPool();
    if (pool) {
      pool.playBuffer(this.buffer, {
        volume: finalVol,
        priority: 3
      });
    }
  }
}
```

### 3.4 原前端 GameRuntime 轮询机制
```javascript
// 在 GameRuntime.js 中原逻辑:
this.flipResetVisual.update(
  dt,
  playerCarView.flipResetSerial,
  !playerCarView.isDemoed
);

// FlipResetVisual 原判定:
update(dt, resetSerial, isAlive) {
  const isNewReset = this.previousResetSerial !== null && resetSerial !== this.previousResetSerial && isAlive;
  this.previousResetSerial = resetSerial;
  if (isNewReset) {
    this.play();
    return;
  }
  // 动画时长递增及淡出
  // ...
}
```

### 3.5 未来恢复指引 (Future Restoration Guide)
未来若需重新接入 Flip Reset 特效与音效，推荐按以下方案接入：
1. **C++ 事件定义**：
   在 `RocketSimBridge.cpp` 中定义新事件类型 `EVENT_TYPE_CAR_FLIP_RESET = 8`；
2. **C++ 事件派发**：
   在物理更新检测到 `hasFlipReset && !tracker.prevHadFlipReset` 时，填充 `PhysicsEvent`（包含车辆坐标、`carIndex`、`team`）并调用 `PushPhysicsEvent(ev)`；
3. **前端消费**：
   在 `GameRuntime.js` 的 `this.physics.readEvents((event) => { ... })` 循环中：
   ```javascript
   if (event.type === PHYSICS_EVENT_TYPES.CAR_FLIP_RESET && event.carIndex === this.playerCarIndex) {
     this.flipResetVisual.play(); // 触发粒子扩散与 reset.wav 音效播放
   }
   ```
