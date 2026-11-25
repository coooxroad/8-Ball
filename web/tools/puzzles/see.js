'use strict';
/* 퍼즐 AI v2 (owner 11-25 night: "AI의 퍼즐과 사람이 길을 보는 퍼즐의 괴리가 심해서 길을 보는 AI를 만드는 거야"): a puzzle
   rated by the seeing AI (web/ai/64-see-mind.js) - the virtual player of rating R looks at the table as a person does.
   For each stroke a player would think of (three paces by plain, follow, draw - and the answer's own stroke, its side and
   raised cue with it), the ways that player sees: where the picture - the guide's lines, and past them straight lines,
   mirror cushions and as much of the real game's curve and cushion angle as R has learnt (seeComp) - says the stroke comes
   off, with the chance each comes to mind (seeIdea: what it asks, plus what the puzzle adds - its goal, a cushion asked
   for, the table's shape, a ball to keep out, more than one to pot, a second turn: extraOf). The player looks over the
   ways that came to mind, surest first (their hand over the window as pictured), and plays the first - three tries, the
   hand steadier and the aim moved towards the real middle after each miss (they saw where it went: seeRoutes tries); a
   way that misses by far (under 0.3 on the first try) is given up for the surest one left that is really there.
     e(R) = sum over ways r, surest first: seen_r x prod(1 - seen_q, q surer) x [p1 + (1 - p1) p2 0.75 + (1 - p1)(1 - p2) p3 0.5]
   with p_k a try's chance on the real game - every aim that really comes off, any way, under the hand about the aim the
   player takes. A way pictured that is not there costs the tries spent on it; a real way pictured off its line is played
   off its line. The rating: the R where e(R) is one half (as ai.js rate: the puzzle scores even with that player).
   Two turns: the second turn's ways from where the likeliest first way (played at its real middle) leaves the balls, a
   try coming off when both turns do. */
const L = require('./lab'), AI = require('./ai');
const S = () => L.g.aiJudge.see;
const PACES = [0.32, 0.6], TIPS = [[0, 0], [0, 0.45], [0, -0.45]];
// the strokes a player thinks of here: the plain set, and the answer's own (with its side, its raised cue)
function strokesOf(sol) {
  const out = [], add = (V, a, b, el) => { if (!out.some(s => Math.abs(s.V / V - 1) < 0.08 && Math.abs(s.a - a) < 0.1 && Math.abs(s.b - b) < 0.1 && Math.abs(s.el - el) < 0.05)) out.push({ V, a, b, el }); };
  if (sol) add(sol[1], sol[2] || 0, sol[3] || 0, sol[4] || 0);
  for (const p of PACES) for (const [a, b] of TIPS) add(L.g.vOf(p), a, b, 0);
  if (sol && Math.abs(sol[2] || 0) > 0.15) for (const p of PACES) add(L.g.vOf(p), Math.sign(sol[2]) * 0.45, 0, 0);
  return out;
}
// the puzzle's own word on a stroke of turn t (puzzles.js judge): a turn that is not the last must leave something to do
function judgeOf(z, t, before) {
  const last = t >= L.Z.turnsOf(z) - 1;
  return (ev, w) => { const j = L.Z.judge(L.g, z, ev, w, t, before || []); return { ok: !!j.ok && (last || !j.done), foul: false }; };
}
// what the puzzle adds to every way's rating to come to mind (the FIND table's puzzle parts, as ai.js findD has them)
function extraOf(z, t) {
  const pocket = L.Z.gameOf(z) === 'pocket', F = pocket ? S().MIND.FIND.pocket : S().MIND.FIND.four, goal = L.Z.goalOf(z), T = L.Z.turnsOf(z);
  let D = (z.table && z.table !== 'rect' ? F.shape : 0) + (z.need && !t ? F.need * z.need.length : 0);
  if (!pocket) { if (!t && F[goal] && goal !== 'score') D += F[goal]; }
  else D += (z.keep && z.keep.length ? F.keep : 0) + ((z.pot || []).length > 1 && T === 1 ? F.extra * ((z.pot || []).length - 1) : 0);
  return D;
}
// the ways from world `from` (the start if none) at turn t: a sweep over the strokes, ready to be read at any R
function sweepTurn(E, z, from, t, before, sol) {
  const w = from || E.w0, pocket = L.Z.gameOf(z) === 'pocket', arounds = sol ? [[sol[0], 0.03, 0.0015]] : [];
  const pots = (z.pot || []).filter(id => !(before || []).includes(id) && w.balls[id] && w.balls[id].on);
  const targets = pocket ? w.balls.filter(b => b.on && b.id !== 0).map(b => b.id) : [2, 3];
  // (one cushion first: at what is to be pocketed or met - the other balls only straight on)
  const sw = S().seeSweep(w, 0, { judge: judgeOf(z, t, before), targets, strokes: strokesOf(sol), kicks: 1, kickTargets: pocket ? pots : targets, coarse: true, arounds });
  sw.t = t; sw.before = before || []; sw.extra = extraOf(z, t) + (L.Z.turnsOf(z) > 1 ? (pocket ? S().MIND.FIND.pocket.turn : S().MIND.FIND.four.turn) / 2 : 0);
  return sw;
}
const score = p => p[0] + (1 - p[0]) * p[1] * AI.TRY_S[1] + (1 - p[0]) * (1 - p[1]) * p[2] * AI.TRY_S[2];
// the ways a player of rating R sees, in the order they would play them, each with the chance it is the one played
function chosen(sw, R) {
  const memo = sw.memo || (sw.memo = new Map()); if (memo.has(R)) return memo.get(R);
  const rs = S().seeRoutes(sw, R, { extra: sw.extra, tries: AI.TRY_HAND }).sort((a, b) => b.sure - a.sure || b.seen - a.seen);
  let none = 1; for (const r of rs) { r.pc = none * r.seen; none *= 1 - r.seen; }
  memo.set(R, rs);
  return rs;
}
/* Rate a puzzle: { rating, e: [e(200), e(2900)], at: what the player of that rating does - the ways in order with seen, p,
   the chance each is played (the gap report reads it) } */
