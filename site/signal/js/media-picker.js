// Unified media picker modal — single implementation used by all callers

export async function openMediaPicker({ insertLabel = 'Insert image', onSelect }) {
  const modal = document.getElementById('media-picker-modal');
  if (!modal) return;

  const grid = document.getElementById('media-picker-grid');
  const insertBtn = document.getElementById('media-picker-insert');
  const closeBtn = document.getElementById('media-picker-close');
  const cancelBtn = document.getElementById('media-picker-cancel');
  const searchEl = document.getElementById('media-picker-search');
  const infoEl = document.getElementById('picker-selected-info');

  grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">Loading…</div>';
  insertBtn.disabled = true;
  insertBtn.textContent = insertLabel;
  if (infoEl) infoEl.textContent = '';
  if (searchEl) searchEl.value = '';
  modal.style.display = 'flex';
  setTimeout(() => searchEl?.focus(), 80);

  let _items = [];

  try {
    const res = await fetch('/api/media?limit=48');
    const data = await res.json();
    _items = Array.isArray(data) ? data : (data.items || []);
    grid.innerHTML = _items.length
      ? _items.map(_pickerItemHtml).join('')
      : '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">No media uploaded yet.</div>';
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

  insertBtn.onclick = () => {
    const selected = grid.querySelector('.media-item.is-selected');
    if (!selected) return;
    const key = selected.dataset.key;
    const url = selected.dataset.url;
    const item = _items.find(i => (i.key || i.id) === key) || { publicUrl: url, url };
    close();
    if (onSelect) onSelect(item);
  };

  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });
}

function _pickerItemHtml(item) {
  const url   = _esc(item.publicUrl || item.url || '');
  const thumb = _esc(item.urls?.thumb || url);
  const name  = _esc(item.displayName || item.filename || '');
  const size  = _esc(_fmtBytes(item.size || 0));
  const key   = _esc(item.key || item.id || '');
  return `<div class="media-item" data-url="${url}" data-key="${key}">
    <img src="${thumb}" alt="${name}" loading="lazy">
    <div class="media-item-overlay">
      <div class="media-item-filename">${name}</div>
      <div class="media-item-size">${size}</div>
    </div>
  </div>`;
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
