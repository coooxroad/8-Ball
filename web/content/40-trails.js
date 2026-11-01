/* Trails (내 장비 · 트레일): what the cue ball leaves behind it.
   { id, name, rarity, note, color: the colour its card shows (and a plain streak's colour), kind?: how it is drawn -
     left out a fading streak; 'chalk' its whole way this shot chalked on the cloth, with every angle written in
     (scene/55-chalk.js) } */
const TRAILS = [
  { id: 'none', name: '없음', rarity: 0, note: '자국 없이', color: null },
  { id: 'chalkboard', name: '분필', rarity: 3, note: '지나간 길을 분필로 긋고, 튕길 때마다 각도를 적어 둡니다', color: 0xf3f6ff, kind: 'chalk' },
];
if (typeof module !== 'undefined') module.exports = { TRAILS };
