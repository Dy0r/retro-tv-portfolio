import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Builds the <noscript> project list from projects.json, so visitors and search
// engines without WebGL/JavaScript still see the work. No project text lives in HTML.
function noscriptProjects() {
  return {
    name: 'noscript-projects',
    transformIndexHtml(html) {
      const site = JSON.parse(readFileSync('src/content/site.json', 'utf8'));
      const projects = JSON.parse(readFileSync('src/content/projects.json', 'utf8'));
      const items = projects
        .map((p) => `<li><a href="/#/project/${p.slug}">${p.title}</a> (${p.year}) — ${p.summary}</li>`)
        .join('\n        ');
      return html
        .replace('<!--NOSCRIPT_NAME-->', site.name)
        .replace('<!--NOSCRIPT_PROJECTS-->', `<ul>\n        ${items}\n      </ul>`);
    },
  };
}

export default defineConfig({
  plugins: [noscriptProjects()],
});
