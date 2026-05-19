// Cinematic theme page renderers.
// Only exports functions where the HTML structure differs from the dark theme.
// The dispatcher in [[path]].js falls back to dark.js for anything not exported here.

// ── Image role metadata ───────────────────────────────────────────────────────
// Consumed by GET /api/theme/image-roles so Signal knows what to offer.
// Each role has className, label, description. Layouts and treatments combine.
export const imageRoles = {
  layouts: [
    {
      className: 'img-wide',
      label: 'Wide',
      description: 'Breaks slightly outside the reading column. Best for landscape, atmospheric, or location images.',
    },
    {
      className: 'img-break',
      label: 'Break',
      description: 'Full-width visual pause between sections. Best for mood images that reset the reader\'s attention.',
    },
    {
      className: 'img-small',
      label: 'Small',
      description: 'Modest image within the reading column. Best for archival, documentary, or reference images.',
    },
    {
      className: 'img-pair',
      label: 'Pair',
      description: 'Two images side by side on desktop. Insert two consecutive images with this layout to form a pair.',
    },
  ],
  treatments: [
    {
      className: 'photo-muted',
      label: 'Muted',
      description: 'Reduced saturation and contrast. Recommended default for atmospheric photos.',
      isDefault: true,
    },
    {
      className: 'photo-mono',
      label: 'Mono',
      description: 'Strong monochrome. Use for archival, cinematic, stark, or memory-like images.',
    },
    {
      className: 'photo-colour',
      label: 'Colour',
      description: 'Mostly untreated. Use when colour is important to the image.',
    },
    {
      className: 'photo-soft',
      label: 'Soft',
      description: 'Lower contrast, slightly lifted. Use for reflective, quiet, nostalgic, or landscape images.',
    },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};

import { esc, buildHead, buildSiteNav, buildNavLinks } from '../lib/templates.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function _fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${MONTHS[m-1]} ${day}, ${y}`;
}

function buildCinematicFooter(menuPages) {
  const navLinks = buildNavLinks(menuPages)
    .map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n      ');
  return `<footer class="cinematic-footer">
  <p class="cinematic-footer-quote">Writing about memory, theatre, technology and life in between.</p>
  <nav class="cinematic-footer-nav" aria-label="Footer">
    ${navLinks}
    <a href="/feed.xml">RSS</a>
  </nav>
</footer>`;
}

export function buildPage(data) {
  const { title, slug, contentHtml, menuPages, accent, snippetCss, year, theme } = data;
  return `${buildHead({ title, theme, accent, snippetCss })}
${buildSiteNav(menuPages, `/${slug}/`)}
<div class="ci-page-masthead">
  <h1 class="ci-page-title">${esc(title)}</h1>
</div>
<div class="surface-invert">
  <div class="ci-page-content">
    <div class="post-content page-content">${contentHtml}</div>
  </div>
</div>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
}

export function buildPhotos(data) {
  const { menuPages, accent, snippetCss, year, theme } = data;
  const extraHead = '<meta name="description" content="Photography portfolio by James Bell — theatre and travel photography"><link rel="stylesheet" href="/photos/styles/gallery.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css">';
  return `${buildHead({ title: 'Photos', theme, accent, snippetCss, extraHead })}
${buildSiteNav(menuPages, '/photos/')}
<div class="ci-page-masthead">
  <h1 class="ci-page-title">Photos</h1>
</div>
<section class="ci-photos-content">
  <nav class="filter-nav">
    <a href="/photos/" class="filter-back">← Photos</a>
    <a href="/photos/?category=theatre" class="filter-link" data-category="theatre">Theatre</a>
    <a href="/photos/?category=travel" class="filter-link" data-category="travel">Travel</a>
  </nav>
  <div class="category-overview hidden" id="category-overview"></div>
  <div class="hero-panel hidden" id="hero-panel">
    <div class="hero-image-wrap">
      <a class="glightbox" href="" id="hero-link" data-gallery="hero">
        <img id="hero-image" src="" alt="" loading="lazy">
      </a>
    </div>
    <div class="hero-description" id="hero-description"></div>
  </div>
  <div id="loading" class="loading">Loading photos...</div>
  <div id="gallery" class="gallery"></div>
  <div id="error" class="error" style="display:none"></div>
  <nav class="pagination" id="pagination" style="display:none">
    <button id="prev-btn" class="pagination-btn" disabled>← Previous</button>
    <span id="page-info" class="page-info"></span>
    <button id="next-btn" class="pagination-btn" disabled>Next →</button>
  </nav>
</section>
<script src="/photos/scripts/gallery.js"></script>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
}

