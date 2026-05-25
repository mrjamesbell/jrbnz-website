/**
 * functions/themes/basic.js
 * Warm Serif theme renderer for jrbnz.com
 *
 * Exports: buildPost, buildIndex, buildPage, buildHomepage, buildPhotos, buildNotes, imageRoles
 */

import { esc, buildHead, buildSiteNav, buildNavLinks, SITE_URL } from '../lib/templates.js';

/* ------------------------------------------------------------------
   imageRoles — tells Signal which layout/treatment options to offer
   ------------------------------------------------------------------ */
export const imageRoles = {
  layouts: [
    { className: 'img-wide',  label: 'Wide',  description: 'Breaks slightly outside the reading column' },
    { className: 'img-break', label: 'Break', description: 'Full-width pause between sections' },
    { className: 'img-small', label: 'Small', description: 'Within the reading column, modest size' },
    { className: 'img-pair',  label: 'Pair',  description: 'Two images side by side on desktop' },
  ],
  treatments: [
    { className: 'photo-muted',  label: 'Muted',  description: 'Reduced saturation and contrast', isDefault: true },
    { className: 'photo-mono',   label: 'Mono',   description: 'Strong monochrome' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated' },
    { className: 'photo-soft',   label: 'Soft',   description: 'Lower contrast, slightly lifted' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};

/* ------------------------------------------------------------------
   Shared footer
   ------------------------------------------------------------------ */
function buildBasicFooter(menuPages, year) {
  const links = buildNavLinks(menuPages)
    .map(({ href, label }) => `<a href="${href}">${esc(label)}</a>`)
    .join('\n        ');

  return `
  <footer class="basic-footer">
    <span class="basic-footer-copy">©${year} JRBNZ</span>
    <nav class="basic-footer-nav" aria-label="Footer">
      ${links}
      <a href="/feed.xml">RSS</a>
    </nav>
  </footer>`;
}

/* ------------------------------------------------------------------
   buildPost
   ------------------------------------------------------------------ */
export function buildPost(data) {
  const {
    title, slug, date, dateFormatted, tags = [], contentHtml,
    excerpt, subtitle, coverImage, coverImageAlt, coverImageFocus,
    author, authorCard, accent, menuPages, snippetCss, extraHead,
    readTime, postUrl, prevPost, nextPost, year, theme,
  } = data;

  const tagHtml = tags.length
    ? `<div class="post-tags">${tags.map(t => `<span class="post-tag">${esc(t)}</span>`).join('')}</div>`
    : '';

  const coverHtml = coverImage
    ? `<img class="post-cover photo-muted" src="${esc(coverImage)}" alt="${esc(coverImageAlt)}" style="object-position:${esc(coverImageFocus || 'center')}">`
    : '';

  const subtitleHtml = subtitle
    ? `<p class="post-subtitle">${esc(subtitle)}</p>`
    : '';

  const prevHtml = prevPost
    ? `<a class="post-nav-link" href="/${esc(prevPost.slug)}/">
        <div class="post-nav-dir">← Previous</div>
        <div class="post-nav-title">${esc(prevPost.title)}</div>
      </a>`
    : '<span></span>';

  const nextHtml = nextPost
    ? `<a class="post-nav-link post-nav-next" href="/${esc(nextPost.slug)}/">
        <div class="post-nav-dir">Next →</div>
        <div class="post-nav-title">${esc(nextPost.title)}</div>
      </a>`
    : '<span></span>';

  return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
  ${buildSiteNav(menuPages, `/posts/`)}

  <article class="post-shell h-entry">

    <header class="post-header">
      <div class="post-kicker">Essay</div>
      <h1 class="post-title p-name">${esc(title)}</h1>
      ${subtitleHtml}
      <div class="post-meta">
        <time datetime="${esc(date)}">${esc(dateFormatted)}</time>
        <span class="post-meta-sep">·</span>
        <span>${readTime} min read</span>
      </div>
      ${tagHtml}
    </header>

    ${coverHtml}

    <div class="post-content e-content">
      ${contentHtml}
    </div>

    ${authorCard ? `<div class="author-card">${authorCard}</div>` : ''}

    <nav class="post-nav" aria-label="Post navigation">
      ${prevHtml}
      ${nextHtml}
    </nav>

  </article>

  ${buildBasicFooter(menuPages, year)}
  </body></html>`;
}

/* ------------------------------------------------------------------
   buildIndex
   ------------------------------------------------------------------ */
export function buildIndex(data) {
  const {
    items, tagChips, menuPages, accent, snippetCss, year, theme, posts = [],
  } = data;

  return `${buildHead({ title: 'Essays', theme, accent, snippetCss })}
  ${buildSiteNav(menuPages, '/posts/')}

  <main class="index-shell">
    <h1 class="index-heading">Essays</h1>
    <hr class="index-rule">

    <div class="tag-filter-bar" id="tag-filter-bar" hidden>
      Essays tagged <strong id="tag-filter-label"></strong>
      <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
    </div>

    <div class="tags-section">
      ${tagChips}
    </div>

    <ul class="post-list">
      ${items}
    </ul>
  </main>

  ${buildBasicFooter(menuPages, year)}
  </body></html>`;
}

/* ------------------------------------------------------------------
   buildPage  (About, Now, etc.)
   ------------------------------------------------------------------ */
export function buildPage(data) {
  const {
    title, slug, contentHtml, menuPages, accent, snippetCss, year, theme,
  } = data;

  return `${buildHead({ title, theme, accent, snippetCss })}
  ${buildSiteNav(menuPages, `/${slug}/`)}

  <main class="page-shell">
    <h1 class="page-title">${esc(title)}</h1>
    <hr class="page-rule">
    <div class="page-content">
      ${contentHtml}
    </div>
  </main>

  ${buildBasicFooter(menuPages, year)}
  </body></html>`;
}

/* ------------------------------------------------------------------
   buildHomepage
   ------------------------------------------------------------------ */
export function buildHomepage(data) {
  const {
    author, recentPosts = [], menuPages, accent, snippetCss, theme,
    defaultCoverImage, homepageConfig,
  } = data;

  const year = new Date().getFullYear();

  /* --- Featured post -------------------------------------------- */
  const cfg      = homepageConfig || {};
  const featCfg  = cfg.featured || {};
  const featured = recentPosts.find(p => p.slug === featCfg.slug) || recentPosts[0];

  let featuredHtml = '';
  if (featured) {
    const featTitle = featCfg.titleOverride || featured.title;
    const featDek   = featCfg.dekOverride   || featured.subtitle || featured.excerpt;
    const featImg   = featCfg.imageOverride || featured.coverImage || defaultCoverImage;
    const featCta   = featCfg.ctaLabel      || 'Read the essay →';
    const imgHtml   = featImg
      ? `<img class="home-featured-img" src="${esc(featImg)}" alt="${esc(featured.coverImageAlt || featTitle)}">`
      : '';
    const dekHtml   = featDek ? `<p class="home-featured-dek">${esc(featDek)}</p>` : '';

    featuredHtml = `
    <section class="home-featured">
      <div class="home-section-label">Latest essay</div>
      <a class="home-featured-link" href="/${esc(featured.slug)}/">
        ${imgHtml}
        <h2 class="home-featured-title">${esc(featTitle)}</h2>
        ${dekHtml}
        <span class="home-featured-cta">${esc(featCta)}</span>
      </a>
    </section>`;
  }

  /* --- Recent posts grid (skip featured) ------------------------ */
  const otherPosts = recentPosts.filter(p => p.slug !== (featured && featured.slug)).slice(0, 3);
  const recentHtml = otherPosts.length ? `
    <section class="home-recent">
      <div class="home-section-label">More recent</div>
      <div class="home-recent-grid">
        ${otherPosts.map(p => `
        <a class="home-recent-item" href="/${esc(p.slug)}/">
          <div class="home-recent-date">${esc(p.date)}</div>
          <div class="home-recent-title">${esc(p.title)}</div>
        </a>`).join('')}
      </div>
    </section>` : '';

  /* --- Nav cards ------------------------------------------------ */
  const defaultCards = [
    { kicker: 'Essays',      title: 'Long-form pieces on theatre, memory, and technology', href: '/posts/',  linkLabel: 'Read essays →',      style: '' },
    { kicker: 'Photographs', title: 'Theatre, travel, and the quiet sky',                  href: '/photos/', linkLabel: 'View photographs →',   style: 'invert' },
    { kicker: 'Now',         title: 'What I\'m doing right now',                           href: '/now/',    linkLabel: 'Read →',               style: '' },
  ];
  const cards = (cfg.cards && cfg.cards.length) ? cfg.cards : defaultCards;
  const cardsHtml = `
    <div class="home-cards">
      ${cards.map(c => `
      <a class="home-card${c.style === 'invert' ? ' invert' : ''}" href="${esc(c.href)}">
        <div class="home-card-kicker">${esc(c.kicker)}</div>
        <div class="home-card-title">${esc(c.title)}</div>
        <div class="home-card-link">${esc(c.linkLabel)}</div>
      </a>`).join('')}
    </div>`;

  return `${buildHead({ title: null, theme, accent, snippetCss })}
  ${buildSiteNav(menuPages, '/')}

  <main class="home-shell h-card">
    <div class="home-intro">
      <h1 class="home-name p-name">${esc(author.name)}</h1>
      <p class="home-bio p-note">${esc(author.bio)}</p>
    </div>

    ${featuredHtml}
    ${recentHtml}
    ${cardsHtml}
  </main>

  ${buildBasicFooter(menuPages, year)}
  </body></html>`;
}

/* ------------------------------------------------------------------
   buildPhotos
   ------------------------------------------------------------------ */
export function buildPhotos(data) {
  const { menuPages, accent, year, theme } = data;

  return `${buildHead({ title: 'Photographs', theme, accent })}
  ${buildSiteNav(menuPages, '/photos/')}

  <div class="photos-shell">
    <h1 class="photos-heading">Photographs</h1>
    <!-- Static photos content injected from site/photos/index.html -->
  </div>

  ${buildBasicFooter(menuPages, year)}
  </body></html>`;
}

/* ------------------------------------------------------------------
   buildNotes
   ------------------------------------------------------------------ */
export function buildNotes(data) {
  const { notes = [], menuPages, accent, snippetCss, theme } = data;

  const year = new Date().getFullYear();

  const notesHtml = notes.map(note => {
    const tagsHtml = note.tags && note.tags.length
      ? `<div class="note-tags">${note.tags.map(t => `<span class="note-tag">#${esc(t)}</span>`).join(' ')}</div>`
      : '';

    const titleHtml = note.title
      ? `<h2 class="note-title"><a href="/notes/${esc(note.slug)}/">${esc(note.title)}</a></h2>`
      : '';

    return `
    <article class="note-item">
      <div class="note-date">${esc(note.date)}</div>
      ${titleHtml}
      <div class="note-body">${note.bodyHtml}</div>
      ${tagsHtml}
    </article>`;
  }).join('');

  return `${buildHead({ title: 'Notes', theme, accent, snippetCss })}
  ${buildSiteNav(menuPages, '/notes/')}

  <main class="notes-shell">
    <h1 class="notes-heading">Notes</h1>
    <hr class="notes-rule">
    ${notesHtml}
  </main>

  ${buildBasicFooter(menuPages, year)}
  </body></html>`;
}
