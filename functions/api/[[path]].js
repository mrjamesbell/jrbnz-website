import { mdEsc, mdInline, mdToHtml } from '../lib/markdown.js';
import { loadSnippetCss } from '../lib/snippets.js';
import { SITE_URL, esc, buildHead, buildSiteNav, buildFooter, buildPostMeta, buildAuthorCard } from '../lib/templates.js';
import * as darkTheme from '../themes/dark.js';
import * as cinematicTheme from '../themes/cinematic.js';

const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

// ── Theme registry ────────────────────────────────────────────────────────────

const SITE_THEME = 'cinematic'; // change to 'dark' to switch themes

const THEMES = { dark: darkTheme, cinematic: cinematicTheme };

function themeRenderer(name) {
  const theme = THEMES[name] ?? THEMES.dark;
  return {
    buildPost:     theme.buildPost     ?? darkTheme.buildPost,
    buildIndex:    theme.buildIndex    ?? darkTheme.buildIndex,
    buildPage:     theme.buildPage     ?? darkTheme.buildPage,
    buildPhotos:   theme.buildPhotos   ?? darkTheme.buildPhotos,
    buildHomepage: theme.buildHomepage ?? darkTheme.buildHomepage,
    buildNotes:    theme.buildNotes    ?? null,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getMicropubToken(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('micropub'));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifySession(token, password) {
  if (!token || !password) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [ts, sigHex] = parts;
  const age = Date.now() - parseInt(ts);
  if (age < 0 || age > 30 * 24 * 60 * 60 * 1000) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = new Uint8Array(sigHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(ts));
}

async function createSession(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ts = Date.now().toString();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(ts));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ts}.${sigHex}`;
}

function getSessionCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.match(/blog_session=([^;]+)/)?.[1] ?? null;
}

function authedResponse(response, token) {
  response.headers.set('Set-Cookie', `blog_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`);
  return response;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

const RATE_KEY = 'auth/rate-limit.json';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

async function checkRateLimit(env) {
  try {
    const obj = await env.BLOG.get(RATE_KEY);
    if (!obj) return { locked: false };
    const data = await obj.json();
    if (data.attempts >= MAX_ATTEMPTS && Date.now() - data.lastAttempt < LOCKOUT_MS) {
      const retryAfter = Math.ceil((data.lastAttempt + LOCKOUT_MS - Date.now()) / 1000);
      return { locked: true, retryAfter };
    }
    return { locked: false, attempts: data.attempts };
  } catch {
    return { locked: false };
  }
}

async function recordFailedAttempt(env) {
  let data = { attempts: 0, lastAttempt: 0 };
  try {
    const obj = await env.BLOG.get(RATE_KEY);
    if (obj) data = await obj.json();
  } catch {}
  data.attempts = (data.attempts || 0) + 1;
  data.lastAttempt = Date.now();
  await env.BLOG.put(RATE_KEY, JSON.stringify(data), { httpMetadata: { contentType: 'application/json' } });
}

async function resetRateLimit(env) {
  await env.BLOG.put(RATE_KEY, JSON.stringify({ attempts: 0, lastAttempt: 0 }), { httpMetadata: { contentType: 'application/json' } });
}

// ── Slug validation ───────────────────────────────────────────────────────────

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug);
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

// mdEsc, mdInline, mdToHtml — imported from ../lib/markdown.js

// ── HTML templates ────────────────────────────────────────────────────────────
// esc, buildHead, buildSiteNav, buildFooter, buildPostMeta, buildAuthorCard
// are imported from ../lib/templates.js

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

function prepPostData({ title, slug, date, tags, contentHtml, body, excerpt, subtitle, coverImage, coverImageAlt, coverImageFocus, defaultCoverImage, defaultCoverImageFocus, author, accent, menuPages, snippetCss, allPosts, wordCount }) {
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
    authorCard, year, theme: SITE_THEME,
    coverImage: coverImage || defaultCoverImage || null,
    coverImageAlt, coverImageFocus: coverImageFocus || (coverImage ? 'center' : defaultCoverImageFocus) || 'center',
    recentPosts, excerpt, subtitle,
  };
}

function buildPostHtml(args) {
  return themeRenderer(SITE_THEME).buildPost(prepPostData(args));
}

function buildIndexHtml(posts, accent, menuPages, snippetCss, defaultCoverImage) {
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = published.map(p => {
    const tagsText = (p.tags || []).map(t => `#${esc(t)}`).join(' · ');
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

  const allTags = [...new Set(published.flatMap(p => p.tags || []))].sort();
  const tagChips = allTags.map(t => `<a href="/posts/?tag=${esc(t)}" class="tag-chip">#${esc(t)}</a>`).join('\n    ');
  const year = new Date().getFullYear();

  return themeRenderer(SITE_THEME).buildIndex({
    items, tagChips, menuPages, accent, snippetCss, year, theme: SITE_THEME, posts: published, defaultCoverImage,
  });
}

function buildPageHtml({ title, slug, contentHtml, menuPages, accent, snippetCss }) {
  const year = new Date().getFullYear();
  return themeRenderer(SITE_THEME).buildPage({
    title, slug, contentHtml, menuPages, accent, snippetCss, year, theme: SITE_THEME,
  });
}

function buildPhotosHtml(menuPages, accent) {
  const year = new Date().getFullYear();
  return themeRenderer(SITE_THEME).buildPhotos({
    menuPages, accent, year, theme: SITE_THEME,
  });
}

function buildHomepageHtml(posts, author, accent, menuPages, snippetCss, defaultCoverImage) {
  const recentPosts = (posts || [])
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  return themeRenderer(SITE_THEME).buildHomepage?.({
    author, recentPosts, menuPages, accent, snippetCss, theme: SITE_THEME, defaultCoverImage,
  }) ?? '';
}

