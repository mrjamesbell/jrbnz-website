/*
  Brash Editorial renderer for jrbnz.com.

  Install at: functions/themes/brash-editorial.js
  Exports only buildHomepage and imageRoles. Other pages fall back to dark.js.
*/

import { esc, buildHead, buildSiteNav, buildNavLinks, buildPostMeta, SITE_URL } from '../lib/templates.js';

function postHref(post) {
  return `/posts/${post.slug}/`;
}

function firstTag(post) {
  return (post.tags || []).find((tag) => tag && tag.toLowerCase() !== 'note') || 'Essay';
}

function formatDateLabel(dateString) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date).toUpperCase();
}

function pickPostBySlug(posts, slug) {
  if (!slug) return null;
  return posts.find((post) => post.slug === slug) || null;
}

function resolveFeatured(recentPosts, homepageConfig = {}) {
  const essays = recentPosts.filter((post) => !(post.tags || []).includes('note'));
  const configured = pickPostBySlug(recentPosts, homepageConfig?.featured?.slug);
  return configured || essays[0] || recentPosts[0] || null;
}

function resolveCards(menuPages = [], homepageConfig = {}) {
  if (Array.isArray(homepageConfig?.cards) && homepageConfig.cards.length) {
    return homepageConfig.cards.slice(0, 4);
  }

  const navPages = buildNavLinks(menuPages || []);
  const firstNavPage = navPages.find((page) => page.href !== '/posts/' && page.href !== '/photos/');

  return [
    {
      kicker: 'Essays',
      title: 'Long-form pieces, odd memories and arguments with myself.',
      href: '/posts/',
      linkLabel: 'Read essays →',
      style: '',
    },
    {
      kicker: 'Notes',
      title: 'Shorter thoughts before they grow up into essays.',
      href: '/notes/',
      linkLabel: 'Read notes →',
      style: '',
    },
    {
      kicker: 'Photos',
      title: 'Theatre, travel, landscapes and useful atmosphere.',
      href: '/photos/',
      linkLabel: 'View photos →',
      style: '',
    },
    {
      kicker: firstNavPage?.label || 'Now',
      title: firstNavPage ? `The latest from ${firstNavPage.label}.` : "What I'm doing, thinking about, and trying next.",
      href: firstNavPage?.href || '/now/',
      linkLabel: 'Read →',
      style: 'invert',
    },
  ];
}

function resolveArchivePosts(recentPosts, featured, homepageConfig = {}) {
  const configured = Array.isArray(homepageConfig?.archive?.posts)
    ? homepageConfig.archive.posts.map((slug) => pickPostBySlug(recentPosts, slug)).filter(Boolean)
    : [];

  if (configured.length) return configured.slice(0, 3);

  return recentPosts
    .filter((post) => post.slug !== featured?.slug)
    .filter((post) => !(post.tags || []).includes('note'))
    .slice(0, 3);
}

function renderCard(card, index) {
  const href = card.href || '#';
  const styleAttr = card.style ? ` data-style="${esc(card.style)}"` : '';
  return `
    <a class="brash-card" href="${esc(href)}"${styleAttr}>
      <div>
        <p class="brash-card-kicker">${esc(card.kicker || `Block ${index + 1}`)}</p>
        <h2 class="brash-card-title">${esc(card.title || '')}</h2>
      </div>
      <span class="brash-card-link">${esc(card.linkLabel || 'Read →')}</span>
    </a>`;
}

function renderArchiveItem(post) {
  return `
    <a href="${esc(postHref(post))}" class="brash-archive-item">
      <span class="brash-archive-title">${esc(post.title)}</span>
      <span class="brash-archive-meta">${esc(firstTag(post))} · ${esc(formatDateLabel(post.date))}</span>
    </a>`;
}

