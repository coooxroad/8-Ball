/* Checks that need no browser: run with `node web/test/run.js`. Exits non-zero on failure.
   1. every practice drill, at every level, on every table size: the layout is valid and its reference shot passes
   2. computer-vs-computer games of every rule set finish, on every table size */
const path = require('path'), W = path.join(__dirname, '..');
// there is one physics, the one the game is played on
const createPhysicsRaw = require(path.join(W, 'physics.js')), createPhysics = cfg => createPhysicsRaw(cfg), createGameRaw = require(path.join(W, 'game.js')), createDrills = require(path.join(W, 'drills.js'));
// the computer player (ai/) is the body of one function, as web/build.sh makes it
const fs = require('fs'), createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const createGame = PH => createGameRaw(PH, createAI);
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
// puzzles (web/puzzles.js): every one is on the cloth, its id is unique, and its stored answer solves it - struck at the
// speed stored and at that speed after the power slider's round trip (what a player can actually set)
{
  const createPuzzles = require(path.join(W, 'puzzles.js')), Z = createPuzzles();
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  /* PUZZLES_WAIT (owner, 2026-11-07): while the physics is being reworked the puzzles are not kept up with it - a stored
     answer that no longer solves is said, not failed. Every other puzzle check stands. Set false (and find the answers
     again: web/tools/puzzles) once the physics is settled. */
  const PUZZLES_WAIT = true;
  let bad = 0; const ids = new Set();
  for (const z of Z.list) {
    if (ids.has(z.id)) fail(`puzzle ${z.id}: id used twice`); ids.add(z.id);
    if (!Z.STAGES[z.stage]) { fail(`puzzle ${z.id}: no stage ${z.stage}`); continue; }
    g.start('puzzle4', ['A', ''], false, {}); const P = g.P, w = g.world, goal = Z.STAGES[z.stage].goal; w.walls = P.walls(z.walls);
    z.balls.forEach((b, i) => { P.place(w, i, b[0], b[1], rnd); if (Math.abs(b[0]) > P.HL - P.R || Math.abs(b[1]) > P.HW - P.R) { fail(`puzzle ${z.id}: ball ${i} off the cloth`); } });
    w.cue = 0;
    for (const V of [z.sol[1], g.vOf(g.powerOf(z.sol[1]))]) {
      const t = P.clone(w); P.strike(t, z.sol[0], V, z.sol[2], z.sol[3], z.sol[4]); const ev = P.run(t, 30);
      if (!g.MODES.puzzle4.judge(goal, ev, t).ok) { bad++; if (!PUZZLES_WAIT) fail(`puzzle ${z.id}: its stored answer does not solve it`); break; }
    }
  }
  console.log(`puzzles: ${Z.list.length} in ${Z.STAGES.length} stages (${Z.STAGES.map((s, i) => s.name + ' ' + Z.of(i).length).join(', ')}), ${Z.list.length - bad} stored answers work${bad && PUZZLES_WAIT ? ` - ${bad} wait for the physics to settle (PUZZLES_WAIT)` : ''}`);
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
  // the cushion keeps part of the roll into it (RAIL_ROLL): a ball rolled at a cushion comes off it bending round
  { const w = mk(); w.balls[2].on = false; const c = w.balls[0]; P.place(w, 0, 0, 0); P.strike(w, -Math.PI / 4, 2.5, 0, 0, 0);
    while (!w.ev.railed.length) P.step(w, 1 / 240); P.step(w, 1 / 240); const h0 = Math.atan2(c.vy, c.vx); for (let i = 0; i < 480; i++) P.step(w, 1 / 240);
    const turn = Math.abs(Math.atan2(c.vy, c.vx) - h0) * 180 / Math.PI; if (!(turn > 12)) fail(`a rolling ball came off the cushion nearly straight (turned ${turn.toFixed(1)} degrees)`); }
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
  // handicaps: each player goes out at their own number; with a finish (owner 11-10) the points stop at the number and the
  // game is won by the finish after them - a cushion, or three, before the second red; a miss or a foul there costs nothing
  g.start('four', ['A', 'B'], false, { targets: [3, 5], tens: true, finish: true, rnd }); g.players[0].score = 2;
  { const M = g.MODES.four, ev = P.newEv(); ev.firstHit = 2; ev.hits = [2, 3]; if (M.ctx(g).last || M.evaluate(ev, M.ctx(g), g).pts !== 1) fail('finish: the points before it should count as ever');
    g._ctx = M.ctx(g); g.world.ev = ev; g.resolve(); if (g.over || g.players[0].score !== 3 || g.turn !== 0) fail('finish: making all the points ended the game or passed the turn');
    if (!M.ctx(g).last || M.ctx(g).need !== 1 || !/마무리/.test(M.badge(g).text)) fail('finish: the finish was not asked for after the points');
    const miss = P.newEv(); miss.firstHit = 2; miss.hits = [2, 3]; const r = M.evaluate(miss, M.ctx(g), g); if (r.win != null || r.pts !== 0 || r.foul) fail('finish: the two reds without a cushion finished, or cost something');
    miss.cushions = 1; if (M.evaluate(miss, M.ctx(g), g).win !== 0) fail('finish: the two reds off a cushion did not finish');
    g._ctx = M.ctx(g); g.world.ev = miss; g.resolve(); if (!g.over || g.over.winner !== 0 || g.players[0].score !== 3 || M.status(g, 0).pts !== 30) fail('finish: the finish did not win the game, or the score went past the number'); }
  g.start('four', ['A', 'B'], false, { targets: [3, 5], tens: true, finish: 'three', rnd }); g.players[0].score = 3;
  { const M = g.MODES.four, ev = P.newEv(); ev.firstHit = 2; ev.hits = [2, 3]; ev.cushions = 2; if (M.ctx(g).need !== 3 || M.evaluate(ev, M.ctx(g), g).win != null) fail('three-cushion finish: two cushions finished');
    ev.cushions = 3; if (M.evaluate(ev, M.ctx(g), g).win !== 0) fail('three-cushion finish: three cushions did not finish');
    const foul = P.newEv(); foul.firstHit = 1; foul.hits = [1, 2, 3]; foul.cushions = 3; g._ctx = M.ctx(g); g.world.ev = foul; g.resolve();
    if (g.over || g.players[0].score !== 3 || g.turn !== 1 || !g.MODES.four.ctx(Object.assign({}, g, { turn: 0 })).last) fail('three-cushion finish: a foul while finishing cost a point, or did not pass the turn (owner 11-10: nothing lost)');
    // (a ball off the table while finishing: nothing lost either)
    g.turn = 0; g.world.cue = 0; const off = P.newEv(); off.firstHit = 2; off.hits = [2]; off.off = [0]; g._ctx = M.ctx(g); g.world.ev = off; g.resolve(); if (g.players[0].score !== 3) fail('finish: a ball off the table while finishing cost a point'); }
  // 마이너스 점수 없음 (a game with a friend): a foul, or a ball off the table, passes the turn and costs nothing
  g.start('four', ['A', 'B'], false, { target: 5, minus: false, rnd });
  { const M = g.MODES.four; g.players[0].score = 2; const ev = P.newEv(); ev.firstHit = 1; ev.hits = [1]; g._ctx = M.ctx(g); g.world.ev = ev; g.resolve(); if (g.players[0].score !== 2 || g.turn !== 1) fail('minus off: a foul cost a point or kept the turn');
    g.players[1].score = 2; const off = P.newEv(); off.firstHit = 2; off.hits = [2]; off.off = [1]; g._ctx = M.ctx(g); g.world.ev = off; g.resolve(); if (g.players[1].score !== 2) fail('minus off: a ball off the table cost a point');
    const d = JSON.parse(JSON.stringify(g.serialize())); g.start('four', ['A', 'B'], false, { rnd }); if (!g.restore(d) || g.minus !== false) fail('minus off: a saved game came back with minus'); }
  // 후구: the one who began, done first, does not win yet - the other has their visit; done in it too, a draw
  { const pt = () => { const ev = P.newEv(); ev.firstHit = 2; ev.hits = [2, 3]; g._ctx = g.MODES.four.ctx(g); g.world.ev = ev; return g.resolve(); };
    const miss = () => { const ev = P.newEv(); ev.firstHit = 2; ev.hits = [2]; g._ctx = g.MODES.four.ctx(g); g.world.ev = ev; return g.resolve(); };
    g.start('four', ['A', 'B'], false, { target: 3, hugu: true, first: 0, rnd }); g.players[0].score = 2;
    const o = pt(); if (g.over || g.turn !== 1 || g.chance !== 0 || !/후구/.test(o.msg)) fail('후구: the first player going out ended the game, or the other had no visit');
    g.players[1].score = 1; pt(); if (g.over || g.turn !== 1) fail('후구: a point in the last visit ended it or passed the turn');
    miss(); if (!g.over || g.over.winner !== 0) fail('후구: the visit ended without going out, and the first player did not win');
    g.start('four', ['A', 'B'], false, { target: 3, hugu: true, first: 0, rnd }); g.players[0].score = 2; pt(); g.players[1].score = 2; pt();
    if (!g.over || g.over.winner !== null || !g.over.draw) fail('후구: going out in the last visit was not a draw');
    g.start('four', ['A', 'B'], false, { target: 3, hugu: true, first: 0, rnd }); g.players[0].score = 2; pt(); g.timeout(); if (!g.over || g.over.winner !== 0) fail('후구: the last visit ran out of time and the first player did not win');
    // the second player going out first wins at once; without 후구 the first player does too
    g.start('four', ['A', 'B'], false, { target: 3, hugu: true, first: 0, rnd }); miss(); g.players[1].score = 2; pt(); if (!g.over || g.over.winner !== 1) fail('후구: the second player going out did not win at once');
    g.start('four', ['A', 'B'], false, { target: 3, first: 0, rnd }); g.players[0].score = 2; pt(); if (!g.over || g.over.winner !== 0) fail('no 후구: the first player going out did not win');
    // with a finish: the finish is what goes out
    g.start('four', ['A', 'B'], false, { target: 3, hugu: true, finish: 'cushion', first: 0, rnd }); g.players[0].score = 3;
    { const ev = P.newEv(); ev.firstHit = 2; ev.hits = [2, 3]; ev.cushions = 1; g._ctx = g.MODES.four.ctx(g); g.world.ev = ev; g.resolve(); } if (g.over || g.chance !== 0 || g.turn !== 1) fail('후구: a finish by the first player gave no last visit');
    const d = JSON.parse(JSON.stringify(g.serialize())); g.start('four', ['A', 'B'], false, { rnd }); if (!g.restore(d) || !g.hugu || g.chance !== 0 || g.first !== 0) fail('후구: a saved game lost the last visit'); }
  g.start('four', ['A', 'B'], false, { targets: [3, 5], tens: true, finish: true, rnd });
  // the other ball is a foul (-1) even with both reds; one red and the other ball too
  { g.players[0].score = 1; const M = g.MODES.four, ev = P.newEv(); ev.firstHit = 2; ev.hits = [2, 3, 1]; ev.cushions = 1; const r = M.evaluate(ev, M.ctx(g), g); if (!r.foul || r.pts !== -1 || r.keep) fail('four-ball: both reds and the other ball should cost a point');
    ev.hits = [2, 1]; const r2 = M.evaluate(ev, M.ctx(g), g); if (!r2.foul || r2.pts !== -1) fail('four-ball: one red and the other ball should still cost a point'); }
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
    if (mode === 'four') {                                              // 4구: rolled out - every ball on the cloth, none touching, the first player has the white
      const P = g.P; if (g.world.cue !== first || g.yellow !== 1 - first) fail(`four, player ${first + 1} first: not on the white ball`);
      g.rollOut(rnd); P.run(g.world, 40); if (!P.rest(g.world)) fail('four: the roll-out did not stop');
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

// barricades (physics walls()): a ball rolled square into one comes back, it is not counted as a cushion, a ball rolled
// past its end goes by, and the same shot comes out the same every time
{
  const P = createPhysics({ R: 0.03275, pockets: false }), W = P.walls([{ x: 0.3, y: 0, len: 0.4, thick: 0.03, ang: Math.PI / 2, h: 0.04 }]);
  const roll = (y, V) => { const w = P.makeWorld(1); w.walls = W; P.place(w, 0, -0.3, y); P.strike(w, 0, V, 0, 0); const ev = P.run(w, 30); return { w, ev, b: w.balls[0] }; };
  // (soft enough not to reach the cushion behind on the way back: on the livelier cloth of PHYS_V 8 a firmer one did)
  const a = roll(0, 0.8), b = roll(0, 0.8), c = roll(0.4, 1.5);
  if (!(a.ev.walls >= 1 && a.ev.cushions === 0 && a.b.x < 0.3)) fail(`barricades: a ball rolled into one should come back (walls ${a.ev.walls}, x ${a.b.x.toFixed(3)})`);
  if (a.b.x !== b.b.x || a.b.y !== b.b.y) fail('barricades: the same shot ends differently');
  if (c.ev.walls !== 0) fail('barricades: a ball rolled past the end met it');
  const none = P.makeWorld(1); if (none.walls.length || P.clone(a.w).walls !== W) fail('barricades: a world has none until given, and a copy keeps them');
  console.log('barricades: checked');
}
// the levels (ai/): each keeps the table more often than the one below. Played with a fixed Math.random, so the same every run.
{
  const real = Math.random; let s = 777; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  for (const mode of ['eight', 'four']) {
    const rate = [];
    for (let lv = 0; lv <= 3; lv++) {
      let kept = 0, turns = 0;
      for (let k = 0; k < 4; k++) {
        g.start(mode, ['A', 'B'], true, { levels: [lv, lv], target: 99, rnd: Math.random }); g.players[0].ai = true;
        for (let n = 0; n < 24 && !g.over; n++) {
          const who = g.turn, wasBreak = g.isBreak, pl = g.aiPlan();
          if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
          g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve();
          if (!wasBreak) { turns++; if (g.over ? g.over.winner === who : g.turn === who) kept++; }
        }
      }
      rate.push(Math.round(100 * kept / Math.max(1, turns)));
    }
    console.log(`levels, ${mode}: keeps the table ${rate.map((r, i) => `level ${i} ${r}%`).join(', ')}`);
    for (let i = 1; i < rate.length; i++) if (rate[i] < rate[i - 1]) fail(`levels, ${mode}: level ${i} (${rate[i]}%) is weaker than level ${i - 1} (${rate[i - 1]}%)`);
  }
  Math.random = real;
}
// the person-like opponent (ai/50-human.js): its own checks, in their own file (a minute or so)
{
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'ai-human.js')], { encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').pop();
  if (r.status !== 0) fail('person-like opponent: ' + (last || r.stderr.trim().split('\n').pop())); else console.log(last);
}
// the computer player in a Worker (ai-worker.js): the game rebuilt from its saved table makes the very plan the game does,
// and a stand-in's seeded chances end where they would have
{
  const T = require(path.join(W, 'tables.js'));
  Object.assign(global, { createGame: createGameRaw, createAI, createPhysics, physicsFor: T.physicsFor, seededRandom: createGameRaw.seededRandom });
  const aiServe = require(path.join(W, 'ai-worker.js'));
  const H = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'))({}).personaFor;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let n = 0;
  for (const [mode, tbl] of [['eight', 'bar'], ['nine', 'club'], ['four', 'bar'], ['three', 'bar']]) for (const human of [false, true]) {
    const g = createGameRaw(T.physicsFor(createPhysics, tbl), createAI), r0 = createGameRaw.seededRandom(777);
    const pz = human ? H(45, createGameRaw.seededRandom(5)) : null;
    g.start(mode, ['A', 'B'], true, { rnd: createGameRaw.seededRandom(99), level: 2, levels: [2, 2], personas: pz ? [null, pz] : undefined }); g.turn = 1;
    if (mode !== 'four' && mode !== 'three') { const P = g.P; P.strike(g.world, 0, 6, 0, 0); P.run(g.world, 30); g.isBreak = false; g.placing = null; }
    for (let k = 0; k < 2; k++) {
      g.aiRnd = human ? createGameRaw.seededRandom(1000 + k) : null;
      const job = { id: k, tbl, d: JSON.parse(JSON.stringify(g.serialize())), levels: g.levels, personas: JSON.parse(JSON.stringify(g.personas)), rnd: g.aiRnd ? g.aiRnd.state() : null };
      let s = 4242; const mr = Math.random; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const direct = g.aiPlan(), after = g.aiRnd ? g.aiRnd.state() : null;
      s = 4242; const rep = aiServe(job); Math.random = mr;
      if (rep.err || !same(rep.plan, direct) || rep.rnd !== after) fail(`ai worker: ${mode}${human ? ' (person-like)' : ''} plan ${k} differs${rep.err ? ' - ' + rep.err : ''}`);
      n++;
    }
  }
  console.log(`ai worker: ${n} plans the same as the game's own`);
}
// 현실 당구 (w.real): side spin pushes the cue ball off its line, a cut throws the object ball, and the cue rises
// over a ball behind or a rail - and none of it happens without the add-on
{
  const P = createPhysics(Object.assign({ pockets: true }, TABLES.bar)), deg = r => r * 180 / Math.PI;
  const w0 = real => { const w = P.makeWorld(16); w.balls.forEach(b => { b.on = false; }); w.cue = 0; P.place(w, 0, -0.5, 0); w.real = real; return w; };
  const sq = real => { const w = w0(real); P.strike(w, 0, 2, 0.5, 0, 0); const c = w.balls[0]; return deg(Math.atan2(c.vy, c.vx)); };
  // squirt, TP A.31 with the house cue's end mass: 3.0 degrees at half a radius of side on a pool ball
  if (Math.abs(sq(null)) > 1e-9 || Math.abs(sq({ squirt: true }) - 2.98) > 0.03) fail(`squirt: ${sq(null)} without, ${sq({ squirt: true })} with`);
  const cut = real => { const w = w0(real); P.place(w, 1, 0, 0); const R = P.R, c = 30 * Math.PI / 180;
    P.strike(w, Math.atan2(2 * R * Math.sin(c), 0.5 - 2 * R * Math.cos(c)), 1.5, 0, 0, 0);
    for (let i = 0; i < 400 && !w.ev.at; i++) P.step(w, 1 / 120); P.step(w, 1 / 120); const o = w.balls[1]; return deg(Math.atan2(o.vy, o.vx)); };
  const thr = cut({ throw: true }) - cut(null);
  if (!(Math.abs(thr) > 0.8 && Math.abs(thr) < 2.5)) fail(`throw on a 30-degree stun cut: ${thr.toFixed(2)} degrees`);
  // throw against Alciatore's model (TP A.14): a stunned cue ball at the hit, the object ball's way off the line of centres
  { const mu = v => 0.00995 + 0.108 * Math.exp(-1.088 * v), R = P.R;
    for (const [v, cd] of [[0.45, 30], [1.34, 30], [1.34, 60], [3.13, 45]]) {
      const w = P.makeWorld(16); w.balls.forEach(b => { b.on = false; }); w.cue = 0; w.real = { throw: true }; const c = cd * Math.PI / 180;
      P.place(w, 1, 0, 0); P.place(w, 0, -2 * R * Math.cos(c) - 0.0004, -2 * R * Math.sin(c)); w.balls[0].vx = v;
      for (let i = 0; i < 20 && !w.ev.hits.length; i++) P.step(w, 1 / 240);
      const got = cd - deg(Math.atan2(w.balls[1].vy, w.balls[1].vx)), vr = v * Math.sin(c), want = deg(Math.atan(Math.min(mu(vr), vr / (7 * 0.98 * v * Math.cos(c)))));
      if (Math.abs(got - want) > 0.05) fail(`throw at ${v} m/s, ${cd} degrees cut: ${got.toFixed(2)}, Alciatore's model ${want.toFixed(2)}`);
    } }
  // the cue's rise, the house cue as drawn: an open table (over the rail), a ball 8 cm behind, a ball frozen to the cushion struck at its middle
  const rise = (x, y, bb) => { const w = w0({ cue: true }); if (x != null) P.place(w, 1, x, y); return deg(Math.atan(P.cueRiseTan(w, 0, 0, bb || 0))); };
  const near = rise(-0.58, 0), open = rise(null);
  const frozen = (bb) => { const w = w0({ cue: true }); P.place(w, 0, -P.HL + P.R, 0); return deg(Math.atan(P.cueRiseTan(w, 0, 0, bb))); };
  if (!(near > 35 && near < 50 && open > 0.5 && open < 3 && frozen(0) > 60 && frozen(0.5) < 10)) fail(`cue rise: ${near.toFixed(1)} over a ball 8 cm behind, ${open.toFixed(1)} on an open table, frozen to the cushion ${frozen(0).toFixed(1)} at its middle and ${frozen(0.5).toFixed(1)} struck high`);
  // the guide follows the add-on (owner 11-10): with squirt on, the line drawn for side bends as the ball will
  const guideEnd = real => { const w = w0(real), p = P.preview(w, 0, 2, 0.5, 0, 0, 0); return deg(Math.atan2(p.pre[31], p.pre[30] + 0.5)); };   // (a point a tenth of a metre on)
  if (!(Math.abs(guideEnd({ squirt: true }) - sq({ squirt: true })) < 0.3 && Math.abs(guideEnd(null)) < 0.3)) fail(`guide with squirt: ${guideEnd({ squirt: true }).toFixed(2)}° (the shot ${sq({ squirt: true }).toFixed(2)}°), without ${guideEnd(null).toFixed(2)}°`);
  console.log(`현실 당구: squirt ${sq({ squirt: true }).toFixed(2)}°, throw ${thr.toFixed(2)}°, cue ${near.toFixed(1)}° over a ball behind`);
}
// 스누커 (game.js MODES.snooker): frames of loosely aimed shots (any power, any spin, now and then at the wrong ball) all
// come to an end; the colours are never down when they should be on their spots; the D is kept to; a foul gives at least 4
{
  const { SNOOKER } = require(path.join(W, 'tables.js')); global.SNOOKER = SNOOKER;   // (game.js reads it as the page does)
  let frames = 0, shots = 0;
  for (let s = 1; s <= 4; s++) {
    const g = createGameRaw({ snooker: createPhysics(SNOOKER.cfg) }), r = createGameRaw.seededRandom(s);
    g.start('snooker', ['A', 'B'], false, { rnd: r });
    let n = 0;
    while (!g.over && n < 3000) {
      n++; const w = g.world, c = g.cueBall(), on = g.legal().filter(i => w.balls[i].on);
      if (g.placing) { const [x, y] = g.toPlace(c.x + 0.5, c.y + 0.4); if (!g.placeOk(x, y)) { fail(`snooker: the cue ball brought into the ${g.placing} is not in it`); break; } }
      const t = on.length && r() < 0.9 ? w.balls[on[Math.floor(r() * on.length)]] : w.balls[1 + Math.floor(r() * 21)];
      g.beginShot(); g.P.strike(w, Math.atan2(t.y - c.y, t.x - c.x) + (r() - 0.5) * 0.08, 0.6 + r() * 3.2, (r() - .5) * .4, (r() - .5) * .4); g.P.run(w, 60);
      const before = g.players.map(p => p.score), mover = g.turn, out = g.resolve(); shots++;
      if (out.r.foul && g.players[1 - mover].score - before[1 - mover] < 4) fail(`snooker: a foul gave less than 4 (seed ${s})`);
      if (!g.over) for (let id = 16; id <= 21; id++) if (!w.balls[id].on && (g.snk.on !== 'clear' || id >= g.snk.next)) fail(`snooker: colour ${id} down out of its turn (seed ${s})`);
    }
    if (!g.over) fail(`snooker: a frame did not end (seed ${s})`); else frames++;
  }
  // the points on the table at the start: fifteen reds with a black each, and the colours
  const g = createGameRaw({ snooker: createPhysics(SNOOKER.cfg) }); g.start('snooker', ['A', 'B'], false, { rnd: createGameRaw.seededRandom(1) });
  if (g.mode.left(g) !== 147) fail(`snooker: ${g.mode.left(g)} points on the table at the start, not 147`);
  console.log(`snooker: ${frames} frames played to the end, ${shots} shots`);
}

// 증강 당구 (game.js ARCADE, MODES.arcade): the 36 racked by rows (one 1 ... eight 8s), every game of loose shots ends with
// the score adding up to the balls down and the winner the one with more; the cards dealt are three, the same for the same
// seed, round and seat, of the round's kind
{
  const T = require(path.join(W, 'tables.js')), { ARCADE } = createGameRaw;
  const faces = [...Array(36)].map((_, i) => ARCADE.face(i + 1)), want = [...Array(8)].flatMap((_, k) => Array(k + 1).fill(k + 1));
  if (faces.join() !== want.join()) fail(`arcade: the faces by id are ${faces.join()}`);
  let games = 0, shots = 0;
  for (let s = 1; s <= 3; s++) {
    const g = createGameRaw(T.physicsFor(createPhysics, 'bar')), r = createGameRaw.seededRandom(s);
    g.start('arcade', ['A', 'B'], false, { rnd: r });
    if (g.world.balls.length !== 37 || g.mode.left(g) !== 36) fail('arcade: not 36 balls racked');
    let n = 0;
    while (!g.over && n < 2000) {
      n++; const w = g.world, c = g.cueBall(), on = g.legal();
      if (g.placing) { const [x, y] = g.P.findFree(w, -g.P.HL / 2, 0.1 * (r() - 0.5), 0); g.P.place(w, 0, x, y); }
      const t = w.balls[on[Math.floor(r() * on.length)]];
      g.beginShot(); g.P.strike(w, Math.atan2(t.y - c.y, t.x - c.x) + (r() - 0.5) * 0.05, 1 + r() * 4, 0, 0); g.P.run(w, 60);
      g.resolve(); shots++;
    }
    const a = g.players[0].score, b = g.players[1].score, down = 36 - g.mode.left(g);
    if (!g.over) fail(`arcade: a game did not end (seed ${s})`);
    else { games++; if (a + b !== down) fail(`arcade: ${a} + ${b} points but ${down} balls down (seed ${s})`); if (a !== b && g.over.winner !== (a > b ? 0 : 1)) fail(`arcade: ${a} : ${b} won by ${g.over.winner}`); if (Math.max(a, b) < ARCADE.WIN && down < 36) fail(`arcade: ended at ${a} : ${b}`); }
  }
  // the steps: the table's, then an augment and a harder vote by turns; a pick's three all of the step's tier, the same
  // tier for both seats; a vote's three the same for both
  if ([0, 1, 2, 3, 4].map(ARCADE.step).join() !== 'shape,buff,hard,buff,hard') fail('arcade: the steps are out of order');
  for (const k of [1, 3, 5, 7]) {
    const a = ARCADE.cards(1234, k, 0), b = ARCADE.cards(1234, k, 1), t = ARCADE.tierOf(1234, k), ok = x => x.length === 3 && new Set(x).size === 3 && x.every(id => ARCADE.buffs.find(c => c.id === id).tier === t);
    if (!ok(a) || !ok(b) || a.join() !== ARCADE.cards(1234, k, 0).join()) fail(`arcade: step ${k}'s picks ${a} / ${b} (tier ${t})`);
  }
  if (ARCADE.cards(99, 2, 0).join() !== ARCADE.cards(99, 2, 1).join() || !ARCADE.cards(99, 2, 0).every(id => ARCADE.hards.some(c => c.id === id))) fail('arcade: a harder vote differs between seats');
  if (ARCADE.due([3, 2], 0, 0) !== 1 || ARCADE.due([2, 2], 1, 0) !== 0 || ARCADE.due([3, 2], 0, 1) !== 0 || ARCADE.due([5, 4], 0, 1) !== 2) fail('arcade: the steps come at the wrong visits');
  // two shots a visit: a visit with nothing potted and no foul still has its second shot
  { const g = createGameRaw(T.physicsFor(createPhysics, 'bar')); g.start('arcade', ['A', 'B'], false, { rnd: createGameRaw.seededRandom(9) }); g.isBreak = false; g.placing = null;
    const w = g.world; g.beginShot(); g.P.strike(w, Math.PI, 0.3, 0, 0); g.P.run(w, 60); g.resolve();
    const t1 = g.turn; g.beginShot(); g.P.strike(w, Math.PI, 0.3, 0, 0); g.P.run(w, 60); g.resolve();
    if (t1 !== 0 || g.turn !== 1 || g.arc.n !== 0) fail(`arcade: a visit of two shots went ${t1}, ${g.turn} (n ${g.arc.n})`); }
  console.log(`arcade: ${games} games of 36 played to the end, ${shots} shots`);
}

// tables of other shapes (physics.js shape, tables.js TABLE_SHAPES): on every shape, pool and carom, hard random shots -
// no ball ever ends up outside the shape's cushion unless it dropped in a hole or left the table; the holes take balls;
// the same shots give the same table twice; a ball is never placed outside or on a hole
{
  const T = require(path.join(W, 'tables.js')), S = T.TABLE_SHAPES;
  let shots = 0, holed = 0;
  for (const tid of ['bar', 'pro']) for (const kind of ['pool', 'carom']) {
    const P = T.physicsFor(createPhysics, tid)[kind]; if (!P) continue;
    for (const k of S.kinds) {
      if (k === 'poly') continue;
      const spec = S.spec(P, { kind: k }), sh = P.shape(spec), r = createGameRaw.seededRandom(k.length * 7 + (kind === 'pool' ? 1 : 2));
      if (!sh || !P.inShape(sh, 0, 0)) { fail(`shapes: ${k} on ${tid} ${kind} is not made`); continue; }
      const once = () => {
        const w = P.makeWorld(kind === 'pool' ? 8 : 4); w.shape = sh; const rr = createGameRaw.seededRandom(99);
        for (const b of w.balls) { const [x, y] = P.findFree(w, (rr() - 0.5) * 0.6, (rr() - 0.5) * 0.4); P.place(w, b.id, x, y); }
        for (let i = 0; i < 6; i++) { if (!w.balls[0].on) { const [x, y] = P.findFree(w, 0, 0); P.place(w, 0, x, y); } P.strike(w, rr() * 6.283, 1.5 + rr() * 4, (rr() - 0.5) * 0.6, (rr() - 0.5) * 0.6); P.run(w, 60); shots++;
          for (const b of w.balls) if (b.on && !P.inShape(sh, b.x, b.y)) fail(`shapes: a ball outside the ${k} cushion on ${tid} ${kind}`);
          holed += w.ev.pocketed.filter(q => q.pocket >= 6).length; }
        return w.balls.map(b => `${b.on ? 1 : 0}${b.x.toFixed(9)},${b.y.toFixed(9)}`).join(';');
      };
      if (once() !== once()) fail(`shapes: ${k} on ${tid} ${kind} plays differently twice`);
      const w = P.makeWorld(2); w.shape = sh;
      for (let i = 0; i < 200; i++) { const [x, y] = P.findFree(w, (r() - 0.5) * 2 * P.HL, (r() - 0.5) * 2 * P.HW); if (P.isFree(w, x, y) && !P.inShape(sh, x, y)) fail(`shapes: a free spot outside the ${k}`); }
    }
  }
  if (!holed) fail('shapes: no ball ever dropped into a hole');
  console.log(`shapes: ${shots} shots on ${S.kinds.length - 1} shapes, ${holed} balls into holes`);
}

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
