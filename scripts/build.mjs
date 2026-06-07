#!/usr/bin/env node
// CF Pages build script.
//
// Order matters: themes are inlined into functions/themes/_bundle.js FIRST, then
// every public page is rendered here under Node using that freshly-inlined bundle.
// Because rendering no longer depends on the previously-deployed Worker's theme
// bundle, a newly uploaded + activated theme goes fully live in a SINGLE deploy
// (the old flow overlaid stale R2 HTML rendered by whatever theme the live Worker
// happened to have, which lagged one deploy behind — the "deploy twice" bug).
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

// 2. Download installed themes from R2 and inline into functions/themes/_bundle.js.
// Inlining into a pre-existing file (rather than writing new files) ensures CF Pages
// picks up the changes when bundling the Worker — no new imports to discover. This
// MUST run before the render step below, which imports the bundle.
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

// 3. Render every public page under Node using the just-inlined theme bundle.
// render.js is imported dynamically AFTER _bundle.js is written, so it picks up the
// current themes. On first deployment the data endpoint may not be live yet — treat
// as non-fatal so the static site/ assets still publish.
console.log(`Fetching render data from ${SITE_URL}/api/internal/render-data ...`);
try {
  const res = await fetch(`${SITE_URL}/api/internal/render-data`);
  if (!res.ok) {
    console.warn(`Render data returned ${res.status} — skipping HTML render (Worker not yet updated)`);
  } else {
    const data = await res.json();
    const { renderAllPages } = await import('../functions/lib/render.js');

    const pages = renderAllPages(data);
    let written = 0;
    for (const [distPath, html] of Object.entries(pages)) {
      const dest = join(dist, distPath);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, html, 'utf8');
      written++;
    }

    // feed.xml / sitemap.xml are theme-independent and already current in R2 —
    // copy them straight through.
    if (data.feedXml) writeFileSync(join(dist, 'feed.xml'), data.feedXml, 'utf8');
    if (data.sitemapXml) writeFileSync(join(dist, 'sitemap.xml'), data.sitemapXml, 'utf8');

    console.log(`Rendered ${written} pages (theme: ${data.ctx?.theme ?? 'unknown'})`);
  }
} catch (e) {
  console.warn(`Render step failed: ${e.message} — skipping HTML render`);
}

console.log('Build complete');
