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
3. Any layout styles specific to that theme's HTML structure (e.g. the
   cinematic fixed nav, hero section, more-essays strip).

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

1. **Copy an existing theme CSS** as a starting point:
   ```
   cp site/styles/themes/cinematic.css site/styles/themes/mytheme.css
   ```

2. **Rename the selectors** — replace `[data-theme="cinematic"]` with
   `[data-theme="mytheme"]` throughout the file.

3. **Update the token values** to match your design.

4. **Add a `.surface-invert` block** if your theme uses inverted surface
   sections. Set the tokens to whatever the inverted palette should be.

5. **Add theme-specific layout styles** for any HTML structure your renderer
   introduces (e.g. nav positioning, hero grid, homepage cards).

6. **Create a renderer file** at `functions/themes/mytheme.js` if the page
   HTML structure differs from the dark theme. Export any of `buildPost`,
   `buildIndex`, `buildPage`, `buildHomepage`, `buildPhotos`, `buildNotes`.
   You only need to export the functions that differ — the dispatcher falls
   back to `dark.js` for anything not exported.
   See [Renderer JS reference](#renderer-js-reference) for full function signatures and data models.

7. **Register the theme** — two lines in `functions/api/[[path]].js`:
   ```js
   import * as myTheme from '../themes/mytheme.js';           // at the top with other imports
   const THEMES = { dark: darkTheme, cinematic: cinematicTheme, mytheme: myTheme };  // add entry
   ```

8. **Activate in Signal** — go to **Settings → Appearance → Theme**, select the new theme, click Save.
   Then **Rebuild site** and **Deploy** to apply it to the live site.

That's it. No other files need to change.

---

## Type system (cinematic theme)

The cinematic theme uses three typefaces. Each is fixed — they cannot be changed in post content, only in the theme CSS.

| Token | Typeface | Role |
|---|---|---|
| `--font-display` | `Baskerville, Georgia, 'Times New Roman', serif` | Hero titles, section headings, pull quotes, quote interludes, homepage feature title, footer quote |
| `--font-body` | `Georgia, 'Times New Roman', serif` | All running prose: article paragraphs, blockquote text, decks, excerpts, card descriptions |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | Labels, kickers, metadata, nav items, dates, all UI chrome |

Display contexts should have tight letter-spacing (around `-0.05em` to `-0.065em` for large titles) and a low line-height (around `0.86` to `0.92` for the largest sizes). Body text uses a generous line-height (`1.7`–`1.82`). Mono text uses uppercase with `0.16`–`0.22em` letter-spacing.

---

## Background colour vars (cinematic theme)

In addition to the standard semantic `--color-bg` token, the cinematic theme defines three atmospheric colour vars in the `[data-theme="cinematic"]` block:

| Variable | Value | Use |
|---|---|---|
| `--color-reading-bg` | `#eee7dc` | Warm reading surface (`.surface-invert` background) |
| `--color-deep-bg` | `#03040a` | Deep dark (legacy; prefer `--color-deeper-bg` for new use) |
| `--color-deeper-bg` | `#040608` | Deepest dark — used for interlude sections, footer, `.quote-interlude` |

These are internal to the cinematic theme and should not be referenced from component CSS. Only reference the semantic tokens (`--color-bg`, `--color-text`, etc.) from shared components.

---

## Quote hierarchy (cinematic theme)

There are three quote structures with increasing visual weight:

| Syntax | Output | When to use |
|---|---|---|
| `> text` (standard blockquote) | Gold left rule, 60% column width, Georgia body text | A cited passage or key sentence incidental to the surrounding prose |
| `<div class="pull-quote"> > text </div>` | In-flow, display font at `clamp(24px, 3.8vw, 48px)`, slightly wider than column, top/bottom rules | One sentence you want the reader to stop at; editorial emphasis; once per section at most |
| `<div class="quote-interlude"> > text </div>` | Full-width dark section break, display font at `clamp(28px, 4.5vw, 66px)`, centred | A structural pause between major sections; once per long piece at most |

The `.pull-quote` and `.quote-interlude` wrappers suppress the standard blockquote styling and apply display-font rules automatically.

---

## Article ending (cinematic theme)

Each post ends with a quiet `.article-ending` footer rendered inside the warm reading surface (`.surface-invert`), immediately after the article body and before the "More Essays" strip.

The ending shows:
- A mono label: `Essay` or `Note` depending on post type
- A meta line: `Published [Month Year] · [tag1] · [tag2]`
- A `Back to Essays` link on the right

This is generated automatically from the post's `date` and `tags` fields — no author action needed. It is deliberately understated: the intent is to let the article breathe rather than jump straight from the last sentence into recommendations.

Stronger image exits, afterwords, or decorative closing marks are future optional styles and should not replace the default fade-out treatment.

---

## Homepage config model

The homepage layout is driven by a JSON config stored at `settings/homepage.json` in R2. It is loaded by `loadSiteContext(env)` and passed to `buildHomepage()` in the active theme renderer.

### Schema

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

### Fallback behaviour

Every field is optional. When absent:
- `featured`: defaults to `essays[0]` (most recent non-note post)
- `cards`: defaults to the hardcoded Essays / Photographs / first nav-page blocks
- `interlude`: defaults to the text-only version with the standing tagline
- `archive`: defaults to the three most recent essays that are not the featured post

### Archive section

The homepage archive section (`home-archive`) uses a **sparse editorial list** treatment by default: typographic, restrained, publication-like. Each item shows a large display-font title and a small mono category label. The background is `--color-deeper-bg`, slightly darker than the page, to give it a distinct curated zone feel.

Archive picks are **curated, not automatic**. The `archive.posts` array in `settings/homepage.json` should be hand-selected. The fallback (three most recent non-featured essays) is only for when no config exists. Stronger image exits or card-based archive displays are future optional styles and should not become the default.

### Editing

Use the **Homepage** view in Signal Admin (`/signal/#homepage`). Clicking **Save & publish** calls `PUT /api/homepage-config`, which saves the config to KV and immediately rebuilds the homepage HTML. No full site rebuild is needed.

---

## Image roles in the cinematic theme

The cinematic theme has a two-axis image system: **layout** (how the image fits into the page) and **treatment** (how it is filtered). These are separate CSS classes that combine freely.

### Why these exist

Many article images will not depict the post subject directly. A photo may be atmospheric, emotional, textural, archival, or documentary. These classes support that without every image becoming a visual distraction. The goal is mood, pacing, and editorial texture — not illustration.

Not every post needs a literal image. Use images that add something the text cannot.

### Layout roles

| Class | Purpose |
|---|---|
| `.img-wide` | Breaks slightly outside the reading column. Best for landscape, atmospheric, or location images. |
| `.img-break` | Full-width pause between sections. Cinematic, immersive. Best for mood images that reset the reader's attention. |
| `.img-small` | Sits comfortably within the reading column. Intentionally modest. Best for archival, documentary, personal, or reference images. |
| `.img-pair` | Two related images side by side on desktop, stacked on mobile. Best for contrasts, sequences, before/after, or images that form a visual thought. |

### Treatment roles

| Class | Purpose |
|---|---|
| `.photo-muted` | Reduced saturation and contrast. **Recommended default** for most atmospheric photos. |
| `.photo-mono` | Strong monochrome. Use for archival, cinematic, stark, or memory-like images. |
| `.photo-colour` | Mostly untreated. Use when colour is important — not as a default. |
| `.photo-soft` | Lower contrast, slightly lifted. Use for reflective, quiet, nostalgic, or landscape images. |

### Combining roles

Apply one layout class and one treatment class to the same `<figure>`:

```html
<figure class="img-wide photo-muted">…</figure>
<figure class="img-break photo-mono">…</figure>
<figure class="img-small photo-colour">…</figure>
<figure class="img-pair photo-soft">…</figure>
```

**Recommended defaults:** `.img-wide.photo-muted` for most unrelated-but-atmospheric images. `.img-break.photo-muted` for a major atmospheric pause.

Use literal or external/CC images sparingly — mostly when the article is explicitly about that person, object, place, or event. In those cases, `.photo-colour` is appropriate.

### `.img-pair` usage

`.img-pair` is a grid wrapper around two `<figure>` (or `<img>`) children. In Signal, insert two consecutive images both with **Pair** layout — the renderer wraps them automatically. A blank line between them breaks the pair.

```
<!-- signal:image src="url1" alt="…" imgRole="img-pair" treatment="photo-soft" -->
<!-- signal:image src="url2" alt="…" imgRole="img-pair" treatment="photo-soft" -->
```

### Hero images

Hero image filters are controlled by the `--image-filter-hero` custom property on `[data-theme="cinematic"]`. Change this one value to adjust all hero images at once. It defaults to full grayscale with a slight brightness/contrast adjustment.

### Theme-level image filter vars

| Variable | Default value |
|---|---|
| `--image-filter-hero` | `grayscale(100%) brightness(0.80) contrast(1.04)` |
| `--image-filter-mono` | Same as hero |
| `--image-filter-muted` | `saturate(0.55) brightness(0.92) contrast(0.97)` |
| `--image-filter-soft` | `saturate(0.75) brightness(1.02) contrast(0.88)` |
| `--image-filter-colour` | `brightness(0.96)` |

### Where the config lives / adding a new theme

Image role metadata is defined in `functions/themes/<name>.js` as a named export `imageRoles`. The Signal editor fetches this from `GET /api/theme/image-roles` (public, no auth) and uses it to populate the layout and treatment selects.

To add, remove, or rename roles in a new theme: export an `imageRoles` object from the theme file with the same shape as `cinematic.js`. Signal will reflect the change automatically.

```js
export const imageRoles = {
  layouts: [
    { className: 'img-wide', label: 'Wide', description: '…' },
    // …
  ],
  treatments: [
    { className: 'photo-muted', label: 'Muted', description: '…', isDefault: true },
    // …
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
```

---

## File map

```
site/
  styles/
    main.css                Token names + dark defaults, reset, base typography
    blog.css                Shared components — token references only, no raw values
    themes/
      dark.css              Dark theme token values + dark layout styles
      cinematic.css         Cinematic theme token values + cinematic layout styles
      brash-editorial.css   Brash editorial theme (warm paper, big serif, coloured blocks)
  scripts/
    blog.js                 Client-side tag filtering (essays page)

functions/
  lib/
    templates.js            Shared HTML partials (buildHead, buildSiteNav, buildFooter, …)
    snippets.js             Snippet CSS builder — uses CSS vars, not raw colour values
  themes/
    dark.js                 Dark page renderers (buildPost, buildIndex, buildPage, …) — fallback base
    cinematic.js            Cinematic page renderers (only what structurally differs from dark)
    brash-editorial.js      Brash editorial renderers (buildHomepage, imageRoles only)
  api/
    [[path]].js             THEMES registry, loadSiteContext() (reads active theme), theme dispatch
```

---

## Renderer JS reference

A theme renderer is an ES module at `functions/themes/<name>.js`. It can export any subset of six page-builder functions plus `imageRoles`. Anything not exported falls back to `dark.js`.

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
  slug: string,
  contentHtml: string,
  menuPages: Page[],
  accent: string | null,
  snippetCss: string | null,
  year: number,
  theme: string,
}
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

