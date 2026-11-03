import * as THREE from 'three';
import { DAMPING } from '../motion/eases.js';

// Makes the resume poster clickable: it lights up and shows a hand cursor on hover,
// and a click or tap on it opens the resume. Only active while `canOpen()` says so
// (the opening room shot and the menu). Found by raycasting onto the poster mesh.

const HOVER_GLOW = 0.35;
const TAP_MAX_PX = 10;

export function createPosterInput({ canvas, camera, getPoster, canOpen, onOpen }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hits = [];
  let hovering = false;
  let downX = 0;
  let downY = 0;

  // Does this pointer event land on the poster?
  function hitsPoster(e) {
    const poster = getPoster();
    if (!poster || !canOpen()) return false;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObject(poster, false, hits);
    return hits.length > 0;
  }

  function setHover(on) {
    hovering = on;
    if (on) canvas.dataset.hoverPoster = '';
    else delete canvas.dataset.hoverPoster;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') setHover(hitsPoster(e));
  });
  canvas.addEventListener('pointerleave', () => setHover(false));
  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MAX_PX) return;
    if (hitsPoster(e)) {
      setHover(false);
      onOpen();
    }
  });

  return {
    hitsPoster,
    // Eases the poster's glow toward its hover state, frame-rate independent.
    update(dt) {
      const poster = getPoster();
      if (!poster) return;
      const goal = hovering && canOpen() ? HOVER_GLOW : 0;
      const m = poster.material;
      m.emissiveIntensity += (goal - m.emissiveIntensity) * (1 - Math.exp(-DAMPING.cartridge * dt));
    },
  };
}
