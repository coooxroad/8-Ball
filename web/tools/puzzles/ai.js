'use strict';
/* 퍼즐 AI (owner 11-23/24): a puzzle's rating and fun, from virtual players - the way King rates a level before it ships,
   by bots that play it as people would; and, as Lichess and Chess.com do, the rating is the level of the player who
   solves it half the time. Real first attempts will move each rating afterwards (the server: a Glicko-2 game between
   the player and the puzzle) and fit FIND below (the plan: the project's cue-puzzle-overhaul-plan.md).

   A virtual player of rating R solves a puzzle when he sees a way and plays it. The ways are the answer's families
   (search: the shots that work, grouped by the route they take - first ball, cushions, spin); for each,
     sees it   p_find(R) = 1 / (1 + e^(-(R - D) / 120)), D from what the route asks (FIND: cushions on the way, side
               spin, follow/draw, a raised cue, the barricades, the table's odd shape, a cushion asked for, gathering the
               balls, a second turn; pocket: kicks, banks, combinations, more than one ball, a ball to keep out)
     plays it  p_exec(R): the middle of that family's working shots (where a player aims) struck by R's hand - aim, pace
               and tip each off by a normal error halving every 400 points (lab.js hand) - on the game's own physics; two
               turns: each turn's share, multiplied
   and he takes the way he is likeliest to make: p(R) = max over the ways of p_find x p_exec. The rating is the R where
   p(R) is one half (searched between 200 and 2,900). */
const L = require('./lab');
const FIND = {
  four: { base: 300, cushion: 170, side: 110, fb: 60, raised: 380, wall: 140, shape: 70, need: 110, gather: 260, bank: 60, three: 120, direct: 40, turn: 220 },
  pocket: { base: 240, kick: 170, bank: 220, combo: 230, side: 100, fb: 50, raised: 380, wall: 130, shape: 70, need: 110, extra: 180, keep: 80, turn: 200 },
};
const pFind = (R, D) => 1 / (1 + Math.exp(-(R - D) / 120));
// what one working shot asks of the player (ev: its events; z: the puzzle; t: its turn)
function traits(z, ev, s, t) {
  const pocket = L.Z.gameOf(z) === 'pocket', side = Math.abs(s[2]) > 0.15, fb = Math.abs(s[3]) > 0.15, raised = (s[4] || 0) > 0.03;
  if (!pocket) return { cushions: Math.min(4, ev.cushions || 0), side, fb, raised, wall: (ev.walls || 0) > 0, first: ev.firstHit };
  const pot = z.pot || [], targ = pot.filter(id => ev.pocketed.some(q => q.id === id));
  const combo = targ.some(id => ev.firstHit !== id), bank = targ.some(id => (ev.railed || []).includes(id));
  return { kick: Math.min(3, ev.pre || 0), bank, combo, side, fb, raised, wall: (ev.walls || 0) > 0, first: ev.firstHit, n: targ.length };
}
function findD(z, tr, t) {
  const pocket = L.Z.gameOf(z) === 'pocket', F = pocket ? FIND.pocket : FIND.four, goal = L.Z.goalOf(z);
  let D = F.base + (tr.side ? F.side : 0) + (tr.fb ? F.fb : 0) + (tr.raised ? F.raised : 0) + (tr.wall ? F.wall : 0) + (z.table && z.table !== 'rect' ? F.shape : 0) + (z.need && !t ? F.need * z.need.length : 0);
  if (!pocket) { D += F.cushion * tr.cushions; if (!t && F[goal] && goal !== 'score') D += F[goal]; }
  else { D += F.kick * tr.kick + (tr.bank ? F.bank : 0) + (tr.combo ? F.combo : 0) + (z.keep && z.keep.length ? F.keep : 0) + ((z.pot || []).length > 1 && L.Z.turnsOf(z) === 1 ? F.extra * ((z.pot || []).length - 1) : 0); }
  return D;
}
/* The shots that work, grouped by route (the key: first ball, cushions or kicks, banked/combined, spin's kind), each
   group's best: the shot with most working neighbours (where a player would aim - the middle, not the edge) */
