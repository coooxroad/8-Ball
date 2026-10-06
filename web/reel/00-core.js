/* The shot reels: the best shot of a match cut like a short edit to the player's song, and the worst one cut as a joke.

   The shot is written down once as a tape (highlights.record), so an edit can run it at any speed, hold it, run it
   backwards or jump about in it. Every edit of a best shot is built so that the moment that matters - the ball dropping -
   lands exactly on the drop of the song (or, with no song, at the same point of its own clock).

   Best shot, twelve edits:
     cuts      slow build from behind the cue, a held breath, the drop, then the same moment from three more cameras
     tracer    the whole table from above, every ball drawing its line in its own colour
     math      the shot worked out before it is played: lines, angles and distances drawn in, then the ball follows them
     freeze    everything stops with the ball on the lip, one skull, then the drop
     velocity  one take circling the ball, time lurching forward on every beat
     combo     every contact counted out loud
     rewind    the shot as it happened, tape run back, then again slowly up to the drop
     pov       riding behind the ball
     strobe    the ball leaves a copy of itself wherever it has been
     bullet    time stops on the lip and the camera goes all the way round
     count     three, two, one - a new camera on every beat
     stutter   the drop itself, hit six times over

   Worst shot, six edits, no music:
     clown     as it happened, the moment it went wrong, tape back, once more slowly with the culprit ringed
     var       under review: the moment run back and forth three times, closer each time
     huh       silence, then one question mark, then two, then three
     sad       black and white and very slow, as if it were a great loss
     news      breaking news: a banner, a headline, footage from two more angles
     error     the game itself gives up: a crash screen, a recovery bar, a restart

   Each edit also has a look of its own (a class on the page, sk-<name>): the cinema bars of cuts, the dark room of the
   tracer, the blueprint of math, the print dots of freeze, the tape and 4:3 frame of rewind, the viewfinder of pov...

   On top of whatever an edit does itself, every edit gets the same layer of effects drawn over the picture: sparks and
   rings where balls meet, tails behind fast balls, a shock ring and a streak of light on the drop.

   d: { game, scene, SND, highlights, st, $, el, app, panOf, onEnd } */
const { game, scene, SND, highlights: HL, st, $, el, app } = d;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x, ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), lerp = (a, b, k) => a + (b - a) * k;
const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; }, turnTo = (a, b, k) => a + wrap(b - a) * k;
const INTRO = 2.2, HOLD = 0.1, PRE = 0.32, POST = 0.14;     // seconds: camera move-in; tape time held back before the drop; tape window of a cut
const cv = $('#reelCv'), g = cv.getContext('2d'), big = $('#reelBig'), tagEl = $('#reelTag'), P2 = [0, 0], Q2 = [0, 0];
const CLS = ['reeling', 'colour', 'hit', 'beat', 'impact', 'hold', 'frozen', 'rew', 'g1', 'g2', 'g3', 'pulse', 'matrix', 'glitch', 'tinted'];
const cardEl = $('#reelCard');
const MINT = '#7cffcb', GOLD = '#ffe04a', RED = '#ff4d43';
let r = null, cam = null, tp = null, last = { best: null, worst: null };
const bags = { best: [], worst: [] };

/* ---- picture effects on the page ---- */
const again = (n, cls) => { n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); };
const kick = cls => { app.classList.remove('hit', 'beat'); void app.offsetWidth; app.classList.add(cls); };
const grade = k => { app.classList.remove('g1', 'g2', 'g3'); if (k) app.classList.add('g' + k); };
function impact() {                                          // two frames of negative, then a white flash
  app.classList.add('impact'); setTimeout(() => app.classList.remove('impact'), 70);
  again($('#reelFlash'), 'go');
}
const flash = () => again($('#reelFlash'), 'soft');
function emoji(ch, x, y, cls) {
  const n = el('i', { class: 'rfx' + (cls ? ' ' + cls : ''), text: ch, style: `left:${x}px;top:${y}px;--dx:${(Math.random() - 0.5) * 140}px;--rot:${(Math.random() - 0.5) * 50}deg` });
  $('#reelFx').appendChild(n); setTimeout(() => n.remove(), 2600);
}
function burst(list) {
  const W = app.clientWidth, H = app.clientHeight, me = r;
  (list || ['🔥', '💀', '🔥', '🗿', '🔥']).forEach((ch, i) => setTimeout(() => { if (r === me) emoji(ch, W * (0.2 + 0.6 * Math.random()), H * (0.6 + 0.2 * Math.random())); }, i * 90));
}
// things falling down the whole screen
function rain(list, n) {
  const W = app.clientWidth, me = r;
  for (let i = 0; i < n; i++) setTimeout(() => { if (r === me) emoji(list[i % list.length], W * (0.05 + 0.9 * Math.random()), 0, 'fall'); }, i * 70 + Math.random() * 60);
}
const showBig = (text, cls) => { big.textContent = text; big.className = ''; void big.offsetWidth; big.className = cls; };
const tag = text => { tagEl.textContent = text || ''; tagEl.hidden = !text; };
// a panel of words over the picture (the news banner, the crash screen, the caption)
const card = (cls, kids) => { cardEl.textContent = ''; cardEl.className = cls; for (const k of kids) cardEl.appendChild(k); cardEl.hidden = false; };
const hideCard = () => { cardEl.hidden = true; cardEl.textContent = ''; };
const skin = id => { for (const c of Array.from(app.classList)) if (c.slice(0, 3) === 'sk-') app.classList.remove(c); if (id) app.classList.add('sk-' + id); };

