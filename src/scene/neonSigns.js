import * as THREE from 'three';
import { tokenColor } from '../styles/tokens.js';
import { ROOM } from './room.js';

// Abstract neon tube pieces on the room's walls (no text, no logos): a red
// ring-and-bar between the window and the TV, a teal tube up the back-left corner,
// and a teal wave above the shelf. Each has a soft glow on the wall and a small
// coloured light, and each flickers on its own, rarely: a short buzz every 8-20 s.
// Steady under prefers-reduced-motion.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const TUBE_RADIUS = 0.007;
const BRIGHTNESS = 2.2; // tubes are brighter than their token colour, like lit glass
const HALO_OPACITY = 0.45;
const LIGHT_INTENSITY = 0.35;

// One buzz: [seconds since it started, brightness 0..1].
const BUZZ = [
  [0.0, 0.15],
  [0.06, 1],
  [0.1, 0.25],
  [0.18, 1],
  [0.24, 0.4],
  [0.3, 1],
];
const BUZZ_LENGTH = BUZZ[BUZZ.length - 1][0];

// Soft round glow, shared by every halo and tinted per sign.
function haloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function tube(curve, material, segments = 64) {
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, TUBE_RADIUS, 8, false), material);
}

// Builds one sign: tube meshes + a halo on the wall + a light, all flickering together.
function buildSign({ token, curves, halo, light, firstBuzz }, haloMap) {
  const group = new THREE.Group();
  const base = tokenColor(token).multiplyScalar(BRIGHTNESS);
  const material = new THREE.MeshBasicMaterial({ color: base.clone() });
  for (const curve of curves) group.add(tube(curve, material));

  const haloMaterial = new THREE.MeshBasicMaterial({
    map: haloMap,
    color: tokenColor(token),
    transparent: true,
    opacity: HALO_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(halo.width, halo.height), haloMaterial);
  haloMesh.position.copy(halo.position);
  haloMesh.rotation.copy(halo.rotation ?? new THREE.Euler());
  group.add(haloMesh);

  const lamp = new THREE.PointLight(tokenColor(token), LIGHT_INTENSITY, 1.3, 2);
  lamp.position.copy(light);
  group.add(lamp);

  let clock = 0;
  let nextBuzz = firstBuzz;

  function setLevel(level) {
    material.color.copy(base).multiplyScalar(level);
    haloMaterial.opacity = HALO_OPACITY * level;
    lamp.intensity = LIGHT_INTENSITY * level;
  }

  function update(dt) {
    if (reducedMotion.matches) return;
    clock += dt;
    if (clock < nextBuzz) return;
    const t = clock - nextBuzz;
    if (t >= BUZZ_LENGTH) {
      setLevel(1);
      clock = 0;
      nextBuzz = 8 + Math.random() * 12;
      return;
    }
    let level = 1;
    for (let i = 0; i < BUZZ.length; i++) {
      if (t >= BUZZ[i][0]) level = BUZZ[i][1];
    }
    setLevel(level);
  }

  return { group, update };
}

export function buildNeonSigns() {
  const group = new THREE.Group();
  group.name = 'NeonSigns';
  const haloMap = haloTexture();
  const wallZ = ROOM.backZ + 0.012;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // 1. Red ring with a bar through it, like a little planet.
  const ringCenter = V(-0.62, 1.56, wallZ);
  const ring = new THREE.EllipseCurve(0, 0, 0.13, 0.13, 0, Math.PI * 2);
  const ringPoints = ring.getPoints(72).map((p) => V(ringCenter.x + p.x, ringCenter.y + p.y, wallZ));
  const planet = {
    token: '--neon-red',
    curves: [new THREE.CatmullRomCurve3(ringPoints, true), new THREE.LineCurve3(V(-0.8, 1.52, wallZ + 0.01), V(-0.44, 1.6, wallZ + 0.01))],
    halo: { width: 0.7, height: 0.6, position: V(ringCenter.x, ringCenter.y, ROOM.backZ + 0.004) },
    light: V(ringCenter.x, ringCenter.y, ROOM.backZ + 0.15),
    firstBuzz: 4 + Math.random() * 4,
  };

  // 2. Teal tube running up the back-left corner, behind the bed.
  const cornerX = ROOM.leftX + 0.03;
  const cornerZ = ROOM.backZ + 0.03;
  const corner = {
    token: '--neon-teal',
    curves: [new THREE.LineCurve3(V(cornerX, 0.78, cornerZ), V(cornerX, 2.32, cornerZ))],
    halo: {
      width: 0.5,
      height: 1.9,
      position: V(ROOM.leftX + 0.004, 1.55, cornerZ + 0.16),
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
    },
    light: V(cornerX + 0.12, 1.55, cornerZ + 0.12),
    firstBuzz: 9 + Math.random() * 6,
  };

  // 3. Teal wave above the shelf.
  const wavePoints = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    wavePoints.push(V(0.53 + t * 0.5, 1.93 + Math.sin(t * Math.PI * 4) * 0.03, wallZ));
  }
  const wave = {
    token: '--neon-teal',
    curves: [new THREE.CatmullRomCurve3(wavePoints)],
    halo: { width: 0.85, height: 0.35, position: V(0.78, 1.93, ROOM.backZ + 0.004) },
    light: V(0.78, 1.93, ROOM.backZ + 0.15),
    firstBuzz: 14 + Math.random() * 6,
  };

  const signs = [planet, corner, wave].map((spec) => buildSign(spec, haloMap));
  for (const sign of signs) group.add(sign.group);

  function update(dt) {
    for (let i = 0; i < signs.length; i++) signs[i].update(dt);
  }

  return { group, update };
}
