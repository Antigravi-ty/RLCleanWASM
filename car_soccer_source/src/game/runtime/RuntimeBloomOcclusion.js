import * as THREE from 'three';
import { getTheme, setTheme, THEMES } from '../../config/themeConfig.js';
import { prewarmSceneShaders } from '../ShaderPrewarmer.js';

export const BLOOM_OCCLUDER_LAYER = 1;

/**
 * RuntimeBloomOcclusion
 * Manages GPU bloom occluder layers, shader compilation, and prewarming.
 */
export class RuntimeBloomOcclusion {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async setupShaders(onProgress = null) {
    const r = this.runtime;
    r.arena.update(
      r.interpolator.prevState,
      r.interpolator.currState,
      0,
      0,
      0,
      r.neutralControls,
      r.neutralControls,
      false
    );
    r.camera.update(r.arena.cars[r.playerCarIndex], r.arena.ball, 0, r.cameraDynamics);

    const originalTheme = getTheme();
    try {
      let themeIndex = 0;
      for (const theme of THEMES) {
        setTheme(theme, { persist: false });
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.dataset.theme = originalTheme;
        }
        await prewarmSceneShaders(r.renderer, r.arena.scene, r.camera.camera, {
          disappearingLightRoots: r.arena.cars,
          renderBloom: async () => {
            this.applyBloomOccluders();
            try {
              if (typeof r.renderer.compileAsync === 'function') {
                await r.renderer.compileAsync(r.arena.scene, r.camera.camera);
              }
              r.boostBloom.render(r.arena.scene, r.camera.camera);
            } finally {
              this.restoreBloomMaterials();
            }
          },
          renderFinal: () => {
            if (r.renderer.shadowMap) r.renderer.shadowMap.needsUpdate = true;
            r.composer.render(0);
          },
          passes: [r.speedLinesPass.pass]
        });
        themeIndex++;
        if (typeof onProgress === 'function') {
          onProgress(themeIndex / THEMES.length, theme);
        }
      }
    } finally {
      setTheme(originalTheme, { persist: false });
    }
  }

  applyBloomOccluders() {
    const r = this.runtime;
    if (r.lastBloomTreeVersion !== r.arena.renderTreeVersion) {
      r.bloomOccluderMeshes.length = 0;
      r.bloomSavedMaterials.length = 0;
      r.bloomInvisibleObjects.length = 0;

      r.arena.scene.traverse((node) => {
        if (node.layers && node.layers.isEnabled(BLOOM_OCCLUDER_LAYER)) return;
        if (node instanceof THREE.Mesh) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          if (node.userData?.bloomOccluder === false || mats.every((m) => m && m.transparent && !m.depthWrite)) {
            r.bloomInvisibleObjects.push(node);
            return;
          }
          r.bloomOccluderMeshes.push(node);
          r.bloomSavedMaterials.push(node.material);
          return;
        }
        if (node.material) r.bloomInvisibleObjects.push(node);
      });
      r.lastBloomTreeVersion = r.arena.renderTreeVersion;
    }

    for (let i = 0; i < r.bloomOccluderMeshes.length; i++) {
      const mesh = r.bloomOccluderMeshes[i];
      r.bloomSavedMaterials[i] = mesh.material;
      mesh.material = r.bloomDarkMaterial;
    }

    r.bloomHiddenObjects.length = 0;
    for (let i = 0; i < r.bloomInvisibleObjects.length; i++) {
      const obj = r.bloomInvisibleObjects[i];
      if (obj.visible) {
        obj.visible = false;
        r.bloomHiddenObjects.push(obj);
      }
    }
  }

  restoreBloomMaterials() {
    const r = this.runtime;
    for (let i = 0; i < r.bloomOccluderMeshes.length; i++) {
      r.bloomOccluderMeshes[i].material = r.bloomSavedMaterials[i];
    }
    for (let i = 0; i < r.bloomHiddenObjects.length; i++) {
      r.bloomHiddenObjects[i].visible = true;
    }
  }
}