function families(z, found) {
  const by = new Map();
  for (const f of found) {
    const tr = f.tr, key = [tr.first, tr.cushions != null ? tr.cushions : tr.kick, tr.bank ? 'b' : '', tr.combo ? 'c' : '', tr.side ? 's' : '', tr.fb ? 'f' : '', tr.raised ? 'r' : ''].join('|');
    if (!by.has(key)) by.set(key, []); by.get(key).push(f);
  }
  const fams = [];
  for (const list of by.values()) {
    // (a working neighbour: within two steps of aim and one of pace, the same spin)
    for (const f of list) f.nb = list.filter(o => Math.abs(o.s[0] - f.s[0]) < 0.6 * L.DEG && Math.abs(o.s[1] / f.s[1] - 1) < 0.2 && o.s[2] === f.s[2] && o.s[3] === f.s[3]).length;
    list.sort((a, b) => b.nb - a.nb);
    fams.push({ best: list[0], n: list.length, D: list[0].D });
  }
  return fams.sort((a, b) => a.D - b.D || b.n - a.n);
}
// a family's shot moved to the middle of what works around it: a 7 x 7 grid, ±0.6°, ±8% pace, the one with most working
// neighbours (E: the puzzle's env; from: the world the turn starts from, t its turn, before: balls already potted)
function centre(E, s, from, t, before) {
  const G = [];
  for (let i = -3; i <= 3; i++) { G.push([]); for (let j = -3; j <= 3; j++) { const q = s.slice(); q[0] += 0.6 * L.DEG * i / 3; q[1] *= 1 + 0.08 * j / 3; G[i + 3].push(q[1] >= E.vmin && q[1] <= E.vmax && L.turn(E, q, from, t, before).ok ? q : null); } }
  let best = s, most = -1, ok = 0;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { if (!G[i][j]) continue; ok++; let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (G[i + a] && G[i + a][j + b]) n++; if (n > most) { most = n; best = G[i][j]; } }
  return { s: best, room: ok / 49 };
}
// p_exec(R) of one turn's shot: N tries by R's hand
function pExec(E, s, R, from, t, before, rnd, N) {
  let ok = 0; for (let i = 0; i < N; i++) if (L.turn(E, L.noisy(E, s, R, rnd), from, t, before).ok) ok++;
  return ok / N;
}
/* Rate a puzzle. ways: for each family to weigh, its turns - [{ s (the centred shot), from (world), t, before, D }] - one
   for a one-turn puzzle, two for two. Returns { rating, curve, D } */
function rate(E, ways, seed) {
  const N = 24, rnd = L.seeded(seed || 1);
  const p = R => Math.max(...ways.map(turns => pFind(R, Math.max(...turns.map(u => u.D)) + (turns.length > 1 ? FIND.four.turn : 0)) * turns.reduce((m, u) => m * pExec(E, u.s, R, u.from, u.t, u.before, rnd, N), 1)));
  let lo = 200, hi = 2900, plo = p(lo), phi = p(hi);
  if (plo >= 0.5) return { rating: lo, p: [plo, phi] };
  if (phi < 0.5) return { rating: hi, p: [plo, phi] };
  for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2, pm = p(m); if (pm >= 0.5) hi = m; else lo = m; }
  return { rating: Math.round((lo + hi) / 2 / 5) * 5, p: [plo, phi] };
}
/* Fun (0 .. 1): a route with something in it (cushions, spin, a raised cue, the elements), an obvious shot that does
   not work, a way that is not one of many, and an answer with room enough to be fair but not so much it is dull */
function fun(z, fams, room, naiveFails) {
  const b = fams[0] ? fams[0].best.tr : {}, pocket = L.Z.gameOf(z) === 'pocket';
  const depth = pocket ? Math.min(1, ((b.kick || 0) + (b.bank ? 1 : 0) + (b.combo ? 1 : 0)) / 2) : Math.min(b.cushions || 0, 3) / 3;
  const elems = (z.walls ? 1 : 0) + (z.table && z.table !== 'rect' ? 1 : 0) + (z.need ? 1 : 0) + (L.Z.turnsOf(z) > 1 ? 1 : 0) + (z.keep ? 1 : 0);
  const v = 0.26 * depth + 0.1 * (b.side || b.fb ? 1 : 0) + 0.08 * (b.raised ? 1 : 0) + 0.12 * Math.min(1, elems / 2) + 0.2 * (naiveFails ? 1 : 0) + 0.08 * (fams.length <= 2 ? 1 : 0) + 0.16 * Math.max(0, 1 - Math.abs(room - 0.35) / 0.65);
  return Math.round(Math.min(1, v) * 100) / 100;
}
module.exports = { FIND, pFind, traits, findD, families, centre, pExec, rate, fun };