function buildNotesHtml(notes, bodies, menuPages, accent, snippetCss) {
  const renderer = themeRenderer(SITE_THEME).buildNotes;
  if (!renderer) return '';
  const notesWithHtml = notes.map((note, i) => ({ ...note, bodyHtml: mdToHtml(bodies[i] || '') }));
  return renderer({ notes: notesWithHtml, menuPages, accent, snippetCss, theme: SITE_THEME });
}

async function buildNotesHtmlFromPosts(env, posts, menuPages, accent, snippetCss) {
  const notes = (posts || [])
    .filter(p => p.status === 'published' && (p.tags || []).includes('note'))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!notes.length) return '';
  const bodies = await Promise.all(notes.map(async n => {
    const obj = await env.BLOG.get(`posts/${n.slug}/draft.md`);
    return obj ? await obj.text() : '';
  }));
  return buildNotesHtml(notes, bodies, menuPages, accent, snippetCss);
}

// ── Index helpers ─────────────────────────────────────────────────────────────

async function getIndex(env) {
  const obj = await env.BLOG.get('posts/index.json');
  if (!obj) return [];
  return obj.json();
}

async function saveIndex(env, posts) {
  await env.BLOG.put('posts/index.json', JSON.stringify(posts), { httpMetadata: { contentType: 'application/json' } });
}

async function rebuildIndexHtml(env, posts) {
  const { author, accent, menuPages, snippetCss, defaultCoverImage, defaultCoverImageFocus } = await loadSiteContext(env);
  const indexHtml = buildIndexHtml(posts, accent, menuPages, snippetCss, defaultCoverImage);
  const homepageHtml = buildHomepageHtml(posts, author, accent, menuPages, snippetCss, defaultCoverImage);
  const notesHtml = await buildNotesHtmlFromPosts(env, posts, menuPages, accent, snippetCss);
  await Promise.all([
    env.BLOG.put('posts/index.html', indexHtml, { httpMetadata: { contentType: 'text/html' } }),
    ...(homepageHtml ? [env.BLOG.put('pages/homepage/index.html', homepageHtml, { httpMetadata: { contentType: 'text/html' } })] : []),
    ...(notesHtml ? [env.BLOG.put('pages/notes/index.html', notesHtml, { httpMetadata: { contentType: 'text/html' } })] : []),
  ]);
}

