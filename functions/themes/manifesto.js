import {
  esc,
  buildHead,
  buildSiteNav,
  buildNavLinks,
  buildPostMeta,
  SITE_URL
} from '../lib/templates.js';

function fmtMonthYear(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

function fmtDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function firstTag(tags = []) {
  return (tags || []).filter(Boolean)[0] || 'Manifesto';
}

function postHref(post) {
  return `/posts/${post.slug}/`;
}

function postImage(post, fallback) {
  return post?.coverImage || fallback || '';
}

function excerptFor(post) {
  return post?.subtitle || post?.excerpt || '';
}

function pickFeatured(recentPosts = [], homepageConfig = {}) {
  const essays = recentPosts.filter((p) => !(p.tags || []).includes('note'));
  if (homepageConfig?.featured?.slug) {
    return essays.find((p) => p.slug === homepageConfig.featured.slug) || essays[0] || recentPosts[0];
  }
  return essays[0] || recentPosts[0];
}

function renderNav(menuPages, activeHref = '/') {
  return buildSiteNav(menuPages, activeHref);
}

function renderFooter(menuPages, year) {
  const links = buildNavLinks(menuPages || []);
  const nav = links
    .map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`)
    .join('');
  return `
    <footer class="cinematic-footer">
      <p class="cinematic-footer-quote">Built slow. Published late.</p>
      <nav class="cinematic-footer-nav">
        ${nav}
        <a href="/feed.xml">RSS</a>
        <span>© ${esc(year || new Date().getFullYear())}</span>
      </nav>
    </footer>
  `;
}

function essayCard(post, fallback) {
  if (!post) return '';
  const img = postImage(post, fallback);
  return `
    <a href="${esc(postHref(post))}" class="essay-card post-list-item" data-tags="${esc((post.tags || []).join(','))}">
      ${
        img
          ? `<img class="essay-card-img" src="${esc(img)}" alt="${esc(post.coverImageAlt || post.title || '')}">`
          : `<div class="essay-card-no-img"></div>`
      }
      <h3 class="essay-card-title">${esc(post.title)}</h3>
      <p class="essay-card-meta">${esc(firstTag(post.tags))} · ${esc(fmtDate(post.date))}</p>
    </a>
  `;
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
  const featuredDek = homepageConfig?.featured?.dekOverride || excerptFor(featured) || 'Writing from the margins of culture.';
  const featuredImage =
    homepageConfig?.featured?.imageOverride ||
    postImage(featured, defaultCoverImage);

  const next = recentPosts.filter((p) => p?.slug !== featured?.slug).slice(0, 3);

  const blocks = homepageConfig?.cards?.length
    ? homepageConfig.cards.slice(0, 3)
    : [
        {
          kicker: 'Notes',
          title: 'Fragments, lists, observations.',
          href: '/notes/',
          linkLabel: 'View notes'
        },
        {
          kicker: 'Records',
          title: 'Documents from a time of collapse and possibility.',
          href: '/posts/',
          linkLabel: 'View records'
        },
        {
          kicker: 'Archive',
          title: 'Older works. Still relevant. Always.',
          href: '/posts/',
          linkLabel: 'Explore archive'
        }
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
            <p class="mf-home-body">Essays, notes and records on art, media, systems and the moments that shape us.</p>
          </div>
          <a class="mf-link" href="${featured ? esc(postHref(featured)) : '/posts/'}">Latest essay →</a>
        </div>
        <div class="mf-home-media">
          ${featuredImage ? `<img src="${esc(featuredImage)}" alt="${esc(featured?.coverImageAlt || featuredTitle)}">` : ''}
          <div class="mf-issue-rail">001 · ${esc(fmtDate(featured?.date))}</div>
        </div>
      </section>

      <section class="mf-feature">
        <div class="mf-feature-copy">
          <p class="mf-kicker">${esc(firstTag(featured?.tags))}</p>
          <h2 class="mf-feature-title mf-display">${esc(featuredTitle)}</h2>
          <p class="mf-feature-body">${esc(featuredDek)}</p>
          <a class="mf-link" href="${featured ? esc(postHref(featured)) : '/posts/'}">Read essay →</a>
        </div>
        <div class="mf-feature-img-wrap">
          ${featuredImage ? `<img class="mf-feature-img" src="${esc(featuredImage)}" alt="${esc(featured?.coverImageAlt || featuredTitle)}">` : ''}
        </div>
      </section>

      <section class="mf-block-grid">
        ${blocks
          .map((block) => `
            <a class="mf-block" href="${esc(block.href || '/posts/')}">
              <p class="mf-kicker">${esc(block.kicker || 'Manifesto')}</p>
              <h3>${esc(block.title || '')}</h3>
              <span class="mf-link">${esc(block.linkLabel || 'Read →')}</span>
            </a>
          `)
          .join('')}
      </section>

      <section class="more-essays">
        <p class="more-essays-label">More from Manifesto</p>
        <div class="essay-strip">
          ${next.map((post) => essayCard(post, defaultCoverImage)).join('')}
        </div>
      </section>
    </main>
    ${renderFooter(menuPages, new Date().getFullYear())}
  </body></html>`;
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
    accent,
    menuPages = [],
    snippetCss = '',
    readTime,
    postUrl,
    extraHead = '',
    recentPosts = [],
    year,
    theme = 'manifesto',
  } = data;

  const isNote = tags.includes('note');
  const label = isNote ? 'Note' : 'Essay';
  const dek = subtitle || excerpt || '';

  return `${buildHead({
    title,
    theme,
    accent,
    snippetCss,
    extraHead
  })}
    ${renderNav(menuPages, '/posts/')}
    <article class="h-entry">
      <section class="mf-post-hero ${isNote ? 'mf-post-hero--note' : ''}">
        <div class="mf-post-hero-copy">
          <p class="post-kicker">${esc(label)} · ${esc(dateFormatted)} · ${esc(readTime)} min read · ${esc(tags.filter((t) => t !== 'note').join(' / '))}</p>
          <h1 class="mf-post-title mf-display p-name">${esc(title)}</h1>
          ${dek ? `<p class="mf-post-dek">${esc(dek)}</p>` : ''}
        </div>
        <div class="mf-post-media">
          ${coverImage ? `<img src="${esc(coverImage)}" alt="${esc(coverImageAlt || title)}">` : ''}
        </div>
      </section>

      <div class="surface-invert mf-article-shell">
        <div class="article-col article-open article-section">
          <div class="post-content e-content">
            ${contentHtml}
          </div>
        </div>
        <footer class="article-ending">
          <div>
            <div class="article-ending-label">${esc(label)}</div>
            <div class="article-ending-meta">Published ${esc(fmtMonthYear(data.date))}${tags.length ? ` · ${esc(tags.filter((t) => t !== 'note').join(' · '))}` : ''}</div>
          </div>
          <a class="article-ending-back" href="/posts/">Back to Essays</a>
        </footer>
      </div>

      <section class="more-essays">
        <p class="more-essays-label">More essays</p>
        <div class="essay-strip">
          ${recentPosts.slice(0, 3).map((post) => essayCard(post, '')).join('')}
          <a href="/posts/" class="essay-card essay-card--archive">
            <div class="essay-card-no-img"></div>
            <h3 class="essay-card-title">Archive</h3>
            <p class="essay-card-meta">All records</p>
          </a>
        </div>
      </section>
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
        <h1 class="mf-index-title">Essays</h1>
      </header>

      <section class="ci-tags">
        <div class="tag-filter-bar" id="tag-filter-bar" hidden>
          Essays tagged <strong id="tag-filter-label"></strong>
          <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
        </div>
        <div class="tags-section">${tagChips}</div>
      </section>

      <section class="more-essays ci-index-all">
        <p class="more-essays-label">All essays</p>
        <div class="essay-strip">
          ${posts.map((post) => essayCard(post, defaultCoverImage)).join('')}
        </div>
      </section>
    </main>
    ${renderFooter(menuPages, year)}
    <script src="/scripts/blog.js"></script>
  </body></html>`;
}

