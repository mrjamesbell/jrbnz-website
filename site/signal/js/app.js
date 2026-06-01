import { openEditor, closeEditor } from './editor.js';
import { initMobile } from './mobile.js';
import { fmtDateShort, relativeTime, slugify } from './markdown.js';
import { showToast } from './toast.js';
import { initMedia } from './media.js';
import { openCropModal, uploadToR2 } from './image-upload.js';
import { initSnippetsView } from './snippets-ui.js';
import { initHomepageView } from './homepage.js';
import { BUILD } from './build.js';
import { openMediaPicker } from './media-picker.js';
import { esc } from './utils.js';
import { showConfirm } from './confirm-modal.js';

export { navigate, invalidatePostCache, invalidatePageCache, getAllTags };
export { showConfirm } from './confirm-modal.js';

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
  if (buildEl) buildEl.textContent = BUILD.split('.').pop();

  initMobile();

  // Rail link interception
  document.querySelectorAll('.rail-item[data-route]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    });
  });

  // Mobile tab bar
  document.querySelectorAll('.mobile-tab[data-route]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    });
  });

  // Topbar breadcrumb interception (href is updated dynamically by openEditor)
  document.getElementById('topbar-breadcrumb')?.addEventListener('click', e => {
    e.preventDefault();
    const href = document.getElementById('topbar-breadcrumb').getAttribute('href');
    navigate(href || '#');
  });

  // New post button
  document.getElementById('btn-new-post-main').addEventListener('click', e => {
    e.preventDefault();
    openNewPostModal();
  });

  // New page button
  document.getElementById('btn-new-page-main').addEventListener('click', e => {
    e.preventDefault();
    openNewPageModal();
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

  // New page modal
  document.getElementById('new-page-close').addEventListener('click', closeNewPageModal);
  document.getElementById('new-page-cancel').addEventListener('click', closeNewPageModal);
  document.getElementById('new-page-create').addEventListener('click', createPage);
  document.getElementById('new-page-title').addEventListener('input', _onNewPageTitleInput);
  document.getElementById('new-page-slug').addEventListener('input', _onNewPageSlugInput);
  document.getElementById('new-page-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewPageModal();
  });
  document.getElementById('new-page-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); createPage(); }
    if (e.key === 'Escape') closeNewPageModal();
  });

  // Rail buttons
  document.getElementById('rail-author').addEventListener('click', e => { e.preventDefault(); openAuthorModal(e); });

  // Mobile icon buttons (post list header, visible when rail is hidden)
  document.getElementById('mobile-author-btn')?.addEventListener('click', e => { e.preventDefault(); openAuthorModal(e); });
  document.getElementById('mobile-settings-btn')?.addEventListener('click', e => { e.preventDefault(); navigate('settings'); });

  // Author modal
  document.getElementById('author-close').addEventListener('click', closeAuthorModal);
  document.getElementById('author-cancel').addEventListener('click', closeAuthorModal);
  document.getElementById('author-save').addEventListener('click', saveAuthor);
  document.getElementById('author-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthorModal(); });
  document.getElementById('btn-copy-token').addEventListener('click', () => {
    const val = document.getElementById('micropub-token-display').value;
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      const btn = document.getElementById('btn-copy-token');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  // Settings page
  document.getElementById('app-settings-save').addEventListener('click', saveAppSettings);
  document.getElementById('btn-app-logout').addEventListener('click', logout);
  document.getElementById('btn-publish-site').addEventListener('click', publishSite);
  // Default cover image in settings
  document.getElementById('btn-default-cover-media')?.addEventListener('click', () =>
    openMediaPicker({ insertLabel: 'Use as default cover', onSelect: item => {
      const url = item.urls?.hero || item.publicUrl;
      const inp = document.getElementById('site-default-cover');
      const wrap = document.getElementById('default-cover-preview-wrap');
      const img = document.getElementById('default-cover-preview-img');
      if (inp) inp.value = url;
      if (wrap && img) { wrap.style.display = ''; img.src = url; }
    }})
  );
  document.getElementById('site-default-cover')?.addEventListener('input', e => {
    const url = e.target.value.trim();
    const wrap = document.getElementById('default-cover-preview-wrap');
    const img = document.getElementById('default-cover-preview-img');
    if (wrap && img) { wrap.style.display = url ? '' : 'none'; if (url) img.src = url; }
  });
  document.querySelectorAll('.default-cover-focus-btn').forEach(btn => {
    btn.addEventListener('click', () => _updateDefaultCoverFocusBtns(btn.dataset.focus));
  });

  // Accent colour pickers
  _initAccentPickers();

  // Headshot buttons
  document.getElementById('btn-headshot-upload').addEventListener('click', () => {
    document.getElementById('headshot-file-input').click();
  });
  document.getElementById('headshot-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    // setTimeout defers until after focus/blur events from the OS file picker settle
    setTimeout(() => openCropModal(file, async processedFile => {
      showToast('Uploading…');
      try {
        const result = await uploadToR2(processedFile);
        if (result) {
          document.getElementById('author-headshot').value = result.publicUrl;
          _updateHeadshotPreview(result.publicUrl);
          showToast('Uploaded', 'success', 1500);
        }
      } catch (e) {
        showToast('Upload failed: ' + e.message, 'error');
      }
    }, { circle: true }), 0);
  });
  document.getElementById('btn-headshot-media').addEventListener('click', () =>
    openMediaPicker({ insertLabel: 'Use as headshot', onSelect: item => {
      const url = item.urls?.hero || item.publicUrl;
      document.getElementById('author-headshot').value = url;
      _updateHeadshotPreview(url);
    }})
  );

  // Cover image picker
  document.getElementById('btn-cover-media').addEventListener('click', () =>
    openMediaPicker({ insertLabel: 'Use as cover image', onSelect: item => {
      const url = item.urls?.hero || item.publicUrl;
      const input = document.getElementById('settings-cover');
      if (input) { input.value = url; input.dispatchEvent(new Event('input')); }
    }})
  );
  document.getElementById('settings-cover').addEventListener('input', e => {
    const url = e.target.value.trim();
    const wrap = document.getElementById('cover-preview-wrap');
    const img = document.getElementById('cover-preview-img');
    if (wrap && img) {
      wrap.style.display = url ? '' : 'none';
      if (url) img.src = url;
    }
  });
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
  _route(location.hash.slice(1));
  window.addEventListener('hashchange', () => _route(location.hash.slice(1)));
})();

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


