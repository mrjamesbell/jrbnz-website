#!/usr/bin/env node
// Recover lost draft content for published posts whose draft.md is empty.
//
// Phase 1 — extract (default):
//   Reads posts/index.json from R2, finds published posts with empty draft.md,
//   fetches each post's published HTML from the live site, extracts the prose,
//   converts to Markdown, and saves to recovery/{slug}.md for review.
//
// Phase 2 — apply (--apply flag):
//   Uploads every recovery/{slug}.md back to R2 as draft.md and clears
//   hasDraftChanges in posts/index.json.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=<token> node scripts/recover-drafts.mjs
//   CLOUDFLARE_API_TOKEN=<token> node scripts/recover-drafts.mjs --apply

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RECOVERY_DIR = join(ROOT, 'recovery');

const ACCOUNT_ID = 'ef77e5b604895bd4cb27640853c06fbb';
const BUCKET     = 'jrbnz-blog';
const WRANGLER   = 'wrangler';
const SITE_URL   = 'https://jrbnz.com';

const APPLY = process.argv.includes('--apply');
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!API_TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN before running.');
  process.exit(1);
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

function r2Get(key) {
  const tmp = `/tmp/r2-get-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  try {
    execSync(
      `CLOUDFLARE_API_TOKEN="${API_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" ${WRANGLER} r2 object get "${BUCKET}/${key}" --file "${tmp}" --remote`,
      { stdio: 'pipe' }
    );
    return readFileSync(tmp, 'utf8');
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

function r2Put(key, content, contentType = 'text/plain') {
  const tmp = `/tmp/r2-put-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  try {
    execSync(
      `CLOUDFLARE_API_TOKEN="${API_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" ${WRANGLER} r2 object put "${BUCKET}/${key}" --file "${tmp}" --content-type "${contentType}" --remote`,
      { stdio: 'inherit' }
    );
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

// ── HTML extraction ───────────────────────────────────────────────────────────

function extractPostContent(html) {
  const marker = html.indexOf('class="post-content');
  if (marker === -1) return null;
  const divOpen = html.lastIndexOf('<div', marker);
  if (divOpen === -1) return null;
  const contentStart = html.indexOf('>', divOpen) + 1;
  let depth = 1, pos = contentStart;
  while (pos < html.length && depth > 0) {
    const nextOpen  = html.indexOf('<div',  pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
    else { depth--; if (depth === 0) return html.slice(contentStart, nextClose).trim(); pos = nextClose + 6; }
  }
  return null;
}

// ── HTML → Markdown ───────────────────────────────────────────────────────────

function decode(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function innerText(html) {
  return decode(html.replace(/<[^>]+>/g, ''));
}

function htmlToMarkdown(html) {
  // Strip HTML comments (incl. signal:image, signal:youtube)
  // but save image src/alt so we can emit markdown image syntax
  const images = [];
  html = html.replace(/<!--\s*signal:image\s+src="([^"]*)"(?:[^>]*alt="([^"]*)")?[^>]*-->/g, (_, src, alt = '') => {
    images.push({ src, alt });
    return `![${alt}](${src})`;
  });
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Fenced code blocks
  html = html.replace(/<pre[^>]*><code(?:[^>]*)>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const lang = _.match(/class="[^"]*language-(\w+)/)?.[1] || '';
    return `\n\`\`\`${lang}\n${decode(code.trim())}\n\`\`\`\n`;
  });

  // Headings
  for (let n = 6; n >= 1; n--) {
    html = html.replace(new RegExp(`<h${n}[^>]*>([\\s\\S]*?)<\\/h${n}>`, 'gi'),
      (_, inner) => `\n${'#'.repeat(n)} ${innerText(inner).trim()}\n`);
  }

  // Blockquotes — handle before paragraphs
  html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const lines = htmlToMarkdown(inner).trim().split('\n');
    return '\n' + lines.map(l => `> ${l}`).join('\n') + '\n';
  });

  // Lists
  html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    return '\n' + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_, li) => `- ${innerText(li).trim()}\n`) + '\n';
  });
  html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let n = 0;
    return '\n' + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_, li) => `${++n}. ${innerText(li).trim()}\n`) + '\n';
  });

  // Tables (basic — keep as HTML; too complex to convert reliably)
  // Leave <table> tags in place so they pass through the renderer

  // Inline formatting (order matters: code before strong/em to avoid double-wrapping)
  html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, (_, c) => `\`${decode(c)}\``);
  html = html.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  html = html.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  html = html.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  html = html.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  html = html.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');
  html = html.replace(/<a[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => `[${innerText(text)}](${href})`);
  html = html.replace(/<img[^>]*\ssrc="([^"]*)"[^>]*\salt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  html = html.replace(/<img[^>]*\salt="([^"]*)"[^>]*\ssrc="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  html = html.replace(/<img[^>]*\ssrc="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Block-level wrappers: convert paragraphs, strip divs/figures/sections
  html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => `\n${inner.trim()}\n`);
  html = html.replace(/<br\s*\/?>/gi, '  \n');
  html = html.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Snippet/pull-quote wrappers: keep text, strip container
  html = html.replace(/<div[^>]*class="[^"]*(?:pull-quote|quote-interlude|snippet-block)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    (_, inner) => `\n${htmlToMarkdown(inner).trim()}\n`);

  // Strip remaining tags (divs, spans, figures, figcaptions, etc.)
  html = html.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi,
    (_, inner) => `\n*${innerText(inner).trim()}*\n`);
  html = html.replace(/<\/?(?:div|span|figure|section|article|aside|header|footer|nav|main)[^>]*>/gi, '');
  html = html.replace(/<[^>]+>/g, '');  // strip any remaining tags

  // Entities and whitespace
  html = decode(html);
  html = html.replace(/\n{3,}/g, '\n\n').trim();

  return html;
}

