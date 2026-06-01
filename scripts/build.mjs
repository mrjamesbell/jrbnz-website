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

// 3. Download installed themes from R2 and write as proper module files
// Theme JS goes into functions/themes/ (picked up by CF Pages Worker bundle).
// Theme CSS goes into dist/styles/themes/ (served as static asset).
console.log('Fetching installed themes...');
try {
  const themesRes = await fetch(`${SITE_URL}/api/internal/theme-bundle`);
  if (!themesRes.ok) {
    console.warn(`Theme bundle returned ${themesRes.status} — skipping`);
  } else {
    const { themes = [] } = await themesRes.json();
    const registryEntries = [];

    for (const { name, js, css } of themes) {
      const identifier = name.replace(/-/g, '_');
      writeFileSync(join(root, `functions/themes/${name}.js`), js, 'utf8');
      mkdirSync(join(dist, 'styles/themes'), { recursive: true });
      writeFileSync(join(dist, `styles/themes/${name}.css`), css, 'utf8');
      registryEntries.push({ name, identifier });
      console.log(`  Theme installed: ${name}`);
    }

    // Regenerate _registry.js with static imports for all installed themes
    const imports = registryEntries.map(({ name, identifier }) =>
      `import * as ${identifier} from './${name}.js';`
    ).join('\n');
    const exports = registryEntries.length
      ? registryEntries.map(({ name, identifier }) => `  '${name}': ${identifier},`).join('\n')
      : '';
    const registry = `// Auto-generated during Cloudflare Pages build. Do not edit manually.\n${imports}\nexport default {\n${exports}\n};\n`;
    writeFileSync(join(root, 'functions/themes/_registry.js'), registry, 'utf8');
    console.log(`Themes: ${themes.length} installed, _registry.js updated`);
  }
} catch (e) {
  console.warn(`Theme bundle fetch failed: ${e.message} — skipping`);
}

console.log('Build complete');
