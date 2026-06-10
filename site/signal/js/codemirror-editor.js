/*
 * Signal Admin — CodeMirror 6 edit surface
 *
 * Wraps CM6 (vendored, no CDN) as the main edit-pane editor:
 *   - Markdown syntax highlighting in Signal's cream palette
 *   - Inline image thumbnails rendered where <!-- signal:image --> comments sit
 *   - A textarea-compatible facade so the existing format helpers
 *     (_wrapSelection / _prefixLine / _insertAtCursor / openImageSheet /
 *     insertYouTubeBlock) keep working unchanged.
 */

import {
  EditorView, keymap, drawSelection, Decoration, WidgetType, ViewPlugin,
  EditorState, RangeSetBuilder,
  syntaxHighlighting, HighlightStyle,
  defaultKeymap, history, historyKeymap,
  markdown, markdownLanguage,
  tags as t,
} from './vendor/cm6.bundle.js';

// ── Markdown highlight style (Signal cream palette) ──
const highlight = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.35em', color: 'var(--color-cream-text-primary)' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.2em',  color: 'var(--color-cream-text-primary)' },
  { tag: t.heading3, fontWeight: '700', fontSize: '1.08em', color: 'var(--color-cream-text-primary)' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '700', color: 'var(--color-cream-text-primary)' },
  { tag: t.strong,    fontWeight: '700', color: 'var(--color-cream-text-primary)' },
  { tag: t.emphasis,  fontStyle: 'italic' },
  { tag: t.link,      color: 'var(--color-accent)' },
  { tag: t.url,       color: 'var(--color-accent)', textDecoration: 'underline' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.92em', color: 'var(--color-cream-text-secondary)' },
  { tag: t.quote,     color: 'var(--color-cream-text-secondary)', fontStyle: 'italic' },
  { tag: t.list,      color: 'var(--color-accent)' },
  { tag: [t.comment, t.meta], color: 'var(--color-cream-text-ghost)' },
]);

// ── Editor chrome theme ──
const theme = EditorView.theme({
  '&': {
    color: 'var(--color-cream-text-primary)',
    backgroundColor: 'transparent',
    fontSize: 'var(--text-lg)',
  },
  '&.cm-editor': { outline: 'none' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'var(--font-serif)',
    lineHeight: 'var(--leading-prose)',
    padding: '0',
    caretColor: 'var(--color-accent)',
  },
  // Keep CM's own scroller semantics — overriding overflow to `visible` breaks
  // its viewport + click-coordinate math (mis-scroll, cursor lands wrong). With
  // no height set, the editor grows to content and the outer pane scrolls.
  '.cm-scroller': { fontFamily: 'var(--font-serif)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--color-accent) 30%, transparent)',
  },
  '.cm-line': { padding: '0' },
}, { dark: true });

// ── Inline image widget ──
class ImageWidget extends WidgetType {
  constructor(src, alt) { super(); this.src = src; this.alt = alt; }
  eq(o) { return o.src === this.src && o.alt === this.alt; }
  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-image-widget';
    wrap.contentEditable = 'false';
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt || '';
    img.className = 'cm-image-thumb';
    img.loading = 'lazy';
    wrap.appendChild(img);
    if (this.alt) {
      const cap = document.createElement('div');
      cap.className = 'cm-image-widget-alt';
      cap.textContent = this.alt;
      wrap.appendChild(cap);
    }
    return wrap;
  }
  ignoreEvent() { return true; }
}

const IMG_RE = /<!--\s*signal:image\s+([^>]*?)-->/g;
const attr = (s, n) => (s.match(new RegExp(n + '="([^"]*)"')) || [, ''])[1];

function buildImageDecos(view) {
  const b = new RangeSetBuilder();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m; IMG_RE.lastIndex = 0;
    while ((m = IMG_RE.exec(text))) {
      const s = from + m.index;
      const e = s + m[0].length;
      const src = attr(m[1], 'src');
      if (!src) continue;
      const alt = attr(m[1], 'alt');
      b.add(s, e, Decoration.mark({ class: 'cm-image-comment' }));
      const line = view.state.doc.lineAt(e);
      // Inline (not block) widget: CM6 forbids block decorations from a
      // ViewPlugin ("Block decorations may not be specified via plugins"),
      // which threw on every post containing an image. The widget's own DOM is
      // display:block so it still renders as a thumbnail on its own line.
      b.add(line.to, line.to, Decoration.widget({
        widget: new ImageWidget(src, alt), side: 1,
      }));
    }
  }
  return b.finish();
}

const imagePlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildImageDecos(view); }
  update(u) { if (u.docChanged || u.viewportChanged) this.decorations = buildImageDecos(u.view); }
}, { decorations: v => v.decorations });

// ── Mount ──
export function mountCM(parent, doc, { onChange, onKeydown, onPaste } = {}) {
  let programmatic = false;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: doc || '',
      extensions: [
        history(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(highlight),
        EditorView.lineWrapping,
        imagePlugin,
        theme,
        EditorView.updateListener.of(u => {
          if (u.docChanged && !programmatic && onChange) onChange();
        }),
        EditorView.domEventHandlers({
          keydown: (e) => { onKeydown && onKeydown(e); return false; },
          paste:   (e) => { onPaste && onPaste(e); return false; },
        }),
      ],
    }),
  });

  // textarea-compatible facade — read/write value + selection, focus, no-op events
  const facade = {
    get value() { return view.state.doc.toString(); },
    set value(v) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    },
    get selectionStart() { return view.state.selection.main.from; },
    set selectionStart(n) {
      view.dispatch({ selection: { anchor: n, head: Math.max(n, view.state.selection.main.to) } });
    },
    get selectionEnd() { return view.state.selection.main.to; },
    set selectionEnd(n) {
      view.dispatch({ selection: { anchor: Math.min(n, view.state.selection.main.from), head: n } });
    },
    setSelectionRange(a, b) { view.dispatch({ selection: { anchor: a, head: b } }); },
    focus() { view.focus(); },
    dispatchEvent() { /* CM's updateListener already fires onChange on doc changes */ },
    addEventListener() {},
    removeEventListener() {},
  };

  // Load content without firing onChange (used on post open + split-view sync)
  function setValue(v) {
    programmatic = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v || '' } });
    programmatic = false;
  }

  function refresh() { view.requestMeasure(); }

  return { view, facade, setValue, refresh };
}