/* ---- the tape ---- */
// put the table at tape time T; going forward, everything passed on the way is heard (and seen) unless `quiet`
function go(T, dt, quiet) {
  T = clamp(T, 0, tp.dur);
  if (T < r.T - 1e-6) scene.clearFalls();
  else if (!quiet) for (const e of tp.events) if (e.time > r.T && e.time <= T) fire(e);
  const v = HL.seek(game.world, tp, T), rate = dt > 0 ? Math.abs(T - r.T) / dt : 0;
  SND.rolling(quiet ? 0 : Math.min(8, v * Math.min(1, rate)));
  r.rate = rate; r.T = T;
}
function fire(e) {
  const pan = d.panOf(e.x, e.y), fx = !r.style.bare;
  if (e.t === 'pocket') { scene.fall(game.P, e); SND.drop('lip', Math.hypot(e.vx, e.vy), pan); if (fx) { const pk = game.P.POCKETS[e.pocket]; shock(pk.x, pk.y, r.cols[e.id] || '#fff', 0.5); sparks(pk.x, pk.y, r.cols[e.id] || '#fff', 22, 1.6); } }
  else if (e.t === 'ball') { SND.ball(e.v, pan); if (fx && e.v > 0.25) { sparks(e.x, e.y, '#fff', 4 + Math.min(14, e.v * 5), 0.5 + e.v * 0.35); if (e.v > 1) shock(e.x, e.y, '#fff', 0.16); } }
  else if (e.t === 'off') scene.fly(game.P, e);
  else if (e.t === 'land') SND.ball(Math.min(1.2, e.v * 0.4), pan);
  else { SND.rail(e.v, pan); if (fx && e.v > 0.4) shock(e.x, e.y, r.cols[e.id] || '#fff', 0.13); }
  if (r.style.on) r.style.on(e); else if (e.t === 'ball' && e.v > 0.8) kick('beat');
}

