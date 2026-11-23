'use strict';
/* 퍼즐 AI 1단계 (owner 11-23): every puzzle given a rating and a fun score by virtual players, written into web/puzzles.js
   ("rating", "fun"). The app serves puzzles near the player's puzzle rating (web/app/52-puzzle.js pzr).

     node web/tools/puzzles/rate.js            # rate every puzzle, write puzzles.js
     node web/tools/puzzles/rate.js --dry      # print only

   A virtual player of rating R solves a puzzle when he both sees the way and plays it:
   - plays it (simulated): the stored answer struck N times with R's hand - aim, pace and tip each off by a normal error whose
     size halves every 400 points (SIG_* at 1500); p_exec(R) the share that still solves it, on the game's own physics and
     judge (engine.js).
   - sees it (a model, to be learned): p_find(R) = 1 / (1 + e^(-(R - D) / 120)), D from what the answer asks - cushions
     before the second red, side spin, follow/draw, a raised cue, a barricade, gathering the balls (FIND weights).
   The puzzle's rating is the R at which p_find * p_exec = 1/2 (as a chess puzzle's: the player who solves it half the time).
   Up to 800 only plain 4구 positions (owner 11-23): any other kind is rated above it. The FIND weights are a first guess
   - the plan (project doc cue-puzzle-overhaul-plan.md) fits them, and each puzzle's rating, from real first attempts.
   A stored answer that no longer solves on today's physics gets no rating: the app leaves those out until made again. */
const fs = require('fs'), path = require('path');
const E = require('./engine.js'), FILE = path.join(__dirname, '../../puzzles.js'), Z = require(FILE)();
const DRY = process.argv.includes('--dry');
const SIG_A = 0.0028, SIG_V = 0.03, SIG_T = 0.05;                 // at 1500: aim (rad), pace (share), tip (radius units)
const hand = R => Math.pow(2, (1500 - R) / 400);
const FIND = { base: 300, cushion: 170, side: 120, fb: 70, raised: 380, wall: 140, gather: 260 };
const N = 40, LEVELS = []; for (let R = 200; R <= 2800; R += 100) LEVELS.push(R);
function gauss(rnd) { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }
// what the answer asks of the player
function traits(z, ev) {
  const [, , a, b, el] = z.sol, goal = Z.STAGES[z.stage].goal;
  return { cushions: Math.min(4, ev.cushions || 0), side: Math.abs(a) > 0.12, fb: Math.abs(b) > 0.12, raised: (el || 0) > 0.02, walls: z.walls ? z.walls.length : 0, gather: goal === 'gather', plain: goal === 'score' && !z.walls && !z.shape };
}
const findD = t => FIND.base + FIND.cushion * t.cushions + (t.side ? FIND.side : 0) + (t.fb ? FIND.fb : 0) + (t.raised ? FIND.raised : 0) + (t.walls ? FIND.wall : 0) + (t.gather ? FIND.gather : 0);
const pFind = (R, D) => 1 / (1 + Math.exp(-(R - D) / 120));
function pExec(z, R, rnd) {
  const goal = Z.STAGES[z.stage].goal, k = hand(R), [ang, V, a, b, el] = z.sol, vmin = E.g.vOf(0), vmax = E.g.vOf(1);
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const s = [ang + gauss(rnd) * SIG_A * k, Math.min(vmax, Math.max(vmin, V * (1 + gauss(rnd) * SIG_V * k))), a + gauss(rnd) * SIG_T * k, b + gauss(rnd) * SIG_T * k, el];
    const r = Math.hypot(s[2], s[3]); if (r > 0.8) { s[2] *= 0.8 / r; s[3] *= 0.8 / r; }
    if (E.play(z.balls, s, goal, true, 30, z.walls).ok) ok++;
  }
  return ok / N;
}
/* where a player aims: not the stored answer (often at the edge of what works) but the middle of the shots near it that
   work - an 11 × 11 grid ±0.8°, ±8% around it, the working shot with the most working neighbours */
