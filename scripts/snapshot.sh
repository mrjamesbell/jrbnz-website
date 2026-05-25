#!/usr/bin/env bash
# Usage: ./scripts/snapshot.sh [theme]
# Snapshots key pages from jrbnz.com into ~/www/jrbnz for local theme dev.
# CSS references in fetched HTML are patched to match the local project files.
# Images are rewritten to load from the live site.
set -euo pipefail

THEME=${1:-wow-signal}
DEST="$HOME/www/jrbnz"
LIVE="https://jrbnz.com"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

THEME_CSS="$PROJECT/site/styles/themes/$THEME.css"
if [[ ! -f "$THEME_CSS" ]]; then
  echo "Unknown theme '$THEME'. Available themes:"
  ls "$PROJECT/site/styles/themes/" | grep -v base | sed 's/\.css//'
  exit 1
fi

echo "Fetching recent post slugs..."
mapfile -t RECENT_POSTS < <(curl -sf "$LIVE/posts/" | grep -oP '(?<=href=")/posts/[^"]+/' | head -5)

PAGES=(
  "/"
  "/about/"
  "/now/"
  "/theatre/"
  "/posts/"
  "${RECENT_POSTS[@]}"
  "/notes/"
)

rm -rf "$DEST/styles"
mkdir -p "$DEST/styles/themes" "$DEST/scripts"

fetch_page() {
  local path=$1
  local dir="$DEST$path"
  mkdir -p "$dir"
  printf "  Fetching %s\n" "$path"
  curl -sf "$LIVE$path" \
    | sed "s|src=\"/img/|src=\"$LIVE/img/|g" \
    | sed "s|srcset=\"/img/|srcset=\"$LIVE/img/|g" \
    | sed "s| /img/| $LIVE/img/|g" \
    | sed 's|href="/styles/main.css"|href="/styles/site.css"|' \
    | sed '/href="\/styles\/blog\.css"/d' \
    | sed "s|href=\"/styles/themes/[^\"]*\.css\"|href=\"/styles/themes/$THEME.css\"|" \
    > "$dir/index.html"
}

echo "Fetching pages..."
for page in "${PAGES[@]}"; do
  fetch_page "$page"
done

echo "Copying styles (theme: $THEME)..."
install -m 644 "$PROJECT/site/styles/site.css"   "$DEST/styles/"
install -m 644 "$THEME_CSS"                      "$DEST/styles/themes/"

echo "Copying scripts..."
install -m 644 "$PROJECT/site/scripts/blog.js" "$DEST/scripts/"

echo "Done. Local snapshot at $DEST"
