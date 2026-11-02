/* Trails (내 장비 · 트레일): what the cue ball leaves behind it.
   { id, name, rarity, note, color: the colour its card shows (and a plain streak's colour), kind?: how it is drawn -
     left out a fading streak; 'chalk' its whole way this shot chalked on the cloth, with every angle written in
     (scene/55-chalk.js) } */
const TRAILS = [
  { id: 'none', name: '없음', rarity: 0, note: '자국 없이', color: null },
  { id: 'chalkboard', name: '분필', rarity: 3, note: '지나간 길을 분필로 긋고, 튕길 때마다 각도를 적어 둡니다', color: 0xf3f6ff, kind: 'chalk', sound: 'fx-chalk' },
  { id: 'fart', name: '방구', rarity: 2, note: '출발할 때 뿡! 지나간 자리엔 몽글몽글 구름', color: 0xc9d79a, kind: 'puff', sound: 'fx-fart' },
  { id: 'ink', name: '먹', rarity: 3, note: '붓으로 그은 먹 한 획: 천천히는 굵고 젖게, 빠르면 갈라진 마른 붓', color: 0x1c1c22, kind: 'ink' },
  { id: 'starlight', name: '별빛', rarity: 4, note: '반짝이는 별가루, 꺾일 때마다 별 하나 - 멈추면 별자리로 이어집니다', color: 0xbfe3ff, kind: 'stars' },
  { id: 'fire', name: '불', rarity: 4, note: '공 뒤로 타오르는 불길, 천에 남는 그을음, 쿠션에 튀는 불똥', color: 0xff7a1a, kind: 'fire', sound: 'fx-fire' },
  { id: 'splash', name: '물 첨벙', rarity: 4, note: '양옆으로 튀는 물방울과 퍼지는 물결, 쿠션마다 첨벙', color: 0x7fd4ff, kind: 'splash', sound: 'fx-splash' },
  { id: 'turf', name: '잔디 자국', rarity: 2, note: '지나간 잔디가 눕고 흙과 풀잎이 튑니다', color: 0x6cbf4a, kind: 'grass' },
  { id: 'afterimage', name: '잔상', rarity: 4, note: '공 뒤로 무지갯빛 잔상이 시간차로 남습니다', color: 0xff3df0, kind: 'ghost' }
];
if (typeof module !== 'undefined') module.exports = { TRAILS };
