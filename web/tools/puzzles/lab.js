'use strict';
/* The puzzle lab: the generator's and the puzzle AI's common ground (gen.js, rate.js). Everything is played on the app's
   own physics and judged by puzzles.js (setup, judge) - the rules the app, the tests and the server use - so what is
   found here works there. A puzzle is set out once (env) and each try played on a copy of it. */
const createPhysics = require('../../physics.js'), createGame = require('../../game.js');
const { physicsFor, TABLE_OUTLINES, TABLE_SHAPES } = require('../../tables.js');
const Z = require('../../puzzles.js')(TABLE_SHAPES);
const DEG = Math.PI / 180;
const g = createGame(physicsFor(createPhysics, 'bar'));
function seeded(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
let sims = 0;
// a puzzle set out, ready to be tried: the game started in its mode, the balls down
function env(z) {
  g.start(Z.modeOf(z), ['A', ''], false, { rnd: () => 0.5 }); Z.setup(g, z, () => 0.5);
  return { z, P: g.P, w0: g.P.clone(g.world), vmin: g.vOf(0), vmax: g.vOf(1) };
}
// one shot struck on world w (changed in place): its events; ok false if it broke the rules of a stroke
function strike(E, w, s) {
  const [aim, V, a, b, el] = s;
  if (![aim, V, a, b, el].every(Number.isFinite) || V < E.vmin - 1e-9 || V > E.vmax + 1e-9 || a * a + b * b > 0.640000001 || el < 0 || el > Math.PI / 2) return null;
  E.P.strike(w, aim, V, a, b, el); sims++; const ev = E.P.run(w, 30);
  return E.P.rest(w) ? ev : null;
}
// shots tried in turn from the start (or from world w, turn t on): { ok, turn, ev, w, evs }
function attempt(E, shots, from, t0, before) {
  const z = E.z, T = Z.turnsOf(z), w = E.P.clone(from || E.w0), down = (before || []).slice(), evs = [];
  for (let t = t0 || 0; t < T; t++) {
    const s = shots[t - (t0 || 0)]; if (!s) return { ok: false, turn: t, w, evs, partial: t > (t0 || 0) };
    const ev = strike(E, w, s); if (!ev) return { ok: false, turn: t, w, evs };
    evs.push(ev);
    const j = Z.judge(g, z, ev, w, t, down);
    if (!j.ok) return { ok: false, turn: t, ev, w, evs, note: j.note };
    for (const q of ev.pocketed) down.push(q.id);
    if (j.done) return { ok: true, turn: t, ev, w, evs, down };
  }
  return { ok: false, turn: T, w, evs };
}
// one turn alone: shot s from world `from` (the start if none) at turn t, judged as that turn - { ok, done, ev, w, down }
function turn(E, s, from, t, before) {
  const w = E.P.clone(from || E.w0), ev = strike(E, w, s); if (!ev) return { ok: false };
  const j = Z.judge(g, E.z, ev, w, t || 0, before || []);
  return { ok: j.ok, done: j.done, note: j.note, ev, w, down: (before || []).concat(ev.pocketed.map(q => q.id)) };
}
const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
// a shot as a hand of rating R plays it: aim, pace and tip each off by a normal error halving every 400 points
const SIG = { A: 0.0028, V: 0.03, T: 0.05 };
const hand = R => Math.pow(2, (1500 - R) / 400);
// (f: the hand's error scaled - a try put right after a miss is played with a smaller one, ai.js TRY_HAND; q: the four
// normal draws given, so the same hands can be played at every rating - ai.js rate)
function noisy(E, s, R, rnd, f, q) {
  const k = hand(R) * (f || 1), n = q || [gauss(rnd), gauss(rnd), gauss(rnd), gauss(rnd)];
  const out = [s[0] + n[0] * SIG.A * k, Math.min(E.vmax, Math.max(E.vmin, s[1] * (1 + n[1] * SIG.V * k))), s[2] + n[2] * SIG.T * k, s[3] + n[3] * SIG.T * k, s[4]];
  const r = Math.hypot(out[2], out[3]); if (r > 0.79) { out[2] *= 0.79 / r; out[3] *= 0.79 / r; }
  return out;
}
module.exports = { Z, g, DEG, TABLE_OUTLINES, seeded, env, strike, attempt, turn, noisy, hand, SIG, gauss, sims: () => sims };
