'use strict';
// Load the same engine as the app and server; no physics or scoring rules live here.
const createPhysics = require('../../physics.js');
const createGame = require('../../game.js');
const { STAGES } = require('../../puzzles.js')();
const g = createGame({ pool: createPhysics({ pockets: true }), carom: createPhysics({ R: 0.03275, pockets: false }) });
g.start('puzzle4', ['A', ''], false, { rnd: () => 0.5 });
const P = g.P, DEG = Math.PI / 180;
function seeded(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function valid(balls) {
  return balls.length === 4 && balls.every((b, i) => b.length === 2 && b.every(Number.isFinite) && Math.abs(b[0]) <= P.HL - P.R && Math.abs(b[1]) <= P.HW - P.R && balls.slice(0, i).every(c => Math.hypot(b[0] - c[0], b[1] - c[1]) > 2 * P.R + 0.003));
}
function world(balls, yellow = true, walls = []) {
  const w = P.makeWorld(4); balls.forEach((b, i) => P.place(w, i, ...b)); w.balls[1].on = yellow; w.walls = P.walls(walls); return w;
}
let simulations = 0;
function play(balls, sol, goal, yellow = true, seconds = 30, walls = []) {
  const [angle, V, a, b, el] = sol;
  if (![angle, V, a, b, el].every(Number.isFinite) || V < g.vOf(0) || V > g.vOf(1) || a * a + b * b > 0.640000001 || el < 0 || el > Math.PI / 2) return { ok: false };
  const w = world(balls, yellow, walls); P.strike(w, angle, V, a, b, el); const ev = P.run(w, seconds); simulations++;
  return { ok: P.rest(w) && g.MODES.puzzle4.judge(goal, ev, w).ok, ev, w };
}
function width(balls, sol, goal, yellow = true, steps = 10, walls = []) {
  let good = 0, total = 0;
  for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++) {
    const s = sol.slice(); s[0] += 0.5 * DEG * i / steps; s[1] *= 1 + 0.05 * j / steps;
    // Out-of-slider perturbations are failures, never silently clamped.
    if (play(balls, s, goal, yellow, 30, walls).ok) good++; total++;
  }
  return { good, total, percent: 100 * good / total };
}
function verify(z) {
  if (!STAGES[z.stage]) throw Error(`invalid stage ${z.stage}`);
  if (STAGES[z.stage].walls ? !require('./walls').validWalls(z.balls, z.walls) : z.walls !== undefined) throw Error(`invalid barricades ${z.id}`);
  if (!valid(z.balls)) throw Error(`invalid layout ${z.id}`);
  for (const V of [z.sol[1], g.vOf(g.powerOf(z.sol[1]))]) for (const seconds of [30, 40]) {
    const sol = z.sol.slice(); sol[1] = V;
    if (!play(z.balls, sol, STAGES[z.stage].goal, true, seconds, z.walls).ok) throw Error(`answer failed ${z.id}`);
  }
}
module.exports = { g, P, DEG, STAGES, seeded, valid, play, width, verify, simulations: () => simulations };
