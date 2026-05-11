import { showToast } from './toast.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadToR2(file) {
  if (file.size > MAX_FILE_SIZE) {
    showToast('Max file size is 20 MB', 'error');
    return null;
  }

  const filename = encodeURIComponent(file.name || 'upload.jpg');
  const ct = file.type || _mimeFromName(file.name);
  // Convert to ArrayBuffer on the client — Safari has a bug where sending
  // a File/Blob object directly as a fetch body produces an empty request body.
  const buffer = await file.arrayBuffer();

  const res = await fetch(`/api/media/upload?filename=${filename}`, {
    method: 'POST',
    headers: { 'Content-Type': ct },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  return res.json(); // { publicUrl, key, filename, size }
}

// ── Crop (canvas-based) ───────────────────────────────────────────────────────

export async function cropImage(file, cropRect, outputWidth) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const srcX = cropRect.x * img.naturalWidth;
      const srcY = cropRect.y * img.naturalHeight;
      const srcW = cropRect.width * img.naturalWidth;
      const srcH = cropRect.height * img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = Math.round(outputWidth * srcH / srcW);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    };
    img.src = url;
  });
}

// ── Insert helpers ────────────────────────────────────────────────────────────

export function renderImageBlock(src, alt, layout, width) {
  const validLayout = ['full', 'left', 'right', 'centre'].includes(layout) ? layout : 'full';
  const isFull = validLayout === 'full';
  const pct = isFull ? 100 : Math.max(10, Math.min(100, parseInt(width, 10) || 100));

  const escSrc = _esc(src);
  const escAlt = _esc(alt || '');
  const dispAlt = escAlt;

  return `<div class="image-block" data-src="${escSrc}" data-alt="${escAlt}" data-layout="${validLayout}" data-width="${pct}">
  <div class="image-thumb-wrap">
    <img class="image-thumb-img" src="${escSrc}" alt="${escAlt}" loading="lazy">
    <button class="image-remove-btn" data-action="remove-image" title="Remove">✕</button>
  </div>
  ${dispAlt ? `<div class="image-info-bar"><div class="image-alt-text">${dispAlt}</div></div>` : ''}
  <div class="image-controls-bar">
    <span class="image-ctrl-label">Layout</span>
    <button class="image-layout-btn ${validLayout === 'full' ? 'is-active' : ''}" data-layout="full">Full</button>
    <button class="image-layout-btn ${validLayout === 'left' ? 'is-active' : ''}" data-layout="left">Left</button>
    <button class="image-layout-btn ${validLayout === 'centre' ? 'is-active' : ''}" data-layout="centre">Centre</button>
    <button class="image-layout-btn ${validLayout === 'right' ? 'is-active' : ''}" data-layout="right">Right</button>
    <span class="image-ctrl-sep"></span>
    <span class="image-ctrl-label${isFull ? ' is-muted' : ''}">Width</span>
    <input class="image-width-input" type="number" min="10" max="100" step="5" value="${pct}"${isFull ? ' disabled' : ''}>
    <span class="image-ctrl-unit">%</span>
  </div>
</div>`;
}

export function insertSignalImage(textarea, publicUrl, altText, layout, width) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const alt = (altText || '').replace(/"/g, '&quot;');
  const widthAttr = width && width !== 100 ? ` width="${width}"` : '';
  const block = `\n<!-- signal:image src="${publicUrl}" alt="${alt}" layout="${layout || 'full'}"${widthAttr} -->\n`;
  textarea.value = value.slice(0, start) + block + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + block.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

export function insertImageMarkdown(textarea, publicUrl, altText) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const block = `\n![${altText || 'Image'}](${publicUrl})\n`;
  textarea.value = value.slice(0, start) + block + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + block.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

// ── Image options modal ───────────────────────────────────────────────────────

export function openImageOptionsModal(textarea, publicUrl, altHint) {
  const modal = document.getElementById('img-options-modal');
  const previewImg = document.getElementById('img-options-preview-img');
  const altInput = document.getElementById('img-options-alt');
  const insertBtn = document.getElementById('img-options-insert');
  const closeBtn = document.getElementById('img-options-close');
  const cancelBtn = document.getElementById('img-options-cancel');

  previewImg.src = publicUrl;
  altInput.value = altHint || '';

  let selectedLayout = 'full';

  modal.querySelectorAll('[data-layout]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.layout === 'full');
    btn.onclick = () => {
      selectedLayout = btn.dataset.layout;
      modal.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('is-active', b === btn));
    };
  });

  const widthInput = document.getElementById('img-options-width');
  widthInput.value = 100;

  modal.style.display = 'flex';
  setTimeout(() => altInput.focus(), 60);

  const close = () => { modal.style.display = 'none'; };
  const doInsert = () => {
    const pct = Math.max(10, Math.min(100, parseInt(widthInput.value, 10) || 100));
    insertSignalImage(textarea, publicUrl, altInput.value.trim(), selectedLayout, pct);
    close();
  };

  closeBtn.onclick = close;
  cancelBtn.onclick = close;
  insertBtn.onclick = doInsert;
  altInput.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); doInsert(); }
    if (e.key === 'Escape') close();
  };
  // Delay backdrop-click registration so any residual click/touch from the
  // preceding crop modal doesn't immediately dismiss this modal.
  setTimeout(() => {
    modal.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });
  }, 400);
}