function centre(z) {
  const goal = Z.STAGES[z.stage].goal, G = [];
  for (let i = -5; i <= 5; i++) { G.push([]); for (let j = -5; j <= 5; j++) { const s = z.sol.slice(); s[0] += 0.8 * E.DEG * i / 5; s[1] *= 1 + 0.08 * j / 5; G[i + 5].push(s[1] >= E.g.vOf(0) && s[1] <= E.g.vOf(1) && E.play(z.balls, s, goal, true, 30, z.walls).ok ? s : null); } }
  let best = z.sol, most = -1;
  for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) { if (!G[i][j]) continue; let n = 0; for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) if (G[i + di] && G[i + di][j + dj]) n++; if (n > most) { most = n; best = G[i][j]; } }
  return Object.assign({}, z, { sol: best });
}
// the answer's room: a 9 × 9 grid ±0.5°, ±5% around it (narrow is hard to play; very wide is dull)
function room(z) {
  const goal = Z.STAGES[z.stage].goal; let ok = 0, n = 0;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const s = z.sol.slice(); s[0] += 0.5 * E.DEG * i / 4; s[1] *= 1 + 0.05 * j / 4; if (E.play(z.balls, s, goal, true, 30, z.walls).ok) ok++; n++; }
  return ok / n;
}
const out = [];
for (const z of Z.list) {
  const first = E.play(z.balls, z.sol, Z.STAGES[z.stage].goal, true, 30, z.walls);
  if (!first.ok) { out.push({ id: z.id, broken: true }); continue; }
  const t = traits(z, first.ev), D = findD(t), rnd = E.seeded(z.id * 7919), zc = centre(z);
  const curve = LEVELS.map(R => [R, pFind(R, D) * pExec(zc, R, rnd)]);
  // where the curve crosses one half (it rises with R, near enough; the first crossing, read between the levels)
  let rating = LEVELS[LEVELS.length - 1] + 100;
  for (let i = 0; i < curve.length; i++) if (curve[i][1] >= 0.5) { if (!i) { rating = curve[0][0]; break; } const [R0, p0] = curve[i - 1], [R1, p1] = curve[i]; rating = R0 + (R1 - R0) * (0.5 - p0) / Math.max(1e-6, p1 - p0); break; }
  if (!t.plain) rating = Math.max(rating, 820);                      // (up to 800 only plain 4구)
  const w = room(zc);
  const fun = 0.3 * Math.min(t.cushions, 3) / 3 + 0.15 * (t.side || t.fb) + 0.15 * t.raised + 0.15 * (t.walls > 0) + 0.25 * Math.max(0, 1 - Math.abs(w - 0.35) / 0.65);
  out.push({ id: z.id, stage: z.stage, rating: Math.round(rating / 5) * 5, fun: Math.round(fun * 100) / 100, D: Math.round(D), room: Math.round(w * 100), curve: curve.map(c => Math.round(c[1] * 100)) });
  process.stdout.write(`${z.id} ${out[out.length - 1].rating} fun ${out[out.length - 1].fun} room ${Math.round(w * 100)}%\n`);
}
const ok = out.filter(o => !o.broken);
console.log(`rated ${ok.length} / ${out.length} (${out.length - ok.length} answers no longer solve), ${E.simulations()} shots played`);
for (let s = 0; s < Z.STAGES.length; s++) { const r = ok.filter(o => o.stage === s).map(o => o.rating).sort((a, b) => a - b); if (r.length) console.log(`  ${Z.STAGES[s].name}: ${r[0]} ~ ${r[r.length - 1]} (가운데 ${r[r.length >> 1]})`); }
if (!DRY) {
  // the list's lines: each puzzle one JSON object; its rating and fun put in (or taken out, for an answer that broke)
  const by = new Map(out.map(o => [o.id, o]));
  const src = fs.readFileSync(FILE, 'utf8').replace(/^(\s*)(\{"id":(\d+),.*\})(,?)$/gm, (all, ind, json, id, comma) => {
    const q = JSON.parse(json), o = by.get(+id); delete q.rating; delete q.fun;
    if (o && !o.broken) { q.rating = o.rating; q.fun = o.fun; }
    return ind + JSON.stringify(q) + comma;
  });
  fs.writeFileSync(FILE, src);
  fs.writeFileSync(path.join(__dirname, 'ratings.json'), JSON.stringify({ made: 'node web/tools/puzzles/rate.js', N, FIND, SIG: { A: SIG_A, V: SIG_V, T: SIG_T }, levels: LEVELS, puzzles: out }, null, 1) + '\n');
  console.log('wrote web/puzzles.js and tools/puzzles/ratings.json');
}
