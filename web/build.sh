#!/bin/sh
# Builds the game page twice from the same sources:
#   web/dist/artifact.html            - page fragment for the claude.ai artifact (three.js and fonts from CDNs)
#   app/src/main/assets/index.html    - full offline page bundled into the Android app
set -e
cd "$(dirname "$0")"
A=../app/src/main/assets
mkdir -p dist "$A/fonts"
script() { echo '<script>'; sed '$d' physics.js; sed '$d' game.js; cat scene.js sounds.js main.js; echo '</script>'; }

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
@font-face{font-family:'Gothic A1';font-weight:300;font-display:swap;src:url(fonts/GothicA1-Light.woff2) format('woff2')}
@font-face{font-family:'Gothic A1';font-weight:500;font-display:swap;src:url(fonts/GothicA1-Medium.woff2) format('woff2')}
@font-face{font-family:'Gothic A1';font-weight:700;font-display:swap;src:url(fonts/GothicA1-Bold.woff2) format('woff2')}
@font-face{font-family:'Gothic A1';font-weight:800;font-display:swap;src:url(fonts/GothicA1-ExtraBold.woff2) format('woff2')}
@font-face{font-family:'Outfit';font-weight:100 900;font-display:swap;src:url(fonts/Outfit.woff2) format('woff2')}
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
