// Gamepad support (standard mapping): d-pad / left stick to move, A to confirm,
// B to go back, Start to start. Polled from the shared GSAP clock, and only while
// a pad is connected. Held directions repeat after a short delay.

const BUTTON = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const STICK_THRESHOLD = 0.5;
const REPEAT_DELAY = 0.4;
const REPEAT_RATE = 0.18;

export function createGamepadInput(onAction) {
  let connected = 0;
  const wasDown = { confirm: false, back: false, start: false };
  let heldDir = 0; // -1 prev, 1 next, 0 none
  let holdClock = 0;

  window.addEventListener('gamepadconnected', () => connected++);
  window.addEventListener('gamepaddisconnected', () => (connected = Math.max(0, connected - 1)));

  function edge(name, down) {
    if (down && !wasDown[name]) onAction(name);
    wasDown[name] = down;
  }

  function update(dt) {
    if (!connected) return;
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    const b = pad.buttons;
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;

    let dir = 0;
    if (b[BUTTON.LEFT]?.pressed || b[BUTTON.UP]?.pressed || x < -STICK_THRESHOLD || y < -STICK_THRESHOLD) dir = -1;
    else if (b[BUTTON.RIGHT]?.pressed || b[BUTTON.DOWN]?.pressed || x > STICK_THRESHOLD || y > STICK_THRESHOLD) dir = 1;

    if (dir !== heldDir) {
      heldDir = dir;
      holdClock = 0;
      if (dir) onAction(dir < 0 ? 'prev' : 'next');
    } else if (dir) {
      holdClock += dt;
      if (holdClock >= REPEAT_DELAY) {
        holdClock -= REPEAT_RATE;
        onAction(dir < 0 ? 'prev' : 'next');
      }
    }

    edge('confirm', !!b[BUTTON.A]?.pressed);
    edge('back', !!b[BUTTON.B]?.pressed);
    edge('start', !!b[BUTTON.START]?.pressed);
  }

  return { update };
}
