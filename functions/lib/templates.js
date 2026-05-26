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

export function buildHead({ title, theme = 'dark', accent = '', snippetCss = '', extraHead = '' }) {
  const fontsUrl = THEME_FONTS[theme];
  const safeAccent = /^#[0-9a-fA-F]{3,8}$|^oklch\([^)]{1,80}\)$/.test(accent ?? '') ? accent : '';
  const accentFg = safeAccent ? siteAccentFg(safeAccent) : '';
  const accentStyle = safeAccent
    ? `<style>:root{--color-accent:${safeAccent};--color-accent-fg:${accentFg};--accent-color:${safeAccent};--accent-fg:${accentFg}}</style>`
    : '';
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
<link rel="stylesheet" href="/styles/themes/${esc(theme)}.css">
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

const SIGNAL_MARK = `<svg class="footer-signal-icon" viewBox="0 0 513 513" fill="currentColor" aria-hidden="true"><g transform="translate(1 1)"><path d="M178.2,161.133c0,14.507-11.093,25.6-25.6,25.6c-14.507,0-25.6-11.093-25.6-25.6c0-14.507,11.093-25.6,25.6-25.6C167.107,135.533,178.2,146.627,178.2,161.133"/><path d="M502.467,502.467H127V485.4c0-9.387,7.68-17.067,17.067-17.067H485.4c9.387,0,17.067,7.68,17.067,17.067V502.467z"/><path d="M476.867,502.467H127V485.4c0-9.387,7.68-17.067,17.067-17.067H459.8c9.387,0,17.067,7.68,17.067,17.067V502.467z"/><path d="M357.4,408.6c-9.387,0-17.92-2.56-25.6-6.827v66.56H383v-66.56C375.32,406.04,366.787,408.6,357.4,408.6"/><path d="M408.6,357.4c0,28.16-23.04,51.2-51.2,51.2s-51.2-23.04-51.2-51.2s23.04-51.2,51.2-51.2S408.6,329.24,408.6,357.4"/><path d="M306.2,357.4c0-28.16,23.04-51.2,51.2-51.2c14.507,0,27.307,5.973,36.693,15.36c39.253-74.24,28.16-168.107-34.133-231.253L81.773,368.493c65.707,65.707,166.4,75.093,242.347,28.16C313.027,386.413,306.2,372.76,306.2,357.4"/><path d="M298.52,361.667c0-28.16,13.653-55.467,39.253-55.467c5.12,0,9.387,0.853,13.653,2.56c12.8,4.267,26.453-3.413,30.72-16.213c22.187-64.853,14.507-128-34.133-182.613L90.307,368.493C150.04,434.2,246.467,447,314.733,400.067C305.347,390.68,298.52,377.027,298.52,361.667"/><path d="M502.467,511H127c-5.12,0-8.533-3.413-8.533-8.533V485.4c0-14.507,11.093-25.6,25.6-25.6H485.4c14.507,0,25.6,11.093,25.6,25.6v17.067C511,507.587,507.587,511,502.467,511z M135.533,493.933h358.4V485.4c0-5.12-3.413-8.533-8.533-8.533H144.067c-5.12,0-8.533,3.413-8.533,8.533V493.933z"/><path d="M220.867,237.933c-2.56,0-4.267-0.853-5.973-2.56l-50.347-50.347c-3.413-3.413-3.413-8.533,0-11.947s8.533-3.413,11.947,0l50.347,50.347c3.413,3.413,3.413,8.533,0,11.947C225.133,237.08,223.427,237.933,220.867,237.933z"/><path d="M169.667,286.573c-5.12,0-8.533-3.413-8.533-8.533v-98.133c0-5.12,3.413-8.533,8.533-8.533c5.12,0,8.533,3.413,8.533,8.533v98.133C178.2,283.16,174.787,286.573,169.667,286.573z"/><path d="M272.067,186.733H171.373c-5.12,0-8.533-3.413-8.533-8.533c0-5.12,3.413-8.533,8.533-8.533h100.693c5.12,0,8.533,3.413,8.533,8.533C280.6,183.32,277.187,186.733,272.067,186.733z"/><path d="M152.6,195.267c-18.773,0-34.133-15.36-34.133-34.133S133.827,127,152.6,127s34.133,15.36,34.133,34.133S171.373,195.267,152.6,195.267z M152.6,144.067c-9.387,0-17.067,7.68-17.067,17.067s7.68,17.067,17.067,17.067s17.067-7.68,17.067-17.067S161.987,144.067,152.6,144.067z"/><path d="M92.867,144.067c-5.12,0-8.533-3.413-8.533-8.533c0-28.16,23.04-51.2,51.2-51.2c5.12,0,8.533,3.413,8.533,8.533s-3.413,8.533-8.533,8.533c-18.773,0-34.133,15.36-34.133,34.133C101.4,140.653,97.987,144.067,92.867,144.067z"/><path d="M50.2,135.533c-5.12,0-8.533-3.413-8.533-8.533c0-46.933,38.4-85.333,85.333-85.333c5.12,0,8.533,3.413,8.533,8.533s-3.413,8.533-8.533,8.533c-37.547,0-68.267,30.72-68.267,68.267C58.733,132.12,55.32,135.533,50.2,135.533z"/><path d="M7.533,135.533C2.413,135.533-1,132.12-1,127C-1,56.173,56.173-1,127,-1c5.12,0,8.533,3.413,8.533,8.533s-3.413,8.533-8.533,8.533C65.56,16.067,16.067,65.56,16.067,127C16.067,132.12,12.653,135.533,7.533,135.533z"/><path d="M357.4,417.133c-33.28,0-59.733-26.453-59.733-59.733s26.453-59.733,59.733-59.733s59.733,26.453,59.733,59.733S390.68,417.133,357.4,417.133z M357.4,314.733c-23.893,0-42.667,18.773-42.667,42.667c0,23.893,18.773,42.667,42.667,42.667c23.893,0,42.667-18.773,42.667-42.667C400.067,333.507,381.293,314.733,357.4,314.733z"/><path d="M383,476.867h-51.2c-5.12,0-8.533-3.413-8.533-8.533v-66.56c0-3.413,1.707-5.973,4.267-7.68s5.973-1.707,8.533,0c12.8,7.68,29.867,7.68,42.667,0c2.56-1.707,5.973-1.707,8.533,0s4.267,4.267,4.267,7.68v66.56C391.533,473.453,388.12,476.867,383,476.867z M340.333,459.8h34.133v-45.227c-11.093,3.413-23.04,3.413-34.133,0V459.8z"/><path d="M220.867,434.2c-52.907,0-104.96-20.48-144.213-59.733c-3.413-3.413-3.413-8.533,0-11.947L353.987,84.333c3.413-3.413,8.533-3.413,11.947,0c64,64,78.507,161.28,35.84,241.493c-1.707,2.56-3.413,4.267-5.973,4.267s-5.12-0.853-7.68-2.56c-8.533-8.533-18.773-12.8-30.72-12.8c-23.893,0-42.667,18.773-42.667,42.667c0,12.8,5.12,23.893,14.507,32.427c1.707,1.707,3.413,4.267,2.56,6.827c0,2.56-1.707,5.12-4.267,6.827C295.107,423.96,257.56,434.2,220.867,434.2z M94.573,367.64c58.88,54.613,145.92,64.853,215.893,26.453c-8.533-10.24-12.8-23.04-12.8-36.693c0-33.28,26.453-59.733,59.733-59.733c11.947,0,23.893,3.413,34.133,10.24c32.427-69.12,19.627-149.333-31.573-205.653L94.573,367.64z"/><path d="M365.933,357.4c0,5.12-3.413,8.533-8.533,8.533s-8.533-3.413-8.533-8.533s3.413-8.533,8.533-8.533S365.933,352.28,365.933,357.4"/></g></svg>`;

export function buildFooter(menuPages, year) {
  const footerNav = buildNavLinks(menuPages)
    .map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n      ');
  return `<footer class="footer">
  <div class="footer-left">
    <a href="/" class="footer-logo">JRBNZ</a>
    <div class="footer-fineprint">&copy; ${year} James Bell</div>
    <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
  </div>
  <div class="footer-right">
    <nav class="footer-nav" aria-label="Footer">
      ${footerNav}
    </nav>
    <div class="footer-bottom-links">
      <a href="/feed.xml" class="footer-rss">
        <svg class="footer-rss-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/></svg>
        RSS Feed
      </a>
      <span class="footer-signal" title="Made with Signal">
        ${SIGNAL_MARK}
      </span>
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
