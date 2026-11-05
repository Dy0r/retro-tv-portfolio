import site from '../content/site.json';
import { assetUrl } from '../assetUrl.js';
import { createFramedDialog } from './framedDialog.js';

// The text-only site (simple/) as a fallback, as the brief asks:
//  - no WebGL at all: main.js sends the visitor straight there (graphicsSupport);
//  - no graphics chip (WebGL drawn in software): the same pop-up as below, but before
//    any of the 3D is built, because building it is what's slow;
//  - reduced motion turned on, or a low-power device / data saver: once loading has
//    finished, a small framed pop-up offers the text version. "Stay in 3D" is
//    remembered, so it only asks once.
// The always-visible "Text version" link (top-right) covers everyone else.
// Words live in site.json `fallback`.

const REMEMBER_KEY = 'portfolio-stay-in-3d';
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render/i;

// 'none' (no WebGL), 'software' (WebGL with no graphics chip behind it) or 'hardware'.
export function graphicsSupport() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // browsers only allow a few at once
    return SOFTWARE_RENDERERS.test(renderer) ? 'software' : 'hardware';
  } catch {
    return 'none';
  }
}

// Why to offer the text version, or null when there's no reason to.
function offerReason() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'motion';
  const { hardwareConcurrency: cores, deviceMemory: memory, connection } = navigator;
  if ((cores && cores <= 2) || (memory && memory <= 2) || connection?.saveData) return 'device';
  return null;
}

function remembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(REMEMBER_KEY, '1');
  } catch {
    // Private mode or blocked storage: it will simply ask again next visit.
  }
}

export function createFallbackOffer() {
  const text = site.fallback;
  const frame = createFramedDialog({ className: 'offer', labelledBy: 'offer-title', closeLabel: text.stayLabel, focusClose: false });
  frame.inner.innerHTML = `
    <h2 class="offer__title" id="offer-title"></h2>
    <p class="offer__body"></p>
    <p class="offer__actions">
      <a class="offer__go"></a>
      <button class="offer__stay" type="button"></button>
    </p>
  `;
  const $ = (s) => frame.inner.querySelector(s);
  $('.offer__title').textContent = text.title;
  const go = $('.offer__go');
  go.href = assetUrl(site.plainSite.url);
  go.textContent = text.goLabel;
  go.autofocus = true;
  const stay = $('.offer__stay');
  stay.textContent = text.stayLabel;
  stay.addEventListener('click', () => frame.close());
  let answered = false; // also covers visitors whose browser blocks remembering
  frame.dialog.addEventListener('close', () => {
    answered = true;
    remember();
  });

  return {
    // Asks before the 3D is built; resolves once the visitor chooses to stay.
    askBeforeLoading() {
      if (remembered()) return Promise.resolve();
      $('.offer__body').textContent = text.deviceBody;
      frame.open();
      return new Promise((resolve) => frame.dialog.addEventListener('close', resolve, { once: true }));
    },

    // Opens the offer if this visitor might prefer the text version.
    maybeOpen() {
      const reason = offerReason();
      if (!reason || answered || remembered()) return;
      $('.offer__body').textContent = reason === 'motion' ? text.motionBody : text.deviceBody;
      frame.open();
    },
  };
}
