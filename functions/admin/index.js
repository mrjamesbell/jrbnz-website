export async function onRequestGet() {
  return new Response(ADMIN_HTML, { headers: { 'content-type': 'text/html;charset=utf-8' } });
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Blog Admin</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #14141f;
  --surface: #1d1d2e;
  --accent: #e07a38;
  --text: #f0ede8;
  --muted: rgba(240,237,232,0.42);
  --border: rgba(240,237,232,0.08);
  --draft: #5878a0;
  --published: #3d8a5c;
  --edited: #b08c30;
  --danger: #b84444;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; }

#app { display: flex; flex-direction: column; min-height: 100vh; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: 0; z-index: 10; }
.topbar-title { font-size: 17px; font-weight: 600; letter-spacing: 0.01em; }
.topbar-actions { display: flex; gap: 8px; }
.main { flex: 1; padding: 28px 20px; max-width: 800px; margin: 0 auto; width: 100%; }

/* ── Buttons ── */
button, .btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
  border: none; border-radius: var(--radius); font-family: var(--font); font-size: 14px;
  font-weight: 600; cursor: pointer; transition: opacity .15s, transform .08s; text-decoration: none; white-space: nowrap;
}
button:hover, .btn:hover { opacity: 0.82; }
button:active, .btn:active { transform: translateY(1px); opacity: 0.9; }
button:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: rgba(240,237,232,0.08); color: var(--text); border: 1px solid var(--border); }
.btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-publish { background: var(--published); color: #fff; }
.btn-sm { padding: 6px 12px; font-size: 13px; }

/* ── Forms ── */
.field { margin-bottom: 20px; }
label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; font-weight: 500; }
input[type=text], input[type=date], input[type=password], textarea, select {
  width: 100%; padding: 10px 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text); font-family: var(--font); font-size: 15px;
}
input:focus, textarea:focus { outline: none; border-color: rgba(224,122,56,0.55); }
.row { display: flex; gap: 12px; }
.row .field { flex: 1; }

/* ── Login ── */
#login-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-card { background: var(--surface); border-radius: 12px; padding: 40px 32px; width: 100%; max-width: 360px; }
.login-card h1 { font-size: 26px; margin-bottom: 4px; }
.login-card p { color: var(--muted); margin-bottom: 28px; font-size: 14px; }
.login-error { color: var(--danger); font-size: 13px; margin-top: 10px; display: none; }
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
.login-card.shake { animation: shake 0.32s ease; }

