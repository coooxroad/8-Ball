STYLES.bullet = {
  name: '불릿 타임',
  init() { r.Tf = Math.max(0, tp.tKey - 0.05); r.F = Math.max(2, 4 * r.beat); return INTRO + buildPlan(r.Tf, 0) + r.F; },
  step(dt, since, rel) {
    if (rel < 0) {
      if (cueUp(since, INTRO)) { camIntro(ease(since / INTRO)); return true; }
      const x = since - INTRO;
      if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, 0.16); return true; }
      // time stops with the ball on the lip, and the camera goes all the way round it
      if (!r.frozen) { r.frozen = true; app.classList.add('hold', 'matrix'); kick('hit'); flash(); SND.boom(); r.c0 = Object.assign({}, cam); const kb = game.world.balls[r.key]; r.bx = kb.on ? kb.x : tp.kx; r.by = kb.on ? kb.y : tp.ky; }
      const k = (x - r.bd) / r.F, e = ease(Math.min(1, k * 4));
      go(r.Tf + k * 0.025, dt, true); r.rush = 0.3;
      cam.az = r.c0.az + 2 * Math.PI * ease(k); cam.el = lerp(r.c0.el, 0.3, e); cam.zoom = lerp(r.c0.zoom, 0.26, e); cam.tx = lerp(r.c0.tx, r.bx, e); cam.ty = lerp(r.c0.ty, r.by, e);
      return true;
    }
    if (!r.dropped) drop(true);
    const k = rel / (2 * r.beat);
    if (k < 1) { go(r.Tf + 0.025 + rel, dt); cam.zoom += (0.32 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; return true; }
    if (k < 2) { cut(2, k - 1, dt, 1); return true; }
    return out(dt, rel);
  },
  beat() { if (r.frozen && !r.dropped) { SND.thump(); kick('beat'); const kb = game.world.balls[r.key]; if (kb.on) shock(kb.x, kb.y, '#bfe9ff', 0.35); } },
};
