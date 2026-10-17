import * as THREE from 'three';

/**
 * Multi-point piecewise linear curve interpolator.
 */
export function lerpPolyline(points, targetX) {
  if (targetX <= points[0].x) return points[0].clone ? points[0].clone() : { ...points[0] };
  for (let i = 1; i < points.length; i++) {
    if (targetX <= points[i].x) {
      const t = (targetX - points[i - 1].x) / (points[i].x - points[i - 1].x);
      if (points[i - 1].clone) {
        const cloned = points[i - 1].clone();
        if (typeof cloned.lerp === 'function') return cloned.lerp(points[i], t);
      }
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
        z: points[i - 1].z + (points[i].z - points[i - 1].z) * t
      };
    }
  }
  return points[points.length - 1].clone ? points[points.length - 1].clone() : { ...points[points.length - 1] };
}

/**
 * Builds realistic rear jet nozzle cluster.
 */
export function createRearJetCluster(parentGroup, tailX, teamColor, heightY) {
  const { Group, Mesh, CylinderGeometry, TorusGeometry, LatheGeometry, Vector2, MeshStandardMaterial, DoubleSide } = THREE;
  const matBody = new MeshStandardMaterial({ color: 2567220, roughness: 0.28, metalness: 0.95 });
  const matChrome = new MeshStandardMaterial({ color: 3159615, roughness: 0.22, metalness: 1, side: DoubleSide ?? 2 });
  const matAccent = new MeshStandardMaterial({ color: teamColor, roughness: 0.3, metalness: 0.7 });

  const mountBar = new Mesh(new CylinderGeometry(1, 1, 26.6, 12), matBody);
  mountBar.position.set(tailX, heightY - 0.3, 0);
  mountBar.castShadow = true;

  const baseCylinder = new Mesh(new CylinderGeometry(3.4, 3.9, 8, 18), matBody);
  baseCylinder.rotation.z = Math.PI / 2;
  baseCylinder.position.set(tailX - 2, heightY, 0);
  baseCylinder.castShadow = true;

  const accentRing = new Mesh(new TorusGeometry(3.7, 0.55, 10, 24), matAccent);
  accentRing.rotation.y = Math.PI / 2;
  accentRing.position.set(tailX - 5.8, heightY, 0);

  const nozzleBell = new Mesh(new LatheGeometry([
    new Vector2(1.7, 0),
    new Vector2(2, 0.9),
    new Vector2(2.9, 2.7),
    new Vector2(3.9, 4.5),
    new Vector2(4.7, 5.6)
  ], 22), matChrome);
  nozzleBell.rotation.z = Math.PI / 2;
  nozzleBell.position.set(tailX - 6, heightY, 0);
  nozzleBell.castShadow = true;

  parentGroup.add(mountBar, baseCylinder, accentRing, nozzleBell);
}
