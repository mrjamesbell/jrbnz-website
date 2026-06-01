#!/usr/bin/env node
// CF Pages build script: copies site/ static assets then overlays pre-rendered HTML from R2.
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

const SITE_URL = 'https://jrbnz.com';

// 1. Copy all static assets from site/ into dist/
execSync(`cp -r ${join(root, 'site')}/. ${dist}/`, { stdio: 'inherit' });
console.log('Copied site/ → dist/');

// 2. Fetch pre-rendered HTML from the live Worker
// On first deployment the export endpoint may not be live yet — treat as non-fatal.
const url = `${SITE_URL}/api/internal/export`;
console.log(`Fetching export from ${SITE_URL}/api/internal/export ...`);
try {
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`Export returned ${res.status} — skipping HTML overlay (Worker not yet updated)`);
  } else {
    const map = await res.json();
    const entries = Object.entries(map);
    console.log(`Received ${entries.length} pages from export`);

    // 3. Write each page to dist/, overwriting any site/ copy at the same path
    for (const [distPath, html] of entries) {
      const dest = join(dist, distPath);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, html, 'utf8');
    }
    console.log('HTML overlay complete');
  }
} catch (e) {
  console.warn(`Export fetch failed: ${e.message} — skipping HTML overlay`);
}

// 3. Download installed themes from R2 and inline into functions/themes/_bundle.js.
// Inlining into a pre-existing file (rather than writing new files) ensures CF Pages
// picks up the changes when bundling the Worker — no new imports to discover.
console.log('Fetching installed themes...');

function inlineTheme(name, jsCode) {
  let code = jsCode;
  // Strip import statements (single- and multi-line) — helpers are imported at the top of _bundle.js
  code = code.replace(/^import[\s\S]*?from\s*['"][^'"]*['"];?\n?/gm, '');
  // Strip 'export' keyword — functions are collected into _t manually at the end
  code = code.replace(/^export\s+((?:async\s+)?function|const|let|var)\s/gm, '$1 ');
  return `\n// ── Theme: ${name} ──\n{\n${code.trim()}\n  _t['${name}'] = { buildPost, buildIndex, buildPage, buildHomepage, buildNotes, buildPhotos, imageRoles };\n}`;
}

const bundleHeader = `// Auto-generated during Cloudflare Pages build. Do not edit manually.\nimport { esc, buildHead, buildSiteNav, buildNavLinks, buildFooter, buildPostMeta, buildAuthorCard, SITE_URL } from '../lib/templates.js';\nconst _t = {};`;
const bundleFooter = `\nexport default _t;\n`;

try {
  const themesRes = await fetch(`${SITE_URL}/api/internal/theme-bundle`);
  if (!themesRes.ok) {
    console.warn(`Theme bundle returned ${themesRes.status} — skipping`);
  } else {
    const { themes = [] } = await themesRes.json();

    // Inline each theme's JS into _bundle.js
    const themeBlocks = themes.map(({ name, js }) => inlineTheme(name, js)).join('\n');
    writeFileSync(join(root, 'functions/themes/_bundle.js'), bundleHeader + themeBlocks + bundleFooter, 'utf8');

    // Write CSS files to dist/ as static assets
    mkdirSync(join(dist, 'styles/themes'), { recursive: true });
    for (const { name, css } of themes) {
      writeFileSync(join(dist, `styles/themes/${name}.css`), css, 'utf8');
      console.log(`  Theme inlined: ${name}`);
    }

    console.log(`Themes: ${themes.length} installed, _bundle.js updated`);
  }
} catch (e) {
  console.warn(`Theme bundle fetch failed: ${e.message} — skipping`);
}

console.log('Build complete');
