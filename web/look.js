/* How things look: cloth colours, cue designs, ball colours. Plain data, shared by the 3D scene and the menus. */
const CLOTHS = [
  { id: 'teal', name: '딥 틸', felt: 0x0e8ba3, wood: 0x6a3a20, grain: 'mahogany' },
  { id: 'green', name: '클래식 그린', felt: 0x17894e, wood: 0x5a2f1a, grain: 'walnut' },
  { id: 'blue', name: '토너먼트 블루', felt: 0x2a78d2, wood: 0x15171c },
  { id: 'wine', name: '버건디', felt: 0x9a2536, wood: 0xa9743f },
  { id: 'charcoal', name: '차콜', felt: 0x4b5562, wood: 0x15171c },
  { id: 'ice', name: '빙판', felt: 0x6fbbe8, wood: 0x2a5f9e, ice: true },      // not a cloth: a sheet of ice, and the balls slide on it
];
const CUES = [
  { id: 'maple', name: '메이플 클래식', note: '단풍나무 상대에 흑단 하대, 네 갈래 포인트', shaft: 0xe2c592, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xd9ab52, fore: 0x2a1710, points: 0xf1e7cf, wrap: 0x14110f, sleeve: 0x2a1710 },
  { id: 'carbon', name: '블랙 카본', note: '검은 카본 상대, 무광 하대에 붉은 링', shaft: 0x1c1e22, ferrule: 0x1c1e22, tip: 0x3c6fd0, joint: 0xe2392b, fore: 0x121316, points: null, wrap: 0x2b2e34, sleeve: 0x121316 },
  { id: 'rose', name: '로즈우드 인레이', note: '붉은 장미목 하대, 금색 포인트와 흰 리넨 그립', shaft: 0xe6cfa0, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xf1e7cf, fore: 0x7a2c1c, points: 0xd9ab52, wrap: 0xece4d2, sleeve: 0x7a2c1c },
  { id: 'house', name: '하우스 큐', note: '당구장 벽에 걸린 통짜 나무 큐', shaft: 0xdcb87c, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xc79556, fore: 0xc79556, points: null, wrap: 0xb5793f, sleeve: 0x8a5a2c },
  { id: 'sport', name: '스포츠 그립', note: '흰 상대, 남색 하대에 노란 고무 그립', shaft: 0xf2f2ee, ferrule: 0xf2f2ee, tip: 0x2037c9, joint: 0xff5a3c, fore: 0x1a1f4d, points: null, wrap: 0xffd21f, sleeve: 0x1a1f4d },
];
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const ballHex = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const ballCss = n => '#' + ballHex(n).toString(16).padStart(6, '0');
/* Ball sets (내 장비 · 공): drawn in code, the same on every table. pal: the colours of balls 1-8 (stripes repeat them),
   cue / yel / red: the carom balls; dots: whether the white (and yellow) carry the red dots TV balls have; num: the
   number disc's colour and its figures'. More (marble, pearl, carbon...) come with their surface pictures. */
