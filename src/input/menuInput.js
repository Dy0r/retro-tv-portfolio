import * as THREE from 'three';

// Menu controls, active only while the menu is up:
//  - keyboard: ←/→ or A/D (↑/↓ or W/S also work)
//  - mouse: hover and click the arrows on the TV screen, or click a cartridge
//  - trackpad / wheel: STEPPED, one item per gesture, then a short cooldown
//  - touch: swipe left/right, or tap an arrow or a cartridge
// Screen hits are found by raycasting onto the screen and reading its UV.

const WHEEL_THRESHOLD = 60;
const WHEEL_COOLDOWN_MS = 380;
const SWIPE_MIN_PX = 40;
const TAP_MAX_PX = 10;

export function createMenuInput({ canvas, camera, menu, getScreen, getCartridgeRow }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hits = [];
  let active = false;

  let wheelTotal = 0;
  let wheelLockedUntil = 0;
  let lastWheel = 0;
  let downX = 0;
  let downY = 0;

  function castFrom(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }

  // What's under the pointer: { arrow } on the screen, or { slug } of a cartridge.
  function pick(e) {
    castFrom(e);
    const screen = getScreen();
    if (screen) {
      hits.length = 0;
      raycaster.intersectObject(screen, false, hits);
      if (hits.length && hits[0].uv) {
        const arrow = menu.hitTest(hits[0].uv);
        if (arrow) return { arrow };
      }
    }
    const row = getCartridgeRow();
    if (row) {
      hits.length = 0;
      raycaster.intersectObject(row, true, hits);
      if (hits.length) return { slug: hits[0].object.userData.slug };
    }
    return null;
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'arrowup' || k === 'a' || k === 'w') {
      e.preventDefault();
      menu.prev();
    } else if (k === 'arrowright' || k === 'arrowdown' || k === 'd' || k === 's') {
      e.preventDefault();
      menu.next();
    }
  }

  function onWheel(e) {
    const now = e.timeStamp;
    if (now < wheelLockedUntil) return;
    if (now - lastWheel > 200) wheelTotal = 0;
    lastWheel = now;
    // Horizontal swipes on a trackpad count too.
    wheelTotal += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(wheelTotal) < WHEEL_THRESHOLD) return;
    if (wheelTotal > 0) menu.next();
    else menu.prev();
    wheelTotal = 0;
    wheelLockedUntil = now + WHEEL_COOLDOWN_MS;
  }

  function onPointerMove(e) {
    if (e.pointerType !== 'mouse') return;
    const hit = pick(e);
    menu.setHover(hit?.arrow ?? null);
    canvas.style.cursor = hit ? 'pointer' : '';
  }

  function onPointerDown(e) {
    downX = e.clientX;
    downY = e.clientY;
  }

  function onPointerUp(e) {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) menu.next();
      else menu.prev();
      return;
    }
    if (Math.hypot(dx, dy) > TAP_MAX_PX) return;
    const hit = pick(e);
    if (hit?.arrow === 'prev') menu.prev();
    else if (hit?.arrow === 'next') menu.next();
    else if (hit?.slug) menu.selectSlug(hit.slug);
  }

  return {
    enable() {
      if (active) return;
      active = true;
      window.addEventListener('keydown', onKey);
      window.addEventListener('wheel', onWheel, { passive: true });
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointerup', onPointerUp);
    },
    disable() {
      if (!active) return;
      active = false;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      menu.setHover(null);
      canvas.style.cursor = '';
    },
  };
}
