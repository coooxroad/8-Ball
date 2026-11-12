/* Trails (내 장비 · 트레일): what the cue ball leaves behind it.
   { id, name, rarity, note, color: the colour its card shows (and a plain streak's colour), kind?: how it is drawn -
     left out a fading streak; the others drawn in code, scene/56-fx.js } */
const TRAILS = [
  { id: 'none', name: '없음', rarity: 0, note: '깔끔하게', color: null },
  { id: 'fart', name: '방구', rarity: 2, note: '출발할 때 뿡!', color: 0xc9d79a, kind: 'puff', sound: 'fx-fart' },
  { id: 'starlight', name: '별빛', rarity: 4, note: '지나간 길이 별자리가 됩니다', color: 0xbfe3ff, kind: 'stars' },
  { id: 'fire', name: '불', rarity: 1, note: '불꽃을 달고 달리는 공', color: 0xff7a1a, kind: 'fire', sound: 'fx-fire' },
  { id: 'splash', name: '물 첨벙', rarity: 1, note: '쿠션마다 첨벙', color: 0x7fd4ff, kind: 'splash', sound: 'fx-splash' },
  { id: 'turf', name: '잔디 자국', rarity: 2, note: '잔디밭을 가르는 공', color: 0x6cbf4a, kind: 'grass' },
  { id: 'afterimage', name: '잔상', rarity: 2, note: '무지갯빛 잔상', color: 0xff3df0, kind: 'ghost' }
];
if (typeof module !== 'undefined') module.exports = { TRAILS };
