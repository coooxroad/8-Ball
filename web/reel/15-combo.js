STYLES.combo = {
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
};
