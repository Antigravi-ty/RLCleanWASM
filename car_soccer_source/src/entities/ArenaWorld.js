import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { VehicleBoostEmitter } from './VehicleBoostEmitter.js';
import {
  createMultiThemeMaterial,
  getThemeMaterial,
  isMultiThemeMaterial,
  resolveThemeMaterial,
  registerThemeSubtree,
  createCelShadedToonMaterial,
  applyArcadeCelShading,
  cloneMaterial
} from '../effects/ThemeMaterialPipeline.js';
import * as THREE from 'three';
/**
 * ArenaWorld.js
 * Comprehensive 3D Soccer Stadium and Vehicle Simulation World.
 * Encapsulates:
 * - Arena dimensions (8192 x 10240 uu) and goal mouth portals.
 * - Procedural turf generation with mowing stripes, field lines, and boost pad decals.
 * - Continuous enclosure boundary geometry, hexagonal bank materials, and glass grid shader.
 * - Stadium architectural GLTF mesh and dynamic dome sky.
 * - Offroad wheels, wishbone linkage, suspension springs, and reaction thruster jets.
 * - Per-frame 120Hz physics state interpolation, car lights, and shadow tracking.
 *
 * Backward-compatibility aliases:
 * - ArenaWorld -> ow
 * - createCarHitboxWireframe -> RS
 * - createCompetitionTurfMesh -> GS
 * - updateTurfPadDecals -> OS
 * - createSuspensionUnit -> mg
 * - createOffroadWheelMesh -> gg
 * - createSuspensionKnuckle -> vg
 * - setupCarReactionJets -> jg
 */

import {
  loadGameCarAsset,
  loadFlatCarAsset,
  loadRealisticCarAsset,
  createRealisticCarModel,
  createRealisticCarGimbals,
  assembleRealisticCar,
  createGameCarModel,
  createFlatCarModel,
  createGameCarWheel,
  createGameCarWheelHardware,
  createFlatCarWheel,
  updateRealisticCockpitGimbal,
  getCarVisualTheme,
  REALISTIC_WHEEL_COORDS,
  FLAT_CAR_WHEEL_COORDS,
  OCTANE_WHEEL_COORDS,
  REALISTIC_SUSPENSION_Z,
  FLAT_CAR_SUSPENSION_HEIGHTS,
  FLAT_CAR_HITBOX_OFFSET,
  createCarPaintMaterial,
  applyVehicleMaterials
} from './VehicleAssembly.js';
import { BoostPadSystem } from './BoostPadSystem.js';
import { loadStadiumContinuousBoundary, loadStadiumArchitecture } from './StadiumArena.js';
import {
  DEFAULT_WHEEL_SPECS,
  getCarRestHeight,
  getWheelSpecsForVisual,
  setVehicleSuspensionThreeContext,
  createOffroadWheelMesh,
  createSuspensionUnit,
  createSuspensionKnuckle,
  updateSuspensionArm,
  updateSuspensionUnitSpring,
  createReactionControlJet,
  setupCarReactionJets,
  updateCarSuspensionAndSteering
} from './VehicleSuspensionSystem.js';

import { BallLocatorArrow } from './BallLocatorArrow.js';
import { SpeedTrail } from './SpeedTrail.js';
import { DemolitionEffect } from './DemolitionEffect.js';
import { loadBallAsset } from './BallVisual.js';
import { HITBOX_PRESETS, createWhiteboxCarModel } from '../ui/GarageDialog.js';
import { onThemeChange } from '../ui/ThemeManager.js';
import {
  SIM_OFFSETS,
  CAR_STATE_OFFSETS as ROCKETSIM_CAR_STATE_OFFSETS,
  CAR_STATE_STRIDE as ROCKETSIM_CAR_STATE_STRIDE,
  BALL_STATE_OFFSETS,
  WASM_WHEEL_OFFSETS,
  MAX_CARS,
  ArenaHeaderView,
  CarStateView,
  BallStateView,
  BoostPadStateView
} from '../physics/RocketSimConstants.js';

// Arena Dimensions & Coordinate Constants (Unreal Units)
export const ARENA_WIDTH = 8192;           // Fi
export const ARENA_LENGTH = 10240;         // Di
export const ARENA_GOAL_DEPTH = 5120;      // US
export const TURF_TEXTURE_WIDTH = 2048;    // dr
export const TURF_TEXTURE_HEIGHT = 2560;

/**
 * Resolves an asset path against base URL or window configuration.
 */
export function resolveAssetPath(path) {
  if (!path) return "";
  if (/^(?:https?:|\/\/|blob:|data:)/.test(path)) return path;
  const base = (typeof window !== "undefined" && (window.__CAR_SOCCER_ASSET_BASE__ || window.__ASSET_BASE__)) || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "";
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith("/") ? path : "/" + path;
  return cleanBase + cleanPath;
}

export const ARENA_BOUNDARY_SPLIT_Y = 280;

export const TEAM_BLUE_HEX = 2844350;
export const TEAM_ORANGE_HEX = 16750126;
export const DEFAULT_TEAM_COLORS = [3111891, 13857839];

export const OCTANE_BOOST_OUTLETS = [
  [-57, 10.25, 20.4278],
  [-57, 10.25, -20.4278]
];

export const FLAT_CAR_BOOST_OUTLETS = [
  [-57.16878128051758, 9.5, 5.489756107330322],
  [-57.16878128051758, 9.5, -5.489756107330322]
];

export const OCTANE_HITBOX_PRESET = {
  length: 120.507,
  width: 86.6994,
  height: 38.6591,
  forward: 13.8757,
  up: 20.755
};

export const STADIUM_FLAT_PARTS = new Set(["Basalt", "Concrete", "Inner fascia", "Tier deck"]);

export const STADIUM_MATERIAL_COLORS = {
  Basalt: 2436921,
  Concrete: 7433570,
  "Inner fascia": 2702664,
  "Tier deck": 4937303,
  Titanium: 7831675,
  Canopy: 9602673,
  "Seat petrol": TEAM_BLUE_HEX,
  "Seat silver": TEAM_ORANGE_HEX,
  "Seat teal": TEAM_ORANGE_HEX,
  "Seat ochre": TEAM_BLUE_HEX
};

// Physics Buffer Offsets & Strides (RocketSim Memory Layout)
export const BUFFER_OFFSETS = SIM_OFFSETS;
export const CAR_STATE_OFFSETS = ROCKETSIM_CAR_STATE_OFFSETS;
export const CAR_STATE_STRIDE = ROCKETSIM_CAR_STATE_STRIDE; // 40
export const BOOST_PAD_OFFSET = SIM_OFFSETS.CARS + MAX_CARS * CAR_STATE_STRIDE; // 342
export const WHEEL_STATE_STRIDE = 3; // EC
export const BOT_CAR_INDEX = 1;      // no

const turfDecalCache = new WeakMap();

let arenaWorldThreeContext = {
  Group: null,
  Mesh: null,
  BoxGeometry: null,
  CylinderGeometry: null,
  SphereGeometry: null,
  PlaneGeometry: null,
  BufferGeometry: null,
  BufferAttribute: null,
  EdgesGeometry: null,
  LineSegments: null,
  LineBasicMaterial: null,
  TubeGeometry: null,
  CatmullRomCurve3: null,
  CurvePath: null,
  LineCurve3: null,
  LatheGeometry: null,
  TorusGeometry: null,
  RingGeometry: null,
  CanvasTexture: null,
  MeshStandardMaterial: null,
  MeshPhysicalMaterial: null,
  MeshBasicMaterial: null,
  ShaderMaterial: null,
  Vector2: null,
  Vector3: null,
  Color: null,
  Quaternion: null,
  Matrix4: null,
  Scene: null,
  DirectionalLight: null,
  HemisphereLight: null,
  DoubleSide: null,
  BackSide: null,
  FrontSide: null,
  AdditiveBlending: null,
  RepeatWrapping: null,
  LinearFilter: null,
  LinearMipmapLinearFilter: null,
  SRGBColorSpace: null,
  mergeVertices: null,
  mergeGeometries: null,
  GLTFLoader: null,
  TextureLoader: null,
  OBJLoader: null,
  VehicleBoostEmitter: null,
  multiThemeMaterial: (m1, m2) => m1,
  getThemeMaterial: (m, mode) => m,
  cloneMaterial: (m) => ({ ...m }),
  markMatrixDirty: () => {},
  setShadowFlags: () => {}
};

let arenaWorldCarLoaders = {
  loadGameCarAsset,
  loadFlatCarAsset,
  loadRealisticCarAsset,
  createRealisticCarModel,
  createRealisticCarGimbals,
  assembleRealisticCar,
  createGameCarModel,
  createFlatCarModel,
  createGameCarWheel,
  createGameCarWheelHardware,
  createFlatCarWheel,
  updateRealisticCockpitGimbal,
  getCarVisualTheme,
  wheelSpecs: {
    realistic: REALISTIC_WHEEL_COORDS,
    flat: FLAT_CAR_WHEEL_COORDS,
    game: OCTANE_WHEEL_COORDS
  },
  suspensionSpecs: {
    realisticZ: REALISTIC_SUSPENSION_Z,
    flatY: FLAT_CAR_SUSPENSION_HEIGHTS
  },
  hitboxOffsets: {
    realistic: OCTANE_BOOST_OUTLETS,
    flat: FLAT_CAR_HITBOX_OFFSET,
    flatJets: FLAT_CAR_BOOST_OUTLETS
  },
  teamColors: DEFAULT_TEAM_COLORS
};