async function rebuildPostHtml(env, slug, posts) {
  const post = posts.find(p => p.slug === slug);
  if (!post || post.status !== 'published') return;

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  const contentHtml = mdToHtml(body);
  const { author, accent, menuPages, snippetCss, defaultCoverImage, defaultCoverImageFocus } = await loadSiteContext(env);
  const html = buildPostHtml({ ...post, body, contentHtml, author, accent, menuPages, snippetCss, allPosts: posts, defaultCoverImage, defaultCoverImageFocus });
  await env.BLOG.put(`posts/${slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });
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
  return { author, accent: accentData.accent || null, menuPages, snippetCss, defaultCoverImage: siteData.defaultCoverImage || null, defaultCoverImageFocus: siteData.defaultCoverImageFocus || 'center' };
}

async function handleGetSiteSettings(env) {
  const obj = await env.BLOG.get('settings/site.json');
  return json(obj ? JSON.parse(await obj.text()) : {});
}

async function handleSaveSiteSettings(request, env) {
  const data = await request.json();
  const existing = await env.BLOG.get('settings/site.json').then(o => o ? o.json() : {}).catch(() => ({}));
  const updated = { ...existing, ...data };
  await env.BLOG.put('settings/site.json', JSON.stringify(updated), { httpMetadata: { contentType: 'application/json' } });
  return json(updated);
}

async function getPagesIndex(env) {
  const obj = await env.BLOG.get('pages/index.json');
  if (!obj) return [];
  return obj.json();
}

async function savePagesIndex(env, pages) {
  await env.BLOG.put('pages/index.json', JSON.stringify(pages), { httpMetadata: { contentType: 'application/json' } });
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, params, env } = context;
  const method = request.method;
  const path = params.path || [];
  const [resource, slug, action] = path;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE', 'access-control-allow-headers': 'Content-Type' } });
  }

  // Auth routes — no session required
  if (resource === 'auth') {
    if (slug === 'login' && method === 'POST') return handleLogin(request, env);
    if (slug === 'logout' && method === 'POST') return handleLogout();
    if (slug === 'check' && method === 'GET') {
      const token = getSessionCookie(request);
      if (token && await verifySession(token, env.BLOG_PASSWORD)) return json({ ok: true });
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  // Legacy login route
  if (resource === 'login' && method === 'POST') return handleLogin(request, env);

  // IndieAuth + Micropub — use their own auth, not session
  if (resource === 'indieauth') return handleIndieAuth(request, env, slug);
  if (resource === 'micropub' && slug === 'media') return handleMicropubMedia(request, env);
  if (resource === 'micropub') return handleMicropub(request, env);

  // Public theme config — no auth required
  if (resource === 'theme' && slug === 'image-roles' && method === 'GET') {
    const theme = THEMES[SITE_THEME] ?? THEMES.dark;
    return json(theme.imageRoles ?? { layouts: [], treatments: [], defaults: {} });
  }

  // All other routes require auth
  const token = getSessionCookie(request);
  if (!token || !await verifySession(token, env.BLOG_PASSWORD)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Author settings
  if (resource === 'author') {
    if (method === 'GET') return handleGetAuthor(env);
    if (method === 'PUT') return handleSaveAuthor(request, env);
  }

  // Micropub bearer token (for iA Writer "Enter Token Manually")
  if (resource === 'micropub-token' && method === 'GET') {
    const mpToken = await getMicropubToken(env.BLOG_PASSWORD);
    return json({ token: mpToken });
  }

  // Site rebuild, accent, site settings
  if (resource === 'site') {
    if (slug === 'rebuild' && method === 'POST') return handleRebuildSite(env);
    if (slug === 'rebuild-indexes' && method === 'POST') return handleRebuildIndexHtml(env);
    if (slug === 'accent') {
      if (method === 'GET') return handleGetAccent(env);
      if (method === 'PUT') return handleSaveAccent(request, env);
    }
    if (slug === 'settings') {
      if (method === 'GET') return handleGetSiteSettings(env);
      if (method === 'PUT') return handleSaveSiteSettings(request, env);
    }
  }

  // Snippets
  if (resource === 'snippets') {
    if (method === 'GET') return handleGetSnippets(env);
    if (method === 'PUT') return handleSaveSnippets(request, env);
  }

  // Media
  if (resource === 'media') {
    if (!slug) {
      if (method === 'GET') return handleListMedia(env);
    } else if (slug === 'upload') {
      if (method === 'POST') return handleUploadMedia(request, env);
    } else {
      if (method === 'DELETE') return handleDeleteMedia(env, slug);
    }
  }

  // YouTube title
  if (resource === 'youtube' && slug === 'title' && method === 'GET') {
    return handleYouTubeTitle(request);
  }

  // Legacy upload endpoint
  if (resource === 'upload' && method === 'POST') return handleUpload(request, env, slug);

  // Posts
  if (resource === 'posts') {
    if (!slug) {
      if (method === 'GET') return handleListPosts(env);
      if (method === 'POST') return handleCreatePost(request, env);
    } else if (!action) {
      if (method === 'GET') return handleGetPost(env, slug);
      if (method === 'PUT') return handleSaveDraft(request, env, slug);
      if (method === 'DELETE') return handleDeletePost(env, slug);
    } else {
      if (action === 'publish' && method === 'POST') return handlePublish(env, slug, request);
      if (action === 'unpublish' && method === 'POST') return handleUnpublish(env, slug);
      if (action === 'rename' && method === 'POST') return handleRename(request, env, slug);
      if (action === 'review' && method === 'POST') return handleReviewPost(env, slug);
      if (action === 'generate-excerpt' && method === 'POST') return handleGenerateExcerpt(env, slug, request);
    }
  }

  // Pages
  if (resource === 'pages') {
    if (!slug) {
      if (method === 'GET') return handleListPages(env);
      if (method === 'POST') return handleCreatePage(request, env);
    } else if (!action) {
      if (method === 'GET') return handleGetPage(env, slug);
      if (method === 'PUT') return handleSavePage(request, env, slug);
      if (method === 'DELETE') return handleDeletePage(env, slug);
    } else {
      if (action === 'publish' && method === 'POST') return handlePublishPage(env, slug);
      if (action === 'unpublish' && method === 'POST') return handleUnpublishPage(env, slug);
      if (action === 'rename' && method === 'POST') return handleRenamePage(request, env, slug);
      if (action === 'review' && method === 'POST') return handleReviewPage(env, slug);
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ── Auth handlers ─────────────────────────────────────────────────────────────

async function handleLogin(request, env) {
  const { password } = await request.json().catch(() => ({}));

  const rateCheck = await checkRateLimit(env);
  if (rateCheck.locked) {
    return json({ error: `Too many failed attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 60)} minutes.`, retryAfter: rateCheck.retryAfter }, 429);
  }

  if (!password || password !== env.BLOG_PASSWORD) {
    await recordFailedAttempt(env);
    return json({ error: 'Invalid password' }, 401);
  }

  await resetRateLimit(env);
  const token = await createSession(env.BLOG_PASSWORD);
  const res = json({ ok: true });
  return authedResponse(res, token);
}

function handleLogout() {
  const res = json({ ok: true });
  res.headers.set('Set-Cookie', 'blog_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
  return res;
}

// ── Author handlers ───────────────────────────────────────────────────────────

async function handleGetAuthor(env) {
  try {
    const obj = await env.BLOG.get('settings/author.json');
    if (!obj) return json({ name: 'James Bell', bio: '', headshotUrl: '', threads: '', instagram: '', linkedin: '', flickr: '' });
    return json(await obj.json());
  } catch {
    return json({ name: 'James Bell', bio: '', headshotUrl: '', threads: '', instagram: '', linkedin: '', flickr: '' });
  }
}

async function handleSaveAuthor(request, env) {
  const { name, bio, headshotUrl, threads, instagram, linkedin, flickr } = await request.json();
  const data = {
    name: name || '',
    bio: bio || '',
    headshotUrl: headshotUrl || '',
    threads: threads || '',
    instagram: instagram || '',
    linkedin: linkedin || '',
    flickr: flickr || '',
  };
  await env.BLOG.put('settings/author.json', JSON.stringify(data), { httpMetadata: { contentType: 'application/json' } });
  return json(data);
}

async function handleRebuildSite(env) {
  const [posts, pages, { author, accent, menuPages, snippetCss, defaultCoverImage, defaultCoverImageFocus }] = await Promise.all([
    getIndex(env),
    getPagesIndex(env),
    loadSiteContext(env),
  ]);
  const publishedPosts = posts.filter(p => p.status === 'published');
  const publishedPages = pages.filter(p => p.status === 'published');
  await Promise.all([
    ...publishedPosts.map(async post => {
      const obj = await env.BLOG.get(`posts/${post.slug}/draft.md`);
      const body = obj ? await obj.text() : '';
      const html = buildPostHtml({ ...post, body, contentHtml: mdToHtml(body), author, accent, menuPages, snippetCss, allPosts: posts, defaultCoverImage, defaultCoverImageFocus });
      await env.BLOG.put(`posts/${post.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });
    }),
    ...publishedPages.map(async page => {
      const obj = await env.BLOG.get(`pages/${page.slug}/draft.md`);
      const body = obj ? await obj.text() : '';
      const html = buildPageHtml({ ...page, contentHtml: mdToHtml(body), menuPages, accent, snippetCss });
      await env.BLOG.put(`pages/${page.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });
    }),
  ]);
  const [indexHtml, photosHtml, homepageHtml, notesHtml] = await Promise.all([
    Promise.resolve(buildIndexHtml(posts, accent, menuPages, snippetCss, defaultCoverImage)),
    Promise.resolve(buildPhotosHtml(menuPages, accent)),
    Promise.resolve(buildHomepageHtml(posts, author, accent, menuPages, snippetCss, defaultCoverImage)),
    buildNotesHtmlFromPosts(env, posts, menuPages, accent, snippetCss),
  ]);
  await Promise.all([
    env.BLOG.put('posts/index.html', indexHtml, { httpMetadata: { contentType: 'text/html' } }),
    env.BLOG.put('pages/photos/index.html', photosHtml, { httpMetadata: { contentType: 'text/html' } }),
    ...(homepageHtml ? [env.BLOG.put('pages/homepage/index.html', homepageHtml, { httpMetadata: { contentType: 'text/html' } })] : []),
    ...(notesHtml ? [env.BLOG.put('pages/notes/index.html', notesHtml, { httpMetadata: { contentType: 'text/html' } })] : []),
  ]);
  return json({ rebuilt: publishedPosts.length + publishedPages.length });
}

// ── Media handlers ────────────────────────────────────────────────────────────

async function handleListMedia(env) {
  const [uploaded, imported] = await Promise.all([
    env.BLOG.list({ prefix: 'media/' }),
    env.BLOG.list({ prefix: 'posts/media/', limit: 500 }),
  ]);

  const toItem = (o, publicUrl) => ({
    key: o.key,
    filename: o.key.split('/').pop(),
    publicUrl,
    url: publicUrl,
    size: o.size,
    uploaded: o.uploaded,
  });

  const items = [
    ...uploaded.objects.map(o => toItem(o, `/${o.key}`)),
    ...imported.objects.map(o => toItem(o, `/${o.key}`)),
  ].sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

  return json(items);
}

async function handleUploadMedia(request, env) {
  const url = new URL(request.url);
  const rawFilename = url.searchParams.get('filename') || 'upload.jpg';
  const filename = decodeURIComponent(rawFilename);
  const ct = request.headers.get('Content-Type') || 'application/octet-stream';

  const rawReplaceKey = url.searchParams.get('replaceKey');
  const replaceKey = rawReplaceKey ? decodeURIComponent(rawReplaceKey) : null;

  const safeName = filename.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
  const key = replaceKey || `media/${Date.now()}-${safeName}`;

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: 'empty body — file not received' }, 400);

  const size = body.byteLength;
  await env.BLOG.put(key, body, { httpMetadata: { contentType: ct } });

  return json({ key, publicUrl: `/${key}`, filename, size });
}

async function handleDeleteMedia(env, key) {
  await env.BLOG.delete(decodeURIComponent(key));
  return json({ ok: true });
}

// ── YouTube handler ───────────────────────────────────────────────────────────

async function handleYouTubeTitle(request) {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('id');
  if (!videoId) return json({ error: 'id required' }, 400);
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return json({ title: '', thumbnail: '' });
    const data = await res.json();
    return json({ title: data.title || '', thumbnail: data.thumbnail_url || '' });
  } catch {
    return json({ title: '', thumbnail: '' });
  }
}

// ── Post handlers ─────────────────────────────────────────────────────────────

async function handleListPosts(env) {
  const posts = await getIndex(env);
  return json(posts);
}

async function handleCreatePost(request, env) {
  const { title, slug, date, tags } = await request.json();
  if (!title || !slug) return json({ error: 'title and slug required' }, 400);
  if (!isValidSlug(slug)) return json({ error: 'slug must be 1-80 lowercase letters, digits, or hyphens' }, 400);

  const posts = await getIndex(env);
  if (posts.find(p => p.slug === slug)) return json({ error: 'slug already exists' }, 409);

  const now = new Date().toISOString();
  const entry = {
    slug,
    title,
    date: date || now.slice(0, 10),
    tags: tags || [],
    status: 'draft',
    subtitle: '',
    excerpt: '',
    coverImage: null,
    coverImageAlt: '',
    coverImageFocus: 'center',
    wordCount: 0,
    createdAt: now,
    updatedAt: now
  };
  posts.push(entry);
  await saveIndex(env, posts);
  await env.BLOG.put(`posts/${slug}/draft.md`, '', { httpMetadata: { contentType: 'text/markdown' } });

  return json(entry, 201);
}

async function handleGetPost(env, slug) {
  const posts = await getIndex(env);
  const meta = posts.find(p => p.slug === slug);
  if (!meta) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  return json({ ...meta, body });
}

async function migrateMediaToPost(env, slug, body) {
  // Match both /media/... and https://jrbnz-blog.r2.dev/media/... URLs
  const re = /(?:https:\/\/jrbnz-blog\.r2\.dev)?(\/media\/[^\s"')>]+)/g;
  const migrations = [];
  let match;
  while ((match = re.exec(body)) !== null) {
    migrations.push(match[1]); // e.g. /media/1234-photo.jpg
  }
  if (!migrations.length) return body;

  let updated = body;
  await Promise.all(migrations.map(async (mediaPath) => {
    const srcKey = mediaPath.slice(1); // strip leading /  → media/1234-photo.jpg
    const filename = srcKey.split('/').pop();
    const destKey = `posts/media/${slug}/${filename}`;
    try {
      const obj = await env.BLOG.get(srcKey);
      if (!obj) return; // already moved or doesn't exist
      const ct = obj.httpMetadata?.contentType || 'application/octet-stream';
      await env.BLOG.put(destKey, obj.body, { httpMetadata: { contentType: ct } });
      await env.BLOG.delete(srcKey);
      // Rewrite both URL forms to the post-relative path
      const destUrl = `/${destKey}`;
      updated = updated
        .replaceAll(`https://jrbnz-blog.r2.dev${mediaPath}`, destUrl)
        .replaceAll(mediaPath, destUrl);
    } catch {}
  }));
  return updated;
}

