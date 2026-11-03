// "Attract mode" for the TV: on the opening room shot the screen flickers in
// uneven bursts, like a CRT struggling to switch on, to pull the eye to it.
// It drives the TV screen's standby glow (see screen/tvScreen.js), so it works
// the same with the placeholder TV and a real tv.glb.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Brightness multipliers over the TV's normal standby glow.
const LEVEL = { standby: 0.35, steady: 1.2 };

// One flicker burst: [seconds since the burst started, brightness].
const BURST = [
  [0.0, 1.9],
  [0.05, 0.3],
  [0.09, 2.4],
  [0.15, 0.45],
  [0.2, 2.8],
  [0.3, 0.6],
  [0.36, 1.6],
  [0.44, LEVEL.standby],
];
const BURST_LENGTH = BURST[BURST.length - 1][0];

export function createAttract(tvScreen) {
  let active = false;
  let clock = 0;
  let nextBurst = 0.6;

  function start() {
    active = true;
    clock = 0;
    nextBurst = 0.6;
    tvScreen.setStandby(reducedMotion.matches ? LEVEL.steady : LEVEL.standby);
  }

  function stop() {
    active = false;
  }

  function update(dt) {
    if (!active || reducedMotion.matches) return;
    clock += dt;
    if (clock < nextBurst) return;

    const t = clock - nextBurst;
    if (t >= BURST_LENGTH) {
      tvScreen.setStandby(LEVEL.standby);
      clock = 0;
      nextBurst = 2 + Math.random() * 2.5;
      return;
    }
    let level = LEVEL.standby;
    for (let i = 0; i < BURST.length; i++) {
      if (t >= BURST[i][0]) level = BURST[i][1];
    }
    tvScreen.setStandby(level);
  }

  return { start, stop, update };
}
