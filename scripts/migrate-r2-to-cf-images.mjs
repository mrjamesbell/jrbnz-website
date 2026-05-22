#!/usr/bin/env node
// Migrate R2 media objects to Cloudflare Images + update KV metadata + rewrite post content.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=<token> CF_IMAGES_TOKEN=<token> node scripts/migrate-r2-to-cf-images.mjs
//
// Options:
//   --dry-run   List what would be migrated without uploading anything
//   --resume    Skip images already in migration-map.json
//
// Outputs:
//   scripts/migration-map.json  — {r2Key: cfImageId} map; used for resumability + content rewriting

import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

const ACCOUNT_ID   = 'ef77e5b604895bd4cb27640853c06fbb';
const ACCOUNT_HASH = 'qK6m4Cv3p759GGOOm_9U_w';
const BUCKET       = 'jrbnz-blog';
const KV_NS_ID     = '92755940da39428eae3ab59c0d489174';
const CF_BASE      = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const SITE_BASE    = 'https://jrbnz.com';
const MAP_FILE     = join(import.meta.dirname, 'migration-map.json');

const isDryRun = process.argv.includes('--dry-run');
const isResume = process.argv.includes('--resume');

const R2_TOKEN     = process.env.CLOUDFLARE_API_TOKEN;
const CF_IMG_TOKEN = process.env.CF_IMAGES_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

