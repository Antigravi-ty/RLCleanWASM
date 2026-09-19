import { CameraController, CameraManager, CAMERA_MODES } from '../camera/index.js';
import { verifyCameraMicrokernelIntegrity } from '../camera/exempt_pov_microkernel/index.js';
/**
 * GameRuntime.js
 * High-performance 120Hz Car Soccer Engine Session & Orchestration Runtime (deobfuscates dB & wt).
 *
 * Upstream RocketSim reference: https://github.com/zealanL/rocketsim
 * Decouples game bootstrap (dB) and 120Hz render clock tick (wt) from monolithic inline script
 * into a modular, clean ES class with semantic property names, robust error handling,
 * and seamless fallback support for headless/unit testing.
 */

import { auditRequiredAssets, formatMissingAssetsHtml } from './AssetDiagnostics.js';
import { unregisterGameServiceWorkers } from '../utils/ServiceWorkerManager.js';
import { prewarmSceneShaders } from './ShaderPrewarmer.js';
import { RocketSimPhysicsEngine, getTeamAssignment } from '../physics/RocketSimPhysicsEngine.js';
import { PhysicsStateInterpolator } from '../physics/PhysicsStateInterpolator.js';
import { RenderClockScheduler } from './RenderClockScheduler.js';
import {
  CarStateView,
  BallStateView,
  PHYSICS_EVENT_TYPES
} from '../physics/RocketSimConstants.js';

export const PLAYER_CAR_INDEX = 0;
export const BOT_CAR_INDEX = 1;
import {
  VehicleActionAudio,
  SupersonicAudio,
  EMotorSynth,
  getAudioContext,
  getMasterAudioInput,
  getAudioSettings,
  gameAudio,
  gameAudioEngine,
  boostCollectAudio,
  ballHitAudio,
  BallHitAudio
} from '../audio/GameAudioSubsystem.js';
import { updateAudioListener, SpatialAudioSource } from '../audio/SpatialAudioSource.js';
import { isEventWithinUI } from '../input/KeyboardMouseController.js';
import {
  KeyboardMouseController,
  GamepadController,
  TouchControls,
  loadInputBindings,
  getEffectiveGamepad,
  formatBindingDisplayName
} from '../input/MultiPlatformInput.js';
import { getTheme, setTheme, THEMES } from '../ui/ThemeManager.js';
import { SettingsSheet, DEFAULT_TRAINING_SETTINGS } from '../ui/SettingsSheet.js';
import { GarageDialog, garageSettingsStore } from '../ui/GarageDialog.js';
import { MatchStateMachine } from './MatchStateMachine.js';
import { RLBotAgent, botSettingsStore } from '../ai/RLBotAgent.js';
import { MatchDialog } from '../ui/MatchDialog.js';
import { BoostGaugeHUD } from '../ui/BoostGaugeHUD.js';
import { PerformanceProfiler, PerformanceOverlayHUD } from '../ui/PerformanceOverlayHUD.js';
import { SpeedometerHUD } from '../ui/SpeedometerHUD.js';
import { PhysicsRateHUD } from '../ui/PhysicsRateHUD.js';
import { EventOscilloscopeHUD } from '../ui/EventOscilloscopeHUD.js';
import { DeterminismHarness } from '../physics/DeterminismHarness.js';
import { DeterminismHUD } from '../ui/DeterminismHUD.js';
import { NetworkChannel } from '../network/NetworkChannel.js';
import { WebRTCNetworkChannel } from '../network/WebRTCNetworkChannel.js';
import { PredictionReconciler } from '../network/PredictionReconciler.js';
import { AuthoritativeServer } from '../network/AuthoritativeServer.js';
import { WebRTCChannel } from '../network/WebRTCChannel.js';
import { HeadlessClient } from '../network/HeadlessClient.js';
import { AsymmetricInputCoordinator } from '../network/AsymmetricInputCoordinator.js';
import { NetworkReconciliationHUD } from '../ui/NetworkReconciliationHUD.js';
import {
  BoostBloom,
  FlipResetVisual,
  SupersonicSpeedLinesPass,
  RenderPass,
  ShaderPass,
  OutputPass,
  EffectComposer,
  RoomEnvironment
} from '../effects/index.js';
import { ArenaWorld } from '../entities/ArenaWorld.js';
import {
  createGameCarModel,
  applyVehicleMaterials,
  createCarPaintMaterial
} from '../entities/VehicleAssembly.js';
import { createClassicSoccerBall } from '../entities/BallVisual.js';

let gameRuntimeThreeContext = null;

export function setGameRuntimeThreeContext(context) {
  gameRuntimeThreeContext = context;
}

function resolveContext() {
  if (gameRuntimeThreeContext) return gameRuntimeThreeContext;
  if (typeof THREE !== 'undefined') return THREE;
  return {
    WebGLRenderer: class FallbackWebGLRenderer {
      constructor() {
        this.domElement = typeof document !== 'undefined' ? document.createElement('canvas') : {};
        this.shadowMap = { enabled: false, type: 0, autoUpdate: false, needsUpdate: false };
      }
      setSize() {}
      setPixelRatio() {}
      getContext() { return { getParameter: () => 0 }; }
      render() {}
      dispose() {}
    },
    PMREMGenerator: class FallbackPMREMGenerator {
      constructor() {}
      fromScene() { return { texture: {} }; }
      dispose() {}
    },
    Vector3: class FallbackVector3 {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
      normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
      dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
      length() { return Math.hypot(this.x, this.y, this.z); }
      setFromMatrixColumn() { return this; }
    },
    ShaderMaterial: class FallbackShaderMaterial { constructor(opts = {}) { Object.assign(this, opts); } },
    MeshBasicMaterial: class FallbackMeshBasicMaterial { constructor(opts = {}) { Object.assign(this, opts); } },
    Mesh: class FallbackMesh {},
    PCFShadowMap: 1,
    PCFSoftShadowMap: 1,
    ACESFilmicToneMapping: 4,
    DoubleSide: 2,
    RoomEnvironment: class FallbackRoomEnvironment {}
  };
}

const BLOOM_OCCLUDER_LAYER = 1;

export class GameRuntime {
  /**
   * @param {HTMLElement} container DOM element to mount the game UI & canvas
   * @param {object} options Customization options (carLoaders, custom assets, etc.)
   */
  constructor(container, options = {}) {
    this.container = container || (typeof document !== 'undefined' ? document.querySelector('#app') : null);
    this.options = options;

    // Core subsystems
    this.physics = null;
    this.interpolator = null;
    this.match = null;
    this.bot = null;
    this.arena = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.boostBloom = null;
    this.speedLinesPass = null;
    this.flipResetVisual = null;
    this.clockScheduler = null;

    // Controllers & HUDs
    this.keyboard = null;
    this.gamepad = null;
    this.touch = null;
    this.settingsSheet = null;
    this.matchDialog = null;
    this.garageDialog = null;
    this.profiler = null;
    this.overlayHUD = null;
    this.boostGaugeHUD = null;
    this.speedometerHUD = null;
    this.physicsRateHUD = null;
    this.physicsRate = 120;
    this.oscilloscope = null;
    this.determinismHarness = null;
    this.determinismHUD = null;
    this.networkChannel = null;
    this.networkReconciler = null;
    this.authoritativeServer = null;
    this.headlessClient = null;
    this.inputCoordinator = null;
    this.networkHUD = null;

    // Audio subsystems
    this.actionAudio = null;
    this.ballHitAudio = null;
    this.supersonicAudio = null;
    this.engineSynths = [];
    this.audioLastGoalScored = false;
    this.audioLastRemainingSec = 300;
    this.audioLastOvertime = false;
    this.audioLastCountdown = -1;
    this.audioLastPhase = 'playing';
    this.audioLastSupersonic = false;
    this.audioLastBoostPressed = false;

    // Simulation states
    this.playerCarIndex = PLAYER_CAR_INDEX;
    this.neutralControls = {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jump: false,
      boost: false,
      handbrake: false
    };
    this.botControls = { ...this.neutralControls };
    this.botTickSkip = 0;
    this.isBotDeciding = false;
    this.botDecisionEpoch = 0;
    this.botKickoffStep = 0;
    this.isBotPaused = false;
    this.playerControls = { ...this.neutralControls };
    this.playerThrottle = 0;

    // Scratch math vectors
    const ctx = resolveContext();
    const V3 = ctx.Vector3 || Array;
    this.scratchGroundNormal = new V3(0, 0, 0);
    this.scratchVelocity = new V3(0, 0, 0);

    // Camera dynamic inputs
    this.cameraDynamics = {
      onGround: false,
      groundNormal: this.scratchGroundNormal,
      velocity: this.scratchVelocity,
      supersonic: false,
      lookX: 0,
      lookY: 0
    };

    // UI overlays & interaction tracking
    this.openOverlays = new Set();
    this.isCursorBrowsing = false;
    this.pendingClickToPlay = false;
    this.gamepadSettingsJustClosed = false;
    this.lastGamepadId = null;
    this.lastGamepadButton8 = false;
    this.trainingOptions = { ...DEFAULT_TRAINING_SETTINGS };

    // Bloom occluder swap caches
    this.bloomOccluderMeshes = [];
    this.bloomSavedMaterials = [];
    this.bloomInvisibleObjects = [];
    this.bloomHiddenObjects = [];
    this.lastBloomTreeVersion = -1;
    this.lastBloomActive = true;
    this.bloomDarkMaterial = null;


    // Timing
    this.lastTimestamp = performance.now();
    this.activeGraphicsSettings = null;
    this.running = false;
  }

