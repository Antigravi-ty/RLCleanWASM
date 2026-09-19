import * as THREE from 'three';
/**
 * BallVisual.js
 * Visual representation of the soccer ball in both Arcade and Realistic modes.
 * - Arcade: High-detail procedural geodesic truncated icosahedron with rounded panels, pentagons, and hexagons.
 * - Realistic: PBR GLTF model with normal maps, roughness/metalness maps, and custom emissive glow shaders.
 */

import { onThemeChange } from '../ui/ThemeManager.js';

export const CLASSIC_BALL_RADIUS = 95;

let ballVisualThreeContext = {
  Group: null,
  Mesh: null,
  BufferGeometry: null,
  BufferAttribute: null,
  IcosahedronGeometry: null,
  MeshStandardMaterial: null,
  Vector2: null,
  Vector3: null,
  Color: null,
  GLTFLoader: null,
  TextureLoader: null,
  SRGBColorSpace: 'srgb'
};

export function setBallVisualThreeContext(context) {
  if (!context) return;
  const descriptors = Object.getOwnPropertyDescriptors(context);
  Object.defineProperties(ballVisualThreeContext, descriptors);
}

function resolveContext() {
  const threeContext = ballVisualThreeContext;
  return {
    ...THREE,
    ...threeContext,
    GLTFLoader: threeContext.GLTFLoader,
    TextureLoader: threeContext.TextureLoader || THREE.TextureLoader,
    SRGBColorSpace: threeContext.SRGBColorSpace || THREE.SRGBColorSpace
  };
}

