import { defineConfig } from 'vite';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { renderSimpleSite } from './src/simple/render.mjs';

// Same order as src/content/projects.js: one JSON file per project, sorted by `order`.
function readProjects() {
  const dir = 'src/content/projects';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')))
    .sort((a, b) => a.order - b.order);
}

// Fills index.html from the content JSON: the <noscript> project list (so visitors
// and search engines without WebGL/JavaScript still see the work) and the loading
// screen label. No site text lives in the HTML itself.
function htmlFromContent() {
  return {
    name: 'html-from-content',
    transformIndexHtml(html) {
      const site = JSON.parse(readFileSync('src/content/site.json', 'utf8'));
      const projects = readProjects();
      const items = projects
        .map((p) => `<li><a href="#/project/${p.slug}">${p.title}</a> (${p.year}) — ${p.summary}</li>`)
        .join('\n        ');
      // Text that goes inside HTML attributes, made safe for quotes and ampersands.
      const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return html
        .replaceAll('%PAGE_TITLE%', attr(site.pageTitle))
        .replaceAll('%SIMPLE_TITLE%', attr(site.simple.pageTitle))
        .replaceAll('%META_DESCRIPTION%', attr(site.metaDescription))
        .replaceAll('%SITE_NAME%', attr(site.name))
        .replaceAll('%SITE_URL%', attr(site.siteUrl))
        .replaceAll('%SHARE_IMAGE%', attr(site.siteUrl + site.shareImage))
        .replaceAll('%SHARE_IMAGE_ALT%', attr(site.shareImageAlt))
        .replaceAll('<!--LOADING_LABEL-->', site.loadingLabel)
        .replace('<!--NOSCRIPT_NAME-->', site.name)
        .replace('<!--NOSCRIPT_PROJECTS-->', `<ul>\n        ${items}\n      </ul>`);
    },
  };
}

// Fills simple/index.html (the text-only site) with the index and every case study,
// built from the same content files. Re-renders whenever a content file changes.
function simpleSite() {
  let base = '/';
  return {
    name: 'simple-site',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html) {
      if (!html.includes('<!--SIMPLE_SITE-->')) return html;
      const site = JSON.parse(readFileSync('src/content/site.json', 'utf8'));
      return html.replace('<!--SIMPLE_SITE-->', renderSimpleSite({ site, projects: readProjects(), base }));
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (file.includes('/src/content/') || file.includes('/src/simple/render')) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

// Exposes `virtual:available-models`: the list of .glb files in public/models.
// Scene code uses it to pick a real model or fall back to a placeholder, so dropping
// a new tv.glb / console.glb / cartridge.glb / room.glb in needs no code change.
function availableModels() {
  const id = 'virtual:available-models';
  const resolvedId = '\0' + id;
  const dir = 'public/models';
  return {
    name: 'available-models',
    resolveId(source) {
      if (source === id) return resolvedId;
    },
    load(loadId) {
      if (loadId !== resolvedId) return;
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.glb')) : [];
      return `export default ${JSON.stringify(files)};`;
    },
    configureServer(server) {
      const onChange = (file) => {
        if (!file.includes('/public/models/')) return;
        const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph;
        const mod = graph.getModuleById(resolvedId);
        if (mod) graph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

// BASE_PATH lets the site live in a sub-folder, e.g. GitHub Pages serves it at
// /retro-tv-portfolio/ (set in .github/workflows/deploy.yml). Defaults to the root.
// Dev only: lets the running site save a fresh share image (public/og-image.jpg).
// In the browser console on the dev site, run: __dev.saveShareImage()
function shareImageSaver() {
  return {
    name: 'share-image-saver',
    configureServer(server) {
      server.middlewares.use('/__dev/save-share-image', (req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          writeFileSync('public/og-image.jpg', Buffer.from(body.replace(/^data:image\/jpeg;base64,/, ''), 'base64'));
          res.end('saved public/og-image.jpg');
        });
      });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [htmlFromContent(), simpleSite(), availableModels(), shareImageSaver()],
  // Two pages: the 3D site and the text-only site.
  build: {
    rollupOptions: {
      input: { main: 'index.html', simple: 'simple/index.html' },
    },
  },
});
