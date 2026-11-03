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
import { buildNeonSigns } from './scene/neonSigns.js';
import { createCameraRig } from './scene/camera.js';
import { createPostFx } from './scene/postfx.js';
import { createAttract } from './scene/attract.js';
import { playIntro, playOutro, LED_ON, LED_STANDBY, GLOW_ON } from './scene/intro.js';
import { playInsert, playEject } from './scene/insert.js';
import { createTvScreen } from './screen/tvScreen.js';
import { createMenu } from './screen/menu.js';
import { createLoader } from './ui/loader.js';
import { createEnterHint } from './ui/enterHint.js';
import { createAnnouncer } from './ui/announcer.js';
import { createZoomOutButton, createInsertButton } from './ui/zoomOutButton.js';
import { createCartMarker } from './scene/cartMarker.js';
import { listenForStart } from './input/start.js';
import { createMenuInput } from './input/menuInput.js';
import { createGamepadInput } from './input/gamepad.js';
import { createPosterInput } from './input/posterInput.js';
import { createResumeOverlay, createResumeButton } from './ui/resumeOverlay.js';
import { EASES, DURATIONS } from './motion/eases.js';

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
  postFx.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// Bloom + colour grade on every frame (see scene/postfx.js).
const postFx = createPostFx(renderer, scene, camera);

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
// ("resume" is added once the poster is in the scene: see the boot sequence.)
const poses = {
  wide: { position: new THREE.Vector3(1.9, 1.5, 2.7), lookAt: new THREE.Vector3(-0.35, 1.05, -0.8) },
  menu: { position: new THREE.Vector3(0.12, 0.8, 0.62), lookAt: new THREE.Vector3(0.07, 0.66, -0.65) },
  console: { position: new THREE.Vector3(0.12, 0.86, -0.06), lookAt: new THREE.Vector3(0.06, standTop + 0.03, -0.52) },
};
const rig = createCameraRig(camera, poses);
rig.setPose('wide', { instant: true });

const roomWindow = buildWindow();
const cartMarker = createCartMarker(scene);
const neonSigns = buildNeonSigns();
const tvScreen = createTvScreen(scene);
const attract = createAttract(tvScreen);
const announcer = createAnnouncer();
let cartridges = null;
let cartridgeRow = null;
let led = null;

async function buildScene() {
  scene.add(buildRoom());
  scene.add(roomWindow.group);
  scene.add(neonSigns.group);
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
    showSelectionCues();
  },
});

const menuInput = createMenuInput({
  canvas,
  camera,
  menu,
  getScreen: () => tvScreen.mesh,
  getCartridgeRow: () => cartridgeRow,
  getMarker: () => cartMarker.sprite,
  onBack: zoomOut,
  onSelect: playSelected,
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
  stopListening = listenForStart(enter, { ignore: posterInput.hitsPoster });
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
  else if (state === STATES.MENU && action === 'back') zoomOut();
  else if (state === STATES.MENU && action === 'confirm') playSelected();
  else if (state === STATES.PROJECT && action === 'back') eject();
  else if (state === STATES.RESUME && action === 'back') resumeOverlay.close();
});

// --- Resume: click the poster (or Tab to the hidden button) ---------------------------
// The camera glides up to the poster, then the resume opens in a framed overlay.
// Closing returns to wherever it was opened from (room shot or menu).
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let resumePoster = null;
let resumeReturn = null;
let resumeOpenCall = null;

function canOpenResume() {
  const state = getState();
  return (state === STATES.BOOT && openingReady) || state === STATES.MENU;
}

function openResume() {
  if (!canOpenResume()) return;
  resumeReturn = getState();
  transition(STATES.RESUME);
}

