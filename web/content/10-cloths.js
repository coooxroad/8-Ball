/* Tables (내 장비 · 테이블): the cloth's colour and the rails' wood.
   { id, name, rarity, felt: cloth colour, wood: rail colour, grain?: 'walnut' | 'mahogany' (the rails' grain), ice?: true, water?: true, look?: 'sky' | 'soccer' | 'desk' | 'court' }
   Card picture: ui/cloth-<id>.webp. The ice table is not a cloth: a sheet of ice the balls slide on (matches only).
   The pool (water: true) plays as cloth; it only looks like a swimming pool - a tiled floor under moving water. A table with a look (look:
   'sky' | 'soccer' | 'desk') has its cloth drawn as that (scene/15-looks.js lookFloor): a night sky that moves, a pitch
   (goals over a pool table's pockets), a school desk. Looks only, all of them. */
const CLOTHS = [
  { id: 'teal', name: '딥 틸', rarity: 0, felt: 0x0e8ba3, wood: 0x6a3a20, grain: 'mahogany' },
  { id: 'green', name: '클래식 그린', rarity: 0, felt: 0x17894e, wood: 0x5a2f1a, grain: 'walnut' },
  { id: 'blue', name: '토너먼트 블루', rarity: 1, felt: 0x2a78d2, wood: 0x15171c },
  { id: 'wine', name: '버건디', rarity: 2, felt: 0x9a2536, wood: 0xa9743f },
  { id: 'charcoal', name: '차콜', rarity: 3, felt: 0x4b5562, wood: 0x15171c },
  { id: 'pool', name: '수영장', rarity: 4, vfx: true, felt: 0x39b4e4, wood: 0xeaf6fa, water: true },   // looks only: a tiled pool, the light of the water moving over it
  { id: 'desk', name: '학교 책상', rarity: 2, felt: 0xa8743f, wood: 0x6e4524, look: 'desk' },     // birch top, pencil doodles and eraser crumbs
  { id: 'soccer', name: '축구장', rarity: 3, felt: 0x2c7f36, wood: 0x1d3f25, look: 'soccer' },   // mown stripes and lines; goals over the pockets
  { id: 'court', name: '농구장', rarity: 3, felt: 0xc8925a, wood: 0x1b2a55, look: 'court' },     // maple boards and lines; a hoop over each pocket
  { id: 'night', name: '밤하늘', rarity: 4, vfx: true, felt: 0x1a1d46, wood: 0x14182e, look: 'sky' },       // stars, the Milky Way, aurora, shooting stars, moving
  { id: 'ice', name: '빙판', rarity: 4, felt: 0x6fbbe8, wood: 0x2a5f9e, ice: true },      // not a cloth: a sheet of ice, and the balls slide on it
];
if (typeof module !== 'undefined') module.exports = { CLOTHS };
