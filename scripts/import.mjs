#!/usr/bin/env node
// Import Bear Blog posts into R2
// Usage: CLOUDFLARE_API_TOKEN=<token> node scripts/import.mjs
//
// Reads "to import/" directory, skips is_page:true, downloads images into R2,
// rewrites image URLs, builds HTML, uploads everything to jrbnz-blog R2 bucket.

import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, basename, extname } from 'path';
import { tmpdir } from 'os';

const ACCOUNT_ID = 'ef77e5b604895bd4cb27640853c06fbb';
const BUCKET = 'jrbnz-blog';
const IMPORT_DIR = join(process.cwd(), 'to import');
const WRANGLER = 'wrangler';

// ── Frontmatter ───────────────────────────────────────────────────────────────

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim();
    meta[key] = val;
  }
  return { meta, content: match[2].trim() };
}

function parseTags(tagsStr) {
  if (!tagsStr) return [];
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
}

function parseDate(dateStr) {
  // Bear uses ISO 8601 — take just the date part
  return dateStr ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

// ── Markdown → HTML ───────────────────────────────────────────────────────────

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(esc(lines[i]));
        i++;
      }
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${code.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,4})\s+(.*)/);
    if (hm) {
      const level = hm[1].length;
      out.push(`<h${level}>${inline(hm[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      out.push(`<blockquote><p>${quoteLines.map(inline).join(' ')}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // HTML block (pass through as-is)
    if (line.match(/^<[a-zA-Z]/)) {
      const htmlLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        htmlLines.push(lines[i]);
        i++;
      }
      out.push(htmlLines.join('\n'));
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect contiguous non-blank, non-special lines
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,4}\s|[-*]\s|\d+\.\s|```|>|<[a-zA-Z]|---+|\*\*\*+)/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${paraLines.map(inline).join(' ')}</p>`);
    }
  }

  return out.join('\n');
}

function inline(str) {
  return str
    // Images before links
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${esc(alt)}" loading="lazy">`)
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${href}">${esc(text)}</a>`)
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── HTML templates ────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function buildPostNav(prev, next) {
  const prevItem = prev
    ? `<a href="/posts/${esc(prev.slug)}/" class="post-nav-item post-nav-prev">
    <span class="post-nav-direction">← Older</span>
    <span class="post-nav-title">${esc(prev.title)}</span>
  </a>`
    : `<div class="post-nav-item post-nav-ghost"></div>`;
  const nextItem = next
    ? `<a href="/posts/${esc(next.slug)}/" class="post-nav-item post-nav-next">
    <span class="post-nav-direction">Newer →</span>
    <span class="post-nav-title">${esc(next.title)}</span>
  </a>`
    : `<div class="post-nav-item post-nav-ghost"></div>`;
  return `<nav class="post-nav">
  ${prevItem}
  <a href="/posts/" class="post-nav-item post-nav-all">All posts</a>
  ${nextItem}
</nav>`;
}

function buildPostHtml({ title, date, tags, contentHtml, prev, next }) {
  const tagLinks = tags.map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)} - James Bell</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/main.css">
<link rel="stylesheet" href="/styles/blog.css">
</head>
<body>
<header class="page-header"><h1>Blog</h1></header>
<section class="content-section">
  <h1 class="post-title">${esc(title)}</h1>
  <div class="post-meta">
    <time datetime="${esc(date)}">${fmtDate(date)}</time>
    ${tagLinks ? `<div class="post-tags">${tagLinks}</div>` : ''}
  </div>
  <div class="post-content">${contentHtml}</div>
  ${buildPostNav(prev, next)}
</section>
<footer class="footer">
  <div class="footer-fineprint">&copy; <span class="footer-year">${year}</span> James Bell</div>
  <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
</footer>
</body>
</html>`;
}

function buildIndexHtml(posts) {
  const published = posts.filter(p => p.status === 'published').sort((a, b) => new Date(b.date) - new Date(a.date));
  const items = published.map(p => `
  <li class="post-list-item" data-tags="${esc(p.tags.join(','))}">
    <time>${fmtDateShort(p.date)}</time>
    <a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a>
  </li>`).join('');
  const allTags = [...new Set(published.flatMap(p => p.tags))].sort();
  const tagLinks = allTags.map(t => `<a href="/posts/?tag=${esc(t)}" class="post-tag">#${esc(t)}</a>`).join(' ');
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Blog - James Bell</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/main.css">
<link rel="stylesheet" href="/styles/blog.css">
</head>
<body>
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/now/">Now</a></li>
    <li><a href="/photos/">Photos</a></li>
    <li><a href="/posts/">Blog</a></li>
  </ul>
