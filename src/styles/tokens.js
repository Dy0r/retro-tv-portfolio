import * as THREE from 'three';

// Reads colour tokens from tokens.css so the 3D scene never hard-codes a colour.
const rootStyle = getComputedStyle(document.documentElement);

// The raw CSS value, e.g. for drawing on a 2D canvas.
export function tokenValue(name) {
  return rootStyle.getPropertyValue(name).trim();
}

// Phones, either way up. The camera frames the TV screen closely there and the TV
// menu switches to bigger type (scene/camera.js, screen/menu.js).
export const smallScreen = window.matchMedia('(max-width: 499px), (max-height: 499px)');

// THREE.Color treats CSS hex as sRGB and converts it to linear for lighting.
export function tokenColor(name) {
  return new THREE.Color(tokenValue(name));
}
