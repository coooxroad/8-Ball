/* Ball sets (내 장비 · 공): drawn in code, the same on every table.
   { id, name, rarity, note, pal: colours of balls 1-8 (stripes repeat them; null: the usual ones), cue / yel / red: the
     carom balls, dots: the red dots TV balls have on the white (and yellow), noir?: dark balls with coloured bands and
     numbers, mat?: a surface laid over them (tex/ball-<mat>.webp), sound?: how they sound }
   A set may also be made otherwise (all optional; scene/30-balls.js, tasks/gpt-skins.md 2-1): shape { lumps, squash, n, eyes,
   seed } (a lumpy 3D shape inside the ball's sphere), holes [[lat, lon, radius, depth]] (finger holes), skin (the surface:
   a colour picture tex/ball-<name>.webp, or a colour), mark 'tint' | 'label' (how a skinned ball shows which it is),
   finish { rough, coat, metal, bump, bumpScale } (how the surface takes the light).
   sound (also on a cue): { rate: pitch, 1 as recorded (1.1 higher), tone: brightness, 1 as recorded, gain: loudness,
   1 as recorded, file: a recording in web/sound/ (name without extension) to use instead }. Left out: the usual sound. */
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const ballHex = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const ballCss = n => '#' + ballHex(n).toString(16).padStart(6, '0');
const BALLSKINS = [
  { id: 'classic', name: '클래식', rarity: 0, note: '중계에서 보는 공: 흰 공과 노란 공에 빨간 점', pal: null, cue: 0xf4efe2, yel: 0xf4c20d, red: 0xd3241c, dots: true },
  { id: 'plain', name: '매끈한 공', rarity: 0, note: '점 없는 흰 공, 맑은 색', pal: null, cue: 0xf7f3ea, yel: 0xf6c514, red: 0xd8261e, dots: false },
  // made otherwise (shape, holes, skin, mark, finish: top of this file): a bowling ball with its finger holes, and a lumpy potato
  { id: 'bowling', name: '볼링공', rarity: 1, note: '마블 무늬에 손가락 구멍 셋', pal: null, cue: 0xf4efe2, yel: 0xf2c21a, red: 0xd3241c, dots: false,
    mat: 'marble', holes: [[52, 80, 0.15, 0.3], [52, 100, 0.15, 0.3], [30, 90, 0.17, 0.32]], finish: { rough: 0.15, coat: 1 } },
  { id: 'potato', name: '알감자', rarity: 5, note: '울퉁불퉁 갓 캔 알감자', pal: null, cue: 0xe9dcc0, yel: 0xf2c21a, red: 0xd3241c, dots: false,
    skin: 0x9a6b3c, mark: 'label', shape: { lumps: 0.09, squash: [1, 0.86, 0.94], n: 14, eyes: 7, seed: 5 }, finish: { rough: 0.85, coat: 0 } },
];
if (typeof module !== 'undefined') module.exports = { BALL_HEX, ballHex, ballCss, BALLSKINS };