</nav>
<script>
(function(){var p=location.pathname;document.querySelectorAll('.site-nav .nav-links a').forEach(function(a){var h=a.getAttribute('href');if(h&&h!=='/'&&p.startsWith(h))a.classList.add('active');});})();
</script>
<header class="page-header"><h1>Blog</h1></header>
<section class="content-section">
  ${published.length ? `<ul class="post-list">${items}</ul>` : '<p>No posts yet.</p>'}
  ${tagLinks ? `<div class="tags-footer">
    <div class="tag-filter-bar" id="tag-filter-bar" hidden>
      Posts tagged <strong id="tag-filter-label"></strong>
      <a href="/posts/" class="tag-filter-clear">× Show all</a>
    </div>
    ${tagLinks}
  </div>` : ''}
</section>
<script src="/scripts/blog.js"></script>
<footer class="footer">
  <div class="footer-fineprint">&copy; <span class="footer-year">${year}</span> James Bell</div>
  <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
</footer>
</body>
</html>`;
}

// ── R2 upload ─────────────────────────────────────────────────────────────────

async function r2Put(key, content, contentType) {
  const tmp = join(tmpdir(), `jrbnz-import-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  if (typeof content === 'string') {
    await writeFile(tmp, content, 'utf8');
  } else {
    await writeFile(tmp, Buffer.from(content));
  }
  try {
    execSync(
      `CLOUDFLARE_API_TOKEN="${process.env.CLOUDFLARE_API_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" ${WRANGLER} r2 object put "${BUCKET}/${key}" --file "${tmp}" --content-type "${contentType}" --remote`,
      { stdio: 'pipe' }
    );
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

// ── Image handling ────────────────────────────────────────────────────────────

function findImages(content) {
  const urls = new Set();
  // Markdown images
  for (const [, url] of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) urls.add(url);
  // HTML img src= (handles malformed tags without closing >)
  for (const [, url] of content.matchAll(/src="(https?:\/\/[^"]+)"/g)) urls.add(url);
  return [...urls].filter(u => /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(u) || u.includes('cdn') || u.includes('upload'));
}

async function downloadImage(url) {
  console.log(`    Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

function imageFilename(url) {
  const raw = basename(new URL(url).pathname);
  // Sanitise: keep alphanumeric, dash, underscore, dot
  return raw.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function rewriteImageUrls(content, urlMap) {
  let result = content;
  for (const [original, replacement] of urlMap) {
    result = result.split(original).join(replacement);
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error('Set CLOUDFLARE_API_TOKEN before running.');
    process.exit(1);
  }

  const files = (await readdir(IMPORT_DIR)).filter(f => f.endsWith('.md') && !f.startsWith('.'));

  // Pass 1: parse, download images, upload drafts — collect post data
  const collectedPosts = [];

  for (const file of files) {
    const raw = await readFile(join(IMPORT_DIR, file), 'utf8');
    const { meta, content } = parseFrontmatter(raw);

    if (meta.is_page === 'true') {
      console.log(`Skipping page: ${file}`);
      continue;
    }

    const slug = meta.slug || file.replace('.md', '');
    const title = meta.title || slug;
    const date = parseDate(meta.published_date);
    const tags = parseTags(meta.tags);
    console.log(`\nParsing: ${title} (${slug})`);

    // Download and reupload images
    const imageUrls = findImages(content);
    const urlMap = [];

    for (const url of imageUrls) {
      try {
        const { buffer, contentType } = await downloadImage(url);
        const filename = imageFilename(url);
        const r2Key = `posts/media/${slug}/${filename}`;
        await r2Put(r2Key, buffer, contentType);
        urlMap.push([url, `/posts/media/${slug}/${filename}`]);
        console.log(`    → /posts/media/${slug}/${filename}`);
      } catch (err) {
        console.warn(`    ⚠ Could not fetch ${url}: ${err.message}`);
      }
    }

    const rewrittenContent = rewriteImageUrls(content, urlMap);

    // Save draft.md (clean content, no frontmatter)
    await r2Put(`posts/${slug}/draft.md`, rewrittenContent, 'text/markdown');

    collectedPosts.push({ slug, title, date, tags, rewrittenContent });
  }

  // Sort by date descending (newest first)
  collectedPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Pass 2: build HTML with prev/next navigation
  const indexEntries = [];

  for (let i = 0; i < collectedPosts.length; i++) {
    const post = collectedPosts[i];
    const prev = collectedPosts[i + 1] || null; // older post
    const next = collectedPosts[i - 1] || null; // newer post
    const contentHtml = mdToHtml(post.rewrittenContent);
    const postHtml = buildPostHtml({ title: post.title, date: post.date, tags: post.tags, contentHtml, prev, next });
    await r2Put(`posts/${post.slug}/index.html`, postHtml, 'text/html');
    indexEntries.push({ slug: post.slug, title: post.title, date: post.date, tags: post.tags, status: 'published' });
    console.log(`  ✓ ${post.title}`);
  }

  // Save index.json
  await r2Put('posts/index.json', JSON.stringify(indexEntries, null, 2), 'application/json');

  // Build and save index.html
  const indexHtml = buildIndexHtml(indexEntries);
  await r2Put('posts/index.html', indexHtml, 'text/html');

  console.log(`\n✅ Imported ${indexEntries.length} posts.`);
}

main().catch(err => { console.error(err); process.exit(1); });
