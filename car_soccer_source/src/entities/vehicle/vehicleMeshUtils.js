import {
  OCTANE_SCALE,
  OCTANE_SCALE_X,
  OCTANE_OFFSET_X,
  OCTANE_OFFSET_Y,
  OCTANE_WHEEL_NAMES
} from './vehicleDescriptors.js';
import * as THREE from 'three';

/**
 * Finds a child Object3D by name, throwing if absent.
 */
export function findMeshObjectByName(root, name) {
  const obj = root.getObjectByName?.(name);
  if (!obj) throw new Error(`Game car asset is missing "${name}"`);
  return obj;
}

/**
 * Traverses root to locate the first Mesh matching material name.
 */
export function findMeshByMaterialName(root, matName) {
  let result = null;
  root.traverse?.(node => {
    if (result || !(node.isMesh || node.material)) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    if (mats.some(mat => mat && mat.name === matName)) result = node;
  });
  if (!result) throw new Error(`Game car asset is missing material "${matName}"`);
  return result;
}

/**
 * Computes root transform matrix for the Octane GLTF chassis.
 */
export function getOctaneTransformMatrix() {
  const { Matrix4, Vector3, Quaternion } = THREE;
  const m = new Matrix4().compose(
    new Vector3(OCTANE_OFFSET_X / OCTANE_SCALE, OCTANE_OFFSET_Y / OCTANE_SCALE, 0),
    new Quaternion(),
    new Vector3(OCTANE_SCALE_X, 1, 1)
  );
  return new Matrix4().makeScale(OCTANE_SCALE, OCTANE_SCALE, OCTANE_SCALE).multiply(m);
}

/**
 * Disjoint Set Union (DSU) algorithm that partitions the Octane "lower-detail" geometry
 * into body chassis details and 4 detachable wheel hardware assemblies.
 */