// ── Crop modal ────────────────────────────────────────────────────────────────

let _cropFile = null;
let _cropOnComplete = null;
let _cropAspect = null;
let _cropCircle = false;
let _cropBox = { x: 0, y: 0, w: 0, h: 0 };
let _cropDrag = null;

export function openCropModal(file, onComplete, options = {}) {
  _cropFile = file;
  _cropOnComplete = onComplete;
  _cropAspect = null;
  _cropCircle = !!(options && options.circle);
  _cropDrag = null;

  const modal = document.getElementById('crop-modal');
  const cropImg = document.getElementById('crop-img');
  const box = document.getElementById('crop-box');

  // Apply circle mode defaults
  if (_cropCircle) {
    _cropAspect = 1;
    box.classList.add('is-circle');
  } else {
    box.classList.remove('is-circle');
  }

  const objectUrl = URL.createObjectURL(file);
  cropImg.onload = () => {
    URL.revokeObjectURL(objectUrl);
    // Double rAF ensures the image is painted and has a layout rect
    requestAnimationFrame(() => requestAnimationFrame(_initCropBox));
  };
  cropImg.src = objectUrl;
  modal.style.display = 'flex';

  // Aspect ratio buttons
  const circleActivePill = _cropCircle
    ? modal.querySelector('[data-circle="true"]')
    : null;
  modal.querySelectorAll('[data-aspect]').forEach(btn => {
    // In circle mode, activate the Circle pill; otherwise default to Free
    if (_cropCircle) {
      btn.classList.toggle('is-active', btn.dataset.circle === 'true');
    } else {
      btn.classList.toggle('is-active', btn.dataset.aspect === 'free' && !btn.dataset.circle);
    }
    btn.onclick = () => {
      const isCircle = btn.dataset.circle === 'true';
      _cropCircle = isCircle;
      _cropAspect = (btn.dataset.aspect === 'free' && !isCircle) ? null : parseFloat(btn.dataset.aspect);
      modal.querySelectorAll('[data-aspect]').forEach(b => b.classList.toggle('is-active', b === btn));
      if (_cropCircle) {
        box.classList.add('is-circle');
      } else {
        box.classList.remove('is-circle');
      }
      if (_cropAspect) _enforceAspect();
      _updateCropOverlay();
    };
  });

  // Drag events on the crop box
  box.onpointerdown = e => {
    _cropDrag = {
      type: e.target.dataset.handle || 'move',
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ..._cropBox }
    };
    box.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  box.onpointermove = e => {
    if (!_cropDrag) return;
    _applyCropDrag(e.clientX - _cropDrag.startX, e.clientY - _cropDrag.startY);
    _updateCropOverlay();
  };
  box.onpointerup = () => { _cropDrag = null; };

  document.getElementById('crop-close').onclick = _closeCropModal;

  document.getElementById('crop-skip').onclick = () => {
    _closeCropModal();
    _cropOnComplete(_cropFile);
  };

  document.getElementById('crop-apply').onclick = async () => {
    const applyBtn = document.getElementById('crop-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = 'Cropping…';
    try {
      const ir = _imgRect();
      const cropRect = {
        x: _cropBox.x / ir.w,
        y: _cropBox.y / ir.h,
        width: _cropBox.w / ir.w,
        height: _cropBox.h / ir.h
      };
      const blob = await cropImage(_cropFile, cropRect, 1200);
      const croppedFile = new File([blob], _cropFile.name, { type: 'image/jpeg' });
      _closeCropModal();
      _cropOnComplete(croppedFile);
    } catch (e) {
      showToast('Crop failed: ' + e.message, 'error');
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply crop';
    }
  };
}

function _closeCropModal() {
  const modal = document.getElementById('crop-modal');
  if (modal) modal.style.display = 'none';
  const box = document.getElementById('crop-box');
  if (box) box.classList.remove('is-circle');
  _cropCircle = false;
  _cropDrag = null;
}

function _imgRect() {
  const container = document.getElementById('crop-container');
  const img = document.getElementById('crop-img');
  const cr = container.getBoundingClientRect();
  const ir = img.getBoundingClientRect();
  return { x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height };
}

function _initCropBox() {
  const ir = _imgRect();
  if (!ir.w || !ir.h) return;
  const pad = Math.min(ir.w, ir.h) * 0.08;
  _cropBox = { x: pad, y: pad, w: ir.w - 2 * pad, h: ir.h - 2 * pad };
  if (_cropAspect) _enforceAspect();
  _updateCropOverlay();
}

function _enforceAspect() {
  if (!_cropAspect) return;
  const ir = _imgRect();
  const targetH = _cropBox.w / _cropAspect;
  if (_cropBox.y + targetH <= ir.h) {
    _cropBox.h = targetH;
  } else {
    _cropBox.h = ir.h - _cropBox.y;
    _cropBox.w = _cropBox.h * _cropAspect;
    if (_cropBox.x + _cropBox.w > ir.w) {
      _cropBox.w = ir.w - _cropBox.x;
      _cropBox.h = _cropBox.w / _cropAspect;
    }
  }
}

function _applyCropDrag(dx, dy) {
  if (!_cropDrag) return;
  const ir = _imgRect();
  const sb = _cropDrag.startBox;
  const MIN = 30;
  let { x, y, w, h } = sb;

  switch (_cropDrag.type) {
    case 'move':
      x = Math.max(0, Math.min(ir.w - w, sb.x + dx));
      y = Math.max(0, Math.min(ir.h - h, sb.y + dy));
      break;
    case 'nw':
      x = Math.max(0, Math.min(sb.x + sb.w - MIN, sb.x + dx));
      y = Math.max(0, Math.min(sb.y + sb.h - MIN, sb.y + dy));
      w = sb.x + sb.w - x;
      h = sb.y + sb.h - y;
      break;
    case 'ne':
      w = Math.max(MIN, Math.min(ir.w - sb.x, sb.w + dx));
      y = Math.max(0, Math.min(sb.y + sb.h - MIN, sb.y + dy));
      h = sb.y + sb.h - y;
      break;
    case 'sw':
      x = Math.max(0, Math.min(sb.x + sb.w - MIN, sb.x + dx));
      w = sb.x + sb.w - x;
      h = Math.max(MIN, Math.min(ir.h - sb.y, sb.h + dy));
      break;
    case 'se':
      w = Math.max(MIN, Math.min(ir.w - sb.x, sb.w + dx));
      h = Math.max(MIN, Math.min(ir.h - sb.y, sb.h + dy));
      break;
  }

  _cropBox = { x, y, w, h };
  if (_cropAspect && _cropDrag.type !== 'move') _enforceAspect();
}

function _updateCropOverlay() {
  const ir = _imgRect();
  const { x, y, w, h } = _cropBox;
  const px = v => `${Math.round(v)}px`;

  const setEl = (id, top, left, width, height) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cssText = `top:${px(top)};left:${px(left)};width:${px(Math.max(0, width))};height:${px(Math.max(0, height))}`;
  };

  setEl('crop-ov-top',    ir.y,         ir.x,         ir.w,          y);
  setEl('crop-ov-bottom', ir.y + y + h, ir.x,         ir.w,          ir.h - y - h);
  setEl('crop-ov-left',   ir.y + y,     ir.x,         x,             h);
  setEl('crop-ov-right',  ir.y + y,     ir.x + x + w, ir.w - x - w,  h);

  const box = document.getElementById('crop-box');
  if (box) {
    box.style.top = px(ir.y + y);
    box.style.left = px(ir.x + x);
    box.style.width = px(w);
    box.style.height = px(h);
  }
}

