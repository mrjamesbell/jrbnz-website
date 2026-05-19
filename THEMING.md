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

The active theme name is set by `SITE_THEME` in
`functions/api/[[path]].js`. The Worker writes `data-theme="<name>"` onto the
`<html>` element and loads `/styles/themes/<name>.css`.

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

1. **Copy an existing theme file** as a starting point:
   ```
   cp styles/themes/dark.css styles/themes/mytheme.css
   ```

2. **Rename the selectors** — replace `[data-theme="dark"]` with
   `[data-theme="mytheme"]` throughout the file.

3. **Update the token values** to match your design.

4. **Add a `.surface-invert` block** if your theme has inverted surface
   sections. Set the tokens to whatever the inverted palette should be.

5. **Add theme-specific layout styles** if your HTML structure differs from
   the dark theme (e.g. a fixed nav needs position/height rules here).

6. **Create a renderer file** at `functions/themes/mytheme.js` if the page
   HTML structure differs from the dark theme. Export any of `buildPost`,
   `buildIndex`, `buildPage`, `buildHomepage`, `buildPhotos`, `buildNotes`.
   You only need to export the functions that differ — the dispatcher falls
   back to `dark.js` for anything not exported. See `functions/themes/dark.js`
   for the expected function signatures.

7. **Activate the theme** by changing `SITE_THEME` in
   `functions/api/[[path]].js`:
   ```js
   const SITE_THEME = 'mytheme';
   ```

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
styles/
  main.css              Token names + dark defaults, reset, base typography
  blog.css              Shared components — token references only, no raw values
  themes/
    dark.css            Dark theme token values + dark layout styles
    cinematic.css       Cinematic theme token values + cinematic layout styles

functions/
  lib/
    templates.js        Shared HTML partials (buildHead, buildSiteNav, buildFooter, …)
  themes/
    dark.js             Dark page renderers (buildPost, buildIndex, buildPage, …)
    cinematic.js        Cinematic page renderers (only what structurally differs)
  api/
    [[path]].js         SITE_THEME constant, prepPostData(), theme dispatch
```
