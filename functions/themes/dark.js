// Dark theme page renderers.
// Each function receives a prepared data object and returns a complete HTML string.
// All logic (prev/next, reading time, OG image, etc.) lives in prepPostData()
// in [[path]].js — these functions only deal with HTML structure.

import { esc, buildHead, buildSiteNav, buildFooter } from '../lib/templates.js';

export function buildPost(data) {
  const { title, slug, date, dateFormatted, tags, contentHtml, author, accent,
          menuPages, snippetCss, readTime, postUrl, extraHead, prevPost, nextPost,
          authorCard, year, theme } = data;

  const sidebarTags = (tags || [])
    .map(t => `<a href="/posts/?tag=${esc(t)}" class="sidebar-tag">#${esc(t)}</a>`)
    .join('\n          ');

  return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
${buildSiteNav(menuPages, '/posts/')}
<article class="h-entry">
<header class="post-masthead">
  <div class="post-masthead-inner">
    <h1 class="post-masthead-title p-name">${esc(title)}</h1>
    <div class="post-masthead-meta">
      <time class="post-masthead-date dt-published" datetime="${esc(date)}">${dateFormatted}</time>
      <span class="post-masthead-readtime">${readTime} min read</span>
    </div>
  </div>
</header>
<section class="content-section">
  <div class="post-layout">
    <div>
      <div class="post-content e-content">${contentHtml}</div>
      <nav class="post-prevnext" aria-label="Post navigation">
        ${prevPost
          ? `<a href="/posts/${esc(prevPost.slug)}/" class="prevnext-item prevnext-prev">
          <span class="prevnext-dir">← Previous</span>
          <span class="prevnext-title">${esc(prevPost.title)}</span>
        </a>`
          : '<div class="prevnext-item prevnext-placeholder"></div>'}
        <a href="/posts/" class="prevnext-item prevnext-all">
          <span class="prevnext-dir">All posts</span>
        </a>
        ${nextPost
          ? `<a href="/posts/${esc(nextPost.slug)}/" class="prevnext-item prevnext-next">
          <span class="prevnext-dir">Next →</span>
          <span class="prevnext-title">${esc(nextPost.title)}</span>
        </a>`
          : '<div class="prevnext-item prevnext-placeholder"></div>'}
      </nav>
    </div>
    <aside class="post-sidebar">
      ${authorCard}
      <div class="sidebar-block sidebar-block--date">
        <div class="sidebar-label">Published</div>
        <time class="sidebar-date" datetime="${esc(date)}">${dateFormatted}</time>
      </div>
      ${sidebarTags ? `<div class="sidebar-block">
        <div class="sidebar-label">Tags</div>
        <div class="sidebar-tags">
          ${sidebarTags}
        </div>
      </div>` : ''}
    </aside>
  </div>
</section>
<a href="${esc(postUrl)}" class="u-url" hidden></a>
</article>
${buildFooter(menuPages, year)}
</body>
</html>`;
}

export function buildIndex(data) {
  const { items, tagChips, menuPages, accent, snippetCss, year, theme } = data;
  return `${buildHead({ title: 'Blog', theme, accent, snippetCss })}
<div class="page-header">
  <div class="page-header-left">
    ${buildSiteNav(menuPages, '/posts/')}
  </div>
  <h1 class="page-header-title">Blog</h1>
</div>
<section class="content-section">
  <div class="post-list-wrap">
    ${items ? `<ul class="post-list">${items}</ul>` : '<p>No posts yet.</p>'}
    ${tagChips ? `
    <div class="tags-box">
      <div class="tag-filter-bar" id="tag-filter-bar" hidden>
        Posts tagged <strong id="tag-filter-label"></strong>
        <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
      </div>
      <div class="tags-section">${tagChips}</div>
    </div>` : ''}
  </div>
</section>
<script src="/scripts/blog.js"></script>
${buildFooter(menuPages, year)}
</body></html>`;
}

export function buildPage(data) {
  const { title, slug, contentHtml, menuPages, accent, snippetCss, year, theme } = data;
  return `${buildHead({ title, theme, accent, snippetCss })}
<div class="page-header">
  <div class="page-header-left">
    ${buildSiteNav(menuPages, `/${slug}/`)}
  </div>
  <h1 class="page-header-title">${esc(title)}</h1>
</div>
<section class="content-section">
  <div class="post-content page-content">${contentHtml}</div>
</section>
${buildFooter(menuPages, year)}
</body>
</html>`;
}

export function buildPhotos(data) {
  const { menuPages, accent, snippetCss, year, theme } = data;
  return `${buildHead({ title: 'Photos', theme, accent, snippetCss,
    extraHead: '<meta name="description" content="Photography portfolio by James Bell — theatre and travel photography"><link rel="stylesheet" href="/photos/styles/gallery.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css">' })}
<div class="page-header">
  <div class="page-header-left">
    ${buildSiteNav(menuPages, '/photos/')}
  </div>
  <h1 class="page-header-title">Photos</h1>
</div>
<section class="content-section">
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
${buildFooter(menuPages, year)}`;
}
