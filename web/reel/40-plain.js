/* ---- any other highlight: the shot again as it happened, with one easy camera move and nothing added ---- */
STYLES.plain = {
  name: '다시 보기', hidden: true, bare: true, plain: true,
  init() {
    const T0 = r.T0 = Math.max(0, tp.tKey - 4); r.I = T0 > 0 ? 0 : 0.9; app.classList.add('colour');
    Object.assign(cam, { az: topAz() + 0.35, el: 0.72, zoom: 0.96, tx: 0, ty: 0 }); if (T0 > 0) { r.struck = true; go(T0, 0, true); }
    return r.I + (tp.tKey - T0);
  },
  step(dt, since, rel) {
    // from a wide view, drifting round and in toward where it happens
    const k = ease(since / (r.lead + 0.9));
    cam.az = topAz() + 0.35 + 0.55 * k; cam.el = lerp(0.72, 0.5, k); cam.zoom = lerp(0.96, 0.5, k); cam.tx = lerp(0, tp.kx * 0.75, k); cam.ty = lerp(0, tp.ky * 0.75, k);
    if (!cueUp(since, r.I)) go(r.T0 + since - r.I, dt);
    return fadeOut(rel, 1.4);
  },
  on() {},
};
