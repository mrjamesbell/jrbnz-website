import { openEditor, closeEditor } from './editor.js';
import { initMobile, initSidebarToggle } from './mobile.js';
import { fmtDateShort, relativeTime, slugify } from './markdown.js';
import { showToast } from './toast.js';

export { navigate };

// ── Boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  try {
    const res = await fetch('/api/auth/check');
    if (!res.ok) { window.location.href = '/admin/login.html'; return; }
  } catch { window.location.href = '/admin/login.html'; return; }

  document.getElementById('app').style.display = 'flex';

  await loadAuthorName();
  loadSidebar();
  initMobile();
  initSidebarToggle(openSidebar, closeSidebar);

  // Rail link interception — use JS router instead of full page loads
  document.querySelectorAll('.rail-icon[data-route], .rail-logo').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.getAttribute('href'));
      closeSidebar();
    });
  });

  // Sidebar new post button
  document.getElementById('btn-new-post').addEventListener('click', openNewPostModal);
  // Header new post button
  document.getElementById('btn-new-post-main').addEventListener('click', openNewPostModal);

  // New post modal
  document.getElementById('new-post-close').addEventListener('click', closeNewPostModal);
  document.getElementById('new-post-cancel').addEventListener('click', closeNewPostModal);
  document.getElementById('new-post-create').addEventListener('click', createPost);
  document.getElementById('new-post-title').addEventListener('input', onNewPostTitleInput);
  document.getElementById('new-post-slug').addEventListener('input', onNewPostSlugInput);
  document.getElementById('new-post-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewPostModal();
  });
  document.getElementById('new-post-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); createPost(); }
    if (e.key === 'Escape') closeNewPostModal();
  });

  // Settings
  document.getElementById('rail-settings').addEventListener('click', openAuthorModal);
  document.getElementById('author-close').addEventListener('click', closeAuthorModal);
  document.getElementById('author-cancel').addEventListener('click', closeAuthorModal);
  document.getElementById('author-save').addEventListener('click', saveAuthor);
  document.getElementById('author-logout').addEventListener('click', logout);

  // Search
  document.getElementById('sidebar-search').addEventListener('input', onSearch);

  // Route on load
  _route(window.location.pathname);
  window.addEventListener('popstate', () => _route(window.location.pathname));
})();

// ── Routing ───────────────────────────────────────────────────────────────────

function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  _route(path);
}

function _route(path) {
  const editMatch = path.match(/^\/admin\/edit\/(.+)$/);
  const mediaMatch = path === '/admin/media';

  if (editMatch) {
    _setRailActive('posts');
    openEditor(editMatch[1]);
    _setActiveSidebarItem(editMatch[1]);
    closeSidebar();
  } else if (mediaMatch) {
    _setRailActive('media');
    closeEditor();
    _showView('media');
    loadMedia();
  } else {
    _setRailActive('posts');
    closeEditor();
    _showView('list');
    loadTablePosts();
  }
}

function _setRailActive(route) {
  document.querySelectorAll('.rail-icon[data-route]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.route === route);
  });
}

// ── View management ───────────────────────────────────────────────────────────

function _showView(view) {
  const listView = document.getElementById('post-list-view');
  const editorWrap = document.getElementById('editor-writing-wrap');
  const mediaView = document.getElementById('media-view');
  const topbarSep = document.getElementById('topbar-sep');
  const topbarTitle = document.getElementById('topbar-title');
  const btnPublish = document.getElementById('btn-publish');
  const saveStatus = document.getElementById('topbar-save-status');
  const viewPost = document.getElementById('btn-view-post');

  listView.style.display = view === 'list' ? '' : 'none';
  mediaView.style.display = view === 'media' ? 'flex' : 'none';
  mediaView.style.flex = '1';
  mediaView.style.overflowY = 'auto';
  if (editorWrap) editorWrap.style.display = 'none';

  topbarSep.style.display = 'none';
  btnPublish.style.display = 'none';
  saveStatus.style.display = 'none';
  viewPost.style.display = 'none';
  topbarTitle.textContent = view === 'media' ? 'Media' : '';
}