function _updateDefaultCoverFocusBtns(focus) {
  const img = document.getElementById('default-cover-preview-img');
  document.querySelectorAll('.default-cover-focus-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.focus === focus);
  });
  if (img) img.style.objectPosition = `${focus} center`;
}

// ── Routing ───────────────────────────────────────────────────────────────────

function navigate(hash) {
  const h = String(hash).replace(/^#/, '');
  if (location.hash.slice(1) === h) {
    _route(h);
  } else {
    location.hash = h;
  }
}

function _route(hash) {
  const editMatch = hash.match(/^edit\/(.+)$/);
  const editPageMatch = hash.match(/^edit-page\/(.+)$/);
  const mediaMatch = hash === 'media';
  const pagesMatch = hash === 'pages';
  const snippetsMatch = hash === 'snippets';
  const homepageMatch = hash === 'homepage';
  const helpMatch = hash === 'help';
  const settingsMatch = hash === 'settings';

  const tabbar = document.getElementById('mobile-tabbar');
  if (editPageMatch) {
    _setRailActive('pages');
    if (tabbar) tabbar.style.display = 'none';
    openEditor(editPageMatch[1], 'page');
  } else if (editMatch) {
    _setRailActive('list');
    if (tabbar) tabbar.style.display = 'none';
    openEditor(editMatch[1]);
  } else if (mediaMatch) {
    _setRailActive('media');
    closeEditor();
    _showView('media');
    initMedia();
  } else if (pagesMatch) {
    _setRailActive('pages');
    closeEditor();
    _showView('pages');
    loadPages();
  } else if (snippetsMatch) {
    _setRailActive('snippets');
    closeEditor();
    _showView('snippets');
    initSnippetsView();
  } else if (homepageMatch) {
    _setRailActive('homepage');
    closeEditor();
    _showView('homepage');
    initHomepageView();
  } else if (helpMatch) {
    _setRailActive('help');
    closeEditor();
    _showView('help');
  } else if (settingsMatch) {
    _setRailActive('settings');
    closeEditor();
    _showView('settings');
    openSettingsView();
  } else {
    _setRailActive('list');
    closeEditor();
    _showView('list');
    loadPosts();
  }
}

function _setRailActive(route) {
  document.querySelectorAll('.rail-item[data-route]').forEach(el => {
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
  const pagesEl = document.getElementById('view-pages');
  const mediaEl = document.getElementById('media-view');
  const snippetsEl = document.getElementById('view-snippets');
  const homepageEl = document.getElementById('view-homepage');
  const helpEl = document.getElementById('view-help');
  const settingsEl = document.getElementById('view-settings');
  const showList = view === 'list';
  const showPages = view === 'pages';
  const showMedia = view === 'media';
  const showSnippets = view === 'snippets';
  const showHomepage = view === 'homepage';
  const showHelp = view === 'help';
  const showSettings = view === 'settings';
  listEl.style.display = showList ? '' : 'none';
  if (pagesEl) pagesEl.style.display = showPages ? '' : 'none';
  mediaEl.style.display = showMedia ? '' : 'none';
  if (snippetsEl) snippetsEl.style.display = showSnippets ? '' : 'none';
  if (homepageEl) homepageEl.style.display = showHomepage ? '' : 'none';
  if (helpEl) helpEl.style.display = showHelp ? '' : 'none';
  if (settingsEl) settingsEl.style.display = showSettings ? '' : 'none';
  if (showList) _animateIn(listEl);
  if (showPages && pagesEl) _animateIn(pagesEl);
  if (showMedia) _animateIn(mediaEl);
  if (showSnippets && snippetsEl) _animateIn(snippetsEl);
  if (showHomepage && homepageEl) _animateIn(homepageEl);
  if (showHelp && helpEl) _animateIn(helpEl);
  if (showSettings && settingsEl) { _animateIn(settingsEl); _restoreDeployStatus(); }
  // view-editor visibility managed by openEditor / closeEditor

  // Mobile tab bar: show/hide and update active tab
  const tabbar = document.getElementById('mobile-tabbar');
  if (tabbar) {
    const isEditor = view === 'editor';
    tabbar.style.display = isEditor ? 'none' : '';
    tabbar.querySelectorAll('.mobile-tab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.route === view);
    });
  }
}

// ── Post list ─────────────────────────────────────────────────────────────────

let allPosts = [];

function invalidatePostCache() { allPosts = []; }

function getAllTags() {
  const seen = new Set();
  for (const p of allPosts) for (const t of (p.tags || [])) seen.add(t);
  return [...seen].sort();
}

async function loadPosts() {
  await _fetchPosts();
  renderList(allPosts);
  const search = document.getElementById('post-list-search');
  if (search && !search._bound) {
    search._bound = true;
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      renderList(q ? allPosts.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.excerpt || '').toLowerCase().includes(q)
      ) : allPosts);
    });
  }
}

