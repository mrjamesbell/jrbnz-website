# jrbnz.com

Personal website for James Bell — theatre maker, writer, photographer, Auckland, New Zealand.

## Architecture

**Cloudflare Pages** serves a fully static `dist/` built at deploy time. A **Cloudflare Worker** handles only API requests, image proxying, and the Signal admin SPA. Content is authored in **Signal** (the custom CMS at `/signal/`) and stored as pre-rendered HTML in **R2**.

| Path | Served by |
|------|-----------|
| `/api/*` | Worker |
| `/img/*` | Worker (Cloudflare Images proxy) |
| `/signal/*` | Worker (SPA fallback) |
| Everything else | CF Pages static CDN |

### Content flow

1. Author writes/edits a post in Signal and clicks **Publish**
2. Worker pre-renders the HTML and stores it in R2 (`posts/{slug}/index.html`, `posts/index.html`, `pages/homepage/index.html`, `feed.xml`, `sitemap.xml`, etc.)
3. Author clicks **Deploy** in Signal settings
4. CF Pages build runs: copies `site/` → `dist/`, then fetches all rendered HTML from `GET /api/internal/export` and writes it into `dist/`
5. CF Pages deploys `dist/` to CDN — no Worker in the public read path

### Deployment

Deployments are triggered two ways:
- **Code changes** → git push to `main` → CF Pages builds automatically
- **Content changes** → Deploy button in Signal → fires the CF Pages deploy hook

There is no `wrangler deploy`. The Worker is compiled and deployed by CF Pages as part of each build.

---

## Repo structure

```
functions/              Cloudflare Workers (compiled by CF Pages)
  api/[[path]].js       All Signal API routes + content export endpoint
  feed.xml.js           RSS feed (serves pre-rendered R2 version)
  sitemap.xml.js        Sitemap (serves pre-rendered R2 version)
  img/[[path]].js       Cloudflare Images proxy
  signal/[[path]].js    Signal SPA fallback routing
  posts/[slug]/index.js Thin R2 proxy for post pages (fallback only)
  posts/index.js        Thin R2 proxy for posts listing
  notes/index.js        Notes page proxy
  index.js              Homepage proxy
  lib/                  Shared Worker utilities
    markdown.js         Markdown → HTML renderer
    templates.js        Shared HTML partials
    snippets.js         Snippet CSS builder
    cf-images.js        Cloudflare Images API client
    media-kv.js         Media metadata KV helpers
  themes/               Page HTML renderers
    cinematic.js        Cinematic theme (active)
    dark.js             Dark theme (fallback)

site/                   Static assets — copied to dist/ at build time
  _routes.json          CF Pages routing rules (Worker allowlist)
  styles/
    main.css            Semantic token definitions + reset
    blog.css            Shared component styles
    themes/
      cinematic.css     Cinematic theme token values + layout
      dark.css          Dark theme token values + layout
  scripts/
    blog.js             Client-side tag filtering for essays page
  signal/               Signal admin SPA
    index.html
    css/
    js/
  photos/               Photos gallery (standalone static page)

scripts/
  build.mjs             CF Pages build script (copies site/ + fetches export)
```

---

## Signal CMS

Signal is the admin interface at `/signal/`. It is a single-page app served by the Worker.

Key capabilities:
- Create, edit, and publish posts and pages (markdown with rich media)
- Media library (upload to Cloudflare Images, insert into posts)
- Homepage config (featured post, cards, interlude, archive)
- Site settings (author, accent colour, nav)
- **Rebuild site** — re-renders all published content to R2
- **Deploy** — triggers a CF Pages build to publish to CDN

Signal routes are protected by a session cookie. Login at `/signal/login.html`.

---

## Cloudflare setup

| Resource | Name | Purpose |
|----------|------|---------|
| R2 bucket | `jrbnz-blog` | Rendered HTML, markdown drafts, settings JSON |
| KV namespace | `MEDIA_KV` | Media library metadata |
| CF Images | — | Image storage and delivery (`/img/` proxy) |

### Worker secrets (set via `wrangler pages secret put`)

| Secret | Purpose |
|--------|---------|
| `BLOG_PASSWORD` | Signal login password |
| `MICROPUB_TOKEN` | iA Writer Micropub auth |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_IMAGES_TOKEN` | Cloudflare Images API token |
| `CF_ACCOUNT_HASH` | Images delivery URL hash |
| `CF_PAGES_HOOK_URL` | Deploy hook URL (triggered by Signal Deploy button) |

---

## Local development

There is no local dev server. Edit → push to `main` → CF Pages deploys. For Worker-only changes you can use `wrangler pages dev` but it is not required.

The build number in `site/signal/js/build.js` must be bumped on every commit that includes Signal JS/CSS changes (`YYYY-MM-DD.NNN`).

---

## Theme system

See [THEMING.md](THEMING.md) for the full CSS token system, cinematic theme specifics, image roles, quote hierarchy, and how to add a new theme.

## Product / design intent

See [PRODUCT.md](PRODUCT.md) for brand personality, audience, design principles, and anti-references.
