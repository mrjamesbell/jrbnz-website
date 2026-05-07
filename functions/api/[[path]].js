// ── Auth ──────────────────────────────────────────────────────────────────────

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
    const ytMatch = line.match(/<!--\s*signal:youtube\s+id="([a-zA-Z0-9_-]{11})"\s*-->/);
    if (ytMatch) {
      out.push(`<div class="youtube-embed"><iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`);
      i++;
      continue;
    }

    // Signal image block
    if (line.trim() === '<!-- signal:image' || line.match(/<!--\s*signal:image\s/)) {
      while (i < lines.length && !lines[i].includes('<!-- /signal:image -->')) i++;
      i++;
      continue;
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
</head>
<body>`;


function buildPostHtml({ title, date, tags, contentHtml }) {
  const tagLinks = (tags || []).map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');
  const year = new Date().getFullYear();
  return `${SITE_HEAD(title)}
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/now/">Now</a></li>
    <li><a href="/photos/">Photos</a></li>
    <li><a href="/posts/" class="active">Blog</a></li>
  </ul>
</nav>
<header class="page-header"><h1>Blog</h1></header>
<section class="content-section">
  <h1 class="post-title">${esc(title)}</h1>
  <div class="post-meta">
    <time datetime="${esc(date)}">${fmtDate(date)}</time>
    ${tagLinks ? `<div class="post-tags">${tagLinks}</div>` : ''}
  </div>
  <div class="post-content">${contentHtml}</div>
  <a href="/posts/" class="all-posts-btn">← All posts</a>
</section>
<footer class="footer">
  <div class="footer-fineprint">&copy; <span class="footer-year">${year}</span> James Bell</div>
  <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
</footer>
</body>
</html>`;
}

function buildIndexHtml(posts) {
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = published.map(p => `
  <li class="post-list-item" data-tags="${esc((p.tags || []).join(','))}">
    <time>${fmtDateShort(p.date)}</time>
    <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
  </li>`).join('');

  const allTags = [...new Set(published.flatMap(p => p.tags || []))].sort();
  const tagLinks = allTags.map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');
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
<header class="page-header"><h1>Blog</h1></header>
<section class="content-section">
  ${published.length ? `<ul class="post-list">${items}</ul>` : '<p>No posts yet.</p>'}
  ${tagLinks ? `<div class="tags-footer">
    <div class="tag-filter-bar" id="tag-filter-bar" hidden>
      Posts tagged <strong id="tag-filter-label"></strong>
      <a href="/posts/" class="tag-filter-clear">× Show all</a>
    </div>
    ${tagLinks}
  </div>` : ''}
</section>
<script src="/scripts/blog.js"></script>
<footer class="footer">
  <div class="footer-fineprint">&copy; <span class="footer-year">${year}</span> James Bell</div>
  <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
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
  const html = buildPostHtml({ ...post, contentHtml });
  await env.BLOG.put(`posts/${slug}/index.html`, html, { httpMetadata: { contentType: 'text/html' } });
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
    if (!obj) return json({ name: 'James Bell', bio: '', headshotUrl: '' });
    return json(await obj.json());
  } catch {
    return json({ name: 'James Bell', bio: '', headshotUrl: '' });
  }
}

async function handleSaveAuthor(request, env) {
  const { name, bio, headshotUrl } = await request.json();
  const data = { name: name || '', bio: bio || '', headshotUrl: headshotUrl || '' };
  await env.BLOG.put('settings/author.json', JSON.stringify(data), { httpMetadata: { contentType: 'application/json' } });
  return json(data);
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
    ...uploaded.objects.map(o => toItem(o, `https://jrbnz-blog.r2.dev/${o.key}`)),
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
  posts[idx] = {
    ...posts[idx],
    title: data.title ?? posts[idx].title,
    date: data.date ?? posts[idx].date,
    tags: data.tags ?? posts[idx].tags,
    excerpt: data.excerpt ?? posts[idx].excerpt,
    coverImage: data.coverImage !== undefined ? data.coverImage : posts[idx].coverImage,
    wordCount: data.wordCount ?? posts[idx].wordCount,
    updatedAt: now,
    status: posts[idx].status === 'published' ? 'published' : 'draft',
  };

  let body = data.body ?? data.markdown ?? '';
  body = await migrateMediaToPost(env, slug, body);
  await env.BLOG.put(`posts/${slug}/draft.md`, body, { httpMetadata: { contentType: 'text/markdown' } });
  await saveIndex(env, posts);
  return json(posts[idx]);
}

async function handlePublish(env, slug) {
  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const body = obj ? await obj.text() : '';
  const contentHtml = mdToHtml(body);

  posts[idx].status = 'published';
  posts[idx].updatedAt = new Date().toISOString();

  const postHtml = buildPostHtml({ ...posts[idx], contentHtml });
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

  return json({ url: `https://jrbnz-blog.r2.dev/${key}`, filename });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
