/* Makes the four-ball puzzles, one stage at a time:   node web/tools/gen-puzzles.js <stage 0..6> <how many> [seed]
   then  node web/tools/pack-puzzles.js  writes web/puzzles.js from what the stages produced (tools/out/s<stage>.json).

   Positions come from games: two computer players play four-ball and every position one of them had to shoot from is kept
   (tools/out/mined.json). A stage takes those positions - as they are, or with one ball moved to set up the shot the stage
   is about - plays out every direction at several speeds on each, and keeps a position when the share of shots that do what
   the stage asks falls in the stage's range (a smaller share is a harder puzzle) and one of them survives being played a
   touch off. Nothing gets in without an answer that has been seen to work. */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
const createPhysics = require(path.join(W, 'physics.js')), createGame = require(path.join(W, 'game.js'));
const P = createPhysics({ R: 0.03275, pockets: false }), { R, HL, HW } = P;
const G = createGame({ pool: createPhysics({ R: 0.028575, pockets: true, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 }), carom: P });
const judge = (goal, ev, w) => G.MODES.puzzle4.judge(goal, ev, w).ok;
const stage = +process.argv[2], WANT = +process.argv[3] || 14;
let seed = (+process.argv[4] || 20261006) + stage * 7919;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const between = (a, b) => a + (b - a) * rnd(), r3 = x => Math.round(x * 1000) / 1000, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

/* ---- positions out of real games ---- */
function mine(n) {
  const out = []; let s2 = 99; const r2 = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
  while (out.length < n) {
    G.start('four', ['A', 'B'], true, { level: 2, target: 12, rnd: r2, levels: [r2() < 0.5 ? 1 : 2, r2() < 0.5 ? 0 : 2] }); G.players[0].ai = true;
    let k = 0;
    while (!G.over && k < 60) {
      const b = G.world.balls, me = G.turn;
      if (k > 1) out.push([[b[me].x, b[me].y], [b[1 - me].x, b[1 - me].y], [b[2].x, b[2].y], [b[3].x, b[3].y]].map(q => q.map(r3)));   // the shooter's ball first
      const pl = G.aiPlan(); G.beginShot(); P.strike(G.world, pl.angle, pl.V, 0, 0); P.run(G.world, 40); G.world.snd.length = 0; G.resolve(); k++;
    }
  }
  return out;
}
const minedFile = path.join(OUT, 'mined.json');
if (!fs.existsSync(minedFile)) { process.stderr.write('mining positions from games...\n'); fs.writeFileSync(minedFile, JSON.stringify(mine(1500))); }
const MINED = JSON.parse(fs.readFileSync(minedFile));
G.start('four', ['A', 'B'], false, {});                             // so that speeds are turned into power the way a four-ball game does

