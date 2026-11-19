# Brief for the image generator — CUE main menu icons (7 images)

## What this is

CUE is a premium billiards mobile game for players of every age (many over 40). Its main menu is a row of printed colour
cards — blue, green, red, amber, purple, slate, olive — each with one big **white line icon** in the middle. Those icons
work: each one is instantly what its card is (a trophy, two people, a book, a puzzle piece, two cards, a chip, a cue and
a ball). What they lack is finish: they look like a fine app, not a game.

Your job: **make the object each line icon stands for, as a polished game icon — the same symbol and the same overall
silhouette, but a solid, filled object, bright and high quality**, so it still sits naturally on its coloured card.

**The line icon is only a symbol. Never render the line strokes themselves** (no hollow outline, no tube-shaped
lines, no shape made of a rim around an empty middle). A trophy icon becomes a solid trophy with a closed, full cup;
a book icon becomes a solid book; a puzzle icon becomes a solid jigsaw piece.

## The attached images and their roles

- **Image 1 — `ref-menu-icons.png` (shape reference).** The seven current icons on their cards, each labelled with its file
  name below it. For each icon you make, keep **its symbol and overall silhouette and proportions** — filled solid,
  both should give the same black shape. Do not swap it for a different object, do not add scenery, do not turn it
  into a realistic object, and do not copy its strokes as an outline.
- **Image 2 — `style-ref-tier-ball-gold.png` (quality reference).** A gold 8 ball from the game: match its render
  quality, its smooth flawless surfaces, its gold, and its soft large studio reflections.

## How to work

1. **One icon per reply**, in the order below, starting with `menu-rank`. Never several icons in one image, never a
   sheet or a grid.
2. Each image is a **separate PNG with a real transparent background** (real alpha). A drawn grey-and-white
   checkerboard is not transparency — never draw one.
3. After each image, stop and wait. I say "OK" or ask for one change; change only that and keep everything else.
4. From the second icon on, use the approved icons as references too: same material, light, angle, thickness, size in
   frame. Change only the symbol.
5. Name each file by its ID (`menu-rank.png` …).

## STYLE (every icon)

- **Medium:** a polished mobile game UI icon, softly three-dimensional (like a thick enamel badge or a porcelain
  token), a clean CG render. Not a photograph, not a realistic object, not flat vector, not a sticker.
- **Seen from the front**, like the line icon (at most a very slight tilt), so the symbol reads exactly as it does now.
- **Materials — the same two for the whole set:** glossy **white enamel** (warm white, like the line icons' white, made
  solid and thick with soft rounded bevels) and polished **gold** (the same gold as Image 2). Each icon below says which
  parts are which. The white takes a faint cool tint in its shadows; no other colours, except where an icon below names
  one small accent.
- **Bright and clean:** high-key, crisp, the white clearly lighter than any card colour behind it. Not dark, not
  muddy, not grey, no black parts.
- **Light:** one large soft light from the upper right, a gentle fill from the left; one bright, smooth highlight along
  the upper-right bevels; a soft semi-transparent shadow just under the icon toward the lower left (part of the image).
- **Simple:** the same few parts as the line icon, slightly chunkier. No fine texture, no scratches, no wear, no tiny
  details, no sparkles, no glow, no particles.
- **Composition:** 1024 × 1024, the icon centred, filling about 70% of the width, clear empty margin all round. Still
  reads at 64 px.
- **Never:** text, letters, numbers, logos, brand marks, watermarks, frames, background shapes.

## The seven icons, in order

1. **menu-rank** (blue card) — a solid trophy: a full, closed cup with two handles on a short stem and a small base, as
   in Image 1. All polished gold, like Image 2; the base may be white enamel.
2. **menu-friend** (green card) — two solid figures (a round head on rounded shoulders, like chess pieces), one in front
   on the left and one smaller behind on the right, as in Image 1. The front one white enamel, the back one gold.
3. **menu-lesson** (red card) — a solid closed book standing upright, as in Image 1: a thick white enamel cover with two
   short gold lines on it, a gold page block.
4. **menu-puzzle** (amber card) — one solid, thick jigsaw piece, as in Image 1 (tabs on top and right, blanks on left
   and bottom). White enamel face with a gold bevelled edge.
5. **menu-arcade** (purple card) — two solid thick cards leaning against each other, as in Image 1. White enamel cards
   with gold edges; on the front card one simple raised gold lightning bolt (the mode is a fast "blitz" mode).
6. **menu-cpu** (slate card) — a solid chip with its pins and the small square in the middle, as in Image 1: a thick
   white enamel chip, gold pins, the inner square raised gold.
7. **menu-free** (olive card) — a cue (a straight stick from the upper left) touching a ball (lower right), as in
   Image 1: a solid glossy white ball; the cue a solid rounded stick, white enamel with a gold band near the tip and a
   small blue tip.

Before finishing, check: put all seven next to Image 1 — each is the same symbol and silhouette, all seven share one
material, light and size, and each is a separate transparent PNG with no text.

<!-- For Claude, not the generator: the PNGs become 512 × 512 WebP web/ui/menu-<id>.webp, shown with
     디버그 · 메인 카드 그림 · 그림 아이콘 (app/37-desk-menu.js menuIco). -->
