/* Checks that need no browser: run with `node web/test/run.js`. Exits non-zero on failure.
   1. every practice drill, at every level, on every table size: the layout is valid and its reference shot passes
   2. computer-vs-computer games of every rule set finish, on every table size */
const path = require('path'), W = path.join(__dirname, '..');
// there is one physics, the one the game is played on
const createPhysicsRaw = require(path.join(W, 'physics.js')), createPhysics = cfg => createPhysicsRaw(cfg), createGame = require(path.join(W, 'game.js')), createDrills = require(path.join(W, 'drills.js'));
const TABLES = {
  bar: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 }, club: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 },
  pro: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 }, pub: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 },
};
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const vOf = p => 0.35 + 7.4 * Math.pow(p, 1.35);
let failed = 0; const fail = msg => { failed++; console.log('FAIL', msg); };

const D = createDrills();
for (const name in TABLES) {
  const P = createPhysics(Object.assign({ pockets: true }, TABLES[name]));
  let n = 0;
  for (const d of D.list) {
    if (!d.make || d.id === 'break') continue;
    for (let lv = 1; lv <= D.LEVELS; lv++) for (let k = 0; k < 12; k++) {
      const L = D.make(d.id, P, lv, rnd, vOf); n++;
      if (!L) { fail(`${name} ${d.id} level ${lv}: no layout`); continue; }
      const w = P.makeWorld(16); for (let i = 1; i < 16; i++) { w.balls[i].on = false; w.balls[i].x = 9 + i; w.balls[i].y = 9; }
      P.place(w, 0, L.cue[0], L.cue[1]); for (const [id, x, y] of L.balls) P.place(w, id, x, y);
      for (const b of w.balls) if (b.on && (Math.abs(b.x) > P.HL - P.R || Math.abs(b.y) > P.HW - P.R)) fail(`${name} ${d.id} level ${lv}: ball ${b.id} off the cloth`);
      P.strike(w, L.demo.angle, vOf(L.demo.power), L.demo.a, L.demo.b);
      const why = D.judge(L, P.run(w, 20), w.balls[0]);
      if (why) fail(`${name} ${d.id} level ${lv}: reference shot fails (${why})`);
    }
  }
  console.log(`drills on ${name}: ${n} layouts checked`);
}

// the top level: whenever it takes the table it has to keep it (a pot or a point on every shot), and so win from there
{
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  for (const mode of ['eight', 'nine', 'four', 'three']) {
    const N = 10; let worst = 0, shots = 0, missed = 0, turns = 0, sum = 0, spun = 0, multi = 0, tricks = 0;
    for (let i = 0; i < N; i++) {
      g.start(mode, ['A', 'B'], true, { level: 3, target: mode === 'three' ? 5 : 10, rnd, cushions: 3 }); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 400) {
        const who = g.turn, wasBreak = g.isBreak, t0 = Date.now(), pl = g.aiPlan(), ms = Date.now() - t0; worst = Math.max(worst, ms); sum += ms;
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
        if (!wasBreak) { turns++; if (!g.over && g.turn !== who) missed++; else if (g.over && g.over.winner !== who) missed++; }
        if (!wasBreak) { if (pl.a || pl.b) spun++; if (pl.pots > 1) multi++; if (pl.el) tricks++; }
      }
      if (!g.over) fail(`top level, ${mode}: game did not finish in 400 shots`);
      shots += n;
    }
    console.log(`top level, ${mode}: gave the table away ${missed} times in ${turns} shots, ${Math.round(shots / N)} shots a game, plans ${Math.round(sum / Math.max(1, shots))} ms on average, ${worst} ms at worst; ${spun} with spin, ${multi} potting two or more, ${tricks} with the cue raised`);
    if (missed > turns * 0.1) fail(`top level, ${mode}: gave the table away ${missed} times in ${turns} shots`);
  }
}

