// Makes the small pictures the TV menu shows (640 px wide), so the site doesn't
// download every full-size hero image at start-up. Run after changing a hero image:
//   node scripts/make-thumbnails.mjs
// For each public/projects/<slug>/hero.jpg it writes thumbnail.jpg next to it, and
// public/about/portrait.jpg becomes portrait-thumb.jpg. Point a project's
// "thumbnail" at the new file. Uses `sips`, which comes with macOS.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WIDTH = 640;
const QUALITY = 72;

function thumbnail(from, to) {
  execFileSync('sips', ['--resampleWidth', String(WIDTH), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), from, '--out', to], { stdio: 'ignore' });
  console.log(`${from} -> ${to}`);
}

for (const slug of readdirSync('public/projects')) {
  const hero = join('public/projects', slug, 'hero.jpg');
  if (existsSync(hero)) thumbnail(hero, join('public/projects', slug, 'thumbnail.jpg'));
}
if (existsSync('public/about/portrait.jpg')) thumbnail('public/about/portrait.jpg', 'public/about/portrait-thumb.jpg');
