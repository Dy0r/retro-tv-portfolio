// The site's state machine: which "screen" the experience is on, and which moves are legal.
// Everything else (scene, UI, input) listens here instead of tracking its own mode.

export const STATES = Object.freeze({
  BOOT: 'BOOT',
  INTRO: 'INTRO',
  MENU: 'MENU',
  INSERTING: 'INSERTING',
  PROJECT: 'PROJECT',
  FALLBACK_2D: 'FALLBACK_2D',
  RESUME: 'RESUME',
});

const { BOOT, INTRO, MENU, INSERTING, PROJECT, FALLBACK_2D, RESUME } = STATES;

// Allowed moves. FALLBACK_2D is reachable from anywhere (added below).
// BOOT -> PROJECT is the deep-link path (/#/project/<slug> skips BOOT and INTRO).
// RESUME is the resume overlay, opened from the room shot or the menu; it returns
// to wherever it was opened from. MENU -> BOOT is "zoom out" back to the opening shot.
const TRANSITIONS = {
  [BOOT]: [INTRO, PROJECT, RESUME],
  [INTRO]: [MENU],
  [MENU]: [INSERTING, RESUME, BOOT],
  [RESUME]: [BOOT, MENU],
  [INSERTING]: [PROJECT],
  [PROJECT]: [MENU],
  [FALLBACK_2D]: [BOOT, MENU],
};
for (const key of Object.keys(TRANSITIONS)) {
  if (key !== FALLBACK_2D) TRANSITIONS[key].push(FALLBACK_2D);
}

let current = BOOT;
let payload = null;
const listeners = new Set();

export function getState() {
  return current;
}

export function getPayload() {
  return payload;
}

export function canTransition(to) {
  return TRANSITIONS[current].includes(to);
}

// Returns true if the move happened. Illegal moves are refused, never forced.
export function transition(to, data = null) {
  if (!canTransition(to)) return false;
  const from = current;
  current = to;
  payload = data;
  for (const fn of listeners) fn({ from, to, data });
  return true;
}

// Subscribe to state changes. Returns an unsubscribe function.
export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
