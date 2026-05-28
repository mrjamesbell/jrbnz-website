import {
  esc,
  buildHead,
  buildNavLinks,
  buildPostMeta,
} from '../lib/templates.js';

const DEFAULT_HOME_TITLE = 'Essays, notes, photographs, and small transmissions from Auckland, theatre, technology, memory, and the rest of it.';
const DEFAULT_HOME_DEK = 'A personal website, not a platform. No growth strategy. No content funnel. Just the things worth keeping.';
const DEFAULT_INDEX_TITLE = 'An index of things that refused to leave quietly.';

function nav(menuPages = [], activeHref = '') {
  const links = buildNavLinks(menuPages);
  const items = links.map((l) => {
    const href = l.href || '#';
    const active = href === activeHref ? ' class="active"' : '';
    return `<a href="${esc(href)}"${active}>${esc(l.label)}</a>`;
  }).join('');

  return `<header class="cb-site-header">
    <div class="cb-wrap">
      <div class="cb-header-inner">
        <a href="/" class="cb-wordmark">JRBNZ</a>
        <nav class="cb-nav" aria-label="Main">${items}</nav>
      </div>
    </div>
  </header>`;
}

function footer(menuPages = [], year = new Date().getFullYear()) {
  const links = buildNavLinks(menuPages)
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');
  return `<footer class="cb-footer">
    <div class="cb-footer-inner">
      <span>©${esc(year)} JRBNZ</span>
      <nav aria-label="Footer">${links}<a href="/feed.xml">RSS</a></nav>
    </div>
  </footer>`;
}

function postHref(post) {
  return `/posts/${esc(post.slug)}/`;
}

function postMeta(post) {
  const date = post.dateFormatted || post.date || '';
  const read = post.readTime ? `${post.readTime} min read` : post.wordCount ? `${Math.max(1, Math.round(post.wordCount / 220))} min read` : '';
  const tags = Array.isArray(post.tags) && post.tags.length ? `#${post.tags.map(esc).join(' #')}` : '';
  return [date, read, tags].filter(Boolean).join('<br>');
}

function groupByYear(posts = []) {
  return posts.reduce((acc, post) => {
    const year = String(post.date || '').slice(0, 4) || 'Archive';
    if (!acc[year]) acc[year] = [];
    acc[year].push(post);
    return acc;
  }, {});
}

function archiveList(posts = [], { compact = false, excludeFirst = false } = {}) {
  const source = excludeFirst ? posts.slice(1) : posts;
  const limited = compact ? source.slice(0, 3) : source;
  const grouped = groupByYear(limited);

  return `<div class="cb-archive-list">
    ${Object.entries(grouped).map(([year, items]) => `<section class="cb-year-group">
      <div class="cb-year">${esc(year)}</div>
      <div class="cb-year-posts">
        ${items.map((post) => {
          const tags = Array.isArray(post.tags) ? post.tags.join(',') : '';
          const title = post.title || 'Untitled';
          const excerpt = post.excerpt || post.subtitle || '';
          return `<a class="post-list-item cb-post-row" data-tags="${esc(tags)}" href="${postHref(post)}">
            <div class="cb-meta">${postMeta(post)}</div>
            <div>
              <h2 class="cb-post-title">${esc(title)}</h2>
              ${excerpt ? `<p class="cb-summary">${esc(excerpt)}</p>` : ''}
            </div>
          </a>`;
        }).join('')}
      </div>
    </section>`).join('')}
  </div>`;
}

function tagChips(tags = []) {
  return `<section class="tags-section"><div class="tags-inner">
    ${tags}
  </div></section>`;
}

