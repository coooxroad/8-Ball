/* ================= frame loop ================= */
let lastT = 0, acc = 0, lastRaw = 0;
// Keep a deadline on the display's clock: at 144 Hz, resetting it to 'now' after each frame would fall to 48 FPS.
// '높음' and '자동' keep the screen's own refresh rate (the owner's choice, 11-04: 주사율 기기 그대로); '낮음' stops at 60, and
// a software renderer at 30 whatever the setting but '높음'.
const framePace = { due: 0, hz: 0 };
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
    else { if (!quiet) { if (e.t === 'ball') SND.ball(e.v, panOf(e.x, e.y)); else SND.rail(e.v, panOf(e.x, e.y)); } scene.hit(e); }
  }
  s.length = 0;
}
// the pocket animation says when the ball knocks the inside wall and when it lands
function drainFalls() {
  const s = scene.fallEvents; if (!s.length) return;
  if (flow && !flow.quiet) for (const e of s) SND.drop(e.t, e.v, panOf(e.x, e.y));
  s.length = 0;
}
// the trail's own sounds (scene/56-fx.js): a puff of wind, a flame, a splash
function drainFx() {
  const s = scene.fxSounds; if (!s.length) return;
  for (const e of s) SND.fx(e.file, flow && flow.quiet ? 0 : e.v, e.rate, panOf(e.x, e.y));
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
  const until = performance.now() + (lastRaw > 20 ? 1.5 : 3);   // three milliseconds of it a frame at the most; half when frames are running late
  for (let k = 0; k < 400 && !a.done && (k < 4 || performance.now() < until); k++) {
    P.step(w, TICK); a.t++;
    for (const e of w.snd) if (e.t === 'ball' && (e.ia === w.cue || e.ib === w.cue)) a.last = Math.max(a.last, a.t);
    w.snd.length = 0;
    if (P.rest(w) || a.t >= 30 * 120) a.done = true;
  }
}
// Rolling the balls out before a game (4구): each ball given a push in a random direction, the table played until it
// stops, and then the flow told (flow.rolled) instead of a shot being judged.
function rollOut(rnd) {
  const w = game.world, P = game.P; w.ev = P.newEv();
  game.rollOut(rnd || Math.random);
  st.ahead = null; st.simTick = 0; acc = 0; st.settle = 0; st.rolling = flow; st.phase = 'sim';   // (rolling: the flow it is for)
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
  if (P.rest(w) && !scene.falling) { st.settle += dt; if (st.settle > 0.12) { if (st.rolling) { const f = st.rolling; st.rolling = false; st.rev++; if (f === flow) flow.rolled(); else st.phase = 'idle'; } else endShot(); } }
  return alpha;
}
let wallsShown = null;
function frame(now) {
  requestAnimationFrame(frame);
  const hz = prefs.quality === 'high' ? 0 : scene.softwareRendering ? 30 : prefs.quality === 'low' ? 60 : 0;
  if (hz) {
    const step = 1000 / hz;
    if (framePace.hz !== hz) { framePace.hz = hz; framePace.due = 0; }
    if (framePace.due && now < framePace.due - 0.25) return;
    framePace.due = !framePace.due || now - framePace.due > step ? now + step : framePace.due + step;
  } else { framePace.hz = 0; framePace.due = 0; }
  const f0 = performance.now(); prof.frame();
  checkPixelRatio();
  const raw = lastT ? now - lastT : 0, dt = Math.min(0.1, raw / 1000 || 0); lastT = now; lastRaw = raw;
  // (a sheet is up, or the home screen's table is covered - the play boards, the cards, the books: its demo waits)
  // (a ranked game goes on under a sheet: the other player is still playing)
  const paused = (!$('#sheet').hidden && !(flow === match && match.ctx && match.ctx.online && st.screen === 'play')) || (st.screen === 'home' && !deskTableShown());
  let animating = false, alpha = 1, pull = 0.03 + st.power * 0.2, clip = null, follow = null;
  if (!paused) {
    if (st.phase === 'auto') { autoTick(dt); animating = true; }
    shotClock(dt); eyeTick(); ranked.tick();
    if (st.phase === 'strike') {
      const ca = st.cueAnim; ca.t += dt; animating = true;
      const k = Math.min(1, ca.t / 0.1); pull = ca.from * (1 - k * k);
      if (ca.t >= 0.1) { const c = game.cueBall(), s = game.P.launch(ca.V, ca.a, ca.b, ca.el || 0);
        const recoil = s.tipVelocity[0] * s.contact.axis[0] + s.tipVelocity[1] * s.contact.axis[1] + s.tipVelocity[2] * s.contact.axis[2] < 0;
        st.follow = { t: 0, x: c.x, y: c.y, V: ca.V, a: ca.a, b: ca.b, recoil, el: ca.el || 0, spin: { x: st.spin.x, y: st.spin.y } }; aheadStart(ca); st.simTick = 0; game.P.strike(game.world, st.aim, ca.V, ca.a, ca.b, ca.el); if (!flow.quiet) SND.cue(ca.V, panOf(c.x, c.y)); st.phase = 'sim'; acc = 0; st.settle = 0; st.power = 0; setPowerUI(0); }
    }
    // Follow-through or recoil follows the resolved contact; an upward rebound must not meet a descending drawn cue.
    if (st.follow && (st.phase === 'sim' || st.phase === 'hold')) {
      const f = st.follow; f.t += Math.max(0, dt);
      if (f.t > 0.42) st.follow = null;
      else {
        const R = game.P.R, se = Math.sin(f.el), point = game.P.cueContact(st.aim, f.a, f.b, f.el).point;
        let reach = Math.min(0.11, 0.025 + f.V * 0.014);
        if (se > 0.05) reach = Math.min(reach, Math.max(0, (R + point[2] - 0.006) / se));
        if (f.recoil) reach = -0.1;  // the coupled tip/bed impact sent the cue back: do not draw it pushing through a rising ball
        const k = Math.min(1, f.t / 0.11), ease = 1 - (1 - k) * (1 - k);
        follow = { x: f.x, y: f.y, pull: -reach * ease, el: f.el, a: f.a, b: f.b, spin: f.spin };
      }
    }
    if (st.phase === 'sim') { const s0 = performance.now(); alpha = stepSim(dt); prof.add('sim', performance.now() - s0); animating = true; if (st.phase !== 'sim') { SND.rolling(0); bolts.set(false); } }
    else if (st.phase === 'reel') { clip = reel.tick(dt); animating = true; if (clip) { alpha = clip.alpha; pull = clip.pull; } }
    else if (st.phase === 'hold') { st.holdT -= dt; animating = true; if (st.holdT <= 0) { const f = st.afterHold, by = st.holdFlow; st.afterHold = st.holdFlow = null; if (f && by === flow) f(); else st.phase = 'idle'; } }
  }
  if (st.phase === 'aim') syncEl();
  if (game.world.walls !== wallsShown) { wallsShown = game.world.walls; scene.setWalls(wallsShown); }   // (a puzzle's barricades)
  const lined = st.phase === 'aim' || (st.phase === 'auto' && !!st.auto && !!st.auto.plan);
  const d0 = performance.now(); scene.prof.guide = 0;
  const drew = scene.frame({
    game, alpha, aim: st.aim, power: st.power, pull, spin: st.spin, el: st.phase === 'strike' && st.cueAnim ? st.cueAnim.el : st.el, rev: st.rev, animating,
    follow, contact: st.phase === 'strike' ? st.cueAnim : null, showCue: clip ? clip.cue : lined || st.phase === 'strike' || st.phase === 'idle' || !!follow, showGuide: lined, aimStyle: prefs.aim,
    // the player's own aim is played out with their cue's stat (the guide is the shot); a planned one as it was planned
    gear: st.phase === 'aim' ? cueK() : null, level: flow ? flow.guide() * (st.phase === 'aim' ? cueK().guide : 1) : 0,
    legalIds: st.screen === 'play' ? legalNow() : NONE, hand: !!game.placing && st.phase === 'aim',
    covered: st.screen === 'home' && !deskTableShown(),
  }, dt);
  { const g = scene.prof.guide; prof.add('guide', g); prof.add('draw', performance.now() - d0 - g); }
  drainFalls(); drainFx();
  if (paused && st.phase === 'sim') { SND.rolling(0); bolts.set(false); }
  prof.add('js', performance.now() - f0);
  perfTick(raw, drew);
}
/* How the frames are coming, from the real time between them (not the game's capped dt). Every two seconds:
   - the display (설정 · 초당 프레임 표시), two lines:
       frames a second (of frames that drew), how many came late (over 25 ms), the slowest in twenty (p95), the longest gap
       between any two frames these two seconds and over the whole session (with what took the most time in it), the 3D's
       pixel density;
       the slowest single piece of work these two seconds, in ms: AI (the computer deciding), 조준 (playing out the aim line),
       물리 (the shot itself), 그리기 (the 3D), 화면 (work outside the frame: taps, building screens - from the browser's
       long-animation-frame / longtask report where it has one), then what the frame drew (draw calls · thousands of triangles);
   - on '자동', the visible live table can shed pixels on the desk, in play or in a replay. Very slow frames count too;
     two slow windows lower only the 3D resolution (down to half per axis), then stable windows restore it gradually.
     A software renderer targets 30 FPS, so its normal 33ms cadence must not trigger the 60-FPS slow-frame threshold.
     The change waits for the next frame's start (scene setScale/takeScale); text and physics keep their own resolution.
   A gap that spans the page being hidden (another app, the screen off) is not counted. */
