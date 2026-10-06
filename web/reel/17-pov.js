STYLES.pov = {
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
};
