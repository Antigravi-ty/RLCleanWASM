import { REALISTIC_DIMENSIONS } from './vehicleDescriptors.js';
import * as THREE from 'three';

/**
 * Builds realistic cockpit 3-axis gimbal ring, cradle, and racing bucket seat.
 */
export function createRealisticCarGimbals() {
  const {
    Group,
    Mesh,
    MeshStandardMaterial,
    BoxGeometry,
    CylinderGeometry,
    SphereGeometry,
    TorusGeometry,
    TubeGeometry,
    CatmullRomCurve3,
    BufferGeometry,
    BufferAttribute,
    EdgesGeometry,
    LineSegments,
    LineBasicMaterial,
    Vector3,
    DoubleSide
  } = THREE;
  const setShadowFlags = applyArcadeCelShading;

  const root = new Group();
  const visual = new Group();
  visual.name = "gimbal-cockpit";
  root.add(visual);

  const matDarkMetal = new MeshStandardMaterial({ color: 6055024, roughness: 0.24, metalness: 0.95 });
  const matBrightChrome = new MeshStandardMaterial({ color: 14870252, roughness: 0.12, metalness: 1 });
  const matTrim = new MeshStandardMaterial({ color: 987670, roughness: 0.6, metalness: 0.15 });
  const matSeatPadding = new MeshStandardMaterial({ color: 2501428, roughness: 0.8 });

  const dim = REALISTIC_DIMENSIONS;
  const hitboxMesh = new LineSegments(
    new EdgesGeometry(new BoxGeometry(dim.length, dim.height, dim.width)),
    new LineBasicMaterial({ color: 16777215, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false })
  );
  hitboxMesh.position.set(dim.centerForward, dim.centerUp, 0);
  hitboxMesh.renderOrder = 100;
  hitboxMesh.visible = false;
  root.add(hitboxMesh);

  const rollRingMesh = new Mesh(new TorusGeometry(dim.gimbalOuterRadius, 1.15, 12, 72), matDarkMetal);
  rollRingMesh.castShadow = true;
  rollRingMesh.position.set(dim.gimbalCenterX, dim.gimbalCenterY, 0);
  visual.add(rollRingMesh);

  for (const side of [-1, 1]) {
    const pivot = new Mesh(new CylinderGeometry(1.4, 1.4, 3, 12), matDarkMetal);
    pivot.rotation.z = Math.PI / 2;
    pivot.position.set(dim.gimbalCenterX + side * dim.gimbalOuterRadius, dim.gimbalCenterY, 0);
    visual.add(pivot);
  }

  const innerRingGroup = new Group();
  innerRingGroup.position.set(dim.gimbalCenterX, dim.gimbalCenterY, 0);
  const innerRingMesh = new Mesh(new TorusGeometry(dim.gimbalInnerRadius, 0.95, 12, 64), matDarkMetal);
  innerRingMesh.rotation.x = Math.PI / 2;
  innerRingMesh.castShadow = true;
  innerRingGroup.add(innerRingMesh);

  for (const side of [-1, 1]) {
    const pivot = new Mesh(new CylinderGeometry(0.85, 0.85, 6, 12), matBrightChrome);
    pivot.rotation.z = Math.PI / 2;
    pivot.position.set(side * (dim.gimbalOuterRadius - 3), 0, 0);
    innerRingGroup.add(pivot);
  }
  visual.add(innerRingGroup);

  const cradleGroup = new Group();
  cradleGroup.name = "gimbal-pitch-cradle";

  const addTube = (pts, radius, mat, name, parentGroup, closed = false) => {
    const curve = new CatmullRomCurve3(pts, closed, "centripetal");
    const geom = new TubeGeometry(curve, pts.length * 7, radius, 8, closed);
    const mesh = new Mesh(geom, mat);
    mesh.name = name;
    mesh.castShadow = true;
    parentGroup.add(mesh);
    mesh.userData.path = pts.map(point => point.toArray?.() || [point.x, point.y, point.z]);
    return mesh;
  };

  for (const side of [-1, 1]) {
    const axle = new Mesh(new CylinderGeometry(0.85, 0.85, 5.5, 16), matBrightChrome);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(0, 0, side * 17.75);
    axle.name = "pitch-bearing-axle";
    cradleGroup.add(axle);

    for (const sideSign of [-1, 1]) {
      addTube([
        new Vector3(0, 0, side * 15.75),
        new Vector3(sideSign * 2.1, -3.5, side * 14.1),
        new Vector3(sideSign * 3.2, -10.1, side * 12.5),
        new Vector3(sideSign * 3.2, -13.8, side * 11.8),
        new Vector3(sideSign * 3.2, -14.2, side * 11.4),
        new Vector3(sideSign * 3.8, -15.7, side * 7)
      ], 0.42, matDarkMetal, "continuous-cradle-fork", cradleGroup);
    }
  }

  for (const side of [-1, 1]) {
    addTube([
      new Vector3(side * 3.8, -15.7, -7),
      new Vector3(side * 3.8, -15.7, 0),
      new Vector3(side * 3.8, -15.7, 7)
    ], 0.45, matDarkMetal, "cradle-lower-crossmember", cradleGroup);
    addTube([
      new Vector3(side * 3.8, -15.7, 0),
      new Vector3(0, -15.7, 0)
    ], 0.52, matDarkMetal, "swivel-support", cradleGroup);
  }

  const spindle = new Mesh(new CylinderGeometry(1.1, 1.25, 5.7, 20), matBrightChrome);
  spindle.position.set(0, -11.65, 0);
  spindle.name = "seat-swivel-spindle";
  spindle.castShadow = true;
  cradleGroup.add(spindle);
  innerRingGroup.add(cradleGroup);

  const seatGroup = new Group();
  seatGroup.name = "gimbal-seat-swivel";

  const spineProfile = [
    [3.8, -8.5, 5.1],
    [0, -9, 5.55],
    [-4.8, -8.95, 5.7],
    [-6.6, -6.4, 5.35],
    [-7, -0.5, 5],
    [-7.3, 4.2, 4.25],
    [-7.4, 7, 3]
  ];
  const lateralSpans = [-1, -0.8, 0, 0.8, 1];
  const seatPositions = [];
  const seatIndices = [];

  for (let layer = 0; layer < 2; layer++) {
    spineProfile.forEach(([px, py, pz], pIdx) => {
      lateralSpans.forEach(span => {
        const spanPow = Math.pow(Math.abs(span), 4);
        seatPositions.push(
          px + (pIdx > 2 ? spanPow * 1.1 : 0) - layer * 0.22,
          py + (pIdx <= 2 ? spanPow * 0.85 : 0) - layer * 0.16,
          span * pz
        );
      });
    });
  }

  const numRing = spineProfile.length * lateralSpans.length;
  for (let layer = 0; layer < 2; layer++) {
    for (let profileIndex = 0; profileIndex < spineProfile.length - 1; profileIndex++) {
      for (let s = 0; s < lateralSpans.length - 1; s++) {
        const idxA = layer * numRing + profileIndex * lateralSpans.length + s;
        const idxB = idxA + 1;
        const idxC = idxB + lateralSpans.length;
        const idxD = idxA + lateralSpans.length;
        seatIndices.push(...(layer ? [idxA, idxC, idxB, idxA, idxD, idxC] : [idxA, idxB, idxC, idxA, idxC, idxD]));
      }
    }
  }

  const edgeLoops = [0, 1, 2, 3, 4, 9, 14, 19, 24, 29, 34, 33, 32, 31, 30, 25, 20, 15, 10, 5];
  for (let i = 0; i < edgeLoops.length; i++) {
    const a = edgeLoops[i];
    const b = edgeLoops[(i + 1) % edgeLoops.length];
    seatIndices.push(a, b, b + numRing, a, b + numRing, a + numRing);
  }

  const seatGeom = new BufferGeometry();
  seatGeom.setAttribute("position", new BufferAttribute(new Float32Array(seatPositions), 3));
  seatGeom.setIndex(seatIndices);
  seatGeom.computeVertexNormals?.();

  const seatShellMat = new MeshStandardMaterial({ color: 1318180, roughness: 0.36, metalness: 0.32, side: DoubleSide ?? 2 });
  const seatShellMesh = new Mesh(seatGeom, seatShellMat);
  seatShellMesh.name = "thin-racing-bucket-shell";
  seatShellMesh.castShadow = true;
  seatGroup.add(seatShellMesh);

  for (const side of [-1, 1]) {
    addTube(spineProfile.map(([px, py, pz], pIdx) =>
      new Vector3(px + (pIdx > 2 ? 1.1 : 0), py + (pIdx <= 2 ? 0.85 : 0), side * pz)
    ), 0.19, matTrim, "bucket-edge-bead", seatGroup);
  }

  const addPadding = (name, x, y, z, sx, sy, sz) => {
    const pad = new Mesh(new SphereGeometry(1, 20, 12), matSeatPadding);
    pad.position.set(x, y, z);
    pad.scale.set(sx, sy, sz);
    pad.name = name;
    pad.castShadow = true;
    seatGroup.add(pad);
  };

  addPadding("seat-pan-padding", -1.2, -8.62, 0, 4.8, 0.42, 4.5);
  addPadding("seat-back-padding", -6.55, -1.8, 0, 0.4, 5.8, 3.75);
  addPadding("seat-head-padding", -6.98, 5.3, 0, 0.34, 1.5, 2.55);

  addTube([
    new Vector3(0, -8.75, 0),
    new Vector3(0.75, -6.3, 0),
    new Vector3(1.5, -4, 0)
  ], 0.35, matDarkMetal, "control-column", seatGroup);

  addTube([
    new Vector3(1.5, -4.95, -3.65),
    new Vector3(1.5, -4.5, -4.1),
    new Vector3(1.5, -2.95, -3.5),
    new Vector3(1.5, -2.75, 0),
    new Vector3(1.5, -2.95, 3.5),
    new Vector3(1.5, -4.5, 4.1),
    new Vector3(1.5, -4.95, 3.65),
    new Vector3(1.5, -5.1, 0)
  ], 0.31, matTrim, "race-control-yoke", seatGroup, true);

  const hubBox = new Mesh(new BoxGeometry(0.7, 1.3, 2.4), matTrim);
  hubBox.position.set(1.5, -4, 0);
  hubBox.name = "yoke-hub";
  hubBox.castShadow = true;
  seatGroup.add(hubBox);

  cradleGroup.add(seatGroup);

  return {
    root,
    visual,
    hitbox: hitboxMesh,
    rollRing: innerRingGroup,
    cradle: cradleGroup,
    seat: seatGroup,
    rollAngle: 0,
    cradleAngle: 0,
    seatHeading: NaN
  };
}
