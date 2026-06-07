import { esc, buildHead, buildPostMeta } from '../lib/templates.js';

// "Here" is built at render time from the site's nav pages (include_in_menu),
// so any page flagged for the menu in Signal also appears in the footer.
const CREATIVE_LINKS = [
  { href: '/posts/', label: 'Writing' },
  { href: '/notes/', label: 'Notes' },
  { href: '/photos/', label: 'Photos' },
];
const PROJECT_LINKS = [
  { href: 'https://thetheatrelist.com', label: 'The Theatre List' },
  { href: 'https://foolishwit.com', label: 'Foolish Wit' },
  { href: 'https://milfordcreative.com', label: 'Milford Creative' },
  { href: 'https://howtotheatre.com', label: 'How To Theatre' },
];

function masthead() {
  return `<header class="bb-masthead">
    <a class="bb-wordmark" href="/">JAMES BELL</a>
    <div class="bb-gradient-rule" aria-hidden="true"></div>
  </header>`;
}

function arrow() {
  return '<span aria-hidden="true">→</span>';
}

function postHref(slug) {
  return `/posts/${esc(slug)}/`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function normaliseSocialValue(value, base) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${base}${raw.replace(/^@/, '')}`;
}

function authorContactLinks(author) {
  const links = [
    ['Threads', normaliseSocialValue(author?.threads, 'https://threads.net/@')],
    ['Instagram', normaliseSocialValue(author?.instagram, 'https://instagram.com/')],
    ['LinkedIn', normaliseSocialValue(author?.linkedin, 'https://linkedin.com/in/')],
    ['Flickr', normaliseSocialValue(author?.flickr, 'https://flickr.com/photos/')],
  ].filter(([, href]) => href);

  return links;
}

function filterNoteTagChips(html = '') {
  return html
    .replace(/<a\b[^>]*href=["']\/posts\/\?tag=note["'][^>]*>.*?<\/a>/gi, '')
    .replace(/<a\b[^>]*>\s*#?notes?\s*<\/a>/gi, '');
}

function footerColumn(heading, links, external = false) {
  if (!links.length) return '';
  const attrs = external ? ' class="bb-ext" target="_blank" rel="noopener noreferrer"' : '';
  const items = links.map(l => `<li><a${attrs} href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('');
  return `<section>
          <h2 class="bb-footer-heading">${esc(heading)}</h2>
          <ul>${items}</ul>
        </section>`;
}

// Site nav pages (About, Now, and anything else flagged include_in_menu in Signal).
function navPageLinks(menuPages) {
  return (menuPages || [])
    .filter(p => p.include_in_menu && p.status === 'published')
    .map(p => ({ href: p.nav_url || `/${p.slug}/`, label: p.title }));
}

function footer(year, author, menuPages) {
  const followLinks = authorContactLinks(author)
    .map(([label, href]) => `<li><a class="social-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></li>`).join('');
  const followColumn = followLinks ? `<section>
          <h2 class="bb-footer-heading">Follow</h2>
          <ul>${followLinks}</ul>
        </section>` : '';

  return `<footer class="bb-footer">
    <div class="bb-footer-inner">
      <div class="bb-footer-grid">
        <div class="bb-footer-nav">
          ${footerColumn('Here', navPageLinks(menuPages))}
          ${footerColumn('Creative', CREATIVE_LINKS)}
          ${footerColumn('Projects', PROJECT_LINKS, true)}
          ${followColumn}
        </div>
        <div class="bb-footer-brand">
          <p class="bb-place">
            <span class="bb-place-name">Tāmaki<br>Makaurau</span>
            <span class="bb-place-region">Aotearoa</span>
          </p>
        </div>
      </div>
      <div class="bb-footer-bottom">
        <span>© ${esc(year)} James Bell</span>
        <div class="bb-footer-end">
          <a href="/feed.xml">RSS</a>
          <a class="bb-signal-link" href="/signal/" title="Made with Signal" aria-label="Signal"><img src="/signal/signal-logo.png" alt="" width="24" height="24"></a>
        </div>
      </div>
    </div>
  </footer>`;
}

function pageShell({ title, theme, accent, snippetCss, extraHead, body, year, author, menuPages }) {
  const footerYear = year || new Date().getFullYear();
  return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
    <div class="bb-shell">
      ${masthead()}
      <main class="bb-main">${body}</main>
    </div>
    ${footer(footerYear, author, menuPages)}
  </body></html>`;
}

function thumbnail(post, fallbackImage = null) {
  const src = post.coverImage || fallbackImage;
  if (!src) return '<span class="bb-thumb-empty"></span>';
  const alt = post.coverImage ? (post.coverImageAlt || '') : '';
  return `<img class="bb-thumb" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
}

function listItem(post, { compact = false, defaultCoverImage = null } = {}) {
  const date = formatDate(post.date);
  const excerpt = post.excerpt || post.subtitle || '';
  const tags = (post.tags || []).join(',');
  return `<a class="bb-list-item post-list-item" data-tags="${esc(tags)}" href="${postHref(post.slug)}">
    <span class="bb-item-date">${esc(date)}</span>
    <span class="bb-item-copy">
      <span class="bb-item-title">${esc(post.title)}</span>
      ${!compact && excerpt ? `<span class="bb-item-excerpt">${esc(excerpt)}</span>` : ''}
    </span>
    ${compact ? '' : thumbnail(post, defaultCoverImage)}
  </a>`;
}

