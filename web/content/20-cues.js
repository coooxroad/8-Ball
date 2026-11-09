/* Cues (내 장비 · 큐): drawn in 3D from these colours, section by section from the tip.
   { id, name, rarity, note: one line on the card, shaft, ferrule, tip, joint, fore (forearm), points (null: none), wrap,
     sleeve: colours; spec: [[label, value], ...] shown when the card is opened; stat: how it plays (00-rarity.js);
     traits?: ['reach', ...] (TRAITS below); sound?: see 30-balls.js }
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
  { id: 'rose', name: '로즈우드 인레이', rarity: 4, note: '붉은 장미목 하대, 금색 포인트와 흰 리넨 그립', shaft: 0xe6cfa0, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xf1e7cf, fore: 0x7a2c1c, points: 0xd9ab52, wrap: 0xece4d2, sleeve: 0x7a2c1c, stat: { power: 6, spin: 5, guide: 5 }, traits: ['reach'],
    spec: [['무게', '19.5oz · 553g'], ['팁', '12mm 레이어드 가죽'], ['상대', '메이플'], ['하대', '로즈우드, 금색 인레이'], ['그립', '아이리시 리넨']] },
  { id: 'house', name: '하우스 큐', rarity: 0, note: '당구장 벽에 걸린 통짜 나무 큐', shaft: 0xdcb87c, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xc79556, fore: 0xc79556, points: null, wrap: 0xb5793f, sleeve: 0x8a5a2c, stat: { power: -3, spin: 0, guide: 3 },
    spec: [['무게', '18oz · 510g'], ['팁', '13mm 단일 가죽'], ['몸통', '통짜 메이플 원피스'], ['쓰임', '당구장 벽걸이 큐'], ['조인트', '없음']] },
  { id: 'sport', name: '스포츠 그립', rarity: 1, note: '흰 상대, 남색 하대에 노란 고무 그립', shaft: 0xf2f2ee, ferrule: 0xf2f2ee, tip: 0x2037c9, joint: 0xff5a3c, fore: 0x1a1f4d, points: null, wrap: 0xffd21f, sleeve: 0x1a1f4d, stat: { power: 6, spin: -4, guide: 2 },
    spec: [['무게', '19oz · 539g'], ['팁', '12.5mm 레이어드 가죽'], ['상대', '화이트 코팅 메이플'], ['하대', '네이비'], ['그립', '노란 고무']] },
  // of its own make (profile, glow: top of this file): a metal hilt and a lit blade, its own strike (GPT, PR #8)
  { id: 'saber', name: '광선검', rarity: 5, vfx: true, note: '은빛 손잡이와 푸른 광선, 짧은 전자 타격음', stat: { power: 8, spin: 6, guide: 6 },
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
  // an acoustic guitar swung by its neck: the body's bottom is the tip, the neck runs back to the head at the butt
  { id: 'guitar', name: '통기타', rarity: 3, note: '몸통으로 치는 통기타: 스프루스 상판, 로즈우드 지판, 끝엔 헤드와 줄감개', stat: { power: -2, spin: 8, guide: 6 },
    // a dreadnought's proportions on a cue's 147 cm (x1.41): body 72 cm long and 56 wide, 15 deep; neck 50 cm to the nut;
    // the head 25. Laid face up with the cue's line through the middle of the body; the neck's top flush with the body's top
    profile: [
      [0, 0.012, 0.005, 0.006, 0xe8e2d4, { rough: 0.4 }],
      [0.012, 0.72, 0.012, 0.012, 0x5a2a14, { rough: 0.4 }],
      [0.72, 1.47, 0.006, 0.006, 0x2a1408, { hide: 1 }]          // (only the line on to the butt: the neck and head are raised parts)
    ],
    parts: [
      { acoustic: [0.005, 0.725, 0.56, 0.15], bridge: 0.435, hole: 0.7, holeR: 0.125, spread: 0.0148, strings: [1.22, 0.087, 0.0099], color: 0x5a2a14 },
      { neck: [0.72, 1.22, 0.075, 0.061, 0.032], z: 0.0745, color: 0x6a3418, rough: 0.45 },
      { box: [0.585, 1.22, 0.068, 0.007], z: 0.0785, color: 0x2a1610, rough: 0.6 },
      { frets: [1.22, 0.597, 20, 0.068, 0.0825], dots: true, color: 0xc9ccd0, rough: 0.3, metal: 1 },
      { box: [1.214, 1.224, 0.068, 0.012], z: 0.081, color: 0xefe8d8, rough: 0.4 },
      { box: [1.224, 1.47, 0.12, 0.02], z: 0.066, color: 0x2a1408, rough: 0.35 },
      { pegs: [1.26, 1.44, 3, 0.011], out: 0.074, z: 0.066, color: 0xd8d8d8, rough: 0.3, metal: 1 }
    ],
    spec: [['길이', '147cm'], ['몸통', '드레드넛 비율: 길이 72cm, 폭 56cm'], ['상판·옆판', '스프루스, 마호가니'], ['넥', '로즈우드 지판, 프렛 20'], ['헤드', '크롬 줄감개 여섯'], ['치는 곳', '몸통 바닥']] },
  // a flute as long as a cue: bright silver, the crown at the tip, three joints, a lip plate, open-hole keys on their rods
  { id: 'flute', name: '플루트', rarity: 2, note: '은빛 세 마디 관, 입술판, 구멍 뚫린 키와 키를 잇는 막대', stat: { power: -3, spin: 6, guide: 5 },
    profile: [
      [0, 0.012, 0.0085, 0.0095, 0xd2d6dc, { rough: 0.1, metal: 1, env: 1.5 }],
      [0.012, 1.32, 0.0095, 0.0095, 0xbfc4cb, { rough: 0.11, metal: 1, env: 1.5 }]
    ],
    parts: [{ flute: [0, 1.32], color: 0xe6e9ee, rough: 0.1, metal: 1, env: 1.6 }],
    spec: [['길이', '132cm'], ['관', '은, 머리·몸통·발 세 마디'], ['키', '열세 개, 구멍 뚫린 프렌치 키'], ['머리', '입술판과 크라운'], ['소리', '맑은 휘슬']] },
  // the break cue: given for every 8볼 lesson done (never sold). All in the stroke - a hard phenolic tip, a stiff shaft -
  // and nothing for control; black-and-white chequers like a finish flag on the forearm and the sleeve
  { id: 'breaker', name: '브레이크 큐', rarity: 2, reward: 'eight', note: '8볼 레슨을 모두 끝내면 받는 큐: 힘에 모든 걸 건 체크무늬 브레이크 큐', stat: { power: 30, spin: -12, guide: -10 },
    profile: [
      [0, 0.008, 0.0062, 0.0063, 0x2b2622, { rough: 0.5 }],
      [0.008, 0.03, 0.0063, 0.0064, 0xf4f2ea, { rough: 0.3 }],
      [0.03, 0.735, 0.0064, 0.0106, 0xead8aa, { rough: 0.4 }],
      [0.735, 0.75, 0.0108, 0.0108, 0x101012, { rough: 0.3 }],
      [0.75, 0.772, 0.0110, 0.0110, 0xc9ccd0, { rough: 0.2, metal: 1 }],
      [0.772, 1.04, 0.0110, 0.0122, 0x101012, { check: [0x0e0e10, 0xf3f2ee, 8, 22], rough: 0.25 }],
      [1.04, 1.06, 0.0123, 0.0123, 0xc9ccd0, { rough: 0.2, metal: 1 }],
      [1.06, 1.3, 0.0124, 0.0134, 0x17171b, { rough: 0.9 }],
      [1.3, 1.45, 0.0135, 0.0146, 0x101012, { check: [0x0e0e10, 0xf3f2ee, 10, 12], rough: 0.25 }],
      [1.45, 1.47, 0.0146, 0.0142, 0x0d0d0d, { rough: 0.9 }]
    ],
    spec: [['얻는 법', '8볼 레슨 전부 완료'], ['팁', '페놀 브레이크 팁'], ['상대', '단단한 메이플'], ['하대', '흑백 체크, 고무 그립'], ['성격', '힘만, 회전·조준선은 포기']] },
];
/* A trait changes what a cue lets its player do, not how much (the stats are how much). One so far:
   reach (정밀한 조준) - no limit on the strike point: an ordinary cue strikes at most half the ball's radius from its
   centre (spin 1 on the pad), this one up to SPIN_REACH times that - three quarters of the radius, the most the
   computer ever strikes (web/ai/50-human.js); its pad's ring is drawn further out (app/10-ui.js padRing). The server holds
   every seat to that same three quarters (server/src/check.js). */
const TRAITS = { reach: { name: '정밀한 조준', say: '당점 제한이 없습니다. 보통 큐의 1.5배 바깥, 공 가장자리 가까이까지 칠 수 있습니다.' } };
const SPIN_REACH = 1.5;
const spinMaxOf = c => (c && c.traits && c.traits.includes('reach') ? SPIN_REACH : 1);
if (typeof module !== 'undefined') module.exports = { CUES, TRAITS, SPIN_REACH, spinMaxOf };
