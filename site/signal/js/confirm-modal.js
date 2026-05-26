export function showConfirm(msg, onConfirm, { okLabel = 'Delete' } = {}) {
  const backdrop = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-modal-msg');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  msgEl.textContent = msg;
  okBtn.textContent = okLabel;
  backdrop.style.display = '';

  function close() {
    backdrop.style.display = 'none';
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', close);
    backdrop.removeEventListener('click', onBackdrop);
  }
  function onOk() { close(); onConfirm(); }
  function onBackdrop(e) { if (e.target === backdrop) close(); }

  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', onBackdrop);
}
