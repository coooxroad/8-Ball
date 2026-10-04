/* The best-shot reel: the chosen shot, cut like a short edit.

   The shot is written down once as a tape (highlights.record), so an edit can run it at any speed, hold it, run it
   backwards or jump about in it. Every edit is built so that the moment that matters - the ball dropping - lands exactly
   on the drop of the song (or, with no song, at the same point of its own clock). Seven edits:

     cuts      slow build from behind the cue, a held breath, the drop, then the same moment from three more cameras
     tracer    the whole table from above, every ball drawing its line in its own colour
     math      the shot worked out before it is played: lines, angles and distances drawn in, then the ball follows them
     freeze    everything stops with the ball on the lip, one skull, then the drop
     velocity  one take circling the ball, time lurching forward on every beat
     combo     every contact counted out loud
     rewind    the shot as it happened, tape run back, then again slowly up to the drop

   d: { game, scene, SND, highlights, st, $, el, app, panOf, onEnd } */
function createReel(d) {
  const { game, scene, SND, highlights: HL, st, $, el, app } = d;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x, ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), lerp = (a, b, k) => a + (b - a) * k;
  const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; }, turnTo = (a, b, k) => a + wrap(b - a) * k;
  const INTRO = 2.2, HOLD = 0.1, PRE = 0.32, POST = 0.14;     // seconds: camera move-in; tape time held back before the drop; tape window of a cut
  const cv = $('#reelCv'), g = cv.getContext('2d'), big = $('#reelBig'), P2 = [0, 0], Q2 = [0, 0];
  const CLS = ['reeling', 'colour', 'hit', 'beat', 'impact', 'hold', 'frozen', 'rew'];
  let r = null, bag = [], cam = null, tp = null;

  /* ---- picture effects (all on the page, none in the 3D scene) ---- */
  const kick = cls => { app.classList.remove('hit', 'beat'); void app.offsetWidth; app.classList.add(cls); };
  function impact() {                                          // two frames of negative, then a white flash
    app.classList.add('impact'); setTimeout(() => app.classList.remove('impact'), 70);
    const f = $('#reelFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  function emoji(ch, x, y, cls) {
    const n = el('i', { class: 'rfx' + (cls ? ' ' + cls : ''), text: ch, style: `left:${x}px;top:${y}px;--dx:${(Math.random() - 0.5) * 140}px;--rot:${(Math.random() - 0.5) * 50}deg` });
    $('#reelFx').appendChild(n); setTimeout(() => n.remove(), 1500);
  }
  function burst() {
    const W = app.clientWidth, H = app.clientHeight, me = r;
    ['🔥', '💀', '🔥', '🗿', '🔥'].forEach((ch, i) => setTimeout(() => { if (r === me) emoji(ch, W * (0.2 + 0.6 * Math.random()), H * (0.6 + 0.2 * Math.random())); }, i * 90));
  }
  const showBig = (text, cls) => { big.textContent = text; big.className = ''; void big.offsetWidth; big.className = cls; };

  /* ---- the tape ---- */
  // put the table at tape time T; going forward, everything passed on the way is heard (and seen) unless `quiet`
  function go(T, dt, quiet) {
    T = clamp(T, 0, tp.dur);
    if (T < r.T - 1e-6) scene.clearFalls();
    else if (!quiet) for (const e of tp.events) if (e.time > r.T && e.time <= T) fire(e);
    const v = HL.seek(game.world, tp, T), rate = dt > 0 ? Math.abs(T - r.T) / dt : 0;
    SND.rolling(quiet ? 0 : Math.min(8, v * Math.min(1, rate)));
    r.T = T;
  }
  function fire(e) {
    const pan = d.panOf(e.x, e.y);
    if (e.t === 'pocket') { scene.fall(game.P, e); SND.drop('lip', Math.hypot(e.vx, e.vy), pan); }
    else if (e.t === 'ball') SND.ball(e.v, pan); else SND.rail(e.v, pan);
    if (r.style.on) r.style.on(e); else if (e.t === 'ball' && e.v > 0.8) kick('beat');
  }

  /* ---- things every edit is made of ---- */
  // the cue being drawn back for D seconds, then the strike; true while it is still drawing back
  function cueUp(since, D) {
    if (since < D) { r.cue = true; r.pull = 0.03 + 0.24 * st.power * ease((since - D * 0.25) / (D * 0.65)); return true; }
    if (!r.struck) { r.struck = true; SND.cue(r.best.V, 0); kick('beat'); }
    r.cue = false; return false;
  }
  // from a wide view down to just behind the cue
  function camIntro(k) {
    const b = r.best;
    cam.az = lerp(r.from.az, b.aim - Math.PI / 2 + 0.16, k); cam.el = lerp(r.from.el, 0.46, k); cam.zoom = lerp(1, 0.44, k);
    cam.tx = lerp(0, r.cue0[0], k); cam.ty = lerp(0, r.cue0[1], k);
  }
  // keep the ball that matters in the middle: the cue ball until it hits, then the ball it is sending to the pocket
  function chase(dt, zoom, turn, stiff) {
    const w = game.world, key = w.balls[r.key], cb = w.balls[tp.cue], o = r.T >= tp.tHit && key.on ? key : cb.on && r.T < tp.tHit ? cb : null;
    const x = o ? o.x : tp.kx, y = o ? o.y : tp.ky, f = Math.min(1, dt * (stiff || 5));
    cam.tx += (x - cam.tx) * f; cam.ty += (y - cam.ty) * f; cam.az += dt * turn; cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 2);
  }
  function pushIn(dt) {
    cam.tx += (tp.kx - tp.ux * 0.12 - cam.tx) * Math.min(1, dt * 3); cam.ty += (tp.ky - tp.uy * 0.12 - cam.ty) * Math.min(1, dt * 3);
    cam.zoom += (0.24 - cam.zoom) * Math.min(1, dt * 1.6); cam.el += (0.5 - cam.el) * Math.min(1, dt * 2);
  }
  // slow play up to just short of the key moment, then a held breath of `hold` seconds; x is seconds since the strike
  function build(x, dt, turn) {
    if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, turn == null ? 0.16 : turn); }
    else { app.classList.add('hold'); go(r.roll + clamp((x - r.bd) / r.hd, 0, 1) * HOLD * 0.5, dt); pushIn(dt); }
  }
  function buildPlan(upto, hold, longest) { r.roll = Math.max(0, upto); r.slow = Math.max(0.42, r.roll / (longest || 4.2)); r.bd = r.roll / r.slow; r.hd = hold; return r.bd + hold; }
  function drop(emojis) {
    r.dropped = true; app.classList.remove('hold', 'frozen', 'rew'); app.classList.add('colour');
    impact(); kick('hit'); SND.boom(); if (emojis) burst();
  }
  // cameras for the replays of the key moment
  function cutCam(k) {
    const away = Math.atan2(tp.ux, -tp.uy);                    // the compass direction that puts the camera beyond the pocket, looking back
    if (k === 0) return { az: away, el: 0.3, zoom: 0.25, tx: tp.kx - tp.ux * 0.16, ty: tp.ky - tp.uy * 0.16, spin: 0.1 };       // from behind the pocket, low
    if (k === 1) return { az: away + Math.PI, el: 1.42, zoom: 0.2, tx: tp.kx - tp.ux * 0.1, ty: tp.ky - tp.uy * 0.1, spin: 0.35 }; // straight down, tight
    return { az: away + Math.PI / 2, el: 0.22, zoom: 0.3, tx: tp.kx - tp.ux * 0.2, ty: tp.ky - tp.uy * 0.2, spin: -0.25 };        // from the side, at cloth level
  }
  // one replay of the last third of a second from camera k; u runs 0..1 through it. Quick up to the pocket, slower after.
  function cut(k, u, dt) {
    if (r.cutK !== k) { r.cutK = k; go(tp.tKey - PRE, 0, true); Object.assign(cam, cutCam(k)); kick('hit'); }
    go(tp.tKey - PRE + (u < 0.55 ? u / 0.55 * PRE : PRE + (u - 0.55) / 0.45 * POST), dt);
    cam.az += dt * (cam.spin || 0); cam.zoom *= 1 - dt * 0.12;
  }
  // a slow turn round the whole table, then black; false once it is over
  function out(dt, rel) {
    if (r.outAt == null) { r.outAt = rel; r.outT = r.T; big.className = ''; }
    const u = rel - r.outAt; go(r.outT + u * 0.8, dt);
    cam.az += dt * 0.55; cam.el += (0.8 - cam.el) * Math.min(1, dt * 1.5); cam.zoom += (1.02 - cam.zoom) * Math.min(1, dt * 1.6);
    cam.tx += (0 - cam.tx) * Math.min(1, dt * 2); cam.ty += (0 - cam.ty) * Math.min(1, dt * 2);
    if (u > 4 * r.beat) $('#reelFade').classList.add('go');
    return u <= 4 * r.beat + 0.55;
  }

  /* ---- drawing on top of the picture: lines that follow the balls, and the working-out ---- */
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
  function label(x, y, text, col, size) {
    g.font = `600 ${size || r.fs}px Outfit, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = 'rgba(8,10,14,.78)'; g.lineJoin = 'round'; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y);
  }
  function ring(x, y, rad, col, w, dash) {                     // a circle lying on the table
    g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 2 * Math.PI; scene.proj.at(x + Math.cos(a) * rad, y + Math.sin(a) * rad, game.P.R, P2); if (i) g.lineTo(P2[0], P2[1]); else g.moveTo(P2[0], P2[1]); }
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
  const MINT = '#7cffcb', GOLD = '#ffe04a';
  function drawMath() {
    const P = game.P, cueP = r.paths.find(p => p.id === tp.cue), keyP = r.key !== tp.cue ? r.paths.find(p => p.id === r.key) : null, rv = r.reveal;
    // everything else that moves, faintly; then the cue ball's line and the object ball's line as far as they are worked out
    g.setLineDash([]); g.lineJoin = g.lineCap = 'round';
    for (const p of r.paths) if (p !== cueP && p !== keyP) { line(p, 0, rv); g.globalAlpha = 0.4; g.strokeStyle = '#cfd6e2'; g.lineWidth = 1.2; g.stroke(); g.globalAlpha = 1; }
    if (cueP) { line(cueP, 0, rv); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    if (keyP) { line(keyP, tp.tHit, rv); g.strokeStyle = MINT; g.lineWidth = 2; g.stroke(); }
    const tick = (n, i) => { if (!n.seen) { n.seen = r.t; SND.blip(i); } return clamp((r.t - n.seen) / 0.25, 0, 1); };
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
      scene.proj.at(pts[0], pts[1], P.R, P2); label(P2[0], P2[1] + r.fs * 2.1, 'v₀ ' + r.best.V.toFixed(2) + ' m/s', '#fff');
    }
    if (keyP && rv >= tp.tHit) {
      // the cut: the line the cue ball came in on, carried through the object ball, against the line the object ball leaves on
      const a = [0, 0], b = [0, 0], c = [0, 0], q = [0, 0];
      HL.at(tp, r.key, tp.tHit, a); HL.at(tp, r.key, Math.min(tp.dur, tp.tHit + 0.06), b); HL.at(tp, tp.cue, tp.tHit, c); HL.at(tp, tp.cue, Math.max(0, tp.tHit - 0.04), q);
      const din = Math.atan2(c[1] - q[1], c[0] - q[0]), dout = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) {
        if (!r.cutSeen) { r.cutSeen = true; SND.blip(i + 2); }
        ring(c[0], c[1], P.R, '#fff', 1.5, [4, 4]);
        seg(a[0], a[1], a[0] + Math.cos(din) * 0.3, a[1] + Math.sin(din) * 0.3, GOLD, 1.2, [3, 4]);
        angle(a[0], a[1], din, dout, 0.13, GOLD);
      }
      walk(r.nKey, MINT, a[0], a[1], tp.tKey, tp.kx, tp.ky);
    }
    if (rv >= tp.tKey && r.best.key >= 0) {                     // the pocket it is going to
      const k = clamp((r.t - (r.pkSeen || (r.pkSeen = r.t, SND.blip(12), r.t))) / 0.3, 0, 1);
      ring(tp.kx, tp.ky, P.R * (3.2 - 1.4 * k), MINT, 2); seg(tp.kx - 0.09, tp.ky, tp.kx + 0.09, tp.ky, MINT, 1.2); seg(tp.kx, tp.ky - 0.09, tp.kx, tp.ky + 0.09, MINT, 1.2);
    }
    // the ball itself, once struck, lights the line it was given
    if (r.struck && r.T > 0) trails(r.T, 2.4, [tp.cue, r.key]);
  }
  function drawOverlay() {
    const W = app.clientWidth, H = app.clientHeight, k = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * k) || cv.height !== Math.round(H * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, W, H);
    if (!r.style.draw) return;
    r.fs = clamp(Math.min(W, H) / 46, 12, 21); scene.proj.begin(); r.style.draw();
  }

  /* ---- the seven edits. init() says how many seconds pass before the drop; step() is one frame (false = finished) ---- */
  const topAz = () => scene.portrait ? -Math.PI / 2 : 0;
  const STYLES = {
    cuts: {
      name: '컷 편집',
      init() { return INTRO + buildPlan(tp.tKey - HOLD, 0.7); },
      step(dt, since, rel) {
        if (rel < 0) { if (cueUp(since, INTRO)) camIntro(ease(since / INTRO)); else build(since - INTRO, dt); return true; }
        if (!r.dropped) drop(true);
        const k = Math.floor(rel / (2 * r.beat)) - 1;
        if (k < 0) { go(tp.tKey - HOLD * 0.5 + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
        if (k < 3) { cut(k, rel / (2 * r.beat) - 1 - k, dt); return true; }
        return out(dt, rel);
      },
    },
    tracer: {
      name: '궤적',
      init() { Object.assign(cam, { az: topAz() - 0.32, el: 0.92, zoom: 0.94, tx: 0, ty: 0 }); r.w = 3; return 1.5 + buildPlan(tp.tKey - HOLD, 0.5, 5); },
      step(dt, since, rel) {
        r.w += (3 - r.w) * Math.min(1, dt * 5);
        if (rel < 0) {
          cam.az += dt * 0.07; if (cueUp(since, 1.5)) return true;
          const x = since - 1.5; if (x < r.bd) go(x * r.slow, dt); else { app.classList.add('hold'); go(r.roll + clamp((x - r.bd) / r.hd, 0, 1) * HOLD * 0.5, dt); }
          return true;
        }
        if (!r.dropped) { drop(false); r.w = 9; r.T1 = r.T; }
        const lift = rel - 2 * r.beat;
        if (lift < 0) { go(r.T1 + rel, dt); cam.az += dt * 0.07; return true; }
        // the rest of the shot runs out quickly while the camera lifts to look straight down at everything that was drawn
        if (r.T2 == null) { r.T2 = r.T; kick('beat'); }
        go(r.T2 + lift * 2.5, dt); const f = Math.min(1, dt * 2.2);
        cam.az = turnTo(cam.az, topAz(), f); cam.el += (1.5 - cam.el) * f; cam.zoom += (1 - cam.zoom) * f;
        if (lift > 6 * r.beat) $('#reelFade').classList.add('go');
        return lift <= 6 * r.beat + 0.55;
      },
      draw() { trails(r.T, r.w); },
    },
    math: {
      name: '계산',
      init() {
        Object.assign(cam, { az: topAz(), el: 1.5, zoom: 1, tx: 0, ty: 0 }); r.A = Math.max(3.4, 8 * r.beat); r.rate = Math.max(1, tp.tKey / 5); r.reveal = 0;
        r.nCue = nodes(tp.cue, 0, tp.tHit); r.nKey = r.key !== tp.cue ? nodes(r.key, tp.tHit, tp.tKey) : [];
        if (r.key === tp.cue) r.nCue = nodes(tp.cue, 0, tp.tKey);
        return r.A + 0.4 + tp.tKey / r.rate;
      },
      step(dt, since, rel) {
        if (rel < 0) {
          r.reveal = ease(since / r.A) * (tp.tKey + 0.05);
          if (!cueUp(since, r.A + 0.4)) go((since - r.A - 0.4) * r.rate, dt);
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
          if (!r.frozen) { r.frozen = true; app.classList.add('frozen'); kick('hit'); SND.boom(); showBig('💀', 'skull'); }
          go(r.Tf, dt, true); cam.zoom *= 1 - dt * 0.05; cam.tx += (tp.kx - tp.ux * 0.1 - cam.tx) * Math.min(1, dt * 2.5); cam.ty += (tp.ky - tp.uy * 0.1 - cam.ty) * Math.min(1, dt * 2.5);
          return true;
        }
        if (!r.dropped) { drop(false); big.className = 'gone'; }
        const k = rel / (2 * r.beat);
        if (k < 1) { go(r.Tf + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.4; return true; }
        if (k < 2) { cut(0, k - 1, dt); return true; }
        return out(dt, rel);
      },
    },
    velocity: {
      name: '벨로시티',
      init() { r.T0 = Math.max(0, tp.tHit - 0.25); r.seg = (Math.min(tp.dur, tp.tKey + 0.3) - r.T0) / 8; return INTRO + buildPlan(tp.tKey - HOLD, 0.5); },
      step(dt, since, rel) {
        if (rel < 0) { if (cueUp(since, INTRO)) camIntro(ease(since / INTRO)); else build(since - INTRO, dt, 0.3); return true; }
        if (!r.dropped) drop(true);
        const x = rel / r.beat - 2, i = Math.floor(x), u = x - i;
        if (i < 0) { go(tp.tKey - HOLD * 0.5 + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
        if (i >= 8) return out(dt, rel);
        // the shot again in one take: every beat throws time forward, then lets it crawl
        if (r.vi !== i) { r.vi = i; kick(i ? 'beat' : 'hit'); if (!i) { go(r.T0, 0, true); cam.el = 0.4; } }
        const v = 1 - u; go(r.T0 + r.seg * (i + 1 - v * v * v * v), dt);
        chase(dt, 0.4 - 0.1 * v * v, 0.35 + 2.6 * v * v, 9);
        return true;
      },
      on() {},
    },
    combo: {
      name: '콤보',
      init() { r.rate = clamp(tp.tKey / 4, 0.35, 0.8); r.n = 0; r.counting = true; r.lastFx = -1; return INTRO + tp.tKey / r.rate; },
      step(dt, since, rel) {
        if (rel < 0) { if (cueUp(since, INTRO)) camIntro(ease(since / INTRO)); else { go((since - INTRO) * r.rate, dt); chase(dt, 0.5, 0.2); } return true; }
        if (!r.dropped) { go(tp.tKey + 0.001, dt); r.counting = false; drop(true); showBig('×' + (r.n + 1), 'count pop last'); }
        const k = rel / (2 * r.beat);
        if (k < 1) { go(tp.tKey + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
        if (k < 3) { cut(Math.floor(k) - 1, k - Math.floor(k), dt); return true; }
        return out(dt, rel);
      },
      // every knock is counted: a mark where it happened, a note one step higher than the last
      on(e) {
        if (!r.counting || e.t === 'pocket' || e.v < 0.2 || r.t - r.lastFx < 0.07) return;
        r.lastFx = r.t; r.n++; SND.blip(r.n); kick('beat'); showBig('×' + r.n, 'count pop');
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
        app.classList.add('colour'); if (T0 > 0) { r.struck = true; go(T0, 0, true); }
        return r.open + 0.3 + r.RW + r.S + 0.5;
      },
      step(dt, since, rel) {
        if (rel >= 0) {
          if (!r.dropped) drop(true);
          if (rel < 4 * r.beat) { go(tp.tKey - HOLD * 0.5 + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
          return out(dt, rel);
        }
        // as it happened, seen from where someone standing by the table would have filmed it
        if (since < r.open) { cam.az = r.spec.az + Math.sin(r.t * 1.3) * 0.012; cam.el = r.spec.el + Math.sin(r.t * 1.9) * 0.006; if (!cueUp(since, r.I)) go(r.T0 + since - r.I, dt); return true; }
        const y = since - r.open - 0.3;
        if (y < 0) { go(r.Te, dt, true); return true; }
        if (y < r.RW) {                                         // tape running back, the camera coming down to the cloth
          if (!r.rw) { r.rw = true; app.classList.add('rew'); SND.rewind(r.RW); }
          const k = ease(y / r.RW); go(lerp(r.Te, r.Tb, k), dt, true);
          const kb = game.world.balls[r.key], tx = kb.on ? kb.x : tp.kx, ty = kb.on ? kb.y : tp.ky;
          cam.az = turnTo(r.spec.az, r.close.az, k); cam.el = lerp(r.spec.el, r.close.el, k); cam.zoom = lerp(r.spec.zoom, r.close.zoom, k); cam.tx = lerp(0, tx, k); cam.ty = lerp(0, ty, k);
          return true;
        }
        if (r.rw !== 2) { r.rw = 2; app.classList.remove('rew', 'colour'); kick('beat'); }
        const z = y - r.RW;
        if (z < r.S) { go(lerp(r.Tb, tp.tKey - HOLD, z / r.S), dt); chase(dt, 0.34, 0.14); }
        else { app.classList.add('hold'); go(tp.tKey - HOLD + clamp((z - r.S) / 0.5, 0, 1) * HOLD * 0.5, dt); pushIn(dt); }
        return true;
      },
    },
  };
  const IDS = Object.keys(STYLES);
  // every edit comes up once before any comes up again
  function pick() {
    if (!bag.length) { bag = IDS.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), x = bag[i]; bag[i] = bag[j]; bag[j] = x; } if (r0 === bag[bag.length - 1] && bag.length > 1) bag.unshift(bag.pop()); }
    return bag.pop();
  }
  let r0 = null;

  // `style`: one of the edits by name, or nothing for the next one in the shuffle
  function play(best, style) {
    const w = game.world, carom = game.mode && game.mode.table === 'carom';
    tp = HL.record(game.P, w.balls.length, best);
    const id = STYLES[style] ? style : pick(); r0 = id;
    cam = { az: best.aim - Math.PI / 2 + 1.0, el: 1.15, zoom: 1, tx: 0, ty: 0 };
    r = { best, id, style: STYLES[id], t: 0, T: 0, key: best.key >= 0 ? best.key : tp.cue, struck: false, dropped: false, cue: true, pull: 0.03, from: Object.assign({}, cam), paths: [] };
    scene.clearFalls(); HL.restore(w, best.snap); w.snd.length = 0;
    for (let i = 0; i < tp.nb; i++) {
      const pts = HL.path(tp, i);
      if (pts) r.paths.push({ id: i, pts, col: carom ? ['#ffffff', '#ffd23c', '#ff4d43', '#ff4d43'][i] || '#fff' : i === tp.cue ? '#ffffff' : i === 8 ? '#aab1bd' : ballCss(i) });
    }
    const c = w.balls[w.cue]; r.cue0 = [c.x, c.y];
    st.aim = best.aim; st.power = Math.min(1, game.powerOf(best.V)); st.spin = { x: best.a / 0.5, y: best.b / 0.5 };
    const info = SND.song.info; r.beat = 60 / (info ? info.bpm : 140);
    $('#reelFx').textContent = ''; big.className = ''; big.textContent = ''; $('#reel').hidden = false; $('#reelFade').classList.remove('go');
    app.classList.remove(...CLS); app.classList.add('reeling');
    r.lead = r.style.init();                                   // real seconds from now to the drop
    r.song = SND.song.play(r.lead);
    scene.setCam(cam); drawOverlay();
  }
  function stop() {
    if (!r) return; r = null;
    SND.song.stop(); SND.rolling(0); scene.clearFalls();
    $('#reel').hidden = true; app.classList.remove(...CLS); big.className = ''; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    scene.setOrbit(false); d.onEnd();
  }

  // one frame; returns what the scene should show, or null once the reel is over
  function tick(dt) {
    r.t += dt;
    const song = r.song ? SND.song.time() : null, rel = song != null ? song : r.t - r.lead;   // seconds since the drop (negative before)
    if (r.style.step(dt, rel + r.lead, rel) === false) { stop(); return null; }
    scene.setCam(cam); drawOverlay();
    return { alpha: 1, pull: r.pull, cue: r.cue };
  }
  return { play, tick, skip: stop, STYLES: IDS.map(id => [id, STYLES[id].name]), get playing() { return !!r; }, get style() { return r && r.id; } };
}
