#!/usr/bin/env bash
# Usage: ./scripts/push-theme.sh [theme]
# Copies edited CSS from ~/www/jrbnz back to the project.
set -euo pipefail

THEME=${1:-wow-signal}
DEST="$HOME/www/jrbnz"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

cp "$DEST/styles/site.css"              "$PROJECT/site/styles/site.css"
cp "$DEST/styles/themes/$THEME.css"     "$PROJECT/site/styles/themes/$THEME.css"

echo "Pushed site.css, themes/$THEME.css → project"
