# CUE image prompts — main menu card props, v2 (owner 11-20)

v1 asked for "a real product photograph" — wrong for our UI (the 다이아·코인 pictures show the same problem: flat, real
textures, no volume). What worked is the 선수증's tier ball: **a clean 3D render** — one chunky simple form, smooth
material, big soft studio reflections, no fine texture, light from the upper right. v2 asks for exactly that, and uses the
tier ball itself as the style reference.

## 사용법 (소유자)

1. ChatGPT 새 채팅에 `style-ref-tier-ball-gold.png`(같이 보낸 파일)를 붙이고, 아래 **STYLE** 블록 + **menu-rank** 블록을 그대로 붙여 넣는다.
2. 마음에 들 때까지 **한 번에 한 가지만** 고쳐 달라고 한다(예: "더 단순하게, 표면 결 없이", "더 통통하게"). 여러 개를 한꺼번에 바꾸면 무엇이 효과였는지 모른다.
3. 하나가 맞으면 **같은 채팅에서** 그 그림을 다시 붙이고 다음 블록을 넣는다: "Image 1 is the approved style. Same render style, light, angle and size. Do not change the style." (STYLE 블록은 매번 같이 넣는다.)
4. 받은 PNG가 **진짜 투명**인지 본다 — 회색·흰 체크무늬가 그림에 그려져 있으면 투명이 아니다. 그러면 "transparent background, real alpha, no drawn checkerboard"로 다시.
5. 7장을 나란히 놓고 크기·빛·각도가 같은지, 작게(64px) 줄여도 무엇인지 보이는지 본다.

너무 현실적으로 나오면: "less realistic — simpler shapes, smooth surfaces, no texture, no wear, like a polished game icon render".
너무 귀엽게 나오면: "not cute, not cartoon, no clay look, no pastel — premium, grown-up".

---

## STYLE (paste with every prompt)

```
Use: a large icon in the middle of a main-menu card of a premium billiards mobile game (the card is a printed colour card; the icon sits on it).
Medium: stylized 3D game UI icon, a clean CG render — NOT a photograph, NOT a product photo, NOT a drawing.
Style reference: Image 1 (the metallic 8 ball) — match its render: simple chunky volume, smooth flawless surfaces, polished metal and glossy enamel with large soft studio-softbox reflections, rich but natural colour, crisp edges.
Forms: one object (or a tight group), simplified and slightly chunky — fewer, bigger parts; bevelled edges; no fine texture, no grain, no scratches, no wear, no small details.
Mood: premium and grown-up (players of every age, many over 40). Not cute, not cartoon, no faces, no clay, no pastel, no glitter, no sparkles.
Camera: three-quarter view from the front, a little from above (about 20°).
Light: one large soft light from the upper right, a gentle fill from the left, a soft contact shadow under the object falling to the lower left (semi-transparent, part of the image).
Composition: 1024×1024, the object centred, filling about 75% of the width, clear empty margin all round, strong silhouette that still reads at 64 px.
Background: transparent (real alpha). No floor, no backdrop, no scene.
Never: text, letters, numbers, logos, brand marks, watermarks, frames, borders.
```

## The seven (paste one at a time, after STYLE)

**menu-rank** (card: royal blue)
```
Subject: a championship trophy cup in polished gold metal (like Image 1's gold), a wide bowl with two simple rounded handles on a short stem, standing on a thick square base of glossy black enamel. Plain — no engraving, no plate, no figures on top.
```

**menu-friend** (card: billiard green)
```
Subject: two billiard balls touching side by side as a pair — a glossy white cue ball and a glossy red ball, the red one slightly behind and to the right. Plain balls, no numbers, no stripes.
```

**menu-lesson** (card: deep red)
```
Subject: a closed thick book with a soft black leather cover and rounded corners, lying flat, turned a little; on top of it a chunky cube of blue billiard chalk with a slightly dished top. No writing on the book, no bookmark ribbon.
```

**menu-puzzle** (card: amber)
```
Subject: a billiard pocket seen as one object — a round polished chrome ring set on a black leather cup — with a glossy red ball resting on the very edge of the ring, about to drop in. Nothing else.
```

**menu-arcade** (card: purple)
```
Subject: three thick game cards fanned out and standing at an angle, their faces deep navy enamel with one simple raised geometric shape each (a circle, a triangle, a diamond), their edges glowing softly in cyan and violet — the only glowing icon in the set; a glossy black billiard ball in front of them, no number.
```

**menu-cpu** (card: slate blue)
```
Subject: a sleek robotic gripper — a polished silver metal arm end with two smooth rounded fingers and dark grey joints — holding a glossy white cue ball. Industrial and precise, not a toy, no face, no eyes, no lights.
```

**menu-free** (card: olive green)
```
Subject: a billiard triangle rack in glossy dark walnut with gold-metal corner caps, lying flat, with three glossy plain balls inside it (yellow, blue, red) and a white cue ball just outside it. No numbers on the balls.
```

---

When they are in: name them `menu-rank.png` … `menu-free.png` (or zip `CUE-batch-menu-props.zip`). Claude makes them
512 × 512 WebP `web/ui/menu-<id>.webp`; they show with 디버그 · 메인 카드 그림 · 3D 소품.
