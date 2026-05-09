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

// ── Markdown renderer ─────────────────────────────────────────────────────────

function mdEsc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mdInline(str) {
  return str
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${mdEsc(alt)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${href}">${mdEsc(text)}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // YouTube signal block
    const ytMatch = line.match(/<!--\s*signal:youtube\s+id="([a-zA-Z0-9_-]{11})"(?:\s+width="([^"]*)")?(?:\s+align="([^"]*)")?\s*-->/);
    if (ytMatch) {
      const ytId = ytMatch[1];
      const rawWidth = ytMatch[2] || '100';
      const ytAlign = ['left', 'center', 'right'].includes(ytMatch[3]) ? ytMatch[3] : 'center';
      const isBreakout = rawWidth === 'wide' || rawWidth === 'full';
      const ytPct = isBreakout ? '100' : String(Math.max(20, Math.min(100, parseInt(rawWidth, 10) || 100)));
      const wrapStyle = isBreakout
        ? 'width:100%;'
        : (ytAlign === 'center' ? `width:${ytPct}%;margin-left:auto;margin-right:auto;` : ytAlign === 'right' ? `width:${ytPct}%;margin-left:auto;` : `width:${ytPct}%;`);
      out.push(`<div class="youtube-embed" style="${wrapStyle}"><div style="position:relative;padding-top:56.25%;"><iframe style="position:absolute;inset:0;width:100%;height:100%;border:none;" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen loading="lazy"></iframe></div></div>`);
      i++;
      continue;
    }

    // Signal image block — single-line: <!-- signal:image src="..." alt="..." layout="..." width="..." -->
    if (line.match(/<!--\s*signal:image\b.*?-->/)) {
      const srcM = line.match(/src="([^"]*)"/);
      const altM = line.match(/alt="([^"]*)"/);
      const layoutM = line.match(/layout="([^"]*)"/);
      const widthM = line.match(/width="(\d+)"/);
      const src = mdEsc(srcM?.[1] || '');
      const alt = mdEsc(altM?.[1] || '');
      const layout = layoutM?.[1] || 'full';
      const cls = { left: 'leftalign', right: 'rightalign', centre: 'img-centre' }[layout] || '';
      const isFloat = cls === 'leftalign' || cls === 'rightalign';
      const w = widthM ? parseInt(widthM[1], 10) : 100;
      const styleStr = w < 100
        ? ` style="max-width:${w}%${isFloat ? '' : ';display:block;margin-left:auto;margin-right:auto'}"`
        : '';
      if (src) out.push(`<img src="${src}" alt="${alt}"${cls ? ` class="${cls}"` : ''}${styleStr} loading="lazy">`);
      i++; continue;
    }
    // Old multi-line signal:image blocks (skip)
    if (line.match(/<!--\s*signal:image\b/) && !line.includes('-->')) {
      while (i < lines.length && !lines[i].includes('-->')) i++;
      i++; continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(mdEsc(lines[i])); i++; }
      out.push(`<pre><code${lang ? ` class="language-${mdEsc(lang)}"` : ''}>${code.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    const hm = line.match(/^(#{1,4})\s+(.*)/);
    if (hm) { out.push(`<h${hm[1].length}>${mdInline(hm[2])}</h${hm[1].length}>`); i++; continue; }

    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) { quoteLines.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote><p>${quoteLines.map(mdInline).join(' ')}</p></blockquote>`);
      continue;
    }

    if (line.match(/^[-*]\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) { items.push(`<li>${mdInline(lines[i].slice(2))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(`<li>${mdInline(lines[i].replace(/^\d+\.\s/, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) { out.push('<hr>'); i++; continue; }

    if (line.match(/^<[a-zA-Z]/)) {
      const htmlLines = [];
      while (i < lines.length && lines[i].trim() !== '') { htmlLines.push(lines[i]); i++; }
      out.push(htmlLines.join('\n'));
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,4}\s|[-*]\s|\d+\.\s|```|>|<[a-zA-Z]|---+|\*\*\*+|<!--)/)
    ) { paraLines.push(lines[i]); i++; }
    if (paraLines.length) out.push(`<p>${paraLines.map(mdInline).join(' ')}</p>`);
  }

  return out.join('\n');
}

// ── HTML templates ────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

const SITE_HEAD = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)} - James Bell</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/main.css">
<link rel="stylesheet" href="/styles/blog.css">
<link rel="alternate" type="application/rss+xml" title="James Bell" href="/feed.xml">
<link rel="micropub" href="/api/micropub">
</head>
<body>`;


function buildAuthorCard(author) {
  if (!author || !author.name) return '';
  const threadsUrl = author.threads
    ? (author.threads.startsWith('http') ? author.threads : `https://threads.net/${author.threads.replace('@', '')}`)
    : '';
  const instagramUrl = author.instagram
    ? (author.instagram.startsWith('http') ? author.instagram : `https://instagram.com/${author.instagram.replace('@', '')}`)
    : '';
  const linkedinUrl = author.linkedin
    ? (author.linkedin.startsWith('http') ? author.linkedin : `https://linkedin.com/in/${author.linkedin}`)
    : '';
  const flickrUrl = author.flickr
    ? (author.flickr.startsWith('http') ? author.flickr : `https://flickr.com/photos/${author.flickr}`)
    : '';
  const socials = [
    threadsUrl && `<a href="${esc(threadsUrl)}" class="social-link" rel="noopener noreferrer" target="_blank">Threads</a>`,
    instagramUrl && `<a href="${esc(instagramUrl)}" class="social-link" rel="noopener noreferrer" target="_blank">Instagram</a>`,
    linkedinUrl && `<a href="${esc(linkedinUrl)}" class="social-link" rel="noopener noreferrer" target="_blank">LinkedIn</a>`,
    flickrUrl && `<a href="${esc(flickrUrl)}" class="social-link" rel="noopener noreferrer" target="_blank">Flickr</a>`,
  ].filter(Boolean).join('\n      ');
  return `<div class="sidebar-block">
  <div class="sidebar-label">Author</div>
  <div class="sidebar-author">
    ${author.headshotUrl ? `<img class="sidebar-avatar" src="${esc(author.headshotUrl)}" alt="${esc(author.name)}">` : ''}
    <div>
      <div class="sidebar-author-name">${esc(author.name)}</div>
      ${author.bio ? `<div class="sidebar-author-bio">${esc(author.bio)}</div>` : ''}
      ${socials ? `<div class="sidebar-social">${socials}</div>` : ''}
    </div>
  </div>
</div>`;
}

function buildPostHtml({ title, date, tags, contentHtml, author }) {
  const mastheadTags = (tags || []).map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');
  const sidebarTags = (tags || []).map(t => `<a href="/posts/?tag=${esc(t)}" class="sidebar-tag">#${esc(t)}</a>`).join('\n          ');
  const year = new Date().getFullYear();
  const authorBlock = buildAuthorCard(author);
  return `${SITE_HEAD(title)}
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/now/">Now</a></li>
    <li><a href="/photos/">Photos</a></li>
    <li><a href="/posts/" class="active">Blog</a></li>
  </ul>
</nav>
<header class="post-masthead">
  <div class="post-masthead-inner">
    <h1 class="post-masthead-title">${esc(title)}</h1>
    <div class="post-masthead-meta">
      <time class="post-masthead-date" datetime="${esc(date)}">${fmtDate(date)}</time>
      ${mastheadTags ? `<div class="post-masthead-tags">${mastheadTags}</div>` : ''}
    </div>
  </div>
</header>
<section class="content-section">
  <div class="post-layout">
    <div>
      <div class="post-content">${contentHtml}</div>
      <a href="/posts/" class="back-to-posts">← All posts</a>
    </div>
    <aside class="post-sidebar">
      <div class="sidebar-block">
        <div class="sidebar-label">Published</div>
        <time class="sidebar-date" datetime="${esc(date)}">${fmtDate(date)}</time>
      </div>
      ${sidebarTags ? `<div class="sidebar-block">
        <div class="sidebar-label">Tags</div>
        <div class="sidebar-tags">
          ${sidebarTags}
        </div>
      </div>` : ''}
      ${authorBlock}
    </aside>
  </div>
</section>
<footer class="footer">
  <div class="footer-left">
    <a href="/" class="footer-logo">JRBNZ</a>
    <div class="footer-fineprint">&copy; <span class="footer-year">${year}</span> James Bell</div>
    <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
  </div>
  <div class="footer-right">
    <nav class="footer-nav">
      <a href="/now/">Now</a>
      <a href="/photos/">Photos</a>
      <a href="/posts/">Blog</a>
    </nav>
    <a href="/feed.xml" class="footer-rss">
      <svg class="footer-rss-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/></svg>
      RSS Feed
    </a>
  </div>
</footer>
</body>
</html>`;
}

function buildIndexHtml(posts) {
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = published.map(p => {
    const tagsText = (p.tags || []).map(t => `#${esc(t)}`).join(' · ');
    return `
  <li class="post-list-item" data-tags="${esc((p.tags || []).join(','))}">
    <time>${fmtDateShort(p.date)}</time>
    <div>
      <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
      ${tagsText ? `<div class="post-item-tags">${tagsText}</div>` : ''}
    </div>
  </li>`;
  }).join('');

  const allTags = [...new Set(published.flatMap(p => p.tags || []))].sort();
  const tagChips = allTags.map(t => `<a href="/posts/?tag=${esc(t)}" class="tag-chip">#${esc(t)}</a>`).join('\n    ');
  const year = new Date().getFullYear();

  return `${SITE_HEAD('Blog - James Bell')}
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/now/">Now</a></li>
    <li><a href="/photos/">Photos</a></li>
    <li><a href="/posts/" class="active">Blog</a></li>
  </ul>
</nav>
<header class="index-masthead">
  <h1 class="index-masthead-title">Blog</h1>
</header>
<section class="content-section">
  <div class="post-list-wrap">
    ${published.length ? `<ul class="post-list">${items}</ul>` : '<p>No posts yet.</p>'}
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
<footer class="footer">
  <div class="footer-left">
    <a href="/" class="footer-logo">JRBNZ</a>
    <div class="footer-fineprint">&copy; <span class="footer-year">${year}</span> James Bell</div>
    <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
  </div>
  <div class="footer-right">
    <nav class="footer-nav">
      <a href="/now/">Now</a>
      <a href="/photos/">Photos</a>
      <a href="/posts/">Blog</a>
    </nav>
    <a href="/feed.xml" class="footer-rss">
      <svg class="footer-rss-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/></svg>
      RSS Feed
    </a>
  </div>
</footer>
</body></html>`;
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
  const html = buildIndexHtml(posts);
  await env.BLOG.put('posts/index.html', html, { httpMetadata: { contentType: 'text/html' } });
}

async function rebuildPostHtml(env, slug, posts) {
  const post = posts.find(p => p.slug === slug);
  if (!post || post.status !== 'published') return;

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  const contentHtml = mdToHtml(body);
  const authorObj = await env.BLOG.get('settings/author.json');
  const author = authorObj ? JSON.parse(await authorObj.text()) : {};
  const html = buildPostHtml({ ...post, contentHtml, author });
  await env.BLOG.put(`posts/${slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, params, env } = context;
  const method = request.method;
  const path = params.path || [];
  const [resource, slug, action] = path;

  // Catch-all request log for debugging — append to a rolling list in R2
  try {
    const logKey = 'auth/debug-requests.json';
    const existing = await env.BLOG.get(logKey);
    const log = existing ? JSON.parse(await existing.text()) : [];
    log.push({
      ts: new Date().toISOString(),
      method,
      path: '/' + path.join('/'),
      auth: (request.headers.get('Authorization') || '').slice(0, 30),
      ua: (request.headers.get('User-Agent') || '').slice(0, 60),
    });
    if (log.length > 20) log.splice(0, log.length - 20);
    await env.BLOG.put(logKey, JSON.stringify(log), { httpMetadata: { contentType: 'application/json' } });
  } catch {}

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

  // Debug — public, temporary
  if (resource === 'debug-indieauth' && method === 'GET') {
    const [tokenPost, tokenGet, micropub, authGet, requests] = await Promise.all([
      env.BLOG.get('auth/debug-token.json'),
      env.BLOG.get('auth/debug-token-get.json'),
      env.BLOG.get('auth/debug-micropub.json'),
      env.BLOG.get('auth/debug-indieauth-get.json'),
      env.BLOG.get('auth/debug-requests.json'),
    ]);
    return json({
      tokenPost: tokenPost ? JSON.parse(await tokenPost.text()) : null,
      tokenGet: tokenGet ? JSON.parse(await tokenGet.text()) : null,
      micropub: micropub ? JSON.parse(await micropub.text()) : null,
      authGet: authGet ? JSON.parse(await authGet.text()) : null,
      requests: requests ? JSON.parse(await requests.text()) : null,
    });
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

  // Site rebuild
  if (resource === 'site' && slug === 'rebuild' && method === 'POST') return handleRebuildSite(env);

  // Media
  if (resource === 'media') {
    if (!slug) {
      if (method === 'GET') return handleListMedia(env);
    } else if (slug === 'presign') {
      if (method === 'POST') return handlePresignMedia(request, env);
    } else if (slug === 'upload' && action && method === 'PUT') {
      const key = decodeURIComponent(action);
      const ct = request.headers.get('Content-Type') || 'application/octet-stream';
      await env.BLOG.put(key, request.body, { httpMetadata: { contentType: ct } });
      return new Response(null, { status: 200 });
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
      if (action === 'publish' && method === 'POST') return handlePublish(env, slug);
      if (action === 'unpublish' && method === 'POST') return handleUnpublish(env, slug);
      if (action === 'rename' && method === 'POST') return handleRename(request, env, slug);
      if (action === 'review' && method === 'POST') return handleReviewPost(env, slug);
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
  const posts = await getIndex(env);
  const authorObj = await env.BLOG.get('settings/author.json');
  const author = authorObj ? JSON.parse(await authorObj.text()) : {};
  const published = posts.filter(p => p.status === 'published');
  await Promise.all(published.map(async post => {
    const obj = await env.BLOG.get(`posts/${post.slug}/draft.md`);
    const body = obj ? await obj.text() : '';
    const contentHtml = mdToHtml(body);
    const html = buildPostHtml({ ...post, contentHtml, author });
    await env.BLOG.put(`posts/${post.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });
  }));
  await rebuildIndexHtml(env, posts);
  return json({ rebuilt: published.length });
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
  ];

  return json(items);
}

async function handlePresignMedia(request, env) {
  const { filename, contentType } = await request.json();
  if (!filename) return json({ error: 'filename required' }, 400);

  const ext = filename.split('.').pop().toLowerCase() || 'jpg';
  const key = `media/${Date.now()}-${filename.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()}`;

  // Upload directly through the Worker (proxy upload)
  // Return a worker-proxied URL so the client uploads to /api/media/upload/:key
  const uploadUrl = `/api/media/upload/${encodeURIComponent(key)}`;
  const publicUrl = `/${key}`;
  return json({ uploadUrl, publicUrl, key });
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

  const posts = await getIndex(env);
  if (posts.find(p => p.slug === slug)) return json({ error: 'slug already exists' }, 409);

  const now = new Date().toISOString();
  const entry = {
    slug,
    title,
    date: date || now.slice(0, 10),
    tags: tags || [],
    status: 'draft',
    excerpt: '',
    coverImage: null,
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
    excerpt: data.excerpt ?? posts[idx].excerpt,
    coverImage: data.coverImage !== undefined ? data.coverImage : posts[idx].coverImage,
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

async function handlePublish(env, slug) {
  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  const contentHtml = mdToHtml(body);

  posts[idx].status = 'published';
  posts[idx].hasDraftChanges = false;
  posts[idx].updatedAt = new Date().toISOString();

  const authorObj = await env.BLOG.get('settings/author.json');
  const author = authorObj ? JSON.parse(await authorObj.text()) : {};

  const postHtml = buildPostHtml({ ...posts[idx], contentHtml, author });
  await env.BLOG.put(`posts/${slug}/index.html`, postHtml, { httpMetadata: { contentType: 'text/html' } });
  await saveIndex(env, posts);
  await rebuildIndexHtml(env, posts);

  return json({ ...posts[idx], url: `/posts/${slug}/` });
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
      await env.BLOG.put('auth/debug-indieauth-get.json', JSON.stringify({
        ts: new Date().toISOString(), params,
      }), { httpMetadata: { contentType: 'application/json' } }).catch(() => {});
      return new Response(INDIEAUTH_PAGE(params), { headers: { 'content-type': 'text/html' } });
    }
    if (request.method === 'POST') {
      const form = await request.formData().catch(() => new FormData());
      const password = form.get('password');
      const redirect_uri = form.get('redirect_uri');
      const state = form.get('state') || '';
      const scope = form.get('scope') || 'create';
      const me = form.get('me') || 'https://jrbnz.com';

      if (!password || password !== env.BLOG_PASSWORD) {
        return new Response('Invalid password', { status: 401, headers: { 'content-type': 'text/plain' } });
      }
      if (!redirect_uri) return new Response('redirect_uri required', { status: 400, headers: { 'content-type': 'text/plain' } });

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
    const tokenMatch = !!token && token === expected;
    await env.BLOG.put('auth/debug-token-get.json', JSON.stringify({
      ts: new Date().toISOString(), hasAuth: !!auth, tokenMatch,
    }), { httpMetadata: { contentType: 'application/json' } }).catch(() => {});
    if (!tokenMatch) return json({ error: 'unauthorized' }, 401);
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
    const debug = {
      ts: new Date().toISOString(), ct, grant_type, redirect_uri,
      code_prefix: code.slice(0, 12),
      parsed: !!codeData,
      redirect_match: codeData ? codeData.redirect_uri === redirect_uri : null,
      expired: codeData ? Date.now() > codeData.expires : null,
    };
    await env.BLOG.put('auth/debug-token.json', JSON.stringify(debug), { httpMetadata: { contentType: 'application/json' } }).catch(() => {});

    if (!codeData) return json({ error: 'invalid_grant' }, 400);
    if (Date.now() > codeData.expires) return json({ error: 'invalid_grant' }, 400);
    if (codeData.redirect_uri !== redirect_uri) return json({ error: 'invalid_grant' }, 400);

    const accessToken = await getMicropubToken(env.BLOG_PASSWORD);
    const me = codeData.me || 'https://jrbnz.com';
    const tokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      scope: codeData.scope || 'create',
      me,
      micropub: 'https://jrbnz.com/api/micropub',
    };
    debug.response = { me, scope: tokenResponse.scope, hasToken: !!accessToken };
    await env.BLOG.put('auth/debug-token.json', JSON.stringify(debug), { httpMetadata: { contentType: 'application/json' } }).catch(() => {});
    return json(tokenResponse);
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
    await env.BLOG.put('auth/debug-micropub.json', JSON.stringify({
      ts: new Date().toISOString(), q,
      ua: request.headers.get('User-Agent') || '',
    }), { httpMetadata: { contentType: 'application/json' } }).catch(() => {});
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

  // Parse body — iA Writer sends JSON or form-encoded
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

// ── Util ──────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
