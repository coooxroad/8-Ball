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
/* Where it is on (owner 11-10: not a setting any more, and never in ranked play): a game against the computer or a friend
   set so before it began (match.ctx.fast - a friend's room by the host's rules), and puzzles once asked after a miss. */
function fastNow() { return flow === puzzle ? !!prefs.pzFast : flow === match ? !!(match.ctx && match.ctx.fast) : false; }
function aheadStart(ca) {
  if (!fastNow() || (flow && flow.quiet)) { st.ahead = null; return; }
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
/* Rolling the balls out before a game (4구), as a hall does it (owner 11-09): the balls lie scattered as a hand left them;
   they are gathered two by two into the corners of one diagonal - all arriving together, so the one furthest off goes
   fastest, slow to start and quick to arrive (GATHER) - a breath, and then each pair is rolled towards the middle and the
   table is played until it stops; then the flow is told (flow.rolled) instead of a shot being judged. Only the gathering is
   drawn here: where the balls go and how they are rolled is game.rollOut's (the same on every device and the server). */
const GATHER = 0.85, GATHER_REST = 0.22;
function rollOut(rnd) {
  const w = game.world, P = game.P; w.ev = P.newEv();
  const from = w.balls.map(b => [b.x, b.y]);
  game.rollOut(rnd || Math.random);
  const to = w.balls.map(b => [b.x, b.y, b.vx, b.vy]);
  for (const b of w.balls) { const f = from[b.id]; b.x = b.px = f[0]; b.y = b.py = f[1]; b.vx = b.vy = 0; }
  st.gather = { t: 0, from, to, flow, clack: false }; st.phase = 'gather';
}
function gatherTick(dt) {
  const G = st.gather, w = game.world; G.t += Math.max(0, dt);
  if (G.flow !== flow) { st.gather = null; st.phase = 'idle'; return; }
  const p = Math.min(1, G.t / GATHER), e = p * p * p * (p * (6 * p - 15) + 10);   // (smootherstep: a slow start, a soft landing)
  for (const b of w.balls) { const f = G.from[b.id], q = G.to[b.id]; b.px = b.x; b.py = b.y; b.x = f[0] + (q[0] - f[0]) * e; b.y = f[1] + (q[1] - f[1]) * e; }
  SND.rolling(p < 1 ? 6 * Math.sin(Math.PI * p) : 0);
  if (p >= 1 && !G.clack) { G.clack = true; SND.ball(0.5, 0); }
  if (G.t < GATHER + GATHER_REST) return;
  for (const b of w.balls) { const q = G.to[b.id]; b.x = b.px = q[0]; b.y = b.py = q[1]; b.vx = q[2]; b.vy = q[3]; }
  st.gather = null; st.ahead = null; st.simTick = 0; acc = 0; st.settle = 0; st.rolling = flow; st.phase = 'sim';   // (rolling: the flow it is for)
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
/* Chalking the cue at the start of a player's own turn (beginTurn): the cube slid onto the tip, a few twists, then off
   (no sound for now - owner 11-09). Any touch, key or wheel stops it at once - it never stands between a player and the shot. */
const CHALK = 1.3;
for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => { st.chalk = null; }, { capture: true, passive: true });
function chalkTick(dt) {
  const c = st.chalk; if (!c) return false;
  if (st.phase !== 'aim' || st.screen !== 'play') { st.chalk = null; return false; }
  c.t += dt; if (c.t >= CHALK) { st.chalk = null; return true; }
  return true;
}
// The frame-rate cap ('낮음' 60, a software renderer 30, otherwise the screen's own rate): false when this animation frame
// comes before the next one is due. The due time steps on by whole frames, so the rate holds even when frames arrive unevenly.
function paceDue(now) {
  const hz = prefs.quality === 'high' ? 0 : scene.softwareRendering ? 30 : prefs.quality === 'low' ? 60 : 0;
  if (!hz) { framePace.hz = 0; framePace.due = 0; return true; }
  const step = 1000 / hz;
  if (framePace.hz !== hz) { framePace.hz = hz; framePace.due = 0; }
  if (framePace.due && now < framePace.due - 0.25) return false;
  framePace.due = !framePace.due || now - framePace.due > step ? now + step : framePace.due + step;
  return true;
}
// follow-through (frame): the cue's place this frame for the moment after the hit, or null once it is over
// (one object, filled again each frame - the drawing reads it and lets it go)
const followAt = { x: 0, y: 0, pull: 0, el: 0, spin: null };
function followTick(dt) {
  const f = st.follow; f.t += Math.max(0, dt);
  if (f.t > 0.42) { st.follow = null; return null; }
  const R = game.P.R, se = Math.sin(f.el), lift = f.spin.y * 0.5 * R * Math.cos(f.el);
  let reach = Math.min(0.11, 0.025 + f.V * 0.014);
  if (se > 0.05) reach = Math.min(reach, Math.max(0, (R + lift - 0.006) / se - R));   // (a raised cue stops above the cloth)
  const k = Math.min(1, f.t / 0.11), ease = 1 - (1 - k) * (1 - k);
  followAt.x = f.x; followAt.y = f.y; followAt.pull = -0.004 - reach * ease; followAt.el = f.el; followAt.spin = f.spin;
  return followAt;
}
/* Whether play waits this frame - nothing on the table moves and no clock runs (it is still drawn). covered: the home
   screen's table is hidden under the desk (the play boards, the cards, the books), so its demo waits; otherwise
   - a sheet is up - but a game online goes on under it in play (the other player is still playing);
   - the match's opening is over the table (56-league.js vsIntro.hold): nobody plays, no clock runs, until it lifts. */
function framePaused(covered) {
  return covered || vsIntro.hold || (!$('#sheet').hidden && !(flow === match && match.ctx && match.ctx.online && st.screen === 'play'));
}
// what this frame's play came to, for the drawing: filled again by playTick each frame
const fr = { animating: false, alpha: 1, pull: 0, clip: null, follow: null };
// the stroke (phase 'strike'): the cue drawn back comes through in a tenth of a second, and at the end of it the shot is struck
function strikeTick(dt) {
  const ca = st.cueAnim; ca.t += dt; fr.animating = true;
  const k = Math.min(1, ca.t / 0.1); fr.pull = ca.from * (1 - k * k) - 0.004 * k;
  if (ca.t < 0.1) return;
  const c = game.cueBall();
  st.follow = { t: 0, x: c.x, y: c.y, V: ca.V, el: ca.show ?? ca.el ?? 0, spin: { x: st.spin.x, y: st.spin.y } };
  aheadStart(ca); st.simTick = 0; game.P.strike(game.world, st.aim, ca.V, ca.a, ca.b, ca.el);
  if (!flow.quiet) SND.cue(ca.V, panOf(c.x, c.y));
  st.phase = 'sim'; acc = 0; st.settle = 0; st.power = 0; setPowerUI(0);
}
// a frame of play, by the phase it is in: the computer lining up, chalking, the clocks, the stroke, the balls running,
// the gathering (4구), a highlight, a review's shot, the hold after a shot
function playTick(dt) {
  if (st.phase === 'auto') { autoTick(dt); fr.animating = true; }
  // (the cue drawn back a little off the ball while it is chalked, and brought up again)
  if (chalkTick(dt)) { fr.animating = true; if (st.chalk) { const t = st.chalk.t; fr.pull += 0.07 * Math.max(0, Math.min(1, t / 0.2, (CHALK - t) / 0.3)); } }
  shotClock(dt); eyeTick(); ranked.tick();
  if (st.phase === 'strike') strikeTick(dt);
  // follow-through: for a moment after the hit the cue carries on through where the ball was, then is lifted away
  if (st.follow && (st.phase === 'sim' || st.phase === 'hold')) fr.follow = followTick(dt);
  const ph = st.phase;
  if (ph === 'sim') { const s0 = performance.now(); fr.alpha = stepSim(dt); prof.add('sim', performance.now() - s0); fr.animating = true; if (st.phase !== 'sim') { SND.rolling(0); bolts.set(false); } }
  else if (ph === 'gather') { gatherTick(dt); fr.animating = true; st.rev++; }
  else if (ph === 'reel') { const clip = fr.clip = reel.tick(dt); fr.animating = true; if (clip) { fr.alpha = clip.alpha; fr.pull = clip.pull; } }
  else if (ph === 'rvplay') { if (review.tick(dt)) fr.animating = true; }
  else if (ph === 'hold') { st.holdT -= dt; fr.animating = true; if (st.holdT <= 0) { const f = st.afterHold, by = st.holdFlow; st.afterHold = st.holdFlow = null; if (f && by === flow) f(); else st.phase = 'idle'; } }
}
let wallsShown = null, shapeShown = null;
// what the table shows besides the balls, kept in step with the game: the cue angle shown, a puzzle's barricades, its shape
function tableSync() {
  if (st.phase === 'aim') syncEl();
  // (현실 당구 · 큐 각도: the angle shown follows the cue as it is turned past something it must stand up over)
  if (st.phase === 'aim' && game.world.real && game.world.real.cue) { const e = shownEl(); if (Math.abs(e - (st.elShown || 0)) > 1e-4) { st.elShown = e; setKindUI(); } }
  if (game.world.walls !== wallsShown) { wallsShown = game.world.walls; scene.setWalls(wallsShown); }   // (a puzzle's barricades)
  if ((game.world.shape || null) !== shapeShown) { shapeShown = game.world.shape || null; scene.setShape(shapeShown); }   // (a table of another shape)
}
// what the 3D is told each frame (scene/90-frame.js frame): one object, filled again every frame - it was made anew
// 60 times a second, drawn or not
const view = { game: null, alpha: 1, aim: 0, power: 0, pull: 0, spin: null, honest: false, el: 0, rev: 0, animating: false, follow: null, chalk: null, pwOn: false, pwCol: '', pwText: '',
  showCue: false, showGuide: false, aimStyle: null, gear: null, level: 0, legalIds: NONE, hand: false, covered: false };
// the 3D drawn for this frame (true when it drew)
function drawFrame(dt) {
  const { animating, alpha, pull, clip, follow } = fr, v = view, aiming = st.phase === 'aim';
  // (the other player online lining up counts too: their cue and line from what their screen sends - ranked.aimShow)
  // (the table alone - a match's end or opening, 50-outro.js tableAlone, and under the result: no cue, no line)
  const nude = app.classList.contains('bare') || (st.screen === 'result' && !review.on);   // (and under the result's slate)
  const lined = !nude && (aiming || (st.phase === 'auto' && !!st.auto && (!!st.auto.plan || ranked.aiming())));
  winCam.tick();   // (a win's camera, moved before the frame is drawn - 50-celebrate.js)
  const d0 = performance.now(); scene.prof.guide = 0;
  // the player's own aim is played out with their cue's stat (the guide is the shot); a planned one as it was planned
  const k = aiming ? cueK() : null;
  v.game = game; v.alpha = alpha; v.aim = st.aim; v.power = st.power; v.pull = pull; v.spin = st.spin; v.honest = !!(game.world && game.world.real && game.world.real.cue);
  v.el = st.phase === 'strike' && st.cueAnim ? st.cueAnim.show ?? st.cueAnim.el : shownEl(); v.rev = st.rev; v.animating = animating;
  v.follow = follow; v.chalk = st.chalk ? st.chalk.t : null; v.showCue = clip ? clip.cue : !nude && (lined || st.phase === 'strike' || st.phase === 'idle' || !!follow);
  // (세기 beside the cue on the table, in 3D - scene/40-cue.js; off unless turned on in 설정: prefs.powerTag)
  v.pwOn = !!prefs.powerTag && aiming && st.screen === 'play'; v.pwCol = powerUI.col || '#7fe0ee'; v.pwText = powerUI.num;
  v.showGuide = lined; v.aimStyle = prefs.aim; v.gear = k; v.level = !flow ? 0 : flow.guide() * (aiming ? k.guide : 1);
  v.legalIds = st.screen === 'play' ? legalNow() : NONE; v.hand = !!game.placing && aiming; v.covered = st.screen === 'home' && !deskTableShown();
  const drew = scene.frame(v, dt);
  { const g = scene.prof.guide; prof.add('guide', g); prof.add('draw', performance.now() - d0 - g); }
  return drew;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!paceDue(now)) return;
  const f0 = performance.now(); prof.frame();
  checkLayout();
  const raw = lastT ? now - lastT : 0, dt = Math.min(0.1, raw / 1000 || 0); lastT = now; lastRaw = raw;
  const paused = framePaused(st.screen === 'home' && !deskTableShown());
  fr.animating = false; fr.alpha = 1; fr.pull = 0.03 + st.power * 0.2; fr.clip = null; fr.follow = null;
  if (!paused) playTick(dt);
  tableSync();
  const drew = drawFrame(dt);   // (after play: the screen may have changed under it)
  if (drew && review.on) review.copy();                    // (the game review shows the live table on its tray: 50-review.js)
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
/* What happens after the screen changes size (fullscreen above all - a tablet showed black for seconds, owner 11-09): when
   it changed, how many size changes followed, the first frame drawn after it, and the 3D context lost or given back. Shown
   on the frame-rate display (설정 · 초당 프레임 표시), to tell a slow redraw from a lost context. */
const fsDiag = { t0: 0, first: 0, sizes: 0, lost: 0, back: 0, lostAt: 0, backAt: 0 };
['fullscreenchange', 'webkitfullscreenchange'].forEach(e => document.addEventListener(e, () => { Object.assign(fsDiag, { t0: performance.now(), first: 0, sizes: 0 }); }));
addEventListener('resize', () => { if (fsDiag.t0) fsDiag.sizes++; });
$('#gl').addEventListener('webglcontextlost', () => { fsDiag.lost++; fsDiag.lostAt = performance.now() - (fsDiag.t0 || 0); });
$('#gl').addEventListener('webglcontextrestored', () => { fsDiag.back++; fsDiag.backAt = performance.now() - (fsDiag.t0 || 0); });
const fsText = () => !fsDiag.t0 && !fsDiag.lost ? '' : `\n전체화면 전환 → 첫 그림 ${fsDiag.first ? Math.round(fsDiag.first) + 'ms' : '대기'} · 크기 변경 ${fsDiag.sizes}회 · 3D 잃음 ${fsDiag.lost}회${fsDiag.lost ? ` (${Math.round(fsDiag.lostAt)}ms)` : ''} · 복구 ${fsDiag.back}회${fsDiag.back ? ` (${Math.round(fsDiag.backAt)}ms)` : ''} · 캔버스 ${$('#gl').width}×${$('#gl').height}`;
function perfTick(raw, drew) {
  if (drew && fsDiag.t0 && !fsDiag.first) fsDiag.first = performance.now() - fsDiag.t0;
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
    $('#fps').textContent = a + ' · ' + b + '\n' + c + '\n' + gpu + fsText();
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
window.__dp8 = { prof, aiw, game, st, prefs, winCam, receipt, rise, bolts, resume, homeDemo, get flow() { return flow; }, menuFx, get lay() { return { layoutW, layoutH, layoutN, layoutPending, sinceSized: performance.now() - sizedAt, pace: framePace }; }, scene, drills, puzzle, puzzles, match, reel, playBest, playWorst, SND, ranked, arcade, net, applyBackdrop, invite, paintHome, vsIntro, outro, tutorial, practice, emote, EMOTES, highlights, review, BOTS, startMatch: match.start, startPractice: practice.start, goHome, shoot, endShot };
start();
