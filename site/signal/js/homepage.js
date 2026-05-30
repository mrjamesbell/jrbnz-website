import { showToast } from './toast.js';
import { openMediaPicker } from './media-picker.js';

let _initialized = false;
let _allPosts = [];

export async function initHomepageView() {
  if (!_initialized) {
    _initialized = true;
    document.getElementById('btn-homepage-save')?.addEventListener('click', _save);
    document.getElementById('btn-hp-hero-media')?.addEventListener('click', () =>
      openMediaPicker({ insertLabel: 'Use as hero image', onSelect: item => {
        const url = item.urls?.hero || item.publicUrl;
        const inp = document.getElementById('hp-hero-image');
        if (inp) { inp.value = url; inp.readOnly = false; }
      }})
    );
    document.getElementById('btn-hp-hero-clear')?.addEventListener('click', () => {
      const inp = document.getElementById('hp-hero-image');
      if (inp) inp.value = '';
    });
  }
  await _load();
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function _load() {
  const [postsRes, cfgRes] = await Promise.all([
    fetch('/api/posts').catch(e => { console.error('Failed to load posts:', e); return null; }),
    fetch('/api/homepage-config').catch(e => { console.error('Failed to load homepage config:', e); return null; }),
  ]);

  if (postsRes?.ok) {
    _allPosts = await postsRes.json();
  }

  const cfg = cfgRes?.ok ? await cfgRes.json() : {};

  _populateFeaturedSelect();
  _applyConfig(cfg);
}

function _populateFeaturedSelect() {
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
}

function _applyConfig(cfg) {
  _setVal('hp-featured-slug',    cfg.featured?.slug  || '');
  _setVal('hp-hero-image',       cfg.heroImage       || '');
  _setVal('hp-hero-description', cfg.heroDescription || '');
  _setVal('hp-quote',            cfg.quote           || '');
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function _save() {
  const btn = document.getElementById('btn-homepage-save');
  if (btn) btn.disabled = true;

  const cfg = {
    featured: {
      slug: _getVal('hp-featured-slug'),
    },
    heroImage:       _getVal('hp-hero-image'),
    heroDescription: _getVal('hp-hero-description'),
    quote:           _getVal('hp-quote'),
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
