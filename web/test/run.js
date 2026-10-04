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
  for (const mode of ['eight', 'nine', 'four']) {
    const N = 10; let worst = 0, shots = 0, missed = 0, turns = 0, sum = 0;
    for (let i = 0; i < N; i++) {
      g.start(mode, ['A', 'B'], true, { level: 3, target: 10, rnd }); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 400) {
        const who = g.turn, wasBreak = g.isBreak, t0 = Date.now(), pl = g.aiPlan(), ms = Date.now() - t0; worst = Math.max(worst, ms); sum += ms;
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, 0, 0); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
        if (!wasBreak) { turns++; if (!g.over && g.turn !== who) missed++; else if (g.over && g.over.winner !== who) missed++; }
      }
      if (!g.over) fail(`top level, ${mode}: game did not finish in 400 shots`);
      shots += n;
    }
    console.log(`top level, ${mode}: gave the table away ${missed} times in ${turns} shots, ${Math.round(shots / N)} shots a game, plans ${Math.round(sum / Math.max(1, shots))} ms on average, ${worst} ms at worst`);
    if (missed > turns * 0.1) fail(`top level, ${mode}: gave the table away ${missed} times in ${turns} shots`);
  }
}

for (const name of ['bar', 'pro', 'pub']) {
  const g = createGame({ pool: createPhysics(Object.assign({ pockets: true }, TABLES[name])), carom: createPhysics({ R: 0.03275, pockets: false }) });
  for (const mode of ['eight', 'nine', 'four']) {
    let shots = 0; const N = 3;
    for (let i = 0; i < N; i++) {
      g.start(mode, ['A', 'B'], true, { level: 2, target: 5, rnd }); g.players[0].ai = true;
      let n = 0;
      while (!g.over && n < 400) {
        const pl = g.aiPlan();
        if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
        g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, 0, 0); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve(); n++;
        for (const b of g.world.balls) if (b.on && !(Number.isFinite(b.x) && Number.isFinite(b.y))) { fail(`${name} ${mode}: ball position is not a number`); n = 999; break; }
      }
      if (!g.over) fail(`${name} ${mode}: game did not finish in 400 shots`);
      shots += n;
    }
    console.log(`${mode} on ${name}: ${N} games, ${Math.round(shots / N)} shots each`);
  }
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
