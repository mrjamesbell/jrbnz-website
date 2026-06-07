// Shared page-rendering logic — pure functions with no env / R2 access, so the
// exact same code runs inside the Worker (dynamic routes, rebuilds) and at build
// time under Node (scripts/build.mjs). Build-time rendering is what lets a freshly
// uploaded theme go live in a single deploy: build.mjs inlines the new theme into
// ../themes/_bundle.js, then imports this module and renders every page with it —
// no dependence on the previously-deployed Worker's theme bundle.
import { mdToHtml } from './markdown.js';
import { SITE_URL, esc, buildPostMeta, buildAuthorCard } from './templates.js';
import * as baseTheme from '../themes/base.js';
import * as basicTheme from '../themes/basic.js';
import installedThemes from '../themes/_bundle.js';

const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

// ── Theme registry ────────────────────────────────────────────────────────────

export const THEMES = { base: baseTheme, basic: basicTheme, ...installedThemes };
export const BUILTIN_THEMES = new Set(['base', 'basic']);

export function themeRenderer(name) {
  const theme = THEMES[name] ?? THEMES.basic;
  return {
    buildPost:     theme.buildPost     ?? baseTheme.buildPost,
    buildIndex:    theme.buildIndex    ?? baseTheme.buildIndex,
    buildPage:     theme.buildPage     ?? baseTheme.buildPage,
    buildPhotos:   theme.buildPhotos   ?? baseTheme.buildPhotos,
    buildHomepage: theme.buildHomepage ?? baseTheme.buildHomepage,
    buildNotes:    theme.buildNotes    ?? baseTheme.buildNotes,
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function calcReadingTime(wordCount) {
  return Math.max(1, Math.ceil((wordCount || 0) / 200));
}

function extractFirstImage(body) {
  const signal = (body || '').match(/<!--\s*signal:image\s+src="([^"]+)"/);
  if (signal) return signal[1];
  const md = (body || '').match(/!\[[^\]]*\]\(([^)]+)\)/);
  return md ? md[1] : null;
}

// ── Page renderers ────────────────────────────────────────────────────────────

function prepPostData({ title, slug, date, tags, contentHtml, body, excerpt, subtitle, coverImage, coverImageAlt, coverImageFocus, defaultCoverImage, defaultCoverImageFocus, author, accent, menuPages, snippetCss, allPosts, wordCount, theme }) {
  const year = new Date().getFullYear();
  const ogImage = coverImage || extractFirstImage(body) || DEFAULT_OG_IMAGE;
  const postUrl = `${SITE_URL}/posts/${slug}/`;
  const extraHead = buildPostMeta({ title, postUrl, metaDesc: excerpt || '', ogImage, date, authorName: author?.name });
  const readTime = calcReadingTime(wordCount);
  const dateFormatted = fmtDate(date);
  const authorCard = buildAuthorCard(author);

  const published = (allPosts || [])
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const pidx = published.findIndex(p => p.slug === slug);
  const prevPost = pidx > 0 ? published[pidx - 1] : null;
  const nextPost = pidx < published.length - 1 ? published[pidx + 1] : null;

  const recentPosts = (allPosts || [])
    .filter(p => p.status === 'published' && p.slug !== slug)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return {
    title, slug, date, dateFormatted, tags, contentHtml, author, accent,
    menuPages, snippetCss, readTime, postUrl, extraHead, prevPost, nextPost,
    authorCard, year, theme: theme,
    coverImage: coverImage || defaultCoverImage || null,
    coverImageAlt, coverImageFocus: coverImageFocus || (coverImage ? 'center' : defaultCoverImageFocus) || 'center',
    recentPosts, excerpt, subtitle,
  };
}

export function buildPostHtml(args, theme) {
  const t = theme;
  return themeRenderer(t).buildPost(prepPostData({ ...args, theme: t }));
}

export function buildIndexHtml(posts, accent, menuPages, snippetCss, defaultCoverImage, theme, author) {
  const essays = posts
    .filter(p => p.status === 'published' && !(p.tags || []).includes('note'))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = essays.map(p => {
    const tagsText = (p.tags || []).filter(t => t !== 'note').map(t => `#${esc(t)}`).join(' · ');
    const readTime = calcReadingTime(p.wordCount);
    return `
  <li class="post-list-item" data-tags="${esc((p.tags || []).join(','))}">
    <time>${fmtDateShort(p.date)}</time>
    <div>
      <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
      <div class="post-item-meta">
        ${tagsText ? `<span class="post-item-tags">${tagsText}</span>` : ''}
        <span class="post-item-readtime">${readTime} min read</span>
      </div>
    </div>
  </li>`;
  }).join('');

  const allTags = [...new Set(essays.flatMap(p => (p.tags || []).filter(t => t !== 'note')))].sort();
  const tagChips = allTags.map(t => `<a href="/posts/?tag=${esc(t)}" class="tag-chip">#${esc(t)}</a>`).join('\n    ');
  const year = new Date().getFullYear();

  const t = theme;
  return themeRenderer(t).buildIndex({
    items, tagChips, menuPages, accent, snippetCss, year, theme: t, posts: essays, defaultCoverImage, author,
  });
}

