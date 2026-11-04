// Builds the text-only site (simple/index.html) from the same content files as the
// 3D site: src/content/site.json and src/content/projects/*.json. It runs in Vite
// (vite.config.js), so the page arrives as finished HTML: no JavaScript is needed to
// read it, and search engines see every word.
//
// One page holds the index and every case study. Each case study is an <article>
// with the project's slug as its id, hidden until a link points at it
// (simple/#plinth); CSS (:target) swaps the index for that article.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Paragraphs; lines starting with a dash become a bulleted list.
function body(lines = []) {
  let html = '';
  let list = [];
  const flush = () => {
    if (list.length) html += `<ul>${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    list = [];
  };
  for (const line of lines) {
    const bullet = line.match(/^[–-]\s+(.*)/);
    if (bullet) list.push(bullet[1]);
    else {
      flush();
      html += `<p>${esc(line)}</p>`;
    }
  }
  flush();
  return html;
}

function links(list = [], cls = 'links') {
  if (!list.length) return '';
  const items = list.map((l) => {
    const external = /^https?:/.test(l.url) || l.url.endsWith('.pdf');
    return `<li><a href="${esc(l.href ?? l.url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}${external ? ' <span aria-hidden="true">↗</span>' : ''}</a></li>`;
  });
  return `<ul class="${cls}">${items.join('')}</ul>`;
}

export function renderSimpleSite({ site, projects, base }) {
  const labels = site.simple;
  const asset = (path) => (/^[a-z]+:/i.test(path) ? path : base + path.replace(/^\//, ''));
  const resolveLinks = (list = []) => list.map((l) => ({ ...l, href: asset(l.url) }));
  const about = site.menuPages.find((p) => p.id === 'about');
  const contact = site.menuPages.find((p) => p.id === 'contact');
  const linkedin = site.socials.find((s) => /linkedin/i.test(s.url));

  function media(m, eager = false) {
    if (!m) return '';
    if (Array.isArray(m)) return m.map((x) => media(x)).join('');
    if (m.type === 'youtube') {
      return `<figure class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(m.id)}" title="${esc(m.alt)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></figure>`;
    }
    if (m.type === 'video') {
      return `<figure><video src="${esc(asset(m.src))}" controls preload="none" aria-label="${esc(m.alt)}"></video>${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
    }
    return `<figure><img src="${esc(asset(m.src))}" alt="${esc(m.alt)}"${eager ? '' : ' loading="lazy"'} decoding="async" />${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  }

  // The index: one project after another, big picture first, like a printed catalogue.
  const works = projects
    .map(
      (p, i) => `
      <li class="work work--${'abc'[i % 3]}" id="p-${esc(p.slug)}">
        <a class="work__image" href="#${esc(p.slug)}" tabindex="-1" aria-hidden="true">${media(p.hero, i === 0).replace(/<\/?figure>/g, '')}</a>
        <h3 class="work__title"><a href="#${esc(p.slug)}">${esc(p.title)}</a> <span class="work__year">${esc(p.year)}</span></h3>
        <p class="work__summary">${esc(p.summary)}</p>
        <p class="work__meta">${esc(p.genre)} · ${esc(p.role)}</p>
        <ul class="work__links">
          <li><a href="#${esc(p.slug)}">${esc(labels.readCase)}</a></li>
          <li><a href="${esc(base)}#/project/${esc(p.slug)}">${esc(labels.view3d)} <span aria-hidden="true">↗</span></a></li>
        </ul>
      </li>`,
    )
    .join('');

  // One article per project: the full case study.
  const cases = projects
    .map(
      (p) => `
    <article class="case" id="${esc(p.slug)}" aria-labelledby="h-${esc(p.slug)}">
      <p class="case__back"><a href="#p-${esc(p.slug)}"><span aria-hidden="true">←</span> ${esc(labels.backToWork)}</a></p>
      <header class="case__header">
        <h2 id="h-${esc(p.slug)}">${esc(p.title)} <span class="work__year">${esc(p.year)}</span></h2>
        <p class="case__lead">${esc(p.summary)}</p>
        <p class="work__meta">${esc(p.genre)} · ${esc(p.role)}</p>
      </header>
      ${media(p.hero)}
      ${p.sections
        .map(
          (s) => `
      <section>
        <h3>${esc(s.heading)}</h3>
        ${body(s.body)}
        ${links(resolveLinks(s.links))}
        ${media(s.media)}
      </section>`,
        )
        .join('')}
      ${links(resolveLinks(p.links))}
      <ul class="case__end">
        <li><a href="#p-${esc(p.slug)}"><span aria-hidden="true">←</span> ${esc(labels.backToWork)}</a></li>
        <li><a href="${esc(base)}#/project/${esc(p.slug)}">${esc(labels.view3d)} <span aria-hidden="true">↗</span></a></li>
      </ul>
    </article>`,
    )
    .join('');

  return `
  <a class="skip" href="#work">${esc(labels.skipLink)}</a>
  <header class="masthead" id="top">
    <a class="masthead__mark" href="#top" aria-hidden="true" tabindex="-1"><img src="${esc(asset('/favicon.svg'))}" alt="" width="20" height="20" /></a>
    <h1>${esc(site.name)}</h1>
    <p>${esc(site.introLines[0])}</p>
    <p><a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></p>
    <nav aria-label="Site">
      <ul>
        <li><a href="#about">${esc(labels.aboutHeading)}</a></li>
        <li><a href="${esc(asset(site.resume.file))}" target="_blank" rel="noopener">${esc(labels.resume)}</a></li>
        ${linkedin ? `<li><a href="${esc(linkedin.url)}" target="_blank" rel="noopener">${esc(linkedin.label)}</a></li>` : ''}
        <li><a href="${esc(base)}">${esc(labels.open3d)}</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <div class="index">
      <section id="work" aria-labelledby="h-work">
        <h2 id="h-work" class="sr-only">${esc(labels.workHeading)}</h2>
        <ol class="works">${works}
        </ol>
      </section>
      <section class="page" id="about" aria-labelledby="h-about">
        <h2 id="h-about">${esc(labels.aboutHeading)}</h2>
        ${about.sections
          .map((s) => `<h3>${esc(s.heading)}</h3>${body(s.body)}`)
          .join('')}
      </section>
      <section class="page" id="contact" aria-labelledby="h-contact">
        <h2 id="h-contact">${esc(labels.contactHeading)}</h2>
        ${contact.sections.map((s) => body(s.body) + links(resolveLinks(s.links))).join('')}
      </section>
    </div>
    ${cases}
  </main>
  <footer class="footer">
    <p>${esc(site.name)} · <a href="${esc(base)}">${esc(labels.footer)}</a></p>
  </footer>`;
}
