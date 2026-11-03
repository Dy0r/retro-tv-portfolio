import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tokenColor, tokenValue } from '../styles/tokens.js';
import site from '../content/site.json';
import { ROOM, STAND } from './room.js';

// Background details that make the room read as a lived-in bedroom: bed, wall
// shelf with books and a plant, posters, rug, and cables. Placeholder shapes only.

function solid(token, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color: tokenColor(token), roughness });
}

function box(w, h, d, material, radius = 0.01) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildBed() {
  const bed = new THREE.Group();
  bed.name = 'Bed';
  const width = 1.0;
  const length = 1.95;
  const x = ROOM.leftX + width / 2 + 0.02;
  const z = ROOM.backZ + length / 2 + 0.02;

  const frame = box(width, 0.26, length, solid('--scene-bed-frame', 0.7), 0.02);
  frame.position.set(x, 0.13, z);

  const headboard = box(width, 0.62, 0.05, solid('--scene-bed-frame', 0.7), 0.015);
  headboard.position.set(x, 0.31, ROOM.backZ + 0.03);

  const mattress = box(width - 0.04, 0.16, length - 0.06, solid('--scene-mattress', 0.95), 0.05);
  mattress.position.set(x, 0.34, z);

  // Blanket covers the lower two-thirds and hangs over the open side.
  const blanket = box(width + 0.02, 0.06, length * 0.66, solid('--scene-blanket', 0.95), 0.03);
  blanket.position.set(x + 0.01, 0.43, z + length * 0.17);
  blanket.rotation.z = -0.02;

  const pillow = box(0.6, 0.1, 0.32, solid('--scene-pillow', 0.95), 0.05);
  pillow.position.set(x, 0.46, ROOM.backZ + 0.25);
  pillow.rotation.x = -0.12;

  bed.add(frame, headboard, mattress, blanket, pillow);
  return bed;
}

function buildShelf() {
  const shelf = new THREE.Group();
  shelf.name = 'Shelf';
  const x = 0.78;
  const y = 1.5;
  const width = 0.62;
  const depth = 0.2;
  const z = ROOM.backZ + depth / 2;

  const board = box(width, 0.025, depth, solid('--scene-stand', 0.7), 0.005);
  board.position.set(x, y, z);
  shelf.add(board);

  // A teal glow strip underneath the shelf.
  const glow = new THREE.Mesh(new THREE.BoxGeometry(width - 0.06, 0.006, 0.01), new THREE.MeshBasicMaterial({ color: tokenColor('--neon-teal') }));
  glow.position.set(x, y - 0.016, z + depth / 2 - 0.02);
  shelf.add(glow);

  // Books: varied heights, colours and a lean at the end.
  const bookTokens = ['--scene-book-a', '--scene-book-b', '--scene-book-c', '--scene-book-d'];
  const heights = [0.22, 0.19, 0.24, 0.2, 0.17, 0.23, 0.21];
  let bx = x - width / 2 + 0.04;
  heights.forEach((h, i) => {
    const t = 0.025 + (i % 3) * 0.008;
    const book = box(t, h, 0.15, solid(bookTokens[i % bookTokens.length], 0.75), 0.003);
    book.position.set(bx + t / 2, y + 0.0125 + h / 2, z - 0.01);
    if (i === heights.length - 1) {
      book.rotation.z = -0.35;
      book.position.x += 0.04;
      book.position.y -= 0.02;
    }
    shelf.add(book);
    bx += t + 0.003;
  });

  // Small potted plant on the right end.
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 16), solid('--scene-pot', 0.8));
  pot.position.set(x + width / 2 - 0.09, y + 0.0575, z);
  pot.castShadow = true;
  shelf.add(pot);
  const leafMat = solid('--scene-plant', 0.7);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.16, 6), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(pot.position.x + Math.cos(a) * 0.02, y + 0.15, z + Math.sin(a) * 0.02);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    leaf.castShadow = true;
    shelf.add(leaf);
  }

  return shelf;
}

