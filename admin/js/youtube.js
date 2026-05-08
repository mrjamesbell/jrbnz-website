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
  // Handle legacy width values (column/wide/full → 100%)
  const pct = ['column', 'wide', 'full'].includes(String(width))
    ? '100'
    : String(Math.max(20, Math.min(100, parseInt(width, 10) || 100)));
  const validAlign = ['left', 'center', 'right'].includes(align) ? align : 'center';
  const t = escHtml(title || 'Loading…');
  return `<div class="youtube-block align-${validAlign}" data-video-id="${videoId}" data-width="${pct}" data-align="${validAlign}" style="width:${pct}%">
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
    <input class="youtube-width-input" type="number" min="20" max="100" step="5" value="${pct}">
    <span class="youtube-ctrl-unit">%</span>
    <span class="youtube-ctrl-sep"></span>
    <span class="youtube-ctrl-label">Align</span>
    <button class="youtube-align-pill ${validAlign === 'left' ? 'is-active' : ''}" data-align="left">Left</button>
    <button class="youtube-align-pill ${validAlign === 'center' ? 'is-active' : ''}" data-align="center">Center</button>
    <button class="youtube-align-pill ${validAlign === 'right' ? 'is-active' : ''}" data-align="right">Right</button>
  </div>
</div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
