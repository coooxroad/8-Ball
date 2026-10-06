STYLES.count = {
  name: '카운트다운',
  init() { r.Tc = Math.max(0, tp.tKey - 0.4); r.C = 3 * r.beat; return INTRO + buildPlan(r.Tc, 0) + r.C; },
  step(dt, since, rel) {
    if (rel < 0) {
      if (cueUp(since, INTRO)) { camIntro(ease(since / INTRO)); return true; }
      const x = since - INTRO;
      if (x < r.bd) { go(x * r.slow, dt); chase(dt, 0.46, 0.16); return true; }
      // three, two, one: a number and a new camera on every beat, the ball crawling the last of the way
      const n = clamp(3 - Math.floor((x - r.bd) / r.beat), 1, 3);
      if (r.cn !== n) { r.cn = n; showBig(String(n), 'num3'); kick('hit'); flash(); SND.thump(); Object.assign(cam, cutCam(3 - n)); cam.zoom *= 1 + 0.25 * (n - 1); $('#reel').style.setProperty('--tint', ['#19e3ff', '#ffd60a', '#ff2d55'][n - 1]); app.classList.add('tinted'); r.rush = 0.6; }
      go(lerp(r.Tc, tp.tKey - 0.04, clamp((x - r.bd) / r.C, 0, 1)), dt); r.rush *= Math.max(0, 1 - dt * 2.5);
      cam.zoom *= 1 - dt * 0.3; cam.az += dt * (cam.spin || 0);
      return true;
    }
    if (!r.dropped) { drop(true); big.className = 'gone'; }
    if (rel < 2 * r.beat) { go(tp.tKey - 0.04 + rel, dt); cam.az += dt * 0.4; return true; }
    return out(dt, rel);
  },
};
