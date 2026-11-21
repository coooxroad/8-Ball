/* ================= a win's celebration: confetti and the camera drawing back round the table =================
   Started by the word over the table (50-outro.js start) on a win; each stops itself - the confetti when the last piece
   has fallen, the camera when the result is left (or the game screen is back without the word). */
/* Confetti (a win - owner 11-21, as a table-tennis game's): paper squares of every colour bursting up from behind the word,
   then raining from the top for a while, each tumbling (its face turning to the light and away), swaying as it falls and
   slowed by the air. Drawn on a canvas over the table and under everything else (after #gl); gone when the last has fallen. */
const confetti = {
  cv: null, raf: 0,
  start() {
    confetti.stop();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = confetti.cv = el('canvas', { id: 'confetti', 'aria-hidden': 'true' }); $('#gl').after(cv);
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const C = ['#ff3b5c', '#ffd23f', '#35d06d', '#2fb6ff', '#9b5cff', '#ff8a1f', '#ff5fd2', '#ffffff', '#3bf0e0'];
    const s = Math.max(0.75, Math.min(1.5, Math.min(W, H) / 560)), P = [], R = Math.random;
    const add = (x, y, vx, vy) => P.push({ x, y, vx, vy, r: R() * 6.28, vr: (R() - 0.5) * 10, f: R() * 6.28, vf: 5 + R() * 9, w: (5 + R() * 4) * s, h: (8 + R() * 7) * s, c: C[R() * C.length | 0], sw: (0.5 + R()) * 36 * s, sp: R() * 6.28 });
    for (let i = 0; i < 120; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 2.6, v = (420 + R() * 720) * s; add(W / 2 + (R() - 0.5) * W * 0.24, H * 0.47 + (R() - 0.5) * 30, Math.cos(a) * v, Math.sin(a) * v); }
    const t0 = performance.now(); let last = t0, rain = 0;
    const step = () => {
      if (!confetti.cv) return;
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      if (t < 2.4) { rain += dt * 75; while (rain >= 1) { rain--; add(R() * W, -20, (R() - 0.5) * 90 * s, (60 + R() * 140) * s); } }
      g.clearRect(0, 0, W, H);
      for (let i = P.length - 1; i >= 0; i--) {
        const q = P[i];
        q.vy += 760 * s * dt; q.vx *= Math.exp(-2.4 * dt); q.vy *= Math.exp(-1.7 * dt);
        q.f += q.vf * dt; q.r += q.vr * dt; q.sp += dt * 2.2;
        q.x += (q.vx + Math.sin(q.sp) * q.sw) * dt; q.y += q.vy * dt;
        if (q.y > H + 40 || q.x < -60 || q.x > W + 60) { P.splice(i, 1); continue; }
        const k = Math.cos(q.f);
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(q.x, q.y); g.rotate(q.r); g.scale(1, k);
        g.fillStyle = q.c; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        if (Math.abs(k) < 0.6) { g.fillStyle = `rgba(0,0,0,${(0.6 - Math.abs(k)) * 0.5})`; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); }   // (turned away from the light)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (P.length || t < 2.4) confetti.raf = requestAnimationFrame(step); else confetti.stop();
    };
    confetti.raf = requestAnimationFrame(step);
  },
  stop() { cancelAnimationFrame(confetti.raf); if (confetti.cv) { confetti.cv.remove(); confetti.cv = null; } },
};
/* The camera at a win (owner 11-21: "뒤로 빠지게, 마인크래프트 시네마틱 카메라처럼" - and then: smooth, not in steps nor at an
   even speed). Where it wants to be glides out from overhead - down, back and round the table, quickly at first and
   settling, then drifting on round slowly - and the camera follows that on a critically damped spring, so it gathers
   speed and loses it as a hand-held glide would, never starting, stopping or turning at once. Moved once a frame from
   the game's own loop, before the frame is drawn (90-loop.js), so each frame shows the camera where that frame put it.
   Leaving the result (a new game, home, the review) puts the player's own view back (70-buttons.js viewBack). */
const winCam = {
  on: false, t: 0, watch: 0, pose: null, vel: null,
  start() {
    winCam.stop(true); if (!scene.setCam || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    winCam.on = true; winCam.t0 = performance.now(); winCam.last = winCam.t0; winCam.turn = app.classList.contains('portrait') ? -Math.PI / 2 : 0;
    winCam.pose = { az: 0, el: 1.42, zoom: 1 }; winCam.vel = { az: 0, el: 0, zoom: 0 };
    winCam.watch = setInterval(() => { if (!(st.screen === 'play' || st.screen === 'result') || review.on || (st.screen === 'play' && !outro.on)) winCam.stop(); }, 250);
  },
  // a frame (90-loop.js, before the scene is drawn): dt in seconds
  tick() {
    if (!winCam.on) return;
    // (the clock's own time, not the frame's capped step: a slow frame does not slow the glide - the spring is stepped
    // in small steps up to now, so it stays smooth whatever the frame rate)
    const now = performance.now(), w = 2.4, p = winCam.pose, v = winCam.vel;
    let left = Math.min(0.25, (now - winCam.last) / 1000); winCam.last = now;
    while (left > 1e-4) {
      const h = Math.min(1 / 120, left), t = (now - winCam.t0) / 1000 - (left - h), drift = Math.min(t, 24);   // (the slow drift round stops after a while)
      const to = { az: 0.55 * (1 - Math.exp(-t / 1.7)) + 0.022 * drift, el: 1.42 - 0.68 * (1 - Math.exp(-t / 1.5)), zoom: 1 + 0.17 * (1 - Math.exp(-t / 1.9)) };
      for (const k in p) { const a = w * w * (to[k] - p[k]) - 2 * w * v[k]; v[k] += a * h; p[k] += v[k] * h; }   // (critically damped: no overshoot)
      left -= h;
    }
    scene.setCam({ az: winCam.turn + p.az, el: p.el, zoom: p.zoom, tx: 0, ty: 0 });
  },
  stop(quiet) {
    clearInterval(winCam.watch);
    if (!winCam.on) return; winCam.on = false;
    if (!quiet) viewBack();
  },
};
