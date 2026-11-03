import * as THREE from 'three';
import { gsap } from 'gsap';
import './styles/tokens.css';
import './styles/base.css';
import projects from './content/projects.json';
import { STATES, getState, transition, onStateChange } from './state.js';
import { loadModel } from './scene/models.js';
import { buildTV, buildConsole, TV_SIZE } from './scene/placeholders.js';
import { buildRoom, STAND } from './scene/room.js';
import { buildCartridges } from './scene/cartridges.js';
import { buildLights } from './scene/lights.js';
import { buildWindow } from './scene/window.js';
import { buildLeds } from './scene/leds.js';
import { buildProps } from './scene/props.js';
import { createCameraRig } from './scene/camera.js';
import { createAttract } from './scene/attract.js';
import { createEnterHint } from './ui/enterHint.js';
import { listenForStart } from './input/start.js';
import { DURATIONS } from './motion/eases.js';

// --- Renderer ---------------------------------------------------------------
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
const MAX_DPR = isCoarsePointer ? 1.5 : 2;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 30);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// --- Scene layout -------------------------------------------------------------
// Everything sits on the TV stand. Positions are in metres.
const standTop = STAND.height;
const tvPosition = new THREE.Vector3(0, standTop, -0.86);
const consolePosition = new THREE.Vector3(0, standTop, -0.5);
const cartridgeRowOrigin = new THREE.Vector3(0.2, standTop, -0.48);
const screenCenter = new THREE.Vector3(0, standTop + TV_SIZE.height / 2 + 0.02, tvPosition.z + TV_SIZE.depth / 2 - 0.034);
const tvBack = new THREE.Vector3(0, standTop + 0.3, tvPosition.z - TV_SIZE.depth / 2 - 0.01);
const tvSide = new THREE.Vector3(TV_SIZE.width / 2, standTop + 0.15, tvPosition.z + 0.1);
const consoleBack = new THREE.Vector3(0.08, standTop + 0.04, consolePosition.z - 0.095);

const rig = createCameraRig(camera, {
  wide: { position: new THREE.Vector3(1.9, 1.5, 2.7), lookAt: new THREE.Vector3(-0.35, 1.05, -0.8) },
  tv: { position: new THREE.Vector3(0, screenCenter.y + 0.03, 0.32), lookAt: screenCenter },
  console: { position: new THREE.Vector3(0.12, 0.86, -0.06), lookAt: new THREE.Vector3(0.06, standTop + 0.03, -0.52) },
});
rig.setPose('wide', { instant: true });

const POSE_FOR_STATE = {
  [STATES.BOOT]: 'wide',
  [STATES.INTRO]: 'wide',
  [STATES.MENU]: 'tv',
  [STATES.INSERTING]: 'console',
};
onStateChange(({ to }) => {
  if (POSE_FOR_STATE[to]) rig.setPose(POSE_FOR_STATE[to]);
});

const roomWindow = buildWindow();

async function buildScene() {
  scene.add(buildRoom());
  scene.add(roomWindow.group);
  scene.add(buildProps({ consoleBack, tvSide }));
  scene.add(buildLeds({ tvBack, tvWidth: TV_SIZE.width }));
  scene.add(buildLights({ screenCenter, lampTarget: new THREE.Vector3(0.18, standTop, -0.5) }));

  const [tv, consoleModel, cartridges] = await Promise.all([
    loadModel('tv', buildTV),
    loadModel('console', buildConsole),
    buildCartridges(projects, cartridgeRowOrigin),
  ]);
  tv.position.copy(tvPosition);
  consoleModel.position.copy(consolePosition);
  scene.add(tv, consoleModel, cartridges.row);
}
// --- Opening moment ---------------------------------------------------------------
// Wide room shot, TV flickering to draw the eye, and a "scroll to enter" hint.
// Scrolling, Enter, Space, a click or a tap moves into INTRO: the camera glides
// to the TV, then the menu takes over. (The full loading screen will come first,
// and the real CRT power-on effect replaces the glide, in later passes.)
const attract = createAttract(scene);
const enterHint = createEnterHint({ onActivate: enter });
let stopListening = null;

function enter() {
  if (getState() === STATES.BOOT) transition(STATES.INTRO);
}

function showOpening() {
  attract.setMode('flicker');
  enterHint.show();
  stopListening?.();
  stopListening = listenForStart(enter);
}

onStateChange(({ to }) => {
  if (to === STATES.BOOT) {
    showOpening();
    return;
  }
  enterHint.hide();
  stopListening?.();
  stopListening = null;
  attract.setMode('on');
  if (to === STATES.INTRO) {
    gsap.delayedCall(DURATIONS.introGlide, () => {
      if (getState() === STATES.INTRO) transition(STATES.MENU);
    });
  }
});

// Compile every shader up front, so the hint never shows over a black screen and
// the first camera move doesn't stutter.
buildScene()
  .then(() => renderer.compileAsync(scene, camera))
  .then(() => {
    attract.bind();
    if (getState() === STATES.BOOT) showOpening();
  });

// --- One clock ----------------------------------------------------------------
// GSAP's ticker is the only frame loop. Three.js renders inside it; Lenis will
// hook in here later.
gsap.ticker.lagSmoothing(0);

// Skip rendering while the tab is hidden or an HTML overlay fully covers the canvas.
const COVERING_STATES = new Set([STATES.PROJECT, STATES.FALLBACK_2D]);
let renderPaused = false;
function updatePaused() {
  renderPaused = document.hidden || COVERING_STATES.has(getState());
}
document.addEventListener('visibilitychange', updatePaused);
onStateChange(updatePaused);

function tick(_time, deltaMs) {
  if (renderPaused) return;
  const dt = deltaMs / 1000;
  rig.update(dt);
  roomWindow.update(dt);
  attract.update(dt);
  renderer.render(scene, camera);
}
gsap.ticker.add(tick);

// --- Dev-only helpers -----------------------------------------------------------
if (import.meta.env.DEV) {
  import('./ui/debug.js').then(({ initDebug }) => initDebug());
  rig.enableDevOrbit(canvas);
}
