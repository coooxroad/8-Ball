/* Cues (내 장비 · 큐): drawn in 3D from these colours, section by section from the tip.
   { id, name, rarity, note: one line on the card, shaft, ferrule, tip, joint, fore (forearm), points (null: none), wrap,
     sleeve: colours; spec: [[label, value], ...] shown when the card is opened; stat: how it plays (00-rarity.js);
     sound?: see 30-balls.js }
   Or a cue of its own make: profile [[from, to, radius at from, radius at to, colour, { rough, metal }?], ...] (metres, from
   the tip) in place of the eight colours, and glow { from, to, color, core, r } (a lit blade). tasks/gpt-skins.md 2-1.
   A section's options: rough, metal, sides (6: a pencil's flats; 4 with flat: a blade's diamond), flat (squashed top to
   bottom), pic / rep (a picture wrapped round it), lit (its own light). parts: [{ box | ball | prongs | frets | pegs |
   guitar: [...], color, rough?, metal? }] - what is not turned on a lathe (scene/40-cue.js cuePart says each one's numbers).
   Card picture: ui/cue-<id>.webp (2400x110, tip on the left). */
const CUES = [
  { id: 'maple', name: '메이플 클래식', rarity: 1, note: '단풍나무 상대에 흑단 하대, 네 갈래 포인트', shaft: 0xe2c592, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xd9ab52, fore: 0x2a1710, points: 0xf1e7cf, wrap: 0x14110f, sleeve: 0x2a1710, stat: { power: 2, spin: 2, guide: 0 },
    spec: [['무게', '19.5oz · 553g'], ['팁', '12mm 레이어드 가죽'], ['상대', '북미산 하드 메이플'], ['하대', '흑단, 네 갈래 포인트'], ['조인트', '스테인리스 3/8×10']] },
  { id: 'carbon', name: '블랙 카본', rarity: 2, note: '검은 카본 상대, 무광 하대에 붉은 링', shaft: 0x1c1e22, ferrule: 0x1c1e22, tip: 0x3c6fd0, joint: 0xe2392b, fore: 0x121316, points: null, wrap: 0x2b2e34, sleeve: 0x121316, stat: { power: 1, spin: 7, guide: 0 },
    spec: [['무게', '19oz · 539g'], ['팁', '12.5mm 레이어드 가죽'], ['상대', '카본 파이버'], ['하대', '무광 블랙, 붉은 링'], ['조인트', '퀵 릴리스']] },
  { id: 'rose', name: '로즈우드 인레이', rarity: 4, note: '붉은 장미목 하대, 금색 포인트와 흰 리넨 그립', shaft: 0xe6cfa0, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xf1e7cf, fore: 0x7a2c1c, points: 0xd9ab52, wrap: 0xece4d2, sleeve: 0x7a2c1c, stat: { power: 6, spin: 5, guide: 5 },
    spec: [['무게', '19.5oz · 553g'], ['팁', '12mm 레이어드 가죽'], ['상대', '메이플'], ['하대', '로즈우드, 금색 인레이'], ['그립', '아이리시 리넨']] },
  { id: 'house', name: '하우스 큐', rarity: 0, note: '당구장 벽에 걸린 통짜 나무 큐', shaft: 0xdcb87c, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xc79556, fore: 0xc79556, points: null, wrap: 0xb5793f, sleeve: 0x8a5a2c, stat: { power: -3, spin: 0, guide: 3 },
    spec: [['무게', '18oz · 510g'], ['팁', '13mm 단일 가죽'], ['몸통', '통짜 메이플 원피스'], ['쓰임', '당구장 벽걸이 큐'], ['조인트', '없음']] },
  { id: 'sport', name: '스포츠 그립', rarity: 1, note: '흰 상대, 남색 하대에 노란 고무 그립', shaft: 0xf2f2ee, ferrule: 0xf2f2ee, tip: 0x2037c9, joint: 0xff5a3c, fore: 0x1a1f4d, points: null, wrap: 0xffd21f, sleeve: 0x1a1f4d, stat: { power: 6, spin: -4, guide: 2 },
    spec: [['무게', '19oz · 539g'], ['팁', '12.5mm 레이어드 가죽'], ['상대', '화이트 코팅 메이플'], ['하대', '네이비'], ['그립', '노란 고무']] },
  // of its own make (profile, glow: top of this file): a metal hilt and a lit blade, its own strike (GPT, PR #8)
  { id: 'saber', name: '광선검', rarity: 5, note: '은빛 손잡이와 푸른 광선, 짧은 전자 타격음', stat: { power: 8, spin: 6, guide: 6 },
    profile: [
      [0, 1, 0.0057, 0.006, 0xeaf8ff, { rough: 0.2 }],
      [1, 1.025, 0.018, 0.018, 0x292e35, { rough: 0.3, metal: 0.9 }],
      [1.025, 1.032, 0.0188, 0.0188, 0xb9c1ca, { rough: 0.22, metal: 1 }],
      [1.032, 1.048, 0.018, 0.018, 0x252a30, { rough: 0.35, metal: 0.85 }],
      [1.048, 1.055, 0.0188, 0.0188, 0xb9c1ca, { rough: 0.22, metal: 1 }],
      [1.055, 1.235, 0.018, 0.018, 0xaab2bc, { rough: 0.3, metal: 1 }],
      [1.235, 1.245, 0.0184, 0.0184, 0x30343a, { rough: 0.3, metal: 0.8 }],
      [1.245, 1.26, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.26, 1.263, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.263, 1.278, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.278, 1.281, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.281, 1.296, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.296, 1.299, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.299, 1.314, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.314, 1.317, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.317, 1.332, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.332, 1.335, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.335, 1.35, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.35, 1.353, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.353, 1.368, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.368, 1.371, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.371, 1.386, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.386, 1.389, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.389, 1.404, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.404, 1.407, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.407, 1.422, 0.0173, 0.0173, 0x202328, { rough: 0.82, metal: 0 }],
      [1.422, 1.425, 0.018, 0.018, 0x717983, { rough: 0.36, metal: 0.9 }],
      [1.425, 1.44, 0.0175, 0.0175, 0x25282d, { rough: 0.8 }],
      [1.44, 1.47, 0.019, 0.0184, 0xb1bac3, { rough: 0.26, metal: 1 }]
    ], glow: { from: 0.004, to: 1, color: 0x38bfff, core: 0xf2fcff, r: 0.006 }, sound: { file: 'saber-strike' },
    spec: [['길이', '147cm'], ['날', '푸른 광선 · 밝은 중심부'], ['손잡이', '브러시드 실버 · 건메탈'], ['그립', '차콜 링 그립'], ['타격음', '짧은 전자 스윕']] },
  // gold: the usual shape, all of it polished gold with black rings
  { id: 'gold', name: '황금 큐', rarity: 3, note: '끝에서 끝까지 광을 낸 금, 검은 링 몇 줄', stat: { power: 4, spin: 4, guide: 4 },
    profile: [
      [0, 0.012, 0.006, 0.0062, 0x3d6fb0, { rough: 0.9 }],
      [0.012, 0.04, 0.0062, 0.0064, 0xf4efe2, { rough: 0.35 }],
      [0.04, 0.74, 0.0064, 0.0104, 0xe8b64a, { rough: 0.22, metal: 1 }],
      [0.74, 0.756, 0.0107, 0.0108, 0x141414, { rough: 0.3 }],
      [0.756, 1.03, 0.0106, 0.0122, 0xf0c25a, { rough: 0.18, metal: 1 }],
      [1.03, 1.036, 0.0122, 0.0123, 0x141414, { rough: 0.3 }],
      [1.036, 1.294, 0.0123, 0.0136, 0xc99a34, { rough: 0.38, metal: 1 }],
      [1.294, 1.3, 0.0136, 0.0136, 0x141414, { rough: 0.3 }],
      [1.3, 1.44, 0.0136, 0.0146, 0xf0c25a, { rough: 0.18, metal: 1 }],
      [1.44, 1.47, 0.0146, 0.0142, 0x141414, { rough: 0.6 }]
    ],
    spec: [['무게', '20oz · 567g'], ['팁', '12mm 레이어드 가죽'], ['몸통', '광택 금 도금'], ['링', '검은 흑단 링 넷'], ['조인트', '금 3/8×10']] },
  // a pencil as long as a cue: graphite point, the sharpened wood, a yellow six-sided body, the metal band and the rubber
  { id: 'pencil', name: '거대 연필', rarity: 2, note: '깎은 흑연 끝, 노란 육각 몸통, 끝엔 분홍 지우개', stat: { power: -2, spin: 4, guide: 6 },
    profile: [
      [0, 0.03, 0.0035, 0.006, 0x2b2b30, { rough: 0.45, metal: 0.35 }],
      [0.03, 0.15, 0.006, 0.0125, 0xe7c89a, { rough: 0.85 }],
      [0.15, 1.36, 0.0125, 0.0125, 0xf2b81c, { rough: 0.45, sides: 6 }],
      [1.36, 1.366, 0.0131, 0.0131, 0xb8bcc2, { rough: 0.3, metal: 1 }],
      [1.366, 1.372, 0.0128, 0.0128, 0x9a9ea5, { rough: 0.35, metal: 1 }],
      [1.372, 1.378, 0.0131, 0.0131, 0xb8bcc2, { rough: 0.3, metal: 1 }],
      [1.378, 1.384, 0.0128, 0.0128, 0x9a9ea5, { rough: 0.35, metal: 1 }],
      [1.384, 1.39, 0.0131, 0.0131, 0xb8bcc2, { rough: 0.3, metal: 1 }],
      [1.39, 1.47, 0.0124, 0.0122, 0xf08aa0, { rough: 0.92 }]
    ],
    spec: [['길이', '147cm'], ['끝', 'HB 흑연'], ['몸통', '노란 육각 삼나무'], ['띠', '알루미늄'], ['지우개', '분홍 고무']] },
  // the dragon: green-bronze scales the length of it (tex/cue-dragon-scales), bronze fittings, an ember at the tip
  { id: 'dragon', name: '드래곤 큐', rarity: 4, note: '청동빛 비늘이 감긴 몸통, 불씨가 맺힌 팁', stat: { power: 9, spin: 4, guide: 3 },
    profile: [
      [0, 0.012, 0.006, 0.0062, 0xff7a1a, { rough: 0.6, lit: 0xff5a0a }],
      [0.012, 0.04, 0.0062, 0.0064, 0xb07a3a, { rough: 0.3, metal: 0.9 }],
      [0.04, 0.74, 0.0064, 0.0104, 0xffffff, { rough: 0.42, metal: 0.25, pic: 'cue-dragon-scales', rep: [1, 9] }],
      [0.74, 0.756, 0.0108, 0.0109, 0xb07a3a, { rough: 0.3, metal: 0.9 }],
      [0.756, 1.03, 0.0106, 0.0122, 0xd8e2d0, { rough: 0.4, metal: 0.25, pic: 'cue-dragon-scales', rep: [2, 4] }],
      [1.03, 1.04, 0.0124, 0.0124, 0xb07a3a, { rough: 0.3, metal: 0.9 }],
      [1.04, 1.3, 0.0123, 0.0136, 0x7e8c78, { rough: 0.55, metal: 0.2, pic: 'cue-dragon-scales', rep: [2, 4] }],
      [1.3, 1.44, 0.0136, 0.0146, 0x1d2a22, { rough: 0.35, metal: 0.4 }],
      [1.44, 1.47, 0.0146, 0.014, 0xb07a3a, { rough: 0.3, metal: 0.9 }]
    ], sound: { file: 'fx-fire' },
    spec: [['무게', '21oz · 595g'], ['팁', '불씨 팁'], ['몸통', '청동 비늘 감기'], ['장식', '청동 고리'], ['타격음', '화르륵']] },
  // a knight's sword: a flat diamond blade to a point, a brass crossguard, a leather grip, a round pommel
  { id: 'sword', name: '기사의 검', rarity: 2, note: '날 선 강철 칼날, 놋쇠 십자 손잡이, 가죽 그립', stat: { power: 5, spin: 0, guide: 3 },
    profile: [
      [0, 0.07, 0.003, 0.016, 0xdfe4ea, { rough: 0.18, metal: 1, sides: 4, flat: 0.22 }],
      [0.07, 0.86, 0.016, 0.018, 0xd3d8de, { rough: 0.22, metal: 1, sides: 4, flat: 0.22 }],
      [0.86, 0.9, 0.012, 0.012, 0x8a6a32, { rough: 0.35, metal: 0.9 }],
      [0.9, 1.3, 0.0125, 0.0135, 0x4a2c18, { rough: 0.85 }],
      [1.3, 1.34, 0.0105, 0.0105, 0x8a6a32, { rough: 0.35, metal: 0.9 }]
    ],
    parts: [{ box: [0.86, 0.885, 0.12, 0.016], color: 0xb08d4a, rough: 0.3, metal: 1 }, { ball: [1.36, 0.022], color: 0xb08d4a, rough: 0.3, metal: 1 }],
    spec: [['길이', '136cm'], ['칼날', '양날 강철'], ['손잡이', '놋쇠 십자 가드'], ['그립', '가죽 감기'], ['폼멜', '놋쇠 공']] },
  // an acoustic guitar swung by its neck: the body's bottom is the tip, the neck runs back to the head at the butt
  { id: 'guitar', name: '통기타', rarity: 3, note: '몸통으로 치는 통기타: 스프루스 상판, 로즈우드 지판, 끝엔 헤드와 줄감개', stat: { power: -2, spin: 8, guide: 6 },
    profile: [
      [0, 0.012, 0.005, 0.006, 0xe8e2d4, { rough: 0.4 }],
      [0.012, 0.44, 0.012, 0.012, 0x5a2a14, { rough: 0.4 }],
      [0.44, 1.12, 0.0135, 0.0125, 0x6a3418, { rough: 0.45, flat: 0.75 }],
      [1.12, 1.3, 0.008, 0.008, 0x2a1408, { rough: 0.5 }]
    ],
    parts: [
      { acoustic: [0.005, 0.46, 0.27, 0.075], strings: [1.14, 0.0135], color: 0x5a2a14 },
      { box: [0.44, 1.12, 0.046, 0.005], z: 0.0095, color: 0x2a1610, rough: 0.6 },
      { frets: [0.46, 1.11, 19, 0.046, 0.0125], dots: true, color: 0xc9ccd0, rough: 0.3, metal: 1 },
      { box: [1.11, 1.12, 0.046, 0.007], z: 0.0105, color: 0xefe8d8, rough: 0.4 },
      { box: [1.12, 1.3, 0.07, 0.014], z: 0.004, color: 0x2a1408, rough: 0.35 },
      { pegs: [1.15, 1.28, 3, 0.007], out: 0.04, z: 0.004, color: 0xd8d8d8, rough: 0.3, metal: 1 }
    ],
    spec: [['길이', '130cm'], ['몸통', '스프루스 상판, 마호가니 옆판'], ['넥', '로즈우드 지판, 프렛 19'], ['헤드', '크롬 줄감개 여섯'], ['치는 곳', '몸통 바닥']] },
  // a flute as long as a cue: bright silver, the crown at the tip, three joints, a lip plate, open-hole keys on their rods
  { id: 'flute', name: '플루트', rarity: 2, note: '은빛 세 마디 관, 입술판, 구멍 뚫린 키와 키를 잇는 막대', stat: { power: -3, spin: 6, guide: 5 },
    profile: [
      [0, 0.012, 0.0085, 0.0095, 0xd2d6dc, { rough: 0.1, metal: 1, env: 1.5 }],
      [0.012, 1.32, 0.0095, 0.0095, 0xbfc4cb, { rough: 0.11, metal: 1, env: 1.5 }]
    ],
    parts: [{ flute: [0, 1.32], color: 0xe6e9ee, rough: 0.1, metal: 1, env: 1.6 }],
    spec: [['길이', '132cm'], ['관', '은, 머리·몸통·발 세 마디'], ['키', '열세 개, 구멍 뚫린 프렌치 키'], ['머리', '입술판과 크라운'], ['소리', '맑은 휘슬']] },
  // cut crystal: a twisted cut-glass shaft, platinum fittings set with small stones, a brilliant at the butt
  { id: 'crystal', name: '크리스탈', rarity: 4, note: '비틀어 깎은 크리스탈 상대, 큐빅 박힌 백금 링, 끝엔 브릴리언트 보석', stat: { power: 6, spin: 6, guide: 4 },
    profile: [
      [0, 0.012, 0.006, 0.0062, 0xa9cdf0, { glass: 1 }],
      [0.012, 0.74, 0.0064, 0.0104, 0x92bde6, { glass: 1, sides: 8, cut: 28 }],
      [0.74, 0.76, 0.0112, 0.0112, 0xf1f3f6, { rough: 0.08, metal: 1, env: 1.8 }],
      [0.76, 1.03, 0.0106, 0.0122, 0x86b4e2, { glass: 1, sides: 8, cut: 12 }],
      [1.03, 1.05, 0.0128, 0.0128, 0xf1f3f6, { rough: 0.08, metal: 1, env: 1.8 }],
      [1.05, 1.3, 0.0123, 0.0136, 0x98c2ea, { glass: 1, sides: 10, cut: 10 }],
      [1.3, 1.42, 0.0137, 0.0146, 0xf1f3f6, { rough: 0.08, metal: 1, env: 1.8 }]
    ],
    parts: [{ stones: [0.75, 0.0113, 14, 0.0016], glass: 1.4, color: 0xffffff }, { stones: [1.04, 0.0129, 16, 0.0016], glass: 1.4, color: 0xffffff },
      { stones: [1.36, 0.0143, 18, 0.0017], glass: 1.4, color: 0xffffff }, { ball: [1.448, 0.024], facets: [12, 6], glass: 1.6, color: 0xbfe0ff }],
    spec: [['길이', '147cm'], ['상대', '비틀어 깎은 크리스탈'], ['링', '백금, 큐빅'], ['끝', '브릴리언트 컷 보석'], ['빛', '가장자리 무지개, 면마다 반짝']] }
];
if (typeof module !== 'undefined') module.exports = { CUES };
