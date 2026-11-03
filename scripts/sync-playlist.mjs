// Reads the tracks of the Spotify playlist in site.json (music.playlistUrl) from
// Spotify's public embed page and saves them to src/content/playlist.json, so the
// music player can shuffle them. Run again whenever the playlist changes:
//   node scripts/sync-playlist.mjs
// (Spotify's embed page lists up to 100 tracks.)

import { readFileSync, writeFileSync } from 'node:fs';

const site = JSON.parse(readFileSync('src/content/site.json', 'utf8'));
const id = site.music.playlistUrl.match(/playlist\/([A-Za-z0-9]+)/)?.[1];
if (!id) throw new Error('No playlist id found in site.json music.playlistUrl');

const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`Spotify answered ${res.status}`);
const html = await res.text();
const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)?.[1];
if (!json) throw new Error('Could not find the track list on the embed page (Spotify may have changed it).');

const entity = JSON.parse(json).props.pageProps.state.data.entity;
const tracks = entity.trackList
  .filter((t) => t.uri?.startsWith('spotify:track:'))
  .map((t) => ({ uri: t.uri, title: t.title, artist: t.subtitle }));

writeFileSync('src/content/playlist.json', JSON.stringify({ playlistId: id, tracks }, null, 2) + '\n');
console.log(`Saved ${tracks.length} tracks to src/content/playlist.json`);
