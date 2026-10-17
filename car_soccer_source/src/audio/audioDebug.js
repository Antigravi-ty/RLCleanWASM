export function applySurfaceTaxonomyColoring(arenaWorld, enabled = true, floorNz = 0.8, netNz = 0.05, THREE = null) {
  if (!arenaWorld) return;
  const contextThree = THREE || globalThis.THREE;

  const targetMeshes = [];
  if (arenaWorld.boundary) arenaWorld.boundary.traverse(child => { if (child.isMesh) targetMeshes.push(child); });
  if (arenaWorld.stadium) arenaWorld.stadium.traverse(child => { if (child.isMesh) targetMeshes.push(child); });

  for (const mesh of targetMeshes) {
    if (enabled) {
      if (!mesh.userData._originalMaterial) {
        mesh.userData._originalMaterial = mesh.material;
      }
      if (!contextThree) continue;

      const geom = mesh.geometry;
      if (!geom || !geom.attributes.position || !geom.attributes.normal) continue;

      const count = geom.attributes.position.count;
      const normals = geom.attributes.normal.array;
      const positions = geom.attributes.position.array;

      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const ny = normals[i * 3 + 1];
        const py = positions[i * 3 + 1];
        const px = positions[i * 3 + 0];
        const pz = positions[i * 3 + 2];

        const isNearGoal = Math.abs(pz) >= 4950;
        const isGoalpost = isNearGoal && ((Math.abs(py - 642) < 80 && Math.abs(px) <= 950) || (Math.abs(Math.abs(px) - 893) < 80 && py <= 700));

        if (isGoalpost) {
          // Crimson Red (#ff4757)
          colors[i * 3 + 0] = 1.0;
          colors[i * 3 + 1] = 0.28;
          colors[i * 3 + 2] = 0.34;
        } else if (ny >= floorNz) {
          // Floor: Emerald Green (#2ecc71)
          colors[i * 3 + 0] = 0.18;
          colors[i * 3 + 1] = 0.80;
          colors[i * 3 + 2] = 0.44;
        } else if (ny <= netNz) {
          // Field Net / Ceiling / Sidewall: Neon Cyan (#00d2ff)
          colors[i * 3 + 0] = 0.0;
          colors[i * 3 + 1] = 0.82;
          colors[i * 3 + 2] = 1.0;
        } else {
          // Ramps / Transition Curves: Warm Orange (#ff9f43)
          colors[i * 3 + 0] = 1.0;
          colors[i * 3 + 1] = 0.62;
          colors[i * 3 + 2] = 0.26;
        }
      }

      geom.setAttribute('color', new contextThree.BufferAttribute(colors, 3));
      mesh.material = new contextThree.MeshBasicMaterial({
        vertexColors: true,
        wireframe: false,
        side: contextThree.DoubleSide
      });
    } else {
      if (mesh.userData._originalMaterial) {
        mesh.material = mesh.userData._originalMaterial;
        delete mesh.userData._originalMaterial;
      }
      if (mesh.geometry?.getAttribute('color')) {
        mesh.geometry.deleteAttribute('color');
      }
    }
  }
}
