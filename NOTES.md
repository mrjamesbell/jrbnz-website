# jrbnz.com — Project Notes

## Overview

Static personal website for James Bell, hosted on Cloudflare Pages and deployed from GitHub (`mrjamesbell/jrbnz-website`). No build step — HTML, CSS and JS are served directly. The blog lives on Bear Blog at `blog.jrbnz.com` but is styled to match the main site.

---

## Architecture

| Concern | Solution |
|---|---|
| Hosting | Cloudflare Pages (auto-deploys from GitHub main branch) |
| Photos | Cloudflare R2 bucket (`photo-gallery`), public at `i.jrbnz.com` |
| Photo metadata | `photos.json` on R2 (no server, no Worker) |
| Blog | Bear Blog (`blog.jrbnz.com`), paid plan |
| Shared header/footer | JS fetch from `/partials/` injected on every inner page |
| Build step | None |

---

## File Structure

```
jrbnz-website/
├── index.html              # Homepage
├── now/index.html          # Now page
├── photos/index.html       # Photo gallery
├── styles/
│   ├── main.css            # Shared design system (imported everywhere)
│   └── home.css            # Homepage-only styles
├── photos/styles/
│   └── gallery.css         # Photo gallery styles
├── partials/
│   ├── header.html         # Shared nav (injected via JS)
│   └── footer.html         # Shared footer (injected via JS)
├── scripts/
│   └── components.js       # Fetches and injects partials
├── blog/
│   ├── custom.css          # Bear Blog custom CSS (paste into admin)
│   ├── header.html         # Bear Blog header directive (paste into admin)
│   └── footer.html         # Bear Blog footer directive (paste into admin)
└── _redirects              # Cloudflare Pages redirect rules
```

---

## Design System (main.css)

Single stylesheet imported by every page — and by the Bear Blog via `@import url('https://jrbnz.com/styles/main.css')`. Any change here propagates everywhere automatically.

### Colours
| Variable | Value | Use |
|---|---|---|
| `--background-color` | `#003a53` | Dark teal — nav, page header, footer |
| `--text-color` | `#fcf4da` | Cream — content section background, body text |
| `--accent-color` | `#cd181b` | Red — hover states, links in content |
| `--link-color` | `#d4b92b` | Gold — links on dark backgrounds |
| `--hover-color` | `#2790af` | Bright teal — hover backgrounds |

### Fonts
- **Bebas Neue** — logo, nav links, display headings
- **Lora** — body text, headings

### Page layout pattern
Every inner page follows the same structure:
1. Blue nav bar (`.site-nav`) — logo left, links right
2. Blue page header (`.page-header`) — giant `clamp(64px, 12vw, 140px)` h1
3. Cream content section (`.content-section`) — body text on cream background
4. Blue footer (`.footer`) — centred fineprint

---

## Pages

