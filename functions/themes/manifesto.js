import {
  esc,
  buildHead,
  buildSiteNav,
  buildNavLinks,
  buildPostMeta,
  SITE_URL
} from '../lib/templates.js';

function dateObj(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(date) {
  const d = dateObj(date);
  if (!d) return '';
  return d.toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
}

function fmtLongDate(date) {
  const d = dateObj(date);
  if (!d) return '';
  return d.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function fmtMonthYear(date) {
  const d = dateObj(date);
  if (!d) return '';
  return d.toLocaleDateString('en-NZ', {
    month: 'long',
    year: 'numeric'
  });
}

function tagList(tags = []) {
  return (tags || []).filter((tag) => tag && tag !== 'note');
}

function firstTag(tags = []) {
  return tagList(tags)[0] || 'Manifesto';
}

function postHref(post) {
  return `/posts/${post.slug}/`;
}

function postImage(post, fallback = '') {
  return post?.coverImage || fallback || '';
}

function postExcerpt(post) {
  return post?.subtitle || post?.excerpt || '';
}

function isNote(post) {
  return (post?.tags || []).includes('note');
}

function renderNav(menuPages = [], activeHref = '/') {
  return buildSiteNav(menuPages, activeHref);
}

function renderFooter(menuPages = [], year = new Date().getFullYear()) {
  const links = buildNavLinks(menuPages || []);
  const nav = links
    .map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`)
    .join('');

  return `
    <footer class="mf-footer">
      <div class="mf-footer-top">
        <section class="mf-footer-panel">
          <h2 class="mf-footer-title">Manifesto</h2>
          <p>Essays, notes and records on art, politics, media and the moments that shape us.</p>
          <a class="mf-link" href="/about/">About Manifesto →</a>
        </section>

        <section class="mf-footer-panel">
          <p class="mf-kicker">Navigate</p>
          <nav class="mf-footer-nav">
            ${nav}
            <a href="/feed.xml">RSS</a>
          </nav>
        </section>

        <section class="mf-footer-panel">
          <p class="mf-kicker">Subscribe for updates</p>
          <p>No spam. Just signal.</p>
          <a class="mf-link" href="/feed.xml">Follow the feed →</a>
        </section>
      </div>

      <div class="mf-footer-bottom">
        <span>© Manifesto ${esc(year)}</span>
        <span>Built slow. Published late.</span>
        <span>Up late?</span>
      </div>
    </footer>
  `;
}

function pickFeatured(recentPosts = [], homepageConfig = null) {
  const essays = recentPosts.filter((post) => !isNote(post));
  if (homepageConfig?.featured?.slug) {
    return essays.find((post) => post.slug === homepageConfig.featured.slug) || essays[0] || recentPosts[0];
  }
  return essays[0] || recentPosts[0];
}

function findBySlug(posts = [], slug) {
  if (!slug) return null;
  return posts.find((post) => post.slug === slug) || null;
}

function renderEssayCard(post, fallbackImage = '') {
  if (!post) return '';
  const img = postImage(post, fallbackImage);
  const tags = tagList(post.tags);
  return `
    <a class="mf-post-card post-list-item" href="${esc(postHref(post))}" data-tags="${esc(tags.join(','))}">
      <p class="mf-kicker">${esc(firstTag(post.tags))}</p>
      <div class="mf-post-card-media">
        ${img ? `<img src="${esc(img)}" alt="${esc(post.coverImageAlt || post.title || '')}">` : ''}
      </div>
      <div>
        <h2 class="mf-post-card-title">${esc(post.title || '')}</h2>
        <p class="mf-meta">${esc(fmtDate(post.date))}</p>
      </div>
    </a>
  `;
}

function renderRelatedList(posts = []) {
  return posts.slice(0, 3).map((post) => `
    <li>
      <a href="${esc(postHref(post))}">
        ${esc(fmtDate(post.date))}<br>
        ${esc(post.title)}
      </a>
    </li>
  `).join('');
}

export function buildHomepage({
  author,
  recentPosts = [],
  menuPages = [],
  accent = null,
  snippetCss = '',
  theme = 'manifesto',
  defaultCoverImage = '',
  homepageConfig = null
}) {
  const featured = pickFeatured(recentPosts, homepageConfig);
  const featuredTitle = homepageConfig?.featured?.titleOverride || featured?.title || 'Manifesto';
  const featuredDek =
    homepageConfig?.featured?.dekOverride ||
    postExcerpt(featured) ||
    'Writing from the margins of culture.';
  const featuredImage =
    homepageConfig?.featured?.imageOverride ||
    postImage(featured, defaultCoverImage);

  const archiveSlugs = homepageConfig?.archive?.posts || [];
  const archivePosts = archiveSlugs.length
    ? archiveSlugs.map((slug) => findBySlug(recentPosts, slug)).filter(Boolean)
    : recentPosts.filter((post) => !isNote(post) && post.slug !== featured?.slug).slice(0, 3);

  const blocks = homepageConfig?.cards?.length
    ? homepageConfig.cards.slice(0, 3)
    : [
        { kicker: 'Notes', title: 'Fragments, lists, observations.', href: '/notes/', linkLabel: 'View notes' },
        { kicker: 'Records', title: 'Documents from a time of collapse and possibility.', href: '/posts/', linkLabel: 'View records' },
        { kicker: 'Archive', title: 'Older works. Still relevant. Always.', href: '/posts/', linkLabel: 'Explore archive' }
      ];

  const extraHead = buildPostMeta({
    title: 'Manifesto',
    postUrl: SITE_URL,
    metaDesc: author?.bio || 'Essays, notes and records.',
    ogImage: featuredImage
  });

  return `${buildHead({ title: 'Manifesto', theme, accent, snippetCss, extraHead })}
    ${renderNav(menuPages, '/')}
    <main class="mf-home h-card">
      <section class="mf-home-hero">
        <div class="mf-home-copy">
          <div>
            <p class="mf-kicker">Manifesto</p>
            <h1 class="mf-home-title mf-display">Manifesto</h1>
            <p class="mf-home-deck">Writing from the margins of culture.</p>
            <p class="mf-home-body">Essays, notes and records on art, politics, media and the moments that shape us.</p>
          </div>
          <a class="mf-link" href="${featured ? esc(postHref(featured)) : '/posts/'}">Latest essay →</a>
        </div>

        <div class="mf-home-media">
          ${featuredImage ? `<img src="${esc(featuredImage)}" alt="${esc(featured?.coverImageAlt || featuredTitle)}">` : ''}
          <div class="mf-issue-rail">001 · ${esc(fmtDate(featured?.date))}</div>
        </div>
      </section>

      <section class="mf-home-feature">
        <div class="mf-feature-copy">
          <p class="mf-kicker">${esc(firstTag(featured?.tags))}</p>
          <h2 class="mf-feature-title mf-display">${esc(featuredTitle)}</h2>
          <p class="mf-feature-body">${esc(featuredDek)}</p>
          <a class="mf-link" href="${featured ? esc(postHref(featured)) : '/posts/'}">Read essay →</a>
        </div>

        <div class="mf-feature-media">
          ${featuredImage ? `<img src="${esc(featuredImage)}" alt="${esc(featured?.coverImageAlt || featuredTitle)}">` : ''}
        </div>
      </section>

      <section class="mf-home-blocks">
        ${blocks.map((block, i) => `
          <a class="mf-home-block" href="${esc(block.href || '/posts/')}">
            <p class="mf-kicker">${esc(block.kicker || `Record ${i + 1}`)}</p>
            <h3>${esc(block.title || '')}</h3>
            <span class="mf-link">${esc(block.linkLabel || 'Read →')}</span>
          </a>
        `).join('')}
      </section>

      <section class="mf-home-archive">
        <p class="mf-kicker">${esc(homepageConfig?.archive?.title || 'From Manifesto')}</p>
        <div class="mf-home-archive-list">
          ${archivePosts.map((post, i) => `
            <a href="${esc(postHref(post))}" class="mf-home-archive-item">
              <span class="mf-home-archive-title">${esc(post.title)}</span>
              <span class="mf-home-archive-meta">${String(i + 1).padStart(2, '0')} · ${esc(firstTag(post.tags))}</span>
            </a>
          `).join('')}
        </div>
      </section>
    </main>
    ${renderFooter(menuPages)}
  </body></html>`;
}

export function buildPost(data) {
  const {
    title,
    date,
    dateFormatted,
    tags = [],
    contentHtml = '',
    excerpt = '',
    subtitle = '',
    coverImage = '',
    coverImageAlt = '',
    accent = null,
    menuPages = [],
    snippetCss = '',
    readTime = 1,
    extraHead = '',
    recentPosts = [],
    year,
    theme = 'manifesto',
  } = data;

  const note = tags.includes('note');
  const displayTags = tagList(tags);
  const related = recentPosts.filter((post) => post.title !== title).slice(0, 3);
  const dek = subtitle || excerpt || '';
  const label = note ? 'Note' : 'Essay';

  return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
    ${renderNav(menuPages, '/posts/')}
    <article class="manifesto-post h-entry">
      <aside class="manifesto-rail">
        <section class="manifesto-rail-section">
          <p class="mf-kicker">${esc(label)}</p>
          <p class="mf-meta">${esc(dateFormatted || fmtLongDate(date))}</p>
          <p class="mf-meta">By J. R. B. NZ</p>
        </section>

        <section class="manifesto-rail-section">
          <h2 class="manifesto-rail-title">In this essay</h2>
          <ol class="manifesto-rail-list">
            ${displayTags.length
              ? displayTags.map((tag) => `<li>${esc(tag)}</li>`).join('')
              : `<li>${esc(label)}</li>`}
          </ol>
        </section>

        <section class="manifesto-rail-section">
          <h2 class="manifesto-rail-title">Related records</h2>
          <ul class="manifesto-rail-list">
            ${renderRelatedList(related)}
          </ul>
        </section>
      </aside>

      <main class="manifesto-main">
        <section class="manifesto-opening">
          <div class="manifesto-opening-copy">
            <div>
              <p class="mf-kicker">${esc(label)} · ${esc(readTime)} min read</p>
              <h1 class="manifesto-title mf-display p-name">${esc(title)}</h1>
              ${dek ? `<p class="manifesto-dek">${esc(dek)}</p>` : ''}
            </div>
            <p class="mf-meta">${displayTags.map(esc).join(' / ')}</p>
          </div>

          <div class="manifesto-opening-media">
            ${coverImage ? `<img src="${esc(coverImage)}" alt="${esc(coverImageAlt || title)}">` : ''}
          </div>
        </section>

        <section class="manifesto-article-grid">
          <div class="manifesto-prose post-content e-content">
            ${contentHtml}
          </div>

          <aside class="manifesto-aside">
            ${related.map((post, i) => `
              <a class="manifesto-aside-card" href="${esc(postHref(post))}">
                <p class="mf-kicker">${String(i + 1).padStart(2, '0')}</p>
                <h3>${esc(post.title)}</h3>
                <p>${esc(postExcerpt(post))}</p>
                ${post.coverImage ? `<img src="${esc(post.coverImage)}" alt="${esc(post.coverImageAlt || post.title)}">` : ''}
              </a>
            `).join('')}
          </aside>
        </section>

        <footer class="surface-invert article-ending">
          <div>
            <div class="article-ending-label">${esc(label)}</div>
            <div class="article-ending-meta">Published ${esc(fmtMonthYear(date))}${displayTags.length ? ` · ${displayTags.map(esc).join(' · ')}` : ''}</div>
          </div>
          <a class="article-ending-back" href="/posts/">Back to Essays</a>
        </footer>
      </main>
    </article>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export function buildIndex({
  tagChips = '',
  menuPages = [],
  accent = null,
  snippetCss = '',
  year,
  theme = 'manifesto',
  posts = [],
  defaultCoverImage = ''
}) {
  return `${buildHead({ title: 'Essays', theme, accent, snippetCss })}
    ${renderNav(menuPages, '/posts/')}
    <main>
      <header class="mf-index-header">
        <p class="mf-kicker">Manifesto</p>
        <h1 class="mf-index-title mf-display">Essays</h1>
        <p class="mf-index-deck">Records, arguments and long-form observations from the cultural margins.</p>
      </header>

      <section class="mf-tags">
        <div class="tag-filter-bar" id="tag-filter-bar" hidden>
          Essays tagged <strong id="tag-filter-label"></strong>
          <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
        </div>
        <div class="tags-section">${tagChips}</div>
      </section>

      <section class="mf-post-grid">
        ${posts.map((post) => renderEssayCard(post, defaultCoverImage)).join('')}
      </section>
    </main>
    ${renderFooter(menuPages, year)}
    <script src="/scripts/blog.js"></script>
  </body></html>`;
}

export function buildPage({
  title,
  slug,
  contentHtml = '',
  menuPages = [],
  accent = null,
  snippetCss = '',
  year,
  theme = 'manifesto'
}) {
  return `${buildHead({ title, theme, accent, snippetCss })}
    ${renderNav(menuPages, `/${slug}/`)}
    <main class="mf-page-shell">
      <section class="mf-page-copy">
        <p class="mf-kicker">Manifesto</p>
        <h1 class="mf-page-title mf-display">${esc(title)}</h1>
      </section>

      <section class="surface-invert mf-page-content">
        <div class="post-content page-content e-content">
          ${contentHtml}
        </div>
      </section>
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export function buildNotes({
  notes = [],
  menuPages = [],
  accent = null,
  snippetCss = '',
  theme = 'manifesto'
}) {
  return `${buildHead({ title: 'Notes', theme, accent, snippetCss })}
    ${renderNav(menuPages, '/notes/')}
    <main class="mf-notes">
      <header class="mf-page-header">
        <p class="mf-kicker">Operational fragments</p>
        <h1 class="mf-page-title mf-display">Notes</h1>
        <p class="mf-page-deck">Short observations, field notes and fragments from the archive.</p>
      </header>

      <section class="surface-invert mf-notes-list">
        ${notes.map((note) => {
          const noteTags = tagList(note.tags);
          return `
            <article class="mf-note-entry">
              <div class="mf-note-meta">
                <a class="note-permalink" href="/posts/${esc(note.slug)}/" title="Permalink">#</a><br>
                <time class="note-date">${esc(fmtLongDate(note.date))}</time>
                ${noteTags.map((tag) => `<br><span class="note-tag">${esc(tag)}</span>`).join('')}
              </div>

              <div class="mf-note-body post-content e-content">
                ${note.bodyHtml}
              </div>
            </article>
          `;
        }).join('')}
      </section>
    </main>
    ${renderFooter(menuPages)}
  </body></html>`;
}

export function buildPhotos({
  menuPages = [],
  accent = null,
  year,
  theme = 'manifesto'
}) {
  return `${buildHead({ title: 'Photos', theme, accent })}
    ${renderNav(menuPages, '/photos/')}
    <main>
      <header class="mf-page-header">
        <p class="mf-kicker">Visual records</p>
        <h1 class="mf-page-title mf-display">Photos</h1>
        <p class="mf-page-deck">Images as evidence, atmosphere and memory.</p>
      </header>

      <section class="mf-photos-placeholder">
        <p>The static photos page can be inserted here, or this renderer can be extended once photo data is available.</p>
      </section>
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export const imageRoles = {
  layouts: [
    {
      className: 'img-wide',
      label: 'Wide',
      description: 'Breaks outside the reading column. Best for documentary or architectural images.'
    },
    {
      className: 'img-break',
      label: 'Break',
      description: 'Full-width visual interruption.'
    },
    {
      className: 'img-small',
      label: 'Small',
      description: 'Modest archival or reference image.'
    },
    {
      className: 'img-pair',
      label: 'Pair',
      description: 'Two-image sequence or contrast.'
    }
  ],
  treatments: [
    {
      className: 'photo-muted',
      label: 'Muted',
      description: 'Desaturated documentary treatment.',
      isDefault: true
    },
    {
      className: 'photo-mono',
      label: 'Mono',
      description: 'Hard monochrome with extra contrast.'
    },
    {
      className: 'photo-colour',
      label: 'Colour',
      description: 'Reduced saturation but colour retained.'
    },
    {
      className: 'photo-soft',
      label: 'Soft',
      description: 'Softer monochrome for quieter moments.'
    }
  ],
  defaults: {
    layout: 'img-wide',
    treatment: 'photo-muted'
  }
};
