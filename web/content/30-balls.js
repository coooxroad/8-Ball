/* Ball sets (내 장비 · 공): drawn in code, the same on every table.
   { id, name, rarity, note, pal: colours of balls 1-8 (stripes repeat them; null: the usual ones), cue / yel / red: the
     carom balls, dots: the red dots TV balls have on the white (and yellow), noir?: dark balls with coloured bands and
     numbers, mat?: a surface laid over them (tex/ball-<mat>.webp), sound?: how they sound }
   A set may also be made otherwise (all optional; scene/30-balls.js, tasks/gpt-skins.md 2-1): shape { lumps, squash, n, eyes,
   seed } (a lumpy 3D shape inside the ball's sphere), holes [[lat, lon, radius, depth]] (finger holes), skin (the surface:
   a colour picture tex/ball-<name>.webp, or a colour), mark 'tint' | 'label' (how a skinned ball shows which it is),
   paint 'planets' | 'soccer' (the whole surface painted in code, scene/35-paint.js),
   finish { rough, coat, metal, bump, bumpScale, toon, facets, env, spots, crystal } (how the surface takes the light; toon: true drawn as a comic
   - three flat steps of light, print dots in the shade, a black outline; facets: [round, up] a mirror ball's flat facets; env:
   how strongly it mirrors the room; spots 'rainbow': throws coloured light on the cloth; crystal { rim, sparkle, cut }: cut glass - scene/30-balls.js).
   sound (also on a cue): { rate: pitch, 1 as recorded (1.1 higher), tone: brightness, 1 as recorded, gain: loudness,
   1 as recorded, file: a recording in web/sound/ (name without extension) to use instead }. Left out: the usual sound. */
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const ballHex = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const ballCss = n => '#' + ballHex(n).toString(16).padStart(6, '0');
const BALLSKINS = [
  { id: 'classic', name: '클래식', rarity: 0, note: '중계에서 보는 공: 흰 공과 노란 공에 빨간 점', pal: null, cue: 0xf4efe2, yel: 0xf4c20d, red: 0xd3241c, dots: true },
  { id: 'plain', name: '매끈한 공', rarity: 0, note: '점 없는 흰 공, 맑은 색', pal: null, cue: 0xf7f3ea, yel: 0xf6c514, red: 0xd8261e, dots: false },
  // made otherwise (shape, holes, skin, mark, finish: top of this file): a bowling ball with its finger holes, and a lumpy potato
  { id: 'bowling', name: '볼링공', rarity: 1, note: '마블 수지와 손가락 구멍 셋, 색과 띠로 공 구분', pal: null,
    cue: 0xf4f1e8, yel: 0xf2c21a, red: 0xdb2827, dots: false, skin: 'bowling', mark: 'tint', numbers: false,
    holes: [[48, 68, 0.135, 0.34], [48, 112, 0.135, 0.34], [24, 90, 0.165, 0.38]], finish: { rough: 0.18, coat: 1 },
    sound: { rate: 0.76, tone: 0.82, gain: 1.05 } },
  // the potato tells its balls apart as potatoes do: on a carom table a peeled one, a golden one and a red one; on a pool
  // table a solid is dyed its colour, a stripe wears two rubber bands of it, and every number is on a big white sticker
  { id: 'potato', name: '알감자', rarity: 5, note: '울퉁불퉁 알감자: 깐 감자·황금 감자·홍감자, 물들이고 고무줄 감고', pal: null,
    cue: 0xf0e8d5, yel: 0xf4ca1c, red: 0xe42f27, dots: false, skin: 'potato', mark: 'tint', stripes: 'bands', sticker: 1.3,
    caromSkins: [{ pic: 'potato-white', color: 0xeee2c4 }, { pic: 'potato-gold', color: 0xe5b52a }, { pic: 'potato-red', color: 0xa33a2c }],
    shape: { lumps: 0.105, squash: [1, 0.9, 0.96], n: 13, eyes: 8, seed: 37 }, finish: { rough: 0.92, coat: 0 },
    sound: { rate: 0.9, tone: 0.65, gain: 0.72 } },
  // a mirror ball: flat mirror facets in the ball's colour, and small lights thrown on the cloth round it (scene/57-comic.js)
  { id: 'disco', name: '디스코볼', rarity: 3, note: '거울 조각이 촘촘한 미러볼, 굴러가며 천 위에 빛 조각을 뿌립니다', pal: null,
    cue: 0xe9edf2, yel: 0xf3c43a, red: 0xe0473c, dots: false, skin: 0xaab1ba, mark: 'tint', sticker: 1.3,
    finish: { rough: 0.14, metal: 0.72, coat: 0, facets: [26, 14] } },
  // a comic: flat colours, the shading in print dots, black outlines, and 쾅! on hard hits (scene/57-comic.js)
  { id: 'comic', name: '만화', rarity: 4, note: '만화책에서 튀어나온 공: 굵은 외곽선과 망점, 세게 맞으면 쾅!', pal: null,
    cue: 0xfbf6ea, yel: 0xffd21f, red: 0xf0322a, dots: false, finish: { toon: true } },
  // the planets: the Moon for the cue ball, Venus to Mercury for 1-7, a black hole for the 8 (scene/35-paint.js)
  { id: 'planets', name: '행성', rarity: 4, note: '달 큐볼, 금성·지구·화성·목성…, 8번은 빛나는 고리의 블랙홀. 줄무늬는 하얀 극관', pal: null,
    cue: 0xe2e0d8, yel: 0xf6c84a, red: 0xd65c34, dots: false, paint: 'planets', finish: { rough: 0.55, coat: 0.3 } },
  // the five-and-six panel ball
  { id: 'soccer', name: '축구공', rarity: 1, note: '오각형·육각형 가죽 조각을 꿰맨 축구공, 색은 공 번호대로', pal: null,
    cue: 0xf6f6f2, yel: 0xf2c21a, red: 0xd3241c, dots: false, paint: 'soccer', finish: { rough: 0.45, coat: 0.5 } },
  // cut crystal: each ball a gem in its colour, faceted, throwing rainbow light on the cloth (scene/35-paint.js, 57-comic.js)
  { id: 'crystal', name: '크리스탈', rarity: 3, note: '빛을 머금은 크리스탈 공: 가장자리는 무지개로 갈라지고 면마다 반짝, 천 위엔 무지개 빛', pal: null,
    cue: 0xd6e8fa, yel: 0xf6d24a, red: 0xe0405a, dots: false, paint: 'crystal', finish: { rough: 0.04, coat: 1, env: 1.8, crystal: { rim: 0.7, sparkle: 0.09, cut: 11, sticker: 1 }, spots: 'rainbow' } },
  // basketballs, each in its colour
  { id: 'basketball', name: '농구공', rarity: 1, note: '오돌토돌한 가죽에 검은 줄, 색은 공 번호대로', pal: null,
    cue: 0xf4f2ec, yel: 0xf2c21a, red: 0xd3241c, dots: false, paint: 'basketball', finish: { rough: 0.75, coat: 0 } }
];
if (typeof module !== 'undefined') module.exports = { BALL_HEX, ballHex, ballCss, BALLSKINS };
