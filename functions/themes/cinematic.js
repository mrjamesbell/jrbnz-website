// Cinematic theme page renderers.
// Only exports functions where the HTML structure differs from the dark theme.
// The dispatcher in [[path]].js falls back to dark.js for anything not exported here.

import { esc, buildHead, buildSiteNav } from '../lib/templates.js';

function _navLinks(menuPages) {
  const cmsPages = (menuPages || []).filter(p => p.include_in_menu && p.status === 'published');
  const now = cmsPages.find(p => p.slug === 'now');
  const others = cmsPages.filter(p => p.slug !== 'now');
  const pageLink = p => ({ href: p.nav_url || `/${p.slug}/`, label: p.title });
  return [
    ...(now ? [pageLink(now)] : []),
    { href: '/posts/', label: 'Blog' },
    { href: '/photos/', label: 'Photos' },
    ...others.map(pageLink),
  ];
}

function buildCinematicFooter(menuPages) {
  const navLinks = _navLinks(menuPages)
    .map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n      ');
  return `<footer class="cinematic-footer">
  <p class="cinematic-footer-quote">Writing about memory, theatre, technology and life in between.</p>
  <nav class="cinematic-footer-nav">
    ${navLinks}
    <a href="/feed.xml">RSS</a>
  </nav>
</footer>`;
}

export function buildPost(data) {
  const { title, slug, date, dateFormatted, tags, contentHtml, author, accent,
          menuPages, snippetCss, readTime, postUrl, extraHead,
          year, theme, coverImage, coverImageAlt, recentPosts, excerpt } = data;

  const kicker = [dateFormatted, `${readTime} min read`, ...(tags || []).slice(0, 1)]
    .filter(Boolean).join(' · ');

  const heroImg = coverImage
    ? `<img class="post-hero-img" src="${esc(coverImage)}" alt="${esc(coverImageAlt || '')}" loading="eager">`
    : '';

  const heroDek = excerpt
    ? `<p class="post-hero-dek">${esc(excerpt)}</p>`
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
      <p class="essay-card-title">${esc(p.title)}</p>
      <p class="essay-card-meta">${esc(meta)}</p>
    </a>`;
  }).join('');

  const moreEssays = recentPosts && recentPosts.length ? `
<section class="more-essays">
  <p class="more-essays-label">More essays</p>
  <div class="essay-strip">
    ${essayCards}
    <a href="/posts/" class="essay-card">
      <p class="essay-card-title">Back to all essays →</p>
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
  ${authorBox}
</div>
${moreEssays}
<a href="${esc(postUrl)}" class="u-url" hidden></a>
</article>
${buildCinematicFooter(menuPages)}
</body>
</html>`;
}