// ── Post list ─────────────────────────────────────────────────────────────────

let allPosts = [];

async function loadSidebar() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) return;
    allPosts = await res.json();
    renderSidebar(allPosts);
  } catch {}
}

async function loadTablePosts() {
  if (allPosts.length === 0) await loadSidebar();
  renderTable(allPosts);
}

function renderSidebar(posts) {
  const list = document.getElementById('sidebar-list');
  if (!list) return;

  const drafts = posts
    .filter(p => p.status !== 'published')
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = '';
  if (drafts.length) {
    html += `<div class="sidebar-section-label">Drafts</div>`;
    html += drafts.map(sidebarItem).join('');
  }
  if (published.length) {
    html += `<div class="sidebar-section-label">Published</div>`;
    html += published.map(sidebarItem).join('');
  }
  if (!html) html = `<div class="sidebar-section-label" style="padding-top:var(--space-6);text-align:center">No posts yet</div>`;

  list.innerHTML = html;
  list.querySelectorAll('.sidebar-post-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(`/admin/edit/${el.dataset.slug}`);
      closeSidebar();
    });
  });
  _setActiveSidebarItem(window.location.pathname.match(/\/admin\/edit\/(.+)/)?.[1]);
}

function sidebarItem(p) {
  const isDraft = p.status !== 'published';
  const meta = isDraft
    ? relativeTime(p.updatedAt || p.date)
    : fmtDateShort(p.date) + (p.wordCount ? ` · ${p.wordCount}w` : '');
  return `<a class="sidebar-post-item" data-slug="${esc(p.slug)}" href="/admin/edit/${esc(p.slug)}">
    <div class="sidebar-post-title">${isDraft ? '<span class="draft-pip"></span>' : ''}${esc(p.title || 'Untitled')}</div>
    <div class="sidebar-post-meta">${esc(meta)}</div>
  </a>`;
}

function renderTable(posts) {
  const container = document.getElementById('post-list-content');
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = `<div class="post-list-empty">
      <div class="post-list-empty-heading">No posts yet</div>
      <div class="post-list-empty-sub">Create your first post to get started.</div>
      <button class="btn-new-post-inline" id="btn-empty-state-new">+ New post</button>
    </div>`;
    document.getElementById('btn-empty-state-new')?.addEventListener('click', openNewPostModal);
    return;
  }

  const drafts = posts.filter(p => p.status !== 'published')
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = posts.filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = '';

  if (drafts.length) {
    html += `<div class="post-list-group-label">Drafts</div>
    <table class="post-list-table"><tbody>
      ${drafts.map(tableRow).join('')}
    </tbody></table>`;
  }
  if (published.length) {
    html += `<div class="post-list-group-label">Published</div>
    <table class="post-list-table"><tbody>
      ${published.map(tableRow).join('')}
    </tbody></table>`;
  }

  container.innerHTML = html;
  container.querySelectorAll('tr[data-slug]').forEach(row => {
    row.addEventListener('click', () => navigate(`/admin/edit/${row.dataset.slug}`));
  });
}

function tableRow(p) {
  const statusClass = p.status === 'published' ? 'is-published' : 'is-draft';
  const statusLabel = p.status === 'published' ? 'published' : 'draft';
  const meta = [
    p.status === 'published' ? fmtDateShort(p.date) : relativeTime(p.updatedAt || p.date),
    p.wordCount ? `${p.wordCount} words` : null,
    (p.tags || []).length ? (p.tags || []).map(t => `#${t}`).join(' ') : null
  ].filter(Boolean).join(' · ');

  return `<tr data-slug="${esc(p.slug)}">
    <td>
      <div class="pli-title">${esc(p.title || 'Untitled')}</div>
      <div class="pli-meta">${esc(meta)}</div>
    </td>
    <td style="width:100px;text-align:right">
      <span class="pli-status ${statusClass}">${statusLabel}</span>
    </td>
  </tr>`;
}

