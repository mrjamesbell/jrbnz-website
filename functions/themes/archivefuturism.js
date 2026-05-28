import {
  esc,
  buildHead,
  buildNavLinks,
  buildPostMeta,
  SITE_URL,
} from '../lib/templates.js';

function postHref(post) {
  return `/posts/${esc(post.slug)}/`;
}

function pageHref(page) {
  return page.nav_url || `/${esc(page.slug)}/`;
}

function formatTags(tags = []) {
  return tags.map((tag) => esc(tag)).join(',');
}

function gradientForIndex(i) {
  const gradients = [
    'linear-gradient(135deg, #34261d, #8a4b2a 48%, #e0a638)',
    'linear-gradient(135deg, #181512, #46503a 48%, #f4efe5)',
    'linear-gradient(135deg, #181512, #a43f2b 56%, #f4efe5)',
    'linear-gradient(135deg, #34261d, #50606b 48%, #e0a638)',
    'linear-gradient(135deg, #181512, #2e3d48 48%, #e0a638)',
  ];
  return gradients[i % gradients.length];
}

function renderHeader(menuPages = [], activeHref = '/') {
  const links = buildNavLinks(menuPages);
  return `<header class="af-header">
    <div class="af-header-inner">
      <a href="/" class="af-brand" aria-label="Home">
        <div class="af-kicker af-brand-kicker">Signal Archive</div>
        <span class="af-wordmark">JRBNZ</span>
      </a>
      <nav class="af-nav" aria-label="Main">
        ${links.map((link) => {
          const href = esc(link.href);
          const active = href === activeHref ? ' class="active"' : '';
          return `<a href="${href}"${active}>${esc(link.label)}</a>`;
        }).join('')}
      </nav>
    </div>
  </header>`;
}

function renderFooter(menuPages = [], year = new Date().getFullYear()) {
  const links = buildNavLinks(menuPages);
  return `<footer class="af-footer">
    <div class="af-footer-inner">
      <div class="af-kicker">©${esc(year)} JRBNZ</div>
      <nav class="af-nav" aria-label="Footer">
        ${links.map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join('')}
        <a href="/feed.xml">RSS</a>
      </nav>
    </div>
  </footer>`;
}

function renderPostCard(post, index = 0, featured = false) {
  const tone = featured ? 'af-post-card-featured' : index % 3 === 1 ? 'af-post-card-rust' : index % 3 === 2 ? 'af-post-card-umber' : '';
  const tag = post.tags?.[0] || 'essay';
  return `<a href="${postHref(post)}" class="af-post-card ${tone}">
    <div class="af-meta">${featured ? 'Featured essay' : esc(tag)} / ${esc(post.dateFormatted || post.date || '')}</div>
    <div>
      <h2 class="af-post-title">${esc(post.title)}</h2>
      ${post.excerpt ? `<p class="af-post-excerpt">${esc(post.excerpt)}</p>` : ''}
    </div>
  </a>`;
}