// While the resume is fully open the scene sits behind a dark backdrop, so the 3D
// render pauses to save battery; it resumes as soon as the frame starts closing.
let resumeCovering = false;
const resumeOverlay = createResumeOverlay({
  onOpened: () => {
    resumeCovering = true;
    updatePaused();
  },
  onClosing: () => {
    resumeCovering = false;
    updatePaused();
  },
  onClose: () => transition(resumeReturn),
});
createResumeButton({ onActivate: openResume });

const posterInput = createPosterInput({
  canvas,
  camera,
  getPoster: () => resumePoster,
  canOpen: canOpenResume,
  onOpen: openResume,
});

function showResume() {
  if (reducedMotion.matches) {
    rig.setPose('resume', { instant: true });
    resumeOverlay.open();
    return;
  }
  rig.tweenTo('resume', { duration: DURATIONS.resumeZoom, ease: EASES.slowDolly });
  // Open the frame as the camera nears the poster.
  resumeOpenCall = gsap.delayedCall(DURATIONS.resumeZoom * 0.6, () => resumeOverlay.open());
}

// --- Zoom out: back to the opening room shot (button top-left, Esc, gamepad B) --------
// The TV switches off (picture collapses to a line, then a dot) while the camera
// glides back out; then the opening flicker and "Scroll to switch on" return.
let outro = null;

function zoomOut() {
  if (getState() === STATES.MENU) transition(STATES.BOOT);
}

// --- Cartridge in / out ------------------------------------------------------------
// Enter, a click on the screen (or on the selected cartridge), or gamepad A puts the
// selected project's cartridge in. Until the case-study overlay exists, the TV then
// shows that project's title screen; Eject (button, Esc, gamepad B) takes it out.
let slot = null;
let inserted = null; // { slug, cart } while a cartridge is in the console
let ejecting = false;

// Make the selection obvious in the menu: the Insert button (bottom-right) and a
// pixel arrow over the selected cartridge, both only while a project is selected.
const insertButton = createInsertButton({ onActivate: playSelected });

function showSelectionCues() {
  if (getState() !== STATES.MENU) return;
  const item = menu.current;
  const isProject = item.kind === 'project';
  insertButton.setVisible(isProject);
  if (isProject) cartMarker.pointDown(cartridges?.bySlug.get(item.slug));
  else cartMarker.hide();
}

// Once a cartridge is in: clicking it, or the arrows above it, ejects it.
const ejectRay = new THREE.Raycaster();
const ejectPointer = new THREE.Vector2();
const ejectHits = [];
function onProjectPointerUp(e) {
  if (!inserted) return;
  const rect = canvas.getBoundingClientRect();
  ejectPointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ejectRay.setFromCamera(ejectPointer, camera);
  ejectHits.length = 0;
  ejectRay.intersectObjects([cartMarker.sprite, inserted.cart], true, ejectHits);
  if (ejectHits.length) eject();
}

function playSelected() {
  const item = menu.current;
  if (getState() !== STATES.MENU || item.kind !== 'project') return;
  transition(STATES.INSERTING, { slug: item.slug });
}

function startInsert(slug) {
  const cart = cartridges.bySlug.get(slug);
  inserted = { slug, cart };
  cartridges.hold(slug);
  cartridges.setSelected(null);
  const tl = playInsert({
    scene,
    cart,
    slot,
    led,
    rig,
    tvScreen,
    onStatic: () => menu.setPlaying(true),
    onComplete: () => transition(STATES.PROJECT, { slug }),
  });
  if (import.meta.env.DEV) window.__dev.timeline = tl;
}

function eject() {
  if (getState() !== STATES.PROJECT || ejecting || !inserted) return;
  ejecting = true;
  zoomOutButton.hide();
  cartMarker.hide();
  playEject({
    cart: inserted.cart,
    tvScreen,
    onStatic: () => menu.setPlaying(false),
    onComplete: () => {
      ejecting = false;
      inserted = null;
      cartridges.hold(null);
      transition(STATES.MENU);
    },
  });
}

function onProjectKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    eject();
  }
}

