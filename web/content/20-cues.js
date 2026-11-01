/* Cues (내 장비 · 큐): drawn in 3D from these colours, section by section from the tip.
   { id, name, rarity, note: one line on the card, shaft, ferrule, tip, joint, fore (forearm), points (null: none), wrap,
     sleeve: colours; spec: [[label, value], ...] shown when the card is opened; stat: how it plays (00-rarity.js);
     sound?: see 30-balls.js }
   Or a cue of its own make: profile [[from, to, radius at from, radius at to, colour, { rough, metal }?], ...] (metres, from
   the tip) in place of the eight colours, and glow { from, to, color, core, r } (a lit blade). tasks/gpt-skins.md 2-1.
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
];
if (typeof module !== 'undefined') module.exports = { CUES };
