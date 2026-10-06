STYLES.huh = {
  name: '물음표', worst: true,
  init() { return specInit(3.5, 1); },
  step(dt, since, rel) {
    if (rel < 0) return specStep(dt, since);
    // nobody says anything. Then one question mark, and another, and another, the camera a step closer each time
    if (!r.dropped) { moment(); r.q = 0; }
    if (rel < 3.1) {
      const n = rel < 0.6 ? 0 : rel < 1.2 ? 1 : rel < 1.8 ? 2 : 3;
      if (n !== r.q) { r.q = n; showBig('?'.repeat(n), 'num3 q'); kick('hit'); if (n < 3) SND.thump(); else { SND.fart(1); rain(['❓', '❔'], 22); } }
      return crash(dt, rel, [0.62, 0.46, 0.34, 0.25][r.q]);
    }
    return encore(dt, rel - 3.1, () => { SND.fart(3); showBig('?', 'num3 q'); rain(['❓', '🤡', '❔', '❓'], 30); }, 2.5);
  },
  on() {},
  draw() { if (r.mark) culprit(); },
};
