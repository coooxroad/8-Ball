STYLES.stutter = {
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
};
