import * as THREE from 'three';
/**
 * src/loaders/GLTFLoader.js
 * GLTF 2.0 3D Model Loader & Plugin Subsystem (Phase 7.8 Part 3 Deobfuscation)
 *
 * Fully modularized GLTF 2.0 loader supporting JSON and Binary (.glb) formats,
 * morph targets, skinning / skeletal animation, and an extensive suite of extensions:
 * - KHR_binary_glTF
 * - KHR_draco_mesh_compression
 * - KHR_lights_punctual
 * - KHR_materials_clearcoat
 * - KHR_materials_dispersion
 * - KHR_materials_ior
 * - KHR_materials_sheen
 * - KHR_materials_specular
 * - KHR_materials_transmission
 * - KHR_materials_iridescence
 * - KHR_materials_anisotropy
 * - KHR_materials_unlit
 * - KHR_materials_volume
 * - KHR_materials_emissive_strength
 * - KHR_texture_basisu
 * - KHR_texture_transform
 * - KHR_mesh_quantization
 * - EXT_materials_bump
 * - EXT_texture_webp
 * - EXT_texture_avif
 * - EXT_meshopt_compression / KHR_meshopt_compression
 * - EXT_mesh_gpu_instancing
 *
 * Fully deobfuscated and modularized Three.js GLTFLoader implementation.
 * All internal single/double letter constants, context shadows, and dead aliases have been eliminated.
 */

import {
  toTrianglesDrawMode,
  cloneSkinnedMesh,
  TrianglesDrawMode,
  TriangleStripDrawMode,
  TriangleFanDrawMode
} from "../utils/BufferGeometryUtils.js";

// Standard Three.js constants matching engine definitions
export const RepeatWrapping = 1000;
export const ClampToEdgeWrapping = 1001;
export const MirroredRepeatWrapping = 1002;
export const NearestFilter = 1003;
export const NearestMipmapNearestFilter = 1004;
export const NearestMipmapLinearFilter = 1005;
export const LinearFilter = 1006;
export const LinearMipmapLinearFilter = 1007;
export const LinearMipmapNearestFilter = 1008;
export const InterpolateDiscrete = 2300;
export const InterpolateLinear = 2301;
export const FrontSide = 0;
export const BackSide = 1;
export const DoubleSide = 2;
export const SRGBColorSpace = "srgb";
export const LinearSRGBColorSpace = "srgb-linear";

// GLTF Binary (.glb) format constants
const BINARY_HEADER_MAGIC = "glTF";
const BINARY_HEADER_LENGTH = 12;
const BINARY_CHUNK_TYPES = {
  JSON: 1313821514,
  BIN: 5130562
};


/**
 * Creates a default loading manager conforming to Three.js LoadingManager interface.
 */
export function createDefaultLoadingManager() {
  const abortCtrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
  return {
    isLoading: false,
    itemsLoaded: 0,
    itemsTotal: 0,
    itemStart() {},
    itemEnd() {},
    itemError() {},
    resolveURL(url) {
      return typeof url === "string" ? url.normalize("NFC") : url;
    },
    setURLModifier(urlModifier) {
      this.resolveURL = (url) => {
        const norm = typeof url === "string" ? url.normalize("NFC") : url;
        return urlModifier ? urlModifier(norm) : norm;
      };
      return this;
    },
    get abortController() {
      return this._abortController || (this._abortController = (typeof AbortController !== "undefined" ? new AbortController() : null));
    },
    _abortController: abortCtrl
  };
}

// Module-scoped dependency injection bindings initialized from standard Three.js
let Loader = THREE.Loader;
let LoaderUtils = THREE.LoaderUtils;
let FileLoader = THREE.FileLoader;
let TextureLoader = THREE.TextureLoader;
let ImageBitmapLoader = THREE.ImageBitmapLoader;
let InstancedBufferAttribute = THREE.InstancedBufferAttribute;
let PropertyBinding = THREE.PropertyBinding;
let Vector2 = THREE.Vector2;
let Vector3 = THREE.Vector3;
let Quaternion = THREE.Quaternion;
let Matrix4 = THREE.Matrix4;
let Color = THREE.Color;
let Sphere = THREE.Sphere;
let Box3 = THREE.Box3;
let MathUtils = THREE.MathUtils;
let BufferGeometry = THREE.BufferGeometry;
let BufferAttribute = THREE.BufferAttribute;
let InterleavedBuffer = THREE.InterleavedBuffer;
let InterleavedBufferAttribute = THREE.InterleavedBufferAttribute;
let Object3D = THREE.Object3D;
let Group = THREE.Group;
let Mesh = THREE.Mesh;
let SkinnedMesh = THREE.SkinnedMesh;
let InstancedMesh = THREE.InstancedMesh;
let Points = THREE.Points;
let Line = THREE.Line;
let LineSegments = THREE.LineSegments;
let LineLoop = THREE.LineLoop;
let Bone = THREE.Bone;
let Skeleton = THREE.Skeleton;
let Material = THREE.Material;
let MeshStandardMaterial = THREE.MeshStandardMaterial;
let MeshPhysicalMaterial = THREE.MeshPhysicalMaterial;
let MeshBasicMaterial = THREE.MeshBasicMaterial;
let PointsMaterial = THREE.PointsMaterial;
let LineBasicMaterial = THREE.LineBasicMaterial;
let PointLight = THREE.PointLight;
let DirectionalLight = THREE.DirectionalLight;
let SpotLight = THREE.SpotLight;
let PerspectiveCamera = THREE.PerspectiveCamera;
let OrthographicCamera = THREE.OrthographicCamera;
let Texture = THREE.Texture;
let AnimationClip = THREE.AnimationClip;
let NumberKeyframeTrack = THREE.NumberKeyframeTrack;
let QuaternionKeyframeTrack = THREE.QuaternionKeyframeTrack;
let VectorKeyframeTrack = THREE.VectorKeyframeTrack;
let Interpolant = THREE.Interpolant;
let ColorManagement = THREE.ColorManagement || { workingColorSpace: LinearSRGBColorSpace };
let toTrianglesDrawModeHelper = toTrianglesDrawMode;
let cloneSkinnedMeshHelper = cloneSkinnedMesh;

let gltfThreeContext = {
  Object3D: null,
  Loader: null,
  LoaderUtils: null,
  FileLoader: null,
  TextureLoader: null,
  ImageBitmapLoader: null,
  DefaultLoadingManager: null,
  Group: null,
  Mesh: null,
  SkinnedMesh: null,
  InstancedMesh: null,
  Points: null,
  Line: null,
  LineSegments: null,
  LineLoop: null,
  Bone: null,
  Skeleton: null,
  BufferGeometry: null,
  BufferAttribute: null,
  InstancedBufferAttribute: null,
  InterleavedBuffer: null,
  InterleavedBufferAttribute: null,
  Material: null,
  MeshStandardMaterial: null,
  MeshPhysicalMaterial: null,
  MeshBasicMaterial: null,
  PointsMaterial: null,
  LineBasicMaterial: null,
  PointLight: null,
  DirectionalLight: null,
  SpotLight: null,
  PerspectiveCamera: null,
  OrthographicCamera: null,
  Texture: null,
  Vector2: null,
  Vector3: null,
  Matrix4: null,
  Quaternion: null,
  Color: null,
  Sphere: null,
  Box3: null,
  MathUtils: null,
  AnimationClip: null,
  Interpolant: null,
  NumberKeyframeTrack: null,
  QuaternionKeyframeTrack: null,
  VectorKeyframeTrack: null,
  ColorManagement: null,
  toTrianglesDrawMode: null,
  cloneSkinnedMesh: null
};

export function setGLTFLoaderThreeContext(ctx) {
  if (!ctx) return;
  const descriptors = Object.getOwnPropertyDescriptors(ctx);
  Object.defineProperties(gltfThreeContext, descriptors);

  if (ctx.Loader) {
    Loader = ctx.Loader;
    try {
      Object.setPrototypeOf(GLTFLoader.prototype, ctx.Loader.prototype);
      Object.setPrototypeOf(GLTFLoader, ctx.Loader);
    } catch(e) {}
  }
  if (ctx.LoaderUtils) LoaderUtils = ctx.LoaderUtils;
  if (ctx.FileLoader) FileLoader = ctx.FileLoader;
  if (ctx.TextureLoader) TextureLoader = ctx.TextureLoader;
  if (ctx.ImageBitmapLoader) ImageBitmapLoader = ctx.ImageBitmapLoader;
  if (ctx.PropertyBinding) PropertyBinding = ctx.PropertyBinding;
  if (ctx.InstancedBufferAttribute) InstancedBufferAttribute = ctx.InstancedBufferAttribute;
  if (ctx.Vector2) Vector2 = ctx.Vector2;
  if (ctx.Vector3) Vector3 = ctx.Vector3;
  if (ctx.Quaternion) Quaternion = ctx.Quaternion;
  if (ctx.Matrix4) Matrix4 = ctx.Matrix4;
  if (ctx.Color) Color = ctx.Color;
  if (ctx.Sphere) Sphere = ctx.Sphere;
  if (ctx.Box3) Box3 = ctx.Box3;
  if (ctx.MathUtils) MathUtils = ctx.MathUtils;
  if (ctx.BufferGeometry) BufferGeometry = ctx.BufferGeometry;
  if (ctx.BufferAttribute) BufferAttribute = ctx.BufferAttribute;
  if (ctx.InterleavedBuffer) InterleavedBuffer = ctx.InterleavedBuffer;
  if (ctx.InterleavedBufferAttribute) InterleavedBufferAttribute = ctx.InterleavedBufferAttribute;
  if (ctx.Object3D) Object3D = ctx.Object3D;
  if (ctx.Group) Group = ctx.Group;
  if (ctx.Mesh) Mesh = ctx.Mesh;
  if (ctx.SkinnedMesh) SkinnedMesh = ctx.SkinnedMesh;
  if (ctx.InstancedMesh) InstancedMesh = ctx.InstancedMesh;
  if (ctx.Points) Points = ctx.Points;
  if (ctx.Line) Line = ctx.Line;
  if (ctx.LineSegments) LineSegments = ctx.LineSegments;
  if (ctx.LineLoop) LineLoop = ctx.LineLoop;
  if (ctx.Bone) Bone = ctx.Bone;
  if (ctx.Skeleton) Skeleton = ctx.Skeleton;
  if (ctx.Material) Material = ctx.Material;
  if (ctx.MeshStandardMaterial) MeshStandardMaterial = ctx.MeshStandardMaterial;
  if (ctx.MeshPhysicalMaterial) MeshPhysicalMaterial = ctx.MeshPhysicalMaterial;
  if (ctx.MeshBasicMaterial) MeshBasicMaterial = ctx.MeshBasicMaterial;
  if (ctx.PointsMaterial) PointsMaterial = ctx.PointsMaterial;
  if (ctx.LineBasicMaterial) LineBasicMaterial = ctx.LineBasicMaterial;
  if (ctx.PointLight) PointLight = ctx.PointLight;
  if (ctx.DirectionalLight) DirectionalLight = ctx.DirectionalLight;
  if (ctx.SpotLight) SpotLight = ctx.SpotLight;
  if (ctx.PerspectiveCamera) PerspectiveCamera = ctx.PerspectiveCamera;
  if (ctx.OrthographicCamera) OrthographicCamera = ctx.OrthographicCamera;
  if (ctx.Texture) Texture = ctx.Texture;
  if (ctx.AnimationClip) AnimationClip = ctx.AnimationClip;
  if (ctx.Interpolant) {
    Interpolant = ctx.Interpolant;
    try {
      Object.setPrototypeOf(GLTFCubicSplineInterpolant.prototype, ctx.Interpolant.prototype);
      Object.setPrototypeOf(GLTFCubicSplineInterpolant, ctx.Interpolant);
    } catch(e) {}
  }
  if (ctx.NumberKeyframeTrack) NumberKeyframeTrack = ctx.NumberKeyframeTrack;
  if (ctx.QuaternionKeyframeTrack) QuaternionKeyframeTrack = ctx.QuaternionKeyframeTrack;
  if (ctx.VectorKeyframeTrack) VectorKeyframeTrack = ctx.VectorKeyframeTrack;
  if (ctx.ColorManagement) ColorManagement = ctx.ColorManagement;
  if (ctx.toTrianglesDrawMode) toTrianglesDrawModeHelper = ctx.toTrianglesDrawMode;
  if (ctx.cloneSkinnedMesh) cloneSkinnedMeshHelper = ctx.cloneSkinnedMesh;
}

