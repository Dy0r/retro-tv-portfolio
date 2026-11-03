import { gsap } from 'gsap';
import { EASES, DURATIONS } from '../motion/eases.js';
import { tokenValue } from '../styles/tokens.js';

// The loading screen (markup lives in index.html so it shows instantly).
// A dot-matrix shape morphs once from a rounded square into a four-point star,
// with a ring pulse as it lands. Progress blocks fill from real load progress.
// `finish()` resolves once the morph has played AND loading is complete.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const GRID = 40; // cells across the shape canvas
const EXTENT = 1.5; // the grid covers -1.5..1.5 in shape units
const SQUARE = { p: 4, r: 0.55 }; // superellipse exponent + radius: rounded square
const STAR = { p: 0.6, r: 1.0 }; // low exponent pinches it into a four-point star

// Faint grey squares scattered behind everything, like the reference.
function drawDust(canvas) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tokenValue('--color-loader-dust');
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const count = Math.round((canvas.width * canvas.height) / 9000);
  const size = 4 * dpr;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.3 + rand() * 0.7;
    ctx.fillRect(Math.floor(rand() * canvas.width), Math.floor(rand() * canvas.height), size, size);
  }
}

export function createLoader() {
  const root = document.getElementById('loader');
  const shapeCanvas = root.querySelector('.loader__shape');
  const dustCanvas = root.querySelector('.loader__dust');
  const bar = root.querySelector('.loader__bar');
  const cells = bar.querySelectorAll('i');
  const ctx = shapeCanvas.getContext('2d');
  const color = tokenValue('--color-loader');

  drawDust(dustCanvas);
  const onResize = () => drawDust(dustCanvas);
  window.addEventListener('resize', onResize);

  const shape = { p: SQUARE.p, r: SQUARE.r, ring: 0, ringAlpha: 0 };
  const cellPx = shapeCanvas.width / GRID;
  const dot = Math.max(1, Math.floor(cellPx) - 1); // 1px gap between dots

  function draw() {
    ctx.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
    ctx.fillStyle = color;
    const { p, r, ring, ringAlpha } = shape;
    const rp = Math.pow(r, p);
    for (let gy = 0; gy < GRID; gy++) {
      const y = ((gy + 0.5) / GRID) * 2 * EXTENT - EXTENT;
      for (let gx = 0; gx < GRID; gx++) {
        const x = ((gx + 0.5) / GRID) * 2 * EXTENT - EXTENT;
        const inShape = Math.pow(Math.abs(x), p) + Math.pow(Math.abs(y), p) <= rp;
        let alpha = inShape ? 1 : 0;
        if (!inShape && ringAlpha > 0 && Math.abs(Math.hypot(x, y) - ring) < 0.05) alpha = ringAlpha;
        if (alpha === 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.round(gx * cellPx), Math.round(gy * cellPx), dot, dot);
      }
    }
    ctx.globalAlpha = 1;
  }

  // The morph plays once. Under reduced motion, show the star straight away.
  let morphDone;
  const morphed = new Promise((resolve) => (morphDone = resolve));
  if (reducedMotion.matches) {
    Object.assign(shape, STAR);
    draw();
    morphDone();
  } else {
    draw();
    gsap
      .timeline({ delay: DURATIONS.loaderHold, onUpdate: draw, onComplete: morphDone })
      .to(shape, { p: STAR.p, r: STAR.r, duration: DURATIONS.loaderMorph, ease: EASES.crtSnap })
      .fromTo(
        shape,
        { ring: STAR.r * 0.6, ringAlpha: 1 },
        { ring: EXTENT, ringAlpha: 0, duration: DURATIONS.loaderRing, ease: EASES.settle },
        DURATIONS.loaderMorph * 0.55,
      );
  }

  let loadDone;
  const loaded = new Promise((resolve) => (loadDone = resolve));

  return {
    // 0..1 real progress.
    setProgress(fraction) {
      const f = Math.min(1, Math.max(0, fraction));
      const lit = Math.round(f * cells.length);
      cells.forEach((cell, i) => cell.classList.toggle('is-on', i < lit));
      bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      if (f >= 1) loadDone();
    },

    // Fades the loading screen out once both the morph and loading are done.
    async finish() {
      await Promise.all([morphed, loaded]);
      root.classList.add('is-done');
      // Fallback timer in case the fade can't run (e.g. the tab is hidden).
      await new Promise((resolve) => {
        root.addEventListener('transitionend', resolve, { once: true });
        setTimeout(resolve, 1000);
      });
      window.removeEventListener('resize', onResize);
      root.hidden = true;
    },
  };
}