function renderAuthorBox(author = {}, menuPages = []) {
  const name = author.name || 'James Bell';
  const bio = author.bio || '';
  const avatar = author.avatar || '';
  return `<footer class="af-author-box">
    <div class="af-author-inner">
      ${avatar ? `<img class="af-author-avatar" src="${esc(avatar)}" alt="${esc(name)}">` : `<div class="af-author-avatar" aria-hidden="true"></div>`}
      <div>
        <div class="af-kicker">Written by</div>
        <h2 class="af-author-name">${esc(name)}</h2>
        ${bio ? `<p class="af-author-bio">${esc(bio)}</p>` : ''}
        <div class="af-author-links">
          <a class="af-button" href="/posts/">More essays</a>
          ${menuPages.find((p) => p.slug === 'about') ? '<a class="af-button" href="/about/">About James</a>' : ''}
          <a class="af-button" href="/feed.xml">RSS</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function renderSectionTeasers() {
  return `<section class="af-section-teasers">
    <div class="af-section-teaser-grid">
      <div class="af-section-teaser">
        <div class="af-kicker">Essays</div>
        <p>Long-form writing about theatre, systems, memory, and the strange mechanics of ordinary life.</p>
      </div>
      <div class="af-section-teaser">
        <div class="af-kicker">Photography</div>
        <p>Landscapes, backstage spaces, roadside observations, architecture, and weather.</p>
      </div>
      <div class="af-section-teaser">
        <div class="af-kicker">Notes</div>
        <p>Smaller fragments, technical experiments, links, and passing thoughts worth preserving.</p>
      </div>
    </div>
  </section>`;
}

export function buildHomepage(data) {
  const {
    author = {},
    recentPosts = [],
    menuPages = [],
    accent = null,
    snippetCss = null,
    theme = 'archivefuturism',
    year = new Date().getFullYear(),
  } = data;

  const intro = author.bio || 'Essays and transmissions from theatre, memory, technology, and the edge of Auckland.';
  const visiblePosts = recentPosts.slice(0, 4);

  return `${buildHead({ title: author.name || 'JRBNZ', theme, accent, snippetCss })}
    ${renderHeader(menuPages, '/')}
    <main class="h-card">
      <section class="af-home-hero">
        <div class="af-sticky-intro">
          <div class="af-kicker">Personal archive</div>
          <h1 class="af-title-serif">Essays and transmissions from theatre, memory, technology, and the edge of Auckland.</h1>
          <p class="af-intro-copy">${esc(intro)}</p>
        </div>
        <div class="af-post-blocks">
          ${visiblePosts.map((post, i) => renderPostCard(post, i, i === 0)).join('')}
        </div>
      </section>
      ${renderSectionTeasers()}
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export function buildIndex(data) {
  const {
    posts = [],
    tagChips = '',
    menuPages = [],
    accent = null,
    snippetCss = null,
    year = new Date().getFullYear(),
    theme = 'archivefuturism',
  } = data;

  const featured = posts[0];
  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags || []))).sort();
  const chips = tagChips || allTags.map((tag) => `<a href="/posts/?tag=${encodeURIComponent(tag)}" class="tag-chip">#${esc(tag)}</a>`).join('');

  return `${buildHead({ title: 'Essays', theme, accent, snippetCss })}
    ${renderHeader(menuPages, '/posts/')}
    <main>
      <section class="af-index-hero">
        <div class="af-index-hero-inner">
          <div class="af-kicker">Essays index</div>
          <h1 class="af-title-serif">Writing gathered by date, but allowed to misbehave visually.</h1>
        </div>
      </section>
      ${featured ? `<section id="featured-hero" data-tags="${formatTags(featured.tags)}" class="af-home-hero">
        <div class="af-sticky-intro">
          <div class="af-kicker">Latest essay</div>
          <p class="af-intro-copy">${esc(featured.excerpt || '')}</p>
        </div>
        <div class="af-post-blocks">${renderPostCard(featured, 0, true)}</div>
      </section>` : ''}
      <section class="af-index-shell">
        <aside class="af-filter-sidebar">
          <div class="af-kicker">Filter</div>
          <div class="tags-section">${chips}</div>
        </aside>
        <div>
          <div class="tag-filter-bar" id="tag-filter-bar" hidden>
            Essays tagged <strong id="tag-filter-label"></strong>
            <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
          </div>
          <div class="af-post-list">
            ${posts.map((post, i) => `<a href="${postHref(post)}" class="post-list-item" data-tags="${formatTags(post.tags)}">
              <div class="af-meta">${esc(post.dateFormatted || post.date || '')}<br>${post.readTime ? `${esc(post.readTime)} min read<br>` : ''}${(post.tags || []).map((tag) => `#${esc(tag)}`).join(' ')}</div>
              <div>
                <h2 class="af-post-title">${esc(post.title)}</h2>
                ${post.excerpt ? `<p class="af-post-excerpt">${esc(post.excerpt)}</p>` : ''}
              </div>
              <div class="af-list-cover" style="${post.coverImage ? `background-image:url('${esc(post.coverImage)}')` : `background:${gradientForIndex(i)}`}"></div>
            </a>`).join('')}
          </div>
        </div>
      </section>
    </main>
    ${renderFooter(menuPages, year)}
    <script src="/scripts/blog.js"></script>
  </body></html>`;
}

