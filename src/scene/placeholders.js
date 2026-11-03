import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tokenColor } from '../styles/tokens.js';

// Stand-in models built from simple shapes. Each one uses the same part names a
// real model from Blender must use (Screen, Slot, LED, Label), so swapping in
// public/models/<name>.glb later needs no code changes.
// Units are metres; every model's origin sits at the centre of its base.

function standard(token, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: tokenColor(token), ...extra });
}

function mesh(name, geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// --- CRT TV ---------------------------------------------------------------------
export const TV_SIZE = { width: 0.62, height: 0.52, depth: 0.44 };
const SCREEN = { width: 0.48, height: 0.36, curveRadius: 2 };

// A plane bowed outward like CRT glass: flat at the centre, curving back at the edges.
function curvedScreenGeometry() {
  const geo = new THREE.PlaneGeometry(SCREEN.width, SCREEN.height, 24, 18);
  const pos = geo.attributes.position;
  const r = SCREEN.curveRadius;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sqrt(r * r - x * x - y * y) - r);
  }
  geo.computeVertexNormals();
  return geo;
}

function bezelGeometry() {
  const { width, height } = TV_SIZE;
  const outer = new THREE.Shape();
  outer.moveTo(-width / 2, -height / 2);
  outer.lineTo(width / 2, -height / 2);
  outer.lineTo(width / 2, height / 2);
  outer.lineTo(-width / 2, height / 2);
  outer.closePath();

  const hw = SCREEN.width / 2 + 0.01;
  const hh = SCREEN.height / 2 + 0.01;
  const rad = 0.03;
  const hole = new THREE.Path();
  hole.moveTo(-hw + rad, -hh);
  hole.lineTo(hw - rad, -hh);
  hole.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  hole.lineTo(hw, hh - rad);
  hole.quadraticCurveTo(hw, hh, hw - rad, hh);
  hole.lineTo(-hw + rad, hh);
  hole.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  hole.lineTo(-hw, -hh + rad);
  hole.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  outer.holes.push(hole);

  return new THREE.ExtrudeGeometry(outer, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
  });
}

export function buildTV() {
  const { width, height, depth } = TV_SIZE;
  const tv = new THREE.Group();
  tv.name = 'TV';

  const bodyMat = standard('--scene-tv-body', { roughness: 0.55 });
  const frontDepth = depth * 0.5;

  const front = mesh('Body', new RoundedBoxGeometry(width, height, frontDepth, 4, 0.025), bodyMat);
  front.position.set(0, height / 2, depth / 2 - frontDepth / 2 - 0.03);
  tv.add(front);

  // The tapered "tube" at the back of a CRT.
  const rear = mesh('Rear', new RoundedBoxGeometry(width * 0.78, height * 0.8, depth * 0.5, 4, 0.04), bodyMat);
  rear.position.set(0, height * 0.46, -depth / 2 + depth * 0.25);
  tv.add(rear);

  const bezel = mesh('Bezel', bezelGeometry(), standard('--scene-tv-bezel', { roughness: 0.6 }));
  bezel.position.set(0, height / 2, depth / 2 - 0.03);
  tv.add(bezel);

  const screen = mesh(
    'Screen',
    curvedScreenGeometry(),
    standard('--scene-screen-off', {
      roughness: 0.15,
      metalness: 0,
      emissive: tokenColor('--light-crt'),
      emissiveIntensity: 0.12,
    }),
  );
  screen.castShadow = false;
  screen.position.set(0, height / 2 + 0.02, depth / 2 - 0.034);
  tv.add(screen);

  return tv;
}

// --- Console ----------------------------------------------------------------------
export const CONSOLE_SIZE = { width: 0.27, height: 0.075, depth: 0.19 };

export function buildConsole() {
  const { width, height, depth } = CONSOLE_SIZE;
  const group = new THREE.Group();
  group.name = 'Console';

  const body = mesh('Body', new RoundedBoxGeometry(width, height, depth, 4, 0.018), standard('--scene-console-body', { roughness: 0.6 }));
  body.position.y = height / 2;
  group.add(body);

  // Top-loading cartridge slot: a dark opening in the back half of the top.
  const slot = mesh('Slot', new THREE.BoxGeometry(0.12, 0.004, 0.026), standard('--scene-slot', { roughness: 0.9 }));
  slot.position.set(0, height + 0.001, -depth * 0.18);
  group.add(slot);

  const detailMat = standard('--scene-console-detail', { roughness: 0.5 });
  const power = mesh('PowerSwitch', new RoundedBoxGeometry(0.03, 0.012, 0.022, 2, 0.004), detailMat);
  power.position.set(-0.07, height + 0.004, depth * 0.25);
  group.add(power);

  const reset = mesh('ResetSwitch', new RoundedBoxGeometry(0.03, 0.012, 0.022, 2, 0.004), detailMat);
  reset.position.set(0.07, height + 0.004, depth * 0.25);
  group.add(reset);

  const led = mesh(
    'LED',
    new THREE.SphereGeometry(0.004, 12, 8),
    standard('--scene-led', { emissive: tokenColor('--scene-led'), emissiveIntensity: 2 }),
  );
  led.castShadow = false;
  led.position.set(-0.1, height * 0.55, depth / 2 + 0.001);
  group.add(led);

  return group;
}

// --- Cartridge --------------------------------------------------------------------
// Standing upright: width x height, thin depth. The label faces +Z.
export const CARTRIDGE_SIZE = { width: 0.1, height: 0.075, depth: 0.02 };

export function buildCartridge() {
  const { width, height, depth } = CARTRIDGE_SIZE;
  const group = new THREE.Group();
  group.name = 'Cartridge';

  // Colour is set per project in cartridges.js.
  const body = mesh('Body', new RoundedBoxGeometry(width, height, depth, 3, 0.004), new THREE.MeshStandardMaterial({ roughness: 0.5 }));
  body.position.y = height / 2;
  group.add(body);

  const label = mesh('Label', new THREE.PlaneGeometry(width * 0.8, height * 0.62), new THREE.MeshStandardMaterial({ roughness: 0.7 }));
  label.castShadow = false;
  label.position.set(0, height * 0.56, depth / 2 + 0.0005);
  group.add(label);

  return group;
}
