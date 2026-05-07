import { openEditor, closeEditor } from './editor.js';
import { initMobile, initSidebarToggle } from './mobile.js';
import { fmtDateShort, relativeTime } from './markdown.js';
import { showToast } from './toast.js';

// Re-export for modules that import from app.js
export { navigate };

// ── Boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  // Auth check
  try {
    const res = await fetch('/api/auth/check');
    if (!res.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
  } catch {
    window.location.href = '/admin/login.html';
    return;
  }

  document.getElementById('app').style.display = 'flex';

  await loadAuthorName();
  loadSidebar();
  initMobile();
  initSidebarToggle(openSidebar, closeSidebar);

  document.getElementById('btn-new-post').addEventListener('click', newPost);
  document.getElementById('btn-new-post-main').addEventListener('click', newPost);
  document.getElementById('rail-settings').addEventListener('click', openAuthorModal);
  document.getElementById('author-close').addEventListener('click', closeAuthorModal);
  document.getElementById('author-cancel').addEventListener('click', closeAuthorModal);
  document.getElementById('author-save').addEventListener('click', saveAuthor);
  document.getElementById('author-logout').addEventListener('click', logout);
  document.getElementById('sidebar-search').addEventListener('input', onSearch);

  // Route on load
  _route(window.location.pathname, false);

  // Handle browser back/forward
  window.addEventListener('popstate', () => _route(window.location.pathname, false));
})();

// ── Routing ───────────────────────────────────────────────────────────────────

function navigate(path, replace = false) {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  _route(path, false);
}

function _route(path, pushState = true) {
  const editMatch = path.match(/^\/admin\/edit\/(.+)$/);
  const mediaMatch = path === '/admin/media';

  if (editMatch) {
    const slug = editMatch[1];
    _setRailActive('posts');
    openEditor(slug);
    _setActiveSidebarItem(slug);
  } else if (mediaMatch) {
    _setRailActive('media');
    closeEditor();
    showMediaView();
  } else {
    // Post list
    _setRailActive('posts');
    closeEditor();
    showListView();
  }
}

function _setRailActive(route) {
  document.querySelectorAll('.rail-icon[data-route]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.route === route);
  });
}

// ── Views ─────────────────────────────────────────────────────────────────────

function showListView() {
  document.getElementById('post-list-view').style.display = '';
  document.getElementById('editor-writing-wrap').style.display = 'none';
  document.getElementById('media-view').style.display = 'none';
  document.getElementById('topbar-sep').style.display = 'none';
  document.getElementById('topbar-title').textContent = '';
  document.getElementById('btn-publish').style.display = 'none';
  document.getElementById('topbar-save-status').style.display = 'none';
  document.getElementById('btn-view-post').style.display = 'none';
  loadTablePosts();
}

function showMediaView() {
  document.getElementById('post-list-view').style.display = 'none';
  document.getElementById('editor-writing-wrap').style.display = 'none';
  document.getElementById('media-view').style.display = '';
  document.getElementById('topbar-sep').style.display = 'none';
  document.getElementById('topbar-title').textContent = 'Media';
  loadMedia();
}

// ── Post list ─────────────────────────────────────────────────────────────────

let allPosts = [];

async function loadSidebar() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) return;
    allPosts = await res.json();
    renderSidebar(allPosts);
    renderTable(allPosts);
  } catch {}
}

async function loadTablePosts() {
  if (allPosts.length === 0) await loadSidebar();
  else renderTable(allPosts);
}

function renderSidebar(posts) {
  const list = document.getElementById('sidebar-list');
  if (!list) return;

  const drafts = posts.filter(p => p.status === 'draft' || p.status === 'edited')
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = posts.filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = '';
  if (drafts.length) {
    html += `<div class="sidebar-section-label">Drafts</div>`;
    html += drafts.map(p => sidebarItem(p)).join('');
  }
  if (published.length) {
    html += `<div class="sidebar-section-label">Published</div>`;
    html += published.map(p => sidebarItem(p)).join('');
  }
  if (!html) html = `<div class="sidebar-section-label">No posts yet</div>`;
  list.innerHTML = html;

  list.querySelectorAll('.sidebar-post-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`/admin/edit/${el.dataset.slug}`);
      closeSidebar();
    });
  });
}

function sidebarItem(p) {
  const isDraft = p.status !== 'published';
  const meta = isDraft
    ? relativeTime(p.updatedAt || p.date)
    : fmtDateShort(p.date) + (p.wordCount ? ` · ${p.wordCount}w` : '');
  return `<a class="sidebar-post-item" data-slug="${esc(p.slug)}" href="/admin/edit/${esc(p.slug)}">
    <div class="sidebar-post-title">
      ${isDraft ? '<span class="draft-pip"></span>' : ''}${esc(p.title || 'Untitled')}
    </div>
    <div class="sidebar-post-meta">${esc(meta)}</div>
  </a>`;
}