  /**
   * Complete game bootstrapping sequence (deobfuscates dB).
   */
  async init() {
    const ctx = resolveContext();

    // 0. Pre-flight sanity check for POV Camera Microkernel (Fail-Fast)
    await verifyCameraMicrokernelIntegrity(this.options);

    // 1. Asset audit
    const { missingCritical, missingNonCritical } = await auditRequiredAssets();
    if (missingCritical && missingCritical.length > 0) {
      const err = new Error(formatMissingAssetsHtml(missingCritical));
      err.isAssetError = true;
      throw err;
    }
    if (missingNonCritical && missingNonCritical.length > 0) {
      console.warn(
        `[GameRuntime Asset Notice] Some non-critical assets are missing:`,
        missingNonCritical.map(m => m.path)
      );
    }

    // 2. Service worker unregistration & cache purge
    await unregisterGameServiceWorkers();

    const loadingLabel = this.container ? this.container.querySelector('#loading .load__label') : null;
    const loadingNote = this.container ? this.container.querySelector('#loading .load__note') : null;
    if (loadingLabel) loadingLabel.textContent = 'Preparing the arena';
    if (loadingNote) loadingNote.textContent = 'Getting every car, sound and game mode ready.';

    // 3. Load selected car & initialize RocketSim C++ WebAssembly
    const selectedPreset = garageSettingsStore.load().carVisual;
    const carVisualIndex = selectedPreset === 'game-car' ? 1 : 0;
    const teamAssignment = getTeamAssignment(selectedPreset === 'flat-car');

    this.physics = new RocketSimPhysicsEngine();
    await this.physics.init();
    this.playerCarIndex = this.physics.addCar(
      carVisualIndex,
      selectedPreset === 'flat-car' ? 'flat' : 'default'
    );
    this.physics.resetKickoff();

    this.interpolator = new PhysicsStateInterpolator(this.physics);
    this.match = new MatchStateMachine();
    this.bot = new RLBotAgent(botSettingsStore.load().botId);

    // 4. Audio subsystems
    this.actionAudio = new VehicleActionAudio();
    this.ballHitAudio = new BallHitAudio();
    this.supersonicAudio = new SupersonicAudio();
    this.engineSynths = [];
    this.resetAudio();

    // 5. Speed lines & input setup
    this.speedLinesPass = new SupersonicSpeedLinesPass();
    const bindings = loadInputBindings();
    this.keyboard = new KeyboardMouseController(bindings);
    this.gamepad = new GamepadController(bindings);
    this.touch = new TouchControls(this.container);

    const onResetHandler = () => this.resetKickoff();
    this.keyboard.onReset = onResetHandler;
    this.gamepad.onReset = onResetHandler;
    this.touch.onReset = onResetHandler;

    // 6. Arena World & Entities
    this.arena = new ArenaWorld(this.physics.ballRadius, selectedPreset);
    await Promise.all([
      this.arena.loadArena(),
      this.arena.loadBall(),
      this.arena.loadCarAndPadAssets()
    ]);
    this.arena.addCar(0);
    this.arena.addPads(this.physics.getPads());

    // Ball control callbacks
    const onBallControlHandler = actionId => {
      if (this.match.state.mode !== 'match') {
        if (this.physics.controlBall(this.playerCarIndex, actionId)) {
          this.interpolator.syncBall();
          this.arena.resetBallTrail();
        }
      }
    };
    this.keyboard.onBallControl = onBallControlHandler;
    this.gamepad.onBallControl = onBallControlHandler;
    this.touch.onBallControl = onBallControlHandler;

    this.flipResetVisual = new FlipResetVisual(this.arena.cars[this.playerCarIndex]);

    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    const CameraControllerClass = this.options.CameraControllerClass || CameraManager;
    this.camera = new CameraControllerClass(aspect, this.physics);

    // 7. UI Dialogs & Controls
    this.cursorHintButton = typeof document !== 'undefined' ? document.createElement('button') : null;
    if (this.cursorHintButton) {
      this.cursorHintButton.type = 'button';
      this.cursorHintButton.className = 'cursor-hint';
    }

    this.settingsSheet = new SettingsSheet(
      this.container,
      this.camera.settings,
      this.trainingOptions,
      bindings,
      isOpen => this.handleOverlayChange('settings', isOpen),
      opts => {
        this.physics.setUnlimitedBoost(this.match.state.mode === 'freeplay' && opts.boostOption === 'unlimited');
        this.arena.setCarHitboxesVisible(opts.showCarHitbox);
      },
      b => {
        this.keyboard.setBindings(b);
        this.gamepad.setBindings(b);
        this.updateCursorHint();
      },
      capturing => {
        this.keyboard.capturing = capturing;
        this.gamepad.capturing = capturing;
      }
    );

    this.activeGraphicsSettings = this.settingsSheet.graphics;
    this.settingsSheet.attachGraphics(graphics => {
      this.activeGraphicsSettings = graphics;
      this.arena.setStadiumVisible(graphics.showStadium);
      if (this.clockScheduler) {
        this.clockScheduler.setFpsLimit(graphics.limitFps ? graphics.maxFps : null);
      }
      this.updateViewport(graphics);
    });

    this.speedometerHUD = new SpeedometerHUD(this.container);
    this.physicsRateHUD = new PhysicsRateHUD(this.container, this.physicsRate);
    this.speedometerHUD.updatePhysicsRate?.(this.physicsRate);
    this.oscilloscope = new EventOscilloscopeHUD(this.container);
    // Dual-Arena Determinism Harness pre-flight check (?test=determinism)
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isDeterminismTest = urlParams && urlParams.get('test') === 'determinism';
    if (isDeterminismTest || (typeof window !== 'undefined' && window.__ENABLE_DETERMINISM_HARNESS__)) {
      this.enableDeterminismHarness(true).catch(err => console.error('[DeterminismHarness] Failed to activate:', err));
    }
    const isNetTest = urlParams && (urlParams.get('test') === 'prediction' || urlParams.get('test') === 'multiplayer');
    if (isNetTest || (typeof window !== 'undefined' && window.__ENABLE_NETWORK_PREDICTION__)) {
      this.enableNetworkPrediction(true).catch(err => console.error('[NetworkPrediction] Failed to activate:', err));
    }

    this.setupHudButtons();

    this.garageDialog = new GarageDialog(this.container, isOpen => this.handleOverlayChange('car', isOpen));
    this.matchDialog = new MatchDialog(this.container, {
      playerTeam: teamAssignment.playerTeam,
      botId: this.bot.id,
      onSelectBot: botId => {
        if (this.match.state.mode !== 'match') {
          this.resetBotState();
          this.bot.select(botId);
          botSettingsStore.save({ botId });
          this.matchDialog.update({ ...this.match.state, botId });
        }
      },
      onOpenChange: isOpen => this.handleOverlayChange('match', isOpen),
      onResume: () => {
        this.isCursorBrowsing = false;
      },
      onStart: async controller => {
        await Promise.all([this.bot.load(), this.arena.ensureOpponent()]);
        if (!controller.aborted) {
          this.physics.configureCars(selectedPreset === 'flat-car' ? 'flat' : 'default', true);
          this.physics.setUnlimitedBoost(false);
          this.isBotPaused = false;
          this.match.start();
          this.resetKickoff();
          this.matchDialog.update(this.match.state);
        }
      },
      onLeave: () => {
        this.resetBotState();
        this.match.leave();
        this.isBotPaused = false;
        this.physics.configureCars(selectedPreset === 'flat-car' ? 'flat' : 'default', false, carVisualIndex);
        this.physics.setUnlimitedBoost(this.trainingOptions.boostOption === 'unlimited');
        this.resetKickoff();
        this.matchDialog.update(this.match.state);
      }
    });

    // 8. Ball cam indicator & Profiler HUD
    this.boostGaugeHUD = new BoostGaugeHUD(this.container);
    if (this.container && typeof document !== 'undefined') {
      const ballCamElem = document.createElement('p');
      ballCamElem.className = 'ball-cam-indicator';
      ballCamElem.textContent = 'Ball cam';
      ballCamElem.hidden = !this.camera.ballCam;
      this.container.appendChild(ballCamElem);
      this.ballCamIndicator = ballCamElem;
    }

    this.profiler = new PerformanceProfiler();
    const onToggleBallCam = () => {
      if (typeof this.camera.handleAction === 'function') {
        this.camera.handleAction('ballCam');
      } else {
        this.camera.ballCam = !this.camera.ballCam;
      }
    };
    this.gamepad.onBallCamToggle = onToggleBallCam;
    this.keyboard.onBallCamToggle = onToggleBallCam;
    this.touch.onBallCamToggle = onToggleBallCam;

    // 9. Three.js WebGLRenderer & Postprocessing Composer
    const WebGLRendererClass = ctx.WebGLRenderer;
    this.renderer = new WebGLRendererClass({ antialias: true });
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
    const devicePixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;

    this.renderer.setSize(winWidth, winHeight);
    this.renderer.setPixelRatio(devicePixelRatio);
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = ctx.PCFShadowMap ?? ctx.PCFSoftShadowMap ?? 1;
      this.renderer.shadowMap.autoUpdate = false;
    }
    this.renderer.toneMapping = ctx.ACESFilmicToneMapping || 4;
    this.renderer.toneMappingExposure = 1.15;

