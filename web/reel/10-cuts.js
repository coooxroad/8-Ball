STYLES.cuts = {
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
};
