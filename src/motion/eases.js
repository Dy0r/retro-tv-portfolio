// Named eases and durations — filled in once the design direction is chosen.
// Every animation on the site will import its ease and duration from here
// (e.g. crtSnap, slowDolly) via GSAP CustomEase. No default power1 / 0.3s fades.

export const EASES = {};
// Seconds. Provisional until the motion direction is chosen.
export const DURATIONS = {
  introGlide: 1.6, // time from "enter" to the menu, until the real INTRO pass
};

// Damping rates (per second) for things that chase a target every frame.
// Higher = snappier. Provisional until the motion direction is chosen.
export const DAMPING = {
  camera: 3.5,
};
