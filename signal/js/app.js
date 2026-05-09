import { openEditor, closeEditor } from './editor.js';
import { initMobile } from './mobile.js';
import { fmtDateShort, relativeTime, slugify } from './markdown.js';
import { showToast } from './toast.js';
import { initMedia } from './media.js';
import { openCropModal } from './image-upload.js';

export { navigate, invalidatePostCache };

const BUILD = '2026-05-09.20';

// ── Boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  try {
    const res = await fetch('/api/auth/check');
    if (!res.ok) { window.location.href = '/signal/login.html'; return; }
  } catch { window.location.href = '/signal/login.html'; return; }

  const appEl = document.getElementById('app');
  appEl.style.display = 'flex';
  requestAnimationFrame(() => appEl.classList.add('is-entering'));
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
  document.getElementById('btn-rebuild-site').addEventListener('click', rebuildSite);

  // Headshot buttons
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
  document.getElementById('btn-headshot-media').addEventListener('click', _openHeadshotMediaPicker);
  document.getElementById('btn-headshot-url').addEventListener('click', () => {
    const row = document.getElementById('headshot-url-row');
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    if (row.style.display === 'flex') document.getElementById('headshot-url-input').focus();
  });
  document.getElementById('btn-headshot-url-set').addEventListener('click', () => {
    const url = document.getElementById('headshot-url-input').value.trim();
    if (url) {
      document.getElementById('author-headshot').value = url;
      _updateHeadshotPreview(url);
      document.getElementById('headshot-url-row').style.display = 'none';
      document.getElementById('headshot-url-input').value = '';
    }
  });
  document.getElementById('headshot-url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-headshot-url-set').click(); }
    if (e.key === 'Escape') { document.getElementById('headshot-url-row').style.display = 'none'; }
  });

  // Route on load
  _route(window.location.pathname);
  window.addEventListener('popstate', () => _route(window.location.pathname));
})();

// ── Headshot upload ───────────────────────────────────────────────────────────

async function _uploadHeadshot(blob) {
  if (!blob || blob.size < 100) {
    showToast('Crop produced an invalid image', 'error');
    return;
  }
  const prevUrl = document.getElementById('author-headshot').value;
  try {
    const filename = `headshot-${Date.now()}.jpg`;
    const presignRes = await fetch('/api/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType: 'image/jpeg' })
    });
    if (!presignRes.ok) throw new Error('Presign failed');
    const { uploadUrl, publicUrl } = await presignRes.json();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob
    });
    if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

    document.getElementById('author-headshot').value = publicUrl;
    _updateHeadshotPreview(publicUrl);
  } catch (e) {
    document.getElementById('author-headshot').value = prevUrl;
    _updateHeadshotPreview(prevUrl);
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

async function _openHeadshotMediaPicker() {
  const modal = document.getElementById('media-picker-modal');
  const grid = document.getElementById('media-picker-grid');
  const insertBtn = document.getElementById('media-picker-insert');
  const closeBtn = document.getElementById('media-picker-close');
  const cancelBtn = document.getElementById('media-picker-cancel');
  const searchEl = document.getElementById('media-picker-search');
  const infoEl = document.getElementById('picker-selected-info');

  grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">Loading…</div>';
  insertBtn.disabled = true;
  insertBtn.textContent = 'Use as headshot';
  if (infoEl) infoEl.textContent = '';
  if (searchEl) searchEl.value = '';
  modal.style.display = 'flex';

  try {
    const res = await fetch('/api/media?limit=48');
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    if (!items.length) {
      grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">No media uploaded yet.</div>';
    } else {
      grid.innerHTML = items.map(item => {
        const url = _escAttr(item.publicUrl || item.url || '');
        const name = _escAttr(item.filename || '');
        return `<div class="media-item" data-url="${url}">
          <img src="${url}" alt="${name}" loading="lazy">
          <div class="media-item-overlay">
            <div class="media-item-filename">${name}</div>
          </div>
        </div>`;
      }).join('');
    }
  } catch {
    grid.innerHTML = '<div style="padding:20px;color:var(--color-danger);font-size:13px">Failed to load media</div>';
  }

  const onGridClick = e => {
    const item = e.target.closest('.media-item');
    if (!item) return;
    grid.querySelectorAll('.media-item.is-selected').forEach(el => el.classList.remove('is-selected'));
    item.classList.add('is-selected');
    insertBtn.disabled = false;
    if (infoEl) infoEl.textContent = item.querySelector('.media-item-filename')?.textContent || '';
  };
  grid.addEventListener('click', onGridClick);

  if (searchEl) {
    searchEl.oninput = e => {
      const q = e.target.value.toLowerCase();
      grid.querySelectorAll('.media-item').forEach(item => {
        const name = item.querySelector('.media-item-filename')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(q) ? '' : 'none';
      });
    };
  }

  const close = () => {
    modal.style.display = 'none';
    grid.removeEventListener('click', onGridClick);
    insertBtn.textContent = 'Insert image';
    insertBtn.onclick = null;
    if (closeBtn) closeBtn.onclick = null;
    if (cancelBtn) cancelBtn.onclick = null;
    if (searchEl) searchEl.oninput = null;
  };

  insertBtn.onclick = async () => {
    const selected = grid.querySelector('.media-item.is-selected');
    if (!selected) return;
    const url = selected.dataset.url;
    close();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const file = new File([blob], `headshot.${ext}`, { type: blob.type });
      openCropModal(file, async (croppedBlob) => {
        await _uploadHeadshot(croppedBlob);
      }, { circle: true });
    } catch {
      showToast('Could not load image for cropping — try the URL option instead', 'error');
    }
  };
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });
}

function _escAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function _animateIn(el) {
  el.classList.remove('is-entering');
  void el.offsetWidth;
  el.classList.add('is-entering');
}

function _showView(view) {
  const listEl = document.getElementById('view-list');
  const mediaEl = document.getElementById('media-view');
  const showList = view === 'list';
  const showMedia = view === 'media';
  listEl.style.display = showList ? '' : 'none';
  mediaEl.style.display = showMedia ? '' : 'none';
  if (showList) _animateIn(listEl);
  if (showMedia) _animateIn(mediaEl);
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

async function rebuildSite() {
  const btn = document.getElementById('btn-rebuild-site');
  btn.disabled = true;
  btn.textContent = 'Rebuilding…';
  try {
    const res = await fetch('/api/site/rebuild', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    showToast(`Rebuilt ${data.rebuilt} post${data.rebuilt === 1 ? '' : 's'}`, 'success');
  } catch (e) {
    showToast('Rebuild failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Rebuild site';
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
