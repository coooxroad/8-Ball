/* Ball sets (내 장비 · 공): drawn in code, the same on every table.
   { id, name, rarity, note, pal: colours of balls 1-8 (stripes repeat them; null: the usual ones), cue / yel / red: the
     carom balls, dots: the red dots TV balls have on the white (and yellow), noir?: dark balls with coloured bands and
     numbers, mat?: a surface laid over them (tex/ball-<mat>.webp), sound?: how they sound }
   sound (also on a cue): { rate: pitch, 1 as recorded (1.1 higher), tone: brightness, 1 as recorded, gain: loudness,
   1 as recorded, file: a recording in web/sound/ (name without extension) to use instead }. Left out: the usual sound. */
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const ballHex = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const ballCss = n => '#' + ballHex(n).toString(16).padStart(6, '0');
const BALLSKINS = [
  { id: 'classic', name: '클래식', rarity: 0, note: '중계에서 보는 공: 흰 공과 노란 공에 빨간 점', pal: null, cue: 0xf4efe2, yel: 0xf4c20d, red: 0xd3241c, dots: true },
  { id: 'plain', name: '매끈한 공', rarity: 0, note: '점 없는 흰 공, 맑은 색', pal: null, cue: 0xf7f3ea, yel: 0xf6c514, red: 0xd8261e, dots: false },
  { id: 'neon', name: '네온', rarity: 1, note: '형광처럼 쨍한 색', pal: [0xffe600, 0x1f6bff, 0xff2a3d, 0xa13bff, 0xff7a00, 0x00d26a, 0xff2d95, 0x111111], cue: 0xffffff, yel: 0xffe600, red: 0xff1f3d, dots: false },
  { id: 'pastel', name: '파스텔', rarity: 1, note: '부드러운 파스텔 색', pal: [0xf6d776, 0x8fb4f0, 0xf39a9a, 0xbba3e6, 0xf6b98a, 0x93d3a8, 0xe8a0b4, 0x3a3a44], cue: 0xfbf8f1, yel: 0xf6d776, red: 0xef8a8a, dots: false },
  { id: 'noir', name: '블랙 에디션', rarity: 4, note: '검은 공에 색 띠와 색 숫자', pal: [0xf2b705, 0x2f6fe0, 0xe0342b, 0x8a4fd1, 0xf08a24, 0x1fa463, 0xc23a5a, 0xd9d9d9], cue: 0xf4efe2, yel: 0xd9a514, red: 0x8e1b20, dots: true, noir: true },
  { id: 'marble', name: '마블', rarity: 2, note: '대리석 결이 흐르는 공', pal: null, cue: 0xf1ede4, yel: 0xf0c020, red: 0xcf2a22, dots: false, mat: 'marble' },
  { id: 'pearl', name: '펄', rarity: 3, note: '자개처럼 은은하게 일렁이는 공', pal: [0xf3d36b, 0x7fa6ec, 0xee8f8f, 0xb39ae0, 0xf3b07e, 0x86cf9f, 0xe597b0, 0x34343c], cue: 0xfbf8f2, yel: 0xf3d36b, red: 0xee8f8f, dots: false, mat: 'pearl' },
  { id: 'carbon', name: '카본', rarity: 3, note: '검은 카본 직조에 색 띠', pal: [0xf2b705, 0x2f6fe0, 0xe0342b, 0x8a4fd1, 0xf08a24, 0x1fa463, 0xc23a5a, 0xd9d9d9], cue: 0xe9e9e9, yel: 0xd9a514, red: 0xa3201f, dots: false, noir: true, mat: 'carbon' },
  { id: 'galaxy', name: '갤럭시', rarity: 5, note: '별이 박힌 밤하늘', pal: [0xe0b23a, 0x2a4fd0, 0xc0283a, 0x6a2fc0, 0xd96a1c, 0x13906a, 0xa01a5a, 0x0d0d1a], cue: 0xdfe4f5, yel: 0xe0b23a, red: 0xb52235, dots: false, mat: 'galaxy' },
  { id: 'vintage', name: '빈티지', rarity: 2, note: '세월이 묻은 상아빛 공', pal: [0xd9a83a, 0x2f4f8a, 0xa8382c, 0x5e3f78, 0xc0702c, 0x2f6a48, 0x6e2a2a, 0x1c1a18], cue: 0xeadfc6, yel: 0xd9a83a, red: 0xa8382c, dots: false, mat: 'vintage' },
];
if (typeof module !== 'undefined') module.exports = { BALL_HEX, ballHex, ballCss, BALLSKINS };
