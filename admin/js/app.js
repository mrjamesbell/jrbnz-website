import { openEditor, closeEditor } from './editor.js';
import { initMobile } from './mobile.js';
import { fmtDateShort, relativeTime, slugify } from './markdown.js';
import { showToast } from './toast.js';
import { initMedia } from './media.js';

export { navigate };

// ── Boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  try {
    const res = await fetch('/api/auth/check');
    if (!res.ok) { window.location.href = '/admin/login.html'; return; }
  } catch { window.location.href = '/admin/login.html'; return; }

  document.getElementById('app').style.display = 'flex';

  initMobile();

  // Rail link interception
  document.querySelectorAll('.rail-icon[data-route], .rail-logo').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    });
  });

  // Topbar breadcrumb interception
  document.getElementById('topbar-breadcrumb')?.addEventListener('click', e => {
    e.preventDefault();
    navigate('/admin/');
  });

  // New post button
  document.getElementById('btn-new-post-main').addEventListener('click', e => {
    e.preventDefault();
    openNewPostModal();
  });

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
    _setRailActive('list');
    openEditor(editMatch[1]);
  } else if (mediaMatch) {
    _setRailActive('media');
    closeEditor();
    _showView('media');
    initMedia();
  } else {
    _setRailActive('list');
    closeEditor();
    _showView('list');
    loadPosts();
  }
}

function _setRailActive(route) {
  document.querySelectorAll('.rail-icon[data-route]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.route === route);
  });
}

// ── View management ───────────────────────────────────────────────────────────

function _showView(view) {
  document.getElementById('view-list').style.display = view === 'list' ? '' : 'none';
  document.getElementById('media-view').style.display = view === 'media' ? '' : 'none';
  // view-editor visibility managed by openEditor / closeEditor
}

// ── Post list ─────────────────────────────────────────────────────────────────

let allPosts = [];

async function loadPosts() {
  if (allPosts.length === 0) await _fetchPosts();
  renderList(allPosts);
}

async function _fetchPosts() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) return;
    allPosts = await res.json();
  } catch {}
}

function renderList(posts) {
  const draftsEl = document.getElementById('drafts-list');
  const publishedEl = document.getElementById('published-list');
  if (!draftsEl || !publishedEl) return;

  const drafts = posts
    .filter(p => p.status !== 'published')
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  draftsEl.innerHTML = drafts.map(listItem).join('');
  publishedEl.innerHTML = published.map(listItem).join('');

  document.querySelectorAll('.post-list-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(`/admin/edit/${el.dataset.slug}`);
    });
  });
}

function listItem(p) {
  const isDraft = p.status !== 'published';
  const tags = (p.tags || []).map(t => `#${t}`).join(' ');
  const wc = p.wordCount ? `${p.wordCount} words` : '';
  const dateStr = isDraft
    ? relativeTime(p.updatedAt || p.date)
    : fmtDateShort(p.date);
  const statusClass = isDraft ? 'is-draft' : 'is-published';
  const statusLabel = isDraft ? 'draft' : 'published';

  return `<a class="post-list-item" href="/admin/edit/${esc(p.slug)}" data-slug="${esc(p.slug)}">
    <div class="post-list-item-body">
      <div class="post-list-title">${isDraft ? '<span class="draft-pip"></span>' : ''}${esc(p.title || 'Untitled')}</div>
      <div class="post-list-meta">
        <span>${esc(dateStr)}</span>
        ${tags ? `<span class="post-list-tags">${esc(tags)}</span>` : ''}
        ${wc ? `<span class="post-list-wordcount">${esc(wc)}</span>` : ''}
      </div>
    </div>
    <span class="post-list-status ${statusClass}">${statusLabel}</span>
  </a>`;
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
    closeNewPostModal();
    navigate(`/admin/edit/${post.slug}`);
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create & edit';
  }
}

// ── Author modal ──────────────────────────────────────────────────────────────

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