function authorBox(author = {}) {
  const name = author.name || 'James Bell';
  const bio = author.bio || 'James writes about theatre, technology, memory, landscapes, and the odd systems people build around themselves.';
  const avatar = author.avatar ? `<img class="cb-author-avatar" src="${esc(author.avatar)}" alt="${esc(name)}">` : `<div class="cb-author-avatar" aria-hidden="true"></div>`;

  return `<footer class="cb-author-box">
    <div class="cb-author-inner">
      ${avatar}
      <div>
        <div class="cb-kicker">Written by</div>
        <h2 class="cb-author-name">${esc(name)}</h2>
        <p class="cb-author-copy">${esc(bio)}</p>
        <div class="cb-author-links">
          <a href="/posts/">More essays</a>
          <a href="/about/">About ${esc(name.split(' ')[0] || name)}</a>
          <a href="/feed.xml">RSS</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function coverBlock(post) {
  if (!post.coverImage) return '';
  const alt = post.coverImageAlt || post.title || '';
  const focus = post.coverImageFocus || 'center';
  return `<figure class="cb-article-cover img-break photo-soft">
    <div class="cb-cover-inner">
      <img class="cb-cover-image" src="${esc(post.coverImage)}" alt="${esc(alt)}" style="object-position:${esc(focus)}">
      ${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}
    </div>
  </figure>`;
}

export function buildHomepage(data) {
  const {
    author,
    recentPosts = [],
    menuPages = [],
    accent,
    snippetCss,
    theme,
    homepageConfig = {},
  } = data;

  const title = homepageConfig?.title || DEFAULT_HOME_TITLE;
  const dek = homepageConfig?.dek || homepageConfig?.description || DEFAULT_HOME_DEK;
  const latest = recentPosts[0];

  return `${buildHead({ title: author?.name || 'JRBNZ', theme, accent, snippetCss })}
  <main class="cb-shell h-card">
    ${nav(menuPages, '/')}
    <section class="cb-hero">
      <div class="cb-hero-inner">
        <h1 class="cb-hero-title">${esc(title)}</h1>
        <p class="cb-hero-dek">${esc(dek)}</p>
      </div>
    </section>
    ${latest ? `<section class="cb-latest">
      <div class="cb-latest-inner">
        <div class="cb-kicker">Latest</div>
        <a href="${postHref(latest)}">
          <div class="cb-meta">${postMeta(latest)}</div>
          <h2 class="cb-latest-title">${esc(latest.title)}</h2>
          ${(latest.excerpt || latest.subtitle) ? `<p class="cb-summary">${esc(latest.excerpt || latest.subtitle)}</p>` : ''}
        </a>
      </div>
    </section>` : ''}
    <section class="cb-section"><div class="cb-section-inner">${archiveList(recentPosts, { compact: true, excludeFirst: true })}</div></section>
    <section class="cb-section"><div class="cb-section-inner cb-home-cards">
      <a class="cb-home-card" href="/posts/"><div class="cb-kicker">Essays</div><p>Longer pieces about theatre, memory, places, systems, and small obsessions.</p></a>
      <a class="cb-home-card" href="/notes/"><div class="cb-kicker">Notes</div><p>Short fragments, stray thoughts, and things that do not need to become essays.</p></a>
      <a class="cb-home-card" href="/photos/"><div class="cb-kicker">Photos</div><p>Images from travel, theatre, weather, backstage corners, and ordinary light.</p></a>
    </div></section>
    ${footer(menuPages, data.year)}
  </main>
  </body></html>`;
}

export function buildIndex(data) {
  const {
    posts = [],
    tagChips = '',
    menuPages = [],
    accent,
    snippetCss,
    theme,
  } = data;

  return `${buildHead({ title: 'Essays', theme, accent, snippetCss })}
  <main class="cb-shell">
    ${nav(menuPages, '/posts/')}
    <section class="cb-page-head">
      <div class="cb-page-head-inner">
        <div class="cb-kicker">Essays</div>
        <div><h1 class="cb-page-title">${DEFAULT_INDEX_TITLE}</h1></div>
      </div>
    </section>
    ${tagChips ? tagChipsWrapper(tagChips) : ''}
    <section class="cb-section">
      <div class="cb-section-inner">
        <div class="tag-filter-bar" id="tag-filter-bar" hidden>
          Essays tagged <strong id="tag-filter-label"></strong>
          <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
        </div>
        ${archiveList(posts)}
      </div>
    </section>
    ${footer(menuPages, data.year)}
    <script src="/scripts/blog.js"></script>
  </main>
  </body></html>`;
}

function tagChipsWrapper(rawChips) {
  return `<section class="tags-section"><div class="tags-inner">${rawChips}</div></section>`;
}

export function buildPost(data) {
  const {
    title,
    dateFormatted,
    tags = [],
    contentHtml,
    excerpt,
    subtitle,
    coverImage,
    coverImageAlt,
    coverImageFocus,
    author,
    accent,
    menuPages = [],
    snippetCss,
    postUrl,
    extraHead = '',
    theme,
  } = data;

  const dek = subtitle || excerpt || '';
  const meta = buildPostMeta ? buildPostMeta({ title, description: excerpt || subtitle, url: postUrl, image: coverImage }) : extraHead;

  return `${buildHead({ title, theme, accent, snippetCss, extraHead: meta || extraHead })}
  <main class="cb-shell">
    ${nav(menuPages, '/posts/')}
    <article class="h-entry">
      <header class="cb-page-head">
        <div class="cb-page-head-inner">
          <div class="cb-meta">${esc(dateFormatted || '')}<br>${tags.map((t) => `#${esc(t)}`).join(' ')}</div>
          <div>
            <h1 class="p-name cb-page-title">${esc(title)}</h1>
            ${dek ? `<p class="cb-page-dek">${esc(dek)}</p>` : ''}
          </div>
        </div>
      </header>
      ${coverBlock({ title, coverImage, coverImageAlt, coverImageFocus })}
      <div class="post-content e-content">${contentHtml}</div>
      ${authorBox(author)}
    </article>
    ${footer(menuPages, data.year)}
  </main>
  </body></html>`;
}

export function buildPage(data) {
  const {
    title,
    slug,
    contentHtml,
    menuPages = [],
    accent,
    snippetCss,
    theme,
  } = data;

  return `${buildHead({ title, theme, accent, snippetCss })}
  <main class="cb-shell">
    ${nav(menuPages, `/${slug}/`)}
    <article class="h-entry">
      <header class="cb-page-head">
        <div class="cb-page-head-inner">
          <div class="cb-kicker">Page</div>
          <div><h1 class="p-name cb-page-title">${esc(title)}</h1></div>
        </div>
      </header>
      <div class="post-content e-content">${contentHtml}</div>
    </article>
    ${footer(menuPages, data.year)}
  </main>
  </body></html>`;
}

export function buildNotes(data) {
  const { notes = [], menuPages = [], accent, snippetCss, theme } = data;
  const notePosts = notes.map((note) => ({
    slug: note.slug,
    title: note.title || note.date,
    date: note.date,
    dateFormatted: note.date,
    excerpt: note.bodyHtml ? note.bodyHtml.replace(/<[^>]+>/g, '').slice(0, 180) : '',
    tags: note.tags || [],
  }));

  return `${buildHead({ title: 'Notes', theme, accent, snippetCss })}
  <main class="cb-shell">
    ${nav(menuPages, '/notes/')}
    <section class="cb-page-head"><div class="cb-page-head-inner"><div class="cb-kicker">Notes</div><div><h1 class="cb-page-title">Fragments and passing thoughts.</h1></div></div></section>
    <section class="cb-section"><div class="cb-section-inner">${archiveList(notePosts)}</div></section>
    ${footer(menuPages, data.year)}
  </main>
  </body></html>`;
}

export function buildPhotos(data) {
  const { menuPages = [], accent, year, theme } = data;
  const extraHead = [
    '<meta name="description" content="Photographs by James Bell">',
    '<link rel="stylesheet" href="/photos/styles/gallery.css">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css">',
  ].join('\n');

  return `${buildHead({ title: 'Photos', theme, accent, extraHead })}
  <main class="cb-shell">
    ${nav(menuPages, '/photos/')}
    <section class="cb-page-head"><div class="cb-page-head-inner"><div class="cb-kicker">Photos</div><div><h1 class="cb-page-title">Photographs and visual notes.</h1></div></div></section>
    <div class="post-content"><p>The static photo gallery loads below using the existing gallery CSS and JavaScript.</p></div>
    ${footer(menuPages, year)}
    <script src="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js"></script>
    <script src="/photos/scripts/gallery.js"></script>
  </main>
  </body></html>`;
}

export const imageRoles = {
  layouts: [
    { className: 'img-wide', label: 'Wide', description: 'Breaks gently outside the reading column' },
    { className: 'img-break', label: 'Break', description: 'Full-width pause between sections' },
    { className: 'img-small', label: 'Small', description: 'Within the reading column, modest size' },
    { className: 'img-pair', label: 'Pair', description: 'Two images side by side on desktop' },
  ],
  treatments: [
    { className: 'photo-muted', label: 'Muted', description: 'Reduced saturation and contrast', isDefault: true },
    { className: 'photo-mono', label: 'Mono', description: 'Strong monochrome' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated' },
    { className: 'photo-soft', label: 'Soft', description: 'Lower contrast, slightly lifted' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