export function buildPost(data) {
  const {
    title,
    slug,
    dateFormatted,
    tags = [],
    contentHtml,
    excerpt,
    subtitle,
    coverImage,
    coverImageAlt = '',
    coverImageFocus = 'center',
    author = {},
    accent = null,
    menuPages = [],
    snippetCss = null,
    readTime,
    postUrl,
    extraHead = '',
    prevPost = null,
    nextPost = null,
    year = new Date().getFullYear(),
    theme = 'archivefuturism',
  } = data;

  const meta = buildPostMeta
    ? buildPostMeta({ title, excerpt, url: postUrl || `${SITE_URL}/posts/${slug}/`, image: coverImage })
    : '';
  const deck = subtitle || excerpt || '';

  return `${buildHead({ title, theme, accent, snippetCss, extraHead: `${meta}\n${extraHead || ''}` })}
    ${renderHeader(menuPages, '/posts/')}
    <main>
      <article class="h-entry">
        <header class="af-post-hero">
          <div class="af-post-hero-text">
            <div class="af-meta">${esc(dateFormatted || '')}${readTime ? ` / ${esc(readTime)} min read` : ''}${tags.length ? ` / ${tags.map((tag) => `#${esc(tag)}`).join(' ')}` : ''}</div>
            <h1 class="p-name af-title-block">${esc(title)}</h1>
            ${deck ? `<p class="af-deck">${esc(deck)}</p>` : ''}
          </div>
          <div class="af-cover" style="--cover-focus:${esc(coverImageFocus)}; ${coverImage ? `background-image:url('${esc(coverImage)}')` : ''}">
            ${coverImage ? '' : '<div class="af-cover-label af-caption">Cover image treatment: generated colour field</div>'}
          </div>
        </header>
        <div class="post-content e-content">
          ${contentHtml}
        </div>
        ${renderAuthorBox(author, menuPages)}
        ${(prevPost || nextPost) ? `<nav class="af-section-teasers" aria-label="Post navigation">
          <div class="af-section-teaser-grid">
            <div class="af-section-teaser">${prevPost ? `<div class="af-kicker">Previous</div><p><a href="${postHref(prevPost)}">${esc(prevPost.title)}</a></p>` : ''}</div>
            <div class="af-section-teaser">${nextPost ? `<div class="af-kicker">Next</div><p><a href="${postHref(nextPost)}">${esc(nextPost.title)}</a></p>` : ''}</div>
            <div class="af-section-teaser"><div class="af-kicker">Archive</div><p><a href="/posts/">All essays</a></p></div>
          </div>
        </nav>` : ''}
      </article>
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export function buildPage(data) {
  const {
    title,
    slug,
    contentHtml,
    menuPages = [],
    accent = null,
    snippetCss = null,
    year = new Date().getFullYear(),
    theme = 'archivefuturism',
  } = data;

  return `${buildHead({ title, theme, accent, snippetCss })}
    ${renderHeader(menuPages, `/${esc(slug)}/`)}
    <main>
      <article class="h-entry">
        <header class="af-page-hero">
          <div class="af-kicker">Page</div>
          <h1 class="p-name af-title-serif">${esc(title)}</h1>
        </header>
        <div class="post-content e-content">
          ${contentHtml}
        </div>
      </article>
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export function buildNotes(data) {
  const {
    notes = [],
    menuPages = [],
    accent = null,
    snippetCss = null,
    theme = 'archivefuturism',
    year = new Date().getFullYear(),
  } = data;

  return `${buildHead({ title: 'Notes', theme, accent, snippetCss })}
    ${renderHeader(menuPages, '/notes/')}
    <main>
      <section class="af-index-hero">
        <div class="af-index-hero-inner">
          <div class="af-kicker">Notes</div>
          <h1 class="af-title-serif">Small fragments from the same signal.</h1>
        </div>
      </section>
      <section class="af-index-shell">
        <aside class="af-filter-sidebar"><div class="af-kicker">Stream</div></aside>
        <div class="af-post-list">
          ${notes.map((note, i) => `<article class="post-list-item" data-tags="${formatTags(note.tags)}">
            <div class="af-meta">${esc(note.date || '')}<br>${(note.tags || []).map((tag) => `#${esc(tag)}`).join(' ')}</div>
            <div>
              <h2 class="af-post-title">${esc(note.title || 'Note')}</h2>
              <div class="post-content e-content">${note.bodyHtml || ''}</div>
            </div>
            <div class="af-list-cover" style="background:${gradientForIndex(i)}"></div>
          </article>`).join('')}
        </div>
      </section>
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export function buildPhotos(data) {
  const {
    menuPages = [],
    accent = null,
    snippetCss = null,
    year = new Date().getFullYear(),
    theme = 'archivefuturism',
  } = data;

  const extraHead = [
    '<meta name="description" content="Photos by James Bell.">',
    '<link rel="stylesheet" href="/photos/styles/gallery.css">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css">',
  ].join('\n');

  return `${buildHead({ title: 'Photos', theme, accent, snippetCss, extraHead })}
    ${renderHeader(menuPages, '/photos/')}
    <main>
      <section class="af-page-hero">
        <div class="af-kicker">Photography</div>
        <h1 class="af-title-serif">Images from the archive.</h1>
      </section>
      <section class="post-content e-content">
        <p>The photo gallery loads from the static photos page and keeps its lightbox behaviour.</p>
      </section>
    </main>
    ${renderFooter(menuPages, year)}
    <script src="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js"></script>
    <script src="/photos/scripts/gallery.js"></script>
  </body></html>`;
}

export const imageRoles = {
  layouts: [
    { className: 'img-wide', label: 'Wide', description: 'Breaks outside the reading column with editorial weight' },
    { className: 'img-break', label: 'Break', description: 'Full-viewport image pause between sections' },
    { className: 'img-small', label: 'Small', description: 'Contained image within the reading column' },
    { className: 'img-pair', label: 'Pair', description: 'Two images side by side on desktop, stacked on mobile' },
  ],
  treatments: [
    { className: 'photo-muted', label: 'Muted', description: 'Reduced saturation and contrast', isDefault: true },
    { className: 'photo-mono', label: 'Mono', description: 'Strong monochrome treatment' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated colour image' },
    { className: 'photo-soft', label: 'Soft', description: 'Lower contrast and slightly lifted' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
