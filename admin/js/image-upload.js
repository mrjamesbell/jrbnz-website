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
  let items = [];
  try {
    const res = await fetch('/api/media');
    if (res.ok) items = await res.json();
  } catch {}

  if (!items.length) {
    showToast('No media in library yet', 'default');
    return;
  }

  // Simple modal with grid
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal" style="max-width:600px">
    <div class="modal-header">
      <span class="modal-title">Media library</span>
      <button class="modal-close" id="media-picker-close">×</button>
    </div>
    <div class="modal-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:16px">
      ${items.map(item => `<div class="media-picker-thumb" data-url="${item.url}" style="cursor:pointer;border:2px solid transparent;border-radius:6px;overflow:hidden;aspect-ratio:1">
        <img src="${item.url}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy">
      </div>`).join('')}
    </div>
  </div>`;

  document.body.appendChild(backdrop);

  backdrop.querySelector('#media-picker-close').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => {
    const thumb = e.target.closest('.media-picker-thumb');
    if (thumb) {
      insertImageMarkdown(textarea, thumb.dataset.url, '');
      backdrop.remove();
    } else if (e.target === backdrop) {
      backdrop.remove();
    }
  });
}