async function _fetchPosts() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error(`${res.status}`);
    allPosts = await res.json();
  } catch (e) {
    console.error('Failed to load posts:', e);
    showToast('Failed to load posts — ' + e.message, 'error');
  }
}

function renderList(posts) {
  const draftsEl = document.getElementById('drafts-list');
  const publishedEl = document.getElementById('published-list');
  const notesEl = document.getElementById('notes-list');
  if (!draftsEl || !publishedEl) return;

  const isNote = p => (p.tags || []).includes('note');
  const drafts = posts
    .filter(p => p.status !== 'published' || p.hasDraftChanges)
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = posts
    .filter(p => p.status === 'published' && !p.hasDraftChanges && !isNote(p))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const notes = posts
    .filter(p => p.status === 'published' && !p.hasDraftChanges && isNote(p))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  draftsEl.innerHTML = drafts.map(listItem).join('');
  publishedEl.innerHTML = published.map(listItem).join('');
  if (notesEl) notesEl.innerHTML = notes.map(listItem).join('');

  document.querySelectorAll('.post-list-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.post-list-delete')) return;
      navigate(`#edit/${el.dataset.slug}`);
    });
  });

  document.querySelectorAll('.post-list-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      showConfirm(`Delete "${slug}"? This cannot be undone.`, async () => {
        try {
          const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(await res.text());
          showToast('Post deleted');
          invalidatePostCache();
          await loadPosts();
        } catch (err) {
          showToast('Delete failed: ' + err.message, 'error');
        }
      });
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
  const statusLabel = isDraft ? 'Draft' : hasEdits ? 'Edits' : 'Published';
  const excerpt = p.excerpt || tags || '';

  return `<div class="post-list-item" data-slug="${esc(p.slug)}">
    <div class="post-list-item-body">
      <div class="post-list-title">${esc(p.title || 'Untitled')}</div>
      ${excerpt ? `<div class="post-list-excerpt">${esc(excerpt)}</div>` : ''}
    </div>
    <div class="post-list-item-right">
      <div>${esc(dateStr)}</div>
      ${wc ? `<div>${esc(wc)}</div>` : ''}
    </div>
    <span class="post-list-status ${statusClass}">${statusLabel}</span>
    <button class="post-list-delete" data-slug="${esc(p.slug)}" title="Delete post" tabindex="-1">×</button>
  </div>`;
}

