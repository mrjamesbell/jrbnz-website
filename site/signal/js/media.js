import { uploadToR2, openCropModal } from './image-upload.js';
import { showToast } from './toast.js';

let mediaInitialized = false;
let nextMediaCursor = null;
let _selectMode = false;
let _selectedKeys = new Set();

// Edit screen state
let _editingKey = null;
let _editFocalX = 0.5;
let _editFocalY = 0.5;
let _focalClickHandler = null;

// Upload screen state
let _pendingUploadFile = null;
let _uploadedResult = null;

export function initMedia() {
  _showMediaScreen('library');
  loadMediaItems();
  if (mediaInitialized) return;
  mediaInitialized = true;
  _setupListeners();
}

// ── Screen navigation ─────────────────────────────────────────────────────────

function _showMediaScreen(id) {
  document.querySelectorAll('#media-view .media-screen').forEach(s => {
    s.classList.toggle('media-screen--active', s.id === `media-screen-${id}`);
  });
}

function _showUploadStep(id) {
  document.querySelectorAll('#media-screen-upload .media-upload-step').forEach(s => {
    s.classList.toggle('media-upload-step--active', s.id === `media-upload-${id}`);
  });
}

function _setupListeners() {
  // ── Library ──
  document.getElementById('btn-upload')?.addEventListener('click', () => {
    _pendingUploadFile = null;
    _showMediaScreen('upload');
    _showUploadStep('drop');
  });
  document.getElementById('btn-select')?.addEventListener('click', () => _enterSelectMode());
  document.getElementById('btn-select-done')?.addEventListener('click', () => _exitSelectMode());
  document.getElementById('btn-delete-selected')?.addEventListener('click', () => _deleteSelected());
  document.getElementById('btn-load-more')?.addEventListener('click', () => {
    if (nextMediaCursor) loadMediaItems(nextMediaCursor);
  });

  document.getElementById('media-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#media-grid .media-item').forEach(item => {
      const name = item.querySelector('.media-item-filename')?.textContent.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
  });

  // ── Grid clicks ──
  const grid = document.getElementById('media-grid');
  grid?.addEventListener('click', async e => {
    if (_selectMode) {
      const item = e.target.closest('.media-item');
      if (item) _toggleSelection(item);
      return;
    }

    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      const item = editBtn.closest('.media-item');
      await _openEditScreen(item.dataset.key, item.dataset.url);
      return;
    }

    const cropBtn = e.target.closest('[data-action="crop"]');
    if (cropBtn) {
      await _cropExistingItem(cropBtn.closest('.media-item'));
      return;
    }
  });

  // ── Upload screen ──
  const dropzone = document.getElementById('media-dropzone');
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
    _handleDroppedFiles(files);
  });
  dropzone?.addEventListener('click', () => _triggerUploadFilePicker());

  document.getElementById('media-upload-back')?.addEventListener('click', () => _showMediaScreen('library'));
  document.getElementById('media-upload-form-back')?.addEventListener('click', () => _showUploadStep('drop'));
  document.getElementById('media-upload-submit')?.addEventListener('click', () => _submitUpload());
  document.getElementById('media-upload-done-library')?.addEventListener('click', () => _showMediaScreen('library'));
  document.getElementById('media-upload-done-edit')?.addEventListener('click', () => {
    if (_uploadedResult) {
      _openEditScreen(_uploadedResult.key || _uploadedResult.id, _uploadedResult.publicUrl || _uploadedResult.url);
    }
  });

  // ── Edit screen ──
  document.getElementById('media-edit-back')?.addEventListener('click', () => _showMediaScreen('library'));
  document.getElementById('media-edit-save')?.addEventListener('click', () => _saveEditMetadata());
  document.getElementById('media-edit-delete-btn')?.addEventListener('click', () => _deleteEditingImage());
  document.getElementById('media-edit-crop-btn')?.addEventListener('click', () => _cropFromEditScreen());

  document.getElementById('media-edit-variants')?.addEventListener('click', async e => {
    const btn = e.target.closest('.media-variant-copy');
    if (!btn) return;
    const url = `https://jrbnz.com${btn.dataset.url}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    showToast('URL copied', 'success');
  });
}

// ── Upload flow ───────────────────────────────────────────────────────────────

function _triggerUploadFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = () => {
    const files = Array.from(input.files);
    document.body.removeChild(input);
    _handleDroppedFiles(files);
  };
  input.click();
}

function _handleDroppedFiles(files) {
  if (!files.length) return;
  if (files.length === 1) {
    _pendingUploadFile = files[0];
    _showUploadForm(files[0]);
  } else {
    // Multiple files: upload directly and show progress in library
    _showMediaScreen('library');
    files.forEach(f => _uploadFileDirect(f));
  }
}

function _showUploadForm(file) {
  _showUploadStep('form');

  const previewImg = document.getElementById('media-upload-preview-img');
  if (previewImg) {
    const objectUrl = URL.createObjectURL(file);
    previewImg.onload = () => URL.revokeObjectURL(objectUrl);
    previewImg.src = objectUrl;
  }

  const infoEl = document.getElementById('media-upload-file-info');
  if (infoEl) infoEl.textContent = `${file.name} · ${_fmtBytes(file.size)}`;

  const nameInput = document.getElementById('media-upload-name');
  if (nameInput) {
    const slug = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    nameInput.value = slug;
    setTimeout(() => nameInput.focus(), 80);
  }

  const altInput = document.getElementById('media-upload-alt');
  const captionInput = document.getElementById('media-upload-caption');
  if (altInput) altInput.value = '';
  if (captionInput) captionInput.value = '';
}

async function _submitUpload() {
  const file = _pendingUploadFile;
  if (!file) return;

  const nameVal = document.getElementById('media-upload-name')?.value.trim() || '';
  const altVal = document.getElementById('media-upload-alt')?.value.trim() || '';
  const captionVal = document.getElementById('media-upload-caption')?.value.trim() || '';

  _showUploadStep('progress');

  const progressBar = document.getElementById('media-progress-bar');
  const progressLabel = document.getElementById('media-upload-progress-label');
  const subLabel = document.getElementById('media-upload-progress-sub');
  if (subLabel) subLabel.textContent = `${file.name} · ${_fmtBytes(file.size)}`;
  if (progressBar) progressBar.style.width = '0%';

  let pct = 0;
  const interval = setInterval(() => {
    pct = Math.min(88, pct + Math.random() * 15 + 5);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressLabel) progressLabel.textContent = `${Math.round(pct)}%`;
  }, 300);

  try {
    const originalSlug = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const uploadFile = nameVal && nameVal !== originalSlug
      ? new File([file], `${nameVal}.${file.name.split('.').pop()}`, { type: file.type })
      : file;

    const result = await uploadToR2(uploadFile);
    clearInterval(interval);

    if (progressBar) progressBar.style.width = '100%';
    if (progressLabel) progressLabel.textContent = '100%';

    if (result) {
      if (altVal || captionVal) {
        try {
          const metaRes = await fetch(`/api/media/${encodeURIComponent(result.key || result.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alt: altVal, caption: captionVal }),
          });
          if (!metaRes.ok) throw new Error(`${metaRes.status}`);
        } catch (e) {
          console.error('Failed to save media metadata:', e);
          showToast('Metadata save failed — ' + e.message, 'error');
        }
      }

      _uploadedResult = result;
      document.getElementById('media-grid')?.prepend(_renderItem({ ...result, alt: altVal }));

      setTimeout(() => {
        _showUploadStep('done');
        const doneTitle = document.getElementById('media-upload-done-title');
        const doneSub = document.getElementById('media-upload-done-sub');
        if (doneTitle) doneTitle.textContent = 'Uploaded successfully';
        if (doneSub) doneSub.textContent = result.key || result.id || '';
      }, 350);
    }
  } catch (e) {
    clearInterval(interval);
    showToast('Upload failed: ' + e.message, 'error');
    _showUploadStep('drop');
  }
}

