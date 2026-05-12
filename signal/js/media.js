import { uploadToR2, openCropModal } from './image-upload.js';
import { showToast } from './toast.js';

let mediaInitialized = false;
let nextMediaCursor = null;
let _selectMode = false;
let _selectedKeys = new Set();

export function initMedia() {
  loadMediaItems();
  if (mediaInitialized) return;
  mediaInitialized = true;
  _setupListeners();
}

function _setupListeners() {
  const dropzone = document.getElementById('media-dropzone');
  const uploadBtn = document.getElementById('btn-upload');
  const loadMoreBtn = document.getElementById('btn-load-more');
  const selectBtn = document.getElementById('btn-select');
  const selectDoneBtn = document.getElementById('btn-select-done');
  const deleteSelectedBtn = document.getElementById('btn-delete-selected');

  uploadBtn?.addEventListener('click', () => _triggerFilePicker());
  selectBtn?.addEventListener('click', () => _enterSelectMode());
  selectDoneBtn?.addEventListener('click', () => _exitSelectMode());
  deleteSelectedBtn?.addEventListener('click', () => _deleteSelected());

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone?.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone?.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('is-dragging');
    });
  });
  dropzone?.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    _uploadFiles(files);
  });
  dropzone?.addEventListener('click', () => _triggerFilePicker());

  loadMoreBtn?.addEventListener('click', () => {
    if (nextMediaCursor) loadMediaItems(nextMediaCursor);
  });

  const grid = document.getElementById('media-grid');
  grid?.addEventListener('click', async e => {
    if (_selectMode) {
      const item = e.target.closest('.media-item');
      if (item) _toggleSelection(item);
      return;
    }

    const copyBtn = e.target.closest('[data-action="copy-url"]');
    if (copyBtn) {
      const item = copyBtn.closest('.media-item');
      await navigator.clipboard.writeText(item.dataset.url).catch(() => {});
      showToast('URL copied', 'success');
      return;
    }

    const cropBtn = e.target.closest('[data-action="crop"]');
    if (cropBtn) {
      await _cropExistingItem(cropBtn.closest('.media-item'));
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const item = deleteBtn.closest('.media-item');
      const filename = item.querySelector('.media-item-filename')?.textContent || item.dataset.key;
      if (!confirm(`Delete "${filename}"? This cannot be undone and will break any posts using this image.`)) return;
      try {
        await fetch(`/api/media/${encodeURIComponent(item.dataset.key)}`, { method: 'DELETE' });
        item.remove();
        showToast('Deleted');
      } catch { showToast('Delete failed', 'error'); }
    }
  });
}

function _triggerFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = () => {
    _uploadFiles(Array.from(input.files));
    document.body.removeChild(input);
  };
  input.click();
}

function _uploadFiles(files) {
  if (!files.length) return;
  const skipCrop = files.length > 1;
  files.forEach(f => _uploadFile(f, skipCrop));
}

// ── Select mode ────────────────────────────────────────────────────────────────

function _enterSelectMode() {
  _selectMode = true;
  _selectedKeys.clear();
  document.getElementById('media-grid')?.classList.add('is-select-mode');
  document.getElementById('media-select-bar')?.style.setProperty('display', 'flex');
  document.getElementById('btn-upload')?.setAttribute('disabled', '');
  document.getElementById('btn-select')?.setAttribute('disabled', '');
  _updateSelectBar();
}

function _exitSelectMode() {
  _selectMode = false;
  _selectedKeys.clear();
  const grid = document.getElementById('media-grid');
  grid?.classList.remove('is-select-mode');
  grid?.querySelectorAll('.media-item.is-selected').forEach(el => el.classList.remove('is-selected'));
  document.getElementById('media-select-bar')?.style.setProperty('display', 'none');
  document.getElementById('btn-upload')?.removeAttribute('disabled');
  document.getElementById('btn-select')?.removeAttribute('disabled');
}

function _toggleSelection(item) {
  const key = item.dataset.key;
  if (_selectedKeys.has(key)) {
    _selectedKeys.delete(key);
    item.classList.remove('is-selected');
  } else {
    _selectedKeys.add(key);
    item.classList.add('is-selected');
  }
  _updateSelectBar();
}

function _updateSelectBar() {
  const count = _selectedKeys.size;
  const countEl = document.getElementById('select-count');
  const deleteBtn = document.getElementById('btn-delete-selected');
  if (countEl) countEl.textContent = count === 1 ? '1 selected' : `${count} selected`;
  if (deleteBtn) deleteBtn.disabled = count === 0;
}

async function _deleteSelected() {
  const count = _selectedKeys.size;
  if (!count) return;
  const noun = count === 1 ? 'image' : 'images';
  if (!confirm(`Delete ${count} ${noun}? This cannot be undone and may break posts using these images.`)) return;

  const keys = [..._selectedKeys];
  const grid = document.getElementById('media-grid');

  try {
    await Promise.all(keys.map(key =>
      fetch(`/api/media/${encodeURIComponent(key)}`, { method: 'DELETE' })
    ));
    grid?.querySelectorAll('.media-item').forEach(el => {
      if (keys.includes(el.dataset.key)) el.remove();
    });
    showToast(`Deleted ${count} ${noun}`, 'success');
    _exitSelectMode();
  } catch {
    showToast('Some deletes failed', 'error');
  }
}

