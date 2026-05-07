import { scheduleSave, saveNow, initAutosave, cancelScheduled } from './autosave.js';
import { renderMarkdown, countWords, slugify, fmtDate } from './markdown.js';
import { extractVideoId, insertYouTubeBlock, fetchYouTubeTitle } from './youtube.js';
import { openImageSheet } from './image-upload.js';
import { showToast } from './toast.js';
import { navigate } from './app.js';

let currentSlug = null;
let currentPost = null;
let originalSlug = null;
let viewMode = 'edit'; // 'edit' | 'split' | 'read'
let tags = [];
let splitDebounce = null;

export async function openEditor(slug) {
  currentSlug = slug;
  originalSlug = slug;

  const isNew = slug === 'new';
  const editorWrap = document.getElementById('editor-writing-wrap');
  const listView = document.getElementById('post-list-view');
  const mediaView = document.getElementById('media-view');

  if (listView) listView.style.display = 'none';
  if (mediaView) mediaView.style.display = 'none';
  if (editorWrap) { editorWrap.style.display = 'flex'; editorWrap.style.flexDirection = 'column'; }

  document.getElementById('topbar-sep').style.display = '';
  document.getElementById('btn-publish').style.display = '';
  document.getElementById('topbar-save-status').style.display = 'flex';

  initAutosave();

  if (isNew) {
    currentPost = {
      slug: '',
      title: '',
      date: new Date().toISOString().slice(0, 10),
      tags: [],
      status: 'draft',
      body: '',
      excerpt: '',
      coverImage: null,
      wordCount: 0
    };
    _populateEditor();
    return;
  }

  try {
    const res = await fetch(`/api/posts/${slug}`);
    if (!res.ok) throw new Error('Post not found');
    currentPost = await res.json();
    _populateEditor();
  } catch (e) {
    showToast('Failed to load post: ' + e.message, 'error');
  }
}

export function closeEditor() {
  cancelScheduled();
  currentSlug = null;
  currentPost = null;
  const editorWrap = document.getElementById('editor-writing-wrap');
  if (editorWrap) editorWrap.style.display = 'none';
  document.getElementById('topbar-sep').style.display = 'none';
  document.getElementById('topbar-title').textContent = '';
  document.getElementById('btn-publish').style.display = 'none';
  document.getElementById('topbar-save-status').style.display = 'none';
  document.getElementById('btn-view-post').style.display = 'none';
}

function _populateEditor() {
  const titleInput = document.getElementById('post-title-input');
  const textarea = document.getElementById('editor-textarea');

  titleInput.value = currentPost.title || '';
  textarea.value = currentPost.body || '';
  tags = Array.isArray(currentPost.tags) ? [...currentPost.tags] : [];

  _updateTitleDisplay();
  _renderTags();
  _updateWordCount();
  _autoResizeTitle();
  _updatePublishButton();

  if (currentPost.status === 'published') {
    document.getElementById('btn-view-post').href = `/posts/${currentSlug}/`;
    document.getElementById('btn-view-post').style.display = '';
  }

  // Attach listeners
  titleInput.addEventListener('input', _onTitleChange);
  textarea.addEventListener('input', _onBodyChange);
  textarea.addEventListener('paste', _onPaste);
  textarea.addEventListener('keydown', _onKeydown);

  // Format bar
  document.getElementById('editor-fmtbar').addEventListener('click', _onFmtBarClick);
  document.getElementById('kb-accessory-bar').addEventListener('click', _onFmtBarClick);

  // View mode buttons
  document.getElementById('view-edit').addEventListener('click', () => _setViewMode('edit'));
  document.getElementById('view-split').addEventListener('click', () => _setViewMode('split'));
  document.getElementById('view-read').addEventListener('click', () => _setViewMode('read'));
  _setViewMode('edit');

  // Tags
  document.getElementById('btn-add-tag').addEventListener('click', _showTagInput);
  document.getElementById('tag-input').addEventListener('keydown', _onTagKeydown);

  // Settings modal
  document.getElementById('btn-settings').addEventListener('click', _openSettings);
  document.getElementById('settings-close').addEventListener('click', _closeSettings);
  document.getElementById('settings-cancel').addEventListener('click', _closeSettings);
  document.getElementById('settings-save').addEventListener('click', _saveSettings);
  document.getElementById('settings-delete').addEventListener('click', _confirmDelete);
  document.getElementById('settings-slug').addEventListener('input', _onSlugInput);
  document.getElementById('settings-excerpt').addEventListener('input', _onExcerptInput);

  // Delete modal
  document.getElementById('delete-close').addEventListener('click', _closeDelete);
  document.getElementById('delete-cancel').addEventListener('click', _closeDelete);
  document.getElementById('delete-confirm').addEventListener('click', _deletePost);

  // Publish
  document.getElementById('btn-publish').addEventListener('click', _publish);
}

function _onTitleChange() {
  currentPost.title = document.getElementById('post-title-input').value;
  _updateTitleDisplay();
  _autoResizeTitle();
  _triggerSave();
}

function _onBodyChange() {
  const textarea = _getActiveTextarea();
  currentPost.body = textarea.value;
  _updateWordCount();
  _triggerSave();
  if (viewMode === 'split') _updateSplitPreview();
}

function _onPaste(e) {
  const text = e.clipboardData.getData('text');
  if (!text) return;

  // YouTube URL detection
  const videoId = extractVideoId(text);
  if (videoId && text.trim() === text) {
    e.preventDefault();
    const textarea = document.getElementById('editor-textarea');
    insertYouTubeBlock(textarea, videoId);
    fetchYouTubeTitle(videoId).then(title => {
      showToast(`YouTube: ${title}`, 'default', 2000);
    });
    return;
  }

  // Markdown paste detection
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
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const textarea = _getActiveTextarea();
  _applyFormat(action, textarea);
}

