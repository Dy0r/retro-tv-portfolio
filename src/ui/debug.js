// Dev-only helper (never ships in the build): shows the current state and lets
// number keys request state changes so the state machine can be tested by hand.
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
  const render = () => {
    label.textContent = `state: ${getState()}${note ? `  ·  ${note}` : ''}`;
  };

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