export function buildPageHtml({ title, slug, contentHtml, menuPages, accent, snippetCss, theme, author }) {
  const year = new Date().getFullYear();
  const t = theme;
  return themeRenderer(t).buildPage({
    title, slug, contentHtml, menuPages, accent, snippetCss, year, theme: t, author,
  });
}

export function buildPhotosHtml(menuPages, accent, theme, author) {
  const year = new Date().getFullYear();
  const t = theme;
  return themeRenderer(t).buildPhotos({
    menuPages, accent, year, theme: t, author,
  });
}

export function buildHomepageHtml(posts, author, accent, menuPages, snippetCss, defaultCoverImage, homepageConfig, theme) {
  const published = (posts || [])
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const isNote = p => (p.tags || []).includes('note');
  const allEssays = published.filter(p => !isNote(p));
  const allNotes  = published.filter(p =>  isNote(p));

  const cfg = homepageConfig || {};

  let featuredEssay = allEssays[0] || null;
  if (cfg.featured?.slug) {
    const found = allEssays.find(p => p.slug === cfg.featured.slug);
    if (found) featuredEssay = found;
  }

  const recentEssays = allEssays.filter(p => p.slug !== featuredEssay?.slug).slice(0, 4);
  const recentNotes  = allNotes.slice(0, 5);

  const t = theme;
  return themeRenderer(t).buildHomepage?.({
    author,
    featuredEssay,
    recentEssays,
    recentNotes,
    heroImage:       cfg.heroImage       || null,
    heroDescription: cfg.heroDescription || null,
    quote:           cfg.quote           || null,
    menuPages, accent, snippetCss, theme: t, defaultCoverImage, homepageConfig: cfg,
  }) ?? '';
}

export function buildNotesHtml(notes, bodies, menuPages, accent, snippetCss, theme, author) {
  const t = theme;
  const renderer = themeRenderer(t).buildNotes;
  if (!renderer) return '';
  const notesWithHtml = notes.map((note, i) => ({ ...note, bodyHtml: mdToHtml(bodies[i] || '') }));
  return renderer({ notes: notesWithHtml, menuPages, accent, snippetCss, theme: t, author });
}

// ── Build-time orchestration ──────────────────────────────────────────────────
// Renders every public page to a { distPath: html } map using the data returned
// by GET /api/internal/render-data. Mirrors handleRebuildSite in the Worker, but
// runs under Node at build time so it uses the just-inlined theme bundle. Photos
// is intentionally excluded — it's a separate, hand-authored static system.
export function renderAllPages(data) {
  const { ctx, posts, publishedPosts, publishedPages } = data;
  const { author, accent, menuPages, snippetCss, defaultCoverImage, defaultCoverImageFocus, homepageConfig, theme } = ctx;
  const map = {};

  map['posts/index.html'] = buildIndexHtml(posts, accent, menuPages, snippetCss, defaultCoverImage, theme, author);

  const homepageHtml = buildHomepageHtml(posts, author, accent, menuPages, snippetCss, defaultCoverImage, homepageConfig, theme);
  if (homepageHtml) map['index.html'] = homepageHtml;

  const notes = (publishedPosts || [])
    .filter(p => (p.tags || []).includes('note'))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (notes.length) {
    const notesHtml = buildNotesHtml(notes, notes.map(n => n.body || ''), menuPages, accent, snippetCss, theme, author);
    if (notesHtml) map['notes/index.html'] = notesHtml;
  }

  for (const post of publishedPosts || []) {
    const contentHtml = mdToHtml(post.body || '');
    map[`posts/${post.slug}/index.html`] = buildPostHtml(
      { ...post, contentHtml, author, accent, menuPages, snippetCss, allPosts: posts, defaultCoverImage, defaultCoverImageFocus },
      theme,
    );
  }

  for (const page of publishedPages || []) {
    const contentHtml = mdToHtml(page.body || '');
    map[`${page.slug}/index.html`] = buildPageHtml({ ...page, contentHtml, menuPages, accent, snippetCss, theme, author });
  }

  return map;
}
