// Shared HTML template helpers used by all page renderers.
// These functions output HTML structure only — no CSS, no inline styles
// (the one exception is the runtime accent-colour override, which is data).

export const SITE_URL = 'https://jrbnz.com';

// Per-theme Google Fonts URLs. Themes using only system fonts return null.
const THEME_FONTS = {
  dark: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Bebas+Neue&display=swap',
};

export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Returns the best foreground colour for a given accent background.
function siteAccentFg(color) {
  let lum;
  if (color.startsWith('#') && color.length >= 7) {
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  } else {
    const m = color.match(/oklch\(\s*([0-9.]+)%/);
    if (!m) return 'oklch(97% 0.008 75)';
    lum = Math.pow(parseFloat(m[1]) / 100, 3);
  }
  return lum > 0.175 ? '#1c1c1c' : 'oklch(97% 0.008 75)';
}

export function buildHead({ title, theme = 'dark', accent = '', snippetCss = '', extraHead = '', inlineCss = '' }) {
  const fontsUrl = THEME_FONTS[theme];
  const safeAccent = /^#[0-9a-fA-F]{3,8}$|^oklch\([^)]{1,80}\)$/.test(accent ?? '') ? accent : '';
  const accentFg = safeAccent ? siteAccentFg(safeAccent) : '';
  const accentStyle = safeAccent
    ? `<style>:root{--color-accent:${safeAccent};--color-accent-fg:${accentFg};--accent-color:${safeAccent};--accent-fg:${accentFg}}</style>`
    : '';
  const cssTag = inlineCss
    ? `<style>${inlineCss}</style>`
    : `<link rel="stylesheet" href="/styles/themes/${esc(theme)}.css">`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="${esc(theme)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title ? `${esc(title)} - James Bell` : 'James Bell'}</title>
${fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsUrl}" rel="stylesheet">` : ''}
<link rel="stylesheet" href="/styles/site.css">
${cssTag}
<link rel="alternate" type="application/rss+xml" title="James Bell" href="/feed.xml">
<link rel="micropub" href="/api/micropub">
${accentStyle}
${snippetCss ? `<style>${snippetCss}</style>` : ''}
${extraHead}
</head>
<body>`;
}

// ── Nav ──────────────────────────────────────────────────────────────────────

export function buildNavLinks(menuPages) {
  const cmsPages = (menuPages || []).filter(p => p.include_in_menu && p.status === 'published');
  const now = cmsPages.find(p => p.slug === 'now');
  const others = cmsPages.filter(p => p.slug !== 'now');
  const pageLink = p => ({ href: p.nav_url || `/${p.slug}/`, label: p.title });
  return [
    ...(now ? [pageLink(now)] : []),
    { href: '/posts/', label: 'Essays' },
    { href: '/photos/', label: 'Photos' },
    { href: '/notes/', label: 'Notes' },
    ...others.map(pageLink),
  ];
}

export function buildSiteNav(menuPages, activeHref) {
  const links = buildNavLinks(menuPages)
    .map(l => `<li><a href="${esc(l.href)}"${l.href === activeHref ? ' class="active"' : ''}>${esc(l.label)}</a></li>`)
    .join('\n    ');
  return `<nav class="site-nav" aria-label="Main navigation">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    ${links}
  </ul>
</nav>`;
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function buildFooter(year) {
  return `<footer class="footer">
  <div class="footer-inner">
    <span class="footer-copy">&copy;${year} James Bell</span>
    <div class="footer-links">
      <a href="/feed.xml" class="footer-rss">RSS</a>
      <a href="/signal/" class="footer-signal" title="Made with Signal" aria-label="Signal">
        <img src="/signal/signal-logo.png" alt="" width="50" height="50">
      </a>
    </div>
  </div>
</footer>`;
}

// ── Post metadata (OG / JSON-LD) ─────────────────────────────────────────────

export function buildPostMeta({ title, postUrl, metaDesc, ogImage, date, authorName }) {
  const t = esc(title);
  const d = esc(metaDesc || '');
  const i = esc(ogImage);
  const u = esc(postUrl);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    url: postUrl,
    image: ogImage,
    author: { '@type': 'Person', name: authorName || 'James Bell', url: SITE_URL },
    publisher: { '@type': 'Person', name: authorName || 'James Bell', url: SITE_URL },
  };
  if (metaDesc) jsonLd.description = metaDesc;
  if (date) { jsonLd.datePublished = date.slice(0, 10); jsonLd.dateModified = date.slice(0, 10); }
  return [
    d ? `<meta name="description" content="${d}">` : '',
    `<link rel="canonical" href="${u}">`,
    `<meta property="og:title" content="${t}">`,
    d ? `<meta property="og:description" content="${d}">` : '',
    `<meta property="og:image" content="${i}">`,
    `<meta property="og:url" content="${u}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="James Bell">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    d ? `<meta name="twitter:description" content="${d}">` : '',
    `<meta name="twitter:image" content="${i}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ].filter(Boolean).join('\n');
}

// ── Author card (sidebar variant) ────────────────────────────────────────────

export function buildAuthorCard(author) {
  if (!author || !author.name) return '';
  const resolve = (handle, base) => !handle ? ''
    : handle.startsWith('http') ? handle
    : `${base}${handle.replace('@', '')}`;
  const socials = [
    resolve(author.threads, 'https://threads.net/') && `<a href="${esc(resolve(author.threads, 'https://threads.net/'))}" class="social-link" rel="noopener noreferrer" target="_blank">Threads</a>`,
    resolve(author.instagram, 'https://instagram.com/') && `<a href="${esc(resolve(author.instagram, 'https://instagram.com/'))}" class="social-link" rel="noopener noreferrer" target="_blank">Instagram</a>`,
    resolve(author.linkedin, 'https://linkedin.com/in/') && `<a href="${esc(resolve(author.linkedin, 'https://linkedin.com/in/'))}" class="social-link" rel="noopener noreferrer" target="_blank">LinkedIn</a>`,
    resolve(author.flickr, 'https://flickr.com/photos/') && `<a href="${esc(resolve(author.flickr, 'https://flickr.com/photos/'))}" class="social-link" rel="noopener noreferrer" target="_blank">Flickr</a>`,
  ].filter(Boolean).join('\n      ');
  return `<div class="sidebar-block">
  <div class="sidebar-label">Author</div>
  <div class="sidebar-author">
    ${author.headshotUrl ? `<img class="sidebar-avatar" src="${esc(author.headshotUrl)}" alt="${esc(author.name)}">` : ''}
    <div>
      <div class="sidebar-author-name">${esc(author.name)}</div>
      ${author.bio ? `<div class="sidebar-author-bio">${esc(author.bio)}</div>` : ''}
      ${socials ? `<div class="sidebar-social">${socials}</div>` : ''}
    </div>
  </div>
</div>`;
}
