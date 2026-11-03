// Generates temporary art for every project file in src/content/projects/: a card
// in the project's cartridge colour with its title, for each image path the file
// mentions (label, thumbnail, hero, section images) that doesn't exist yet.
// Run: node scripts/make-placeholder-art.mjs
// It only creates missing .svg files, so your real images are never overwritten.
// To use real art, drop your file into public/projects/<slug>/ and point the path
// in the project's file at it.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const DIR = 'src/content/projects';
const SIZES = {
  label: [400, 300],
  thumbnail: [640, 480],
  hero: [1600, 900],
  image: [1200, 800],
};

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function card({ width, height, title, year, color, kind }) {
  const pad = Math.round(width * 0.07);
  const titleSize = Math.round(width * (kind === 'label' ? 0.085 : 0.07));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${color}"/>
  <rect x="${pad / 2}" y="${pad / 2}" width="${width - pad}" height="${height - pad}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3"/>
  <text x="${pad}" y="${height * 0.5}" font-family="monospace" font-weight="700" font-size="${titleSize}" fill="#fff">${escape(title)}</text>
  <text x="${pad}" y="${height * 0.5 + titleSize * 1.3}" font-family="monospace" font-size="${titleSize * 0.6}" fill="#fff" fill-opacity="0.75">${escape(year)}</text>
  <text x="${pad}" y="${height - pad}" font-family="monospace" font-size="${titleSize * 0.4}" fill="#fff" fill-opacity="0.5">PLACEHOLDER ${kind.toUpperCase()}</text>
</svg>
`;
}

// Every image path a project file mentions, with what kind of image it is.
function imagePaths(p) {
  const paths = [
    [p.labelImage, 'label'],
    [p.thumbnail, 'thumbnail'],
    [p.hero?.type === 'image' ? p.hero.src : null, 'hero'],
  ];
  for (const section of p.sections ?? []) {
    const media = Array.isArray(section.media) ? section.media : section.media ? [section.media] : [];
    for (const m of media) if (m.type === 'image') paths.push([m.src, 'image']);
  }
  return paths.filter(([path]) => path && path.endsWith('.svg'));
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const p = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8'));
  for (const [path, kind] of imagePaths(p)) {
    const out = `public${path}`;
    if (existsSync(out)) continue;
    mkdirSync(dirname(out), { recursive: true });
    const [width, height] = SIZES[kind];
    const label = kind === 'image' ? basename(path, '.svg') : kind;
    writeFileSync(out, card({ width, height, title: p.title, year: p.year, color: p.cartridgeColor, kind: label }));
    console.log(`wrote ${out}`);
  }
}