export function resolveGLTFContext() {
  return {
    Loader,
    LoaderUtils,
    FileLoader,
    TextureLoader,
    ImageBitmapLoader,
    DefaultLoadingManager: gltfThreeContext.DefaultLoadingManager || createDefaultLoadingManager(),
    Vector2,
    Vector3,
    Quaternion,
    Matrix4,
    Color,
    Sphere,
    Box3,
    MathUtils,
    BufferGeometry,
    BufferAttribute,
    InstancedBufferAttribute,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    Object3D,
    Group,
    Mesh,
    SkinnedMesh,
    InstancedMesh,
    Points,
    Line,
    LineSegments,
    LineLoop,
    Bone,
    Skeleton,
    Material,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    MeshBasicMaterial,
    PointsMaterial,
    LineBasicMaterial,
    PointLight,
    DirectionalLight,
    SpotLight,
    PerspectiveCamera,
    OrthographicCamera,
    Texture,
    AnimationClip,
    Interpolant,
    NumberKeyframeTrack,
    QuaternionKeyframeTrack,
    VectorKeyframeTrack,
    ColorManagement,
    toTrianglesDrawMode: toTrianglesDrawModeHelper,
    cloneSkinnedMesh: cloneSkinnedMeshHelper,
    RepeatWrapping,
    ClampToEdgeWrapping,
    MirroredRepeatWrapping,
    NearestFilter,
    NearestMipmapNearestFilter,
    NearestMipmapLinearFilter,
    LinearFilter,
    LinearMipmapNearestFilter,
    LinearMipmapLinearFilter,
    InterpolateDiscrete,
    InterpolateLinear,
    DoubleSide,
    SRGBColorSpace,
    LinearSRGBColorSpace,
    BINARY_HEADER_MAGIC,
    BINARY_HEADER_LENGTH,
    BINARY_CHUNK_TYPES,
    TrianglesDrawMode,
    TriangleStripDrawMode,
    TriangleFanDrawMode
  };
}

// ----------------------------------------------------------------------------
// Core GLTFLoader Implementation (extracted from CarSoccerEngine lines 18255-19726)
// ----------------------------------------------------------------------------
class GLTFLoader extends Loader {
  constructor(manager) {
    super(manager);
    this.dracoLoader = null;
    this.ktx2Loader = null;
    this.meshoptDecoder = null;
    this.pluginCallbacks = [];

    this.register(parser => new GLTFMaterialsClearcoatExtension(parser));
    this.register(parser => new GLTFMaterialsDispersionExtension(parser));
    this.register(parser => new GLTFTextureBasisUExtension(parser));
    this.register(parser => new GLTFTextureWebPExtension(parser));
    this.register(parser => new GLTFTextureAVIFExtension(parser));
    this.register(parser => new GLTFMaterialsSheenExtension(parser));
    this.register(parser => new GLTFMaterialsTransmissionExtension(parser));
    this.register(parser => new GLTFMaterialsVolumeExtension(parser));
    this.register(parser => new GLTFMaterialsIorExtension(parser));
    this.register(parser => new GLTFMaterialsEmissiveStrengthExtension(parser));
    this.register(parser => new GLTFMaterialsSpecularExtension(parser));
    this.register(parser => new GLTFMaterialsIridescenceExtension(parser));
    this.register(parser => new GLTFMaterialsAnisotropyExtension(parser));
    this.register(parser => new GLTFMaterialsBumpExtension(parser));
    this.register(parser => new GLTFLightsExtension(parser));
    this.register(parser => new GLTFMeshoptCompressionExtension(parser, EXTENSIONS.EXT_MESHOPT_COMPRESSION));
    this.register(parser => new GLTFMeshoptCompressionExtension(parser, EXTENSIONS.KHR_MESHOPT_COMPRESSION));
    this.register(parser => new GLTFMeshGpuInstancing(parser));
  }

  load(url, onLoad, onProgress, onError) {
    const scope = this;
    let resourcePath;
    if (this.resourcePath !== "") {
      resourcePath = this.resourcePath;
    } else if (this.path !== "") {
      const baseURL = LoaderUtils.extractUrlBase(url);
      resourcePath = LoaderUtils.resolveURL(baseURL, this.path);
    } else {
      resourcePath = LoaderUtils.extractUrlBase(url);
    }

    this.manager.itemStart(url);

    const failureCallback = function(err) {
      if (onError) onError(err);
      else console.error(err);
      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    };

    const fileLoader = new FileLoader(this.manager);
    fileLoader.setPath(this.path);
    fileLoader.setResponseType("arraybuffer");
    fileLoader.setRequestHeader(this.requestHeader);
    fileLoader.setWithCredentials(this.withCredentials);

    fileLoader.load(
      url,
      function(data) {
        try {
          scope.parse(
            data,
            resourcePath,
            function(gltf) {
              if (onLoad) onLoad(gltf);
              scope.manager.itemEnd(url);
            },
            failureCallback
          );
        } catch (err) {
          failureCallback(err);
        }
      },
      onProgress,
      failureCallback
    );
  }

  setDRACOLoader(dracoLoader) {
    this.dracoLoader = dracoLoader;
    return this;
  }

  setKTX2Loader(ktx2Loader) {
    this.ktx2Loader = ktx2Loader;
    return this;
  }

  setMeshoptDecoder(meshoptDecoder) {
    this.meshoptDecoder = meshoptDecoder;
    return this;
  }

  register(callback) {
    if (this.pluginCallbacks.indexOf(callback) === -1) {
      this.pluginCallbacks.push(callback);
    }
    return this;
  }

  unregister(callback) {
    const index = this.pluginCallbacks.indexOf(callback);
    if (index !== -1) {
      this.pluginCallbacks.splice(index, 1);
    }
    return this;
  }

  parse(data, path, onLoad, onError) {
    let json;
    const extensions = {};
    const plugins = {};
    const textDecoder = new TextDecoder();

    if (typeof data === "string") {
      json = JSON.parse(data);
    } else if (data instanceof ArrayBuffer) {
      if (textDecoder.decode(new Uint8Array(data, 0, 4)) === BINARY_HEADER_MAGIC) {
        try {
          extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data);
        } catch (err) {
          if (onError) onError(err);
          return;
        }
        json = JSON.parse(extensions[EXTENSIONS.KHR_BINARY_GLTF].content);
      } else {
        json = JSON.parse(textDecoder.decode(data));
      }
    } else {
      json = data;
    }

    if (json.asset === undefined || json.asset.version[0] < 2) {
      if (onError) onError(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));
      return;
    }

    const parser = new GLTFParser(json, {
      path: path || this.resourcePath || "",
      crossOrigin: this.crossOrigin,
      requestHeader: this.requestHeader,
      manager: this.manager,
      ktx2Loader: this.ktx2Loader,
      meshoptDecoder: this.meshoptDecoder
    });
    parser.fileLoader.setRequestHeader(this.requestHeader);

    for (let i = 0; i < this.pluginCallbacks.length; i++) {
      const plugin = this.pluginCallbacks[i](parser);
      if (!plugin.name) {
        console.error("THREE.GLTFLoader: Invalid plugin found: missing name");
      }
      plugins[plugin.name] = plugin;
      extensions[plugin.name] = true;
    }

    if (json.extensionsUsed) {
      for (let i = 0; i < json.extensionsUsed.length; ++i) {
        const extName = json.extensionsUsed[i];
        const extensionsRequired = json.extensionsRequired || [];
        switch (extName) {
          case EXTENSIONS.KHR_MATERIALS_UNLIT:
            extensions[extName] = new GLTFMaterialsUnlitExtension();
            break;
          case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
            extensions[extName] = new GLTFDracoMeshCompressionExtension(json, this.dracoLoader);
            break;
          case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
            extensions[extName] = new GLTFTextureTransformExtension();
            break;
          case EXTENSIONS.KHR_MESH_QUANTIZATION:
            extensions[extName] = new GLTFMeshQuantizationExtension();
            break;
          default:
            if (extensionsRequired.indexOf(extName) >= 0 && plugins[extName] === undefined) {
              console.warn('THREE.GLTFLoader: Unknown extension "' + extName + '".');
            }
        }
      }
    }

    parser.setExtensions(extensions);
    parser.setPlugins(plugins);
    parser.parse(onLoad, onError);
  }

  parseAsync(data, path) {
    const scope = this;
    return new Promise(function(resolve, reject) {
      scope.parse(data, path, resolve, reject);
    });
  }
}
/**
 * In-memory key-value cache with set, get, add, remove, and removeAll capabilities.
 */
function createCache() {
  let store = {};
  return {
    get(key) {
      return store[key];
    },
    add(key, value) {
      store[key] = value;
    },
    set(key, value) {
      store[key] = value;
    },
    remove(key) {
      delete store[key];
    },
    removeAll() {
      store = {};
    }
  };
}
/**
 * Extracts material extension configuration from GLTF material JSON.
 * @param {object} parser GLTF parser instance
 * @param {number} materialIndex Material index
 * @param {string} extensionName Extension identifier string
 * @returns {object | null}
 */
function getMaterialExtension(parser, materialIndex, extensionName) {
  const materialDef = parser.json.materials && parser.json.materials[materialIndex];
  return (materialDef && materialDef.extensions && materialDef.extensions[extensionName])
    ? materialDef.extensions[extensionName]
    : null;
}
export const EXTENSIONS = {
  KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"
};
class GLTFLightsExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;
    this.cache = {
      refs: {},
      uses: {}
    };
  }

  _markDefs() {
    const parser = this.parser;
    const nodes = parser.json.nodes || [];
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      if (node.extensions && node.extensions[this.name] && node.extensions[this.name].light !== undefined) {
        parser._addNodeRef(this.cache, node.extensions[this.name].light);
      }
    }
  }

  _loadLight(lightIndex) {
    const parser = this.parser;
    const cacheKey = "light:" + lightIndex;
    let promise = parser.cache.get(cacheKey);
    if (promise) return promise;

    const json = parser.json;
    const extensions = (json.extensions && json.extensions[this.name]) || {};
    const lightDef = ((extensions.lights) || [])[lightIndex];
    let light;
    const color = new Color(0xffffff);
    if (lightDef.color !== undefined) {
      color.setRGB(lightDef.color[0], lightDef.color[1], lightDef.color[2]);
    }
    const range = lightDef.range !== undefined ? lightDef.range : 0;
    switch (lightDef.type) {
      case "directional":
        light = new DirectionalLight(color);
        light.target.position.set(0, 0, -1);
        light.add(light.target);
        break;
      case "point":
        light = new PointLight(color);
        light.distance = range;
        break;
      case "spot":
        light = new SpotLight(color);
        light.distance = range;
        lightDef.spot = lightDef.spot || {};
        lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
        lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4;
        light.angle = lightDef.spot.outerConeAngle;
        light.penumbra = 1 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
        light.target.position.set(0, 0, -1);
        light.add(light.target);
        break;
      default:
        throw new Error("THREE.GLTFLoader: Unexpected light type: " + lightDef.type);
    }
    light.position.set(0, 0, 0);
    assignExtras(light, lightDef);
    if (lightDef.intensity !== undefined) light.intensity = lightDef.intensity;
    light.name = parser.createUniqueName(lightDef.name || "light_" + lightIndex);
    promise = Promise.resolve(light);
    parser.cache.add(cacheKey, promise);
    return promise;
  }

  getDependency(type, index) {
    if (type === "light") return this._loadLight(index);
  }

  createNodeAttachment(nodeIndex) {
    const scope = this;
    const parser = this.parser;
    const nodeDef = parser.json.nodes[nodeIndex];
    const lightIndex = (nodeDef.extensions && nodeDef.extensions[this.name] || {}).light;
    return lightIndex === undefined ? null : this._loadLight(lightIndex).then(function(light) {
      return parser._getNodeRef(scope.cache, lightIndex, light);
    });
  }
}

class GLTFMaterialsUnlitExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;
  }
  getMaterialType() {
    return MeshBasicMaterial;
  }
  extendParams(materialParams, materialDef, parser) {
    const pending = [];
    materialParams.color = new Color(1, 1, 1);
    materialParams.opacity = 1;
    const pbrMetallicRoughness = materialDef.pbrMetallicRoughness;
    if (pbrMetallicRoughness) {
      if (Array.isArray(pbrMetallicRoughness.baseColorFactor)) {
        const factor = pbrMetallicRoughness.baseColorFactor;
        materialParams.color.setRGB(factor[0], factor[1], factor[2], LinearSRGBColorSpace);
        materialParams.opacity = factor[3];
      }
      if (pbrMetallicRoughness.baseColorTexture !== undefined) {
        pending.push(parser.assignTexture(materialParams, "map", pbrMetallicRoughness.baseColorTexture, SRGBColorSpace));
      }
    }
    return Promise.all(pending);
  }

}
class GLTFMaterialsEmissiveStrengthExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext !== null && ext.emissiveStrength !== void 0) {
      materialParams.emissiveIntensity = ext.emissiveStrength;
    }
    return Promise.resolve();
  }
}

class GLTFMaterialsClearcoatExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    if (ext.clearcoatFactor !== void 0) {
      materialParams.clearcoat = ext.clearcoatFactor;
    }
    if (ext.clearcoatTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "clearcoatMap", ext.clearcoatTexture));
    }
    if (ext.clearcoatRoughnessFactor !== void 0) {
      materialParams.clearcoatRoughness = ext.clearcoatRoughnessFactor;
    }
    if (ext.clearcoatRoughnessTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "clearcoatRoughnessMap", ext.clearcoatRoughnessTexture));
    }
    if (ext.clearcoatNormalTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "clearcoatNormalMap", ext.clearcoatNormalTexture));
      if (ext.clearcoatNormalTexture.scale !== void 0) {
        const scale = ext.clearcoatNormalTexture.scale;
        materialParams.clearcoatNormalScale = new Vector2(scale, scale);
      }
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsDispersionExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_DISPERSION;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext !== null) {
      materialParams.dispersion = ext.dispersion !== void 0 ? ext.dispersion : 0;
    }
    return Promise.resolve();
  }
}

class GLTFMaterialsIridescenceExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_IRIDESCENCE;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    if (ext.iridescenceFactor !== void 0) {
      materialParams.iridescence = ext.iridescenceFactor;
    }
    if (ext.iridescenceTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "iridescenceMap", ext.iridescenceTexture));
    }
    if (ext.iridescenceIor !== void 0) {
      materialParams.iridescenceIOR = ext.iridescenceIor;
    }
    if (materialParams.iridescenceThicknessRange === void 0) {
      materialParams.iridescenceThicknessRange = [100, 400];
    }
    if (ext.iridescenceThicknessMinimum !== void 0) {
      materialParams.iridescenceThicknessRange[0] = ext.iridescenceThicknessMinimum;
    }
    if (ext.iridescenceThicknessMaximum !== void 0) {
      materialParams.iridescenceThicknessRange[1] = ext.iridescenceThicknessMaximum;
    }
    if (ext.iridescenceThicknessTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "iridescenceThicknessMap", ext.iridescenceThicknessTexture));
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsSheenExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_SHEEN;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    materialParams.sheenColor = new Color(0, 0, 0);
    materialParams.sheenRoughness = 0;
    materialParams.sheen = 1;
    if (ext.sheenColorFactor !== void 0) {
      const sc = ext.sheenColorFactor;
      materialParams.sheenColor.setRGB(sc[0], sc[1], sc[2], LinearSRGBColorSpace);
    }
    if (ext.sheenRoughnessFactor !== void 0) {
      materialParams.sheenRoughness = ext.sheenRoughnessFactor;
    }
    if (ext.sheenColorTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "sheenColorMap", ext.sheenColorTexture, SRGBColorSpace));
    }
    if (ext.sheenRoughnessTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "sheenRoughnessMap", ext.sheenRoughnessTexture));
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsTransmissionExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    if (ext.transmissionFactor !== void 0) {
      materialParams.transmission = ext.transmissionFactor;
    }
    if (ext.transmissionTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "transmissionMap", ext.transmissionTexture));
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsVolumeExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_VOLUME;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    materialParams.thickness = ext.thicknessFactor !== void 0 ? ext.thicknessFactor : 0;
    if (ext.thicknessTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "thicknessMap", ext.thicknessTexture));
    }
    materialParams.attenuationDistance = ext.attenuationDistance || Infinity;
    const ac = ext.attenuationColor || [1, 1, 1];
    materialParams.attenuationColor = new Color().setRGB(ac[0], ac[1], ac[2], LinearSRGBColorSpace);
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsIorExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_IOR;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext !== null) {
      materialParams.ior = ext.ior !== void 0 ? ext.ior : 1.5;
      if (materialParams.ior === 0) materialParams.ior = 1000;
    }
    return Promise.resolve();
  }
}

class GLTFMaterialsSpecularExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    materialParams.specularIntensity = ext.specularFactor !== void 0 ? ext.specularFactor : 1;
    if (ext.specularTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "specularIntensityMap", ext.specularTexture));
    }
    const sc = ext.specularColorFactor || [1, 1, 1];
    materialParams.specularColor = new Color().setRGB(sc[0], sc[1], sc[2], LinearSRGBColorSpace);
    if (ext.specularColorTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "specularColorMap", ext.specularColorTexture, SRGBColorSpace));
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsBumpExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_MATERIALS_BUMP;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    materialParams.bumpScale = ext.bumpFactor !== void 0 ? ext.bumpFactor : 1;
    if (ext.bumpTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "bumpMap", ext.bumpTexture));
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFMaterialsAnisotropyExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_ANISOTROPY;
  }
  getMaterialType(materialIndex) {
    return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const ext = getMaterialExtension(this.parser, materialIndex, this.name);
    if (ext === null) return Promise.resolve();
    const pendingPromises = [];
    if (ext.anisotropyStrength !== void 0) {
      materialParams.anisotropy = ext.anisotropyStrength;
    }
    if (ext.anisotropyRotation !== void 0) {
      materialParams.anisotropyRotation = ext.anisotropyRotation;
    }
    if (ext.anisotropyTexture !== void 0) {
      pendingPromises.push(this.parser.assignTexture(materialParams, "anisotropyMap", ext.anisotropyTexture));
    }
    return Promise.all(pendingPromises);
  }
}

class GLTFTextureBasisUExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_TEXTURE_BASISU;
  }
  loadTexture(textureIndex) {
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[this.name]) return null;
    const ext = textureDef.extensions[this.name];
    const ktx2Loader = parser.options.ktx2Loader;
    if (!ktx2Loader) {
      if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) {
        throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");
      }
      return null;
    }
    return parser.loadTextureImage(textureIndex, ext.source, ktx2Loader);
  }
}

class GLTFTextureWebPExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
  }
  loadTexture(textureIndex) {
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[this.name]) return null;
    const ext = textureDef.extensions[this.name];
    const imageDef = json.images[ext.source];
    let loader = parser.textureLoader;
    if (imageDef.uri) {
      const handler = parser.options.manager.getHandler(imageDef.uri);
      if (handler !== null) loader = handler;
    }
    return parser.loadTextureImage(textureIndex, ext.source, loader);
  }
}

class GLTFTextureAVIFExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_TEXTURE_AVIF;
  }
  loadTexture(textureIndex) {
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[this.name]) return null;
    const ext = textureDef.extensions[this.name];
    const imageDef = json.images[ext.source];
    let loader = parser.textureLoader;
    if (imageDef.uri) {
      const handler = parser.options.manager.getHandler(imageDef.uri);
      if (handler !== null) loader = handler;
    }
    return parser.loadTextureImage(textureIndex, ext.source, loader);
  }
}

class GLTFMeshoptCompressionExtension {
  constructor(parser, name) {
    this.parser = parser;
    this.name = name;
  }
  loadBufferView(bufferViewIndex) {
    const json = this.parser.json;
    const bufferViewDef = json.bufferViews[bufferViewIndex];
    if (bufferViewDef.extensions && bufferViewDef.extensions[this.name]) {
      const ext = bufferViewDef.extensions[this.name];
      const bufferPromise = this.parser.getDependency("buffer", ext.buffer);
      const meshoptDecoder = this.parser.options.meshoptDecoder;
      if (!meshoptDecoder || !meshoptDecoder.supported) {
        if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) {
          throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");
        }
        return null;
      }
      return bufferPromise.then((buffer) => {
        const byteOffset = ext.byteOffset || 0;
        const byteLength = ext.byteLength || 0;
        const count = ext.count;
        const byteStride = ext.byteStride;
        const source = new Uint8Array(buffer, byteOffset, byteLength);
        if (meshoptDecoder.decodeGltfBufferAsync) {
          return meshoptDecoder.decodeGltfBufferAsync(count, byteStride, source, ext.mode, ext.filter).then((res) => res.buffer);
        }
        return meshoptDecoder.ready.then(() => {
          const target = new ArrayBuffer(count * byteStride);
          meshoptDecoder.decodeGltfBuffer(new Uint8Array(target), count, byteStride, source, ext.mode, ext.filter);
          return target;
        });
      });
    }
    return null;
  }
}

class GLTFMeshGpuInstancing {
  constructor(parser) {
    this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING;
    this.parser = parser;
  }

  createNodeMesh(nodeIndex) {
    const json = this.parser.json;
    const nodeDef = json.nodes[nodeIndex];
    if (!nodeDef.extensions || !nodeDef.extensions[this.name] || nodeDef.mesh === undefined) return null;

    const meshDef = json.meshes[nodeDef.mesh];
    for (const prim of meshDef.primitives) {
      if (prim.mode !== WEBGL_CONSTANTS.TRIANGLES && prim.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP && prim.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN && prim.mode !== undefined) {
        return null;
      }
    }

    const instancingExt = nodeDef.extensions[this.name];
    const attributes = instancingExt.attributes;
    const pending = [];
    const resolvedAttributes = {};

    for (const attrName in attributes) {
      pending.push(this.parser.getDependency("accessor", attributes[attrName]).then(accessor => {
        resolvedAttributes[attrName] = accessor;
        return accessor;
      }));
    }

    if (pending.length < 1) return null;
    pending.push(this.parser.createNodeMesh(nodeIndex));

    return Promise.all(pending).then(results => {
      const baseMesh = results.pop();
      const children = baseMesh.isGroup ? baseMesh.children : [baseMesh];
      const count = results[0].count;
      const instancedMeshes = [];

      for (const child of children) {
        const matrix = new Matrix4();
        const translation = new Vector3();
        const rotation = new Quaternion();
        const scale = new Vector3(1, 1, 1);
        const instancedMesh = new InstancedMesh(child.geometry, child.material, count);

        for (let i = 0; i < count; i++) {
          if (resolvedAttributes.TRANSLATION) translation.fromBufferAttribute(resolvedAttributes.TRANSLATION, i);
          if (resolvedAttributes.ROTATION) rotation.fromBufferAttribute(resolvedAttributes.ROTATION, i);
          if (resolvedAttributes.SCALE) scale.fromBufferAttribute(resolvedAttributes.SCALE, i);
          instancedMesh.setMatrixAt(i, matrix.compose(translation, rotation, scale));
        }

        for (const attrName in resolvedAttributes) {
          if (attrName === "_COLOR_0") {
            const colorAttr = resolvedAttributes[attrName];
            instancedMesh.instanceColor = new BufferAttribute(colorAttr.array, colorAttr.itemSize, colorAttr.normalized);
          } else if (attrName !== "TRANSLATION" && attrName !== "ROTATION" && attrName !== "SCALE") {
            child.geometry.setAttribute(attrName, resolvedAttributes[attrName]);
          }
        }

        Object3D.prototype.copy.call(instancedMesh, child);
        this.parser.assignFinalMaterial(instancedMesh);
        instancedMeshes.push(instancedMesh);
      }

      return baseMesh.isGroup ? (baseMesh.clear(), baseMesh.add(...instancedMeshes), baseMesh) : instancedMeshes[0];
    });
  }
}

