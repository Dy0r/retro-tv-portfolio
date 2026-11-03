import * as THREE from 'three';
import { tokenColor } from '../styles/tokens.js';

// The TV's picture. Replaces the material on the mesh named `Screen` (placeholder
// or tv.glb; the real model's Screen mesh needs UVs) with a small shader that can:
//  - glow faintly on standby (the opening flicker drives this),
//  - power on: a dot becomes a bright line, the line opens to fill the screen, flash,
//  - show the menu canvas, with light scanlines and bursts of static.
// The full CRT look (curvature, chromatic aberration, bloom, rolling bar) is a later pass.

export const SCREEN_CANVAS = { width: 1024, height: 768 };

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uOffColor;
  uniform vec3 uGlowColor;
  uniform float uStandby;  // faint glow while switched off
  uniform float uLine;     // 0..1 width of the power-on line
  uniform float uOpen;     // 0..1 how far the picture has opened vertically
  uniform float uFlash;    // extra white while powering on
  uniform float uContent;  // 0..1 how much of the menu shows
  uniform float uStatic;   // 0..1 static noise
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 c = vUv - 0.5;
    float vignette = smoothstep(0.78, 0.15, length(c * vec2(1.0, 1.33)));

    vec3 color = uOffColor + uGlowColor * uStandby * 0.35 * vignette;

    // Power-on aperture: a line that grows sideways, then opens up and down.
    float halfH = mix(0.003, 0.52, uOpen);
    float halfW = 0.52 * uLine;
    float inside = step(abs(c.y), halfH) * step(abs(c.x), halfW);

    vec3 picture = texture2D(uMap, vUv).rgb * 1.35 * uContent;
    picture *= 0.9 + 0.1 * sin(vUv.y * 900.0);            // light scanlines
    picture *= mix(0.65, 1.0, vignette);
    float noise = hash(floor(vUv * vec2(320.0, 240.0)) + fract(uTime) * 91.0);
    picture = mix(picture, vec3(noise), uStatic);
    picture += vec3(uFlash);

    color = mix(color, picture, inside);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createTvScreen(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_CANVAS.width;
  canvas.height = SCREEN_CANVAS.height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const uniforms = {
    uMap: { value: texture },
    uOffColor: { value: tokenColor('--screen-off') },
    uGlowColor: { value: tokenColor('--light-crt') },
    uStandby: { value: 1 },
    uLine: { value: 0 },
    uOpen: { value: 0 },
    uFlash: { value: 0 },
    uContent: { value: 0 },
    uStatic: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });

  let mesh = null;
  let glow = null;
  let baseGlow = 0;

  return {
    canvas,
    texture,
    uniforms,
    get mesh() {
      return mesh;
    },
    get glow() {
      return glow;
    },
    get baseGlow() {
      return baseGlow;
    },

    // Call once the TV is in the scene.
    bind() {
      mesh = scene.getObjectByName('Screen');
      if (mesh) mesh.material = material;
      glow = scene.getObjectByName('CRTGlow') ?? null;
      baseGlow = glow?.intensity ?? 0;
    },

    // Faint glow while off. `level` 1 = normal standby glow.
    setStandby(level) {
      uniforms.uStandby.value = level;
      if (glow) glow.intensity = baseGlow * level;
    },

    // Fully on with the menu showing, no animation (e.g. reduced motion, dev shortcuts).
    powerOnInstant(glowLevel) {
      uniforms.uLine.value = 1;
      uniforms.uOpen.value = 1;
      uniforms.uFlash.value = 0;
      uniforms.uContent.value = 1;
      uniforms.uStandby.value = 0;
      if (glow) glow.intensity = baseGlow * glowLevel;
    },

    // Back to fully off (used when returning to the opening shot).
    reset() {
      uniforms.uLine.value = 0;
      uniforms.uOpen.value = 0;
      uniforms.uFlash.value = 0;
      uniforms.uContent.value = 0;
      uniforms.uStatic.value = 0;
      this.setStandby(1);
    },

    update(dt) {
      uniforms.uTime.value += dt;
    },
  };
}