const BALLSKINS = [
  { id: 'classic', name: '클래식', note: '중계에서 보는 공: 흰 공과 노란 공에 빨간 점', pal: null, cue: 0xf4efe2, yel: 0xf4c20d, red: 0xd3241c, dots: true },
  { id: 'plain', name: '매끈한 공', note: '점 없는 흰 공, 맑은 색', pal: null, cue: 0xf7f3ea, yel: 0xf6c514, red: 0xd8261e, dots: false },
  { id: 'neon', name: '네온', note: '형광처럼 쨍한 색', pal: [0xffe600, 0x1f6bff, 0xff2a3d, 0xa13bff, 0xff7a00, 0x00d26a, 0xff2d95, 0x111111], cue: 0xffffff, yel: 0xffe600, red: 0xff1f3d, dots: false },
  { id: 'pastel', name: '파스텔', note: '부드러운 파스텔 색', pal: [0xf6d776, 0x8fb4f0, 0xf39a9a, 0xbba3e6, 0xf6b98a, 0x93d3a8, 0xe8a0b4, 0x3a3a44], cue: 0xfbf8f1, yel: 0xf6d776, red: 0xef8a8a, dots: false },
  { id: 'noir', name: '블랙 에디션', note: '검은 공에 색 띠와 색 숫자', pal: [0xf2b705, 0x2f6fe0, 0xe0342b, 0x8a4fd1, 0xf08a24, 0x1fa463, 0xc23a5a, 0xd9d9d9], cue: 0xf4efe2, yel: 0xd9a514, red: 0x8e1b20, dots: true, noir: true },
  { id: 'marble', name: '마블', note: '대리석 결이 흐르는 공', pal: null, cue: 0xf1ede4, yel: 0xf0c020, red: 0xcf2a22, dots: false, mat: 'marble' },
  { id: 'pearl', name: '펄', note: '자개처럼 은은하게 일렁이는 공', pal: [0xf3d36b, 0x7fa6ec, 0xee8f8f, 0xb39ae0, 0xf3b07e, 0x86cf9f, 0xe597b0, 0x34343c], cue: 0xfbf8f2, yel: 0xf3d36b, red: 0xee8f8f, dots: false, mat: 'pearl' },
  { id: 'carbon', name: '카본', note: '검은 카본 직조에 색 띠', pal: [0xf2b705, 0x2f6fe0, 0xe0342b, 0x8a4fd1, 0xf08a24, 0x1fa463, 0xc23a5a, 0xd9d9d9], cue: 0xe9e9e9, yel: 0xd9a514, red: 0xa3201f, dots: false, noir: true, mat: 'carbon' },
  { id: 'galaxy', name: '갤럭시', note: '별이 박힌 밤하늘', pal: [0xe0b23a, 0x2a4fd0, 0xc0283a, 0x6a2fc0, 0xd96a1c, 0x13906a, 0xa01a5a, 0x0d0d1a], cue: 0xdfe4f5, yel: 0xe0b23a, red: 0xb52235, dots: false, mat: 'galaxy' },
  { id: 'vintage', name: '빈티지', note: '세월이 묻은 상아빛 공', pal: [0xd9a83a, 0x2f4f8a, 0xa8382c, 0x5e3f78, 0xc0702c, 0x2f6a48, 0x6e2a2a, 0x1c1a18], cue: 0xeadfc6, yel: 0xd9a83a, red: 0xa8382c, dots: false, mat: 'vintage' },
];
/* Trails (내 장비 · 트레일): a fading streak behind the cue ball while it rolls. */
const TRAILS = [
  { id: 'none', name: '없음', note: '자국 없이', color: null },
  { id: 'chalk', name: '초크 가루', note: '희미한 흰 자국', color: 0xf3f6ff },
  { id: 'fire', name: '불꽃', note: '주황빛 불꽃 꼬리', color: 0xff7a1a },
  { id: 'neon', name: '네온', note: '파랗게 빛나는 줄', color: 0x2ee6ff },
  { id: 'gold', name: '골드', note: '금빛 꼬리', color: 0xffcf3a },
  { id: 'rainbow', name: '무지개', note: '색이 바뀌며 흐르는 꼬리', color: 'rainbow' },
];
/* Gloves (내 장비 · 장갑): pictures come as ui/glove-<id>.webp. */
const GLOVES = [
  { id: 'black', name: '블랙' }, { id: 'white', name: '화이트' }, { id: 'red', name: '레드' },
  { id: 'blue', name: '블루' }, { id: 'gold', name: '골드' }, { id: 'camo', name: '카모' },
];
/* What the gear pages list under each thing (looks only: every cue, ball and cloth plays the same). */
const CUE_SPEC = {
  maple: [['무게', '19.5oz · 553g'], ['팁', '12mm 레이어드 가죽'], ['상대', '북미산 하드 메이플'], ['하대', '흑단, 네 갈래 포인트'], ['조인트', '스테인리스 3/8×10']],
  carbon: [['무게', '19oz · 539g'], ['팁', '12.5mm 레이어드 가죽'], ['상대', '카본 파이버'], ['하대', '무광 블랙, 붉은 링'], ['조인트', '퀵 릴리스']],
  rose: [['무게', '19.5oz · 553g'], ['팁', '12mm 레이어드 가죽'], ['상대', '메이플'], ['하대', '로즈우드, 금색 인레이'], ['그립', '아이리시 리넨']],
  house: [['무게', '18oz · 510g'], ['팁', '13mm 단일 가죽'], ['몸통', '통짜 메이플 원피스'], ['쓰임', '당구장 벽걸이 큐'], ['조인트', '없음']],
  sport: [['무게', '19oz · 539g'], ['팁', '12.5mm 레이어드 가죽'], ['상대', '화이트 코팅 메이플'], ['하대', '네이비'], ['그립', '노란 고무']],
};
const GLOVE_SPEC = [['소재', '스트레치 라이크라'], ['손가락', '엄지 · 검지 · 중지'], ['손목', '벨크로 스트랩']];
