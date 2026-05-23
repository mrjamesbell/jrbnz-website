/*
  Base theme renderers for jrbnz.com.
  Minimal HTML — Arial 14px, no decoration. Designed to be a clean
  starting point and an honest fallback when a renderer is not implemented.
*/

import { esc, buildHead, buildSiteNav, buildNavLinks } from '../lib/templates.js';

function baseFooter(menuPages) {
  const links = buildNavLinks(menuPages).map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' · ');
  return `<footer class="base-footer">${links}${links ? ' · ' : ''}<a href="/feed.xml">RSS</a></footer>`;
}

function head(data) {
  const { title, theme, accent, snippetCss, extraHead } = data;
  return buildHead({ title, theme, accent, snippetCss, extraHead });
}

export function buildPost(data) {
  const { title, dateFormatted, date, tags, contentHtml, menuPages, readTime, theme, accent, snippetCss, extraHead, prevPost, nextPost } = data;
  const tagList = (tags || []).map(t => `<a href="/posts/?tag=${esc(t)}">#${esc(t)}</a>`).join(' ');
  return `${head(data)}
${buildSiteNav(menuPages, '/posts/')}
<div class="base-wrap">
  <h1>${esc(title)}</h1>
  <p class="base-meta"><time datetime="${esc(date)}">${esc(dateFormatted)}</time> · ${readTime} min read${tagList ? ` · ${tagList}` : ''}</p>
  <div class="post-content">${contentHtml}</div>
  ${prevPost || nextPost ? `<p class="base-meta">${prevPost ? `← <a href="/posts/${esc(prevPost.slug)}/">${esc(prevPost.title)}</a>` : ''}${prevPost && nextPost ? ' &nbsp; ' : ''}${nextPost ? `<a href="/posts/${esc(nextPost.slug)}/">${esc(nextPost.title)}</a> →` : ''}</p>` : ''}
</div>
${baseFooter(menuPages)}
</body>
</html>`;
}

export function buildIndex(data) {
  const { posts, menuPages, theme, accent, snippetCss } = data;
  const items = (posts || []).map(p => `
  <li>
    <time>${esc(p.date)}</time>
    <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
  </li>`).join('');
  return `${head(data)}
${buildSiteNav(menuPages, '/posts/')}
<div class="base-wrap">
  <h1>Essays</h1>
  <ul class="base-post-list">${items}</ul>
</div>
${baseFooter(menuPages)}
</body>
</html>`;
}

export function buildPage(data) {
  const { title, contentHtml, menuPages } = data;
  return `${head(data)}
${buildSiteNav(menuPages, `/${data.slug}/`)}
<div class="base-wrap">
  <h1>${esc(title)}</h1>
  <div class="post-content">${contentHtml}</div>
</div>
${baseFooter(menuPages)}
</body>
</html>`;
}

export function buildPhotos(data) {
  const { menuPages } = data;
  return `${head({ ...data, title: 'Photos' })}
${buildSiteNav(menuPages, '/photos/')}
<div class="base-wrap">
  <h1>Photos</h1>
  <p>Photo gallery.</p>
</div>
${baseFooter(menuPages)}
</body>
</html>`;
}

export function buildHomepage(data) {
  const { author, recentPosts, menuPages } = data;
  const posts = (recentPosts || []).filter(p => !(p.tags || []).includes('note')).slice(0, 5);
  const items = posts.map(p => `
  <li>
    <time>${esc(p.date)}</time>
    <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
  </li>`).join('');
  return `${head({ ...data, title: author?.name || 'jrbnz.com' })}
${buildSiteNav(menuPages, '/')}
<div class="base-wrap">
  <h1>${esc(author?.name || 'jrbnz.com')}</h1>
  ${author?.bio ? `<p>${esc(author.bio)}</p>` : ''}
  <h2>Recent essays</h2>
  <ul class="base-post-list">${items}</ul>
</div>
${baseFooter(menuPages)}
</body>
</html>`;
}

export function buildNotes(data) {
  const { notes, menuPages } = data;
  const items = (notes || []).map(n => `
  <article>
    <p class="base-meta"><time>${esc(n.date)}</time> · <a href="/posts/${esc(n.slug)}/">#</a></p>
    <div class="post-content">${n.bodyHtml}</div>
  </article>`).join('<hr>');
  return `${head({ ...data, title: 'Notes' })}
${buildSiteNav(menuPages, '/notes/')}
<div class="base-wrap">
  <h1>Notes</h1>
  ${items}
</div>
${baseFooter(menuPages)}
</body>
</html>`;
}

export const imageRoles = {
  layouts: [
    { className: 'img-wide',  label: 'Wide',  description: 'Wide image.' },
    { className: 'img-break', label: 'Break', description: 'Full-width image.' },
    { className: 'img-small', label: 'Small', description: 'Small image.' },
    { className: 'img-pair',  label: 'Pair',  description: 'Two images side by side.' },
  ],
  treatments: [
    { className: 'photo-muted',  label: 'Muted',  description: 'Reduced saturation.', isDefault: true },
    { className: 'photo-mono',   label: 'Mono',   description: 'Monochrome.' },
    { className: 'photo-colour', label: 'Colour', description: 'Untreated colour.' },
    { className: 'photo-soft',   label: 'Soft',   description: 'Low contrast.' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