function _uploadFileDirect(file) {
  const progressEl = _createProgressItem(file.name);
  document.getElementById('uploads-active')?.appendChild(progressEl);

  uploadToR2(file).then(result => {
    progressEl.remove();
    if (result) {
      document.getElementById('media-grid')?.prepend(_renderItem(result));
      showToast('Uploaded', 'success');
    }
  }).catch(() => {
    const status = progressEl.querySelector('.media-upload-status');
    if (status) status.textContent = 'Failed';
    setTimeout(() => progressEl.remove(), 3000);
    showToast('Upload failed', 'error');
  });
}

// ── Edit screen ───────────────────────────────────────────────────────────────

async function _openEditScreen(key, thumbUrl = '') {
  if (!key) return;
  _editingKey = key;
  _editFocalX = 0.5;
  _editFocalY = 0.5;

  _showMediaScreen('edit');

  const previewImg = document.getElementById('media-edit-preview');
  const focalDot = document.getElementById('media-edit-focal-dot');
  const focalWrap = document.getElementById('media-edit-focal-wrap');

  if (previewImg && thumbUrl) previewImg.src = thumbUrl;
  if (focalDot) focalDot.hidden = true;

  const variantList = document.getElementById('media-edit-variants');
  if (variantList) variantList.innerHTML = '<div class="media-field-hint">Loading…</div>';

  let meta = { displayName: '', alt: '', caption: '', focalX: 0.5, focalY: 0.5, urls: {}, size: 0, uploadedAt: null };
  try {
    const res = await fetch(`/api/media/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    meta = { ...meta, ...data };
    if (previewImg) {
      previewImg.src = data.urls?.hero || data.publicUrl || data.url || thumbUrl;
    }
  } catch (e) {
    console.error('Failed to load media metadata:', e);
    showToast('Failed to load media details — ' + e.message, 'error');
  }

  const nameInput = document.getElementById('media-edit-name');
  const altInput = document.getElementById('media-edit-alt');
  const captionInput = document.getElementById('media-edit-caption');
  if (nameInput) nameInput.value = meta.displayName || '';
  if (altInput) altInput.value = meta.alt || '';
  if (captionInput) captionInput.value = meta.caption || '';

  const titleEl = document.getElementById('media-edit-title');
  if (titleEl) titleEl.textContent = meta.displayName || key;

  _editFocalX = meta.focalX ?? 0.5;
  _editFocalY = meta.focalY ?? 0.5;

  const _placeDot = () => {
    if (!focalDot) return;
    focalDot.hidden = false;
    focalDot.style.left = `${_editFocalX * 100}%`;
    focalDot.style.top = `${_editFocalY * 100}%`;
  };
  _placeDot();
  _updateFocalCoordsDisplay();

  if (_focalClickHandler && focalWrap) focalWrap.removeEventListener('click', _focalClickHandler);
  _focalClickHandler = e => {
    if (!previewImg) return;
    const rect = previewImg.getBoundingClientRect();
    _editFocalX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _editFocalY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    _placeDot();
    _updateFocalCoordsDisplay();
  };
  if (focalWrap) focalWrap.addEventListener('click', _focalClickHandler);

  // Populate variants
  if (variantList) {
    if (meta.urls && Object.keys(meta.urls).length) {
      const descs = { thumb: '400px — library', md: '900px — in-post', hero: '1600px — full-width', public: 'original' };
      variantList.innerHTML = ['thumb', 'md', 'hero', 'public']
        .filter(v => meta.urls[v])
        .map(v => `<div class="media-variant-row">
          <span class="media-variant-name">${_esc(v)}</span>
          <span class="media-variant-dims">${descs[v] || v}</span>
          <button class="media-variant-copy" data-url="${_esc(meta.urls[v])}" title="Copy URL">⧉</button>
        </div>`)
        .join('');
    } else {
      variantList.innerHTML = '<div class="media-field-hint">Variants not available</div>';
    }
  }

  // File info
  const fileMeta = document.getElementById('media-edit-file-meta');
  if (fileMeta) {
    const uploadDate = meta.uploadedAt
      ? new Date(meta.uploadedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    fileMeta.innerHTML = `
      <div class="media-meta-item"><span class="media-meta-key">Size</span><span class="media-meta-val">${_fmtBytes(meta.size || 0)}</span></div>
      <div class="media-meta-item"><span class="media-meta-key">Uploaded</span><span class="media-meta-val">${_esc(uploadDate)}</span></div>
    `;
  }
}

function _updateFocalCoordsDisplay() {
  const el = document.getElementById('media-focal-coords');
  if (el) el.textContent = `x: ${_editFocalX.toFixed(2)} · y: ${_editFocalY.toFixed(2)}`;
}

async function _saveEditMetadata() {
  if (!_editingKey) return;
  const saveBtn = document.getElementById('media-edit-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    const res = await fetch(`/api/media/${encodeURIComponent(_editingKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: document.getElementById('media-edit-name')?.value.trim(),
        alt: document.getElementById('media-edit-alt')?.value.trim(),
        caption: document.getElementById('media-edit-caption')?.value.trim(),
        focalX: Math.round(_editFocalX * 1000) / 1000,
        focalY: Math.round(_editFocalY * 1000) / 1000,
      }),
    });
    if (!res.ok) throw new Error('Save failed');

    const displayName = document.getElementById('media-edit-name')?.value.trim();
    if (displayName) {
      const gridItem = document.querySelector(`#media-grid .media-item[data-key="${CSS.escape(_editingKey)}"]`);
      const filenameEl = gridItem?.querySelector('.media-item-filename');
      if (filenameEl) filenameEl.textContent = displayName;
      const titleEl = document.getElementById('media-edit-title');
      if (titleEl) titleEl.textContent = displayName;
    }

    showToast('Saved', 'success', 1500);
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save metadata'; }
  }
}

