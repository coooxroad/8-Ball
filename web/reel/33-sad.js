STYLES.sad = {
  name: '비극', worst: true,
  init() {
    const T0 = r.T0 = Math.max(0, tp.tKey - 1.8); r.I = T0 > 0 ? 0 : 0.8; r.tear = 0; grade(3); app.classList.add('hold');
    Object.assign(cam, { az: Math.atan2(-tp.ux, tp.uy) + 0.6, el: 0.4, zoom: 0.55, tx: r.cue0[0], ty: r.cue0[1] });
    if (T0 > 0) { r.struck = true; go(T0, 0, true); }
    return r.I + (tp.tKey - T0) / 0.3;
  },
  step(dt, since, rel) {
    const b = game.world.balls[r.key], f = Math.min(1, dt * 2.5);
    cam.tx += ((b.on ? b.x : tp.kx) - cam.tx) * f; cam.ty += ((b.on ? b.y : tp.ky) - cam.ty) * f; cam.zoom *= 1 - dt * 0.035; cam.az += dt * 0.05;
    if (rel < 0) {
      // very slowly, in black and white, as if it mattered
      if (!cueUp(since, r.I)) go(r.T0 + (since - r.I) * 0.3, dt);
      if (r.t > r.tear) { r.tear = r.t + 0.8; emoji(['😭', '💔', '😢'][Math.floor(Math.random() * 3)], app.clientWidth * (0.15 + 0.7 * Math.random()), app.clientHeight * 0.72); }
      return true;
    }
    if (!r.dropped) { r.dropped = true; go(tp.tKey, dt); kick('hit'); SND.fart(2); showBig('🥀', 'skull'); rain(['🫡', '😭', '🕯️'], 18); card('obit', [el('b', { text: r.best.who }), el('span', { text: '의 샷 · 방금 우리 곁을 떠났습니다' })]); }
    go(tp.tKey, dt, true);
    if (rel > 2.6 && !r.squeak) { r.squeak = true; SND.fart(1); kick('beat'); }
    return fadeOut(rel, 4.3);
  },
  on() {},
  draw() { culprit(); },
};
