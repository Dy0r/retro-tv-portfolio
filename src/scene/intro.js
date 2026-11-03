import { gsap } from 'gsap';
import { EASES, DURATIONS } from '../motion/eases.js';

// INTRO: the TV powers on while the camera dollies in from the room.
//   0.00  console LED clicks on, TV drops to black
//   0.05  camera starts its slow dolly toward the TV (2 s)
//   0.15  a bright dot snaps sideways into a thin line
//   0.36  the line snaps open to fill the screen; white flash lights the room
//   0.50  flash fades and the menu settles in
// About 2.05 s in total. Returns the GSAP timeline; `progress(1)` skips to the end.
// Under reduced motion: no flash or long move, just a quick fade-in.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export const LED_ON = 3;
export const LED_STANDBY = 0.35;
const GLOW_FLASH = 6; // CRT light multiplier during the flash
export const GLOW_ON = 2.2; // CRT light multiplier while the TV is on
const GLOW_STANDBY = 0.35; // CRT light while off, matching the opening flicker's resting level

export function playIntro({ rig, tvScreen, led, onComplete }) {
  const u = tvScreen.uniforms;
  const glow = tvScreen.glow;
  const base = tvScreen.baseGlow;

  const tl = gsap.timeline({ onComplete });

  if (reducedMotion.matches) {
    rig.setPose('menu', { instant: true });
    tl.call(() => {
      if (led) led.material.emissiveIntensity = LED_ON;
      tvScreen.setStandby(0);
      u.uLine.value = 1;
      u.uOpen.value = 1;
      if (glow) glow.intensity = base * GLOW_ON;
    }).fromTo(u.uContent, { value: 0 }, { value: 1, duration: DURATIONS.powerSettle, ease: EASES.settle });
    return tl;
  }

  tl.call(() => {
    if (led) led.material.emissiveIntensity = LED_ON;
    tvScreen.setStandby(0);
    u.uLine.value = 0;
    u.uOpen.value = 0;
    u.uContent.value = 0;
    u.uFlash.value = 2.5;
  });

  tl.add(rig.tweenTo('menu', { duration: DURATIONS.introDolly, ease: EASES.slowDolly }), 0.05);

  tl.fromTo(u.uLine, { value: 0 }, { value: 1, duration: DURATIONS.powerLine, ease: EASES.crtSnap }, 0.15);

  const openAt = 0.15 + DURATIONS.powerLine + 0.03;
  tl.to(u.uOpen, { value: 1, duration: DURATIONS.powerOpen, ease: EASES.crtSnap }, openAt);
  if (glow) {
    tl.to(glow, { intensity: base * GLOW_FLASH, duration: DURATIONS.powerOpen, ease: EASES.crtSnap }, openAt);
    tl.to(glow, { intensity: base * GLOW_ON, duration: DURATIONS.powerSettle, ease: EASES.settle }, openAt + DURATIONS.powerOpen);
  }

  const settleAt = openAt + DURATIONS.powerOpen * 0.6;
  tl.to(u.uFlash, { value: 0, duration: DURATIONS.powerSettle, ease: EASES.settle }, settleAt);
  tl.fromTo(u.uContent, { value: 0 }, { value: 1, duration: DURATIONS.powerSettle, ease: EASES.settle }, settleAt);

  return tl;
}

// Zoom out: the reverse. The picture collapses to a bright line, the line shrinks
// to a dot and goes dark, the LED drops to standby, and the camera glides back out
// to the room shot. Under reduced motion: TV off and camera back, no animation.
export function playOutro({ rig, tvScreen, led, onComplete }) {
  const u = tvScreen.uniforms;
  const glow = tvScreen.glow;
  const base = tvScreen.baseGlow;
  const tl = gsap.timeline({ onComplete });

  if (reducedMotion.matches) {
    rig.setPose('wide', { instant: true });
    tl.call(() => {
      tvScreen.reset();
      if (led) led.material.emissiveIntensity = LED_STANDBY;
    });
    return tl;
  }

  const half = DURATIONS.powerOff / 2;
  tl.to(u.uContent, { value: 0, duration: half, ease: EASES.settle }, 0);
  tl.to(u.uFlash, { value: 1.6, duration: half, ease: EASES.crtSnap }, 0);
  tl.to(u.uOpen, { value: 0, duration: half, ease: EASES.crtSnap }, 0);
  tl.to(u.uLine, { value: 0, duration: half, ease: EASES.crtSnap }, half);
  tl.to(u.uFlash, { value: 0, duration: half, ease: EASES.settle }, half);
  if (glow) tl.to(glow, { intensity: base * GLOW_STANDBY, duration: DURATIONS.powerOff, ease: EASES.settle }, 0);
  tl.call(() => {
    if (led) led.material.emissiveIntensity = LED_STANDBY;
  }, null, half);

  tl.add(rig.tweenTo('wide', { duration: DURATIONS.outroDolly, ease: EASES.slowDolly }), 0.1);
  return tl;
}
