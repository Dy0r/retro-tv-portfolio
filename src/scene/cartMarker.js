import * as THREE from 'three';
import { tokenColor } from '../styles/tokens.js';

// Pixel arrows floating over a cartridge, so it's obvious what you can do with it:
//  - in the menu, one arrow points DOWN at the selected cartridge ("put this in"),
//  - once it's in the console, stacked arrows point UP above it ("eject").
// They bob gently (still under reduced motion), always face the camera, and can be
// clicked. Drawn as squares on a tiny canvas so they match the pixel UI.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SIZE = 0.045; // metres on screen-facing side
const GAP_ABOVE = 0.008; // metres between the cartridge's top and the arrows
const BOB = { height: 0.008, speed: 4 }; // metres, radians per second
const BRIGHTNESS = 1; // plain token colour: crisp, below the bloom threshold, so no neon glow

// Rows of a 9x9 grid, '#' = lit. One chevron, or three stacked.
const DOWN = ['', '', '#########', ' ####### ', '  #####  ', '   ###   ', '    #    ', '', ''];
const UP = ['    #    ', '   ###   ', '  #####  ', '         ', '    #    ', '   ###   ', '  #####  ', '         ', '    #    '];

function arrowTexture(rows) {
  const cell = 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cell * 9;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // tinted by the material colour
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export function createCartMarker(scene) {
  const color = tokenColor('--neon-teal').multiplyScalar(BRIGHTNESS);
  const textures = { down: arrowTexture(DOWN), up: arrowTexture(UP) };
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.down, color, transparent: true, depthWrite: false }));
  sprite.name = 'CartMarker';
  sprite.scale.setScalar(SIZE);
  sprite.renderOrder = 10;
  sprite.visible = false;
  scene.add(sprite);

  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const base = new THREE.Vector3();
  let target = null;
  let height = 0;
  let clock = 0;

  function point(cart, dir) {
    if (!cart) return hide();
    target = cart;
    // Height of the cartridge, measured once per cartridge (works for any model).
    if (cart.userData.markerHeight === undefined) {
      box.setFromObject(cart).getSize(size);
      cart.userData.markerHeight = size.y;
    }
    height = cart.userData.markerHeight;
    sprite.material.map = textures[dir];
    sprite.visible = true;
  }

  function hide() {
    target = null;
    sprite.visible = false;
  }

  return {
    sprite,
    pointDown: (cart) => point(cart, 'down'),
    pointUp: (cart) => point(cart, 'up'),
    hide,
    update(dt) {
      if (!target) return;
      clock += dt;
      target.getWorldPosition(base);
      const bob = reducedMotion.matches ? 0 : Math.sin(clock * BOB.speed) * BOB.height;
      sprite.position.set(base.x, base.y + height + GAP_ABOVE + SIZE / 2 + bob, base.z);
    },
  };
}