function renderTable(posts) {
  const tbody = document.getElementById('post-list-tbody');
  if (!tbody) return;

  const sorted = [...posts].sort((a, b) => {
    // Drafts first, then published newest first
    if (a.status !== 'published' && b.status === 'published') return -1;
    if (a.status === 'published' && b.status !== 'published') return 1;
    return new Date(b.date) - new Date(a.date);
  });

  tbody.innerHTML = sorted.map(p => `
    <tr data-slug="${esc(p.slug)}">
      <td>
        <div class="pli-title">${esc(p.title || 'Untitled')}</div>
        <div class="pli-meta">${fmtDateShort(p.date)}${p.wordCount ? ` · ${p.wordCount} words` : ''}</div>
      </td>
      <td style="width:90px">
        <span class="pli-status ${p.status === 'published' ? 'is-published' : 'is-draft'}">${p.status}</span>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => navigate(`/admin/edit/${row.dataset.slug}`));
  });
}

function onSearch(e) {
  const q = e.target.value.toLowerCase();
  const filtered = allPosts.filter(p =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  );
  renderSidebar(filtered);
}

function _setActiveSidebarItem(slug) {
  document.querySelectorAll('.sidebar-post-item').forEach(el => {
    el.classList.toggle('is-active', el.dataset.slug === slug);
  });
}

// ── New post ──────────────────────────────────────────────────────────────────

async function newPost() {
  const title = prompt('Post title:');
  if (!title) return;
  const slug = slugifyTitle(title);

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to create post', 'error');
      return;
    }
    const post = await res.json();
    allPosts.push(post);
    renderSidebar(allPosts);
    navigate(`/admin/edit/${post.slug}`);
  } catch (e) {
    showToast('Failed to create post: ' + e.message, 'error');
  }
}

function slugifyTitle(title) {
  return title
    .toLowerCase()
    .replace(/['''""]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Media ─────────────────────────────────────────────────────────────────────

async function loadMedia() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="color:var(--color-cream-text-muted);font-size:13px">Loading…</div>';

  try {
    const res = await fetch('/api/media');
    if (!res.ok) throw new Error('Failed to load');
    const items = await res.json();

    if (!items.length) {
      grid.innerHTML = '<div style="color:var(--color-cream-text-muted);font-size:13px">No media yet.</div>';
      return;
    }

    grid.innerHTML = items.map(item => `
      <div style="position:relative;border:1px solid var(--color-cream-border);border-radius:6px;overflow:hidden;aspect-ratio:1">
        <img src="${item.url}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy">
        <button data-key="${esc(item.key)}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:11px;cursor:pointer" title="Delete">×</button>
      </div>`).join('');

    grid.querySelectorAll('button[data-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this image?')) return;
        try {
          await fetch(`/api/media/${encodeURIComponent(btn.dataset.key)}`, { method: 'DELETE' });
          loadMedia();
        } catch { showToast('Delete failed', 'error'); }
      });
    });
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--color-danger);font-size:13px">${e.message}</div>`;
  }
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────

function openSidebar() {
  document.getElementById('sidebar').classList.add('is-open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('is-open');
}

// ── Author modal ──────────────────────────────────────────────────────────────

async function loadAuthorName() {
  try {
    const res = await fetch('/api/author');
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('sidebar-author');
      if (el && data.name) el.textContent = data.name;
    }
  } catch {}
}

function openAuthorModal(e) {
  e.preventDefault();
  fetch('/api/author').then(r => r.ok ? r.json() : {}).then(data => {
    document.getElementById('author-name').value = data.name || '';
    document.getElementById('author-bio').value = data.bio || '';
    document.getElementById('author-headshot').value = data.headshotUrl || '';
    document.getElementById('author-modal').style.display = 'flex';
  }).catch(() => { document.getElementById('author-modal').style.display = 'flex'; });
}

function closeAuthorModal() {
  document.getElementById('author-modal').style.display = 'none';
}

async function saveAuthor() {
  const name = document.getElementById('author-name').value.trim();
  const bio = document.getElementById('author-bio').value.trim();
  const headshotUrl = document.getElementById('author-headshot').value.trim();

  try {
    const res = await fetch('/api/author', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio, headshotUrl })
    });
    if (!res.ok) throw new Error(await res.text());
    const el = document.getElementById('sidebar-author');
    if (el && name) el.textContent = name;
    closeAuthorModal();
    showToast('Author settings saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/admin/login.html';
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
