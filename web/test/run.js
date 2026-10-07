/* Checks that need no browser: run with `node web/test/run.js`. Exits non-zero on failure.
   1. every practice drill, at every level, on every table size: the layout is valid and its reference shot passes
   2. computer-vs-computer games of every rule set finish, on every table size */
const path = require('path'), W = path.join(__dirname, '..');
const createPhysics = require(path.join(W, 'physics.js')), createGame = require(path.join(W, 'game.js')), createDrills = require(path.join(W, 'drills.js'));
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
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || 0); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
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
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || 0); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
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
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || 0); g.P.run(g.world, 60); g.world.snd.length = 0; g.resolve(); n++;
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
        const shot = { snap: H.snapshot(g.world), aim: pl.angle, V: pl.V, a: pl.a || 0, b: pl.b || 0, el: pl.el || 0, turn: g.turn, isBreak: g.isBreak };
        g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || 0); g.P.run(g.world, 40); g.world.snd.length = 0;
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
// puzzles: every one is on the cloth, and the answer stored with it really does what its stage asks -
// played both straight from the stored speed and through the power control's rounding, as the app's "answer" button does
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
      if (!g.MODES.puzzle4.judge(goal, ev, t).ok) { bad++; fail(`puzzle ${z.id} (${Z.STAGES[z.stage].name}): its stored answer does not work`); break; }
    }
  }
  if (Z.list.length < 40) fail('fewer than 40 puzzles');
  console.log(`puzzles: ${Z.list.length} in ${Z.STAGES.length} stages (${Z.STAGES.map((s, i) => s.name + ' ' + Z.of(i).length).join(', ')}), ${Z.list.length - bad} stored answers work`);
}
// 2.0: the raised cue. A masse bends towards the side that was put on it; a jump clears a ball in the way and a soft one does not;
// a ball that goes over the rail is a foul and comes back; a shot replayed from its tape ends where it ended, in the air or not
{
  const P = createPhysics({ R: 0.03275, pockets: false }), mk = () => { const w = P.makeWorld(4); [[-0.8, 0], [9, 9], [0.2, 0], [9, 9]].forEach((b, i) => P.place(w, i, b[0], b[1])); w.balls[1].on = w.balls[3].on = false; return w; };
  const deg = d => d * Math.PI / 180;
  for (const side of [0.4, -0.4]) { const w = mk(); w.balls[2].on = false; P.strike(w, 0, 3.5, side, 0, deg(70)); for (let i = 0; i < 120; i++) P.step(w, 1 / 120); if (!(w.balls[0].y * side < -0.05)) fail(`a raised cue with side ${side} did not curve that way (y ${w.balls[0].y.toFixed(3)})`); }
  { const w = mk(); P.strike(w, 0, 3.5, 0.4, 0, 0); for (let i = 0; i < 60; i++) P.step(w, 1 / 120); if (Math.abs(w.balls[0].y) > 0.01) fail('a level cue curved the ball'); }
  // the same angle, hard and soft: hard it clears the ball in front, soft it does not leave the cloth
  { const w = mk(); w.balls[2].x = w.balls[2].px = -0.45; P.strike(w, 0, 6.2, 0, 0, deg(42)); let hit = false; for (let i = 0; i < 40; i++) { P.step(w, 1 / 120); if (w.ev.hits.length) hit = true; } if (hit || !(w.ev.air > 0.06)) fail(`a hard raised shot did not jump the ball in front (height ${w.ev.air.toFixed(3)})`); }
  { const w = mk(); w.balls[2].x = w.balls[2].px = -0.45; P.strike(w, 0, 1.5, 0, 0, deg(42)); P.run(w, 20); if (w.ev.air > 0 || w.ev.firstHit !== 2) fail('a soft raised shot left the cloth'); }
  { const w = mk(); w.balls[2].x = w.balls[2].px = -0.45; P.strike(w, 0, 5.5, 0, 0, 0); P.run(w, 20); if (w.ev.firstHit !== 2 || w.ev.air > 0) fail('a level shot went through or over a ball'); }
  // steeper is higher and shorter; a steep shot struck low comes back
  { const a = mk(), b = mk(); a.balls[2].on = b.balls[2].on = false; P.strike(a, 0, 5, 0, 0, deg(35)); P.strike(b, 0, 5, 0, 0, deg(60)); for (let i = 0; i < 80; i++) { P.step(a, 1 / 120); P.step(b, 1 / 120); } if (!(b.ev.air > a.ev.air && b.balls[0].x < a.balls[0].x)) fail('a steeper cue did not jump higher and shorter'); }
  { const w = mk(); w.balls[2].on = false; P.strike(w, 0, 3.5, 0, -0.4, deg(80)); let far = -9; for (let i = 0; i < 360 && !P.rest(w); i++) { P.step(w, 1 / 120); far = Math.max(far, w.balls[0].x); } if (!(w.balls[0].x < far - 0.05)) fail('a steep shot struck low did not come back'); }
  { const w = mk(); w.balls[0].x = w.balls[0].px = 0.95; w.balls[2].on = false; P.strike(w, 0, 7, 0, 0, deg(45)); P.run(w, 20); if (!w.ev.off.includes(0) || w.balls[0].on) fail('a jump at the rail did not leave the table'); }
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
  { g.beginShot(); const shot = { snap: H.snapshot(g.world), aim: 0.2, V: 6, a: 0, b: 0, el: 0.75, turn: 0, isBreak: false, key: -1 }; g.P.strike(g.world, 0.2, 6, 0, 0, 0.75); g.P.run(g.world, 40); const end = g.world.balls.map(b => [b.x, b.y, b.on]);
    const tape = H.record(g.P, 4, shot), w2 = g.P.makeWorld(4); let high = 0; for (let t = 0; t < 0.4; t += 0.02) { H.seek(w2, tape, t); high = Math.max(high, w2.balls[0].z); } H.seek(w2, tape, tape.dur);
    if (!(high > 0.03)) fail('the tape of a jump has no height in it'); end.forEach((e, k) => { const b = w2.balls[k]; if (b.on !== e[2] || (e[2] && Math.hypot(b.x - e[0], b.y - e[1]) > 1e-3)) fail('the tape of a jump ends somewhere else'); }); }
  console.log('raised cue, handicaps, ice: checked');
}
// openings: whoever shoots first, their ball is never in line with the two reds; three-ball has its own table and balls
{
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }), carom3: createPhysics({ R: 0.03075, HL: 1.42, HW: 0.71, pockets: false }) });
  for (const mode of ['four', 'three']) for (const first of [0, 1]) {
    g.start(mode, ['A', 'B'], false, { first, rnd }); const b = g.world.balls, c = g.cueBall();
    if (g.world.cue !== first || Math.abs(c.y) < 0.1 || Math.abs(b[1 - first].y) > 1e-3) fail(`${mode}, player ${first + 1} first: the shooter's ball is not on the spot beside the line`);
  }
  g.start('three', ['A', 'B'], true, { level: 2, target: 3, cushions: 1, rnd }); g.players[0].ai = true;
  if (g.P.R !== 0.03075 || g.P.HL !== 1.42) fail('three-ball is not on the match table');
  let n = 0; while (!g.over && n < 400) { const pl = g.aiPlan(); g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || 0); g.P.run(g.world, 60); g.world.snd.length = 0; g.resolve(); n++; }
  if (!g.over) fail('three-ball on the match table did not finish');
  const d = JSON.parse(JSON.stringify(g.serialize())); g.start('four', ['A', 'B'], false, {}); if (!g.restore(d) || g.P.HL !== 1.42) fail('a saved three-ball game came back on the wrong table');
  console.log(`openings and the three-ball table: checked (${n} shots)`);
}
// the realistic physics (cfg.real): games of every kind finish on it; nothing gains energy at a cushion; running side
// lengthens the angle off a cushion; a cut throws the struck ball off the line of centres towards the way the cue ball was going;
// side sends the cue ball a little the other way; the carom cloth runs further than the pool cloth; and a raised cue costs spin
{
  const real = cfg => createPhysics(Object.assign({ real: true }, cfg)), C = real({ R: 0.03275, pockets: false }), PL = real(Object.assign({ pockets: true }, TABLES.bar)), OLD = createPhysics({ R: 0.03275, pockets: false });
  const one = (P, n) => { const w = P.makeWorld(n); for (let i = 1; i < n; i++) w.balls[i].on = false; P.place(w, 0, 0, 0); return w; };
  const energy = b => b.vx * b.vx + b.vy * b.vy + 0.4 * C.R * C.R * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz);
  let gain = 0;
  for (let k = 0; k < 1500; k++) { const w = one(C, 4); C.strike(w, (k * 0.6180339) % 1 * 6.283, 1 + (k * 7 % 60) / 10, (k % 7 - 3) / 6 * 0.5, (k % 5 - 2) / 4 * 0.5); for (let i = 0; i < 300; i++) { const e0 = energy(w.balls[0]); C.step(w, 1 / 120); if (energy(w.balls[0]) > e0 * 1.0001 + 1e-9) gain++; } }
  if (gain) fail(`realistic physics: energy went up on ${gain} steps`);
  const off = side => { const w = one(C, 4); w.balls[0].x = w.balls[0].px = -0.5; C.strike(w, Math.PI / 4, 2.5, side, 0); for (let i = 0; i < 600; i++) { C.step(w, 1 / 120); if (w.ev.railed.length) { const b = w.balls[0]; return Math.atan2(-b.vy, b.vx); } } return NaN; };
  if (!(off(0.35) < off(0) - 0.03)) fail('realistic physics: running side did not lengthen the angle off the cushion');
  { const w = C.makeWorld(4); w.balls[1].on = w.balls[3].on = false; C.place(w, 0, -0.5, 0); C.place(w, 2, 0, C.R); C.strike(w, 0, 1.5, 0, 0); const v = OLD.makeWorld(4); v.balls[1].on = v.balls[3].on = false; OLD.place(v, 0, -0.5, 0); OLD.place(v, 2, 0, OLD.R); OLD.strike(v, 0, 1.5, 0, 0);
    for (let i = 0; i < 200 && !w.ev.hits.length; i++) C.step(w, 1 / 120); for (let i = 0; i < 200 && !v.ev.hits.length; i++) OLD.step(v, 1 / 120); for (let i = 0; i < 3; i++) { C.step(w, 1 / 120); OLD.step(v, 1 / 120); } const a = Math.atan2(w.balls[2].vy, w.balls[2].vx), b = Math.atan2(v.balls[2].vy, v.balls[2].vx);
    if (!(a < b - 0.003 && a > b - 0.12)) fail(`realistic physics: a cut should throw the struck ball a degree or so (${((b - a) * 57.3).toFixed(2)} degrees)`); if (!(Math.abs(w.balls[2].wz) > 0.1)) fail('realistic physics: no spin passed from ball to ball'); }
  { const w = one(C, 4); C.strike(w, 0, 3, 0.4, 0); if (!(w.balls[0].vy > 0.02 && w.balls[0].vy < 0.2)) fail('realistic physics: right side should send the cue ball a little left'); const v = one(OLD, 4); OLD.strike(v, 0, 3, 0.4, 0); if (v.balls[0].vy !== 0) fail('the usual physics has no squirt'); }
  const roll = P => { const w = one(P, P.POCKETED ? 16 : 4); P.place(w, 0, -P.HL + 0.2, 0.11); P.strike(w, 0, 4, 0, 0); let d = 0, px = w.balls[0].x, n = 0; while (!P.rest(w) && n < 20000) { P.step(w, 1 / 120); n++; d += Math.abs(w.balls[0].x - px); px = w.balls[0].x; } return d / (2 * P.HL); };
  if (!(roll(C) > roll(PL) && roll(C) > roll(OLD) * 1.2)) fail('realistic physics: the carom cloth should run further than the pool cloth, and further than before');
  { const spin = P => { const w = one(P, 4); P.strike(w, 0, 5, 0, -0.4, 0.6); return Math.hypot(w.balls[0].wx, w.balls[0].wy); }; if (!(spin(C) < spin(OLD) * 0.9)) fail('realistic physics: a raised cue should cost some of the draw'); }
  const g = createGame({ pool: PL, carom: C, carom3: real({ R: 0.03075, HL: 1.42, HW: 0.71, pockets: false }) });
  for (const mode of ['eight', 'nine', 'four', 'three']) for (const level of [2, 3]) {
    g.start(mode, ['A', 'B'], true, { level, target: 3, cushions: 1, rnd }); g.players[0].ai = true; let n = 0;
    while (!g.over && n < 400) { const pl = g.aiPlan(); if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; } g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || 0); g.P.run(g.world, 90); g.world.snd.length = 0; g.resolve(); n++;
      for (const b of g.world.balls) if (b.on && !(Number.isFinite(b.x) && Number.isFinite(b.y) && Math.abs(b.x) <= g.P.HL + 0.2 && Math.abs(b.y) <= g.P.HW + 0.2)) { fail(`realistic physics, ${mode}: a ball is nowhere sensible`); n = 999; break; } }
    if (!g.over) fail(`realistic physics, ${mode} level ${level}: game did not finish`);
  }
  console.log(`realistic physics: checked (carom cloth runs ${roll(C).toFixed(1)} table lengths against ${roll(OLD).toFixed(1)} before; pool ${roll(PL).toFixed(1)})`);
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
