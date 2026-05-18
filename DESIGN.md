---
name: James Bell
description: Personal portfolio and blog — theatre, writing, photography, from Auckland, New Zealand.
colors:
  projection-black: "#090b0d"
  deep-void: "#03040a"
  warm-gold: "#b89b72"
  linen: "#f1eadf"
  linen-hover: "#e2d8c8"
  ink: "#2a2420"
  accent-fg: "#1c1c1c"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(72px, 10vw, 160px)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.065em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(40px, 7vw, 108px)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.06em"
  title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(32px, 5.5vw, 80px)"
    fontWeight: 400
    lineHeight: 0.93
    letterSpacing: "-0.05em"
  body:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(17px, 1.8vw, 20px)"
    fontWeight: 400
    lineHeight: 1.82
    letterSpacing: "normal"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.22em"
rounded:
  none: "0px"
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
  circle: "50%"
spacing:
  nav-h: "56px"
  gutter: "clamp(24px, 5vw, 60px)"
  read-col: "720px"
components:
  tag-chip:
    backgroundColor: "transparent"
    textColor: "{colors.warm-gold}"
    rounded: "{rounded.sm}"
    padding: "3px 10px"
  tag-chip-hover:
    backgroundColor: "rgba(184,155,114,0.14)"
    textColor: "{colors.warm-gold}"
    rounded: "{rounded.sm}"
    padding: "3px 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "rgba(255,255,255,0.85)"
    rounded: "{rounded.lg}"
    padding: "10px 22px"
  button-ghost-hover:
    backgroundColor: "rgba(184,155,114,0.14)"
    textColor: "rgba(255,255,255,0.85)"
    rounded: "{rounded.lg}"
    padding: "10px 22px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "rgba(255,255,255,0.52)"
    typography: "{typography.label}"
---

# Design System: James Bell

## 1. Overview

**Creative North Star: "The Southern Literary Journal"**

This is the design language of a serious publication from the bottom of the world — not a tech product, not a lifestyle blog, not an agency showcase. The canvas is deep cinematic black (`#090b0d`). Reading content surfaces on a warm linen interior (`#f1eadf`). Between them, text floats at precisely calibrated opacity: 85% for body, 52% for supporting roles, 35% for timestamps and labels. The result is a site that feels considered in the way a well-printed journal does — every weight and layer deliberate, nothing decorative.

Georgia carries the entire type burden. No display face, no grotesque pair. A single serif family at extreme scale (up to 160px on the home nameplate, line-height 0.86) and modest scale for body copy at 17–20px, line-height 1.82. The mono font appears only for UI chrome: nav links, kickers, figure captions, timestamps. The contrast between the two creates hierarchy without a third typeface.

The Warm Gold (`#b89b72`) is the single accent. It marks active states, prose links, tag chips, and hover transitions. At full opacity it is assertive; at 14% mix it serves as a hover tint. Its rarity is the point. The colour strategy is committed: Projection Black holds the surface for the vast majority of every screen. Warm Gold speaks only when something matters.

**Key Characteristics:**
- Georgia only for prose and display; mono only for UI chrome and labels
- Tight negative tracking at large scale (-0.065em at display), releasing toward 0 at body
- Surface inversion: dark canvas transitions to warm linen for extended reading (the `.surface-invert` pattern)
- Single accent, used sparingly — never decoratively
- Square or near-square corners throughout; radius only where legibility requires
- No shadows; depth through tonal layering and opacity steps

## 2. Colors: The Cinematic Palette

A palette of three anchors: a projection-booth black, a burnished gold, and a warm linen interior.

### Primary
- **Warm Gold** (`#b89b72`): The single accent. Applied to prose links, active nav states, tag chips, kicker labels in featured cards, hover transition fills, and the timeline marker border. Used at full opacity for interactive elements; at 14% mix (`rgba(184,155,114,0.14)`) for hover surface tints.

