// Dev-only helper (never ships in the build): shows the current state and lets
// number keys request state changes so the state machine can be tested by hand.
// Also shows frames per second and the slowest frame in the last second.
import { gsap } from 'gsap';
import { STATES, getState, transition, onStateChange } from '../state.js';

const KEY_TO_STATE = {
  1: STATES.BOOT,
  2: STATES.INTRO,
  3: STATES.MENU,
  4: STATES.INSERTING,
  5: STATES.PROJECT,
  6: STATES.FALLBACK_2D,
};

export function initDebug() {
  const label = document.createElement('div');
  label.className = 'debug-state';
  label.setAttribute('aria-hidden', 'true');
  document.body.appendChild(label);

  let note = '';
  let fps = 0;
  let worstMs = 0;
  const render = () => {
    label.textContent = `state: ${getState()}  ·  ${fps} fps, worst ${worstMs} ms${note ? `  ·  ${note}` : ''}`;
  };

  // Frame-rate readout, sampled once a second from the shared GSAP clock.
  let frames = 0;
  let elapsed = 0;
  let worst = 0;
  gsap.ticker.add((_time, deltaMs) => {
    frames++;
    elapsed += deltaMs;
    worst = Math.max(worst, deltaMs);
    if (elapsed < 1000) return;
    fps = Math.round((frames * 1000) / elapsed);
    worstMs = Math.round(worst);
    frames = 0;
    elapsed = 0;
    worst = 0;
    render();
  });

  onStateChange(({ from, to }) => {
    note = `${from} → ${to}`;
    render();
  });

  window.addEventListener('keydown', (e) => {
    const target = KEY_TO_STATE[e.key];
    if (!target) return;
    if (!transition(target)) {
      note = `refused: ${getState()} → ${target}`;
      render();
    }
  });

  render();
}
