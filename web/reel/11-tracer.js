STYLES.tracer = {
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
};
