import {
  Color,
  LinearFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NoColorSpace,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  TextureLoader,
  Vector2
} from 'three';
import {
  DEFAULT_DRIFTWOODS_CONFIG,
  DEFAULT_Q1_LAYER_COLORS,
  GROUND_Q1_MANIFEST,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig
} from '../../../config/driftwoodsConfig.ts';
import { resolveAssetPath } from '../../../utils/AssetResponseValidator.js';
import {
  DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG,
  experimentalWallFxRuntimeConfig,
  getExperimentalWallFxConfig,
  setExperimentalWallFxRuntimeConfig,
  PULSE_STEADY_MODE_MAP,
  PULSE_DIRECTION_MAP,
  createWallFxUniforms,
  injectWallFxShader,
  createSpherePreviewMeshes
} from './WallFxShaderController.js';

export {
  DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG,
  experimentalWallFxRuntimeConfig,
  getExperimentalWallFxConfig,
  setExperimentalWallFxRuntimeConfig
};

let sharedQ1GroundTexture = null;

function getOrLoadQ1GroundTexture() {
  if (sharedQ1GroundTexture) {
    return sharedQ1GroundTexture;
  }
  const loader = new TextureLoader();
  const textureUrl = resolveAssetPath(GROUND_Q1_MANIFEST.url);
  const texture = loader.load(
    textureUrl,
    (loadedTex) => {
      loadedTex.flipY = false;
      loadedTex.wrapS = MirroredRepeatWrapping;
      loadedTex.wrapT = MirroredRepeatWrapping;
      loadedTex.colorSpace = NoColorSpace;
      loadedTex.generateMipmaps = false;
      loadedTex.needsUpdate = true;
    },
    undefined,
    (err) => {
      console.warn('[DriftwoodsMaterialManager] Failed to load Q1 7-layer ground texture:', err);
    }
  );
  texture.flipY = false;
  texture.wrapS = MirroredRepeatWrapping;
  texture.wrapT = MirroredRepeatWrapping;
  texture.colorSpace = NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  sharedQ1GroundTexture = texture;
  return texture;
}

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
    this.wallFxConfig = { ...experimentalWallFxRuntimeConfig };

    /** @type {Record<string, import('three').Mesh>} */
    this.meshes = {};

    /** @type {Record<string, import('three').MeshStandardMaterial>} */
    this.standardMaterials = {};

    /** @type {Record<string, import('three').MeshLambertMaterial>} */
    this.lambertMaterials = {};

    this.q1GroundTexture = getOrLoadQ1GroundTexture();
    const q1Colors = {
      ...DEFAULT_Q1_LAYER_COLORS,
      ...(this.config.ground?.q1Colors || {})
    };

    this.groundUniforms = {
      uGroundMode: { value: this.config.ground?.textureMode === 'original' ? 0.0 : 1.0 },
      uQ1GroundMap: { value: this.q1GroundTexture },
      uQ1UvScale: {
        value: new Vector2(
          this.config.ground?.q1ScaleX ?? 1.0,
          this.config.ground?.q1ScaleY ?? 1.0
        )
      },
      uQ1UvOffset: {
        value: new Vector2(
          this.config.ground?.q1OffsetX ?? 0.0,
          this.config.ground?.q1OffsetY ?? 0.0
        )
      },
      uGroundColor: { value: new Color(this.config.ground?.groundColor || '#18441c') },
      uLineColor: { value: new Color(this.config.ground?.lineColor || '#e1e6eb') },
      uLineThreshold: { value: this.config.ground?.lineThreshold ?? 0.35 },
      uLineSmoothness: { value: this.config.ground?.lineSmoothness ?? 0.001 },
      uOrigLineThreshold: { value: this.config.ground?.originalLineThreshold ?? 0.0921 },
      uOrigLineSmoothness: { value: this.config.ground?.originalLineSmoothness ?? 0.0364 },
      uL0Color: { value: new Color(q1Colors.L0) },
      uL1Color: { value: new Color(q1Colors.L1) },
      uL2Color: { value: new Color(q1Colors.L2) },
      uL3Color: { value: new Color(q1Colors.L3) },
      uL4Color: { value: new Color(q1Colors.L4) },
      uL5Color: { value: new Color(q1Colors.L5) },
      uL6Color: { value: new Color(q1Colors.L6) },
      uL4UseTeamColor: { value: this.config.ground?.l4UseTeamColor !== false ? 1.0 : 0.0 },
      uL5UseTeamColor: { value: this.config.ground?.l5UseTeamColor !== false ? 1.0 : 0.0 },
      uL6UseTeamColor: { value: this.config.ground?.l6UseTeamColor !== false ? 1.0 : 0.0 }
    };

    this.wallFxUniforms = createWallFxUniforms(this.wallFxConfig);

    this.spherePreviewGroup = null;
    this.circlePreviewMesh = null;
    this.pulsePreviewMesh = null;

    this.initScene();
    this.setupSpherePreviewMeshes();
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
    } else if (name === 'Woods_Field_Walls_Hexes' || name === 'Woods_Field_Walls') {
      const isWallsMesh = name === 'Woods_Field_Walls';
      this.setupWallFxShader(standardMat, isWallsMesh);
      this.setupWallFxShader(lambertMat, isWallsMesh);
    }

    this.standardMaterials[name] = standardMat;
    this.lambertMaterials[name] = lambertMat;

    mesh.material = this.config.fastDiffuse ? lambertMat : standardMat;
  }

  setupGroundShader(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGroundMode = this.groundUniforms.uGroundMode;
      shader.uniforms.uQ1GroundMap = this.groundUniforms.uQ1GroundMap;
      shader.uniforms.uQ1UvScale = this.groundUniforms.uQ1UvScale;
      shader.uniforms.uQ1UvOffset = this.groundUniforms.uQ1UvOffset;
      shader.uniforms.uGroundColor = this.groundUniforms.uGroundColor;
      shader.uniforms.uLineColor = this.groundUniforms.uLineColor;
      shader.uniforms.uLineThreshold = this.groundUniforms.uLineThreshold;
      shader.uniforms.uLineSmoothness = this.groundUniforms.uLineSmoothness;
      shader.uniforms.uOrigLineThreshold = this.groundUniforms.uOrigLineThreshold;
      shader.uniforms.uOrigLineSmoothness = this.groundUniforms.uOrigLineSmoothness;
      shader.uniforms.uL0Color = this.groundUniforms.uL0Color;
      shader.uniforms.uL1Color = this.groundUniforms.uL1Color;
      shader.uniforms.uL2Color = this.groundUniforms.uL2Color;
      shader.uniforms.uL3Color = this.groundUniforms.uL3Color;
      shader.uniforms.uL4Color = this.groundUniforms.uL4Color;
      shader.uniforms.uL5Color = this.groundUniforms.uL5Color;
      shader.uniforms.uL6Color = this.groundUniforms.uL6Color;
      shader.uniforms.uL4UseTeamColor = this.groundUniforms.uL4UseTeamColor;
      shader.uniforms.uL5UseTeamColor = this.groundUniforms.uL5UseTeamColor;
      shader.uniforms.uL6UseTeamColor = this.groundUniforms.uL6UseTeamColor;
      shader.uniforms.uBlueTeamColor = this.wallFxUniforms.uBlueTeamColor;
      shader.uniforms.uOrangeTeamColor = this.wallFxUniforms.uOrangeTeamColor;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vGroundWorldPos;'
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vGroundWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          'uniform vec3 diffuse;',
          `uniform vec3 diffuse;
          varying vec3 vGroundWorldPos;
          uniform float uGroundMode;
          uniform sampler2D uQ1GroundMap;
          uniform vec2 uQ1UvScale;
          uniform vec2 uQ1UvOffset;
          uniform vec3 uGroundColor;
          uniform vec3 uLineColor;
          uniform float uLineThreshold;
          uniform float uLineSmoothness;
          uniform float uOrigLineThreshold;
          uniform float uOrigLineSmoothness;
          uniform vec3 uL0Color;
          uniform vec3 uL1Color;
          uniform vec3 uL2Color;
          uniform vec3 uL3Color;
          uniform vec3 uL4Color;
          uniform vec3 uL5Color;
          uniform vec3 uL6Color;
          uniform float uL4UseTeamColor;
          uniform float uL5UseTeamColor;
          uniform float uL6UseTeamColor;
          uniform vec3 uBlueTeamColor;
          uniform vec3 uOrangeTeamColor;`
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            if (uGroundMode > 0.5) {
              vec2 q1Uv = vec2(abs(vGroundWorldPos.x) / 4096.0, abs(vGroundWorldPos.z) / 6000.0) * uQ1UvScale + uQ1UvOffset;
              float smoothGray = texture2D( uQ1GroundMap, q1Uv ).r;
              if (smoothGray <= 0.002) {
                diffuseColor.rgb = uL0Color;
              } else {
                const vec2 Q1_TEX_SIZE = vec2(2048.0, 3000.0);
                const vec2 Q1_INV_SIZE = vec2(1.0 / 2048.0, 1.0 / 3000.0);
                vec2 baseTexelUv = (floor(q1Uv * Q1_TEX_SIZE) + 0.5) * Q1_INV_SIZE;
                float peakGray = smoothGray;
                if (peakGray < 0.915686) {
                  for (int dy = -2; dy <= 2; dy++) {
                    for (int dx = -2; dx <= 2; dx++) {
                      float g = texture2D( uQ1GroundMap, baseTexelUv + vec2(float(dx), float(dy)) * Q1_INV_SIZE ).r;
                      peakGray = max(peakGray, g);
                    }
                  }
                }
                vec3 teamSideColor = vGroundWorldPos.z < 0.0 ? uBlueTeamColor : uOrangeTeamColor;
                vec3 layerColor = uL0Color;
                if (peakGray < 0.080392) {
                  layerColor = uL0Color;
                } else if (peakGray < 0.249020) {
                  layerColor = uL1Color;
                } else if (peakGray < 0.417647) {
                  layerColor = uL2Color;
                } else if (peakGray < 0.586275) {
                  layerColor = uL3Color;
                } else if (peakGray < 0.750980) {
                  layerColor = (uL4UseTeamColor > 0.5) ? teamSideColor : uL4Color;
                } else if (peakGray < 0.915686) {
                  layerColor = (uL5UseTeamColor > 0.5) ? teamSideColor : uL5Color;
                } else {
                  layerColor = (uL6UseTeamColor > 0.5) ? teamSideColor : uL6Color;
                }
                float coverage = clamp(smoothGray / max(0.0001, peakGray), 0.0, 1.0);
                float halfWidth = max(0.0005, uLineSmoothness);
                float lineMask = smoothstep(uLineThreshold - halfWidth, uLineThreshold + halfWidth, coverage);
                diffuseColor.rgb = mix(uL0Color, layerColor, lineMask);
              }
            } else {
              vec4 sampledDiffuseColor = texture2D( map, vMapUv );
              #ifdef DECODE_VIDEO_TEXTURE
                sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
              #endif
              float lineLum = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
              float halfWidth = max(0.0005, uOrigLineSmoothness);
              float isLine = smoothstep(uOrigLineThreshold - halfWidth, uOrigLineThreshold + halfWidth, lineLum);
              diffuseColor.rgb = mix(uGroundColor, uLineColor, isLine);
            }
          #endif`
        );
    };

    material.customProgramCacheKey = () =>
      material.isMeshLambertMaterial
        ? 'driftwoods-ground-tint-lambert-v9-q1-orig-sep'
        : 'driftwoods-ground-tint-standard-v9-q1-orig-sep';
  }

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
      this.groundUniforms.uGroundMode.value = c.ground.textureMode === 'original' ? 0.0 : 1.0;

      this.groundUniforms.uQ1UvScale.value.set(
        c.ground.q1ScaleX ?? 1.0,
        c.ground.q1ScaleY ?? 1.0
      );
      this.groundUniforms.uQ1UvOffset.value.set(
        c.ground.q1OffsetX ?? 0.0,
        c.ground.q1OffsetY ?? 0.0
      );

      if (c.ground.q1Colors) {
        const q1 = c.ground.q1Colors;
        if (q1.L0) this.groundUniforms.uL0Color.value.set(q1.L0);
        if (q1.L1) this.groundUniforms.uL1Color.value.set(q1.L1);
        if (q1.L2) this.groundUniforms.uL2Color.value.set(q1.L2);
        if (q1.L3) this.groundUniforms.uL3Color.value.set(q1.L3);
        if (q1.L4) this.groundUniforms.uL4Color.value.set(q1.L4);
        if (q1.L5) this.groundUniforms.uL5Color.value.set(q1.L5);
        if (q1.L6) this.groundUniforms.uL6Color.value.set(q1.L6);
      }

      if (this.groundUniforms.uL4UseTeamColor) {
        this.groundUniforms.uL4UseTeamColor.value = c.ground.l4UseTeamColor !== false ? 1.0 : 0.0;
      }
      if (this.groundUniforms.uL5UseTeamColor) {
        this.groundUniforms.uL5UseTeamColor.value = c.ground.l5UseTeamColor !== false ? 1.0 : 0.0;
      }
      if (this.groundUniforms.uL6UseTeamColor) {
        this.groundUniforms.uL6UseTeamColor.value = c.ground.l6UseTeamColor !== false ? 1.0 : 0.0;
      }

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
      if (this.groundUniforms.uOrigLineThreshold) {
        this.groundUniforms.uOrigLineThreshold.value = c.ground.originalLineThreshold ?? 0.0921;
      }
      if (this.groundUniforms.uOrigLineSmoothness) {
        this.groundUniforms.uOrigLineSmoothness.value = c.ground.originalLineSmoothness ?? 0.0364;
      }

      this.updateMaterialCommon(this.standardMaterials['Woods_Field_Ground'], c.ground);
      this.updateMaterialCommon(this.lambertMaterials['Woods_Field_Ground'], c.ground);

      const targetMag = c.ground.magFilter === 'nearest' ? NearestFilter : LinearFilter;
      const targetAnisotropy = Math.max(1, Math.min(16, c.ground.anisotropy ?? 1));

      if (this.q1GroundTexture) {
        if (
          this.q1GroundTexture.magFilter !== targetMag ||
          this.q1GroundTexture.minFilter !== targetMag ||
          this.q1GroundTexture.anisotropy !== targetAnisotropy
        ) {
          this.q1GroundTexture.magFilter = targetMag;
          this.q1GroundTexture.minFilter = targetMag;
          this.q1GroundTexture.anisotropy = targetAnisotropy;
          this.q1GroundTexture.needsUpdate = true;
        }
      }

      const origAnisotropy = Math.max(16, targetAnisotropy);
      const tex = this.standardMaterials['Woods_Field_Ground']?.map;
      if (tex) {
        tex.repeat.set(c.ground.scaleX ?? 1.0, c.ground.scaleY ?? 1.0);
        tex.offset.set(c.ground.offsetX ?? 0.0, c.ground.offsetY ?? 0.0);
        if (tex.magFilter !== targetMag || tex.anisotropy !== origAnisotropy) {
          tex.magFilter = targetMag;
          tex.anisotropy = origAnisotropy;
          tex.needsUpdate = true;
        }
        tex.updateMatrix();
      }
      const lambertTex = this.lambertMaterials['Woods_Field_Ground']?.map;
      if (lambertTex) {
        lambertTex.repeat.set(c.ground.scaleX ?? 1.0, c.ground.scaleY ?? 1.0);
        lambertTex.offset.set(c.ground.offsetX ?? 0.0, c.ground.offsetY ?? 0.0);
        if (lambertTex.magFilter !== targetMag || lambertTex.anisotropy !== origAnisotropy) {
          lambertTex.magFilter = targetMag;
          lambertTex.anisotropy = origAnisotropy;
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

  applyLayerConfig(meshName, layerConfig) {
    if (!layerConfig) return;
    const mesh = this.meshes[meshName];
    if (!mesh) return;

    mesh.visible = layerConfig.visible !== false;

    const std = this.standardMaterials[meshName];
    const lam = this.lambertMaterials[meshName];

    const keepTransparent = meshName === 'Woods_Field_Walls' || meshName === 'Woods_Field_Walls_Hexes';

    if (std) {
      if (layerConfig.color) std.color.set(layerConfig.color);
      if (layerConfig.roughness !== undefined) std.roughness = layerConfig.roughness;
      if (layerConfig.metalness !== undefined) std.metalness = layerConfig.metalness;
      if (layerConfig.opacity !== undefined) {
        std.opacity = layerConfig.opacity;
        std.transparent = keepTransparent || layerConfig.opacity < 0.999;
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
        lam.transparent = keepTransparent || layerConfig.opacity < 0.999;
      }
      if (layerConfig.emissive) {
        lam.emissive.set(layerConfig.emissive);
      }
      if (layerConfig.wireframe !== undefined) {
        lam.wireframe = layerConfig.wireframe;
      }
    }
  }

  setupSpherePreviewMeshes() {
    if (!this.scene || this.spherePreviewGroup) return;
    const preview = createSpherePreviewMeshes(this.scene, this.wallFxConfig);
    if (preview) {
      this.spherePreviewGroup = preview.group;
      this.circlePreviewMesh = preview.circlePreviewMesh;
      this.pulsePreviewMesh = preview.pulsePreviewMesh;
      this.syncSpherePreviewMeshes();
    }
  }

  syncSpherePreviewMeshes() {
    const c = this.wallFxConfig;
    const u = this.wallFxUniforms;
    if (this.circlePreviewMesh) {
      const rX = Math.max(10, Number(c.circleRadius) || 500);
      const rY = Math.max(10, rX + (Number(c.circleVerticalExtendUu) || 0));
      this.circlePreviewMesh.visible = Boolean(c.circleShowSpherePreview && c.circleEnabled);
      this.circlePreviewMesh.scale.set(rX, rY, rX);
      this.circlePreviewMesh.position.copy(u.uCircleBallPos.value);
    }
    if (this.pulsePreviewMesh) {
      const rX = Math.max(10, Number(c.pulseSphereRadius) || 4000);
      const rY = Math.max(10, rX + (Number(c.pulseVerticalExtendUu) || 0));
      this.pulsePreviewMesh.visible = Boolean(c.pulseShowSpherePreview && c.pulseEnabled);
      this.pulsePreviewMesh.scale.set(rX, rY, rX);
      this.pulsePreviewMesh.position.copy(u.uPulseBallPos.value);
    }
  }

  setupWallFxShader(material, isWallsMesh = false) {
    injectWallFxShader(material, this.wallFxUniforms, isWallsMesh);
  }

  updateBallProximity(ballPos, ballVel, dt = 0.016) {
    this.wallFxUniforms.uTime.value += Math.max(0, Math.min(0.1, dt || 0.016));
    const t = this.wallFxUniforms.uTime.value;
    const c = this.wallFxConfig;

    if (c.circlePreviewOrbit || c.previewBallNearWall) {
      this.wallFxUniforms.uCircleBallPos.value.set(
        3820,
        420 + Math.sin(t * 1.4) * 220,
        Math.cos(t * 0.8) * 900
      );
    } else if (ballPos) {
      this.wallFxUniforms.uCircleBallPos.value.copy(ballPos);
    }

    if (c.pulsePreviewOrbit || c.previewBallNearWall) {
      this.wallFxUniforms.uPulseBallPos.value.set(
        3820,
        420 + Math.sin(t * 1.4) * 220,
        Math.cos(t * 0.8) * 900
      );
    } else if (ballPos) {
      this.wallFxUniforms.uPulseBallPos.value.copy(ballPos);
    }

    if (c.circleShowSpherePreview || c.pulseShowSpherePreview) {
      this.syncSpherePreviewMeshes();
    }
  }

  updateExperimentalWallConfig(patch) {
    if (!patch) return;
    Object.assign(this.wallFxConfig, patch);
    Object.assign(experimentalWallFxRuntimeConfig, this.wallFxConfig);
    const c = this.wallFxConfig;
    const u = this.wallFxUniforms;

    u.uCircleEnabled.value = c.circleEnabled ? 1.0 : 0.0;
    u.uCircleRadius.value = Number(c.circleRadius) || 500;
    u.uCircleVerticalExtendUu.value = Number(c.circleVerticalExtendUu) || 0;
    u.uCircleThickness.value = Number(c.circleThickness) || 5;
    if (c.circleColor) u.uCircleColor.value.set(c.circleColor);
    u.uCircleUseTeamColor.value = c.circleUseTeamColor ? 1.0 : 0.0;
    u.uCircleOpacity.value = Number(c.circleOpacity) ?? 0.75;

    u.uPulseEnabled.value = c.pulseEnabled ? 1.0 : 0.0;
    if (u.uPulseApplyToHexes) u.uPulseApplyToHexes.value = c.pulseApplyToHexes !== false ? 1.0 : 0.0;
    if (u.uPulseApplyToWalls) u.uPulseApplyToWalls.value = c.pulseApplyToWalls ? 1.0 : 0.0;
    u.uPulseSphereRadius.value = Number(c.pulseSphereRadius) || 4000;
    u.uPulseVerticalExtendUu.value = Number(c.pulseVerticalExtendUu) || 0;
    if (u.uPulseDirection) u.uPulseDirection.value = PULSE_DIRECTION_MAP[c.pulseDirection] ?? 1;
    if (u.uPulseFadeShrinkPct) u.uPulseFadeShrinkPct.value = Number(c.pulseFadeShrinkPct ?? 50);
    if (u.uPulseFadeBezier) {
      u.uPulseFadeBezier.value.set(
        Number(c.pulseFadeBezierP1X ?? 0.5),
        Number(c.pulseFadeBezierP1Y ?? 0.0),
        Number(c.pulseFadeBezierP2X ?? 1.0),
        Number(c.pulseFadeBezierP2Y ?? 0.0)
      );
    }
    if (u.uPulseSteadyMode) u.uPulseSteadyMode.value = PULSE_STEADY_MODE_MAP[c.pulseSteadyMode] ?? 0;
    if (u.uPulseStaticPositionPct) u.uPulseStaticPositionPct.value = Number(c.pulseStaticPositionPct ?? 47);
    if (u.uPulseStaticBandWidthPct) u.uPulseStaticBandWidthPct.value = Number(c.pulseStaticBandWidthPct ?? 5) ;
    u.uPulseIntervalSec.value = Number(c.pulseIntervalSec) || 1.0;
    if (u.uPulseRiseDurationSec) u.uPulseRiseDurationSec.value = Number(c.pulseRiseDurationSec ?? 0.01);
    if (u.uPulseFallDurationSec) u.uPulseFallDurationSec.value = Number(c.pulseFallDurationSec ?? 0.2);
    u.uPulseSpeedRadiusPct.value = Number(c.pulseSpeedRadiusPct) || 50;
    if (u.uPulseRiseBezier) {
      u.uPulseRiseBezier.value.set(
        Number(c.pulseRiseBezierP1X ?? 0.33),
        Number(c.pulseRiseBezierP1Y ?? 0.33),
        Number(c.pulseRiseBezierP2X ?? 0.67),
        Number(c.pulseRiseBezierP2Y ?? 0.67)
      );
    }
    if (u.uPulseFallBezier) {
      u.uPulseFallBezier.value.set(
        Number(c.pulseFallBezierP1X ?? 0.0),
        Number(c.pulseFallBezierP1Y ?? 0.5),
        Number(c.pulseFallBezierP2X ?? 0.0),
        Number(c.pulseFallBezierP2Y ?? 1.01)
      );
    }
    u.uPulseIntensity.value = Number(c.pulseIntensity) ?? 1.0;
    if (c.pulseColor) u.uPulseColor.value.set(c.pulseColor);
    u.uPulseMultiplyTeamColor.value = c.pulseMultiplyTeamColor ? 1.0 : 0.0;
    u.uPulseOpacity.value = Number(c.pulseOpacity) ?? 0.92;

    u.uTeamGradientEnabled.value = c.teamGradientEnabled ? 1.0 : 0.0;
    u.uCenterLineWidth.value = Number(c.centerLineWidth) ?? 5;
    u.uTeamTransitionWidth.value = Number(c.teamTransitionWidth) ?? 1000;
    u.uTeamColorStrength.value = Number(c.teamColorStrength) ?? 0.8;
    if (c.blueTeamColor) u.uBlueTeamColor.value.set(c.blueTeamColor);
    u.uBlueTeamAlpha.value = Number(c.blueTeamAlpha) ?? 0.85;
    if (c.orangeTeamColor) u.uOrangeTeamColor.value.set(c.orangeTeamColor);
    u.uOrangeTeamAlpha.value = Number(c.orangeTeamAlpha) ?? 0.85;
    if (c.centerLineColor) u.uCenterLineColor.value.set(c.centerLineColor);
    u.uCenterLineAlpha.value = Number(c.centerLineAlpha) ?? 0.0;

    this.syncSpherePreviewMeshes();
  }

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