See [Homepage config model](#homepage-config-model) for the `HomepageConfig` shape.

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

Tells Signal which layout and treatment options to show in the image editor for this theme. Fetched from `GET /api/theme/image-roles`.

```js
export const imageRoles = {
  layouts: [
    { className: 'img-wide',  label: 'Wide',  description: '…' },
    { className: 'img-break', label: 'Break', description: '…' },
    { className: 'img-small', label: 'Small', description: '…' },
    { className: 'img-pair',  label: 'Pair',  description: '…' },
  ],
  treatments: [
    { className: 'photo-muted',  label: 'Muted',  description: '…', isDefault: true },
    { className: 'photo-mono',   label: 'Mono',   description: '…' },
    { className: 'photo-colour', label: 'Colour', description: '…' },
    { className: 'photo-soft',   label: 'Soft',   description: '…' },
  ],
  defaults: { layout: 'img-wide', treatment: 'photo-muted' },
};
```

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

## HTML structure and class reference

This section documents every class the **cinematic** theme CSS targets, organised by page. The HTML is generated by `functions/themes/cinematic.js` (falling back to `dark.js` for pages it doesn't override). A designer writing a new theme should use this as a reference for what HTML structure to expect — or to produce from their own renderer.

All pages carry `data-theme="<name>"` on `<html>`. Theme CSS must scope all selectors with `[data-theme="<name>"]` to avoid leaking into Signal or other themes.

---

### Shared — every page

```html
<!-- Nav (position: fixed) -->
<nav class="site-nav">
  <a href="/" class="nav-logo">JRBNZ</a>
  <ul class="nav-links">
    <li><a href="/posts/" class="active">Essays</a></li>  <!-- .active on current page -->
    <li><a href="/photos/">Photos</a></li>
  </ul>
</nav>

<!-- Inverted surface (warm light panel on dark page) -->
<div class="surface-invert">
  <!-- article body, notes stream, CMS page content -->
</div>

<!-- Footer -->
<footer class="cinematic-footer">
  <p class="cinematic-footer-quote">…tagline…</p>
  <nav class="cinematic-footer-nav">
    <a href="/posts/">Essays</a>
    <a href="/feed.xml">RSS</a>
  </nav>
</footer>
```

---

### Homepage (`/`)

```html
<main class="h-card">

  <!-- Featured essay hero — full viewport height, image behind overlay -->
  <section class="ci-featured" id="home-featured">
    <img class="ci-featured-img" src="…" alt="…">       <!-- background image -->
    <div class="ci-featured-overlay">                   <!-- dark gradient overlay -->
      <div class="ci-featured-inner">
        <p class="post-kicker">Featured Essay · January 1, 2025</p>
        <h2 class="ci-featured-title"><a href="/posts/slug/">Title</a></h2>
        <p class="ci-featured-excerpt">Subtitle or excerpt</p>
        <a href="/posts/slug/" class="ci-read-link">Read the essay →</a>
      </div>
    </div>
  </section>

  <!-- Navigation cards -->
  <section class="home-blocks">
    <a class="home-block" href="/posts/">               <!-- standard card -->
      <div>
        <p class="home-block-kicker">Essays</p>
        <h2 class="home-block-title">Long-form pieces…</h2>
      </div>
      <span class="home-block-link">Read essays →</span>
    </a>
    <a class="home-block home-block-invert" href="/photos/">  <!-- inverted card -->
      …
    </a>
  </section>

  <!-- Interlude — full viewport height, atmospheric image or text break -->
  <!-- Renders as <section> or <a> depending on whether href is set -->
  <section class="home-interlude home-interlude--image">   <!-- --image modifier when image present -->
    <img class="home-interlude-img photo-muted" src="…" alt="">
    <p class="home-interlude-text">Theatre, memory, technology…</p>
  </section>

  <!-- Archive — curated post list -->
  <section class="home-archive">
    <div class="home-archive-label">From the Archive</div>
    <div class="home-archive-list">
      <a href="/posts/slug/" class="home-archive-item">
        <span class="home-archive-title">Post title</span>
        <span class="home-archive-meta">Theatre</span>
      </a>
    </div>
  </section>

</main>
```

---

### Essays index (`/posts/`)

```html
<main>

  <!-- Featured essay — same structure as homepage ci-featured, carries data-tags -->
  <section class="ci-featured" id="ci-featured" data-tags="theatre,writing">
    …same as homepage featured…
  </section>

  <!-- Tag filter bar + chips -->
  <section class="ci-tags">
    <div class="tag-filter-bar" id="tag-filter-bar" hidden>   <!-- shown by blog.js when tag active -->
      Essays tagged <strong id="tag-filter-label"></strong>
      <a href="/posts/" class="tag-filter-clear">× Clear filter</a>
    </div>
    <div class="tags-section">
      <a href="/posts/?tag=theatre" class="tag-chip">#theatre</a>
      <a href="/posts/?tag=writing" class="tag-chip">#writing</a>
    </div>
  </section>

  <!-- All essays grid -->
  <section class="more-essays ci-index-all">
    <p class="more-essays-label">All essays</p>
    <div class="essay-strip">
      <!-- Each card carries data-tags for client-side filtering -->
      <a href="/posts/slug/" class="essay-card post-list-item" data-tags="theatre">
        <img class="essay-card-img" src="…" alt="…">    <!-- or .essay-card-no-img div if no image -->
        <h3 class="essay-card-title">Post title</h3>
        <p class="essay-card-meta">Theatre · January 1, 2025</p>
      </a>
    </div>
  </section>

</main>
```

---

### Post — essay

```html
<article class="h-entry">

  <!-- Full-viewport hero -->
  <section class="post-hero">
    <img class="post-hero-img" src="…" alt="…">         <!-- optional cover image -->
    <div class="post-hero-content">
      <p class="post-kicker">January 1, 2025 · 8 min read · Theatre</p>
      <h1 class="post-hero-title p-name">Post title</h1>
      <p class="post-hero-dek">Subtitle / deck</p>       <!-- optional -->
    </div>
  </section>

  <!-- Warm reading surface -->
  <div class="surface-invert">
    <div class="article-col article-open article-section">
      <div class="post-content e-content">
        <!-- Rendered markdown — see Post content classes below -->
      </div>
    </div>

    <!-- Article ending footer -->
    <footer class="article-ending">
      <div>
        <div class="article-ending-label">Essay</div>       <!-- or "Note" -->
        <div class="article-ending-meta">Published January 2025 · theatre</div>
      </div>
      <a class="article-ending-back" href="/posts/">Back to Essays</a>
    </footer>
  </div>

  <!-- More essays strip (dark background) -->
  <section class="more-essays">
    <p class="more-essays-label">More essays</p>
    <div class="essay-strip">
      <a href="/posts/slug/" class="essay-card">…</a>
      <a href="/posts/" class="essay-card essay-card--archive">…</a>   <!-- archive link card -->
    </div>
  </section>

</article>
```

---

### Post — note

Notes use a compact dark header instead of a full hero.

```html
<article class="h-entry">

  <!-- Compact header (no hero image) -->
  <div class="post-hero-compact">
    <p class="post-kicker">January 1, 2025 · 2 min read</p>
    <h1 class="post-hero-compact-title p-name">Note title</h1>
    <p class="post-hero-dek">Optional subtitle</p>
  </div>

  <!-- Same surface-invert + article-col + article-ending as essay -->
  <div class="surface-invert">…</div>

  <!-- Same more-essays strip as essay -->
  <section class="more-essays">…</section>

</article>
```

---

### Notes stream (`/notes/`)

```html
<!-- Page masthead — also used by CMS pages -->
<div class="ci-page-masthead">
  <h1 class="ci-page-title">Notes</h1>
</div>

<div class="surface-invert">
  <section class="notes-stream">
    <article class="note-entry">
      <div class="note-meta">
        <a class="note-permalink" href="/posts/slug/" title="Permalink">#</a>
        <time class="note-date">January 1, 2025</time>
        <span class="note-tag">theatre</span>            <!-- one per non-note tag -->
      </div>
      <div class="note-body post-content">
        <!-- Rendered markdown -->
      </div>
    </article>
  </section>
</div>
```

---

### CMS page

```html
<div class="ci-page-masthead">
  <h1 class="ci-page-title">About</h1>
</div>

<div class="surface-invert">
  <div class="ci-page-content">
    <div class="post-content page-content">
      <!-- Rendered markdown -->
    </div>
  </div>
</div>
```

---

### Post content (inside `.post-content`)

These classes appear inside the rendered markdown body and are applied by the markdown renderer or Signal image blocks.

```html
<!-- Standard prose elements -->
<h2>, <h3>, <h4>
<p>, <ul>, <ol>, <li>
<blockquote>          <!-- gold left-rule style -->
<code>, <pre><code>   <!-- inline and block code -->
<figcaption>

<!-- Quote structures (increasing visual weight) -->
<div class="pull-quote">
  <blockquote><p>…</p></blockquote>    <!-- display font, in-flow emphasis -->
</div>

<div class="quote-interlude">
  <blockquote><p>…</p></blockquote>    <!-- full-width dark section break -->
</div>

<!-- Images — layout class + treatment class on the figure -->
<figure class="img-wide photo-muted">
  <img src="…" alt="…">
  <figcaption>Optional caption</figcaption>
</figure>

<!-- Available layout classes: img-wide, img-break, img-small -->
<!-- img-pair is a wrapper around two figures: -->
<div class="img-pair">
  <figure class="photo-soft"><img …></figure>
  <figure class="photo-soft"><img …></figure>
</div>

<!-- Available treatment classes: photo-muted, photo-mono, photo-colour, photo-soft -->

<!-- Snippet blocks (inline styled via CSS vars — do not override with raw colours) -->
<div class="snippet">…</div>
```

---

## Static build notes

HTML is pre-rendered to R2 at publish time and exported to `dist/` at deploy time (see `scripts/build.mjs`). Theme changes require a full **Rebuild site** in Signal to re-render all posts and pages with the updated templates, then a **Deploy** to push the new HTML to CDN.

CSS and JS changes in `site/` are picked up automatically on the next deploy — no Rebuild needed since they are copied directly from `site/` to `dist/`.

Snippets CSS (`functions/lib/snippets.js`) uses only CSS custom properties — the same vars defined in the theme token system. Raw colour values must not appear in snippets.