function world(balls) { const w = P.makeWorld(4); balls.forEach((b, i) => P.place(w, i, b[0], b[1], () => 0.5)); return w; }
const valid = b => { for (let i = 0; i < 4; i++) { if (Math.abs(b[i][0]) > HL - R - 0.02 || Math.abs(b[i][1]) > HW - R - 0.02) return false; for (let j = 0; j < i; j++) if (dist(b[i], b[j]) < 2 * R + 0.03) return false; } return true; };
// one shot: does it do what the stage asks?
function tryShot(base, goal, s) { const w = P.clone(base); P.strike(w, s[0], s[1], s[2] || 0, s[3] || 0, s[4] || 0); return judge(goal, P.run(w, 25), w); }
// every direction in `angles` at each speed, with one way of striking: the share that works, and the middle of the widest run
function sweep(base, goal, angles, Vs, a, b, el) {
  let hits = 0, best = null; const n = angles.length, loop = angles.loop;
  for (const V of Vs) {
    const ok = angles.map(ang => tryShot(base, goal, [ang, V, a, b, el]));
    for (let i = 0; i < n; i++) if (ok[i]) hits++;
    for (let i = 0; i < n; i++) if (ok[i] && !(loop ? ok[(i + n - 1) % n] : i > 0 && ok[i - 1])) {
      let m = 1; while (m < n && (loop ? ok[(i + m) % n] : i + m < n && ok[i + m])) m++;
      if (!best || m > best.n) best = { n: m, sol: [angles[(i + Math.floor((m - 1) / 2)) % n], V, a, b, el || 0] };
    }
  }
  return { share: hits / (n * Vs.length), best };
}
const circle = n => { const a = []; for (let i = 0; i < n; i++) a.push(i * 2 * Math.PI / n); a.loop = true; return a; };
const fan = (mid, half, step) => { const a = []; for (let x = -half; x <= half + 1e-9; x += step) a.push(mid + x); return a; };
const ALL = circle(600);
function sturdy(base, goal, s) {
  for (const da of [0, 0.0025, -0.0025]) for (const k of [1, 0.985, 1.015]) if (!tryShot(base, goal, [s[0] + da, s[1] * k, s[2], s[3], s[4]])) return false;
  // and through the app's power control, which is how the "answer" button plays it
  return tryShot(base, goal, [s[0], G.vOf(G.powerOf(s[1])), s[2], s[3], s[4]]);
}
const pick = () => MINED[Math.floor(rnd() * MINED.length)].map(q => q.slice());
const onLine = (a, b, k, j) => [a[0] + (b[0] - a[0]) * k + between(-j, j), a[1] + (b[1] - a[1]) * k + between(-j, j)];
const near = (b, i) => dist(b[0], b[2]) <= dist(b[0], b[3]) ? (i ? 3 : 2) : (i ? 2 : 3);     // the red nearer the cue ball (i=0) or the other