class GLTFBinaryExtension {
  constructor(data) {
    this.name = EXTENSIONS.KHR_BINARY_GLTF;
    this.content = null;
    this.body = null;
    const headerView = new DataView(data, 0, BINARY_HEADER_LENGTH);
    const textDecoder = new TextDecoder();
    this.header = {
      magic: textDecoder.decode(new Uint8Array(data.slice(0, 4))),
      version: headerView.getUint32(4, true),
      length: headerView.getUint32(8, true)
    };
    if (this.header.magic !== BINARY_HEADER_MAGIC) {
      throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");
    }
    if (this.header.version < 2) {
      throw new Error("THREE.GLTFLoader: Legacy binary file detected.");
    }
    const chunkLength = this.header.length - BINARY_HEADER_LENGTH;
    const chunkView = new DataView(data, BINARY_HEADER_LENGTH);
    let chunkOffset = 0;
    while (chunkOffset < chunkLength) {
      const chunkDataLength = chunkView.getUint32(chunkOffset, true);
      chunkOffset += 4;
      const chunkType = chunkView.getUint32(chunkOffset, true);
      chunkOffset += 4;
      if (chunkType === BINARY_CHUNK_TYPES.JSON) {
        const jsonSlice = new Uint8Array(data, BINARY_HEADER_LENGTH + chunkOffset, chunkDataLength);
        this.content = textDecoder.decode(jsonSlice);
      } else if (chunkType === BINARY_CHUNK_TYPES.BIN) {
        const binOffset = BINARY_HEADER_LENGTH + chunkOffset;
        this.body = data.slice(binOffset, binOffset + chunkDataLength);
      }
      chunkOffset += chunkDataLength;
    }
    if (this.content === null) {
      throw new Error("THREE.GLTFLoader: JSON content not found.");
    }
  }
}
class GLTFDracoMeshCompressionExtension {
  constructor(json, dracoLoader) {
    if (!dracoLoader) throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");
    this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
    this.json = json;
    this.dracoLoader = dracoLoader;
    this.dracoLoader.preload();
  }

  decodePrimitive(primitive, parser) {
    const json = this.json;
    const dracoLoader = this.dracoLoader;
    const dracoExt = primitive.extensions[this.name];
    const bufferViewIndex = dracoExt.bufferView;
    const attributes = dracoExt.attributes;
    const attributeMap = {};
    const normalizedMap = {};
    const componentTypeMap = {};

    for (const attrName in attributes) {
      const standardName = ATTRIBUTES[attrName] || attrName.toLowerCase();
      attributeMap[standardName] = attributes[attrName];
    }

    for (const attrName in primitive.attributes) {
      const standardName = ATTRIBUTES[attrName] || attrName.toLowerCase();
      if (attributes[attrName] !== undefined) {
        const accessorDef = json.accessors[primitive.attributes[attrName]];
        const componentType = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
        componentTypeMap[standardName] = componentType.name;
        normalizedMap[standardName] = accessorDef.normalized === true;
      }
    }

    return parser.getDependency("bufferView", bufferViewIndex).then(function(bufferView) {
      return new Promise(function(resolve, reject) {
        dracoLoader.decodeDracoFile(
          bufferView,
          function(decodedGeometry) {
            for (const attrName in decodedGeometry.attributes) {
              const attr = decodedGeometry.attributes[attrName];
              const normalized = normalizedMap[attrName];
              if (normalized !== undefined) {
                attr.normalized = normalized;
              }
            }
            resolve(decodedGeometry);
          },
          attributeMap,
          componentTypeMap,
          LinearSRGBColorSpace,
          reject
        );
      });
    });
  }
}

class GLTFTextureTransformExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;
  }

  extendTexture(texture, transform) {
    if (
      (transform.texCoord === undefined || transform.texCoord === texture.channel) &&
      transform.offset === undefined &&
      transform.rotation === undefined &&
      transform.scale === undefined
    ) {
      return texture;
    }

    const cloned = texture.clone();
    if (transform.texCoord !== undefined) {
      cloned.channel = transform.texCoord;
    }
    if (transform.offset !== undefined) {
      cloned.offset.fromArray(transform.offset);
    }
    if (transform.rotation !== undefined) {
      cloned.rotation = transform.rotation;
    }
    if (transform.scale !== undefined) {
      cloned.repeat.fromArray(transform.scale);
    }
    cloned.needsUpdate = true;
    return cloned;
  }
}

class GLTFMeshQuantizationExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;
  }
}

class GLTFCubicSplineInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }

  copySampleValue_(index) {
    const result = this.resultBuffer;
    const values = this.sampleValues;
    const stride = this.valueSize;
    const offset = index * stride * 3 + stride;
    for (let i = 0; i !== stride; i++) {
      result[i] = values[offset + i];
    }
    return result;
  }

  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer;
    const values = this.sampleValues;
    const stride = this.valueSize;
    const stride2 = stride * 2;
    const stride3 = stride * 3;
    const dt = t1 - t0;
    const p = (t - t0) / dt;
    const pp = p * p;
    const ppp = pp * p;
    const s1 = i1 * stride3;
    const s0 = s1 - stride3;

    const h00 = 2 * ppp - 3 * pp + 1;
    const h10 = ppp - 2 * pp + p;
    const h01 = -2 * ppp + 3 * pp;
    const h11 = ppp - pp;

    for (let i = 0; i !== stride; i++) {
      const p0 = values[s0 + stride + i];
      const m0 = values[s0 + stride2 + i] * dt;
      const p1 = values[s1 + stride + i];
      const m1 = values[s1 + i] * dt;
      result[i] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    }
    return result;
  }
}

const _quaternion = new Quaternion();
class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant {
  interpolate_(i1, t0, t, t1) {
    const result = super.interpolate_(i1, t0, t, t1);
    return _quaternion.fromArray(result).normalize().toArray(result), result;
  }
}

const WEBGL_CONSTANTS = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6
};
const WEBGL_COMPONENT_TYPES = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array
};
const WEBGL_FILTERS = {
  9728: NearestFilter,
  9729: LinearFilter,
  9984: NearestMipmapNearestFilter,
  9985: LinearMipmapLinearFilter,
  9986: NearestMipmapLinearFilter,
  9987: LinearMipmapNearestFilter
};

const WEBGL_WRAPPINGS = {
  33071: ClampToEdgeWrapping,
  33648: MirroredRepeatWrapping,
  10497: RepeatWrapping
};

const WEBGL_TYPE_SIZES = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};
const ATTRIBUTES = {
  POSITION: "position",
  NORMAL: "normal",
  TANGENT: "tangent",
  TEXCOORD_0: "uv",
  TEXCOORD_1: "uv1",
  TEXCOORD_2: "uv2",
  TEXCOORD_3: "uv3",
  COLOR_0: "color",
  WEIGHTS_0: "skinWeight",
  JOINTS_0: "skinIndex"
};
const PATH_PROPERTIES = {
  scale: "scale",
  translation: "position",
  rotation: "quaternion",
  weights: "morphTargetInfluences"
};
const INTERPOLATION_MODES = {
  CUBICSPLINE: void 0,
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete
};

const ALPHA_MODES = {
  OPAQUE: "OPAQUE",
  MASK: "MASK",
  BLEND: "BLEND"
};
/**
 * Resolves or lazily instantiates the default PBR material for primitives lacking a material definition.
 * @param {object} cache Parser cache object
 * @returns {MeshStandardMaterial}
 */
function getDefaultMaterial(cache) {
  if (cache.DefaultMaterial === undefined) {
    cache.DefaultMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0,
      metalness: 1,
      roughness: 1,
      transparent: false,
      depthTest: true,
      side: FrontSide
    });
  }
  return cache.DefaultMaterial;
}
/**
 * Copies extension properties from GLTF schema to target object's userData.
 * @param {object} extensions Extensions object map
 * @param {object} target Target object with userData
 * @param {object} json GLTF node or root JSON definition
 */
function assignExtensions(extensions, target, json) {
  if (!json || !json.extensions) return;
  for (const extName in json.extensions) {
    if (extensions[extName] === undefined) {
      target.userData = target.userData || {};
      target.userData.gltfExtensions = target.userData.gltfExtensions || {};
      target.userData.gltfExtensions[extName] = json.extensions[extName];
    }
  }
}
/**
 * Transfers extras dictionary from GLTF node/mesh JSON definition to Three.js userData.
 * @param {object} target Target Three.js Object3D, Material, or BufferGeometry
 * @param {object} json GLTF element JSON definition
 */
function assignExtras(target, json) {
  if (json && json.extras !== undefined) {
    if (typeof json.extras === 'object' && json.extras !== null) {
      target.userData = target.userData || {};
      Object.assign(target.userData, json.extras);
    } else {
      console.warn('THREE.GLTFLoader: Ignoring primitive type .extras, ' + json.extras);
    }
  }
}
/**
 * Asynchronously resolves and binds morph target accessors to a BufferGeometry.
 * @param {BufferGeometry} geometry Three.js geometry to bind morph attributes
 * @param {Array<object>} targets GLTF primitive targets array
 * @param {GLTFParser} parser Active GLTFParser instance
 * @returns {Promise<BufferGeometry>}
 */
function buildMorphTargetAttributes(geometry, targets, parser) {
  let hasPosition = false;
  let hasNormal = false;
  let hasColor = false;

  for (let i = 0, len = targets.length; i < len; i++) {
    const target = targets[i];
    if (target.POSITION !== undefined) hasPosition = true;
    if (target.NORMAL !== undefined) hasNormal = true;
    if (target.COLOR_0 !== undefined) hasColor = true;
    if (hasPosition && hasNormal && hasColor) break;
  }

  if (!hasPosition && !hasNormal && !hasColor) {
    return Promise.resolve(geometry);
  }

  const positionPromises = [];
  const normalPromises = [];
  const colorPromises = [];

  for (let i = 0, len = targets.length; i < len; i++) {
    const target = targets[i];
    if (hasPosition) {
      const p = target.POSITION !== undefined
        ? parser.getDependency('accessor', target.POSITION)
        : geometry.attributes.position;
      positionPromises.push(p);
    }
    if (hasNormal) {
      const p = target.NORMAL !== undefined
        ? parser.getDependency('accessor', target.NORMAL)
        : geometry.attributes.normal;
      normalPromises.push(p);
    }
    if (hasColor) {
      const p = target.COLOR_0 !== undefined
        ? parser.getDependency('accessor', target.COLOR_0)
        : geometry.attributes.color;
      colorPromises.push(p);
    }
  }

  return Promise.all([
    Promise.all(positionPromises),
    Promise.all(normalPromises),
    Promise.all(colorPromises)
  ]).then(([positions, normals, colors]) => {
    if (hasPosition) geometry.morphAttributes.position = positions;
    if (hasNormal) geometry.morphAttributes.normal = normals;
    if (hasColor) geometry.morphAttributes.color = colors;
    geometry.morphTargetsRelative = true;
    return geometry;
  });
}
/**
 * Configures morph target influence weights and dictionary mapping on a Mesh.
 * @param {Mesh} mesh Mesh instance with geometry containing morph attributes
 * @param {object} json GLTF mesh JSON definition
 */
function createMorphTargets(mesh, json) {
  if (typeof mesh.updateMorphTargets === 'function') {
    mesh.updateMorphTargets();
  }
  if (json.weights !== undefined) {
    for (let i = 0, len = json.weights.length; i < len; i++) {
      mesh.morphTargetInfluences[i] = json.weights[i];
    }
  }
  if (json.extras && Array.isArray(json.extras.targetNames)) {
    const targetNames = json.extras.targetNames;
    if (mesh.morphTargetInfluences.length === targetNames.length) {
      mesh.morphTargetDictionary = {};
      for (let i = 0, len = targetNames.length; i < len; i++) {
        mesh.morphTargetDictionary[targetNames[i]] = i;
      }
    } else {
      console.warn('THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.');
    }
  }
}
/**
 * Generates a unique string hash key identifying an identical GLTF primitive for geometry caching.
 * @param {object} primitive GLTF primitive definition
 * @returns {string} Unique primitive hash key
 */
