import { showToast } from './toast.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function uploadToR2(file, onProgress) {
  if (file.size > MAX_FILE_SIZE) {
    showToast('Max file size is 20 MB', 'error');
    return null;
  }

  const { uploadUrl, publicUrl, key } = await fetch('/api/media/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type })
  }).then(r => {
    if (!r.ok) throw new Error('Could not get upload URL');
    return r.json();
  });

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    });
    xhr.onload = () => xhr.status < 400 ? resolve() : reject(new Error(xhr.statusText));
    xhr.onerror = reject;
    xhr.send(file);
  });

  return { publicUrl, key };
}

export async function cropImage(file, cropRect, outputWidth) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = Math.round(outputWidth * (cropRect.height / cropRect.width));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        cropRect.x * img.naturalWidth,
        cropRect.y * img.naturalHeight,
        cropRect.width * img.naturalWidth,
        cropRect.height * img.naturalHeight,
        0, 0, canvas.width, canvas.height
      );
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    };
    img.src = url;
  });
}

export function insertImageMarkdown(textarea, publicUrl, altText) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const block = `\n![${altText || 'Image'}](${publicUrl})\n`;
  textarea.value = value.slice(0, start) + block + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + block.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

export function openImageSheet(textarea) {
  const sheet = document.getElementById('image-sheet');
  const fileInput = document.getElementById('file-input');
  const cameraInput = document.getElementById('camera-input');

  // Show camera option on mobile only
  const cameraOpt = document.getElementById('img-from-camera');
  if (cameraOpt) cameraOpt.style.display = /Mobi|Android/i.test(navigator.userAgent) ? '' : 'none';

  sheet.classList.add('is-open');

  const close = () => sheet.classList.remove('is-open');

  // Close on backdrop click
  const backdropClick = (e) => {
    if (e.target === sheet) { close(); sheet.removeEventListener('click', backdropClick); }
  };
  sheet.addEventListener('click', backdropClick);

  document.getElementById('img-from-file').onclick = () => {
    close();
    fileInput.onchange = (e) => handleFile(e.target.files[0], textarea, fileInput);
    fileInput.click();
  };

  if (cameraOpt) {
    cameraOpt.onclick = () => {
      close();
      cameraInput.onchange = (e) => handleFile(e.target.files[0], textarea, cameraInput);
      cameraInput.click();
    };
  }

  document.getElementById('img-from-url').onclick = () => {
    close();
    const url = prompt('Image URL:');
    if (url && url.startsWith('http')) {
      insertImageMarkdown(textarea, url, '');
    }
  };

  document.getElementById('img-from-media').onclick = () => {
    close();
    openMediaPicker(textarea);
  };
}

async function handleFile(file, textarea, input) {
  if (!file) return;
  if (input) input.value = '';

  showToast('Uploading…');
  try {
    const result = await uploadToR2(file, () => {});
    if (result) {
      insertImageMarkdown(textarea, result.publicUrl, '');
      showToast('Image uploaded to R2', 'success');
    }
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
}

async function openMediaPicker(textarea) {
  const modal = document.getElementById('media-picker-modal');
  if (!modal) {
    showToast('Media picker not available', 'error');
    return;
  }

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
    if (selected) insertImageMarkdown(textarea, selected.dataset.url, '');
    close();
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

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
