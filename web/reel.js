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
function createReel(d) {
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

  const STYLES = {
    cuts: {
      name: '컷 편집',
      init() { return INTRO + buildPlan(tp.tKey - HOLD, 0.7); },
      step(dt, since, rel) {
        if (rel < 0) return opening(dt, since);
        if (!r.dropped) drop(true);
        const k = Math.floor(rel / (2 * r.beat)) - 1;
        if (k < 0) return after(dt, rel);
        if (k < 3) { cut(k, rel / (2 * r.beat) - 1 - k, dt, k + 1); return true; }
        return out(dt, rel);
      },
    },
    tracer: {
      name: '궤적', plain: true,
      init() { Object.assign(cam, { az: topAz() - 0.32, el: 0.92, zoom: 0.94, tx: 0, ty: 0 }); r.w = 3; return 1.5 + buildPlan(tp.tKey - HOLD, 0.5, 5); },
      step(dt, since, rel) {
        r.w += (3 - r.w) * Math.min(1, dt * 5);
        if (rel < 0) {
          cam.az += dt * 0.07; if (cueUp(since, 1.5)) return true;
          const x = since - 1.5; if (x < r.bd) go(x * r.slow, dt); else { app.classList.add('hold'); go(r.roll + clamp((x - r.bd) / r.hd, 0, 1) * HOLD * 0.5, dt); }
          return true;
        }
        if (!r.dropped) { drop(false); r.w = 10; r.T1 = r.T; }
        const lift = rel - 2 * r.beat;
        if (lift < 0) { go(r.T1 + rel, dt); cam.az += dt * 0.07; return true; }
        // the rest of the shot runs out quickly while the camera lifts to look straight down at everything that was drawn
        if (r.T2 == null) { r.T2 = r.T; kick('beat'); }
        go(r.T2 + lift * 2.5, dt); const f = Math.min(1, dt * 2.2);
        cam.az = turnTo(cam.az, topAz(), f); cam.el += (1.5 - cam.el) * f; cam.zoom += (1 - cam.zoom) * f;
        return fadeOut(lift, 6 * r.beat);
      },
      beat() { if (r.dropped) r.w = 7; },
      draw() {
        trails(r.T, r.w);
        // once it is all drawn, a spark of light runs each line again and again
        if (r.T2 != null) for (const p of r.paths) { const end = p.pts[p.pts.length - 1], t = ((r.t * 0.9) % 1) * end; if (HL.at(tp, p.id, t, Q2) && scene.proj.at(Q2[0], Q2[1], game.P.R, P2)) { g.fillStyle = '#fff'; g.globalAlpha = 0.95; g.beginPath(); g.arc(P2[0], P2[1], 4.5, 0, 6.283); g.fill(); g.globalAlpha = 0.3; g.fillStyle = p.col; g.beginPath(); g.arc(P2[0], P2[1], 12, 0, 6.283); g.fill(); g.globalAlpha = 1; } }
      },
    },
    math: {
      name: '계산', plain: true,
      init() {
        Object.assign(cam, { az: topAz(), el: 1.5, zoom: 1, tx: 0, ty: 0 }); r.A = Math.max(3.4, 8 * r.beat); r.spd = Math.max(1, tp.tKey / 5); r.reveal = 0;
        r.nCue = nodes(tp.cue, 0, r.key !== tp.cue ? tp.tHit : tp.tKey); r.nKey = r.key !== tp.cue ? nodes(r.key, tp.tHit, tp.tKey) : [];
        return r.A + 0.4 + tp.tKey / r.spd;
      },
      step(dt, since, rel) {
        if (rel < 0) {
          r.reveal = ease(since / r.A) * (tp.tKey + 0.05);
          if (!cueUp(since, r.A + 0.4)) go((since - r.A - 0.4) * r.spd, dt);
          return true;
        }
        if (!r.dropped) drop(false);
        r.reveal = tp.dur;
        const k = rel / (2 * r.beat);
        if (k < 1) { go(tp.tKey + rel, dt); return true; }
        if (k < 3) { cut(0, (k - 1) / 2, dt); return true; }      // once more from the pocket, with the working still on the table
        return out(dt, rel);
      },
      on(e) { if (e.t !== 'pocket' && e.v > 0.4) kick('beat'); },
      draw: drawMath,
    },
    freeze: {
      name: '정지',
      init() { r.Tf = Math.max(0, tp.tKey - 0.05); r.F = Math.max(1.1, 2 * r.beat); return INTRO + buildPlan(r.Tf, 0) + r.F; },
      step(dt, since, rel) {
        if (rel < 0) {
          if (cueUp(since, INTRO)) { camIntro(ease(since / INTRO)); return true; }
          const x = since - INTRO;
          if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, 0.16); return true; }
          // the ball is on the lip and the world stops
          if (!r.frozen) { r.frozen = true; app.classList.add('frozen'); kick('hit'); SND.boom(); showBig('💀', 'skull'); r.rush = 0.9; }
          go(r.Tf, dt, true); cam.zoom *= 1 - dt * 0.05; cam.tx += (tp.kx - tp.ux * 0.1 - cam.tx) * Math.min(1, dt * 2.5); cam.ty += (tp.ky - tp.uy * 0.1 - cam.ty) * Math.min(1, dt * 2.5);
          return true;
        }
        if (!r.dropped) { drop(false); big.className = 'gone'; burst(['💀', '💀', '☠️', '💀', '💀', '☠️', '💀']); }
        const k = rel / (2 * r.beat);
        if (k < 1) { go(r.Tf + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.4; return true; }
        if (k < 2) { cut(0, k - 1, dt, 2); return true; }
        return out(dt, rel);
      },
      beat() { if (r.frozen && !r.dropped) { SND.thump(); kick('beat'); } },
    },
    velocity: {
      name: '벨로시티',
      init() { r.T0 = Math.max(0, tp.tHit - 0.25); r.seg = (Math.min(tp.dur, tp.tKey + 0.3) - r.T0) / 8; return INTRO + buildPlan(tp.tKey - HOLD, 0.5); },
      step(dt, since, rel) {
        if (rel < 0) return opening(dt, since, 0.3);
        if (!r.dropped) drop(true);
        const x = rel / r.beat - 2, i = Math.floor(x), u = x - i;
        if (i < 0) return after(dt, rel);
        if (i >= 8) { r.rush = 0; return out(dt, rel); }
        // the shot again in one take: every beat throws time forward, then lets it crawl
        if (r.vi !== i) { r.vi = i; kick(i ? 'beat' : 'hit'); flash(); if (!i) { go(r.T0, 0, true); cam.el = 0.4; } }
        const v = 1 - u; go(r.T0 + r.seg * (i + 1 - v * v * v * v), dt);
        chase(dt, 0.4 - 0.1 * v * v, 0.35 + 2.6 * v * v, 9); r.rush = v * v * 0.9;
        return true;
      },
      on() {},
    },
    combo: {
      name: '콤보',
      init() { r.spd = clamp(tp.tKey / 4, 0.35, 0.8); r.n = 0; r.counting = true; r.lastFx = -1; return INTRO + tp.tKey / r.spd; },
      step(dt, since, rel) {
        if (rel < 0) { if (cueUp(since, INTRO)) camIntro(ease(since / INTRO)); else { go((since - INTRO) * r.spd, dt); chase(dt, 0.5, 0.2); } return true; }
        if (!r.dropped) { go(tp.tKey + 0.001, dt); r.counting = false; drop(true); showBig('×' + (r.n + 1), 'count pop last'); burst(['💥', '⚡', '🔥', '💥', '⚡']); }
        const k = rel / (2 * r.beat);
        if (k < 1) { go(tp.tKey + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
        if (k < 3) { cut(Math.floor(k) - 1, k - Math.floor(k), dt); return true; }
        return out(dt, rel);
      },
      // every knock is counted: a mark where it happened, a note one step higher than the last, and the count getting hotter
      on(e) {
        if (!r.counting || e.t === 'pocket' || e.v < 0.2 || r.t - r.lastFx < 0.07) return;
        r.lastFx = r.t; r.n++; SND.blip(r.n); kick(r.n > 2 ? 'hit' : 'beat'); showBig('×' + r.n, 'count pop'); big.style.setProperty('--hot', Math.min(1, r.n / 6));
        shock(e.x, e.y, GOLD, 0.3 + 0.06 * r.n);
        scene.proj.begin(); if (scene.proj.at(e.x, e.y, game.P.R, P2)) { emoji(e.t === 'ball' ? '💥' : '⚡', P2[0], P2[1]); emoji('×' + r.n, P2[0] + 34, P2[1] - 30, 'num'); }
      },
    },
    rewind: {
      name: '되감기',
      init() {
        const T0 = r.T0 = Math.max(0, tp.tKey - 4.5), I = r.I = T0 > 0 ? 0 : 0.7, Te = r.Te = Math.min(tp.dur, tp.tKey + 0.45);
        let Tb = Math.max(T0, tp.tHit - 0.4); if (tp.tKey - Tb < 0.5) Tb = Math.max(T0, tp.tKey - 0.9); r.Tb = Tb;
        r.open = I + (Te - T0); r.RW = clamp((Te - Tb) / 2.5, 0.7, 1.5); r.S = clamp((tp.tKey - HOLD - Tb) / 0.4, 1.6, 4);
        r.spec = { az: topAz() + 0.5, el: 0.6, zoom: 0.92, tx: 0, ty: 0 }; Object.assign(cam, r.spec);
        r.close = { az: Math.atan2(-tp.ux, tp.uy) + 0.5, el: 0.34, zoom: 0.36 };
        app.classList.add('colour'); tag('▶ PLAY'); if (T0 > 0) { r.struck = true; go(T0, 0, true); }
        return r.open + 0.3 + r.RW + r.S + 0.5;
      },
      step(dt, since, rel) {
        if (rel >= 0) {
          if (!r.dropped) { drop(true); tag(''); }
          if (rel < 4 * r.beat) return after(dt, rel);
          return out(dt, rel);
        }
        // as it happened, seen from where someone standing by the table would have filmed it
        if (since < r.open) { cam.az = r.spec.az + Math.sin(r.t * 1.3) * 0.012; cam.el = r.spec.el + Math.sin(r.t * 1.9) * 0.006; if (!cueUp(since, r.I)) go(r.T0 + since - r.I, dt); return true; }
        const y = since - r.open - 0.3;
        if (y < 0) { go(r.Te, dt, true); tag('❚❚'); return true; }
        if (y < r.RW) {                                         // tape running back, the camera coming down to the cloth
          if (!r.rw) { r.rw = true; app.classList.add('rew'); SND.rewind(r.RW); tag('◀◀ REW'); }
          const k = ease(y / r.RW); go(lerp(r.Te, r.Tb, k), dt, true); r.rush = 0.5;
          const kb = game.world.balls[r.key], tx = kb.on ? kb.x : tp.kx, ty = kb.on ? kb.y : tp.ky;
          cam.az = turnTo(r.spec.az, r.close.az, k); cam.el = lerp(r.spec.el, r.close.el, k); cam.zoom = lerp(r.spec.zoom, r.close.zoom, k); cam.tx = lerp(0, tx, k); cam.ty = lerp(0, ty, k);
          return true;
        }
        if (r.rw !== 2) { r.rw = 2; r.rush = 0; app.classList.remove('rew', 'colour'); kick('beat'); flash(); tag('▶ SLOW'); }
        const z = y - r.RW;
        if (z < r.S) { go(lerp(r.Tb, tp.tKey - HOLD, z / r.S), dt); chase(dt, 0.34, 0.14); }
        else { app.classList.add('hold'); r.rush = 0.35; go(tp.tKey - HOLD + clamp((z - r.S) / 0.5, 0, 1) * HOLD * 0.5, dt); pushIn(dt); }
        return true;
      },
    },
    pov: {
      name: '공 시점',
      init() { tag('● REC'); r.h = [Math.cos(r.best.aim), Math.sin(r.best.aim)]; Object.assign(cam, { az: Math.atan2(-r.h[0], r.h[1]) + 0.9, el: 0.6, zoom: 0.5, tx: r.cue0[0], ty: r.cue0[1] }); return 1.7 + buildPlan(tp.tKey - HOLD, 0.6); },
      // sit just behind the ball, looking the way it is going
      ride(dt, side) {
        const o = lead(), id = o ? o.id : r.key, a = [0, 0], b = [0, 0];
        if (o && HL.at(tp, id, r.T, a) && HL.at(tp, id, Math.min(tp.dur, r.T + 0.06), b)) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > 0.004) { const f = Math.min(1, dt * 7); r.h[0] += ((b[0] - a[0]) / l - r.h[0]) * f; r.h[1] += ((b[1] - a[1]) / l - r.h[1]) * f; } }
        const l = Math.hypot(r.h[0], r.h[1]) || 1, hx = r.h[0] / l, hy = r.h[1] / l, x = o ? o.x : tp.kx, y = o ? o.y : tp.ky, f = Math.min(1, dt * 9);
        cam.tx += (x + hx * 0.24 - cam.tx) * f; cam.ty += (y + hy * 0.24 - cam.ty) * f;
        cam.az = turnTo(cam.az, Math.atan2(-hx, hy) + (side || 0), Math.min(1, dt * 6)); cam.el += ((side ? 0.4 : 0.2) - cam.el) * Math.min(1, dt * 4); cam.zoom += ((side ? 0.3 : 0.17) - cam.zoom) * Math.min(1, dt * 4);
      },
      step(dt, since, rel) {
        if (rel < 0) {
          if (cueUp(since, 1.7)) { this.ride(dt, 0.7); return true; }
          const x = since - 1.7;
          if (x < r.bd) { go(x * r.slow, dt); r.rush = Math.min(0.5, r.rate * 0.6); } else { app.classList.add('hold'); r.rush = 0.45; go(r.roll + clamp((x - r.bd) / r.hd, 0, 1) * HOLD * 0.5, dt); }
          this.ride(dt); return true;
        }
        if (!r.dropped) drop(true);
        const k = rel / (2 * r.beat);
        // once the ball is gone there is nothing to ride: ease back and watch the pocket
        if (k < 1) { go(tp.tKey - HOLD * 0.5 + rel, dt); const f = Math.min(1, dt * 4); cam.tx += (tp.kx - tp.ux * 0.22 - cam.tx) * f; cam.ty += (tp.ky - tp.uy * 0.22 - cam.ty) * f; cam.zoom += (0.34 - cam.zoom) * f; cam.el += (0.42 - cam.el) * f; cam.az += dt * 0.3; return true; }
        if (k < 3) { cut(k < 2 ? 0 : 2, k - Math.floor(k), dt, k < 2 ? 0 : 1); return true; }
        return out(dt, rel);
      },
    },
    strobe: {
      name: '잔상', plain: true,
      init() {
        Object.assign(cam, { az: topAz() + 0.28, el: 1.05, zoom: 0.95, tx: 0, ty: 0 }); r.w = 1;
        // where each ball leaves a copy of itself: every couple of ball-widths along its line
        const a = [0, 0], gap = game.P.R * 2.5;
        // (when many balls fly, as on a break, only the two the shot is about leave copies: the rest just draw thin lines)
        const few = r.paths.length <= 5;
        for (const p of r.paths) { p.gh = []; if (!few && p.id !== tp.cue && p.id !== r.key) continue; let lx = p.pts[0], ly = p.pts[1]; for (let t = 0; t <= p.pts[p.pts.length - 1]; t += 1 / 120) { if (!HL.at(tp, p.id, t, a)) break; if (Math.hypot(a[0] - lx, a[1] - ly) >= gap) { p.gh.push(a[0], a[1], t); lx = a[0]; ly = a[1]; } } }
        return 1.5 + buildPlan(tp.tKey - HOLD, 0.5, 5);
      },
      step(dt, since, rel) {
        r.w += (1 - r.w) * Math.min(1, dt * 5);
        if (rel < 0) {
          cam.az -= dt * 0.06; if (cueUp(since, 1.5)) return true;
          const x = since - 1.5; if (x < r.bd) go(x * r.slow, dt); else { app.classList.add('hold'); go(r.roll + clamp((x - r.bd) / r.hd, 0, 1) * HOLD * 0.5, dt); }
          return true;
        }
        if (!r.dropped) { drop(true); r.w = 2.2; r.T1 = r.T; }
        const lift = rel - 2 * r.beat;
        if (lift < 0) { go(r.T1 + rel, dt); cam.az -= dt * 0.06; return true; }
        if (r.T2 == null) { r.T2 = r.T; kick('beat'); }
        go(r.T2 + lift * 2.5, dt); const f = Math.min(1, dt * 2.2);
        cam.az = turnTo(cam.az, topAz(), f); cam.el += (1.5 - cam.el) * f; cam.zoom += (1 - cam.zoom) * f;
        return fadeOut(lift, 6 * r.beat);
      },
      beat() { if (r.dropped) r.w = 1.8; if (r.struck && r.outAt == null) flash(); },
      draw() {
        for (const p of r.paths) {
          line(p, 0, r.T); g.globalAlpha = 0.35; g.strokeStyle = p.col; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1;
          for (let i = 0; i < p.gh.length; i += 3) { const age = r.T - p.gh[i + 2]; if (age < 0) break; ghost(p.gh[i], p.gh[i + 1], p.col, Math.min(0.85, (0.16 + 0.5 * Math.exp(-age * 1.6)) * r.w)); }
        }
      },
    },
    bullet: {
      name: '불릿 타임',
      init() { r.Tf = Math.max(0, tp.tKey - 0.05); r.F = Math.max(2, 4 * r.beat); return INTRO + buildPlan(r.Tf, 0) + r.F; },
      step(dt, since, rel) {
        if (rel < 0) {
          if (cueUp(since, INTRO)) { camIntro(ease(since / INTRO)); return true; }
          const x = since - INTRO;
          if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, 0.16); return true; }
          // time stops with the ball on the lip, and the camera goes all the way round it
          if (!r.frozen) { r.frozen = true; app.classList.add('hold', 'matrix'); kick('hit'); flash(); SND.boom(); r.c0 = Object.assign({}, cam); const kb = game.world.balls[r.key]; r.bx = kb.on ? kb.x : tp.kx; r.by = kb.on ? kb.y : tp.ky; }
          const k = (x - r.bd) / r.F, e = ease(Math.min(1, k * 4));
          go(r.Tf + k * 0.025, dt, true); r.rush = 0.3;
          cam.az = r.c0.az + 2 * Math.PI * ease(k); cam.el = lerp(r.c0.el, 0.3, e); cam.zoom = lerp(r.c0.zoom, 0.26, e); cam.tx = lerp(r.c0.tx, r.bx, e); cam.ty = lerp(r.c0.ty, r.by, e);
          return true;
        }
        if (!r.dropped) drop(true);
        const k = rel / (2 * r.beat);
        if (k < 1) { go(r.Tf + 0.025 + rel, dt); cam.zoom += (0.32 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
        if (k < 2) { cut(2, k - 1, dt, 1); return true; }
        return out(dt, rel);
      },
      beat() { if (r.frozen && !r.dropped) { SND.thump(); kick('beat'); const kb = game.world.balls[r.key]; if (kb.on) shock(kb.x, kb.y, '#bfe9ff', 0.35); } },
    },
    count: {
      name: '카운트다운',
      init() { r.Tc = Math.max(0, tp.tKey - 0.4); r.C = 3 * r.beat; return INTRO + buildPlan(r.Tc, 0) + r.C; },
      step(dt, since, rel) {
        if (rel < 0) {
          if (cueUp(since, INTRO)) { camIntro(ease(since / INTRO)); return true; }
          const x = since - INTRO;
          if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, 0.16); return true; }
          // three, two, one: a number and a new camera on every beat, the ball crawling the last of the way
          const n = clamp(3 - Math.floor((x - r.bd) / r.beat), 1, 3);
          if (r.cn !== n) { r.cn = n; showBig(String(n), 'num3'); kick('hit'); flash(); SND.thump(); Object.assign(cam, cutCam(3 - n)); cam.zoom *= 1 + 0.25 * (n - 1); $('#reel').style.setProperty('--tint', ['#19e3ff', '#ffd60a', '#ff2d55'][n - 1]); app.classList.add('tinted'); r.rush = 0.6; }
          go(lerp(r.Tc, tp.tKey - 0.04, clamp((x - r.bd) / r.C, 0, 1)), dt); r.rush *= Math.max(0, 1 - dt * 2.5);
          cam.zoom *= 1 - dt * 0.3; cam.az += dt * (cam.spin || 0);
          return true;
        }
        if (!r.dropped) { drop(true); big.className = 'gone'; }
        if (rel < 2 * r.beat) { go(tp.tKey - 0.04 + rel, dt); cam.az += dt * 0.4; return true; }
        return out(dt, rel);
      },
    },
    stutter: {
      name: '스터터',
      init() { return INTRO + buildPlan(tp.tKey - HOLD, 0.7); },
      step(dt, since, rel) {
        if (rel < 0) return opening(dt, since);
        if (!r.dropped) drop(true);
        // the drop itself, six times in three beats: back a fraction, in again, closer and from further round each time
        const h = r.beat / 2, i = Math.floor(rel / h), u = rel / h - i;
        if (i < 6) {
          if (r.si !== i) { r.si = i; go(tp.tKey - 0.07, 0, true); if (i) { kick('hit'); flash(); grade(i % 2 ? 3 : 0); app.classList.toggle('glitch', i % 2 === 1); cam.zoom *= 0.9; cam.az += 0.4; again($('#reelStreak'), 'go'); } }
          go(tp.tKey - 0.07 + u * 0.13, dt); return true;
        }
        if (r.si !== 6) { r.si = 6; grade(0); app.classList.remove('glitch'); r.T1 = r.T; }
        const t = rel - 6 * h;
        if (t < 2 * r.beat) { go(r.T1 + t, dt); cam.zoom += (0.34 - cam.zoom) * Math.min(1, dt * 3); cam.az += dt * 0.5; return true; }
        return out(dt, rel);
      },
    },

    /* ---- any other highlight: the shot again as it happened, with one easy camera move and nothing added ---- */
    plain: {
      name: '다시 보기', hidden: true, bare: true, plain: true,
      init() {
        const T0 = r.T0 = Math.max(0, tp.tKey - 4); r.I = T0 > 0 ? 0 : 0.9; app.classList.add('colour');
        Object.assign(cam, { az: topAz() + 0.35, el: 0.72, zoom: 0.96, tx: 0, ty: 0 }); if (T0 > 0) { r.struck = true; go(T0, 0, true); }
        return r.I + (tp.tKey - T0);
      },
      step(dt, since, rel) {
        // from a wide view, drifting round and in toward where it happens
        const k = ease(since / (r.lead + 0.9));
        cam.az = topAz() + 0.35 + 0.55 * k; cam.el = lerp(0.72, 0.5, k); cam.zoom = lerp(0.96, 0.5, k); cam.tx = lerp(0, tp.kx * 0.75, k); cam.ty = lerp(0, tp.ky * 0.75, k);
        if (!cueUp(since, r.I)) go(r.T0 + since - r.I, dt);
        return fadeOut(rel, 1.4);
      },
      on() {},
    },

    /* ---- worst shot: no song, and the "drop" is the moment it went wrong ---- */
    clown: {
      name: '광대', worst: true,
      init() { return specInit(3.5, 1); },
      step(dt, since, rel) {
        if (rel < 0) return specStep(dt, since);
        // it happens: everything stops, the camera crashes in on the culprit
        if (!r.dropped) { moment(); SND.fart(0); showBig('🤡', 'skull'); rain(['💩'], 16); }
        if (rel < 2) return crash(dt, rel, 0.3);
        return encore(dt, rel - 2, () => { SND.fart(3); showBig('🤡', 'skull'); rain(['💩', '🤡', '💩'], 26); });
      },
      on() {},
      draw() { if (r.mark) culprit(); },
    },
    var: {
      name: 'VAR', worst: true, plain: true,
      init() {
        const T0 = r.T0 = Math.max(0, tp.tKey - 3); r.I = T0 > 0 ? 0 : 0.8; r.L = 1.5;
        Object.assign(cam, { az: topAz(), el: 1.5, zoom: 1, tx: 0, ty: 0 }); tag('● VAR 판독 중');
        if (T0 > 0) { r.struck = true; go(T0, 0, true); }
        return r.I + (tp.tKey - T0) / 0.6;
      },
      step(dt, since, rel) {
        if (rel < 0) { if (!cueUp(since, r.I)) go(r.T0 + (since - r.I) * 0.6, dt); return true; }
        const i = Math.floor(rel / r.L), u = rel / r.L - i, away = Math.atan2(tp.ux, -tp.uy);
        if (i < 3) {
          // the moment itself, three times: stop on it, run it back, run it in again - closer every time
          if (r.li !== i) {
            r.li = i; go(tp.tKey, dt); r.dropped = true; app.classList.add('colour'); kick('hit'); flash(); SND.fart(i); showBig('×' + (i + 1), 'count pop');
            Object.assign(cam, { az: away + Math.PI * (0.5 + 0.6 * i), el: [0.95, 0.55, 0.32][i], zoom: [0.55, 0.38, 0.27][i], tx: tp.kx, ty: tp.ky });
            scene.proj.begin(); if (scene.proj.at(tp.kx, tp.ky, game.P.R, P2)) emoji('❌', P2[0], P2[1]); rain(['💩'], 5 + 4 * i);
          }
          const back = 0.45;
          if (u < 0.3) go(tp.tKey, dt, true); else if (u < 0.62) go(tp.tKey - back * ease((u - 0.3) / 0.32), dt, true); else go(tp.tKey - back * (1 - (u - 0.62) / 0.38), dt);
          app.classList.toggle('rew', u >= 0.3 && u < 0.62); cam.az += dt * 0.15; cam.zoom *= 1 - dt * 0.05;
          return true;
        }
        if (r.li !== 3) { r.li = 3; app.classList.remove('rew', 'colour'); app.classList.add('frozen'); go(tp.tKey, dt); kick('hit'); SND.fart(3); showBig('🤡', 'skull'); rain(['💩', '🤡'], 28); tag('판독 결과: 유죄'); }
        go(tp.tKey, dt, true); cam.zoom *= 1 - dt * 0.04;
        return fadeOut(rel - 3 * r.L, 2.2);
      },
      on() {},
      draw() { for (const p of r.paths) if (p.id === r.key || p.id === tp.cue) { line(p, 0, r.T); g.globalAlpha = 0.8; g.strokeStyle = p.id === r.key ? RED : '#fff'; g.lineWidth = 2; g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; } culprit(); },
    },
    huh: {
      name: '물음표', worst: true,
      init() { return specInit(3.5, 1); },
      step(dt, since, rel) {
        if (rel < 0) return specStep(dt, since);
        // nobody says anything. Then one question mark, and another, and another, the camera a step closer each time
        if (!r.dropped) { moment(); r.q = 0; }
        if (rel < 3.1) {
          const n = rel < 0.6 ? 0 : rel < 1.2 ? 1 : rel < 1.8 ? 2 : 3;
          if (n !== r.q) { r.q = n; showBig('?'.repeat(n), 'num3 q'); kick('hit'); if (n < 3) SND.thump(); else { SND.fart(1); rain(['❓', '❔'], 22); } }
          return crash(dt, rel, [0.62, 0.46, 0.34, 0.25][r.q]);
        }
        return encore(dt, rel - 3.1, () => { SND.fart(3); showBig('?', 'num3 q'); rain(['❓', '🤡', '❔', '❓'], 30); }, 2.5);
      },
      on() {},
      draw() { if (r.mark) culprit(); },
    },
    sad: {
      name: '비극', worst: true,
      init() {
        const T0 = r.T0 = Math.max(0, tp.tKey - 1.8); r.I = T0 > 0 ? 0 : 0.8; r.tear = 0; grade(3); app.classList.add('hold');
        Object.assign(cam, { az: Math.atan2(-tp.ux, tp.uy) + 0.6, el: 0.4, zoom: 0.55, tx: r.cue0[0], ty: r.cue0[1] });
        if (T0 > 0) { r.struck = true; go(T0, 0, true); }
        return r.I + (tp.tKey - T0) / 0.3;
      },
      step(dt, since, rel) {
        const b = game.world.balls[r.key], f = Math.min(1, dt * 2.5);
        cam.tx += ((b.on ? b.x : tp.kx) - cam.tx) * f; cam.ty += ((b.on ? b.y : tp.ky) - cam.ty) * f; cam.zoom *= 1 - dt * 0.035; cam.az += dt * 0.05;
        if (rel < 0) {
          // very slowly, in black and white, as if it mattered
          if (!cueUp(since, r.I)) go(r.T0 + (since - r.I) * 0.3, dt);
          if (r.t > r.tear) { r.tear = r.t + 0.8; emoji(['😭', '💔', '😢'][Math.floor(Math.random() * 3)], app.clientWidth * (0.15 + 0.7 * Math.random()), app.clientHeight * 0.72); }
          return true;
        }
        if (!r.dropped) { r.dropped = true; go(tp.tKey, dt); kick('hit'); SND.fart(2); showBig('🥀', 'skull'); rain(['🫡', '😭', '🕯️'], 18); card('obit', [el('b', { text: r.best.who }), el('span', { text: '의 샷 · 방금 우리 곁을 떠났습니다' })]); }
        go(tp.tKey, dt, true);
        if (rel > 2.6 && !r.squeak) { r.squeak = true; SND.fart(1); kick('beat'); }
        return fadeOut(rel, 4.3);
      },
      on() {},
      draw() { culprit(); },
    },
    news: {
      name: '속보', worst: true,
      init() { return specInit(3.5, 1); },
      step(dt, since, rel) {
        if (rel < 0) return specStep(dt, since);
        if (!r.dropped) {
          moment(); flash(); SND.fart(0); app.classList.remove('frozen'); app.classList.add('colour');
          card('news', [el('i', { text: '속보' }), el('b', { text: `${r.best.who}, ${HEAD[r.best.kind] || '믿기 힘든 샷'}` }),
            el('span', { class: 'tick', text: '목격자 "눈을 의심했다" · 전문가 "일부러 해도 어렵다" · 공 측 "할 말 없다" · 당사자는 연락 두절' })]);
          scene.proj.begin(); if (scene.proj.at(tp.kx, tp.ky, game.P.R, P2)) emoji('📢', P2[0], P2[1]);
        }
        if (rel < 2.4) return crash(dt, rel, 0.36);
        // footage from two more angles, each ending on the moment
        const x = (rel - 2.4) / 1.9, i = Math.floor(x), u = x - i, away = Math.atan2(tp.ux, -tp.uy);
        if (i < 2) {
          if (r.ni !== i) { r.ni = i; go(Math.max(0, tp.tKey - 0.55), 0, true); kick('hit'); flash(); tag(i ? '단독 · 다른 각도' : '현장 화면'); cardEl.firstChild.textContent = i ? '단독' : '속보'; Object.assign(cam, { az: away + (i ? 2 : -1.2), el: i ? 1.25 : 0.34, zoom: i ? 0.3 : 0.32, tx: tp.kx, ty: tp.ky }); }
          go(Math.max(0, tp.tKey - 0.55) + Math.min(1, u * 1.35) * 0.55, dt); cam.az += dt * 0.12; cam.zoom *= 1 - dt * 0.05;
          if (u * 1.35 >= 1 && r.nf !== i) { r.nf = i; SND.fart(1 + i); kick('beat'); }
          return true;
        }
        if (r.ni !== 2) { r.ni = 2; go(tp.tKey, dt); app.classList.remove('colour'); app.classList.add('frozen'); kick('hit'); SND.fart(3); showBig('🤡', 'skull'); rain(['💩', '📰', '🤡'], 26); tag(''); }
        go(tp.tKey, dt, true); cam.zoom *= 1 - dt * 0.04;
        return fadeOut(rel - 2.4 - 3.8, 2);
      },
      on() {},
      draw() { if (r.mark) culprit(); },
    },
    error: {
      name: '오류', worst: true,
      init() { return specInit(3.5, 1); },
      step(dt, since, rel) {
        if (rel < 0) return specStep(dt, since);
        // the game itself cannot take it: the picture breaks up, then a crash screen with a recovery bar
        if (!r.dropped) { moment(); app.classList.remove('frozen'); app.classList.add('glitch'); grade(3); SND.fart(1); }
        if (rel < 0.6) return crash(dt, rel, 0.34);
        if (rel < 3.4) {
          if (!r.bsod) { r.bsod = true; app.classList.remove('glitch'); SND.fart(2); card('bsod', [el('b', { text: ':(' }), el('span', { text: '실력.exe가 응답하지 않습니다' }), el('small', { text: '' })]); }
          cardEl.lastChild.textContent = `오류 코드: ${CODE[r.best.kind] || 'UNKNOWN_SHOT'} · 샷을 복구하는 중… ${Math.min(100, Math.floor((rel - 0.6) / 2.6 * 100))}%`;
          go(tp.tKey, dt, true); return true;
        }
        if (!r.reboot) { r.reboot = true; grade(0); flash(); }
        return encore(dt, rel - 3.4, () => { SND.fart(3); showBig('⚠️', 'skull'); rain(['⚠️', '💩', '🤡'], 26); }, 2.6);
      },
      on() {},
      draw() { if (r.mark && !r.bsod || r.reboot) culprit(); },
    },
  };
  const BEST = Object.keys(STYLES).filter(id => !STYLES[id].worst && !STYLES[id].hidden), WORST = Object.keys(STYLES).filter(id => STYLES[id].worst);
  // every edit comes up once before any comes up again
  function pick(kind) {
    const bag = bags[kind];
    if (!bag.length) { bag.push(...(kind === 'worst' ? WORST : BEST)); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), x = bag[i]; bag[i] = bag[j]; bag[j] = x; } if (last[kind] === bag[bag.length - 1] && bag.length > 1) bag.unshift(bag.pop()); }
    return bag.pop();
  }

  // `shot`: a best shot, or (with shot.kind set) a worst one. `style`: one of the edits by name, or nothing for the next in the shuffle.
  function play(shot, style) {
    const w = game.world, carom = game.mode && game.mode.table === 'carom', kind = shot.kind ? 'worst' : 'best';
    tp = HL.record(game.P, w.balls.length, shot);
    const id = style === 'plain' ? style : STYLES[style] && !!STYLES[style].worst === (kind === 'worst') ? style : pick(kind); if (id !== 'plain') last[kind] = id;
    cam = { az: shot.aim - Math.PI / 2 + 1.0, el: 1.15, zoom: 1, tx: 0, ty: 0 };
    r = { best: shot, id, style: STYLES[id], t: 0, T: 0, rate: 0, rush: 0, bn: null, key: kind === 'worst' ? shot.ball : shot.key >= 0 ? shot.key : tp.cue, struck: false, dropped: false, cue: true, pull: 0.03,
      from: Object.assign({}, cam), paths: [], parts: [], rings: [], cols: {} };
    scene.clearFalls(); HL.restore(w, shot.snap); w.snd.length = 0;
    for (let i = 0; i < tp.nb; i++) {
      r.cols[i] = carom ? ['#ffffff', '#ffd23c', '#ff4d43', '#ff4d43'][i] || '#fff' : i === tp.cue ? '#ffffff' : i === 8 ? '#aab1bd' : ballCss(i);
      const pts = HL.path(tp, i); if (pts) r.paths.push({ id: i, pts, col: r.cols[i] });
    }
    const c = w.balls[w.cue]; r.cue0 = [c.x, c.y];
    st.aim = shot.aim; st.power = Math.min(1, game.powerOf(shot.V)); st.spin = { x: shot.a / 0.5, y: shot.b / 0.5 }; st.el = shot.el || 0; st.jump = !!shot.j;
    const info = kind === 'best' ? SND.song.info : null; r.beat = 60 / (info ? info.bpm : 140);
    $('#reelFx').textContent = ''; big.className = ''; big.textContent = ''; tag(''); $('#reel').hidden = false; $('#reelFade').classList.remove('go');
    $('#reel').style.setProperty('--kc', r.cols[r.key] === '#aab1bd' ? '#ffffff' : r.cols[r.key] || '#ffffff');
    app.classList.remove(...CLS); app.classList.add('reeling'); skin(id); hideCard();
    r.lead = r.style.init();                                   // real seconds from now to the key moment
    r.song = kind === 'best' && id !== 'plain' ? SND.song.play(r.lead) : false;
    scene.setCam(cam); drawOverlay(0);
  }
  function stop() {
    if (!r) return; r = null;
    SND.song.stop(); SND.rolling(0); scene.clearFalls();
    $('#reel').hidden = true; app.classList.remove(...CLS); skin(null); hideCard(); big.className = ''; tag(''); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    scene.setOrbit(false); d.onEnd();
  }

  // one frame; returns what the scene should show, or null once the reel is over
  function tick(dt) {
    r.t += dt;
    const song = r.song ? SND.song.time() : null, rel = song != null ? song : r.t - r.lead;   // seconds since the key moment (negative before)
    if (r.style.step(dt, rel + r.lead, rel) === false) { stop(); return null; }
    const bn = Math.floor(rel / r.beat);
    if (bn !== r.bn) { r.bn = bn; if (r.style.beat) r.style.beat(bn); if (r.dropped && !r.style.worst && !r.style.bare && r.outAt == null) again(app, 'pulse'); }
    scene.setCam(cam); drawOverlay(dt);
    return { alpha: 1, pull: r.pull, cue: r.cue };
  }
  return { play, tick, skip: stop, STYLES: BEST.map(id => [id, STYLES[id].name]), WORST, get playing() { return !!r; }, get style() { return r && r.id; } };
}