// ── Bottom sheet (image source picker) ───────────────────────────────────────

export function openImageSheet(textarea) {
  const sheet = document.getElementById('image-sheet');
  const fileInput = document.getElementById('file-input');
  const cameraInput = document.getElementById('camera-input');

  const cameraOpt = document.getElementById('img-from-camera');
  if (cameraOpt) cameraOpt.style.display = /Mobi|Android/i.test(navigator.userAgent) ? '' : 'none';

  sheet.classList.add('is-open');
  const close = () => sheet.classList.remove('is-open');

  const onBackdrop = e => { if (e.target === sheet) { close(); sheet.removeEventListener('click', onBackdrop); } };
  sheet.addEventListener('click', onBackdrop);

  document.getElementById('img-from-file').onclick = () => {
    close();
    fileInput.onchange = () => _handleFile(fileInput.files[0], textarea, fileInput);
    fileInput.click();
  };

  if (cameraOpt) {
    cameraOpt.onclick = () => {
      close();
      cameraInput.onchange = () => _handleFile(cameraInput.files[0], textarea, cameraInput);
      cameraInput.click();
    };
  }

  document.getElementById('img-from-url').onclick = () => {
    close();
    const url = prompt('Image URL:');
    if (url && url.startsWith('http')) {
      openImageOptionsModal(textarea, url);
    }
  };

  document.getElementById('img-from-media').onclick = () => {
    close();
    _openMediaPicker(textarea);
  };
}