/* ---- effects that live on the table: they are kept in table coordinates, so they stay put as the camera moves ---- */
function sparks(x, y, col, n, speed) {
  for (let i = 0; i < n && r.parts.length < 220; i++) {
    const a = Math.random() * 6.283, s = speed * (0.3 + Math.random());
    r.parts.push({ x, y, z: game.P.R, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0.4 + Math.random() * 1.4, t: 0, life: 0.35 + Math.random() * 0.45, col });
  }
}
function shock(x, y, col, size) { if (r.rings.length < 40) r.rings.push({ x, y, t: 0, dur: 0.3 + size * 0.6, size, col }); }
function drawFx(dt) {
  const R = game.P.R; g.lineCap = 'round';
  for (let i = r.rings.length - 1; i >= 0; i--) {
    const q = r.rings[i]; q.t += dt; const k = q.t / q.dur; if (k >= 1) { r.rings.splice(i, 1); continue; }
    g.globalAlpha = (1 - k) * 0.9; ring(q.x, q.y, R + q.size * (1 - (1 - k) * (1 - k)), q.col, 1 + 5 * (1 - k) * Math.min(1, q.size * 3));
  }
  for (let i = r.parts.length - 1; i >= 0; i--) {
    const p = r.parts[i]; p.t += dt; if (p.t >= p.life) { r.parts.splice(i, 1); continue; }
    const x0 = p.x, y0 = p.y, z0 = p.z; p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(R * 0.3, p.z + p.vz * dt); p.vz -= 5 * dt; p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt;
    if (!scene.proj.at(x0, y0, z0, Q2) || !scene.proj.at(p.x + p.vx * 0.012, p.y + p.vy * 0.012, p.z, P2)) continue;
    if (Math.abs(P2[0] - Q2[0]) + Math.abs(P2[1] - Q2[1]) > 120) continue;
    g.globalAlpha = 1 - p.t / p.life; g.strokeStyle = p.col; g.lineWidth = 2.2; g.beginPath(); g.moveTo(Q2[0], Q2[1]); g.lineTo(P2[0], P2[1]); g.stroke();
  }
  g.globalAlpha = 1;
}
// a short lit tail behind every ball that is moving fast
function comets() {
  if (!(r.rate > 0.02)) return;
  for (const p of r.paths) {
    if (!game.world.balls[p.id].on || !HL.at(tp, p.id, r.T, Q2)) continue;
    const x = Q2[0], y = Q2[1]; HL.at(tp, p.id, Math.max(0, r.T - 0.05), Q2);
    if (Math.hypot(x - Q2[0], y - Q2[1]) < 0.035) continue;
    line(p, Math.max(0, r.T - 0.13), r.T); g.lineJoin = g.lineCap = 'round';
    g.globalAlpha = 0.22; g.strokeStyle = p.col; g.lineWidth = 9; g.stroke(); g.globalAlpha = 0.6; g.lineWidth = 3; g.stroke(); g.globalAlpha = 1;
  }
}
// lines rushing in from the edges of the screen (not on the table: straight on the glass)
function rushLines(W, H, k) {
  const cx = W / 2, cy = H / 2, D = Math.hypot(W, H) / 2; g.strokeStyle = '#fff'; g.lineCap = 'butt';
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * 6.283, r0 = D * (0.5 + Math.random() * 0.35), c = Math.cos(a), s = Math.sin(a);
    g.globalAlpha = k * (0.15 + Math.random() * 0.5); g.lineWidth = 1 + Math.random() * 3; g.beginPath(); g.moveTo(cx + c * r0, cy + s * r0); g.lineTo(cx + c * D * 1.1, cy + s * D * 1.1); g.stroke();
  }
  g.globalAlpha = 1;
}