    // Environment map
    const PMREMGeneratorClass = ctx.PMREMGenerator;
    const pmrem = new PMREMGeneratorClass(this.renderer);
    const RoomEnvClass = ctx.RoomEnvironment || RoomEnvironment;
    this.arena.scene.environment = pmrem.fromScene(new RoomEnvClass(), 0.04).texture;
    this.arena.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    if (this.container && this.renderer.domElement && this.renderer.domElement.parentNode !== this.container) {
      if (this.renderer.domElement.classList?.add) {
        this.renderer.domElement.classList.add('game-canvas');
      }
      this.container.appendChild(this.renderer.domElement);
    }

    // Performance Overlay HUD
    const statusCallbacks = this.settingsSheet.attachStatus(
      opts => this.overlayHUD && this.overlayHUD.apply(opts),
      () => this.overlayHUD && this.overlayHUD.showDetails()
    );
    this.overlayHUD = new PerformanceOverlayHUD(
      this.container,
      this.profiler,
      this.renderer,
      statusCallbacks,
      isOpen => this.handleOverlayChange('status', isOpen),
      {
        getRenderScale: () => this.activeGraphicsSettings?.renderScale ?? this.settingsSheet?.graphics?.renderScale ?? 50
      }
    );

    // BoostBloom & Composer setup
    this.boostBloom = new BoostBloom(this.renderer, winWidth, winHeight, this.renderer.getPixelRatio());
    this.composer = new EffectComposer(this.renderer);
    this.updateViewport();

    this.composer.addPass(new RenderPass(this.arena.scene, this.camera.camera));

