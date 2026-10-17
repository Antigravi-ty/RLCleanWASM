import {
  DEFAULT_TEAM_COLORS,
  DEFAULT_PLAYER_TEAM_INDEX,
  REALISTIC_WHEEL_COORDS,
  REALISTIC_SUSPENSION_Z,
  REALISTIC_TIRE_WIDTH,
  OCTANE_WHEEL_COORDS,
  FLAT_CAR_WHEEL_COORDS,
  FLAT_CAR_SUSPENSION_HEIGHTS
} from './vehicleDescriptors.js';
import * as THREE from 'three';
import { applyArcadeCelShading } from '../../effects/ThemeMaterialPipeline.js';
import {
  loadGameCarAsset,
  createGameCarModel,
  createGameCarWheel,
  createGameCarWheelHardware
} from './gameCarModel.js';
import {
  loadFlatCarAsset,
  createFlatCarModel,
  createFlatCarWheel
} from './flatCarModel.js';
import { createRealisticCarGimbals } from './realisticCockpitGimbal.js';
import { createRealisticCarModel } from './realisticBuggyFrame.js';
import {
  loadRealisticCarAsset,
  assembleRealisticCar,
  alignCylinderBetweenPoints,
  updateSuspensionUnitSpring
} from './realisticCarAssembly.js';
import {
  createOffroadWheelMesh,
  createSuspensionUnit,
  createSuspensionKnuckle,
  setupCarReactionJets
} from '../VehicleSuspensionSystem.js';

/**
 * Full static showcase loader for realistic buggy vehicle (used by Garage Turntable).
 */
export async function loadRealisticCarShowcase(teamColor = DEFAULT_TEAM_COLORS[DEFAULT_PLAYER_TEAM_INDEX]) {
  const { Group, Mesh, CylinderGeometry, MeshStandardMaterial, Vector3 } = THREE;
  const setShadowFlags = applyArcadeCelShading;

  const detailsAsset = await loadRealisticCarAsset();
  const root = new Group();
  const frame = createRealisticCarModel(teamColor, {});
  root.add(frame.group);

  const gimbals = createRealisticCarGimbals();
  assembleRealisticCar(detailsAsset, frame, gimbals, teamColor);
  root.add(gimbals.root);

  const wheelMats = {
    tire: new MeshStandardMaterial({ color: 1447965, roughness: 0.96 }),
    lug: new MeshStandardMaterial({ color: 987412, roughness: 0.98 }),
    rim: new MeshStandardMaterial({ color: 1909033, roughness: 0.3, metalness: 0.9 }),
    accent: new MeshStandardMaterial({ color: teamColor, roughness: 0.3, metalness: 0.7 })
  };
  const matSpring = new MeshStandardMaterial({ color: teamColor, roughness: 0.28, metalness: 0.7 });
  const matShaft = new MeshStandardMaterial({ color: 15133423, roughness: 0.1, metalness: 1 });
  const matBody = new MeshStandardMaterial({ color: 1711652, roughness: 0.3, metalness: 0.9 });
  const matArm = new MeshStandardMaterial({ color: 2830134, roughness: 0.45, metalness: 0.8 });

  for (let i = 0; i < REALISTIC_WHEEL_COORDS.length; i++) {
    const [wx, wy, wz] = REALISTIC_WHEEL_COORDS[i];
    const dropY = wz - REALISTIC_SUSPENSION_Z;
    const wheelAnchor = new Group();
    wheelAnchor.position.set(wx, dropY, wy);

    const wheelRotGroup = new Group();
    const wheelMesh = createOffroadWheelMesh(wz, REALISTIC_TIRE_WIDTH, wheelMats);
    wheelMesh.rotation.x = Math.PI / 2;
    wheelRotGroup.add(wheelMesh);
    wheelAnchor.add(wheelRotGroup, createSuspensionKnuckle(frame.suspension[i].innerZ - wy));
    root.add(wheelAnchor);

    const { top, innerZ, foreRoot, aftRoot } = frame.suspension[i];
    const spanDist = Math.hypot(dropY - top.y, innerZ - top.z);
    const susUnit = createSuspensionUnit(spanDist, matSpring, matShaft, matBody);
    susUnit.group.position.copy(top);
    root.add(susUnit.group);
    updateSuspensionUnitSpring({ ...susUnit, top, botZ: innerZ }, dropY);

    const knucklePt = new Vector3(wx, dropY, innerZ);
    for (const rootPt of [foreRoot, aftRoot]) {
      const armMesh = new Mesh(new CylinderGeometry(1.5, 1.5, 1, 10), matArm);
      alignCylinderBetweenPoints(armMesh, rootPt, knucklePt);
      root.add(armMesh);
    }
  }

  if (typeof setShadowFlags === "function") setShadowFlags(root);
  setupCarReactionJets(frame);
  return root;
}

/**
 * Full static showcase loader for Octane vehicle (used by Garage Turntable).
 */
export async function loadGameCarShowcase(teamColor = DEFAULT_TEAM_COLORS[DEFAULT_PLAYER_TEAM_INDEX]) {
  const { Group } = THREE;
  const root = new Group();
  const asset = await loadGameCarAsset();
  root.add(createGameCarModel(asset, teamColor, undefined));

  OCTANE_WHEEL_COORDS.forEach(([wx, wz, wy], idx) => {
    const dropY = wy - REALISTIC_SUSPENSION_Z;
    const anchor = new Group();
    anchor.position.set(wx, dropY, wz);
    const rotGroup = new Group();
    rotGroup.add(createGameCarWheel(asset, idx));
    anchor.add(createGameCarWheelHardware(asset, idx), rotGroup);
    root.add(anchor);
  });

  return root;
}

/**
 * Full static showcase loader for Dominus flat car (used by Garage Turntable).
 */
export async function loadFlatCarShowcase(teamColor = DEFAULT_TEAM_COLORS[DEFAULT_PLAYER_TEAM_INDEX]) {
  const { Group } = THREE;
  const root = new Group();
  const asset = await loadFlatCarAsset();
  root.add(createFlatCarModel(asset, teamColor));

  FLAT_CAR_WHEEL_COORDS.forEach(([wx, wz], idx) => {
    const wheelGroup = createFlatCarWheel(asset, idx, teamColor);
    wheelGroup.position.set(wx, FLAT_CAR_SUSPENSION_HEIGHTS[idx], wz);
    root.add(wheelGroup);
  });

  return root;
}