### Neutral — Dark Canvas
- **Projection Black** (`#090b0d`): The default page background. Near-total darkness with a barely perceptible warm tint. Canvas for all pages, footer, and dark sections.
- **Deep Void** (`#03040a`): Reserved for atmospheric interlude and pull-quote sections. A half-step darker than Projection Black — distinguishes content zones without a harsh edge.
- **Surface Overlay** (`rgba(255,255,255,0.06)` over Projection Black): Card and panel backgrounds on the dark canvas. Translucent white wash; a barely-there elevation visible only in context.

### Neutral — Text Layers (dark canvas)
Text colours on the dark canvas are composited transparencies, not solid values:
- **Text Primary** (`rgba(255,255,255,0.85)`): Body copy, headings, titles on dark canvas.
- **Text Muted** (`rgba(255,255,255,0.52)`): Supporting text — deks, excerpts, author bio, footer quote.
- **Text Subtle** (`rgba(255,255,255,0.35)`): Timestamps, figure captions, empty-state notices.

### Neutral — Warm Reading Surface
- **Linen** (`#f1eadf`): The `.surface-invert` background. Applied to the reading surface within articles and the inverted home block. Warm, not clinical — closest to aged newsprint.
- **Linen Hover** (`#e2d8c8`): The Linen block's hover state, 10% darker and slightly more saturated.
- **Ink** (`#2a2420`): Primary text on the linen surface. Deep warm brown, not pure black.
- **Ink Muted** (`rgba(0,0,0,0.55)`): Supporting text on the linen surface.
- **Accent FG** (`#1c1c1c`): Text colour when placed directly on the Warm Gold accent.

### Borders (dark canvas)
- **Border Faint** (`rgba(255,255,255,0.12)`): Default dividers — section boundaries, note entries, recent list rows, author box.
- **Border Strong** (`rgba(255,255,255,0.25)`): Post navigation boxes, YouTube embeds, stronger structural divisions.

### Named Rules
**The One Voice Rule.** Warm Gold is the only accent in the palette. If you find yourself reaching for a second colour to indicate warning, emphasis, or category, solve it with scale, weight, or opacity instead.

**The Opacity Hierarchy Rule.** Text on the dark canvas is never a solid light colour. It is always a transparency over Projection Black: 85% for primary, 52% for muted, 35% for subtle. This trio is the depth system.

## 3. Typography

**Display / Body Font:** Georgia, 'Times New Roman', serif  
**Label / UI Chrome Font:** ui-monospace, SFMono-Regular, Menlo, Consolas, monospace

**Character:** A single-family editorial. Georgia runs from nameplate scale to body copy without apology. The mono face is its functional opposite — system-weight, small, spaced wide — appearing only where information, not language, is being communicated.

### Hierarchy
- **Display** (400, `clamp(72px, 10vw, 160px)`, line-height 0.86, tracking -0.065em): Homepage nameplate only. Letters collide by design; tight leading compresses the name into a single visual block.
- **Headline** (400, `clamp(40px, 7vw, 108px)`, line-height 0.92, tracking -0.06em): Full-viewport post hero titles. Monumental, not comfortable.
- **Title** (400, `clamp(32px, 5.5vw, 80px)`, line-height 0.93, tracking -0.05em): Featured essay titles, compact hero headings. One step below Headline; still editorial.
- **Body** (400, `clamp(17px, 1.8vw, 20px)`, line-height 1.82): All prose. The generous line-height is designed for reading, not scanning. Never below 17px — the site author prefers scale; err large.
- **Label** (400, 10–13px, letter-spacing 0.14–0.32em, uppercase, mono): Nav links, kickers, timestamps, figure captions, essay card metadata. Never for prose.