const perf = { gaps: [], t: 0, frames: 0, ok: 0, slow: 0, calls: 0, tris: 0, long: 0, longWhy: '', stalls: 0 };
function perfTick(raw, drew) {
  if (prof.hid) { prof.hid = false; return; }                              // (the page was away: that gap is not ours)
  perf.t += raw;
  if (raw > 0) perf.frames++;
  if (raw > perf.long) { perf.long = raw; perf.longWhy = prof.why(raw); }
  if (raw > 100) perf.stalls++;
  if (drew && raw > 0) { perf.gaps.push(raw); perf.calls = scene.info.render.calls; perf.tris = scene.info.render.triangles; }
  if (perf.t < 2000) return;
  if (perf.long > prof.worst) { prof.worst = perf.long; prof.worstWhy = perf.longWhy; }
  const g = perf.gaps.sort((a, b) => a - b), n = g.length, at = q => g[Math.min(n - 1, Math.floor(n * q))];
  if (prefs.fps) {
    const ms = k => Math.round(prof.win[k] || 0), why = w => w ? ' ' + w : '';
    const late = framePace.hz === 30 ? 45 : 25;
    const a = n ? `${Math.round(n * 1000 / perf.t)} FPS · 늦음 ${Math.round(100 * g.filter(x => x > late).length / n)}% · p95 ${Math.round(at(0.95))}ms` : '대기';
    const b = `최장 ${Math.round(perf.long)}ms${why(perf.longWhy)}${perf.stalls ? ` · 멈춤 ${perf.stalls}회` : ''} · 세션 최장 ${Math.round(prof.worst)}ms${why(prof.worstWhy)} · ${scene.pixelRatio.toFixed(2)}x`;
    const c = `AI ${ms('ai')} · 조준 ${ms('guide')} · 물리 ${ms('sim')} · 그리기 ${ms('draw')} · 화면 ${ms('ui')}ms · ${perf.calls}회 ${Math.round(perf.tris / 1000)}k`;
    const gpu = scene.softwareRendering ? 'WebGL: 소프트웨어 렌더링' : 'WebGL: ' + (scene.rendererName || '장치 정보 없음');
    $('#fps').textContent = a + ' · ' + b + '\n' + c + '\n' + gpu;
  }
  const live = st.screen === 'play' || st.screen === 'reel' || (st.screen === 'home' && deskTableShown());
  if (prefs.quality === 'auto' && live && n >= 3) {
    const target = scene.softwareRendering ? 30 : 60, rate = perf.frames * 1000 / perf.t;
    // Healthy 60-FPS pacing on a 75-Hz monitor includes 26.7ms gaps; sparse on-demand draws are not GPU overload either.
    if (rate < target * 0.8 && at(0.9) > (scene.softwareRendering ? 45 : 25)) {
      perf.ok = 0; if (++perf.slow >= 2) { perf.slow = 0; scene.setScale(scene.scale - (at(0.9) > 60 ? 0.2 : 0.1)); }
    } else {
      perf.slow = 0;
      if (rate < target * 0.9 || at(0.9) >= 1900 / target) perf.ok = 0;
      else if (++perf.ok >= 5 && scene.scale < 1) { perf.ok = 0; scene.setScale(scene.scale + 0.05); }
    }
  } else { perf.ok = 0; perf.slow = 0; }
  perf.gaps.length = 0; perf.t = 0; perf.frames = 0; perf.long = 0; perf.longWhy = ''; perf.stalls = 0; prof.win = {};
}

/* ================= saving ================= */
function snapshot() {
  if (st.screen !== 'play' || !flow || !flow.save || (flow === match && match.ctx && match.ctx.online)) return;   // (a ranked game is not picked up later)
  const d = { v: 2, game: game.serialize(), aim: st.aim, series, tbl: prefs.table, hl: { shots: match.shots, best: match.best, worst: match.worst, count: match.count }, log: match.log, inn: match.innings, el: match.t0 ? Date.now() - match.t0 : 0 };   // el: ms played (Codex B20)
  store.set('save', d);
}
function start() {
  SND.song.load(); $('#fps').hidden = !prefs.fps;
  goHome(true);                                             // a game left unfinished waits on the first screen as a card to carry on with
  net.flush();                                              // rewards earned offline, and the wallet as the server has it
  requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('boot')));   // shown once laid out and drawn
  requestAnimationFrame(frame);
}
window.__dp8 = { prof, game, st, prefs, bolts, resume, homeDemo, get flow() { return flow; }, scene, drills, practice, puzzle, puzzles, match, reel, playBest, playWorst, SND, showRecords, ranked, net, startMatch: match.start, startPractice: practice.start, goHome, shoot, endShot };
start();
