// Compresses a .glb exported from Blender (or downloaded) for the web and saves it
// into public/models/: Meshopt geometry compression, textures converted to WebP and
// capped at 2048 px. Run:
//   node scripts/optimize-models.mjs path/to/export.glb [name]
// e.g. node scripts/optimize-models.mjs blender/exports/tv.glb tv  ->  public/models/tv.glb
// Then check the size it prints: each model should be under 1.5 MB.

import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const [input, name] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/optimize-models.mjs <input.glb> [output name]');
  process.exit(1);
}

const output = join('public/models', `${name ?? basename(input, extname(input))}.glb`);
const result = spawnSync(
  'npx',
  ['gltf-transform', 'optimize', input, output, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '2048'],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);

const before = statSync(input).size / 1e6;
const after = statSync(output).size / 1e6;
console.log(`${input} (${before.toFixed(2)} MB) -> ${output} (${after.toFixed(2)} MB)`);
if (after > 1.5) console.warn('Over the 1.5 MB budget per model.');