for (const name of ['bar', 'pro', 'pub']) {
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES[name])), carom: createPhysics({ R: 0.03275, pockets: false }) });
  for (const mode of ['eight', 'nine', 'four', 'three']) {
    let shots = 0; const N = 3;
    for (let i = 0; i < N; i++) {
      g.start(mode, ['A', 'B'], true, { level: 2, target: mode === 'three' ? 2 : 5, rnd, cushions: name === 'pro' ? 3 : name === 'pub' ? 1 : 0 }); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 400) {
        const pl = g.aiPlan();
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
        for (const b of g.world.balls) if (b.on && !(Number.isFinite(b.x) && Number.isFinite(b.y))) { fail(`${name} ${mode}: ball position is not a number`); n = 999; break; }
      }
      if (!g.over) fail(`${name} ${mode}: game did not finish in 400 shots`);
      shots += n;
    }
    console.log(`${mode} on ${name}: ${N} games, ${Math.round(shots / N)} shots each`);
  }
}
// games on the ice table finish too
{
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  for (const [mode, opt] of [['eight', { ice: true }], ['four', { ice: true }], ['nine', { ice: true }], ['three', { ice: true }]]) {
    let shots = 0; const N = 2;
    for (let i = 0; i < N; i++) {
      g.start(mode, ['A', 'B'], true, Object.assign({ level: 2, target: 4, rnd }, opt)); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 500) {
        const pl = g.aiPlan();
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 60); g.world.snd.length = 0; g.resolve(); n++;
        for (const b of g.world.balls) if (b.on && !(Number.isFinite(b.x) && Number.isFinite(b.y))) { fail(`ice ${mode}: ball position is not a number`); n = 999; break; }
      }
      if (!g.over) fail(`ice ${mode} ${JSON.stringify(opt)}: game did not finish in 500 shots`);
      shots += n;
    }
    console.log(`${mode} on ice: ${N} games, ${Math.round(shots / N)} shots each`);
  }
}
// highlights: every shot of a few games, in every mode, can be rated both ways, written down as a tape, and the tape ends
// where the real shot ended (so a reel shows what actually happened)
{
  const createHighlights = require(path.join(W, 'highlights.js')), H = createHighlights();
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  for (const mode of ['eight', 'nine', 'four', 'three']) {
    let tapes = 0, off = 0, bests = 0, worsts = 0;
    for (let i = 0; i < 3; i++) {
      g.start(mode, ['A', 'B'], true, { level: i, target: 3, rnd, cushions: 1 }); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 60) {
        const pl = g.aiPlan();
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot();
        const shot = { snap: H.snapshot(g.world), aim: pl.angle, V: pl.V, a: pl.a || 0, b: pl.b || 0, el: pl.el || null, turn: g.turn, isBreak: g.isBreak };
        g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 40); g.world.snd.length = 0;
        const ev = g.world.ev, end = g.world.balls.map(b => [b.x, b.y, b.on]), out = g.resolve(); n++;
        try {
          const good = H.rate(g.P, g.mode, shot, ev, out.r), bad = H.rateWorst(g.P, g.mode, shot, ev, out.r);
          for (const r of [good, bad]) {
            if (!(r.score > 0)) continue; if (r === good) bests++; else worsts++;
            const tape = H.record(g.P, g.world.balls.length, Object.assign({}, shot, r)); tapes++;
            if (!(tape.tKey >= 0 && tape.tKey <= tape.dur + 1e-6) || !Number.isFinite(tape.kx + tape.ky + tape.ux + tape.uy)) fail(`${mode}: tape has no usable key moment (${r.tag})`);
            const w2 = g.P.makeWorld(g.world.balls.length); H.seek(w2, tape, tape.dur);
            end.forEach((e, k) => { const b = w2.balls[k]; if (b.on !== e[2] || (e[2] && Math.hypot(b.x - e[0], b.y - e[1]) > 1e-3)) off++; });
            for (let k = 0; k < tape.nb; k++) H.path(tape, k);
          }
        } catch (e) { fail(`${mode}: highlights threw: ${e.message}`); }
      }
    }
    if (off) fail(`${mode}: ${off} ball(s) ended somewhere else on the tape than in the game`);
    console.log(`highlights, ${mode}: ${tapes} tapes (${bests} good shots, ${worsts} bad), all ending where the game did`);
  }
}
// puzzles: every one is on the cloth. Their stored answers were found on the realistic physics, which is gone; until the
// puzzles are made again on the game's, how many answers still work is only counted, not required
{
  const createPuzzles = require(path.join(W, 'puzzles.js')), Z = createPuzzles();
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  let bad = 0;
  for (const z of Z.list) {
    g.start('puzzle4', ['A', ''], false, {}); const P = g.P, w = g.world, goal = Z.STAGES[z.stage].goal;
    z.balls.forEach((b, i) => { P.place(w, i, b[0], b[1], rnd); if (Math.abs(b[0]) > P.HL - P.R || Math.abs(b[1]) > P.HW - P.R) { fail(`puzzle ${z.id}: ball ${i} off the cloth`); } });
    w.cue = 0;
    for (const V of [z.sol[1], g.vOf(g.powerOf(z.sol[1]))]) {
      const t = P.clone(w); P.strike(t, z.sol[0], V, z.sol[2], z.sol[3], z.sol[4]); const ev = P.run(t, 30);
      if (!g.MODES.puzzle4.judge(goal, ev, t).ok) { bad++; break; }
    }
  }
  // (none while they are made again)
  console.log(`puzzles: ${Z.list.length} in ${Z.STAGES.length} stages (${Z.STAGES.map((s, i) => s.name + ' ' + Z.of(i).length).join(', ')}), ${Z.list.length - bad} stored answers work`);
}
// Meetings at the same instant are settled together, not in the balls' order: two touching balls struck square between
// them come off alike, whatever their numbers; a straight break opens the rack evenly; a row of touching balls passes the
// blow along it; no group of blows makes energy.
{
  const P = createPhysics(Object.assign({ pockets: true }, TABLES.pro)), R = P.R;
  const sp = b => Math.hypot(b.vx, b.vy), KE = w => w.balls.reduce((a, b) => a + b.vx * b.vx + b.vy * b.vy, 0);
  for (const tick of [1 / 120, 1 / 1920]) {
    const got = [];
    for (const swap of [false, true]) {
      const w = P.makeWorld(3); P.place(w, 0, -0.3, 0); P.place(w, swap ? 2 : 1, 0, R); P.place(w, swap ? 1 : 2, 0, -R); P.strike(w, 0, 3, 0, 0, 0);
      let k0 = KE(w), up = 0, gain = 0; for (let t = 0; t < 0.2; t += tick) { P.step(w, tick); const k = KE(w); if (k > k0 + 1e-9) gain = Math.max(gain, k - k0); k0 = k; }
      const u = w.balls[swap ? 2 : 1], d = w.balls[swap ? 1 : 2];
      if (Math.abs(sp(u) - sp(d)) > 1e-9) fail(`touching pair, tick 1/${Math.round(1 / tick)}${swap ? ' swapped' : ''}: ${sp(u).toFixed(4)} vs ${sp(d).toFixed(4)} m/s`);
      if (gain > 0) fail(`touching pair: the blows made energy (${gain.toExponential(2)})`);
      got.push(sp(u));
    }
    if (Math.abs(got[0] - got[1]) > 1e-9) fail(`touching pair: swapping the numbers changed the result (${got[0]} vs ${got[1]})`);
  }
  {
    const w = P.makeWorld(16), rows = [[0], [-1, 1], [-2, 0, 2], [-3, -1, 1, 3], [-4, -2, 0, 2, 4]], at = [];
    let id = 1; rows.forEach((r, k) => r.forEach(m => { P.place(w, id, P.HL / 2 + k * 2 * R * Math.sqrt(3) / 2, m * R); at.push([k, m, id]); id++; }));
    P.place(w, 0, -P.HL / 2, 0); P.strike(w, 0, 8, 0, 0, 0);
    for (let t = 0; t < 0.3; t += 1 / 1920) P.step(w, 1 / 1920);
    let worst = 0, vy = 0; for (const b of w.balls) vy += b.vy;
    for (const [k, m, i] of at) if (m > 0) { const j = at.find(q => q[0] === k && q[1] === -m)[2]; worst = Math.max(worst, Math.abs(sp(w.balls[i]) - sp(w.balls[j]))); }
    if (worst > 1e-6 || Math.abs(vy) > 1e-6) fail(`straight break: mirror pairs differ by ${worst.toExponential(2)} m/s, sideways momentum ${vy.toExponential(2)}`);
  }
  {
    const w = P.makeWorld(4); P.place(w, 0, -0.4, 0); for (let i = 1; i < 4; i++) P.place(w, i, (i - 1) * 2 * R, 0); P.strike(w, 0, 2, 0, 0, 0);
    for (let t = 0; t < 0.3; t += 1 / 240) P.step(w, 1 / 240);
    if (!(sp(w.balls[3]) > 3 * sp(w.balls[1]) && sp(w.balls[3]) > 3 * sp(w.balls[2]))) fail(`a row of touching balls: the blow did not pass along it (${[1, 2, 3].map(i => sp(w.balls[i]).toFixed(2)).join(', ')})`);
  }
  console.log('simultaneous contacts: alike whatever the numbers, an even break, a row passes the blow on');
}
// Pockets: a hard, well-aimed ball coming into a corner pocket at an angle is not turned away for its pace (the drop zone
// used to shrink with speed, which with the spit halved the window at full pace)
{
  const P = createPhysics(Object.assign({ pockets: true }, TABLES.pro)), K = P.POCKETS[2];
  const win = (ang, v) => { let n = 0; for (let o = -0.08; o <= 0.0801; o += 0.0025) { const w = P.makeWorld(1), a0 = Math.PI / 4 - ang * Math.PI / 180, sx = K.x - Math.cos(a0), sy = K.y - Math.sin(a0); P.place(w, 0, sx, sy); P.strike(w, Math.atan2(K.y - sy, K.x - sx) + Math.atan2(o, 1), v, 0, 0, 0); if (P.run(w, 25).pocketed.length) n++; } return n * 0.25; };
  const slowish = win(30, 3.5), hard = win(30, 7.7);
  if (hard < slowish * 0.8) fail(`corner pocket 30° off: ${hard} cm of aim pocket at full pace against ${slowish} cm at 3.5 m/s`);
  console.log(`pocket window, corner 30° off the diagonal: ${slowish} cm at 3.5 m/s, ${hard} cm at 7.7 m/s`);
}
// 2.0: the raised cue. A masse bends towards the side that was put on it; a jump clears a ball in the way and a soft one does not;
// a ball that goes over the rail is a foul and comes back; a shot replayed from its tape ends where it ended, in the air or not
{
  const P = createPhysics({ R: 0.03275, pockets: false }), mk = () => { const w = P.makeWorld(4); [[-0.8, 0], [9, 9], [0.2, 0], [9, 9]].forEach((b, i) => P.place(w, i, b[0], b[1])); w.balls[1].on = w.balls[3].on = false; return w; };
  const deg = d => d * Math.PI / 180;
  for (const side of [0.4, -0.4]) { const w = mk(); w.balls[2].on = false; P.strike(w, 0, 3.5, side, 0, deg(70)); for (let i = 0; i < 120; i++) P.step(w, 1 / 120); if (!(w.balls[0].y * side < -0.05)) fail(`a raised cue with side ${side} did not curve that way (y ${w.balls[0].y.toFixed(3)})`); }
  // (level, side only pushes it a degree or two off the line of the cue - squirt - and it stays on that straight line)
  { const w = mk(); w.balls[2].on = false; P.strike(w, 0, 3.5, 0.4, 0, 0); const c = w.balls[0]; for (let i = 0; i < 30; i++) P.step(w, 1 / 120); const k = c.y / (c.x + 0.8); for (let i = 0; i < 30; i++) P.step(w, 1 / 120); if (Math.abs(c.y / (c.x + 0.8) - k) > 0.002 || Math.abs(k) > 0.05) fail('a level cue curved the ball'); }
  // the same angle, hard and soft: hard it clears the ball in front, soft it barely lifts (with a house cue a jump is
  // played flat-ish and hard, about 40 degrees, at a ball some way off)
  { const w = mk(); w.balls[2].x = w.balls[2].px = -0.35; P.strike(w, 0, 6.6, 0, 0, deg(40)); let hit = false; for (let i = 0; i < 40; i++) { P.step(w, 1 / 120); if (w.ev.hits.length) hit = true; } if (hit || !(w.ev.air > 0.06)) fail(`a hard raised shot did not jump the ball in front (height ${w.ev.air.toFixed(3)})`); }
  { const w = mk(); w.balls[2].x = w.balls[2].px = -0.45; P.strike(w, 0, 1.5, 0, 0, deg(42)); P.run(w, 20); if (w.ev.air > P.R * 0.3 || w.ev.firstHit !== 2) fail('a soft raised shot jumped (it should barely lift and run into the ball)'); }
  { const w = mk(); w.balls[2].x = w.balls[2].px = -0.45; P.strike(w, 0, 5.5, 0, 0, 0); P.run(w, 20); if (w.ev.firstHit !== 2 || w.ev.air > 0) fail('a level shot went through or over a ball'); }
  // steeper is higher and shorter;
  // a steep shot struck low comes back
  { const a = mk(), b = mk(); a.balls[2].on = b.balls[2].on = false; P.strike(a, 0, 5, 0, 0, deg(35)); P.strike(b, 0, 5, 0, 0, deg(60)); for (let i = 0; i < 80; i++) { P.step(a, 1 / 120); P.step(b, 1 / 120); } if (!(b.ev.air > a.ev.air && b.balls[0].x < a.balls[0].x)) fail('a steeper cue did not jump higher and shorter'); }
  // a soft masse stays on the cloth (it hops a few millimetres at most)
  { const w = mk(); w.balls[2].on = false; P.strike(w, 0, 1.4, 0.4, 0, deg(75)); for (let i = 0; i < 80; i++) P.step(w, 1 / 120); if (!(w.ev.air < 0.006)) fail(`a soft masse hopped ${(w.ev.air * 1000).toFixed(1)} mm`); }
  { const w = mk(); w.balls[2].on = false; P.strike(w, 0, 3.5, 0, -0.4, deg(80)); let back = 9; for (let i = 0; i < 360 && !P.rest(w); i++) { P.step(w, 1 / 120); back = Math.min(back, w.balls[0].x); } if (!(back < -0.85)) fail('a steep shot struck low did not come back'); }
  { const w = mk(); w.balls[0].x = w.balls[0].px = 0.95; w.balls[2].on = false; P.strike(w, 0, 7, 0, 0, deg(40)); P.run(w, 20); if (!w.ev.off.includes(0) || w.balls[0].on) fail('a jump at the rail did not leave the table'); }
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: P });
  g.start('four', ['A', 'B'], false, { targets: [3, 5], tens: true, finish: true, rnd });
  { const c = g.cueBall(); c.x = c.px = 1.1; c.y = c.py = 0.4; g.beginShot(); g.P.strike(g.world, 0, 7, 0, 0, deg(45)); g.P.run(g.world, 20); const out = g.resolve(); if (!out.r.foul || !g.world.balls[0].on || g.turn !== 1) fail('four-ball: cue ball off the table should be a foul, back on the cloth, turn over'); }
  // handicaps: each player goes out at their own number, and the last point needs a cushion when that rule is on
  g.start('four', ['A', 'B'], false, { targets: [3, 5], tens: true, finish: true, rnd }); g.players[0].score = 2;
  { const ev = P.newEv(); ev.firstHit = 2; ev.hits = [2, 3]; const r = g.MODES.four.evaluate(ev, g.MODES.four.ctx(g), g); if (r.pts !== 0) fail('cushion finish: the last point counted without a cushion'); ev.cushions = 1; if (g.MODES.four.evaluate(ev, g.MODES.four.ctx(g), g).pts !== 1) fail('cushion finish: the last point off a cushion did not count'); }
  { g.players[0].score = 2; g.finish = false; g._ctx = g.MODES.four.ctx(g); const w = g.world; w.ev = P.newEv(); w.ev.firstHit = 2; w.ev.hits = [2, 3]; g.resolve(); if (!g.over || g.over.winner !== 0) fail('handicap: player with 30 did not go out on the third score'); }
  // ice: the same shot runs longer, and a saved game comes back still on ice
  { const a = mk(), b = mk(); a.balls[2].on = b.balls[2].on = false; b.ice = true; let ta = 0, tb = 0; P.strike(a, 0.3, 3, 0, 0); while (!P.rest(a) && ta < 9000) { P.step(a, 1 / 120); ta++; } P.strike(b, 0.3, 3, 0, 0); while (!P.rest(b) && tb < 9000) { P.step(b, 1 / 120); tb++; } if (!(tb > ta * 1.2)) fail('ice is not slipperier than cloth'); }
  g.start('eight', ['A', 'B'], false, { ice: true, rnd }); const d = JSON.parse(JSON.stringify(g.serialize())); g.start('nine', ['A', 'B'], false, {});
  if (!g.restore(d) || !g.world.ice) fail('a saved game on ice came back on cloth');
  // a jump on the tape
  const H = require(path.join(W, 'highlights.js'))(); g.start('four', ['A', 'B'], false, { rnd });
  { g.beginShot(); const shot = { snap: H.snapshot(g.world), aim: 0.2, V: 6.5, a: 0, b: 0, el: 0.7, turn: 0, isBreak: false, key: -1 }; g.P.strike(g.world, 0.2, 6.5, 0, 0, 0.7); g.P.run(g.world, 40); const end = g.world.balls.map(b => [b.x, b.y, b.on]);
    const tape = H.record(g.P, 4, shot), w2 = g.P.makeWorld(4); let high = 0; for (let t = 0; t < 0.4; t += 0.02) { H.seek(w2, tape, t); high = Math.max(high, w2.balls[0].z); } H.seek(w2, tape, tape.dur);
    if (!(high > 0.03)) fail('the tape of a jump has no height in it'); end.forEach((e, k) => { const b = w2.balls[k]; if (b.on !== e[2] || (e[2] && Math.hypot(b.x - e[0], b.y - e[1]) > 1e-3)) fail('the tape of a jump ends somewhere else'); }); }
  console.log('raised cue, handicaps, ice: checked');
}
// openings: whoever shoots first, their ball is never in line with the two reds; three-ball has its own table and balls
{
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }), carom3: createPhysics({ R: 0.03075, HL: 1.42, HW: 0.71, pockets: false }) });
  for (const mode of ['four', 'three']) for (const first of [0, 1]) {
    g.start(mode, ['A', 'B'], false, { first, rnd }); const b = g.world.balls, c = g.cueBall();
    if (mode === 'four') {                                              // 4구: rolled out - every ball on the cloth, none touching, the first player has the yellow
      const P = g.P; if (g.world.cue !== first || g.yellow !== first) fail(`four, player ${first + 1} first: not on the yellow ball`);
      for (let i = 0; i < 4; i++) { if (Math.abs(b[i].x) > P.HL - P.R || Math.abs(b[i].y) > P.HW - P.R) fail(`four: ball ${i} off the cloth`); for (let j = i + 1; j < 4; j++) if (Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) < 2 * P.R) fail(`four: balls ${i} and ${j} overlap`); }
    } else if (g.world.cue !== first || Math.abs(c.y) < 0.1 || Math.abs(b[1 - first].y) > 1e-3) fail(`${mode}, player ${first + 1} first: the shooter's ball is not on the spot beside the line`);
  }
  g.start('three', ['A', 'B'], true, { level: 2, target: 3, cushions: 1, rnd }); g.players[0].ai = true;
  if (g.P.R !== 0.03075 || g.P.HL !== 1.42) fail('three-ball is not on the match table');
  let n = 0; while (!g.over && n < 400) { const pl = g.aiPlan(); g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 60); g.world.snd.length = 0; g.resolve(); n++; }
  if (!g.over) fail('three-ball on the match table did not finish');
  const d = JSON.parse(JSON.stringify(g.serialize())); g.start('four', ['A', 'B'], false, {}); if (!g.restore(d) || g.P.HL !== 1.42) fail('a saved three-ball game came back on the wrong table');
  console.log(`openings and the three-ball table: checked (${n} shots)`);
}
/* What a simulation owes whoever plays it: the same answer at any step length (a thin cut against theory); the mirror image
   of a shot gives the mirror image of the result, and which ball has which number changes nothing; the aiming guide's
   preview IS the shot; the gentlest touch and the smallest raise of the cue can be played; nothing jumps at a threshold, a
   ball landing on another is a real blow, and no shot - cushions, balls, air and all - ever ends up with more energy than
   it was given. */
{
  const deg = 180 / Math.PI, both = [['game', {}]];
  let worst = 0, gain = 0, shots = 0;
  for (const [name, kind] of both) {
    const P = createPhysics(Object.assign({ pockets: true }, kind, TABLES.bar)), R = P.R;
    const lay = (list) => { const w = P.makeWorld(list.length); list.forEach((q, i) => P.place(w, i, q[0], q[1])); return w; };
    const cut = dt => { const w = lay([[-0.4, 0], [0, 1.8 * R]]); P.strike(w, 0, 3, 0, 0); let n = 0; while (w.ev.firstHit == null && n++ < 1e6) P.step(w, dt); return Math.atan2(w.balls[1].vy, w.balls[1].vx) * deg; };
    const a = cut(1 / 120), b = cut(1 / 1920); worst = Math.max(worst, Math.abs(a - b));
    if (Math.abs(a - b) > 0.02) fail(`${name} physics: a thin cut depends on the step length (${a.toFixed(2)} against ${b.toFixed(2)} degrees)`);
    if (Math.abs(a - Math.asin(0.9) * deg) > 0.01) fail(`${name} physics: a thin cut should leave along the line of centres (${a.toFixed(3)})`);
    // mirror image
    for (let k = 0; k < 40; k++) {
      const ang = (k * 0.618 % 1 - 0.5) * 0.5, V = 1 + k % 7, sa = (k % 5 - 2) / 4 * 0.5, sb = (k % 3 - 1) * 0.3, el = k % 4 === 0 ? 0.5 : 0, pos = [[-0.4, 0.1], [0.1, 0.16], [0.5, -0.2], [-0.2, -0.3]];
      const w = lay(pos), m = lay(pos.map(q => [q[0], -q[1]]));
      P.strike(w, ang, V, sa, sb, el); P.strike(m, -ang, V, -sa, sb, el); P.run(w, 30); P.run(m, 30);
      for (let i = 0; i < 4; i++) if (w.balls[i].on !== m.balls[i].on || (w.balls[i].on && Math.hypot(w.balls[i].x - m.balls[i].x, w.balls[i].y + m.balls[i].y) > 1e-6)) { fail(`${name} physics: a mirrored shot did not give the mirrored result (shot ${k}, ball ${i})`); break; }
    }
    // the same balls numbered the other way round
    { const A = lay([[-0.4, 0], [0, 0.03], [0.5, 0.3], [0.3, -0.25]]), B = lay([[-0.4, 0], [0.3, -0.25], [0.5, 0.3], [0, 0.03]]);
      P.strike(A, 0, 4, 0.2, 0.1); P.strike(B, 0, 4, 0.2, 0.1); P.run(A, 30); P.run(B, 30);
      for (const [i, j] of [[0, 0], [1, 3], [2, 2], [3, 1]]) if (A.balls[i].on !== B.balls[j].on || Math.hypot(A.balls[i].x - B.balls[j].x, A.balls[i].y - B.balls[j].y) > 1e-6) fail(`${name} physics: renumbering the balls changed the shot`); }
    // the preview is the shot
    for (let k = 0; k < 60; k++) {
      const pos = [[-0.5, 0.05], [0.1 + (k % 5) * 0.05, 0.1 - (k % 7) * 0.04], [0.5, -0.2]], ang = (k * 0.618 % 1 - 0.5) * 0.9, V = 0.6 + k % 6, sa = (k % 5 - 2) / 4 * 0.5, sb = (k % 3 - 1) * 0.3, el = k % 5 === 0 ? 0.6 : k % 5 === 1 ? 0.05 : 0;
      const w = lay(pos), pv = P.preview(w, ang, V, sa, sb, el, 1);
      if (w.balls.some((q, i) => q.x !== pos[i][0] || q.y !== pos[i][1] || q.vx !== 0) || w.ev.at) { fail(`${name} physics: looking at the guide moved the balls`); break; }
      P.strike(w, ang, V, sa, sb, el); let t = 0, obj = null; const path = [];
      while (t < 9 && w.balls[0].on && path.length < 90) { P.step(w, 1 / 120); t += 1 / 120; if (w.ev.at) { if (!path.length && w.ev.at[3] >= 0) { const o = w.balls[w.ev.at[3]]; obj = Math.atan2(o.vy, o.vx); } path.push(w.balls[0].x, w.balls[0].y, w.balls[0].z); } else if (!w.balls[0].vx && !w.balls[0].vy && !w.balls[0].z) break; }
      const at = w.ev.at;
      if (!at !== !pv.at || (at && (at[0] !== pv.at[0] || at[1] !== pv.at[1] || at[3] !== pv.at[3]))) { fail(`${name} physics: the guide's first contact is not the shot's (shot ${k})`); break; }
      if (at && obj != null && (!pv.obj || Math.abs(Math.atan2(pv.obj.dy, pv.obj.dx) - obj) > 1e-9)) { fail(`${name} physics: the guide sends the struck ball another way than the shot does (shot ${k})`); break; }
      if (at) for (let i = 0; i < Math.min(path.length, pv.post.length - 3); i++) if (path[i] !== pv.post[i + 3]) { fail(`${name} physics: the guide's cue ball path is not the shot's (shot ${k})`); k = 99; break; }
    }
    // energy, everything counted: travel, turning, height. (Striking the ball is where energy comes in; after that it only goes.)
    for (let k = 0; k < 400; k++) {
      const w = lay([[-0.5, 0.02], [0.05, 0.06 * (k % 3 - 1)], [0.3, 0.2], [0.11, 0.0], [-0.1, -0.3]]), el = k % 3 === 0 ? 0.2 + (k % 11) * 0.1 : 0;
      P.strike(w, (k * 0.618 % 1 - 0.5) * 0.6, 1 + (k * 7 % 70) / 10, (k % 7 - 3) / 6 * 0.5, (k % 5 - 2) / 4 * 0.5, el); shots++;
      const E = () => { let e = 0; for (const q of w.balls) if (q.on) e += 0.5 * (q.vx * q.vx + q.vy * q.vy + q.vz * q.vz) + 0.2 * R * R * (q.wx * q.wx + q.wy * q.wy + q.wz * q.wz) + 9.8 * q.z; return e; };
      for (let i = 0; i < 600 && !P.rest(w); i++) { const e0 = E(); P.step(w, 1 / 120); if (E() > e0 * 1.0005 + 1e-7) gain++; }
    }
    {
      // nothing switches on at a threshold: a hair more speed, never less air and never a leap (on the game's physics the
      // cloth swallows a soft raised stroke, so the air starts from nothing - smoothly - above a walking pace)
      const air = V => { const w = lay([[0, 0]]); P.strike(w, 0, V, 0, 0, Math.PI / 4); P.run(w, 20); return w.ev.air; };
      if (!(air(4) > 0.01)) fail('a hard raised stroke did not leave the cloth');
      for (let V = 0.2; V < 4; V += 0.02) { const d = air(V + 0.02) - air(V); if (!(d >= 0 && d < 0.0012)) { fail(`physics: the jump leaps between ${V.toFixed(2)} and ${(V + 0.02).toFixed(2)} m/s (${(d * 1000).toFixed(2)} mm)`); break; } }
      const bounce = down => { const w = lay([[0, 0]]), q = w.balls[0]; q.z = 1e-5; q.vz = -down; let top = 0; for (let i = 0; i < 60; i++) { P.step(w, 1 / 960); top = Math.max(top, q.z); } return top; };
      for (let d = 0.1; d < 2; d += 0.02) { const j = bounce(d + 0.02) - bounce(d); if (!(j > 0 && j < 0.002)) { fail(`physics: the bounce leaps for a landing between ${d.toFixed(2)} and ${(d + 0.02).toFixed(2)} m/s`); break; } }
      // a ball coming down on another: a hit, a blow both ways, and it is thrown back up
      { const w = lay([[-0.03, 0], [0, 0]]), c = w.balls[0]; c.z = 1.9 * R; c.vz = -1.5; c.vx = 0.4; let up = false; for (let i = 0; i < 40; i++) { P.step(w, 1 / 120); if (c.vz > 0.2) up = true; }
        if (w.ev.firstHit !== 1 || !up || !(Math.hypot(w.balls[1].vx, w.balls[1].vy) > 0.05 || w.balls[1].x > 0.001)) fail('physics: a ball landing on another should strike it, move it and bounce off it'); }
    }
    // a ball only turning on the spot does not hold the game up, and what is left of it at the end is dropped
    { const w = lay([[0, 0]]), q = w.balls[0]; q.wz = 30; P.step(w, 1 / 120);
      if (!P.rest(w)) fail('a ball only turning on the spot should not hold up the game'); P.run(w, 1); if (q.wz !== 0) fail('the turning left over when a shot ends should be dropped'); }
  }
  if (gain) fail(`physics: total energy went up on ${gain} steps`);
  // power: from 15% up the game's calm curve, and below it down to a touch - smooth, increasing, and the way back agrees
  for (const [B, E] of [[6.4, 1.6]]) {
    const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
    g.start('eight', ['A', 'B'], false, {}); g.isBreak = false;
    let ok = true, last = g.vOf(0); for (let p = 0.001; p <= 1.0001; p += 0.001) { const v = g.vOf(p); if (!(v > last && v - last < 0.02) || Math.abs(g.powerOf(v) - p) > 1e-6) ok = false; last = v; }
    if (!ok) fail('power: the curve should rise smoothly, and powerOf should undo vOf');
    for (const p of [0.15, 0.3, 0.62, 1]) if (Math.abs(g.vOf(p) - (0.35 + B * Math.pow(p, E))) > 1e-12) fail('power: the curve changed where lessons use it');
  }
  { const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
    g.start('eight', ['A', 'B'], false, {}); g.isBreak = false;
    const P = g.P, w = P.makeWorld(1); P.place(w, 0, 0, 0); P.strike(w, 0, g.vOf(0.002), 0, 0); P.run(w, 30);
    if (!(w.balls[0].x > 0 && w.balls[0].x < 0.01)) fail(`power: the gentlest touch rolls ${(w.balls[0].x * 100).toFixed(1)} cm - it should be millimetres`);
    console.log(`physics: step length (worst ${worst.toFixed(4)} degrees), mirror, numbering, guide = shot, energy over ${shots} shots, thresholds, soft touch (${(w.balls[0].x * 1000).toFixed(1)} mm): checked`);
  }
}
// the cue's angle: an ordinary stroke is level, and striking without saying an angle is that ordinary stroke
{
  const P = createPhysics(Object.assign({ pockets: true }, TABLES.bar)), at = () => { const w = P.makeWorld(1); P.place(w, 0, 0, 0); return w; };
  const a = at(), b = at(); P.strike(a, 0.3, 4, 0.2, 0.1); P.strike(b, 0.3, 4, 0.2, 0.1, 0);
  if (P.restEl() !== 0 || a.balls[0].vx !== b.balls[0].vx || a.balls[0].wz !== b.balls[0].wz || a.balls[0].vz !== 0) fail('cue angle: the ordinary stroke should be level');
  console.log('cue angle: checked');
}
// the shot clock: running out passes the turn; on a pool table it is a foul with ball in hand (not on the break), on a
// carom table nothing more - no point lost
{
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  g.start('eight', ['A', 'B'], false, { rnd: Math.random });
  let o = g.timeout();
  if (g.turn !== 1 || g.placing === 'any' || g.players[0].fouls) fail('shot clock: a timed-out break should simply pass');
  g.isBreak = false; o = g.timeout();
  if (g.turn !== 0 || g.placing !== 'any' || g.players[1].fouls !== 1 || o.kind !== 'foul') fail('shot clock: on a pool table, time out = foul and ball in hand');
  g.start('four', ['A', 'B'], false, { target: 10, rnd: Math.random });
  g.players[0].score = 3; g.timeout();
  if (g.turn !== 1 || g.players[0].score !== 3 || g.world.cue !== 1) fail('shot clock: on a carom table, time out passes the turn and nothing more');
  console.log('shot clock: checked');
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
