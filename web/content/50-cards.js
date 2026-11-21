/* The player card's own look (owner 11-21: 선수증 꾸미기) - what goes on it besides the tier, which stays the player's
   (its rim, its header and its ball are the rating's, 84-menu.css .mn-pc.t-<tier>).
   CARD_BGS: the card's face. { id, name, rarity } - drawn in the styles (84-menu.css .mn-pc.bg-<id>); 'tier' is the tier's
     own paper. For now every one is everyone's (rarity 0); later ones come from the arenas and the shop.
   TITLES: the line under the name, seen by the other player on the match's opening (56-league.js). { id, name, rarity,
     need?: what opens it - { w: wins, best: wins in a row, games } on this device's record (37-desk-menu.js titleOpen) }.
     (To come: 도전과제 opening more of them, kept by the server - roadmap.) */
const CARD_BGS = [
  { id: 'tier', name: '티어 기본', rarity: 0 },
  { id: 'felt', name: '녹색 펠트', rarity: 0 },
  { id: 'walnut', name: '호두나무', rarity: 0 },
  { id: 'chalk', name: '초크 블루', rarity: 0 },
  { id: 'night', name: '밤하늘', rarity: 0 },
  { id: 'racing', name: '레이싱', rarity: 0 },
  { id: 'argyle', name: '아가일', rarity: 0 },
];
const TITLES = [
  { id: 'none', name: '칭호 없음', rarity: 0 },
  { id: 'rookie', name: '신입 큐잡이', rarity: 0 },
  { id: 'four', name: '4구 매니아', rarity: 0 },
  { id: 'three', name: '3쿠션 수행자', rarity: 0 },
  { id: 'pocket', name: '포켓 사냥꾼', rarity: 0 },
  { id: 'night', name: '야간 당구장 단골', rarity: 0 },
  { id: 'calm', name: '침착한 승부사', rarity: 0 },
  { id: 'spin', name: '회전의 마법사', rarity: 0 },
  { id: 'first-win', name: '첫 승리', rarity: 0, need: { w: 1 } },
  { id: 'streak5', name: '5연승 달성', rarity: 0, need: { best: 5 } },
  { id: 'games100', name: '100판 베테랑', rarity: 0, need: { games: 100 } },
];
if (typeof module !== 'undefined') module.exports = { CARD_BGS, TITLES };
