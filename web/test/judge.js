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
const say = r => `${GR[r.grade]}${r.fluke ? ' 행운' : ''}${r.unlucky ? ' 불운' : ''} (made ${r.made}, loss ${r.loss}, p ${r.p}, cause ${r.cause})`;

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
  // what the coach is told: the ball met, potted where, the stroke; and the other ways, one easiest
  check(made.d && made.d.first === 1 && made.d.potted.some(([id, k]) => id === 1 && k === 2) && Math.abs(made.d.cut) < 6 && made.d.pace > 0, `the shot described: ${JSON.stringify(made.d)}`);
  const ways = (made.alts || []).map(a => a.way);
  // what it meant: the ball and pocket, and where the stroke sent the cue ball (the best of its paces at least its own)
  const it = made.intent || {};
  check(it.kind === 'score' && it.target && it.target.id === 1 && it.target.pocket === 2 && it.shape && it.shape.best.v >= (it.shape.own ? it.shape.own.v : 0), `the intent read: ${JSON.stringify(it)}`);
  check(made.facts && Math.abs(made.facts.cut) < 6 && made.facts.scratch >= 0 && made.facts.tight === false, `the facts of the shot: ${JSON.stringify(made.facts)}`);
  check(ways.length >= 2 && new Set(ways).size === ways.length && made.alts.filter(a => a.easiest).length === 1 && made.alts.every(a => a.d && a.shot), `other ways to play it: ${ways.join(', ')}`);
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
  // (owner 11-19, the house style: 예술 only where the ordinary way was shut - ball 3 is an easy pot here, so the hard cut
  // made is 좋음 or 무난 by its leave, never 예술)
  check(made.length && made.every(r => r.grade !== 0) && made.some(r => r.grade === 1), `the hard cut made, an easy ball besides, is not 예술: ${made.map(say).join(' / ')}`);
  check(made.every(r => r.grade !== 0 || r.leave >= Math.max(0.4, 0.7 * r.bestLeave)), 'no 예술 with a poor leave');
  // (owner 11-18: a made shot is graded by its leave - set, 좋음 or, the line hard, 예술; left poor, 무난. The line here is
  // hard, so every way of making it is 예술 or 무난)
  check(made.every(r => r.grade === 1 || r.grade === 2), `the hard cut made is 좋음 or 무난, by its leave: ${made.map(say).join(' / ')}`);
  // (a miss: the first aim off the line that goes in nowhere - one a little off can go in by a kiss, a 요행)
  let off = null; for (const d of [0.012, -0.012, 0.018, -0.018, 0.025]) { const w = P.clone(g.world); P.strike(w, line.angle + d, 2.6, 0, 0); const ev = P.run(w, 20); if (!ev.pocketed.length) { off = d; break; } }
  const miss = line && off != null && judge({ angle: line.angle + off, V: 2.6 });
  check(miss && miss.alts.some(a => a.best && a.why && a.why.length), `the better way's reasons: ${miss && JSON.stringify(miss.alts.map(a => [a.way, a.id, a.why]))}`);
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
// ---- the raised cue (11-19, 53-raised.js): 1 hidden behind the 9 - the other ways include a jump or a massé, and a
// raised stroke played is told as one
{
  eight({ 1: [0.55, 0.09], 9: [-0.15, 0], 13: [0.2, -0.35], 8: [-0.7, 0.35] }, [-0.4, 0]);
  const tries = K().raisedShots(g.world, 0, { ...g, isBreak: false }, { masse: true, jump: true, skill: 0.8, cap: 20 });
  check(tries.some(t => t.kind === 'jump') && tries.some(t => t.kind === 'masse'), `raised strokes offered: ${tries.map(t => t.kind).join(',')}`);
  const jump = tries.find(t => t.kind === 'jump' && t.el >= 0.8 && t.V < g.vOf(0.9)) || tries.find(t => t.kind === 'jump');
  const r = judge(jump);
  check(r && r.d && r.d.raised === 'jump', `a jump told as one: ${r && JSON.stringify(r.d)}`);
  const m = judge(tries.find(t => t.kind === 'masse'));
  check(m && m.d && m.d.raised === 'masse' && m.d.thick == null, `a massé told as one (no straight-line thickness): ${m && JSON.stringify(m.d)}`);
  check(r && r.alts.some(a => a.way === 'jump' || a.way === 'masse'), `the raised ways among the others: ${r && r.alts.map(a => a.way).join(',')}`);
}
// ---- the chance to win (59-win.js): a race, the shooter first at the leave's chance
{
  const r = K().winRace(0.5);
  check(r.W(5, 5, 0.9) > r.W(5, 5, 0.1) && r.W(1, 5, 0.5) > r.W(5, 5, 0.5) && r.W(5, 1, 0.5) < r.W(5, 5, 0.5) && Math.abs(r.V[7][7] + r.V[7][7] - 1) < 0.2, 'the race: a better leave, fewer to go - more chance');
  const k = K().routeOf({ seq: ['L', 2, 'L', 'S', 'L', 3] }), b = K().routeOf({ seq: [2, 'L', 'S', 'L', 'S', 3] });
  check(k.pre === 1 && k.name === '원뱅크' && k.rails === '장-단-장' && b.name === '대회전', `routes named: ${JSON.stringify([k, b])}`);
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
    check(made.intent && made.intent.route && made.d.route && (mode === 'four' || made.d.cushions < 3 || made.d.route.rails.split('-').length + made.d.route.pre >= 3), `${mode}: the route read: ${JSON.stringify(made.d.route)}`);
    const wide = judge({ angle: l.angle + 0.08, V: l.V, a: l.a, b: l.b });
    check(wide.made || wide.grade >= 2, `${mode}: the same played wide: ${say(wide)}`);
  }
  check(found > 0, `${mode}: a scoring line found on ${tried} tables`);
  if (mode === 'three') { const t0 = Date.now(), cf = K().cushionFirst(g.world, 0, K().judgeView(g.world, 0)); check(Array.isArray(cf) && cf.every(l => l.p >= 0 && l.p <= 1) && Date.now() - t0 < 8000, `3쿠션: cushion-first lines swept (${cf.length}, ${Date.now() - t0} ms)`); }
}
// ---- 4구's 후구 (owner 11-19: '4구 마지막 샷일 때 성공하면 다음 배치가 안 좋을수록 좋은 건데'): the last point of the one
// who began does not win - it hands the other a visit, and is worth what it denies them; without 후구, it wins
{
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 12; i++) {
    g.start('four', ['A', 'B'], true, { level: 3, rnd, hugu: true, target: 5 }); g.isBreak = false; g.turn = 0; g.first = 0; g.world.cue = 0; g.players[0].score = 4;
    const l = K().caromLines(g.world, 0, K().judgeView(g.world, 0), true).find(x => x.p > 0.5); if (!l) continue;
    const r = judge({ angle: l.angle, V: l.V, a: l.a, b: l.b });
    check(r.made && r.pass && !r.won && r.theirs != null && r.grade <= 2 && (r.alts || []).every(a => !a.pass || !(a.why || []).some(w => w.k === 'pos')), `4구 후구: the last point passes, judged by what it leaves: ${say(r)} (theirs ${r.theirs})`);
    g.hugu = false; const w = judge({ angle: l.angle, V: l.V, a: l.a, b: l.b });
    check(w.won && !w.pass && w.grade <= 1, `4구 without 후구: the last point wins: ${say(w)}`);
    g.hugu = true; g.chance = 0; g.turn = 1; g.world.cue = 1; g.players[1].score = 4;
    const l2 = K().caromLines(g.world, 1, K().judgeView(g.world, 1), true).find(x => x.p > 0.3);
    if (l2) { const t = judge({ angle: l2.angle, V: l2.V, a: l2.a, b: l2.b }); check(t.made ? t.tie && !t.won : t.lost, `4구 후구, caught up: a draw, not a win; missed: the game: ${say(t)}`); }
    // (owner 11-19: '후구 상태라서 득점 못 하면 지는데 수비해서 좋습니다가 나옴' - in the 후구, a miss is the game: never good,
    // never a safety)
    const gone = judge({ angle: (l2 || l).angle + 1.2, V: 1.2 });
    check(!gone.made && gone.lost && gone.grade >= 3 && gone.intent.kind !== 'safety' && gone.rule && gone.rule.chase, `4구 후구, missed: lost, never a good safety: ${say(gone)}`);
    break;
  }
}
// ---- 행운 · 불운 (owner 11-25; the seeing AI, ai/64-see-mind.js seeKiss): a point made through a kiss is luck to a player
// who would not have seen it coming and did not aim for it - the kiss struck at a stroke nobody plays for, at 600; a
// line the kiss spoilt (with nothing to kiss it comes off) is bad luck to one who did not see the kiss, and nothing to
// say where the line was not right anyway; a kiss on the moving ball's own line is plain to see. (A kiss way aimed for,
// meant by one who sees it: test/see.js)
{
  let seed = 5; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let kissed = 0, told = 0, spoilt = 0, saidSpoilt = 0;
  for (let tbl = 0; tbl < 8 && (kissed < 3 || spoilt < 2); tbl++) {
    g.start('four', ['A', 'B'], true, { level: 3, rnd }); g.isBreak = false; g.turn = 0; g.world.cue = 0;
    for (let k = 0; k < 360 && (kissed < 3 || spoilt < 2); k++) {
      const angle = k / 360 * Math.PI * 2, V = g.vOf(0.55), C = g.P, w = C.clone(g.world); w.cue = 0; C.strike(w, angle, V, 0, 0, 0); const ev = C.run(w, 20);
      if (!(ev.kissPre > 0)) continue;
      const scored = ev.hits.includes(2) && ev.hits.includes(3) && !ev.hits.includes(1), see = K().see;
      if (scored && kissed < 3) {
        const sk = see.seeKiss(g.world, 0, { angle, V, a: 0, b: 0, el: 0 }, null, 600); if (!sk || sk.right) continue;
        const lo = judge({ angle, V, rating: 600 }); if (!lo.made) continue; kissed++;
        if (lo.fluke && lo.kissMeant < 0.35) told++; else fail(`a kiss point at a stroke nobody plays for, at 600: ${say(lo)} meant ${lo.kissMeant}`);
      } else if (!scored && spoilt < 2) {
        const lo = judge({ angle, V, rating: 600 }); if (lo.cause !== 'kiss') continue; spoilt++;
        const sk = see.seeKiss(g.world, 0, { angle, V, a: 0, b: 0, el: 0 }, null, 600), want = !!sk && sk.spoiled && sk.seen < 0.35;
        if (lo.unlucky === want) saidSpoilt++; else fail(`a line a kiss took, to a 600 player: ${say(lo)} unlucky ${lo.unlucky}, spoiled ${sk && sk.spoiled} seen ${sk && sk.seen}`);
      }
    }
  }
  check(kissed >= 2 && told === kissed, `kiss points at strokes nobody plays for: luck to a 600 player (${told}/${kissed})`);
  check(spoilt === 0 || saidSpoilt === spoilt, `a line a kiss took: bad luck only where the line was right and the kiss unseen (${saidSpoilt}/${spoilt})`);
  // (a kiss on the moving ball's own line: the red sent straight into the other red)
  g.start('four', ['A', 'B'], true, { level: 3, rnd }); g.isBreak = false; g.turn = 0; g.world.cue = 0;
  const w0 = g.world, place = (id, x, y) => g.P.place(w0, id, x, y); place(0, -0.8, 0); place(1, -0.8, 0.5); place(2, -0.3, 0); place(3, 0.3, 0);
  const st = K().kissStory ? K().kissStory(w0, 0, { angle: 0, V: g.vOf(0.5), a: 0, b: 0, el: 0 }) : null;
  check(st && st.kind === 'obj' && st.straight, `a red sent straight into the other: a plain kiss ${JSON.stringify(st)}`);
}
const avg = L => L.length ? Math.round(L.reduce((s, v) => s + v, 0) / L.length) : 0;
console.log(`judging: pool ${avg(times.pool)} ms, carom ${avg(times.carom)} ms on average`);
check(avg(times.pool) < 2500 && avg(times.carom) < 5000, 'a judging stays within a few seconds');
console.log(`judge: ${ok} checks passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
