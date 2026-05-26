import { SNIPPETS } from './snippets.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';

let _snippets = [];
let _editingId = null;
let _inited = false;

export async function initSnippetsView() {
  if (!_inited) {
    _inited = true;
    await _loadSnippets();
    _bindActions();
  }
  _renderList();
  _hideForm();
}

async function _loadSnippets() {
  try {
    const res = await fetch('/api/snippets');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _snippets = Array.isArray(data) && data.length ? data : SNIPPETS.map(s => ({ id: s.id, label: s.label, css: s.css, html: s.html }));
  } catch {
    _snippets = SNIPPETS.map(s => ({ id: s.id, label: s.label, css: s.css, html: s.html }));
  }
}

async function _save() {
  const res = await fetch('/api/snippets', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_snippets),
  });
  if (!res.ok) throw new Error(await res.text());
}

function _renderList() {
  const el = document.getElementById('snippet-list');
  if (!el) return;
  if (!_snippets.length) {
    el.innerHTML = '<p class="post-list-empty">No snippets yet.</p>';
    return;
  }
  el.innerHTML = _snippets.map(s => `
    <div class="post-list-item" data-snippet-id="${s.id}" style="cursor:pointer">
      <div class="post-list-item-inner">
        <span class="post-list-title-text">${s.label}</span>
        <span class="post-list-status is-draft">${s.id}</span>
      </div>
    </div>`).join('');
  el.querySelectorAll('.post-list-item').forEach(item => {
    item.addEventListener('click', () => _editSnippet(item.dataset.snippetId));
  });
}

function _editSnippet(id) {
  const s = _snippets.find(x => x.id === id);
  if (!s) return;
  _editingId = id;
  document.getElementById('snippet-name').value = s.label;
  document.getElementById('snippet-css').value = s.css;
  document.getElementById('snippet-html').value = s.html;
  document.getElementById('btn-snippet-delete').style.display = '';
  _showForm();
}

function _newSnippet() {
  _editingId = null;
  document.getElementById('snippet-name').value = '';
  document.getElementById('snippet-css').value = '';
  document.getElementById('snippet-html').value = '';
  document.getElementById('btn-snippet-delete').style.display = 'none';
  _showForm();
  document.getElementById('snippet-name').focus();
}

function _showForm() {
  document.getElementById('snippet-form').style.display = '';
}

function _hideForm() {
  const el = document.getElementById('snippet-form');
  if (el) el.style.display = 'none';
  _editingId = null;
}

function _bindActions() {
  document.getElementById('btn-new-snippet')?.addEventListener('click', _newSnippet);

  document.getElementById('btn-snippet-cancel')?.addEventListener('click', _hideForm);

  document.getElementById('btn-snippet-save')?.addEventListener('click', async () => {
    const label = document.getElementById('snippet-name').value.trim();
    const css = document.getElementById('snippet-css').value.trim();
    const html = document.getElementById('snippet-html').value.trim();
    if (!label) { showToast('Name required', 'error'); return; }

    if (_editingId) {
      const idx = _snippets.findIndex(s => s.id === _editingId);
      if (idx !== -1) _snippets[idx] = { ..._snippets[idx], label, css, html };
    } else {
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      _snippets.push({ id, label, css, html });
    }

    try {
      await _save();
      showToast('Saved', 'success');
      _hideForm();
      _renderList();
    } catch {
      showToast('Save failed', 'error');
    }
  });

  document.getElementById('btn-snippet-delete')?.addEventListener('click', () => {
    if (!_editingId) return;
    const id = _editingId;
    showConfirm('Delete this snippet?', async () => {
      _snippets = _snippets.filter(s => s.id !== id);
      try {
        await _save();
        showToast('Deleted', 'default');
        _hideForm();
        _renderList();
      } catch {
        showToast('Delete failed', 'error');
      }
    });
  });
}
