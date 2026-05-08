import { extractVideoId, renderYouTubeBlock, fetchYouTubeTitle } from './youtube.js';

let markedReady = false;
const ytTitleCache = {};

function getMarked() {
  if (typeof marked === 'undefined') return null;
  if (!markedReady) {
    marked.setOptions({ breaks: true, gfm: true });

    // Custom renderer for YouTube blocks and images
    const renderer = new marked.Renderer();

    const origHtml = renderer.html.bind(renderer);
    renderer.html = function (token) {
      const html = typeof token === 'string' ? token : (token.raw || token.text || '');

      // Detect <!-- signal:youtube id="..." width="..." -->
      const ytMatch = html.match(/<!--\s*signal:youtube\s+id="([a-zA-Z0-9_-]{11})"(?:\s+width="([^"]*)")?\s*-->/);
      if (ytMatch) {
        const videoId = ytMatch[1];
        const width = ytMatch[2] || 'column';
        const cached = ytTitleCache[videoId];
        if (!cached) {
          fetchYouTubeTitle(videoId).then(title => {
            ytTitleCache[videoId] = title;
            const el = document.getElementById(`yt-title-${videoId}`);
            if (el) el.textContent = title;
          });
        }
        return renderYouTubeBlock(videoId, cached, width);
      }

      // Detect <!-- signal:image src="..." alt="..." layout="..." width="..." -->
      if (html.includes('signal:image')) {
        const srcM = html.match(/src="([^"]*)"/);
        const altM = html.match(/alt="([^"]*)"/);
        const layoutM = html.match(/layout="([^"]*)"/);
        const widthM = html.match(/width="(\d+)"/);
        const src = srcM?.[1] || '';
        const alt = altM?.[1] || '';
        const layout = layoutM?.[1] || 'full';
        const cls = { left: 'leftalign', right: 'rightalign', centre: 'img-centre' }[layout] || '';
        const isFloat = cls === 'leftalign' || cls === 'rightalign';
        const w = widthM ? parseInt(widthM[1], 10) : 100;
        const styleStr = w < 100
          ? `max-width:${w}%${isFloat ? '' : ';display:block;margin-left:auto;margin-right:auto'}`
          : 'max-width:100%';
        if (src) return `<img src="${src}" alt="${alt}"${cls ? ` class="${cls}"` : ''} loading="lazy" style="${styleStr}">`;
      }

      return origHtml(token);
    };

    const origImage = renderer.image.bind(renderer);
    renderer.image = function (href, title, text) {
      return `<img src="${href}" alt="${text || ''}" title="${title || ''}" loading="lazy" style="max-width:100%">`;
    };

    marked.use({ renderer });
    markedReady = true;
  }
  return marked;
}

export function renderMarkdown(md) {
  const m = getMarked();
  if (!m) return `<pre>${escHtml(md)}</pre>`;
  return m.parse(md || '');
}

export function countWords(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['''""]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(isoStr.slice(0, 10));
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
