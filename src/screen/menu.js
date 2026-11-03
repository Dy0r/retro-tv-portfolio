import * as THREE from 'three';
import { gsap } from 'gsap';
import { EASES, DURATIONS } from '../motion/eases.js';
import { tokenValue } from '../styles/tokens.js';
import { loadingManager } from '../scene/models.js';
import { SCREEN_CANVAS } from './tvScreen.js';

// The menu drawn on the TV: one item at a time with chunky pixel arrows on the
// sides. Once a cartridge is in, the same item shows as a "title screen": bigger
// picture, no arrows or counter, until it's ejected. Items are the projects (each has a cartridge) followed by the extra pages
// from site.json (About, Contact, Credits). The canvas is only redrawn when
// something changes: a new item, a hover, the slide between items, or the cursor
// blink.

const { width: W, height: H } = SCREEN_CANVAS;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Layout, in canvas pixels.
const THUMB = { x: 272, y: 96, w: 480, h: 360 };
const THUMB_PLAYING = { x: 232, y: 70, w: 560, h: 420 };
const ARROW = { size: 46, y: H / 2 - 40, leftX: 78, rightX: W - 78 };
const ARROW_HIT = { w: 170, h: 300 }; // generous click/tap area around each arrow
const CURSOR_BLINK = 0.5; // seconds per blink phase

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function createMenu({ projects, pages, tvScreen, onChange }) {
  const ctx = tvScreen.canvas.getContext('2d');
  const font = tokenValue('--font-pixel');
  const colors = {
    bg: tokenValue('--screen-bg'),
    ink: tokenValue('--screen-ink'),
    dim: tokenValue('--screen-dim'),
    accent: tokenValue('--screen-accent'),
  };

  // Everything the menu shows, prepared once so redraws allocate nothing.
  const items = [
    ...projects.map((p) => ({
      kind: 'project',
      slug: p.slug,
      title: p.title,
      meta: `${p.year}  ·  ${p.genre}`,
      summary: p.summary,
      spoken: `${p.title}, ${p.year}, ${p.genre}`,
      image: null,
      thumbnail: p.thumbnail,
    })),
    ...pages.map((page) => ({
      kind: 'page',
      slug: page.id,
      title: page.title,
      meta: '',
      summary: page.summary,
      spoken: page.title,
      image: null,
    })),
  ];
  items.forEach((item, i) => (item.counter = `${pad2(i + 1)} / ${pad2(items.length)}`));

  // Thumbnails go through the shared LoadingManager, so the loader counts them.
  const imageLoader = new THREE.ImageLoader(loadingManager);
  const imagesReady = Promise.all(
    items
      .filter((item) => item.thumbnail)
      .map((item) => imageLoader.loadAsync(item.thumbnail).then((img) => (item.image = img))),
  );

  let index = 0;
  let playing = false; // title screen for the inserted cartridge
  let hover = null; // 'prev' | 'next' | null
  let pressed = null;
  let cursorOn = true;
  let blinkClock = 0;
  const slide = { offset: 0 }; // -1..1, which way the content is sliding
  let dirty = true;

  function drawArrow(x, dir, state) {
    const s = ARROW.size;
    const nudge = state === 'pressed' ? dir * 6 : 0;
    ctx.fillStyle = state ? colors.accent : colors.dim;
    // A chunky stepped triangle, built from squares like a sprite.
    const step = s / 4;
    for (let i = 0; i < 4; i++) {
      const h = s * 2 - i * step * 2;
      const cx = x + nudge + dir * (i * step - s / 2);
      ctx.fillRect(Math.round(cx - step / 2), Math.round(ARROW.y - h / 2), Math.ceil(step), Math.round(h));
    }
  }

  function wrapSummary(text, x, y, maxWidth, lineHeight) {
    let line = '';
    let lines = 0;
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        line = word;
        if (++lines === 2) return;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y + lines * lineHeight);
  }

  function draw() {
    const item = items[index];
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 1 - Math.abs(slide.offset);
    ctx.translate(slide.offset * 90, 0);

    // Top row: counter (menu only).
    if (!playing) {
      ctx.font = `400 26px ${font}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = colors.dim;
      ctx.textAlign = 'left';
      ctx.fillText(item.counter, 60, 34);
    }

    // Picture: the project thumbnail, or a framed panel for pages.
    const pic = playing ? THUMB_PLAYING : THUMB;
    ctx.strokeStyle = playing ? colors.accent : colors.dim;
    ctx.lineWidth = 4;
    if (item.image) {
      ctx.drawImage(item.image, pic.x, pic.y, pic.w, pic.h);
    } else {
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha *= 0.12;
      ctx.fillRect(pic.x, pic.y, pic.w, pic.h);
      ctx.globalAlpha = 1 - Math.abs(slide.offset);
    }
    ctx.strokeRect(pic.x - 8, pic.y - 8, pic.w + 16, pic.h + 16);

    // Title with a blinking block cursor.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = colors.ink;
    ctx.font = `700 64px ${font}`;
    const titleY = 556;
    ctx.fillText(item.title, W / 2, titleY);
    if (cursorOn) {
      const tw = ctx.measureText(item.title).width;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(W / 2 + tw / 2 + 14, titleY - 46, 26, 48);
    }

    ctx.font = `400 28px ${font}`;
    if (item.meta) {
      ctx.fillStyle = colors.accent;
      ctx.fillText(item.meta, W / 2, 604);
    }
    if (!playing) {
      ctx.fillStyle = colors.dim;
      ctx.font = `400 24px ${font}`;
      wrapSummary(item.summary, W / 2, item.meta ? 652 : 616, 720, 32);
    }
    ctx.restore();

    // Arrows stay put while the content slides between them.
    if (!playing) {
      drawArrow(ARROW.leftX, -1, pressed === 'prev' ? 'pressed' : hover === 'prev' ? 'hover' : null);
      drawArrow(ARROW.rightX, 1, pressed === 'next' ? 'pressed' : hover === 'next' ? 'hover' : null);
    }

    tvScreen.texture.needsUpdate = true;
    dirty = false;
  }

  function go(delta) {
    const count = items.length;
    index = (index + delta + count) % count;
    pressed = delta < 0 ? 'prev' : 'next';
    cursorOn = true;
    blinkClock = 0;
    onChange?.(items[index]);

    if (reducedMotion.matches) {
      slide.offset = 0;
      pressed = null;
      dirty = true;
      return;
    }
    // Slide in from the side you're moving toward, with a short burst of static.
    gsap.killTweensOf(slide);
    gsap.fromTo(
      slide,
      { offset: delta > 0 ? 0.6 : -0.6 },
      {
        offset: 0,
        duration: DURATIONS.menuSlide,
        ease: EASES.crtSnap,
        onUpdate: () => (dirty = true),
        onComplete: () => {
          pressed = null;
          dirty = true;
        },
      },
    );
    gsap.fromTo(tvScreen.uniforms.uStatic, { value: 0.55 }, { value: 0, duration: DURATIONS.menuStatic, ease: EASES.settle });
  }

  return {
    ready: Promise.all([document.fonts.load(`700 64px ${font}`), document.fonts.load(`400 24px ${font}`), imagesReady]).then(draw),
    get current() {
      return items[index];
    },
    next: () => go(1),
    prev: () => go(-1),
    // Switch between the menu and the inserted cartridge's title screen.
    setPlaying(on) {
      playing = on;
      hover = null;
      dirty = true;
    },
    selectSlug(slug) {
      const i = items.findIndex((item) => item.slug === slug);
      if (i >= 0 && i !== index) go(i - index);
    },

    // Screen UV (0..1, from a raycast) -> 'prev' | 'next' | null.
    hitTest(uv) {
      const x = uv.x * W;
      const y = (1 - uv.y) * H;
      if (Math.abs(y - ARROW.y) > ARROW_HIT.h / 2) return null;
      if (Math.abs(x - ARROW.leftX) < ARROW_HIT.w / 2) return 'prev';
      if (Math.abs(x - ARROW.rightX) < ARROW_HIT.w / 2) return 'next';
      return null;
    },
    setHover(target) {
      if (target === hover) return;
      hover = target;
      dirty = true;
    },

    update(dt) {
      blinkClock += dt;
      if (blinkClock >= CURSOR_BLINK && !reducedMotion.matches) {
        blinkClock = 0;
        cursorOn = !cursorOn;
        dirty = true;
      }
      if (dirty) draw();
    },
  };
}