export function buildHomepage({
  author,
  recentPosts = [],
  menuPages = [],
  accent = null,
  snippetCss = null,
  theme = 'brash-editorial',
  defaultCoverImage = null,
  homepageConfig = null,
}) {
  const config = homepageConfig || {};
  const featured = resolveFeatured(recentPosts, config);
  const cards = resolveCards(menuPages, config).slice(0, 4);
  const archivePosts = resolveArchivePosts(recentPosts, featured, config);

  const title = author?.name ? `${author.name}` : 'jrbnz.com';
  const metaDesc = featured?.excerpt || featured?.subtitle || 'Personal essays, notes, photographs and observations.';
  const featuredTitle = config?.featured?.titleOverride || featured?.title || 'Ideas, memories, arguments and strange little observations.';
  const featuredDek = config?.featured?.dekOverride || featured?.subtitle || featured?.excerpt || 'Personal essays, notes, photographs and observations.';
  const featuredImage = config?.featured?.imageOverride || featured?.coverImage || defaultCoverImage;
  const featuredHref = featured ? postHref(featured) : '/posts/';
  const featuredDate = featured ? formatDateLabel(featured.date) : 'Latest';
  const ctaLabel = config?.featured?.ctaLabel || 'Read the essay →';

  const interlude = config?.interlude || {};
  const interludeText = interlude.text || 'Ideas, memories, arguments and strange little observations.';
  const interludeImage = interlude.image || featuredImage;
  const interludeTreatment = interlude.treatment || 'photo-muted';
  const interludeTag = interlude.href ? 'a' : 'section';
  const interludeHref = interlude.href ? ` href="${esc(interlude.href)}"` : '';

  const archiveTitle = config?.archive?.title || 'From the Archive';

  return `${buildHead({
    title,
    theme,
    accent,
    snippetCss,
    extraHead: buildPostMeta({
      title,
      metaDesc,
      ogImage: featuredImage,
      authorName: author?.name,
      postUrl: SITE_URL,
    }),
  })}
${buildSiteNav(menuPages, '/')}
<main class="brash-home h-card">
  <section class="brash-home-hero" id="home-featured">
    <div class="brash-home-copy">
      <div>
        <p class="brash-home-kicker">Latest Essay · ${esc(featuredDate)}</p>
        <h1 class="brash-home-title"><a href="${esc(featuredHref)}">${esc(featuredTitle)}</a></h1>
      </div>
      <div>
        <p class="brash-home-excerpt">${esc(featuredDek)}</p>
        <a class="brash-read-link" href="${esc(featuredHref)}">${esc(ctaLabel)}</a>
      </div>
    </div>
    ${featuredImage ? `
    <div class="brash-home-media">
      <img src="${esc(featuredImage)}" alt="${esc(featured?.coverImageAlt || '')}">
      <div class="brash-home-date">${esc(featuredDate)}</div>
    </div>` : ''}
  </section>

  <section class="brash-card-grid" aria-label="Site sections">
    ${cards.map(renderCard).join('\n')}
  </section>

  <${interludeTag} class="brash-interlude"${interludeHref}>
    ${interludeImage ? `<img class="brash-interlude-img ${esc(interludeTreatment)}" src="${esc(interludeImage)}" alt="">` : ''}
    <p class="brash-interlude-text">${esc(interludeText)}</p>
  </${interludeTag}>

  <section class="brash-archive">
    <div class="brash-archive-head">
      <p class="brash-section-label">${esc(archiveTitle)}</p>
      <a class="brash-section-label" href="/posts/">All essays →</a>
    </div>
    <div class="brash-archive-list">
      ${archivePosts.map(renderArchiveItem).join('\n')}
    </div>
  </section>
</main>
<footer class="cinematic-footer">
  <p class="cinematic-footer-quote">Personal essays, observations and memories from a perpetually curious mind.</p>
  <nav class="cinematic-footer-nav">
    <a href="/posts/">Essays</a>
    <a href="/notes/">Notes</a>
    <a href="/feed.xml">RSS</a>
  </nav>
</footer>
</body>
</html>`;
}

export const basedOn = 'cinematic';

export const imageRoles = {
  layouts: [
    { className: 'img-wide', label: 'Wide', description: 'Large editorial image, slightly wider than the reading column.' },
    { className: 'img-break', label: 'Break', description: 'Full-width visual interruption between sections.' },
    { className: 'img-small', label: 'Small', description: 'Modest documentary image within the reading column.' },
    { className: 'img-pair', label: 'Pair', description: 'Two related images side by side on desktop, stacked on mobile.' },
  ],
  treatments: [
    { className: 'photo-muted', label: 'Muted', description: 'Slightly softened colour for atmospheric images.', isDefault: true },
    { className: 'photo-mono', label: 'Mono', description: 'Black-and-white editorial treatment.' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated colour.' },
    { className: 'photo-soft', label: 'Soft', description: 'Lower contrast, reflective treatment.' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