### Homepage (`index.html`)
- Full-viewport hero with randomly chosen portrait photo (two options, picked at runtime)
- Bebas Neue JRBNZ logo overlaid on hero
- Big link section — Now, Blog, Photos, Theatre, Contact, Work, The Theatre List
- Two-column about section (callout left, bio right)
- Own inline footer (doesn't use the shared partial)

### Now (`/now/`)
Standard inner page. Bullet list of current activities. Footnote crediting Derek Sivers.

### Photos (`/photos/`)
- Category landing — 2-column card grid, hero image + label overlay per category
- Category view — hero image + description panel, then masonry gallery (3-col → 2-col → 1-col)
- 16 photos per page with prev/next pagination
- GLightbox for full-screen viewing, custom coloured to match the site
- All data loaded from `photos.json` on R2 — no server needed

---

## Blog (Bear Blog)

The blog lives at `blog.jrbnz.com` on Bear Blog's paid plan. Rather than use Bear Blog's default styling, we override it entirely using Bear Blog's custom CSS and header/footer directive fields.

### How the styling works
The Bear Blog custom CSS starts with:
```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Lora:wght@400;600;700&display=swap');
@import url('https://jrbnz.com/styles/main.css');
```

This means all colours, nav styles, page-header, and footer styles flow in from `main.css` automatically. The Bear Blog CSS only defines things that are genuinely Bear Blog-specific — the post list layout, upvote button, code blocks, tags, and overrides for Bear Blog's own body width and chrome.

### What goes in each Bear Blog admin field
- **Custom CSS** → contents of `blog/custom.css`
- **Header directive** → contents of `blog/header.html` (fonts + nav + page header)
- **Footer directive** → contents of `blog/footer.html` (prev/next nav + footer)

### Routing
Bear Blog's blog path is set to `posts`, so the listing page is at `blog.jrbnz.com/posts/`. A Cloudflare Pages `_redirects` rule sends `jrbnz.com/posts` there transparently. All nav links across the site use `jrbnz.com/posts/` as the canonical URL.

### DNS
```
CNAME  blog  →  domain-proxy.bearblog.dev  (Cloudflare proxy OFF)
```

---

## Photo Upload App

Separate Electron app at `~/Projects/photo-uploader/`.

- `npm start` — run in development
- `npm run build` — package as `.app`
- Credentials in `.env` in the photo-uploader folder
- Two tabs: **Upload** (drag-drop, set hero image, edit category description) and **Manage** (grid view, delete photos)
- Uploads to R2 bucket `photo-gallery`, updates `photos.json` automatically

---

## Issues We Solved

**Bear Blog nav disappearing**
Our CSS was hiding `nav` globally, which killed our own injected `.site-nav` along with Bear Blog's. Fixed by targeting `body > nav:not(.site-nav)` — then later discovered Bear Blog's nav is actually inside `<header>`, not a direct body child, so the rule wasn't needed at all.

**"Powered by Bear" showing despite hiding `body > footer`**
Bear Blog's `<footer>` contains our injected content inside `<span id="footer-directive">`. Hiding the whole `<footer>` hid our content too. Fixed with `body > footer > span:not(#footer-directive) { display: none }`.

**Header/footer inject location**
Bear Blog's "header directive" field injects into `<head>`, not `<body>`. Browsers auto-rescue misplaced body elements (nav, div) from `<head>` so our nav and page-header end up in the right place anyway — but it's worth knowing this is what's happening.

**Prev/next nav showing on blog index with unrendered shortcodes**
`{{ previous_post }}` and `{{ next_post }}` only render on individual post pages, not the index. On the index they appear as literal text. Fixed by hiding `.post-nav` on `body.home` and `body.blog` via CSS.

**`_redirects` splat stripping the `/posts/` prefix**
Original rule `/posts/* → https://blog.jrbnz.com/:splat` was sending `/posts/` to `blog.jrbnz.com/` (empty splat). Fixed to `/posts/* → https://blog.jrbnz.com/posts/:splat`.

**CSS redundancy in Bear Blog stylesheet**
Early versions of the Bear Blog CSS redefined colours, fonts, nav styles and more that were already coming from `main.css` via `@import`. Audited and stripped down to ~100 lines of genuine additions only.

**Nav links in Lora serif**
`.site-nav .nav-links a` was originally set to Lora serif at 19px with no hover state. Updated in `main.css` to Bebas Neue, 20px, with a white underline on hover — applies globally to the whole site including the blog via `@import`.

**h2 → paragraph spacing**
The global CSS reset (`* { margin: 0 }`) zeroed all heading margins. Inside the cream content area, headings ran straight into following paragraphs. Fixed with `main h2, main h3... { margin-top: 1.5rem; margin-bottom: 0.6rem }`.

**Images flush left with no breathing room**
After removing auto-centering from images, they sat hard against surrounding text with no vertical margin. Fixed with `img { margin: 1.5rem 0 }` and padding on `.rightalign` / `.leftalign` helper classes.

---

## What's Still To Do

- Theatre page (currently `href="#"` placeholder)
- Mobile nav hamburger menu (currently links just stack)
- Consider adding an RSS feed link somewhere visible
