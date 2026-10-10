import * as THREE from 'three';
/**
 * src/entities/VehicleSuspensionSystem.js
 * High-performance Vehicle Suspension, Steering & Reaction Control Thruster Subsystem.
 * Modernized extraction from ArenaWorld.js and VehicleAssembly.js (Phase 10.2).
 */

let suspensionThreeContext = null;

/**
 * Injects custom Three.js context into the suspension subsystem.
 * @param {object} context
 */
export function setVehicleSuspensionThreeContext(context) {
  suspensionThreeContext = context;
}

/**
 * Resolves active Three.js context.
 * @returns {object}
 */
export function resolveContext() {
  return THREE;
}

/**
 * Standard wheel physical placement specifications [x, z, radius] for each vehicle type.
 */
/**
 * Resolves vertical chassis connection height (Unreal Units) for the vehicle preset.
 * Values precisely match RocketSim CarConfig.cpp connectionPointOffset.z
 * @param {string} vehiclePreset
 * @returns {number}
 */
export function getCarRestHeight(vehiclePreset) {
  switch (vehiclePreset) {
    case "hitbox-octane":
    case "game-car":
      return 20.755;
    case "hitbox-dominus":
    case "flat-car":
      return 15.75;
    case "hitbox-plank":
      return 12.0942;
    case "hitbox-breakout":
      return 11.75;
    case "hitbox-hybrid":
      return 20.755;
    case "hitbox-merc":
      return 21.505;
    default:
      return 20.755;
  }
}

/**
 * Standard wheel physical placement specifications [x, z, radius] for each vehicle preset.
 * Values precisely match RocketSim CarConfig.cpp FRONT_WHEELS_OFFSET / BACK_WHEELS_OFFSET.
 * @param {string} vehiclePreset
 * @returns {Array<[number, number, number]>}
 */
export function getWheelSpecsForVisual(vehiclePreset) {
  switch (vehiclePreset) {
    case "hitbox-octane":
    case "game-car":
      return [
        [51.25, 25.90, 12.5],
        [51.25, -25.90, 12.5],
        [-33.75, 29.50, 15.0],
        [-33.75, -29.50, 15.0]
      ];
    case "hitbox-dominus":
    case "flat-car":
      return [
        [50.30, 31.10, 12.0],
        [50.30, -31.10, 12.0],
        [-34.75, 33.00, 13.5],
        [-34.75, -33.00, 13.5]
      ];
    case "hitbox-plank":
      return [
        [49.97, 27.80, 12.5],
        [49.97, -27.80, 12.5],
        [-35.43, 20.28, 17.0],
        [-35.43, -20.28, 17.0]
      ];
    case "hitbox-breakout":
      return [
        [51.50, 26.67, 13.5],
        [51.50, -26.67, 13.5],
        [-35.75, 35.00, 15.0],
        [-35.75, -35.00, 15.0]
      ];
    case "hitbox-hybrid":
      return [
        [51.25, 25.90, 12.5],
        [51.25, -25.90, 12.5],
        [-34.00, 29.50, 15.0],
        [-34.00, -29.50, 15.0]
      ];
    case "hitbox-merc":
      return [
        [51.25, 25.90, 15.0],
        [51.25, -25.90, 15.0],
        [-33.75, 29.50, 15.0],
        [-33.75, -29.50, 15.0]
      ];
    case "realistic":
      return DEFAULT_WHEEL_SPECS.realistic;
    default:
      return DEFAULT_WHEEL_SPECS.game;
  }
}

export const DEFAULT_WHEEL_SPECS = Object.freeze({
  game: [
    [45.5, 30.5, 13.5],
    [45.5, -30.5, 13.5],
    [-35.5, 30.5, 13.5],
    [-35.5, -30.5, 13.5]
  ],
  flat: [
    [50.3, 31.1, 12],
    [50.3, -31.1, 12],
    [-34.75, 33, 13.5],
    [-34.75, -33, 13.5]
  ],
  realistic: [
    [63.88, 34, 13],
    [63.88, -34, 13],
    [-36.12, 34, 16],
    [-36.12, -34, 16]
  ]
});

/**
 * Creates vehicle offroad wheel procedural mesh with rims and tire tread.
 */
