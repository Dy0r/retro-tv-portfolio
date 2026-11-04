// The text-only site works without JavaScript (see render.mjs). This file only
// loads its fonts and styles, and keeps the browser tab title in step with the
// case study being read.
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '../styles/tokens.css';
import './simple.css';

const baseTitle = document.title;

function updateTitle() {
  const article = document.querySelector('.case:target h2');
  document.title = article ? `${article.firstChild.textContent.trim()} — ${baseTitle}` : baseTitle;
}

window.addEventListener('hashchange', updateTitle);
updateTitle();
