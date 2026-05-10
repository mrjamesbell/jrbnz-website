import { scheduleSave, saveNow, initAutosave, cancelScheduled } from './autosave.js';
import { renderMarkdown, countWords, slugify, fmtDate } from './markdown.js';
import { extractVideoId, insertYouTubeBlock, fetchYouTubeTitle } from './youtube.js';
import { openImageSheet } from './image-upload.js';
import { showToast } from './toast.js';
import { navigate, invalidatePostCache, invalidatePageCache, getAllTags } from './app.js';
import { SNIPPETS, snippetInsert } from './snippets.js';

let currentSlug = null;
let currentPost = null;
let currentType = 'post'; // 'post' | 'page'
let originalSlug = null;
let viewMode = 'edit';
let tags = [];
let splitDebounce = null;
let _snapshot = null;
let _isDirty = false;
let _snippetPickerInited = false;

// ── Module-level delegated handlers ───────────────────────────────────────────

document.addEventListener('click', e => {
  // YouTube remove button
  const removeBtn = e.target.closest('[data-action="remove-youtube"]');
  if (removeBtn) {
    const block = removeBtn.closest('.youtube-block');
    if (!block) return;
    const videoId = block.dataset.videoId;
    if (videoId && currentPost) {
      const re = new RegExp(`\\n?<!--\\s*signal:youtube\\s+id="${videoId}"[^>]*-->\\n?`, 'g');
      currentPost.body = (currentPost.body || '').replace(re, '\n');
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
    block.remove();
    return;
  }

  // YouTube size preset (Wide / Full)
  const sizePreset = e.target.closest('.youtube-size-preset');
  if (sizePreset) {
    const block = sizePreset.closest('.youtube-block');
    if (!block) return;
    const preset = sizePreset.dataset.preset; // "wide" or "full"
    block.classList.remove('align-left', 'align-center', 'align-right', 'width-wide', 'width-full');
    block.classList.add(`width-${preset}`);
    block.style.width = '';
    block.dataset.width = preset;
    block.querySelectorAll('.youtube-size-preset').forEach(p => p.classList.toggle('is-active', p === sizePreset));
    block.querySelectorAll('.youtube-align-pill').forEach(p => p.classList.remove('is-active'));
    block.querySelectorAll('.youtube-ctrl-label').forEach((el, i) => { if (i === 1) el.classList.add('is-muted'); });
    const wi = block.querySelector('.youtube-width-input');
    if (wi) wi.disabled = true;
    const videoId = block.dataset.videoId;
    if (videoId && currentPost) {
      currentPost.body = _rebuildYouTubeComment(currentPost.body, videoId, preset, block.dataset.align || 'center');
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
    return;
  }

  // YouTube align pill
  const alignPill = e.target.closest('.youtube-align-pill');
  if (alignPill) {
    const block = alignPill.closest('.youtube-block');
    if (!block) return;
    const align = alignPill.dataset.align;
    block.classList.remove('align-left', 'align-center', 'align-right');
    block.classList.add(`align-${align}`);
    block.dataset.align = align;
    alignPill.closest('.youtube-controls-bar').querySelectorAll('.youtube-align-pill')
      .forEach(p => p.classList.toggle('is-active', p === alignPill));
    const videoId = block.dataset.videoId;
    if (videoId && currentPost) {
      currentPost.body = _rebuildYouTubeComment(currentPost.body, videoId, block.dataset.width || '100', align);
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
  }

  // Image remove button
  const removeImgBtn = e.target.closest('[data-action="remove-image"]');
  if (removeImgBtn) {
    const block = removeImgBtn.closest('.image-block');
    if (!block) return;
    const src = block.dataset.src;
    if (src && currentPost) {
      const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\n?<!--\\s*signal:image\\s+src="${escapedSrc}"[^>]*-->\\n?`, 'g');
      currentPost.body = (currentPost.body || '').replace(re, '\n');
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
    block.remove();
    return;
  }

  // Image layout button
  const layoutBtn = e.target.closest('.image-layout-btn');
  if (layoutBtn) {
    const block = layoutBtn.closest('.image-block');
    if (!block) return;
    const layout = layoutBtn.dataset.layout;
    const isFull = layout === 'full';
    block.dataset.layout = layout;
    layoutBtn.closest('.image-controls-bar').querySelectorAll('.image-layout-btn')
      .forEach(p => p.classList.toggle('is-active', p === layoutBtn));
    const wi = block.querySelector('.image-width-input');
    const widthLabel = block.querySelectorAll('.image-ctrl-label')[1];
    if (wi) wi.disabled = isFull;
    if (widthLabel) widthLabel.classList.toggle('is-muted', isFull);
    const width = isFull ? 100 : parseInt(wi?.value || '100', 10);
    if (isFull) {
      block.dataset.width = '100';
      if (wi) wi.value = 100;
    }
    const src = block.dataset.src;
    if (src && currentPost) {
      currentPost.body = _rebuildImageComment(currentPost.body, src, block.dataset.alt || '', layout, String(width));
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
  }
});

document.addEventListener('input', e => {
  // YouTube width input
  const ytWidthInput = e.target.closest('.youtube-width-input');
  if (ytWidthInput) {
    const block = ytWidthInput.closest('.youtube-block');
    if (!block) return;
    const pct = Math.max(20, Math.min(100, parseInt(ytWidthInput.value, 10) || 100));

    block.classList.remove('width-wide', 'width-full');
    const align = block.dataset.align || 'center';
    block.classList.remove('align-left', 'align-center', 'align-right');
    block.classList.add(`align-${align}`);
    block.style.width = `${pct}%`;
    block.dataset.width = String(pct);
    block.querySelectorAll('.youtube-size-preset').forEach(p => p.classList.remove('is-active'));
    block.querySelectorAll('.youtube-align-pill').forEach(p => p.classList.toggle('is-active', p.dataset.align === align));
    block.querySelectorAll('.youtube-ctrl-label').forEach(el => el.classList.remove('is-muted'));
    ytWidthInput.disabled = false;

    const videoId = block.dataset.videoId;
    if (videoId && currentPost) {
      currentPost.body = _rebuildYouTubeComment(currentPost.body, videoId, String(pct), align);
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
    return;
  }

  // Image width input
  const imgWidthInput = e.target.closest('.image-width-input');
  if (imgWidthInput) {
    const block = imgWidthInput.closest('.image-block');
    if (!block) return;
    const pct = Math.max(10, Math.min(100, parseInt(imgWidthInput.value, 10) || 100));
    block.dataset.width = String(pct);
    const src = block.dataset.src;
    if (src && currentPost) {
      currentPost.body = _rebuildImageComment(currentPost.body, src, block.dataset.alt || '', block.dataset.layout || 'full', String(pct));
      const ta = document.getElementById('editor-textarea');
      if (ta) ta.value = currentPost.body;
      _triggerSave();
    }
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

function _getApiBase() {
  return currentType === 'page' ? '/api/pages' : '/api/posts';
}

export async function openEditor(slug, type = 'post') {
  currentSlug = slug;
  currentType = type;
  originalSlug = slug;

  const isNew = slug === 'new';

  // Update back button label
  const backLabelEl = document.getElementById('topbar-back-label');
  if (backLabelEl) backLabelEl.textContent = type === 'page' ? 'Pages' : 'Posts';
  const backEl = document.getElementById('topbar-breadcrumb');
  if (backEl) backEl.href = type === 'page' ? '/signal/pages' : '/signal/';

  // Show editor, hide other views
  document.getElementById('view-list').style.display = 'none';
  document.getElementById('view-pages')?.style && (document.getElementById('view-pages').style.display = 'none');
  document.getElementById('media-view').style.display = 'none';
  const editorEl = document.getElementById('view-editor');
  if (editorEl) {
    editorEl.style.display = 'flex';
    editorEl.classList.remove('is-entering');
    void editorEl.offsetWidth;
    editorEl.classList.add('is-entering');
  }

  initAutosave();

  if (isNew) {
    currentPost = {
      slug: '',
      title: '',
      date: new Date().toISOString().slice(0, 10),
      tags: [],
      include_in_menu: false,
      nav_url: null,
      status: 'draft',
      body: '',
      excerpt: '',
      coverImage: null,
      wordCount: 0
    };
    _isDirty = false;
    _snapshot = null;
    _populateEditor();
    return;
  }

  try {
    const res = await fetch(`${_getApiBase()}/${slug}`);
    if (!res.ok) throw new Error(`${type === 'page' ? 'Page' : 'Post'} not found`);
    currentPost = await res.json();
    _isDirty = false;
    _snapshot = _takeSnapshot();
    _populateEditor();
  } catch (e) {
    showToast('Failed to load: ' + e.message, 'error');
  }
}

export function closeEditor() {
  // Commit any text typed in the tag input that wasn't confirmed with Enter
  const tagInput = document.getElementById('tag-input');
  if (tagInput && tagInput.value.trim() && currentPost) {
    const val = tagInput.value.trim().replace(/^#/, '');
    if (val && !tags.includes(val)) {
      tags.push(val);
      currentPost.tags = tags;
      _markDirty();
    }
  }

  if (_isDirty && currentSlug && currentPost) {
    const slug = currentSlug;
    const apiBase = _getApiBase();
    const payload = { title: currentPost.title, body: currentPost.body, tags: currentPost.tags, date: currentPost.date, excerpt: currentPost.excerpt, coverImage: currentPost.coverImage, include_in_menu: currentPost.include_in_menu, wordCount: currentPost.wordCount };
    fetch(`${apiBase}/${slug}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
  }
  cancelScheduled();
  currentSlug = null;
  currentPost = null;
  const editorEl = document.getElementById('view-editor');
  if (editorEl) editorEl.style.display = 'none';
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = '';
  const viewPostBtn = document.getElementById('btn-view-post');
  if (viewPostBtn) viewPostBtn.style.display = 'none';
}

// ── Editor initialisation ─────────────────────────────────────────────────────

function _populateEditor() {
  const titleInput = document.getElementById('post-title-input');
  const textarea = document.getElementById('editor-textarea');

  titleInput.value = currentPost.title || '';
  textarea.value = currentPost.body || '';
  tags = Array.isArray(currentPost.tags) ? [...currentPost.tags] : [];

  // Show/hide type-specific UI
  const metaRow = document.getElementById('post-meta-row');
  if (metaRow) metaRow.style.display = currentType === 'page' ? 'none' : '';

  _updateTitleDisplay();
  _renderTags();
  _updateWordCount();
  _autoResizeTitle();
  _autoResizeTextarea();
  _updatePublishButton();

  const viewPostBtn = document.getElementById('btn-view-post');
  if (viewPostBtn) {
    if (currentPost.status === 'published') {
      viewPostBtn.href = currentType === 'page' ? `/${currentSlug}/` : `/posts/${currentSlug}/`;
      viewPostBtn.style.display = '';
    } else {
      viewPostBtn.style.display = 'none';
    }
  }

  // Listeners — use fresh references to avoid stacking on re-open
  titleInput.removeEventListener('input', _onTitleChange);
  titleInput.addEventListener('input', _onTitleChange);
  textarea.removeEventListener('input', _onBodyChange);
  textarea.addEventListener('input', _onBodyChange);
  textarea.removeEventListener('paste', _onPaste);
  textarea.addEventListener('paste', _onPaste);
  textarea.removeEventListener('keydown', _onKeydown);
  textarea.addEventListener('keydown', _onKeydown);

  // Format bar — single delegated listener
  const fmtbar = document.getElementById('editor-fmtbar');
  fmtbar.onclick = _onFmtBarClick;
  document.getElementById('kb-accessory-bar').onclick = _onFmtBarClick;

  // Snippet picker
  _initSnippetPicker();

  _setViewMode('edit');
  _initReviewBtn();

  // Tags
  document.getElementById('btn-add-tag').onclick = _showTagInput;
  document.getElementById('tag-input').onkeydown = _onTagKeydown;
  document.getElementById('tag-input').onblur = _onTagBlur;

  // Settings modal
  document.getElementById('btn-settings').onclick = _openSettings;
  document.getElementById('settings-close').onclick = _closeSettings;
  document.getElementById('settings-cancel').onclick = _closeSettings;
  document.getElementById('settings-save').onclick = _saveSettings;
  document.getElementById('settings-delete').onclick = _confirmDelete;
  document.getElementById('settings-slug').oninput = _onSlugInput;
  document.getElementById('settings-excerpt').oninput = _onExcerptInput;

  // Delete modal
  document.getElementById('delete-close').onclick = _closeDelete;
  document.getElementById('delete-cancel').onclick = _closeDelete;
  document.getElementById('delete-confirm').onclick = _deletePost;

  // Publish / Revert
  document.getElementById('btn-publish').onclick = _publish;
  document.getElementById('btn-revert').onclick = _revertChanges;
  _updateRevertButton();
}

function _onTitleChange() {
  currentPost.title = document.getElementById('post-title-input').value;
  _updateTitleDisplay();
  _autoResizeTitle();
  _markDirty();
  _triggerSave();
}

function _onBodyChange() {
  const textarea = _getActiveTextarea();
  currentPost.body = textarea.value;
  _updateWordCount();
  _markDirty();
  _triggerSave();
  if (viewMode === 'split') _updateSplitPreview();
  if (viewMode === 'edit') _autoResizeTextarea();
}

function _onPaste(e) {
  const text = e.clipboardData.getData('text');
  if (!text) return;

  // Intercept if the clipboard looks like a standalone YouTube URL
  // (single line, under 300 chars — handles URLs with trailing whitespace/newlines)
  const trimmed = text.trim();
  const videoId = !trimmed.includes('\n') && trimmed.length < 300 ? extractVideoId(trimmed) : null;
  if (videoId) {
    e.preventDefault();
    const textarea = document.getElementById('editor-textarea');
    insertYouTubeBlock(textarea, videoId);
    fetchYouTubeTitle(videoId).then(title => {
      showToast(`YouTube: ${title}`, 'default', 2000);
    });
    return;
  }

  if (text.length > 200 && (text.includes('#') || text.includes('**') || text.includes('['))) {
    showToast('Markdown detected — pasted as-is. Switch to Read view to preview.');
  }
}

function _onKeydown(e) {
  const meta = e.metaKey || e.ctrlKey;
  const textarea = document.getElementById('editor-textarea');
  if (!meta) return;
  if (e.key === 'b') { e.preventDefault(); _applyFormat('bold', textarea); }
  if (e.key === 'i') { e.preventDefault(); _applyFormat('italic', textarea); }
  if (e.key === 'k') { e.preventDefault(); _applyFormat('link', textarea); }
  if (e.key === 'H' || (e.shiftKey && e.key === 'H')) { e.preventDefault(); _applyFormat('h2', textarea); }
  if (e.key === '.' && e.shiftKey) { e.preventDefault(); _applyFormat('quote', textarea); }
}

function _onFmtBarClick(e) {
  // View mode pill
  const viewBtn = e.target.closest('.fmtbar-view-btn');
  if (viewBtn) { _setViewMode(viewBtn.dataset.view); return; }

  // AI review button (handled separately, not a data-action)
  if (e.target.closest('#btn-ai-review')) return;

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const textarea = _getActiveTextarea();
  _applyFormat(btn.dataset.action, textarea);
}

function _getActiveTextarea() {
  if (viewMode === 'split') return document.getElementById('editor-textarea-split');
  return document.getElementById('editor-textarea');
}

function _applyFormat(action, textarea) {
  switch (action) {
    case 'bold':    _wrapSelection(textarea, '**', '**'); break;
    case 'italic':  _wrapSelection(textarea, '_', '_'); break;
    case 'h2':      _prefixLine(textarea, '## '); break;
    case 'h3':      _prefixLine(textarea, '### '); break;
    case 'quote':   _prefixLine(textarea, '> '); break;
    case 'ul':      _prefixLine(textarea, '- '); break;
    case 'divider': _insertAtCursor(textarea, '\n---\n'); break;
    case 'link': {
      const url = prompt('URL:');
      if (!url) break;
      const { selectionStart: s, selectionEnd: end, value } = textarea;
      const sel = value.slice(s, end) || '';
      const md = `[${sel}](${url})`;
      textarea.value = value.slice(0, s) + md + value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = s + md.length;
      textarea.dispatchEvent(new Event('input'));
      break;
    }
    case 'image':
    case 'img':
      openImageSheet(textarea);
      break;
    case 'youtube': {
      const url = prompt('YouTube URL:');
      if (!url) break;
      const videoId = extractVideoId(url);
      if (videoId) {
        insertYouTubeBlock(textarea, videoId);
        fetchYouTubeTitle(videoId).then(title => showToast(`YouTube: ${title}`, 'default', 2000));
      } else {
        showToast('Not a valid YouTube URL', 'error');
      }
      break;
    }
  }
}

function _wrapSelection(textarea, before, after) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  textarea.value = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

function _rebuildYouTubeComment(body, videoId, width, align) {
  return (body || '').replace(
    new RegExp(`<!--\\s*signal:youtube\\s+id="${videoId}"[^>]*-->`, 'g'),
    `<!-- signal:youtube id="${videoId}" width="${width}" align="${align}" -->`
  );
}

function _rebuildImageComment(body, src, alt, layout, width) {
  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<!--\\s*signal:image\\s+src="${escapedSrc}"[^>]*-->`, 'g');
  const escapedAlt = (alt || '').replace(/"/g, '&quot;');
  const widthAttr = layout !== 'full' ? ` width="${width}"` : '';
  return (body || '').replace(re, `<!-- signal:image src="${src}" alt="${escapedAlt}" layout="${layout}"${widthAttr} -->`);
}

function _prefixLine(textarea, prefix) {
  const { selectionStart: start, value } = textarea;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const before = value.slice(lineStart, start);
  const alreadyPrefixed = before.startsWith(prefix);
  if (alreadyPrefixed) {
    textarea.value = value.slice(0, lineStart) + value.slice(lineStart + prefix.length);
    textarea.selectionStart = textarea.selectionEnd = start - prefix.length;
  } else {
    textarea.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
  }
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

function _insertAtCursor(textarea, text) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

function _initSnippetPicker() {
  if (_snippetPickerInited) return;
  const btn = document.getElementById('btn-snippet');
  const picker = document.getElementById('snippet-picker');
  if (!btn || !picker) return;
  _snippetPickerInited = true;

  picker.innerHTML = SNIPPETS.map(s =>
    `<button class="snippet-item" data-snippet-id="${s.id}">${s.label}</button>`
  ).join('');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isHidden = picker.hidden;
    picker.hidden = !isHidden;
    if (isHidden) {
      const r = btn.getBoundingClientRect();
      picker.style.top = (r.bottom + 4) + 'px';
      picker.style.left = r.left + 'px';
    }
  });

  picker.addEventListener('click', e => {
    const item = e.target.closest('.snippet-item');
    if (!item) return;
    const snippet = SNIPPETS.find(s => s.id === item.dataset.snippetId);
    if (!snippet) return;
    const textarea = _getActiveTextarea();
    _insertAtCursor(textarea, '\n' + snippetInsert(snippet) + '\n');
    picker.hidden = true;
  });

  document.addEventListener('click', () => { picker.hidden = true; });
}

function _setViewMode(mode) {
  viewMode = mode;
  const editArea = document.getElementById('editor-textarea');
  const splitView = document.getElementById('editor-split-view');
  const readView = document.getElementById('editor-read-view');

  document.querySelectorAll('.fmtbar-view-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === mode);
  });

  if (mode === 'edit') {
    editArea.style.display = '';
    splitView.style.display = 'none';
    readView.style.display = 'none';
    _autoResizeTextarea();
  } else if (mode === 'split') {
    editArea.style.display = 'none';
    splitView.style.display = 'flex';
    readView.style.display = 'none';
    const splitTA = document.getElementById('editor-textarea-split');
    splitTA.value = currentPost.body || '';
    splitTA.removeEventListener('input', _onSplitInput);
    splitTA.addEventListener('input', _onSplitInput);
    _updateSplitPreview();
  } else if (mode === 'read') {
    editArea.style.display = 'none';
    splitView.style.display = 'none';
    readView.style.display = '';
    const preview = document.getElementById('read-preview');
    if (preview) preview.innerHTML = renderMarkdown(currentPost.body || '');
  }
}

function _onSplitInput() {
  const splitTA = document.getElementById('editor-textarea-split');
  currentPost.body = splitTA.value;
  document.getElementById('editor-textarea').value = splitTA.value;
  _updateWordCount();
  _triggerSave();
  clearTimeout(splitDebounce);
  splitDebounce = setTimeout(_updateSplitPreview, 300);
}

function _updateSplitPreview() {
  const preview = document.getElementById('split-preview');
  if (preview) preview.innerHTML = renderMarkdown(currentPost.body || '');
}

function _updateTitleDisplay() {
  const title = currentPost.title || 'Untitled';
  document.getElementById('topbar-title').textContent = title;
  document.title = `${title} — Signal Admin`;
}

function _updateWordCount() {
  const wc = countWords(currentPost.body || '');
  currentPost.wordCount = wc;
  document.getElementById('topbar-word-count').textContent = wc > 0 ? `${wc} words` : '';
  const sep = document.getElementById('topbar-save-sep');
  if (sep) sep.style.display = wc > 0 ? '' : 'none';
}

function _autoResizeTitle() {
  const el = document.getElementById('post-title-input');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function _autoResizeTextarea() {
  const el = document.getElementById('editor-textarea');
  if (!el) return;
  el.style.height = '0';
  el.style.height = el.scrollHeight + 'px';
}

function _renderTags() {
  const container = document.getElementById('meta-tags-container');
  if (!container) return;
  container.innerHTML = tags.map(tag => `
    <span class="meta-tag" data-tag="${tag}">
      #${tag}<span class="tag-remove" data-remove="${tag}">×</span>
    </span>`).join('');
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      tags = tags.filter(t => t !== btn.dataset.remove);
      currentPost.tags = tags;
      _renderTags();
      _markDirty();
      _triggerSave();
    });
  });
}

function _showTagInput(e) {
  e.preventDefault();
  const input = document.getElementById('tag-input');
  const addBtn = document.getElementById('btn-add-tag');
  if (input) {
    const dl = document.getElementById('tag-suggestions');
    if (dl) {
      const existing = new Set(tags);
      dl.innerHTML = getAllTags()
        .filter(t => !existing.has(t))
        .map(t => `<option value="${t}">`)
        .join('');
    }
    input.style.display = '';
    input.focus();
  }
  if (addBtn) addBtn.style.display = 'none';
}

function _onTagKeydown(e) {
  const input = e.target;
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = input.value.trim().replace(/^#/, '');
    if (val && !tags.includes(val)) {
      tags.push(val);
      currentPost.tags = tags;
      _renderTags();
      _markDirty();
      _triggerSave();
    }
    input.value = '';
  }
  if (e.key === 'Escape') {
    input.style.display = 'none';
    const addBtn = document.getElementById('btn-add-tag');
    if (addBtn) addBtn.style.display = '';
    input.value = '';
  }
  if (e.key === 'Backspace' && !input.value) {
    tags.pop();
    currentPost.tags = tags;
    _renderTags();
    _triggerSave();
  }
}

function _onTagBlur() {
  const input = document.getElementById('tag-input');
  if (!input) return;
  const val = input.value.trim().replace(/^#/, '');
  if (val && !tags.includes(val)) {
    tags.push(val);
    currentPost.tags = tags;
    _renderTags();
    _markDirty();
    _triggerSave();
  }
  input.value = '';
  input.style.display = 'none';
  const addBtn = document.getElementById('btn-add-tag');
  if (addBtn) addBtn.style.display = '';
}

function _triggerSave() {
  if (!currentSlug || currentSlug === 'new') return;
  scheduleSave(
    () => ({
      slug: currentSlug,
      apiBase: _getApiBase(),
      title: currentPost.title,
      body: currentPost.body,
      tags: currentPost.tags,
      date: currentPost.date,
      excerpt: currentPost.excerpt,
      coverImage: currentPost.coverImage,
      include_in_menu: currentPost.include_in_menu,
      nav_url: currentPost.nav_url || null,
      wordCount: currentPost.wordCount
    }),
    () => {},
    (e) => showToast('Save failed — ' + e.message, 'error')
  );
}

function _updatePublishButton() {
  const btn = document.getElementById('btn-publish');
  const draftPill = document.getElementById('topbar-draft-pill');
  if (!btn) return;
  if (currentPost.status === 'published' && !_isDirty) {
    btn.textContent = 'Published';
    btn.classList.add('is-published');
    btn.classList.remove('is-republish');
    if (draftPill) draftPill.style.display = 'none';
  } else if (currentPost.status === 'published' && _isDirty) {
    btn.textContent = 'Republish';
    btn.classList.remove('is-published');
    btn.classList.add('is-republish');
    if (draftPill) draftPill.style.display = 'none';
  } else {
    btn.textContent = 'Publish';
    btn.classList.remove('is-published', 'is-republish');
    if (draftPill) draftPill.style.display = '';
  }
}

function _updateRevertButton() {
  const btn = document.getElementById('btn-revert');
  if (btn) btn.style.display = (_isDirty && _snapshot) ? '' : 'none';
}

function _markDirty() {
  if (_isDirty) return;
  _isDirty = true;
  _updatePublishButton();
  _updateRevertButton();
}

function _takeSnapshot() {
  return {
    title: currentPost.title,
    body: currentPost.body,
    tags: [...(currentPost.tags || [])],
    date: currentPost.date,
    excerpt: currentPost.excerpt,
    coverImage: currentPost.coverImage,
    include_in_menu: currentPost.include_in_menu,
    nav_url: currentPost.nav_url || null,
  };
}

function _revertChanges() {
  if (!_snapshot) return;
  currentPost.title = _snapshot.title;
  currentPost.body = _snapshot.body;
  currentPost.tags = [..._snapshot.tags];
  currentPost.date = _snapshot.date;
  currentPost.excerpt = _snapshot.excerpt;
  currentPost.coverImage = _snapshot.coverImage;
  currentPost.include_in_menu = _snapshot.include_in_menu;
  tags = [..._snapshot.tags];

  document.getElementById('post-title-input').value = currentPost.title || '';
  document.getElementById('editor-textarea').value = currentPost.body || '';
  if (viewMode === 'split') {
    const splitTA = document.getElementById('editor-textarea-split');
    if (splitTA) splitTA.value = currentPost.body || '';
    _updateSplitPreview();
  }

  _updateTitleDisplay();
  _renderTags();
  _updateWordCount();
  _autoResizeTitle();

  _isDirty = false;
  _updatePublishButton();
  _updateRevertButton();

  saveNow(() => ({
    slug: currentSlug,
    apiBase: _getApiBase(),
    title: currentPost.title,
    body: currentPost.body,
    tags: currentPost.tags,
    date: currentPost.date,
    excerpt: currentPost.excerpt,
    coverImage: currentPost.coverImage,
    include_in_menu: currentPost.include_in_menu,
    nav_url: currentPost.nav_url || null,
    wordCount: currentPost.wordCount
  })).catch(e => showToast('Revert save failed — ' + e.message, 'error'));

  showToast('Reverted', 'default', 1500);
}

async function _publish() {
  const btn = document.getElementById('btn-publish');
  if (!currentSlug || currentSlug === 'new' || !currentPost) {
    showToast('Save the post first', 'error');
    return;
  }

  // Snapshot values before any async work so they're safe if editor closes mid-flight
  const slug = currentSlug;
  const payload = {
    slug,
    apiBase: _getApiBase(),
    title: currentPost.title,
    body: currentPost.body,
    tags: currentPost.tags,
    date: currentPost.date,
    excerpt: currentPost.excerpt,
    coverImage: currentPost.coverImage,
    include_in_menu: currentPost.include_in_menu,
    nav_url: currentPost.nav_url || null,
    wordCount: currentPost.wordCount
  };

  btn.disabled = true;
  btn.textContent = 'Publishing…';

  try {
    await saveNow(() => payload);

    const res = await fetch(`${_getApiBase()}/${slug}/publish`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (currentPost) {
      currentPost.status = 'published';
      _snapshot = _takeSnapshot();
      _isDirty = false;
      _updatePublishButton();
      _updateRevertButton();
      const btnEl = document.getElementById('btn-publish');
      if (btnEl) {
        btnEl.classList.add('just-published');
        setTimeout(() => btnEl.classList.remove('just-published'), 450);
      }
    }
    if (currentType === 'page') invalidatePageCache(); else invalidatePostCache();

    const viewBtn = document.getElementById('btn-view-post');
    const defaultUrl = currentType === 'page' ? `/${slug}/` : `/posts/${slug}/`;
    if (viewBtn) { viewBtn.href = data.url || defaultUrl; viewBtn.style.display = ''; }

    showToast('Published ↗', 'success', 4000);
  } catch (e) {
    showToast('Publish failed — ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Settings modal ────────────────────────────────────────────────────────────

function _openSettings(e) {
  e && e.preventDefault();
  document.getElementById('settings-slug').value = currentSlug;
  document.getElementById('settings-date').value = currentPost.date || new Date().toISOString().slice(0, 10);
  document.getElementById('settings-excerpt').value = currentPost.excerpt || '';
  document.getElementById('settings-cover').value = currentPost.coverImage || '';

  const isPage = currentType === 'page';
  const slugHint = document.getElementById('settings-slug-hint');
  if (slugHint) slugHint.textContent = isPage ? 'URL: jrbnz.com/' : 'URL: jrbnz.com/posts/';
  const dateRow = document.getElementById('settings-date-row');
  if (dateRow) dateRow.style.display = isPage ? 'none' : '';
  const excerptRow = document.getElementById('settings-excerpt-row');
  if (excerptRow) excerptRow.style.display = isPage ? 'none' : '';
  const coverRow = document.getElementById('settings-cover-row');
  if (coverRow) coverRow.style.display = isPage ? 'none' : '';
  const menuRow = document.getElementById('settings-menu-row');
  if (menuRow) menuRow.style.display = isPage ? '' : 'none';
  const menuCheck = document.getElementById('settings-include-menu');
  if (menuCheck) {
    menuCheck.checked = !!currentPost.include_in_menu;
    menuCheck.onchange = () => {
      const urlRow = document.getElementById('settings-nav-url-row');
      if (urlRow) urlRow.style.display = menuCheck.checked ? '' : 'none';
    };
  }
  const navUrlRow = document.getElementById('settings-nav-url-row');
  if (navUrlRow) navUrlRow.style.display = currentPost.include_in_menu ? '' : 'none';
  const navUrlInput = document.getElementById('settings-nav-url');
  if (navUrlInput) navUrlInput.value = currentPost.nav_url || '';
  const deleteBtn = document.getElementById('settings-delete');
  if (deleteBtn) deleteBtn.textContent = isPage ? 'Delete page' : 'Delete post';

  _updateSlugPreview();
  _updateExcerptCount();
  document.getElementById('settings-modal').style.display = 'flex';
}

function _closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function _onSlugInput() {
  _updateSlugPreview();
  const newSlug = document.getElementById('settings-slug').value;
  const warn = document.getElementById('settings-slug-warn');
  if (warn) warn.style.display = (newSlug !== originalSlug && currentPost.status === 'published') ? '' : 'none';
}

function _updateSlugPreview() {
  const el = document.getElementById('settings-slug-preview');
  const slug = document.getElementById('settings-slug').value || '';
  if (el) el.textContent = currentType === 'page' ? `jrbnz.com/${slug}/` : `jrbnz.com/posts/${slug}/`;
}

function _onExcerptInput() { _updateExcerptCount(); }

function _updateExcerptCount() {
  const val = document.getElementById('settings-excerpt').value;
  const cnt = document.getElementById('settings-excerpt-count');
  if (cnt) cnt.textContent = `${val.length}/160`;
}

async function _saveSettings() {
  const newSlug = document.getElementById('settings-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (!newSlug) { showToast('Slug cannot be empty', 'error'); return; }

  const isPage = currentType === 'page';

  if (!isPage) {
    const date = document.getElementById('settings-date').value;
    const excerpt = document.getElementById('settings-excerpt').value;
    const coverImage = document.getElementById('settings-cover').value.trim() || null;
    currentPost.date = date;
    currentPost.excerpt = excerpt;
    currentPost.coverImage = coverImage;
  } else {
    const menuCheck = document.getElementById('settings-include-menu');
    if (menuCheck) currentPost.include_in_menu = menuCheck.checked;
    const navUrlInput = document.getElementById('settings-nav-url');
    if (navUrlInput) currentPost.nav_url = navUrlInput.value.trim() || null;
  }

  if (newSlug !== currentSlug) {
    const renameUrl = isPage
      ? `/api/pages/${currentSlug}/rename`
      : `/api/posts/${currentSlug}/rename`;
    try {
      const res = await fetch(renameUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSlug })
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Rename failed', 'error');
        return;
      }
      originalSlug = newSlug;
      currentSlug = newSlug;
      navigate(isPage ? `#edit-page/${newSlug}` : `#edit/${newSlug}`);
    } catch (e) {
      showToast('Rename failed: ' + e.message, 'error');
      return;
    }
  }

  _closeSettings();
  _triggerSave();
  showToast('Settings saved', 'default', 1500);
}

function _confirmDelete(e) {
  e.preventDefault();
  _closeSettings();
  document.getElementById('delete-modal').style.display = 'flex';
}

function _closeDelete() {
  document.getElementById('delete-modal').style.display = 'none';
}

async function _deletePost() {
  _closeDelete();
  try {
    const res = await fetch(`${_getApiBase()}/${currentSlug}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    if (currentType === 'page') { invalidatePageCache(); showToast('Page deleted', 'default'); navigate('#pages'); }
    else { invalidatePostCache(); showToast('Post deleted', 'default'); navigate('#'); }
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

// ── AI Review ─────────────────────────────────────────────────────────────────

function _initReviewBtn() {
  document.getElementById('btn-ai-review').onclick = _runReview;
}

async function _runReview() {
  if (!currentSlug || !currentPost) return;
  const btn = document.getElementById('btn-ai-review');

  // Open synchronously before any await to bypass popup blockers
  const reviewWin = window.open('', '_blank');
  if (!reviewWin) {
    showToast('Allow popups for this site to use Review', 'error');
    return;
  }

  const loadingHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Reviewing…</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #faf8f4; color: #2a2520; margin: 0; padding: 48px;
    max-width: 740px; margin: 0 auto; }
  .spinner { width: 20px; height: 20px; border: 2px solid #ddd;
    border-top-color: #4a9; border-radius: 50%;
    animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading { display: flex; align-items: center; gap: 12px; color: #888;
    margin-top: 80px; font-size: 15px; }
</style></head><body>
<div class="loading"><div class="spinner"></div>Reviewing your post…</div>
</body></html>`;
  reviewWin.document.write(loadingHtml);
  reviewWin.document.close();

  btn.disabled = true;
  btn.textContent = '🔍 Reviewing…';

  try {
    const res = await fetch(`/api/posts/${currentSlug}/review`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }
    const { review } = await res.json();
    const reviewHtml = renderMarkdown(review);
    const title = currentPost.title ? `Review: ${currentPost.title}` : 'Post Review';
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #faf8f4; color: #2a2520; margin: 0; padding: 48px 64px 80px;
    max-width: 740px; margin: 0 auto; line-height: 1.7; font-size: 15px; }
  h1 { font-size: 18px; font-weight: 700; color: #3a8a72; margin: 0 0 4px;
    letter-spacing: -0.01em; }
  .post-title { font-size: 13px; color: #888; margin-bottom: 32px; }
  hr { border: none; border-top: 1px solid #e5e0d8; margin: 28px 0; }
  h2 { font-size: 12px; font-weight: 700; letter-spacing: 0.07em;
    text-transform: uppercase; color: #888; margin: 28px 0 8px; }
  h3 { font-size: 13px; font-weight: 600; color: #555; margin: 20px 0 6px; }
  p { margin: 0 0 14px; }
  ul, ol { padding-left: 22px; margin: 0 0 14px; }
  li { margin-bottom: 6px; }
  strong { color: #1a1510; }
  em { color: #555; }
  code { background: #ede9e2; padding: 1px 5px; border-radius: 3px;
    font-family: monospace; font-size: 13px; }
</style></head><body>
<h1>🔍 Post Review</h1>
<div class="post-title">${currentPost.title || currentSlug}</div>
<hr>
${reviewHtml}
</body></html>`;
    reviewWin.document.open();
    reviewWin.document.write(fullHtml);
    reviewWin.document.close();
  } catch (e) {
    const errHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Review Error</title>
<style>body{font-family:sans-serif;padding:48px;color:#c00;}</style></head>
<body><p>Review failed: ${e.message}</p></body></html>`;
    reviewWin.document.open();
    reviewWin.document.write(errHtml);
    reviewWin.document.close();
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Review';
  }
}