// ── Crop existing ──────────────────────────────────────────────────────────────

async function _cropExistingItem(item) {
  const url = item.dataset.url;
  const key = item.dataset.key;
  const filename = item.querySelector('.media-item-filename')?.textContent || key.split('/').pop();

  showToast('Loading image…');
  let blob;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('fetch failed');
    blob = await res.blob();
  } catch {
    showToast('Could not load image', 'error');
    return;
  }

  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

  openCropModal(file, async processedFile => {
    const progressEl = _createProgressItem(filename);
    document.getElementById('uploads-active')?.appendChild(progressEl);

    try {
      const result = await uploadToR2(processedFile, key);
      progressEl.remove();
      if (result) {
        const img = item.querySelector('img');
        if (img) img.src = `${url}?t=${Date.now()}`;
        showToast('Image cropped and replaced', 'success');
      }
    } catch {
      const status = progressEl.querySelector('.media-upload-status');
      if (status) status.textContent = 'Failed';
      setTimeout(() => progressEl.remove(), 3000);
      showToast('Crop failed', 'error');
    }
  });
}

// ── Load / render ──────────────────────────────────────────────────────────────

async function loadMediaItems(cursor = null) {
  const grid = document.getElementById('media-grid');
  const loadMore = document.getElementById('load-more');
  if (!grid) return;

  if (!cursor) {
    grid.innerHTML = '<div style="padding:20px;color:var(--color-cream-text-muted);font-size:13px;font-family:var(--font-sans)">Loading…</div>';
  }

  try {
    const url = cursor ? `/api/media?limit=48&cursor=${cursor}` : '/api/media?limit=48';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load media');
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    nextMediaCursor = Array.isArray(data) ? null : (data.cursor || null);

    if (!cursor) grid.innerHTML = '';

    if (!items.length && !cursor) {
      grid.innerHTML = '<div style="padding:20px;color:var(--color-cream-text-muted);font-size:13px;font-family:var(--font-sans)">No media uploaded yet. Use the dropzone above to upload images.</div>';
    } else {
      items.forEach(item => grid.appendChild(_renderItem(item)));
    }

    if (loadMore) loadMore.style.display = nextMediaCursor ? 'block' : 'none';
  } catch (e) {
    grid.innerHTML = `<div style="padding:20px;color:var(--color-danger);font-size:13px;font-family:var(--font-sans)">${e.message}</div>`;
  }
}

function _renderItem(item) {
  const el = document.createElement('div');
  el.className = 'media-item';
  el.dataset.key = item.key;
  el.dataset.url = item.publicUrl || item.url || '';
  el.innerHTML = `
    <img src="${_esc(el.dataset.url)}" alt="${_esc(item.filename || '')}" loading="lazy">
    <div class="media-item-overlay">
      <div class="media-item-filename">${_esc(item.filename || item.key?.split('/').pop() || '')}</div>
      <div class="media-item-size">${_fmtBytes(item.size || 0)}</div>
      <div class="media-item-actions">
        <button class="media-item-btn" data-action="copy-url">Copy URL</button>
        <button class="media-item-btn" data-action="crop">Crop</button>
        <button class="media-item-btn is-danger" data-action="delete">Delete</button>
      </div>
    </div>
  `;
  return el;
}

function _uploadFile(file, skipCrop = false) {
  if (skipCrop) {
    const progressEl = _createProgressItem(file.name);
    document.getElementById('uploads-active')?.appendChild(progressEl);

    uploadToR2(file).then(result => {
      progressEl.remove();
      if (result) {
        document.getElementById('media-grid')?.prepend(_renderItem({
          key: result.key,
          publicUrl: result.publicUrl,
          url: result.publicUrl,
          filename: file.name,
          size: file.size,
        }));
        showToast('Uploaded', 'success');
      }
    }).catch(() => {
      const status = progressEl.querySelector('.media-upload-status');
      if (status) status.textContent = 'Failed';
      setTimeout(() => progressEl.remove(), 3000);
      showToast('Upload failed', 'error');
    });
    return;
  }

  openCropModal(file, async processedFile => {
    const progressEl = _createProgressItem(processedFile.name);
    document.getElementById('uploads-active')?.appendChild(progressEl);

    try {
      const result = await uploadToR2(processedFile);
      progressEl.remove();
      if (result) {
        document.getElementById('media-grid')?.prepend(_renderItem({
          key: result.key,
          publicUrl: result.publicUrl,
          url: result.publicUrl,
          filename: processedFile.name,
          size: processedFile.size,
        }));
        showToast('Uploaded', 'success');
      }
    } catch {
      const status = progressEl.querySelector('.media-upload-status');
      if (status) status.textContent = 'Failed';
      setTimeout(() => progressEl.remove(), 3000);
      showToast('Upload failed', 'error');
    }
  });
}

function _createProgressItem(filename) {
  const el = document.createElement('div');
  el.className = 'media-upload-item';
  el.innerHTML = `
    <span class="media-upload-filename">${_esc(filename)}</span>
    <div class="media-upload-bar-wrap"><div class="media-upload-bar"></div></div>
    <span class="media-upload-status">0%</span>
  `;
  return el;
}

function _fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
