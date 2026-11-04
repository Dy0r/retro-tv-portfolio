import site from '../content/site.json';
import { assetUrl } from '../assetUrl.js';

// The "back" button, top-left. In the menu it's "Zoom out" (back to the opening
// room shot); once a cartridge is in, it's "Eject" (back to the menu). Esc and
// gamepad B do the same. Each has its own pixel icon, plus an ESC key cap so the
// shortcut is discoverable. Labels live in site.json. The Insert button (bottom-
// right) at the end of this file shares the same look.

function pixelIcon(cells) {
  const rects = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('');
  return `<svg viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
}

// Four L-shaped brackets pointing outward.
function cornersIcon() {
  const cells = [];
  for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]) {
    cells.push([x, y], [8 - x, y], [x, 8 - y], [8 - x, 8 - y]);
  }
  return pixelIcon(cells);
}

// A triangle pointing up over a bar: the classic eject symbol, built from squares.
function ejectIcon() {
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let x = 4 - row; x <= 4 + row; x++) cells.push([x, row + 1]);
  }
  for (let x = 0; x < 9; x++) cells.push([x, 7]);
  return pixelIcon(cells);
}

// A triangle pointing down onto a bar: "put it in".
function insertIcon() {
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let x = row + 1; x <= 7 - row; x++) cells.push([x, row + 1]);
  }
  for (let x = 0; x < 9; x++) cells.push([x, 7]);
  return pixelIcon(cells);
}

const MODES = {
  zoomOut: { icon: cornersIcon(), ...site.zoomOut },
  eject: { icon: ejectIcon(), ...site.eject },
};

export function createZoomOutButton({ onActivate }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'zoom-out';
  button.inert = true;
  button.setAttribute('aria-keyshortcuts', 'Escape');
  button.addEventListener('click', onActivate);
  document.body.appendChild(button);

  let current = null;
  function setMode(mode) {
    if (mode === current) return;
    current = mode;
    const { icon, key, label } = MODES[mode];
    button.innerHTML = `${icon}<kbd class="zoom-out__key"></kbd><span class="zoom-out__label"></span>`;
    button.querySelector('.zoom-out__key').textContent = key;
    button.querySelector('.zoom-out__label').textContent = label;
  }
  setMode('zoomOut');

  return {
    // mode: 'zoomOut' (menu) or 'eject' (a cartridge is in).
    show(mode = 'zoomOut') {
      setMode(mode);
      button.inert = false;
      button.classList.add('is-visible');
    },
    hide() {
      button.inert = true;
      button.classList.remove('is-visible');
    },
  };
}

// "Insert" button, bottom-right, shown in the menu while a project is selected.
// Same look as the back button; Enter does the same thing.
export function createInsertButton({ onActivate }) {
  const { label, key } = site.insert;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'zoom-out zoom-out--insert';
  button.inert = true;
  button.setAttribute('aria-keyshortcuts', 'Enter');
  button.innerHTML = `${insertIcon()}<kbd class="zoom-out__key"></kbd><span class="zoom-out__label"></span>`;
  button.querySelector('.zoom-out__key').textContent = key;
  button.querySelector('.zoom-out__label').textContent = label;
  button.addEventListener('click', onActivate);
  document.body.appendChild(button);

  return {
    setVisible(on) {
      button.inert = !on;
      button.classList.toggle('is-visible', on);
    },
  };
}

// Three lines of text: "read it as a page".
function linesIcon() {
  const cells = [];
  for (const [y, w] of [[1, 9], [4, 9], [7, 6]]) for (let x = 0; x < w; x++) cells.push([x, y]);
  return pixelIcon(cells);
}

// Top-right link to the text-only site (simple/), same look as the buttons above.
// Visible from the start, over the loading screen too.
export function createPlainSiteLink() {
  const link = document.createElement('a');
  link.className = 'zoom-out zoom-out--plain';
  link.href = assetUrl(site.plainSite.url);
  link.title = site.plainSite.title;
  link.innerHTML = `${linesIcon()}<span></span>`;
  link.querySelector('span').textContent = site.plainSite.label;
  link.inert = true;
  document.body.appendChild(link);
  return {
    setVisible(on) {
      link.classList.toggle('is-visible', on);
      link.inert = !on;
    },
  };
}
