// Listens for the visitor's first "let's go": scrolling, Enter, Space, a click,
// or a tap / swipe on a phone. Fires `onStart` exactly once, then stops listening.
// Scrolling is accumulated, so one trackpad flick counts once, and a tiny
// accidental nudge (or slow drift) doesn't count at all.

const WHEEL_THRESHOLD = 80;
const WHEEL_RESET_MS = 250;

// `ignore(e)` can veto a click/tap, e.g. when it lands on the resume poster.
export function listenForStart(onStart, { target = window, ignore } = {}) {
  let wheelTotal = 0;
  let lastWheel = 0;

  function fire() {
    stop();
    onStart();
  }

  function onWheel(e) {
    if (e.timeStamp - lastWheel > WHEEL_RESET_MS) wheelTotal = 0;
    lastWheel = e.timeStamp;
    wheelTotal += Math.abs(e.deltaY) + Math.abs(e.deltaX);
    if (wheelTotal >= WHEEL_THRESHOLD) fire();
  }

  function onKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest?.('button, a, dialog')) return; // a focused button does its own thing
    e.preventDefault();
    fire();
  }

  // pointerup covers mouse clicks, taps and the end of a swipe.
  function onPointerUp(e) {
    // Clicks on buttons, links, pop-ups and on-page panels ([data-ui]) aren't "enter".
    if (e.target.closest?.('button, a, dialog, [data-ui]')) return;
    if (ignore?.(e)) return;
    fire();
  }

  function stop() {
    target.removeEventListener('wheel', onWheel);
    target.removeEventListener('keydown', onKey);
    target.removeEventListener('pointerup', onPointerUp);
  }

  target.addEventListener('wheel', onWheel, { passive: true });
  target.addEventListener('keydown', onKey);
  target.addEventListener('pointerup', onPointerUp);
  return stop;
}