export function buildHomepage(data) {
  const { author, recentPosts, menuPages, accent, snippetCss, theme, defaultCoverImage } = data;
  const essays = (recentPosts || []).filter(p => !(p.tags || []).includes('note'));
  const featured = essays[0];
  const stripPosts = essays.slice(1, 5);

  const homeFeatured = featured ? `
<section class="ci-featured" id="home-featured">
  ${(featured.coverImage || defaultCoverImage) ? `<img class="ci-featured-img" src="${esc(featured.coverImage || defaultCoverImage)}" alt="${esc(featured.coverImageAlt || '')}" style="object-position:${esc(featured.coverImageFocus || 'center')} center" loading="eager">` : ''}
  <div class="ci-featured-overlay">
    <div class="ci-featured-inner">
      <p class="post-kicker">Featured Essay · ${esc(_fmtDate(featured.date))}</p>
      <h2 class="ci-featured-title"><a href="/posts/${esc(featured.slug)}/">${esc(featured.title)}</a></h2>
      ${(featured.subtitle || featured.excerpt) ? `<p class="ci-featured-excerpt">${esc(featured.subtitle || featured.excerpt)}</p>` : ''}
      <a href="/posts/${esc(featured.slug)}/" class="ci-read-link">Read the essay →</a>
    </div>
  </div>
</section>` : '';

  const cmsPages = (menuPages || []).filter(p => p.include_in_menu && p.status === 'published' && p.slug !== 'now');
  const thirdPage = cmsPages[0];
  const thirdBlock = thirdPage
    ? `<a class="home-block" href="${esc(thirdPage.nav_url || `/${thirdPage.slug}/`)}">
    <div>
      <p class="home-block-kicker">${esc(thirdPage.title)}</p>
      <h2 class="home-block-title">${esc(thirdPage.title)}</h2>
    </div>
    <span class="home-block-link">View ${esc(thirdPage.title.toLowerCase())} →</span>
  </a>`
    : '';

  const recentItems = stripPosts.map(p => {
    const tag = (p.tags || [])[0] || '';
    const meta = [tag, _fmtDate(p.date)].filter(Boolean).join(' · ');
    return `<li class="home-recent-row">
      <a href="/posts/${esc(p.slug)}/" class="home-recent-item">
        <span class="home-recent-title">${esc(p.title)}</span>
        <span class="home-recent-meta">${esc(meta)}</span>
      </a>
    </li>`;
  }).join('');

  const interlude = `
<section class="home-interlude">
  <p class="home-interlude-text">Theatre, memory, technology, photographs, and the odd quiet corner.</p>
</section>`;

  const recentSection = stripPosts.length ? `
<section class="home-recent">
  <p class="home-recent-label">Recently</p>
  <ul class="home-recent-list">
    ${recentItems}
    <li class="home-recent-row">
      <a href="/posts/" class="home-recent-item home-recent-all">
        <span class="home-recent-title">All essays</span>
        <span class="home-recent-meta">Archive →</span>
      </a>
    </li>
  </ul>
</section>` : '';

  const extraHead = `<meta name="description" content="${esc(author?.bio || 'Writing about memory, theatre, technology and life in between.')}">
<link rel="alternate" type="application/rss+xml" title="James Bell" href="/feed.xml">
<link rel="authorization_endpoint" href="https://jrbnz.com/api/indieauth/auth">
<link rel="token_endpoint" href="https://jrbnz.com/api/indieauth/token">
<link rel="micropub" href="https://jrbnz.com/api/micropub">
<link rel="me" href="https://github.com/mrjamesbell">`;

  return `${buildHead({ title: null, theme, accent, snippetCss, extraHead })}
${buildSiteNav(menuPages, '/')}
<main class="h-card">
  <span class="p-name" hidden>${esc(author?.name || 'James Bell')}</span>
  ${homeFeatured}
  <section class="home-blocks">
    <a class="home-block" href="/posts/">
      <div>
        <p class="home-block-kicker">Essays</p>
        <h2 class="home-block-title">Long-form pieces that behave more like scenes than posts.</h2>
      </div>
      <span class="home-block-link">Read essays →</span>
    </a>
    <a class="home-block home-block-invert" href="/photos/">
      <div>
        <p class="home-block-kicker">Photographs</p>
        <h2 class="home-block-title">Theatre, travel, lake and the odd quiet corner.</h2>
      </div>
      <span class="home-block-link">View photographs →</span>
    </a>
    ${thirdBlock}
  </section>
  ${interlude}
  ${recentSection}
</main>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
}

export function buildIndex(data) {
  const { posts, tagChips, menuPages, accent, snippetCss, year, theme, defaultCoverImage } = data;
  const essays = (posts || []).filter(p => !(p.tags || []).includes('note'));
  const notes  = (posts || []).filter(p =>  (p.tags || []).includes('note'));

  const featured = essays[0];
  const rest = essays.slice(1);

  const featuredCard = featured ? `
<section class="ci-featured" id="ci-featured" data-tags="${esc((featured.tags || []).join(','))}">
  ${(featured.coverImage || defaultCoverImage) ? `<img class="ci-featured-img" src="${esc(featured.coverImage || defaultCoverImage)}" alt="${esc(featured.coverImageAlt || '')}" style="object-position:${esc(featured.coverImageFocus || 'center')} center" loading="eager">` : ''}
  <div class="ci-featured-overlay">
    <div class="ci-featured-inner">
      <p class="post-kicker">${featured.tags?.[0] ? `${esc(featured.tags[0])} · ` : ''}${esc(_fmtDate(featured.date))}</p>
      <h2 class="ci-featured-title"><a href="/posts/${esc(featured.slug)}/">${esc(featured.title)}</a></h2>
      ${(featured.subtitle || featured.excerpt) ? `<p class="ci-featured-excerpt">${esc(featured.subtitle || featured.excerpt)}</p>` : ''}
      <a href="/posts/${esc(featured.slug)}/" class="ci-read-link">Read the essay →</a>
    </div>
  </div>
</section>` : '';

  const _postCard = (p, extraClass = '') => {
    const tag = (p.tags || [])[0] || '';
    const meta = [tag, _fmtDate(p.date)].filter(Boolean).join(' · ');
    const img = p.coverImage || defaultCoverImage;
    return `<a href="/posts/${esc(p.slug)}/" class="essay-card post-list-item${extraClass ? ' ' + extraClass : ''}" data-tags="${esc((p.tags || []).join(','))}">
      ${img
        ? `<img class="essay-card-img" src="${esc(img)}" alt="${esc(p.coverImageAlt || '')}" style="object-position:${esc(p.coverImageFocus || 'center')} center" loading="lazy">`
        : '<div class="essay-card-no-img"></div>'}
      <h3 class="essay-card-title">${esc(p.title)}</h3>
      <p class="essay-card-meta">${esc(meta)}</p>
    </a>`;
  };

  const postCards = rest.map(p => _postCard(p)).join('');
  const noteCards = notes.map(p => _postCard(p, 'note-post')).join('');

  const tagsSection = tagChips ? `
<section class="ci-tags">
  <div class="tag-filter-bar" id="tag-filter-bar" hidden>
    Posts tagged <strong id="tag-filter-label"></strong>
    <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
  </div>
  <div class="tags-section">${tagChips}</div>
</section>` : '';

  return `${buildHead({ title: 'Essays', theme, accent, snippetCss })}
${buildSiteNav(menuPages, '/posts/')}
<main>
  ${featuredCard}
  ${(rest.length || notes.length) ? `<section class="more-essays ci-index-all">
  <p class="more-essays-label">All essays</p>
  <div class="essay-strip">${postCards}${noteCards}</div>
</section>` : ''}
  ${tagsSection}
</main>
<script src="/scripts/blog.js"></script>
${buildCinematicFooter(menuPages)}
</body></html>`;
}

export function buildPost(data) {
  const { title, slug, date, dateFormatted, tags, contentHtml, author, accent,
          menuPages, snippetCss, readTime, postUrl, extraHead,
          year, theme, coverImage, coverImageAlt, coverImageFocus, recentPosts, subtitle } = data;

  const isNote = (tags || []).includes('note');
  const focus = coverImageFocus || 'center';
  const kicker = [dateFormatted, `${readTime} min read`, ...(tags || []).filter(t => t !== 'note').slice(0, 1)]
    .filter(Boolean).join(' · ');

  // Notes: compact dark header, no full-viewport hero
  if (isNote) {
    const essayCards = (recentPosts || []).map(p => {
      const tag = (p.tags || [])[0] || '';
      const meta = [tag, p.date ? p.date.slice(0, 4) : ''].filter(Boolean).join(' · ');
      return `<a href="/posts/${esc(p.slug)}/" class="essay-card">
        ${p.coverImage ? `<img class="essay-card-img" src="${esc(p.coverImage)}" alt="" style="object-position:${esc(p.coverImageFocus || 'center')} center" loading="lazy">` : '<div class="essay-card-no-img"></div>'}
        <h3 class="essay-card-title">${esc(p.title)}</h3>
        <p class="essay-card-meta">${esc(meta)}</p>
      </a>`;
    }).join('');

    const moreEssays = recentPosts && recentPosts.length ? `
<section class="more-essays">
  <p class="more-essays-label">More essays</p>
  <div class="essay-strip">
    ${essayCards}
    <a href="/posts/" class="essay-card essay-card--archive">
      <div class="essay-card-no-img"></div>
      <h3 class="essay-card-title">All essays</h3>
      <p class="essay-card-meta">Archive</p>
    </a>
  </div>
</section>` : '';

    return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
${buildSiteNav(menuPages, '/posts/')}
<article class="h-entry">
<div class="post-hero-compact">
  <p class="post-kicker">${esc(kicker)}</p>
  <h1 class="post-hero-compact-title p-name">${esc(title)}</h1>
  ${subtitle ? `<p class="post-hero-dek">${esc(subtitle)}</p>` : ''}
</div>
<div class="surface-invert">
  <div class="article-col article-open article-section">
    <div class="post-content e-content">${contentHtml}</div>
  </div>
</div>
${moreEssays}
<a href="${esc(postUrl)}" class="u-url" hidden></a>
</article>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
  }

  // Essays: full-viewport hero
  const heroImg = coverImage
    ? `<img class="post-hero-img" src="${esc(coverImage)}" alt="${esc(coverImageAlt || '')}" style="object-position:${esc(focus)} center" loading="eager">`
    : '';

  const heroDek = subtitle
    ? `<p class="post-hero-dek">${esc(subtitle)}</p>`
    : '';

  const authorBox = author && author.name ? `
<div class="author-box">
  <div class="author-box-inner">
    ${author.headshotUrl ? `<img class="author-box-avatar" src="${esc(author.headshotUrl)}" alt="${esc(author.name)}">` : ''}
    <div>
      <p class="author-box-name">${esc(author.name)}</p>
      ${author.bio ? `<p class="author-box-bio">${esc(author.bio)}</p>` : ''}
    </div>
  </div>
</div>` : '';

  const essayCards = (recentPosts || []).map(p => {
    const tag = (p.tags || [])[0] || '';
    const yr = p.date ? p.date.slice(0, 4) : '';
    const meta = [tag, yr].filter(Boolean).join(' · ');
    return `<a href="/posts/${esc(p.slug)}/" class="essay-card">
      ${p.coverImage
        ? `<img class="essay-card-img" src="${esc(p.coverImage)}" alt="${esc(p.coverImageAlt || '')}" style="object-position:${esc(p.coverImageFocus || 'center')} center" loading="lazy">`
        : '<div class="essay-card-no-img"></div>'}
      <h3 class="essay-card-title">${esc(p.title)}</h3>
      <p class="essay-card-meta">${esc(meta)}</p>
    </a>`;
  }).join('');

  const moreEssays = recentPosts && recentPosts.length ? `
<section class="more-essays">
  <p class="more-essays-label">More essays</p>
  <div class="essay-strip">
    ${essayCards}
    <a href="/posts/" class="essay-card essay-card--archive">
      <div class="essay-card-no-img"></div>
      <h3 class="essay-card-title">All essays</h3>
      <p class="essay-card-meta">Archive</p>
    </a>
  </div>
</section>` : '';

  return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
${buildSiteNav(menuPages, '/posts/')}
<article class="h-entry">
<section class="post-hero">
  ${heroImg}
  <div class="post-hero-content">
    <p class="post-kicker">${esc(kicker)}</p>
    <h1 class="post-hero-title p-name">${esc(title)}</h1>
    ${heroDek}
  </div>
</section>
<div class="surface-invert">
  <div class="article-col article-open article-section">
    <div class="post-content e-content">${contentHtml}</div>
  </div>
</div>
${moreEssays}
<a href="${esc(postUrl)}" class="u-url" hidden></a>
</article>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
}

export function buildNotes(data) {
  const { notes, menuPages, accent, snippetCss, theme } = data;

  const noteItems = (notes || []).map(note => {
    const otherTags = (note.tags || []).filter(t => t !== 'note');
    const tagHtml = otherTags.map(t => `<span class="note-tag">${esc(t)}</span>`).join('');
    return `
<article class="note-entry">
  <div class="note-meta">
    <time class="note-date">${esc(_fmtDate(note.date))}</time>
    ${tagHtml}
  </div>
  <div class="note-body post-content">${note.bodyHtml || ''}</div>
</article>`;
  }).join('');

  return `${buildHead({ title: 'Notes', theme, accent, snippetCss })}
${buildSiteNav(menuPages, '/notes/')}
<div class="ci-page-masthead">
  <h1 class="ci-page-title">Notes</h1>
</div>
<div class="surface-invert">
  <section class="notes-stream">
    ${noteItems || '<p class="notes-empty">No notes yet.</p>'}
  </section>
</div>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
}
