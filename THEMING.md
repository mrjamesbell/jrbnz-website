# Theming

The site uses a two-layer CSS custom property system. Components reference
semantic tokens; themes supply the values. Switching the active theme changes
visual output without touching any component CSS.

---

## How it works

### Layer 1 — Semantic tokens

Defined in `styles/main.css` `:root`. These names never change between themes;
only their values do. Every component references only these tokens.

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

Each theme lives in `styles/themes/<name>.css`. A theme file contains:

1. A `[data-theme="<name>"]` block that sets values for every token above.
2. A `[data-theme="<name>"] .surface-invert` block for the inverted surface
   (see below).
3. Any layout styles specific to that theme's HTML structure (e.g. a fixed nav,
   hero section, post grid).

The active theme name is stored in `settings/site.json` in R2 (key `theme`).
`loadSiteContext()` reads it on every render. The Worker writes `data-theme="<name>"` onto
the `<html>` element and loads `/styles/themes/<name>.css`. The active theme can be
changed from the **Settings → Appearance → Theme** picker in Signal — no code change needed.

### The `.surface-invert` pattern

Many designs have sections that invert the palette — a light reading surface
inside a dark page, or vice versa. Rather than hardcoding colours for that
surface, wrap it in a `<div class="surface-invert">`. The theme's
`.surface-invert` block re-declares the same token names with inverted values,
so every component inside automatically renders correctly.

```html
<!-- Dark page background, then a light reading column -->
<div class="surface-invert">
  <div class="article-col">…article content…</div>
</div>
```

### Runtime accent override

`--color-accent` (and its legacy alias `--accent-color`) can be overridden at
runtime via an inline `<style>` injected by the Worker when a site has a custom
accent colour configured. This sits on top of whatever the theme file sets and
takes precedence via cascade order.

---

## Adding a new theme

