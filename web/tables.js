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
const physicsFor = (createPhysics, tableId) => ({ pool: createPhysics(Object.assign({ pockets: true }, (TABLES.find(t => t.id === tableId) || TABLES[0]).cfg)),
  carom: createPhysics(CAROM.carom), carom3: createPhysics(CAROM.carom3) });
if (typeof module !== 'undefined') module.exports = { TABLES, CAROM, physicsFor };
