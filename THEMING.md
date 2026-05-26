# Theming

The site uses a two-layer CSS system. `site.css` handles structural layout only — no colours, no typography, no borders. Theme files own all visual decisions. Switching the active theme changes the entire look without touching any layout CSS.

---

## How it works

### Layer 1 — Structural foundation (`site.css`)

`site/styles/site.css` contains:

- **`:root` token defaults** — fallback values for every semantic token. Themes override these via `[data-theme="x"]`. No component uses raw values; everything references a token.
- **Reset** — `box-sizing`, `margin`, `padding`, `overflow-x`.
- **Structural layout** — `display`, `grid`, `flex`, `max-width`, `padding`, `margin`, `gap` for shared components (nav, post layout, sidebar, footer, etc.). No colours, borders, font sizes, or font families.

| Token | Purpose |
|---|---|
| `--color-bg` | Page / canvas background |
| `--color-surface` | Cards, elevated panels |
| `--color-text` | Primary body text |
| `--color-text-muted` | Secondary text, dates, captions |
| `--color-text-subtle` | Faint labels, timestamps |
| `--color-border` | Standard dividers and outlines |
| `--color-border-strong` | More prominent borders |
| `--color-accent` | Brand highlight (also runtime-overridable per site) |
| `--color-accent-muted` | Translucent accent for hover states |
| `--color-accent-fg` | Text rendered on accent-coloured backgrounds |
| `--font-body` | Article / prose text |
| `--font-display` | Headings, titles, logo |
| `--font-mono` | Labels, kickers, UI chrome, code |
| `--gutter` | Horizontal page padding |
| `--col-read` | Reading column max-width |
| `--nav-h` | Nav bar height (used by fixed-nav offset) |

### Layer 2 — Theme files

Each theme lives in `site/styles/themes/<name>.css`. A theme file contains:

1. A `[data-theme="<name>"]` block that overrides every token above.
2. All visual rules — colours, typography, borders, backgrounds — for every component, scoped to `[data-theme="<name>"]`.
3. Any layout adjustments specific to that theme's HTML structure (e.g. a sticky nav, hero section, post grid).

Because `site.css` makes no visual decisions, themes start from a clean slate. The `:root` defaults give a plain black-on-white Arial fallback — any missing theme rule will look obviously wrong rather than accidentally inheriting a previous design.

The active theme name is stored in `settings/site.json` in R2 (key `theme`). `loadSiteContext()` reads it on every render. The Worker writes `data-theme="<name>"` onto the `<html>` element and loads `/styles/themes/<name>.css`. The active theme can be changed from **Settings → Appearance → Theme** in Signal — no code change needed.

### The `.surface-invert` pattern

Many designs have sections that invert the palette — a light reading surface inside a dark page, or vice versa. Rather than hardcoding colours for that surface, wrap it in a `<div class="surface-invert">`. The theme's `.surface-invert` block re-declares the same token names with inverted values, so every component inside automatically renders correctly.

```html
<!-- Dark page background, then a light reading column -->
<div class="surface-invert">
  <div class="article-col">…article content…</div>
</div>
```

### Runtime accent override

`--color-accent` (and its legacy alias `--accent-color`) can be overridden at runtime via an inline `<style>` injected by the Worker when a site has a custom accent colour configured. This sits on top of whatever the theme file sets and takes precedence via cascade order.

---

## Adding a new theme