/* ---- things every edit is made of ---- */
// the cue being drawn back for D seconds, then the strike; true while it is still drawing back
function cueUp(since, D) {
  if (since < D) { r.cue = true; r.pull = 0.03 + 0.24 * st.power * ease((since - D * 0.25) / (D * 0.65)); return true; }
  if (!r.struck) { r.struck = true; SND.cue(r.best.V, 0); if (!r.style.bare) { kick('beat'); sparks(r.cue0[0], r.cue0[1], '#fff', 8, 1); } }
  r.cue = false; return false;
}
// from a wide view down to just behind the cue
function camIntro(k) {
  const b = r.best;
  cam.az = lerp(r.from.az, b.aim - Math.PI / 2 + 0.16, k); cam.el = lerp(r.from.el, 0.46, k); cam.zoom = lerp(1, 0.44, k);
  cam.tx = lerp(0, r.cue0[0], k); cam.ty = lerp(0, r.cue0[1], k);
}
// the ball the edit is about: the cue ball until it hits, then the ball it is sending to the pocket
function lead() { const w = game.world, key = w.balls[r.key], cb = w.balls[tp.cue]; return r.T >= tp.tHit && key.on ? key : cb.on && r.T < tp.tHit ? cb : null; }
function chase(dt, zoom, turn, stiff) {
  const o = lead(), x = o ? o.x : tp.kx, y = o ? o.y : tp.ky, f = Math.min(1, dt * (stiff || 5));
  cam.tx += (x - cam.tx) * f; cam.ty += (y - cam.ty) * f; cam.az += dt * turn; cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 2);
}
function pushIn(dt) {
  cam.tx += (tp.kx - tp.ux * 0.12 - cam.tx) * Math.min(1, dt * 3); cam.ty += (tp.ky - tp.uy * 0.12 - cam.ty) * Math.min(1, dt * 3);
  cam.zoom += (0.24 - cam.zoom) * Math.min(1, dt * 1.6); cam.el += (0.5 - cam.el) * Math.min(1, dt * 2);
}
// slow play up to just short of the key moment, then a held breath of `hold` seconds; x is seconds since the strike
function build(x, dt, turn) {
  if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, turn == null ? 0.16 : turn); }
  else { app.classList.add('hold'); r.rush = 0.35; go(r.roll + clamp((x - r.bd) / r.hd, 0, 1) * HOLD * 0.5, dt); pushIn(dt); }
}
function buildPlan(upto, hold, longest) { r.roll = Math.max(0, upto); r.slow = Math.max(0.42, r.roll / (longest || 4.2)); r.bd = r.roll / r.slow; r.hd = hold; return r.bd + hold; }
function drop(emojis) {
  r.dropped = true; r.rush = 0; app.classList.remove('hold', 'frozen', 'rew', 'matrix', 'tinted'); grade(0); app.classList.add('colour');
  impact(); kick('hit'); SND.boom(); again($('#reelStreak'), 'go'); if (emojis) burst();
  shock(tp.kx, tp.ky, r.cols[r.key] || '#fff', 0.9); shock(tp.kx, tp.ky, '#fff', 0.5); sparks(tp.kx, tp.ky, r.cols[r.key] || '#fff', 46, 2.6);
}
// cameras for the replays of the key moment
function cutCam(k) {
  const away = Math.atan2(tp.ux, -tp.uy);                    // the compass direction that puts the camera beyond the pocket, looking back
  if (k === 0) return { az: away, el: 0.3, zoom: 0.25, tx: tp.kx - tp.ux * 0.16, ty: tp.ky - tp.uy * 0.16, spin: 0.1 };       // from behind the pocket, low
  if (k === 1) return { az: away + Math.PI, el: 1.42, zoom: 0.2, tx: tp.kx - tp.ux * 0.1, ty: tp.ky - tp.uy * 0.1, spin: 0.35 }; // straight down, tight
  return { az: away + Math.PI / 2, el: 0.22, zoom: 0.3, tx: tp.kx - tp.ux * 0.2, ty: tp.ky - tp.uy * 0.2, spin: -0.25 };        // from the side, at cloth level
}
// one replay of the last third of a second from camera k; u runs 0..1 through it. Quick up to the pocket, slower after.
// The camera arrives still swinging and settles; `look` gives the cut its own colour.
function cut(k, u, dt, look) {
  if (r.cutK !== k) { r.cutK = k; go(tp.tKey - PRE, 0, true); Object.assign(cam, cutCam(k)); r.whip = 2.4 * (k % 2 ? -1 : 1); kick('hit'); flash(); grade(look || 0); }
  go(tp.tKey - PRE + (u < 0.55 ? u / 0.55 * PRE : PRE + (u - 0.55) / 0.45 * POST), dt);
  r.whip *= Math.max(0, 1 - dt * 7); cam.az += dt * ((cam.spin || 0) + r.whip); cam.zoom *= 1 - dt * 0.12;
}
// a slow turn round the whole table, then black; false once it is over
function out(dt, rel) {
  if (r.outAt == null) { r.outAt = rel; r.outT = r.T; big.className = ''; grade(0); tag(''); skin(null); app.classList.remove('glitch', 'matrix', 'tinted'); }
  const u = rel - r.outAt; go(r.outT + u * 0.8, dt);
  cam.az += dt * 0.55; cam.el += (0.8 - cam.el) * Math.min(1, dt * 1.5); cam.zoom += (1.02 - cam.zoom) * Math.min(1, dt * 1.6);
  cam.tx += (0 - cam.tx) * Math.min(1, dt * 2); cam.ty += (0 - cam.ty) * Math.min(1, dt * 2);
  if (u > 4 * r.beat) $('#reelFade').classList.add('go');
  return u <= 4 * r.beat + 0.55;
}
// black, then over: for the edits that end where they are
function fadeOut(u, at) { if (u > at) $('#reelFade').classList.add('go'); return u <= at + 0.55; }

