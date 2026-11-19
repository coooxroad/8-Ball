# CUE image prompts — hall carpets (owner 11-19)

Two floor textures for the 3D room under the table. Send them back as `carpet-carom.png` and `carpet-calm.png`
(or one zip `CUE-batch-carpet.zip`). Claude makes them 768 × 768 WebP in `web/tex/`.

How they are used: the picture is repeated across the floor, **one picture = a 2 m × 2 m patch of floor**, seen from
straight above, and the game lights it with the table lamps (it fades to dark away from the table). So the picture itself
must be flat and evenly lit, and its edges must join seamlessly when tiled.

## COMMON RULES (both images)

- 1024 × 1024, square, opaque. **Seamless / tileable**: the left edge continues into the right edge, the top into the bottom
  (no seam, no border, no lighter or darker edge).
- Straight top-down, orthographic (like a flatbed scan of the floor): no perspective, no camera angle, no horizon.
- Evenly lit: no light spot, no vignette, no shadows, no reflections. (The game adds the light.)
- A real commercial floor, as it looks today: short loop-pile carpet tiles, a little worn and flattened where people walk.
  Not "AI art": no gloss, no ornaments, no perfect plastic look, no gold, no antique look.
- No text, no logos, no numbers, no objects, no people, no furniture on the floor.
- Muted, slightly dark tones: the floor sits behind a bright green / blue billiard cloth and must never compete with it.

## F3. carpet-carom — Korean billiard hall checks (under 3구 / 4구 tables)

Paste to GPT:

> A seamless, tileable top-down texture of commercial carpet tiles on the floor of a Korean billiard hall (danggujang),
> photographed straight from above, flat and evenly lit, 1024×1024. The floor is laid in a 4 × 4 grid of square carpet tiles
> (each tile 50 cm), in a repeating 2 × 2 checkerboard of **deep muted blue, black, black, and medium-dark grey**: in every
> 2 × 2 block the top-left tile is blue, top-right black, bottom-left black, bottom-right grey, so blue and grey sit on
> one diagonal and the two blacks on the other. Short dense loop pile with a fine visible fibre texture and tiny tonal
> flecks, each tile's pile running a slightly different direction so neighbouring tiles of the same colour differ very
> slightly in sheen. Thin, barely visible seams between tiles. A little real wear: some flattened pile and faint scuffs,
> evenly spread. Colours: blue like a navy blue faded by years (#27365a-ish), black slightly warm and not pure
> (#17181b-ish), grey a cool charcoal grey (#4a4d52-ish). No perspective, no lighting gradient, no vignette, no shadows,
> no text, no objects. Realistic photo texture, not illustration.

Check before sending: tiled 2 × 2 it shows an even checkerboard with no visible seam where the copies meet, and the blue is
calm (not bright royal blue).

## F4. carpet-calm — a floor that never takes the eye (for play)

Paste to GPT:

> A seamless, tileable top-down texture of dark commercial carpet for a billiard hall, photographed straight from above,
> flat and evenly lit, 1024×1024. Very low contrast and calm: a deep charcoal with a hint of navy (#1c1f26-ish), short dense
> loop pile with a fine, even fibre texture and tiny, soft tonal flecks of slightly lighter grey and muted blue, so it reads
> as a real carpet up close but as one quiet dark colour from a distance. No pattern, no stripes, no checks, no visible
> tile grid (or only an extremely faint seam every 50 cm). Slight, even wear. No perspective, no lighting gradient, no
> vignette, no shadows, no text, no objects. Realistic photo texture, not illustration.

Check before sending: from arm's length the picture looks like a single dark colour with texture; tiled 2 × 2 nothing
repeats in a way the eye can catch (no single fleck or blotch that shows up again and again).
