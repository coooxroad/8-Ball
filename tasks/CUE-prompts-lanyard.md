# CUE image prompts — the player card's lanyard (owner 11-21)

The player card (선수증) is getting an ID-badge look: our card as it is, inside a clear acrylic holder (drawn by the game in
CSS — no picture needed), hanging from a lanyard. These prompts are for **the lanyard only**. Send back
`lanyard-strap-<colour>.png` and `lanyard-clip.png` (or one zip `CUE-batch-lanyard.zip`); Claude makes WebP in `web/ui/`.

How they are used: the clip is fixed to the slot at the top of the holder; the strap rises from the clip straight up and out
of the top of the screen (on the menu, into the bar at the top; on the match's opening, past the top edge). The strap's
length changes with the screen, so it is **one short piece repeated upward** (a tile), and the clip is a separate picture
whose top joins the strap.

## COMMON RULES (all images)

- Real product photo look, as sold today: a woven polyester lanyard about 2 cm wide, slightly used (a few soft creases, the
  weave visible). Not "AI art": no gloss, no perfect symmetry, no ornaments, no gold, no antique look.
- Seen from the front, the camera very slightly above (about 15°), the same as the rest of the desk set.
- **Light from the upper right**: the right edge of the strap and the metal catch a little more light; a soft shadow would
  fall down-left (but do not draw the shadow — the game adds it).
- **Transparent background** (PNG with alpha). Nothing else in the picture: no card, no holder, no hand, no table.
- **No text, no logo, no pattern of words** on the strap.

## L1. lanyard-strap-navy — the strap, a tile that repeats upward

Paste to GPT:

> A product photo of a short straight section of a woven polyester lanyard strap, hanging perfectly vertical, seen from the
> front with the camera very slightly above. The strap is 2 cm wide, deep navy blue (#1f3a8a-ish), a fine visible ribbed
> weave running across it, a little real-world softness (one or two very faint creases), soft light from the upper right so
> the right edge is slightly brighter. Transparent background, nothing else in the image, no text, no logo, no shadow.
> Size 256 × 1024 pixels, the strap centred and filling the middle 120 pixels of the width (x = 68 to 188), running the full
> height from top edge to bottom edge. **Seamless vertically**: the top edge must continue exactly into the bottom edge when
> stacked (no fold, no end, no darker band at either edge).

Check before sending: two copies stacked show one continuous strap with no visible join; the strap is exactly vertical and
centred.

## L2. lanyard-strap-white — the same strap in off-white (the game tints it)

Same prompt as L1, but: **"off-white / very light grey (#e9e7e2-ish)"** in place of navy. (With a light strap the game can
colour it to match the card's face or the tier.) Same size, same position, seamless the same way.

## L3. lanyard-clip — the metal clip at the strap's end

Paste to GPT:

> A product photo of the metal end of an ID-badge lanyard, seen from the front with the camera very slightly above: at the
> top, the end of a 2 cm wide woven strap folded over and stitched into a small loop, through a brushed-steel swivel ring,
> below it a steel swivel and a **flat bulldog clip** (the kind that clips through the slot of a hard plastic badge holder),
> the clip's jaw pointing straight down. Brushed stainless steel, slightly used (fine scratches), soft light from the upper
> right, no harsh highlights. Transparent background, nothing else in the image, no text, no logo, no shadow.
> Size 256 × 512 pixels. The strap enters from the top edge, centred, 120 pixels wide (x = 68 to 188), straight and
> vertical for its first 60 pixels (so the strap tile joins it there). The clip is centred, and the tip of its jaw ends at
> the bottom centre, about y = 500.

Check before sending: the strap at the top edge is the same width and position as in L1 (x = 68 to 188); the clip hangs
straight; the jaw tip is at the bottom centre.

Tell Claude which strap you prefer (navy as it is, or white tinted by the game).
