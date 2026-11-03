import * as THREE from 'three';
import { gsap } from 'gsap';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import projects from './content/projects.json';
import site from './content/site.json';
import { STATES, getState, transition, onStateChange } from './state.js';
import { loadModel, loadingManager } from './scene/models.js';
import { buildTV, buildConsole, TV_SIZE, SCREEN_OFFSET } from './scene/placeholders.js';
import { buildRoom, STAND } from './scene/room.js';
import { buildCartridges } from './scene/cartridges.js';
import { buildLights } from './scene/lights.js';
import { buildWindow } from './scene/window.js';
import { buildLeds } from './scene/leds.js';
import { buildProps } from './scene/props.js';
import { createCameraRig } from './scene/camera.js';
import { createAttract } from './scene/attract.js';
import { playIntro, LED_ON, LED_STANDBY, GLOW_ON } from './scene/intro.js';
import { createTvScreen } from './screen/tvScreen.js';
import { createMenu } from './screen/menu.js';
import { createLoader } from './ui/loader.js';
import { createEnterHint } from './ui/enterHint.js';
import { createAnnouncer } from './ui/announcer.js';
import { listenForStart } from './input/start.js';
import { createMenuInput } from './input/menuInput.js';
import { createGamepadInput } from './input/gamepad.js';

// --- Loading screen ---------------------------------------------------------------
// Starts straight away; real progress comes from the shared LoadingManager.
const loader = createLoader();
loadingManager.onProgress = (_url, loaded, total) => loader.setProgress((loaded / total) * 0.9);

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
const screenCenter = new THREE.Vector3(0, standTop + SCREEN_OFFSET.y, tvPosition.z + SCREEN_OFFSET.z);
const tvBack = new THREE.Vector3(0, standTop + 0.3, tvPosition.z - TV_SIZE.depth / 2 - 0.01);
const tvSide = new THREE.Vector3(TV_SIZE.width / 2, standTop + 0.15, tvPosition.z + 0.1);
const consoleBack = new THREE.Vector3(0.08, standTop + 0.04, consolePosition.z - 0.095);

// Camera framings. "menu" keeps the TV large but shows the cartridge row too, so
// the selected cartridge lifting is visible next to the screen.
const rig = createCameraRig(camera, {
  wide: { position: new THREE.Vector3(1.9, 1.5, 2.7), lookAt: new THREE.Vector3(-0.35, 1.05, -0.8) },
  menu: { position: new THREE.Vector3(0.12, 0.8, 0.62), lookAt: new THREE.Vector3(0.07, 0.66, -0.65) },
  console: { position: new THREE.Vector3(0.12, 0.86, -0.06), lookAt: new THREE.Vector3(0.06, standTop + 0.03, -0.52) },
});
rig.setPose('wide', { instant: true });

const roomWindow = buildWindow();
const tvScreen = createTvScreen(scene);
const attract = createAttract(tvScreen);
const announcer = createAnnouncer();
let cartridges = null;
let cartridgeRow = null;
let led = null;

async function buildScene() {
  scene.add(buildRoom());
  scene.add(roomWindow.group);
  scene.add(buildProps({ consoleBack, tvSide }));
  scene.add(buildLeds({ tvBack, tvWidth: TV_SIZE.width }));
  scene.add(buildLights({ screenCenter, lampTarget: new THREE.Vector3(0.18, standTop, -0.5) }));

  const [tv, consoleModel, carts] = await Promise.all([
    loadModel('tv', buildTV),
    loadModel('console', buildConsole),
    buildCartridges(projects, cartridgeRowOrigin),
  ]);
  tv.position.copy(tvPosition);
  consoleModel.position.copy(consolePosition);
  scene.add(tv, consoleModel, carts.row);
  cartridges = carts;
  cartridgeRow = carts.row;
}

function setLed(level) {
  if (led) led.material.emissiveIntensity = level;
}

// --- Menu ---------------------------------------------------------------------------
const menu = createMenu({
  projects,
  pages: site.menuPages,
  tvScreen,
  onChange(item) {
    cartridges?.setSelected(item.kind === 'project' ? item.slug : null);
    announcer.announce(item.spoken);
  },
});

const menuInput = createMenuInput({
  canvas,
  camera,
  menu,
  getScreen: () => tvScreen.mesh,
  getCartridgeRow: () => cartridgeRow,
});

// --- Opening moment ---------------------------------------------------------------
// Wide room shot, TV flickering to draw the eye, and the "scroll to switch on" hint.
const enterHint = createEnterHint({ onActivate: enter });
let stopListening = null;
let openingReady = false;

