// The text-only pages work without JavaScript (see render.mjs). This file only
// loads their fonts and styles, and forwards old index links to case studies
// (simple/#plinth) to the case study's own page (work/plinth/).
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '../styles/tokens.css';
import './simple.css';

const slug = window.location.hash.slice(1);
if (slug && document.getElementById(`p-${slug}`)) {
  window.location.replace(new URL(`../work/${slug}/`, window.location.href));
}