/* ---- the stages ---- each: goal, how to get a position, how to look for the answer, and the share that makes it fit */
const STAGES = [
  { name: '첫 득점', goal: 'score', lo: 0.05, hi: 0.2, make: pick, ok: b => dist(b[2], b[3]) < 0.55 && dist(b[0], b[near(b, 0)]) < 1.1,
    solve: w => sweep(w, 'score', ALL, [2.4, 3.4, 4.6], 0, 0) },
  { name: '모아치기', goal: 'gather', lo: 0.004, hi: 0.05, make: pick, ok: b => dist(b[2], b[3]) < 0.6 && dist(b[0], b[near(b, 0)]) < 0.9,
    solve: w => sweep(w, 'gather', ALL, [1.5, 2.0, 2.6, 3.3], 0, 0) },
  { name: '밀어치기 · 끌어치기', goal: 'direct', lo: 0.004, hi: 0.05,
    // the second red straight on past the first (follow) or back behind the cue ball (draw); hit without spin the cue ball goes neither way
    make() { const c = [between(-HL + 0.3, HL - 0.3), between(-HW + 0.25, HW - 0.25)], th = between(0, 6.28), d1 = between(0.22, 0.5), r1 = [c[0] + Math.cos(th) * d1, c[1] + Math.sin(th) * d1];
      const draw = rnd() < 0.5, t2 = th + (draw ? Math.PI : 0) + between(-0.4, 0.4), d2 = between(0.3, 0.75), o = draw ? c : r1, r2 = [o[0] + Math.cos(t2) * d2, o[1] + Math.sin(t2) * d2];
      let y; do { y = [between(-HL + 0.15, HL - 0.15), between(-HW + 0.15, HW - 0.15)]; } while (dist(y, c) < 0.4 || dist(y, r1) < 0.3 || dist(y, r2) < 0.3);
      return [c, y, r1, r2].map(q => q.map(r3)); },
    ok: () => true,
    solve(w, b) {
      const mid = Math.atan2(b[2][1] - b[0][1], b[2][0] - b[0][0]), half = Math.asin(Math.min(1, 2 * R / dist(b[0], b[2]))) * 1.05, A = fan(mid, half, half / 40), Vs = [2.6, 3.6, 4.8];
      if (sweep(w, 'direct', A, Vs, 0, 0).share > 0.004) return null;                       // goes in without spin: not what this stage is for
      let best = null; for (const sb of [0.36, -0.36, 0.25, -0.25]) { const s = sweep(w, 'direct', A, Vs, 0, sb); if (s.best && (!best || s.share > best.share)) best = s; }
      return best; } },
  { name: '빈쿠션', goal: 'bank', lo: 0.004, hi: 0.045, make: pick, ok: b => dist(b[2], b[3]) < 0.9,
    solve: w => sweep(w, 'bank', ALL, [2.6, 3.6, 4.8], 0, 0) },
  { name: '상대 공 피해 가기', goal: 'score', lo: 0.005, hi: 0.03,
    make() { const b = pick(), n = near(b, 0); b[1] = onLine(b[0], b[n], between(0.35, 0.65), 0.025).map(r3); return b; }, ok: b => dist(b[0], b[near(b, 0)]) > 0.55,
    solve: w => sweep(w, 'score', ALL, [2.4, 3.4, 4.6], 0, 0) },
  { name: '돌려치기', goal: 'three', lo: 0.003, hi: 0.03, make: pick, ok: b => dist(b[2], b[3]) < 1.2,
    solve: w => sweep(w, 'three', ALL, [4.2, 5.2, 6.2], 0, 0) },
  { name: '맛세이 · 점프', goal: 'direct', lo: 0.006, hi: 0.5,
    // the yellow ball right in front of the cue ball, the reds beyond it: over it or round it, with no cushion to help
    make() { const b = pick(), n = near(b, 0), d = dist(b[0], b[n]); b[1] = onLine(b[0], b[n], between(0.2, 0.42) / d, 0.008).map(r3); const m = near(b, 1); if (dist(b[n], b[m]) > 0.45) { const t = between(0, 6.28), l = between(0.16, 0.36); b[m] = [r3(b[n][0] + Math.cos(t) * l), r3(b[n][1] + Math.sin(t) * l)]; } return b; },
    ok: b => { const n = near(b, 0), d = dist(b[0], b[n]); return d > 0.75 && d < 1.5; },
    solve(w, b) {
      const n = near(b, 0), mid = Math.atan2(b[n][1] - b[0][1], b[n][0] - b[0][0]);
      if (sweep(w, 'direct', fan(mid, 0.5, 0.004), [2.6, 3.6, 4.8], 0, 0).share > 0.002) return null;   // there is a plain way through
      // over it: the cue raised to a whole number of degrees and struck hard. Round it: steeper, softer, with side on the ball
      const D = Math.PI / 180; let best = { share: 0, best: null };
      for (const dg of [40, 50]) { const s = sweep(w, 'direct', fan(mid, 0.2, 0.003), [5.6, 6.2, 6.8], 0, 0, dg * D); if (s.best && (!best.best || s.best.n > best.best.n)) best = s; }
      for (const a of [0.42, -0.42]) for (const dg of [55, 70]) { const s = sweep(w, 'direct', fan(mid, 0.7, 0.006), [3.2, 4.2], a, 0, dg * D); if (s.best && (!best.best || s.best.n > best.best.n + 2)) best = s; }
      return best; } },
];

const T = STAGES[stage], found = [], seen = new Set(); let tries = 0; const t0 = Date.now();
while (found.length < WANT && tries < 30000) {
  tries++; const balls = T.make();
  if (!valid(balls) || !T.ok(balls)) continue;
  const key = balls.join(';'); if (seen.has(key)) continue; seen.add(key);
  // not two puzzles that look the same: the reds and the cue ball each somewhere new
  if (found.some(f => dist(f.balls[0], balls[0]) + dist(f.balls[2], balls[2]) + dist(f.balls[3], balls[3]) < 0.5)) continue;
  const base = world(balls), s = T.solve(base, balls);
  if (!s || !s.best || s.share < T.lo || s.share > T.hi || s.best.n < 3) continue;
  const sol = s.best.sol.map((v, i) => i === 0 ? Math.round(v * 1e5) / 1e5 : v);
  if (!sturdy(base, T.goal, sol)) continue;
  found.push({ share: s.share, balls, sol });
  process.stderr.write(`stage ${stage} ${T.name}: ${found.length}/${WANT} after ${tries} tries, ${Math.round((Date.now() - t0) / 1000)}s (share ${(s.share * 100).toFixed(2)}%)\n`);
  fs.writeFileSync(path.join(OUT, `s${stage}.json`), JSON.stringify({ name: T.name, goal: T.goal, list: found }));
}
console.log(`stage ${stage}: ${found.length} puzzles`);