async function handleSaveDraft(request, env, slug) {
  const data = await request.json();
  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  const now = new Date().toISOString();
  const isPublished = posts[idx].status === 'published';
  posts[idx] = {
    ...posts[idx],
    title: data.title ?? posts[idx].title,
    date: data.date ?? posts[idx].date,
    tags: data.tags ?? posts[idx].tags,
    subtitle: data.subtitle !== undefined ? data.subtitle : (posts[idx].subtitle || ''),
    excerpt: data.excerpt ?? posts[idx].excerpt,
    coverImage: data.coverImage !== undefined ? data.coverImage : posts[idx].coverImage,
    coverImageAlt: data.coverImageAlt !== undefined ? data.coverImageAlt : (posts[idx].coverImageAlt || ''),
    coverImageFocus: data.coverImageFocus || posts[idx].coverImageFocus || 'center',
    wordCount: data.wordCount ?? posts[idx].wordCount,
    updatedAt: now,
    status: isPublished ? 'published' : 'draft',
    hasDraftChanges: isPublished ? true : false,
  };

  let body = data.body ?? data.markdown ?? '';
  body = await migrateMediaToPost(env, slug, body);
  await env.BLOG.put(`posts/${slug}/draft.md`, body, { httpMetadata: { contentType: 'text/markdown' } });
  await saveIndex(env, posts);
  return json(posts[idx]);
}

