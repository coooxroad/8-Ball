/* Gloves (내 장비 · 장갑): the bridge hand's three-finger glove. { id, name, rarity, stat: { power, dial } (00-rarity.js) };
   picture: ui/glove-<id>.webp.
   GLOVE_SPEC: what every glove's card lists when opened. */
const GLOVES = [
  { id: 'black', name: '블랙', rarity: 0, stat: { power: 1, dial: 0.08 } },
  { id: 'white', name: '화이트', rarity: 0, stat: { power: 1, dial: 0.08 } },
  { id: 'red', name: '레드', rarity: 1, stat: { power: 0.5, dial: 0.06 } },
  { id: 'blue', name: '블루', rarity: 1, stat: { power: 0.5, dial: 0.06 } },
  { id: 'gold', name: '골드', rarity: 4, stat: { power: 0.25, dial: 0.03 } },
  { id: 'camo', name: '카모', rarity: 2, stat: { power: 0.5, dial: 0.05 } },
];
const GLOVE_SPEC = [['소재', '스트레치 라이크라'], ['손가락', '엄지 · 검지 · 중지'], ['손목', '벨크로 스트랩']];
if (typeof module !== 'undefined') module.exports = { GLOVES, GLOVE_SPEC };