function createPrimitiveKey(primitive) {
  let key;
  const dracoExt = primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION];
  if (dracoExt) {
    key = 'draco:' + dracoExt.bufferView + ':' + dracoExt.indices + ':' + hashAttributes(dracoExt.attributes);
  } else {
    key = primitive.indices + ':' + hashAttributes(primitive.attributes) + ':' + primitive.mode;
  }
  if (primitive.targets !== undefined) {
    for (let i = 0, len = primitive.targets.length; i < len; i++) {
      key += ':' + hashAttributes(primitive.targets[i]);
    }
  }
  return key;
}
/**
 * Deterministically sorts and concatenates attribute names and accessor indices into a hash string.
 * @param {Record<string, number>} attributes Map of attribute names to accessor IDs
 * @returns {string}
 */
function hashAttributes(attributes) {
  let hash = '';
  const keys = Object.keys(attributes).sort();
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i];
    hash += key + ':' + attributes[key] + ';';
  }
  return hash;
}
/**
 * Computes normalization multiplier factor for typed buffer component types.
 * @param {Function} componentType TypedArray constructor
 * @returns {number}
 */
function getNormalizedComponentScale(componentType) {
  switch (componentType) {
    case Int8Array:
      return 1 / 127;
    case Uint8Array:
      return 1 / 255;
    case Int16Array:
      return 1 / 32767;
    case Uint16Array:
      return 1 / 65535;
    default:
      throw new Error('THREE.GLTFLoader: Unsupported normalized accessor component type.');
  }
}
/**
 * Detects image MIME type from image URL or base64 data URI.
 * @param {string} url Image URL or data URI
 * @returns {string} MIME type string
 */
function extractUrlMimeType(url) {
  if (url.search(/\.jpe?g($|\?)/i) > 0 || url.search(/^data:image\/jpeg/) === 0) {
    return 'image/jpeg';
  }
  if (url.search(/\.webp($|\?)/i) > 0 || url.search(/^data:image\/webp/) === 0) {
    return 'image/webp';
  }
  if (url.search(/\.ktx2($|\?)/i) > 0 || url.search(/^data:image\/ktx2/) === 0) {
    return 'image/ktx2';
  }
  return 'image/png';
}
const identityMatrix = new Matrix4();
class GLTFParser {
  constructor(json = {}, options = {}) {
    this.json = json;
    this.extensions = {};
    this.plugins = {};
    this.options = options,this.cache = createCache(),this.associations = new Map,this.primitiveCache = {

    }
    ,this.nodeCache = {

    }
    ,this.meshCache = {
      refs:{

      }
      ,uses:{

      }

    }
    ,this.cameraCache = {
      refs:{

      }
      ,uses:{

      }

    }
    ,this.lightCache = {
      refs:{

      }
      ,uses:{

      }

    }
    ,this.sourceCache = {

    }
    ,this.textureCache = {

    }
    ,this.nodeNamesUsed = {

    }
    ;
    let isSafariUserAgent = false, safariVersion = -1, isFirefoxUserAgent = false, firefoxVersion = -1;
    if (typeof navigator !== "undefined" && typeof navigator.userAgent !== "undefined") {
      const ua = navigator.userAgent;
      isSafariUserAgent = /^((?!chrome|android).)*safari/i.test(ua);
      const safariMatch = ua.match(/Version\/(\d+)/);
      safariVersion = isSafariUserAgent && safariMatch ? parseInt(safariMatch[1], 10) : -1;
      isFirefoxUserAgent = ua.indexOf("Firefox") > -1;
      firefoxVersion = isFirefoxUserAgent ? parseInt(ua.match(/Firefox\/([0-9]+)\./)[1], 10) : -1;
    }
    const isSafari = isSafariUserAgent && safariVersion < 17;
    const isFirefox = isFirefoxUserAgent && firefoxVersion < 98;
    const canUseImageBitmap = typeof createImageBitmap !== "undefined" && !isSafari && !isFirefox;
    this.textureLoader = canUseImageBitmap ? new ImageBitmapLoader(this.options.manager) : new TextureLoader(this.options.manager);
    this.textureLoader.setCrossOrigin(this.options.crossOrigin);
    this.textureLoader.setRequestHeader(this.options.requestHeader);
    this.fileLoader = new FileLoader(this.options.manager);
    this.fileLoader.setResponseType("arraybuffer");
    if (this.options.crossOrigin === "use-credentials") {
      this.fileLoader.setWithCredentials(true);
    }
  }

  setExtensions(extensions) {
    this.extensions = extensions;
  }

  setPlugins(plugins) {
    this.plugins = plugins;
  }

  parse(onLoad, onError) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    this.cache.removeAll();
    this.nodeCache = {};

    this._invokeAll(function(plugin) {
      return plugin._markDefs && plugin._markDefs();
    });