export function buildPage(data) {
  const {
    title,
    slug,
    contentHtml,
    menuPages = [],
    accent = null,
    snippetCss = '',
    year,
    theme = 'manifesto',
  } = data;
  return `${buildHead({ title, theme, accent, snippetCss })}
    ${renderNav(menuPages, `/${data.slug}/`)}
    <main>
      <div class="ci-page-masthead">
        <p class="mf-kicker">Manifesto</p>
        <h1 class="ci-page-title">${esc(title)}</h1>
      </div>
      <div class="surface-invert">
        <div class="ci-page-content">
          <div class="post-content page-content">
            ${contentHtml}
          </div>
        </div>
      </div>
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
    <main>
      <div class="ci-page-masthead">
        <p class="mf-kicker">Operational fragments</p>
        <h1 class="ci-page-title">Notes</h1>
      </div>

      <div class="surface-invert">
        <section class="notes-stream">
          ${notes
            .map((note) => `
              <article class="note-entry">
                <div class="note-meta">
                  <a class="note-permalink" href="/posts/${esc(note.slug)}/" title="Permalink">#</a>
                  <time class="note-date">${esc(fmtDate(note.date))}</time>
                  ${(note.tags || [])
                    .filter((tag) => tag !== 'note')
                    .map((tag) => `<span class="note-tag">${esc(tag)}</span>`)
                    .join('')}
                </div>
                <div class="note-body post-content">
                  ${note.bodyHtml}
                </div>
              </article>
            `)
            .join('')}
        </section>
      </div>
    </main>
    ${renderFooter(menuPages, new Date().getFullYear())}
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
      <div class="ci-page-masthead">
        <p class="mf-kicker">Visual records</p>
        <h1 class="ci-page-title">Photos</h1>
      </div>
      <div class="surface-invert">
        <div class="ci-page-content">
          <div class="post-content page-content">
            <p>Photos are loaded from the static photos page.</p>
          </div>
        </div>
      </div>
    </main>
    ${renderFooter(menuPages, year)}
  </body></html>`;
}

export const imageRoles = {
  layouts: [
    {
      className: 'img-wide',
      label: 'Wide',
      description: 'Large documentary image breaking beyond the reading column.'
    },
    {
      className: 'img-break',
      label: 'Break',
      description: 'Full-width visual interruption.'
    },
    {
      className: 'img-small',
      label: 'Small',
      description: 'Small archival or reference image.'
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
      description: 'Hard monochrome treatment.'
    },
    {
      className: 'photo-colour',
      label: 'Colour',
      description: 'Retained colour with reduced saturation.'
    },
    {
      className: 'photo-soft',
      label: 'Soft',
      description: 'Softer low-contrast monochrome.'
    }
  ],
  defaults: {
    layout: 'img-wide',
    treatment: 'photo-muted'
  }
};