### Section-specific scales
- **Dark Quote / Interlude:** `clamp(28px, 4.5vw, 66px)`, line-height 1.08–1.1, tracking -0.04em. Pull-quote moments that punctuate the dark canvas.
- **Feature Card / Block Title:** `clamp(22px, 3.2vw, 44px)` to `clamp(24px, 3vw, 38px)`, line-height 1.02–1.08, tracking -0.04em.
- **Recent List / Footer Quote:** `clamp(18px, 2.2vw, 28px)` and `clamp(18px, 2.5vw, 26px)`.

### Named Rules
**The Georgia-Only Rule.** Georgia is the only prose typeface. Never introduce a sans-serif for display, headings, or pull quotes. Mono exists for UI chrome — it is an information choice, not a design flourish.

**The Scale-Down-Never Rule.** Body copy minimum is 17px. Do not go smaller for captions, footnotes, or secondary content. Demote those to the label scale in monospace instead.

**The Tight-at-Large Rule.** Tracking tightens as size increases. Never apply positive tracking to a serif at display or headline scale.

## 4. Elevation

This system is flat by default. Depth is conveyed through background lightness steps and opacity compositing, not shadows.

The tonal ramp, darkest to lightest:
1. **Deep Void** (`#03040a`) — atmospheric interlude backgrounds
2. **Projection Black** (`#090b0d`) — default page canvas, footer
3. **Essay Strip** (`#08090a`) — between-section breaks
4. **Surface Overlay** (`rgba(255,255,255,0.06)`) — card and panel backgrounds on the dark canvas

Two permitted exceptions where blur-based depth appears, both functional:
- **Fixed Nav:** `backdrop-filter: blur(12px)` over `rgba(9,11,13,0.88)`. The frosted glass separates the nav from scrolled content below. Functional, not decorative.
- **Inline Feature Card:** `backdrop-filter: blur(16px)` over `rgba(8,9,10,0.78)`. Separates text from hero image detail without obscuring it.

### Named Rules
**The Flat-By-Default Rule.** No `box-shadow` on any component at rest. Depth comes from the tonal stack. If you're reaching for a shadow, adjust the background lightness step instead.

**The Blur-is-Functional Rule.** `backdrop-filter` is permitted only where it solves a legibility problem caused by a live background. Decorative frosted panels are prohibited.

## 5. Components

Components exist to frame text. Shape is always secondary; the words lead. Square corners are the default; radius appears only where legibility or interaction convention requires it.

### Navigation
Fixed to the top. Frosted glass (`rgba(9,11,13,0.88)`, `blur(12px)`), height 56px.
- **Logo:** Mono, 13px, letter-spacing 0.32em. No underline, no hover state beyond colour shift to Text Primary.
- **Links:** Mono, 12px, letter-spacing 0.14em, uppercase. Default at Text Muted (52%). Hover and active at Text Primary (85%). No underlines.
- **Breakpoints:** Gap closes from 32px to 20px at 960px; 16px at 560px.

### Tag Chips
The minimal taxonomy element. The one place Warm Gold appears as chromatic surface.
- **Default:** Transparent fill, Warm Gold text, 1px border at 32% Warm Gold, 3px radius, 3–10px padding. Mono, 14–15px, tracking 0.05–0.06em.
- **Hover:** Background fills to 14% Warm Gold; border strengthens to 40–55% opacity.

### Essay Cards
Image-first. No card container — no background, no border, no shadow.
- **Image:** 16:9, `brightness(0.9)` at rest, lifts to `brightness(1)` on hover. `transition: filter 0.3s`.
- **Title:** Georgia, 17px, weight 400, line-height 1.3, tracking -0.02em. Transitions to Warm Gold on hover.
- **Meta:** Mono, 10px, tracking 0.12em, uppercase, Text Muted.

### Feature Card (Hero Overlay)
Positioned absolute inside a full-bleed image section.
- **Background:** `rgba(8,9,10,0.78)`, `backdrop-filter: blur(16px)`.
- **Border:** 1px Border Faint. Radius: 0.
- **Padding:** 24px 24px 20px.
- **Kicker:** Mono, 11px, Warm Gold, 0.22em tracking.
- **Title:** Georgia, `clamp(22px, 3.2vw, 44px)`, weight 400, line-height 1.02, tracking -0.04em.

