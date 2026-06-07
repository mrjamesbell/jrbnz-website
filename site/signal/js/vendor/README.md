# Vendored bundles

## cm6.bundle.js — CodeMirror 6

Self-contained ESM bundle (no CDN) consumed by `../codemirror-editor.js`.

To regenerate (e.g. to update CodeMirror):

```sh
mkdir -p /tmp/cm6build && cd /tmp/cm6build
npm init -y && npm pkg set type=module
npm install codemirror@^6 @codemirror/state@^6 @codemirror/view@^6 \
  @codemirror/language@^6 @codemirror/commands@^6 @codemirror/lang-markdown@^6 \
  @lezer/highlight@^1 esbuild

cat > entry.js <<'EOF'
export { EditorView, keymap, drawSelection, highlightActiveLine, lineNumbers,
         Decoration, WidgetType, ViewPlugin, MatchDecorator } from '@codemirror/view';
export { EditorState, RangeSetBuilder, Compartment } from '@codemirror/state';
export { syntaxHighlighting, HighlightStyle, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
export { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
export { markdown, markdownLanguage } from '@codemirror/lang-markdown';
export { tags } from '@lezer/highlight';
EOF

./node_modules/.bin/esbuild entry.js --bundle --format=esm --minify \
  --outfile=<repo>/site/signal/js/vendor/cm6.bundle.js
```

Do not edit `cm6.bundle.js` by hand.
