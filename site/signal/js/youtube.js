const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

export function extractVideoId(url) {
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function insertYouTubeBlock(textarea, videoId, width = '100', align = 'center') {
  const block = `\n<!-- signal:youtube id="${videoId}" width="${width}" align="${align}" -->\n`;
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  textarea.value = value.slice(0, start) + block + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + block.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

export async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(`/api/youtube/title?id=${videoId}`);
    if (!res.ok) return `youtube.com/watch?v=${videoId}`;
    const { title } = await res.json();
    return title || `youtube.com/watch?v=${videoId}`;
  } catch {
    return `youtube.com/watch?v=${videoId}`;
  }
}

export function renderYouTubeBlock(videoId, title, width = '100', align = 'center') {
  const isWide = width === 'wide';
  const isFull = width === 'full';
  // Legacy "column" → numeric 100
  const isLegacyColumn = width === 'column';
  const isBreakout = isWide || isFull;

  const pct = isBreakout || isLegacyColumn
    ? '100'
    : String(Math.max(20, Math.min(100, parseInt(width, 10) || 100)));
  const validAlign = ['left', 'center', 'right'].includes(align) ? align : 'center';

  const blockClass = isBreakout
    ? `youtube-block width-${width}`
    : `youtube-block align-${validAlign}`;
  const blockStyle = isBreakout ? '' : ` style="width:${pct}%"`;
  const storedWidth = isBreakout ? width : pct;

  const t = escHtml(title || 'Loading…');

  return `<div class="${blockClass}" data-video-id="${videoId}" data-width="${storedWidth}" data-align="${validAlign}"${blockStyle}>
  <div class="youtube-thumb-wrap" id="yt-thumb-${videoId}">
    <img class="youtube-thumb-img"
      src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg"
      alt="Video thumbnail"
      onerror="this.parentElement.classList.add('no-thumb'); this.remove()">
    <div class="youtube-play-btn"><div class="youtube-play-triangle"></div></div>
    <button class="youtube-remove-btn" data-action="remove-youtube" title="Remove">✕</button>
  </div>
  <div class="youtube-info-bar">
    <div class="youtube-title" id="yt-title-${videoId}">${t}</div>
    <div class="youtube-url-text">youtube.com/watch?v=${videoId}</div>
    <div class="youtube-embed-note">Embeds as video on publish</div>
  </div>
  <div class="youtube-controls-bar">
    <span class="youtube-ctrl-label">Width</span>
    <input class="youtube-width-input" type="number" min="20" max="100" step="5" value="${pct}"${isBreakout ? ' disabled' : ''}>
    <span class="youtube-ctrl-unit">%</span>
    <button class="youtube-size-preset ${isWide ? 'is-active' : ''}" data-preset="wide">Wide</button>
    <button class="youtube-size-preset ${isFull ? 'is-active' : ''}" data-preset="full">Full</button>
    <span class="youtube-ctrl-sep"></span>
    <span class="youtube-ctrl-label${isBreakout ? ' is-muted' : ''}">Align</span>
    <button class="youtube-align-pill ${!isBreakout && validAlign === 'left' ? 'is-active' : ''}" data-align="left">Left</button>
    <button class="youtube-align-pill ${!isBreakout && validAlign === 'center' ? 'is-active' : ''}" data-align="center">Center</button>
    <button class="youtube-align-pill ${!isBreakout && validAlign === 'right' ? 'is-active' : ''}" data-align="right">Right</button>
  </div>
</div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