export function createOffroadWheelMesh(radius, width, mats, resolveContextFn = resolveContext) {
  const { Group, LatheGeometry, CylinderGeometry, Vector2, Mesh } = resolveContextFn();
  const wheelGroup = new Group();
  wheelGroup.name = "offroad-wheel";

  const halfWidth = width / 2;
  const innerRadius = radius * 0.58;
  const profile = [
    new Vector2(innerRadius, -halfWidth),
    new Vector2(radius * 0.94, -halfWidth),
    new Vector2(radius, -halfWidth * 0.55),
    new Vector2(radius, halfWidth * 0.55),
    new Vector2(radius * 0.94, halfWidth),
    new Vector2(innerRadius, halfWidth)
  ];

  const tireMesh = new Mesh(new LatheGeometry(profile, 36), mats.tire);
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  const rimMesh = new Mesh(new CylinderGeometry(innerRadius * 0.92, innerRadius * 0.92, width * 0.48, 32), mats.rim);
  rimMesh.castShadow = true;
  wheelGroup.add(rimMesh);

  return wheelGroup;
}

/**
 * Creates vehicle suspension unit (spring coil, shock shaft, and damper body).
 */
export function createSuspensionUnit(length, matSpring, matShaft, matBody, resolveContextFn = resolveContext) {
  const { Group, CylinderGeometry, Mesh } = resolveContextFn();
  const group = new Group();
  const spring = new Mesh(new CylinderGeometry(2.5, 2.5, length, 12), matSpring);
  const shaft = new Mesh(new CylinderGeometry(0.8, 0.8, 1, 10), matShaft);
  const bodyLen = length * 0.5;
  const body = new Mesh(new CylinderGeometry(1.7, 1.7, bodyLen, 14), matBody);

  spring.castShadow = true;
  shaft.castShadow = true;
  body.castShadow = true;
  group.add(spring, shaft, body);

  return { group, spring, shaft, body, built: length, bodyLen, top: group.position };
}

/**
 * Creates suspension knuckle hub.
 */
export function createSuspensionKnuckle(innerZ, mat, resolveContextFn = resolveContext) {
  const { Group, CylinderGeometry, SphereGeometry, Mesh } = resolveContextFn();
  const group = new Group();
  group.name = "suspension-knuckle";
  const shaft = new Mesh(new CylinderGeometry(1.3, 1.3, Math.abs(innerZ), 12), mat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = innerZ / 2;
  const knuckle = new Mesh(new SphereGeometry(1.8, 12, 8), mat);
  knuckle.position.z = innerZ;
  shaft.castShadow = true;
  knuckle.castShadow = true;
  group.add(shaft, knuckle);
  return group;
}

/**
 * Updates a suspension wishbone arm mesh orientation between its chassis root and the wheel knuckle hub.
 */
export function updateSuspensionArm(armMesh, rootPosOrMesh, knucklePos, resolveContextFn = resolveContext) {
  if (!armMesh || !rootPosOrMesh || !knucklePos) return;
  const { Vector3 } = resolveContextFn();
  const rootPos = rootPosOrMesh.position || rootPosOrMesh;
  const mid = new Vector3().copy(rootPos).add(knucklePos).multiplyScalar(0.5);
  armMesh.position.copy(mid);
  const dir = new Vector3().copy(knucklePos).sub(rootPos);
  const len = dir.length();
  dir.divideScalar(len || 1);
  armMesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
  armMesh.scale.set(1, len, 1);
}

/**
 * Updates suspension coil spring scale and damper rod height.
 */
export function updateSuspensionUnitSpring(susUnit, knucklePos, resolveContextFn = resolveContext) {
  if (!susUnit || !susUnit.group || !knucklePos) return;
  const { Vector3 } = resolveContextFn();

  // Support both 3D knuckle vector or scalar Y coordinate
  const top = susUnit.top || susUnit.group.position;
  const isScalarY = typeof knucklePos === 'number';
  const knuckleY = isScalarY ? knucklePos : knucklePos.y;
  const knuckleX = isScalarY ? (susUnit.group.position.x || 0) : knucklePos.x;
  const knuckleZ = isScalarY ? (susUnit.botZ !== undefined ? susUnit.botZ : top.z) : knucklePos.z;

  const dir = new Vector3(knuckleX - top.x, knuckleY - top.y, knuckleZ - top.z);
  const len = dir.length();
  dir.divideScalar(len || 1);
  susUnit.group.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), dir);
  if (susUnit.spring) susUnit.spring.scale.y = len / susUnit.built;
  const shaftLen = Math.max(1, len - susUnit.bodyLen * 0.5);
  if (susUnit.shaft) {
    susUnit.shaft.scale.y = shaftLen;
    susUnit.shaft.position.y = -shaftLen / 2;
  }
  if (susUnit.body) {
    susUnit.body.position.y = -(len - susUnit.bodyLen / 2);
  }
}

/**
 * Creates reaction control thruster jet nozzle and animated flame cone.
 */
