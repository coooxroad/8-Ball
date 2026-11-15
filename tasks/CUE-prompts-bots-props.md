# CUE image prompts — bot portraits (15) and the menu's towel and plant (owner 11-16 night)

Send back one zip, `CUE-batch-bots-props.zip`, with the files named exactly as the IDs below (PNG, transparent where said).
Claude converts them to WebP and puts them in `web/ui/` (bots: `bot-<id>.webp`; then `pic: true` on the bot's line in
`web/app/34-desk-bots.js`).

## COMMON RULES (all images)

- No text, no letters, no numbers, no logos, no watermark, no frame or border.
- Looks like a real, current thing — not "AI art": no heavy gloss, no perfect symmetry, no ornaments, no gold leaf, no antique look.
  A little wear is good.
- Light from the upper right, soft.
- Each person is fictional (not a real or famous person) and looks different from the others (age, face, hair, clothes).

## A. Bot portraits — 15 images, 512 × 512, square, opaque

Style for all 15: a painted-realistic portrait (like a good illustrated game avatar, not a photo, not a cartoon), head and
shoulders, looking at the viewer or slightly aside, plain soft background in one muted colour (given per bot), a Korean
billiards-hall regular. Keep the face large in the frame (face about 45% of the height) so it reads at 46 px.

| ID | name | who (for the picture) | background |
|---|---|---|---|
| bot-haneul | 하늘 | girl around 20, cheerful, short bob, hoodie, a cue chalk in her fingers | pale sky blue |
| bot-doyun | 도윤 | shy young man, mid 20s, glasses, plain cardigan | light grey |
| bot-miso | 미소 | woman around 30, calm smile, ponytail, simple knit | soft peach |
| bot-gangcheol | 강철 | stocky man around 40, crew cut, work jacket, confident grin | warm tan |
| bot-eunbi | 은비 | young woman mid 20s, playful, colourful hairpins, oversized shirt | lilac |
| bot-taeo | 태오 | quiet man around 35, neat hair, dark polo, careful look | slate blue |
| bot-narae | 나래 | woman around 40, gentle, long straight hair, cream blouse | sage green |
| bot-beomsu | 범수 | man in his 50s, loud and friendly, cap backwards, vest | ochre |
| bot-jian | 지안 | young man late 20s, sharp eyes, black shirt, thinking face | teal |
| bot-woojin | 우진 | man around 30, showman smile, rolled sleeves, cue on shoulder | coral |
| bot-soyul | 소율 | woman early 30s, composed, short hair, dark blazer | dusty rose |
| bot-hangyeol | 한결 | man in his 60s, grey hair, calm, cardigan over shirt | deep olive |
| bot-baekho | 백호 | man around 40, bold, slicked hair, white shirt, tie loosened | charcoal with a faint warm glow |
| bot-eunha | 은하 | woman around 45, elegant, hair up, navy turtleneck | midnight blue |
| bot-seoha | 서하 | woman around 35, focused, low ponytail, black vest over white shirt (tournament look) | dark green felt colour |

## B. Menu props — transparent background PNG

The same towel and plant that are on the desk now (`web/ui/towel.webp`, `web/ui/plant.webp`), drawn again larger and sharper
— the plant is shown at about 220 px wide on a tablet, so it needs at least 3× that.

| ID | size | what |
|---|---|---|
| plant | 1024 × 1024, transparent | a few long green leaves of a potted plant (pothos / monstera-like) **leaning in from the top-right corner**: the leaves come in from outside the image at the top and right edges, no pot visible, seen from above at about 15°, slight shadow of their own, nothing else |
| towel | 1400 × 1000, transparent | a dark navy cotton hand towel, used, folded once and draped over a corner: it comes in from the **left and bottom edges** of the image (cut by them), soft folds, seen from above at about 15°, no stripes, no logo |
