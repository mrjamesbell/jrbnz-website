export function initMobile() {
  if (!window.visualViewport) return;
  const bar = document.getElementById('kb-accessory-bar');
  if (!bar) return;

  window.visualViewport.addEventListener('resize', () => {
    const keyboardUp = window.visualViewport.height < window.innerHeight * 0.75;
    bar.style.display = keyboardUp ? 'flex' : '';
  });
}

export function initSidebarToggle(openSidebar, closeSidebar) {
  const btn = document.getElementById('btn-menu');
  const overlay = document.getElementById('sidebar-overlay');
  if (btn) btn.addEventListener('click', openSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}
