STYLES.velocity = {
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
};
