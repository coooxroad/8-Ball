STYLES.strobe = {
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
};
