import { showToast } from './toast.js';

let _initialized = false;
let _allPosts = [];

export async function initHomepageView() {
  if (!_initialized) {
    _initialized = true;
    _buildCardBlocks();
    document.getElementById('btn-homepage-save')?.addEventListener('click', _save);
    document.getElementById('btn-hp-interlude-media')?.addEventListener('click', _openInterlucdeMediaPicker);
  }
  await _load();
}

// ── Card blocks (built once) ─────────────────────────────────────────────────

function _buildCardBlocks() {
  const container = document.getElementById('hp-cards-container');
  if (!container) return;
  container.innerHTML = [0, 1, 2].map(i => `
    <div class="settings-page-field" style="border:1px solid var(--color-cream-border);border-radius:var(--radius-md);padding:16px;margin-bottom:12px">
      <p class="field-label" style="margin-bottom:12px">Card ${i + 1}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label class="field-label" style="font-size:11px" for="hp-card-${i}-kicker">Kicker</label>
          <input class="field-input" type="text" id="hp-card-${i}-kicker" placeholder="Essays">
        </div>
        <div>
          <label class="field-label" style="font-size:11px" for="hp-card-${i}-style">Style</label>
          <select class="field-select" id="hp-card-${i}-style">
            <option value="">Dark (default)</option>
            <option value="invert">Inverted (warm)</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:8px">
        <label class="field-label" style="font-size:11px" for="hp-card-${i}-title">Title / description</label>
        <input class="field-input" type="text" id="hp-card-${i}-title" placeholder="Long-form pieces that behave more like scenes than posts.">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="field-label" style="font-size:11px" for="hp-card-${i}-href">Link URL</label>
          <input class="field-input" type="url" id="hp-card-${i}-href" placeholder="/posts/">
        </div>
        <div>
          <label class="field-label" style="font-size:11px" for="hp-card-${i}-linklabel">Link label</label>
          <input class="field-input" type="text" id="hp-card-${i}-linklabel" placeholder="Read essays →">
        </div>
      </div>
    </div>
  `).join('');
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function _load() {
  const [postsRes, cfgRes] = await Promise.all([
    fetch('/api/posts').catch(() => null),
    fetch('/api/homepage-config').catch(() => null),
  ]);

  if (postsRes?.ok) {
    _allPosts = await postsRes.json();
  }

  const cfg = cfgRes?.ok ? await cfgRes.json() : {};

  _populatePostSelects();
  _applyConfig(cfg);
}

function _populatePostSelects() {
  const essays = _allPosts
    .filter(p => p.status === 'published' && !(p.tags || []).includes('note'))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const opts = essays.map(p => `<option value="${_esc(p.slug)}">${_esc(p.title)}</option>`).join('');

  const featuredSel = document.getElementById('hp-featured-slug');
  if (featuredSel) {
    const current = featuredSel.value;
    featuredSel.innerHTML = `<option value="">— Auto (most recent essay) —</option>${opts}`;
    featuredSel.value = current;
  }

  for (let i = 0; i < 3; i++) {
    const sel = document.getElementById(`hp-archive-post-${i}`);
    if (sel) {
      const current = sel.value;
      sel.innerHTML = `<option value="">— Auto —</option>${opts}`;
      sel.value = current;
    }
  }
}

function _applyConfig(cfg) {
  _setVal('hp-featured-slug', cfg.featured?.slug || '');
  _setVal('hp-featured-title', cfg.featured?.titleOverride || '');
  _setVal('hp-featured-dek', cfg.featured?.dekOverride || '');
  _setVal('hp-featured-image', cfg.featured?.imageOverride || '');
  _setVal('hp-featured-cta', cfg.featured?.ctaLabel || '');

  const cards = cfg.cards || [];
  for (let i = 0; i < 3; i++) {
    const c = cards[i] || {};
    _setVal(`hp-card-${i}-kicker`, c.kicker || '');
    _setVal(`hp-card-${i}-title`, c.title || '');
    _setVal(`hp-card-${i}-href`, c.href || '');
    _setVal(`hp-card-${i}-linklabel`, c.linkLabel || '');
    _setVal(`hp-card-${i}-style`, c.style || '');
  }

  _setVal('hp-interlude-text', cfg.interlude?.text || '');
  _setVal('hp-interlude-image', cfg.interlude?.image || '');
  _setVal('hp-interlude-treatment', cfg.interlude?.treatment || 'photo-muted');
  _setVal('hp-interlude-href', cfg.interlude?.href || '');

  _setVal('hp-archive-title', cfg.archive?.title || '');
  const archivePosts = cfg.archive?.posts || [];
  for (let i = 0; i < 3; i++) {
    _setVal(`hp-archive-post-${i}`, archivePosts[i] || '');
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function _save() {
  const btn = document.getElementById('btn-homepage-save');
  if (btn) btn.disabled = true;

  const cards = [0, 1, 2].map(i => ({
    kicker: _getVal(`hp-card-${i}-kicker`),
    title: _getVal(`hp-card-${i}-title`),
    href: _getVal(`hp-card-${i}-href`),
    linkLabel: _getVal(`hp-card-${i}-linklabel`),
    style: _getVal(`hp-card-${i}-style`),
  })).filter(c => c.title || c.href);

  const archivePosts = [0, 1, 2]
    .map(i => _getVal(`hp-archive-post-${i}`))
    .filter(Boolean);

  const cfg = {
    featured: {
      slug: _getVal('hp-featured-slug'),
      titleOverride: _getVal('hp-featured-title'),
      dekOverride: _getVal('hp-featured-dek'),
      imageOverride: _getVal('hp-featured-image'),
      ctaLabel: _getVal('hp-featured-cta'),
    },
    cards,
    interlude: {
      text: _getVal('hp-interlude-text'),
      image: _getVal('hp-interlude-image'),
      treatment: _getVal('hp-interlude-treatment') || 'photo-muted',
      href: _getVal('hp-interlude-href'),
    },
    archive: {
      title: _getVal('hp-archive-title'),
      posts: archivePosts,
    },
  };

  try {
    const res = await fetch('/api/homepage-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    if (!res.ok) throw new Error('Save failed');
    showToast('Homepage published', 'success', 2000);
  } catch (e) {
    showToast('Failed to save: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Interlude image picker ────────────────────────────────────────────────────

async function _openInterlucdeMediaPicker() {
  const modal = document.getElementById('media-picker-modal');
  if (!modal) { showToast('Media picker not available', 'error'); return; }

  const grid = document.getElementById('media-picker-grid');
  const insertBtn = document.getElementById('media-picker-insert');
  const closeBtn = document.getElementById('media-picker-close');
  const cancelBtn = document.getElementById('media-picker-cancel');
  const searchEl = document.getElementById('media-picker-search');
  const infoEl = document.getElementById('picker-selected-info');

  grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">Loading…</div>';
  insertBtn.disabled = true;
  insertBtn.textContent = 'Use as interlude image';
  if (infoEl) infoEl.textContent = '';
  if (searchEl) searchEl.value = '';
  modal.style.display = 'flex';

  let selected = null;

  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    if (!items.length) {
      grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted);font-family:var(--font-sans)">No media uploaded yet.</div>';
    } else {
      grid.innerHTML = items.map(item => {
        const url = _esc(item.publicUrl || item.url || '');
        return `<div class="media-picker-item" data-url="${url}" style="cursor:pointer;border:2px solid transparent;border-radius:4px;overflow:hidden;aspect-ratio:1;background:#111">
          <img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
        </div>`;
      }).join('');
      grid.querySelectorAll('.media-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          grid.querySelectorAll('.media-picker-item').forEach(i => i.style.borderColor = 'transparent');
          item.style.borderColor = 'var(--color-accent)';
          selected = item.dataset.url;
          insertBtn.disabled = false;
          if (infoEl) infoEl.textContent = selected.split('/').pop();
        });
      });
    }
  } catch {
    grid.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--color-cream-text-muted)">Failed to load media.</div>';
  }

  const onInsert = () => {
    if (selected) {
      const inp = document.getElementById('hp-interlude-image');
      if (inp) inp.value = selected;
    }
    cleanup();
  };

  const cleanup = () => {
    modal.style.display = 'none';
    insertBtn.removeEventListener('click', onInsert);
    closeBtn?.removeEventListener('click', cleanup);
    cancelBtn?.removeEventListener('click', cleanup);
  };

  insertBtn.addEventListener('click', onInsert);
  closeBtn?.addEventListener('click', cleanup);
  cancelBtn?.addEventListener('click', cleanup);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _getVal(id) {
  return (document.getElementById(id)?.value || '').trim();
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