function featuredHomeItem(post) {
  if (!post) return '';
  const date = formatDate(post.date);
  const excerpt = post.excerpt || post.subtitle || '';
  return `<a class="bb-featured-home" href="${postHref(post.slug)}">
    <span class="bb-featured-label">Featured writing</span>
    <span class="bb-featured-title">${esc(post.title)}</span>
    ${excerpt ? `<span class="bb-featured-excerpt">${esc(excerpt)}</span>` : ''}
    ${date ? `<span class="bb-featured-date">${esc(date)}</span>` : ''}
  </a>`;
}

export function buildHomepage(data) {
  const { author, featuredEssay, recentEssays, accent, snippetCss, theme, year, menuPages } = data;
  const recent = (recentEssays || []).filter(Boolean).slice(0, 4);
  const intro = 'Writing about theatre, memory, technology and whatever keeps echoing.';
  const body = `<section class="bb-home">
    <h1 class="bb-home-intro">${esc(intro)}</h1>
    ${featuredEssay ? featuredHomeItem(featuredEssay) : ''}
    <div class="bb-home-list">
      <h2 class="bb-section-title">Latest</h2>
      <div class="bb-list">
        ${recent.map(post => listItem(post, { compact: true })).join('')}
      </div>
      <a class="bb-action-link" href="/posts/">From the archive ${arrow()}</a>
    </div>
  </section>`;
  return pageShell({ title: author?.name || 'James Bell', theme, accent, snippetCss, body, year, author, menuPages });
}

export function buildPost(data) {
  const { title, dateFormatted, contentHtml, accent, snippetCss, theme, year, extraHead, postUrl, excerpt, coverImage, prevPost, nextPost, author, menuPages } = data;
  const meta = buildPostMeta ? buildPostMeta({ title, description: excerpt, url: postUrl, image: coverImage }) : '';
  const nav = `<nav class="bb-post-nav" aria-label="Post navigation">
    <span>${prevPost ? `<a href="${postHref(prevPost.slug)}">← Newer post</a>` : ''}</span>
    <span>${nextPost ? `<a href="${postHref(nextPost.slug)}">Older post →</a>` : ''}</span>
  </nav>`;
  const body = `<article class="bb-article h-entry">
    <div class="bb-date">${esc(dateFormatted || formatDate(data.date))}</div>
    <h1 class="bb-post-title p-name">${esc(title)}</h1>
    <div class="post-content e-content">${contentHtml}</div>
    ${nav}
  </article>`;
  return pageShell({ title, theme, accent, snippetCss, extraHead: `${meta}\n${extraHead || ''}`, body, year, author, menuPages });
}

export function buildIndex(data) {
  const { posts = [], tagChips = '', accent, snippetCss, theme, year, defaultCoverImage, author, menuPages } = data;
  const body = `<section class="bb-index">
    <h1 class="bb-page-title">Writing</h1>
    <div class="tag-filter-bar" id="tag-filter-bar" hidden>
      Writing tagged <strong id="tag-filter-label"></strong>
      <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
    </div>
    ${filterNoteTagChips(tagChips) ? `<div class="tags-section">${filterNoteTagChips(tagChips)}</div>` : ''}
    <div class="bb-list">
      ${posts.map(post => listItem(post, { defaultCoverImage })).join('')}
    </div>
  </section>
  <script src="/scripts/blog.js"></script>`;
  return pageShell({ title: 'Writing', theme, accent, snippetCss, body, year, author, menuPages });
}

export function buildPage(data) {
  const { title, contentHtml, accent, snippetCss, theme, year, author, menuPages } = data;
  const body = `<article class="bb-article h-entry">
    <h1 class="bb-page-title p-name">${esc(title)}</h1>
    <div class="post-content e-content">${contentHtml}</div>
  </article>`;
  return pageShell({ title, theme, accent, snippetCss, body, year, author, menuPages });
}

export function buildNotes(data) {
  const { notes = [], accent, snippetCss, theme, year, author, menuPages } = data;
  const items = notes.map(note => {
    const date = formatDate(note.date);
    return `<article class="bb-note-item h-entry">
      <time class="bb-item-date" datetime="${esc(note.date)}">${esc(date)}</time>
      <div class="post-content e-content">${note.bodyHtml || `<p>${esc(note.title || '')}</p>`}</div>
    </article>`;
  }).join('');
  const body = `<section class="bb-notes">
    <h1 class="bb-page-title">Notes</h1>
    <div class="bb-notes-list">${items}</div>
  </section>`;
  return pageShell({ title: 'Notes', theme, accent, snippetCss, body, year, author, menuPages });
}

export function buildPhotos(data) {
  const { accent, snippetCss, theme, year, author, menuPages } = data;
  const extraHead = [
    '<link rel="stylesheet" href="/photos/styles/gallery.css">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css">',
  ].join('\n');
  const body = `<article class="bb-article">
    <h1 class="bb-page-title">Photos</h1>
    <div id="photo-gallery"></div>
  </article>
  <script src="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js"></script>
  <script src="/photos/scripts/gallery.js"></script>`;
  return pageShell({ title: 'Photos', theme, accent, snippetCss, extraHead, body, year, author, menuPages });
}

export const imageRoles = {
  layouts: [
    { className: 'img-wide', label: 'Wide', description: 'Breaks slightly outside the reading column' },
    { className: 'img-break', label: 'Break', description: 'Full-width pause between sections' },
    { className: 'img-small', label: 'Small', description: 'Within the reading column, modest size' },
    { className: 'img-pair', label: 'Pair', description: 'Two images side by side on desktop' },
  ],
  treatments: [
    { className: 'photo-soft', label: 'Soft', description: 'Lower contrast, slightly lifted', isDefault: true },
    { className: 'photo-muted', label: 'Muted', description: 'Reduced saturation and contrast' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated' },
    { className: 'photo-mono', label: 'Mono', description: 'Strong monochrome' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-soft' },
};
