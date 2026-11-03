import * as THREE from 'three';
import { gsap } from 'gsap';
import { EASES, DURATIONS } from '../motion/eases.js';
import { LED_ON } from './intro.js';

// INSERTING (original version): the camera eases down to the console, the selected
// cartridge lifts out of the row, arcs over the console and slides down into the
// slot, the LED blinks, and the TV fills with static before the project's title
// screen comes up. Eject is the reverse: it pops up and glides back to its place.
// The cartridge is moved in world space, then handed back to the row afterwards.
// Under reduced motion: no arcs or camera moves, it just appears in place.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const LIFT_HEIGHT = 0.1; // metres above the row while it's carried
const HOVER_ABOVE_SLOT = 0.12; // metres above the slot before it goes down
const SINK = 0.045; // how far it sits inside the console once inserted

const slotWorld = new THREE.Vector3();
const homeWorld = new THREE.Vector3();

function setLed(led, level) {
  if (led) led.material.emissiveIntensity = level;
}

// Pulls the cartridge out of the row (keeping where it is on screen) and remembers
// where it lives, so eject can put it back exactly.
function detach(scene, cart) {
  cart.userData.home = {
    parent: cart.parent,
    position: cart.position.clone(),
    rotationY: cart.rotation.y,
  };
  scene.attach(cart);
}

function reattach(cart) {
  const home = cart.userData.home;
  home.parent.attach(cart);
  cart.position.copy(home.position);
  cart.rotation.set(0, home.rotationY, 0);
}

export function playInsert({ scene, cart, slot, led, rig, tvScreen, onStatic, onComplete }) {
  detach(scene, cart);
  slot.getWorldPosition(slotWorld);
  const finalY = slotWorld.y - SINK;
  const u = tvScreen.uniforms;
  const tl = gsap.timeline({ onComplete });

  if (reducedMotion.matches) {
    rig.setPose('console', { instant: true });
    cart.position.set(slotWorld.x, finalY, slotWorld.z);
    cart.rotation.set(0, 0, 0);
    tl.call(() => {
      setLed(led, LED_ON);
      onStatic?.();
    });
    return tl;
  }

  const startY = cart.position.y;
  tl.add(rig.tweenTo('console', { duration: DURATIONS.insertCamera, ease: EASES.slowDolly }), 0);

  // Lift out of the row.
  tl.to(cart.position, { y: startY + LIFT_HEIGHT, duration: DURATIONS.insertLift, ease: EASES.crtSnap }, 0.1);

  // Arc over to the slot, turning square to it.
  const moveAt = 0.1 + DURATIONS.insertLift * 0.7;
  tl.to(cart.position, { x: slotWorld.x, z: slotWorld.z, duration: DURATIONS.insertMove, ease: EASES.slowDolly }, moveAt);
  tl.to(cart.position, { y: slotWorld.y + HOVER_ABOVE_SLOT, duration: DURATIONS.insertMove, ease: EASES.settle }, moveAt);
  tl.to(cart.rotation, { y: 0, duration: DURATIONS.insertMove, ease: EASES.settle }, moveAt);

  // Down into the slot with a firm snap.
  const pressAt = moveAt + DURATIONS.insertMove;
  tl.to(cart.position, { y: finalY, duration: DURATIONS.insertPress, ease: EASES.crtSnap }, pressAt);

  // LED blinks, TV fills with static, then the camera rises back to the TV.
  const inAt = pressAt + DURATIONS.insertPress;
  for (let i = 0; i < 3; i++) {
    tl.call(() => setLed(led, 0.2), null, inAt + i * DURATIONS.ledBlink * 2);
    tl.call(() => setLed(led, LED_ON), null, inAt + i * DURATIONS.ledBlink * 2 + DURATIONS.ledBlink);
  }
  tl.set(u.uStatic, { value: 1 }, inAt);
  tl.call(() => onStatic?.(), null, inAt + DURATIONS.insertStatic * 0.5);
  tl.to(u.uStatic, { value: 0, duration: DURATIONS.insertStatic * 0.5, ease: EASES.settle }, inAt + DURATIONS.insertStatic * 0.5);
  tl.add(rig.tweenTo('menu', { duration: DURATIONS.insertCamera, ease: EASES.slowDolly }), inAt + 0.05);

  return tl;
}

// Puts a cartridge straight into the slot with no animation (opening a project link).
export function placeInSlot({ scene, cart, slot }) {
  detach(scene, cart);
  slot.getWorldPosition(slotWorld);
  cart.position.set(slotWorld.x, slotWorld.y - SINK, slotWorld.z);
  cart.rotation.set(0, 0, 0);
}

export function playEject({ cart, tvScreen, onStatic, onComplete }) {
  const home = cart.userData.home;
  homeWorld.copy(home.position);
  home.parent.localToWorld(homeWorld);
  const u = tvScreen.uniforms;
  const tl = gsap.timeline({
    onComplete: () => {
      reattach(cart);
      onComplete?.();
    },
  });

  if (reducedMotion.matches) {
    tl.call(() => onStatic?.());
    return tl;
  }

  // Static burst as the picture drops back to the menu.
  tl.set(u.uStatic, { value: 1 }, 0);
  tl.call(() => onStatic?.(), null, 0.12);
  tl.to(u.uStatic, { value: 0, duration: DURATIONS.insertStatic * 0.5, ease: EASES.settle }, 0.12);

  // Pops up, then glides home and settles.
  const popY = cart.position.y + HOVER_ABOVE_SLOT;
  tl.to(cart.position, { y: popY, duration: DURATIONS.ejectPop, ease: EASES.crtSnap }, 0);
  const backAt = DURATIONS.ejectPop * 0.8;
  tl.to(cart.position, { x: homeWorld.x, z: homeWorld.z, duration: DURATIONS.ejectReturn, ease: EASES.slowDolly }, backAt);
  tl.to(cart.position, { y: homeWorld.y, duration: DURATIONS.ejectReturn, ease: EASES.settle }, backAt);
  tl.to(cart.rotation, { y: home.rotationY, duration: DURATIONS.ejectReturn, ease: EASES.settle }, backAt);

  return tl;
}
