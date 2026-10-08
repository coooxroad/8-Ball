/* ================= frame loop ================= */
let lastT = 0, acc = 0, fpsN = 0, fpsT = 0;
// which balls may be hit: recomputed when the table changes (st.rev), not on every frame
const NONE = [], legal = { rev: -1, turn: -1, ids: NONE };
function legalNow() { if (legal.rev !== st.rev || legal.turn !== game.turn) { legal.rev = st.rev; legal.turn = game.turn; legal.ids = game.legal(); } return legal.ids; }
// what the physics reported since the last frame: sounds to play, balls to drop into pockets
function drain() {
  const s = game.world.snd, quiet = flow.quiet;
  for (const e of s) {
    if (e.t === 'pocket') { scene.fall(game.P, e); if (!quiet) { SND.drop('lip', Math.hypot(e.vx, e.vy), panOf(e.x, e.y)); } }
    else if (e.t === 'off') scene.fly(game.P, e);
    else if (e.t === 'land') { if (!quiet) SND.ball(Math.min(1.2, e.v * 0.4), panOf(e.x, e.y)); }
    else if (!quiet) { if (e.t === 'ball') SND.ball(e.v, panOf(e.x, e.y)); else SND.rail(e.v, panOf(e.x, e.y)); }
  }
  s.length = 0;
}
// the pocket animation says when the ball knocks the inside wall and when it lands
function drainFalls() {
  const s = scene.fallEvents; if (!s.length) return;
  if (flow && !flow.quiet) for (const e of s) SND.drop(e.t, e.v, panOf(e.x, e.y));
  s.length = 0;
}
/* Fast play needs to know when, in steps, the cue ball makes its last contact with another ball this shot. The shot is
   played out on a copy alongside the real one (the physics gives the same answer every time) - a slice of it each frame, so
   that working it out never costs a frame. Until the copy has finished, play stays at its own pace. Not before 0.3 seconds
   in either, so a shot that hits nothing still starts at its own pace. */
function aheadStart(ca) {
  if (!prefs.fast || (flow && flow.quiet)) { st.ahead = null; return; }
  const P = game.P, w = P.clone(game.world); w.snd = []; P.strike(w, st.aim, ca.V, ca.a, ca.b, ca.el);
  st.ahead = { w, t: 0, last: 36, done: false };
}
function aheadStep() {
  const a = st.ahead; if (!a || a.done) return;
  const P = game.P, w = a.w;
  const until = performance.now() + 3;                      // three milliseconds of it a frame at the most
  for (let k = 0; k < 400 && !a.done && (k < 4 || performance.now() < until); k++) {
    P.step(w, TICK); a.t++;
    for (const e of w.snd) if (e.t === 'ball' && (e.ia === w.cue || e.ib === w.cue)) a.last = Math.max(a.last, a.t);
    w.snd.length = 0;
    if (P.rest(w) || a.t >= 30 * 120) a.done = true;
  }
}
function stepSim(dt) {
  const w = game.world, P = game.P;
  // once everything is crawling, run the clock faster so nobody waits on the last roll
  let vmax = 0; for (const b of w.balls) if (b.on) { const s = Math.abs(b.vx) + Math.abs(b.vy); if (s > vmax) vmax = s; }
  // fast play: once the cue ball has met every ball it is going to meet this shot, the rest runs at double speed
  aheadStep(); const fast = !!st.ahead && st.ahead.done && st.simTick > st.ahead.last; bolts.set(fast);
  acc += dt * (fast ? 2 : 1);
  let n = 0; while (acc >= TICK && n < 30) { P.step(w, TICK); acc -= TICK; n++; st.simTick++; }
  if (n === 30) acc = 0;
  const alpha = acc / TICK;
  drain(); SND.rolling(flow.quiet ? 0 : Math.min(8, vmax));
  if (P.rest(w) && !scene.falling) { st.settle += dt; if (st.settle > 0.12) endShot(); }
  return alpha;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now;
  const paused = !$('#sheet').hidden;
  let animating = false, alpha = 1, pull = 0.03 + st.power * 0.2, clip = null;
  if (!paused) {
    if (st.phase === 'auto') { autoTick(dt); animating = true; }
    if (st.phase === 'strike') {
      const ca = st.cueAnim; ca.t += dt; animating = true;
      const k = Math.min(1, ca.t / 0.1); pull = ca.from * (1 - k * k) - 0.004 * k;
      if (ca.t >= 0.1) { const c = game.cueBall(); aheadStart(ca); st.simTick = 0; game.P.strike(game.world, st.aim, ca.V, ca.a, ca.b, ca.el); if (!flow.quiet) SND.cue(ca.V, panOf(c.x, c.y)); st.phase = 'sim'; acc = 0; st.settle = 0; st.power = 0; setPowerUI(0); }
    }
    if (st.phase === 'sim') { alpha = stepSim(dt); animating = true; if (st.phase !== 'sim') { SND.rolling(0); bolts.set(false); } }
    else if (st.phase === 'reel') { clip = reel.tick(dt); animating = true; if (clip) { alpha = clip.alpha; pull = clip.pull; } }
    else if (st.phase === 'hold') { st.holdT -= dt; animating = true; if (st.holdT <= 0) { const f = st.afterHold; st.afterHold = null; f(); } }
  }
  if (st.phase === 'aim' && game.P.REAL) syncEl();
  const lined = st.phase === 'aim' || (st.phase === 'auto' && !!st.auto && !!st.auto.plan);
  const drew = scene.frame({
    game, alpha, aim: st.aim, power: st.power, pull, spin: st.spin, el: st.phase === 'strike' && st.cueAnim ? st.cueAnim.el : st.el, rev: st.rev, animating,
    showCue: clip ? clip.cue : lined || st.phase === 'strike' || st.phase === 'idle', showGuide: lined, level: flow ? flow.guide() : 0, aimStyle: prefs.aim,
    legalIds: st.screen === 'play' ? legalNow() : NONE, hand: !!game.placing && st.phase === 'aim',
  }, dt);
  drainFalls();
  if (paused && st.phase === 'sim') { SND.rolling(0); bolts.set(false); }
  if (prefs.fps) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} FPS · ${scene.pixelRatio.toFixed(2)}x` + (drew ? '' : ' · 대기'); fpsN = 0; fpsT = 0; }
  }
}

/* ================= saving ================= */
function snapshot() {
  if (st.screen !== 'play' || !flow || !flow.save) return;
  const d = { v: 2, game: game.serialize(), aim: st.aim, series, tbl: prefs.table, real: !!game.P.REAL, hl: { shots: match.shots, best: match.best, worst: match.worst, count: match.count } };
  store.set('save', d);
}
function start() {
  SND.song.load(); $('#fps').hidden = !prefs.fps;
  goHome(true);                                             // a game left unfinished waits on the first screen as a card to carry on with
  if (prefs.news) sheetNews();
  requestAnimationFrame(frame);
}
window.__dp8 = { game, st, prefs, bolts, resume, homeDemo, get flow() { return flow; }, scene, drills, practice, puzzle, puzzles, match, reel, playBest, playWorst, SND, showRecords, startMatch: match.start, startPractice: practice.start, goHome, shoot, endShot };
start();
