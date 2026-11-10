/* Playing shots again on the game's own physics, to check what the app says happened.
   The physics gives the same result for the same input, so a shot sent with where the balls stood and how it was struck
   ends exactly where the app saw it end - and a made-up result does not. */
import * as E from './gen/engine.js';
// the furthest from the cue ball's centre a shot may be struck, as a share of its radius (see Replay.begin)
const STRIKE_MAX = Math.max(0.79, ...E.CUES.map(c => 0.5 * E.spinMaxOf(c) * (1 + ((c.stat && c.stat.spin) || 0) / 100))) + 1e-9;
import { logError, shotOk, badShotAt } from './match-log.js';

const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const H = E.createHighlights();

// A puzzle (web/puzzles.js) and the shot the player solved it with: does that shot do what the puzzle asks?
export function playPuzzle(id, shot) {
  const Z = E.createPuzzles(), z = Z.byId(id);
  if (!z) return { ok: false, why: 'no such puzzle' };
  if (!shotOk(shot)) return { ok: false, why: 'bad shot' };
  const g = E.createGame(E.physicsFor(E.createPhysics, 'bar')), rnd = seeded(1);
  g.start('puzzle4', ['A', ''], false, { rnd }); const P = g.P, w = g.world, goal = Z.STAGES[z.stage].goal;
  w.walls = P.walls(z.walls); z.balls.forEach((b, i) => P.place(w, i, b[0], b[1], rnd)); w.cue = 0; g.goal = goal;
  P.strike(w, shot.aim, shot.V, shot.a, shot.b, shot.el || 0);
  const ev = P.run(w, 40);
  return g.MODES.puzzle4.judge(goal, ev, w).ok ? { ok: true } : { ok: false, why: 'the shot does not solve it' };
}

/* A lesson (web/drills.js) done at its top level: the layout is made again from the seed the device made it from (on that
   table size), the balls set out as the app sets them (app/51-practice.js putLayout), and the shot played - does it do
   what the lesson asks? */