// ── File upload flow: crop → upload → options modal ──────────────────────────

function _handleFile(file, textarea, input) {
  if (!file) return;
  if (input) input.value = '';

  openCropModal(file, async processedFile => {
    showToast('Uploading…');
    try {
      const result = await uploadToR2(processedFile);
      if (result) {
        showToast('Uploaded', 'success', 1500);
        openImageOptionsModal(textarea, result.publicUrl, _altHint(processedFile.name));
      }
    } catch (e) {
      showToast('Upload failed: ' + e.message, 'error');
    }
  });
}

function _altHint(filename) {
  return (filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Media picker modal ────────────────────────────────────────────────────────

async function _openMediaPicker(textarea) {
  const modal = document.getElementById('media-picker-modal');
  if (!modal) { showToast('Media picker not available', 'error'); return; }

  const grid = document.getElementById('media-picker-grid');
  const insertBtn = document.getElementById('media-picker-insert');
  const infoEl = document.getElementById('picker-selected-info');
  const searchEl = document.getElementById('media-picker-search');
  const closeBtn = document.getElementById('media-picker-close');
  const cancelBtn = document.getElementById('media-picker-cancel');

  grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">Loading…</div>';
  insertBtn.disabled = true;
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
        const url = _esc(item.publicUrl || item.url || '');
        const name = _esc(item.filename || '');
        const size = _fmtBytes(item.size || 0);
        return `<div class="media-item" data-url="${url}" data-key="${_esc(item.key)}">
          <img src="${url}" alt="${name}" loading="lazy">
          <div class="media-item-overlay">
            <div class="media-item-filename">${name}</div>
            <div class="media-item-size">${size}</div>
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

  const close = () => {
    modal.style.display = 'none';
    grid.removeEventListener('click', onGridClick);
    insertBtn.onclick = null;
    if (closeBtn) closeBtn.onclick = null;
    if (cancelBtn) cancelBtn.onclick = null;
    if (searchEl) searchEl.oninput = null;
  };

  insertBtn.onclick = () => {
    const selected = grid.querySelector('.media-item.is-selected');
    if (selected) {
      const url = selected.dataset.url;
      const name = selected.querySelector('.media-item-filename')?.textContent || '';
      close();
      openImageOptionsModal(textarea, url, _altHint(name));
    } else {
      close();
    }
  };

  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });

  if (searchEl) {
    searchEl.oninput = e => {
      const q = e.target.value.toLowerCase();
      grid.querySelectorAll('.media-item').forEach(item => {
        const name = item.querySelector('.media-item-filename')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(q) ? '' : 'none';
      });
    };
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function _mimeFromName(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
           webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
           avif: 'image/avif' }[ext] || 'application/octet-stream';
}