/* ---- drawing on top of the picture ---- */
function line(p, t0, t1) {                                   // the path of one ball between two tape times, as the current path of the canvas
  const pts = p.pts, z = game.P.R; let pen = false;
  const to = ok => { if (ok) { if (pen) g.lineTo(P2[0], P2[1]); else g.moveTo(P2[0], P2[1]); pen = true; } else pen = false; };
  g.beginPath();
  if (t0 > pts[2] && HL.at(tp, p.id, t0, Q2)) to(scene.proj.at(Q2[0], Q2[1], z, P2));
  for (let i = 0; i < pts.length; i += 3) { const t = pts[i + 2]; if (t < t0) continue; if (t > t1) break; to(scene.proj.at(pts[i], pts[i + 1], z, P2)); }
  if (t1 < pts[pts.length - 1] && HL.at(tp, p.id, t1, Q2)) to(scene.proj.at(Q2[0], Q2[1], z, P2));
}
function glow(col, w) {                                      // the current path as a lit line: soft halo, colour, bright core
  g.lineJoin = g.lineCap = 'round';
  g.globalAlpha = 0.28; g.strokeStyle = col; g.lineWidth = w * 3.2; g.stroke();
  g.globalAlpha = 0.95; g.lineWidth = w; g.stroke();
  g.globalAlpha = 0.75; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, w * 0.3); g.stroke(); g.globalAlpha = 1;
}
function trails(T, w, only) { for (const p of r.paths) if (!only || only.includes(p.id)) { line(p, 0, T); glow(p.col, w); } }
function label(x, y, text, col, size, align) {
  g.font = `600 ${size || r.fs}px Outfit, sans-serif`; g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.lineWidth = 4; g.strokeStyle = 'rgba(8,10,14,.78)'; g.lineJoin = 'round'; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y);
}
function ring(x, y, rad, col, w, dash) {                     // a circle lying on the table
  g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * 2 * Math.PI; scene.proj.at(x + Math.cos(a) * rad, y + Math.sin(a) * rad, game.P.R, P2); if (i) g.lineTo(P2[0], P2[1]); else g.moveTo(P2[0], P2[1]); }
  g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.setLineDash([]);
}
// an angle marked at a table point between two directions, with its size written beside it
function angle(x, y, a0, a1, rad, col) {
  const dA = wrap(a1 - a0), z = game.P.R; g.beginPath();
  for (let i = 0; i <= 12; i++) { const a = a0 + dA * i / 12; scene.proj.at(x + Math.cos(a) * rad, y + Math.sin(a) * rad, z, P2); if (i) g.lineTo(P2[0], P2[1]); else g.moveTo(P2[0], P2[1]); }
  g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
  const m = a0 + dA / 2; scene.proj.at(x + Math.cos(m) * rad * 1.9, y + Math.sin(m) * rad * 1.9, z, P2);
  label(P2[0], P2[1], (Math.abs(dA) * 180 / Math.PI).toFixed(1) + '°', col);
}
function seg(x0, y0, x1, y1, col, w, dash) {
  const z = game.P.R; g.beginPath(); scene.proj.at(x0, y0, z, P2); g.moveTo(P2[0], P2[1]); scene.proj.at(x1, y1, z, P2); g.lineTo(P2[0], P2[1]);
  g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.setLineDash([]);
}
// four corner marks closing in on a table point, as if a sight had locked on to it
function lockOn(x, y, size, col, k) {
  const s = size * (1.9 - 0.9 * k), q = s * 0.45;
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { seg(x + sx * s, y + sy * s, x + sx * (s - q), y + sy * s, col, 2); seg(x + sx * s, y + sy * s, x + sx * s, y + sy * (s - q), col, 2); }
}
// a ball painted flat where it once was
function ghost(x, y, col, alpha) {
  const R = game.P.R; if (!scene.proj.at(x, y, R, P2)) return; const cx = P2[0], cy = P2[1];
  scene.proj.at(x + R, y, R, Q2); const a = Math.hypot(Q2[0] - cx, Q2[1] - cy); scene.proj.at(x, y + R, R, Q2); const rad = Math.max(a, Math.hypot(Q2[0] - cx, Q2[1] - cy));
  g.globalAlpha = alpha; g.fillStyle = col; g.beginPath(); g.arc(cx, cy, rad, 0, 6.283); g.fill();
  g.globalAlpha = Math.min(1, alpha * 1.6); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); g.globalAlpha = 1;
}
// the places where a ball changes direction between two tape times: where, what it met, and its heading before and after
function nodes(id, t0, t1) {
  const list = [], a = [0, 0], b = [0, 0], c = [0, 0]; let prev = t0;
  for (const e of tp.events) {
    if (e.time <= t0 || e.time > t1 || list.length >= 6) continue;
    if (!(e.t === 'rail' ? e.id === id : e.t === 'ball' ? e.ia === id || e.ib === id : false)) continue;
    if (list.length && e.time - prev < 0.05) continue;
    const dt = Math.min(0.05, (e.time - prev) * 0.8);
    HL.at(tp, id, e.time, a); HL.at(tp, id, e.time - dt, b); HL.at(tp, id, Math.min(tp.dur, e.time + 0.05), c);
    list.push({ time: e.time, x: a[0], y: a[1], kind: e.t, din: Math.atan2(a[1] - b[1], a[0] - b[0]), dout: Math.atan2(c[1] - a[1], c[0] - a[0]) });
    prev = e.time;
  }
  return list;
}
function drawMath() {
  const P = game.P, cueP = r.paths.find(p => p.id === tp.cue), keyP = r.key !== tp.cue ? r.paths.find(p => p.id === r.key) : null, rv = r.reveal;
  g.setLineDash([]); g.lineJoin = g.lineCap = 'round';
  // squared paper over the cloth, and a line sweeping across it while the working is done
  g.globalAlpha = 0.16;
  for (let x = -Math.floor(P.HL / 0.25) * 0.25; x <= P.HL; x += 0.25) seg(x, -P.HW, x, P.HW, '#bfe9ff', 1);
  for (let y = -Math.floor(P.HW / 0.25) * 0.25; y <= P.HW; y += 0.25) seg(-P.HL, y, P.HL, y, '#bfe9ff', 1);
  g.globalAlpha = 1;
  if (!r.struck) { const sx = -P.HL + 2 * P.HL * ((r.t * 0.55) % 1); g.globalAlpha = 0.5; seg(sx, -P.HW, sx, P.HW, MINT, 2); g.globalAlpha = 0.12; seg(sx - 0.05, -P.HW, sx - 0.05, P.HW, MINT, 8); g.globalAlpha = 1; }
  // everything else that moves, faintly; then the cue ball's line and the object ball's line as far as they are worked out
  for (const p of r.paths) if (p !== cueP && p !== keyP) { line(p, 0, rv); g.globalAlpha = 0.4; g.strokeStyle = '#cfd6e2'; g.lineWidth = 1.2; g.stroke(); g.globalAlpha = 1; }
  if (cueP) { line(cueP, 0, rv); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
  if (keyP) { line(keyP, tp.tHit, rv); g.strokeStyle = MINT; g.lineWidth = 2; g.stroke(); }
  const tick = (n, i) => { if (!n.seen) { n.seen = r.t; SND.blip(i); shock(n.x, n.y, GOLD, 0.2); } return clamp((r.t - n.seen) / 0.25, 0, 1); };
  let i = 0;
  const walk = (list, col, x0, y0, tEnd, xe, ye) => {
    let px = x0, py = y0;
    const leg = (x, y) => { const L = Math.hypot(x - px, y - py); if (L > 0.22) { scene.proj.at((x + px) / 2, (y + py) / 2, P.R, P2); label(P2[0], P2[1] - r.fs * 0.9, L.toFixed(2) + ' m', 'rgba(255,255,255,.8)', r.fs * 0.82); } px = x; py = y; };
    for (const n of list) {
      if (n.time > rv) return; const k = tick(n, i++);
      leg(n.x, n.y);
      ring(n.x, n.y, P.R * (2 - k), col, 1.5, [4, 4]);
      if (n.kind === 'rail') {
        // against the cushion it met: the angle in and the angle out
        const side = P.HL - Math.abs(n.x) < P.HW - Math.abs(n.y), tA = side ? Math.PI / 2 : 0, back = n.din + Math.PI;
        const t1 = Math.abs(wrap(back - tA)) < Math.PI / 2 ? tA : tA + Math.PI, t2 = Math.abs(wrap(n.dout - tA)) < Math.PI / 2 ? tA : tA + Math.PI;
        seg(n.x - Math.cos(tA) * 0.22, n.y - Math.sin(tA) * 0.22, n.x + Math.cos(tA) * 0.22, n.y + Math.sin(tA) * 0.22, GOLD, 1.2, [3, 4]);
        angle(n.x, n.y, t1, back, 0.1, GOLD); angle(n.x, n.y, t2, n.dout, 0.1, GOLD);
      }
    }
    if (rv >= tEnd) leg(xe, ye);
  };
  if (cueP) {
    const pts = cueP.pts, a = [0, 0]; HL.at(tp, tp.cue, tp.tHit, a);
    walk(r.nCue, '#fff', pts[0], pts[1], tp.tHit, a[0], a[1]);
    scene.proj.at(pts[0], pts[1], P.R, P2); const x = P2[0], y = P2[1];
    label(x, y + r.fs * 2.1, 'v₀ ' + r.best.V.toFixed(2) + ' m/s', '#fff');
    label(x, y + r.fs * 3.4, 'φ₀ ' + (((r.best.aim * 180 / Math.PI) % 360 + 360) % 360).toFixed(1) + '°   t ' + tp.tKey.toFixed(2) + ' s', 'rgba(255,255,255,.75)', r.fs * 0.82);
  }
  if (keyP && rv >= tp.tHit) {
    // the cut: the line the cue ball came in on, carried through the object ball, against the line the object ball leaves on
    const a = [0, 0], b = [0, 0], c = [0, 0], q = [0, 0];
    HL.at(tp, r.key, tp.tHit, a); HL.at(tp, r.key, Math.min(tp.dur, tp.tHit + 0.06), b); HL.at(tp, tp.cue, tp.tHit, c); HL.at(tp, tp.cue, Math.max(0, tp.tHit - 0.04), q);
    const din = Math.atan2(c[1] - q[1], c[0] - q[0]), dout = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) {
      if (!r.cutSeen) { r.cutSeen = r.t; SND.blip(i + 2); }
      ring(c[0], c[1], P.R, '#fff', 1.5, [4, 4]);
      seg(a[0], a[1], a[0] + Math.cos(din) * 0.3, a[1] + Math.sin(din) * 0.3, GOLD, 1.2, [3, 4]);
      angle(a[0], a[1], din, dout, 0.13, GOLD);
      if (!r.struck) { const kb = keyP.pts; lockOn(kb[0], kb[1], P.R * 1.7, MINT, clamp((r.t - r.cutSeen) / 0.3, 0, 1)); }
    }
    walk(r.nKey, MINT, a[0], a[1], tp.tKey, tp.kx, tp.ky);
  }
  if (rv >= tp.tKey && r.best.key >= 0) {                     // the pocket it is going to
    const k = clamp((r.t - (r.pkSeen || (r.pkSeen = r.t, SND.blip(12), r.t))) / 0.3, 0, 1);
    ring(tp.kx, tp.ky, P.R * (3.2 - 1.4 * k), MINT, 2); seg(tp.kx - 0.09, tp.ky, tp.kx + 0.09, tp.ky, MINT, 1.2); seg(tp.kx, tp.ky - 0.09, tp.kx, tp.ky + 0.09, MINT, 1.2);
    lockOn(tp.kx, tp.ky, P.R * 3.4, MINT, k);
    if (r.dropped) { scene.proj.at(tp.kx, tp.ky, P.R, P2); label(P2[0], P2[1] - r.fs * 3.2, 'Q.E.D. ∎', GOLD, r.fs * 1.5); }
  }
  // the ball itself, once struck, lights the line it was given
  if (r.struck && r.T > 0) trails(r.T, 2.4, [tp.cue, r.key]);
}
// the culprit of a bad shot, ringed in red with an arrow pointing at it
function culprit() {
  const w = game.world, b = w.balls[r.key], x = b.on ? b.x : tp.kx, y = b.on ? b.y : tp.ky, R = game.P.R, bob = Math.sin(r.t * 9) * 0.012;
  ring(x, y, R * 2.1, RED, 3.5); ring(x, y, R * 2.6 + bob, RED, 1.5, [6, 5]);
  if (!scene.proj.at(x, y, R, P2)) return; const px = P2[0], py = P2[1], s = r.fs * 2.4, o = s * 1.7 + Math.sin(r.t * 9) * 5;
  g.lineCap = g.lineJoin = 'round';
  for (const [col, lw] of [['rgba(8,10,14,.8)', 10], [RED, 5]]) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(px + o + s * 1.6, py - o - s * 1.6); g.lineTo(px + o, py - o); g.moveTo(px + o + s * 0.75, py - o); g.lineTo(px + o, py - o); g.lineTo(px + o, py - o - s * 0.75); g.stroke();
  }
}
function drawOverlay(dt) {
  const W = app.clientWidth, H = app.clientHeight, k = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * k) || cv.height !== Math.round(H * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
  g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, W, H);
  r.fs = clamp(Math.min(W, H) / 46, 12, 21); scene.proj.begin();
  if (r.style.draw) r.style.draw(); if (!r.style.plain) comets();
  drawFx(dt);
  if (r.rush > 0.02) rushLines(W, H, r.rush);
}

