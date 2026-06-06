/*
 * Signal Admin — Command palette (⌘K / Ctrl+K)
 *
 * Fuzzy-searchable launcher for navigation, actions, and opening any post.
 * Self-contained: imports navigate + getAllPosts from app.js and
 * toggleFocusMode from editor.js. The ⌘K listener is registered on import.
 */

import { navigate, getAllPosts } from './app.js';
import { toggleFocusMode } from './editor.js';

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  edit:     svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
  file:     svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
  posts:    svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  media:    svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  snippet:  svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  home:     svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  user:     svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  settings: svg('<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>'),
  help:     svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  focus:    svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  globe:    svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  doc:      svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
};

let _results = [];
let _active = 0;

function _staticCommands() {
  const nav = (h) => () => navigate(h);
  return [
    { icon: ICONS.edit,     label: 'New post',          kw: 'new post create write',        run: () => document.getElementById('btn-new-post-main')?.click() },
    { icon: ICONS.file,     label: 'New page',          kw: 'new page create',              run: () => { navigate('pages'); setTimeout(() => document.getElementById('btn-new-page-main')?.click(), 80); } },
    { icon: ICONS.posts,    label: 'Go to Posts',       kw: 'posts list',                   run: nav('') },
    { icon: ICONS.file,     label: 'Go to Pages',       kw: 'pages',                        run: nav('pages') },
    { icon: ICONS.media,    label: 'Go to Media',       kw: 'media images library photos',  run: nav('media') },
    { icon: ICONS.snippet,  label: 'Go to Snippets',    kw: 'snippets code html css',       run: nav('snippets') },
    { icon: ICONS.home,     label: 'Go to Homepage',    kw: 'homepage featured hero',       run: nav('homepage') },
    { icon: ICONS.user,     label: 'Go to Author',      kw: 'author profile bio headshot',  run: nav('author') },
    { icon: ICONS.settings, label: 'Go to Settings',    kw: 'settings theme accent deploy', run: nav('settings') },
    { icon: ICONS.help,     label: 'Help',              kw: 'help docs markdown guide',     run: nav('help') },
    { icon: ICONS.focus,    label: 'Toggle focus mode', kw: 'focus distraction zen write',  run: () => toggleFocusMode() },
    { icon: ICONS.globe,    label: 'View live site',    kw: 'live site jrbnz open',          run: () => window.open('https://jrbnz.com', '_blank', 'noopener') },
  ];
}

function _allItems() {
  const posts = (getAllPosts() || []).map(p => ({
    icon: ICONS.doc,
    label: p.title || '(untitled)',
    sub: p.status === 'published' ? 'Post' : 'Draft',
    kw: `${p.title || ''} ${p.excerpt || ''}`,
    run: () => navigate('edit/' + p.slug),
  }));
  return _staticCommands().concat(posts);
}

function _filter(q) {
  const items = _allItems();
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(it => (it.label + ' ' + (it.kw || '')).toLowerCase().includes(needle));
}

function _render() {
  const list = document.getElementById('palette-results');
  const empty = document.getElementById('palette-empty');
  if (!list) return;
  if (!_results.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  list.innerHTML = _results.map((it, i) => `
    <button class="palette-item${i === _active ? ' is-active' : ''}" role="option" data-i="${i}" aria-selected="${i === _active}">
      <span class="palette-item-icon">${it.icon}</span>
      <span class="palette-item-label">${_esc(it.label)}</span>
      ${it.sub ? `<span class="palette-item-sub">${_esc(it.sub)}</span>` : ''}
    </button>`).join('');
}

function _esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function _setActive(i) {
  if (!_results.length) return;
  _active = (i + _results.length) % _results.length;
  _render();
  const el = document.querySelector(`.palette-item[data-i="${_active}"]`);
  el?.scrollIntoView({ block: 'nearest' });
}

function _run(i) {
  const it = _results[i];
  if (!it) return;
  closePalette();
  it.run();
}

export function openPalette() {
  const backdrop = document.getElementById('palette-backdrop');
  const input = document.getElementById('palette-input');
  if (!backdrop || !input) return;
  backdrop.hidden = false;
  input.value = '';
  _active = 0;
  _results = _filter('');
  _render();
  requestAnimationFrame(() => input.focus());
}

export function closePalette() {
  const backdrop = document.getElementById('palette-backdrop');
  if (backdrop) backdrop.hidden = true;
}

function _isOpen() {
  const backdrop = document.getElementById('palette-backdrop');
  return backdrop && !backdrop.hidden;
}

export function initPalette() {
  const backdrop = document.getElementById('palette-backdrop');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-results');
  if (!backdrop || !input || !list) return;

  input.addEventListener('input', () => {
    _results = _filter(input.value);
    _active = 0;
    _render();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); _setActive(_active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _setActive(_active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); _run(_active); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });

  list.addEventListener('click', e => {
    const item = e.target.closest('.palette-item');
    if (!item) return;
    _run(Number(item.dataset.i));
  });

  // Clicking the backdrop (outside the panel) closes it
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closePalette(); });
}

// Global ⌘K / Ctrl+K to open (toggle)
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    _isOpen() ? closePalette() : openPalette();
  }
});
