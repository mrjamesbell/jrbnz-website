// JRBNZ theme renderer: brash-editorial
// Only exports buildHomepage and imageRoles — other pages fall back to cinematic/dark.

import { esc, buildHead, buildSiteNav, buildNavLinks } from '../lib/templates.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function _fmtDateShort(d) {
  if (!d) return '';
  const [y, m] = d.split('-').map(Number);
  return `${MONTHS[m-1]} ${y}`;
}

function buildBrashFooter(menuPages) {
  const navLinks = buildNavLinks(menuPages)
    .map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n    ');
  return `<footer class="cinematic-footer">
  <p class="cinematic-footer-quote">Writing about memory, theatre, technology and life in between.</p>
  <nav class="cinematic-footer-nav">
    ${navLinks}
    <a href="/feed.xml">RSS</a>
  </nav>
</footer>`;
}

export const imageRoles = {
  layouts: [
    { className: 'img-wide',  label: 'Wide',  description: 'Breaks slightly outside the reading column.' },
    { className: 'img-break', label: 'Break', description: 'Full-width visual interruption between sections.' },
    { className: 'img-small', label: 'Small', description: 'Contained, documentary, or reference image.' },
    { className: 'img-pair',  label: 'Pair',  description: 'Two related images side by side on desktop.' },
  ],
  treatments: [
    { className: 'photo-muted',  label: 'Muted',  description: 'Reduced saturation and contrast.', isDefault: true },
    { className: 'photo-mono',   label: 'Mono',   description: 'Strong monochrome editorial treatment.' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated colour.' },
    { className: 'photo-soft',   label: 'Soft',   description: 'Lower contrast and reflective.' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};

export function buildHomepage(data) {
  const { author, recentPosts, menuPages, accent, snippetCss, theme, defaultCoverImage, homepageConfig } = data;
  const cfg = homepageConfig || {};
  const essays = (recentPosts || []).filter(p => !(p.tags || []).includes('note'));

  // Featured
  let featured = essays[0];
  if (cfg.featured?.slug) {
    const found = essays.find(p => p.slug === cfg.featured.slug);
    if (found) featured = found;
  }
  const featuredTitle = cfg.featured?.titleOverride || featured?.title || '';
  const featuredImage = cfg.featured?.imageOverride || featured?.coverImage || defaultCoverImage;
  const featuredCta = cfg.featured?.ctaLabel || 'Read the essay →';
  const featuredHref = featured ? `/posts/${esc(featured.slug)}/` : '/posts/';
  const featuredDate = featured?.date ? _fmtDateShort(featured.date) : '';

  // Cards — default to 4 editorial blocks
  const defaultCards = [
    { kicker: 'Essays',   title: 'Ideas, memories, arguments and strange little observations.', href: '/posts/',  linkLabel: 'Read essays →' },
    { kicker: 'Notes',    title: 'Shorter thoughts, fragments and useful things.',              href: '/notes/',  linkLabel: 'Read notes →' },
    { kicker: 'Photos',   title: 'Theatre, travel, places and visual scraps.',                 href: '/photos/', linkLabel: 'View photos →' },
    { kicker: 'Archive',  title: 'Older pieces worth resurfacing.',                             href: '/posts/',  linkLabel: 'Browse →' },
  ];
  const cards = cfg.cards?.length ? cfg.cards.slice(0, 4) : defaultCards;
  const cardsHtml = cards.map(card => `
    <a class="home-block" href="${esc(card.href || '#')}">
      <div>
        <p class="home-block-kicker">${esc(card.kicker || '')}</p>
        <h2 class="home-block-title">${esc(card.title || '')}</h2>
      </div>
      <span class="home-block-link">${esc(card.linkLabel || 'Open →')}</span>
    </a>`).join('');

  // Archive
  const archiveTitle = cfg.archive?.title || 'From the Archive';
  let archivePosts;
  if (cfg.archive?.posts?.length) {
    archivePosts = cfg.archive.posts.map(slug => essays.find(p => p.slug === slug)).filter(Boolean);
  } else {
    archivePosts = essays.filter(p => p.slug !== featured?.slug).slice(0, 3);
  }
  const archiveItems = archivePosts.map(p => `
    <a href="/posts/${esc(p.slug)}/" class="home-archive-item">
      <span class="home-archive-title">${esc(p.title)}</span>
      <span class="home-archive-meta">${esc((p.tags || []).find(t => t !== 'note') || 'Essay')}</span>
    </a>`).join('');

  const extraHead = `<meta name="description" content="${esc(author?.bio || 'Writing about memory, theatre, technology and life in between.')}">
<link rel="alternate" type="application/rss+xml" title="James Bell" href="/feed.xml">`;

  return `${buildHead({ title: null, theme, accent, snippetCss, extraHead })}
${buildSiteNav(menuPages, '/')}
<main class="brash-home h-card">
  <span class="p-name" hidden>${esc(author?.name || 'James Bell')}</span>
  <section class="brash-hero" id="home-featured">
    <div class="brash-hero-copy">
      <div>
        <h1 class="brash-hero-title">Ideas, memories, arguments and <em>strange</em> little observations.</h1>
        ${featured ? `<div class="brash-featured">
          <p class="post-kicker">Latest essay${featuredDate ? ` · ${esc(featuredDate)}` : ''}</p>
          <h2><a href="${featuredHref}">${esc(featuredTitle)}</a></h2>
          <a href="${featuredHref}" class="ci-read-link">${esc(featuredCta)}</a>
        </div>` : ''}
      </div>
    </div>
    <div class="brash-hero-media">
      <div class="brash-hero-img-wrap">
        ${featuredImage ? `<img class="brash-hero-img" src="${esc(featuredImage)}" alt="${esc(featured?.coverImageAlt || '')}" loading="eager">` : ''}
        ${featuredDate ? `<div class="brash-date-badge">${esc(featuredDate)}</div>` : ''}
      </div>
      <div class="brash-card-grid">
        ${cardsHtml}
      </div>
    </div>
  </section>
  <div class="brash-strip">
    <p>New writing every few weeks. No algorithm. Just human.</p>
    <a href="/feed.xml">RSS →</a>
  </div>
  ${archivePosts.length ? `<section class="home-archive">
    <div class="home-archive-label">${esc(archiveTitle)}</div>
    <div class="home-archive-list">${archiveItems}</div>
  </section>` : ''}
</main>
${buildBrashFooter(menuPages)}
</body>
</html>`;
}