/* ---- the edits. init() says how many seconds pass before the key moment; step() is one frame (false = finished) ---- */
const topAz = () => scene.portrait ? -Math.PI / 2 : 0;
// the usual opening of a best-shot edit: down behind the cue, the strike, then the slow build to a held breath
const opening = (dt, since, turn) => { if (cueUp(since, INTRO)) camIntro(ease(since / INTRO)); else build(since - INTRO, dt, turn); return true; };
const after = (dt, rel) => { go(tp.tKey - HOLD * 0.5 + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; };
/* ---- what the worst-shot edits are made of ---- */
const HEAD = { scratch: '흰 공, 포켓으로 직행', air: '아무 공도 못 맞혀', wrong: '엉뚱한 공부터 맞혀', miss: '다 된 공 놓쳐', lost: '경기를 통째로 헌납' };
const CODE = { scratch: 'WHITE_BALL_IN_POCKET', air: 'NO_BALL_CONTACT', wrong: 'WRONG_BALL_FIRST', miss: 'EASY_SHOT_MISSED', lost: 'GAME_THROWN_AWAY' };
// they open the same way: the shot as it happened, from where someone standing by the table would have filmed it
function specInit(span, speed) {
  const T0 = r.T0 = Math.max(0, tp.tKey - span * speed); r.I = T0 > 0 ? 0 : 0.8; r.spd = speed; r.Tb = Math.max(T0, tp.tKey - 1.3);
  r.spec = { az: topAz() + 0.45, el: 0.62, zoom: 0.92, tx: 0, ty: 0 }; Object.assign(cam, r.spec);
  app.classList.add('colour'); if (T0 > 0) { r.struck = true; go(T0, 0, true); }
  return r.I + (tp.tKey - T0) / speed;
}
function specStep(dt, since) { cam.az = r.spec.az + Math.sin(r.t * 1.3) * 0.012; if (!cueUp(since, r.I)) go(r.T0 + (since - r.I) * r.spd, dt); return true; }
// the moment it goes wrong: everything stops and drains of colour
function moment() { r.dropped = true; go(tp.tKey, 0.016); app.classList.remove('colour'); app.classList.add('frozen'); kick('hit'); r.c0 = Object.assign({}, cam); r.mark = true; }
// held on the moment while the camera crashes in on the culprit
function crash(dt, rel, zoom) {
  const k = ease(rel / 0.22); go(tp.tKey, dt, true);
  cam.tx = lerp(r.c0.tx, tp.kx, k); cam.ty = lerp(r.c0.ty, tp.ky, k); cam.el += (0.55 - cam.el) * Math.min(1, dt * 8); cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 12);
  return true;
}
// the second half of most of them: tape back, the moment again slowly with the culprit ringed, then `finale` and black
function encore(dt, y, finale, S) {
  const RW = 0.9; S = S || 3;
  if (y < RW) {
    if (!r.rw) { r.rw = 1; big.className = 'gone'; hideCard(); app.classList.remove('frozen', 'glitch'); app.classList.add('rew'); SND.rewind(RW); tag('◀◀ 다시 봅시다'); }
    go(lerp(tp.tKey, r.Tb, ease(y / RW)), dt, true); cam.zoom += (0.42 - cam.zoom) * Math.min(1, dt * 4); return true;
  }
  const z = y - RW;
  if (z < S) {
    if (r.rw !== 2) { r.rw = 2; app.classList.remove('rew'); app.classList.add('colour'); tag('▶ 느린 화면'); }
    go(lerp(r.Tb, tp.tKey, z / S), dt); const b = game.world.balls[r.key], f = Math.min(1, dt * 5);
    cam.tx += ((b.on ? b.x : tp.kx) - cam.tx) * f; cam.ty += ((b.on ? b.y : tp.ky) - cam.ty) * f; cam.az += dt * 0.25; cam.zoom += (0.34 - cam.zoom) * Math.min(1, dt * 2);
    return true;
  }
  if (r.rw !== 3) { r.rw = 3; go(tp.tKey, dt); app.classList.remove('colour'); app.classList.add('frozen'); kick('hit'); tag(''); finale(); }
  go(tp.tKey, dt, true); cam.zoom *= 1 - dt * 0.04;
  return fadeOut(z - S, 2.1);
}

// the edits, one to a file: each adds itself here
const STYLES = {};
