/* The money and the ranking: one set of rules, read by the app (to show what a match will pay) and by the server (which
   is the only one that pays). Change a number here and both follow. No DOM in here.

   Coins for a match come from the points a player scored in it ("points": a score on a carom table, a ball potted on a
   legal shot on a pool table), at a price per point that depends on the game:
     ranked (랭킹전)        my points x price x (2 if I won, 1/2 if I lost)
     friend (한 기기 둘이서) both players' points x price x 1/4, to the device's account
     cpu (컴퓨터 대전)       my points x price x 1/4
     tour (투어)            both put up the same stake; the winner takes the pot less the house's cut
   A puzzle pays once, the first time it is solved. Anything bought is priced by its rarity (content/00-rarity.js).
   DAMA is the ranked score: everyone starts at DAMA_START, and a ranked game moves both players by the chess-rating rule
   (beating someone rated higher earns more, losing to someone rated lower costs more, never more than DAMA_K). */
const ECONOMY = {
  PER_POINT: { four: 100, eight: 60, three: 150, nine: 60 },
  RANKED_WIN: 2, RANKED_LOSS: 0.5, FRIEND: 0.25, CPU: 0.25,
  TOUR_CUT: 0.1,
  PUZZLE: 150,
  // until the server plays every match again to check it (paid plan), matches it cannot check pay at most this a day
  UNCHECKED_DAILY: 3000,
  // price by rarity: coins for 일반..전설 (일반 is everyone's from the start), diamonds for 시크릿
  PRICE: [{ coin: 0 }, { coin: 3000 }, { coin: 8000 }, { coin: 20000 }, { coin: 50000 }, { dia: 300 }],
  DAMA_START: 1000, DAMA_K: 32,
};
const matchCoins = (kind, mode, points, won) => {
  const per = ECONOMY.PER_POINT[mode] || 0, mine = points[0] * per;
  if (kind === 'ranked') return Math.round(mine * (won ? ECONOMY.RANKED_WIN : ECONOMY.RANKED_LOSS));
  if (kind === 'friend') return Math.round((points[0] + points[1]) * per * ECONOMY.FRIEND);
  if (kind === 'cpu') return Math.round(mine * ECONOMY.CPU);
  return 0;
};
const tourPayout = stake => Math.floor(stake * 2 * (1 - ECONOMY.TOUR_CUT));
const priceOf = item => ECONOMY.PRICE[Math.max(0, Math.min(ECONOMY.PRICE.length - 1, item.rarity || 0))];
// new ratings after a ranked game between a (won: 1, lost: 0) and b
const damaAfter = (a, b, aWon) => {
  const ea = 1 / (1 + Math.pow(10, (b - a) / 400)), d = Math.round(ECONOMY.DAMA_K * ((aWon ? 1 : 0) - ea));
  return [a + d, b - d];
};
if (typeof module !== 'undefined') module.exports = { ECONOMY, matchCoins, tourPayout, priceOf, damaAfter };
