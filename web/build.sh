#!/bin/sh
# Builds the game page twice from the same sources:
#   web/dist/artifact.html            - page fragment for the claude.ai artifact (three.js and fonts from CDNs)
#   app/src/main/assets/index.html    - full offline page bundled into the Android app
set -e
cd "$(dirname "$0")"
A=../app/src/main/assets
mkdir -p dist "$A/fonts"
script() { echo '<script>'; sed '$d' physics.js; sed '$d' game.js; cat scene.js main.js; echo '</script>'; }

{ cat head.html; script; } > dist/artifact.html

{
  cat <<'HTML'
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
html{box-sizing:border-box;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
body{margin:0}
[hidden]{display:none!important}
@font-face{font-family:'Jua';font-display:swap;src:url(fonts/Jua-Regular.woff2) format('woff2')}
@font-face{font-family:'Black Han Sans';font-display:swap;src:url(fonts/BlackHanSans-Regular.woff2) format('woff2')}
@font-face{font-family:'Lilita One';font-display:swap;src:url(fonts/LilitaOne-Regular.woff2) format('woff2')}
</style>
</head>
<body>
HTML
  sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#three.min.js#' \
      -e '/fonts.googleapis.com/d' head.html
  script
  echo '</body></html>'
} > "$A/index.html"
cp three.min.js "$A/three.min.js"
rm -f "$A"/fonts/*
cp fonts/*.woff2 "$A/fonts/"
grep -q 'src="three.min.js"' "$A/index.html" || { echo "three.js path was not rewritten" >&2; exit 1; }
wc -c dist/artifact.html "$A/index.html"
