import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { tokenColor } from '../styles/tokens.js';

// Post-processing: the finished frame goes through a few passes before it hits
// the screen.
//  1. Bloom: only things brighter than "white" (neon tubes, LED strips, the lamp
//     bulb, the TV picture) spill a soft glow into the room. Tuned with a high
//     threshold so walls and furniture never haze over.
//  2. Output: tone mapping and colour space, as the renderer would normally do.
//  3. Colour grade: cool teal in the shadows, warm amber in the highlights, a touch
//     more contrast, and a soft vignette, so it never looks like default 3D.
// Bloom runs at half resolution to keep it cheap.

const BLOOM = { strength: 0.45, radius: 0.5, threshold: 1.05, resolution: 0.5 }; // above pure white, so screen text and art never glow
const GRADE = { shadowTint: 0.07, highlightTint: 0.05, contrast: 1.08, saturation: 1.04, vignette: 0.32 };

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uShadowColor: { value: new THREE.Color() },
    uHighlightColor: { value: new THREE.Color() },
    uShadowTint: { value: GRADE.shadowTint },
    uHighlightTint: { value: GRADE.highlightTint },
    uContrast: { value: GRADE.contrast },
    uSaturation: { value: GRADE.saturation },
    uVignette: { value: GRADE.vignette },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uShadowColor;
    uniform vec3 uHighlightColor;
    uniform float uShadowTint;
    uniform float uHighlightTint;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // Split-tone: tint the darks and the brights toward two different colours.
      c = mix(c, c * uShadowColor * 2.0, uShadowTint * (1.0 - smoothstep(0.0, 0.45, luma)));
      c = mix(c, c * uHighlightColor * 2.0, uHighlightTint * smoothstep(0.55, 1.0, luma));

      // Gentle contrast around mid-grey, and saturation.
      c = (c - 0.5) * uContrast + 0.5;
      c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSaturation);

      // Soft vignette toward the corners.
      vec2 d = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.75, dot(d, d) * 2.0);

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
};

export function createPostFx(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  // Render target with MSAA, so edges stay as smooth as without post-processing.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x * BLOOM.resolution, size.y * BLOOM.resolution),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  // The grade works on the final, display-ready colours, so use the token colours as-is.
  grade.uniforms.uShadowColor.value.copy(tokenColor('--grade-shadow')).convertLinearToSRGB();
  grade.uniforms.uHighlightColor.value.copy(tokenColor('--grade-highlight')).convertLinearToSRGB();
  composer.addPass(grade);

  return {
    render(dt) {
      composer.render(dt);
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      bloom.resolution.set(width * BLOOM.resolution, height * BLOOM.resolution);
    },
  };
}
