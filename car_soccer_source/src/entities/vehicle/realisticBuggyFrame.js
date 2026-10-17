import {
  REALISTIC_DIMENSIONS,
  REALISTIC_WHEEL_COORDS,
  REALISTIC_TIRE_WIDTH
} from './vehicleDescriptors.js';
import * as THREE from 'three';
import { lerpPolyline, createRearJetCluster } from './realisticBuggyParts.js';

export { lerpPolyline, createRearJetCluster } from './realisticBuggyParts.js';

/**
 * Procedural tubular space-frame buggy chassis generator.
 */
export function createRealisticCarModel(teamColor, options = {}) {
  const {
    Group,
    Mesh,
    CylinderGeometry,
    SphereGeometry,
    BoxGeometry,
    TorusGeometry,
    BufferGeometry,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    Vector3,
    DoubleSide,
    MathUtils
  } = THREE;
  const setShadowFlags = applyArcadeCelShading;

  const dim = REALISTIC_DIMENSIONS;
  const cfg = {
    length: dim.length,
    width: dim.width,
    height: dim.height,
    centerForward: dim.centerForward,
    centerUp: dim.centerUp,
    gimbalCenter: new Vector3(dim.gimbalCenterX, dim.gimbalCenterY, 0),
    wheels: REALISTIC_WHEEL_COORDS,
    tireWidth: REALISTIC_TIRE_WIDTH,
    roofWidth: 0.82,
    roofLength: 0.43,
    ...options
  };

  const { length: L, width: W, height: H, centerForward: fwd, centerUp: up } = cfg;
  const gimbalCenterX = cfg.gimbalCenter.x;
  const centerElevationY = up - H / 2;
  const topElevationY = up + H / 2;
  const tubeRadius = Math.min(W, H) * 0.029;

  const chassisRoot = new Group();
  chassisRoot.name = "procedural-buggy-frame";

  const matTube = new MeshStandardMaterial({ color: 7634824, roughness: 0.36, metalness: 0.82 });
  const matTeam = new MeshPhysicalMaterial({ color: teamColor, roughness: 0.31, metalness: 0.55, clearcoat: 0.7 });
  const matGusset = new MeshStandardMaterial({ color: 1121060, roughness: 0.46, metalness: 0.5, side: DoubleSide ?? 2 });
  const matFastener = new MeshStandardMaterial({ color: 11648453, roughness: 0.28, metalness: 0.9 });
  const matLine = new MeshStandardMaterial({ color: 9789486, roughness: 0.4, metalness: 0.7 });
  const matLight = new MeshStandardMaterial({ color: 13625075, emissive: 14282239, emissiveIntensity: 2.3, roughness: 0.22 });

  const upAxis = new Vector3(0, 1, 0);

  const addTube = (p1, p2, mat = matTube, radius = tubeRadius, name = "chassis-tube") => {
    const delta = p2.clone().sub(p1);
    const len = delta.length();
    if (len < 1e-5) return;
    const mesh = new Mesh(new CylinderGeometry(radius, radius, len, 12), mat);
    mesh.name = name;
    mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(upAxis, delta.normalize());
    mesh.castShadow = true;
    chassisRoot.add(mesh);
    mesh.userData.endpoints = [p1.toArray?.() || [p1.x, p1.y, p1.z], p2.toArray?.() || [p2.x, p2.y, p2.z]];
  };

  const addGusset = (name, pts, mat) => {
    const geom = new BufferGeometry().setFromPoints?.(pts) || new BufferGeometry();
    const indices = [];
    for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1);
    geom.setIndex?.(indices);
    geom.computeVertexNormals?.();
    const mesh = new Mesh(geom, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chassisRoot.add(mesh);
  };

  const addFastener = (pos, dir) => {
    const mesh = new Mesh(new CylinderGeometry(tubeRadius * 0.32, tubeRadius * 0.32, tubeRadius * 0.4, 6), matFastener);
    mesh.name = "chassis-fastener";
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(upAxis, dir);
    chassisRoot.add(mesh);
  };

  const noseX = fwd + L * 0.5;
  const tailX = fwd - L * 0.608;
  const frontX = gimbalCenterX + L * 0.27;
  const rearX = gimbalCenterX - L * 0.3;
  const bayRearX = gimbalCenterX - L * 0.27;
  const bayFrontX = bayRearX + L * cfg.roofLength;
  const sideW = Math.max(W * 0.274, 22 + tubeRadius * 1.4);
  const roofW = W * 0.5 * cfg.roofWidth;
  const canopyW = roofW * 0.94;

  const maxWheelX = Math.max(...cfg.wheels.map(w => w[0]));
  const minWheelX = Math.min(...cfg.wheels.map(w => w[0]));
  const getWheelInnerZ = (wx) => Math.min(...cfg.wheels.filter(w => Math.abs(w[0] - wx) < 0.001).map(w => Math.abs(w[1]))) - cfg.tireWidth * 0.99;

  const roofY = topElevationY - H * 0.025;
  const beltY = centerElevationY + H * 0.5;
  const noseW = W * 0.16;

  const getTopY = (x) => MathUtils.lerp(roofY, beltY, (x - bayFrontX) / (noseX - bayFrontX));
  const getTopZ = (x) => MathUtils.lerp(canopyW, noseW, (x - bayFrontX) / (noseX - bayFrontX));
  const getAftProfile = (sign, x) => new Vector3(tailX, centerElevationY + H * 0.54, sign * W * 0.29).lerp(new Vector3(bayRearX, topElevationY, sign * roofW), (x - tailX) / (bayRearX - tailX));

  const railMap = new Map();
  const addLongeronChain = (pts, name, mat = matTeam, radius = tubeRadius) => {
    for (let i = 1; i < pts.length; i++) addTube(pts[i - 1], pts[i], mat, radius, name);
    for (const pt of pts.slice(1, -1)) {
      const bend = new Mesh(new SphereGeometry(radius, 12, 8), mat);
      bend.position.copy(pt);
      bend.name = `${name}-bend`;
      bend.castShadow = true;
      chassisRoot.add(bend);
    }
  };

  for (const side of [-1, 1]) {
    const bottomLongeron = [
      new Vector3(tailX, centerElevationY + H * 0.06, side * W * 0.18),
      new Vector3(minWheelX, centerElevationY, side * getWheelInnerZ(minWheelX)),
      new Vector3(rearX, centerElevationY, side * sideW),
      new Vector3(frontX, centerElevationY, side * sideW),
      new Vector3(maxWheelX, centerElevationY, side * getWheelInnerZ(maxWheelX)),
      new Vector3(noseX, centerElevationY + H * 0.12, side * noseW)
    ];
    const topLongeron = [
      getAftProfile(side, tailX),
      getAftProfile(side, minWheelX),
      new Vector3(bayRearX, topElevationY, side * roofW),
      new Vector3(bayFrontX, roofY, side * canopyW),
      new Vector3(frontX, getTopY(frontX), side * getTopZ(frontX)),
      new Vector3(maxWheelX, getTopY(maxWheelX), side * getTopZ(maxWheelX)),
      new Vector3(noseX, beltY, side * noseW)
    ];

    railMap.set(side, { bottom: bottomLongeron, top: topLongeron });
    addLongeronChain(bottomLongeron, "lower-longeron");
    addLongeronChain(topLongeron, "swept-upper-longeron");

    const midPillarPt = new Vector3(rearX, centerElevationY + H * 0.7, side * sideW);
    addLongeronChain([bottomLongeron[2], midPillarPt, topLongeron[2]], "rear-cage-pillar", matTube, tubeRadius * 0.92);
    addTube(bottomLongeron[3], topLongeron[4], matTube, tubeRadius * 0.92, "front-cage-pillar");
    addTube(bottomLongeron[0], topLongeron[0], matTube, tubeRadius * 0.92, "tail-upright");
    addTube(bottomLongeron[5], topLongeron[6], matTube, tubeRadius * 0.92, "nose-upright");
    addTube(bottomLongeron[2], topLongeron[4], matTube, tubeRadius * 0.72, "door-diagonal");
    addTube(bottomLongeron[0], midPillarPt, matTube, tubeRadius * 0.75, "rear-bay-diagonal");
    addTube(bottomLongeron[3], topLongeron[6], matTube, tubeRadius * 0.75, "front-bay-diagonal");

    const pressureLine = bottomLongeron.map(point => point.clone().add(new Vector3(0, tubeRadius * 1.5, -side * tubeRadius * 0.65)));
    for (let i = 1; i < pressureLine.length; i++) {
      addTube(pressureLine[i - 1], pressureLine[i], matLine, tubeRadius * 0.19, "frame-pressure-line");
    }
  }

  const leftRails = railMap.get(-1);
  const rightRails = railMap.get(1);
  const evalBottomRail = (side, targetX) => lerpPolyline(railMap.get(Math.sign(side)).bottom, targetX);
  const evalTopRail = (side, targetX) => lerpPolyline(railMap.get(Math.sign(side)).top, targetX);

  for (let i = 0; i < leftRails.bottom.length; i++) {
    addTube(leftRails.bottom[i], rightRails.bottom[i]);
  }
  for (const idx of [0, 1, 2, 3, 5, 6]) {
    addTube(
      leftRails.top[idx],
      rightRails.top[idx],
      (idx === 2 || idx === 3) ? matTeam : matTube,
      tubeRadius,
      (idx === 1 || idx === 5) ? "shock-tower-crossmember" : "cage-crossmember"
    );
  }

  const suspensionData = cfg.wheels.map(([wx, wz]) => {
    const sign = Math.sign(wz);
    const topPt = evalTopRail(sign, wx);
    const topCoord = new Vector3(wx, topPt.y, sign * Math.min(getWheelInnerZ(wx), Math.abs(topPt.z) - tubeRadius * 1.2));
    const offset = Math.min(L * 0.075, (maxWheelX - minWheelX) * 0.11);
    const foreRoot = evalBottomRail(sign, wx + offset);
    const aftRoot = evalBottomRail(sign, wx - offset);

    addTube(foreRoot, topCoord, matTube, tubeRadius * 0.9, "shock-tower-forward-leg");
    addTube(aftRoot, topCoord, matTube, tubeRadius * 0.9, "shock-tower-rear-leg");
    addGusset("shock-tower-gusset", [
      topCoord.clone().add(new Vector3(0, -tubeRadius, 0)),
      topCoord.clone().lerp(foreRoot, 0.2),
      topCoord.clone().lerp(aftRoot, 0.2)
    ], matGusset);

    const eyeMesh = new Mesh(new TorusGeometry(tubeRadius * 1.2, tubeRadius * 0.38, 8, 20), matFastener);
    eyeMesh.name = "shock-mount-eye";
    eyeMesh.position.copy(topCoord);
    chassisRoot.add(eyeMesh);
    addFastener(topCoord, new Vector3(0, 0, sign));

    return {
      top: topCoord,
      foreRoot,
      aftRoot,
      innerZ: sign * (Math.abs(wz) - cfg.tireWidth * 0.8)
    };
  });

  for (const side of [-1, 1]) {
    const nosePt = evalTopRail(side, noseX);
    const pod = new Mesh(new BoxGeometry(L * 0.024, H * 0.12, W * 0.052), matGusset);
    pod.position.copy(nosePt).add(new Vector3(-tubeRadius, -tubeRadius, -side * tubeRadius));
    pod.name = "nose-light-pod";
    chassisRoot.add(pod);

    for (const py of [-0.9, 0.9]) {
      for (const pz of [-1, 1]) {
        const emitter = new Mesh(new BoxGeometry(0.7, 1.35, 1.4), matLight);
        emitter.position.copy(pod.position).add(new Vector3(L * 0.013, py, pz));
        chassisRoot.add(emitter);
      }
    }
  }

  const powertrainPos = new Vector3(tailX + L * 0.145, centerElevationY + H * 0.35, 0);
  const boostOutletPos = new Vector3(tailX - 11, powertrainPos.y, 0);
  createRearJetCluster(chassisRoot, tailX, teamColor, powertrainPos.y);

  return {
    group: chassisRoot,
    railBottom: evalBottomRail,
    railTop: evalTopRail,
    suspension: suspensionData,
    powertrainMount: powertrainPos,
    boostOutlet: boostOutletPos,
    stations: {
      nose: noseX,
      front: frontX,
      rear: rearX,
      tail: tailX
    }
  };
}
