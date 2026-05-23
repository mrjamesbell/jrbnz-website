#!/usr/bin/env node
// CF Pages build script: copies site/ static assets then overlays pre-rendered HTML from R2.
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

const SITE_URL = process.env.SITE_URL;
const CF_BUILD_SECRET = process.env.CF_BUILD_SECRET;

if (!SITE_URL || !CF_BUILD_SECRET) {
  console.error('Missing required env vars: SITE_URL, CF_BUILD_SECRET');
  process.exit(1);
}

// 1. Copy all static assets from site/ into dist/
execSync(`cp -r ${join(root, 'site')}/. ${dist}/`, { stdio: 'inherit' });
console.log('Copied site/ → dist/');

// 2. Fetch pre-rendered HTML from the live Worker
const url = `${SITE_URL}/api/internal/export?token=${CF_BUILD_SECRET}`;
console.log(`Fetching export from ${SITE_URL}/api/internal/export ...`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`Export endpoint returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const map = await res.json();
const entries = Object.entries(map);
console.log(`Received ${entries.length} pages from export`);

// 3. Write each page to dist/, overwriting any site/ copy at the same path
for (const [distPath, html] of entries) {
  const dest = join(dist, distPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html, 'utf8');
}
console.log('Build complete');
