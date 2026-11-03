import { defineConfig } from 'vite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

// Fills index.html from the content JSON: the <noscript> project list (so visitors
// and search engines without WebGL/JavaScript still see the work) and the loading
// screen label. No site text lives in the HTML itself.
function htmlFromContent() {
  return {
    name: 'html-from-content',
    transformIndexHtml(html) {
      const site = JSON.parse(readFileSync('src/content/site.json', 'utf8'));
      const projects = JSON.parse(readFileSync('src/content/projects.json', 'utf8'));
      const items = projects
        .map((p) => `<li><a href="/#/project/${p.slug}">${p.title}</a> (${p.year}) — ${p.summary}</li>`)
        .join('\n        ');
      return html
        .replaceAll('<!--LOADING_LABEL-->', site.loadingLabel)
        .replace('<!--NOSCRIPT_NAME-->', site.name)
        .replace('<!--NOSCRIPT_PROJECTS-->', `<ul>\n        ${items}\n      </ul>`);
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

export default defineConfig({
  plugins: [htmlFromContent(), availableModels()],
});