function _getActiveTextarea() {
  if (viewMode === 'split') return document.getElementById('editor-textarea-split');
  return document.getElementById('editor-textarea');
}

function _applyFormat(action, textarea) {
  switch (action) {
    case 'bold':   _wrapSelection(textarea, '**', '**'); break;
    case 'italic': _wrapSelection(textarea, '_', '_'); break;
    case 'h2':     _prefixLine(textarea, '## '); break;
    case 'h3':     _prefixLine(textarea, '### '); break;
    case 'quote':  _prefixLine(textarea, '> '); break;
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
  const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.value = newVal;
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
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

function _setViewMode(mode) {
  viewMode = mode;
  const editArea = document.getElementById('editor-textarea');
  const splitView = document.getElementById('editor-split-view');
  const readView = document.getElementById('editor-read-view');
  const writingInner = editArea.closest('.writing-inner');

  // Update active button
  ['edit', 'split', 'read'].forEach(m => {
    const btn = document.getElementById(`view-${m}`);
    if (btn) btn.classList.toggle('is-active', m === mode);
  });

  if (mode === 'edit') {
    editArea.style.display = '';
    splitView.style.display = 'none';
    readView.style.display = 'none';
  } else if (mode === 'split') {
    editArea.style.display = 'none';
    splitView.style.display = 'flex';
    readView.style.display = 'none';
    // Sync content
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
}

function _updateWordCount() {
  const wc = countWords(currentPost.body || '');
  currentPost.wordCount = wc;
  document.getElementById('topbar-word-count').textContent = wc > 0 ? `${wc} words` : '';
}

function _autoResizeTitle() {
  const el = document.getElementById('post-title-input');
  if (!el) return;
  el.style.height = 'auto';
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
      _triggerSave();
    });
  });
}

function _showTagInput(e) {
  e.preventDefault();
  const input = document.getElementById('tag-input');
  const addBtn = document.getElementById('btn-add-tag');
  if (input) { input.style.display = ''; input.focus(); }
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

function _triggerSave() {
  if (!currentSlug || currentSlug === 'new') return;
  scheduleSave(
    () => ({
      slug: currentSlug,
      title: currentPost.title,
      body: currentPost.body,
      tags: currentPost.tags,
      date: currentPost.date,
      excerpt: currentPost.excerpt,
      coverImage: currentPost.coverImage,
      wordCount: currentPost.wordCount
    }),
    () => {},
    (e) => showToast('Save failed — ' + e.message, 'error')
  );
}

function _updatePublishButton() {
  const btn = document.getElementById('btn-publish');
  if (!btn) return;
  if (currentPost.status === 'published') {
    btn.textContent = 'Published';
    btn.classList.add('is-published');
  } else {
    btn.textContent = 'Publish';
    btn.classList.remove('is-published');
  }
}

async function _publish() {
  const btn = document.getElementById('btn-publish');
  if (!currentSlug || currentSlug === 'new') {
    showToast('Save the post first', 'error');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Publishing…';

  try {
    // Save first
    await saveNow(() => ({
      slug: currentSlug,
      title: currentPost.title,
      body: currentPost.body,
      tags: currentPost.tags,
      date: currentPost.date,
      excerpt: currentPost.excerpt,
      coverImage: currentPost.coverImage,
      wordCount: currentPost.wordCount
    }));

    const res = await fetch(`/api/posts/${currentSlug}/publish`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    currentPost.status = 'published';
    _updatePublishButton();

    const viewBtn = document.getElementById('btn-view-post');
    if (viewBtn) { viewBtn.href = data.url || `/posts/${currentSlug}/`; viewBtn.style.display = ''; }

    showToast('Published — View post ↗', 'success', 4000);
  } catch (e) {
    showToast('Publish failed — ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// Settings modal

function _openSettings(e) {
  e && e.preventDefault();
  const modal = document.getElementById('settings-modal');
  document.getElementById('settings-slug').value = currentSlug;
  document.getElementById('settings-date').value = currentPost.date || new Date().toISOString().slice(0, 10);
  document.getElementById('settings-excerpt').value = currentPost.excerpt || '';
  document.getElementById('settings-cover').value = currentPost.coverImage || '';
  _updateSlugPreview();
  _updateExcerptCount();
  modal.style.display = 'flex';
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
  if (el) el.textContent = document.getElementById('settings-slug').value || '';
}

function _onExcerptInput() {
  _updateExcerptCount();
}

function _updateExcerptCount() {
  const val = document.getElementById('settings-excerpt').value;
  const cnt = document.getElementById('settings-excerpt-count');
  if (cnt) cnt.textContent = `${val.length}/160`;
}

async function _saveSettings() {
  const newSlug = document.getElementById('settings-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const date = document.getElementById('settings-date').value;
  const excerpt = document.getElementById('settings-excerpt').value;
  const coverImage = document.getElementById('settings-cover').value.trim() || null;

  if (!newSlug) {
    showToast('Slug cannot be empty', 'error');
    return;
  }

  currentPost.date = date;
  currentPost.excerpt = excerpt;
  currentPost.coverImage = coverImage;

  // Handle slug rename
  if (newSlug !== currentSlug) {
    try {
      const res = await fetch(`/api/posts/${currentSlug}/rename`, {
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
      navigate(`/admin/edit/${newSlug}`, true);
    } catch (e) {
      showToast('Rename failed: ' + e.message, 'error');
      return;
    }
  }

  _closeSettings();

  // Save updated meta
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
    const res = await fetch(`/api/posts/${currentSlug}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    showToast('Post deleted', 'default');
    navigate('/admin/');
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}