async function handleReviewPost(env, slug) {
  const posts = await getIndex(env);
  const post = posts.find(p => p.slug === slug);
  if (!post) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  if (!body.trim()) return json({ error: 'Post has no content to review' }, 400);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);

  const prompt = `You are an editorial assistant reviewing a blog post for a personal blog. The author wants honest, practical feedback.

Please review the following post titled "${esc(post.title)}" and provide:
1. **Spelling & grammar** — list any specific errors you find (quote the text)
2. **Clarity** — anything confusing, unclear, or that could be better explained
3. **Content** — what's missing, what could be expanded, or what doesn't quite land
4. **One or two suggestions** — concrete things to improve the post

Be direct and brief. If something is fine, say so. Use markdown formatting.

---

${body}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: `Anthropic API error ${res.status}` }, 502);
  }

  const data = await res.json();
  const review = data.content?.[0]?.text || '';
  return json({ review });
}

async function handleGenerateExcerpt(env, slug, request) {
  const posts = await getIndex(env);
  const post = posts.find(p => p.slug === slug);
  if (!post) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  if (!body.trim()) return json({ error: 'Post has no content' }, 400);

  const apiKey = env.ANTHROPIC_API_KEY || (request.headers.get('x-api-key') || '');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);

  const prompt = `Write a 1–2 sentence plain-text excerpt for the following blog post, written in first person from the author's perspective (use "I", "my", "we" etc.). Maximum 280 characters total. No quotes, no commentary, just the excerpt itself.

Title: ${post.title}

${body}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) return json({ error: `Anthropic API error ${res.status}` }, 502);

  const data = await res.json();
  const excerpt = (data.content?.[0]?.text || '').trim().slice(0, 280);
  return json({ excerpt });
}

async function handleReviewPage(env, slug) {
  const pages = await getPagesIndex(env);
  const page = pages.find(p => p.slug === slug);
  if (!page) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`pages/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  if (!body.trim()) return json({ error: 'Page has no content to review' }, 400);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);

  const prompt = `You are an editorial assistant reviewing a page for a personal website. The author wants honest, practical feedback.

Please review the following page titled "${esc(page.title)}" and provide:
1. **Spelling & grammar** — list any specific errors you find (quote the text)
2. **Clarity** — anything confusing, unclear, or that could be better explained
3. **Content** — what's missing, what could be expanded, or what doesn't quite land
4. **One or two suggestions** — concrete things to improve the page

Be direct and brief. If something is fine, say so. Use markdown formatting.

---

${body}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) return json({ error: `Anthropic API error ${res.status}` }, 502);

  const data = await res.json();
  const review = data.content?.[0]?.text || '';
  return json({ review });
}

async function handlePublish(env, slug, request) {
  const reqData = request ? await request.json().catch(() => ({})) : {};

  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  posts[idx].status = 'published';
  posts[idx].hasDraftChanges = false;
  posts[idx].updatedAt = new Date().toISOString();
  if (reqData.excerpt !== undefined) posts[idx].excerpt = reqData.excerpt;

  // Save index JSON + delete stale cached HTML so serve Worker rebuilds lazily
  await Promise.all([
    saveIndex(env, posts),
    env.BLOG.delete(`posts/${slug}/index.html`),
  ]);

  return json({ ...posts[idx], url: `/posts/${slug}/` });
}

async function handleRebuildIndexHtml(env) {
  const posts = await getIndex(env);
  await rebuildIndexHtml(env, posts);
  return json({ ok: true });
}

async function handleUnpublish(env, slug) {
  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  posts[idx].status = 'draft';
  posts[idx].updatedAt = new Date().toISOString();
  await env.BLOG.delete(`posts/${slug}/index.html`);
  await saveIndex(env, posts);
  await rebuildIndexHtml(env, posts);

  return json(posts[idx]);
}

async function handleDeletePost(env, slug) {
  const posts = await getIndex(env);
  const updated = posts.filter(p => p.slug !== slug);
  if (updated.length === posts.length) return json({ error: 'Not found' }, 404);

  const listed = await env.BLOG.list({ prefix: `posts/${slug}/` });
  await Promise.all(listed.objects.map(o => env.BLOG.delete(o.key)));

  await saveIndex(env, updated);
  await rebuildIndexHtml(env, updated);
  return json({ ok: true });
}