/* ── Post list ── */
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
.list-header h2 { font-size: 20px; font-weight: 600; }
.post-list { display: flex; flex-direction: column; gap: 1px; background: var(--border); border-radius: var(--radius); overflow: hidden; }
.post-item { background: var(--surface); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; transition: background .12s; }
.post-item:hover { background: rgba(240,237,232,0.04); }
.post-item:active { background: rgba(240,237,232,0.06); }
.post-item-info { flex: 1; min-width: 0; }
.post-item-title { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.post-item-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
.badge { display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 11px; font-weight: 500; letter-spacing: 0.02em; flex-shrink: 0; }
.badge-draft { background: rgba(88,120,160,0.18); color: #8aade0; }
.badge-published { background: rgba(61,138,92,0.18); color: #6dc496; }
.badge-edited { background: rgba(176,140,48,0.18); color: #d4b55a; }
.empty-state { padding: 56px 16px 48px; text-align: center; }
.empty-state-title { font-size: 17px; font-weight: 500; margin-bottom: 6px; }
.empty-state-sub { font-size: 14px; color: var(--muted); margin-bottom: 24px; }

/* ── Editor ── */
.editor-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.editor-header h2 { flex: 1; font-size: 19px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor-actions { display: flex; gap: 8px; flex-wrap: wrap; }
textarea#content { min-height: 360px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; resize: vertical; }
.toolbar { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
.toolbar button { padding: 5px 10px; font-size: 13px; background: rgba(240,237,232,0.06); color: var(--text); border-radius: 4px; border: 1px solid var(--border); }
.tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
.tab { padding: 8px 16px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; border-radius: 0; border: none; }
.tab.active { color: var(--text); border-bottom-color: var(--accent); }
.preview { background: var(--surface); border-radius: var(--radius); padding: 20px; min-height: 200px; }
.preview h1,.preview h2,.preview h3 { margin: 1.2em 0 0.5em; }
.preview p { margin-bottom: 1em; line-height: 1.7; }
.preview img { max-width: 100%; border-radius: 4px; margin: 1em 0; }
.preview a { color: var(--accent); }
.preview code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 3px; font-family: monospace; }
.preview pre { background: rgba(0,0,0,0.3); padding: 16px; border-radius: var(--radius); overflow-x: auto; margin: 1em 0; }
.preview blockquote { border-left: 3px solid rgba(224,122,56,0.4); padding-left: 16px; color: var(--muted); margin: 1em 0; }
.preview ul, .preview ol { padding-left: 24px; margin-bottom: 1em; }
.preview li { margin-bottom: 0.3em; line-height: 1.7; }
.danger-zone { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.danger-zone span { font-size: 13px; color: var(--muted); flex: 1; }
.status-bar { padding: 8px 0; font-size: 13px; color: var(--muted); min-height: 28px; transition: color 0.2s; }
.status-bar.ok { color: var(--published); }
.status-bar.err { color: var(--danger); }
.upload-progress { font-size: 13px; color: var(--muted); padding: 4px 0; }

@media (max-width: 600px) {
  .main { padding: 20px 16px; }
  .row { flex-direction: column; gap: 0; }
  .editor-actions { width: 100%; }
  .editor-actions button { flex: 1; justify-content: center; }
  .danger-zone { flex-direction: column; }
  .danger-zone span { flex: none; }
  textarea#content { min-height: 50vh; }
}
</style>
</head>
<body>
<div id="app">
  <div id="login-screen" style="display:none">
    <div class="login-card">
      <h1>jrbnz.com</h1>
      <p>Admin</p>
      <div class="field">
        <label>Password</label>
        <input type="password" id="login-password" placeholder="Enter password" autocomplete="current-password">
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="login()">Sign in</button>
      <div class="login-error" id="login-error">Incorrect password.</div>
    </div>
  </div>

  <div id="main-screen" style="display:none">
    <div class="topbar">
      <span class="topbar-title">jrbnz.com</span>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="showList()">← Posts</button>
        <a href="/posts/" class="btn btn-ghost btn-sm" target="_blank">View blog ↗</a>
      </div>
    </div>
    <div class="main" id="view"></div>
  </div>
</div>

<script>
const API = '/api';
let currentSlug = null;
let saveTimer = null;
let lastSavedContent = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const ok = await checkAuth();
  if (!ok) {
    document.getElementById('login-screen').style.display = 'flex';
  } else {
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('main-screen').style.flexDirection = 'column';
    showList();
  }
}

async function checkAuth() {
  const r = await fetch(API + '/posts');
  return r.ok;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login() {
  const pw = document.getElementById('login-password').value;
  const r = await fetch(API + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
  if (r.ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('main-screen').style.flexDirection = 'column';
    showList();
  } else {
    const card = document.querySelector('.login-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    document.getElementById('login-error').style.display = 'block';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') login();
});

// ── Post list ─────────────────────────────────────────────────────────────────

async function showList() {
  currentSlug = null;
  clearSaveTimer();
  const view = document.getElementById('view');
  view.innerHTML = '<p style="color:var(--muted);padding:20px 0">Loading…</p>';
  const posts = await fetch(API + '/posts').then(r => r.json());
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  view.innerHTML = \`
    <div class="list-header">
      <h2>Posts</h2>
      <button class="btn btn-primary btn-sm" onclick="showNew()">+ New post</button>
    </div>
    \${posts.length === 0
      ? \`<div class="empty-state">
          <div class="empty-state-title">Nothing written yet.</div>
          <div class="empty-state-sub">Ready when you are.</div>
          <button class="btn btn-primary" onclick="showNew()">Start writing</button>
        </div>\`
      : \`<div class="post-list">\${posts.map(postItem).join('')}</div>\`
    }
  \`;
}

function postItem(p) {
  const badge = \`<span class="badge badge-\${p.status}">\${p.status}</span>\`;
  return \`<div class="post-item" onclick="showEditor('\${p.slug}')">
    <div class="post-item-info">
      <div class="post-item-title">\${esc(p.title)}</div>
      <div class="post-item-meta">\${p.date}\${p.tags?.length ? ' \xb7 ' + p.tags.map(t => '#'+t).join(' ') : ''}</div>
    </div>
    \${badge}
  </div>\`;
}

// ── New post ──────────────────────────────────────────────────────────────────

function showNew() {
  const view = document.getElementById('view');
  view.innerHTML = \`
    <div class="editor-header">
      <h2>New post</h2>
    </div>
    <div class="field"><label>Title</label><input type="text" id="new-title" placeholder="Post title" oninput="autoSlug()"></div>
    <div class="row">
      <div class="field"><label>Slug</label><input type="text" id="new-slug" placeholder="post-slug"></div>
      <div class="field"><label>Date</label><input type="date" id="new-date" value="\${today()}"></div>
    </div>
    <div class="field"><label>Tags (comma separated)</label><input type="text" id="new-tags" placeholder="tech, writing"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary" onclick="createPost()">Create post</button>
      <button class="btn btn-ghost" onclick="showList()">Cancel</button>
    </div>
    <div class="status-bar" id="new-status"></div>
  \`;
  document.getElementById('new-title').focus();
}

function autoSlug() {
  const title = document.getElementById('new-title').value;
  document.getElementById('new-slug').value = slugify(title);
}

async function createPost() {
  const title = document.getElementById('new-title').value.trim();
  const slug = document.getElementById('new-slug').value.trim();
  const date = document.getElementById('new-date').value;
  const tags = parseTags(document.getElementById('new-tags').value);
  if (!title || !slug) { setStatus('new-status', 'Title and slug required', true); return; }

  const r = await fetch(API + '/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, slug, date, tags }) });
  if (r.ok) { showEditor(slug); } else { const e = await r.json(); setStatus('new-status', e.error || 'Error', true); }
}

// ── Editor ────────────────────────────────────────────────────────────────────

async function showEditor(slug) {
  currentSlug = slug;
  clearSaveTimer();
  const view = document.getElementById('view');
  view.innerHTML = '<p style="color:var(--muted);padding:20px 0">Loading…</p>';

  const post = await fetch(API + '/posts/' + slug).then(r => r.json());
  lastSavedContent = post.markdown || '';

  view.innerHTML = \`
    <div class="editor-header">
      <h2>\${esc(post.title)}</h2>
      <div class="editor-actions">
        <button class="btn btn-secondary btn-sm" onclick="saveDraft()">Save</button>
        \${post.status !== 'published' && post.status !== 'edited'
          ? '<button class="btn btn-publish btn-sm" onclick="publish()">Publish</button>'
          : '<button class="btn btn-publish btn-sm" onclick="publish()">Update &amp; publish</button>'
        }
      </div>
    </div>
    <div class="field"><label>Title</label><input type="text" id="ed-title" value="\${esc(post.title)}"></div>
    <div class="row">
      <div class="field"><label>Slug</label><input type="text" id="ed-slug" value="\${esc(post.slug)}" readonly style="opacity:.5;cursor:not-allowed"></div>
      <div class="field"><label>Date</label><input type="date" id="ed-date" value="\${post.date}"></div>
    </div>
    <div class="field"><label>Tags (comma separated)</label><input type="text" id="ed-tags" value="\${(post.tags||[]).join(', ')}"></div>
    <div class="tabs">
      <button class="tab active" id="tab-write" onclick="switchTab('write')">Write</button>
      <button class="tab" id="tab-preview" onclick="switchTab('preview')">Preview</button>
    </div>
    <div id="panel-write">
      <div class="toolbar">
        <button onclick="wrap('**','**')" title="Bold"><b>B</b></button>
        <button onclick="wrap('*','*')" title="Italic"><i>I</i></button>
        <button onclick="wrap('[','](url)')" title="Link">Link</button>
        <button onclick="insertHeading()" title="Heading">H</button>
        <button onclick="insertImage()" title="Upload image">Image</button>
      </div>
      <textarea id="content" spellcheck="true" placeholder="Write in markdown…" oninput="scheduleAutosave()">\${esc(post.markdown || '')}</textarea>
      <input type="file" id="file-input" accept="image/*" style="display:none" onchange="uploadImage(this)">
      <div class="upload-progress" id="upload-status"></div>
    </div>
    <div id="panel-preview" style="display:none">
      <div class="preview" id="preview-content"></div>
    </div>
    <div class="status-bar" id="ed-status"></div>
    <div class="danger-zone">
      <span>Danger zone</span>
      \${post.status === 'published' || post.status === 'edited'
        ? '<button class="btn btn-ghost btn-sm" onclick="unpublish()">Unpublish</button>'
        : ''
      }
      <button class="btn btn-danger btn-sm" onclick="deletePost()">Delete</button>
    </div>
  \`;
}

function switchTab(tab) {
  const isWrite = tab === 'write';
  document.getElementById('tab-write').classList.toggle('active', isWrite);
  document.getElementById('tab-preview').classList.toggle('active', !isWrite);
  document.getElementById('panel-write').style.display = isWrite ? '' : 'none';
  document.getElementById('panel-preview').style.display = isWrite ? 'none' : '';
  if (!isWrite) {
    document.getElementById('preview-content').innerHTML = marked.parse(document.getElementById('content').value);
  }
}

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function wrap(before, after) {
  const ta = document.getElementById('content');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || 'text';
  ta.setRangeText(before + sel + after, start, end, 'select');
  ta.focus();
}

function insertHeading() {
  const ta = document.getElementById('content');
  const start = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\\n', start - 1) + 1;
  ta.setRangeText('## ', lineStart, lineStart, 'end');
  ta.focus();
}

function insertImage() {
  document.getElementById('file-input').click();
}

async function uploadImage(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const statusEl = document.getElementById('upload-status');
  statusEl.textContent = 'Uploading…';

  const form = new FormData();
  form.append('file', file);

  const r = await fetch(\`\${API}/upload/\${currentSlug}\`, { method: 'POST', body: form });
  if (r.ok) {
    const { url, filename } = await r.json();
    const ta = document.getElementById('content');
    const pos = ta.selectionStart;
    const md = \`![\${filename}](\${url})\`;
    ta.setRangeText(md, pos, pos, 'end');
    ta.focus();
    statusEl.textContent = '';
  } else {
    statusEl.textContent = 'Upload failed';
  }
  input.value = '';
}

// ── Autosave ──────────────────────────────────────────────────────────────────

function scheduleAutosave() {
  clearSaveTimer();
  saveTimer = setTimeout(async () => {
    const current = document.getElementById('content')?.value;
    if (current === lastSavedContent) return;
    await saveDraftSilent();
  }, 2500);
}

function clearSaveTimer() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
}

async function saveDraftSilent() {
  const titleEl = document.getElementById('ed-title');
  if (!titleEl || !currentSlug) return;
  const body = {
    title: titleEl.value.trim(),
    date: document.getElementById('ed-date').value,
    tags: parseTags(document.getElementById('ed-tags').value),
    markdown: document.getElementById('content').value,
  };
  const r = await fetch(\`\${API}/posts/\${currentSlug}\`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) {
    lastSavedContent = body.markdown;
    setStatus('ed-status', 'Autosaved');
    setTimeout(() => {
      const el = document.getElementById('ed-status');
      if (el && el.textContent === 'Autosaved') { el.textContent = ''; el.className = 'status-bar'; }
    }, 2000);
  }
}

// ── Save / Publish / Delete ───────────────────────────────────────────────────

async function saveDraft() {
  clearSaveTimer();
  const body = {
    title: document.getElementById('ed-title').value.trim(),
    date: document.getElementById('ed-date').value,
    tags: parseTags(document.getElementById('ed-tags').value),
    markdown: document.getElementById('content').value,
  };
  setStatus('ed-status', 'Saving…');
  const r = await fetch(\`\${API}/posts/\${currentSlug}\`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) { lastSavedContent = body.markdown; setStatus('ed-status', 'Saved'); }
  else { setStatus('ed-status', 'Save failed', true); }
}

async function publish() {
  clearSaveTimer();
  await saveDraft();
  const markdown = document.getElementById('content').value;
  const contentHtml = marked.parse(markdown);
  setStatus('ed-status', 'Publishing…');
  const r = await fetch(\`\${API}/posts/\${currentSlug}/publish\`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentHtml })
  });
  if (r.ok) { setStatus('ed-status', 'Published'); setTimeout(showList, 800); }
  else { setStatus('ed-status', 'Publish failed', true); }
}

async function unpublish() {
  if (!confirm('Remove this post from the public blog?')) return;
  const r = await fetch(\`\${API}/posts/\${currentSlug}/unpublish\`, { method: 'POST' });
  if (r.ok) { showList(); } else { setStatus('ed-status', 'Failed', true); }
}

async function deletePost() {
  if (!confirm('Delete this post permanently?')) return;
  const r = await fetch(\`\${API}/posts/\${currentSlug}\`, { method: 'DELETE' });
  if (r.ok) { showList(); } else { setStatus('ed-status', 'Delete failed', true); }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseTags(str) {
  return str.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

function today() {
  return new Date().toLocaleDateString('en-CA');
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setStatus(id, msg, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-bar' + (isError ? ' err' : ' ok');
}

init();
</script>
</body>
</html>`;
