# ui/ — the desk's materials and controls

Made to order by image generation from the owner's mockups, converted here to WebP. The desk pieces (A–E) are drawn
seen from a little in front (only front lips and far walls show) with one light from the upper right and no cast
shadows (CSS draws those, to the lower left). Copied next to index.html by build.sh and used from CSS as `url(ui/<name>.webp)`.

| file | from | use | 9-slice (image px: slice t r b l / transparent margin) |
|---|---|---|---|
| desk | oak-desk-1024 | desk surface, tiled | – |
| felt | blue-felt-512 | felt: the tray's floor, swatch backs; tiled | – |
| bar | charcoal-bar-512x128 | top bar, repeat-x | – |
| edge | E1-desk-edge 2048x200 | the desk's front edge and the floor below it, repeat-x along the bottom | – |
| rail | A1-rail-slab | the ivory rail slab, front lip 28 | 48 48 76 48 / 20 |
| slate | A2-slate-slab | the slate slab, front lip 28 | 48 48 76 48 / 20 |
| tray | A3-tray | the felt tray (rim, far inner wall, lip 26), drawn without its centre over the felt. The PNG arrived cut off at row 1054; its bottom was rebuilt from its top rim | 112 92 108 92 / 20 |
| slot | B1-rail-slot | a slot cut in the rail for each key | 54 48 48 48 / 16 |
| track | B2-seg-track | the well of a segmented choice or a stepper | 38 36 34 36 / 10 |
| well | B3-swatch-well | a well in the felt round each swatch (no centre: the swatch shows) | 50 48 48 48 / 16 |
| key, key-press, key-on | C1, C1-press, C2 | rail keys (lip 20 / 8 / 14; top face moves down 0 / 12 / 6) | 66 56 74 56 / 16 |
| main, main-press | C3 | the big blue button (lip 22 / 8, moves 14) | 72 60 80 60 / 16 |
| sec, sec-press | C4 | dark buttons, puzzle stages (lip 14 / 6, moves 8) | 46 38 54 38 / 14 |
| sq, sq-press | C5 | square buttons: arrows, steppers, chips, top bar (lip 12 / 5, moves 7) | 40 34 46 34 / 12 |
| seg-on | C6 | the chosen segment, a chosen stage (lip 8) | 34 32 42 32 / 10 |
| tab, tab-on | C7 | top tabs (lip 8) | 30 30 38 30 / 10 |
| plate | D1 | the players' name plates (lip 14) | 40 40 68 40 / 16 t r, 30 b |
| towel, chalk, plant | E2, E3, E4 | on the desk; scaled down and blurred a little here (out of focus) | – |
| dot | 13-glossy-red-dot-128 | the chosen rail key's red ball | – |
| swframe | 14-cream-swatch-frame-480x260 | frame over the chosen swatch | body from 16 |
| coin | 18-brass-coin-128 | the coin (for the shop, not used yet) | – |
| ring | 19-brass-avatar-ring-160 | ring round a player's avatar; opening centre 80,80, radius 54 | – |
| tag | 21-cream-equipped-tag-160x64 | the "장착" tab on what is in use | slice 24, body from 8 |
| lock | 22-closed-brass-padlock-96 | a locked puzzle stage | – |
| star, star-off | 23-puzzle-star-* | a puzzle's stars | – |
| cloth-teal … cloth-ice | 24a–f | the table cloths' swatches (ids as in look.js CLOTHS), tiled | – |
| cue-maple … cue-sport | 25a–e | the cues (ids as in look.js CUES); 2400×110, butt left, tip right, centre line y 49 | – |
