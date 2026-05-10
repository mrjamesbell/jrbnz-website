export function mdEsc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function mdInline(str) {
  return str
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${mdEsc(alt)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${href}">${mdEsc(text)}</a>`)
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

  while (i < lines.length) {
    const line = lines[i];

    // YouTube signal block
    const ytMatch = line.match(/<!--\s*signal:youtube\s+id="([a-zA-Z0-9_-]{11})"(?:\s+width="([^"]*)")?(?:\s+align="([^"]*)")?\s*-->/);
    if (ytMatch) {
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
      const srcM = line.match(/src="([^"]*)"/);
      const altM = line.match(/alt="([^"]*)"/);
      const layoutM = line.match(/layout="([^"]*)"/);
      const widthM = line.match(/width="(\d+)"/);
      const src = mdEsc(srcM?.[1] || '');
      const alt = mdEsc(altM?.[1] || '');
      const layout = layoutM?.[1] || 'full';
      const cls = { left: 'leftalign', right: 'rightalign', centre: 'img-centre' }[layout] || '';
      const isFloat = cls === 'leftalign' || cls === 'rightalign';
      const w = widthM ? parseInt(widthM[1], 10) : 100;
      const styleStr = w < 100
        ? ` style="max-width:${w}%${isFloat ? '' : ';display:block;margin-left:auto;margin-right:auto'}"`
        : '';
      if (src) out.push(`<img src="${src}" alt="${alt}"${cls ? ` class="${cls}"` : ''}${styleStr} loading="lazy">`);
      i++; continue;
    }
    // Old multi-line signal:image blocks (skip)
    if (line.match(/<!--\s*signal:image\b/) && !line.includes('-->')) {
      while (i < lines.length && !lines[i].includes('-->')) i++;
      i++; continue;
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

    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) { out.push('<hr>'); i++; continue; }

    if (line.match(/^<[a-zA-Z]/)) {
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
    if (paraLines.length) out.push(`<p>${paraLines.map(mdInline).join(' ')}</p>`);
  }

  return out.join('\n');
}
