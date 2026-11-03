import * as THREE from 'three';
import { tokenColor, tokenValue } from '../styles/tokens.js';
import { ROOM, WINDOW } from './room.js';

// The window on the back wall: frame, half-open blinds, and a generated night
// skyline behind it in layers at different depths (so it shifts as the camera moves).
// One neon sign flickers now and then; it stays steady under prefers-reduced-motion.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const PX_PER_METRE = 420;

// Small seeded random generator, so the skyline looks the same on every visit.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasLayer(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * PX_PER_METRE);
  canvas.height = Math.round(height * PX_PER_METRE);
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  return mesh;
}

// '#rrggbb' token -> 'rgba(r, g, b, a)' for canvas gradients.
function withAlpha(token, alpha) {
  const n = parseInt(tokenValue(token).slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// The pale, almost-white centre a real neon tube has, tinted toward its colour.
function neonCore(token) {
  return new THREE.Color(tokenValue(token)).lerp(new THREE.Color(tokenValue('--neon-core')), 0.65).getStyle();
}

// Draws a neon shape as three layers: a wide soft halo, a tighter glow, then a
// pale hot core. 'lighter' blending makes overlapping glow add up like real light.
function neon(ctx, token, drawShape, scale = 1) {
  const color = tokenValue(token);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  for (const [blur, alpha, width] of [[42, 0.35, 6], [16, 0.7, 4]]) {
    ctx.shadowBlur = blur * scale;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width * scale;
    drawShape(ctx);
  }
  ctx.shadowBlur = 4 * scale;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = neonCore(token);
  ctx.fillStyle = neonCore(token);
  ctx.lineWidth = 1.6 * scale;
  drawShape(ctx);
  ctx.restore();
}

function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tokenValue('--skyline-sky'));
  g.addColorStop(0.45, tokenValue('--skyline-sky'));
  g.addColorStop(1, tokenValue('--skyline-haze'));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Light pollution: soft pools of red and teal glowing up from the streets.
  const pools = [
    ['--neon-red', 0.62, 0.5],
    ['--neon-teal', 0.76, 0.28],
    ['--neon-red', 0.9, 0.38],
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const [token, cx, alpha] of pools) {
    const r = ctx.createRadialGradient(w * cx, h * 0.8, 0, w * cx, h * 0.8, h * 0.6);
    r.addColorStop(0, withAlpha(token, alpha));
    r.addColorStop(1, withAlpha(token, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawBuildings(ctx, w, h, { seed, fill, minH, maxH, minW, maxW, windowChance, neonChance, haze }) {
  const rand = seededRandom(seed);
  const warm = tokenValue('--skyline-window-warm');
  const cool = tokenValue('--skyline-window-cool');
  const signs = [];

  let x = -rand() * maxW;
  while (x < w) {
    const bw = minW + rand() * (maxW - minW);
    const bh = h * (minH + rand() * (maxH - minH));
    const top = h - bh;
    ctx.fillStyle = fill;
    ctx.fillRect(x, top, bw, bh);

    // Lit windows in a loose grid.
    const cell = 9;
    for (let wy = top + 8; wy < h - 6; wy += cell) {
      for (let wx = x + 5; wx < x + bw - 6; wx += cell * 0.8) {
        if (rand() > windowChance) continue;
        ctx.globalAlpha = 0.25 + rand() * 0.55;
        ctx.fillStyle = rand() > 0.3 ? warm : cool;
        ctx.fillRect(wx, wy, 3, 4);
      }
    }
    ctx.globalAlpha = 1;

    // Rooftop warning light.
    if (rand() > 0.6) signs.push({ token: '--neon-red', kind: 'dot', x: x + bw / 2, y: top - 3 });

    // Abstract neon signage: vertical boards and horizontal bands, no text.
    if (rand() < neonChance) {
      const token = rand() > 0.35 ? '--neon-red' : '--neon-teal';
      if (rand() > 0.5) {
        const sw = 14 + rand() * 10;
        const sh = 50 + rand() * 90;
        signs.push({ token, kind: 'board', x: x + rand() * Math.max(bw - sw, 1), y: top + 20 + rand() * Math.max(bh * 0.4, 1), w: sw, h: sh });
      } else {
        signs.push({ token, kind: 'band', x: x + 6, y: top + 14 + rand() * 30, w: bw - 12, h: 10 });
      }
    }

    x += bw + rand() * 10;
  }

  // Haze settling between the buildings, so this layer sinks into the city glow.
  if (haze) {
    const g = ctx.createLinearGradient(0, h, 0, h * 0.45);
    g.addColorStop(0, withAlpha('--skyline-haze', haze));
    g.addColorStop(1, withAlpha('--skyline-haze', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Neon goes on last, so no building ever cuts a glow off.
  for (const s of signs) {
    if (s.kind === 'dot') {
      neon(ctx, s.token, (c) => c.fillRect(s.x - 1.5, s.y, 3, 3), 0.5);
    } else if (s.kind === 'board') {
      neon(ctx, s.token, (c) => {
        c.strokeRect(s.x, s.y, s.w, s.h);
        for (let ly = s.y + 10; ly < s.y + s.h - 6; ly += 14) c.fillRect(s.x + 4, ly, s.w - 8, 3);
      });
    } else {
      neon(ctx, s.token, (c) => c.strokeRect(s.x, s.y, s.w, s.h));
    }
  }
}

// A glowing vertical sign board as its own mesh, plus a soft halo behind it,
// so both can flicker together cheaply.
function buildFlickerSign() {
  const group = new THREE.Group();

  const halo = canvasLayer(0.6, 0.9, (ctx, w, h) => {
    const r = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, withAlpha('--neon-red', 0.4));
    r.addColorStop(1, withAlpha('--neon-red', 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
  });
  halo.scale.y = 1.2;

  const board = canvasLayer(0.18, 0.5, (ctx, w, h) =>
    neon(
      ctx,
      '--neon-red',
      (c) => {
        c.strokeRect(22, 22, w - 44, h - 44);
        for (let y = 50; y < h - 46; y += 30) c.fillRect(36, y, w - 72, 8);
      },
      1.4,
    ),
  );
  board.position.z = 0.01;

  for (const layer of [halo, board]) layer.material.blending = THREE.AdditiveBlending;
  group.add(halo, board);
  return { group, materials: [halo.material, board.material] };
}

function buildFrame() {
  const frame = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: tokenColor('--scene-window-frame'), roughness: 0.6 });
  const { x, y, width, height } = WINDOW;
  const t = 0.04;
  const d = 0.12;
  const z = ROOM.backZ - d / 2 + 0.02;
  const parts = [
    [width + t * 2, t, d, x, y + height / 2 + t / 2],
    [width + t * 2, t, d, x, y - height / 2 - t / 2],
    [t, height, d, x - width / 2 - t / 2, y],
    [t, height, d, x + width / 2 + t / 2, y],
    [t * 0.5, height, d * 0.4, x, y], // centre mullion
  ];
  for (const [w, h, dd, px, py] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mat);
    m.position.set(px, py, z);
    m.castShadow = true;
    m.receiveShadow = true;
    frame.add(m);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.16, 0.03, 0.18), mat);
  sill.position.set(x, y - height / 2 - t - 0.015, ROOM.backZ + 0.05);
  sill.castShadow = true;
  sill.receiveShadow = true;
  frame.add(sill);
  return frame;
}

// Horizontal slats, tilted half open. One instanced mesh = one draw call.
function buildBlinds() {
  const { x, y, width, height } = WINDOW;
  const count = 11;
  const slat = new THREE.BoxGeometry(width - 0.02, 0.003, 0.035);
  const mat = new THREE.MeshStandardMaterial({ color: tokenColor('--scene-blinds'), roughness: 0.7, side: THREE.DoubleSide });
  const blinds = new THREE.InstancedMesh(slat, mat, count);
  blinds.castShadow = true;
  blinds.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.05);
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  // Raised to just over half way, so the lower part of the skyline shows clearly.
  const top = y + height / 2 - 0.03;
  const step = (height * 0.5) / count;
  for (let i = 0; i < count; i++) {
    p.set(x, top - i * step, ROOM.backZ + 0.03);
    m.compose(p, q, s);
    blinds.setMatrixAt(i, m);
  }
  return blinds;
}

export function buildWindow() {
  const group = new THREE.Group();
  group.name = 'Window';
  const { x } = WINDOW;
  const z = ROOM.backZ;

  const sky = canvasLayer(12, 6, drawSky);
  sky.material.transparent = false;
  sky.position.set(x - 2.5, 1.6, z - 4);

  const far = canvasLayer(4.6, 1.6, (ctx, w, h) =>
    drawBuildings(ctx, w, h, { seed: 7, fill: tokenValue('--skyline-far'), minH: 0.45, maxH: 0.95, minW: 40, maxW: 110, windowChance: 0.22, neonChance: 0.3, haze: 0.8 }),
  );
  far.position.set(x - 1.5, 1.4, z - 1.9);

  const near = canvasLayer(2.6, 1.4, (ctx, w, h) =>
    drawBuildings(ctx, w, h, { seed: 21, fill: tokenValue('--skyline-near'), minH: 0.55, maxH: 0.8, minW: 60, maxW: 140, windowChance: 0.14, neonChance: 0.55, haze: 0.35 }),
  );
  near.position.set(x - 0.6, 1.1, z - 0.7);

  const sign = buildFlickerSign();
  sign.group.position.set(x + 0.15, 1.25, z - 0.65);

  // Faint glass so the window reads as a window, not a hole.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WINDOW.width, WINDOW.height),
    new THREE.MeshStandardMaterial({ color: tokenColor('--skyline-window-cool'), roughness: 0.05, transparent: true, opacity: 0.06, depthWrite: false }),
  );
  glass.position.set(x, WINDOW.y, z - 0.04);

  // Neon city light spilling in through the blinds, casting slat shadows.
  const cityLight = new THREE.SpotLight(tokenColor('--neon-red'), 16, 7, 0.55, 0.6, 1.6);
  cityLight.position.set(x - 0.6, WINDOW.y + 0.9, z - 1.3);
  cityLight.target.position.set(x + 0.9, 0, z + 1.8);
  cityLight.castShadow = true;
  cityLight.shadow.mapSize.set(1024, 1024);
  cityLight.shadow.bias = -0.0005;
  cityLight.shadow.normalBias = 0.01;
  cityLight.shadow.camera.near = 0.2;
  cityLight.shadow.camera.far = 7;

  group.add(sky, far, near, sign.group, glass, buildFrame(), buildBlinds(), cityLight, cityLight.target);

  // Flicker: mostly on; every few seconds a short stutter of off/on.
  let clock = 0;
  let nextBurst = 3;
  function setSign(opacity) {
    for (const m of sign.materials) m.opacity = opacity;
  }
  function update(dt) {
    if (reducedMotion.matches) {
      setSign(1);
      return;
    }
    clock += dt;
    if (clock < nextBurst) return;
    const t = clock - nextBurst;
    const stutter = t < 0.06 || (t > 0.12 && t < 0.16) || (t > 0.26 && t < 0.3);
    setSign(stutter ? 0.15 : 1);
    if (t > 0.36) {
      clock = 0;
      nextBurst = 2.5 + Math.random() * 5;
      setSign(1);
    }
  }

  return { group, update };
}
