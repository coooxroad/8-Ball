STYLES.math = {
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
};
