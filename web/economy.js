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
   DAMA is the ranked score, shown as 레이팅 (until 5.0 as 다마, billiard-hall slang), kept the way chess.com keeps its
   ratings (owner, 11-08) - Glicko: each player has a rating and how sure it is (RD, its deviation). Everyone starts at
   DAMA_START (500) and RD_START (350: not known yet), so a new player's rating moves a lot - over a hundred a game - and
   settles as games are played (RD shrinks, to RD_MIN); a long time away makes it less sure again (RD grows by RD_GROW
   a day, to RD_MAX). 400 apart, the stronger is expected to win ten times out of eleven; beating someone higher earns
   more, and a result against someone whose own rating is unsure counts for less. Nobody goes below DAMA_FLOOR.

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
  DAMA_START: 500, DAMA_FLOOR: 100, RD_START: 350, RD_MIN: 50, RD_MAX: 350, RD_GROW: 15,
  DAMA_STEP_MAX: 600,                      // (the most one game can move a rating: a vault refuses more from a room)
  // the tiers by rating, each from its number up: 브론즈 실버 골드 플래티넘 다이아몬드 프로 (owner: 프로 from 2000; the
  // others a first cut between the start, 500, and that)
  TIER_AT: [0, 800, 1100, 1400, 1700, 2000],
  // every lesson of a game's volume done at its top level: coins and a thing found nowhere else
  LESSON_PRIZE: { eight: { coin: 3000, kind: 'cue', id: 'breaker' } },
  // signing up (a Google account tied to this one for the first time) and the tutorial done: each once per account (owner 11-09)
  SIGNUP_PRIZE: { coin: 1000, dia: 10 },
  TUTORIAL_PRIZE: { coin: 500, kind: 'cue', id: 'maple' },
};
// a ranked game's rules, the same for everyone (the app plays them; the server's room plays them again)
const RANKED_RULES = { eight: {}, nine: {}, four: { target: 5 }, three: { target: 5, cushions: 3 } };
// a game with an invited friend: the host's choices, only those the game offers (anything else: the ranked rules)
const inviteRules = (mode, r) => {
  const o = Object.assign({}, RANKED_RULES[mode] || {}); r = r || {};
  if (mode === 'three') { if ([3, 5, 10].includes(r.target)) o.target = r.target; if ([0, 1, 3].includes(r.cushions)) o.cushions = r.cushions; }
  if (mode === 'four' && [5, 10, 15, 20, 30].includes(r.target)) o.target = r.target;
  if (mode === 'four' && ['cushion', 'three'].includes(r.finish)) o.finish = r.finish;   // (the finish - game.js MODES.four)
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
// how sure a rating is after `days` without a ranked game: it grows less sure with time (Glicko's c)
const rdNow = (rd, days) => Math.min(ECONOMY.RD_MAX, Math.max(ECONOMY.RD_MIN, Math.sqrt(Math.pow(rd == null ? ECONOMY.RD_START : rd, 2) + Math.pow(ECONOMY.RD_GROW, 2) * Math.max(0, days || 0))));
/* After a ranked game between a and b (aWon: 1 won, 0 lost), with how sure each rating is (rdA, rdB): Glicko-1, the game
   as its own rating period. Returns [a', b', rdA', rdB'], ratings rounded. */
const damaAfter = (a, b, aWon, rdA, rdB) => {
  const q = Math.LN10 / 400, gOf = rd => 1 / Math.sqrt(1 + 3 * q * q * rd * rd / (Math.PI * Math.PI));
  const one = (r, rd, ro, rdo, s) => {
    const gg = gOf(rdo), e = 1 / (1 + Math.pow(10, -gg * (r - ro) / 400)), d2 = 1 / (q * q * gg * gg * e * (1 - e)), k = 1 / (1 / (rd * rd) + 1 / d2);
    return [Math.max(ECONOMY.DAMA_FLOOR, Math.round(r + q * k * gg * (s - e))), Math.max(ECONOMY.RD_MIN, Math.sqrt(k))];
  };
  const ra = rdA == null ? ECONOMY.RD_START : rdA, rb = rdB == null ? ECONOMY.RD_START : rdB, s = aWon ? 1 : 0;
  const A = one(a, ra, b, rb, s), B = one(b, rb, a, ra, 1 - s);
  return [A[0], B[0], A[1], B[1]];
};
if (typeof module !== 'undefined') module.exports = { ECONOMY, RANKED_RULES, inviteRules, matchCoins, tourPayout, priceOf, damaAfter, rdNow };