    Promise.all(this._invokeAll(function(plugin) {
      return plugin.beforeRoot && plugin.beforeRoot();
    })).then(function() {
      return Promise.all([
        parser.getDependencies("scene"),
        parser.getDependencies("animation"),
        parser.getDependencies("camera")
      ]);
    }).then(function(dependencies) {
      const rootObject = {
        scene: dependencies[0][json.scene || 0],
        scenes: dependencies[0],
        animations: dependencies[1],
        cameras: dependencies[2],
        asset: json.asset,
        parser,
        userData: {}
      };
      assignExtensions(extensions, rootObject, json);
      assignExtras(rootObject, json);
      return Promise.all(parser._invokeAll(function(plugin) {
        return plugin.afterRoot && plugin.afterRoot(rootObject);
      })).then(function() {
        for (const scene of rootObject.scenes) {
          scene.updateMatrixWorld();
        }
        onLoad(rootObject);
      });
    }).catch(onError);
  }

  _markDefs() {
    const nodes = this.json.nodes || [];
    const skins = this.json.skins || [];
    const meshes = this.json.meshes || [];
    for (let i = 0, len = skins.length; i < len; i++) {
      const joints = skins[i].joints;
      for (let j = 0, jLen = joints.length; j < jLen; j++) {
        nodes[joints[j]].isBone = true;
      }
    }
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      if (node.mesh !== undefined) {
        this._addNodeRef(this.meshCache, node.mesh);
        if (node.skin !== undefined) {
          meshes[node.mesh].isSkinnedMesh = true;
        }
      }
      if (node.camera !== undefined) {
        this._addNodeRef(this.cameraCache, node.camera);
      }
    }
  }

  _addNodeRef(cache, index) {
    if (index !== undefined) {
      if (cache.refs[index] === undefined) {
        cache.refs[index] = cache.uses[index] = 0;
      }
      cache.refs[index]++;
    }
  }

  _getNodeRef(cache, index, object) {
    if (cache.refs[index] <= 1) return object;
    const clone = object.clone();
    const cloneAssociations = (source, target) => {
      const assoc = this.associations.get(source);
      if (assoc != null) this.associations.set(target, assoc);
      for (const [idx, child] of source.children.entries()) {
        cloneAssociations(child, target.children[idx]);
      }
    };
    cloneAssociations(object, clone);
    clone.name += "_instance_" + cache.uses[index]++;
    return clone;
  }

  _invokeOne(func) {
    const plugins = Object.values(this.plugins);
    plugins.push(this);
    for (let i = 0; i < plugins.length; i++) {
      const result = func(plugins[i]);
      if (result) return result;
    }
    return null;
  }

  _invokeAll(func) {
    const plugins = Object.values(this.plugins);
    plugins.unshift(this);
    const results = [];
    for (let i = 0; i < plugins.length; i++) {
      const result = func(plugins[i]);
      if (result) results.push(result);
    }
    return results;
  }

  getDependency(type, index) {
    const cacheKey = type + ":" + index;
    let promise = this.cache.get(cacheKey);
    if (!promise) {
      switch (type) {
        case "scene":
          promise = this.loadScene(index);
          break;
        case "node":
          promise = this._invokeOne(function(plugin) {
            return plugin.loadNode && plugin.loadNode(index);
          });
          break;
        case "mesh":
          promise = this._invokeOne(function(plugin) {
            return plugin.loadMesh && plugin.loadMesh(index);
          });
          break;
        case "accessor":
          promise = this.loadAccessor(index);
          break;
        case "bufferView":
          promise = this._invokeOne(function(plugin) {
            return plugin.loadBufferView && plugin.loadBufferView(index);
          });
          break;
        case "buffer":
          promise = this.loadBuffer(index);
          break;
        case "material":
          promise = this._invokeOne(function(plugin) {
            return plugin.loadMaterial && plugin.loadMaterial(index);
          });
          break;
        case "texture":
          promise = this._invokeOne(function(plugin) {
            return plugin.loadTexture && plugin.loadTexture(index);
          });
          break;
        case "skin":
          promise = this.loadSkin(index);
          break;
        case "animation":
          promise = this._invokeOne(function(plugin) {
            return plugin.loadAnimation && plugin.loadAnimation(index);
          });
          break;
        case "camera":
          promise = this.loadCamera(index);
          break;
        default:
          promise = this._invokeOne(function(plugin) {
            return plugin !== this && plugin.getDependency && plugin.getDependency(type, index);
          });
          if (!promise) throw new Error("Unknown type: " + type);
          break;
      }
      this.cache.add(cacheKey, promise);
    }
    return promise;
  }

  getDependencies(type) {
    let promise = this.cache.get(type);
    if (!promise) {
      const parser = this;
      const items = this.json[type + (type === "mesh" ? "es" : "s")] || [];
      promise = Promise.all(items.map(function(item, index) {
        return parser.getDependency(type, index);
      }));
      this.cache.add(type, promise);
    }
    return promise;
  }

  loadBuffer(bufferIndex) {
    const bufferDef = this.json.buffers[bufferIndex];
    const loader = this.fileLoader;
    if (bufferDef.type && bufferDef.type !== "arraybuffer") {
      throw new Error(`THREE.GLTFLoader: ${bufferDef.type} buffer type is not supported.`);
    }
    if (bufferDef.uri === void 0 && bufferIndex === 0) {
      return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);
    }
    const options = this.options;
    return new Promise((resolve, reject) => {
      loader.load(
        LoaderUtils.resolveURL(bufferDef.uri, options.path),
        resolve,
        void 0,
        () => reject(new Error(`THREE.GLTFLoader: Failed to load buffer "${bufferDef.uri}".`))
      );
    });
  }

  loadBufferView(bufferViewIndex) {
    const bufferViewDef = this.json.bufferViews[bufferViewIndex];
    return this.getDependency("buffer", bufferViewDef.buffer).then((buffer) => {
      const byteLength = bufferViewDef.byteLength || 0;
      const byteOffset = bufferViewDef.byteOffset || 0;
      return buffer.slice(byteOffset, byteOffset + byteLength);
    });
  }

  loadAccessor(accessorIndex) {
    const parser = this;
    const json = this.json;
    const accessorDef = this.json.accessors[accessorIndex];

    if (accessorDef.bufferView === void 0 && accessorDef.sparse === void 0) {
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
      const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
      const normalized = accessorDef.normalized === true;
      const array = new TypedArray(accessorDef.count * itemSize);
      return Promise.resolve(new BufferAttribute(array, itemSize, normalized));
    }

    const pendingDependencies = [];
    if (accessorDef.bufferView !== void 0) {
      pendingDependencies.push(this.getDependency("bufferView", accessorDef.bufferView));
    } else {
      pendingDependencies.push(null);
    }

    if (accessorDef.sparse !== void 0) {
      pendingDependencies.push(this.getDependency("bufferView", accessorDef.sparse.indices.bufferView));
      pendingDependencies.push(this.getDependency("bufferView", accessorDef.sparse.values.bufferView));
    }

    return Promise.all(pendingDependencies).then((buffers) => {
      const bufferView = buffers[0];
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
      const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
      const bytesPerElement = TypedArray.BYTES_PER_ELEMENT;
      const elementByteStride = bytesPerElement * itemSize;
      const byteOffset = accessorDef.byteOffset || 0;
      const byteStride = accessorDef.bufferView !== void 0 ? json.bufferViews[accessorDef.bufferView].byteStride : void 0;
      const normalized = accessorDef.normalized === true;

      let attribute;
      let array;

      if (byteStride && byteStride !== elementByteStride) {
        const ibSliceIndex = Math.floor(byteOffset / byteStride);
        const cacheKey = `InterleavedBuffer:${accessorDef.bufferView}:${accessorDef.componentType}:${ibSliceIndex}:${accessorDef.count}`;
        let interleavedBuffer = parser.cache.get(cacheKey);
        if (!interleavedBuffer) {
          array = new TypedArray(bufferView, ibSliceIndex * byteStride, (accessorDef.count * byteStride) / bytesPerElement);
          interleavedBuffer = new InterleavedBuffer(array, byteStride / bytesPerElement);
          parser.cache.add(cacheKey, interleavedBuffer);
        }
        attribute = new InterleavedBufferAttribute(interleavedBuffer, itemSize, (byteOffset % byteStride) / bytesPerElement, normalized);
      } else {
        try {
          array = bufferView === null ? new TypedArray(accessorDef.count * itemSize) : new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize);
        } catch (bufErr) {
          const reqBytes = accessorDef.count * itemSize * bytesPerElement;
          const actualBytes = bufferView ? bufferView.byteLength : 0;
          const errMsg = `[GLTFLoader] Buffer length out of range in accessor ${accessorIndex}: requested ${reqBytes} bytes at offset ${byteOffset}, but buffer only has ${actualBytes} bytes (${TypedArray.name}). File may be truncated or corrupted.`;
          console.error(errMsg);
          const err = new Error(errMsg);
          err.isAssetError = true;
          throw err;
        }
        attribute = new BufferAttribute(array, itemSize, normalized);
      }

      if (accessorDef.sparse !== void 0) {
        const itemSizeScalar = WEBGL_TYPE_SIZES.SCALAR;
        const IndicesConstructor = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];
        const indicesOffset = accessorDef.sparse.indices.byteOffset || 0;
        const valuesOffset = accessorDef.sparse.values.byteOffset || 0;
        const indicesArray = new IndicesConstructor(buffers[1], indicesOffset, accessorDef.sparse.count * itemSizeScalar);
        const valuesArray = new TypedArray(buffers[2], valuesOffset, accessorDef.sparse.count * itemSize);

        if (bufferView !== null) {
          attribute = new BufferAttribute(attribute.array.slice(), attribute.itemSize, attribute.normalized);
        }
        attribute.normalized = false;
        for (let i = 0, len = indicesArray.length; i < len; i++) {
          const idx = indicesArray[i];
          attribute.setX(idx, valuesArray[i * itemSize]);
          if (itemSize >= 2) attribute.setY(idx, valuesArray[i * itemSize + 1]);
          if (itemSize >= 3) attribute.setZ(idx, valuesArray[i * itemSize + 2]);
          if (itemSize >= 4) attribute.setW(idx, valuesArray[i * itemSize + 3]);
          if (itemSize >= 5) throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.");
        }
        attribute.normalized = normalized;
      }

      return attribute;
    });
  }

  loadTexture(textureIndex) {
    const json = this.json;
    const options = this.options;
    const textureDef = json.textures[textureIndex];
    const sourceIndex = textureDef.source;
    const sourceDef = json.images[sourceIndex];
    let loader = this.textureLoader;
    if (sourceDef.uri) {
      const handler = options.manager.getHandler(sourceDef.uri);
      if (handler !== null) loader = handler;
    }
    return this.loadTextureImage(textureIndex, sourceIndex, loader);
  }

  loadTextureImage(textureIndex, sourceIndex, loader) {
    const parser = this;
    const json = this.json;
    const textureDef = json.textures[textureIndex];
    const sourceDef = json.images[sourceIndex];
    const cacheKey = (sourceDef.uri || sourceDef.bufferView) + ":" + textureDef.sampler;

    if (this.textureCache[cacheKey]) return this.textureCache[cacheKey];

    const promise = this.loadImageSource(sourceIndex, loader).then((texture) => {
      texture.flipY = false;
      texture.name = textureDef.name || sourceDef.name || "";
      if (texture.name === "" && typeof sourceDef.uri === "string" && !sourceDef.uri.startsWith("data:image/")) {
        texture.name = sourceDef.uri;
      }
      const sampler = (json.samplers || {})[textureDef.sampler] || {};
      texture.magFilter = WEBGL_FILTERS[sampler.magFilter] || LinearFilter;
      texture.minFilter = WEBGL_FILTERS[sampler.minFilter] || LinearMipmapNearestFilter;
      texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || RepeatWrapping;
      texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || RepeatWrapping;
      texture.generateMipmaps = !texture.isCompressedTexture && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
      parser.associations.set(texture, { textures: textureIndex });
      return texture;
    }).catch(() => null);

    this.textureCache[cacheKey] = promise;
    return promise;
  }

  loadImageSource(sourceIndex, loader) {
    const parser = this;
    const json = this.json;
    const options = this.options;
    if (this.sourceCache[sourceIndex] !== void 0) {
      return this.sourceCache[sourceIndex].then((tex) => tex.clone());
    }
    const sourceDef = json.images[sourceIndex];
    const URLObject = self.URL || self.webkitURL;
    let uri = sourceDef.uri || "";
    let isBlob = false;

    if (sourceDef.bufferView !== void 0) {
      uri = parser.getDependency("bufferView", sourceDef.bufferView).then((bufferView) => {
        isBlob = true;
        const blob = new Blob([bufferView], { type: sourceDef.mimeType });
        return URLObject.createObjectURL(blob);
      });
    } else if (sourceDef.uri === void 0) {
      throw new Error(`THREE.GLTFLoader: Image ${sourceIndex} is missing URI and bufferView`);
    }

    const promise = Promise.resolve(uri).then((imageUri) => {
      return new Promise((resolve, reject) => {
        let onLoadCallback = resolve;
        if (loader.isImageBitmapLoader === true) {
          onLoadCallback = (bitmap) => {
            const tex = new Texture(bitmap);
            tex.needsUpdate = true;
            resolve(tex);
          };
        }
        loader.load(LoaderUtils.resolveURL(imageUri, options.path), onLoadCallback, void 0, reject);
      });
    }).then((texture) => {
      if (isBlob === true && typeof uri === "string") {
        URLObject.revokeObjectURL(uri);
      }
      assignExtras(texture, sourceDef);
      texture.userData.mimeType = sourceDef.mimeType || extractUrlMimeType(sourceDef.uri);
      return texture;
    }).catch((err) => {
      console.error("THREE.GLTFLoader: Couldn't load texture", uri);
      throw err;
    });

    this.sourceCache[sourceIndex] = promise;
    return promise;
  }

  assignTexture(materialParams, mapName, mapDef, encoding) {
    const parser = this;
    return this.getDependency("texture", mapDef.index).then((texture) => {
      if (!texture) return null;
      if (mapDef.texCoord !== void 0 && mapDef.texCoord > 0) {
        texture = texture.clone();
        texture.channel = mapDef.texCoord;
      }
      if (parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]) {
        const transformExtension = mapDef.extensions !== void 0 ? mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] : void 0;
        if (transformExtension) {
          const prevAssoc = parser.associations.get(texture);
          texture = parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM].extendTexture(texture, transformExtension);
          parser.associations.set(texture, prevAssoc);
        }
      }
      if (encoding !== void 0) {
        texture.colorSpace = encoding;
      }
      materialParams[mapName] = texture;
      return texture;
    });
  }
  assignFinalMaterial(mesh) {
    const geometry = mesh.geometry;
    let material = mesh.material;
    const missingTangent = geometry.attributes.tangent === void 0;
    const hasColor = geometry.attributes.color !== void 0;
    const missingNormal = geometry.attributes.normal === void 0;
    if (mesh.isPoints) {
      const cacheKey = "PointsMaterial:" + material.uuid;
      let cached = this.cache.get(cacheKey);
      if (!cached) {
        cached = new PointsMaterial();
        Material.prototype.copy.call(cached, material);
        cached.color.copy(material.color);
        cached.map = material.map;
        cached.sizeAttenuation = false;
        this.cache.add(cacheKey, cached);
      }
      material = cached;
    } else if (mesh.isLine) {
      const cacheKey = "LineBasicMaterial:" + material.uuid;
      let cached = this.cache.get(cacheKey);
      if (!cached) {
        cached = new LineBasicMaterial();
        Material.prototype.copy.call(cached, material);
        cached.color.copy(material.color);
        cached.map = material.map;
        this.cache.add(cacheKey, cached);
      }
      material = cached;
    }
    if (missingTangent || hasColor || missingNormal) {
      let cacheKey = "ClonedMaterial:" + material.uuid + ":";
      if (missingTangent) cacheKey += "derivative-tangents:";
      if (hasColor) cacheKey += "vertex-colors:";
      if (missingNormal) cacheKey += "flat-shading:";
      let cached = this.cache.get(cacheKey);
      if (!cached) {
        cached = material.clone();
        if (hasColor) cached.vertexColors = true;
        if (missingNormal) cached.flatShading = true;
        if (missingTangent) {
          if (cached.normalScale) cached.normalScale.y *= -1;
          if (cached.clearcoatNormalScale) cached.clearcoatNormalScale.y *= -1;
        }
        this.cache.add(cacheKey, cached);
        this.associations.set(cached, this.associations.get(material));
      }
      material = cached;
    }
    mesh.material = material;
  }
  getMaterialType() {
    return MeshStandardMaterial;
  }
  loadMaterial(materialIndex) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    const materialDef = json.materials[materialIndex];
    let MaterialType;
    const materialParams = {};
    const materialExtensions = materialDef.extensions || {};
    const pendingPromises = [];

    if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
      const unlitExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT];
      MaterialType = unlitExtension.getMaterialType();
      pendingPromises.push(unlitExtension.extendParams(materialParams, materialDef, parser));
    } else {
      const pbr = materialDef.pbrMetallicRoughness || {};
      materialParams.color = new Color(1, 1, 1);
      materialParams.opacity = 1;
      if (Array.isArray(pbr.baseColorFactor)) {
        const bcf = pbr.baseColorFactor;
        materialParams.color.setRGB(bcf[0], bcf[1], bcf[2], LinearSRGBColorSpace);
        materialParams.opacity = bcf[3];
      }
      if (pbr.baseColorTexture !== void 0) {
        pendingPromises.push(parser.assignTexture(materialParams, "map", pbr.baseColorTexture, SRGBColorSpace));
      }
      materialParams.metalness = pbr.metallicFactor !== void 0 ? pbr.metallicFactor : 1;
      materialParams.roughness = pbr.roughnessFactor !== void 0 ? pbr.roughnessFactor : 1;
      if (pbr.metallicRoughnessTexture !== void 0) {
        pendingPromises.push(parser.assignTexture(materialParams, "metalnessMap", pbr.metallicRoughnessTexture));
        pendingPromises.push(parser.assignTexture(materialParams, "roughnessMap", pbr.metallicRoughnessTexture));
      }
      MaterialType = this._invokeOne((ext) => ext.getMaterialType && ext.getMaterialType(materialIndex));
      pendingPromises.push(Promise.all(this._invokeAll((ext) => ext.extendMaterialParams && ext.extendMaterialParams(materialIndex, materialParams))));
    }

    if (materialDef.doubleSided === true) {
      materialParams.side = DoubleSide;
    }
    const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;
    if (alphaMode === ALPHA_MODES.BLEND) {
      materialParams.transparent = true;
      materialParams.depthWrite = false;
    } else {
      materialParams.transparent = false;
      if (alphaMode === ALPHA_MODES.MASK) {
        materialParams.alphaTest = materialDef.alphaCutoff !== void 0 ? materialDef.alphaCutoff : 0.5;
      }
    }

    if (materialDef.normalTexture !== void 0 && MaterialType !== MeshBasicMaterial) {
      pendingPromises.push(parser.assignTexture(materialParams, "normalMap", materialDef.normalTexture));
      materialParams.normalScale = new Vector2(1, 1);
      if (materialDef.normalTexture.scale !== void 0) {
        const scale = materialDef.normalTexture.scale;
        materialParams.normalScale.set(scale, scale);
      }
    }

    if (materialDef.occlusionTexture !== void 0 && MaterialType !== MeshBasicMaterial) {
      pendingPromises.push(parser.assignTexture(materialParams, "aoMap", materialDef.occlusionTexture));
      if (materialDef.occlusionTexture.strength !== void 0) {
        materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;
      }
    }

    if (materialDef.emissiveFactor !== void 0 && MaterialType !== MeshBasicMaterial) {
      const ef = materialDef.emissiveFactor;
      materialParams.emissive = new Color().setRGB(ef[0], ef[1], ef[2], LinearSRGBColorSpace);
    }

    if (materialDef.emissiveTexture !== void 0 && MaterialType !== MeshBasicMaterial) {
      pendingPromises.push(parser.assignTexture(materialParams, "emissiveMap", materialDef.emissiveTexture, SRGBColorSpace));
    }

    return Promise.all(pendingPromises).then(() => {
      const material = new MaterialType(materialParams);
      if (materialDef.name) material.name = materialDef.name;
      assignExtras(material, materialDef);
      parser.associations.set(material, { materials: materialIndex });
      if (materialDef.extensions) assignExtensions(extensions, material, materialDef);
      return material;
    });
  }

  createUniqueName(name) {
    const sanitized = PropertyBinding.sanitizeNodeName(name || "");
    if (sanitized in this.nodeNamesUsed) {
      return `${sanitized}_${++this.nodeNamesUsed[sanitized]}`;
    }
    this.nodeNamesUsed[sanitized] = 0;
    return sanitized;
  }

  loadGeometries(primitives) {
    const parser = this;
    const extensions = this.extensions;
    const cache = this.primitiveCache;

    function decodeDracoPrimitive(prim) {
      return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(prim, parser).then((geo) => {
        return initGeometryAttributes(geo, prim, parser);
      });
    }

    const geometryPromises = [];
    for (let i = 0, len = primitives.length; i < len; i++) {
      const prim = primitives[i];
      const cacheKey = createPrimitiveKey(prim);
      const cached = cache[cacheKey];
      if (cached) {
        geometryPromises.push(cached.promise);
      } else {
        let promise;
        if (prim.extensions && prim.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {
          promise = decodeDracoPrimitive(prim);
        } else {
          promise = initGeometryAttributes(new BufferGeometry(), prim, parser);
        }
        cache[cacheKey] = { primitive: prim, promise };
        geometryPromises.push(promise);
      }
    }
    return Promise.all(geometryPromises);
  }

  loadMesh(meshIndex) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    const meshDef = json.meshes[meshIndex];
    const primitives = meshDef.primitives;
    const pendingMaterials = [];

    for (let i = 0, len = primitives.length; i < len; i++) {
      const matPromise = primitives[i].material === void 0
        ? getDefaultMaterial(this.cache)
        : this.getDependency("material", primitives[i].material);
      pendingMaterials.push(matPromise);
    }

    pendingMaterials.push(parser.loadGeometries(primitives));

    return Promise.all(pendingMaterials).then((results) => {
      const materials = results.slice(0, results.length - 1);
      const geometries = results[results.length - 1];
      const meshes = [];

      for (let i = 0, len = geometries.length; i < len; i++) {
        const geometry = geometries[i];
        const prim = primitives[i];
        let mesh;
        const material = materials[i];

        if (prim.mode === WEBGL_CONSTANTS.TRIANGLES || prim.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || prim.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || prim.mode === void 0) {
          mesh = meshDef.isSkinnedMesh === true ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material);
          if (mesh.isSkinnedMesh === true) mesh.normalizeSkinWeights();
          if (prim.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleStripDrawMode);
          } else if (prim.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleFanDrawMode);
          }
        } else if (prim.mode === WEBGL_CONSTANTS.LINES) {
          mesh = new LineSegments(geometry, material);
        } else if (prim.mode === WEBGL_CONSTANTS.LINE_STRIP) {
          mesh = new Line(geometry, material);
        } else if (prim.mode === WEBGL_CONSTANTS.LINE_LOOP) {
          mesh = new LineLoop(geometry, material);
        } else if (prim.mode === WEBGL_CONSTANTS.POINTS) {
          mesh = new Points(geometry, material);
        } else {
          throw new Error(`THREE.GLTFLoader: Primitive mode unsupported: ${prim.mode}`);
        }

        if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
          createMorphTargets(mesh, meshDef);
        }
        mesh.name = parser.createUniqueName(meshDef.name || `mesh_${meshIndex}`);
        assignExtras(mesh, meshDef);
        if (prim.extensions) assignExtensions(extensions, mesh, prim);
        parser.assignFinalMaterial(mesh);
        meshes.push(mesh);
      }

      for (let i = 0, len = meshes.length; i < len; i++) {
        parser.associations.set(meshes[i], {
          meshes: meshIndex,
          primitives: i
        });
      }

      if (meshes.length === 1) {
        if (meshDef.extensions) assignExtensions(extensions, meshes[0], meshDef);
        return meshes[0];
      }

      const group = new Group();
      if (meshDef.extensions) assignExtensions(extensions, group, meshDef);
      parser.associations.set(group, {
        meshes: meshIndex
      });
      for (let i = 0, len = meshes.length; i < len; i++) {
        group.add(meshes[i]);
      }
      return group;
    });
  }
  loadCamera(cameraIndex) {
    let camera;
    const cameraDef = this.json.cameras[cameraIndex];
    const params = cameraDef[cameraDef.type];
    if (!params) {
      console.warn("THREE.GLTFLoader: Missing camera parameters.");
      return;
    }
    if (cameraDef.type === "perspective") {
      camera = new PerspectiveCamera(MathUtils.radToDeg(params.yfov), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6);
    } else if (cameraDef.type === "orthographic") {
      camera = new OrthographicCamera(-params.xmag, params.xmag, params.ymag, -params.ymag, params.znear, params.zfar);
    }
    if (cameraDef.name) {
      camera.name = this.createUniqueName(cameraDef.name);
    }
    assignExtras(camera, cameraDef);
    return Promise.resolve(camera);
  }
  loadSkin(skinIndex) {
    const parser = this;
    const skinDef = this.json.skins[skinIndex];
    const jointPromises = [];
    for (let i = 0, len = skinDef.joints.length; i < len; i++) {
      jointPromises.push(this._loadNodeShallow(skinDef.joints[i]));
    }
    if (skinDef.inverseBindMatrices !== void 0) {
      jointPromises.push(this.getDependency("accessor", skinDef.inverseBindMatrices));
    } else {
      jointPromises.push(null);
    }
    return Promise.all(jointPromises).then((results) => {
      const ibmAccessor = results.pop();
      const joints = results;
      const bones = [];
      const boneInverses = [];
      for (let i = 0, len = joints.length; i < len; i++) {
        const jointNode = joints[i];
        if (jointNode) {
          bones.push(jointNode);
          const mat = new Matrix4();
          if (ibmAccessor !== null) {
            mat.fromArray(ibmAccessor.array, i * 16);
          }
          boneInverses.push(mat);
        } else {
          console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', skinDef.joints[i]);
        }
      }
      return new Skeleton(bones, boneInverses);
    });
  }
  loadAnimation(animIndex) {
    const json = this.json;
    const parser = this;
    const animDef = json.animations[animIndex];
    const animName = animDef.name ? animDef.name : "animation_" + animIndex;
    const nodePromises = [];
    const inputPromises = [];
    const outputPromises = [];
    const samplers = [];
    const targets = [];
    for (let i = 0, len = animDef.channels.length; i < len; i++) {
      const channel = animDef.channels[i];
      const sampler = animDef.samplers[channel.sampler];
      const target = channel.target;
      const nodeIndex = target.node;
      const inputIndex = animDef.parameters !== void 0 ? animDef.parameters[sampler.input] : sampler.input;
      const outputIndex = animDef.parameters !== void 0 ? animDef.parameters[sampler.output] : sampler.output;
      if (target.node !== void 0) {
        nodePromises.push(this.getDependency("node", nodeIndex));
        inputPromises.push(this.getDependency("accessor", inputIndex));
        outputPromises.push(this.getDependency("accessor", outputIndex));
        samplers.push(sampler);
        targets.push(target);
      }
    }
    return Promise.all([
      Promise.all(nodePromises),
      Promise.all(inputPromises),
      Promise.all(outputPromises),
      Promise.all(samplers),
      Promise.all(targets)
    ]).then(([nodes, inputs, outputs, samplersList, targetsList]) => {
      const tracks = [];
      for (let i = 0, len = nodes.length; i < len; i++) {
        const targetNode = nodes[i];
        const inputAccessor = inputs[i];
        const outputAccessor = outputs[i];
        const samplerDef = samplersList[i];
        const targetDef = targetsList[i];
        if (targetNode === void 0) continue;
        if (targetNode.updateMatrix) targetNode.updateMatrix();
        const createdTracks = parser._createAnimationTracks(targetNode, inputAccessor, outputAccessor, samplerDef, targetDef);
        if (createdTracks) {
          for (let j = 0; j < createdTracks.length; j++) {
            tracks.push(createdTracks[j]);
          }
        }
      }
      const clip = new AnimationClip(animName, void 0, tracks);
      assignExtras(clip, animDef);
      return clip;
    });
  }
  createNodeMesh(nodeIndex) {
    const parser = this;
    const nodeDef = this.json.nodes[nodeIndex];
    if (nodeDef.mesh === void 0) return null;
    return parser.getDependency("mesh", nodeDef.mesh).then((mesh) => {
      const nodeRef = parser._getNodeRef(parser.meshCache, nodeDef.mesh, mesh);
      if (nodeDef.weights !== void 0) {
        nodeRef.traverse((child) => {
          if (child.isMesh) {
            for (let i = 0, len = nodeDef.weights.length; i < len; i++) {
              child.morphTargetInfluences[i] = nodeDef.weights[i];
            }
          }
        });
      }
      return nodeRef;
    });
  }
  loadNode(nodeIndex) {
    const json = this.json;
    const parser = this;
    const nodeDef = json.nodes[nodeIndex];
    const shallowNodePromise = parser._loadNodeShallow(nodeIndex);
    const childPromises = [];
    const children = nodeDef.children || [];
    for (let i = 0, len = children.length; i < len; i++) {
      childPromises.push(parser.getDependency("node", children[i]));
    }
    const skinPromise = nodeDef.skin === void 0 ? Promise.resolve(null) : parser.getDependency("skin", nodeDef.skin);
    return Promise.all([shallowNodePromise, Promise.all(childPromises), skinPromise]).then(([node, loadedChildren, skin]) => {
      if (skin !== null) {
        node.traverse((child) => {
          if (child.isSkinnedMesh) child.bind(skin, identityMatrix);
        });
      }
      for (let i = 0, len = loadedChildren.length; i < len; i++) {
        node.add(loadedChildren[i]);
      }
      if (node.userData.pivot !== void 0 && loadedChildren.length > 0) {
        const pivot = node.userData.pivot;
        const firstChild = loadedChildren[0];
        node.pivot = new Vector3().fromArray(pivot);
        node.position.x -= pivot[0];
        node.position.y -= pivot[1];
        node.position.z -= pivot[2];
        firstChild.position.set(0, 0, 0);
        delete node.userData.pivot;
      }
      return node;
    });
  }
  _loadNodeShallow(nodeIndex) {
    const json = this.json;
    const extensions = this.extensions;
    const parser = this;
    if (this.nodeCache[nodeIndex] !== undefined) return this.nodeCache[nodeIndex];

    const nodeDef = json.nodes[nodeIndex];
    const nodeName = nodeDef.name ? parser.createUniqueName(nodeDef.name) : "";
    const pendingPromises = [];

    const meshPromise = parser._invokeOne(function(plugin) {
      return plugin.createNodeMesh && plugin.createNodeMesh(nodeIndex);
    });
    if (meshPromise) pendingPromises.push(meshPromise);

    if (nodeDef.camera !== undefined) {
      pendingPromises.push(parser.getDependency("camera", nodeDef.camera).then(function(camera) {
        return parser._getNodeRef(parser.cameraCache, nodeDef.camera, camera);
      }));
    }

    parser._invokeAll(function(plugin) {
      return plugin.createNodeAttachment && plugin.createNodeAttachment(nodeIndex);
    }).forEach(function(attachmentPromise) {
      pendingPromises.push(attachmentPromise);
    });

    this.nodeCache[nodeIndex] = Promise.all(pendingPromises).then(function(resolvedObjects) {
      let node;
      if (nodeDef.isBone === true) {
        node = new Bone();
      } else if (resolvedObjects.length > 1) {
        node = new Group();
      } else if (resolvedObjects.length === 1) {
        node = resolvedObjects[0];
      } else {
        node = new Object3D();
      }

      if (node !== resolvedObjects[0]) {
        for (let i = 0, len = resolvedObjects.length; i < len; i++) {
          node.add(resolvedObjects[i]);
        }
      }

      if (nodeDef.name) {
        node.userData.name = nodeDef.name;
        node.name = nodeName;
      }
      assignExtras(node, nodeDef);
      if (nodeDef.extensions) {
        assignExtensions(extensions, node, nodeDef);
      }

      if (nodeDef.matrix !== undefined) {
        const matrix = new Matrix4();
        matrix.fromArray(nodeDef.matrix);
        node.applyMatrix4(matrix);
      } else {
        if (nodeDef.translation !== undefined) node.position.fromArray(nodeDef.translation);
        if (nodeDef.rotation !== undefined) node.quaternion.fromArray(nodeDef.rotation);
        if (nodeDef.scale !== undefined) node.scale.fromArray(nodeDef.scale);
      }

      if (!parser.associations.has(node)) {
        parser.associations.set(node, {});
      } else if (nodeDef.mesh !== undefined && parser.meshCache.refs[nodeDef.mesh] > 1) {
        const assoc = parser.associations.get(node);
        parser.associations.set(node, { ...assoc });
      }
      parser.associations.get(node).nodes = nodeIndex;
      return node;
    });

    return this.nodeCache[nodeIndex];
  }

  loadScene(sceneIndex) {
    const extensions = this.extensions;
    const sceneDef = this.json.scenes[sceneIndex];
    const parser = this;
    const scene = new Group();
    if (sceneDef.name) {
      scene.name = parser.createUniqueName(sceneDef.name);
    }
    assignExtras(scene, sceneDef);
    if (sceneDef.extensions) {
      assignExtensions(extensions, scene, sceneDef);
    }
    const nodeIndices = sceneDef.nodes || [];
    const pendingNodes = [];
    for (let i = 0, len = nodeIndices.length; i < len; i++) {
      pendingNodes.push(parser.getDependency("node", nodeIndices[i]));
    }
    return Promise.all(pendingNodes).then(function(loadedNodes) {
      for (let i = 0, len = loadedNodes.length; i < len; i++) {
        const childNode = loadedNodes[i];
        if (childNode.parent !== null) {
          scene.add(cloneSkinnedMeshHelper(childNode));
        } else {
          scene.add(childNode);
        }
      }
      const filterSceneAssociations = (rootNode) => {
        const filtered = new Map();
        for (const [key, val] of parser.associations) {
          if (key instanceof Material || key instanceof Texture) {
            filtered.set(key, val);
          }
        }
        rootNode.traverse((node) => {
          const assoc = parser.associations.get(node);
          if (assoc != null) filtered.set(node, assoc);
        });
        return filtered;
      };
      parser.associations = filterSceneAssociations(scene);
      return scene;
    });
  }

  _createAnimationTracks(node, inputAccessor, outputAccessor, samplerDef, targetDef) {
    const tracks = [];
    const nodeName = node.name ? node.name : node.uuid;
    const targetNames = [];

    function collectMorphTargetNode(targetNode) {
      if (targetNode.morphTargetInfluences) {
        targetNames.push(targetNode.name ? targetNode.name : targetNode.uuid);
      }
    }

    if (PATH_PROPERTIES[targetDef.path] === PATH_PROPERTIES.weights) {
      collectMorphTargetNode(node);
      if (node.isGroup) {
        node.children.forEach(collectMorphTargetNode);
      }
    } else {
      targetNames.push(nodeName);
    }

    let trackInterpolantClass;
    switch (PATH_PROPERTIES[targetDef.path]) {
      case PATH_PROPERTIES.weights:
        trackInterpolantClass = NumberKeyframeTrack;
        break;
      case PATH_PROPERTIES.rotation:
        trackInterpolantClass = QuaternionKeyframeTrack;
        break;
      case PATH_PROPERTIES.translation:
      case PATH_PROPERTIES.scale:
        trackInterpolantClass = VectorKeyframeTrack;
        break;
      default:
        switch (outputAccessor.itemSize) {
          case 1:
            trackInterpolantClass = NumberKeyframeTrack;
            break;
          case 2:
          case 3:
          default:
            trackInterpolantClass = VectorKeyframeTrack;
            break;
        }
        break;
    }

    const interpolation = samplerDef.interpolation !== undefined ? INTERPOLATION_MODES[samplerDef.interpolation] : InterpolateLinear;
    const values = this._getArrayFromAccessor(outputAccessor);

    for (let i = 0, len = targetNames.length; i < len; i++) {
      const track = new trackInterpolantClass(targetNames[i] + "." + PATH_PROPERTIES[targetDef.path], inputAccessor.array, values, interpolation);
      if (samplerDef.interpolation === "CUBICSPLINE") {
        this._createCubicSplineTrackInterpolant(track);
      }
      tracks.push(track);
    }
    return tracks;
  }

  _getArrayFromAccessor(accessor) {
    let array = accessor.array;
    if (accessor.normalized) {
      const scale = getNormalizedComponentScale(array.constructor);
      const scaledArray = new Float32Array(array.length);
      for (let s = 0, a = array.length; s < a; s++) scaledArray[s] = array[s] * scale;
      array = scaledArray;
    }
    return array;
  }
  _createCubicSplineTrackInterpolant(track) {
    track.createInterpolant = function(result) {
      const interpolantClass = this instanceof QuaternionKeyframeTrack ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant;
      return new interpolantClass(this.times, this.values, this.getValueSize() / 3, result);
    };
    track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
  }

}
/**
 * Computes bounding box and bounding sphere for a primitive geometry using accessor min/max bounds.
 * @param {BufferGeometry} geometry
 * @param {object} primitive GLTF primitive definition
 * @param {GLTFParser} parser
 */