A theme is two files: a CSS file that styles your design, and a JS renderer that generates the HTML. The HTML class names are yours to define — you are not required to reuse class names from any existing theme. The only constraints are the [shared class contract](#shared-class-contract) below.

1. **Create a CSS file** at `site/styles/themes/mytheme.css`. Scope every rule to `[data-theme="mytheme"]`.

   At minimum, override all semantic tokens:
   ```css
   [data-theme="mytheme"] {
     --color-bg: …;
     --color-surface: …;
     --color-text: …;
     --color-text-muted: …;
     --color-text-subtle: …;
     --color-border: …;
     --color-border-strong: …;
     --color-accent: …;
     --color-accent-muted: …;
     --color-accent-fg: …;
     --font-body: …;
     --font-display: …;
     --font-mono: …;
     --gutter: …;
     --col-read: …;
     --nav-h: …;
   }
   ```

   Then style `body` and all global elements:
   ```css
   [data-theme="mytheme"] body {
     background: var(--color-bg);
     color: var(--color-text);
     font-family: var(--font-body);
     font-size: …;
     line-height: …;
   }

   [data-theme="mytheme"] a { … }
   ```

   Then add a `.surface-invert` block if your design has sections that flip the palette:
   ```css
   [data-theme="mytheme"] .surface-invert {
     --color-bg: …;     /* inverted values */
     --color-text: …;
     background: var(--color-bg);
     color: var(--color-text);
   }
   ```

   Then style every class in the [shared class contract](#shared-class-contract). Use the checklist there to make sure nothing is missed.

2. **Create a renderer file** at `functions/themes/mytheme.js`. Export any of `buildPost`, `buildIndex`, `buildPage`, `buildHomepage`, `buildPhotos`, `buildNotes`. Any not exported fall back to `base.js` — which renders unstyled Arial 14px, making missing pages immediately obvious.

   Your renderer writes the HTML. **Use whatever class names suit your design.** You do not need to reuse class names from any existing theme. The only classes the system requires are listed in [Shared class contract](#shared-class-contract) below.

   ```js
   import { esc, buildHead, buildSiteNav, buildPostMeta, SITE_URL } from '../lib/templates.js';

   export function buildPost(data) {
     const { title, theme, accent, snippetCss, extraHead, menuPages, contentHtml } = data;
     return `${buildHead({ title, theme, accent, snippetCss, extraHead })}
       ${buildSiteNav(menuPages, '/posts/')}
       <main class="my-article-shell">
         <h1 class="my-title">${esc(title)}</h1>
         <div class="my-body post-content e-content">${contentHtml}</div>
       </main>
     </body></html>`;
   }
   // export other builders …
   ```

   If you want to borrow one page type from an existing theme rather than write it yourself, re-export it explicitly:
   ```js
   export { buildPhotos } from './cinematic.js';
   ```

   See [Renderer JS reference](#renderer-js-reference) for full function signatures and data models.

3. **Register the theme** — two lines in `functions/api/[[path]].js`:
   ```js
   import * as myTheme from '../themes/mytheme.js';           // at the top with other imports
   const THEMES = { …, mytheme: myTheme };                    // add entry
   ```

4. **Activate in Signal** — go to **Settings → Appearance → Theme**, select the new theme, click Save.
   Then **Rebuild site** and **Deploy** to apply it to the live site.

That's it. No other files need to change.

---

## Shared class contract

These class names are required by the system — `blog.js` tag filtering, Signal's image editor, and the template helpers produce or depend on them. Your CSS must style them; your renderer must not rename them.

Use this as a checklist when finishing a new theme CSS file.

### From `buildSiteNav()` — always produced by the template helper

```html
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/posts/" class="active">Essays</a></li>
  </ul>
</nav>
```

Style all of: `site-nav`, `nav-logo`, `nav-links`, `nav-links a`, `nav-links a.active`.

`site.css` gives these elements structural layout (flex, gap, list-style) but no visual properties — your theme must supply all colours, typography, and borders.

### Footer — each theme writes its own

There is no shared footer helper. Each theme renderer inlines its own footer HTML with its own class names. Use whatever structure suits your design.

`site.css` contains structural layout rules for a set of footer classes used by the `buildFooter` helper in `functions/lib/templates.js` (`.footer`, `.footer-left`, `.footer-right`, `.footer-nav`, etc.). That helper is not called by any active theme, but the structural rules remain. **These rules are layout-only** (flex/grid, padding, gaps) — reusing the class names will not impose any unwanted colours or typography.

Two current footer patterns for reference:

```html
<!-- Lightroom — minimal, own class names -->
<footer class="lr-footer">
  <span class="lr-footer-copy">©2026 JRBNZ</span>
  <nav class="lr-footer-nav">
    <a href="/posts/">Essays</a>
    …
  </nav>
</footer>

<!-- Cinematic — own class names -->
<footer class="site-footer">
  <p class="footer-tagline">…tagline…</p>
  <nav class="footer-nav" aria-label="Footer">
    <a href="/posts/">Essays</a>
    …
    <a href="/feed.xml">RSS</a>
  </nav>
</footer>
```

### From the markdown renderer — inside `.post-content`

These elements appear inside the rendered article body. Your theme controls how they look via `.post-content` descendant selectors, but you cannot change the element structure.

Style all of the following inside `.post-content`:

```html
<div class="post-content e-content">
  <h2>, <h3>, <h4>
  <p>
  <ul>, <ol>, <li>
  <blockquote>
  <code>
  <pre><code>
  <figcaption>
  <div class="pull-quote"><blockquote>…</blockquote></div>
  <div class="quote-interlude"><blockquote>…</blockquote></div>
  <div class="snippet">…</div>
</div>
```

`pull-quote` and `quote-interlude` have increasing visual weight — they should be styled distinctly from plain blockquotes and from each other.

### From Signal's image editor — figure layout and treatment

Signal writes these class names into the markdown. Your CSS must define all of them.

**All four layout classes:**

```html
<figure class="img-wide …">   <!-- breaks slightly outside reading column -->
<figure class="img-break …">  <!-- full-width -->
<figure class="img-small …">  <!-- within reading column, max-width constrained -->
<div class="img-pair">        <!-- wraps two figures side by side on desktop, stacked on mobile -->
```

**All four treatment classes** (applied to the same figure as the layout class):

```html
… class="… photo-muted">    <!-- reduced saturation and contrast -->
… class="… photo-mono">     <!-- strong monochrome -->
… class="… photo-colour">   <!-- mostly untreated -->
… class="… photo-soft">     <!-- lower contrast, slightly lifted -->
```

All 4 × 4 combinations are valid. Define each layout and each treatment independently so they compose freely.

**Do not set `aspect-ratio` or fixed heights on `<figure>` or `<img>` elements.** Images in posts have varying proportions — a portrait, a landscape, and a square can all appear in the same article. Forcing an aspect ratio will crop or distort any image that doesn't match it. Use `width: 100%; height: auto` to preserve natural proportions:

```css
/* ✗ Distorts images that don't match the ratio */
[data-theme="x"] .post-content figure { aspect-ratio: 16 / 9; overflow: hidden; }

/* ✓ Each image renders at its natural proportions */
[data-theme="x"] .post-content figure { width: 100%; }
[data-theme="x"] .post-content figure img { width: 100%; height: auto; display: block; }
```

The exception is cover images, where you control the source and can guarantee the ratio. Even then, use `object-fit: cover` with `object-position` (focal point is passed via inline style) rather than cropping with `overflow: hidden` on the container.

Your theme JS must also export an `imageRoles` object so Signal knows which options to show. See [`imageRoles` export](#imageroles-export) in the renderer reference.

### From `blog.js` — tag filtering on the essays index

The client-side tag filter script (`/scripts/blog.js`) reads `?tag=` from the URL on page load, shows and populates the filter bar, hides non-matching posts, and intercepts tag chip clicks to filter in place without a full reload.

**Your `buildIndex` renderer must do two things:**

1. Include the script tag immediately before `</body>`:
   ```html
   <script src="/scripts/blog.js"></script>
   </body></html>
   ```

2. Produce the expected HTML structure (IDs and classes the script targets):
   ```html
   <div class="tag-filter-bar" id="tag-filter-bar" hidden>
     Essays tagged <strong id="tag-filter-label"></strong>
     <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
   </div>
   <div class="tags-section">
     <a href="/posts/?tag=theatre" class="tag-chip">#theatre</a>
   </div>
   <!-- Each essay card must carry data-tags: -->
   <a class="post-list-item" data-tags="theatre,writing" href="…">…</a>
   <!-- Featured hero (if present) must also carry data-tags and id="featured-hero": -->
   <section id="featured-hero" data-tags="theatre,writing">…</section>
   ```

If either the script tag or the HTML structure is missing, the filter bar stays permanently hidden or permanently visible and tag clicks do nothing. This failure is silent — there are no console errors to catch it.

If your `buildIndex` includes a featured/hero section at the top of the listing, it **must** have `id="featured-hero"` and a `data-tags` attribute containing the featured post's tags (comma-separated). `blog.js` uses this ID to show or hide the featured section when a tag filter is active. Any other ID will cause the featured hero to remain visible when it doesn't match the selected tag.

Style: `tag-filter-bar`, `tag-filter-clear`, `tags-section`, `tag-chip`, `post-list-item`.

`site.css` gives `tag-filter-bar` and `post-list-item` structural layout — your theme supplies all visual properties.

### Microformats2 — search/reader compatibility

Wrap each post page in `<article class="h-entry">` and the homepage in `<main class="h-card">`. Mark the post title with `p-name` and body with `e-content`. These do not need CSS — they are semantic hooks for feed readers and search.

---

## Writing reliable theme CSS

### 1. Understand the CSS load order

```
site.css          ← :root token defaults, reset, structural layout only
themes/<name>.css ← all visual decisions (loaded last)
<style> block     ← runtime accent override (injected inline by Worker)
```

Your theme loads after `site.css`. Since `site.css` makes no visual decisions, there is nothing to fight — your theme defines colours, typography, and borders from scratch.

### 2. Style `body` and `a` explicitly — don't rely on `:root` defaults

`site.css` sets `body { font-family: var(--font-body); background: var(--color-bg); color: var(--color-text); }` using the token values, but makes no other typography decisions. Your theme should set `font-size`, `line-height`, and link styles directly:

```css
[data-theme="x"] body {
  font-size: 18px;
  line-height: 1.75;
}

[data-theme="x"] a {
  color: var(--color-accent);
  text-decoration: none;
  /* add border-bottom or underline if your design uses it */
}
```

### 3. `:root` defaults are a plain fallback, not a dark theme

If a token is not overridden by your theme, it resolves to the `:root` default — white background, black text, Arial. A missing token will make a component look obviously wrong rather than accidentally inheriting another theme's values. This is intentional — gaps are visible.

### 4. Scope every selector — no naked rules

Every rule in your theme CSS must be scoped to `[data-theme="<name>"]`. Naked rules will leak into Signal admin and every other theme. There are no exceptions.

```css
/* ✗ Leaks everywhere */
.article-col { max-width: 680px; }

/* ✓ Scoped to your theme only */
[data-theme="x"] .article-col { max-width: 680px; }
```

### 5. Minimum font size is 14px — use `px` for small labels, not `rem`

**The site owner is sight-impaired. These are not design targets — they are absolute floors. Aim higher.**

No rendered text — body, captions, labels, metadata, fine print — should be set below `14px`. This applies to every element in every state, including `:hover` and inside compressed layouts on mobile. If something feels too large at 14px, reconsider the surrounding spacing or weight rather than dropping the size.

**If your body font size is larger than 16px, `rem` values for small text will fall below the floor.** `rem` is relative to the root font size, which your theme sets on `body`. At `font-size: 18px`, `0.72rem` is only 13px — below the minimum, and not obvious from the value alone. Set all small labels explicitly in `px`:

```css
/* ✗ Dangerous — depends on body size; 0.72rem at 18px body = 12.96px */
.post-date { font-size: 0.72rem; }

/* ✓ Safe — always 13px regardless of body size */
.post-date { font-size: 13px; }
```

The safe pattern: use `rem` for body text and headings (which scale together), use `px` for labels, captions, metadata, and fine print (which have a hard floor).

### 6. Post links must use `/posts/{slug}/` — never `/{slug}/`

Posts are served from `dist/posts/{slug}/index.html`. Any link that omits the `/posts/` prefix will 404 or redirect to the homepage.

| Content type | Correct URL pattern | Wrong |
|---|---|---|
| Post | `/posts/${slug}/` | `/${slug}/` |
| CMS page (About, Now, etc.) | `/${slug}/` | `/posts/${slug}/` |
| Note | `/notes/${slug}/` | `/${slug}/` |

This applies everywhere a renderer links to a post: prev/next nav in `buildPost`, featured and recent items in `buildHomepage`, archive grids, and anywhere else post slugs appear as hrefs.

```js
// ✗ Wrong — posts at /{slug}/ don't exist as static files
`<a href="/${esc(prevPost.slug)}/">`
`<a href="/${esc(p.slug)}/">`

// ✓ Correct
`<a href="/posts/${esc(prevPost.slug)}/">`
`<a href="/posts/${esc(p.slug)}/">`
```

CMS page slugs (`buildPage`, `buildSiteNav` active href) correctly use `/${slug}/` — that's right because pages live at `dist/{slug}/index.html`.

### 7. All three text tokens must independently pass WCAG AA — including `--color-text-subtle`

**The site owner is sight-impaired. WCAG AA (4.5:1) is the floor, not the goal. Where the design allows, target AAA (7:1) for body text and AA for secondary text. When in doubt, go higher.**

All three text tokens — `--color-text`, `--color-text-muted`, and `--color-text-subtle` — must pass WCAG AA contrast (4.5:1 for normal text, 3:1 for large text ≥ 18px or bold ≥ 14px) against the background they sit on. This applies inside `.surface-invert` sections too, where the background changes.

`--color-text-subtle` is the most likely to fail. It's tempting to set it faint — low opacity, a desaturated hue, a near-background grey — as a visual move. Don't. If something needs to feel less prominent, achieve that through size or weight, not reduced contrast:

```css
/* ✗ Fails WCAG AA — fine as a design intention, fails as text */
--color-text-subtle: rgba(255, 255, 255, 0.3);

/* ✓ Still passes — 11px caps at 0.09em letter-spacing reads lighter without dropping contrast */
--color-text-subtle: rgba(255, 255, 255, 0.72);
.post-kicker { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
```

Verify all three tokens with a contrast checker. The check must pass on every background they appear against — `--color-bg`, `--color-surface`, and inside `.surface-invert`.

---

## Local theme development

A local snapshot of the live site is available for theme development without redeploying.

```bash
./scripts/snapshot.sh [theme]   # seed ~/www/jrbnz with live HTML + project CSS
./scripts/push-theme.sh [theme] # copy edited CSS back to the project
```

The snapshot fetches the homepage, about, now, theatre, posts listing, five recent posts, and notes. Images load from the live site. CSS is copied from the project — edits to `~/www/jrbnz/styles/` take effect on the next browser refresh without any server restart.

The local site is served by Caddy on port 8083.

---

## File map

```
site/
  styles/
    site.css                Token defaults + reset + structural layout (no visual opinions)
    themes/
      base.css              Minimal starter theme — Arial 14px, no decoration
      <name>.css            One file per theme — all visual decisions live here

functions/
  lib/
    templates.js            Shared HTML partials (buildHead, buildSiteNav, buildFooter, …)
    snippets.js             Snippet CSS builder — uses CSS vars, not raw colour values
  themes/
    base.js                 Minimal fallback — all page types, Arial 14px, no decoration
    <name>.js               One file per theme
  api/
    [[path]].js             THEMES registry, loadSiteContext() (reads active theme), theme dispatch
```

---

## Renderer JS reference

A theme renderer is an ES module at `functions/themes/<name>.js`. It can export any subset of six page-builder functions plus `imageRoles`. Anything not exported falls back to `base.js` — which renders unstyled Arial 14px, making gaps immediately visible.

### Template helpers (from `functions/lib/templates.js`)

All renderers import from here. Never hardcode nav, footer, or `<head>` HTML directly.

```js
import { esc, buildHead, buildSiteNav, buildNavLinks, buildFooter, buildPostMeta, buildAuthorCard, SITE_URL } from '../lib/templates.js';
```

| Helper | Signature | Returns |
|---|---|---|
| `esc(str)` | `esc(value: any) → string` | HTML-escaped string |
| `SITE_URL` | constant | `'https://jrbnz.com'` |
| `buildHead({ title, theme, accent, snippetCss, extraHead })` | all optional | Full `<!doctype html><html data-theme="…"><head>…</head><body>` opener |
| `buildSiteNav(menuPages, activeHref)` | positional args | `<nav class="site-nav">…</nav>` |
| `buildNavLinks(menuPages)` | `menuPages: Page[]` | `[{ href, label }]` — for building custom nav markup |
| `buildFooter(menuPages, year)` | positional args | `<footer class="footer">…</footer>` (structural only — theme provides visual styles) |
| `buildPostMeta({ title, postUrl, metaDesc, ogImage, date, authorName })` | all optional | OG/meta tags HTML string for `<head>` |
| `buildAuthorCard(author)` | `author: Author` | HTML string for the author bio card |

**`buildHead` detail:**
```js
buildHead({
  title,       // string | null — null omits <title> (homepage uses site name from CSS)
  theme,       // string — written to data-theme="…" on <html>
  accent,      // string | null — hex colour; injected as inline style override for --color-accent
  snippetCss,  // string | null — additional CSS for snippet blocks
  extraHead,   // string | null — arbitrary HTML appended inside <head>
})
// → '<!doctype html>\n<html lang="en" data-theme="cinematic">\n<head>…</head>\n<body>'
```

---

### `buildPost(data)` → string

Renders a full post page. The dispatcher calls `themeRenderer(theme).buildPost(prepPostData(args))`.

```js
// data shape (all fields set by prepPostData):
{
  title: string,
  slug: string,
  date: string,              // ISO date e.g. '2025-01-01'
  dateFormatted: string,     // e.g. '1 January 2025'
  tags: string[],
  contentHtml: string,       // rendered markdown body
  excerpt: string,
  subtitle: string,
  coverImage: string | null,
  coverImageAlt: string,
  coverImageFocus: string,   // 'center' | 'top' | 'bottom' | 'left' | 'right'
  author: Author,
  authorCard: string,        // pre-rendered HTML from buildAuthorCard()
  accent: string | null,
  menuPages: Page[],
  snippetCss: string | null,
  readTime: number,          // minutes
  postUrl: string,           // full URL
  extraHead: string,         // pre-built OG/meta tags HTML
  prevPost: Post | null,
  nextPost: Post | null,
  year: number,
  theme: string,
  recentPosts: Post[],       // up to 3 recent published posts
}
```

---

### `buildIndex(data)` → string

Renders the essays list page (`/posts/`).

```js
{
  items: string,          // pre-rendered <li> elements (tag filtering via data-tags attr)
  tagChips: string,       // pre-rendered tag chip <a> elements
  menuPages: Page[],
  accent: string | null,
  snippetCss: string | null,
  year: number,
  theme: string,
  posts: Post[],          // published posts, sorted newest-first
  defaultCoverImage: string | null,
}
```

---

### `buildPage(data)` → string

Renders a CMS page (About, Now, etc.).

```js
{
  title: string,
  slug: string,      // use this for the active nav href: `/${slug}/`
  contentHtml: string,
  menuPages: Page[],
  accent: string | null,
  snippetCss: string | null,
  year: number,
  theme: string,
}
```

**Use `slug` for the active nav href**, not `title.toLowerCase()` — slugs are authoritative and won't break on multi-word or mixed-case page titles:
```js
buildSiteNav(menuPages, `/${slug}/`)
```

**The content wrapper must use `post-content`** (and optionally `e-content`). This is not optional — image layout classes (`img-wide`, `img-break`, `img-pair`), treatment classes (`photo-muted`, etc.), snippet blocks, blockquote styles, and all prose typography are defined under `.post-content` descendant selectors. A custom wrapper class will silently lose all of them:

```js
// ✓ Correct — all image layouts, treatments, and prose styles apply
`<div class="post-content e-content">${contentHtml}</div>`

// ✗ Wrong — images and prose render unstyled or broken
`<div class="page-body">${contentHtml}</div>`
```

This applies to `buildPage` specifically. `buildPost` already passes `contentHtml` into `.post-content` by convention, but `buildPage` is where theme authors most often reach for a custom class name.

---

### `buildPhotos(data)` → string

Renders the `/photos/` page. No photo data is passed — photos are static HTML in `site/photos/index.html` and copied to `dist/`. This renderer wraps them in nav/footer.

```js
{
  menuPages: Page[],
  accent: string | null,
  year: number,
  theme: string,
}
```

**The photo gallery requires CSS and JS that must be injected by your renderer.** Without them the lightbox and category filtering do not work.

Pass the CSS via `extraHead`:
```js
const extraHead = [
  '<meta name="description" content="…">',
  '<link rel="stylesheet" href="/photos/styles/gallery.css">',
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css">',
].join('\n');
return `${buildHead({ title: 'Photos', theme, accent, snippetCss, extraHead })}
  …
  <script src="/photos/scripts/gallery.js"></script>
</body></html>`;
```

Both the CSS and the script tag are required. Omitting either silently breaks the gallery — images load but the lightbox and category filter do nothing.

---

### `buildHomepage(data)` → string

Renders the site homepage (`/`). This is the most theme-specific renderer — most themes will want their own.

```js
{
  author: Author,
  recentPosts: Post[],       // all published posts, sorted newest-first
  menuPages: Page[],
  accent: string | null,
  snippetCss: string | null,
  theme: string,
  defaultCoverImage: string | null,
  homepageConfig: HomepageConfig | null,  // from settings/homepage.json
}
```

#### HomepageConfig shape

```json
{
  "featured": {
    "slug": "optional-post-slug",
    "titleOverride": "Optional override title",
    "dekOverride": "Optional override subtitle/deck",
    "imageOverride": "https://… (optional)",
    "ctaLabel": "Read the essay →"
  },
  "cards": [
    { "kicker": "Essays", "title": "Long-form pieces…", "href": "/posts/", "linkLabel": "Read essays →", "style": "" },
    { "kicker": "Photographs", "title": "Theatre, travel…", "href": "/photos/", "linkLabel": "View photographs →", "style": "invert" },
    { "kicker": "Now", "title": "What I'm doing now", "href": "/now/", "linkLabel": "Read →", "style": "" }
  ],
  "interlude": {
    "text": "Theatre, memory, technology…",
    "image": "https://… (optional)",
    "treatment": "photo-muted",
    "href": "/posts/ (optional)"
  },
  "archive": {
    "title": "From the Archive",
    "posts": ["slug-one", "slug-two", "slug-three"]
  }
}
```

Every field is optional. When absent, `featured` defaults to the most recent non-note post; `cards`, `interlude`, and `archive` fall back to hardcoded defaults. The config is edited via **Homepage** in Signal Admin — no full rebuild needed.

---

### `buildNotes(data)` → string

Renders the notes stream (`/notes/`).

```js
{
  notes: NoteWithHtml[],   // published notes with bodyHtml pre-rendered from markdown
  menuPages: Page[],
  accent: string | null,
  snippetCss: string | null,
  theme: string,
}

// NoteWithHtml shape:
{
  slug: string,
  title: string,
  date: string,
  tags: string[],
  bodyHtml: string,
}
```

---

### `imageRoles` export

Tells Signal which layout and treatment options to show in the image editor for this theme. Fetched from `GET /api/theme/image-roles`. **Every theme must export this** — without it, Signal falls back to an empty list and the image editor shows no options.

Export all four layouts and all four treatments, matching the class names in the [shared class contract](#shared-class-contract):

```js
export const imageRoles = {
  layouts: [
    { className: 'img-wide',  label: 'Wide',  description: 'Breaks slightly outside the reading column' },
    { className: 'img-break', label: 'Break', description: 'Full-width pause between sections' },
    { className: 'img-small', label: 'Small', description: 'Within the reading column, modest size' },
    { className: 'img-pair',  label: 'Pair',  description: 'Two images side by side on desktop' },
  ],
  treatments: [
    { className: 'photo-muted',  label: 'Muted',  description: 'Reduced saturation and contrast', isDefault: true },
    { className: 'photo-mono',   label: 'Mono',   description: 'Strong monochrome' },
    { className: 'photo-colour', label: 'Colour', description: 'Mostly untreated' },
    { className: 'photo-soft',   label: 'Soft',   description: 'Lower contrast, slightly lifted' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
```

If your theme uses different layout or treatment classes, update the `className` values to match — Signal will use whatever you export.

---

### Shared data types

```js
// Author (from settings/author.json)
{
  name: string,
  bio: string,
  avatar: string,   // URL
}

// Page (from pages/index.json — menu pages)
{
  slug: string,
  title: string,
  nav_url: string | undefined,   // if set, this URL is used in nav instead of /slug/
  include_in_menu: boolean,
  status: 'published' | 'draft',
}

// Post (from posts/index.json)
{
  slug: string,
  title: string,
  date: string,         // ISO e.g. '2025-01-01'
  status: 'published' | 'draft',
  tags: string[],
  coverImage: string | null,
  coverImageAlt: string,
  coverImageFocus: string,
  excerpt: string,
  subtitle: string,
  wordCount: number,
}
```

---

## Static build notes

HTML is pre-rendered to R2 at publish time and exported to `dist/` at deploy time (see `scripts/build.mjs`). Theme changes require a full **Rebuild site** in Signal to re-render all posts and pages with the updated templates, then a **Deploy** to push the new HTML to CDN.

CSS and JS changes in `site/` are picked up automatically on the next deploy — no Rebuild needed since they are copied directly from `site/` to `dist/`.

Snippets CSS (`functions/lib/snippets.js`) uses only CSS custom properties — the same vars defined in the theme token system. Raw colour values must not appear in snippets.