function onSearch(e) {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderSidebar(allPosts); return; }
  renderSidebar(allPosts.filter(p =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  ));
}

function _setActiveSidebarItem(slug) {
  document.querySelectorAll('.sidebar-post-item').forEach(el => {
    el.classList.toggle('is-active', slug && el.dataset.slug === slug);
  });
}

// ── New post modal ────────────────────────────────────────────────────────────

let slugManuallyEdited = false;

function openNewPostModal() {
  slugManuallyEdited = false;
  document.getElementById('new-post-title').value = '';
  document.getElementById('new-post-slug').value = '';
  document.getElementById('new-post-slug-hint').textContent = '';
  document.getElementById('new-post-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('new-post-title').focus(), 50);
}

function closeNewPostModal() {
  document.getElementById('new-post-modal').style.display = 'none';
}

function onNewPostTitleInput() {
  if (!slugManuallyEdited) {
    const title = document.getElementById('new-post-title').value;
    const slug = slugify(title);
    document.getElementById('new-post-slug').value = slug;
    document.getElementById('new-post-slug-hint').textContent = slug ? `jrbnz.com/posts/${slug}/` : '';
  }
}

function onNewPostSlugInput() {
  slugManuallyEdited = true;
  const slug = document.getElementById('new-post-slug').value;
  document.getElementById('new-post-slug-hint').textContent = slug ? `jrbnz.com/posts/${slug}/` : '';
}

async function createPost() {
  const title = document.getElementById('new-post-title').value.trim();
  const rawSlug = document.getElementById('new-post-slug').value.trim();
  const slug = (rawSlug || slugify(title)).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');

  if (!title) { document.getElementById('new-post-title').focus(); return; }
  if (!slug) { showToast('Could not generate a slug from the title', 'error'); return; }

  const btn = document.getElementById('new-post-create');
  btn.disabled = true;
  btn.textContent = 'Creating…';

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
    allPosts.unshift(post);
    renderSidebar(allPosts);
    closeNewPostModal();
    navigate(`/admin/edit/${post.slug}`);
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create & edit';
  }
}

// ── Media ─────────────────────────────────────────────────────────────────────

async function loadMedia() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="color:var(--color-cream-text-muted);font-size:13px;font-family:var(--font-sans)">Loading…</div>';

  try {
    const res = await fetch('/api/media');
    if (!res.ok) throw new Error('Failed to load media');
    const items = await res.json();

    if (!items.length) {
      grid.innerHTML = '<div style="color:var(--color-cream-text-muted);font-size:14px;font-family:var(--font-sans)">No media uploaded yet.<br><br>Images are uploaded from the editor when writing a post.</div>';
      return;
    }

    grid.innerHTML = items.map(item => `
      <div style="position:relative;border:1px solid var(--color-cream-border);border-radius:8px;overflow:hidden;background:var(--color-cream-dark)">
        <div style="aspect-ratio:1;overflow:hidden">
          <img src="${esc(item.url)}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy">
        </div>
        <div style="padding:6px 8px;display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--color-cream-text-ghost);font-family:var(--font-sans);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.key.split('/').pop())}</span>
          <button data-key="${esc(item.key)}" style="background:none;border:none;cursor:pointer;color:var(--color-cream-text-ghost);font-size:14px;padding:2px;line-height:1" title="Delete">×</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('button[data-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this image from R2? This cannot be undone.')) return;
        try {
          await fetch(`/api/media/${encodeURIComponent(btn.dataset.key)}`, { method: 'DELETE' });
          loadMedia();
          showToast('Image deleted');
        } catch { showToast('Delete failed', 'error'); }
      });
    });
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--color-danger);font-size:13px;font-family:var(--font-sans)">${e.message}</div>`;
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
    showToast('Saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } finally {
    window.location.href = '/admin/login.html';
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
