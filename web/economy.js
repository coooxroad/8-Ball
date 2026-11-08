/* The money and the ranking: one set of rules, read by the app (to show what a match will pay) and by the server (which
   is the only one that pays). Change a number here and both follow. No DOM in here.

   Coins for a match come from the points a player scored in it ("points": a score on a carom table, a ball potted on a
   legal shot on a pool table), at a price per point that depends on the game:
     ranked (랭킹전)        my points x price x (2 if I won, 1/2 if I lost)
     friend (한 기기 둘이서) both players' points x price x 1/4, to the device's account
     cpu (컴퓨터 대전)       my points x price x 1/4
     invite (초대한 친구와)   my points x price x 1/4 (two devices, the room checks it as a ranked game; no DAMA)
     tour (투어)            both put up the same stake; the winner takes the pot less the house's cut
   A puzzle pays once, the first time it is solved. Anything bought is priced by its rarity (content/00-rarity.js).
   DAMA is the ranked score - a rating in place of ELO, shown as 레이팅 (until 5.0 as 다마, billiard-hall slang). Everyone starts at
   DAMA_START (30). A ranked game moves both players the chess-rating way, on this smaller scale: an even
   game moves each by DAMA_K / 2, beating someone higher earns more and losing to someone lower costs more (never more than
   DAMA_K); DAMA_SPREAD apart, the stronger is expected to win ten times out of eleven. Nobody goes below DAMA_FLOOR.

   Checking (server, free plan): a match played on the device is played again on the server before it pays - but only a
   share of them (CHECK_SHARE), and always the big ones (over CHECK_OVER coins), a new account's first CHECK_FIRST, and
   every one from an account caught once. The rest pay at once by what the app says (within sense, at most
   UNCHECKED_DAILY a day). */
const ECONOMY = {
  PER_POINT: { four: 100, eight: 60, three: 150, nine: 60 },
  RANKED_WIN: 2, RANKED_LOSS: 0.5, FRIEND: 0.25, CPU: 0.25,
  TOUR_CUT: 0.1,
  PUZZLE: 150,
  // until the server plays every match again to check it (paid plan), matches it cannot check pay at most this a day
  UNCHECKED_DAILY: 3000, CHECK_SHARE: 0.25, CHECK_OVER: 600, CHECK_FIRST: 3,
  // price by rarity: coins for 일반..전설 (일반 is everyone's from the start), diamonds for 시크릿
  PRICE: [{ coin: 0 }, { coin: 3000 }, { coin: 8000 }, { coin: 20000 }, { coin: 50000 }, { dia: 300 }],
  DAMA_START: 30, DAMA_K: 6, DAMA_SPREAD: 100, DAMA_FLOOR: 10,
  // every lesson of a game's volume done at its top level: coins and a thing found nowhere else
  LESSON_PRIZE: { eight: { coin: 3000, kind: 'cue', id: 'breaker' } },
};
// a ranked game's rules, the same for everyone (the app plays them; the server's room plays them again)
const RANKED_RULES = { eight: {}, nine: {}, four: { target: 5 }, three: { target: 5, cushions: 3 } };
// a game with an invited friend: the host's choices, only those the game offers (anything else: the ranked rules)
const inviteRules = (mode, r) => {
  const o = Object.assign({}, RANKED_RULES[mode] || {}); r = r || {};
  if (mode === 'three') { if ([3, 5, 10].includes(r.target)) o.target = r.target; if ([0, 1, 3].includes(r.cushions)) o.cushions = r.cushions; }
  if (mode === 'four' && [5, 10, 15, 20, 30].includes(r.target)) o.target = r.target;
  return o;
};
const matchCoins = (kind, mode, points, won) => {
  const per = ECONOMY.PER_POINT[mode] || 0, mine = points[0] * per;
  if (kind === 'ranked') return Math.round(mine * (won ? ECONOMY.RANKED_WIN : ECONOMY.RANKED_LOSS));
  if (kind === 'friend') return Math.round((points[0] + points[1]) * per * ECONOMY.FRIEND);
  if (kind === 'cpu' || kind === 'invite') return Math.round(mine * ECONOMY.CPU);
  return 0;
};
const tourPayout = stake => Math.floor(stake * 2 * (1 - ECONOMY.TOUR_CUT));
const priceOf = item => ECONOMY.PRICE[Math.max(0, Math.min(ECONOMY.PRICE.length - 1, item.rarity || 0))];
// new ratings after a ranked game between a (won: 1, lost: 0) and b
const damaAfter = (a, b, aWon) => {
  const ea = 1 / (1 + Math.pow(10, (b - a) / ECONOMY.DAMA_SPREAD)), d = Math.round(ECONOMY.DAMA_K * ((aWon ? 1 : 0) - ea));
  return [Math.max(ECONOMY.DAMA_FLOOR, a + d), Math.max(ECONOMY.DAMA_FLOOR, b - d)];
};
if (typeof module !== 'undefined') module.exports = { ECONOMY, RANKED_RULES, inviteRules, matchCoins, tourPayout, priceOf, damaAfter };
