/**
 * Lightroom theme renderer
 * Clean, typographic, cream + black
 * All page types implemented — no fallbacks to base.js
 */

import { esc, buildHead, buildSiteNav, buildPostMeta, SITE_URL } from '../lib/templates.js';

/* --------------------------------------------------------------------------
   Image roles — exported for Signal image editor
   -------------------------------------------------------------------------- */

export const imageRoles = {
  layouts: [
    { className: 'img-break', label: 'Break',  description: 'Full viewport width — a cinematic pause between sections.' },
    { className: 'img-wide',  label: 'Wide',   description: 'Bleeds slightly outside the reading column.' },
    { className: 'img-small', label: 'Small',  description: 'Sits within the reading column — documentary or reference.' },
    { className: 'img-pair',  label: 'Pair',   description: 'Two images side by side — contrasts, sequences, before/after.' },
  ],
  treatments: [
    { className: 'photo-muted',  label: 'Muted',  description: 'Reduced saturation and contrast. Recommended default.', isDefault: true },
    { className: 'photo-mono',   label: 'Mono',   description: 'Strong monochrome — archival, stark, memory-like.' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated. Use when colour is the point.' },
    { className: 'photo-soft',   label: 'Soft',   description: 'Lower contrast, slightly lifted — reflective, quiet.' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};

/* --------------------------------------------------------------------------
   Shared partials
   -------------------------------------------------------------------------- */

function lrFooter(menuPages, activeSlug = '') {
  const links = [
    { href: '/posts/',  label: 'Essays'      },
    { href: '/notes/',  label: 'Notes'       },
    { href: '/photos/', label: 'Photos'      },
    ...menuPages
      .filter(p => p.status === 'published' && p.include_in_menu)
      .map(p => ({ href: p.nav_url || `/${p.slug}/`, label: p.title })),
  ];

  const navItems = links.map(({ href, label }) => {
    const isActive = href === activeSlug || href === `/${activeSlug}/`;
    return `<a href="${href}"${isActive ? ' class="active"' : ''}>${esc(label)}</a>`;
  }).join('\n        ');

  return `
  <footer class="lr-footer">
    <span class="lr-footer-copy">©${new Date().getFullYear()} JRBNZ</span>
    <nav class="lr-footer-nav">
      ${navItems}
    </nav>
  </footer>`;
}

function lrPostNav(backHref = '/posts/') {
  return `
  <nav class="lr-post-nav">
    <a href="/" class="lr-post-nav-logo">JRBNZ</a>
    <a href="${backHref}" class="lr-post-nav-back">← All Essays</a>
  </nav>`;
}

/* --------------------------------------------------------------------------
   buildHomepage
   -------------------------------------------------------------------------- */

export function buildHomepage(data) {
  const {
    theme, accent, snippetCss, extraHead,
    menuPages = [],
    featuredEssay = null,
    heroImage = null,
  } = data;

  const title    = featuredEssay?.title    || 'JRBNZ';
  const deck     = featuredEssay?.subtitle || '';
  const href     = featuredEssay ? `/posts/${featuredEssay.slug}/` : '/posts/';
  const kicker   = [
    (featuredEssay?.tags || []).find(t => t !== 'note'),
    featuredEssay?.date ? new Date(featuredEssay.date).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' }) : null,
    featuredEssay?.readTime ? `${featuredEssay.readTime} min` : null,
  ].filter(Boolean).join(' · ');

  const imageUrl = heroImage || '';
  const imageAlt = title;

  const ctaLabel = 'Read the essay';

  return `${buildHead({ title: null, theme, accent, snippetCss, extraHead })}
<main class="lr-home h-card">

  <div class="lr-home-logo">
    <a href="/">JRBNZ</a>
  </div>

  <section class="lr-home-essay">
    ${kicker ? `<p class="lr-home-kicker">${esc(kicker)}</p>` : ''}
    <a href="${href}" class="lr-home-title p-name">${esc(title)}</a>
    <div class="lr-home-rule"></div>
    ${deck ? `<p class="lr-home-excerpt">${esc(deck)}</p>` : ''}
    <a href="${href}" class="lr-home-cta">${esc(ctaLabel)}</a>
  </section>

  ${imageUrl ? `
  <div class="lr-home-image">
    <img src="${esc(imageUrl)}" alt="${esc(imageAlt)}">
  </div>` : ''}

  <nav class="lr-box-nav">
    <a href="/posts/"  class="lr-box-nav-item">Essays</a>
    <a href="/notes/"  class="lr-box-nav-item">Notes</a>
    <a href="/photos/" class="lr-box-nav-item">Photography</a>
  </nav>

  ${lrFooter(menuPages)}

</main>
</body></html>`;
}

/* --------------------------------------------------------------------------
   buildPost
   -------------------------------------------------------------------------- */

export function buildPost(data) {
  const {
    title, slug, date, dateFormatted, tags = [],
    contentHtml, subtitle,
    menuPages = [], snippetCss, extraHead,
    readTime, postUrl, theme, accent,
  } = data;

  const kicker = [
    tags[0] ? `<a href="/posts/?tag=${encodeURIComponent(tags[0])}">${esc(tags[0])}</a>` : null,
    dateFormatted || null,
    readTime ? `${readTime} min read` : null,
  ].filter(Boolean).join(' · ');

  const endingMeta = [
    tags[0] || '',
    dateFormatted ? dateFormatted.replace(/\d+\s/, '') : '', // Month Year only
  ].filter(Boolean).join(' · ');

  return `${buildHead({ title: esc(title), theme, accent, snippetCss, extraHead })}
<article class="lr-post h-entry">

  ${lrPostNav('/posts/')}

  <header class="lr-post-header">
    <p class="lr-post-kicker">${kicker}</p>
    <h1 class="lr-post-title p-name">${esc(title)}</h1>
    ${subtitle ? `<p class="lr-post-deck">${esc(subtitle)}</p>` : ''}
  </header>

  <div class="lr-post-body">
    <div class="post-content e-content">${contentHtml}</div>

    <footer class="lr-post-ending">
      <span class="lr-post-ending-meta">${esc(endingMeta)}</span>
      <a href="/posts/" class="lr-post-ending-back">← All Essays</a>
    </footer>
  </div>

  ${lrFooter(menuPages, '/posts/')}

</article>
</body></html>`;
}

/* --------------------------------------------------------------------------
   buildIndex — essays list
   -------------------------------------------------------------------------- */

export function buildIndex(data) {
  const {
    theme, accent, snippetCss, extraHead,
    menuPages = [],
    posts = [],
    tagChips = '',
  } = data;

  const postItems = posts
    .filter(p => p.status === 'published')
    .map(p => {
      const date = p.date
        ? new Date(p.date).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })
        : '';
      const tag  = p.tags?.[0] || '';
      const read = p.readTime ? `${p.readTime} min` : '';
      const tags = (p.tags || []).join(',');

      return `
    <a href="/posts/${esc(p.slug)}/"
       class="post-list-item"
       data-tags="${esc(tags)}">
      <span class="lr-post-item-date">${esc(date)}</span>
      <span>
        <span class="lr-post-item-title">${esc(p.title)}</span>
        ${tag ? `<span class="lr-post-item-tag">${esc(tag)}</span>` : ''}
      </span>
      <span class="lr-post-item-read">${esc(read)}</span>
    </a>`;
    }).join('\n');

  return `${buildHead({ title: 'Essays', theme, accent, snippetCss, extraHead })}
<main class="lr-index">

  ${buildSiteNav(menuPages, '/posts/')}

  <div class="lr-index-header">
    <h1 class="lr-index-title">Essays</h1>

    <div class="tag-filter-bar" id="tag-filter-bar" hidden>
      Essays tagged <strong id="tag-filter-label"></strong>
      <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
    </div>

    <div class="tags-section">
      ${tagChips}
    </div>
  </div>

  <div class="lr-post-list">
    ${postItems}
  </div>

  ${lrFooter(menuPages, '/posts/')}

</main>
<script src="/scripts/blog.js"></script>
</body></html>`;
}

/* --------------------------------------------------------------------------
   buildNotes
   -------------------------------------------------------------------------- */

export function buildNotes(data) {
  const {
    theme, accent, snippetCss, extraHead,
    menuPages = [],
    notes = [],
  } = data;

  const noteItems = notes.map(note => {
    const date = note.date
      ? new Date(note.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const tags = (note.tags || []).filter(t => t !== 'note').map(t => esc(t)).join(' · ');
    const meta = [date, tags].filter(Boolean).join(' · ');

    return `
    <article class="lr-note">
      <p class="lr-note-meta">
        <a href="/posts/${esc(note.slug)}/" class="lr-note-tag">${esc(meta)}</a>
      </p>
      <div class="lr-note-body">${note.bodyHtml}</div>
    </article>`;
  }).join('\n');

  return `${buildHead({ title: 'Notes', theme, accent, snippetCss, extraHead })}
<main class="lr-notes">

  ${buildSiteNav(menuPages, '/notes/')}

  <div class="lr-notes-body">
    <h1 class="lr-notes-title">Notes</h1>
    ${noteItems}
  </div>

  ${lrFooter(menuPages, '/notes/')}

</main>
</body></html>`;
}

/* --------------------------------------------------------------------------
   buildPage — CMS pages (About, Now, Theatre, etc.)
   -------------------------------------------------------------------------- */

export function buildPage(data) {
  const {
    title, slug, contentHtml,
    menuPages = [],
    theme, accent, snippetCss, extraHead,
  } = data;

  return `${buildHead({ title: esc(title), theme, accent, snippetCss, extraHead })}
<main class="lr-page">

  ${buildSiteNav(menuPages, `/${slug}/`)}

  <div class="lr-page-body">
    <h1 class="lr-page-title">${esc(title)}</h1>
    <div class="page-content">${contentHtml}</div>
  </div>

  ${lrFooter(menuPages, `/${slug}/`)}

</main>
</body></html>`;
}

/* --------------------------------------------------------------------------
   buildPhotos — re-use cinematic's photos page
   (photos are static HTML, only needs nav/footer wrapping)
   -------------------------------------------------------------------------- */

export { buildPhotos } from './cinematic.js';
