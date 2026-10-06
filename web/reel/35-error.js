STYLES.error = {
  name: '오류', worst: true,
  init() { return specInit(3.5, 1); },
  step(dt, since, rel) {
    if (rel < 0) return specStep(dt, since);
    // the game itself cannot take it: the picture breaks up, then a crash screen with a recovery bar
    if (!r.dropped) { moment(); app.classList.remove('frozen'); app.classList.add('glitch'); grade(3); SND.fart(1); }
    if (rel < 0.6) return crash(dt, rel, 0.34);
    if (rel < 3.4) {
      if (!r.bsod) { r.bsod = true; app.classList.remove('glitch'); SND.fart(2); card('bsod', [el('b', { text: ':(' }), el('span', { text: '실력.exe가 응답하지 않습니다' }), el('small', { text: '' })]); }
      cardEl.lastChild.textContent = `오류 코드: ${CODE[r.best.kind] || 'UNKNOWN_SHOT'} · 샷을 복구하는 중… ${Math.min(100, Math.floor((rel - 0.6) / 2.6 * 100))}%`;
      go(tp.tKey, dt, true); return true;
    }
    if (!r.reboot) { r.reboot = true; grade(0); flash(); }
    return encore(dt, rel - 3.4, () => { SND.fart(3); showBig('⚠️', 'skull'); rain(['⚠️', '💩', '🤡'], 26); }, 2.6);
  },
  on() {},
  draw() { if (r.mark && !r.bsod || r.reboot) culprit(); },
};
