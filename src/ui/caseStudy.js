import { gsap } from 'gsap';
import Lenis from 'lenis';
import site from '../content/site.json';
import { assetUrl } from '../assetUrl.js';
import { EASES, DURATIONS } from '../motion/eases.js';
import { createFramedDialog } from './framedDialog.js';
import { createLightbox } from './lightbox.js';

// The reader: the case study for the inserted cartridge, and the About / Contact /
// Credits pages from the menu, in the shared framed pop-up.
//  - Header: counter, title (a real heading), year · genre · role.
//  - Reading area: hero, then each section from the project's file (real headings,
//    paragraphs, images), then its links. Scrolls smoothly with Lenis (native
//    scrolling under reduced motion; touch always native). Keyboard: the reading
//    area takes focus on open, so arrows / Page Down / Space scroll straight away.
//  - Indicators: a progress bar that fills as you read, a section list that marks
//    where you are (click to jump), and a "Scroll to read" cue until you start.
//  - Every image is a button that opens it big in the image enlarger.
// Built with textContent only, so nothing in the content files can inject HTML.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const ACTIVE_LINE = 0.3; // a section is "current" once its top passes 30% down the reading area
const HINT_HIDE_AFTER = 40; // px scrolled before the "Scroll to read" cue fades
const JUMP_OFFSET = 24; // px of breathing room above a section you jump to

