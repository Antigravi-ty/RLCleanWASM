/**
 * ArenaSky.js
 * Hemispherical sky dome shader mesh with arcade and realistic multi-theme grading.
 */

import * as THREE from 'three';
import {
  createMultiThemeMaterial,
  registerThemeSubtree
} from '../../effects/ThemeMaterialPipeline.js';

/**
 * Creates stadium dome sky shader mesh.
 */
export function createStadiumDomeSky() {
  const arcadeMat = new THREE.ShaderMaterial({
    name: "Stadium / arcade sky",
    side: THREE.FrontSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(1389936) },
      middle: { value: new THREE.Color(3766190) },
      horizon: { value: new THREE.Color(8894931) }
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

  const skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(28000, 48, 24),
    createMultiThemeMaterial(arcadeMat, realisticMat)
  );
  skyMesh.name = "Stadium / open blue sky";
  skyMesh.userData.bloomOccluder = false;
  skyMesh.renderOrder = 10000;
  registerThemeSubtree(skyMesh);
  return skyMesh;
}
