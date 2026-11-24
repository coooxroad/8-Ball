'use strict';
/* The puzzle AI learning from real play (owner 11-24: 머신러닝). The server keeps every counted attempt with no account
   in it (server/src/puzzlebook-core.js: puzzle id, solved or not, the player's rating then); read them out and fit:

     curl -s -X POST https://api.danguuu.com/v1/admin/puzzles -H 'X-Admin-Pass: …' -d '{"after":0,"limit":1000}' > tries.json
     node web/tools/puzzles/fit.js tries.json [more.json …]      # prints the fit, writes fit.json beside this file
     node web/tools/puzzles/fit.js --selftest                    # made-up players on made-up puzzles: is the truth found?

   1. Each puzzle's rating, from its attempts: the rating Rp that makes what happened likeliest, the chance a player of
      rating pr solves it being 1 / (1 + 10^((Rp - pr) / 400)) (item response theory's one-parameter model - Elo's
      curve, as Pelánek uses it for adaptive practice), pulled towards the puzzle AI's rating by a prior (sd 250) so a
      puzzle tried a few times stays near it. Newton's method on the log-likelihood.
   2. What the AI misjudges, learnt: ridge regression of (those ratings less the AI's) on what each puzzle asks (its features: the
      route's cushions, side spin, follow/draw, a raised cue, barricades, the table's shape, a cushion asked for, two turns,
      the goal, pocket's kicks, banks and combinations, the answer's room) - weighted by how many attempts each has. Its
      weights say, in rating points, what each thing is worth to real players beyond what the AI thought; the generator's FIND (ai.js) is set from
      them (and from the room's weight, how much the hand matters against the eye). fit.json keeps both. */