// ── Page list ─────────────────────────────────────────────────────────────────

let allPages = [];

function invalidatePageCache() { allPages = []; }

async function loadPages() {
  try {
    const res = await fetch('/api/pages');
    if (!res.ok) throw new Error(`${res.status}`);
    allPages = await res.json();
  } catch (e) {
    console.error('Failed to load pages:', e);
    showToast('Failed to load pages — ' + e.message, 'error');
  }
  renderPageList(allPages);
}

function renderPageList(pages) {
  const draftsEl = document.getElementById('page-drafts-list');
  const publishedEl = document.getElementById('page-published-list');
  if (!draftsEl || !publishedEl) return;

  const drafts = pages
    .filter(p => p.status !== 'published' || p.hasDraftChanges)
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const published = pages
    .filter(p => p.status === 'published' && !p.hasDraftChanges)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  draftsEl.innerHTML = drafts.map(pageListItem).join('');
  publishedEl.innerHTML = published.map(pageListItem).join('');

  document.querySelectorAll('.page-list-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.post-list-delete')) return;
      navigate(`#edit-page/${el.dataset.slug}`);
    });
  });

  document.querySelectorAll('.page-list-item .post-list-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      showConfirm(`Delete page "${slug}"? This cannot be undone.`, async () => {
        try {
          const res = await fetch(`/api/pages/${slug}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(await res.text());
          showToast('Page deleted');
          invalidatePageCache();
          await loadPages();
        } catch (err) {
          showToast('Delete failed: ' + err.message, 'error');
        }
      });
    });
  });
}

function pageListItem(p) {
  const isDraft = p.status !== 'published';
  const hasEdits = p.status === 'published' && p.hasDraftChanges;
  const dateStr = (isDraft || hasEdits)
    ? relativeTime(p.updatedAt || p.date)
    : fmtDateShort(p.date);
  const statusClass = isDraft ? 'is-draft' : hasEdits ? 'is-draft' : 'is-published';
  const statusLabel = isDraft ? 'draft' : hasEdits ? 'published · edits' : 'published';
  const menuLabel = p.include_in_menu ? '<span class="post-list-tags">in nav</span>' : '';

  return `<div class="post-list-item page-list-item" data-slug="${esc(p.slug)}">
    <div class="post-list-item-body">
      <div class="post-list-title">${(isDraft || hasEdits) ? '<span class="draft-pip"></span>' : ''}${esc(p.title || 'Untitled')}</div>
      <div class="post-list-meta">
        <span>${esc(dateStr)}</span>
        ${menuLabel}
      </div>
    </div>
    <span class="post-list-status ${statusClass}">${statusLabel}</span>
    <button class="post-list-delete" data-slug="${esc(p.slug)}" title="Delete page" tabindex="-1">×</button>
  </div>`;
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
    navigate(`#edit/${post.slug}`);
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create & edit';
  }
}

// ── New page modal ────────────────────────────────────────────────────────────

let _pageSlugManuallyEdited = false;

function openNewPageModal() {
  _pageSlugManuallyEdited = false;
  document.getElementById('new-page-title').value = '';
  document.getElementById('new-page-slug').value = '';
  document.getElementById('new-page-slug-hint').textContent = '';
  document.getElementById('new-page-menu').checked = false;
  document.getElementById('new-page-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('new-page-title').focus(), 50);
}

function closeNewPageModal() {
  document.getElementById('new-page-modal').style.display = 'none';
}

function _onNewPageTitleInput() {
  if (!_pageSlugManuallyEdited) {
    const title = document.getElementById('new-page-title').value;
    const slug = slugify(title);
    document.getElementById('new-page-slug').value = slug;
    document.getElementById('new-page-slug-hint').textContent = slug ? `jrbnz.com/${slug}/` : '';
  }
}

function _onNewPageSlugInput() {
  _pageSlugManuallyEdited = true;
  const slug = document.getElementById('new-page-slug').value;
  document.getElementById('new-page-slug-hint').textContent = slug ? `jrbnz.com/${slug}/` : '';
}

async function createPage() {
  const title = document.getElementById('new-page-title').value.trim();
  const rawSlug = document.getElementById('new-page-slug').value.trim();
  const slug = (rawSlug || slugify(title)).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const include_in_menu = document.getElementById('new-page-menu').checked;

  if (!title) { document.getElementById('new-page-title').focus(); return; }
  if (!slug) { showToast('Could not generate a slug from the title', 'error'); return; }

  const btn = document.getElementById('new-page-create');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, include_in_menu })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to create page', 'error');
      return;
    }
    const page = await res.json();
    allPages.unshift(page);
    closeNewPageModal();
    navigate(`#edit-page/${page.slug}`);
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