if (!R2_TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN before running.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateImageId(slug) {
  return `${slug}-${Math.floor(Date.now() / 1000)}`;
}

function cfProxyUrl(imageId, variant) {
  return `/img/${imageId}/${variant}`;
}

// ── Cloudflare API calls ──────────────────────────────────────────────────────

async function r2List(prefix) {
  const items = [];
  let cursor = null;
  do {
    const url = new URL(`${CF_BASE}/r2/buckets/${BUCKET}/objects`);
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('per_page', '1000');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${R2_TOKEN}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(`R2 list failed: ${JSON.stringify(data.errors)}`);

    for (const obj of data.result ?? []) items.push(obj.key);
    cursor = data.result_info?.is_truncated ? data.result_info.cursor : null;
  } while (cursor);
  return items;
}

async function r2Download(key) {
  // Download via the public site — media worker serves R2 objects
  const urlPath = key.startsWith('media/')
    ? `/${key}`
    : key.startsWith('posts/media/')
    ? `/${key}`
    : null;

  if (!urlPath) throw new Error(`Unrecognised R2 key path: ${key}`);

  const res = await fetch(`${SITE_BASE}${urlPath}`);
  if (!res.ok) throw new Error(`Download failed for ${urlPath}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

async function cfImagesUpload(buffer, contentType, imageId) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), imageId);
  form.append('id', imageId);
  form.append('requireSignedURLs', 'false');

  const res = await fetch(`${CF_BASE}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_IMG_TOKEN}` },
    body: form,
  });
  const data = await res.json();
  if (!data.success) throw new Error(`CF Images upload failed: ${data.errors?.[0]?.message}`);
  return data.result;
}

async function kvPutWithMeta(imageId, meta) {
  const key = `media:${imageId}`;
  const { displayName, alt, caption, uploadedAt, size, w, h, focalX, focalY } = meta;

  // Cloudflare KV REST API: write value + metadata together via multipart
  const form = new FormData();
  form.append('value', JSON.stringify(meta));
  form.append('metadata', JSON.stringify({ displayName, alt, caption, uploadedAt, size, w, h, focalX, focalY }));

  const res = await fetch(
    `${CF_BASE}/storage/kv/namespaces/${KV_NS_ID}/values/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${R2_TOKEN}` },
      body: form,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`KV put failed for ${key}: ${err}`);
  }
}

// ── Content rewriting ─────────────────────────────────────────────────────────

async function listAllPostKeys() {
  const items = await r2List('posts/');
  return items.filter(k => k.endsWith('index.json') || k === 'posts/index.json');
}

async function r2GetJson(key) {
  const res = await fetch(`${CF_BASE}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${R2_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function r2GetText(key) {
  const res = await fetch(`${CF_BASE}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${R2_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.text();
}

async function r2PutText(key, text, contentType) {
  const tmp = join(tmpdir(), `jrbnz-migrate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await writeFile(tmp, text, 'utf8');
  try {
    execSync(
      `CLOUDFLARE_API_TOKEN="${R2_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" npx wrangler r2 object put "${BUCKET}/${key}" --file "${tmp}" --content-type "${contentType}" --remote`,
      { stdio: 'pipe' }
    );
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

function buildUrlRewriter(migrationMap) {
  // Build lookup: old URL pattern → new /img/{id}/hero path
  // R2 patterns: /media/{filename} and /posts/media/{slug}/{filename}
  const rewrites = new Map();
  for (const [r2Key, cfId] of Object.entries(migrationMap)) {
    const oldUrl = `/${r2Key}`;          // e.g. /media/foo.jpg
    const newUrl = `/img/${cfId}/hero`;
    rewrites.set(oldUrl, newUrl);
  }
  return rewrites;
}

function applyRewrites(text, rewrites) {
  let result = text;
  for (const [oldUrl, newUrl] of rewrites) {
    result = result.split(oldUrl).join(newUrl);
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load existing migration map for resumability
  let migrationMap = {};
  if (existsSync(MAP_FILE)) {
    migrationMap = JSON.parse(await readFile(MAP_FILE, 'utf8'));
    console.log(`Loaded existing migration map: ${Object.keys(migrationMap).length} entries`);
  }

  // List R2 media objects
  console.log('Listing R2 media objects...');
  const [mediaKeys, postMediaKeys] = await Promise.all([
    r2List('media/'),
    r2List('posts/media/'),
  ]);

  const allKeys = [...mediaKeys, ...postMediaKeys].filter(k =>
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(k)
  );
  console.log(`Found ${allKeys.length} media objects (${mediaKeys.length} in media/, ${postMediaKeys.length} in posts/media/)`);

  if (isDryRun) {
    console.log('\n-- DRY RUN: would migrate these keys --');
    for (const key of allKeys) {
      const already = isResume && migrationMap[key];
      console.log(`  ${already ? '[skip] ' : '       '} ${key}`);
    }
    return;
  }

  // Phase 1: Upload each R2 image to CF Images
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of allKeys) {
    if (isResume && migrationMap[key]) {
      console.log(`  [skip] ${key} → ${migrationMap[key]}`);
      skipped++;
      continue;
    }

    const filename = basename(key);
    const imageId = generateImageId(slugify(filename));

    try {
      process.stdout.write(`  Uploading ${key}... `);
      const { buffer, contentType } = await r2Download(key);

      await cfImagesUpload(buffer, contentType, imageId);

      const meta = {
        id: imageId,
        displayName: slugify(filename).replace(/-/g, ' '),
        alt: '',
        caption: '',
        focalX: 0.5,
        focalY: 0.5,
        w: null,
        h: null,
        size: buffer.byteLength,
        uploadedAt: new Date().toISOString(),
        urls: {
          thumb:  cfProxyUrl(imageId, 'thumb'),
          md:     cfProxyUrl(imageId, 'md'),
          hero:   cfProxyUrl(imageId, 'hero'),
          public: cfProxyUrl(imageId, 'public'),
        },
      };

      await kvPutWithMeta(imageId, meta);

      migrationMap[key] = imageId;
      await writeFile(MAP_FILE, JSON.stringify(migrationMap, null, 2));

      console.log(`→ ${imageId}`);
      uploaded++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nUpload complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    console.log('Re-run with --resume to retry failed items after fixing issues.');
    if (uploaded === 0) return;
  }

  // Phase 2: Rewrite post content
  console.log('\nRewriting post content...');
  const rewrites = buildUrlRewriter(migrationMap);

  if (rewrites.size === 0) {
    console.log('No URL rewrites needed.');
    return;
  }

  // Rewrite posts/index.json
  const indexText = await r2GetText('posts/index.json');
  if (indexText) {
    const rewritten = applyRewrites(indexText, rewrites);
    if (rewritten !== indexText) {
      await r2PutText('posts/index.json', rewritten, 'application/json');
      console.log('  ✓ posts/index.json');
    }
  }

  // Rewrite each post's index.json and draft.md
  const postKeys = await r2List('posts/');
  const postJsonKeys = postKeys.filter(k => k.match(/^posts\/[^/]+\/index\.json$/));
  const postMdKeys   = postKeys.filter(k => k.match(/^posts\/[^/]+\/draft\.md$/));

  for (const key of [...postJsonKeys, ...postMdKeys]) {
    const text = await r2GetText(key);
    if (!text) continue;
    const rewritten = applyRewrites(text, rewrites);
    if (rewritten !== text) {
      const ct = key.endsWith('.json') ? 'application/json' : 'text/markdown';
      await r2PutText(key, rewritten, ct);
      console.log(`  ✓ ${key}`);
    }
  }

  // Rewrite pages
  const pageKeys = await r2List('pages/');
  const pageJsonKeys = pageKeys.filter(k => k.match(/^pages\/[^/]+\/index\.json$/));
  const pageMdKeys   = pageKeys.filter(k => k.match(/^pages\/[^/]+\/draft\.md$/));

  for (const key of [...pageJsonKeys, ...pageMdKeys]) {
    const text = await r2GetText(key);
    if (!text) continue;
    const rewritten = applyRewrites(text, rewrites);
    if (rewritten !== text) {
      const ct = key.endsWith('.json') ? 'application/json' : 'text/markdown';
      await r2PutText(key, rewritten, ct);
      console.log(`  ✓ ${key}`);
    }
  }

  // Rewrite settings (headshot, cover, default-cover, interlude image)
  const settingsKeys = ['settings/site.json', 'settings/homepage.json'];
  for (const key of settingsKeys) {
    const text = await r2GetText(key);
    if (!text) continue;
    const rewritten = applyRewrites(text, rewrites);
    if (rewritten !== text) {
      await r2PutText(key, rewritten, 'application/json');
      console.log(`  ✓ ${key}`);
    }
  }

  console.log('\n✅ Migration complete. Republish posts in Signal to regenerate HTML with new image URLs.');
}

main().catch(err => { console.error(err); process.exit(1); });