export function setArenaWorldThreeContext(context) {
  if (!context) return;
  const descriptors = Object.getOwnPropertyDescriptors(context);
  Object.defineProperties(arenaWorldThreeContext, descriptors);
  setVehicleSuspensionThreeContext(context);
}

export function setArenaWorldCarLoaders(loaders) {
  if (!loaders) return;
  arenaWorldCarLoaders = { ...arenaWorldCarLoaders, ...loaders };
}

export function resolveContext() {
  return {
    ...THREE,
    GLTFLoader: arenaWorldThreeContext.GLTFLoader || GLTFLoader,
    OBJLoader: arenaWorldThreeContext.OBJLoader || OBJLoader,
    VehicleBoostEmitter: arenaWorldThreeContext.VehicleBoostEmitter || VehicleBoostEmitter,
    mergeVertices,
    mergeGeometries,
    multiThemeMaterial: createMultiThemeMaterial,
    getThemeMaterial,
    isMultiThemeMaterial,
    resolveThemeMaterial,
    registerThemeSubtree,
    markMatrixDirty: registerThemeSubtree,
    cloneMaterial: createCelShadedToonMaterial,
    createCelShadedToonMaterial,
    setShadowFlags: applyArcadeCelShading,
    applyArcadeCelShading
  };
}

export function unrealToThreeCoords(target, x = 0, y = 0, z = 0) {
  return target.set(x || 0, z || 0, y || 0);
}

let basisFwd = null;
let basisRight = null;
let basisUp = null;
let basisMatrix = null;

/**
 * Reconstructs orientation quaternion from RocketSim state 3 basis vectors:
 * offset + 0: forward (3 floats)
 * offset + 3: right (3 floats)
 * offset + 6: up (3 floats)
 */
/**
 * Converts 3-axis basis vectors from state view to Three.js Quaternion.
 */
export function viewBasisToQuaternion(targetQuat, view) {
  const { Vector3, Matrix4 } = resolveContext();
  if (!basisFwd) basisFwd = new Vector3();
  if (!basisRight) basisRight = new Vector3();
  if (!basisUp) basisUp = new Vector3();
  if (!basisMatrix) basisMatrix = new Matrix4();

  unrealToThreeCoords(basisFwd, view.fwdX, view.fwdY, view.fwdZ);
  unrealToThreeCoords(basisRight, view.rightX, view.rightY, view.rightZ);
  unrealToThreeCoords(basisUp, view.upX, view.upY, view.upZ);

  if (basisFwd.lengthSq() < 1e-6 || basisUp.lengthSq() < 1e-6 || basisRight.lengthSq() < 1e-6) {
    targetQuat.set(0, 0, 0, 1);
    return targetQuat;
  }

  basisMatrix.makeBasis(basisFwd, basisUp, basisRight);
  targetQuat.setFromRotationMatrix(basisMatrix);
  return targetQuat;
}

export function bufferBasisToQuaternion(targetQuat, buffer, offset) {
  const { Vector3, Matrix4 } = resolveContext();
  if (!basisFwd) basisFwd = new Vector3();
  if (!basisRight) basisRight = new Vector3();
  if (!basisUp) basisUp = new Vector3();
  if (!basisMatrix) basisMatrix = new Matrix4();

  unrealToThreeCoords(basisFwd, buffer[offset], buffer[offset + 1], buffer[offset + 2]);
  unrealToThreeCoords(basisRight, buffer[offset + 3], buffer[offset + 4], buffer[offset + 5]);
  unrealToThreeCoords(basisUp, buffer[offset + 6], buffer[offset + 7], buffer[offset + 8]);

  if (basisFwd.lengthSq() < 1e-6 || basisUp.lengthSq() < 1e-6 || basisRight.lengthSq() < 1e-6) {
    targetQuat.set(0, 0, 0, 1);
    return targetQuat;
  }

  basisMatrix.makeBasis(basisFwd, basisUp, basisRight);
  targetQuat.setFromRotationMatrix(basisMatrix);
  return targetQuat;
}

/**
 * Backward compatibility quaternion unpacker: supports either 9-float basis vector extraction
 * or fallback 4-float quaternion unpacking.
 */
export function unpackBufferQuaternion(targetQuat, buffer, offset) {
  if (!buffer || buffer.length < offset + 9) {
    if (buffer && buffer.length >= offset + 4 && (buffer[offset] || buffer[offset + 1] || buffer[offset + 2] || buffer[offset + 3])) {
      targetQuat.set(buffer[offset], buffer[offset + 2], buffer[offset + 1], buffer[offset + 3]);
      return targetQuat;
    }
    targetQuat.set(0, 0, 0, 1);
    return targetQuat;
  }
  return bufferBasisToQuaternion(targetQuat, buffer, offset);
}

// Suspension spring and arm helpers moved to VehicleSuspensionSystem.js

/**
 * Generates procedural wireframe box for visual hitbox debugging.
 */
export function createCarHitboxWireframe(preset = OCTANE_HITBOX_PRESET) {
  const { BoxGeometry, EdgesGeometry, LineSegments, LineBasicMaterial } = resolveContext();
  const boxGeom = new BoxGeometry(preset.length, preset.height, preset.width);
  const edgesGeom = new EdgesGeometry(boxGeom);
  const lineMat = new LineBasicMaterial({
    color: 16777215,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: false
  });
  const hitboxMesh = new LineSegments(edgesGeom, lineMat);
  hitboxMesh.name = "car-hitbox";
  hitboxMesh.position.set(preset.forward, preset.up, 0);
  hitboxMesh.renderOrder = 100;
  hitboxMesh.visible = false;
  return hitboxMesh;
}

/**
 * Generates procedural striped turf canvas texture with soccer pitch markings.
 */
