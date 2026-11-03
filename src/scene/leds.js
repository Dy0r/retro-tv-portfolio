import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { tokenColor } from '../styles/tokens.js';
import { ROOM } from './room.js';

// Teal LED strips: one behind the TV washing the wall (like bias lighting), one
// along the top of the back wall. Each is a glowing strip plus a soft area light.
// An area light is a light shaped like a rectangle, so it glows softly like a real strip.

RectAreaLightUniformsLib.init();

function strip(width, height, depth) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ color: tokenColor('--neon-teal') }),
  );
}

export function buildLeds({ tvBack, tvWidth }) {
  const group = new THREE.Group();
  group.name = 'LEDs';
  const teal = tokenColor('--neon-teal');

  // Behind the TV, facing the wall.
  const bias = new THREE.RectAreaLight(teal, 14, tvWidth * 0.9, 0.3);
  bias.position.copy(tvBack);
  bias.lookAt(tvBack.x, tvBack.y, ROOM.backZ);

  // Along the top of the back wall, aimed down the wall.
  const coveY = ROOM.height - 0.04;
  const coveWidth = ROOM.rightX - ROOM.leftX - 0.4;
  const coveX = (ROOM.leftX + ROOM.rightX) / 2;
  const coveStrip = strip(coveWidth, 0.015, 0.015);
  coveStrip.position.set(coveX, coveY, ROOM.backZ + 0.02);
  const cove = new THREE.RectAreaLight(teal, 14, coveWidth, 0.06);
  cove.position.set(coveX, coveY - 0.02, ROOM.backZ + 0.12);
  cove.lookAt(coveX, coveY - 1.2, ROOM.backZ);

  group.add(bias, coveStrip, cove);
  return group;
}