async function handleRename(request, env, oldSlug) {
  const { newSlug } = await request.json();
  if (!newSlug) return json({ error: 'newSlug required' }, 400);
  if (!isValidSlug(newSlug)) return json({ error: 'slug must be 1-80 lowercase letters, digits, or hyphens' }, 400);
  if (newSlug === oldSlug) return json({ ok: true });

  const posts = await getIndex(env);
  if (posts.find(p => p.slug === newSlug)) return json({ error: 'slug already exists' }, 409);

  const idx = posts.findIndex(p => p.slug === oldSlug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  // Copy all R2 objects
  const listed = await env.BLOG.list({ prefix: `posts/${oldSlug}/` });
  await Promise.all(listed.objects.map(async o => {
    const obj = await env.BLOG.get(o.key);
    if (!obj) return;
    const newKey = o.key.replace(`posts/${oldSlug}/`, `posts/${newSlug}/`);
    await env.BLOG.put(newKey, obj.body, { httpMetadata: o.httpMetadata });
    await env.BLOG.delete(o.key);
  }));

  posts[idx] = { ...posts[idx], slug: newSlug, updatedAt: new Date().toISOString() };
  await saveIndex(env, posts);

  // Rebuild if published
  if (posts[idx].status === 'published') {
    await rebuildPostHtml(env, newSlug, posts);
    await rebuildIndexHtml(env, posts);
  }

  return json(posts[idx]);
}

async function handleRenamePage(request, env, oldSlug) {
  const { newSlug } = await request.json();
  if (!newSlug) return json({ error: 'newSlug required' }, 400);
  if (!isValidSlug(newSlug)) return json({ error: 'slug must be 1-80 lowercase letters, digits, or hyphens' }, 400);
  if (newSlug === oldSlug) return json({ ok: true });

  const pages = await getPagesIndex(env);
  if (pages.find(p => p.slug === newSlug)) return json({ error: 'slug already exists' }, 409);

  const idx = pages.findIndex(p => p.slug === oldSlug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  // Copy all R2 objects under old slug to new slug, then delete old
  const listed = await env.BLOG.list({ prefix: `pages/${oldSlug}/` });
  await Promise.all(listed.objects.map(async o => {
    const obj = await env.BLOG.get(o.key);
    if (!obj) return;
    const newKey = o.key.replace(`pages/${oldSlug}/`, `pages/${newSlug}/`);
    await env.BLOG.put(newKey, obj.body, { httpMetadata: o.httpMetadata });
    await env.BLOG.delete(o.key);
  }));

  pages[idx] = { ...pages[idx], slug: newSlug, updatedAt: new Date().toISOString() };
  await savePagesIndex(env, pages);

  return json(pages[idx]);
}

async function handleUpload(request, env, slug) {
  if (!slug) return json({ error: 'slug required' }, 400);
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return json({ error: 'file required' }, 400);

  const filename = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, '_')}`;
  const key = `posts/media/${slug}/${filename}`;

  await env.BLOG.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });

  return json({ url: `/${key}`, filename });
}

// ── IndieAuth ─────────────────────────────────────────────────────────────────

const INDIEAUTH_PAGE = (params) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Authorize - James Bell</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:380px;margin:5rem auto;padding:1.5rem;color:#222}
  h1{font-size:1.1rem;margin-bottom:.5rem}
  p{margin:.5rem 0 1.5rem;color:#555;font-size:.9rem}
  input[type=password]{display:block;width:100%;padding:.6rem;margin-bottom:1rem;border:1px solid #ccc;border-radius:4px;font-size:1rem;box-sizing:border-box}
  button{padding:.6rem 1.4rem;background:#1a1a1a;color:#fff;border:none;border-radius:4px;font-size:.95rem;cursor:pointer}
</style>
</head>
<body>
<h1>Authorize Access</h1>
<p><strong>${esc(params.client_id || 'An app')}</strong> wants to post to your site.</p>
<form method="POST">
  <input type="hidden" name="client_id" value="${esc(params.client_id || '')}">
  <input type="hidden" name="redirect_uri" value="${esc(params.redirect_uri || '')}">
  <input type="hidden" name="state" value="${esc(params.state || '')}">
  <input type="hidden" name="scope" value="${esc(params.scope || 'create')}">
  <input type="hidden" name="me" value="${esc(params.me || '')}">
  <input type="password" name="password" placeholder="Password" required autofocus>
  <button type="submit">Approve</button>
</form>
</body>
</html>`;

function toUrlSafeB64(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromUrlSafeB64(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(s + '==='.slice((s.length + 3) % 4));
}

async function makeAuthCode(password, data) {
  const payload = toUrlSafeB64(JSON.stringify(data));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${payload}.${sigHex}`;
}

async function parseAuthCode(password, code) {
  const dot = code.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = code.slice(0, dot);
  const sigHex = code.slice(dot + 1);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = new Uint8Array(sigHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(payload));
  if (!valid) return null;
  try { return JSON.parse(fromUrlSafeB64(payload)); } catch { return null; }
}

async function handleIndieAuth(request, env, slug) {
  const url = new URL(request.url);

  if (slug === 'auth') {
    if (request.method === 'GET') {
      const params = Object.fromEntries(url.searchParams);
      return new Response(INDIEAUTH_PAGE(params), { headers: { 'content-type': 'text/html' } });
    }
    if (request.method === 'POST') {
      const form = await request.formData().catch(() => new FormData());
      const password = form.get('password');
      const client_id = form.get('client_id') || '';
      const redirect_uri = form.get('redirect_uri');
      const state = form.get('state') || '';
      const scope = form.get('scope') || 'create';
      const me = form.get('me') || 'https://jrbnz.com';

      if (!redirect_uri) return new Response('redirect_uri required', { status: 400, headers: { 'content-type': 'text/plain' } });

      // Validate redirect_uri origin matches client_id origin (IndieAuth spec)
      try {
        const clientOrigin = new URL(client_id).origin;
        const redirectOrigin = new URL(redirect_uri).origin;
        if (clientOrigin !== redirectOrigin) {
          return new Response('redirect_uri does not match client_id', { status: 400, headers: { 'content-type': 'text/plain' } });
        }
      } catch {
        return new Response('invalid client_id or redirect_uri', { status: 400, headers: { 'content-type': 'text/plain' } });
      }

      const rateCheck = await checkRateLimit(env);
      if (rateCheck.locked) {
        return new Response(`Too many attempts. Try again in ${rateCheck.retryAfter}s.`, { status: 429, headers: { 'content-type': 'text/plain' } });
      }

      if (!password || password !== env.BLOG_PASSWORD) {
        await recordFailedAttempt(env);
        return new Response('Invalid password', { status: 401, headers: { 'content-type': 'text/plain' } });
      }
      await resetRateLimit(env);

      // Self-contained signed code — no R2 storage needed
      const code = await makeAuthCode(env.BLOG_PASSWORD, {
        redirect_uri, scope, me, expires: Date.now() + 5 * 60 * 1000,
      });

      const dest = new URL(redirect_uri);
      dest.searchParams.set('code', code);
      if (state) dest.searchParams.set('state', state);
      return Response.redirect(dest.toString(), 302);
    }
  }

  // Token verification — iA Writer GETs the token endpoint to verify an issued token
  if (slug === 'token' && request.method === 'GET') {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const expected = await getMicropubToken(env.BLOG_PASSWORD);
    if (!token || token !== expected) return json({ error: 'unauthorized' }, 401);
    return json({ me: 'https://jrbnz.com/', scope: 'create media', client_id: 'https://ia.net/writer' });
  }

  if (slug === 'token' && request.method === 'POST') {
    const ct = request.headers.get('Content-Type') || '';
    let grant_type, code, redirect_uri;
    if (ct.includes('application/json')) {
      ({ grant_type, code, redirect_uri } = await request.json().catch(() => ({})));
    } else {
      const body = await request.text().catch(() => '');
      const params = new URLSearchParams(body);
      grant_type = params.get('grant_type');
      code = params.get('code');
      redirect_uri = params.get('redirect_uri');
    }

    if (grant_type !== 'authorization_code') return json({ error: 'unsupported_grant_type' }, 400);
    if (!code) return json({ error: 'invalid_grant' }, 400);

    const codeData = await parseAuthCode(env.BLOG_PASSWORD, code);
    if (!codeData) return json({ error: 'invalid_grant' }, 400);
    if (Date.now() > codeData.expires) return json({ error: 'invalid_grant' }, 400);
    if (codeData.redirect_uri !== redirect_uri) return json({ error: 'invalid_grant' }, 400);

    const accessToken = await getMicropubToken(env.BLOG_PASSWORD);
    return json({
      access_token: accessToken,
      token_type: 'Bearer',
      scope: codeData.scope || 'create',
      me: 'https://jrbnz.com/',
      micropub: 'https://jrbnz.com/api/micropub',
    });
  }

  return json({ error: 'Not found' }, 404);
}

// ── Micropub media endpoint ───────────────────────────────────────────────────

async function handleMicropubMedia(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const expectedMedia = await getMicropubToken(env.BLOG_PASSWORD);
  if (!token || token !== expectedMedia) return json({ error: 'Unauthorized' }, 401);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || typeof file === 'string') return json({ error: 'file required' }, 400);

  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
  const key = `media/${Date.now()}-${safeName}`;
  await env.BLOG.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });

  const location = `https://jrbnz.com/${key}`;
  return new Response(null, { status: 202, headers: { Location: location } });
}

// ── Micropub ──────────────────────────────────────────────────────────────────

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function handleMicropub(request, env) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    if (q === 'syndicate-to') return json({ 'syndicate-to': [] });
    const linkHeaders = [
      '<https://jrbnz.com/api/indieauth/auth>; rel="authorization_endpoint"',
      '<https://jrbnz.com/api/indieauth/token>; rel="token_endpoint"',
    ].join(', ');
    return new Response(JSON.stringify({ 'media-endpoint': 'https://jrbnz.com/api/micropub/media', 'post-types': [{ type: 'h-entry', name: 'Post' }], 'syndicate-to': [] }), {
      headers: { 'content-type': 'application/json', 'Link': linkHeaders },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Bearer token auth — POST only
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const expectedToken = await getMicropubToken(env.BLOG_PASSWORD);
  if (!token || token !== expectedToken) return json({ error: 'Unauthorized' }, 401);

  // Parse body — iA Writer sends JSON
  let title = '';
  let content = '';
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    const props = body.properties || {};
    title = Array.isArray(props.name) ? props.name[0] : (props.name || '');
    content = Array.isArray(props.content) ? props.content[0] : (props.content || '');
  } else {
    const form = await request.formData().catch(() => new FormData());
    title = form.get('name') || form.get('title') || '';
    content = form.get('content') || '';
  }

  // Always prefer h1 from content as the title (iA Writer sends filename as name)
  if (content.match(/^#+ /)) {
    const firstLine = content.split('\n')[0];
    title = firstLine.replace(/^#+ /, '').trim();
    content = content.slice(firstLine.length).replace(/^\n+/, '');
  }

  if (!title) return json({ error: 'title (name) required' }, 400);

  // Generate unique slug
  const posts = await getIndex(env);
  let base = slugify(title);
  if (!base) base = `post-${Date.now()}`;
  let slug = base;
  let suffix = 2;
  while (posts.find(p => p.slug === slug)) {
    slug = `${base}-${suffix++}`;
  }

  // Create draft
  const now = new Date().toISOString();
  const entry = {
    slug,
    title,
    date: now.slice(0, 10),
    tags: [],
    status: 'draft',
    excerpt: '',
    coverImage: null,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    createdAt: now,
    updatedAt: now,
  };
  posts.push(entry);
  await saveIndex(env, posts);
  await env.BLOG.put(`posts/${slug}/draft.md`, content, { httpMetadata: { contentType: 'text/markdown' } });

  return new Response(null, {
    status: 202,
    headers: { Location: `https://jrbnz.com/signal/#post/${slug}` },
  });
}

// ── Accent handlers ───────────────────────────────────────────────────────────

async function handleGetAccent(env) {
  try {
    const obj = await env.BLOG.get('settings/accent.json');
    if (!obj) return json({ accent: null });
    return json(await obj.json());
  } catch {
    return json({ accent: null });
  }
}

async function handleSaveAccent(request, env) {
  const { accent, signalAccent } = await request.json().catch(() => ({}));
  if (!accent && !signalAccent) return json({ error: 'accent or signalAccent required' }, 400);

  // Merge with existing so the two fields are independent
  let existing = {};
  try {
    const obj = await env.BLOG.get('settings/accent.json');
    if (obj) existing = await obj.json();
  } catch {}

  const updated = { ...existing };
  if (accent && typeof accent === 'string') updated.accent = accent;
  if (signalAccent && typeof signalAccent === 'string') updated.signalAccent = signalAccent;

  await env.BLOG.put('settings/accent.json', JSON.stringify(updated), { httpMetadata: { contentType: 'application/json' } });

  // Only rebuild the public site when the live accent changed
  if (accent) await handleRebuildSite(env);

  return json(updated);
}

async function handleGetSnippets(env) {
  const obj = await env.BLOG.get('settings/snippets.json');
  if (!obj) return json([]);
  try { return json(await obj.json()); } catch { return json([]); }
}

async function handleSaveSnippets(request, env) {
  const snippets = await request.json().catch(() => null);
  if (!Array.isArray(snippets)) return json({ error: 'array required' }, 400);
  await env.BLOG.put('settings/snippets.json', JSON.stringify(snippets), { httpMetadata: { contentType: 'application/json' } });
  return json(snippets);
}

// ── Pages handlers ────────────────────────────────────────────────────────────

async function handleListPages(env) {
  return json(await getPagesIndex(env));
}

async function handleCreatePage(request, env) {
  const { title, slug, include_in_menu } = await request.json().catch(() => ({}));
  if (!title || !slug) return json({ error: 'title and slug required' }, 400);
  if (!isValidSlug(slug)) return json({ error: 'slug must be 1-80 lowercase letters, digits, or hyphens' }, 400);

  const pages = await getPagesIndex(env);
  if (pages.find(p => p.slug === slug)) return json({ error: 'slug already exists' }, 409);

  const page = {
    slug,
    title,
    include_in_menu: !!include_in_menu,
    status: 'draft',
    date: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  pages.push(page);
  await savePagesIndex(env, pages);
  await env.BLOG.put(`pages/${slug}/draft.md`, `# ${title}\n`, { httpMetadata: { contentType: 'text/markdown' } });
  return json(page);
}

async function handleGetPage(env, slug) {
  const pages = await getPagesIndex(env);
  const page = pages.find(p => p.slug === slug);
  if (!page) return json({ error: 'Not found' }, 404);
  const obj = await env.BLOG.get(`pages/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  return json({ ...page, body });
}

async function handleSavePage(request, env, slug) {
  const { title, body, include_in_menu, nav_url, wordCount } = await request.json().catch(() => ({}));
  const pages = await getPagesIndex(env);
  const idx = pages.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  if (title !== undefined) pages[idx].title = title;
  if (include_in_menu !== undefined) pages[idx].include_in_menu = !!include_in_menu;
  if (nav_url !== undefined) pages[idx].nav_url = nav_url || null;
  if (wordCount !== undefined) pages[idx].wordCount = wordCount;
  pages[idx].updatedAt = new Date().toISOString();
  if (pages[idx].status === 'published') pages[idx].hasDraftChanges = true;

  if (body !== undefined) {
    await env.BLOG.put(`pages/${slug}/draft.md`, body, { httpMetadata: { contentType: 'text/markdown' } });
  }
  await savePagesIndex(env, pages);
  return json(pages[idx]);
}

async function handleDeletePage(env, slug) {
  const pages = await getPagesIndex(env);
  const updated = pages.filter(p => p.slug !== slug);
  if (updated.length === pages.length) return json({ error: 'Not found' }, 404);

  const listed = await env.BLOG.list({ prefix: `pages/${slug}/` });
  await Promise.all(listed.objects.map(o => env.BLOG.delete(o.key)));

  await savePagesIndex(env, updated);
  return json({ ok: true });
}

async function handlePublishPage(env, slug) {
  const pages = await getPagesIndex(env);
  const idx = pages.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`pages/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  const contentHtml = mdToHtml(body);

  pages[idx].status = 'published';
  pages[idx].hasDraftChanges = false;
  pages[idx].updatedAt = new Date().toISOString();
  await savePagesIndex(env, pages);

  const { author, accent, snippetCss, defaultCoverImage, defaultCoverImageFocus } = await loadSiteContext(env);
  const menuPages = pages;
  const pageHtml = buildPageHtml({ ...pages[idx], contentHtml, menuPages, accent, snippetCss });
  await env.BLOG.put(`pages/${slug}/index.html`, pageHtml, { httpMetadata: { contentType: 'text/html' } });

  return json({ ...pages[idx], url: `/${slug}/`, needsRebuild: pages[idx].include_in_menu });
}

async function handleUnpublishPage(env, slug) {
  const pages = await getPagesIndex(env);
  const idx = pages.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  pages[idx].status = 'draft';
  pages[idx].updatedAt = new Date().toISOString();
  await env.BLOG.delete(`pages/${slug}/index.html`);
  await savePagesIndex(env, pages);
  return json(pages[idx]);
}

// ── Util ──────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