const fs = require('fs'), path = require('path');
const L = require('./lab'), AI = require('./ai');
const PRIOR_SD = 250;
const expect = (Rp, pr) => 1 / (1 + Math.pow(10, (Rp - pr) / 400));
// 1. a puzzle's rating from its attempts [{ pr, s }] and the AI's rating r0
function puzzleRating(tries, r0) {
  let R = r0; const k = Math.LN10 / 400;
  for (let it = 0; it < 30; it++) {
    let g = -(R - r0) / (PRIOR_SD * PRIOR_SD), h = -1 / (PRIOR_SD * PRIOR_SD);
    for (const t of tries) { const p = expect(R, t.pr); g += -k * (t.s - p); h += -k * k * p * (1 - p); }
    const step = g / h; R -= Math.max(-200, Math.min(200, step)); if (Math.abs(step) < 0.01) break;
  }
  return R;
}
// what a puzzle asks, as numbers (its stored answer played to see its route)
const FEATS = ['cushions', 'side', 'fb', 'raised', 'wall', 'shape', 'need', 'turns', 'gather', 'bank', 'three', 'direct', 'kick', 'pbank', 'combo', 'extra', 'keep', 'room'];
function features(z) {
  const E = L.env(z), s0 = L.Z.shotOf(z, 0), r = L.turn(E, s0, null, 0, []), tr = r.ev ? AI.traits(z, r.ev, s0, 0) : {}, goal = L.Z.goalOf(z), pocket = L.Z.gameOf(z) === 'pocket';
  const c = AI.centre(E, s0, null, 0, []);
  return { cushions: pocket ? 0 : tr.cushions || 0, side: +!!tr.side, fb: +!!tr.fb, raised: +!!tr.raised, wall: +!!z.walls, shape: +!!(z.table && z.table !== 'rect'), need: z.need ? z.need.length : 0, turns: +(L.Z.turnsOf(z) > 1),
    gather: +(goal === 'gather'), bank: +(goal === 'bank'), three: +(goal === 'three'), direct: +(goal === 'direct'),
    kick: pocket ? tr.kick || 0 : 0, pbank: +!!(pocket && tr.bank), combo: +!!(pocket && tr.combo), extra: pocket ? Math.max(0, (z.pot || []).length - 1) : 0, keep: +!!(z.keep && z.keep.length), room: c.room };
}
// 2. ridge regression: y ≈ b + Σ w_i x_i, rows weighted, lambda the ridge
function ridge(X, y, wts, lambda) {
  const n = X[0].length + 1, A = Array.from({ length: n }, () => new Array(n).fill(0)), B = new Array(n).fill(0);
  X.forEach((x, r) => { const v = [1, ...x], w = wts[r]; for (let i = 0; i < n; i++) { B[i] += w * v[i] * y[r]; for (let j = 0; j < n; j++) A[i][j] += w * v[i] * v[j]; } });
  for (let i = 1; i < n; i++) A[i][i] += lambda;
  // Gaussian elimination
  for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
    for (let r = 0; r < n; r++) if (r !== i && A[i][i]) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; B[r] -= f * B[i]; } }
  return B.map((b, i) => b / A[i][i]);
}
function fit(rows) {
  const by = new Map(); for (const t of rows) { if (!['o', 'x'].includes(t.res) || !Number.isFinite(t.pr)) continue; if (!by.has(t.id)) by.set(t.id, []); by.get(t.id).push({ pr: t.pr, s: t.res === 'o' ? 1 : 0 }); }
  const out = [];
  for (const [id, tries] of by) { const z = L.Z.byId(id); if (!z || !Number.isFinite(z.rating)) continue; out.push({ id, n: tries.length, ai: z.rating, R: puzzleRating(tries, z.rating), z }); }
  if (!out.length) return null;
  // (what the AI got wrong, learnt: the fitted rating less the AI's, on the features - the model is the AI's rating plus that)
  const X = out.map(o => { o.f = features(o.z); return FEATS.map(k => o.f[k]); }), wts = out.map(o => Math.min(50, o.n)), w = ridge(X, out.map(o => o.R - o.ai), wts, 0.02 * wts.reduce((a, b) => a + b, 0));
  const pred = o => o.ai + w[0] + FEATS.reduce((a, k, i) => a + w[i + 1] * o.f[k], 0);
  const err = (f) => Math.sqrt(out.reduce((a, o) => a + o.n * (f(o) - o.R) ** 2, 0) / out.reduce((a, o) => a + o.n, 0));
  return { puzzles: out.map(o => ({ id: o.id, n: o.n, ai: o.ai, fitted: Math.round(o.R), model: Math.round(pred(o)) })), weights: Object.fromEntries([['base', w[0]], ...FEATS.map((k, i) => [k, w[i + 1]])].map(([k, v]) => [k, Math.round(v)])),
    rmse: { ai: Math.round(err(o => o.ai)), model: Math.round(err(pred)) } };
}
function selftest() {
  // made-up truth: each puzzle's real rating is the AI's plus what real players find harder than the AI thought (a
  // barricade +150, a raised cue +200, the room's width counting double); made-up players, rated 400 .. 2,200, try them
  const rnd = L.seeded(7), list = L.Z.list.filter(z => Number.isFinite(z.rating)).filter((z, i) => i % 2 === 0).slice(0, 140), rows = [];
  if (list.length < 20) { console.log('selftest: too few rated puzzles in web/puzzles.js'); return; }
  const truth = new Map(list.map(z => { const f = features(z); return [z.id, z.rating + 150 * f.wall + 200 * f.raised - 300 * (f.room - 0.3)]; }));
  for (let i = 0; i < 14000; i++) { const z = list[Math.floor(rnd() * list.length)], pr = 400 + rnd() * 1800, p = expect(truth.get(z.id), pr); rows.push({ id: z.id, res: rnd() < p ? 'o' : 'x', pr }); }
  const r = fit(rows), near = r.puzzles.reduce((a, o) => a + Math.abs(o.fitted - truth.get(o.id)), 0) / r.puzzles.length;
  console.log(`selftest: ${rows.length} attempts on ${r.puzzles.length} puzzles; fitted ratings off the truth by ${Math.round(near)} on average (the AI's by ${Math.round(r.puzzles.reduce((a, o) => a + Math.abs(o.ai - truth.get(o.id)), 0) / r.puzzles.length)})`);
  console.log('  learnt beyond the AI (made up: wall +150, raised +200, room -300 a whole):', JSON.stringify(r.weights), 'rmse', JSON.stringify(r.rmse));
  return r;
}
if (require.main === module) {
  if (process.argv.includes('--selftest')) selftest();
  else {
    const rows = process.argv.slice(2).flatMap(f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j.rows || j; });
    const r = fit(rows); if (!r) { console.log('no attempts at known puzzles'); process.exit(0); }
    console.log(`${rows.length} attempts on ${r.puzzles.length} puzzles; rmse to the fitted ratings: the AI ${r.rmse.ai}, the learnt model ${r.rmse.model}`);
    console.log('what each thing is worth to real players beyond the AI (rating points):', JSON.stringify(r.weights));
    fs.writeFileSync(path.join(__dirname, 'fit.json'), JSON.stringify(r, null, 1) + '\n'); console.log('wrote fit.json');
  }
}
module.exports = { fit, puzzleRating, features, ridge };