A theme is two files: a CSS file that tokens and layouts your design, and a JS renderer that generates the HTML. The HTML class names are yours to define — you are not required to reuse class names from any existing theme. The only constraints are the [shared class contract](#shared-class-contract) below.

1. **Create a CSS file** at `site/styles/themes/mytheme.css`. Start from scratch or use `base.css` as a minimal scaffold. Scope every rule to `[data-theme="mytheme"]`.

   At minimum, set all semantic tokens:
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

   Then add a `.surface-invert` block if your design has sections that flip the palette:
   ```css
   [data-theme="mytheme"] .surface-invert {
     --color-bg: …;     /* inverted values */
     --color-text: …;
     background: var(--color-bg);
     color: var(--color-text);
   }
   ```

   Then add whatever layout CSS your HTML requires — using your own class names.

   **Your CSS must also style every class in the [shared class contract](#shared-class-contract).** Use the checklist there to make sure nothing is missed.

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

These class names are required by the system — blog.js tag filtering, Signal's image editor, and the template helpers produce or depend on them. Your CSS must style them; your renderer must not rename them.

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

### Footer — each theme writes its own

There is no shared footer helper. Each theme renderer inlines its own footer HTML with its own class names. Use whatever structure suits your design.

`blog.css` contains styles for a set of footer classes written for the `buildFooter` helper in `functions/lib/templates.js`. That helper is not called by any active theme, but its styles remain in the cascade. **Avoid reusing these class names** unless you want those styles applied. The helper produces:

```html
<footer class="footer">
  <div class="footer-left">
    <a href="/" class="footer-logo">JRBNZ</a>
    <div class="footer-fineprint">© 2026 James Bell</div>
    <div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div>
  </div>
  <div class="footer-right">
    <nav class="footer-nav" aria-label="Footer">
      <a href="/posts/">Essays</a> …
    </nav>
    <div class="footer-bottom-links">
      <a href="/feed.xml" class="footer-rss"><!-- RSS SVG --> RSS Feed</a>
      <span class="footer-signal" title="Made with Signal"><!-- Signal SVG --></span>
    </div>
  </div>
</footer>
```

Classes with blog.css styles: `.footer`, `.footer-left`, `.footer-right`, `.footer-logo`, `.footer-fineprint`, `.footer-nav`, `.footer-nav a`, `.footer-bottom-links`, `.footer-rss`, `.footer-signal`. See the clash table below.

Two current footer patterns for reference:

```html
<!-- Lightroom — minimal, own class names, no clash risk -->
<footer class="lr-footer">
  <span class="lr-footer-copy">©2026 JRBNZ</span>
  <nav class="lr-footer-nav">
    <a href="/posts/">Essays</a>
    …
  </nav>
</footer>

<!-- Cinematic — reuses .footer-nav (blog.css styles apply; overridden in cinematic.css) -->
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

Your theme JS must also export an `imageRoles` object so Signal knows which options to show. See [`imageRoles` export](#imageroles-export) in the renderer reference.

### From `blog.js` — tag filtering on the essays index

The client-side tag filter script expects these IDs and classes to exist on the essays index page. If your `buildIndex` renderer doesn't produce them, tag filtering silently does nothing.

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
```

Style: `tag-filter-bar`, `tag-filter-clear`, `tags-section`, `tag-chip`, `post-list-item`.

### Microformats2 — search/reader compatibility

Wrap each post page in `<article class="h-entry">` and the homepage in `<main class="h-card">`. Mark the post title with `p-name` and body with `e-content`. These do not need CSS — they are semantic hooks for feed readers and search.

---

## Writing reliable theme CSS

These are the rules that matter most for avoiding subtle bugs when building a new theme. Each one comes from a real regression.

### 1. Understand the CSS load order

```
main.css          ← :root base tokens, reset, global a/body/h1 rules
blog.css          ← shared component styles (post list, footer, nav, etc.)
themes/<name>.css ← your theme (loaded last)
<style> block     ← runtime accent override (injected inline by Worker)
```

Your theme CSS loads after `blog.css`, which helps. But **specificity still beats source order**. A bare `.footer-nav a` rule in `blog.css` (specificity 0,1,1) will win over an inherited value from `[data-theme="x"] .footer-nav` (specificity 0,2,0) because inheritance always loses to a directly-set property. See rule 2.

### 2. Always set properties directly on `a` elements — never rely on inheritance from a container

`blog.css` explicitly sets `font-family`, `font-size`, `letter-spacing`, and `color` on many anchor selectors (`.footer-nav a`, `.post-list-item a`, etc.). Even if you set the right `font-family` on a container with higher specificity, the direct `a` rule in `blog.css` beats it for the anchor element itself.

**Rule:** if you want a different value on an `<a>` inside a shared class, you must set it directly on the `a`:

```css
/* ✗ Wrong — sets font on container; blog.css's .footer-nav a wins on the anchor */
[data-theme="x"] .footer-nav {
  font-family: var(--font-mono);
  font-size: 12px;
}

/* ✓ Correct — targets the anchor directly, beats blog.css */
[data-theme="x"] .footer-nav a {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
```

When reusing a class name from blog.css, look it up and explicitly override **every property** that file sets on the element.

### 3. Every `<a>` gets a visible border-bottom by default

`main.css` applies `a { border-bottom: 1.6px solid var(--color-text) }` globally. Every link in your theme that should not have an underline needs `border-bottom: none` stated explicitly in your theme CSS:

```css
[data-theme="x"] .nav-logo,
[data-theme="x"] .nav-links a,
[data-theme="x"] .footer-nav a,
[data-theme="x"] .my-card-link {
  border-bottom: none;
}
```

Forgetting this is the most common source of unexpected underlines appearing on link-styled elements.

### 4. `:root` defaults are base theme values, not dark values

If a token is not overridden by your theme, it resolves to the `:root` default — which is the base theme: white background, black text, Arial. A missing token will make a component look obviously wrong (white on white, or black Helvetica in the middle of a serif page) rather than accidentally inheriting the dark theme. This is intentional and helpful — gaps are visible.

### 5. Scope every selector — no naked rules

Every rule in your theme CSS must be scoped to `[data-theme="<name>"]`. Naked rules (without the scope) will leak into Signal admin and every other theme. There are no exceptions.

```css
/* ✗ Leaks everywhere */
.article-col { max-width: 680px; }

/* ✓ Scoped to your theme only */
[data-theme="x"] .article-col { max-width: 680px; }
```

### 6. Check blog.css before reusing a class name

Before using a class name in your renderer HTML, `grep blog.css` for it. If it appears there, read what properties it sets. You will need to explicitly override all of them in `[data-theme="x"] .classname` and `[data-theme="x"] .classname a`. Shared class names that are most likely to clash:

| Class | Properties set in blog.css | Note |
|---|---|---|
| `.footer-nav a` | `font-family`, `font-size`, `letter-spacing`, `color`, `border-bottom` | From unused `buildFooter` helper — avoid or override |
| `.footer-logo` | `font-family`, `font-size`, `color`, `border-bottom` | From unused `buildFooter` helper — avoid or override |
| `.post-list-item a` | `font-size`, `color`, `border-bottom` | |
| `.post-content a` | `color`, `border-bottom-color` | |
| `.tag-chip` | `font-family`, `font-size`, `color`, `border` | |
| `.site-nav .nav-links a` | `font-family`, `font-size`, `letter-spacing`, `color`, `border-bottom` | |

If in doubt, use a unique class name for your theme instead.

### 7. Minimum font size is 14px

No rendered text — body, captions, labels, metadata, fine print — should be set below `14px`. This applies to every element in every state, including `:hover` and inside compressed layouts on mobile. If something feels too large at 14px, reconsider the surrounding spacing or weight rather than dropping the size.

### 8. No muted colours — always maintain contrast

Do not use low-contrast or muted text colours as a design move. `--color-text-muted` and `--color-text-subtle` exist in the token system, but their values must still pass WCAG AA contrast against the background they sit on (4.5:1 for normal text, 3:1 for large text). Do not set these tokens to colours that are decoratively faint — if it looks faded, it will fail for low-vision readers.

This applies to every foreground value in the theme: body text, captions, labels, dates, placeholders, icon fills, and link colours in all states.

---

## File map

```
site/
  styles/
    main.css                Token names + defaults, reset, base typography
    blog.css                Shared components — token references only, no raw values
    themes/
      base.css              Minimal starter theme — Arial 14px, no decoration
      <name>.css            One file per theme

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
| `buildFooter(menuPages, year)` | positional args | `<footer class="footer">…</footer>` (dark theme footer) |
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