// One button, top-left: "Zoom out" in the menu, "Eject" once a cartridge is in.
const zoomOutButton = createZoomOutButton({
  onActivate: () => (getState() === STATES.PROJECT ? eject() : zoomOut()),
});

// --- State changes --------------------------------------------------------------------
onStateChange(({ from, to, data }) => {
  if (to !== STATES.INTRO) stopIntroListeners();
  if (to !== STATES.MENU) menuInput.disable();

  if (to === STATES.MENU) zoomOutButton.show('zoomOut');
  else if (to === STATES.PROJECT) zoomOutButton.show('eject');
  else zoomOutButton.hide();
  if (to === STATES.PROJECT) {
    window.addEventListener('keydown', onProjectKey);
    canvas.addEventListener('pointerup', onProjectPointerUp);
    cartMarker.pointUp(inserted?.cart);
  } else {
    window.removeEventListener('keydown', onProjectKey);
    canvas.removeEventListener('pointerup', onProjectPointerUp);
  }
  if (to === STATES.MENU) showSelectionCues();
  else {
    insertButton.setVisible(false);
    if (to !== STATES.PROJECT) cartMarker.hide();
  }

  if (to === STATES.BOOT) {
    intro?.kill();
    intro = null;
    cartridges?.setSelected(null);
    if (from === STATES.MENU) {
      outro = playOutro({
        rig,
        tvScreen,
        led,
        onComplete: () => {
          outro = null;
          tvScreen.reset();
          if (getState() === STATES.BOOT && openingReady) showOpening();
        },
      });
    } else {
      tvScreen.reset();
      rig.setPose('wide');
      if (openingReady) showOpening();
    }
    return;
  }

  // Anything else interrupts a zoom-out still in progress.
  outro?.kill();
  outro = null;

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

  if (to === STATES.INSERTING) startInsert(data.slug);
  if (to === STATES.PROJECT) announcer.announce(menu.current.spoken);
  if (to === STATES.RESUME) showResume();
  else {
    resumeOpenCall?.kill();
    resumeOpenCall = null;
  }
});

// --- Boot sequence -----------------------------------------------------------------------
// Build the scene and the menu, swap in the TV screen, compile every shader up
// front (so the first moves don't stutter), then let the loading screen finish.
Promise.all([buildScene(), menu.ready])
  .then(() => {
    tvScreen.bind();
    led = scene.getObjectByName('LED');
    slot = scene.getObjectByName('Slot');
    // Frame the resume poster straight on, close enough that it fills the view.
    resumePoster = scene.getObjectByName('ResumePoster');
    if (resumePoster) {
      const center = resumePoster.getWorldPosition(new THREE.Vector3());
      poses.resume = { position: center.clone().add(new THREE.Vector3(0, 0.02, 0.9)), lookAt: center };
    }
    setLed(LED_STANDBY);
    return renderer.compileAsync(scene, camera).then(() => postFx.render(0)); // warm up the post passes too
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
// (PROJECT joins this once the case-study overlay exists; for now it shows the TV.)
const COVERING_STATES = new Set([STATES.FALLBACK_2D]);
const MENU_VISIBLE = new Set([STATES.INTRO, STATES.MENU, STATES.INSERTING, STATES.PROJECT]);
let renderPaused = false;
function updatePaused() {
  renderPaused = document.hidden || resumeCovering || COVERING_STATES.has(getState());
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
  cartMarker.update(dt);
  posterInput.update(dt);
  roomWindow.update(dt);
  neonSigns.update(dt);
  attract.update(dt);
  postFx.render(dt);
}
gsap.ticker.add(tick);

// --- Dev-only helpers -----------------------------------------------------------
if (import.meta.env.DEV) {
  import('./ui/debug.js').then(({ initDebug }) => initDebug());
  rig.enableDevOrbit(canvas);
  window.__dev = { scene, tvScreen, menu, renderer };
}