export function playLesson(id, proof) {
  const D = E.createDrills(), d = D.byId(id), p = proof || {};
  if (!d || d.id !== id || !d.make) return { ok: false, why: 'no such lesson' };
  if (!shotOk(p.shot) || !Number.isInteger(p.seed)) return { ok: false, why: 'bad shot' };
  const g = E.createGame(E.physicsFor(E.createPhysics, p.table)), rnd = E.seededRandom(p.seed >>> 0);
  g.start('practice', ['A', ''], false, { rnd: seeded(1) });
  const L = D.make(id, g.P, D.LEVELS, rnd, g.vOf); if (!L) return { ok: false, why: 'no layout' };
  const P = g.P, w = g.world;
  g.MODES.practice.setup(g, null);
  if (L.rack) { g.MODES.eight.setup(g, E.seededRandom((p.seed ^ 0x9e3779b9) >>> 0)); g.placing = null; }
  else { P.place(w, 0, L.cue[0], L.cue[1], null); for (const [bid, x, y] of L.balls) P.place(w, bid, x, y, null); }
  g.isBreak = !!L.rack; P.strike(w, p.shot.aim, p.shot.V, p.shot.a, p.shot.b, p.shot.el || 0);
  const ev = P.run(w, 40);
  return D.judge(L, ev, w.balls[0]) === '' ? { ok: true } : { ok: false, why: 'the shot does not do it' };
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
  // open: a ranked game's log (room.js) - it may stop before the end (someone left), and who won is what the replay says,
  // not what a player claims. A shot carries the seat that sent it (seat), checked against whose turn it was; a failing
  // shot's index is in the answer (at), so the seat that sent it can be held to it.
  constructor(log, cp, open) {
    this.log = log; this.open = !!open; const o = log && log.opts || {};
    const why = logError(log); if (why) { const at = badShotAt(log); this.out = at == null ? { ok: false, why } : { ok: false, why: `shot ${at}: ${why}`, at }; return; }
    this.g = E.createGame(E.physicsFor(E.createPhysics, log.table));
    // a ranked game starts from its room's seed, the rack and the 4구 roll-out as both devices made them (room.js)
    const rnd = this.open ? E.seededRandom(log.seed >>> 0) : seeded(1);
    this.g.start(log.mode, ['A', 'B'], false, { rnd, first: o.first ? 1 : 0, target: o.target, cushions: o.cushions, targets: o.targets, tens: !!o.tens, finish: o.finish, ice: !!o.ice, real: o.real, team: !!o.team });
    if (this.open && log.mode === 'four') { this.g.rollOut(E.seededRandom((log.seed ^ 0x5bd1e995) >>> 0)); this.g.P.run(this.g.world, 40); this.g.world.ev = this.g.P.newEv(); }
    this.i = 0; this.points = [0, 0]; this.running = false;
    // Older checkpoints did not save a win. Replaying those terminal checkpoints from the start recovers pending rewards.
    if (cp && cp.i === log.shots.length && !cp.over) cp = null;
    if (cp) { this.i = cp.i; this.points = cp.points.slice(); if (!this.g.restore(cp.game)) this.out = { ok: false, why: 'bad checkpoint' }; else { this.g.world.ice = !!o.ice; this.g.world.real = this.g.real; this.g.over = cp.over || null; this.fresh = !!cp.fresh; if (cp.rnd != null && this.g.rnd.seek) this.g.rnd.seek(cp.rnd); } }
  }
  // (rnd: where the rack's chances have got to - a break that does not stand is racked again from them, game.js)
  checkpoint() { return this.running || this.out ? null : { i: this.i, points: this.points.slice(), game: JSON.parse(JSON.stringify(this.g.serialize())), over: this.g.over && { ...this.g.over }, fresh: !!this.fresh, rnd: this.g.rnd && this.g.rnd.state ? this.g.rnd.state() : null }; }
  // the next shot set going, or the end of the match
  begin() {
    const g = this.g, log = this.log, o = log.opts || {};
    // (a timeout is the turn of the seat whose clock ran out: a seat cannot run out another's - Codex B11)
    while (this.i < log.shots.length && !g.over && log.shots[this.i].timeout) {
      const t = log.shots[this.i]; if (t.seat != null && t.seat !== g.shooter()) return this.out = { ok: false, why: `shot ${this.i}: a timeout not on this seat's turn`, at: this.i };
      g.timeout(); this.i++;
    }
    if (this.i >= log.shots.length || g.over) {
      if (this.open) return this.out = { ok: true, points: this.points, winner: g.over ? g.over.winner : null };
      if (!g.over) return this.out = { ok: false, why: 'the match does not end' };
      if (log.winner !== g.over.winner) return this.out = { ok: false, why: 'a different winner' };
      return this.out = { ok: true, points: this.points, winner: g.over.winner };
    }
    const sh = log.shots[this.i], w = g.world, i = this.i;
    if (!shotOk(sh) || !sh.s || !Array.isArray(sh.s.balls) || sh.s.balls.length !== w.balls.length) return this.out = { ok: false, why: `shot ${i}: bad`, at: i };
    if (sh.seat != null && sh.seat !== g.shooter()) return this.out = { ok: false, why: `shot ${i}: not this seat's turn`, at: i };
    // (the first shot of a game played on one device may start from any rack; a ranked game's from its seed's)
    // (nor a new rack after a break that did not stand, on a game played on one device: its rack was the device's own)
    if ((i > 0 && !this.fresh) || this.open) for (let j = 0; j < w.balls.length; j++) {
      if (j === w.cue && g.placing) continue;
      const b = w.balls[j], v = sh.s.balls[j];
      if (!!v[2] !== b.on || (b.on && (Math.abs(v[0] - b.x) > 1e-7 || Math.abs(v[1] - b.y) > 1e-7))) return this.out = { ok: false, why: `shot ${i}: ball ${j} is not where the last shot left it`, at: i };
    }
    // the cue ball is the game's, not the shot's to say; one in hand goes on the cloth, clear of the others, behind the head
    // string on a break (as app/80-input.js tryPlace and the computer put it) - Codex B12
    if (sh.s.cue !== w.cue) return this.out = { ok: false, why: `shot ${i}: not the cue ball`, at: i };
    if (g.placing && (i > 0 || this.open)) {
      const v = sh.s.balls[w.cue];
      if (!v[2] || !g.P.isFree(w, v[0], v[1], w.cue) || (g.placing === 'kitchen' && v[0] > -g.P.HL / 2 + 1e-9)) return this.out = { ok: false, why: `shot ${i}: the cue ball cannot go there`, at: i };
    }
    // no harder than the seat's cue strikes at full gauge (Codex B14)
    if (this.open && Array.isArray(log.cues) && sh.V > this.vMax(g.shooter())) return this.out = { ok: false, why: `shot ${i}: harder than the cue can strike`, at: i };
    // no further from the ball's centre than any cue strikes (one with no strike limit, at full pad - content/20-cues.js
    // TRAITS) or the computer does (a stand-in's plan: web/ai/50-human.js, 0.79 of the radius)
    if (this.open && Math.hypot(sh.a || 0, sh.b || 0) > STRIKE_MAX) return this.out = { ok: false, why: `shot ${i}: struck further out than a cue can`, at: i };
    H.restore(w, sh.s); if (!!sh.s.ice !== !!o.ice) return this.out = { ok: false, why: 'ice changed', at: i };
    w.real = g.real;                                                           // (the add-on is the game's rules', not the shot's to say)
    this.me = g.turn; g.beginShot(); g.P.strike(w, sh.aim, sh.V, sh.a, sh.b, sh.el || 0); this.t = 0; this.running = true;
    return null;
  }
  /* The hardest a seat can strike: the full gauge (g.vOf(1), a break's extra included) times its cue's power stat - the
     sum a stroke makes (web/app/80-input.js) - and never less than an ordinary cue's: a stand-in's plan (web/ai) strikes up
     to g.vOf(1) whatever it holds. log.cues: each seat's cue id (the room's, from the players' gear; null: the usual). */
  vMax(seat) {
    const id = this.log.cues[seat], c = E.CUES.find(q => q.id === id), k = 1 + ((c && c.stat && c.stat.power) || 0) / 100;
    return this.g.vOf(1) * Math.max(1, k) * (1 + 1e-9);
  }
  advance(steps) {
    while (!this.out && steps > 0) {
      if (!this.running) { if (this.begin()) break; continue; }
      const g = this.g, w = g.world, P = g.P;
      while (steps > 0 && !P.rest(w) && this.t < 40) { P.step(w, 1 / 120); this.t += 1 / 120; steps--; }
      if (!P.rest(w) && this.t < 40) break;                                       // (out of steps for now, mid-shot)
      for (const b of w.balls) b.wz = 0;                                          // (as physics.run ends a shot)
      const potted = w.ev.pocketed.filter(p => p.id !== 0).length, r = g.resolve().r; this.fresh = !!r.rerack;
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
export const DRILLS = E.createDrills();