// ── Phase 1: extract ──────────────────────────────────────────────────────────

async function extract() {
  console.log('Reading posts/index.json from R2…');
  const indexRaw = r2Get('posts/index.json');
  if (!indexRaw) { console.error('Could not read posts/index.json'); process.exit(1); }
  const posts = JSON.parse(indexRaw);

  const published = posts.filter(p => p.status === 'published');
  console.log(`Found ${published.length} published posts. Checking draft.md for each…\n`);

  const empty = [];
  for (const post of published) {
    const draft = r2Get(`posts/${post.slug}/draft.md`);
    const hasContent = draft && draft.trim().length > 0;
    process.stdout.write(hasContent ? '.' : 'E');
    if (!hasContent) empty.push(post);
  }
  console.log(`\n\n${empty.length} post(s) with empty draft.md:\n`);
  empty.forEach(p => console.log(`  • ${p.slug} — "${p.title}"`));

  if (empty.length === 0) {
    console.log('\nNothing to recover.');
    return;
  }

  mkdirSync(RECOVERY_DIR, { recursive: true });

  let recovered = 0, failed = 0;
  for (const post of empty) {
    process.stdout.write(`\nFetching ${post.slug}… `);
    let html;
    try {
      const res = await fetch(`${SITE_URL}/posts/${post.slug}/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      console.log(`FETCH FAILED: ${e.message}`);
      failed++;
      continue;
    }

    const content = extractPostContent(html);
    if (!content) {
      console.log('Could not extract .post-content');
      failed++;
      continue;
    }

    const markdown = htmlToMarkdown(content);
    const header = `<!-- recovered from published HTML on ${new Date().toISOString().slice(0, 10)} -->\n\n`;
    writeFileSync(join(RECOVERY_DIR, `${post.slug}.md`), header + markdown, 'utf8');
    console.log(`saved (${markdown.length} chars)`);
    recovered++;
  }

  console.log(`\n── Summary ──────────────────────────────────────────`);
  console.log(`Recovered: ${recovered}  Failed: ${failed}`);
  console.log(`Files saved to: recovery/`);
  console.log('\nReview the files, edit as needed, then run with --apply to upload.');
}

// ── Phase 2: apply ────────────────────────────────────────────────────────────

function apply() {
  if (!existsSync(RECOVERY_DIR)) {
    console.error('No recovery/ directory found. Run without --apply first.');
    process.exit(1);
  }

  const files = readdirSync(RECOVERY_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.error('No .md files in recovery/. Nothing to apply.');
    process.exit(1);
  }

  console.log(`Reading posts/index.json from R2…`);
  const indexRaw = r2Get('posts/index.json');
  if (!indexRaw) { console.error('Could not read posts/index.json'); process.exit(1); }
  const posts = JSON.parse(indexRaw);
  let modified = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const content = readFileSync(join(RECOVERY_DIR, file), 'utf8');

    // Strip the recovery comment header before uploading
    const body = content.replace(/^<!--[\s\S]*?-->\n\n/, '').trim();
    if (!body) {
      console.log(`${slug}: empty after stripping header — skipping`);
      continue;
    }

    process.stdout.write(`Uploading ${slug}… `);
    r2Put(`posts/${slug}/draft.md`, body, 'text/markdown');
    console.log('done');

    const idx = posts.findIndex(p => p.slug === slug);
    if (idx !== -1) {
      posts[idx].hasDraftChanges = false;
      posts[idx].wordCount = body.split(/\s+/).filter(Boolean).length;
      modified++;
    }
  }

  console.log(`\nUpdating posts/index.json (${modified} entries)…`);
  r2Put('posts/index.json', JSON.stringify(posts, null, 2), 'application/json');
  console.log('Done. Trigger a site rebuild in Signal to re-render the recovered posts.');
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (APPLY) {
  apply();
} else {
  await extract();
}
