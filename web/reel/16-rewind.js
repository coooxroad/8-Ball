STYLES.rewind = {
  name: '되감기',
  init() {
    const T0 = r.T0 = Math.max(0, tp.tKey - 4.5), I = r.I = T0 > 0 ? 0 : 0.7, Te = r.Te = Math.min(tp.dur, tp.tKey + 0.45);
    let Tb = Math.max(T0, tp.tHit - 0.4); if (tp.tKey - Tb < 0.5) Tb = Math.max(T0, tp.tKey - 0.9); r.Tb = Tb;
    r.open = I + (Te - T0); r.RW = clamp((Te - Tb) / 2.5, 0.7, 1.5); r.S = clamp((tp.tKey - HOLD - Tb) / 0.4, 1.6, 4);
    r.spec = { az: topAz() + 0.5, el: 0.6, zoom: 0.92, tx: 0, ty: 0 }; Object.assign(cam, r.spec);
    r.close = { az: Math.atan2(-tp.ux, tp.uy) + 0.5, el: 0.34, zoom: 0.36 };
    app.classList.add('colour'); tag('▶ PLAY'); if (T0 > 0) { r.struck = true; go(T0, 0, true); }
    return r.open + 0.3 + r.RW + r.S + 0.5;
  },
  step(dt, since, rel) {
    if (rel >= 0) {
      if (!r.dropped) { drop(true); tag(''); }
      if (rel < 4 * r.beat) return after(dt, rel);
      return out(dt, rel);
    }
    // as it happened, seen from where someone standing by the table would have filmed it
    if (since < r.open) { cam.az = r.spec.az + Math.sin(r.t * 1.3) * 0.012; cam.el = r.spec.el + Math.sin(r.t * 1.9) * 0.006; if (!cueUp(since, r.I)) go(r.T0 + since - r.I, dt); return true; }
    const y = since - r.open - 0.3;
    if (y < 0) { go(r.Te, dt, true); tag('❚❚'); return true; }
    if (y < r.RW) {                                         // tape running back, the camera coming down to the cloth
      if (!r.rw) { r.rw = true; app.classList.add('rew'); SND.rewind(r.RW); tag('◀◀ REW'); }
      const k = ease(y / r.RW); go(lerp(r.Te, r.Tb, k), dt, true); r.rush = 0.5;
      const kb = game.world.balls[r.key], tx = kb.on ? kb.x : tp.kx, ty = kb.on ? kb.y : tp.ky;
      cam.az = turnTo(r.spec.az, r.close.az, k); cam.el = lerp(r.spec.el, r.close.el, k); cam.zoom = lerp(r.spec.zoom, r.close.zoom, k); cam.tx = lerp(0, tx, k); cam.ty = lerp(0, ty, k);
      return true;
    }
    if (r.rw !== 2) { r.rw = 2; r.rush = 0; app.classList.remove('rew', 'colour'); kick('beat'); flash(); tag('▶ SLOW'); }
    const z = y - r.RW;
    if (z < r.S) { go(lerp(r.Tb, tp.tKey - HOLD, z / r.S), dt); chase(dt, 0.34, 0.14); }
    else { app.classList.add('hold'); r.rush = 0.35; go(tp.tKey - HOLD + clamp((z - r.S) / 0.5, 0, 1) * HOLD * 0.5, dt); pushIn(dt); }
    return true;
  },
};
