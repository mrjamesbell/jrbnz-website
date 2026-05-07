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

export function insertYouTubeBlock(textarea, videoId, width = 'column') {
  const block = `\n<!-- signal:youtube id="${videoId}" width="${width}" -->\n`;
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

export function renderYouTubeBlock(videoId, title, width = 'column') {
  const t = escHtml(title || 'Loading…');
  return `<div class="youtube-block width-${width}" data-video-id="${videoId}">
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
  <div class="youtube-width-bar">
    <span class="youtube-width-label">Width</span>
    <button class="youtube-width-pill ${width === 'column' ? 'is-active' : ''}" data-width="column">Column</button>
    <button class="youtube-width-pill ${width === 'wide' ? 'is-active' : ''}" data-width="wide">Wide</button>
    <button class="youtube-width-pill ${width === 'full' ? 'is-active' : ''}" data-width="full">Full</button>
  </div>
</div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
