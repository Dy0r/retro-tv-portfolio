import { defineConfig } from 'vite';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { renderSimpleSite, renderProjectPage, renderRedirect, renderSitemap, renderRobots, renderNotFound, personJsonLd } from './src/simple/render.mjs';

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
        .map((p) => `<li><a href="work/${p.slug}/">${p.title}</a> (${p.year}) — ${p.summary}</li>`)
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
        .replace('<!--PERSON_JSONLD-->', personJsonLd(site))
        .replaceAll('<!--LOADING_LABEL-->', site.loadingLabel)
        .replace('<!--NOSCRIPT_NAME-->', site.name)
        .replace('<!--NOSCRIPT_PROJECTS-->', `<ul>\n        ${items}\n      </ul>`);
    },
  };
}

// Fills simple/index.html (the text-only site) with the index and every case study,
// built from the same content files. Re-renders whenever a content file changes.
// Also writes, at build time, the search-friendly pages: work/<slug>/ for every
// case study, forwarding pages for the old Framer addresses (site.json seo.redirects),
// sitemap.xml, robots.txt and 404.html. In dev, /work/<slug>/ is served on the fly.
function simpleSite() {
  let base = '/';
  let outDir = 'dist';
  let isBuild = false;
  const readSite = () => JSON.parse(readFileSync('src/content/site.json', 'utf8'));
  const write = (path, text) => {
    const file = `${outDir}/${path}`;
    mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
    writeFileSync(file, text);
  };
  return {
    name: 'simple-site',
    configResolved(config) {
      base = config.base;
      outDir = config.build.outDir;
      isBuild = config.command === 'build';
    },
    transformIndexHtml(html) {
      if (!html.includes('<!--SIMPLE_SITE-->')) return html;
      return html.replace('<!--SIMPLE_SITE-->', renderSimpleSite({ site: readSite(), projects: readProjects(), base, imageSizes: readImageSizes() }));
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (file.includes('/src/content/') || file.includes('/src/simple/render')) server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use(async (req, res, next) => {
        const slug = req.url.match(/^\/work\/([\w-]+)\/?$/)?.[1];
        const project = slug && readProjects().find((p) => p.slug === slug);
        if (!project) return next();
        const assets = '<script type="module" src="/src/simple/main.js"></script>';
        const html = renderProjectPage({ site: readSite(), project, projects: readProjects(), base, imageSizes: readImageSizes(), assets });
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(req.url, html));
      });
    },
    closeBundle() {
      if (!isBuild) return;
      const site = readSite();
      const projects = readProjects();
      const imageSizes = readImageSizes();
      // Reuse the CSS and script tags Vite produced for the text index.
      const head = readFileSync(`${outDir}/simple/index.html`, 'utf8').match(/<head>([\s\S]*?)<\/head>/)[1];
      const assets = (head.match(/<(link|script)[^>]*\/assets\/[^>]*>(<\/script>)?/g) || []).join('\n    ');
      for (const project of projects) write(`work/${project.slug}/index.html`, renderProjectPage({ site, project, projects, base, imageSizes, assets }));
      for (const { from, to } of site.seo.redirects) write(`${from.replace(/^\//, '')}/index.html`, renderRedirect({ site, base, to, title: site.name }));
      write('sitemap.xml', renderSitemap({ site, projects }));
      write('robots.txt', renderRobots({ site }));
      write('404.html', renderNotFound({ site, base, assets }));
    },
  };
}

// Exposes `virtual:image-sizes`: { "/projects/plinth/01.jpg": [width, height], … } for
// every JPEG and PNG in public/. The case study gives each image its size before it
// loads, so the page doesn't grow as images arrive (which made the progress bar jump).
function imageSize(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function readImageSizes() {
  const sizes = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(jpe?g|png)$/i.test(entry.name)) {
        const size = imageSize(path);
        if (size) sizes[path.slice('public'.length)] = size;
      }
    }
  };
  walk('public');
  return sizes;
}

function imageSizes() {
  const id = 'virtual:image-sizes';
  const resolvedId = '\0' + id;
  return {
    name: 'image-sizes',
    resolveId(source) {
      if (source === id) return resolvedId;
    },
    load(loadId) {
      if (loadId === resolvedId) return `export default ${JSON.stringify(readImageSizes())};`;
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
  plugins: [htmlFromContent(), simpleSite(), availableModels(), imageSizes(), shareImageSaver()],
  // Two pages: the 3D site and the text-only site.
  build: {
    rollupOptions: {
      input: { main: 'index.html', simple: 'simple/index.html' },
    },
  },
});