export function createGeodesicSoccerBallGeometry(patternColor = null) {
  const {
    BufferGeometry,
    BufferAttribute,
    IcosahedronGeometry,
    Vector3,
    Color
  } = resolveContext();

  const baseIco = new IcosahedronGeometry(1, 0);
  const posAttr = baseIco.getAttribute("position");
  const uniqueVertices = [];
  const vertexLookup = new Map();
  const faces = [];

  if (posAttr) {
    for (let i = 0; i < posAttr.count; i += 3) {
      const face = [];
      for (let cornerIdx = 0; cornerIdx < 3; cornerIdx++) {
        const v = new Vector3().fromBufferAttribute(posAttr, i + cornerIdx);
        const key = v.toArray().map(val => Number(val).toFixed(6)).join(",");
        if (!vertexLookup.has(key)) {
          vertexLookup.set(key, uniqueVertices.length);
          uniqueVertices.push(v);
        }
        face.push(vertexLookup.get(key));
      }
      faces.push(face);
    }
  }
  baseIco.dispose();

  const lerpNorm = (aIdx, bIdx) => uniqueVertices[aIdx].clone().lerp(uniqueVertices[bIdx], 1 / 3).normalize();
  const adjacent = uniqueVertices.map(() => new Set());
  const panels = [];

  for (const [a, b, c] of faces) {
    adjacent[a].add(b).add(c);
    adjacent[b].add(a).add(c);
    adjacent[c].add(a).add(b);
    panels.push({
      corners: [lerpNorm(a, b), lerpNorm(b, a), lerpNorm(b, c), lerpNorm(c, b), lerpNorm(c, a), lerpNorm(a, c)],
      black: false
    });
  }

  for (let i = 0; i < uniqueVertices.length; i++) {
    const v = uniqueVertices[i].clone().normalize();
    const up = (Math.abs(v.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).cross(v).normalize();
    const right = v.clone().cross(up);
    const sorted = [...adjacent[i]].map(adj => lerpNorm(i, adj));
    sorted.sort((p1, p2) => Math.atan2(p1.dot(right), p1.dot(up)) - Math.atan2(p2.dot(right), p2.dot(up)));
    panels.push({
      corners: sorted,
      black: true
    });
  }

  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  const whiteColor = new Color(16052713);
  const darkColor = patternColor != null ? new Color(patternColor) : new Color(1054498);
  const seamColor = new Color(3423560);

  const addVertex = (vNorm, radius, col) => {
    const idx = positions.length / 3;
    positions.push(vNorm.x * radius, vNorm.y * radius, vNorm.z * radius);
    normals.push(vNorm.x, vNorm.y, vNorm.z);
    colors.push(col.r, col.g, col.b);
    return idx;
  };

  for (const { corners, black } of panels) {
    const center = corners.reduce((acc, cur) => acc.add(cur), new Vector3()).normalize();
    const panelColor = black ? darkColor : whiteColor;
    const centerIdx = addVertex(center, CLASSIC_BALL_RADIUS, panelColor);
    const interpolated = [];

    for (let i = 0; i < corners.length; i++) {
      for (let step = 0; step < 3; step++) {
        interpolated.push(corners[i].clone().lerp(corners[(i + 1) % corners.length], step / 3).normalize());
      }
    }

    let previousRing = null;
    for (const radiusFraction of [0.3, 0.6, 0.85, 0.975, 1.0]) {
      const isRim = radiusFraction === 1.0;
      const currentRing = interpolated.map(pt =>
        addVertex(
          center.clone().lerp(pt, radiusFraction).normalize(),
          CLASSIC_BALL_RADIUS - (isRim ? 0.7 : 0),
          isRim ? seamColor : panelColor
        )
      );

      for (let i = 0; i < currentRing.length; i++) {
        const next = (i + 1) % currentRing.length;
        if (previousRing) {
          indices.push(previousRing[i], currentRing[i], currentRing[next], previousRing[i], currentRing[next], previousRing[next]);
        } else {
          indices.push(centerIdx, currentRing[i], currentRing[next]);
        }
      }
      previousRing = currentRing;
    }
  }

  const geometry = new BufferGeometry();
  geometry.name = "Classic soccer ball / rounded panels";
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  geometry.userData.panels = {
    pentagons: panels.filter(panel => panel.corners.length === 5).length,
    hexagons: panels.filter(panel => panel.corners.length === 6).length
  };

  return geometry;
}

/**
 * Creates the classic arcade soccer ball mesh.
 */
export function createClassicSoccerBall(patternColor = null) {
  const { Mesh, Group, MeshStandardMaterial } = resolveContext();
  const geometry = createGeodesicSoccerBallGeometry(patternColor);
  const material = new MeshStandardMaterial({
    name: "Classic soccer ball / matte leather",
    vertexColors: true
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "Classic soccer ball";
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new Group();
  group.name = "ball";
  group.add(mesh);
  return group;
}

let cachedRealisticBallPromise = null;

/**
 * Loads the realistic GLTF soccer ball with normal maps and dynamic emissive lamps.
 */
export function loadRealisticBallModel(gltfLoader = null, textureLoader = null) {
  if (cachedRealisticBallPromise) return cachedRealisticBallPromise;

  const {
    Group,
    Mesh,
    MeshStandardMaterial,
    Vector2,
    GLTFLoader,
    TextureLoader,
    SRGBColorSpace
  } = resolveContext();

  const gLoader = gltfLoader || new GLTFLoader();
  const tLoader = textureLoader || new TextureLoader();

  cachedRealisticBallPromise = Promise.all([
    gLoader.loadAsync("/assets/ball/ball.gltf"),
    tLoader.loadAsync("/assets/ball/albedo.png"),
    tLoader.loadAsync("/assets/ball/normal.png"),
    tLoader.loadAsync("/assets/ball/material-mask.png")
  ]).then(([gltf, albedo, normal, mask]) => {
    for (const tex of [albedo, normal, mask]) {
      tex.flipY = false;
      tex.anisotropy = 8;
    }
    albedo.colorSpace = SRGBColorSpace;

    const material = new MeshStandardMaterial({
      name: "Realistic ball / metal panels and inset lamps",
      map: albedo,
      normalMap: normal,
      normalScale: new Vector2(1, -1),
      roughness: 0.62,
      roughnessMap: mask,
      metalness: 0.55,
      metalnessMap: mask,
      emissive: 6473671,
      emissiveIntensity: 0.78
    });

    material.onBeforeCompile = shader => {
      shader.uniforms.ballMaterialMask = { value: mask };
      shader.fragmentShader = shader.fragmentShader
        .replace("uniform vec3 diffuse;", "uniform vec3 diffuse;\nuniform sampler2D ballMaterialMask;")
        .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance *= texture2D(ballMaterialMask, vMapUv).rrr;");
    };
    material.customProgramCacheKey = () => "car-soccer-ball";

    const ballGroup = new Group();
    ballGroup.name = "Realistic ball";
    ballGroup.add(gltf.scene);
    if (ballGroup.scale?.setScalar) {
      ballGroup.scale.setScalar(100);
    }
    ballGroup.traverse(child => {
      if (child instanceof Mesh) {
        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return ballGroup;
  }).catch(err => {
    cachedRealisticBallPromise = null;
    throw err;
  });

  return cachedRealisticBallPromise;
}

/**
 * Creates the composite soccer ball entity containing both Arcade and Realistic representations,
 * switching between them dynamically on theme changes.
 */
export async function loadBallAsset(gltfLoader = null, textureLoader = null) {
  const compositeGroup = createClassicSoccerBall();
  try {
    const realisticBall = (await loadRealisticBallModel(gltfLoader, textureLoader)).clone(true);
    compositeGroup.add(realisticBall);
  } catch (e) {
    // Expected in test environment without WebGL / assets
  }

  const weakGroup = new WeakRef(compositeGroup);
  if (typeof onThemeChange === 'function') {
    onThemeChange(theme => {
      const g = weakGroup.deref();
      if (g && g.children.length >= 2) {
        g.children[0].visible = theme === "arcade";
        g.children[1].visible = theme === "realistic";
      }
    });
  }

  return compositeGroup;
}
