/* How things look: cloth colours, cue designs, ball colours. Plain data, shared by the 3D scene and the menus. */
const CLOTHS = [
  { id: 'teal', name: '딥 틸', felt: 0x0e8ba3, wood: 0x6a3a20 },
  { id: 'green', name: '클래식 그린', felt: 0x17894e, wood: 0x5a2f1a },
  { id: 'blue', name: '토너먼트 블루', felt: 0x2a78d2, wood: 0x15171c },
  { id: 'wine', name: '버건디', felt: 0x9a2536, wood: 0xa9743f },
  { id: 'charcoal', name: '차콜', felt: 0x4b5562, wood: 0x15171c },
  { id: 'neon', name: '야간 네온', felt: 0x2a2278, wood: 0x0b0b12, neon: true },   // lights down: glowing edges, dark room whatever the screen theme
];
const CUES = [
  { id: 'maple', name: '메이플 클래식', note: '단풍나무 상대에 흑단 하대, 네 갈래 포인트', shaft: 0xe2c592, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xd9ab52, fore: 0x2a1710, points: 0xf1e7cf, wrap: 0x14110f, sleeve: 0x2a1710 },
  { id: 'carbon', name: '블랙 카본', note: '검은 카본 상대, 무광 하대에 붉은 링', shaft: 0x1c1e22, ferrule: 0x1c1e22, tip: 0x3c6fd0, joint: 0xe2392b, fore: 0x121316, points: null, wrap: 0x2b2e34, sleeve: 0x121316 },
  { id: 'rose', name: '로즈우드 인레이', note: '붉은 장미목 하대, 금색 포인트와 흰 리넨 그립', shaft: 0xe6cfa0, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xf1e7cf, fore: 0x7a2c1c, points: 0xd9ab52, wrap: 0xece4d2, sleeve: 0x7a2c1c },
  { id: 'house', name: '하우스 큐', note: '당구장 벽에 걸린 통짜 나무 큐', shaft: 0xdcb87c, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xc79556, fore: 0xc79556, points: null, wrap: 0xb5793f, sleeve: 0x8a5a2c },
  { id: 'sport', name: '스포츠 그립', note: '흰 상대, 남색 하대에 노란 고무 그립', shaft: 0xf2f2ee, ferrule: 0xf2f2ee, tip: 0x2037c9, joint: 0xff5a3c, fore: 0x1a1f4d, points: null, wrap: 0xffd21f, sleeve: 0x1a1f4d },
  { id: 'crystal', name: '크리스탈', note: '속이 비치는 유리 큐. 각진 하대가 빛을 받아 무지갯빛으로 번집니다', crystal: true, shaft: 0xd9f3ff, ferrule: 0xffffff, tip: 0x62c8ff, joint: 0xffffff, fore: 0xa9e4ff, points: null, wrap: 0xd9c8ff, sleeve: 0xffc4ee },
];
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const ballHex = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const ballCss = n => '#' + ballHex(n).toString(16).padStart(6, '0');
