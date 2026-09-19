/**
 * BoostBloom.js
 * Multi-pass progressive dual-filtering (downsampling & upsampling) bloom post-processor.
 * Generates low-frequency halo glow for vehicle boost fires, supersonic plumes, and goals.
 */

export const BLOOM_MIP_LEVELS = 4;
export const BLOOM_DOWNSCALE_FACTOR = 0.5;
export const BLOOM_THRESHOLD = 1.2;
export const BLOOM_SMOOTH_WIDTH = 0.01;
export const BLOOM_OUTPUT_STRENGTH = 0.275 * 3;
export const BLOOM_WEIGHTS = [0.76, 0.68, 0.6, 0.52 + 0.44];

export const BLOOM_QUAD_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const BLOOM_DOWNSAMPLE_FRAGMENT_SHADER = `
  uniform sampler2D inputTexture;
  uniform vec2 texelSize;
  uniform float applyThreshold;
  uniform float threshold;
  uniform float smoothWidth;
  varying vec2 vUv;

  void main() {
    // Four bilinear taps are enough for a stable, low-frequency boost
    // halo and suppress the stair-stepping of a single scaled lookup.
    vec3 color = (
      texture2D(inputTexture, vUv + texelSize * vec2(-0.5, -0.5)).rgb +
      texture2D(inputTexture, vUv + texelSize * vec2( 0.5, -0.5)).rgb +
      texture2D(inputTexture, vUv + texelSize * vec2(-0.5,  0.5)).rgb +
      texture2D(inputTexture, vUv + texelSize * vec2( 0.5,  0.5)).rgb
    ) * 0.25;

    if (applyThreshold > 0.5) {
      float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color *= smoothstep(threshold, threshold + smoothWidth, brightness);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const BLOOM_UPSAMPLE_FRAGMENT_SHADER = `
  uniform sampler2D lowTexture;
  uniform sampler2D highTexture;
  uniform vec2 lowTexelSize;
  uniform float highWeight;
  uniform float lowWeight;
  uniform float outputStrength;
  varying vec2 vUv;

  void main() {
    vec2 d = lowTexelSize;
    // Tent-filter the coarser level while scaling it up. The diagonal
    // taps carry twice the weight of the axial taps, matching the smooth
    // rounded falloff expected from the old Gaussian chain.
    vec3 low = (
      texture2D(lowTexture, vUv + vec2(-d.x, -d.y)).rgb * 2.0 +
      texture2D(lowTexture, vUv + vec2( d.x, -d.y)).rgb * 2.0 +
      texture2D(lowTexture, vUv + vec2(-d.x,  d.y)).rgb * 2.0 +
      texture2D(lowTexture, vUv + vec2( d.x,  d.y)).rgb * 2.0 +
      texture2D(lowTexture, vUv + vec2(-2.0 * d.x, 0.0)).rgb +
      texture2D(lowTexture, vUv + vec2( 2.0 * d.x, 0.0)).rgb +
      texture2D(lowTexture, vUv + vec2(0.0, -2.0 * d.y)).rgb +
      texture2D(lowTexture, vUv + vec2(0.0,  2.0 * d.y)).rgb
    ) / 12.0;
    vec3 high = texture2D(highTexture, vUv).rgb;
    gl_FragColor = vec4(
      (high * highWeight + low * lowWeight) * outputStrength,
      1.0
    );
  }
