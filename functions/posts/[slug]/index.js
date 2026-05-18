import { mdToHtml } from '../../lib/markdown.js';
import { loadSnippetCss } from '../../lib/snippets.js';
import { SITE_URL, esc, buildHead, buildSiteNav, buildPostMeta, buildAuthorCard } from '../../lib/templates.js';
import * as cinematicTheme from '../../themes/cinematic.js';
import * as darkTheme from '../../themes/dark.js';

const SITE_THEME = 'cinematic';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
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

async function loadSiteContext(env) {
  const [authorObj, accentObj, pagesObj, siteObj, snippetCss] = await Promise.all([
    env.BLOG.get('settings/author.json'),
    env.BLOG.get('settings/accent.json'),
    env.BLOG.get('pages/index.json'),
    env.BLOG.get('settings/site.json'),
    loadSnippetCss(env),
  ]);
  const author = authorObj ? JSON.parse(await authorObj.text()) : {};
  const accentData = accentObj ? JSON.parse(await accentObj.text()) : {};
  const menuPages = pagesObj ? JSON.parse(await pagesObj.text()) : [];
  const siteData = siteObj ? JSON.parse(await siteObj.text()) : {};
  return {
    author,
    accent: accentData.accent || null,
    menuPages,
    snippetCss,
    defaultCoverImage: siteData.defaultCoverImage || null,
    defaultCoverImageFocus: siteData.defaultCoverImageFocus || 'center',
  };
}

function buildPostHtml({ title, slug, date, tags, contentHtml, body, excerpt, subtitle, coverImage, coverImageAlt, coverImageFocus, defaultCoverImage, defaultCoverImageFocus, author, accent, menuPages, snippetCss, allPosts, wordCount }) {
  const themes = { dark: darkTheme, cinematic: cinematicTheme };
  const theme = themes[SITE_THEME] ?? themes.dark;
  const renderer = theme.buildPost ?? darkTheme.buildPost;

  const ogImage = coverImage || extractFirstImage(body) || DEFAULT_OG_IMAGE;
  const postUrl = `${SITE_URL}/posts/${slug}/`;
  const extraHead = buildPostMeta({ title, postUrl, metaDesc: excerpt || '', ogImage, date, authorName: author?.name });
  const readTime = calcReadingTime(wordCount);
  const dateFormatted = fmtDate(date);
  const authorCard = buildAuthorCard(author);
  const year = new Date().getFullYear();

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

  return renderer({
    title, slug, date, dateFormatted, tags, contentHtml, author, accent,
    menuPages, snippetCss, readTime, postUrl, extraHead, prevPost, nextPost,
    authorCard, year, theme: SITE_THEME,
    coverImage: coverImage || defaultCoverImage || null,
    coverImageAlt,
    coverImageFocus: coverImageFocus || (coverImage ? 'center' : defaultCoverImageFocus) || 'center',
    recentPosts, excerpt, subtitle,
  });
}

export async function onRequestGet({ params, env }) {
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  // Fast path — pre-built HTML in R2
  const cached = await env.BLOG.get(`posts/${slug}/index.html`);
  if (cached) {
    return new Response(cached.body, {
      headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
    });
  }

  // Lazy build — check the post is actually published before doing work
  const indexObj = await env.BLOG.get('posts/index.json');
  if (!indexObj) return new Response('Not found', { status: 404 });
  const posts = await indexObj.json();
  const post = posts.find(p => p.slug === slug && p.status === 'published');
  if (!post) return new Response('Post not found', { status: 404 });

  const [draftObj, ctx] = await Promise.all([
    env.BLOG.get(`posts/${slug}/draft.md`),
    loadSiteContext(env),
  ]);
  const body = draftObj ? await draftObj.text() : '';
  const contentHtml = mdToHtml(body);
  const { author, accent, menuPages, snippetCss, defaultCoverImage, defaultCoverImageFocus } = ctx;

  const html = buildPostHtml({
    ...post, body, contentHtml, author, accent, menuPages, snippetCss,
    allPosts: posts, defaultCoverImage, defaultCoverImageFocus,
  });

  // Cache for subsequent requests
  await env.BLOG.put(`posts/${slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
  });
}