    const ShaderMaterialClass = ctx.ShaderMaterial;
    this.composer.addPass(
      new ShaderPass(
        new ShaderMaterialClass({
          uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: this.boostBloom.texture }
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D baseTexture;
            uniform sampler2D bloomTexture;
            varying vec2 vUv;
            void main() {
              vec4 base = texture2D(baseTexture, vUv);
              vec3 glow = texture2D(bloomTexture, vUv).rgb;
              gl_FragColor = vec4(base.rgb + glow, base.a);
            }
          `
        }),
        'baseTexture'
      )
    );
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.speedLinesPass.pass);

    // Occluder material for bloom pass
    const MeshBasicMaterialClass = ctx.MeshBasicMaterial;
    this.bloomDarkMaterial = new MeshBasicMaterialClass({
      color: 0,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: ctx.DoubleSide || 2
    });

    this.setupWindowEvents();

    // 10. Preload assets & fonts
    if (loadingLabel) loadingLabel.textContent = 'Preparing cars, sounds and opponents';
    await Promise.all([
      this.actionAudio.preload(),
      this.ballHitAudio.preload(),
      this.supersonicAudio.preload(),
      this.flipResetVisual.preloadAudio(),
      this.bot.preloadAll().catch(err => console.warn('[Bot] Policy preload deferred or failed:', err)),
      this.arena.prepareAssets(),
      this.garageDialog.preload(),
      ...(typeof document !== 'undefined' && document.fonts
        ? ['400 16px Archivo', '500 16px Archivo', '700 16px Archivo', '400 20px "Lilita One"'].map(f =>
            document.fonts.load(f)
          )
        : [])
    ]);

    // 11. Prewarm visual shaders
    if (loadingLabel) loadingLabel.textContent = 'Warming up visual effects';
    if (loadingNote) loadingNote.textContent = 'Almost ready to play.';
    this.arena.update(
      this.interpolator.prevState,
      this.interpolator.currState,
      0,
      0,
      0,
      this.neutralControls,
      this.neutralControls,
      false
    );
    this.camera.update(this.arena.cars[this.playerCarIndex], this.arena.ball, 0, this.cameraDynamics);

    const originalTheme = getTheme();
    try {
      for (const theme of THEMES) {
        setTheme(theme, { persist: false });
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.dataset.theme = originalTheme;
        }
        await prewarmSceneShaders(this.renderer, this.arena.scene, this.camera.camera, {
          disappearingLightRoots: this.arena.cars,
          renderBloom: async () => {
            this.applyBloomOccluders();
            try {
              if (typeof this.renderer.compileAsync === 'function') {
                await this.renderer.compileAsync(this.arena.scene, this.camera.camera);
              }
              this.boostBloom.render(this.arena.scene, this.camera.camera);
            } finally {
              this.restoreBloomMaterials();
            }
          },
          renderFinal: () => {
            if (this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
            this.composer.render(0);
          },
          passes: [this.speedLinesPass.pass]
        });
      }
    } finally {
      setTheme(originalTheme, { persist: false });
    }

    this.boostBloom.clear();
    if (this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render(0);
    this.lastTimestamp = performance.now();
    this.interpolator.sync(this.lastTimestamp);

    // Remove loading screen
    if (typeof document !== 'undefined') {
      const loading = document.querySelector('#loading');
      if (loading) loading.remove();
    }
  }

  /**
   * Start 120Hz render loop and clock scheduler.
   */
  start() {
    if (this.running) return;
    this.running = true;
    const glContext = this.renderer ? this.renderer.getContext() : null;
    this.clockScheduler = new RenderClockScheduler(
      glContext,
      timestamp => this.renderFrame(timestamp),
      timestamp => this.profiler && this.profiler.displayFrame(timestamp)
    );
    if (this.activeGraphicsSettings) {
      this.clockScheduler.setFpsLimit(
        this.activeGraphicsSettings.limitFps ? this.activeGraphicsSettings.maxFps : null
      );
    }
    this.updateInteractionState();
    this.clockScheduler.start();
  }

  /**
   * Stop render loop.
   */
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.clockScheduler) {
      this.clockScheduler.stop();
    }
  }

  /**
   * Main 120Hz tick and render pipeline (deobfuscates wt).
   * @param {number} timestamp Current performance.now() high-res timestamp
   */
  renderFrame(timestamp) {
    if (this.profiler) this.profiler.frameStart();

    // Check low-power stop-rendering toggle
    if (this.settingsSheet && this.settingsSheet.isOpen && this.settingsSheet.stopRendering) {
      this.lastTimestamp = timestamp;
      this.interpolator.sync(timestamp);
      if (this.profiler) this.profiler.frameEnd(0, 0, 0);
      return;
    }

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    const isHidden = typeof document !== 'undefined' && (!document.hasFocus() || document.hidden);
    this.match.state.paused =
      this.match.state.mode === 'match' &&
      (this.isCursorBrowsing || this.openOverlays.size > 0 || isHidden || this.isBotPaused);

    if (this.match.state.paused || (this.match.state.mode === 'match' && this.match.state.phase === 'ended')) {
      this.pollInputs();
      this.interpolator.sync(timestamp);
    } else {
      this.interpolator.update(
        timestamp,
        () => this.pollInputs(),
        this.match.state.mode === 'match' ? () => this.stepBot() : undefined
      );
    }

    const activeSim = this.physics;
    const goalScored = activeSim.pollGoal() !== 0;

    // Free play goal handling
    if (this.match.state.mode === 'freeplay' && goalScored && !this.trainingOptions.disableGoalReset) {
      this.resetKickoff();
      this.arena.resetBallTrail();
    }

    this.matchDialog.update(this.match.state);

    if (this.container && this.container.dataset.gameMode !== this.match.state.mode) {
      this.container.dataset.gameMode = this.match.state.mode;
      this.touch.setMatchActive(this.match.state.mode === 'match');
    }

    if (this.profiler) this.profiler.mark();

    const activeCar = this.playerCarIndex;
    const activeCarMesh = this.arena.cars[this.playerCarIndex];
    if (this.networkReconciler && this.authoritativeServer) {
      const now = performance.now();
      // Server runs on dedicated decoupled 120Hz accumulator independent of render refresh rate
      this.authoritativeServer.update(now);
      this.headlessClient?.update?.(now) ?? this.headlessClient?.pollServerState(now);
      this.networkReconciler.reconcile(now);
      if (this.interpolator) {
        this.interpolator.currState.set(this.physics.state);
        if (this.networkReconciler.metrics.lastCorrectionDelta > 0.05 && !this.networkReconciler.enableSmoothing) {
          this.interpolator.prevState.set(this.physics.state);
        }
      }
    }

    // Visual updates
    const isMatchActive =
      this.match.state.mode === 'freeplay' ||
      (!this.match.state.paused && this.match.state.phase === 'playing');

    this.arena.update(
      this.interpolator.prevState,
      this.interpolator.currState,
      this.interpolator.alpha,
      dt,
      this.playerThrottle,
      this.playerControls,
      this.botControls,
      isMatchActive
    );

    if (this.networkReconciler) {
      const smoothOffset = this.networkReconciler.updateSmoothing(dt);
      if (this.networkReconciler.enableSmoothing && activeCarMesh?.group && smoothOffset) {
        activeCarMesh.group.position.x += smoothOffset.x;
        activeCarMesh.group.position.y += smoothOffset.y;
        activeCarMesh.group.position.z += smoothOffset.z;
      }
    }


    const curr = this.interpolator.currState;
    const playerCarView = this.interpolator.getCurrCarStateView(activeCar);
    const botCarView = this.interpolator.getCurrCarStateView(BOT_CAR_INDEX);

    this.flipResetVisual.update(
      dt,
      !playerCarView.isDemoed
    );


// RocketSim Native Debounced Collision Events Audio Pipeline
    if (this.physics) {
      const audioSettings = getAudioSettings();
      this.physics.readEvents((event) => {
        if (event.type === PHYSICS_EVENT_TYPES.CAR_BALL_HIT) {
          if (audioSettings.logCarBallHitEvents) {
            console.log('[CarBallHit Event]', event);
          }
          if (this.oscilloscope) {
            this.oscilloscope.addEvent(event);
          }
        }

        // Unified Event-Driven Game Audio Engine (Zero GC, fixed slot pool)
        if (gameAudioEngine) {
          gameAudioEngine.handleEvent(event, this.camera);
        } else if (this.ballHitAudio && event.type === PHYSICS_EVENT_TYPES.CAR_BALL_HIT) {
          this.ballHitAudio.play(event);
        }
      });
    }

    if (this.profiler) this.profiler.mark();

    // Camera dynamics & follow
    this.cameraDynamics.onGround = playerCarView.isOnGround;
    this.cameraDynamics.supersonic = playerCarView.isSupersonic;
    this.cameraDynamics.carView = playerCarView;
    this.scratchGroundNormal.set(
      playerCarView.groundNormalX,
      playerCarView.groundNormalZ,
      playerCarView.groundNormalY
    );
    this.scratchVelocity.set(
      playerCarView.velX,
      playerCarView.velZ,
      playerCarView.velY
    );
    this.cameraDynamics.velocity = this.scratchVelocity;

    const isRearViewHeld = (this.keyboard?.held?.('rearView') || this.gamepad?.pressed?.('rearView')) ?? false;
    this.cameraInputState = this.cameraInputState || {};
    this.cameraInputState.isRearViewHeld = isRearViewHeld;

    this.camera.update(activeCarMesh, this.arena.ball, dt, this.cameraDynamics, this.cameraInputState);
    this.arena.updateBallLocatorArrow(this.camera.ballCam, activeCar, this.arena.ball, activeCarMesh);

    if (this.profiler) this.profiler.mark();

    if (this.ballCamIndicator && this.ballCamIndicator.hidden === this.camera.ballCam) {
      this.ballCamIndicator.hidden = !this.camera.ballCam;
    }
    updateAudioListener(this.camera.camera);

    // Multi-car procedural EMotorSynth engine audio
    const numCarsInArena = this.interpolator ? this.interpolator.numCars : 0;
    const audioCtx = getAudioContext();
    const masterInput = getMasterAudioInput();

    while (this.engineSynths.length < Math.max(2, numCarsInArena)) {
      const carIndex = this.engineSynths.length;
      const isSpatial = carIndex !== activeCar;
      let spatialBus = null;
      let synth = null;
      if (audioCtx) {
        if (isSpatial) {
          spatialBus = new SpatialAudioSource(audioCtx, masterInput);
          synth = new EMotorSynth(audioCtx, spatialBus.input);
        } else {
          synth = new EMotorSynth(audioCtx, masterInput);
        }
      }
      this.engineSynths.push({
        synth,
        spatialBus,
        spatial: isSpatial,
        position: { x: 0, y: 0, z: 0 }
      });
    }

    const settings = getAudioSettings();
    const engineVol = (settings.engineVolume ?? 0.8) * (settings.masterVolume ?? 1.0);

    for (let i = 0; i < this.engineSynths.length; i++) {
      const entry = this.engineSynths[i];
      const isThisActiveCar = i === activeCar;
      const isCarValid = i < numCarsInArena;

      if (entry.spatial === isThisActiveCar && entry.synth?.outputNode) {
        entry.spatial = !isThisActiveCar;
        try {
          entry.synth.outputNode.disconnect();
          if (entry.spatial) {
            if (!entry.spatialBus && audioCtx) {
              entry.spatialBus = new SpatialAudioSource(audioCtx, masterInput);
            }
            if (entry.spatialBus) {
              entry.synth.outputNode.connect(entry.spatialBus.input);
            }
          } else {
            entry.synth.outputNode.connect(masterInput);
          }
        } catch (e) {}
      }

      if (!isCarValid) {
        entry.synth?.silence();
        entry.spatialBus?.setEnabled(false);
        continue;
      }

      const carPos =
        isThisActiveCar && activeCarMesh
          ? activeCarMesh.position
          : this.arena.cars[i]?.position;

      const carView = this.interpolator.getCurrCarStateView(i);
      const forwardSpeed = carView.forwardSpeed;
      const alive = isCarValid && !carView.isDemoed;
      const audible = this.keyboard.enabled && isMatchActive;

      if (entry.spatialBus && carPos) {
        entry.spatialBus.setPosition(carPos);
        entry.spatialBus.setEnabled(alive && audible);
      }

      if (entry.synth) {
        entry.synth.setVolume(engineVol);
        entry.synth.update({
          forwardSpeed,
          alive,
          audible
        });
      }
    }

    this.arena.prepareBallSpeedTrail(this.camera.camera);

    // Speed lines & supersonic effects
    const isSupersonic = playerCarView.isSupersonic && !playerCarView.isDemoed;
    this.scratchVelocity.set(
      playerCarView.velX,
      playerCarView.velZ,
      playerCarView.velY
    );

    this.speedLinesPass.update(dt, isSupersonic && this.keyboard.enabled && isMatchActive, this.scratchVelocity, this.camera.camera);
    this.supersonicAudio.update(isSupersonic, this.gamepad.active(), this.keyboard.enabled && isMatchActive);

    if (this.speedometerHUD) {
      this.speedometerHUD.update(this.scratchVelocity.length());
    }
    if (this.oscilloscope) {
      this.oscilloscope.update();
    }

    const curBoost = playerCarView.boost;
    if (typeof window !== 'undefined') {
      if (typeof window.__lastBoostAmount === 'undefined') window.__lastBoostAmount = curBoost;
      if (
        curBoost > window.__lastBoostAmount + 1 &&
        !(this.match.state.mode === 'freeplay' && this.trainingOptions.boostOption === 'unlimited')
      ) {
        if (boostCollectAudio) {
          boostCollectAudio.play();
        }
      }
      window.__lastBoostAmount = curBoost;
    }

    this.boostGaugeHUD.update(
      curBoost,
      playerCarView.isBoosting,
      this.match.state.mode === 'freeplay' && this.trainingOptions.boostOption === 'unlimited'
    );

    this.triggerGameAudioEvents(goalScored, curBoost, isSupersonic, curr);


    if (this.profiler) this.profiler.mark();

    // Render passes & Bloom
    const isBloomActive = this.arena.boostBloomActive || this.flipResetVisual.bloomActive;
    if (isBloomActive) {
      this.camera.camera.layers.set(0);
      this.applyBloomOccluders();
      try {
        this.boostBloom.render(this.arena.scene, this.camera.camera);
      } finally {
        this.restoreBloomMaterials();
      }
    } else if (this.lastBloomActive) {
      this.boostBloom.clear();
    }
    this.lastBloomActive = isBloomActive;

    if (this.profiler) this.profiler.mark();

    if (this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render(dt);

    if (this.profiler) {
      this.profiler.mark();
      this.profiler.frameEnd(
        this.interpolator.lastTicks,
        this.interpolator.lastDropped,
        this.interpolator.lastStalled
      );
    }
  }

  /**
   * Evaluates and dispatches the 9 distinct game audio triggers.
   */
  triggerGameAudioEvents(goalScored, curBoost, isSupersonic, curr) {
    const audio = this.options.gameAudio || gameAudio;
    if (!audio) return;

    // 1. Goal scored poof SFX
    const isGoalNow = goalScored || (this.match.state.mode === 'match' && this.match.state.phase === 'goal');
    if (isGoalNow && !this.audioLastGoalScored) {
      audio.play('sfx_goal_poof', 1.0);
    }
    this.audioLastGoalScored = isGoalNow;

    // 2. Match 30 seconds left SFX
    if (this.match.state.mode === 'match' && !this.match.state.overtime && this.match.state.phase === 'playing') {
      if (
        this.audioLastRemainingSec > 30 &&
        this.match.state.remainingSeconds <= 30 &&
        this.match.state.remainingSeconds > 0
      ) {
        audio.play('match_30_seconds_left', 1.0, 10000);
      }
    }
    this.audioLastRemainingSec = this.match.state.remainingSeconds;

    // 3. Match entering overtime SFX
    if (this.match.state.mode === 'match' && this.match.state.overtime && !this.audioLastOvertime) {
      audio.play('match_entering_overtime', 1.0, 10000);
    }
    this.audioLastOvertime = this.match.state.overtime;

    // 4. Kickoff countdown 321 SFX
    if (this.match.state.mode === 'match' && this.match.state.phase === 'kickoff') {
      const currentCount = Math.ceil(this.match.state.countdown);
      if (currentCount >= 1 && currentCount <= 3 && currentCount !== this.audioLastCountdown) {
        this.audioLastCountdown = currentCount;
        audio.play('match_countdown_321', 1.0);
      }
    } else {
      this.audioLastCountdown = -1;
    }

    // 5. Match start / kickoff Go! SFX
    if (this.match.state.mode === 'match' && this.audioLastPhase === 'kickoff' && this.match.state.phase === 'playing') {
      audio.play('match_start_go', 1.0);
    }
    this.audioLastPhase = this.match.state.phase;

    // Note: Supersonic enter and loop audio is unified inside this.supersonicAudio
    // Out of boost SFX
    const isBoostPressed = Boolean(this.playerControls && this.playerControls.boost);
    if (isBoostPressed && !this.audioLastBoostPressed && curBoost <= 0.001) {
      audio.play('sfx_error_no_boost', 0.85);
    }
    this.audioLastBoostPressed = isBoostPressed;
  }

  /**
   * Polls input devices (keyboard, gamepad, touch) and dispatches to simulation.
   */
  pollInputs() {
    const pad = getEffectiveGamepad();
    const btn8 = pad?.buttons[8]?.pressed ?? false;
    const padId = pad ? JSON.stringify([pad.id, pad.index]) : null;

    if (padId !== this.lastGamepadId) {
      this.lastGamepadButton8 = btn8;
    }
    this.lastGamepadId = padId;

    const shouldToggleMatch =
      btn8 && !this.lastGamepadButton8 && !this.settingsSheet.isOpen && !this.garageDialog.isOpen;
    if (shouldToggleMatch) {
      if (this.matchDialog.isOpen) this.matchDialog.hide();
      else this.matchDialog.show();
    }
    this.lastGamepadButton8 = btn8;

    if (shouldToggleMatch) this.gamepad.capturing = true;
    let padReading = this.gamepad.read();
    if (shouldToggleMatch) this.gamepad.capturing = false;

    if (this.gamepadSettingsJustClosed) {
      this.gamepadSettingsJustClosed = [0, 1, 8, 9].some(i => pad?.buttons[i]?.pressed);
      if (this.gamepadSettingsJustClosed) padReading = this.neutralControls;
    }

    const touchReading = this.touch.read();
    const kbReading = this.keyboard.read();
    const activeDevice = this.gamepad.active()
      ? 'gamepad'
      : this.touch.active()
      ? 'touch'
      : 'keyboard';

    const effectiveControls =
      activeDevice === 'gamepad'
        ? padReading
        : activeDevice === 'touch'
        ? touchReading
        : kbReading;

    const hasFocus =
      typeof document !== 'undefined' && !document.hidden && document.hasFocus();

    this.cameraDynamics.lookX = hasFocus
      ? Math.min(Math.max(this.keyboard.cameraLook.x + (this.gamepadSettingsJustClosed ? 0 : this.gamepad.cameraLook.x), -1), 1)
      : 0;
    this.cameraDynamics.lookY = hasFocus
      ? Math.min(Math.max(this.keyboard.cameraLook.y + (this.gamepadSettingsJustClosed ? 0 : this.gamepad.cameraLook.y), -1), 1)
      : 0;

    if (this.networkReconciler?.shouldSkipLocalStep) {
      // Legacy Hard Sync: Client lead exceeds target lead, pause local step to allow authoritative server to catch up
      this.networkReconciler.shouldSkipLocalStep = false;
      return false;
    }

    let car0Controls = effectiveControls;
    if (this.inputCoordinator && this.networkReconciler) {
      const nowMs = performance.now();
      const coordResult = this.inputCoordinator.coordinate(effectiveControls, nowMs);
      car0Controls = coordResult.car0Controls;
    } else if (this.networkReconciler) {
      this.networkReconciler.sampleAndPredictInput(this.playerCarIndex, effectiveControls);
    }

    this.playerThrottle = car0Controls.throttle;
    this.playerControls = car0Controls;
    this.physics.setControls(this.playerCarIndex, car0Controls);
    return true;
  }

  /**
   * Advances RL bot decision making and simulation step during 1v1 match.
   */
  /**
   * Activate or toggle the Dual-Arena Determinism Harness and HUD
   * @param {boolean} [showHUD=true]
   * @returns {Promise<DeterminismHarness>}
   */
  /**
   * Activate or toggle the Multiplayer Client Prediction & Reconciliation Subsystem
   * @param {boolean} [showHUD=true]
   * @returns {Promise<PredictionReconciler>}
   */
  async enableNetworkPrediction(showHUD = true, options = {}) {
    if (!this.networkReconciler) {
      const useWebRTC = options.useWebRTC ?? true;
      this.networkChannel = useWebRTC
        ? new WebRTCNetworkChannel({ rttMs: 80, jitterMs: 5, packetLossRate: 0.0, useBitPacking: options.useBitPacking ?? false })
        : new NetworkChannel({ rttMs: 80, jitterMs: 5, packetLossRate: 0.0 });
      this.authoritativeServer = new AuthoritativeServer(this.networkChannel, { snapshotInterval: 2 });
      await this.authoritativeServer.init();

      // Synchronize server arena configuration and unlimited boost with client physics
      this.authoritativeServer.sim.setUnlimitedBoost(this.physics.isUnlimitedBoost);

      // Clone client physics state into server (preserves kickoff position instead of teleporting to random spawn)
      this.authoritativeServer.sim.restoreState(this.physics.saveState());

      const serverSnap = this.authoritativeServer.sim.saveState();
      const serverTick = Math.floor(this.authoritativeServer.sim.getHeaderView().tickCount);

      this.networkReconciler = new PredictionReconciler(this.physics, this.networkChannel, {
        localCarIndex: this.playerCarIndex,
        redundantHistoryCount: options.redundantHistoryCount ?? 10,
        enableRedundantInputs: options.enableRedundantInputs ?? true,
        useBitPacking: options.useBitPacking ?? false
      });
      this.networkReconciler.syncTimeline(serverSnap, serverTick);

      this.headlessClient = new HeadlessClient(this.authoritativeServer, { carIndex: 1, rttMs: 80 });
      await this.headlessClient.init();
      this.headlessClient.connect();
      this.inputCoordinator = new AsymmetricInputCoordinator(this.networkReconciler, this.headlessClient);

      this.networkHUD = new NetworkReconciliationHUD(
        this.container,
        this.networkReconciler,
        this.networkChannel,
        this.headlessClient,
        this.inputCoordinator
      );
    }
    if (showHUD && this.networkHUD) {
      this.networkHUD.show();
    }
    return this.networkReconciler;
  }

  /**
   * Adjusts client physics simulation pacing rate by delta (+1 / -1).
   * Allowed rates: 118, 119, 120, 121, 122.
   * @param {number} delta
   */
  adjustPhysicsRate(delta) {
    const currentRate = this.interpolator?.physicsRate ?? this.physicsRate ?? 120;
    const newRate = Math.max(118, Math.min(122, currentRate + delta));
    if (newRate !== currentRate) {
      this.setPhysicsRate(newRate);
    }
  }

  setPhysicsRate(rate) {
    const clamped = Math.max(118, Math.min(122, Math.round(rate)));
    this.physicsRate = clamped;
    if (this.interpolator) {
      this.interpolator.physicsRate = clamped;
    }
    if (this.physicsRateHUD) {
      this.physicsRateHUD.update(clamped);
    }
    if (this.speedometerHUD) {
      this.speedometerHUD.updatePhysicsRate?.(clamped);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("car-soccer:physics-rate-changed", { detail: { rate: clamped } }));
    }
  }

  dropPacketBurst(count = null) {
    const pkts = count ?? this.networkHUD?.burstDropCount ?? 5;
    if (this.networkHUD) {
      this.networkHUD.dropPacketBurst?.(pkts);
    } else if (this.networkChannel) {
      this.networkChannel.forceDropNextInput?.(pkts);
    }
  }

  dropSinglePacket() {
    this.dropPacketBurst();
  }

  adjustSimulatedLatency(direction) {
    if (this.networkHUD) {
      this.networkHUD.adjustLatency(direction);
    } else {
      this.adjustNetworkLatency(direction * 10);
    }
  }

  adjustNetworkLatency(deltaLatencyMs) {
    if (!this.networkChannel) return;
    const currentRtt = this.networkChannel.rttMs ?? 80;
    const currentLatency = Math.round(currentRtt * 0.5);
    const newLatency = Math.max(0, Math.min(500, currentLatency + deltaLatencyMs));
    const newRtt = newLatency * 2;
    this.networkChannel.setRtt(newRtt);
    if (this.networkReconciler) {
      this.networkReconciler.leadTicks = this.networkReconciler.calculateLeadTicks(newRtt);
    }
    if (this.networkHUD) {
      this.networkHUD.syncLatencyValues?.();
    }
  }

  adjustNetworkRtt(deltaMs) {
    this.adjustNetworkLatency(Math.round(deltaMs * 0.5));
  }

  async spawnHeadlessCarEntity() {
    await this.arena.ensureOpponent();
    if (this.arena.cars[1]) {
      this.arena.cars[1].visible = true;
    }

    if (this.physics.numCars < 2) {
      this.physics.addCar(1, "default");
    }

    if (this.authoritativeServer) {
      this.authoritativeServer.ensureCar(1, 1);
    }

    if (this.headlessClient) {
      if (!this.headlessClient.sim) {
        await this.headlessClient.init();
      }
      this.headlessClient.connect();
    }

    if (this.authoritativeServer && this.networkReconciler) {
      const snap = this.authoritativeServer.sim.saveState();
      const sTick = Math.floor(this.authoritativeServer.sim.getHeaderView().tickCount);
      this.networkReconciler.syncTimeline(snap, sTick);
    }
    if (this.interpolator) {
      this.interpolator.sync();
    }
  }

  async enableDeterminismHarness(showHUD = true) {
    if (!this.determinismHarness) {
      this.determinismHarness = new DeterminismHarness(this.physics);
      await this.determinismHarness.init();
      this.determinismHUD = new DeterminismHUD(this.container, this.determinismHarness);
    }
    if (showHUD && this.determinismHUD) {
      this.determinismHUD.show();
    }
    return this.determinismHarness;
  }

  stepBot() {
    if (this.match.state.paused || this.match.state.phase === 'ended' || this.isBotPaused) {
      return false;
    }

    if (this.match.state.phase === 'playing') {
      const kickoffControls = this.bot.getKickoffControls(this.physics.state, this.botKickoffStep);
      if (kickoffControls) {
        this.botControls = kickoffControls;
        this.bot.overrideControls(kickoffControls);
      } else if (this.botTickSkip === 0) {
        this.scheduleBotDecision();
        return false;
      }

      this.physics.setControls(BOT_CAR_INDEX, this.botControls);
      this.physics.step(1);
      this.botKickoffStep++;
      if (!kickoffControls) this.botTickSkip--;

      const ballView = this.physics.getBallStateView();
      const kickoffTouched =
        Math.abs(ballView.posX) + Math.abs(ballView.posY) > 1 ||
        Math.hypot(ballView.velX, ballView.velY) > 1;

      const transition = this.match.tick({
        goal: this.physics.pollGoal(),
        ballOnGround: this.physics.ballOnGround,
        kickoffTouched
      });

      if (transition === 'kickoff') {
        this.resetKickoff();
      }

      if (
        this.match.state.phase === 'playing' &&
        this.botTickSkip === 0 &&
        !this.bot.getKickoffControls(this.physics.state, this.botKickoffStep)
      ) {
        this.scheduleBotDecision();
      }
    } else {
      const transition = this.match.tick();
      if (transition === 'kickoff') {
        this.resetKickoff();
      }
    }
    return true;
  }

  /**
   * Schedules async ONNX decision from Web Worker with stale response protection.
   */
  scheduleBotDecision() {
    if (this.isBotDeciding) return;
    this.isBotDeciding = true;
    const epoch = this.botDecisionEpoch;
    const pads = this.physics.getPads();
    const teamAssignment = getTeamAssignment(garageSettingsStore.load().carVisual === 'flat-car');

    this.bot
      .decide(this.physics.state, pads, BOT_CAR_INDEX, teamAssignment.botTeam)
      .then(controls => {
        if (epoch === this.botDecisionEpoch) {
          this.botControls = controls;
          this.botTickSkip = this.bot.option.tickSkip;
          this.isBotDeciding = false;
        }
      })
      .catch(err => {
        if (epoch === this.botDecisionEpoch) {
          this.isBotDeciding = false;
          this.isBotPaused = true;
          this.match.state.paused = true;
          this.matchDialog.showError(
            err instanceof Error ? err.message : 'The opponent stopped responding.'
          );
        }
      });
  }

  /**
   * Resets simulation positions to kickoff standards.
   */
  resetKickoff(seed = -1) {
    if (this.match.state.mode !== 'match') {
      this.physics.resetKickoff(seed);
      this.resetAudio();
      this.interpolator.sync();

      if (this.authoritativeServer) {
        this.authoritativeServer.sim.resetKickoff(seed);
        this.authoritativeServer.sim.pollGoal(); // Clear goal flag on server
        this.authoritativeServer.clientInputBuffer.clear();
        this.authoritativeServer.lastReceivedControls.clear();
      }
      if (this.headlessClient) {
        this.headlessClient.reset();
      }
      if (this.inputCoordinator) {
        this.inputCoordinator.reset();
      }
      if (this.networkReconciler) {
        const sSnap = this.authoritativeServer ? this.authoritativeServer.sim.saveState() : this.physics.saveState();
        const sTick = this.authoritativeServer ? Math.floor(this.authoritativeServer.sim.getHeaderView().tickCount) : 0;
        this.networkReconciler.syncTimeline(sSnap, sTick);
      }
      return;
    }

    this.physics.resetKickoff(seed);
    this.resetAudio();
    this.resetBotState();

    if (this.authoritativeServer) {
      this.authoritativeServer.sim.resetKickoff(seed);
      this.authoritativeServer.sim.pollGoal();
      this.authoritativeServer.clientInputBuffer.clear();
      this.authoritativeServer.lastReceivedControls.clear();
    }
    if (this.networkReconciler) {
      const sSnap = this.authoritativeServer ? this.authoritativeServer.sim.saveState() : this.physics.saveState();
      const sTick = this.authoritativeServer ? Math.floor(this.authoritativeServer.sim.getHeaderView().tickCount) : 0;
      this.networkReconciler.syncTimeline(sSnap, sTick);
    }

    const playerCarView = this.physics.getCarStateView(this.playerCarIndex);
    const botCarView = this.physics.getCarStateView(BOT_CAR_INDEX);

    this.flipResetVisual.update(0, false);


    // Kickoff impact reset completed
    this.arena.resetBallTrail();
    this.physics.resetView();
    this.interpolator.sync();

  }

  /**
   * Resets internal audio state caches.
   */
  resetAudio() {
    for (const eng of this.engineSynths) {
      eng.synth?.reset();
      eng.spatialBus?.setEnabled(false);
    }
    if (this.ballHitAudio) this.ballHitAudio.reset();
    this.audioLastGoalScored = false;
    this.audioLastCountdown = -1;
    this.audioLastBoostPressed = false;
  }

  /**
   * Resets bot controls and step counters.
   */
  resetBotState() {
    if (this.bot) this.bot.reset();
    this.botDecisionEpoch++;
    this.botTickSkip = 0;
    this.isBotDeciding = false;
    this.botControls = { ...this.neutralControls };
    this.botKickoffStep = 0;
  }

  /**
   * Dynamically resizes viewports and adjusts pixel ratio scaling.
   */
  updateViewport(graphics) {
    if (!this.renderer || !this.boostBloom || !this.composer) return;
    const currentGraphics = graphics ?? this.activeGraphicsSettings ?? this.settingsSheet?.graphics;
    const scale = ((currentGraphics?.renderScale) ?? 50) / 100;
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
    const basePixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const effectivePixelRatio = basePixelRatio * scale;

    if (this.camera?.camera) {
      this.camera.camera.aspect = winWidth / winHeight;
      this.camera.camera.updateProjectionMatrix();
    }

    this.renderer.setPixelRatio(effectivePixelRatio);
    this.renderer.setSize(winWidth, winHeight);
    this.boostBloom.setSize(winWidth, winHeight, this.renderer.getPixelRatio());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(winWidth, winHeight);
  }

  /**
   * Traverses scene and substitutes non-bloom meshes with dark occluders.
   */
  applyBloomOccluders() {
    const ctx = resolveContext();
    const MeshClass = ctx.Mesh || Object;

    if (this.lastBloomTreeVersion !== this.arena.renderTreeVersion) {
      this.bloomOccluderMeshes.length = 0;
      this.bloomSavedMaterials.length = 0;
      this.bloomInvisibleObjects.length = 0;

      this.arena.scene.traverse(node => {
        if (node.layers && node.layers.isEnabled(BLOOM_OCCLUDER_LAYER)) return;
        if (node instanceof MeshClass) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          if (node.userData?.bloomOccluder === false || mats.every(m => m && m.transparent && !m.depthWrite)) {
            this.bloomInvisibleObjects.push(node);
            return;
          }
          this.bloomOccluderMeshes.push(node);
          this.bloomSavedMaterials.push(node.material);
          return;
        }
        if (node.material) this.bloomInvisibleObjects.push(node);
      });
      this.lastBloomTreeVersion = this.arena.renderTreeVersion;
    }

    for (let i = 0; i < this.bloomOccluderMeshes.length; i++) {
      const mesh = this.bloomOccluderMeshes[i];
      this.bloomSavedMaterials[i] = mesh.material;
      mesh.material = this.bloomDarkMaterial;
    }

    this.bloomHiddenObjects.length = 0;
    for (let i = 0; i < this.bloomInvisibleObjects.length; i++) {
      const obj = this.bloomInvisibleObjects[i];
      if (obj.visible) {
        obj.visible = false;
        this.bloomHiddenObjects.push(obj);
      }
    }
  }

  /**
   * Restores original materials after bloom pass.
   */
  restoreBloomMaterials() {
    for (let i = 0; i < this.bloomOccluderMeshes.length; i++) {
      this.bloomOccluderMeshes[i].material = this.bloomSavedMaterials[i];
    }
    for (let i = 0; i < this.bloomHiddenObjects.length; i++) {
      this.bloomHiddenObjects[i].visible = true;
    }
  }

  /**
   * Handles modal dialog visibility and keeps them mutually exclusive.
   */
  handleOverlayChange(name, isOpen) {
    if (isOpen) {
      this.openOverlays.add(name);
      if (name !== 'settings' && this.settingsSheet) this.settingsSheet.hide();
      if (name !== 'car' && this.garageDialog) this.garageDialog.hide();
      if (name !== 'match' && this.matchDialog) this.matchDialog.hide();
      if (name !== 'status' && this.overlayHUD) this.overlayHUD.hideDetails(false);
    } else {
      this.openOverlays.delete(name);
      this.gamepadSettingsJustClosed = true;
    }
    this.syncPausedAndInputState();
  }

  /**
   * Synchronizes pause state and enables/disables input controllers.
   */
  syncPausedAndInputState() {
    this.pendingClickToPlay = false;
    const isPlaying = this.openOverlays.size === 0 && !this.isCursorBrowsing;
    this.match.state.paused = this.match.state.mode === 'match' && (!isPlaying || this.isBotPaused);
    if (this.keyboard) this.keyboard.enabled = isPlaying;
    if (this.gamepad) this.gamepad.enabled = isPlaying;
    if (this.touch) this.touch.enabled = isPlaying;
    this.updateInteractionState();
    if (this.interpolator) this.interpolator.sync();
  }

  /**
   * Updates CSS interaction classes on root container.
   */
  updateInteractionState() {
    if (!this.container) return;
    const hasFocus = typeof document !== 'undefined' ? (!document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true)) : true;
    const isPlaying = this.openOverlays.size === 0 && hasFocus;
    if (this.container.classList) {
      this.container.classList.toggle('game-playing', isPlaying && !this.isCursorBrowsing);
      this.container.classList.toggle('cursor-browsing', isPlaying && this.isCursorBrowsing);
    }
    this.updateCursorHint();
  }

  /**
   * Updates text inside the cursor hint HUD button.
   */
  updateCursorHint() {
    if (!this.cursorHintButton) return;
    const bindings = loadInputBindings();
    const toggleBindings = bindings.keyboard.toggleSettings;
    const keyBinding = toggleBindings.find(b => b.kind === 'key') ?? toggleBindings[0];

    this.cursorHintButton.replaceChildren();
    if (this.isCursorBrowsing) {
      this.cursorHintButton.textContent = 'Click field to play';
    } else if (keyBinding) {
      const kbd = document.createElement('kbd');
      kbd.textContent = formatBindingDisplayName(keyBinding);
      this.cursorHintButton.append(kbd, ' to show cursor');
    } else {
      this.cursorHintButton.textContent = 'Show cursor';
    }
    this.cursorHintButton.setAttribute(
      'aria-label',
      this.isCursorBrowsing
        ? 'Return to play'
        : keyBinding
        ? `Show mouse cursor (${formatBindingDisplayName(keyBinding)})`
        : 'Show mouse cursor'
    );
  }

  /**
   * Set up HUD buttons (Multiplayer training, settings hint).
   */
  setupHudButtons() {
    if (!this.container || typeof document === 'undefined') return;
    const hudTools = this.container.querySelector('.hud-tools');
    if (hudTools) {
      if (this.cursorHintButton) {
        hudTools.appendChild(this.cursorHintButton);
      }
    }
  }

  /**
   * Sets up window and DOM event listeners for resize, blur/focus, and keydown.
   */
  setupWindowEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', () => {
      this.updateViewport();
    });

    const onSettingsToggle = () => {
      if (this.overlayHUD && this.overlayHUD.isDetailsOpen) {
        this.overlayHUD.hideDetails();
        return;
      }
      if (this.matchDialog && this.matchDialog.isOpen) {
        this.matchDialog.hide();
        return;
      }
      if (this.garageDialog && this.garageDialog.isOpen) {
        this.garageDialog.hide();
        return;
      }
      if (this.settingsSheet) {
        this.settingsSheet.toggle();
      }
    };
    this.gamepad.onSettingsToggle = onSettingsToggle;

    const onDismissCursor = () => {
      this.isCursorBrowsing = false;
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      this.syncPausedAndInputState();
    };

    const onCursorToggle = () => {
      if (this.openOverlays.size > 0) {
        this.isCursorBrowsing = true;
        onSettingsToggle();
      } else if (this.isCursorBrowsing) {
        onDismissCursor();
      } else {
        this.isCursorBrowsing = true;
        this.syncPausedAndInputState();
      }
    };
    this.keyboard.onSettingsToggle = onCursorToggle;
    if (this.cursorHintButton) {
      this.cursorHintButton.addEventListener('click', onCursorToggle);
    }

    if (this.container) {
      const settingsBtn = this.container.querySelector('#settings-button');
      if (settingsBtn) settingsBtn.setAttribute('title', 'Settings');

      this._onContainerPointerDown = evt => {
        if (
          evt.pointerType !== 'mouse' ||
          !(evt.target instanceof Element) ||
          evt.target.closest(
            '#settings-button, #car-button, #match-button'
          )
        ) {
          this.isCursorBrowsing = true;
          this.syncPausedAndInputState();
        }
      };
      this.container.addEventListener('pointerdown', this._onContainerPointerDown, true);
    }

    this.gamepad.onActivity = () => {
      if (this.container) this.container.dataset.inputMethod = 'gamepad';
      this.touch.hideForExternalInput();
      if (this.isCursorBrowsing) {
        this.isCursorBrowsing = false;
        this.syncPausedAndInputState();
      }
    };

    this._onToggleOscilloscope = () => {
      this.oscilloscope?.toggle();
    };
    window.addEventListener('car-soccer:toggle-oscilloscope', this._onToggleOscilloscope);

    this._onToggleDeterminism = async () => {
      if (!this.determinismHarness) {
        await this.enableDeterminismHarness(true);
      } else {
        this.determinismHUD?.toggle();
      }
    };
    window.addEventListener('car-soccer:toggle-determinism', this._onToggleDeterminism);

    this._onToggleNetworkHUD = async () => {
      if (!this.networkReconciler) {
        await this.enableNetworkPrediction(true);
      } else {
        this.networkHUD?.toggle();
      }
      await this.spawnHeadlessCarEntity();
    };
    window.addEventListener('car-soccer:toggle-network-hud', this._onToggleNetworkHUD);

    this._onWindowKeyDown = evt => {
      // Shift + I: Oscilloscope HUD
      if (
        (evt.code === "KeyI" || evt.key === "i" || evt.key === "I") &&
        evt.shiftKey &&
        !evt.repeat
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this.oscilloscope?.toggle();
          return;
        }
      }

      // Shift + O: Dual-Arena Determinism HUD
      if (
        (evt.code === "KeyO" || evt.key === "o" || evt.key === "O") &&
        evt.shiftKey &&
        !evt.repeat
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this._onToggleDeterminism?.();
          return;
        }
      }

      // Shift + P (or Ctrl+O): Network Reconciliation & Latency HUD
      if (
        (((evt.code === "KeyP" || evt.key === "p" || evt.key === "P") && evt.shiftKey) ||
         ((evt.code === "KeyO" || evt.key === "o" || evt.key === "O") && (evt.ctrlKey || evt.metaKey)) ||
         ((evt.code === "KeyN" || evt.key === "n" || evt.key === "N") && evt.shiftKey)) &&
        !evt.repeat
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this._onToggleNetworkHUD?.();
          return;
        }
      }

      // Hotkey 8: Burst packet drop simulation
      if (
        (evt.code === "Digit8" || evt.code === "Numpad8" || evt.key === "8") &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey &&
        !evt.shiftKey
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          if (!this.networkReconciler) {
            this.enableNetworkPrediction(false).then(() => {
              this.dropPacketBurst();
            });
          } else {
            this.dropPacketBurst();
          }
          return;
        }
      }

      // Physics Rate Increase: = / +
      if (
        (evt.code === "Equal" || evt.key === "=" || evt.key === "+") &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey &&
        !evt.repeat
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this.adjustPhysicsRate(1);
          return;
        }
      }

      // Physics Rate Decrease: - / _
      if (
        (evt.code === "Minus" || evt.key === "-" || evt.key === "_") &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey &&
        !evt.repeat
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this.adjustPhysicsRate(-1);
          return;
        }
      }

      // Hotkey 9: Latency decrease (-10ms RTT)
      if (
        (evt.code === "Digit9" || evt.code === "Numpad9" || evt.key === "9") &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this.adjustSimulatedLatency(-1);
          return;
        }
      }

      // Hotkey 0: Latency increase (+10ms RTT)
      if (
        (evt.code === "Digit0" || evt.code === "Numpad0" || evt.key === "0") &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== "INPUT" && evt.target.tagName !== "TEXTAREA") {
          evt.preventDefault();
          this.adjustSimulatedLatency(1);
          return;
        }
      }

      if (
        evt.code !== 'KeyM' ||
        evt.repeat ||
        evt.ctrlKey ||
        evt.metaKey ||
        evt.altKey ||
        this.settingsSheet?.isOpen ||
        this.garageDialog?.isOpen
      ) {
        return;
      }
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.isCursorBrowsing = true;
      if (this.matchDialog?.isOpen) {
        this.matchDialog.hide();
      } else {
        this.matchDialog?.show();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onWindowKeyDown, true);
    }

    this._onWindowBlurFocus = () => {
      this.pendingClickToPlay = false;
      this.updateInteractionState();
      if (this.interpolator) this.interpolator.sync();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this._onWindowBlurFocus);
      window.addEventListener('focus', this._onWindowBlurFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onWindowBlurFocus);
    }

    if (this.renderer?.domElement) {
      this._onCanvasMouseDown = evt => {
        this.pendingClickToPlay = this.isCursorBrowsing && this.openOverlays.size === 0 && evt.button === 0;
        const bindings = loadInputBindings();
        if (
          !(!this.isCursorBrowsing || this.openOverlays.size > 0) &&
          bindings.keyboard.toggleSettings.some(b => b.kind === 'mouse' && b.button === evt.button)
        ) {
          evt.preventDefault();
          evt.stopPropagation();
          onCursorToggle();
        }
      };
      this.renderer.domElement.addEventListener('mousedown', this._onCanvasMouseDown);

      this._onCanvasClick = evt => {
        const wasPending = this.pendingClickToPlay;
        this.pendingClickToPlay = false;
        if (!(!wasPending || !this.isCursorBrowsing || this.openOverlays.size > 0 || evt.button !== 0)) {
          evt.preventDefault();
          evt.stopPropagation();
          onDismissCursor();
        }
      };
      this.renderer.domElement.addEventListener('click', this._onCanvasClick);
    }
  }

  /**
   * Destroys the runtime and disposes all resources.
   */
  destroy() {
    this.stop();

    // 1. Remove event listeners
    if (this.container && this._onContainerPointerDown) {
      this.container.removeEventListener('pointerdown', this._onContainerPointerDown, true);
    }
    if (typeof window !== 'undefined') {
      if (this._onWindowKeyDown) window.removeEventListener('keydown', this._onWindowKeyDown, true);
      if (this._onWindowBlurFocus) {
        window.removeEventListener('blur', this._onWindowBlurFocus);
        window.removeEventListener('focus', this._onWindowBlurFocus);
      }
    }
    if (typeof document !== 'undefined' && this._onWindowBlurFocus) {
      document.removeEventListener('visibilitychange', this._onWindowBlurFocus);
    }
    if (this.renderer?.domElement) {
      if (this._onCanvasMouseDown) this.renderer.domElement.removeEventListener('mousedown', this._onCanvasMouseDown);
      if (this._onCanvasClick) this.renderer.domElement.removeEventListener('click', this._onCanvasClick);
    }

    // 2. Remove appended DOM elements
    if (this.cursorHintButton && this.cursorHintButton.parentElement) {
      this.cursorHintButton.parentElement.removeChild(this.cursorHintButton);
      this.cursorHintButton = null;
    }
    if (this.ballCamIndicator && this.ballCamIndicator.parentElement) {
      this.ballCamIndicator.parentElement.removeChild(this.ballCamIndicator);
      this.ballCamIndicator = null;
    }

    // 3. Subsystems disposal
    if (this.keyboard) {
      this.keyboard.dispose?.();
      this.keyboard = null;
    }
    if (this.gamepad) {
      this.gamepad.dispose?.();
      this.gamepad = null;
    }
    for (const eng of this.engineSynths) {
      eng.synth?.dispose();
      eng.spatialBus?.dispose();
    }
    this.engineSynths.length = 0;
    if (this.touch) {
      this.touch.destroy?.();
      this.touch = null;
    }
    if (this.camera) {
      this.camera.dispose?.();
      this.camera = null;
    }
    if (this._onToggleOscilloscope && typeof window !== 'undefined') {
      window.removeEventListener('car-soccer:toggle-oscilloscope', this._onToggleOscilloscope);
      this._onToggleOscilloscope = null;
    }
    if (this._onToggleDeterminism && typeof window !== 'undefined') {
      window.removeEventListener('car-soccer:toggle-determinism', this._onToggleDeterminism);
      this._onToggleDeterminism = null;
    }
    if (this.determinismHUD) {
      this.determinismHUD.destroy?.();
      this.determinismHUD = null;
    }
    if (this.determinismHarness) {
      this.determinismHarness.destroy?.();
      this.determinismHarness = null;
    }
    if (this._onToggleNetworkHUD && typeof window !== 'undefined') {
      window.removeEventListener('car-soccer:toggle-network-hud', this._onToggleNetworkHUD);
      this._onToggleNetworkHUD = null;
    }
    if (this.networkHUD) {
      this.networkHUD.destroy?.();
      this.networkHUD = null;
    }
    if (this.authoritativeServer) {
      this.authoritativeServer.destroy?.();
      this.authoritativeServer = null;
    }
    if (this.networkReconciler) {
      this.networkReconciler = null;
    }
    if (this.oscilloscope) {
      this.oscilloscope.destroy?.();
      this.oscilloscope = null;
    }
    if (this.physicsRateHUD) {
      this.physicsRateHUD.destroy?.();
      this.physicsRateHUD = null;
    }
    if (this.speedometerHUD) {
      this.speedometerHUD.destroy?.();
      this.speedometerHUD = null;
    }
    if (this.boostGaugeHUD) {
      this.boostGaugeHUD.destroy?.();
      this.boostGaugeHUD = null;
    }
    if (this.overlayHUD) {
      this.overlayHUD.destroy?.();
      this.overlayHUD = null;
    }
    if (this.matchDialog) {
      this.matchDialog.destroy?.();
      this.matchDialog = null;
    }
    if (this.garageDialog) {
      this.garageDialog.destroy?.();
      this.garageDialog = null;
    }
    if (this.settingsSheet) {
      this.settingsSheet.destroy?.();
      this.settingsSheet = null;
    }
    if (this.hud) {
      this.hud.destroy?.();
      this.hud = null;
    }
    if (this.composer) {
      this.composer.dispose?.();
      this.composer = null;
    }
    if (this.boostBloom) {
      this.boostBloom.dispose?.();
      this.boostBloom = null;
    }
    if (this.speedLinesPass) {
      this.speedLinesPass.dispose?.();
      this.speedLinesPass = null;
    }
    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose?.();
      this.renderer = null;
    }
    if (this.arena) {
      this.arena.dispose?.();
      this.arena = null;
    }
    if (this.physics) {
      this.physics.destroy?.();
      this.physics = null;
    }
  }

  dispose() {
    this.destroy();
  }
}