### Post Navigation (Prev / Next)
- **Shape:** 1px Border Faint, 4–6px radius, 16–20px padding.
- **Hover:** Border shifts to 40% Warm Gold; fill to 14% Warm Gold muted.
- **Direction label:** Mono 12px, Warm Gold.
- **Title:** Georgia, 15px, Text Muted; transitions to Warm Gold on hover.

### Author Box
Inline below article content. Structural, not decorative.
- **Container:** Full border, 1px Border Faint, 0 radius. Padding 28px 32px.
- **Avatar:** 88px, circular (`border-radius: 50%`). No filter.
- **Name:** Georgia, 14px, weight 700.
- **Bio:** Georgia, 13px, line-height 1.6, Text Muted.

### Timeline
Signature component for chronological content.
- **Spine:** 1px vertical rule at Border Faint, 60px from left edge.
- **Year:** Georgia, 18px, tracking -0.03em, Text Primary.
- **Marker:** 10px circle, 2px solid Warm Gold border, Projection Black fill. The one place Warm Gold appears as a structural border.
- **Copy:** Georgia 16px (title) + Mono 12px uppercase (label). Both typefaces together at small scale.

### Blockquote
- **Background:** Surface Overlay (`rgba(255,255,255,0.06)`).
- **Opening mark:** `\201C` at 3em in Georgia, Warm Gold, displayed as block element.

## 6. Do's and Don'ts

### Do:
- **Do** use Georgia for all headings, titles, display text, and prose. If it's words, it's Georgia.
- **Do** tighten letter-spacing as text size increases: -0.065em at display, releasing toward 0 at body.
- **Do** use the `.surface-invert` pattern for extended reading sections — dark canvas to linen interior is the system's signature structural move.
- **Do** run body text at a minimum of 17px (`clamp(17px, 1.8vw, 20px)`). Bigger is more considered, not less. The site's author is visually impaired and prefers scale.
- **Do** keep Warm Gold appearing on ≤10% of any given screen surface. Rarity is what gives it authority.
- **Do** respect `prefers-reduced-motion` on all transitions. The system's default transitions are 0.15–0.3s; disable them under the media query.
- **Do** treat image brightness as a palette decision: `brightness(0.72–0.92)` on the dark canvas. Full-brightness photography fights the palette.
- **Do** use monospace only for UI chrome — nav, kickers, timestamps, captions, metadata. Never as a prose substitute.

### Don't:
- **Don't** introduce a second typeface family. Georgia and the system mono are the complete set.
- **Don't** add a second accent colour. Solve emphasis problems with scale, weight, or opacity.
- **Don't** build generic dev portfolio patterns — GitHub-green tints, dark card grids with icon + heading + text, hero metric blocks, "My Skills" sections. The audience has a practiced aesthetic eye and will notice immediately.
- **Don't** soften toward lifestyle blogger warmth: pastel tints, rounded card grids, Instagram-adjacent curation, cosy spacing rhythms.
- **Don't** introduce SaaS or startup patterns: gradient CTA buttons, feature grids, sticky floating contact buttons, conversion-funnel copy.
- **Don't** over-engineer motion: no scroll-jacking, no cursor effects, no parallax layers, no entrance choreography that overwhelms the content. Restraint is the statement.
- **Don't** use `border-left` or `border-right` greater than 1px as a coloured stripe accent on any component. Prohibited. Rewrite with full borders, background tints, or leading icons.
- **Don't** use `background-clip: text` with a gradient. Warm Gold is a solid colour. Keep it that way.
- **Don't** use `box-shadow` on components at rest. Depth is tonal, not shadowed.
- **Don't** go below 17px for any prose or readable body content. Spatial compression is not refinement.