function enter() {
  if (openingReady && getState() === STATES.BOOT) transition(STATES.INTRO);
}

function showOpening() {
  openingReady = true;
  setLed(LED_STANDBY);
  attract.start();
  enterHint.show();
  stopListening?.();
  stopListening = listenForStart(enter);
}

// --- INTRO: power-on + dolly (any key or click skips) ---------------------------------
let intro = null;

function skipIntro(e) {
  if (e.repeat) return;
  intro?.progress(1);
}

function startIntro() {
  window.addEventListener('keydown', skipIntro);
  canvas.addEventListener('pointerdown', skipIntro);
  intro = playIntro({
    rig,
    tvScreen,
    led,
    onComplete: () => {
      intro = null;
      if (getState() === STATES.INTRO) transition(STATES.MENU);
    },
  });
}

function stopIntroListeners() {
  window.removeEventListener('keydown', skipIntro);
  canvas.removeEventListener('pointerdown', skipIntro);
}

// --- Gamepad ---------------------------------------------------------------------------
const gamepad = createGamepadInput((action) => {
  const state = getState();
  if (state === STATES.BOOT && (action === 'start' || action === 'confirm')) enter();
  else if (state === STATES.INTRO) intro?.progress(1);
  else if (state === STATES.MENU && action === 'prev') menu.prev();
  else if (state === STATES.MENU && action === 'next') menu.next();
});

// --- State changes --------------------------------------------------------------------
onStateChange(({ to }) => {
  if (to !== STATES.INTRO) stopIntroListeners();
  if (to !== STATES.MENU) menuInput.disable();

  if (to === STATES.BOOT) {
    intro?.kill();
    intro = null;
    tvScreen.reset();
    cartridges?.setSelected(null);
    rig.setPose('wide');
    if (openingReady) showOpening();
    return;
  }

  // Leaving the opening moment.
  enterHint.hide();
  stopListening?.();
  stopListening = null;
  attract.stop();

  if (to === STATES.INTRO) startIntro();

  if (to === STATES.MENU) {
    intro?.progress(1);
    // Arriving without the intro (dev shortcut): make sure the TV is on.
    if (tvScreen.uniforms.uOpen.value < 1) {
      tvScreen.powerOnInstant(GLOW_ON);
      setLed(LED_ON);
    }
    rig.setPose('menu');
    menuInput.enable();
    cartridges?.setSelected(menu.current.kind === 'project' ? menu.current.slug : null);
    announcer.announce(menu.current.spoken);
  }

  if (to === STATES.INSERTING) rig.setPose('console');
});

// --- Boot sequence -----------------------------------------------------------------------
// Build the scene and the menu, swap in the TV screen, compile every shader up
// front (so the first moves don't stutter), then let the loading screen finish.
Promise.all([buildScene(), menu.ready])
  .then(() => {
    tvScreen.bind();
    led = scene.getObjectByName('LED');
    setLed(LED_STANDBY);
    return renderer.compileAsync(scene, camera);
  })
  .then(() => {
    loader.setProgress(1);
    return loader.finish();
  })
  .then(() => {
    if (getState() === STATES.BOOT) showOpening();
  });

// --- One clock ----------------------------------------------------------------
// GSAP's ticker is the only frame loop. Three.js renders inside it; Lenis will
// hook in here later.
gsap.ticker.lagSmoothing(0);

// Skip rendering while the tab is hidden or an HTML overlay fully covers the canvas.
const COVERING_STATES = new Set([STATES.PROJECT, STATES.FALLBACK_2D]);
const MENU_VISIBLE = new Set([STATES.INTRO, STATES.MENU, STATES.INSERTING]);
let renderPaused = false;
function updatePaused() {
  renderPaused = document.hidden || COVERING_STATES.has(getState());
}
document.addEventListener('visibilitychange', updatePaused);
onStateChange(updatePaused);

function tick(_time, deltaMs) {
  if (renderPaused) return;
  const dt = deltaMs / 1000;
  gamepad.update(dt);
  rig.update(dt);
  if (MENU_VISIBLE.has(getState())) menu.update(dt);
  tvScreen.update(dt);
  cartridges?.update(dt);
  roomWindow.update(dt);
  attract.update(dt);
  renderer.render(scene, camera);
}
gsap.ticker.add(tick);

// --- Dev-only helpers -----------------------------------------------------------
if (import.meta.env.DEV) {
  import('./ui/debug.js').then(({ initDebug }) => initDebug());
  rig.enableDevOrbit(canvas);
  window.__dev = { scene, tvScreen, menu, renderer };
}
