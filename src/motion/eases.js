import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

// Named eases and durations. Every animation on the site imports its ease and
// duration from here. No default power1 / 0.3s fades. All values provisional
// until the motion direction is chosen.

gsap.registerPlugin(CustomEase);

export const EASES = {
  // Fast in, tiny overshoot, settle: CRT snaps, shape morphs, UI hits.
  crtSnap: CustomEase.create('crtSnap', 'M0,0 C0.14,0.86 0.22,1.08 0.46,1.04 0.7,1 0.8,1 1,1'),
  // Slow start, long glide, soft landing: camera moves.
  slowDolly: CustomEase.create('slowDolly', 'M0,0 C0.45,0 0.18,1 1,1'),
  // Gentle ease-out for things fading or calming down.
  settle: CustomEase.create('settle', 'M0,0 C0.2,0.6 0.35,1 1,1'),
};

// Seconds.
export const DURATIONS = {
  loaderHold: 0.2, // rounded square before it morphs
  loaderMorph: 0.6, // rounded square -> star
  loaderRing: 0.5, // ring pulse as the star lands
  introDolly: 2.0, // camera from the room into the TV
  powerLine: 0.18, // dot -> thin bright line
  powerOpen: 0.22, // line -> full screen
  powerSettle: 0.45, // flash fades, picture settles
  menuSlide: 0.28, // one project to the next
  menuStatic: 0.12, // burst of static between projects
  resumeZoom: 0.9, // camera glides up to the resume poster
  powerOff: 0.32, // picture collapses to a line, then a dot
  outroDolly: 1.5, // camera glides from the TV back out to the room
  screenGlitch: 0.2, // a rare on/off flicker on the TV picture
};

// Damping rates (per second) for things that chase a target every frame.
// Higher = snappier.
export const DAMPING = {
  camera: 3.5,
  cartridge: 9,
};
