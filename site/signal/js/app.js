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

export { navigate, invalidatePostCache, invalidatePageCache, getAllTags };

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
  document.getElementById('btn-rebuild-site').addEventListener('click', rebuildSite);
  document.getElementById('btn-deploy-site').addEventListener('click', deploySite);
  document.getElementById('btn-show-apikey').addEventListener('click', () => {
    const inp = document.getElementById('app-settings-apikey');
    const btn = document.getElementById('btn-show-apikey');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'Hide'; }
    else { inp.type = 'password'; btn.textContent = 'Show'; }
  });

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
  location.hash = h;
  _route(h);
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
  if (showSettings && settingsEl) _animateIn(settingsEl);
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
    if (!res.ok) return;
    allPosts = await res.json();
  } catch {}
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
      if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
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
    if (!res.ok) return;
    allPages = await res.json();
  } catch {}
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
      if (!confirm(`Delete page "${slug}"? This cannot be undone.`)) return;
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

async function deploySite() {
  const btn = document.getElementById('btn-deploy-site');
  btn.disabled = true;
  btn.textContent = 'Deploying…';
  try {
    const res = await fetch('/api/site/deploy', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    showToast('Deploy triggered — changes live in ~60s', 'success');
  } catch (e) {
    showToast('Deploy failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Deploy';
  }
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } finally {
    window.location.href = '/signal/login.html';
  }
}

// ── Settings page ─────────────────────────────────────────────────────────────

function openSettingsView() {
  const savedKey = localStorage.getItem('signal-apikey') || '';
  document.getElementById('app-settings-apikey').value = savedKey;
  document.getElementById('app-settings-apikey').type = 'password';
  document.getElementById('btn-show-apikey').textContent = 'Show';

  fetch('/api/site/accent').then(r => r.ok ? r.json() : {}).then(d => {
    _markActiveSwatch('signal-swatch-row', d.signalAccent || '');
    _markActiveSwatch('live-swatch-row', d.accent || '');
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
  }).catch(() => {});
}

async function saveAppSettings() {
  const apiKey = document.getElementById('app-settings-apikey').value.trim();
  if (apiKey) localStorage.setItem('signal-apikey', apiKey);
  else localStorage.removeItem('signal-apikey');

  const defaultCoverImage = document.getElementById('site-default-cover')?.value.trim() || null;
  const activeDefaultFocusBtn = document.querySelector('.default-cover-focus-btn.active');
  const defaultCoverImageFocus = activeDefaultFocusBtn ? activeDefaultFocusBtn.dataset.focus : 'center';
  try {
    await fetch('/api/site/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultCoverImage, defaultCoverImageFocus }),
    });
  } catch {}

  showToast('Settings saved', 'success');
}

function _markActiveSwatch(rowId, savedColor) {
  const row = document.getElementById(rowId);
  if (!row) return;
  let matched = false;
  row.querySelectorAll('.accent-swatch').forEach(s => {
    const match = savedColor && s.dataset.color.toLowerCase() === savedColor.toLowerCase();
    s.classList.toggle('is-active', match);
    if (match) matched = true;
  });
  const customBtn = row.querySelector('.accent-custom-btn');
  if (customBtn) {
    customBtn.classList.toggle('is-active', !matched && !!savedColor);
    customBtn.style.background = (!matched && savedColor) ? savedColor : '';
  }
  // Keep hidden picker in sync so it opens at the current custom colour
  const picker = row.querySelector('.accent-picker-input');
  if (picker && !matched && savedColor && savedColor.startsWith('#')) picker.value = savedColor;
}

function _applySignalAccent(color) {
  document.documentElement.style.setProperty('--color-accent', color);
  document.documentElement.style.setProperty('--color-accent-dim', `color-mix(in oklch, ${color} 15%, transparent)`);
  document.documentElement.style.setProperty('--color-accent-fg', accentFg(color));
  // Save to R2 — fire-and-forget, UI already updated instantly above
  fetch('/api/site/accent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signalAccent: color }),
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
    body: JSON.stringify({ accent: color }),
  }).catch(() => {});
}

function _initAccentPickers() {
  // Signal
  const signalRow = document.getElementById('signal-swatch-row');
  const signalPicker = document.getElementById('signal-color-picker');
  const signalCustomBtn = document.getElementById('signal-custom-btn');

  signalRow?.querySelectorAll('.accent-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      signalRow.querySelectorAll('.accent-swatch, .accent-custom-btn').forEach(s => s.classList.remove('is-active'));
      swatch.classList.add('is-active');
      if (signalCustomBtn) signalCustomBtn.style.background = '';
      _applySignalAccent(swatch.dataset.color);
    });
  });
  signalCustomBtn?.addEventListener('click', () => signalPicker?.click());
  const _onSignalPicker = () => {
    signalRow.querySelectorAll('.accent-swatch, .accent-custom-btn').forEach(s => s.classList.remove('is-active'));
    signalCustomBtn?.classList.add('is-active');
    if (signalCustomBtn) signalCustomBtn.style.background = signalPicker.value;
    _applySignalAccent(signalPicker.value);
  };
  // iOS fires 'change' not 'input' when the colour wheel closes; listen to both
  signalPicker?.addEventListener('input', _onSignalPicker);
  signalPicker?.addEventListener('change', _onSignalPicker);

  // Live
  const liveRow = document.getElementById('live-swatch-row');
  const livePicker = document.getElementById('live-color-picker');
  const liveCustomBtn = document.getElementById('live-custom-btn');

  liveRow?.querySelectorAll('.accent-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      liveRow.querySelectorAll('.accent-swatch, .accent-custom-btn').forEach(s => s.classList.remove('is-active'));
      swatch.classList.add('is-active');
      if (liveCustomBtn) liveCustomBtn.style.background = '';
      _applyLiveAccent(swatch.dataset.color);
    });
  });
  liveCustomBtn?.addEventListener('click', () => livePicker?.click());
  const _onLivePicker = () => {
    liveRow.querySelectorAll('.accent-swatch, .accent-custom-btn').forEach(s => s.classList.remove('is-active'));
    liveCustomBtn?.classList.add('is-active');
    if (liveCustomBtn) liveCustomBtn.style.background = livePicker.value;
    _applyLiveAccent(livePicker.value);
  };
  livePicker?.addEventListener('input', _onLivePicker);
  livePicker?.addEventListener('change', _onLivePicker);

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

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
