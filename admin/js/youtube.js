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

export function insertYouTubeBlock(textarea, videoId) {
  const block = `\n<!-- signal:youtube id="${videoId}" -->\n`;
  insertAtCursor(textarea, block);
}

function insertAtCursor(textarea, text) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
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

export function renderYouTubePreview(videoId, title) {
  return `<div class="youtube-block">
    <div class="youtube-thumb">
      <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div class="youtube-play" style="display:none"></div>
    </div>
    <div class="youtube-info">
      <div class="youtube-title">${escHtml(title || 'YouTube video')}</div>
      <div class="youtube-url">youtube.com/watch?v=${videoId}</div>
      <div class="youtube-note">Renders as embed on publish</div>
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
