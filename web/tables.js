/* The tables everything is played on, shared by the app and the server (which plays a match again to check it).
   TABLES: the pool table sizes to choose from - real regulation numbers: playing surface, ball diameter, pocket openings.
   CAROM: four-ball's medium table (254x127cm, 65.5mm balls) and three-cushion's match table (284x142cm, 61.5mm).
   physicsFor(createPhysics, tableId): the tables a game needs, as game.js wants them ({ pool, carom, carom3 }). */
const TABLES = [
  { id: 'bar', name: '당구장 7피트', short: '7피트', d: '198×99cm · 공 57mm. 공이 크게 보이고 가장 쉽습니다.', cfg: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 } },
  { id: 'club', name: '클럽 8피트', short: '8피트', d: '224×112cm · 공 57mm. 동호인이 많이 쓰는 중간 크기.', cfg: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 } },
  { id: 'pro', name: '대회 9피트', short: '9피트', d: '254×127cm · 공 57mm. 프로 대회 규격, 가장 넓고 어렵습니다.', cfg: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 } },
  { id: 'pub', name: '영국식 6피트', short: '6피트', d: '183×91cm · 공 51mm. 작은 공에 좁은 포켓.', cfg: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 } },
];
const CAROM = { carom: { R: 0.03275, pockets: false }, carom3: { R: 0.03075, HL: 1.42, HW: 0.71, pockets: false } };
/* 스누커 (owner 11-11): the full-size table - 3569x1778mm inside the cushions, 52.5mm balls, its pockets rounded and
   tighter than a pool table's (corner ~3.5in, middle a little wider; game.js MODES.snooker). The balls are numbered
   0 the cue ball, 1-15 the reds, 16-21 the colours from yellow (2) to black (7). The markings and spots, in metres from
   the baulk cushion (the -x end) as the rules set them: the baulk line 737mm, the D's radius 292mm, the pink midway
   between the middle and the top cushion, the black 324mm from it. */
const SNOOKER = {
  cfg: { R: 0.02625, HL: 1.7845, HW: 0.889, cornerMouth: 0.09, sideMouth: 0.105, pockets: true, kind: 'snooker' },
  BAULK: 0.737, D: 0.292, BLACK: 0.324,
  hex: [0xf6f1e4, 0xc4161c, 0xf2c500, 0x0b7a3b, 0x6a3a1c, 0x1747b8, 0xef8fb0, 0x111111],   // (cue, red, then yellow .. black)
  name: ['큐볼', '빨간 공', '노란 공', '초록 공', '갈색 공', '파란 공', '분홍 공', '검은 공'],
  css: id => '#' + SNOOKER.hex[SNOOKER.kind(id)].toString(16).padStart(6, '0'),   // (a ball's colour, for the screen)
  value: id => id <= 15 ? 1 : id - 14,                       // (a red 1, yellow 2 .. black 7; the cue ball, 0, is never asked)
  kind: id => id === 0 ? 0 : id <= 15 ? 1 : id - 14,         // (the index into hex and name)
  // where a colour's spot is on table P (x along the length, the baulk end -HL; yellow on the D's right seen from baulk)
  spot(P, id) {
    const k = P.HL / 1.7845, xb = -P.HL + SNOOKER.BAULK * k, d = SNOOKER.D * k;
    return { 16: [xb, -d], 17: [xb, d], 18: [xb, 0], 19: [0, 0], 20: [P.HL / 2, 0], 21: [P.HL - SNOOKER.BLACK * k, 0] }[id];
  },
};
const physicsFor = (createPhysics, tableId) => ({ pool: createPhysics(Object.assign({ pockets: true }, (TABLES.find(t => t.id === tableId) || TABLES[0]).cfg)),
  carom: createPhysics(CAROM.carom), carom3: createPhysics(CAROM.carom3), snooker: createPhysics(SNOOKER.cfg) });
if (typeof module !== 'undefined') module.exports = { TABLES, CAROM, SNOOKER, physicsFor };