function computeBoundingBoxSphere(geometry, primitive, parser) {
  const attributes = primitive.attributes;
  const bbox = new Box3();

  if (attributes.POSITION !== undefined) {
    const accessor = parser.json.accessors[attributes.POSITION];
    const minVal = accessor.min;
    const maxVal = accessor.max;
    if (minVal !== undefined && maxVal !== undefined) {
      bbox.set(
        new Vector3(minVal[0], minVal[1], minVal[2]),
        new Vector3(maxVal[0], maxVal[1], maxVal[2])
      );
      if (accessor.normalized) {
        const scale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
        bbox.min.multiplyScalar(scale);
        bbox.max.multiplyScalar(scale);
      }
    } else {
      console.warn('THREE.GLTFLoader: Missing min/max properties for accessor POSITION.');
      return;
    }
  } else {
    return;
  }

  const targets = primitive.targets;
  if (targets !== undefined) {
    const targetBox = new Vector3();
    const maxTarget = new Vector3();
    for (let i = 0, len = targets.length; i < len; i++) {
      const target = targets[i];
      if (target.POSITION !== undefined) {
        const targetAccessor = parser.json.accessors[target.POSITION];
        const minVal = targetAccessor.min;
        const maxVal = targetAccessor.max;
        if (minVal !== undefined && maxVal !== undefined) {
          maxTarget.setX(Math.max(Math.abs(minVal[0]), Math.abs(maxVal[0])));
          maxTarget.setY(Math.max(Math.abs(minVal[1]), Math.abs(maxVal[1])));
          maxTarget.setZ(Math.max(Math.abs(minVal[2]), Math.abs(maxVal[2])));
          if (targetAccessor.normalized) {
            const scale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[targetAccessor.componentType]);
            maxTarget.multiplyScalar(scale);
          }
          targetBox.max(maxTarget);
        } else {
          console.warn('THREE.GLTFLoader: Missing min/max properties for accessor POSITION.');
        }
      }
    }
    bbox.expandByVector(targetBox);
  }

  geometry.boundingBox = bbox;
  const sphere = new Sphere();
  bbox.getCenter(sphere.center);
  sphere.radius = bbox.min.distanceTo(bbox.max) / 2;
  geometry.boundingSphere = sphere;
}
/**
 * Resolves accessor dependencies, binds buffer attributes, indices, bounding volumes, and morph targets.
 * @param {BufferGeometry} geometry
 * @param {object} primitive GLTF primitive definition
 * @param {GLTFParser} parser
 * @returns {Promise<BufferGeometry>}
 */