async function publishSite() {
  const btn = document.getElementById('btn-publish-site');
  const progress = document.getElementById('deploy-progress');
  btn.disabled = true;
  progress.hidden = true;
  progress.innerHTML = '';

  // Step 1 — rebuild
  btn.textContent = 'Rebuilding…';
  try {
    const res = await fetch('/api/site/rebuild', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
  } catch (e) {
    showToast('Rebuild failed: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Publish site';
    return;
  }

  // Step 2 — deploy
  btn.textContent = 'Deploying…';
  progress.hidden = false;
  try {
    const res = await fetch('/api/site/deploy', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    _pollDeployStatus(btn, progress);
  } catch (e) {
    showToast('Deploy failed: ' + e.message, 'error');
    _deployFinish(btn, progress, false);
  }
}

function _deployAddBox(progress) {
  const box = document.createElement('div');
  box.className = 'deploy-box';
  progress.appendChild(box);
}

function _deployFinish(btn, progress, success) {
  progress.innerHTML = '';
  const result = document.createElement('span');
  const at = new Date();
  result.className = success ? 'deploy-result deploy-result--success' : 'deploy-result deploy-result--fail';
  result.textContent = success ? '✓' : '■';
  result.title = at.toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  progress.appendChild(result);
  progress.hidden = false;
  btn.disabled = false;
  btn.textContent = 'Publish site';
  if (success) {
    localStorage.setItem('signal_deploy_status', JSON.stringify({ ok: true, at: at.toISOString() }));
  } else {
    setTimeout(() => {
      progress.hidden = true;
      progress.innerHTML = '';
    }, 4000);
  }
}

function _restoreDeployStatus() {
  const progress = document.getElementById('deploy-progress');
  if (!progress) return;
  try {
    const stored = localStorage.getItem('signal_deploy_status');
    if (!stored) { progress.hidden = true; return; }
    const { ok, at } = JSON.parse(stored);
    if (!ok) { progress.hidden = true; return; }
    progress.innerHTML = '';
    const result = document.createElement('span');
    result.className = 'deploy-result deploy-result--success';
    result.textContent = '✓';
    result.title = new Date(at).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    progress.appendChild(result);
    progress.hidden = false;
  } catch {
    progress.hidden = true;
  }
}

async function _pollDeployStatus(btn, progress) {
  const started = Date.now();
  const timeout = 5 * 60 * 1000;
  const interval = 6000;
  await new Promise(r => setTimeout(r, 8000));
  _deployAddBox(progress);
  while (Date.now() - started < timeout) {
    try {
      const res = await fetch('/api/site/deploy-status');
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'success') {
          showToast('Deploy complete — site is live', 'success');
          _deployFinish(btn, progress, true);
          return;
        }
        if (d.status === 'failure') {
          showToast('Deploy failed — check CF Pages dashboard', 'error');
          _deployFinish(btn, progress, false);
          return;
        }
        _deployAddBox(progress);
      }
    } catch (e) {
      console.error('Deploy status check failed:', e);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  showToast('Deploy is taking longer than expected — check CF Pages dashboard', 'warning');
  _deployFinish(btn, progress, false);
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } finally {
    window.location.href = '/signal/login.html';
  }
}

// ── Settings page ─────────────────────────────────────────────────────────────

function openSettingsView() {
  fetch('/api/site/accent').then(r => r.ok ? r.json() : {}).then(d => {
    _updateAccentButtons('signal-swatch-row', d.signalAccent || '');
    _updateAccentButtons('live-swatch-row', d.accent || '');
  }).catch(() => {});

  const tokenEl = document.getElementById('micropub-token-display');
  tokenEl.value = '';
  fetch('/api/micropub-token').then(r => r.ok ? r.json() : {}).then(d => {
    tokenEl.value = d.token || '';
  }).catch(() => {});

  fetch('/api/site/settings').then(r => r.ok ? r.json() : {}).then(d => {
    const inp = document.getElementById('site-default-cover');
    const wrap = document.getElementById('default-cover-preview-wrap');
    const img = document.getElementById('default-cover-preview-img');
    if (inp) inp.value = d.defaultCoverImage || '';
    if (wrap && img) {
      wrap.style.display = d.defaultCoverImage ? '' : 'none';
      if (d.defaultCoverImage) img.src = d.defaultCoverImage;
    }
    _updateDefaultCoverFocusBtns(d.defaultCoverImageFocus || 'center');
    _loadThemePicker(d.theme || 'cinematic');
  }).catch(() => {});

  _loadThemeManager();
  _initThemeUpload();
}

function _loadThemePicker(activeTheme) {
  const group = document.getElementById('theme-picker-group');
  if (!group) return;
  fetch('/api/theme/list').then(r => r.ok ? r.json() : []).then(themes => {
    group.innerHTML = themes.map(t => {
      const label = t.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      return `<button type="button" class="btn btn-secondary btn-sm theme-pick-btn${t === activeTheme ? ' active' : ''}" data-theme="${t}">${label}</button>`;
    }).join('');
    group.querySelectorAll('.theme-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.theme-pick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }).catch(() => {});
}

// ── Theme management ──────────────────────────────────────────────────────────

let _pendingTheme = null; // { name, js, css } ready to install

async function _loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(s);
  });
}

function _setThemeUploadFeedback(msg, type) {
  const el = document.getElementById('theme-upload-feedback');
  if (!el) return;
  el.hidden = !msg;
  el.className = 'theme-upload-feedback' + (type ? ` is-${type}` : '');
  el.innerHTML = msg || '';
}

async function _loadThemeManager() {
  const wrap = document.getElementById('theme-installed-wrap');
  const list = document.getElementById('theme-installed-list');
  if (!wrap || !list) return;
  try {
    const res = await fetch('/api/themes', { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return;
    const { installed = [] } = await res.json();
    if (!installed.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    list.innerHTML = installed.map(({ name, installedAt }) => {
      const date = installedAt ? new Date(installedAt).toLocaleDateString() : '';
      return `<div class="theme-installed-item">
        <span class="theme-installed-name">${name}</span>
        <span class="theme-installed-date">${date}</span>
        <button type="button" class="btn btn-danger btn-sm" data-delete-theme="${name}">Delete</button>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-delete-theme]').forEach(btn => {
      btn.addEventListener('click', () => _deleteTheme(btn.dataset.deleteTheme));
    });
  } catch (_) {}
}

async function _deleteTheme(name) {
  if (!confirm(`Delete theme "${name}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/themes/${name}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Delete failed', 'error'); return; }
    showToast(`Theme "${name}" deleted`, 'success');
    await _loadThemeManager();
    const activeBtn = document.querySelector('#theme-picker-group .theme-pick-btn.active');
    _loadThemePicker(activeBtn?.dataset.theme || 'cinematic');
  } catch (e) {
    showToast('Delete failed — ' + e.message, 'error');
  }
}

let _themeUploadInitialized = false;
function _initThemeUpload() {
  if (_themeUploadInitialized) return;
  _themeUploadInitialized = true;
  const input = document.getElementById('theme-upload-input');
  const chooseBtn = document.getElementById('theme-upload-btn');
  const filenameEl = document.getElementById('theme-upload-filename');
  const installBtn = document.getElementById('theme-install-btn');
  if (!input || !chooseBtn || !installBtn) return;

  chooseBtn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    filenameEl.textContent = file.name;
    _setThemeUploadFeedback('Reading zip…', null);
    installBtn.hidden = true;
    _pendingTheme = null;

    try {
      const JSZip = await _loadJSZip();
      const zip = await JSZip.loadAsync(file);
      const files = Object.keys(zip.files).filter(n => !zip.files[n].dir);
      const jsFile = files.find(n => n.endsWith('.js'));
      const cssFile = files.find(n => n.endsWith('.css'));
      if (!jsFile || !cssFile) {
        _setThemeUploadFeedback('Zip must contain a <code>.js</code> and a <code>.css</code> file.', 'error');
        return;
      }
      const name = jsFile.replace(/\.js$/, '').replace(/^.*\//, '');
      const js = await zip.files[jsFile].async('string');
      const css = await zip.files[cssFile].async('string');
      _pendingTheme = { name, js, css };
      _setThemeUploadFeedback(`Ready to install theme: <strong>${name}</strong>`, 'ok');
      installBtn.hidden = false;
    } catch (e) {
      _setThemeUploadFeedback('Failed to read zip — ' + e.message, 'error');
    }
  });

  installBtn.addEventListener('click', async () => {
    if (!_pendingTheme) return;
    installBtn.disabled = true;
    installBtn.textContent = 'Installing…';
    _setThemeUploadFeedback('Validating and installing…', null);
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_pendingTheme),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = `<strong>${data.error}</strong>`;
        if (data.errors?.length) msg += `<ul>${data.errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        if (data.warnings?.length) msg += `<ul>${data.warnings.map(w => `<li>⚠ ${w}</li>`).join('')}</ul>`;
        _setThemeUploadFeedback(msg, 'error');
        return;
      }
      let msg = `Theme <strong>${data.name}</strong> installed.`;
      if (data.warnings?.length) msg += `<ul>${data.warnings.map(w => `<li>⚠ ${w}</li>`).join('')}</ul>`;
      _setThemeUploadFeedback(msg, data.warnings?.length ? 'warning' : 'ok');
      installBtn.hidden = true;
      input.value = '';
      filenameEl.textContent = '';
      _pendingTheme = null;
      await _loadThemeManager();
      const activeBtn = document.querySelector('#theme-picker-group .theme-pick-btn.active');
      _loadThemePicker(activeBtn?.dataset.theme || 'cinematic');
      showToast(`Theme "${data.name}" installed`, 'success');
    } catch (e) {
      _setThemeUploadFeedback('Install failed — ' + e.message, 'error');
    } finally {
      installBtn.disabled = false;
      installBtn.textContent = 'Install theme';
    }
  });
}

async function saveAppSettings() {
  const defaultCoverImage = document.getElementById('site-default-cover')?.value.trim() || null;
  const activeDefaultFocusBtn = document.querySelector('.default-cover-focus-btn.active');
  const defaultCoverImageFocus = activeDefaultFocusBtn ? activeDefaultFocusBtn.dataset.focus : 'center';
  const activeThemeBtn = document.querySelector('#theme-picker-group .theme-pick-btn.active');
  const theme = activeThemeBtn ? activeThemeBtn.dataset.theme : null;
  try {
    const res = await fetch('/api/site/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultCoverImage, defaultCoverImageFocus, ...(theme ? { theme } : {}) }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    showToast(theme ? `Settings saved — theme: ${theme}` : 'Settings saved', 'success');
  } catch (e) {
    console.error('Failed to save settings:', e);
    showToast('Settings save failed — ' + e.message, 'error');
  }
}

function _updateAccentButtons(rowId, color) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const customBtn = row.querySelector('.accent-custom-btn');
  const noneBtn = row.querySelector('.accent-none-btn');
  const picker = row.querySelector('.accent-picker-input');
  if (color) {
    customBtn?.classList.add('is-active');
    noneBtn?.classList.remove('is-active');
    if (customBtn) customBtn.style.background = color;
    if (picker && color.startsWith('#')) picker.value = color;
  } else {
    customBtn?.classList.remove('is-active');
    noneBtn?.classList.add('is-active');
    if (customBtn) customBtn.style.background = '';
  }
}

function _applySignalAccent(color) {
  if (color) {
    document.documentElement.style.setProperty('--color-accent', color);
    document.documentElement.style.setProperty('--color-accent-dim', `color-mix(in oklch, ${color} 15%, transparent)`);
    document.documentElement.style.setProperty('--color-accent-fg', accentFg(color));
  } else {
    document.documentElement.style.removeProperty('--color-accent');
    document.documentElement.style.removeProperty('--color-accent-dim');
    document.documentElement.style.removeProperty('--color-accent-fg');
  }
  fetch('/api/site/accent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signalAccent: color || null }),
  }).catch(() => {});
}

// Returns the best text colour for a given accent background.
// Crossover at oklch L ≈ 56% (equal WCAG contrast vs cream and near-black).
function accentFg(color) {
  let lum;
  if (color.startsWith('#') && color.length >= 7) {
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  } else {
    // oklch — L³ approximates relative luminance well enough for a threshold check
    const m = color.match(/oklch\(\s*([0-9.]+)%/);
    if (!m) return '#f0ede8';
    lum = Math.pow(parseFloat(m[1]) / 100, 3);
  }
  // lum > 0.175 → accent is lighter than the crossover → dark text reads better
  return lum > 0.175 ? '#1c1c1c' : '#f0ede8';
}

function _applyLiveAccent(color) {
  fetch('/api/site/accent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accent: color || null }),
  }).catch(() => {});
}

function _initAccentPickers() {
  // Signal
  const signalPicker = document.getElementById('signal-color-picker');
  const signalCustomBtn = document.getElementById('signal-custom-btn');
  const signalNoneBtn = document.getElementById('signal-none-btn');

  signalCustomBtn?.addEventListener('click', () => signalPicker?.click());
  const _onSignalPicker = () => {
    _updateAccentButtons('signal-swatch-row', signalPicker.value);
    _applySignalAccent(signalPicker.value);
  };
  // iOS fires 'change' not 'input' when the colour wheel closes; listen to both
  signalPicker?.addEventListener('input', _onSignalPicker);
  signalPicker?.addEventListener('change', _onSignalPicker);
  signalNoneBtn?.addEventListener('click', () => {
    _updateAccentButtons('signal-swatch-row', '');
    _applySignalAccent('');
  });

  // Live
  const livePicker = document.getElementById('live-color-picker');
  const liveCustomBtn = document.getElementById('live-custom-btn');
  const liveNoneBtn = document.getElementById('live-none-btn');

  liveCustomBtn?.addEventListener('click', () => livePicker?.click());
  const _onLivePicker = () => {
    _updateAccentButtons('live-swatch-row', livePicker.value);
    _applyLiveAccent(livePicker.value);
  };
  livePicker?.addEventListener('input', _onLivePicker);
  livePicker?.addEventListener('change', _onLivePicker);
  liveNoneBtn?.addEventListener('click', () => {
    _updateAccentButtons('live-swatch-row', '');
    _applyLiveAccent('');
  });

  // Apply Signal accent on boot from R2; migrate any legacy localStorage value on first run
  fetch('/api/site/accent').then(r => r.ok ? r.json() : {}).then(d => {
    if (d.signalAccent) {
      _applySignalAccent(d.signalAccent);
      localStorage.removeItem('signal-accent');
    } else {
      const legacy = localStorage.getItem('signal-accent');
      if (legacy) {
        _applySignalAccent(legacy);
        localStorage.removeItem('signal-accent');
      }
    }
  }).catch(() => {});
}

