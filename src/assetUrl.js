// File paths in the content JSON and scene code are written from the site root,
// e.g. "/models/tv.glb". The live site may sit in a sub-folder (GitHub Pages serves
// it at /retro-tv-portfolio/ until a custom domain is connected), so every path goes
// through here to get the right prefix. Full URLs (https://…) pass through untouched.
export function assetUrl(path) {
  if (/^[a-z]+:/i.test(path)) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
