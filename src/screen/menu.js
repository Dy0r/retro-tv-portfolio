import * as THREE from 'three';
import { gsap } from 'gsap';
import { EASES, DURATIONS } from '../motion/eases.js';
import { tokenValue, smallScreen } from '../styles/tokens.js';
import { loadingManager } from '../scene/models.js';
import { SCREEN_CANVAS } from './tvScreen.js';
import { assetUrl } from '../assetUrl.js';

// The menu drawn on the TV: one item at a time with chunky pixel arrows on the
// sides. Once a cartridge is in, the same item shows as a "title screen": bigger
// picture, no arrows or counter, until it's ejected. Items are the projects (each
// has a cartridge) followed by the extra pages from site.json (About, Contact,
// Credits). The canvas is only redrawn when something changes: a new item, a
// hover, the slide between items, or the cursor blink.
//
// Readability: the canvas shows on screen at roughly half size (about 0.6x with
// the menu framing at 1440x900), so the smallest text is 44px here (VT323 runs
// small for its size) to land at ~16px or more on screen. On phones the screen shows at about a third of its
// size even with the camera close, so a compact layout takes over: bigger type,
// smaller picture, long titles and summaries shrink to fit (smallest text 52px,
// most summaries stay at 58px). All text colours pass WCAG AAA (7:1) on --screen-bg.

