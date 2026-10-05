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
    const N = 10; let worst = 0, shots = 0, missed = 0, turns = 0, sum = 0, spun = 0, multi = 0;
    for (let i = 0; i < N; i++) {
      g.start(mode, ['A', 'B'], true, { level: 3, target: mode === 'three' ? 5 : 10, rnd, cushions: 3 }); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 400) {
        const who = g.turn, wasBreak = g.isBreak, t0 = Date.now(), pl = g.aiPlan(), ms = Date.now() - t0; worst = Math.max(worst, ms); sum += ms;
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
        if (!wasBreak) { turns++; if (!g.over && g.turn !== who) missed++; else if (g.over && g.over.winner !== who) missed++; }
        if (!wasBreak) { if (pl.a || pl.b) spun++; if (pl.pots > 1) multi++; }
      }
      if (!g.over) fail(`top level, ${mode}: game did not finish in 400 shots`);
      shots += n;
    }
    console.log(`top level, ${mode}: gave the table away ${missed} times in ${turns} shots, ${Math.round(shots / N)} shots a game, plans ${Math.round(sum / Math.max(1, shots))} ms on average, ${worst} ms at worst; ${spun} with spin, ${multi} potting two or more`);
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
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
        for (const b of g.world.balls) if (b.on && !(Number.isFinite(b.x) && Number.isFinite(b.y))) { fail(`${name} ${mode}: ball position is not a number`); n = 999; break; }
      }
      if (!g.over) fail(`${name} ${mode}: game did not finish in 400 shots`);
      shots += n;
    }
    console.log(`${mode} on ${name}: ${N} games, ${Math.round(shots / N)} shots each`);
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
        const shot = { snap: H.snapshot(g.world), aim: pl.angle, V: pl.V, a: pl.a || 0, b: pl.b || 0, turn: g.turn, isBreak: g.isBreak };
        g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0); g.P.run(g.world, 40); g.world.snd.length = 0;
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
// puzzles: every one is on the cloth, clear of its barricades, and the answer stored with it really does score -
// played both straight from the stored speed and through the power control's rounding, as the app's "answer" button does
{
  const createPuzzles = require(path.join(W, 'puzzles.js')), Z = createPuzzles();
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES.bar)), carom: createPhysics({ R: 0.03275, pockets: false }) });
  let bad = 0, walled = 0;
  for (const z of Z.list) {
    g.start('puzzle4', ['A', ''], false, {}); const P = g.P, w = g.world;
    z.balls.forEach((b, i) => { P.place(w, i, b[0], b[1], rnd); if (Math.abs(b[0]) > P.HL - P.R || Math.abs(b[1]) > P.HW - P.R) { fail(`puzzle ${z.id}: ball ${i} off the cloth`); } });
    w.walls = z.walls.length ? z.walls.map(q => P.wall(q[0], q[1], q[2], q[3])) : null; w.cue = 0; if (w.walls) walled++;
    for (const V of [z.sol[1], g.vOf(g.powerOf(z.sol[1]))]) {
      const t = P.clone(w); P.strike(t, z.sol[0], V, 0, 0); const ev = P.run(t, 30);
      if (!g.MODES.puzzle4.evaluate(ev).solved) { bad++; fail(`puzzle ${z.id}: its stored answer does not score`); break; }
      for (const b of t.balls) for (const s of t.walls || []) { const u = Math.max(0, Math.min(s.len, (b.x - s.ax) * s.tx + (b.y - s.ay) * s.ty)); if (Math.hypot(b.x - s.ax - s.tx * u, b.y - s.ay - s.ty * u) < P.R + s.r - 1e-3) fail(`puzzle ${z.id}: a ball ended inside a barricade`); }
    }
  }
  if (Z.list.length < 20) fail('fewer than 20 puzzles');
  console.log(`puzzles: ${Z.list.length} (${walled} with barricades), ${Z.list.length - bad} stored answers score`);
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
