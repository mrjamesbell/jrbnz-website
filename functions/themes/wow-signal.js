/**
 * wow-signal.js — jrbnz.com theme renderer
 * File: functions/themes/wow-signal.js
 *
 * Register in functions/api/[[path]].js:
 *   import * as wowSignal from '../themes/wow-signal.js';
 *   const THEMES = { ..., 'wow-signal': wowSignal };
 */

import {
  esc,
  buildHead,
  buildSiteNav,
  buildFooter,
  buildPostMeta,
  buildAuthorCard,
  SITE_URL,
} from '../lib/templates.js';

const THEME = 'wow-signal';


/* ──────────────────────────────────────────────────────────
   imageRoles — tells Signal which layout/treatment options
   to show in the image editor for this theme.
   ────────────────────────────────────────────────────────── */

export const imageRoles = {
  layouts: [
    { className: 'img-wide',  label: 'Wide',  description: 'Breaks slightly outside the reading column' },
    { className: 'img-break', label: 'Break', description: 'Full-width pause between sections' },
    { className: 'img-small', label: 'Small', description: 'Within the reading column, modest size' },
    { className: 'img-pair',  label: 'Pair',  description: 'Two images side by side on desktop' },
  ],
  treatments: [
    { className: 'photo-blue',   label: 'Blue',   description: 'Cyan-wash tint matching the theme palette', isDefault: true },
    { className: 'photo-muted',  label: 'Muted',  description: 'Reduced saturation and contrast' },
    { className: 'photo-mono',   label: 'Mono',   description: 'Strong monochrome' },
    { className: 'photo-soft',   label: 'Soft',   description: 'Lower contrast, slightly lifted' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-blue' },
};


/* ──────────────────────────────────────────────────────────
   HOMEPAGE
   ────────────────────────────────────────────────────────── */

export function buildHomepage({ author, recentPosts, menuPages, accent, snippetCss, theme, homepageConfig }) {
  const cfg   = homepageConfig ?? {};
  const posts = recentPosts ?? [];

  // Notes are identified by a 'note' tag — separate from essays
  const isNote = p => Array.isArray(p.tags) && p.tags.includes('note');

  // Featured post — config slug wins; otherwise most recent non-note post
  const essays = posts.filter(p => !isNote(p));
  const featuredPost = cfg.featured?.slug
    ? posts.find(p => p.slug === cfg.featured.slug) ?? essays[0]
    : essays[0];

  const featuredTitle = cfg.featured?.titleOverride ?? featuredPost?.title ?? '';
  const featuredDek   = cfg.featured?.dekOverride   ?? featuredPost?.subtitle ?? featuredPost?.excerpt ?? '';
  const featuredCta   = cfg.featured?.ctaLabel       ?? 'Read the essay →';
  const featuredHref  = featuredPost ? `/posts/${esc(featuredPost.slug)}/` : '/posts/';

  // Mixed recent feed — all posts except featured, newest first, up to 8
  const recents = posts
    .filter(p => p.slug !== featuredPost?.slug)
    .slice(0, 8);

  const recentItems = recents.length
    ? recents.map(p => {
        if (isNote(p)) {
          return `<li>
          <p class="ws-recent-note">${esc(p.excerpt ?? p.title)}</p>
          <p class="ws-recent-meta">${esc(p.dateFormatted ?? p.date)}</p>
        </li>`;
        }
        return `<li>
        <a href="/posts/${esc(p.slug)}/" class="ws-recent-title">${esc(p.title)}</a>
        <p class="ws-recent-meta">${esc(p.dateFormatted ?? p.date)}${p.readTime ? ` · ${p.readTime} min` : ''}</p>
      </li>`;
      }).join('\n')
    : '';

  // Nav cards — use config or defaults
  const cards = cfg.cards ?? [
    { kicker: 'Essays',      title: 'Long-form writing on theatre, photography, and the technology of remembering.', href: '/posts/',  linkLabel: 'Read essays →',     style: '' },
    { kicker: 'Photographs', title: 'Theatre production stills, travel, and long-exposure night sky work.',          href: '/photos/', linkLabel: 'View photographs →', style: 'ws-card--raised' },
    { kicker: 'Now',         title: 'What I\'m directing, reading, and thinking about this month.',                  href: '/now/',    linkLabel: 'Read →',             style: '' },
  ];

  const cardHtml = cards.map(c => `
    <a href="${esc(c.href)}" class="ws-card ${esc(c.style ?? '')}">
      <p class="kicker">${esc(c.kicker)}</p>
      <p class="ws-card-title">${esc(c.title)}</p>
      <p class="ws-card-link">${esc(c.linkLabel)}</p>
    </a>`).join('\n');

  // Interlude quote — only rendered if configured
  const interludeText = cfg.interlude?.text ?? '';
  const interlude = interludeText
    ? `<div class="ws-interlude">
        <blockquote>${esc(interludeText)}</blockquote>
       </div>`
    : '';

  // Featured block — only rendered if we have a post to show
  const featuredHtml = featuredPost ? `
  <div class="ws-featured-strip">
    <div class="ws-featured-main">
      <p class="kicker">Latest essay</p>
      <h1 class="ws-featured-title p-name">${esc(featuredTitle)}</h1>
      ${featuredDek ? `<p class="ws-featured-dek">${esc(featuredDek)}</p>` : ''}
      <a href="${featuredHref}" class="ws-read-link">${esc(featuredCta)}</a>
    </div>
    <div class="ws-featured-aside">
      <ul class="ws-recents">${recentItems}</ul>
    </div>
  </div>` : '';

  return `${buildHead({ title: null, theme: THEME, accent, snippetCss })}
<main class="h-card">
  ${buildSiteNav(menuPages, '/')}

  <div class="ws-dot-hero">
    <canvas class="ws-dot-canvas" id="wsDotHero"></canvas>
  </div>

  ${featuredHtml}

  <div class="ws-cards">${cardHtml}</div>

  ${interlude}

</main>
${buildFooter(menuPages, new Date().getFullYear())}

<script>
(function () {
  const canvas = document.getElementById('wsDotHero');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const COLS = 34;
  const ROWS = 6;
  const HEIGHT = 130;

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = HEIGHT;
  }
  resize();
  window.addEventListener('resize', function () { resize(); initDots(); });

  // Read the current --color-accent from the theme token so the canvas
  // automatically matches whichever palette is active.
  function getAccentRgb() {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim();
    // Parse #rrggbb or #rgb
    if (raw.startsWith('#')) {
      const h = raw.slice(1);
      if (h.length === 6) {
        return [
          parseInt(h.slice(0,2), 16),
          parseInt(h.slice(2,4), 16),
          parseInt(h.slice(4,6), 16),
        ];
      }
      if (h.length === 3) {
        return [
          parseInt(h[0]+h[0], 16),
          parseInt(h[1]+h[1], 16),
          parseInt(h[2]+h[2], 16),
        ];
      }
    }
    return [79, 195, 247]; // fallback: signal blue
  }

  function getBgRgb() {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg').trim();
    if (raw.startsWith('#')) {
      const h = raw.slice(1);
      if (h.length === 6) {
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
      }
    }
    return [5, 11, 20]; // fallback: signal blue bg
  }

  var dots = [];
  var t = 0;

  function initDots() {
    dots = [];
    var cw = canvas.width;
    var ch = canvas.height;
    var sx = cw / (COLS + 1);
    var sy = ch / (ROWS + 1);
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        dots.push({
          x:     sx * (c + 1),
          y:     sy * (r + 1),
          base:  Math.random(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.6,
          r:     sx * 0.26,
        });
      }
    }
  }
  initDots();

  function envelope(col, time) {
    var peak = (Math.sin(time * 0.35) * 0.5 + 0.5) * COLS;
    var w = COLS * 0.25;
    var d = col - peak;
    return Math.exp(-(d * d) / (2 * w * w));
  }

  function draw() {
    var bg     = getBgRgb();
    var accent = getAccentRgb();

    ctx.fillStyle = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    t += 0.016;

    for (var i = 0; i < dots.length; i++) {
      var d   = dots[i];
      var col = i % COLS;
      var sig = envelope(col, t);
      var flicker = 0.5 + 0.5 * Math.sin(t * d.speed + d.phase);
      var b = d.base * 0.2 + sig * flicker * 0.8;

      var r  = Math.min(255, Math.round(bg[0] + b * accent[0]));
      var g  = Math.min(255, Math.round(bg[1] + b * accent[1]));
      var bl = Math.min(255, Math.round(bg[2] + b * accent[2]));

      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  draw();
}());
</script>
</body></html>`;
}


/* ──────────────────────────────────────────────────────────
   ESSAYS INDEX  (/posts/)
   ────────────────────────────────────────────────────────── */

export function buildIndex({ items, tagChips, menuPages, accent, snippetCss, posts, year }) {
  return `${buildHead({ title: 'Essays', theme: THEME, accent, snippetCss })}
<main>
  ${buildSiteNav(menuPages, '/posts/')}

  <div class="ws-posts-header">
    <span class="ws-posts-title">Essays</span>
    <span class="ws-post-count">${posts?.length ?? 0} essays</span>
  </div>

  <div id="tag-filter-bar" class="tag-filter-bar" hidden>
    Essays tagged <strong id="tag-filter-label"></strong>
    <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
  </div>

  <div class="tag-filter-row tags-section">
    ${tagChips}
  </div>

  <ul class="post-list">${items}</ul>

</main>
${buildFooter(menuPages, year)}
</body></html>`;
}


/* ──────────────────────────────────────────────────────────
   SINGLE POST
   ────────────────────────────────────────────────────────── */

export function buildPost({
  title, slug, date, dateFormatted, tags, contentHtml, excerpt, subtitle,
  author, authorCard, accent, menuPages, snippetCss, readTime, postUrl,
  extraHead, prevPost, nextPost, year,
}) {
  const metaDesc = excerpt || subtitle || '';
  const tagList  = (tags ?? []).map(t =>
    `<a href="/posts/?tag=${esc(t)}" class="tag-chip">#${esc(t)}</a>`
  ).join(' ');

  const prevNav = prevPost
    ? `<a href="/posts/${esc(prevPost.slug)}/" class="ws-post-nav-prev">
        <p class="ws-nav-dir">← Previous</p>
        <p class="ws-nav-title">${esc(prevPost.title)}</p>
       </a>`
    : `<div></div>`;

  const nextNav = nextPost
    ? `<a href="/posts/${esc(nextPost.slug)}/" class="ws-post-nav-next">
        <p class="ws-nav-dir">Next →</p>
        <p class="ws-nav-title">${esc(nextPost.title)}</p>
       </a>`
    : `<div></div>`;

  return `${buildHead({
    title,
    theme: THEME,
    accent,
    snippetCss,
    extraHead: buildPostMeta({ title, postUrl, metaDesc, date, authorName: author?.name }),
  })}
<article class="h-entry">
  ${buildSiteNav(menuPages, '/posts/')}

  <header class="ws-post-header">
    <p class="kicker">${(tags ?? []).map(esc).join(' · ')}${readTime ? ` · ${readTime} min read` : ''}</p>
    <h1 class="ws-post-title-display p-name">${esc(title)}</h1>
    ${subtitle ? `<p class="ws-post-subtitle">${esc(subtitle)}</p>` : ''}
    <div class="ws-post-byline post-meta">
      <span>${esc(author?.name ?? '')}</span>
      <span>${esc(dateFormatted ?? date)}</span>
      ${readTime ? `<span>${readTime} min</span>` : ''}
    </div>
  </header>

  <div class="ws-article-col">
    <div class="post-content e-content">${contentHtml}</div>
    ${tagList ? `<div class="tags-section" style="margin-top:2.5rem;">${tagList}</div>` : ''}
  </div>

  ${authorCard ? `<div class="author-card">${authorCard}</div>` : ''}

  <nav class="ws-post-nav">${prevNav}${nextNav}</nav>

</article>
${buildFooter(menuPages, year)}
</body></html>`;
}


/* ──────────────────────────────────────────────────────────
   STATIC PAGES  (/about/, /now/, etc.)
   ────────────────────────────────────────────────────────── */

export function buildPage({ title, slug, contentHtml, menuPages, accent, snippetCss, year }) {
  return `${buildHead({ title, theme: THEME, accent, snippetCss })}
<main>
  ${buildSiteNav(menuPages, `/${esc(slug)}/`)}

  <header class="ws-page-header">
    <p class="kicker">${esc(title)}</p>
    <h1 class="ws-page-title">${esc(title)}</h1>
  </header>

  <div class="ws-page-col page-content">
    ${contentHtml}
  </div>

</main>
${buildFooter(menuPages, year)}
</body></html>`;
}


/* ──────────────────────────────────────────────────────────
   NOTES STREAM  (/notes/)
   ────────────────────────────────────────────────────────── */

export function buildNotes({ notes, menuPages, accent, snippetCss, theme }) {
  const noteItems = (notes ?? []).map(n => `
    <li class="ws-note-item h-entry" id="${esc(n.slug)}">
      <p class="ws-note-date">${esc(n.date)}</p>
      <div class="ws-note-body e-content">${n.bodyHtml}</div>
      ${n.tags?.length
        ? `<div class="ws-note-tags">${n.tags.map(t =>
            `<a href="/posts/?tag=${esc(t)}" class="tag-chip">#${esc(t)}</a>`
          ).join(' ')}</div>`
        : ''}
    </li>`).join('\n');

  return `${buildHead({ title: 'Notes', theme: THEME, accent, snippetCss })}
<main>
  ${buildSiteNav(menuPages, '/notes/')}

  <header class="ws-posts-header">
    <span class="ws-posts-title">Notes</span>
    <span class="ws-post-count">${notes?.length ?? 0} notes</span>
  </header>

  <ul class="ws-notes-list">${noteItems}</ul>

</main>
${buildFooter(menuPages, new Date().getFullYear())}
</body></html>`;
}


/* ──────────────────────────────────────────────────────────
   PHOTOS PAGE  (/photos/)
   Static HTML is in site/photos/index.html — this just
   wraps it in nav + footer.
   ────────────────────────────────────────────────────────── */

export function buildPhotos({ menuPages, accent, year, theme }) {
  return `${buildHead({ title: 'Photographs', theme: THEME, accent })}
<main>
  ${buildSiteNav(menuPages, '/photos/')}
  <div id="photos-content"></div>
</main>
${buildFooter(menuPages, year)}
</body></html>`;
}
