// Generates temporary label + thumbnail art for every project in projects.json:
// a card in the project's cartridge colour with its title and year.
// Run: node scripts/make-placeholder-art.mjs
// It only writes files that don't exist yet, so your real art is never overwritten.
// Replace a placeholder by dropping in your own file and updating the path in projects.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const PROJECTS_FILE = 'src/content/projects.json';
const projects = JSON.parse(readFileSync(PROJECTS_FILE, 'utf8'));

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

for (const p of projects) {
  const dir = `public/projects/${p.slug}`;
  mkdirSync(dir, { recursive: true });

  const files = [
    { key: 'labelImage', name: 'label.svg', width: 400, height: 300, kind: 'label' },
    { key: 'thumbnail', name: 'thumbnail.svg', width: 640, height: 480, kind: 'thumbnail' },
  ];

  for (const f of files) {
    const path = `${dir}/${f.name}`;
    // Only fill in projects whose image is missing or still a placeholder path.
    const current = p[f.key];
    const currentExists = current && existsSync(`public${current}`);
    if (currentExists && !current.endsWith(f.name)) continue;
    if (!existsSync(path)) {
      writeFileSync(path, card({ ...f, title: p.title, year: p.year, color: p.cartridgeColor }));
      console.log(`wrote ${path}`);
    }
    p[f.key] = `/projects/${p.slug}/${f.name}`;
  }
}

writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2) + '\n');
console.log(`updated ${PROJECTS_FILE}`);
