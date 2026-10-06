STYLES.news = {
  name: '속보', worst: true,
  init() { return specInit(3.5, 1); },
  step(dt, since, rel) {
    if (rel < 0) return specStep(dt, since);
    if (!r.dropped) {
      moment(); flash(); SND.fart(0); app.classList.remove('frozen'); app.classList.add('colour');
      card('news', [el('i', { text: '속보' }), el('b', { text: `${r.best.who}, ${HEAD[r.best.kind] || '믿기 힘든 샷'}` }),
        el('span', { class: 'tick', text: '목격자 "눈을 의심했다" · 전문가 "일부러 해도 어렵다" · 공 측 "할 말 없다" · 당사자는 연락 두절' })]);
      scene.proj.begin(); if (scene.proj.at(tp.kx, tp.ky, game.P.R, P2)) emoji('📢', P2[0], P2[1]);
    }
    if (rel < 2.4) return crash(dt, rel, 0.36);
    // footage from two more angles, each ending on the moment
    const x = (rel - 2.4) / 1.9, i = Math.floor(x), u = x - i, away = Math.atan2(tp.ux, -tp.uy);
    if (i < 2) {
      if (r.ni !== i) { r.ni = i; go(Math.max(0, tp.tKey - 0.55), 0, true); kick('hit'); flash(); tag(i ? '단독 · 다른 각도' : '현장 화면'); cardEl.firstChild.textContent = i ? '단독' : '속보'; Object.assign(cam, { az: away + (i ? 2 : -1.2), el: i ? 1.25 : 0.34, zoom: i ? 0.3 : 0.32, tx: tp.kx, ty: tp.ky }); }
      go(Math.max(0, tp.tKey - 0.55) + Math.min(1, u * 1.35) * 0.55, dt); cam.az += dt * 0.12; cam.zoom *= 1 - dt * 0.05;
      if (u * 1.35 >= 1 && r.nf !== i) { r.nf = i; SND.fart(1 + i); kick('beat'); }
      return true;
    }
    if (r.ni !== 2) { r.ni = 2; go(tp.tKey, dt); app.classList.remove('colour'); app.classList.add('frozen'); kick('hit'); SND.fart(3); showBig('🤡', 'skull'); rain(['💩', '📰', '🤡'], 26); tag(''); }
    go(tp.tKey, dt, true); cam.zoom *= 1 - dt * 0.04;
    return fadeOut(rel - 2.4 - 3.8, 2);
  },
  on() {},
  draw() { if (r.mark) culprit(); },
};
