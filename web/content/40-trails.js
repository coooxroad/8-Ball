/* Trails (내 장비 · 트레일): a fading streak behind the cue ball while it rolls.
   { id, name, rarity, note, color: a colour, 'rainbow', or null for none } */
const TRAILS = [
  { id: 'none', name: '없음', rarity: 0, note: '자국 없이', color: null },
  { id: 'chalk', name: '초크 가루', rarity: 0, note: '희미한 흰 자국', color: 0xf3f6ff },
  { id: 'fire', name: '불꽃', rarity: 1, note: '주황빛 불꽃 꼬리', color: 0xff7a1a },
  { id: 'neon', name: '네온', rarity: 3, note: '파랗게 빛나는 줄', color: 0x2ee6ff },
  { id: 'gold', name: '골드', rarity: 2, note: '금빛 꼬리', color: 0xffcf3a },
  { id: 'rainbow', name: '무지개', rarity: 4, note: '색이 바뀌며 흐르는 꼬리', color: 'rainbow' },
];
if (typeof module !== 'undefined') module.exports = { TRAILS };