export function detachOctaneWheelHardware(bodyMesh, wheelMeshes, ) {
  const { Matrix4, Matrix3, Vector3, BufferGeometry, BufferAttribute, Mesh } = THREE;
  const lowerDetailMesh = findMeshByMaterialName(bodyMesh, "lower-detail");
  const geom = lowerDetailMesh.geometry;
  const posAttr = geom.getAttribute("position");
  const normAttr = geom.getAttribute("normal");
  const indexAttr = geom.index;
  if (!indexAttr) throw new Error("Game car lower detail must be indexed");

  const parentDSU = new Int32Array(posAttr.count);
  for (let i = 0; i < parentDSU.length; i++) parentDSU[i] = i;

  const findRoot = (x) => {
    let curr = x;
    while (parentDSU[curr] !== curr) curr = parentDSU[curr];
    let trace = x;
    while (trace !== curr) {
      const next = parentDSU[trace];
      parentDSU[trace] = curr;
      trace = next;
    }
    return curr;
  };

  const unionRoots = (a, b) => {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA !== rootB) parentDSU[rootB] = rootA;
  };

  for (let i = 0; i < indexAttr.count; i += 3) {
    const idxA = indexAttr.getX ? indexAttr.getX(i) : indexAttr.array[i];
    const idxB = indexAttr.getX ? indexAttr.getX(i + 1) : indexAttr.array[i + 1];
    const idxC = indexAttr.getX ? indexAttr.getX(i + 2) : indexAttr.array[i + 2];
    unionRoots(idxA, idxB);
    unionRoots(idxB, idxC);
  }

  const transformMat = getOctaneTransformMatrix();
  bodyMesh.updateWorldMatrix?.(true, true);
  const worldMat = transformMat.clone().multiply(lowerDetailMesh.matrixWorld || new Matrix4());
  const normalMat = new Matrix3().getNormalMatrix(worldMat);

  const tmpVec = new Vector3();
  const tmpNorm = new Vector3();
  const wheelWorldPositions = wheelMeshes.map(w => {
    const pos = w.getWorldPosition ? w.getWorldPosition(new Vector3()) : (w.position?.clone() || new Vector3());
    return pos.applyMatrix4(transformMat);
  });

  const clusters = new Map();
  for (let i = 0; i < indexAttr.count; i += 3) {
    const firstVertexIdx = indexAttr.getX ? indexAttr.getX(i) : indexAttr.array[i];
    const root = findRoot(firstVertexIdx);
    let cluster = clusters.get(root);
    if (!cluster) {
      cluster = {
        indices: [],
        min: new Vector3(Infinity, Infinity, Infinity),
        max: new Vector3(-Infinity, -Infinity, -Infinity)
      };
      clusters.set(root, cluster);
    }
    for (let triOffset = 0; triOffset < 3; triOffset++) {
      const idx = indexAttr.getX ? indexAttr.getX(i + triOffset) : indexAttr.array[i + triOffset];
      cluster.indices.push(idx);
      if (tmpVec.fromBufferAttribute) {
        tmpVec.fromBufferAttribute(posAttr, idx).applyMatrix4(worldMat);
      } else {
        tmpVec.set(posAttr.array[idx * 3], posAttr.array[idx * 3 + 1], posAttr.array[idx * 3 + 2]).applyMatrix4(worldMat);
      }
      cluster.min.min(tmpVec);
      cluster.max.max(tmpVec);
    }
  }

  const wheelClusterIndices = wheelWorldPositions.map(() => []);
  const bodyRemainingIndices = [];

  for (const cluster of clusters.values()) {
    const center = cluster.min.clone().add(cluster.max).multiplyScalar(0.5);
    const size = cluster.max.clone().sub(cluster.min);
    const matchedWheel = wheelWorldPositions.findIndex(wheelPos =>
      Math.abs(center.x - wheelPos.x) < 9 &&
      Math.sign(center.z) === Math.sign(wheelPos.z) &&
      Math.abs(center.z - wheelPos.z) < 14 &&
      cluster.max.y < wheelPos.y + 9.5 &&
      cluster.min.y > wheelPos.y - 9 &&
      size.x < 16 &&
      size.z < 18
    );
    if (matchedWheel >= 0) {
      wheelClusterIndices[matchedWheel].push(...cluster.indices);
    } else {
      bodyRemainingIndices.push(...cluster.indices);
    }
  }

  const prunedGeom = geom.clone ? geom.clone() : geom;
  if (prunedGeom.setIndex) {
    prunedGeom.setIndex(bodyRemainingIndices);
  }
  lowerDetailMesh.geometry = prunedGeom;

  return wheelWorldPositions.map((wheelPos, wheelIdx) => {
    const indices = wheelClusterIndices[wheelIdx];
    if (indices.length === 0) {
      throw new Error(`Game car wheel ${wheelIdx} has no detachable hardware`);
    }
    const positions = new Float32Array(indices.length * 3);
    const normals = new Float32Array(indices.length * 3);

    for (let vertexSlot = 0; vertexSlot < indices.length; vertexSlot++) {
      const vertIdx = indices[vertexSlot];
      if (tmpVec.fromBufferAttribute) {
        tmpVec.fromBufferAttribute(posAttr, vertIdx).applyMatrix4(worldMat).sub(wheelPos);
      } else {
        tmpVec.set(posAttr.array[vertIdx * 3], posAttr.array[vertIdx * 3 + 1], posAttr.array[vertIdx * 3 + 2]).applyMatrix4(worldMat).sub(wheelPos);
      }
      tmpVec.toArray(positions, vertexSlot * 3);

      if (normAttr) {
        if (tmpNorm.fromBufferAttribute) {
          tmpNorm.fromBufferAttribute(normAttr, vertIdx).applyNormalMatrix(normalMat).normalize();
        } else {
          tmpNorm.set(normAttr.array[vertIdx * 3], normAttr.array[vertIdx * 3 + 1], normAttr.array[vertIdx * 3 + 2]).applyNormalMatrix(normalMat).normalize();
        }
        tmpNorm.toArray(normals, vertexSlot * 3);
      }
    }

    const hardwareGeom = new BufferGeometry();
    hardwareGeom.setAttribute("position", new BufferAttribute(positions, 3));
    if (normAttr) {
      hardwareGeom.setAttribute("normal", new BufferAttribute(normals, 3));
    } else {
      hardwareGeom.computeVertexNormals?.();
    }
    hardwareGeom.computeBoundingBox?.();
    hardwareGeom.computeBoundingSphere?.();

    const hardwareMesh = new Mesh(hardwareGeom, lowerDetailMesh.material);
    hardwareMesh.name = `${OCTANE_WHEEL_NAMES[wheelIdx]}-hardware`;
    return hardwareMesh;
  });
}
