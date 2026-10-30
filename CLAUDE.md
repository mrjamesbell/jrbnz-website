# jrbnz-website

## Purpose
- jrbnz.com: James Bell's personal site plus Signal v1 (custom CMS at `/signal/`). Cloudflare Pages + Pages Functions + R2.
- Signal v2 lives in `~/projects/signal-cms`; this repo stays live and is its transplant source. Do not mix them up.

## Run
- No local dev server and no local API (`/api/*` needs R2/KV/Images). Do not build one.
- `npm run build` (`node scripts/build.mjs`) copies `site/` to `dist/` and fetches `/api/internal/export`. It is the Pages build step, not a local preview.
- Smoke test a deployed page: `chromium-browser --headless=new --disable-gpu --no-sandbox --enable-logging=stderr --dump-dom <url>`.

## Test
- None yet. Verify after push on the live site; roll back with `git revert`.

## Deploy
- `git push` to `main` triggers Cloudflare Pages. Never suggest or run wrangler for this project (James corrected this repeatedly).
- Site content changes go live via the Deploy button in Signal (fires the Pages deploy hook), not via git.
- Bump `BUILD` in `site/signal/js/build.js` (`YYYY-MM-DD.N`, currently `2026-06-10.1`) in the same commit as every Signal change. Do not use a separate bump commit.
- `pages_build_output_dir = "dist"` in `wrangler.toml` must match the Pages dashboard setting.
- Account is JRBNZ personal (`ef77e5b6...`). The ambient `CLOUDFLARE_API_TOKEN` is the Pumphouse account, so never use it here.

## Secrets
- Worker secrets (Pages project, set in dashboard): `BLOG_PASSWORD`, `MICROPUB_TOKEN`, `CF_ACCOUNT_ID`, `CF_IMAGES_TOKEN`, `CF_ACCOUNT_HASH`, `CF_PAGES_HOOK_URL`. Code also reads `CF_PAGES_API_TOKEN` and `ANTHROPIC_API_KEY` (excerpt generation).
- Local scripts use gitignored `cf.env` / `.cftoken` (JRBNZ account). Prefer 1Password via `~/.local/bin/with-secrets -- CMD`.
- Never paste tokens into commands or allow rules. No `.dev.vars` exists here.

## Gotchas
- `site/_routes.json` includes `/signal/*`, `/api/*`, `/img/*` for the Worker. `site/_redirects` needs a `/signal/* /signal/index.html 200` catch-all for sub-routes.
- Worker CPU limit: one expensive op per request. Publish saves one post plus index JSON. `POST /api/site/rebuild-indexes` is separate. Full `/api/site/rebuild` is for explicit user action only.
- CSS: add `[hidden]{display:none}` beside any rule that sets `display`. `editor-components.css` beats `admin-layout.css`; `blog.css` leaks into cinematic styles.
- Themes live in `functions/themes/<name>.js`; the active one is in `settings/site.json` (R2). Theme changes need Rebuild then Deploy. No inheritance or silent fallbacks.
- UI rules (James is sight-impaired): 14px and 4.5:1 contrast are floors, aim for AAA. No dimmed text for hierarchy. No horizontal scroll. Signal uses Georgia plus system mono, no Google Fonts. Public site: Bebas Neue, Lora, OKLCH, terracotta accent.
- Excerpt tone: dry, understated, first person, max about 15 words, no full stop, never "apparently".
- `.claude/`, `old/`, `test/`, `dist/`, `cf.env`, `.cftoken` are gitignored. `recovery/`, `.agents/`, `skills-lock.json` are untracked.

## Files worth knowing
- `functions/api/[[path]].js`: all Signal API routes, theme registry, export endpoint.
- `functions/lib/` (markdown, templates, cf-images, media-kv), `functions/themes/`.
- `site/signal/` (admin SPA), `site/styles/`, `site/_routes.json`, `site/_redirects`.
- `scripts/import.mjs` (needs `CLOUDFLARE_API_TOKEN` from `cf.env`, not ambient), `scripts/snapshot.sh`.
- `README.md`, `THEMING.md`, `DESIGN.md`, `PRODUCT.md` (use `register: product` for Signal admin work).
