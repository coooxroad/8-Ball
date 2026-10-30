# ui/ — the desk's materials and controls

Made to order by image generation from the owner's mockups (no text, one light from the upper left), converted here to
WebP. Copied next to index.html by build.sh and used from CSS as `url(ui/<name>.webp)`.

| file | from | use | 9-slice (image px) |
|---|---|---|---|
| desk | oak-desk-1024 | desk surface, tiled | – |
| felt | blue-felt-512 | felt in the tray and in selected buttons, tiled | – |
| bar | charcoal-bar-512x128 | top bar, repeat-x | – |
| tray | 04-blue-felt-tray-1200 | the felt tray's rim | slice 170, body from 55 |
| rail | 05-ivory-side-rail-360x1080 | the ivory rail | slice 76, body from 26 |
| slate | 06-dark-slate-panel-640x1200 | the slate board | slice 94, body from 34 |
| rb, rb-press, rb-on | 07-ivory-* | rail buttons | slice 79, body from 16 |
| main, main-press | 08-primary-* | the one big button | slice 84, body from 16 |
| sec, sec-press | 09-secondary-* | second button | slice 54, body from 14 |
| seg, seg-on | 10-segment-* | segmented control track and pill | 50 / 44, body from 10 |
| tab, tab-on | 11-tab-* | top tabs | slice 36, body from 10 |
| sq, sq-press | 12-square-* | square buttons (arrows, steppers, chips) | slice 46, body from 12 |
| dot | 13-glossy-red-dot-128 | the selected rail button's red ball | – |
| swframe | 14-cream-swatch-frame-480x260 | frame over the chosen swatch | body from 16 |
| plant | 15-plant-leaves-top-right-900 | leaves leaning in at the desk's top right (wide screens) | – |
| towel | 16-folded-navy-towel-bottom-left-800x560 | towel under the rail, bottom left (wide screens) | – |
| chalk | 17-blue-chalk-pair-360x260 | chalk at the foot of the rail (wide, tall enough) | – |
| coin | 18-brass-coin-128 | the coin (for the shop, not used yet) | – |
| ring | 19-brass-avatar-ring-160 | ring round a player's avatar; opening centre 80,80, radius 54 | – |
| plate | 20-ivory-nameplate-520x140 | the players' plates in the tray | slice 40, body from 16 |
| tag | 21-cream-equipped-tag-160x64 | the "장착" tab on what is in use | slice 24, body from 8 |
| lock | 22-closed-brass-padlock-96 | a locked puzzle stage | – |
| star, star-off | 23-puzzle-star-* | a puzzle's stars | – |
| cloth-teal … cloth-ice | 24a–f | the table cloths' swatches (ids as in look.js CLOTHS), tiled | – |
| cue-maple … cue-sport | 25a–e | the cues (ids as in look.js CUES); 2400×110, butt left, tip right, centre line y 49 | – |