async function _deleteEditingImage() {
  if (!_editingKey) return;
  const displayName = document.getElementById('media-edit-name')?.value || _editingKey;
  if (!confirm(`Delete "${displayName}"? This cannot be undone and will break any posts using this image.`)) return;
  try {
    await fetch(`/api/media/${encodeURIComponent(_editingKey)}`, { method: 'DELETE' });
    document.querySelector(`#media-grid .media-item[data-key="${CSS.escape(_editingKey)}"]`)?.remove();
    _editingKey = null;
    _showMediaScreen('library');
    showToast('Deleted');
  } catch { showToast('Delete failed', 'error'); }
}

async function _cropFromEditScreen() {
  if (!_editingKey) return;
  const previewImg = document.getElementById('media-edit-preview');
  const imgUrl = previewImg?.src;
  if (!imgUrl) return;

  showToast('Loading image…');
  let blob;
  try {
    const res = await fetch(imgUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error('fetch failed');
    blob = await res.blob();
  } catch {
    showToast('Could not load image', 'error');
    return;
  }

  const filename = _editingKey + '.jpg';
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

  openCropModal(file, async processedFile => {
    const progressEl = _createProgressItem(filename);
    document.getElementById('uploads-active')?.appendChild(progressEl);
    _showMediaScreen('library');

    try {
      const result = await uploadToR2(processedFile);
      progressEl.remove();
      if (result) {
        document.getElementById('media-grid')?.prepend(_renderItem(result));
        showToast('Saved as new image', 'success');
        await _openEditScreen(result.key || result.id, result.publicUrl || result.url);
      }
    } catch {
      const status = progressEl.querySelector('.media-upload-status');
      if (status) status.textContent = 'Failed';
      setTimeout(() => progressEl.remove(), 3000);
      showToast('Crop failed', 'error');
    }
  });
}

// ── Crop from grid ────────────────────────────────────────────────────────────

async function _cropExistingItem(item) {
  const url = item.dataset.url;
  const key = item.dataset.key;
  const filename = item.querySelector('.media-item-filename')?.textContent || key;

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
      const result = await uploadToR2(processedFile);
      progressEl.remove();
      if (result) {
        document.getElementById('media-grid')?.prepend(_renderItem(result));
        showToast('Saved as new image', 'success');
      }
    } catch {
      const status = progressEl.querySelector('.media-upload-status');
      if (status) status.textContent = 'Failed';
      setTimeout(() => progressEl.remove(), 3000);
      showToast('Crop failed', 'error');
    }
  });
}