export function createReactionControlJet(pos, dirX, dirY, dirZ, resolveContextFn = resolveContext) {
  const { Group } = resolveContextFn();
  const jetGroup = new Group();
  if (Array.isArray(pos)) {
    jetGroup.position.set(pos[0], pos[1], pos[2]);
  } else if (pos && typeof pos.copy === 'function') {
    jetGroup.position.copy(pos);
  }
  const flameGroup = new Group();
  flameGroup.position.y = 3.3;
  flameGroup.scale.set(0, 0, 0);
  jetGroup.add(flameGroup);
  return { group: jetGroup, flame: flameGroup };
}

/**
 * Connects vehicle reaction jets to vehicle gimbal state.
 */
export function setupCarReactionJets(vehicleGimbals, resolveContextFn = resolveContext) {
  if (!vehicleGimbals || !vehicleGimbals.jets) return null;
  const jets = vehicleGimbals.jets;
  const makeJet = (pos, dx, dy, dz) => {
    const jet = createReactionControlJet(pos, dx, dy, dz, resolveContextFn);
    vehicleGimbals.group?.add(jet.group);
    return jet.flame;
  };
  const makeAxisJets = (axis) => ({
    fP: makeJet(axis.fP, 0, 0, 1),
    fN: makeJet(axis.fN, 0, 0, -1),
    bP: makeJet(axis.bP, 0, 0, 1),
    bN: makeJet(axis.bN, 0, 0, -1)
  });
  return {
    roll: makeAxisJets(jets.roll),
    yaw: makeAxisJets(jets.yaw),
    pitchFront: (jets.pitchFront || []).map(jetPos => makeJet(jetPos, 0, 1, 0)),
    pitchBack: (jets.pitchBack || []).map(jetPos => makeJet(jetPos, 0, 1, 0)),
    jump: makeJet(jets.jump, 0, -1, 0)
  };
}

/**
 * Solves and animates the 4-wheel suspension, steering angle, and tire rotation for a vehicle.
 */
export function updateCarSuspensionAndSteering(
  wheels,
  wheelSpecs,
  suspension,
  spin,
  currCar,
  vehiclePreset,
  actualDelta,
  carThrottle,
  resolveContextFn = resolveContext
) {
  if (!wheels || !wheelSpecs || !spin || !currCar) return;
  const { Vector3 } = resolveContextFn();
  const axisY = new Vector3(0, 1, 0);
  const forwardSpeed = currCar.forwardSpeed !== undefined ? currCar.forwardSpeed : 0;
  const restHeight = getCarRestHeight(vehiclePreset);

  for (let wheelIndex = 0; wheelIndex < 4; wheelIndex++) {
    if (!wheelSpecs[wheelIndex] || !wheels[wheelIndex]) continue;
    let susLength = currCar.getWheelSusLength(wheelIndex);
    const steerAngle = currCar.getWheelSteerAngle(wheelIndex);
    const hasContact = currCar.getWheelContact(wheelIndex);
    const [specX, specZ, wheelRadius] = wheelSpecs[wheelIndex];

    // Scale guard: if susLength is in Bullet units (meters, < 2.0), scale to UU (50.0)
    if (susLength > 0 && susLength < 2.0) {
      susLength *= 50.0;
    }

    // Default resting height places wheels resting on the ground (-6.0 UU under chassis origin)
    const effectiveSusLength = susLength > 0 ? susLength : (restHeight + 6.0);
    const mountY = restHeight - effectiveSusLength;

    if (wheels[wheelIndex].steer) {
      wheels[wheelIndex].steer.position.set(specX, mountY, specZ);
      wheels[wheelIndex].steer.rotation.y = -steerAngle;
    }

    const sus = suspension?.[wheelIndex];
    if (sus) {
      const knucklePos = new Vector3(0, 0, sus.innerZ - specZ)
        .applyAxisAngle(axisY, -steerAngle)
        .add(new Vector3(specX, mountY, specZ));

      updateSuspensionUnitSpring(sus, knucklePos, resolveContextFn);
      if (sus.armFore && sus.foreRoot) updateSuspensionArm(sus.armFore, sus.foreRoot, knucklePos, resolveContextFn);
      if (sus.armAft && sus.aftRoot) updateSuspensionArm(sus.armAft, sus.aftRoot, knucklePos, resolveContextFn);
    }

    const spinDelta = hasContact
      ? (forwardSpeed / wheelRadius)
      : (carThrottle * 1410 / wheelRadius);

    spin[wheelIndex] += spinDelta * actualDelta;
    if (wheels[wheelIndex].spin) {
      wheels[wheelIndex].spin.rotation.z = -spin[wheelIndex];
    }
  }
}
