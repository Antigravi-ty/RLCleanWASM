import {
  Color,
  LinearFilter,
  NearestFilter,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RepeatWrapping
} from 'three';
import {
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig
} from './DriftwoodsConfigurator.ts';

/**
 * Manages Driftwoods stadium mesh materials, shader compilation, UV transforms,
 * texture filtering modes, and high-performance Lambert downgrades in real time.
 */
export class DriftwoodsMaterialManager {
  /**
   * @param {import('three').Group} stadiumScene
   * @param {any} [initialConfig]
   */
  constructor(stadiumScene, initialConfig = DEFAULT_DRIFTWOODS_CONFIG) {
    this.scene = stadiumScene;
    this.config = cloneDriftwoodsConfig(initialConfig);

    /** @type {Record<string, import('three').Mesh>} */
    this.meshes = {};

    /** @type {Record<string, import('three').MeshStandardMaterial>} */
    this.standardMaterials = {};

    /** @type {Record<string, import('three').MeshLambertMaterial>} */
    this.lambertMaterials = {};

    /** @type {{ uGroundColor: { value: Color }, uLineColor: { value: Color }, uLineThreshold: { value: number }, uLineSmoothness: { value: number } }} */
    this.groundUniforms = {
      uGroundColor: { value: new Color(this.config.ground?.groundColor || '#18441c') },
      uLineColor: { value: new Color(this.config.ground?.lineColor || '#e1e6eb') },
      uLineThreshold: { value: this.config.ground?.lineThreshold ?? 0.13 },
      uLineSmoothness: { value: this.config.ground?.lineSmoothness ?? 0.05 }
    };

    this.initScene();
    this.applyConfig(this.config);
  }

  initScene() {
    this.scene.traverse((obj) => {
      if (obj.name === 'BoostPads_Combined_Base') {
        obj.visible = false;
        obj.removeFromParent?.();
        return;
      }

      if (obj.isMesh) {
        this.meshes[obj.name] = obj;
        this.setupMeshMaterials(obj);
      }
    });
  }

  /**
   * @param {import('three').Mesh} mesh
   */
  setupMeshMaterials(mesh) {
    const name = mesh.name;
    const origMat = mesh.material;

    const standardMat = origMat.isMeshStandardMaterial
      ? origMat.clone()
      : new MeshStandardMaterial();

    standardMat.name = `${name}_Standard`;

    const lambertMat = new MeshLambertMaterial({
      name: `${name}_Lambert`,
      map: standardMat.map || null,
      transparent: standardMat.transparent,
      opacity: standardMat.opacity,
      side: standardMat.side,
      wireframe: standardMat.wireframe
    });

    if (name === 'Woods_Field_Ground') {
      this.setupGroundShader(standardMat);
      this.setupGroundShader(lambertMat);

      if (standardMat.map) {
        standardMat.map.wrapS = RepeatWrapping;
        standardMat.map.wrapT = RepeatWrapping;
        standardMat.map.needsUpdate = true;
      }
      if (lambertMat.map) {
        lambertMat.map.wrapS = RepeatWrapping;
        lambertMat.map.wrapT = RepeatWrapping;
        lambertMat.map.needsUpdate = true;
      }
    }

    this.standardMaterials[name] = standardMat;
    this.lambertMaterials[name] = lambertMat;

    mesh.material = this.config.fastDiffuse ? lambertMat : standardMat;
  }

