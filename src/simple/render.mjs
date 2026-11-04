// Builds the text-only pages from the same content files as the 3D site
// (src/content/site.json and src/content/projects/*.json). It runs in Vite
// (vite.config.js), so every page arrives as finished HTML: no JavaScript is needed
// to read it, and search engines see every word.
//
//  simple/            the index: every project, then About and Contact
//  work/<slug>/       one page per case study (the same addresses the old
//                     dylanprasodjo.com used, so old links and search results still work)
//  forwarding pages   old addresses that moved (see vite.config.js)
//  sitemap.xml, robots.txt, 404.html

export const esc = (s) =>
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

function linkList(list = [], cls = 'links') {
  if (!list.length) return '';
  const items = list.map((l) => {
    const external = /^https?:/.test(l.url) || l.url.endsWith('.pdf');
    return `<li><a href="${esc(l.href ?? l.url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}${external ? ' <span aria-hidden="true">↗</span>' : ''}</a></li>`;
  });
  return `<ul class="${cls}">${items.join('')}</ul>`;
}

// Shared helpers for one build: where files live and what the labels say.
function context({ site, base, imageSizes = {} }) {
  const asset = (path) => (/^[a-z]+:/i.test(path) ? path : base + path.replace(/^\//, ''));
  const absolute = (path) => (/^[a-z]+:/i.test(path) ? path : site.siteUrl + path.replace(/^\//, ''));
  const resolveLinks = (list = []) => list.map((l) => ({ ...l, href: asset(l.url) }));
  const paths = {
    index: `${base}simple/`,
    project: (slug) => `${base}work/${slug}/`,
    threeD: (slug) => (slug ? `${base}#/project/${slug}` : base),
  };

  function media(m, eager = false) {
    if (!m) return '';
    if (Array.isArray(m)) return m.map((x) => media(x)).join('');
    if (m.type === 'youtube') {
      return `<figure class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(m.id)}" title="${esc(m.alt)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></figure>`;
    }
    if (m.type === 'video') {
      return `<figure><video src="${esc(asset(m.src))}" controls preload="none" aria-label="${esc(m.alt)}"></video>${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
    }
    const size = imageSizes[m.src];
    const dims = size ? ` width="${size[0]}" height="${size[1]}"` : '';
    return `<figure><img src="${esc(asset(m.src))}" alt="${esc(m.alt)}"${dims}${eager ? '' : ' loading="lazy"'} decoding="async" />${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  }

  return { site, base, labels: site.simple, asset, absolute, resolveLinks, paths, media };
}

// Small centred masthead. On the index the name is the page's main heading; on
// case-study pages the project title is, so the name is just a link home.
function masthead(ctx, { nameIsHeading }) {
  const { site, labels, asset, paths } = ctx;
  const linkedin = site.socials.find((s) => /linkedin/i.test(s.url));
  const name = nameIsHeading ? `<h1>${esc(site.name)}</h1>` : `<p class="masthead__name"><a href="${esc(paths.index)}">${esc(site.name)}</a></p>`;
  return `
  <header class="masthead" id="top">
    <a class="masthead__mark" href="${esc(paths.index)}" aria-hidden="true" tabindex="-1"><img src="${esc(asset('/favicon.svg'))}" alt="" width="20" height="20" /></a>
    ${name}
    <p>${esc(site.introLines[0])}</p>
    <p><a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></p>
    <nav aria-label="Site">
      <ul>
        <li><a href="${esc(paths.index)}#about">${esc(labels.aboutHeading)}</a></li>
        <li><a href="${esc(asset(site.resume.file))}" target="_blank" rel="noopener">${esc(labels.resume)}</a></li>
        ${linkedin ? `<li><a href="${esc(linkedin.url)}" target="_blank" rel="noopener">${esc(linkedin.label)}</a></li>` : ''}
        <li><a href="${esc(paths.threeD())}">${esc(labels.open3d)}</a></li>
      </ul>
    </nav>
  </header>`;
}

function footer(ctx) {
  const { site, labels, paths } = ctx;
  return `
  <footer class="footer">
    <p>${esc(site.name)} · <a href="${esc(paths.threeD())}">${esc(labels.footer)}</a></p>
  </footer>`;
}

// Who the site is about, in a form search engines understand (schema.org Person).
function personData(site) {
  return {
    '@type': 'Person',
    name: site.name,
    jobTitle: site.seo.jobTitle,
    email: `mailto:${site.contact.email}`,
    url: site.siteUrl,
    sameAs: site.socials.map((s) => s.url),
    alumniOf: site.seo.alumniOf,
  };
}

export function personJsonLd(site) {
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...personData(site) })}</script>`;
}

// A complete page: head (title, description, link preview, canonical address,
// structured data), then the body. `assets` is the CSS/JS tags Vite produced.
function page(ctx, { title, description, path, image, imageAlt, structured, assets, content }) {
  const { site, absolute, asset } = ctx;
  const url = absolute(path);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="icon" type="image/svg+xml" href="${esc(asset('/favicon.svg'))}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(absolute(image))}" />
    <meta property="og:image:alt" content="${esc(imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...structured })}</script>
    ${assets}
  </head>
  <body>${content}
  </body>
</html>
`;
}

// The text index (simple/index.html): one project after another, big picture
// first, like a printed catalogue, then About and Contact.
export function renderSimpleSite({ site, projects, base, imageSizes }) {
  const ctx = context({ site, base, imageSizes });
  const { labels, paths, media, resolveLinks } = ctx;
  const about = site.menuPages.find((p) => p.id === 'about');
  const contact = site.menuPages.find((p) => p.id === 'contact');

  const works = projects
    .map(
      (p, i) => `
      <li class="work work--${'abc'[i % 3]}" id="p-${esc(p.slug)}">
        <a class="work__image" href="${esc(paths.project(p.slug))}" tabindex="-1" aria-hidden="true">${media(p.hero, i === 0).replace(/<\/?figure>/g, '')}</a>
        <h3 class="work__title"><a href="${esc(paths.project(p.slug))}">${esc(p.title)}</a> <span class="work__year">${esc(p.year)}</span></h3>
        <p class="work__summary">${esc(p.summary)}</p>
        <p class="work__meta">${esc(p.genre)} · ${esc(p.role)}</p>
        <ul class="work__links">
          <li><a href="${esc(paths.project(p.slug))}">${esc(labels.readCase)}</a></li>
          <li><a href="${esc(paths.threeD(p.slug))}">${esc(labels.view3d)} <span aria-hidden="true">↗</span></a></li>
        </ul>
      </li>`,
    )
    .join('');

  return `
  <a class="skip" href="#work">${esc(labels.skipLink)}</a>
  ${masthead(ctx, { nameIsHeading: true })}
  <main>
    <section id="work" aria-labelledby="h-work">
      <h2 id="h-work" class="sr-only">${esc(labels.workHeading)}</h2>
      <ol class="works">${works}
      </ol>
    </section>
    <section class="page" id="about" aria-labelledby="h-about">
      <h2 id="h-about">${esc(labels.aboutHeading)}</h2>
      ${about.sections.map((s) => `<h3>${esc(s.heading)}</h3>${body(s.body)}`).join('')}
    </section>
    <section class="page" id="contact" aria-labelledby="h-contact">
      <h2 id="h-contact">${esc(labels.contactHeading)}</h2>
      ${contact.sections.map((s) => body(s.body) + linkList(resolveLinks(s.links))).join('')}
    </section>
  </main>
  ${footer(ctx)}
  ${personJsonLd(site)}`;
}

// One case study as its own page: work/<slug>/index.html.
export function renderProjectPage({ site, project: p, projects, base, imageSizes, assets }) {
  const ctx = context({ site, base, imageSizes });
  const { labels, paths, media, resolveLinks } = ctx;
  const i = projects.findIndex((x) => x.slug === p.slug);
  const next = projects[(i + 1) % projects.length];

  const content = `
  <a class="skip" href="#case">${esc(labels.skipLink)}</a>
  ${masthead(ctx, { nameIsHeading: false })}
  <main>
    <article class="case" id="case" aria-labelledby="h-case">
      <p class="case__back"><a href="${esc(paths.index)}#p-${esc(p.slug)}"><span aria-hidden="true">←</span> ${esc(labels.backToWork)}</a></p>
      <header class="case__header">
        <h1 id="h-case">${esc(p.title)} <span class="work__year">${esc(p.year)}</span></h1>
        <p class="case__lead">${esc(p.summary)}</p>
        <p class="work__meta">${esc(p.genre)} · ${esc(p.role)}</p>
      </header>
      ${media(p.hero, true)}
      ${p.sections
        .map(
          (s) => `
      <section>
        <h2>${esc(s.heading)}</h2>
        ${body(s.body)}
        ${linkList(resolveLinks(s.links))}
        ${media(s.media)}
      </section>`,
        )
        .join('')}
      ${linkList(resolveLinks(p.links))}
      <ul class="case__end">
        <li><a href="${esc(paths.index)}#p-${esc(p.slug)}"><span aria-hidden="true">←</span> ${esc(labels.backToWork)}</a></li>
        <li><a href="${esc(paths.project(next.slug))}">${esc(labels.nextProject)}: ${esc(next.title)} <span aria-hidden="true">→</span></a></li>
        <li><a href="${esc(paths.threeD(p.slug))}">${esc(labels.view3d)} <span aria-hidden="true">↗</span></a></li>
      </ul>
    </article>
  </main>
  ${footer(ctx)}`;

  return page(ctx, {
    title: `${p.title} — ${site.name}`,
    description: p.summary,
    path: `/work/${p.slug}/`,
    image: p.hero.src,
    imageAlt: p.hero.alt,
    structured: {
      '@type': 'CreativeWork',
      name: p.title,
      headline: `${p.title} — ${site.name}`,
      description: p.summary,
      dateCreated: String(p.year),
      genre: p.genre,
      image: ctx.absolute(p.hero.src),
      url: ctx.absolute(`/work/${p.slug}/`),
      author: personData(site),
    },
    assets,
    content,
  });
}

// A tiny page that forwards an old address to its new home (search engines treat
// an instant refresh plus a canonical link like a permanent redirect).
export function renderRedirect({ site, base, to, title }) {
  const ctx = context({ site, base });
  const target = ctx.asset(to);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${esc(title)}</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${esc(ctx.absolute(to))}" />
    <meta http-equiv="refresh" content="0; url=${esc(target)}" />
  </head>
  <body>
    <p><a href="${esc(target)}">${esc(title)}</a></p>
  </body>
</html>
`;
}

// Every page worth finding, for search engines.
export function renderSitemap({ site, projects }) {
  const urls = ['', 'simple/', ...projects.map((p) => `work/${p.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(site.siteUrl + u)}</loc></url>`).join('\n')}
</urlset>
`;
}

export function renderRobots({ site }) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}sitemap.xml\n`;
}

// Shown by GitHub Pages for any address that doesn't exist.
export function renderNotFound({ site, base, assets }) {
  const ctx = context({ site, base });
  const { labels, paths } = ctx;
  return page(ctx, {
    title: `${labels.notFoundTitle} — ${site.name}`,
    description: site.metaDescription,
    path: '/404.html',
    image: `/${site.shareImage}`,
    imageAlt: site.shareImageAlt,
    structured: personData(site),
    assets,
    content: `
  ${masthead(ctx, { nameIsHeading: false })}
  <main>
    <section class="page page--plain">
      <h1>${esc(labels.notFoundTitle)}</h1>
      <p>${esc(labels.notFoundBody)}</p>
      <ul class="links">
        <li><a href="${esc(paths.index)}">${esc(labels.backToWork)}</a></li>
        <li><a href="${esc(paths.threeD())}">${esc(labels.open3d)}</a></li>
      </ul>
    </section>
  </main>
  ${footer(ctx)}`,
  });
}
