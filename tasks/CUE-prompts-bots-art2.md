# CUE image prompts — bots, batch 2 (10 pictures), style g

소유자 11-17 17:00: 프리야(인도인 같지 않음)·루카스(동아시아인 같음)·한결(당구장 사장 복장이 아님)·하늘·누르(포즈)·
카밀라(→ 남자 카를로스로 바뀜)·루이자·린이 마음에 안 듦. 하늘·프리야·누르·카밀라가 **다 똑같이 생김**.
그래서 이번 판은 (1) 사람마다 얼굴 생김새를 따로 정해 두고, (2) 포즈를 사람마다 다르게, (3) 얼굴 크기와 위치를 정해
모든 그림이 같은 크기로 보이게 했다. 성비는 여자 14 : 남자 9(약 3:2)로 맞춤 — 남자 그림이 4장 들어 있다.

Send back: `CUE-batch-bots2.zip`, PNG, transparent, named exactly as the IDs. Claude makes the WebP and fits them in.

## How to build one prompt (paste these in this order)

1. **WHO** — the bot's paragraph from THE CAST (face, clothes, pose: all of it).
2. **COMMON**
3. **STYLE-G** (unchanged)
4. **HEROINE** — only for the ★ ones.

If one comes out looking like a photo, add at the very end: *A 2D anime illustration painted in oil, not a photograph.*
If the background will not come out transparent: make it on "Plain muted dark-green background", then in the same chat
ask *"The same picture, background removed, transparent PNG."*
If two people still look alike, add: *Make the face clearly different from a generic anime face: follow the face
description exactly.*

## COMMON

Half-body portrait, from the waist up, holding a billiard cue as described. Framing, exactly: the top of the head about 5%
below the top edge, the face centred left-to-right, the face (hairline to chin) about one seventh of the picture's height.
Soft warm light from the upper right. Transparent background: only the person, nothing behind them - no wall, no room, no
table, no colour; the lower edge, at the waist, dissolves into a few loose oil brush strokes. Elegant and tasteful: fully
clothed with a modest neckline, natural pose, nothing suggestive. The person's ethnicity and age must read clearly in the
face, as described - not a generic anime face. No text, no letters, no logo, no watermark, no frame. Square, 1024 × 1024.

## STYLE-G

Anime character design - clean readable face, expressive eyes, anime proportions - painted in oil: visible thick brushwork
and canvas texture on the clothes and hair, smooth refined brushwork on the face; a rich warm palette of deep
billiard-cloth green, walnut brown, burgundy and soft gold, gentle chiaroscuro light like a classic portrait painting.
Elegant, calm, premium.

## HEROINE (★ only)

Strikingly beautiful, the kind of anime heroine who becomes the fan favourite: a delicate, perfectly balanced face, big
sparkling eyes with long lashes, a soft blush on the cheeks, silky hair catching the light, a charming expression full of
personality. Still tasteful and fully clothed.

## THE CAST (batch 2)

Everyone is an adult. Men: anime male character design - handsome and clean-lined when young, dignified and characterful
when older (lines, grey hair, kept anime eyes).

