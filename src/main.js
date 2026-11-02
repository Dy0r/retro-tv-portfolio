import * as THREE from 'three';
import { gsap } from 'gsap';
import './styles/tokens.css';
import './styles/base.css';
import { STATES, getState, onStateChange } from './state.js';

// --- Renderer ---------------------------------------------------------------
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
const MAX_DPR = isCoarsePointer ? 1.5 : 2;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.2, 4);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// --- One clock ----------------------------------------------------------------
// GSAP's ticker is the only frame loop. Three.js renders inside it; Lenis and
// camera damping will hook in here later.
gsap.ticker.lagSmoothing(0);

// Skip rendering while the tab is hidden or an HTML overlay fully covers the canvas.
const COVERING_STATES = new Set([STATES.PROJECT, STATES.FALLBACK_2D]);
let renderPaused = false;
function updatePaused() {
  renderPaused = document.hidden || COVERING_STATES.has(getState());
}
document.addEventListener('visibilitychange', updatePaused);
onStateChange(updatePaused);

function tick() {
  if (renderPaused) return;
  renderer.render(scene, camera);
}
gsap.ticker.add(tick);

// --- Dev-only state debugger ----------------------------------------------------
if (import.meta.env.DEV) {
  import('./ui/debug.js').then(({ initDebug }) => initDebug());
}