function initGeometryAttributes(geometry, primitive, parser) {
  const attributes = primitive.attributes;
  const pending = [];

  function assignAttribute(accessorIndex, attributeName) {
    return parser.getDependency('accessor', accessorIndex).then((accessor) => {
      geometry.setAttribute(attributeName, accessor);
    });
  }

  for (const attrName in attributes) {
    const targetName = ATTRIBUTES[attrName] || attrName.toLowerCase();
    if (!(targetName in geometry.attributes)) {
      pending.push(assignAttribute(attributes[attrName], targetName));
    }
  }

  if (primitive.indices !== undefined && !geometry.index) {
    const indexPromise = parser.getDependency('accessor', primitive.indices).then((accessor) => {
      geometry.setIndex(accessor);
    });
    pending.push(indexPromise);
  }

  if (ColorManagement.workingColorSpace !== LinearSRGBColorSpace && 'COLOR_0' in attributes) {
    console.warn('THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "' + ColorManagement.workingColorSpace + '" not supported.');
  }

  assignExtras(geometry, primitive);
  computeBoundingBoxSphere(geometry, primitive, parser);

  return Promise.all(pending).then(() => {
    return primitive.targets !== undefined
      ? buildMorphTargetAttributes(geometry, primitive.targets, parser)
      : geometry;
  });
}

export {
  GLTFLoader,
  GLTFParser,
  GLTFBinaryExtension,
  BINARY_HEADER_MAGIC,
  BINARY_HEADER_LENGTH,
  BINARY_CHUNK_TYPES,
  GLTFLightsExtension,
  GLTFMaterialsUnlitExtension,
  GLTFMaterialsEmissiveStrengthExtension,
  GLTFMaterialsClearcoatExtension,
  GLTFMaterialsDispersionExtension,
  GLTFMaterialsIridescenceExtension,
  GLTFMaterialsSheenExtension,
  GLTFMaterialsTransmissionExtension,
  GLTFMaterialsVolumeExtension,
  GLTFMaterialsIorExtension,
  GLTFMaterialsSpecularExtension,
  GLTFMaterialsBumpExtension,
  GLTFMaterialsAnisotropyExtension,
  GLTFTextureBasisUExtension,
  GLTFTextureWebPExtension,
  GLTFTextureAVIFExtension,
  GLTFMeshoptCompressionExtension,
  GLTFMeshGpuInstancing,
  GLTFDracoMeshCompressionExtension,
  GLTFTextureTransformExtension,
  GLTFMeshQuantizationExtension,
  GLTFCubicSplineInterpolant,
  GLTFCubicSplineQuaternionInterpolant,
  EXTENSIONS as GLTF_EXTENSIONS,
  WEBGL_CONSTANTS,
  WEBGL_COMPONENT_TYPES,
  WEBGL_FILTERS,
  WEBGL_WRAPPINGS,
  WEBGL_TYPE_SIZES,
  ATTRIBUTES,
  PATH_PROPERTIES,
  INTERPOLATION_MODES,
  ALPHA_MODES,
  getDefaultMaterial,
  assignExtras,
  assignExtensions,
  createMorphTargets,
  buildMorphTargetAttributes,
  computeBoundingBoxSphere,
  initGeometryAttributes,
  getMaterialExtension,
  extractUrlMimeType,
  getNormalizedComponentScale,
  createPrimitiveKey,
  hashAttributes,
  createCache
};
export default GLTFLoader;
