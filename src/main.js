import * as THREE from 'three';
import { gsap } from 'gsap';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import projects from './content/projects.js';
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
import { createCameraRig, fovForAspect } from './scene/camera.js';
import { createPostFx } from './scene/postfx.js';
import { createAttract } from './scene/attract.js';
import { playIntro, playOutro, LED_ON, LED_STANDBY, GLOW_ON } from './scene/intro.js';
import { playInsert, playEject, placeInSlot } from './scene/insert.js';
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
import { createCaseStudy } from './ui/caseStudy.js';
import { createSfx } from './audio/sfx.js';
import { createMusicPlayer } from './audio/musicPlayer.js';
import { dialogEvents } from './ui/framedDialog.js';
import { EASES, DURATIONS } from './motion/eases.js';

// --- Loading screen ---------------------------------------------------------------
// Starts straight away; real progress comes from the shared LoadingManager.
const loader = createLoader();
loadingManager.onProgress = (_url, loaded, total) => loader.setProgress((loaded / total) * 0.9);
// Let the browser paint the loading screen before the heavy scene set-up below,
// so it shows straight away even on slow phones.
await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

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
const camera = new THREE.PerspectiveCamera(fovForAspect(window.innerWidth / window.innerHeight), window.innerWidth / window.innerHeight, 0.05, 30);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(w, h, false);
  postFx.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  camera.fov = fovForAspect(camera.aspect);
  camera.updateProjectionMatrix();
  rig.refit();
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
// `width`: metres that must stay in view on a phone held upright; `narrowShift`
// re-centres the menu on the TV there (see scene/camera.js).
const poses = {
  wide: { position: new THREE.Vector3(1.9, 1.5, 2.7), lookAt: new THREE.Vector3(-0.35, 1.05, -0.8), width: 2.0 },
  menu: { position: new THREE.Vector3(0.15, 0.78, 0.44), lookAt: new THREE.Vector3(0.13, 0.65, -0.65), width: 0.68, narrowShift: new THREE.Vector3(-0.13, -0.02, 0) },
  console: { position: new THREE.Vector3(0.12, 0.86, -0.06), lookAt: new THREE.Vector3(0.06, standTop + 0.03, -0.52), width: 0.55 },
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
  // The lamp points at the console, so the cartridge row only gets its soft edge
  // (bright cartridge colours like yellow otherwise read as glowing).
  scene.add(buildLights({ screenCenter, lampTarget: new THREE.Vector3(-0.05, standTop, -0.55) }));

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

// --- Sound -------------------------------------------------------------------------
// Sound effects are on by default (they start after the first click, tap or key,
// as browsers require). Music only plays when someone presses play on the player.
const sfx = createSfx();
const music = createMusicPlayer();
dialogEvents.addEventListener('open', () => sfx.open());
dialogEvents.addEventListener('close', () => sfx.close());

// --- Menu ---------------------------------------------------------------------------
const menu = createMenu({
  projects,
  pages: site.menuPages,
  tvScreen,
  onChange(item, delta) {
    if (delta) {
      sfx.blip(delta);
      sfx.static(DURATIONS.menuStatic);
    }
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
  sfx.powerOn();
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
  else if (state === STATES.PROJECT && action === 'prev') caseStudy.scrollBy(-240);
  else if (state === STATES.PROJECT && action === 'next') caseStudy.scrollBy(240);
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
  if (getState() !== STATES.MENU) return;
  if (item.kind === 'page') openPage(item.slug);
  else transition(STATES.INSERTING, { slug: item.slug });
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
    onSeat: () => sfx.insert(),
    onStatic: () => menu.setPlaying(true),
    onComplete: () => transition(STATES.PROJECT, { slug }),
  });
  if (import.meta.env.DEV) window.__dev.timeline = tl;
}

// The case study opens a moment after the cartridge is in, over the title screen.
// Closing it (X, Esc, click outside, gamepad B) ejects the cartridge.
let caseCovering = false;
let caseOpenCall = null;
const caseStudy = createCaseStudy({
  onOpened: () => {
    caseCovering = true;
    updatePaused();
  },
  onClosing: () => {
    caseCovering = false;
    updatePaused();
  },
  // Closing a project ejects its cartridge; closing a page just returns to the menu.
  onClosed: () => {
    if (readingPage) readingPage = false;
    else ejectCartridge();
  },
});

// About / Contact / Credits open in the same reader, straight from the menu (no cartridge).
let readingPage = false;
function openPage(id) {
  const page = site.menuPages.find((p) => p.id === id);
  if (!page) return;
  readingPage = true;
  caseStudy.openPage(page);
}

function openCaseStudy(slug) {
  const index = projects.findIndex((p) => p.slug === slug);
  caseOpenCall = gsap.delayedCall(DURATIONS.caseOpenDelay, () => {
    if (getState() === STATES.PROJECT) caseStudy.open(projects[index], index, projects.length);
  });
}

// Every way of leaving a project goes through here: close the case study first
// (which then ejects), or eject straight away if it isn't open.
function eject() {
  if (caseStudy.isOpen) {
    caseStudy.close();
    return;
  }
  ejectCartridge();
}

function ejectCartridge() {
  if (getState() !== STATES.PROJECT || ejecting || !inserted) return;
  caseOpenCall?.kill();
  ejecting = true;
  zoomOutButton.hide();
  cartMarker.hide();
  sfx.eject();
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
  // Inside a pop-up (case study, enlarged image), that pop-up handles Esc itself,
  // so the topmost one closes first.
  if (e.target.closest?.('dialog')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    eject();
  }
}

// --- Deep links: /#/project/<slug> --------------------------------------------------
// Opening a project's link skips the opening shot and the intro: it lands straight
// in that project with its cartridge already in. Opening a project updates the
// address bar, and the browser's Back button closes it (ejecting the cartridge).
const PROJECT_HASH = /^#\/project\/([\w-]+)$/;
let projectEntryPushed = false; // did we add the project's address to the history?

function slugFromHash() {
  const match = window.location.hash.match(PROJECT_HASH);
  return match && projects.some((p) => p.slug === match[1]) ? match[1] : null;
}

function setProjectHash(slug) {
  if (window.location.hash === `#/project/${slug}`) return;
  history.pushState(null, '', `#/project/${slug}`);
  projectEntryPushed = true;
}

function clearProjectHash() {
  if (!slugFromHash()) return;
  if (projectEntryPushed) history.back();
  else history.replaceState(null, '', window.location.pathname + window.location.search);
  projectEntryPushed = false;
}

window.addEventListener('hashchange', () => {
  const slug = slugFromHash();
  const state = getState();
  if (state === STATES.PROJECT && slug !== inserted?.slug) {
    projectEntryPushed = false; // the browser already left the project's address
    eject();
  } else if (state === STATES.MENU && slug) {
    menu.jumpTo(slug);
    playSelected();
  }
});

function enterProjectDirectly(slug) {
  openingReady = true; // so zooming out later shows the opening shot as normal
  tvScreen.powerOnInstant(GLOW_ON);
  setLed(LED_ON);
  rig.setPose('menu', { instant: true });
  menu.jumpTo(slug);
  menu.setPlaying(true);
  const cart = cartridges.bySlug.get(slug);
  inserted = { slug, cart };
  cartridges.hold(slug);
  cartridges.setSelected(null);
  placeInSlot({ scene, cart, slot });
  transition(STATES.PROJECT, { slug });
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
  if (to === STATES.MENU) {
    showSelectionCues();
    if (from === STATES.PROJECT) clearProjectHash();
  } else {
    insertButton.setVisible(false);
    if (to !== STATES.PROJECT) cartMarker.hide();
  }

  if (to === STATES.BOOT) {
    intro?.kill();
    intro = null;
    cartridges?.setSelected(null);
    if (from === STATES.MENU) {
      sfx.powerOff();
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
  if (to === STATES.PROJECT) {
    announcer.announce(menu.current.spoken);
    setProjectHash(data.slug);
    openCaseStudy(data.slug);
  }
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
      poses.resume = { position: center.clone().add(new THREE.Vector3(0, 0.02, 0.9)), lookAt: center, width: 0.5 };
    }
    setLed(LED_STANDBY);
    return renderer.compileAsync(scene, camera).then(() => postFx.render(0)); // warm up the post passes too
  })
  .then(() => {
    loader.setProgress(1);
    return loader.finish();
  })
  .then(() => {
    music.setVisible(true);
    if (getState() !== STATES.BOOT) return;
    const deepLink = slugFromHash();
    if (deepLink) enterProjectDirectly(deepLink);
    else showOpening();
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
  renderPaused = document.hidden || resumeCovering || caseCovering || COVERING_STATES.has(getState());
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
  window.__dev = {
    scene,
    camera,
    tvScreen,
    menu,
    renderer,
    // Saves the current view as the 1200x630 link-preview image (public/og-image.jpg).
    async saveShareImage() {
      postFx.render(0);
      const shot = document.createElement('canvas');
      shot.width = 1200;
      shot.height = 630;
      const ctx = shot.getContext('2d');
      const src = renderer.domElement;
      const scale = Math.max(shot.width / src.width, shot.height / src.height);
      const w = src.width * scale;
      const h = src.height * scale;
      ctx.drawImage(src, (shot.width - w) / 2, (shot.height - h) / 2, w, h);
      const res = await fetch('/__dev/save-share-image', { method: 'POST', body: shot.toDataURL('image/jpeg', 0.88) });
      return res.text();
    },
  };
}