// ── Select mode ───────────────────────────────────────────────────────────────

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
  if (!confirm(`Delete ${count} ${noun}? This cannot be undone.`)) return;

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

// ── Load / render ──────────────────────────────────────────────────────────────

export async function loadMediaItems(cursor = null) {
  const grid = document.getElementById('media-grid');
  const loadMore = document.getElementById('load-more');
  if (!grid) return;

  if (!cursor) {
    grid.innerHTML = '<div style="padding:20px;color:var(--color-dark-text-muted);font-size:13px;font-family:var(--font-sans)">Loading…</div>';
  }

  try {
    const url = cursor ? `/api/media?limit=48&cursor=${cursor}` : '/api/media?limit=48';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load media');
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    nextMediaCursor = Array.isArray(data) ? null : (data.nextCursor || null);

    if (!cursor) grid.innerHTML = '';

    if (!items.length && !cursor) {
      grid.innerHTML = '<div style="padding:20px;color:var(--color-dark-text-muted);font-size:13px;font-family:var(--font-sans)">No media uploaded yet. Click ↑ Upload to add images.</div>';
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
  el.dataset.key = item.key || item.id || '';
  el.dataset.url = item.publicUrl || item.url || '';
  const thumbUrl = item.urls?.thumb || el.dataset.url;
  const displayName = item.displayName || item.filename || item.key?.split('/').pop() || '';
  el.innerHTML = `
    <img src="${_esc(thumbUrl)}" alt="${_esc(displayName)}" loading="lazy">
    <div class="media-item-overlay">
      <div class="media-item-filename">${_esc(displayName)}</div>
      <div class="media-item-size">${_fmtBytes(item.size || 0)}</div>
      <div class="media-item-actions">
        <button class="media-item-btn" data-action="edit">Edit</button>
        <button class="media-item-btn" data-action="crop">Crop</button>
      </div>
    </div>
  `;
  return el;
}

function _createProgressItem(filename) {
  const el = document.createElement('div');
  el.className = 'media-upload-item';
  el.innerHTML = `
    <span class="media-upload-filename">${_esc(filename)}</span>
    <div class="media-upload-bar-wrap"><div class="media-upload-bar"></div></div>
    <span class="media-upload-status">Uploading…</span>
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
