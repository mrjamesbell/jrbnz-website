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

function authed(response, token) {
  response.headers.set('Set-Cookie', `blog_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`);
  return response;
}

// ── Templates ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

const HEAD = (title) => `<!DOCTYPE html>
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
<body>
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/now/">Now</a></li>
    <li><a href="/photos/">Photos</a></li>
    <li><a href="/posts/">Blog</a></li>
  </ul>
</nav>`;

const FOOT = `<footer class="footer">
<div class="footer-fineprint">&copy; ${new Date().getFullYear()} James Bell</div>
<div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
</footer>
</body></html>`;

function buildPostHtml({ title, date, tags, contentHtml }) {
  const tagLinks = (tags || []).map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');
  return `${HEAD(title)}
<header class="page-header"><h1>${esc(title)}</h1></header>
<section class="content-section">
  <div class="post-meta">
    <time datetime="${esc(date)}">${fmtDate(date)}</time>
    ${tagLinks ? `<div class="post-tags">${tagLinks}</div>` : ''}
  </div>
  <div class="post-content">${contentHtml}</div>
  <a href="/posts/" class="back-link">← All posts</a>
</section>
${FOOT}`;
}

function buildIndexHtml(posts) {
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = published.map(p => `
  <li class="post-list-item">
    <time>${fmtDateShort(p.date)}</time>
    <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
  </li>`).join('');

  const allTags = [...new Set(published.flatMap(p => p.tags || []))].sort();
  const tagLinks = allTags.map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');

  return `${HEAD('Blog')}
<header class="page-header"><h1>Blog</h1></header>
<section class="content-section">
  ${published.length ? `<ul class="post-list">${items}</ul>` : '<p>No posts yet.</p>'}
  ${tagLinks ? `<div class="tags-footer">${tagLinks}</div>` : ''}
</section>
${FOOT}`;
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

// ── Router ────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, params, env } = context;
  const method = request.method;
  const path = params.path || [];
  const [resource, slug, action] = path;

  // Login — no auth required
  if (resource === 'login' && method === 'POST') {
    return handleLogin(request, env);
  }

  // All other routes require auth
  const token = getSessionCookie(request);
  if (!token || !await verifySession(token, env.BLOG_PASSWORD)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // POST /api/upload
  if (resource === 'upload' && method === 'POST') return handleUpload(request, env, slug);

  if (resource === 'posts') {
    if (!slug) {
      if (method === 'GET') return handleListPosts(env);
      if (method === 'POST') return handleCreatePost(request, env);
    } else if (!action) {
      if (method === 'GET') return handleGetPost(env, slug);
      if (method === 'PUT') return handleSaveDraft(request, env, slug);
      if (method === 'DELETE') return handleDeletePost(env, slug);
    } else {
      if (action === 'publish' && method === 'POST') return handlePublish(request, env, slug);
      if (action === 'unpublish' && method === 'POST') return handleUnpublish(env, slug);
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleLogin(request, env) {
  const { password } = await request.json();
  if (!password || password !== env.BLOG_PASSWORD) {
    return json({ error: 'Invalid password' }, 401);
  }
  const token = await createSession(env.BLOG_PASSWORD);
  const res = json({ ok: true });
  return authed(res, token);
}

async function handleListPosts(env) {
  const posts = await getIndex(env);
  return json(posts);
}

async function handleCreatePost(request, env) {
  const { title, slug, date, tags } = await request.json();
  if (!title || !slug) return json({ error: 'title and slug required' }, 400);

  const posts = await getIndex(env);
  if (posts.find(p => p.slug === slug)) return json({ error: 'slug already exists' }, 409);

  const entry = { slug, title, date: date || new Date().toISOString().slice(0, 10), tags: tags || [], status: 'draft' };
  posts.push(entry);
  await saveIndex(env, posts);
  await env.BLOG.put(`posts/${slug}/draft.md`, `# ${title}\n\n`, { httpMetadata: { contentType: 'text/markdown' } });

  return json(entry, 201);
}

async function handleGetPost(env, slug) {
  const posts = await getIndex(env);
  const meta = posts.find(p => p.slug === slug);
  if (!meta) return json({ error: 'Not found' }, 404);

  const obj = await env.BLOG.get(`posts/${slug}/draft.md`);
  const markdown = obj ? await obj.text() : '';
  return json({ ...meta, markdown });
}

async function handleSaveDraft(request, env, slug) {
  const { title, date, tags, markdown } = await request.json();
  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  posts[idx] = {
    ...posts[idx],
    title: title ?? posts[idx].title,
    date: date ?? posts[idx].date,
    tags: tags ?? posts[idx].tags,
    status: posts[idx].status === 'published' ? 'edited' : posts[idx].status,
  };

  await env.BLOG.put(`posts/${slug}/draft.md`, markdown ?? '', { httpMetadata: { contentType: 'text/markdown' } });
  await saveIndex(env, posts);
  return json(posts[idx]);
}

async function handlePublish(request, env, slug) {
  const { contentHtml } = await request.json();
  if (!contentHtml) return json({ error: 'contentHtml required' }, 400);

  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  posts[idx].status = 'published';

  const postHtml = buildPostHtml({ ...posts[idx], contentHtml });
  await env.BLOG.put(`posts/${slug}/index.html`, postHtml, { httpMetadata: { contentType: 'text/html' } });
  await saveIndex(env, posts);
  await rebuildIndexHtml(env, posts);

  return json(posts[idx]);
}

async function handleUnpublish(env, slug) {
  const posts = await getIndex(env);
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) return json({ error: 'Not found' }, 404);

  posts[idx].status = 'draft';
  await env.BLOG.delete(`posts/${slug}/index.html`);
  await saveIndex(env, posts);
  await rebuildIndexHtml(env, posts);

  return json(posts[idx]);
}

async function handleDeletePost(env, slug) {
  const posts = await getIndex(env);
  const updated = posts.filter(p => p.slug !== slug);
  if (updated.length === posts.length) return json({ error: 'Not found' }, 404);

  // Delete all R2 objects for this post
  const listed = await env.BLOG.list({ prefix: `posts/${slug}/` });
  await Promise.all(listed.objects.map(o => env.BLOG.delete(o.key)));

  await saveIndex(env, updated);
  await rebuildIndexHtml(env, updated);
  return json({ ok: true });
}

async function handleUpload(request, env, slug) {
  if (!slug) return json({ error: 'slug required' }, 400);
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return json({ error: 'file required' }, 400);

  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, '_')}`;
  const key = `posts/media/${slug}/${filename}`;

  await env.BLOG.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });

  return json({ url: `/posts/media/${slug}/${filename}`, filename });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  });
}
