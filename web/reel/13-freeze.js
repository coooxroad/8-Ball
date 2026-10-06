STYLES.freeze = {
  name: '정지',
  init() { r.Tf = Math.max(0, tp.tKey - 0.05); r.F = Math.max(1.1, 2 * r.beat); return INTRO + buildPlan(r.Tf, 0) + r.F; },
  step(dt, since, rel) {
    if (rel < 0) {
      if (cueUp(since, INTRO)) { camIntro(ease(since / INTRO)); return true; }
      const x = since - INTRO;
      if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, 0.16); return true; }
      // the ball is on the lip and the world stops
      if (!r.frozen) { r.frozen = true; app.classList.add('frozen'); kick('hit'); SND.boom(); showBig('💀', 'skull'); r.rush = 0.9; }
      go(r.Tf, dt, true); cam.zoom *= 1 - dt * 0.05; cam.tx += (tp.kx - tp.ux * 0.1 - cam.tx) * Math.min(1, dt * 2.5); cam.ty += (tp.ky - tp.uy * 0.1 - cam.ty) * Math.min(1, dt * 2.5);
      return true;
    }
    if (!r.dropped) { drop(false); big.className = 'gone'; burst(['💀', '💀', '☠️', '💀', '💀', '☠️', '💀']); }
    const k = rel / (2 * r.beat);
    if (k < 1) { go(r.Tf + rel, dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.4; return true; }
    if (k < 2) { cut(0, k - 1, dt, 2); return true; }
    return out(dt, rel);
  },
  beat() { if (r.frozen && !r.dropped) { SND.thump(); kick('beat'); } },
};
