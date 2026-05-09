let saveTimer = null;
let savePip = null;
let saveDot = null;
let saveText = null;
let saveStatus = null;
let railPip = null;

export function initAutosave() {
  savePip = document.getElementById('rail-pip');
  saveDot = document.getElementById('topbar-save-dot');
  saveText = document.getElementById('topbar-save-text');
  saveStatus = document.getElementById('topbar-save-status');
  railPip = document.getElementById('rail-pip');
}

export function scheduleSave(getPayload, onSave, onError) {
  clearTimeout(saveTimer);
  _setSaving(false);
  saveTimer = setTimeout(async () => {
    _setSaving(true);
    try {
      const payload = getPayload();
      await _doSave(payload);
      _setSaved();
      onSave && onSave();
    } catch (e) {
      _setError();
      onError && onError(e);
    }
  }, 1500);
}

export function cancelScheduled() {
  clearTimeout(saveTimer);
}

export async function saveNow(getPayload) {
  clearTimeout(saveTimer);
  _setSaving(true);
  const payload = getPayload();
  await _doSave(payload);
  _setSaved();
}

async function _doSave({ slug, title, body, tags, date, excerpt, coverImage, wordCount }) {
  const res = await fetch(`/api/posts/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, tags, date, excerpt, coverImage, wordCount, status: 'draft' })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function _setSaving(active) {
  if (!saveStatus) return;
  if (active) {
    saveStatus.style.display = 'flex';
    if (saveDot) saveDot.style.background = 'var(--color-accent)';
    if (savePip) savePip.classList.add('is-saving');
    if (savePip) savePip.classList.remove('is-error');
    if (saveText) saveText.textContent = 'Saving…';
  }
}

function _setSaved() {
  if (!saveStatus) return;
  saveStatus.style.display = 'flex';
  if (saveDot) saveDot.style.background = 'var(--color-saved)';
  if (savePip) savePip.classList.remove('is-saving', 'is-error');
  if (saveText) saveText.textContent = 'Saved';
}

function _setError() {
  if (!saveStatus) return;
  saveStatus.style.display = 'flex';
  if (saveDot) saveDot.style.background = 'var(--color-danger)';
  if (savePip) savePip.classList.add('is-error');
  if (savePip) savePip.classList.remove('is-saving');
  if (saveText) saveText.textContent = 'Save failed';
}
