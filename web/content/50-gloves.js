/* Gloves (내 장비 · 장갑): the bridge hand's three-finger glove. { id, name, rarity }; picture: ui/glove-<id>.webp.
   GLOVE_SPEC: what every glove's card lists when opened. */
const GLOVES = [
  { id: 'black', name: '블랙', rarity: 0 },
  { id: 'white', name: '화이트', rarity: 0 },
  { id: 'red', name: '레드', rarity: 1 },
  { id: 'blue', name: '블루', rarity: 1 },
  { id: 'gold', name: '골드', rarity: 4 },
  { id: 'camo', name: '카모', rarity: 2 },
];
const GLOVE_SPEC = [['소재', '스트레치 라이크라'], ['손가락', '엄지 · 검지 · 중지'], ['손목', '벨크로 스트랩']];
if (typeof module !== 'undefined') module.exports = { GLOVES, GLOVE_SPEC };