export function createStadiumTurfTexture(wornFineStripes = false) {
  const { CanvasTexture, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter } = resolveContext();
  if (typeof document === 'undefined') {
    return new CanvasTexture({});
  }

  const canvas = document.createElement("canvas");
  canvas.width = TURF_TEXTURE_WIDTH;
  canvas.height = TURF_TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  let seed = 1296388681;
  const prng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const imgData = ctx.createImageData(TURF_TEXTURE_WIDTH, TURF_TEXTURE_HEIGHT);
  const data = imgData.data;
  const xFreq = new Float32Array(TURF_TEXTURE_WIDTH);
  for (let x = 0; x < TURF_TEXTURE_WIDTH; x++) {
    xFreq[x] = Math.sin(x * 0.026) * 0.009 + Math.sin(x * 0.0073 + 1.1) * 0.018 + (Math.floor(x / 160) % 2) * 0.015;
  }

  for (let y = 0; y < TURF_TEXTURE_HEIGHT; y++) {
    const worldY = (y * ARENA_LENGTH) / TURF_TEXTURE_HEIGHT - ARENA_LENGTH / 2;
    const stripePattern = Math.floor(y / (wornFineStripes ? 160 : 320)) % 2;
    const ySine = Math.sin(y * 0.021) * 0.014 + Math.sin(y * 0.0051) * 0.022;
    const goalDecay = Math.exp(-Math.pow((Math.abs(worldY) - 4510) / 390, 2));

    for (let x = 0; x < TURF_TEXTURE_WIDTH; x++) {
      const worldX = (x * ARENA_WIDTH) / TURF_TEXTURE_WIDTH - ARENA_WIDTH / 2;
      const cornerDim = Math.abs(worldX) > 3650 || Math.abs(worldY) > 4800 ? (wornFineStripes ? 0.81 : 0.88) : 1;
      const goalMouthShade = wornFineStripes ? goalDecay * Math.exp(-Math.pow(worldX / 880, 2)) : 0;
      const bladeNoise = wornFineStripes ? 0.955 + prng() * 0.09 + xFreq[x] + ySine : 0.995 + prng() * 0.01;
      const idx = (y * TURF_TEXTURE_WIDTH + x) * 4;

      data[idx] = ((wornFineStripes ? (stripePattern ? 32 : 26) + goalMouthShade * 9 : stripePattern ? 35 : 30)) * bladeNoise * cornerDim;
      data[idx + 1] = ((wornFineStripes ? (stripePattern ? 84 : 76) - goalMouthShade * 6 : stripePattern ? 105 : 94)) * bladeNoise * cornerDim;
      data[idx + 2] = ((wornFineStripes ? (stripePattern ? 36 : 30) - goalMouthShade * 5 : stripePattern ? 39 : 34)) * bladeNoise * cornerDim;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  ctx.scale(TURF_TEXTURE_WIDTH / ARENA_WIDTH, TURF_TEXTURE_HEIGHT / ARENA_LENGTH);
  ctx.translate(ARENA_WIDTH / 2, ARENA_LENGTH / 2);
  ctx.lineWidth = 22;
  ctx.strokeStyle = "rgba(235, 245, 225, 0.96)";
  ctx.fillStyle = "rgba(235, 245, 225, 0.96)";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const drawLine = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawArc = (x, y, r, fill = false) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) ctx.fill(); else ctx.stroke();
  };

  const halfPitchX = 3500, halfPitchY = 4700;
  ctx.strokeRect(-halfPitchX, -halfPitchY, halfPitchX * 2, halfPitchY * 2);
  drawLine(-halfPitchX, 0, halfPitchX, 0);
  drawArc(0, 0, 915);
  drawArc(0, 0, 23, true);

  for (const sign of [-1, 1]) {
    const goalY = sign * halfPitchY;
    const penY = sign * 3350;
    const teamHex = sign < 0 ? TEAM_BLUE_HEX : TEAM_ORANGE_HEX;
    const teamColorStr = `#${(teamHex & 0xffffff).toString(16).padStart(6, '0')}`;

    ctx.fillStyle = teamColorStr;
    ctx.globalAlpha = 0.13;
    ctx.fillRect(-2000, Math.min(goalY, penY), 4000, Math.abs(goalY - penY));
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = teamColorStr;
    ctx.lineWidth = 30;

    drawLine(-halfPitchX, 0, -halfPitchX, goalY);
    drawLine(halfPitchX, 0, halfPitchX, goalY);
    drawLine(-halfPitchX, goalY, halfPitchX, goalY);

    ctx.beginPath();
    ctx.moveTo(-2000, goalY); ctx.lineTo(-2000, penY); ctx.lineTo(2000, penY); ctx.lineTo(2000, goalY); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-1150, goalY); ctx.lineTo(-1150, sign * 4190); ctx.lineTo(1150, sign * 4190); ctx.lineTo(1150, goalY); ctx.stroke();
    drawArc(0, sign * 3760, 20, true);

    ctx.save();
    ctx.beginPath();
    ctx.rect(-1600, sign > 0 ? 2000 : -3350, 3200, 1350);
    ctx.clip();
    drawArc(0, sign * 3760, 850);
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.name = wornFineStripes ? "Stadium / worn grass and fine mowing stripes" : "Stadium / striped grass and painted pitch";
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Builds the competition pitch mesh with emerald/natural dual-theme turf.
 */
export function createCompetitionTurfMesh() {
  const { Group, PlaneGeometry, MeshStandardMaterial, Mesh, multiThemeMaterial, markMatrixDirty } = resolveContext();
  const turfGroup = new Group();
  turfGroup.name = "Stadium / competition turf";

  const emeraldTex = createStadiumTurfTexture(false);
  const naturalTex = createStadiumTurfTexture(true);

  const emeraldMat = new MeshStandardMaterial({
    name: "Stadium / emerald mown turf",
    map: emeraldTex,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.35
  });
  const naturalMat = new MeshStandardMaterial({
    name: "Stadium / natural mown turf",
    map: naturalTex,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 1
  });

  const turfMesh = new Mesh(new PlaneGeometry(ARENA_WIDTH, ARENA_LENGTH), multiThemeMaterial(emeraldMat, naturalMat));
  turfMesh.name = "Stadium / painted playing surface";
  turfMesh.rotation.x = -Math.PI / 2;
  turfMesh.receiveShadow = true;
  turfGroup.add(turfMesh);

  turfDecalCache.set(turfGroup, [emeraldTex, naturalTex].map(tex => ({
    texture: tex,
    base: tex.image
  })));

  markMatrixDirty(turfGroup);
  return turfGroup;
}

/**
 * Stamps boost pad boundary rings, chevrons, backing plates, and speed lanes directly onto the pitch texture.
 */
export function updateTurfPadDecals(turfGroup, padDefs) {
  const cached = turfDecalCache.get(turfGroup);
  if (!cached || !padDefs || !padDefs.length) return;

  const signature = padDefs.map(d => `${d.pos[0]},${d.pos[1]},${d.isBig}`).join(";");
  for (const item of cached) {
    if (item.padSignature === signature) continue;
    if (typeof document === "undefined") return;

    const canvas = document.createElement("canvas");
    canvas.width = TURF_TEXTURE_WIDTH;
    canvas.height = TURF_TEXTURE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx || !item.base) continue;

    ctx.drawImage(item.base, 0, 0);
    ctx.scale(TURF_TEXTURE_WIDTH / ARENA_WIDTH, TURF_TEXTURE_HEIGHT / ARENA_LENGTH);
    ctx.translate(ARENA_WIDTH / 2, ARENA_LENGTH / 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const toRgb = hex => `${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}`;
    const blueStr = toRgb(TEAM_BLUE_HEX);
    const orangeStr = toRgb(TEAM_ORANGE_HEX);
    const midStr = "201, 221, 195";
    const getPadColor = y => y < -50 ? blueStr : y > 50 ? orangeStr : midStr;
    const bigPads = padDefs.filter(d => d.isBig);
    const drawArc = (x, y, r, start, end) => {
      ctx.beginPath();
      ctx.arc(x, y, r, start, end);
      ctx.stroke();
    };

    // 1. S-curve boost lanes connecting corner pads to midfield
    for (const sideY of [-1, 1]) {
      const colorStr = sideY < 0 ? blueStr : orangeStr;
      for (const sideX of [-1, 1]) {
        const cornerPad = bigPads
          .filter(pad => pad.pos[0] * sideX > 1000 && pad.pos[1] * sideY > 1000)
          .sort((a, b) => Math.abs(b.pos[1]) - Math.abs(a.pos[1]))[0];
        if (!cornerPad) continue;

        const midPad = bigPads.find(pad => pad.pos[0] * sideX > 1000 && Math.abs(pad.pos[1]) < 800);
        const midPadX = midPad?.pos[0] ?? sideX * 3550;
        const midPadY = midPad?.pos[1] ?? 0;
        const [cornerX, cornerY] = cornerPad.pos;

        const tracePath = () => {
          ctx.beginPath();
          ctx.moveTo(midPadX, midPadY + sideY * 245);
          ctx.bezierCurveTo(midPadX - sideX * 110, sideY * 1780, cornerX - sideX * 260, cornerY - sideY * 760, cornerX, cornerY);
          ctx.quadraticCurveTo(cornerX - sideX * 360, cornerY + sideY * 370, sideX * 1470, sideY * 4560);
        };

        ctx.lineWidth = 160;
        ctx.strokeStyle = `rgba(${colorStr}, 0.10)`;
        tracePath();
        ctx.stroke();

        ctx.lineWidth = 10;
        ctx.strokeStyle = `rgba(${colorStr}, 0.49)`;
        tracePath();
        ctx.stroke();

        ctx.fillStyle = `rgba(${colorStr}, 0.075)`;
        ctx.beginPath();
        ctx.moveTo(sideX * 1020, sideY * 4780);
        ctx.lineTo(sideX * 2220, sideY * 4780);
        ctx.lineTo(sideX * 1900, sideY * 4060);
        ctx.lineTo(sideX * 1510, sideY * 4240);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Pad ground markings
    for (const pad of padDefs) {
      const [padX, padY] = pad.pos;
      const padColorRgb = getPadColor(padY);
      const innerRingRadius = pad.isBig ? 163 : 69;
      const padHeadingAngle = Math.atan2(-padY, -padX);

      if (pad.isBig) {
        ctx.fillStyle = `rgba(${padColorRgb}, 0.12)`;
        ctx.beginPath();
        ctx.arc(padX, padY, 338, padHeadingAngle - Math.PI / 2, padHeadingAngle + Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(${padColorRgb}, 0.62)`;
        ctx.lineWidth = 13;
        drawArc(padX, padY, 338, padHeadingAngle - 1.27, padHeadingAngle + 1.27);

        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(${padColorRgb}, 0.34)`;
        drawArc(padX, padY, 363, padHeadingAngle - 1.12, padHeadingAngle + 1.12);
      }

      ctx.strokeStyle = `rgba(${midStr}, ${pad.isBig ? 0.68 : 0.56})`;
      ctx.lineWidth = pad.isBig ? 11 : 8;
      drawArc(padX, padY, innerRingRadius, 0, Math.PI * 2);

      ctx.strokeStyle = `rgba(${padColorRgb}, ${pad.isBig ? 0.82 : 0.64})`;
      ctx.lineWidth = pad.isBig ? 18 : 8;

      const outerChevronRadius = innerRingRadius + (pad.isBig ? 43 : 28);
      for (const offset of [0, Math.PI]) {
        drawArc(padX, padY, outerChevronRadius, padHeadingAngle + offset - 0.74, padHeadingAngle + offset + 0.74);
      }

      ctx.save();
      ctx.translate(padX, padY);
      ctx.rotate(padHeadingAngle);
      ctx.lineWidth = pad.isBig ? 9 : 6;
      ctx.strokeStyle = `rgba(${padColorRgb}, 0.45)`;

      const chevronOffset = outerChevronRadius + (pad.isBig ? 160 : 28);
      for (const sideSign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(chevronOffset, sideSign * (pad.isBig ? 38 : 22));
        ctx.lineTo(chevronOffset + (pad.isBig ? 155 : 70), sideSign * (pad.isBig ? 38 : 22));
        ctx.stroke();
      }
      ctx.restore();
    }

    item.texture.image = canvas;
    item.texture.needsUpdate = true;
    item.padSignature = signature;
  }
}

/**
 * Creates stadium dome sky shader mesh.
 */
export function createStadiumDomeSky() {
  const { ShaderMaterial, SphereGeometry, Mesh, Color, FrontSide, multiThemeMaterial, markMatrixDirty } = resolveContext();
  const arcadeMat = new ShaderMaterial({
    name: "Stadium / arcade sky",
    side: FrontSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new Color(1389936) },
      middle: { value: new Color(3766190) },
      horizon: { value: new Color(8894931) }
    },
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: `
      varying vec3 vSkyDirection;
      uniform vec3 zenith;
      uniform vec3 middle;
      uniform vec3 horizon;
      void main() {
        vec3 direction = normalize(vSkyDirection);
        float h = max(0.0, direction.y);
        vec3 color = mix(horizon, middle, smoothstep(0.0, 0.22, h));
        color = mix(color, zenith, pow(smoothstep(0.10, 0.88, h), 0.65));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const realisticMat = arcadeMat.clone();
  realisticMat.name = "Stadium / blue-hour sky";
  realisticMat.uniforms.zenith.value.setHex(794685);
  realisticMat.uniforms.middle.value.setHex(4679561);
  realisticMat.uniforms.horizon.value.setHex(10784133);

  const skyMesh = new Mesh(new SphereGeometry(28000, 48, 24), multiThemeMaterial(arcadeMat, realisticMat));
  skyMesh.name = "Stadium / open blue sky";
  skyMesh.userData.bloomOccluder = false;
  skyMesh.renderOrder = 10000;
  markMatrixDirty(skyMesh);
  return skyMesh;
}

// Wheel meshes, suspension units, knuckles and reaction thrusters moved to VehicleSuspensionSystem.js

/**
 * ArenaWorld (aliased as ow)
 * Central manager for the 3D soccer pitch, ball, vehicles, lights, shadows, and camera targets.
 */
export class ArenaWorld {
  constructor(ballRadius, defaultCarVisual = "game-car") {
    const { Scene, Group, Color, Fog, HemisphereLight, DirectionalLight, Vector3, Quaternion, RingGeometry, MeshBasicMaterial, Mesh } = resolveContext();

    this.scene = new Scene();
    this.ball = new Group();
    this.cars = [];
    this.vehiclePresets = [];
    this.carVisuals = this.vehiclePresets;
    this.pads = [];
    this.boostPadSystem = new BoostPadSystem();
    this.carHitboxes = [];
    this.carHitboxesVisible = true;
    this.padTemplates = null;
    this.gameCarAsset = null;
    this.flatCarAsset = null;
    this.realisticCarAsset = null;
    this.carGimbals = [];
    this.carSuspension = [];
    this.carWheels = [];
    this.carWheelSpecs = [];
    this.wheelSpin = [];
    this.carBoosts = [];
    this.carDemolitions = [];
    this.carJets = [];
    this.jumpPrev = [];
    this.jumpTimer = [];
    this.flipPrev = [];
    this.dodgeBurst = [];
    this.dodgeRoll = [];
    this.dodgeYaw = [];
    this.dodgePitch = [];
    this.ballRadius = ballRadius;
    this.ballSpeedTrail = new SpeedTrail();
    this.ballLocatorArrow = new BallLocatorArrow();
    this.ballVelocity = new Vector3();
    this._renderTreeVersion = 0;
    this.pA = new Vector3();
    this.pB = new Vector3();
    this.qA = new Quaternion();
    this.qB = new Quaternion();
    this.shadowFocus = new Vector3();
    this.vehiclePreset = defaultCarVisual;
    this.carVisual = defaultCarVisual;
    this.stadium = null;
    this.stadiumVisible = true;

    this.scene.background = new Color(4679561);
    if (Fog) {
      this.scene.fog = new Fog(6586005, 15000, 34000);
    }
    this.scene.add(new HemisphereLight(13164543, 2569000, 1.15));

    this.carSunTarget = new Group();
    this.ballSunTarget = new Group();
    this.opponentSunTarget = new Group();
    this.opponentSun = null;

    this.carSun = this.makeSubjectSun(this.carSunTarget, 260);
    this.ballSun = this.makeSubjectSun(this.ballSunTarget, 190);
    this.scene.add(this.carSunTarget, this.ballSunTarget, this.carSun, this.ballSun);

    const keyLight = new DirectionalLight(8956671, 0.35);
    keyLight.position.set(-2000, 2000, -2000);
    this.scene.add(keyLight);

    this.turf = createCompetitionTurfMesh();
    this.sky = createStadiumDomeSky();
    this.scene.add(this.turf, this.sky);

    this.scene.add(this.ball);
    if (this.ballLocatorArrow?.object) this.scene.add(this.ballLocatorArrow.object);
    if (this.ballSpeedTrail?.object) this.scene.add(this.ballSpeedTrail.object);

    const ringRadius = ballRadius * 1.15;
    const ringGeom = new RingGeometry(ringRadius * 0.92, ringRadius, 48);
    const ringMat = new MeshBasicMaterial({ color: 16777215, transparent: true, opacity: 0.55, depthWrite: false });
    this.indicatorRing = new Mesh(ringGeom, ringMat);
    this.indicatorHeightRing = new Mesh(ringGeom, ringMat);
    for (const r of [this.indicatorRing, this.indicatorHeightRing]) {
      r.rotation.x = -Math.PI / 2;
      r.renderOrder = 2;
      this.scene.add(r);
    }

    this.markRenderTreeChanged();

    this.playerCarIndex = 0;

    // Reusable, zero-allocation RocketSim state views
    this._headerView = new ArenaHeaderView();
    this._currCarView = new CarStateView();
    this._prevCarView = new CarStateView();
    this._currBallView = new BallStateView();
    this._prevBallView = new BallStateView();

    if (typeof onThemeChange === 'function') {
      const weakThis = new WeakRef(this);
      onThemeChange(() => weakThis.deref()?.markRenderTreeChanged());
    }
  }

  resetBallTrail() {
    this.ballSpeedTrail?.reset();
  }

  get renderTreeVersion() {
    return this._renderTreeVersion;
  }

  get boostBloomActive() {
    for (const carGroup of this.carBoosts) {
      for (const emitter of carGroup) {
        if (emitter?.bloomActive) return true;
      }
    }
    return false;
  }

  markRenderTreeChanged() {
    this._renderTreeVersion++;
  }

  async loadBall() {
    try {
      const ballAsset = await loadBallAsset();
      this.ball.add(ballAsset);
    } catch (err) {
      console.warn("Ball asset failed to load, keeping default procedural mesh:", err);
    }
    this.markRenderTreeChanged();
  }

  updateBallLocatorArrow(ballCamActive, carIndex = 0, targetBall = this.ball, targetCar = null) {
    this.ballLocatorArrow?.update(targetCar || this.cars[carIndex] || this.cars[0], targetBall || this.ball, ballCamActive);
  }

  async loadAllAssets(onProgress = null) {
    let completed = 0;
    const total = 3;
    const step = (name) => {
      completed++;
      if (typeof onProgress === "function") {
        onProgress(completed / total, name);
      }
    };

    await Promise.all([
      this.loadArena().then(() => step("Stadium Architecture & Boundary")),
      this.loadBall().then(() => step("Soccer Ball Geometry")),
      this.loadCarAndPadAssets().then(() => step("Vehicle Models & Boost Pads"))
    ]);
    this.markRenderTreeChanged();
  }

  async loadCarAndPadAssets() {
    if (arenaWorldCarLoaders.loadGameCarAsset) {
      try {
        this.gameCarAsset = await arenaWorldCarLoaders.loadGameCarAsset();
      } catch (err) {
        console.warn("Game car asset failed to load:", err);
      }
    }
    if (arenaWorldCarLoaders.loadFlatCarAsset) {
      try {
        this.flatCarAsset = await arenaWorldCarLoaders.loadFlatCarAsset();
      } catch (err) {
        console.warn("Flat car asset failed to load:", err);
      }
    }
    if (arenaWorldCarLoaders.loadRealisticCarAsset) {
      try {
        this.realisticCarAsset = await arenaWorldCarLoaders.loadRealisticCarAsset();
      } catch (err) {
        console.warn("Realistic car asset failed to load:", err);
      }
    }

    const {
      OBJLoader,
      TextureLoader,
      SRGBColorSpace,
      MeshStandardMaterial,
      multiThemeMaterial,
      cloneMaterial,
      Mesh
    } = resolveContext();

    if (OBJLoader && TextureLoader) {
      try {
        const objLoader = new OBJLoader();
        const texLoader = new TextureLoader();

        const [bigActive, bigIdle, smallActive, smallIdle, albedo] = await Promise.all([
          objLoader.loadAsync(resolveAssetPath("/assets/arena/pads/large-active.obj")),
          objLoader.loadAsync(resolveAssetPath("/assets/arena/pads/large-idle.obj")),
          objLoader.loadAsync(resolveAssetPath("/assets/arena/pads/small-active.obj")),
          objLoader.loadAsync(resolveAssetPath("/assets/arena/pads/small-idle.obj")),
          texLoader.loadAsync(resolveAssetPath("/assets/arena/pads/albedo.png"))
        ]);

        if (albedo && SRGBColorSpace) albedo.colorSpace = SRGBColorSpace;

        const padMat = (typeof multiThemeMaterial === "function") ? multiThemeMaterial(
          cloneMaterial ? cloneMaterial({ map: albedo }) : new MeshStandardMaterial({ map: albedo }),
          new MeshStandardMaterial({ map: albedo, roughness: 0.6, metalness: 0.2 })
        ) : new MeshStandardMaterial({ map: albedo, roughness: 0.6, metalness: 0.2 });

        for (const obj of [bigActive, bigIdle, smallActive, smallIdle]) {
          if (obj) {
            if (obj.rotation && typeof obj.rotation.x === "number") {
              obj.rotation.x = -Math.PI / 2;
            }
            obj.traverse?.(child => {
              if (child instanceof Mesh || child.isMesh) {
                child.material = padMat;
              }
            });
          }
        }
        this.padTemplates = {
          bigFull: bigActive,
          bigBase: bigIdle,
          smallFull: smallActive,
          smallBase: smallIdle
        };
      } catch (err) {
        console.warn("Pad models failed to load, keeping primitive fallbacks", err);
      }
    }

    this.markRenderTreeChanged();
  }

  async loadArena() {
    try {
      const [boundary, stadium] = await Promise.all([
        loadStadiumContinuousBoundary(resolveContext).catch(err => {
          console.warn("Continuous stadium boundary failed to load:", err);
          return null;
        }),
        loadStadiumArchitecture(resolveContext).catch(err => {
          console.warn("Stadium architecture failed to load:", err);
          return null;
        })
      ]);
      if (boundary) {
        this.boundary = boundary;
        this.scene.add(boundary);
      }
      if (stadium) {
        this.stadium = stadium;
        if (this.stadiumVisible) {
          this.scene.add(stadium);
        }
      }
    } catch (err) {
      console.warn("loadArena skipped:", err);
    }
    this.markRenderTreeChanged();
  }

  setStadiumVisible(visible) {
    if (this.stadiumVisible !== visible) {
      this.stadiumVisible = visible;
      for (const t of [this.stadium, this.sky]) {
        if (t) {
          visible ? this.scene.add(t) : t.removeFromParent?.();
        }
      }
      const { Color } = resolveContext();
      this.scene.background = new Color(visible ? 4679561 : 0);
      this.markRenderTreeChanged();
    }
  }


  setCarColor(carIndex, colorVal) {
    if (!this.carColors) this.carColors = [];
    const num = typeof colorVal === "string" ? parseInt(colorVal.replace("#", ""), 16) : colorVal;
    this.carColors[carIndex] = num;

    const carRoot = this.cars[carIndex];
    if (!carRoot) return;
    const palette = createCarPaintMaterial(num, undefined, resolveContext);
    applyVehicleMaterials(carRoot, palette, resolveContext);
  }

  async ensureOpponent() {
    if (this.cars.length <= 1) {
      if (!this.gameCarAsset && arenaWorldCarLoaders.loadGameCarAsset) {
        try {
          this.gameCarAsset = await arenaWorldCarLoaders.loadGameCarAsset();
        } catch (err) {
          console.warn("Opponent game car asset load skipped:", err);
        }
      }
      this.opponentSun = this.makeSubjectSun(this.opponentSunTarget, 260);
      this.opponentSun.visible = false;
      this.scene.add(this.opponentSun, this.opponentSunTarget);
      this.addCar(1, "game-car");
    }
  }

  async prepareAssets() {
    await this.ensureOpponent();
    if (this.cars[BOT_CAR_INDEX]) this.cars[BOT_CAR_INDEX].visible = false;
    await Promise.all(this.carBoosts.flatMap(emitterList => emitterList.map(emitter => emitter.preload?.())));
  }

  addCar(teamIndex, visual = this.carVisual) {
    const { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial } = resolveContext();
    const carRoot = new Group();
    const isBot = this.cars.length === BOT_CAR_INDEX;
    const isHitbox = visual.startsWith("hitbox-");
    const isRealistic = visual === "realistic";
    const isFlat = visual === "flat-car";
    const teamColor = arenaWorldCarLoaders.teamColors?.[teamIndex] ?? DEFAULT_TEAM_COLORS[teamIndex % 2];

    let gimbals = null;
    let boostOutlets = null;

    if (isHitbox) {
      const preset = HITBOX_PRESETS[visual] || HITBOX_PRESETS["hitbox-octane"];
      let carModel;
      try {
        carModel = createWhiteboxCarModel(visual, teamColor);
      } catch (err) {
        carModel = new Group();
      }
      carModel.name = "car-body-mesh";
      carRoot.add(carModel);
      const hitboxBox = createCarHitboxWireframe(preset);
      hitboxBox.name = "car-hitbox-wireframe";
      hitboxBox.visible = this.carHitboxesVisible;
      this.carHitboxes.push(hitboxBox);
      this.carGimbals.push(null);
      carRoot.add(hitboxBox);
      boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
    } else if (isRealistic && arenaWorldCarLoaders.createRealisticCarModel) {
      const realisticGroup = new Group();
      realisticGroup.name = "realistic-car";
      const model = arenaWorldCarLoaders.createRealisticCarModel(teamColor);
      realisticGroup.add(model.group);
      gimbals = arenaWorldCarLoaders.createRealisticCarGimbals ? arenaWorldCarLoaders.createRealisticCarGimbals() : null;
      if (this.realisticCarAsset && arenaWorldCarLoaders.assembleRealisticCar) {
        arenaWorldCarLoaders.assembleRealisticCar(this.realisticCarAsset, model, gimbals, teamColor);
      }
      if (gimbals?.hitbox) {
        gimbals.hitbox.visible = this.carHitboxesVisible;
        this.carHitboxes.push(gimbals.hitbox);
        this.carGimbals.push(gimbals);
        carRoot.add(realisticGroup, gimbals.root);
      } else {
        const hitboxBox = createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
        hitboxBox.visible = this.carHitboxesVisible;
        this.carHitboxes.push(hitboxBox);
        this.carGimbals.push(null);
        carRoot.add(realisticGroup, hitboxBox);
      }
      boostOutlets = [model.boostOutlet || new Vector3(-57, 10.25, 0)];
    } else {
      let carModel;
      if (isFlat && arenaWorldCarLoaders.createFlatCarModel && this.flatCarAsset) {
        carModel = arenaWorldCarLoaders.createFlatCarModel(this.flatCarAsset, teamColor);
      } else if (arenaWorldCarLoaders.createGameCarModel && this.gameCarAsset) {
        const theme = arenaWorldCarLoaders.getCarVisualTheme ? arenaWorldCarLoaders.getCarVisualTheme(this.carVisual) : undefined;
        carModel = arenaWorldCarLoaders.createGameCarModel(this.gameCarAsset, teamColor, isBot ? theme : undefined);
      } else {
        try {
          carModel = createWhiteboxCarModel("hitbox-octane", teamColor);
        } catch (err) {
          carModel = new Group();
        }
      }
      carModel.name = "car-body-mesh";
      carRoot.add(carModel);
      const hitboxPreset = isFlat ? (HITBOX_PRESETS["hitbox-dominus"] || OCTANE_HITBOX_PRESET) : OCTANE_HITBOX_PRESET;
      const hitboxBox = createCarHitboxWireframe(hitboxPreset);
      hitboxBox.name = "car-hitbox-wireframe";
      hitboxBox.visible = this.carHitboxesVisible;
      this.carHitboxes.push(hitboxBox);
      this.carGimbals.push(null);
      carRoot.add(hitboxBox);
      if (isFlat) {
        boostOutlets = FLAT_CAR_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
      } else {
        boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
      }
    }

    let wheelSpecs = getWheelSpecsForVisual(visual);
    if (!isHitbox && !isFlat && !isRealistic && arenaWorldCarLoaders.wheelSpecs?.game) {
      wheelSpecs = arenaWorldCarLoaders.wheelSpecs.game;
    }

    const wheels = [];
    if (isHitbox || !this.gameCarAsset) {
      const wheelGeom = new CylinderGeometry(13.5, 13.5, 9, 16);
      wheelGeom.rotateX?.(Math.PI / 2);
      const wheelMat = new MeshStandardMaterial({ color: 2171169, roughness: 0.9, metalness: 0.1 });
      for (let wheelIndex = 0; wheelIndex < 4; wheelIndex++) {
        const [specX, specZ] = wheelSpecs[wheelIndex] || [0, 0];
        const steerGroup = new Group();
        steerGroup.position.set(specX, -6.0, specZ);
        const spinGroup = new Group();
        const wm = new Mesh(wheelGeom, wheelMat);
        wm.castShadow = true;
        spinGroup.add(wm);
        steerGroup.add(spinGroup);
        carRoot.add(steerGroup);
        wheels.push({ steer: steerGroup, spin: spinGroup });
      }
    } else {
      for (let wheelIndex = 0; wheelIndex < wheelSpecs.length; wheelIndex++) {
        const [specX, specZ, specRadius] = wheelSpecs[wheelIndex];
        const steerGroup = new Group();
        steerGroup.position.set(specX, isFlat ? (arenaWorldCarLoaders.suspensionSpecs?.flatY?.[wheelIndex] ?? -6.2) : (specRadius - 17), specZ);
        const spinGroup = new Group();
        let wheelMesh;
        if (isRealistic) {
          wheelMesh = createOffroadWheelMesh(specRadius, 16, {
            tire: new MeshStandardMaterial({ color: 1447965, roughness: 0.96 }),
            rim: new MeshStandardMaterial({ color: 1909033, roughness: 0.3, metalness: 0.9 })
          });
        } else if (isFlat && arenaWorldCarLoaders.createFlatCarWheel && this.flatCarAsset) {
          wheelMesh = arenaWorldCarLoaders.createFlatCarWheel(this.flatCarAsset, wheelIndex, teamColor);
        } else if (arenaWorldCarLoaders.createGameCarWheel && this.gameCarAsset) {
          wheelMesh = arenaWorldCarLoaders.createGameCarWheel(this.gameCarAsset, wheelIndex, teamColor);
          if (arenaWorldCarLoaders.createGameCarWheelHardware) {
            steerGroup.add(arenaWorldCarLoaders.createGameCarWheelHardware(this.gameCarAsset, wheelIndex, teamColor));
          }
        } else {
          wheelMesh = new Group();
        }
        spinGroup.add(wheelMesh);
        steerGroup.add(spinGroup);
        carRoot.add(steerGroup);
        wheels.push({ steer: steerGroup, spin: spinGroup });
      }
    }

    this.carWheels.push(wheels);
    this.carWheelSpecs.push(wheelSpecs);
    this.wheelSpin.push([0, 0, 0, 0]);
    this.carSuspension.push([]);
    this.carJets.push(gimbals ? setupCarReactionJets(gimbals) : null);
    this.jumpPrev.push(false);
    this.jumpTimer.push(-1);
    this.flipPrev.push(false);
    this.dodgeBurst.push(0);
    this.dodgeRoll.push(0);
    this.dodgeYaw.push(0);
    this.dodgePitch.push(0);

    const BoostEmitterClass = arenaWorldThreeContext.VehicleBoostEmitter || VehicleBoostEmitter;
    const defaultOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
    this.carBoosts.push((boostOutlets || defaultOutlets).map((pos, p) => new BoostEmitterClass(this.scene, carRoot, pos, p === 0, isBot)));

    const demoEffect = new DemolitionEffect();
    this.carDemolitions.push(demoEffect);
    if (demoEffect.object) this.scene.add(demoEffect.object);

    this.cars.push(carRoot);
    this.vehiclePresets.push(visual);
    this.scene.add(carRoot);
    if (this.carColors && this.carColors[teamIndex] !== undefined && this.carColors[teamIndex] !== null) {
      this.setCarColor(teamIndex, this.carColors[teamIndex]);
    }
    this.markRenderTreeChanged();
  }

  /**
   * In-place Hot Swap: Update vehicle mesh, hitbox wireframe, wheel positions, and boost emitters
   * without destroying carRoot or disconnecting CameraManager references.
   * @param {number} carIndex
   * @param {string} newVisual
   * @returns {boolean}
   */
  swapCarVisual(carIndex, newVisual) {
    if (!this.cars || carIndex < 0 || carIndex >= this.cars.length) return false;
    const carRoot = this.cars[carIndex];
    if (!carRoot) return false;

    const { Group, Vector3 } = resolveContext();
    const isBot = carIndex === BOT_CAR_INDEX;
    const isHitbox = newVisual.startsWith("hitbox-");
    const isRealistic = newVisual === "realistic";
    const isFlat = newVisual === "flat-car";
    const teamIndex = carIndex % 2;
    const teamColor = arenaWorldCarLoaders.teamColors?.[teamIndex] ?? DEFAULT_TEAM_COLORS[teamIndex % 2];

    // 1. Remove and dispose old body mesh and hitbox wireframe
    const childrenToRemove = [];
    for (const child of carRoot.children) {
      if (
        child.name === "car-body-mesh" ||
        child.name === "car-hitbox-wireframe" ||
        child.name === "realistic-car" ||
        child.name?.startsWith("whitebox-")
      ) {
        childrenToRemove.push(child);
      }
    }
    for (const child of childrenToRemove) {
      carRoot.remove(child);
      child.traverse?.((node) => {
        if (node.geometry) node.geometry.dispose?.();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => m?.dispose?.());
        }
      });
    }

    // 2. Build new model and hitbox
    let newCarModel = null;
    let newHitboxBox = null;
    let boostOutlets = null;

    if (isHitbox) {
      const preset = HITBOX_PRESETS[newVisual] || HITBOX_PRESETS["hitbox-octane"];
      try {
        newCarModel = createWhiteboxCarModel(newVisual, teamColor);
      } catch (err) {
        newCarModel = new Group();
      }
      newHitboxBox = createCarHitboxWireframe(preset);
      boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
    } else if (isRealistic && arenaWorldCarLoaders.createRealisticCarModel) {
      const realisticGroup = new Group();
      realisticGroup.name = "realistic-car";
      const model = arenaWorldCarLoaders.createRealisticCarModel(teamColor);
      realisticGroup.add(model.group);
      const gimbals = arenaWorldCarLoaders.createRealisticCarGimbals ? arenaWorldCarLoaders.createRealisticCarGimbals() : null;
      if (this.realisticCarAsset && arenaWorldCarLoaders.assembleRealisticCar) {
        arenaWorldCarLoaders.assembleRealisticCar(this.realisticCarAsset, model, gimbals, teamColor);
      }
      newCarModel = realisticGroup;
      newHitboxBox = gimbals?.hitbox || createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
      boostOutlets = [model.boostOutlet || new Vector3(-57, 10.25, 0)];
    } else {
      if (isFlat && arenaWorldCarLoaders.createFlatCarModel && this.flatCarAsset) {
        newCarModel = arenaWorldCarLoaders.createFlatCarModel(this.flatCarAsset, teamColor);
        newHitboxBox = createCarHitboxWireframe(HITBOX_PRESETS["hitbox-dominus"] || OCTANE_HITBOX_PRESET);
        boostOutlets = FLAT_CAR_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
      } else if (arenaWorldCarLoaders.createGameCarModel && this.gameCarAsset) {
        const theme = arenaWorldCarLoaders.getCarVisualTheme ? arenaWorldCarLoaders.getCarVisualTheme(newVisual) : undefined;
        newCarModel = arenaWorldCarLoaders.createGameCarModel(this.gameCarAsset, teamColor, isBot ? theme : undefined);
        newHitboxBox = createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
        boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
      } else {
        try {
          newCarModel = createWhiteboxCarModel("hitbox-octane", teamColor);
        } catch (err) {
          newCarModel = new Group();
        }
        newHitboxBox = createCarHitboxWireframe(OCTANE_HITBOX_PRESET);
        boostOutlets = OCTANE_BOOST_OUTLETS.map(([x, y, z]) => new Vector3(x, y, z));
      }
    }

    newCarModel.name = "car-body-mesh";
    newHitboxBox.name = "car-hitbox-wireframe";
    newHitboxBox.visible = this.carHitboxesVisible;

    carRoot.add(newCarModel);
    carRoot.add(newHitboxBox);
    this.carHitboxes[carIndex] = newHitboxBox;

    // 3. Update wheel specs and positions
    let wheelSpecs = getWheelSpecsForVisual(newVisual);
    if (!isHitbox && !isFlat && !isRealistic && arenaWorldCarLoaders.wheelSpecs?.game) {
      wheelSpecs = arenaWorldCarLoaders.wheelSpecs.game;
    }
    this.carWheelSpecs[carIndex] = wheelSpecs;

    const wheels = this.carWheels[carIndex];
    if (wheels && wheelSpecs) {
      for (let wheelIndex = 0; wheelIndex < wheels.length && wheelIndex < wheelSpecs.length; wheelIndex++) {
        const [specX, specZ] = wheelSpecs[wheelIndex];
        wheels[wheelIndex].steer.position.set(
          specX,
          -6.0,
          specZ
        );
      }
    }

    // 4. Update boost emitters
    const emitterList = this.carBoosts[carIndex];
    if (emitterList && boostOutlets) {
      for (let p = 0; p < emitterList.length && p < boostOutlets.length; p++) {
        if (emitterList[p]?.offset) {
          emitterList[p].offset.copy(boostOutlets[p]);
        }
      }
    }

    this.vehiclePresets[carIndex] = newVisual;

    if (this.carColors && this.carColors[teamIndex] !== undefined && this.carColors[teamIndex] !== null) {
      this.setCarColor(carIndex, this.carColors[teamIndex]);
    }

    this.markRenderTreeChanged();
    return true;
  }

  /**
   * Remove a car and dispose all associated resources
   * @param {number} carIndex
   * @returns {boolean}
   */
  removeCar(carIndex) {
    if (!this.cars || carIndex < 0 || carIndex >= this.cars.length) return false;
    const carRoot = this.cars[carIndex];
    if (carRoot) {
      this.scene.remove(carRoot);
      carRoot.traverse(node => {
        if (node.geometry) node.geometry.dispose?.();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => m?.dispose?.());
        }
      });
    }

    if (this.carDemolitions && this.carDemolitions[carIndex]) {
      const demo = this.carDemolitions[carIndex];
      if (demo.object) this.scene.remove(demo.object);
      demo.dispose?.();
    }

    if (this.carBoosts && this.carBoosts[carIndex]) {
      this.carBoosts[carIndex].forEach(emitter => emitter.dispose?.());
    }

    this.cars[carIndex] = null;
    this.vehiclePresets[carIndex] = null;
    this.carHitboxes[carIndex] = null;
    this.carGimbals[carIndex] = null;
    this.carSuspension[carIndex] = null;
    this.carWheels[carIndex] = null;
    this.carWheelSpecs[carIndex] = null;
    this.carBoosts[carIndex] = null;
    this.carDemolitions[carIndex] = null;
    this.carJets[carIndex] = null;

    this.markRenderTreeChanged();
    return true;
  }

  setCarHitboxesVisible(visible) {
    this.carHitboxesVisible = visible;
    for (const hitboxMesh of this.carHitboxes) hitboxMesh.visible = visible;
  }

  prepareBallSpeedTrail(camera) {
    this.ballSpeedTrail?.prepare(camera);
  }

  addPads(padDefs) {
    updateTurfPadDecals(this.turf, padDefs);
    const { markMatrixDirty } = resolveContext();
    this.boostPadSystem.addPads(padDefs, this.padTemplates, this.scene, markMatrixDirty);
    this.pads = this.boostPadSystem.pads;
    this.markRenderTreeChanged();
  }

  /**
   * Performs per-frame 120Hz physics interpolation and visual component updates.
   */
  update(prevState, currState, alpha, delta = 0, throttle = 0, controls, opponentControls, activeVisuals = true) {
    let actualDelta = delta;
    let actualThrottle = throttle;
    let actualControls = controls;
    let actualOpponentControls = opponentControls;

    // Gracefully handle inverted delta/throttle parameter callers
    if (actualDelta > 0.1 && actualThrottle > 0 && actualThrottle < 0.05) {
      actualDelta = throttle;
      actualThrottle = delta;
    }

    const header = this._headerView.attach(currState);
    const currBall = this._currBallView.attach(currState);
    const prevBall = this._prevBallView.attach(prevState);
    this.applyPhys(this.ball, prevBall, currBall, alpha);
    unrealToThreeCoords(this.ballVelocity, currBall.velX, currBall.velY, currBall.velZ);
    this.ballSpeedTrail?.update(this.ball.position, this.ballVelocity, actualDelta);

    const ballPos = this.ball.position;
    this.indicatorRing.position.set(ballPos.x, 2, ballPos.z);
    this.indicatorHeightRing.position.set(ballPos.x, 2, ballPos.z);
    const height = Math.max(0, ballPos.y - this.ballRadius);
    const scale = 0.86 - 0.68 * Math.min(1, height / 1600);
    this.indicatorHeightRing.scale.set(scale, scale, 1);

    const { Vector3 } = resolveContext();
    const axisY = new Vector3(0, 1, 0);

    for (let carIndex = 0; carIndex < this.cars.length; carIndex++) {
      if (!this.cars[carIndex]) continue;
      if (carIndex >= header.numCars) {
        this.cars[carIndex].visible = false;
        this.carDemolitions[carIndex]?.update(actualDelta, false, this.cars[carIndex].position, false);
        continue;
      }
      const isLocalCar = carIndex === (this.playerCarIndex ?? 0);
      const carControls = carIndex === 0 ? actualControls : actualOpponentControls;
      const carThrottle = isLocalCar ? actualThrottle : (carControls?.throttle ?? 0);

      const currCar = this._currCarView.attachCar(currState, carIndex);
      const prevCar = this._prevCarView.attachCar(prevState, carIndex);

      const isRespawning = prevCar.isDemoed && !currCar.isDemoed;
      this.applyPhys(this.cars[carIndex], isRespawning ? currCar : prevCar, currCar, alpha);

      const isAlive = !currCar.isDemoed;
      this.carDemolitions[carIndex]?.update(actualDelta, !isAlive, this.cars[carIndex].position, activeVisuals);
      this.cars[carIndex].visible = isAlive;

      const gimbal = this.carGimbals[carIndex];
      if (gimbal && arenaWorldCarLoaders.updateRealisticCockpitGimbal) {
        arenaWorldCarLoaders.updateRealisticCockpitGimbal(
          this.cars[carIndex].quaternion,
          currCar.velX,
          currCar.velY,
          actualDelta,
          gimbal
        );
      }

      const forwardSpeed = currCar.forwardSpeed;

      const wheels = this.carWheels[carIndex];
      const wheelSpecs = this.carWheelSpecs[carIndex];
      const suspension = this.carSuspension[carIndex];
      const spin = this.wheelSpin[carIndex];

      updateCarSuspensionAndSteering(
        wheels,
        wheelSpecs,
        suspension,
        spin,
        currCar,
        this.vehiclePresets[carIndex],
        actualDelta,
        carThrottle,
        resolveContext
      );

      const jets = this.carJets[carIndex];
      if (jets) {
        const inAir = currCar.isOnGround ? 0 : 1;
        const roll = carControls?.roll ?? 0;
        const yaw = carControls?.yaw ?? 0;
        const pitch = carControls?.pitch ?? 0;
        const rollPos = inAir * Math.max(0, roll);
        const rollNeg = inAir * Math.max(0, -roll);
        const yawPos = inAir * Math.max(0, yaw);
        const yawNeg = inAir * Math.max(0, -yaw);
        const isFlipping = currCar.isFlipping;

        if (isFlipping && !this.flipPrev[carIndex]) {
          this.dodgeBurst[carIndex] = 0.22;
          this.dodgeRoll[carIndex] = roll;
          this.dodgeYaw[carIndex] = yaw;
          this.dodgePitch[carIndex] = pitch;
        }
        this.flipPrev[carIndex] = isFlipping;

        let burstFactor = 0;
        if (this.dodgeBurst[carIndex] > 0) {
          this.dodgeBurst[carIndex] -= actualDelta;
          burstFactor = 2 * Math.max(0, this.dodgeBurst[carIndex] / 0.22);
        }

        const bRollPos = burstFactor * Math.max(0, this.dodgeRoll[carIndex]);
        const bRollNeg = burstFactor * Math.max(0, -this.dodgeRoll[carIndex]);
        const bYawPos = burstFactor * Math.max(0, this.dodgeYaw[carIndex]);
        const bYawNeg = burstFactor * Math.max(0, -this.dodgeYaw[carIndex]);
        const bPitchPos = burstFactor * Math.max(0, this.dodgePitch[carIndex]);
        const bPitchNeg = burstFactor * Math.max(0, -this.dodgePitch[carIndex]);

        const rollNet = Math.max(rollNeg, bRollNeg) - Math.max(rollPos, bRollPos);
        this.setJet(jets.roll.fP, Math.max(0, rollNet));
        this.setJet(jets.roll.bP, Math.max(0, rollNet));
        this.setJet(jets.roll.fN, Math.max(0, -rollNet));
        this.setJet(jets.roll.bN, Math.max(0, -rollNet));

        const yawNet = Math.max(yawNeg, bYawNeg) - Math.max(yawPos, bYawPos);
        this.setJet(jets.yaw.fP, Math.max(0, -yawNet));
        this.setJet(jets.yaw.fN, Math.max(0, yawNet));
        this.setJet(jets.yaw.bP, Math.max(0, -yawNet));
        this.setJet(jets.yaw.bN, Math.max(0, yawNet));

        const pitchBackNet = Math.max(inAir * Math.max(0, pitch), bPitchPos) - Math.max(inAir * Math.max(0, -pitch), bPitchNeg);
        this.setJet(jets.pitchBack, Math.max(0, pitchBackNet));
        this.setJet(jets.pitchFront, Math.max(0, -pitchBackNet));

        const isJumping = carControls?.jump ?? false;
        const isAirInput = inAir === 1 && (roll !== 0 || yaw !== 0 || pitch !== 0);
        if (isJumping && !this.jumpPrev[carIndex] && !isAirInput) {
          this.jumpTimer[carIndex] = 0;
        }
        this.jumpPrev[carIndex] = isJumping;
        if (isFlipping) this.jumpTimer[carIndex] = -1;

        let jumpActive = 0;
        if (this.jumpTimer[carIndex] >= 0) {
          this.jumpTimer[carIndex] += actualDelta;
          const jumpElapsed = this.jumpTimer[carIndex];
          const upwardVel = currCar.velZ > 0 || jumpElapsed < 0.05;
          if (jumpElapsed <= 0.2 && upwardVel && (isJumping || jumpElapsed < 0.07)) {
            jumpActive = 1;
          } else {
            this.jumpTimer[carIndex] = -1;
          }
        }
        this.setJet(jets.jump, jumpActive, 2);
      }
    }

    if (this.opponentSun) {
      this.opponentSun.visible = header.numCars > 1;
      this.carSun.intensity = this.ballSun.intensity = this.opponentSun.visible ? 2 / 3 : 1;
      this.opponentSun.intensity = 2 / 3;
    }
    this.updateSubjectShadows();
    this.boostPadSystem?.update(currState);
    this.updateBoostVisuals(currState, actualThrottle, actualDelta, actualOpponentControls?.throttle ?? 0, activeVisuals, actualControls, actualOpponentControls);
  }

  setJet(jet, active, intensity = 1) {
    if (!jet) return;
    if (Array.isArray(jet)) {
      for (const j of jet) this.setJetFlame(j, active, intensity);
      return;
    }
    this.setJetFlame(jet, active, intensity);
  }

  setJetFlame(flame, active, intensity) {
    if (!flame) return;
    flame.visible = active;
    if (active) {
      const s = Math.min(2, intensity);
      flame.scale.set(1 + 0.4 * Math.min(s, 1), (6 + 13 * s), 1 + 0.4 * Math.min(s, 1));
    }
  }

  makeSubjectSun(targetGroup, frustumSize) {
    const { DirectionalLight } = resolveContext();
    const sun = new DirectionalLight(16777215, 1);
    sun.position.set(2500, 4000, 1500);
    sun.castShadow = true;
    sun.target = targetGroup;
    sun.shadow.camera.left = -frustumSize;
    sun.shadow.camera.right = frustumSize;
    sun.shadow.camera.top = frustumSize;
    sun.shadow.camera.bottom = -frustumSize;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 8500;
    return sun;
  }

  updateSubjectShadows() {
    if (this.cars[0]) {
      this.updateSubjectShadow(this.carSun, this.carSunTarget, this.cars[0].position, 260);
    }
    if (this.opponentSun && this.opponentSun.visible && this.cars[1]?.visible) {
      this.updateSubjectShadow(this.opponentSun, this.opponentSunTarget, this.cars[1].position, 260);
    }
    this.updateSubjectShadow(this.ballSun, this.ballSunTarget, this.ball.position, 190);
  }

  updateSubjectShadow(sun, targetGroup, worldPos, frustumSize = 260) {
    const { Vector3 } = resolveContext();
    const shadowDir = new Vector3(2500, 4000, 1500).normalize();
    const shadowX = new Vector3(0, 1, 0).cross(shadowDir).normalize();
    const shadowY = new Vector3().crossVectors(shadowDir, shadowX).normalize();

    // Texel-snapping grid step size for 1024x1024 shadow map (prevents shadow shimmering during movement)
    const texelSize = (frustumSize * 2) / 1024;
    const snappedX = Math.round(worldPos.dot(shadowX) / texelSize) * texelSize;
    const snappedY = Math.round(worldPos.dot(shadowY) / texelSize) * texelSize;
    const depthZ = worldPos.dot(shadowDir);
    this.shadowFocus.copy(shadowX).multiplyScalar(snappedX).addScaledVector(shadowY, snappedY).addScaledVector(shadowDir, depthZ);
    targetGroup.position.copy(this.shadowFocus);
    sun.position.copy(this.shadowFocus).add(new Vector3(2500, 4000, 1500));
    targetGroup.updateMatrixWorld?.();
  }

  updateBoostVisuals(currState, throttle, delta, opponentThrottle = 0, activeVisuals = true, controls = null, opponentControls = null) {
    const header = this._headerView.attach(currState);
    const localCarIdx = this.playerCarIndex ?? 0;
    for (let carIndex = 0; carIndex < this.cars.length; carIndex++) {
      if (!this.cars[carIndex]) continue;
      if (carIndex >= header.numCars) continue;
      const carView = this._currCarView.attachCar(currState, carIndex);
      const isLocalCar = carIndex === localCarIdx;
      const carCtrl = carIndex === 0 ? controls : opponentControls;
      const isBoosting = activeVisuals && (carView.isBoosting || Boolean(carCtrl?.boost && carView.boost > 0));
      const isAudibleActive = isLocalCar;
      const currentThrottle = isLocalCar ? throttle : opponentThrottle;
      for (const emitter of this.carBoosts[carIndex] ?? []) {
        emitter.setSpatial?.(!isAudibleActive);
        emitter.update?.(isBoosting, activeVisuals && currentThrottle > 0.01, this.cars[carIndex].visible, delta, activeVisuals);
      }
    }
  }

  applyPhys(targetMesh, prevViewOrState, currViewOrState, offsetOrAlpha, alphaParam) {
    if (typeof offsetOrAlpha === "number" && typeof alphaParam === "number") {
      const prevState = prevViewOrState;
      const currState = currViewOrState;
      const offset = offsetOrAlpha;
      const alpha = alphaParam;
      unrealToThreeCoords(this.pA, prevState[offset], prevState[offset + 1], prevState[offset + 2]);
      unrealToThreeCoords(this.pB, currState[offset], currState[offset + 1], currState[offset + 2]);
      targetMesh.position.lerpVectors(this.pA, this.pB, alpha);

      unpackBufferQuaternion(this.qA, prevState, offset + 3);
      unpackBufferQuaternion(this.qB, currState, offset + 3);
      targetMesh.quaternion.slerpQuaternions(this.qA, this.qB, alpha);
      return;
    }

    const prevView = prevViewOrState;
    const currView = currViewOrState;
    const alpha = offsetOrAlpha;
    unrealToThreeCoords(this.pA, prevView.posX, prevView.posY, prevView.posZ);
    unrealToThreeCoords(this.pB, currView.posX, currView.posY, currView.posZ);
    targetMesh.position.lerpVectors(this.pA, this.pB, alpha);

    viewBasisToQuaternion(this.qA, prevView);
    viewBasisToQuaternion(this.qB, currView);
    targetMesh.quaternion.slerpQuaternions(this.qA, this.qB, alpha);
  }

  dispose() {
    this.boostPadSystem?.dispose?.();
    this.ballSpeedTrail?.dispose?.();
    this.ballLocatorArrow?.dispose?.();

    if (this.turf?.geometry?.dispose) this.turf.geometry.dispose();
    if (this.turf?.material?.dispose) this.turf.material.dispose();
    if (this.sky?.geometry?.dispose) this.sky.geometry.dispose();
    if (this.sky?.material?.dispose) this.sky.material.dispose();
    if (this.indicatorRing?.geometry?.dispose) this.indicatorRing.geometry.dispose();
    if (this.indicatorRing?.material?.dispose) this.indicatorRing.material.dispose();
    if (this.indicatorHeightRing?.geometry?.dispose) this.indicatorHeightRing.geometry.dispose();
    if (this.indicatorHeightRing?.material?.dispose) this.indicatorHeightRing.material.dispose();

    if (Array.isArray(this.carBoosts)) {
      for (const carList of this.carBoosts) {
        if (Array.isArray(carList)) {
          for (const emitter of carList) {
            emitter?.dispose?.();
          }
        }
      }
    }

    if (Array.isArray(this.cars)) {
      for (const car of this.cars) {
        if (car) {
          car.traverse?.(obj => {
            if (obj.geometry?.dispose) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(material => material?.dispose?.());
              } else {
                obj.material.dispose?.();
              }
            }
          });
        }
      }
    }

    if (this.ball) {
      this.ball.traverse?.(obj => {
        if (obj.geometry?.dispose) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => material?.dispose?.());
          } else {
            obj.material.dispose?.();
          }
        }
      });
    }

    if (this.stadium) {
      this.stadium.traverse?.(obj => {
        if (obj.geometry?.dispose) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => material?.dispose?.());
          } else {
            obj.material.dispose?.();
          }
        }
      });
    }

    if (this.scene) {
      while (this.scene.children?.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
    }
  }
}

export {
  loadStadiumContinuousBoundary,
  loadStadiumArchitecture
};

export {
  DEFAULT_WHEEL_SPECS,
  setVehicleSuspensionThreeContext,
  createOffroadWheelMesh,
  createSuspensionUnit,
  createSuspensionKnuckle,
  updateSuspensionArm,
  updateSuspensionUnitSpring,
  createReactionControlJet,
  setupCarReactionJets,
  updateCarSuspensionAndSteering
};
