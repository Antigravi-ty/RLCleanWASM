import { BallTrajectoryPredictor } from '../entities/BallTrajectoryPredictor.js';
import { BallTrajectoryPredictorHUD } from '../ui/BallTrajectoryPredictorHUD.js';
import * as THREE from 'three';
import '../utils/ConsoleLoggerEnhancer.js';
import { CAR_COLOR_SLOTS } from "../entities/CarColorConstants.js";
import { CameraController } from '../camera/CameraController.js';
import { CameraManager, CAMERA_MODES } from '../camera/CameraManager.js';
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
import { prewarmSceneShaders } from './ShaderPrewarmer.js';
import { RocketSimPhysicsEngine, getTeamAssignment } from '../physics/RocketSimPhysicsEngine.js';
import { PhysicsStateInterpolator } from '../physics/PhysicsStateInterpolator.js';
import { RenderClockScheduler } from './RenderClockScheduler.js';
import {
  CarStateView,
  BallStateView,
  PHYSICS_EVENT_TYPES,
  INCIDENT_EVENT_TYPES
} from '../physics/RocketSimConstants.js';

export const PLAYER_CAR_INDEX = 0;
export const BOT_CAR_INDEX = 1;
import {
  EMotorSynth,
  getAudioContext,
  getMasterAudioInput,
  getAudioSettings,
  gameAudio,
  gameAudioEngine,
  isEventLogEnabled,
  audioConfig,
  getAudioSlotPool
} from '../audio/AudioArchitecture.js';
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
import { EventOscilloscopeHUD } from '../ui/EventOscilloscopeHUD.js';
import { DeterminismHarness } from '../physics/DeterminismHarness.js';
import { DeterminismHUD } from '../ui/DeterminismHUD.js';
import { PredictionReconciler } from '../network/PredictionReconciler.js';
import { HostServerWorker } from '../network/HostServerWorker.js';
import { NetworkReconciliationHUD } from '../ui/NetworkReconciliationHUD.js';
import { OnlineDialog } from '../ui/OnlineDialog.js';
import { P2PWebRTCChannel } from '../network/P2PWebRTCChannel.js';
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
import { EntityManager } from '../entities/EntityManager.js';
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
  return {
    ...THREE,
    RoomEnvironment,
    ...(gameRuntimeThreeContext || {})
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

    this.physics = null;
    this.interpolator = null;
    this.match = null;
    this.bot = null;
    this.arena = null;
    this.entityManager = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.boostBloom = null;
    this.speedLinesPass = null;
    this.flipResetVisuals = new Map();
    this.clockScheduler = null;

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
    this.ballTrajectoryPredictor = null;
    this.ballTrajectoryPredictorHUD = null;
    this.determinismHarness = null;
    this.determinismHUD = null;
    this.networkChannel = null;
    this.networkReconciler = null;
    this.authoritativeServer = null;
    this.networkHUD = null;

    this.engineSynths = [];
    this.audioLastGoalScored = false;
    this.audioLastRemainingSec = 300;
    this.audioLastOvertime = false;
    this.audioLastCountdown = -1;
    this.audioLastPhase = 'playing';
    this.audioLastSupersonic = false;
    this.audioLastBoostPressed = false;

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

    const ctx = resolveContext();
    const V3 = ctx.Vector3 || Array;
    this.scratchGroundNormal = new V3(0, 0, 0);
    this.scratchVelocity = new V3(0, 0, 0);

    this.cameraDynamics = {
      onGround: false,
      groundNormal: this.scratchGroundNormal,
      velocity: this.scratchVelocity,
      supersonic: false,
      lookX: 0,
      lookY: 0
    };

    this.openOverlays = new Set();
    this.isCursorBrowsing = false;
    this.pendingClickToPlay = false;
    this.gamepadSettingsJustClosed = false;
    this.lastGamepadId = null;
    this.lastGamepadButton8 = false;
    this.trainingOptions = { ...DEFAULT_TRAINING_SETTINGS };

    this.bloomOccluderMeshes = [];
    this.bloomSavedMaterials = [];
    this.bloomInvisibleObjects = [];
    this.bloomHiddenObjects = [];
    this.lastBloomTreeVersion = -1;
    this.lastBloomActive = true;
    this.bloomDarkMaterial = null;


    this.lastTimestamp = performance.now();
    this.activeGraphicsSettings = null;
    this.running = false;
  }

  /**
   * Complete game bootstrapping sequence coordinated via LoadingOrchestrator.
   */
  async init() {
    const { buildEngineLoadingPipeline } = await import('../loader/index.js');
    const orchestrator = buildEngineLoadingPipeline(this, this.options);
    if (this.options?.bootstrapReporter) {
      orchestrator.subscribe(this.options.bootstrapReporter);
    }
    await orchestrator.run();
    return this;
  }

  /**
   * Phase 1: Initialize RocketSim physics engine with preloaded chunks or dynamic fetch.
   * @param {object} [options={}]
   */
  async setupPhysics(options = {}) {
    const loadedSettings = garageSettingsStore.load();
    const selectedPreset = loadedSettings.vehiclePreset || loadedSettings.carVisual || 'game-car';
    this.selectedPreset = selectedPreset;
    this.teamAssignment = getTeamAssignment(selectedPreset === 'flat-car');

    this.physics = new RocketSimPhysicsEngine();
    await this.physics.init(options);
    this.playerCarIndex = this.physics.addCar(
      this.teamAssignment.playerTeam,
      selectedPreset
    );
    this.physics.resetKickoff();

    this.interpolator = new PhysicsStateInterpolator(this.physics);
    this.match = new MatchStateMachine();
    this.bot = new RLBotAgent(botSettingsStore.load().botId);
    if (this.isAiWorkerMissing) {
      this.bot.enableFallbackMode("AI opponent worker is missing");
    }

    this.engineSynths = [];
    this.resetAudio();
  }

  /**
   * Phase 2: Construct 3D scene, vehicle assembly, Three.js renderer, and UI HUD layers.
   * @param {(ratio: number, detail: string) => void} [onProgress]
   */
  getFlipResetVisual(carIndex) {
    if (this.flipResetVisuals.has(carIndex)) {
      return this.flipResetVisuals.get(carIndex);
    }
    const carRoot = this.arena?.cars?.[carIndex];
    if (carRoot) {
      const visual = new FlipResetVisual(carRoot);
      this.flipResetVisuals.set(carIndex, visual);
      return visual;
    }
    return null;
  }

  get flipResetVisual() {
    return this.getFlipResetVisual(this.playerCarIndex);
  }

  set flipResetVisual(v) {
    if (v) {
      this.flipResetVisuals.set(this.playerCarIndex, v);
    }
  }

  _bindReconcilerSignals(reconciler) {
    if (!reconciler) return;
    reconciler.onSignals = (signals) => {
      for (const sig of signals) {
        if (sig.signalType === 16) { // PLAYER_LEFT
          const leftCarIndex = sig.param1;
          if (leftCarIndex >= 0 && leftCarIndex !== this.playerCarIndex) {
            this.arena?.removeCar(leftCarIndex);
            if (this.flipResetVisuals.has(leftCarIndex)) {
              this.flipResetVisuals.get(leftCarIndex).stopVisual();
              this.flipResetVisuals.delete(leftCarIndex);
            }
          }
        }
      }
    };
  }

  async setupScene(onProgress = null) {
    const ctx = resolveContext();
    const loadedSettings = garageSettingsStore.load();
    const selectedPreset = this.selectedPreset || loadedSettings.vehiclePreset || loadedSettings.carVisual || 'game-car';
    const teamAssignment = this.teamAssignment || getTeamAssignment(selectedPreset === 'flat-car');

    this.speedLinesPass = new SupersonicSpeedLinesPass();
    const bindings = loadInputBindings();
    this.keyboard = new KeyboardMouseController(bindings);
    this.gamepad = new GamepadController(bindings);
    this.touch = new TouchControls(this.container);

    const onResetHandler = () => this.resetKickoff();
    this.keyboard.onReset = onResetHandler;
    this.gamepad.onReset = onResetHandler;
    this.touch.onReset = onResetHandler;

    this.arena = new ArenaWorld(this.physics.ballRadius, selectedPreset);
    await this.arena.loadAllAssets(onProgress);
    this.entityManager = new EntityManager({ physics: this.physics, arena: this.arena });
    this.entityManager.spawnVehicle(0, { team: 0, visual: selectedPreset, isPlayer: true });
    this.arena.addPads(this.physics.getPads());

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

    this.getFlipResetVisual(this.playerCarIndex);

    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    const CameraControllerClass = this.options.CameraControllerClass || CameraManager;
    this.camera = new CameraControllerClass(aspect, this.physics);

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
    this.physicsRateHUD = null;
    this.oscilloscope = new EventOscilloscopeHUD(this.container, { physicsEngine: this.physics, arenaWorld: this.arena });
    this.oscilloscope.setPhysicsEngine(this.physics);
    this.oscilloscope.setArenaWorld(this.arena);

    // Ball Trajectory Predictor subsystem (purely local client-side)
    this.ballTrajectoryPredictor = new BallTrajectoryPredictor(this.arena?.scene, {}, this.physics?.ballRadius || 91.25, this.physics);
    this.ballTrajectoryPredictorHUD = new BallTrajectoryPredictorHUD(this.container, {
      predictor: this.ballTrajectoryPredictor,
      physics: this.physics,
      onOverlayChange: (name, isOpen) => this.handleOverlayChange(name, isOpen)
    });
    this.settingsSheet?.attachTrajectoryPredictor?.(
      this.ballTrajectoryPredictor,
      this.ballTrajectoryPredictorHUD,
      this.physics
    );

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

    this.onlineDialog = new OnlineDialog(this.container, {
      onHostServer: async (opts) => {
        await this.hostOnlineServer(opts);
      },
      onStopServer: async () => {
        await this.stopOnlineServer();
      },
      onLeaveServer: async () => {
        await this.stopOnlineServer();
      },
      onJoinServer: async (opts) => {
        await this.joinOnlineServer(opts);
      },
      onPeerConnected: async (channel, name) => {
        await this.onRemotePlayerConnected(channel, name);
      },
      onRemovePlayer: async (carIndex) => {
        await this.removeRemotePlayer(carIndex);
      },
      onOpenNetworkHUD: () => {
        if (this.networkHUD) {
          this.networkHUD.toggle();
        } else {
          this.enableNetworkPrediction(true);
        }
      },
      onOpenChange: (isOpen) => {
        this.handleOverlayChange("online", isOpen);
      },
      onColorSelect: (carIndex, slotId, hex) => {
        this.setCarColor(carIndex, hex);
      },
      onClose: () => {
        this.isCursorBrowsing = false;
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        this.syncPausedAndInputState();
      }
    });

    this.garageDialog = new GarageDialog(
      this.container,
      isOpen => this.handleOverlayChange('car', isOpen),
      { onSelectCar: (visualId) => this.changePlayerVehicle(visualId) }
    );
    this.garageDialog.onSelectCar = (visualId) => this.changePlayerVehicle(visualId);
    this.matchDialog = new MatchDialog(this.container, {
      playerTeam: teamAssignment.playerTeam,
      botId: this.bot.id,
      isAiWorkerMissing: () => Boolean(this.isAiWorkerMissing || this.bot.fallbackMode || this.bot.workerMissing),
      onSelectBot: botId => {
        if (this.match.state.mode !== 'match') {
          this.resetBotState();
          this.bot.select(botId);
          botSettingsStore.save({ botId });
          this.matchDialog.update({ ...this.match.state, botId, workerMissing: Boolean(this.isAiWorkerMissing || this.bot.fallbackMode || this.bot.workerMissing) });
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
          this.matchDialog.update({ ...this.match.state, workerMissing: Boolean(this.isAiWorkerMissing || this.bot.fallbackMode || this.bot.workerMissing) });
        }
      },
      onLeave: () => {
        this.resetBotState();
        this.match.leave();
        this.isBotPaused = false;
        this.physics.configureCars(selectedPreset === 'flat-car' ? 'flat' : 'default', false, this.teamAssignment.playerTeam);
        this.physics.setUnlimitedBoost(this.trainingOptions.boostOption === 'unlimited');
        this.resetKickoff();
        this.matchDialog.update({ ...this.match.state, workerMissing: Boolean(this.isAiWorkerMissing || this.bot.fallbackMode || this.bot.workerMissing) });
      }
    });

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
        getRenderScale: () => this.activeGraphicsSettings?.renderScale ?? this.settingsSheet?.graphics?.renderScale ?? 50,
        getPhysicsRate: () => this.physicsRate,
        getNetworkRtt: () => this.networkChannel?.measuredRttMs ?? (this.networkChannel?.rttMs > 0 ? this.networkChannel.rttMs : null),
        getNetworkLatencyInfo: () => {
          const ch = this.networkChannel || this.networkHUD?.channel;
          if (!ch) return null;
          const extra = ch.extraLatencyMs ?? 0;
          const measuredRtt = ch.measuredRttMs ?? 0;
          const baseLatency = Math.round(measuredRtt * 0.5);
          return { baseLatency, extraLatency: extra };
        }
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
  }

  /**
   * Phase 3: Preload sound bank, flip reset audio, vehicle showcase assets, and garage dialog.
   * @param {(loaded: number, total: number, file: string) => void} [onProgress]
   */
  async setupAudio(onProgress = null) {
    await Promise.all([
      gameAudioEngine.preload(onProgress),
      this.flipResetVisual?.preloadAudio?.(),
      this.arena?.prepareAssets?.(),
      this.garageDialog?.preload?.()
    ]);
  }

  /**
   * Phase 4: Non-blocking Bot AI policy preload with error resilience.
   * @param {(loaded: number, total: number, botId: string) => void} [onProgress]
   */
  async setupBot(onProgress = null) {
    if (this.bot) {
      await this.bot.preloadAll(onProgress).catch(err => {
        console.warn('[GameRuntime] Bot preload deferred or failed:', err);
      });
    }
  }

  /**
   * Phase 5: WebGL GPU shader prewarming across visual themes.
   * @param {(ratio: number, theme: string) => void} [onProgress]
   */
  async setupShaders(onProgress = null) {
    if (this.physicsRateHUD) {
      const netRtt = this.networkChannel?.measuredRttMs ?? (this.networkChannel?.rttMs > 0 ? this.networkChannel.rttMs : null);
      this.physicsRateHUD.updateRateAndRtt(this.physicsRate, netRtt);
    }
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
      let themeIndex = 0;
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
        themeIndex++;
        if (typeof onProgress === 'function') {
          onProgress(themeIndex / THEMES.length, theme);
        }
      }
    } finally {
      setTheme(originalTheme, { persist: false });
    }
  }

  /**
   * Phase 6: Finalize frame synchronization and launch 120Hz clock scheduler.
   */
  ignite() {
    this.boostBloom.clear();
    if (this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render(0);
    this.lastTimestamp = performance.now();
    this.interpolator.sync(this.lastTimestamp);
    this.start();
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

    if (this.settingsSheet && this.settingsSheet.isOpen && this.settingsSheet.stopRendering) {
      this.lastTimestamp = timestamp;
      this.interpolator.sync(timestamp);
      if (this.profiler) this.profiler.frameEnd(0, 0, 0);
      return false;
    }

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    const continueOnBlur = audioConfig.get('continueAudioOnLostFocus');
    const isHidden = typeof document !== 'undefined' && (!document.hasFocus() || document.hidden);
    const shouldPauseOnHidden = !continueOnBlur && isHidden;
    const blockingOverlays = Array.from(this.openOverlays).filter(n => n !== 'trajectory');
    const hasBlockingOverlay = blockingOverlays.length > 0;
    const isTrajectoryOnly = this.openOverlays.has('trajectory') && !hasBlockingOverlay;

    this.match.state.paused =
      this.match.state.mode === 'match' &&
      ((this.isCursorBrowsing && !isTrajectoryOnly) || hasBlockingOverlay || shouldPauseOnHidden || this.isBotPaused);

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
    if (this.networkReconciler) {
      const now = performance.now();
      if (this.authoritativeServer) {
        // Server runs on dedicated decoupled 120Hz accumulator independent of render refresh rate
        this.authoritativeServer.update(now);
      }
      this.networkReconciler.reconcile(now);
      if (this.interpolator) {
        this.interpolator.currState.set(this.physics.state);
        if (this.networkReconciler.metrics.lastCorrectionDelta > 0.05 && !this.networkReconciler.enableSmoothing) {
          this.interpolator.prevState.set(this.physics.state);
        }
      }
    }

    const isMatchActive =
      this.match.state.mode === 'freeplay' ||
      (!this.match.state.paused && (
        this.match.state.phase === 'playing' ||
        this.match.state.phase === 'kickoff' ||
        this.match.state.phase === 'goal'
      ));

    const getCarControls = (carIdx) => {
      if (carIdx === this.playerCarIndex) {
        return this.playerControls;
      }
      const remote = this.networkReconciler?.lastRemoteControls?.get(carIdx);
      const ctrl = remote?.controls ? remote.controls : remote;
      return ctrl || this.neutralControls;
    };

    const car0Controls = getCarControls(0);
    const car0Throttle = this.playerCarIndex === 0 ? this.playerThrottle : (car0Controls?.throttle ?? 0);
    const car1Controls = getCarControls(1);

    this.arena.playerCarIndex = this.playerCarIndex;
    this.arena.update(
      this.interpolator.prevState,
      this.interpolator.currState,
      this.interpolator.alpha,
      dt,
      car0Throttle,
      car0Controls,
      car1Controls,
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

    for (const [cIdx, visual] of this.flipResetVisuals.entries()) {
      const cView = this.interpolator?.getCurrCarStateView(cIdx);
      visual.update(dt, cView ? !cView.isDemoed : true);
    }


// RocketSim Native Debounced Collision Events Audio Pipeline
    if (this.physics) {
      this.physics.readEvents((event) => {
        if (isEventLogEnabled(event.type)) {
          console.log(`[Physics Incident 0x${event.type.toString(16).padStart(2, '0')}]`, event);
        }

        if (this.oscilloscope) {
          this.oscilloscope.addEvent(event);
        }



        if (event.type === PHYSICS_EVENT_TYPES.FLIP_RESET_GAINED) {
          const visual = this.getFlipResetVisual(event.carIndex);
          if (visual) {
            visual.play();
          }
        }

        // Unified Event-Driven Game Audio Engine (Zero GC, fixed slot pool)
        if (gameAudioEngine) {
          gameAudioEngine.handleEvent(event, this.camera);
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

    if (gameAudioEngine && typeof gameAudioEngine.updateBallAudio === "function") {
      gameAudioEngine.updateBallAudio(this.arena.ball, this.camera, this.physics);
    }

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
      const continueOnBlur = audioConfig.get('continueAudioOnLostFocus');
      const audible = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));

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

    const isAudibleActive = !hasBlockingOverlay && (isMatchActive || (continueOnBlur && isHidden));
    this.speedLinesPass.update(dt, isSupersonic && this.keyboard.enabled && isMatchActive, this.scratchVelocity, this.camera.camera);
    gameAudioEngine.updateSupersonic(isSupersonic, isAudibleActive);
    gameAudioEngine.updateBoost(playerCarView.isBoosting && !playerCarView.isDemoed, isAudibleActive);

    // Multi-car dynamic spatial audio tracking (positions, loops, action emitters)
    if (gameAudioEngine && typeof gameAudioEngine.updateVehicles === 'function') {
      gameAudioEngine.updateVehicles({
        activeCarIndex: activeCar,
        numCars: numCarsInArena,
        getCarPos: (i) => (i === activeCar && activeCarMesh) ? activeCarMesh.position : this.arena.cars[i]?.position,
        getCarState: (i) => this.interpolator?.getCurrCarStateView(i),
        isMatchActive,
        hasBlockingOverlay,
        continueOnBlur,
        isHidden
      });
    }

    if (this.speedometerHUD) {
      this.speedometerHUD.update(this.scratchVelocity.length());
    }
    if (this.oscilloscope) {
      this.oscilloscope.update();
    }

    if (this.ballTrajectoryPredictor) {
      const winWidth = this.container ? this.container.clientWidth || window.innerWidth : window.innerWidth;
      const winHeight = this.container ? this.container.clientHeight || window.innerHeight : window.innerHeight;
      const curTick = this.physics?.getHeaderView()?.tickCount ?? 0;
      this.ballTrajectoryPredictor.update(curTick, this.arena?.ball?.position, winWidth, winHeight, this.physics);
    }

    const curBoost = playerCarView.boost;
    this.boostGaugeHUD.update(
      curBoost,
      playerCarView.isBoosting,
      this.match.state.mode === 'freeplay' && this.trainingOptions.boostOption === 'unlimited'
    );

    this.triggerGameAudioEvents(goalScored, curBoost, isSupersonic, curr);


    if (this.profiler) this.profiler.mark();

    // Render passes & Bloom
    const isBloomActive = this.arena.boostBloomActive || Array.from(this.flipResetVisuals.values()).some(v => v.bloomActive);
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

    // Note: Supersonic enter and loop audio is unified inside gameAudioEngine
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
    if (this.networkReconciler) {
      this.networkReconciler.sampleAndPredictInput(this.playerCarIndex, effectiveControls);
    }

    this.playerThrottle = car0Controls.throttle;
    this.playerControls = car0Controls;
    this.physics.setControls(this.playerCarIndex, car0Controls);

    if (this.networkReconciler && this.networkReconciler.lastRemoteControls) {
      const numCars = Math.min(this.physics.numCars, 6);
      for (let c = 0; c < numCars; c++) {
        if (c !== this.playerCarIndex) {
          const remote = this.networkReconciler.lastRemoteControls.get(c);
          const remoteCtrl = remote?.controls ? remote.controls : (remote || this.neutralControls);
          this.physics.setControls(c, remoteCtrl);
        }
      }
    }
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
      this.authoritativeServer = new HostServerWorker(null, { snapshotInterval: 1 });
      await this.authoritativeServer.init();
      this.networkChannel = this.authoritativeServer.channel;

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
      this._bindReconcilerSignals(this.networkReconciler);
      this.networkReconciler.syncTimeline(serverSnap, serverTick);

    
      this.networkHUD = new NetworkReconciliationHUD(
        this.container,
        this.networkReconciler,
        this.networkChannel
      );
    }
    if (showHUD && this.networkHUD) {
      this.networkHUD.show();
    }
    return this.networkReconciler;
  }

  /**
   * Sets vehicle paint color by carIndex (0: Host, 1: Opponent/Client)
   * @param {number} carIndex
   * @param {string|number} colorVal
   */
  /**
   * In-place Hot Swap: Instantly equip a new vehicle model and physical hitbox without page reload.
   * @param {string} visualId
   */
  changePlayerVehicle(visualId) {
    this.selectedPreset = visualId;
    if (this.entityManager) {
      this.entityManager.hotSwapVehicle(this.playerCarIndex, { visual: visualId, hitbox: visualId });
    } else {
      if (this.arena?.swapCarVisual) {
        this.arena.swapCarVisual(this.playerCarIndex, visualId);
      }
      if (this.physics?.setCarHitbox) {
        this.physics.setCarHitbox(this.playerCarIndex, visualId);
      }
    }

    if (this.arena?.cars?.[this.playerCarIndex]) {
      this.flipResetVisual?.dispose?.();
      try {
        this.getFlipResetVisual(this.playerCarIndex);
      } catch (err) {
        console.warn("[GameRuntime] FlipResetVisual re-bind skipped:", err);
      }
      this.camera?.update?.(this.arena.cars[this.playerCarIndex], this.arena.ball, 0, this.cameraDynamics);
    }
  }

  setCarColor(carIndex, colorVal, broadcast = true) {
    if (this.arena?.setCarColor) {
      this.arena.setCarColor(carIndex, colorVal);
    }
    if (broadcast && this.networkChannel?.sendColorChange) {
      const hex = typeof colorVal === 'number'
        ? '#' + colorVal.toString(16).padStart(6, '0')
        : String(colorVal);
      const slot = CAR_COLOR_SLOTS.find(s => s.hex.toLowerCase() === hex.toLowerCase()) || CAR_COLOR_SLOTS[0];
      try {
        this.networkChannel.sendColorChange(slot.id, hex, carIndex);
      } catch (_) {}
    }
  }

  /**
   * Host an online multiplayer room using a dedicated 120Hz server Web Worker
   * @param {object} [options]
   * @param {string} [options.playerName='Host']
   */
  cleanupOnlineSession() {
    if (this.authoritativeServer) {
      try { this.authoritativeServer.destroy?.(); } catch (_) {}
      this.authoritativeServer = null;
    }
    if (this.networkChannel) {
      try { this.networkChannel.destroy?.(); } catch (_) {}
      this.networkChannel = null;
    }
    if (this.networkReconciler) {
      this.networkReconciler = null;
    }
    this.playerCarIndex = 0;
  }

  async stopOnlineServer() {
    this.cleanupOnlineSession();
    if (this.arena?.cars?.[1]) {
      this.arena.cars[1].visible = false;
    }
    if (this.physics && this.physics.numCars > 1) {
      this.physics.configureCars("default", false, 0);
    }
    this.resetKickoff();
  }

  /**
   * Host an online multiplayer room using a dedicated 120Hz server Web Worker
   * @param {object} [options]
   * @param {string} [options.playerName="Host"]
   */
  async hostOnlineServer(options = {}) {
    if (this.authoritativeServer) {
      console.warn("[GameRuntime] Authoritative server already running. Disposing prior instance before hosting.");
      await this.stopOnlineServer();
    }
    const playerName = options.playerName || "Host";

    const initialSnapshot = this.physics.saveState();
    this.authoritativeServer = new HostServerWorker(null, {
      snapshotInterval: 1,
      initialState: Array.from(initialSnapshot),
      hostPlayerName: playerName,
      roomId: options.roomId || 'local_room'
    });
    await this.authoritativeServer.init();

    this.authoritativeServer.sim.setUnlimitedBoost(this.physics.isUnlimitedBoost);
    await Promise.resolve(this.authoritativeServer.sim.restoreState(initialSnapshot));

    // Connect host player client to server worker via dedicated 0ms loopback hostChannel
    this.networkChannel = this.authoritativeServer.channel;
    this.playerCarIndex = 0;

    const serverSnap = this.authoritativeServer.sim.saveState();
    const serverTick = Math.floor(this.authoritativeServer.sim.getHeaderView().tickCount);

    this.networkReconciler = new PredictionReconciler(this.physics, this.networkChannel, {
      localCarIndex: 0,
      redundantHistoryCount: 10,
      enableRedundantInputs: true,
      useBitPacking: false
    });
    this._bindReconcilerSignals(this.networkReconciler);
    this.networkReconciler.onHardResync = () => {
      if (this.interpolator) {
        this.interpolator.sync(performance.now());
      }
    };
    this.networkReconciler.syncTimeline(serverSnap, serverTick);

    this.authoritativeServer.notifyPlayerJoined(0, playerName, 'host');

    if (this.networkHUD) {
      this.networkHUD.setSession(this.networkReconciler, this.networkChannel);
    } else {
      this.networkHUD = new NetworkReconciliationHUD(
        this.container,
        this.networkReconciler,
        this.networkChannel
      );
    }
  }

  /**
   * Join an online multiplayer room as client Car 1 (Orange Team)
   * @param {object} options
   * @param {P2PWebRTCChannel} options.channel
   * @param {string} [options.playerName='Player 2']
   */
  async joinOnlineServer(options = {}) {
    const { channel, playerName = 'Player 2' } = options;
    this.playerCarIndex = 1;
    this.networkChannel = channel;

    await this.arena.ensureOpponent();
    if (this.arena.cars[1]) {
      this.arena.cars[1].visible = true;
    }
    if (this.physics.numCars < 2) {
      this.physics.addCar(1, 'default');
    }

    if (this.arena.cars[1]) {
      this.getFlipResetVisual(1);
      this.camera.update(this.arena.cars[1], this.arena.ball, 0, this.cameraDynamics);
    }

    if (this.interpolator) {
      this.interpolator.sync(performance.now());
    }

    this.networkReconciler = new PredictionReconciler(this.physics, this.networkChannel, {
      localCarIndex: 1,
      redundantHistoryCount: 10,
      enableRedundantInputs: true,
      useBitPacking: false
    });
    this._bindReconcilerSignals(this.networkReconciler);
    this.networkReconciler.onHardResync = () => {
      if (this.interpolator) {
        this.interpolator.sync(performance.now());
      }
    };

    if (this.networkHUD) {
      this.networkHUD.setSession(this.networkReconciler, this.networkChannel);
    } else {
      this.networkHUD = new NetworkReconciliationHUD(
        this.container,
        this.networkReconciler,
        this.networkChannel
      );
    }

    if (this.networkChannel) {
      this.networkChannel.onColorChange = (msg) => {
        const cIdx = msg.carIndex ?? (this.playerCarIndex === 0 ? 1 : 0);
        this.setCarColor(cIdx, msg.hex, false);
      };

      // Notify Host's MatchSessionAdmin via NetworkDataHandler
      if (typeof this.networkChannel.send === "function") {
        this.networkChannel.send(JSON.stringify({
          type: "join",
          playerName: playerName,
          role: "player",
          preferredTeam: 1
        }));
      }
    }
  }

  /**
   * Callback when remote peer connects to host (supports up to 6 players)
   */
  async onRemotePlayerConnected(channel, remotePlayerName = 'Player 2', assignedCarIndex = null) {
    if (this.authoritativeServer) {
      this.authoritativeServer.addClientChannel(channel);
      let targetCarIndex = assignedCarIndex;
      if (typeof targetCarIndex !== 'number' || targetCarIndex < 1) {
        for (let i = 1; i < 6; i++) {
          if (!this.arena.cars[i] || !this.authoritativeServer.channelMap?.has(i)) {
            targetCarIndex = i;
            break;
          }
        }
        if (typeof targetCarIndex !== 'number') targetCarIndex = 1;
      }
      const team = targetCarIndex % 2;
      this.authoritativeServer.ensureCar(targetCarIndex, team);
      this.authoritativeServer.notifyPlayerJoined(targetCarIndex, remotePlayerName, 'player');

      await this.arena.ensureOpponent();
      while (this.arena.cars.length <= targetCarIndex) {
        this.arena.addCar(this.arena.cars.length % 2, 'game-car');
      }
      if (this.arena.cars[targetCarIndex]) {
        this.arena.cars[targetCarIndex].visible = true;
      }
      while (this.physics.numCars <= targetCarIndex) {
        this.physics.addCar(this.physics.numCars % 2, 'default');
      }
      if (this.interpolator) {
        this.interpolator.sync(performance.now());
      }
      if (this.networkHUD) {
        this.networkHUD.setSession(this.networkReconciler, this.networkChannel);
      }
      if (channel) {
        channel.onColorChange = (msg) => {
          const cIdx = msg.carIndex ?? targetCarIndex;
          this.setCarColor(cIdx, msg.hex, false);
        };
      }
      return targetCarIndex;
    }
  }

  async removeRemotePlayer(carIndex) {
    if (typeof carIndex !== 'number' || carIndex < 0) return;
    if (this.authoritativeServer) {
      this.authoritativeServer.removeCar(carIndex);
    }
    this.arena?.removeCar(carIndex);
    if (this.flipResetVisuals.has(carIndex)) {
      this.flipResetVisuals.get(carIndex).stopVisual();
      this.flipResetVisuals.delete(carIndex);
    }
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

  dumpNextNetworkPacket() {
    if (this.networkReconciler?.triggerDumpNextPacket) {
      console.log('%c[Network Packet Dump]%c Waiting for next incoming datagram...', 'background:#1f6feb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold', 'color:#58a6ff');
      return this.networkReconciler.triggerDumpNextPacket();
    }
    console.warn('[Network Packet Dump] No active network prediction reconciler.');
    return Promise.resolve(null);
  }

  dumpLatestNetworkPacket(packet = null) {
    if (this.networkReconciler?.dumpPacket) {
      return this.networkReconciler.dumpPacket(packet);
    }
    console.warn('[Network Packet Dump] No active network prediction reconciler.');
    return null;
  }

  adjustSimulatedLatency(direction) {
    const step = this.networkHUD?.adjustStepMs || 25;
    const ch = this.networkChannel || this.networkHUD?.channel;
    if (ch && typeof ch.setExtraLatency === 'function') {
      const currentExtra = ch.extraLatencyMs ?? 0;
      const nextExtra = Math.max(0, Math.min(500, currentExtra + direction * step));
      ch.setExtraLatency(nextExtra);
      if (this.networkReconciler) {
        const totalRtt = (ch.measuredRttMs > 0 ? ch.measuredRttMs : 0) + nextExtra * 2;
        this.networkReconciler.leadTicks = this.networkReconciler.calculateLeadTicks(totalRtt);
      }
      this.networkHUD?.syncLatencyValues?.();
      return;
    }
    if (this.networkHUD) {
      this.networkHUD.adjustLatency(direction);
    } else {
      this.adjustNetworkLatency(direction * step);
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
    const loadedSettings = garageSettingsStore.load();
    const teamAssignment = getTeamAssignment((this.selectedPreset || loadedSettings.vehiclePreset || loadedSettings.carVisual) === 'flat-car');

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
    this.ballTrajectoryPredictor?.clear();
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

    for (const v of this.flipResetVisuals.values()) v.update(0, false);


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
      if (name !== 'online' && this.onlineDialog && this.onlineDialog.isOpen) this.onlineDialog.close();
      if (name !== 'status' && this.overlayHUD) this.overlayHUD.hideDetails(false);
      if (name !== 'trajectory' && this.ballTrajectoryPredictorHUD && this.ballTrajectoryPredictorHUD.isOpen) {
        this.ballTrajectoryPredictorHUD.hide();
      }
    } else {
      this.openOverlays.delete(name);
      if (this.openOverlays.size === 0) {
        this.isCursorBrowsing = false;
      }
      this.gamepadSettingsJustClosed = true;
    }
    this.syncPausedAndInputState();
  }

  /**
   * Synchronizes pause state and enables/disables input controllers.
   */
  syncPausedAndInputState() {
    this.pendingClickToPlay = false;
    const blockingOverlays = Array.from(this.openOverlays).filter(n => n !== 'trajectory');
    const hasBlockingOverlay = blockingOverlays.length > 0;
    const isTrajectoryOnly = this.openOverlays.has('trajectory') && !hasBlockingOverlay;

    const isPlaying = !hasBlockingOverlay && (!this.isCursorBrowsing || isTrajectoryOnly);
    this.match.state.paused = this.match.state.mode === 'match' && (!isPlaying || this.isBotPaused);

    const allowInputs = !hasBlockingOverlay;
    if (this.keyboard) this.keyboard.enabled = allowInputs;
    if (this.gamepad) this.gamepad.enabled = allowInputs;
    if (this.touch) this.touch.enabled = allowInputs;
    this.updateInteractionState();
    if (this.interpolator) this.interpolator.sync();
  }

  /**
   * Updates CSS interaction classes on root container.
   */
  updateInteractionState() {
    if (!this.container) return;
    const hasFocus = typeof document !== 'undefined' ? (!document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true)) : true;
    const blockingOverlays = Array.from(this.openOverlays).filter(n => n !== 'trajectory');
    const isPlaying = blockingOverlays.length === 0 && hasFocus;
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
            '#settings-button, #car-button, #match-button, #online-button, #trajectory-button, .online-tab-btn, .online-overlay, .online-modal, .net-hud, .hud-tools, .trajectory-overlay, .trajectory-panel'
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
    window.dumpNextNetworkPacket = () => this.dumpNextNetworkPacket();
    window.dumpLatestNetworkPacket = (p) => this.dumpLatestNetworkPacket(p);
    window.toggleNetworkControlPanel = () => this._onToggleNetworkHUD?.();

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

      // F2 or Shift + P (or Ctrl+O): Network Reconciliation & Latency HUD
      if (
        (evt.code === "F2" ||
         ((evt.code === "KeyP" || evt.key === "p" || evt.key === "P") && evt.shiftKey) ||
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

      // Escape key closes Network Controller HUD and Online Dialog cleanly
      if (evt.code === 'Escape') {
        if (this.networkHUD?.visible) {
          evt.preventDefault();
          this.networkHUD.hide();
          return;
        }
        if (this.onlineDialog?.isOpen) {
          evt.preventDefault();
          this.onlineDialog.close();
          return;
        }
      }

      // Hotkey O: Toggle Online Dialog
      if (
        (evt.code === 'KeyO' || evt.key === 'o' || evt.key === 'O') &&
        !evt.repeat &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey &&
        !evt.shiftKey
      ) {
        if (!isEventWithinUI(evt.target) && evt.target.tagName !== 'INPUT' && evt.target.tagName !== 'TEXTAREA') {
          evt.preventDefault();
          this.onlineDialog?.toggle();
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
      if (!audioConfig.get('continueAudioOnLostFocus')) {
        const hasFocus = typeof document !== 'undefined' ? (!document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true)) : true;
        if (!hasFocus) {
          gameAudioEngine.stateEngine?.silenceAll?.();
          getAudioSlotPool()?.silenceAll?.();
        }
      }
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
          this.isCursorBrowsing && this.openOverlays.size === 0 &&
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
        if (wasPending && this.isCursorBrowsing && this.openOverlays.size === 0 && evt.button === 0) {
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
    if (this.ballTrajectoryPredictorHUD) {
      this.ballTrajectoryPredictorHUD.destroy?.();
      this.ballTrajectoryPredictorHUD = null;
    }
    if (this.ballTrajectoryPredictor) {
      this.ballTrajectoryPredictor.dispose?.();
      this.ballTrajectoryPredictor = null;
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