function rateSee(z, o = {}) {
  const E = L.env(z), T = L.Z.turnsOf(z), sol0 = T > 1 ? z.sol && z.sol[0] : z.sol;
  const sw1 = sweepTurn(E, z, null, 0, [], sol0);
  let seconds = null;
  if (T > 1) {
    // the second turn from where the likeliest first way leaves the balls (at 1500), played at its real middle
    const first = chosen(sw1, 1500).filter(r => r.truth).sort((a, b) => b.pc - a.pc).slice(0, 1);
    seconds = new Map();
    for (const r of first) {
      const s = [r.truth.c, r.stroke.V, r.stroke.a, r.stroke.b, r.stroke.el], res = L.turn(E, s, null, 0, []);
      if (!res.ok || res.done) continue;
      seconds.set(r, sweepTurn(E, z, res.w, 1, res.down, z.sol && z.sol[1]));
    }
  }
  /* (a way that misses by far - the picture was wrong, the ball showed it - is given up after the first try for the
     surest way left that really comes off near enough, if one came to mind: the second and third tries are that way's) */
  const keep = r => r.tries[0] >= 0.3;
  const after = (rs, r) => { const alt = rs.filter(q => q !== r && keep(q)).sort((a, b) => b.sure - a.sure)[0]; return alt ? alt.seen * (alt.tries[1] * AI.TRY_S[1] + (1 - alt.tries[1]) * alt.tries[2] * AI.TRY_S[2]) : 0; };
  const e = R => {
    const rs = chosen(sw1, R); let sc = 0;
    for (const r of rs) {
      if (r.pc < 1e-4) continue;
      if (T === 1) { sc += r.pc * (keep(r) ? score(r.tries) : r.tries[0] + (1 - r.tries[0]) * after(rs, r)); continue; }
      const key = [...seconds.keys()].find(q => q.key === r.key && q.stroke === r.stroke && Math.abs(q.c - r.c) < 0.02); if (!key) continue;
      for (const r2 of chosen(seconds.get(key), R)) if (r2.pc > 1e-4) sc += r.pc * r2.pc * score(r.tries.map((p, k) => p * r2.tries[k]));
    }
    return sc;
  };
  // (e rises with R: looked at on a few ratings, then the half way found between the two about it - by its line, then
  // twice halved)
  const memo = new Map(), E_ = R => { if (!memo.has(R)) memo.set(R, e(R)); return memo.get(R); };
  const grid = [200, 800, 1400, 2000, 2600, 2900]; let rating, lo = 200, hi = 2900;
  if (E_(200) >= 0.5) rating = 200; else if (E_(2900) < 0.5) rating = 2900;
  else {
    for (let i = 1; i < grid.length; i++) if (E_(grid[i]) >= 0.5) { lo = grid[i - 1]; hi = grid[i]; break; }
    for (let k = 0; k < 3; k++) {
      const el = E_(lo), eh = E_(hi), m = Math.round(Math.min(hi - 25, Math.max(lo + 25, lo + (hi - lo) * (0.5 - el) / Math.max(1e-6, eh - el))));
      if (hi - lo <= 60) break; if (E_(m) >= 0.5) hi = m; else lo = m;
    }
    const el = E_(lo), eh = E_(hi); rating = Math.round((lo + (hi - lo) * (0.5 - el) / Math.max(1e-6, eh - el)) / 5) * 5;
  }
  const elo = E_(200), ehi = E_(2900);
  const out = { rating, e: [Math.round(elo * 100) / 100, Math.round(ehi * 100) / 100], sims: sw1.sims };
  if (o.explain) {
    // what a player of the rating sees and does; and whether the answer's way is one a person finds (the gap report)
    const at = R => chosen(sw1, R).filter(r => r.pc > 0.01).slice(0, 5).map(r => ({ key: r.key, kiss: r.kiss, D: Math.round(r.D), seen: +r.seen.toFixed(2), pc: +r.pc.toFixed(2), p: +r.p.toFixed(2), sure: +r.sure.toFixed(2),
      off: r.truth ? +((r.c - r.truth.c) * 180 / Math.PI).toFixed(2) : null, feats: r.feats }));
    out.at = { [rating]: at(rating), 1200: at(1200), 2000: at(2000) };
    // the best a person can do here: the real ways seen by a 2400 player and how sure they are
    const top = chosen(sw1, 2400).filter(r => r.truth && r.p > 0.5);
    out.fair = top.length ? +Math.max(...top.map(r => r.seen)).toFixed(2) : 0;
  }
  return out;
}
module.exports = { rateSee, strokesOf, sweepTurn, chosen, extraOf };