const { width: W, height: H } = SCREEN_CANVAS;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Layout and type sizes, in canvas pixels.
const SUMMARY_LINES = 3;
const LAYOUTS = {
  regular: {
    type: { counter: 42, title: 96, titleMin: 96, meta: 44, summary: 44, summaryMin: 44, summaryLine: 50 },
    thumb: { x: 320, y: 78, w: 384, h: 288 },
    thumbPlaying: { x: 288, y: 64, w: 448, h: 336 },
    textY: {
      menu: { title: 452, meta: 504, summary: 560, summaryNoMeta: 512 },
      playing: { title: 490, meta: 544 },
    },
    titleWidth: 820,
    summaryWidth: 900,
    arrow: { size: 46, y: 78 + 288 / 2 },
  },
  compact: {
    type: { counter: 56, title: 124, titleMin: 84, meta: 60, summary: 58, summaryMin: 52, summaryLine: 62 },
    thumb: { x: 352, y: 92, w: 320, h: 240 },
    thumbPlaying: { x: 312, y: 56, w: 400, h: 300 },
    textY: {
      menu: { title: 448, meta: 516, summary: 584, summaryNoMeta: 524 },
      playing: { title: 490, meta: 562 },
    },
    titleWidth: 800,
    summaryWidth: 940,
    arrow: { size: 56, y: 92 + 240 / 2 },
  },
};
const ARROW_X = { left: 78, right: W - 78 };
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
      thumbnail: page.thumbnail,
    })),
  ];
  items.forEach((item, i) => (item.counter = `${pad2(i + 1)} / ${pad2(items.length)}`));

  // Thumbnails go through the shared LoadingManager, so the loader counts them.
  const imageLoader = new THREE.ImageLoader(loadingManager);
  const imagesReady = Promise.all(
    items
      .filter((item) => item.thumbnail)
      .map((item) => imageLoader.loadAsync(assetUrl(item.thumbnail)).then((img) => (item.image = img))),
  );

  let index = 0;
  let playing = false; // title screen for the inserted cartridge
  let hover = null; // 'prev' | 'next' | null
  let pressed = null;
  let cursorOn = true;
  let blinkClock = 0;
  const slide = { offset: 0 }; // -1..1, which way the content is sliding
  let dirty = true;
  let layout = smallScreen.matches ? LAYOUTS.compact : LAYOUTS.regular;
  smallScreen.addEventListener('change', () => {
    layout = smallScreen.matches ? LAYOUTS.compact : LAYOUTS.regular;
    dirty = true;
  });

  // Title size for this item in this layout: the layout's size, shrunk in steps
  // until it fits the width (worked out once, then remembered).
  function titleSize(item) {
    const key = layout === LAYOUTS.compact ? 'compactTitle' : 'regularTitle';
    if (item[key]) return item[key];
    let size = layout.type.title;
    ctx.font = `400 ${size}px ${font}`;
    while (size > layout.type.titleMin && ctx.measureText(item.title).width > layout.titleWidth) {
      size -= 4;
      ctx.font = `400 ${size}px ${font}`;
    }
    item[key] = size;
    return size;
  }

  // Summary size: the layout's size, shrunk in steps until it fits in SUMMARY_LINES
  // lines, so nothing is ever cut off (worked out once per item, then remembered).
  function summarySize(item) {
    const key = layout === LAYOUTS.compact ? 'compactSummary' : 'regularSummary';
    if (item[key]) return item[key];
    let size = layout.type.summary;
    while (size > layout.type.summaryMin && summaryLines(item.summary, size) > SUMMARY_LINES) size -= 2;
    item[key] = size;
    return size;
  }

  function summaryLines(text, size) {
    ctx.font = `400 ${size}px ${font}`;
    let line = '';
    let lines = 1;
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > layout.summaryWidth && line) {
        lines++;
        line = word;
      } else {
        line = test;
      }
    }
    return lines;
  }

  function drawArrow(x, dir, state) {
    const { size: s, y: arrowY } = layout.arrow;
    const nudge = state === 'pressed' ? dir * 6 : 0;
    ctx.fillStyle = state ? colors.accent : colors.dim;
    // A chunky stepped triangle, built from squares like a sprite.
    const step = s / 4;
    for (let i = 0; i < 4; i++) {
      const h = s * 2 - i * step * 2;
      const cx = x + nudge + dir * (i * step - s / 2);
      ctx.fillRect(Math.round(cx - step / 2), Math.round(arrowY - h / 2), Math.ceil(step), Math.round(h));
    }
  }

  // Fills the box with the image, cropping the edges instead of stretching it.
  function drawCover(img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  function wrapSummary(text, x, y, maxWidth, lineHeight) {
    let line = '';
    let lines = 0;
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        line = word;
        if (++lines === SUMMARY_LINES) return;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y + lines * lineHeight);
  }

  function draw() {
    const item = items[index];
    const { type } = layout;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 1 - Math.abs(slide.offset);
    ctx.translate(slide.offset * 90, 0);

    // Top row: counter (menu only).
    if (!playing) {
      ctx.font = `400 ${type.counter}px ${font}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = colors.dim;
      ctx.textAlign = 'left';
      ctx.fillText(item.counter, 56, 26);
    }

    // Picture: the project thumbnail, or a framed panel for pages.
    const pic = playing ? layout.thumbPlaying : layout.thumb;
    ctx.strokeStyle = playing ? colors.accent : colors.dim;
    ctx.lineWidth = 4;
    if (item.image) {
      drawCover(item.image, pic.x, pic.y, pic.w, pic.h);
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
    const y = playing ? layout.textY.playing : layout.textY.menu;
    const size = titleSize(item);
    ctx.fillStyle = colors.ink;
    ctx.font = `400 ${size}px ${font}`;
    ctx.fillText(item.title, W / 2, y.title);
    if (cursorOn) {
      const tw = ctx.measureText(item.title).width;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(W / 2 + tw / 2 + 14, y.title - size * 0.72, size * 0.38, size * 0.74);
    }

    ctx.font = `400 ${type.meta}px ${font}`;
    if (item.meta) {
      ctx.fillStyle = colors.accent;
      ctx.fillText(item.meta, W / 2, y.meta);
    }
    if (!playing) {
      ctx.fillStyle = colors.dim;
      const summary = summarySize(item);
      ctx.font = `400 ${summary}px ${font}`;
      wrapSummary(item.summary, W / 2, item.meta ? y.summary : y.summaryNoMeta, layout.summaryWidth, (type.summaryLine * summary) / type.summary);
    }
    ctx.restore();

    // Arrows stay put while the content slides between them.
    if (!playing) {
      drawArrow(ARROW_X.left, -1, pressed === 'prev' ? 'pressed' : hover === 'prev' ? 'hover' : null);
      drawArrow(ARROW_X.right, 1, pressed === 'next' ? 'pressed' : hover === 'next' ? 'hover' : null);
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
    onChange?.(items[index], delta);

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
    ready: Promise.all([document.fonts.load(`400 ${LAYOUTS.regular.type.title}px ${font}`), document.fonts.load(`400 ${LAYOUTS.regular.type.summary}px ${font}`), imagesReady]).then(draw),
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
    // Jump straight to an item with no slide or static (opening a project link).
    jumpTo(slug) {
      const i = items.findIndex((item) => item.slug === slug);
      if (i < 0) return;
      index = i;
      slide.offset = 0;
      pressed = null;
      cursorOn = true;
      blinkClock = 0;
      dirty = true;
      onChange?.(items[index]);
    },
    selectSlug(slug) {
      const i = items.findIndex((item) => item.slug === slug);
      if (i >= 0 && i !== index) go(i - index);
    },

    // Screen UV (0..1, from a raycast) -> 'prev' | 'next' | null.
    hitTest(uv) {
      const x = uv.x * W;
      const y = (1 - uv.y) * H;
      if (Math.abs(y - layout.arrow.y) > ARROW_HIT.h / 2) return null;
      if (Math.abs(x - ARROW_X.left) < ARROW_HIT.w / 2) return 'prev';
      if (Math.abs(x - ARROW_X.right) < ARROW_HIT.w / 2) return 'next';
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
