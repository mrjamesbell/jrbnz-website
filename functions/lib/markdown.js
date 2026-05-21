export function mdEsc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeUrl(url) {
  try {
    const u = new URL(url, 'https://jrbnz.com');
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? url : '#';
  } catch { return '#'; }
}

export function mdInline(str) {
  return str
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${safeUrl(src)}" alt="${mdEsc(alt)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${safeUrl(href)}">${mdEsc(text)}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  let _pendingPair = null; // holds first figure of an img-pair until the second arrives

  function _flushPair() {
    if (_pendingPair !== null) { out.push(_pendingPair); _pendingPair = null; }
  }

  function _renderSignalImage(raw) {
    const srcM = raw.match(/src="([^"]*)"/);
    const altM = raw.match(/alt="([^"]*)"/);
    const imgRoleM = raw.match(/imgRole="([^"]*)"/);
    const treatmentM = raw.match(/treatment="([^"]*)"/);
    const layoutM = raw.match(/layout="([^"]*)"/);
    const widthM = raw.match(/width="(\d+)"/);
    const fxM = raw.match(/focalX="([^"]*)"/);
    const fyM = raw.match(/focalY="([^"]*)"/);

    const src = mdEsc(srcM?.[1] || '');
    const alt = mdEsc(altM?.[1] || '');
    if (!src) return;

    const imgRole = imgRoleM?.[1] || '';
    const treatment = treatmentM?.[1] || '';
    const focalX = fxM ? parseFloat(fxM[1]) : null;
    const focalY = fyM ? parseFloat(fyM[1]) : null;
    const focalStyle = (focalX !== null && focalY !== null)
      ? ` style="object-position:${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%"`
      : '';

    if (imgRole || treatment) {
      // Editorial role rendering — wrap in <figure>
      const isPair = imgRole === 'img-pair';
      const figClasses = isPair
        ? (treatment || null)           // pair wrapper handles layout; figure gets treatment only
        : [imgRole, treatment].filter(Boolean).join(' ');
      const figHtml = figClasses
        ? `<figure class="${figClasses}"><img src="${src}" alt="${alt}"${focalStyle} loading="lazy"></figure>`
        : `<figure><img src="${src}" alt="${alt}"${focalStyle} loading="lazy"></figure>`;

      if (isPair) {
        if (_pendingPair !== null) {
          out.push(`<div class="img-pair">${_pendingPair}${figHtml}</div>`);
          _pendingPair = null;
        } else {
          _pendingPair = figHtml;
        }
      } else {
        _flushPair();
        out.push(figHtml);
      }
    } else {
      // Legacy inline rendering
      _flushPair();
      const layout = layoutM?.[1] || 'full';
      const cls = { left: 'leftalign', right: 'rightalign', centre: 'img-centre' }[layout] || '';
      const isFloat = cls === 'leftalign' || cls === 'rightalign';
      const w = widthM ? parseInt(widthM[1], 10) : 100;
      const styleStr = w < 100
        ? ` style="max-width:${w}%${isFloat ? '' : ';display:block;margin-left:auto;margin-right:auto'}"`
        : '';
      out.push(`<img src="${src}" alt="${alt}"${cls ? ` class="${cls}"` : ''}${styleStr} loading="lazy">`);
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Snippet markers — CSS injected globally via SITE_HEAD; skip these comments
    if (line.match(/^<!--\s*signal:(css|snippet)\b.*-->$/)) { i++; continue; }

    // YouTube signal block
    const ytMatch = line.match(/<!--\s*signal:youtube\s+id="([a-zA-Z0-9_-]{11})"(?:\s+width="([^"]*)")?(?:\s+align="([^"]*)")?\s*-->/);
    if (ytMatch) {
      _flushPair();
      const ytId = ytMatch[1];
      const rawWidth = ytMatch[2] || '100';
      const ytAlign = ['left', 'center', 'right'].includes(ytMatch[3]) ? ytMatch[3] : 'center';
      const isBreakout = rawWidth === 'wide' || rawWidth === 'full';
      const ytPct = isBreakout ? '100' : String(Math.max(20, Math.min(100, parseInt(rawWidth, 10) || 100)));
      const wrapStyle = isBreakout
        ? 'width:100%;'
        : (ytAlign === 'center' ? `width:${ytPct}%;margin-left:auto;margin-right:auto;` : ytAlign === 'right' ? `width:${ytPct}%;margin-left:auto;` : `width:${ytPct}%;`);
      out.push(`<div class="youtube-embed" style="${wrapStyle}"><div style="position:relative;padding-top:56.25%;"><iframe style="position:absolute;inset:0;width:100%;height:100%;border:none;" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen loading="lazy"></iframe></div></div>`);
      i++;
      continue;
    }

    // Signal image block — single-line
    if (line.match(/<!--\s*signal:image\b.*?-->/)) {
      _renderSignalImage(line);
      i++; continue;
    }
    // Old multi-line signal:image blocks — collect into one string then parse same as single-line
    if (line.match(/<!--\s*signal:image\b/) && !line.includes('-->')) {
      let block = line;
      while (i < lines.length && !lines[i].includes('-->')) { i++; block += ' ' + lines[i]; }
      i++;
      _renderSignalImage(block);
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(mdEsc(lines[i])); i++; }
      out.push(`<pre><code${lang ? ` class="language-${mdEsc(lang)}"` : ''}>${code.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    const hm = line.match(/^(#{1,4})\s+(.*)/);
    if (hm) { out.push(`<h${hm[1].length}>${mdInline(hm[2])}</h${hm[1].length}>`); i++; continue; }

    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) { quoteLines.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote><p>${quoteLines.map(mdInline).join(' ')}</p></blockquote>`);
      continue;
    }

    if (line.match(/^[-*]\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) { items.push(`<li>${mdInline(lines[i].slice(2))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(`<li>${mdInline(lines[i].replace(/^\d+\.\s/, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) { _flushPair(); out.push('<hr>'); i++; continue; }

    if (line.match(/^<[a-zA-Z]/)) { _flushPair();
      const htmlLines = [];
      while (i < lines.length && lines[i].trim() !== '') { htmlLines.push(lines[i]); i++; }
      out.push(htmlLines.join('\n'));
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,4}\s|[-*]\s|\d+\.\s|```|>|<[a-zA-Z]|---+|\*\*\*+|<!--)/)
    ) { paraLines.push(lines[i]); i++; }
    if (paraLines.length) { _flushPair(); out.push(`<p>${paraLines.map(mdInline).join(' ')}</p>`); }
  }

  _flushPair(); // flush any orphaned first pair image at end of document
  return out.join('\n');
}
