/* The shot judge (ai/60-judge.js): set tables, shots played on them, what the judge must say - and that its sums for a
   pot's chance agree with the physics. Run with `node web/test/judge.js` (about a minute). Exits non-zero on failure. */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..');
const createPhysics = require(path.join(W, 'physics.js')), createGameRaw = require(path.join(W, 'game.js'));
const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const bar = { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 };
const g = createGameRaw({ pool: createPhysics(Object.assign({ pockets: true }, bar)), carom: createPhysics({ R: 0.03275, pockets: false }) }, createAI);
let failed = 0, ok = 0; const fail = m => { failed++; console.log('FAIL', m); }, check = (c, m) => c ? ok++ : fail(m);
const GR = ['예술', '좋음', '무난', '아쉬움', '실수'], K = () => g.aiJudge;
const times = { pool: [], carom: [] };
const judge = shot => { const t = Date.now(), r = g.aiReview({ pos: null, a: 0, b: 0, el: 0, ...shot }); times[g.P.POCKETED ? 'pool' : 'carom'].push(Date.now() - t); return r; };
const say = r => `${GR[r.grade]}${r.fluke ? ' 요행' : ''} (made ${r.made}, loss ${r.loss}, p ${r.p}, cause ${r.cause})`;

// ---- 8볼: a table set by hand (the player on solids)
function eight(balls, cue) {
  g.start('eight', ['A', 'B'], true, { level: 3 });
  const w = g.world; for (const b of w.balls) { b.on = false; b.x = 9 + b.id; b.y = 9; }
  g.P.place(w, 0, cue[0], cue[1]); for (const id in balls) g.P.place(w, +id, balls[id][0], balls[id][1]);
  g.isBreak = false; g.placing = null; g.turn = 0; g.players[0].group = 'solid'; g.players[1].group = 'stripe';
}
const P = g.P, R = P.R;
const ghostAim = (cue, T, k) => { const pk = P.POCKETS[k], ux = pk.ax - T[0], uy = pk.ay - T[1], L = Math.hypot(ux, uy); return Math.atan2(T[1] - uy / L * 2 * R - cue[1], T[0] - ux / L * 2 * R - cue[0]); };
// the middle of the aims that pot ball id (in pocket k, if given) with this stroke, near an aim; null if none does
function potAim(id, near, V, b = 0, k = null) {
  const pots = a => { const w = P.clone(g.world); P.strike(w, a, V, 0, b); const ev = P.run(w, 20); return ev.pocketed.some(q => q.id === id && (k == null || q.pocket === k)) && !ev.pocketed.some(q => q.id === 0); };
  let lo = null; for (let d = -0.02; d <= 0.02; d += 0.0004) if (pots(near + d)) { lo = near + d; break; }
  if (lo == null) return null; let hi = lo; while (pots(hi + 0.0002)) hi += 0.0002; return (lo + hi) / 2;
}
{
  // an easy straight pot into the top right corner
  const pk = P.POCKETS[2], T = [pk.ax - 0.35, pk.ay - 0.175], ux = pk.ax - T[0], uy = pk.ay - T[1], L = Math.hypot(ux, uy), cue = [T[0] - ux / L * 0.4, T[1] - uy / L * 0.4];
  eight({ 1: T, 2: [-0.3, 0.3], 8: [0.2, -0.35], 9: [-0.6, -0.3], 10: [0.2, -0.1] }, cue);
  const aim = potAim(1, ghostAim(cue, T, 2), 2.2, 0, 2);
  const made = judge({ angle: aim, V: 2.2 });
  check(made.made && made.grade <= 2 && !made.fluke, `easy straight made: ${say(made)}`);
  const missed = judge({ angle: aim + 0.03, V: 2.2 });
  check(!missed.made && missed.grade === 4 && /thin|thick/.test(missed.cause), `easy straight missed by a mile: ${say(missed)}`);
  const soft = judge({ angle: aim, V: 0.5 });
  check(!soft.made && soft.grade >= 3 && /soft|norail/.test(soft.cause), `easy straight, far too soft (short, or a foul for no cushion): ${say(soft)}`);
  const near = judge({ angle: aim + 0.004, V: 2.2 });
  check(near.made || near.grade >= 2, `easy straight, a hair off: ${say(near)}`);
}
{
  // a long, thin cut on ball 1 - hard -, with ball 3 an easy pot besides: made with the next shot set, 예술; made leaving
  // little, not; missed, the easier ball named
  const T = [0.84, 0.11], cue = [-0.81, 0.07];
  eight({ 1: T, 2: [0.3, 0.3], 3: [-0.2, -0.3], 8: [0.6, -0.42], 9: [-0.85, -0.4], 12: [-0.85, 0.4] }, cue);
  const line = K().potLines(g.world, 0, K().judgeView(g.world, 0), false).find(l => l.id === 1 && l.kind === 'pot');
  check(line && line.p < 0.4, `the thin cut is a hard line (${line && line.p.toFixed(2)})`);
  const got = [];
  for (const V of [1.6, 2.6, 3.8]) for (const b of [-0.5, 0, 0.5]) { const a = line && potAim(1, line.angle, V, b); if (a != null) got.push(judge({ angle: a, V, b })); }
  const made = got.filter(r => r.made && !r.fluke);
  check(made.some(r => r.grade === 0), `the hard cut made with a good leave is 예술: ${made.map(say).join(' / ')}`);
  check(made.every(r => r.grade !== 0 || r.leave >= Math.max(0.4, 0.7 * r.bestLeave)), 'no 예술 with a poor leave');
  check(made.some(r => r.grade !== 0), `not every way of making it is 예술: ${made.map(say).join(' / ')}`);
  // (a miss: the first aim off the line that goes in nowhere - one a little off can go in by a kiss, a 요행)
  let off = null; for (const d of [0.012, -0.012, 0.018, -0.018, 0.025]) { const w = P.clone(g.world); P.strike(w, line.angle + d, 2.6, 0, 0); const ev = P.run(w, 20); if (!ev.pocketed.length) { off = d; break; } }
  const miss = line && off != null && judge({ angle: line.angle + off, V: 2.6 });
  check(miss && !miss.made && miss.grade >= 3 && miss.better && miss.better.easier, `the hard cut missed with an easy ball on: ${miss && say(miss)} better ${JSON.stringify(miss && miss.better && { id: miss.better.id, easier: miss.better.easier })}`);
}
{
  // the cue ball following the object ball in: a scratch, a foul, 실수
  const pk = P.POCKETS[2], T = [pk.ax - 0.25, pk.ay - 0.12], ux = pk.ax - T[0], uy = pk.ay - T[1], L = Math.hypot(ux, uy), cue = [T[0] - ux / L * 0.3, T[1] - uy / L * 0.3];
  eight({ 4: T, 2: [-0.3, 0.3], 8: [0.1, -0.35], 9: [0.1, -0.3], 12: [-0.7, 0.35] }, cue);
  let shot = null;
  for (const V of [2.5, 3.5, 4.5]) for (const b of [0.6, 0.8]) { const w = P.clone(g.world); P.strike(w, ghostAim(cue, T, 2), V, 0, b); const ev = P.run(w, 20); if (!shot && ev.pocketed.some(q => q.id === 0)) shot = { angle: ghostAim(cue, T, 2), V, b }; }
  if (shot) { const r = judge(shot); check(r.foul && r.cause === 'scratch' && r.grade === 4, `scratch: ${say(r)}`); }
  else fail('no scratch found to judge');
}
{
  // snookered behind a wall of stripes: no plain pot, but a kick off the cushion - the judge must see it and name it
  eight({ 1: [0.55, 0.25], 9: [0.0, 0.05], 10: [0.0, 0.12], 11: [0.0, -0.02], 12: [0.0, 0.19], 13: [0.0, -0.09], 8: [-0.7, -0.4] }, [-0.5, 0.1]);
  const v = K().judgeView(g.world, 0), ex = K().potExtras(g.world, 0, v);
  check(!K().potLines(g.world, 0, v, false).length && ex.some(l => l.kind === 'kick'), 'snookered: no plain pot, a kick found');
  check(ex.some(l => K().judgeAim(g.world, 0, { pos: null, angle: l.angle, V: 3, a: 0, b: 0, el: 0 }, v) != null), 'a kick\'s aim that really goes in, found on the physics');
  const whack = judge({ angle: 0, V: 3 });
  check(whack.better && whack.better.kind === 'kick', `a blind whack: the kick shown as the better shot (${whack.better && whack.better.kind})`);
}
{
  // a combination: ball 1 (legal) into ball 9's... no - 9볼: the lowest ball into the 9, the 9 in the corner
  g.start('nine', ['A', 'B'], true, { level: 3 });
  const w = g.world; for (const b of w.balls) { b.on = false; b.x = 9 + b.id; b.y = 9; }
  const pk = P.POCKETS[2], B9 = [pk.ax - 0.3, pk.ay - 0.15], u = [(pk.ax - B9[0]) / Math.hypot(pk.ax - B9[0], pk.ay - B9[1]), (pk.ay - B9[1]) / Math.hypot(pk.ax - B9[0], pk.ay - B9[1])];
  P.place(w, 9, B9[0], B9[1]); P.place(w, 1, B9[0] - u[0] * 0.2, B9[1] - u[1] * 0.2); P.place(w, 0, B9[0] - u[0] * 0.55, B9[1] - u[1] * 0.55 - 0.05); P.place(w, 2, -0.6, -0.3);
  g.isBreak = false; g.placing = null; g.turn = 0;
  const ex = K().potExtras(w, 0, K().judgeView(w, 0));
  check(ex.some(l => l.kind === 'combo' && l.via === 9), `9볼: the combination on the 9 found (${ex.map(l => l.kind + (l.via || '')).join(' ')})`);
}
// ---- the pot sums against the physics: random tables, one ball, every pocket - the chance worked out, and the window
// found by playing it (the best of three paces)
{
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  g.start('nine', ['A', 'B'], true, { level: 3 });
  const erf = K().winChance; let sum = 0, n = 0;
  for (let i = 0; i < 70; i++) {
    const w = g.world; for (const b of w.balls) { b.on = false; b.x = 9 + b.id; b.y = 9; }
    const T = [(rnd() * 2 - 1) * (P.HL - 0.08), (rnd() * 2 - 1) * (P.HW - 0.08)], C = [(rnd() * 2 - 1) * (P.HL - 0.08), (rnd() * 2 - 1) * (P.HW - 0.08)];
    if (Math.hypot(T[0] - C[0], T[1] - C[1]) < 0.15) continue;
    P.place(w, 0, C[0], C[1]); P.place(w, 1, T[0], T[1]); g.isBreak = false; g.placing = null; g.turn = 0;
    for (const l of K().potLines(w, 0, K().judgeView(w, 0), false).filter(l => l.kind === 'pot')) {
      let best = 0;
      for (const V of [1.4, 2.4, 3.6]) {
        const pots = da => { const x = P.clone(w); P.strike(x, l.angle + da, V, 0, 0); return P.run(x, 20).pocketed.some(q => q.id === 1 && q.pocket === l.pocket); };
        let c0 = null; for (const d of [0, 0.001, -0.001, 0.002, -0.002, 0.004, -0.004, 0.007, -0.007, 0.01, -0.01]) if (pots(d)) { c0 = d; break; }
        if (c0 == null) continue;
        const end = s => { let lo = 0, hi = 0.002; while (hi < 0.1 && pots(c0 + s * hi)) { lo = hi; hi *= 2; } for (let j = 0; j < 7; j++) { const m = (lo + hi) / 2; if (pots(c0 + s * m)) lo = m; else hi = m; } return lo; };
        best = Math.max(best, erf((end(1) + end(-1)) / 2));
      }
      sum += Math.abs(best - l.p); n++;
    }
  }
  check(n > 60 && sum / n < 0.09, `the worked-out pot chances agree with the physics: ${n} pots, mean error ${(sum / n).toFixed(3)}`);
}
// ---- 4구 and 3쿠션: a line the judge itself finds, played as found and played wide
for (const [mode, opts] of [['four', {}], ['three', { cushions: 3 }]]) {
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let tried = 0, found = 0;
  for (let i = 0; i < 12 && found < 2; i++) {
    g.start(mode, ['A', 'B'], true, { level: 3, rnd, ...opts }); g.isBreak = false; g.turn = 0; g.world.cue = 0;
    const lines = K().caromLines(g.world, 0, K().judgeView(g.world, 0), true); tried++;
    const l = lines.find(x => x.p > (mode === 'four' ? 0.5 : 0.2)); if (!l) continue; found++;
    const made = judge({ angle: l.angle, V: l.V, a: l.a, b: l.b });
    check(made.made && made.grade <= 2, `${mode}: a line played as found: ${say(made)}`);
    const wide = judge({ angle: l.angle + 0.08, V: l.V, a: l.a, b: l.b });
    check(wide.made || wide.grade >= 2, `${mode}: the same played wide: ${say(wide)}`);
  }
  check(found > 0, `${mode}: a scoring line found on ${tried} tables`);
  if (mode === 'three') { const t0 = Date.now(), cf = K().cushionFirst(g.world, 0, K().judgeView(g.world, 0)); check(Array.isArray(cf) && cf.every(l => l.p >= 0 && l.p <= 1) && Date.now() - t0 < 8000, `3쿠션: cushion-first lines swept (${cf.length}, ${Date.now() - t0} ms)`); }
}
const avg = L => L.length ? Math.round(L.reduce((s, v) => s + v, 0) / L.length) : 0;
console.log(`judging: pool ${avg(times.pool)} ms, carom ${avg(times.carom)} ms on average`);
check(avg(times.pool) < 2500 && avg(times.carom) < 5000, 'a judging stays within a few seconds');
console.log(`judge: ${ok} checks passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
