# CUE image prompts — the bots' pictures (21), style g: oil painting + anime (owner 11-17: "무조건 g")

**11-17 00:47 다시 씀.** 앞 판(서식 2:3·투명 배경·IDOL 문단)으로 뽑으니 실사처럼 나옴. 그래서 소유자가 고른 style-g 시험 그림을
만든 **그 프롬프트 그대로의 순서와 문장**으로 되돌림: 인물 → 장면(COMMON) → style-g → (★만) HEROINE.
'idol'이라는 낱말은 뺌(실제 아이돌 사진 쪽으로 끌려감) — 대신 시험 때 쓴 'anime heroine' 문장.

**11-17 00:50**: 인물은 **투명 배경**으로, 배경은 따로 두 장(BACKGROUNDS: 다크 테마용 녹색 유화, 라이트 테마용 파란 유화).
게임에서 테마에 맞는 배경 위에 인물을 겹침. 투명 배경을 빼고 나머지 문장은 시험 때 그대로.

One picture per bot, plus 2 backgrounds. Send back: `CUE-batch-bots.zip`, the files named exactly as the IDs (PNG,
the bots transparent). Claude makes the WebP and fits them in.

## How to build one prompt (paste these four in this order)

1. **WHO** - the bot's line from THE CAST.
2. **COMMON** (below - the style test's, with a transparent background instead of the green one).
3. **STYLE-G** (below - the style test's, minus "and background").
4. **HEROINE** - only for the ★ ones.

If one still comes out looking like a photo, add at the very end: *A 2D anime illustration painted in oil, not a photograph.*
If the background will not come out transparent: make it with "Plain muted dark-green background" instead, then in the same
chat ask *"The same picture, background removed, transparent PNG."*

## COMMON

Half-body portrait, from the waist up, turned three-quarters to the viewer, holding a billiard cue as described. Soft warm
light from the upper right. Transparent background: only the person, nothing behind them - no wall, no room, no
table, no colour; the lower edge, at the waist, dissolves into a few loose oil brush strokes. Elegant and tasteful: fully
clothed with a modest neckline, natural pose, nothing suggestive. No text, no letters, no logo, no watermark, no frame.
Square, 1024 × 1024.

## STYLE-G

Anime character design - clean readable face, expressive eyes, anime proportions - painted in oil: visible thick brushwork
and canvas texture on the clothes and hair, smooth refined brushwork on the face; a rich warm palette of deep
billiard-cloth green, walnut brown, burgundy and soft gold, gentle chiaroscuro light like a classic portrait painting.
Elegant, calm, premium.

## HEROINE (★ only)

Strikingly beautiful, the kind of anime heroine who becomes the fan favourite: a delicate, perfectly balanced face, big
sparkling eyes with long lashes, a soft blush on the cheeks, silky hair catching the light, a charming expression full of
personality. Still tasteful and fully clothed.

## BACKGROUNDS (2 pictures, no person - the bots stand in front of them)

Both: An oil painting on canvas with no people and no objects - only a soft, abstract painted backdrop for a portrait: thick
visible brush strokes and impasto texture, colour laid in loose layered strokes, a soft glow behind the centre where a
person will stand, darker towards the edges like a gentle vignette. Gentle chiaroscuro like a classic portrait painting.
Elegant, calm, premium. No text, no letters, no logo, no watermark, no frame. Square, 1024 × 1024.

| ID | for | add this |
|---|---|---|
| bot-bg-dark | 다크 테마 | Deep billiard-cloth green with touches of walnut brown and a faint soft gold where the glow is; dark and rich overall. |
| bot-bg-light | 라이트 테마 | Soft light blue - airy powder blue and pale sky blue, with touches of warm cream and a faint soft gold where the glow is; light and bright overall, never grey. |

## THE CAST

Everyone is an adult. The last sentence of each is how they hold themselves - keep it. Men: anime male character design -
handsome and clean-lined when young, dignified and characterful when older (lines, grey hair, kept anime eyes). ★ = add HEROINE.

| ID | tier | who |
|---|---|---|
| bot-haneul ★ | 브론즈 | An adult Korean woman, 20, part-timer at a neighbourhood billiards hall: ash-brown wavy short hair with a small clip, bright mischievous eyes, a snaggle-tooth grin. A dark green staff apron over a striped shirt, a name tag. Sitting on the table edge swinging one foot, holding the cue sideways like a toy. |
| bot-marco | 브론즈 | An adult Italian man, 24, a cooking student from Naples: curly black hair, soft brown eyes, a nervous, apologetic smile. A white chef's jacket with the sleeves pushed up, a tea towel over one shoulder. Holding the cue with both hands close to his chest as if it might bite. |
| bot-yuki ★ | 브론즈 | An adult Japanese woman, 23, daughter of a neighbourhood billiards-hall owner in Tokyo: straight black hair to the shoulders with blunt bangs, gentle dark eyes, small silver earrings. White blouse, navy cardigan, a navy ribbon. Holding a piece of blue chalk to her cue tip, looking up with a quiet, focused smile. |
| bot-camila ★ | 브론즈 | An adult Colombian woman, 25, a motorbike mechanic from Medellín: thick dark curly hair tied up with a red bandana, warm brown skin, big bold confident eyes, a dazzling smile. A rolled-sleeve denim work shirt buttoned up, a single tiny smudge of grease on one cheek. Gripping the cue low like she means to hit hard, a fierce grin. |
| bot-luiza | 브론즈 | An adult Brazilian woman, 22, a samba teacher from Rio de Janeiro: long wavy honey-brown hair, sun-kissed skin, laughing eyes. A yellow-and-green sporty zip jacket over a white tee, gold hoop earrings. Twirling the cue in one hand mid-step, as if dancing. |
| bot-linh ★ | 실버 | An adult Vietnamese woman, 21, a university student in Hanoi: long black hair in a high ponytail with a few soft loose strands, big bright curious eyes, a sweet dimpled grin. An oversized cream knit sweater, a small jade bracelet. Leaning on the cue with both hands stacked on its tip, head tilted, laughing. |
| bot-sofia | 실버 | An adult Greek woman, 28, a marine biologist from Athens: long dark hair in a braid wound round her head, olive skin, calm sea-grey eyes. A white linen shirt under a navy waistcoat, a small silver anchor pendant. Standing at ease, the cue resting against her shoulder, a serene half-smile. |
| bot-sean | 실버 | An adult Irish man, 35, a Dublin pub regular: short ginger hair, a neat ginger beard, freckles, pale blue eyes. A flat cap, a brown tweed waistcoat over a collarless shirt. Leaning back on the cue planted on the floor, one eyebrow raised, a dry, patient smile. |
| bot-emre | 골드 | An adult Turkish man, 52, owner of a tea house with a billiard table in Istanbul: salt-and-pepper hair, a full moustache, kind crinkled eyes. A burgundy cardigan over a white shirt. Holding a tulip-shaped glass of tea in one hand and the cue loosely in the other, unhurried. |
| bot-nour ★ | 골드 | An adult Egyptian woman, 26, a three-cushion player from Cairo who learned from her grandfather: dark wavy hair half tied back, warm olive skin, thoughtful dark eyes with long lashes, small gold hoop earrings. An olive-green waistcoat, white shirt, rolled sleeves. Bent slightly over the table edge, the cue lined up, glancing up at the viewer with a small, sure smile. |
| bot-femke | 골드 | An adult Dutch woman, 30, a crane operator at the port of Rotterdam: short strawberry-blonde pixie cut, freckles, sharp blue eyes. An orange work jacket worn open over a grey hoodie. One hand on her hip, the cue pointed forward like a lance, an impatient smirk. |
| bot-ana | 플래티넘 | An adult Spanish woman, 26, an architect from Valencia: dark brown hair in a low loose ponytail, warm brown eyes, light freckles. A white shirt with sleeves rolled to the elbow, a fitted charcoal waistcoat, a slim burgundy ribbon tie, a thin gold watch. Holding the cue upright beside her, the other hand on her waistcoat pocket, a calm confident half-smile. |
| bot-priya | 플래티넘 | An adult Indian woman, 27, a software engineer from Bengaluru: long black hair in a thick side braid, deep brown eyes, a small nose stud. A deep teal waistcoat over a white high-collared tunic, a thin gold bangle. Studying the table with the cue tucked under her arm, a finger at her chin, thinking. |
| bot-lea ★ | 플래티넘 | An adult French woman, 27, a former circus acrobat from Paris: short wavy auburn bob, green eyes, a playful raised eyebrow. A black fitted turtleneck, high-waisted dark trousers with braces, red lipstick. The cue resting across her shoulders behind her neck, both wrists over it, grinning. |
| bot-jose | 다이아 | An adult Filipino man, 34, who grew up playing street pool in Manila: short black hair, tanned skin, a relaxed confident grin. An open short-sleeved patterned shirt over a white tee, a wooden bead bracelet. The cue over one shoulder, the other hand in his pocket, completely at ease. |
| bot-ingrid ★ | 다이아 | An adult Swedish woman, 31, a calm engineer from Stockholm: long straight platinum-blonde hair behind her ears, pale grey-blue eyes. A grey wool waistcoat, white shirt buttoned to the top, a thin black tie. Standing very straight, the cue held vertically in front of her like a staff, a cool, level gaze. |
| bot-hangyeol | 다이아 | An adult Korean man, 64, who has run a neighbourhood billiards hall for 35 years: neatly combed grey hair, reading glasses on a cord, strict but kind eyes. A brown knit vest over a white shirt. Holding the cue at rest, chalking it slowly, saying nothing. |
| bot-frederic | 프로 | An adult Belgian man, 45, a three-cushion league veteran: dark slicked hair greying at the temples, a clean-shaven calm face. A navy suit waistcoat, crisp white shirt, a dark tie, a white glove on his bridge hand. Standing straight, the cue held at an exact angle, no expression at all. |
| bot-jack | 프로 | An adult English man, 32, a snooker star from a London pub: tousled dark-blond hair, light stubble, mischievous eyes. A black waistcoat with the bow tie hanging undone. Spinning the cue in one hand, a cheeky grin at the audience. |
| bot-lena ★ | 프로 | An adult German woman, 33, a watchmaker from Munich: a sleek dark-brown bob, thin round glasses, cool precise eyes. A tailored black waistcoat over a grey shirt, a watchmaker's loupe hanging on a fine chain. Holding the cue lightly between two fingers, checking its straightness with one eye closed. |
| bot-lukas | 프로 | An adult Austrian man, 28, a professional pool player from Vienna: platinum-blond undercut, sharp light-green eyes. A black tournament shirt with thin gold trim. Leaning on the cue with crossed arms, a cool, confident look straight at the viewer. |
