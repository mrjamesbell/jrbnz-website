export function initMobile() {
  if (!window.visualViewport) return;
  const bar = document.getElementById('kb-accessory-bar');
  if (!bar) return;

  window.visualViewport.addEventListener('resize', () => {
    const keyboardUp = window.visualViewport.height < window.innerHeight * 0.75;
    bar.style.display = keyboardUp ? 'flex' : '';
  });
}
