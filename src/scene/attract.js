// "Attract mode" for the TV: on the opening room shot the screen flickers in
// uneven bursts, like a CRT struggling to switch on, to pull the eye to it.
// It finds the screen and its glow light by name (Screen, CRTGlow), so it works
// the same with the placeholder TV and a real tv.glb.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Brightness multipliers over the TV's normal glow.
const LEVEL = { standby: 0.35, steady: 1.2, on: 2.2 };

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

export function createAttract(scene) {
  let screenMaterial = null;
  let glow = null;
  let baseEmissive = 0;
  let baseGlow = 0;
  let mode = 'idle';
  let clock = 0;
  let nextBurst = 0.6;

  function apply(level) {
    if (screenMaterial) screenMaterial.emissiveIntensity = baseEmissive * level;
    if (glow) glow.intensity = baseGlow * level;
  }

  // Call once the TV is in the scene.
  function bind() {
    const screen = scene.getObjectByName('Screen');
    screenMaterial = screen?.material ?? null;
    glow = scene.getObjectByName('CRTGlow') ?? null;
    baseEmissive = screenMaterial?.emissiveIntensity || 0.12;
    baseGlow = glow?.intensity ?? 0;
    setMode(mode);
  }

  // 'flicker' on the opening shot, 'on' once the visitor has entered.
  function setMode(next) {
    mode = next;
    clock = 0;
    nextBurst = 0.6;
    if (mode === 'on') apply(LEVEL.on);
    else if (mode === 'flicker') apply(reducedMotion.matches ? LEVEL.steady : LEVEL.standby);
  }

  function update(dt) {
    if (mode !== 'flicker' || reducedMotion.matches) return;
    clock += dt;
    if (clock < nextBurst) return;

    const t = clock - nextBurst;
    if (t >= BURST_LENGTH) {
      apply(LEVEL.standby);
      clock = 0;
      nextBurst = 2 + Math.random() * 2.5;
      return;
    }
    let level = LEVEL.standby;
    for (let i = 0; i < BURST.length; i++) {
      if (t >= BURST[i][0]) level = BURST[i][1];
    }
    apply(level);
  }

  return { bind, setMode, update };
}
