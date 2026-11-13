#!/bin/sh
# Builds the game page from the sources:
#   app/src/main/assets/index.html    - full offline page bundled into the Android app
set -e
cd "$(dirname "$0")"
A=../app/src/main/assets
mkdir -p "$A/fonts"
# Every source file is a plain script that defines one factory (or data); the lines that export them to node tests are dropped.
# content/ is the data of what can be owned (cues, balls, tables, trails, gloves), one file a kind, in file-name order.
# Two parts are folders of small files that share one scope, in file-name order:
#   ai/    the body of createAI(g) - the computer player
#   scene/ the body of createScene(canvas, app, PH) - the 3D table, balls, cue and guide
#   reel/  the body of createReel(d) - the reel's machinery, then one file per edit, then playing one
#   app/   the app itself - what it shares first (00-state.js), then one file per screen or concern
# The game itself - the DOM-free part: what can be owned, tables, money, physics, rules, lessons, puzzles, highlights, the
# computer player - is a script of its own (id "core"), so the page can start the computer player in a Worker from it
# (ai-worker.js; app/40-shot.js aiAsk). Its top-level names are seen by the script after it, as before.
core() {
  cat content/*.js tables.js economy.js physics.js game.js drills.js puzzles.js highlights.js | grep -v '^if (typeof module'
  echo 'function createAI(g) {'; cat ai/*.js; echo '}'
  grep -v '^if (typeof module' ai-worker.js
}
script() {
  echo '<script id="core">'; core; echo '</script>'
  echo '<script>'
  # what the 3D's pictures of things depend on (the card pictures kept on the device are taken again when it changes)
  echo "const BUILD_ID = '$(cat content/*.js scene/*.js tex/*.webp three.min.js | sha1sum | cut -c1-12)';"
  # the table's material pictures (tex/), carried as data so WebGL may read them from a page opened as a file
  echo 'const TEXTURES = {'; for f in tex/*.webp; do printf "'%s': 'data:image/webp;base64,%s',\n" "$(basename "$f" .webp)" "$(base64 -w0 "$f")"; done; echo '};'
  # sounds an item names for itself (content/: sound.file), carried as data the same way
  echo 'const SOUNDS = {'; for f in sound/*.mp3 sound/*.ogg sound/*.wav; do [ -e "$f" ] || continue; printf "'%s': 'data:audio/%s;base64,%s',\n" "$(basename "${f%.*}")" "${f##*.}" "$(base64 -w0 "$f")"; done; echo '};'
  echo 'function createScene(canvas, app, PH) {'; cat scene/*.js; echo '}'
  cat sounds.js audio.js | grep -v '^if (typeof module'
  echo 'function createReel(d) {'; cat reel/*.js; echo '}'
  echo "(() => {"; echo "'use strict';"; cat app/*.js; echo '})();'
  echo '</script>'
}

{
  cat <<'HTML'
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#14110f">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<style>
html{box-sizing:border-box;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
body{margin:0}
[hidden]{display:none!important}
@font-face{font-family:'Gothic A1';font-weight:300;font-display:swap;src:url(fonts/GothicA1-Light.woff2) format('woff2')}
@font-face{font-family:'Gothic A1';font-weight:500;font-display:swap;src:url(fonts/GothicA1-Medium.woff2) format('woff2')}
@font-face{font-family:'Gothic A1';font-weight:700;font-display:swap;src:url(fonts/GothicA1-Bold.woff2) format('woff2')}
@font-face{font-family:'Gothic A1';font-weight:800;font-display:swap;src:url(fonts/GothicA1-ExtraBold.woff2) format('woff2')}
</style>
</head>
<body>
HTML
  # the markup (index.html), with the styles (style/*.css, in file-name order) where it marks them
  while IFS= read -r line; do
    case "$line" in '<!--STYLE'*) echo '<style>'; cat style/*.css; echo '</style>';; *) printf '%s\n' "$line";; esac
  done < index.html | sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#three.min.js#' -e '/fonts.googleapis.com/d'

  script
  echo '</body></html>'
} > "$A/index.html"
cp three.min.js "$A/three.min.js"
rm -f "$A"/fonts/*
cp fonts/*.woff2 "$A/fonts/"
# the desk's materials and controls (images made to order, see ui/README.md)
rm -rf "$A/ui"; mkdir -p "$A/ui"; cp ui/*.webp "$A/ui/"
# (the emoji of the quick emotes: Microsoft Fluent Emoji, MIT - its license goes with them)
mkdir -p "$A/ui/emoji"; cp ui/emoji/*.webp ui/emoji/LICENSE-fluentui-emoji.txt "$A/ui/emoji/"
# the one texture the page's CSS uses as a file (the play room's carpet); the rest live only inside the page as TEXTURES
# (the balls' pictures were copied here too, for shelf cards that now photograph the balls instead: scene.ballPortrait)
rm -rf "$A/tex"; mkdir -p "$A/tex"; cp tex/carpet-geo.webp "$A/tex/"
# the music (lobby, win, lose; see music/README.md)
rm -rf "$A/music"; mkdir -p "$A/music"; cp music/*.mp3 "$A/music/"
# the web version installed as an app (site/): its name, icon and full-screen display
cp manifest.webmanifest icon-192.png icon-512.png "$A/"
# the privacy policy and the terms (Google sign-in and a store listing want them on the site: /privacy, /terms)
cp legal/privacy.html legal/terms.html "$A/"
# Google Search Console's proof that the site is the owner's (asked for by the Google sign-in consent screen)
cp legal/google*.html "$A/"
# the admin console (/admin; the server lets only the owner's Google account use it - server/src/index.js adminRoute)
cp admin.html "$A/"
grep -q 'src="three.min.js"' "$A/index.html" || { echo "three.js path was not rewritten" >&2; exit 1; }
wc -c "$A/index.html"