  /**
   * Injects calibrated dynamic dual-color mask shader into ground material.
   * @param {import('three').Material} material
   */
  setupGroundShader(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGroundColor = this.groundUniforms.uGroundColor;
      shader.uniforms.uLineColor = this.groundUniforms.uLineColor;
      shader.uniforms.uLineThreshold = this.groundUniforms.uLineThreshold;
      shader.uniforms.uLineSmoothness = this.groundUniforms.uLineSmoothness;

      shader.fragmentShader = shader.fragmentShader
        .replace(
          'uniform vec3 diffuse;',
          'uniform vec3 diffuse;\nuniform vec3 uGroundColor;\nuniform vec3 uLineColor;\nuniform float uLineThreshold;\nuniform float uLineSmoothness;'
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vMapUv );
            #ifdef DECODE_VIDEO_TEXTURE
              sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
            #endif
            float lineLum = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            float halfWidth = max(0.0005, uLineSmoothness);
            float isLine = smoothstep(uLineThreshold - halfWidth, uLineThreshold + halfWidth, lineLum);
            diffuseColor.rgb = mix(uGroundColor, uLineColor, isLine);
          #endif`
        );
    };

    material.customProgramCacheKey = () =>
      material.isMeshLambertMaterial
        ? 'driftwoods-ground-tint-lambert-v5'
        : 'driftwoods-ground-tint-standard-v5';
  }

  /**
   * Applies partial or complete configuration updates in real time.
   * @param {Partial<import('./DriftwoodsConfigurator.ts').DriftwoodsTunerConfig>} patch
   */
  applyConfig(patch) {
    if (!patch) return;

    this.config = mergeDriftwoodsConfig(this.config, patch);
    const c = this.config;

    const useLambert = Boolean(c.fastDiffuse);
    for (const [name, mesh] of Object.entries(this.meshes)) {
      const targetMat = useLambert ? this.lambertMaterials[name] : this.standardMaterials[name];
      if (mesh.material !== targetMat) {
        mesh.material = targetMat;
      }
    }

    const groundMesh = this.meshes['Woods_Field_Ground'];
    if (groundMesh && c.ground) {
      if (this.groundUniforms.uGroundColor) {
        this.groundUniforms.uGroundColor.value.set(c.ground.groundColor);
      }
      if (this.groundUniforms.uLineColor) {
        this.groundUniforms.uLineColor.value.set(c.ground.lineColor);
      }
      if (this.groundUniforms.uLineThreshold && c.ground.lineThreshold !== undefined) {
        this.groundUniforms.uLineThreshold.value = c.ground.lineThreshold;
      }
      if (this.groundUniforms.uLineSmoothness && c.ground.lineSmoothness !== undefined) {
        this.groundUniforms.uLineSmoothness.value = c.ground.lineSmoothness;
      }

      this.updateMaterialCommon(this.standardMaterials['Woods_Field_Ground'], c.ground);
      this.updateMaterialCommon(this.lambertMaterials['Woods_Field_Ground'], c.ground);

      const targetMag = c.ground.magFilter === 'nearest' ? NearestFilter : LinearFilter;
      const targetAnisotropy = Math.max(1, Math.min(16, c.ground.anisotropy ?? 16));

      const tex = this.standardMaterials['Woods_Field_Ground']?.map;
      if (tex) {
        tex.repeat.set(c.ground.scaleX ?? 1.0, c.ground.scaleY ?? 1.0);
        tex.offset.set(c.ground.offsetX ?? 0.0, c.ground.offsetY ?? 0.0);
        if (tex.magFilter !== targetMag || tex.anisotropy !== targetAnisotropy) {
          tex.magFilter = targetMag;
          tex.anisotropy = targetAnisotropy;
          tex.needsUpdate = true;
        }
        tex.updateMatrix();
      }
      const lambertTex = this.lambertMaterials['Woods_Field_Ground']?.map;
      if (lambertTex) {
        lambertTex.repeat.set(c.ground.scaleX ?? 1.0, c.ground.scaleY ?? 1.0);
        lambertTex.offset.set(c.ground.offsetX ?? 0.0, c.ground.offsetY ?? 0.0);
        if (lambertTex.magFilter !== targetMag || lambertTex.anisotropy !== targetAnisotropy) {
          lambertTex.magFilter = targetMag;
          lambertTex.anisotropy = targetAnisotropy;
          lambertTex.needsUpdate = true;
        }
        lambertTex.updateMatrix();
      }

      groundMesh.visible = c.ground.visible !== false;
    }

    this.applyLayerConfig('Woods_Field_Ramps', c.ramps);
    this.applyLayerConfig('Woods_Field_Ramps_Trim', c.rampsTrim);
    this.applyLayerConfig('Woods_Field_Wall_Posts', c.wallPosts);
    this.applyLayerConfig('Woods_Field_Goal', c.goalFrame);
    this.applyLayerConfig('Woods_Field_Goal_Posts', c.goalPosts);

    this.applyLayerConfig('Woods_Field_Walls', c.walls);
    this.applyLayerConfig('Woods_Field_Goal_Net', c.goalNet);

    this.applyLayerConfig('Woods_Field_Walls_Hexes', c.hexes);
  }

  /**
   * @param {string} meshName
   * @param {import('./DriftwoodsConfigurator.ts').DriftwoodsLayerConfig} layerConfig
   */
  applyLayerConfig(meshName, layerConfig) {
    if (!layerConfig) return;
    const mesh = this.meshes[meshName];
    if (!mesh) return;

    mesh.visible = layerConfig.visible !== false;

    const std = this.standardMaterials[meshName];
    const lam = this.lambertMaterials[meshName];

    if (std) {
      if (layerConfig.color) std.color.set(layerConfig.color);
      if (layerConfig.roughness !== undefined) std.roughness = layerConfig.roughness;
      if (layerConfig.metalness !== undefined) std.metalness = layerConfig.metalness;
      if (layerConfig.opacity !== undefined) {
        std.opacity = layerConfig.opacity;
        std.transparent = layerConfig.opacity < 0.999;
      }
      if (layerConfig.emissive) {
        std.emissive.set(layerConfig.emissive);
      }
      if (layerConfig.emissiveIntensity !== undefined) {
        std.emissiveIntensity = layerConfig.emissiveIntensity;
      }
      if (layerConfig.wireframe !== undefined) {
        std.wireframe = layerConfig.wireframe;
      }
    }

    if (lam) {
      if (layerConfig.color) lam.color.set(layerConfig.color);
      if (layerConfig.opacity !== undefined) {
        lam.opacity = layerConfig.opacity;
        lam.transparent = layerConfig.opacity < 0.999;
      }
      if (layerConfig.emissive) {
        lam.emissive.set(layerConfig.emissive);
      }
      if (layerConfig.wireframe !== undefined) {
        lam.wireframe = layerConfig.wireframe;
      }
    }
  }

  /**
   * @param {import('three').Material} mat
   * @param {any} config
   */
  updateMaterialCommon(mat, config) {
    if (!mat) return;
    if (config.roughness !== undefined && 'roughness' in mat) mat.roughness = config.roughness;
    if (config.metalness !== undefined && 'metalness' in mat) mat.metalness = config.metalness;
    if (config.wireframe !== undefined) mat.wireframe = config.wireframe;
  }
}

export function createDriftwoodsManager(stadiumScene, config) {
  return new DriftwoodsMaterialManager(stadiumScene, config);
}
