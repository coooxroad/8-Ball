/* Playing shots again on the game's own physics, to check what the app says happened.
   The physics gives the same result for the same input, so a shot sent with where the balls stood and how it was struck
   ends exactly where the app saw it end - and a made-up result does not. */
import * as E from './gen/engine.js';
import { logError, shotOk } from './match-log.js';

const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const H = E.createHighlights();

// A puzzle (web/puzzles.js) and the shot the player solved it with: does that shot do what the puzzle asks?
export function playPuzzle(id, shot) {
  const Z = E.createPuzzles(), z = Z.byId(id);
  if (!z) return { ok: false, why: 'no such puzzle' };
  if (!shotOk(shot)) return { ok: false, why: 'bad shot' };
  const g = E.createGame(E.physicsFor(E.createPhysics, 'bar')), rnd = seeded(1);
  g.start('puzzle4', ['A', ''], false, { rnd }); const P = g.P, w = g.world, goal = Z.STAGES[z.stage].goal;
  z.balls.forEach((b, i) => P.place(w, i, b[0], b[1], rnd)); w.cue = 0; g.goal = goal;
  P.strike(w, shot.aim, shot.V, shot.a, shot.b, shot.el || 0);
  const ev = P.run(w, 40);
  return g.MODES.puzzle4.judge(goal, ev, w).ok ? { ok: true } : { ok: false, why: 'the shot does not solve it' };
}

/* A whole match, from its log (app/50-match.js keeps it): { mode, table, opts, shots: [{ s: where the balls stood (the
   highlights snapshot), aim, V, a, b, el, inHand } | { timeout: true }], winner, points }. Every shot is played from where
   the last one left the balls - only a cue ball in hand may have moved - and the rules are applied as in the app.
   Ends with each player's points (a carom score, or a ball potted on a legal pool shot) and who won.

   It can be played a slice at a time: advance(steps) plays at most that many physics steps (1/120 s each) and returns
   null while there is more, or the result. Between shots (when every ball is still) checkpoint() says where it is, and
   a Replay made from that checkpoint carries on from there - so a server that may only think for a few milliseconds per
   request still plays every shot, a few hundred steps per request. */
export class Replay {
  constructor(log, cp) {
    this.log = log; const o = log && log.opts || {};
    const why = logError(log); if (why) { this.out = { ok: false, why }; return; }
    this.g = E.createGame(E.physicsFor(E.createPhysics, log.table));
    this.g.start(log.mode, ['A', 'B'], false, { rnd: seeded(1), first: o.first ? 1 : 0, target: o.target, cushions: o.cushions, targets: o.targets, tens: !!o.tens, finish: !!o.finish, ice: !!o.ice });
    this.i = 0; this.points = [0, 0]; this.running = false;
    // Older checkpoints did not save a win. Replaying those terminal checkpoints from the start recovers pending rewards.
    if (cp && cp.i === log.shots.length && !cp.over) cp = null;
    if (cp) { this.i = cp.i; this.points = cp.points.slice(); if (!this.g.restore(cp.game)) this.out = { ok: false, why: 'bad checkpoint' }; else { this.g.world.ice = !!o.ice; this.g.over = cp.over || null; } }
  }
  checkpoint() { return this.running || this.out ? null : { i: this.i, points: this.points.slice(), game: JSON.parse(JSON.stringify(this.g.serialize())), over: this.g.over && { ...this.g.over } }; }
  // the next shot set going, or the end of the match
  begin() {
    const g = this.g, log = this.log, o = log.opts || {};
    while (this.i < log.shots.length && !g.over && log.shots[this.i].timeout) { g.timeout(); this.i++; }
    if (this.i >= log.shots.length || g.over) {
      if (!g.over) return this.out = { ok: false, why: 'the match does not end' };
      if (log.winner !== g.over.winner) return this.out = { ok: false, why: 'a different winner' };
      return this.out = { ok: true, points: this.points, winner: g.over.winner };
    }
    const sh = log.shots[this.i], w = g.world, i = this.i;
    if (!shotOk(sh) || !sh.s || !Array.isArray(sh.s.balls) || sh.s.balls.length !== w.balls.length) return this.out = { ok: false, why: `shot ${i}: bad` };
    if (i > 0) for (let j = 0; j < w.balls.length; j++) {
      if (j === w.cue && g.placing) continue;
      const b = w.balls[j], v = sh.s.balls[j];
      if (!!v[2] !== b.on || (b.on && (Math.abs(v[0] - b.x) > 1e-7 || Math.abs(v[1] - b.y) > 1e-7))) return this.out = { ok: false, why: `shot ${i}: ball ${j} is not where the last shot left it` };
    }
    H.restore(w, sh.s); if (!!sh.s.ice !== !!o.ice) return this.out = { ok: false, why: 'ice changed' };
    this.me = g.turn; g.beginShot(); g.P.strike(w, sh.aim, sh.V, sh.a, sh.b, sh.el || 0); this.t = 0; this.running = true;
    return null;
  }
  advance(steps) {
    while (!this.out && steps > 0) {
      if (!this.running) { if (this.begin()) break; continue; }
      const g = this.g, w = g.world, P = g.P;
      while (steps > 0 && !P.rest(w) && this.t < 40) { P.step(w, 1 / 120); this.t += 1 / 120; steps--; }
      if (!P.rest(w) && this.t < 40) break;                                       // (out of steps for now, mid-shot)
      for (const b of w.balls) b.wz = 0;                                          // (as physics.run ends a shot)
      const potted = w.ev.pocketed.filter(p => p.id !== 0).length, r = g.resolve().r;
      if (g.mode.table === 'carom') { if (r.pts > 0) this.points[this.me] += r.pts; } else if (!r.foul) this.points[this.me] += potted;
      this.running = false; this.i++;
      this.lastCp = this.checkpoint();                                          // (including a win at the last step of a slice)
    }
    return this.out || null;
  }
}
// all of it at once (for a server that may think as long as it likes, and for the tests)
export const playMatch = log => new Replay(log).advance(Infinity);
export { E };
