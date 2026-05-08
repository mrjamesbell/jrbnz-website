import { openEditor, closeEditor } from './editor.js';
import { initMobile } from './mobile.js';
import { fmtDateShort, relativeTime, slugify } from './markdown.js';
import { showToast } from './toast.js';
import { initMedia } from './media.js';
import { openCropModal } from './image-upload.js';

export { navigate, invalidatePostCache };

const BUILD = '2026-05-08.4';

// ── Boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  try {
    const res = await fetch('/api/auth/check');
    if (!res.ok) { window.location.href = '/signal/login.html'; return; }
  } catch { window.location.href = '/signal/login.html'; return; }

  document.getElementById('app').style.display = 'flex';
  const buildEl = document.getElementById('build-label');
  if (buildEl) buildEl.textContent = `build ${BUILD}`;

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
    navigate('/signal/');
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

  // Headshot upload button
  document.getElementById('btn-headshot-upload').addEventListener('click', () => {
    document.getElementById('headshot-file-input').click();
  });
  document.getElementById('headshot-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    openCropModal(file, async (croppedBlob) => {
      await _uploadHeadshot(croppedBlob);
    }, { circle: true });
  });

  // Route on load
  _route(window.location.pathname);
  window.addEventListener('popstate', () => _route(window.location.pathname));
})();

// ── Headshot upload ───────────────────────────────────────────────────────────

async function _uploadHeadshot(blob) {
  try {
    const filename = `headshot-${Date.now()}.jpg`;
    const presignRes = await fetch('/api/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType: blob.type || 'image/jpeg' })
    });
    if (!presignRes.ok) throw new Error('Presign failed');
    const { uploadUrl, key } = await presignRes.json();

    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob
    });

    const publicUrl = `https://jrbnz-blog.r2.dev/${key}`;
    document.getElementById('author-headshot').value = publicUrl;
    _updateHeadshotPreview(publicUrl);
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
}

function _updateHeadshotPreview(url) {
  const img = document.getElementById('headshot-preview-img');
  const placeholder = document.getElementById('headshot-placeholder');
  if (url) {
    img.src = url;
    img.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    img.src = '';
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
  }
}

// ── Routing ───────────────────────────────────────────────────────────────────

function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  _route(path);
}

function _route(path) {
  const editMatch = path.match(/^\/signal\/edit\/(.+)$/);
  const mediaMatch = path === '/signal/media';

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

function invalidatePostCache() { allPosts = []; }

async function loadPosts() {
  await _fetchPosts();
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
    .filter(p => p.status !== 'published' || p.hasDraftChanges)
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = posts
    .filter(p => p.status === 'published' && !p.hasDraftChanges)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  draftsEl.innerHTML = drafts.map(listItem).join('');
  publishedEl.innerHTML = published.map(listItem).join('');

  document.querySelectorAll('.post-list-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(`/signal/edit/${el.dataset.slug}`);
    });
  });
}

function listItem(p) {
  const isDraft = p.status !== 'published';
  const hasEdits = p.status === 'published' && p.hasDraftChanges;
  const tags = (p.tags || []).map(t => `#${t}`).join(' ');
  const wc = p.wordCount ? `${p.wordCount} words` : '';
  const dateStr = (isDraft || hasEdits)
    ? relativeTime(p.updatedAt || p.date)
    : fmtDateShort(p.date);
  const statusClass = isDraft ? 'is-draft' : hasEdits ? 'is-draft' : 'is-published';
  const statusLabel = isDraft ? 'draft' : hasEdits ? 'published · edits' : 'published';

  return `<a class="post-list-item" href="/signal/edit/${esc(p.slug)}" data-slug="${esc(p.slug)}">
    <div class="post-list-item-body">
      <div class="post-list-title">${(isDraft || hasEdits) ? '<span class="draft-pip"></span>' : ''}${esc(p.title || 'Untitled')}</div>
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
    navigate(`/signal/edit/${post.slug}`);
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
    document.getElementById('author-threads').value = data.threads || '';
    document.getElementById('author-instagram').value = data.instagram || '';
    document.getElementById('author-linkedin').value = data.linkedin || '';
    document.getElementById('author-flickr').value = data.flickr || '';
    _updateHeadshotPreview(data.headshotUrl || '');
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
  const threads = document.getElementById('author-threads').value.trim();
  const instagram = document.getElementById('author-instagram').value.trim();
  const linkedin = document.getElementById('author-linkedin').value.trim();
  const flickr = document.getElementById('author-flickr').value.trim();
  try {
    const res = await fetch('/api/author', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio, headshotUrl, threads, instagram, linkedin, flickr })
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
    window.location.href = '/signal/login.html';
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
