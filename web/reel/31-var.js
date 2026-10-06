STYLES.var = {
  name: 'VAR', worst: true, plain: true,
  init() {
    const T0 = r.T0 = Math.max(0, tp.tKey - 3); r.I = T0 > 0 ? 0 : 0.8; r.L = 1.5;
    Object.assign(cam, { az: topAz(), el: 1.5, zoom: 1, tx: 0, ty: 0 }); tag('● VAR 판독 중');
    if (T0 > 0) { r.struck = true; go(T0, 0, true); }
    return r.I + (tp.tKey - T0) / 0.6;
  },
  step(dt, since, rel) {
    if (rel < 0) { if (!cueUp(since, r.I)) go(r.T0 + (since - r.I) * 0.6, dt); return true; }
    const i = Math.floor(rel / r.L), u = rel / r.L - i, away = Math.atan2(tp.ux, -tp.uy);
    if (i < 3) {
      // the moment itself, three times: stop on it, run it back, run it in again - closer every time
      if (r.li !== i) {
        r.li = i; go(tp.tKey, dt); r.dropped = true; app.classList.add('colour'); kick('hit'); flash(); SND.fart(i); showBig('×' + (i + 1), 'count pop');
        Object.assign(cam, { az: away + Math.PI * (0.5 + 0.6 * i), el: [0.95, 0.55, 0.32][i], zoom: [0.55, 0.38, 0.27][i], tx: tp.kx, ty: tp.ky });
        scene.proj.begin(); if (scene.proj.at(tp.kx, tp.ky, game.P.R, P2)) emoji('❌', P2[0], P2[1]); rain(['💩'], 5 + 4 * i);
      }
      const back = 0.45;
      if (u < 0.3) go(tp.tKey, dt, true); else if (u < 0.62) go(tp.tKey - back * ease((u - 0.3) / 0.32), dt, true); else go(tp.tKey - back * (1 - (u - 0.62) / 0.38), dt);
      app.classList.toggle('rew', u >= 0.3 && u < 0.62); cam.az += dt * 0.15; cam.zoom *= 1 - dt * 0.05;
      return true;
    }
    if (r.li !== 3) { r.li = 3; app.classList.remove('rew', 'colour'); app.classList.add('frozen'); go(tp.tKey, dt); kick('hit'); SND.fart(3); showBig('🤡', 'skull'); rain(['💩', '🤡'], 28); tag('판독 결과: 유죄'); }
    go(tp.tKey, dt, true); cam.zoom *= 1 - dt * 0.04;
    return fadeOut(rel - 3 * r.L, 2.2);
  },
  on() {},
  draw() { for (const p of r.paths) if (p.id === r.key || p.id === tp.cue) { line(p, 0, r.T); g.globalAlpha = 0.8; g.strokeStyle = p.id === r.key ? RED : '#fff'; g.lineWidth = 2; g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; } culprit(); },
};
