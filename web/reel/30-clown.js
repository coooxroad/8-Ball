/* ---- worst shot: no song, and the "drop" is the moment it went wrong ---- */
STYLES.clown = {
  name: '광대', worst: true,
  init() { return specInit(3.5, 1); },
  step(dt, since, rel) {
    if (rel < 0) return specStep(dt, since);
    // it happens: everything stops, the camera crashes in on the culprit
    if (!r.dropped) { moment(); SND.fart(0); showBig('🤡', 'skull'); rain(['💩'], 16); }
    if (rel < 2) return crash(dt, rel, 0.3);
    return encore(dt, rel - 2, () => { SND.fart(3); showBig('🤡', 'skull'); rain(['💩', '🤡', '💩'], 26); });
  },
  on() {},
  draw() { if (r.mark) culprit(); },
};