| ID | who |
|---|---|
| bot-haneul ★ | A 21-year-old Korean woman, a part-timer at a neighbourhood billiard hall. Face: small soft round face, gentle single-lidded eyes with a little puffy aegyo-sal under them, a small nose, a bright toothy grin with one dimple. Hair: chestnut-brown straight bob to the chin with see-through bangs and one yellow hair clip. Clothes: a cream-and-green striped shirt, sleeves pushed up, under a dark-green work apron with a little name tag. Pose: standing behind the cue held upright, both hands stacked on its tip and her chin resting on them, head tilted, peeking mischievously at the viewer. |
| bot-carlos | A 28-year-old Colombian man from Medellín, a motorbike mechanic. Face: tanned olive-brown skin, strong jaw, thick dark eyebrows, short stubble, a wide confident grin. Hair: thick black curls held back by a red bandana. Clothes: a faded denim work shirt with the sleeves rolled up over strong forearms, a smudge of grease on one cheek. Pose: the cue laid across his shoulders behind his neck, both wrists hooked over it, leaning back with a cocky laugh. |
| bot-luiza ★ | A 26-year-old Afro-Brazilian woman from Rio, a samba teacher. Face: warm deep-brown skin, high cheekbones, full lips, large bright dark eyes, a joyful open laugh. Hair: big voluminous natural black curls with golden-brown tips, a small yellow flower tucked in. Clothes: a cropped-length (still covering the waist) green-and-yellow track jacket zipped up over a white top, gold hoop earrings. Pose: caught mid-dance step - the cue held horizontally in both hands at chest height like a dance prop, shoulders turned, hair swinging. |
| bot-linh ★ | A 21-year-old Vietnamese woman, a university student in Hanoi. Face: slim oval face, gentle almond eyes with a natural double eyelid, a small straight nose, a soft shy smile with lips slightly parted. Hair: very long straight glossy black hair worn half-up with a small jade hairpin, the rest falling over one shoulder. Clothes: a modern pastel-lavender áo dài-style top with a high mandarin collar and fine embroidery. Pose: holding the cue diagonally across her body and chalking its tip with a blue chalk cube, eyes lifted to the viewer. |
| bot-nour ★ | A 27-year-old Egyptian woman from Cairo, a three-cushion player taught by her grandfather. Face: warm olive-brown skin, a defined oval face, strong dark arched eyebrows, large dark-brown eyes with heavy lashes and a touch of kohl, a slightly aquiline nose, a calm knowing smile. Hair: thick wavy black hair in a low loose chignon, a few strands free. Clothes: a cream linen shirt under an olive-green tailored waistcoat, a thin gold chain bracelet. Pose: bent forward over an unseen table in a classic stance, the cue held level under her chin, eyes looking up from the aim straight at the viewer. |
| bot-priya ★ | A 29-year-old Indian woman from Bengaluru, a software engineer. Face: clearly South Asian - warm medium-brown skin, a heart-shaped face, large dark almond eyes lined with kajal, thick dark eyebrows, a small gold nose stud, a small dark bindi, a warm thoughtful smile. Hair: thick long black hair in one loose side braid over her shoulder. Clothes: a deep teal kurta-style tunic with gold embroidery at the neckline, a light cardigan over it, thin gold bangles. Pose: the cue tucked under one arm, tapping her chin with a chalk cube, eyes up and to the side as if solving a puzzle. |
| bot-jose | A 38-year-old Filipino man from Manila, a street-pool legend. Face: warm tan-brown skin, a broad friendly face, kind dark eyes with laugh lines, a short trimmed moustache, an easy relaxed grin. Hair: short black hair, slightly spiky on top. Clothes: a short-sleeved patterned polo shirt in teal and white, a silver watch. Pose: leaning on the upright cue with one elbow, the other hand in his pocket, relaxed and at ease. |
| bot-hangyeol | A 62-year-old Korean man, the owner of a neighbourhood billiard hall for 35 years. Face: a lean face with deep lines, kind but sharp narrow eyes behind thin round metal glasses, a neat grey goatee, a small closed-mouth smile. Hair: short silver-grey hair neatly combed back. Clothes: a brown knitted wool vest over a white collared shirt with the sleeves rolled once, dark slacks, a small hand towel over one shoulder - a billiard hall owner at work. Pose: standing straight, chalking the cue's tip with care, the cue resting against his shoulder. |
| bot-frederic | A 52-year-old Belgian man, a three-cushion professional. Face: a long refined European face, light skin, deep-set calm grey eyes, a neat salt-and-pepper moustache, an unreadable expression. Hair: dark hair going grey at the temples, slicked back. Clothes: tournament dress - a crisp white shirt, a black waistcoat, a black bow tie, one white billiard glove on the bridge hand. Pose: standing side-on, holding the cue vertically in front of him with both hands like a sword at rest, chin slightly raised. |
| bot-lukas | A 33-year-old Austrian man from Vienna, a professional pool player. Face: clearly Central European - fair skin, an angular face with high cheekbones and a defined jaw, light grey-blue eyes, light stubble, a confident half-smile. Hair: light ash-brown hair, short at the sides, swept back on top. Clothes: a black waistcoat over a white shirt with the sleeves rolled to the elbow, a loosened dark tie. Pose: half-sitting back against an unseen table edge, the cue held loosely upright in one hand, looking at the viewer with cool confidence. |
