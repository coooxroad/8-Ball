/* Tables (내 장비 · 테이블): the cloth's colour and the rails' wood.
   { id, name, rarity, felt: cloth colour, wood: rail colour, grain?: 'walnut' | 'mahogany' (the rails' grain), ice?: true }
   Card picture: ui/cloth-<id>.webp. The ice table is not a cloth: a sheet of ice the balls slide on (matches only). */
const CLOTHS = [
  { id: 'teal', name: '딥 틸', rarity: 0, felt: 0x0e8ba3, wood: 0x6a3a20, grain: 'mahogany' },
  { id: 'green', name: '클래식 그린', rarity: 0, felt: 0x17894e, wood: 0x5a2f1a, grain: 'walnut' },
  { id: 'blue', name: '토너먼트 블루', rarity: 1, felt: 0x2a78d2, wood: 0x15171c },
  { id: 'wine', name: '버건디', rarity: 2, felt: 0x9a2536, wood: 0xa9743f },
  { id: 'charcoal', name: '차콜', rarity: 3, felt: 0x4b5562, wood: 0x15171c },
  { id: 'ice', name: '빙판', rarity: 4, felt: 0x6fbbe8, wood: 0x2a5f9e, ice: true },      // not a cloth: a sheet of ice, and the balls slide on it
];
if (typeof module !== 'undefined') module.exports = { CLOTHS };