`;

// Three.js dependency container
let bloomThreeContext = {
  WebGLRenderTarget: null,
  ShaderMaterial: null,
  Vector2: null,
  Color: null,
  FullScreenQuad: null,
  HalfFloatType: 1016,
  LinearFilter: 1006
};

export function setBoostBloomThreeContext(context) {
  bloomThreeContext = { ...bloomThreeContext, ...context };
}

export function createBloomRenderTarget(name, hasDepth) {
  const RenderTarget = bloomThreeContext.WebGLRenderTarget || (typeof THREE !== 'undefined' ? THREE.WebGLRenderTarget : null);
  if (!RenderTarget) {
    // Mock target for headless testing
    return {
      texture: { name, generateMipmaps: false },
      width: 1,
      height: 1,
      setSize(w, h) { this.width = w; this.height = h; },
      dispose() {}
    };
  }
  const target = new RenderTarget(1, 1, {
    type: bloomThreeContext.HalfFloatType,
    minFilter: bloomThreeContext.LinearFilter,
    magFilter: bloomThreeContext.LinearFilter,
    depthBuffer: hasDepth,
    stencilBuffer: false
  });
  target.texture.name = name;
  target.texture.generateMipmaps = false;
  return target;
}

export class BoostBloom {
  constructor(renderer, width, height, pixelRatio) {
    this.renderer = renderer;
    this.renderSubmissions = 1 + BLOOM_MIP_LEVELS + (BLOOM_MIP_LEVELS - 1);
    this.sourceTarget = createBloomRenderTarget("BoostBloom.source", true);
    this.downTargets = [];
    this.upTargets = [];

    const ShaderMaterial = bloomThreeContext.ShaderMaterial || (typeof THREE !== 'undefined' ? THREE.ShaderMaterial : null);
    const Vector2 = bloomThreeContext.Vector2 || (typeof THREE !== 'undefined' ? THREE.Vector2 : function (x = 0, y = 0) { this.x = x; this.y = y; this.set = (nx, ny) => { this.x = nx; this.y = ny; }; });
    const Color = bloomThreeContext.Color || (typeof THREE !== 'undefined' ? THREE.Color : function () { this.r = 0; this.g = 0; this.b = 0; });
    const FullScreenQuad = bloomThreeContext.FullScreenQuad || (typeof THREE !== 'undefined' ? THREE.FullScreenQuad : null);

    this.oldClearColor = new Color();

    for (let mipIndex = 0; mipIndex < BLOOM_MIP_LEVELS; mipIndex += 1) {
      this.downTargets.push(createBloomRenderTarget(`BoostBloom.down${mipIndex}`, false));
      if (mipIndex < BLOOM_MIP_LEVELS - 1) {
        this.upTargets.push(createBloomRenderTarget(`BoostBloom.up${mipIndex}`, false));
      }
    }

    this.texture = this.upTargets[0]?.texture || null;

    if (ShaderMaterial) {
      this.downsampleMaterial = new ShaderMaterial({
        uniforms: {
          inputTexture: { value: null },
          texelSize: { value: new Vector2() },
          applyThreshold: { value: 0 },
          threshold: { value: BLOOM_THRESHOLD },
          smoothWidth: { value: BLOOM_SMOOTH_WIDTH }
        },
        vertexShader: BLOOM_QUAD_VERTEX_SHADER,
        fragmentShader: BLOOM_DOWNSAMPLE_FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      });

      this.upsampleMaterial = new ShaderMaterial({
        uniforms: {
          lowTexture: { value: null },
          highTexture: { value: null },
          lowTexelSize: { value: new Vector2() },
          highWeight: { value: 1 },
          lowWeight: { value: 1 },
          outputStrength: { value: 1 }
        },
        vertexShader: BLOOM_QUAD_VERTEX_SHADER,
        fragmentShader: BLOOM_UPSAMPLE_FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      });
    } else {
      this.downsampleMaterial = { uniforms: { inputTexture: {}, texelSize: { value: new Vector2() }, applyThreshold: {} }, dispose() {} };
      this.upsampleMaterial = { uniforms: { lowTexture: {}, highTexture: {}, lowTexelSize: { value: new Vector2() }, highWeight: {}, lowWeight: {}, outputStrength: {} }, dispose() {} };
    }

    if (FullScreenQuad) {
      this.quad = new FullScreenQuad(this.downsampleMaterial);
    } else {
      this.quad = { material: this.downsampleMaterial, render() {}, dispose() {} };
    }

    this.setSize(width, height, pixelRatio);
  }

  setSize(width, height, pixelRatio = (this.renderer?.getPixelRatio?.() ?? 1)) {
    let currentWidth = Math.max(1, Math.round(width * pixelRatio * BLOOM_DOWNSCALE_FACTOR));
    let currentHeight = Math.max(1, Math.round(height * pixelRatio * BLOOM_DOWNSCALE_FACTOR));
    this.sourceTarget.setSize(currentWidth, currentHeight);

    for (let mipIndex = 0; mipIndex < BLOOM_MIP_LEVELS; mipIndex += 1) {
      currentWidth = Math.max(1, Math.round(currentWidth / 2));
      currentHeight = Math.max(1, Math.round(currentHeight / 2));
      this.downTargets[mipIndex].setSize(currentWidth, currentHeight);
      if (mipIndex < BLOOM_MIP_LEVELS - 1) {
        this.upTargets[mipIndex].setSize(currentWidth, currentHeight);
      }
    }
  }

  clear() {
    if (!this.renderer) return;
    const renderer = this.renderer;
    const prevRenderTarget = renderer.getRenderTarget();
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.oldClearColor);
    renderer.setRenderTarget(this.upTargets[0]);
    renderer.setClearColor(0, 0);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(prevRenderTarget);
    renderer.setClearColor(this.oldClearColor, prevClearAlpha);
  }

  render(scene, camera) {
    if (!this.renderer) return;
    const renderer = this.renderer;
    const prevRenderTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevClearAlpha = renderer.getClearAlpha();

    renderer.getClearColor(this.oldClearColor);
    renderer.autoClear = false;
    renderer.setRenderTarget(this.sourceTarget);
    renderer.setClearColor(0, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    this.quad.material = this.downsampleMaterial;
    let currentInputTarget = this.sourceTarget;
    for (let mipLevel = 0; mipLevel < BLOOM_MIP_LEVELS; mipLevel += 1) {
      this.downsampleMaterial.uniforms.inputTexture.value = currentInputTarget.texture;
      this.downsampleMaterial.uniforms.texelSize.value.set(1 / currentInputTarget.width, 1 / currentInputTarget.height);
      this.downsampleMaterial.uniforms.applyThreshold.value = (mipLevel === 0 ? 1 : 0);
      renderer.setRenderTarget(this.downTargets[mipLevel]);
      this.quad.render(renderer);
      currentInputTarget = this.downTargets[mipLevel];
    }

    this.quad.material = this.upsampleMaterial;
    let currentUpTarget = this.downTargets[BLOOM_MIP_LEVELS - 1];
    for (let mipLevel = BLOOM_MIP_LEVELS - 2; mipLevel >= 0; mipLevel -= 1) {
      this.upsampleMaterial.uniforms.lowTexture.value = currentUpTarget.texture;
      this.upsampleMaterial.uniforms.highTexture.value = this.downTargets[mipLevel].texture;
      this.upsampleMaterial.uniforms.lowTexelSize.value.set(1 / currentUpTarget.width, 1 / currentUpTarget.height);
      this.upsampleMaterial.uniforms.highWeight.value = BLOOM_WEIGHTS[mipLevel];
      this.upsampleMaterial.uniforms.lowWeight.value = (mipLevel === BLOOM_MIP_LEVELS - 2 ? BLOOM_WEIGHTS[BLOOM_MIP_LEVELS - 1] : 1);
      this.upsampleMaterial.uniforms.outputStrength.value = (mipLevel === 0 ? BLOOM_OUTPUT_STRENGTH : 1);
      renderer.setRenderTarget(this.upTargets[mipLevel]);
      this.quad.render(renderer);
      currentUpTarget = this.upTargets[mipLevel];
    }

    renderer.setRenderTarget(prevRenderTarget);
    renderer.setClearColor(this.oldClearColor, prevClearAlpha);
    renderer.autoClear = prevAutoClear;
  }

  dispose() {
    this.sourceTarget.dispose();
    for (const target of this.downTargets) target.dispose();
    for (const target of this.upTargets) target.dispose();
    this.downsampleMaterial.dispose();
    this.upsampleMaterial.dispose();
    this.quad.dispose();
  }
}
