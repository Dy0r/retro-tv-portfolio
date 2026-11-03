import site from '../content/site.json';

// "Zoom out" button, top-left, shown while the menu is up. Takes you back to the
// opening room shot (Esc and gamepad B do the same). Icon: four pixel corner
// brackets pointing outward, plus an ESC key cap so the shortcut is discoverable.

function pixelCorners() {
  // 9x9 grid: an L-shaped bracket in each corner.
  const cells = [];
  const L = [
    [0, 0], [1, 0], [2, 0], [0, 1], [0, 2],
  ];
  for (const [x, y] of L) {
    cells.push([x, y], [8 - x, y], [x, 8 - y], [8 - x, 8 - y]);
  }
  const rects = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('');
  return `<svg viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
}

export function createZoomOutButton({ onActivate }) {
  const { label, key } = site.zoomOut;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'zoom-out';
  button.inert = true;
  button.innerHTML = `${pixelCorners()}<kbd class="zoom-out__key"></kbd><span class="zoom-out__label"></span>`;
  button.querySelector('.zoom-out__key').textContent = key;
  button.querySelector('.zoom-out__label').textContent = label;
  button.setAttribute('aria-keyshortcuts', 'Escape');
  button.addEventListener('click', onActivate);
  document.body.appendChild(button);

  return {
    show() {
      button.inert = false;
      button.classList.add('is-visible');
    },
    hide() {
      button.inert = true;
      button.classList.remove('is-visible');
    },
  };
}