function pad2(n) {
  return String(n).padStart(2, '0');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A small pixel down-chevron for the scroll cue.
const CHEVRON = '<svg viewBox="0 0 7 4" width="14" height="8" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="7" height="1"/><rect x="1" y="1" width="5" height="1"/><rect x="2" y="2" width="3" height="1"/><rect x="3" y="3" width="1" height="1"/></svg>';

export function createCaseStudy({ onOpened, onClosing, onClosed }) {
  const labels = site.caseStudy;
  const lightbox = createLightbox();

  const frame = createFramedDialog({
    className: 'case',
    labelledBy: 'case-title',
    closeLabel: labels.closeLabel,
    focusClose: false,
    onOpened,
    onClosing: () => {
      lenis?.stop();
      lightbox.close();
      onClosing?.();
    },
    onClosed,
  });

  frame.inner.innerHTML = `
    <header class="case__header">
      <p class="case__counter"></p>
      <h2 class="case__title" id="case-title"></h2>
      <p class="case__meta"></p>
    </header>
    <div class="case__progress" aria-hidden="true"><i></i></div>
    <div class="case__body">
      <nav class="case__nav"><p class="case__nav-title" aria-hidden="true"></p><ol></ol></nav>
      <div class="case__scroll" tabindex="0"><div class="case__content"></div></div>
      <p class="case__hint" aria-hidden="true">${CHEVRON} <span></span></p>
    </div>
  `;
  const $ = (selector) => frame.inner.querySelector(selector);
  const counter = $('.case__counter');
  const title = $('.case__title');
  const meta = $('.case__meta');
  const bar = $('.case__progress i');
  const nav = $('.case__nav');
  const navList = $('.case__nav ol');
  const scrollEl = $('.case__scroll');
  const content = $('.case__content');
  const hint = $('.case__hint');

  nav.setAttribute('aria-label', labels.sectionsLabel);
  $('.case__nav-title').textContent = labels.sectionsLabel;
  hint.querySelector('span').textContent = labels.scrollHint;
  scrollEl.autofocus = true; // keyboard users can scroll straight away

  // Smooth scrolling inside the reading area only; the one GSAP clock drives it.
  let lenis = null;
  if (!reducedMotion.matches) {
    lenis = new Lenis({ wrapper: scrollEl, content, autoRaf: false });
    lenis.stop();
    gsap.ticker.add((time) => lenis.raf(time * 1000));
  }

  let sections = []; // { node, button }
  let current = -1;

  function updateIndicators() {
    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    const progress = max > 0 ? scrollEl.scrollTop / max : 1;
    bar.style.transform = `scaleX(${progress})`;
    hint.classList.toggle('is-hidden', max <= 0 || scrollEl.scrollTop > HINT_HIDE_AFTER);

    const line = scrollEl.getBoundingClientRect().top + scrollEl.clientHeight * ACTIVE_LINE;
    let active = 0;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].node.getBoundingClientRect().top <= line) active = i;
    }
    if (active === current) return;
    if (sections[current]) sections[current].button.removeAttribute('aria-current');
    current = active;
    if (sections[current]) sections[current].button.setAttribute('aria-current', 'true');
  }
  scrollEl.addEventListener('scroll', updateIndicators, { passive: true });

  function jumpTo(node, heading) {
    if (lenis) {
      lenis.scrollTo(node, { offset: -JUMP_OFFSET, duration: DURATIONS.caseJump, easing: EASES.settle });
    } else {
      scrollEl.scrollTo({ top: node.offsetTop - JUMP_OFFSET });
    }
    heading.focus({ preventScroll: true }); // screen readers continue from here
  }

  function linkList(links) {
    const list = el('ul', 'case__links');
    for (const link of links) {
      const a = el('a', null, link.label);
      a.href = assetUrl(link.url); // site files like the resume PDF need the sub-folder prefix
      if (/^https?:/.test(link.url) || link.url.endsWith('.pdf')) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      const li = el('li');
      li.append(a);
      list.append(li);
    }
    return list;
  }

  function mediaFigure(media) {
    const figure = el('figure');
    if (media.type === 'youtube') {
      // Privacy-friendly YouTube player; only loads when scrolled near.
      const frameEl = el('iframe', 'case__embed');
      frameEl.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.id)}?rel=0`;
      frameEl.title = media.alt ?? 'Video';
      frameEl.loading = 'lazy';
      frameEl.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      frameEl.allowFullscreen = true;
      figure.append(frameEl);
      if (media.caption) figure.append(el('figcaption', null, media.caption));
      return figure;
    }
    const src = assetUrl(media.src);
    if (media.type === 'video') {
      const video = el('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = src;
      if (media.alt) video.setAttribute('aria-label', media.alt);
      figure.append(video);
    } else {
      const button = el('button', 'case__zoom');
      button.type = 'button';
      button.setAttribute('aria-label', `${labels.enlargeImageLabel}: ${media.alt ?? ''}`);
      const img = el('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = src;
      img.alt = media.alt ?? '';
      const tag = el('span', 'case__zoom-tag', labels.enlargeLabel);
      tag.setAttribute('aria-hidden', 'true');
      button.append(img, tag);
      button.addEventListener('click', () => lightbox.open({ src, alt: media.alt, caption: media.caption }));
      figure.append(button);
    }
    if (media.caption) figure.append(el('figcaption', null, media.caption));
    return figure;
  }

  function addSection(id, headingText, body, media, links) {
    const section = el('section');
    section.id = id;
    const heading = el('h3', null, headingText);
    heading.tabIndex = -1;
    section.append(heading);
    const paragraphs = Array.isArray(body) ? body : body ? [body] : [];
    for (const text of paragraphs) section.append(el('p', null, text));
    const mediaList = Array.isArray(media) ? media : media ? [media] : [];
    for (const m of mediaList) section.append(mediaFigure(m));
    if (links?.length) section.append(linkList(links));
    content.append(section);

    const item = el('li');
    const button = el('button', null, headingText);
    button.type = 'button';
    button.addEventListener('click', () => jumpTo(section, heading));
    item.append(button);
    navList.append(item);
    sections.push({ node: section, button });
  }

  // entry: a project or a menu page (title, hero?, sections, links?).
  function render(entry, { counterText = '', metaText = '' }) {
    counter.textContent = counterText;
    counter.hidden = !counterText;
    title.textContent = entry.title;
    meta.textContent = metaText;
    meta.hidden = !metaText;
    content.replaceChildren();
    navList.replaceChildren();
    sections = [];
    current = -1;

    if (entry.hero?.src || entry.hero?.id) content.append(mediaFigure(entry.hero));
    (entry.sections ?? []).forEach((s, i) => addSection(`case-section-${i}`, s.heading, s.body, s.media, s.links));
    if (entry.links?.length) addSection('case-links', labels.linksHeading, null, null, entry.links);
  }

  function show() {
    frame.open();
    scrollEl.scrollTop = 0;
    lenis?.scrollTo(0, { immediate: true });
    lenis?.start();
    updateIndicators();
  }

  return {
    get isOpen() {
      return frame.isOpen;
    },
    // A project's case study, with "02 / 05" and year · genre · role in the header.
    open(project, index, total) {
      render(project, {
        counterText: `${pad2(index + 1)} / ${pad2(total)}`,
        metaText: [project.year, project.genre, project.role].filter(Boolean).join('  ·  '),
      });
      show();
    },
    // An About / Contact / Credits page: just its title in the header.
    openPage(page) {
      render(page, {});
      show();
    },
    close: frame.close,
    // For the gamepad d-pad: scroll the reading area by some pixels.
    scrollBy(dy) {
      if (lenis) lenis.scrollTo(lenis.scroll + dy, { duration: DURATIONS.caseJump * 0.5, easing: EASES.settle });
      else scrollEl.scrollBy({ top: dy });
    },
  };
}