// Geometric poster art drawn on a canvas; no borrowed imagery. Drawn at 2x so
// text stays crisp, using 360 x 500 layout units.
function posterTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  draw(ctx, 360, 500);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Placeholder resume poster: same geometric style as the other poster, with the
// title from site.json set big across the middle. The thin rules below it hint
// at lines of a CV.
function drawResumePoster(ctx, w, h) {
  const ink = tokenValue('--scene-book-d');
  ctx.fillStyle = tokenValue('--scene-poster-paper');
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = tokenValue('--neon-red');
  ctx.beginPath();
  ctx.arc(w * 0.6, h * 0.28, w * 0.27, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = tokenValue('--neon-teal');
  ctx.fillRect(w * 0.1, h * 0.08, w * 0.06, h * 0.4);

  // Title, scaled so it always spans 80% of the poster width.
  const title = site.resume.posterTitle.toLocaleUpperCase();
  const family = tokenValue('--font-poster');
  ctx.font = `900 100px ${family}`;
  const size = (100 * w * 0.8) / ctx.measureText(title).width;
  ctx.font = `900 ${size}px ${family}`;
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, w * 0.1, h * 0.66);

  ctx.fillRect(w * 0.1, h * 0.69, w * 0.8, h * 0.012);

  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  const lengths = [0.8, 0.62, 0.74, 0.5, 0.8, 0.68, 0.4];
  lengths.forEach((len, i) => {
    const y = h * (0.75 + i * 0.026);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, y);
    ctx.lineTo(w * (0.1 + len * 0.8), y);
    ctx.stroke();
  });
}

function drawPosterB(ctx, w, h) {
  ctx.fillStyle = tokenValue('--skyline-near');
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = tokenValue('--neon-teal');
  ctx.lineWidth = 6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.95, w * (0.15 + i * 0.12), Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = tokenValue('--neon-red');
  ctx.fillRect(0, h * 0.18, w, h * 0.03);
  ctx.fillStyle = tokenValue('--scene-poster-paper');
  ctx.fillRect(w * 0.08, h * 0.06, w * 0.3, h * 0.02);
}

function buildPoster(drawFn, width, height) {
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: posterTexture(drawFn), roughness: 0.85 }),
  );
  poster.receiveShadow = true;
  return poster;
}

function buildRug() {
  const rug = box(1.7, 0.012, 1.2, solid('--scene-rug', 1), 0.006);
  rug.name = 'Rug';
  rug.position.set(0.1, 0.006, 0.1);
  rug.castShadow = false;
  return rug;
}

// Two cables from the back of the console, over the stand, to the side of the TV.
function buildCables(consoleBack, tvSide) {
  const group = new THREE.Group();
  group.name = 'Cables';
  const mat = solid('--scene-cable', 0.5);
  const top = STAND.height + 0.006;
  [-0.01, 0.012].forEach((offset, i) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(consoleBack.x + offset, consoleBack.y, consoleBack.z),
      new THREE.Vector3(consoleBack.x + 0.05 + offset, top, consoleBack.z - 0.06),
      new THREE.Vector3(tvSide.x - 0.02, top, tvSide.z + 0.08 + i * 0.03),
      new THREE.Vector3(tvSide.x + 0.03, top, tvSide.z - 0.05),
      new THREE.Vector3(tvSide.x + 0.01, tvSide.y, tvSide.z - 0.14),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0035, 6), mat);
    cable.castShadow = true;
    group.add(cable);
  });
  return group;
}

export function buildProps({ consoleBack, tvSide }) {
  const group = new THREE.Group();
  group.name = 'Props';

  const resumePoster = buildPoster(drawResumePoster, 0.42, 0.58);
  resumePoster.name = 'ResumePoster';
  // Lights up on hover (see input/posterInput.js) so it reads as clickable.
  resumePoster.material.emissive.setScalar(1);
  resumePoster.material.emissiveMap = resumePoster.material.map;
  resumePoster.material.emissiveIntensity = 0;
  resumePoster.position.set(0.78, 1.02, ROOM.backZ + 0.005);

  // Above the bed, on the side wall.
  const posterB = buildPoster(drawPosterB, 0.5, 0.7);
  posterB.rotation.y = Math.PI / 2;
  posterB.position.set(ROOM.leftX + 0.005, 1.35, ROOM.backZ + 1.25);

  group.add(buildBed(), buildShelf(), resumePoster, posterB, buildRug(), buildCables(consoleBack, tvSide));
  return group;
}
