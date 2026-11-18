  /* ================= the carom leave network (docs/ai-roadmap.md step 5, 11-18) =================
     A carom leave - what the table offers whoever shoots next - can only be found by playing the next shot many ways
     (60-judge.js caromLines), so the judge's own quick look was rough (a few dozen copies). As Stockfish's NNUE learnt its
     evaluation from a slow search, a small network learns the leave from a slow, careful sweep (leaveTeach) over a
     hundred thousand tables (web/tools/net/label.js, on GitHub Actions) and gives it back in microseconds
     (web/tools/net/train.js writes its weights: 55-leave-net-w.js). With no weights for a game, nothing changes.
     What it sees (leaveFeatures): the table turned so the shooter's ball is in one quarter (a table is the same mirrored),
     the balls' places, how far apart each two are, how far each is from its nearest cushion; the two reds of 4구 in order
     of nearness (either may be met first). */
  function leaveFeatures(mode, balls, who, HL, HW) {
    const S = balls[who], fx = S[0] < 0 ? -1 : 1, fy = S[1] < 0 ? -1 : 1, P = b => [b[0] * fx, b[1] * fy];
    const s = P(S), o = P(balls[1 - who]), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) / (2 * HL), rail = b => Math.min(HL - Math.abs(b[0]), HW - Math.abs(b[1])) / HW;
    const pos = b => [b[0] / HL, b[1] / HW];
    if (mode === 'four') {
      let r1 = P(balls[2]), r2 = P(balls[3]); if (d(s, r2) < d(s, r1)) [r1, r2] = [r2, r1];
      return [...pos(s), ...pos(o), ...pos(r1), ...pos(r2), d(s, o), d(s, r1), d(s, r2), d(r1, r2), d(o, r1), d(o, r2), rail(s), rail(o), rail(r1), rail(r2)];
    }
    const r = P(balls[2]);
    return [...pos(s), ...pos(o), ...pos(r), d(s, o), d(s, r), d(o, r), rail(s), rail(o), rail(r)];
  }
  // a forward pass: inputs standardised, hidden layers of ReLU, a sigmoid out
  function netForward(N, x) {
    let a = x.map((v, i) => (v - N.mean[i]) / N.std[i]);
    for (let l = 0; l < N.layers.length; l++) {
      const { w, b, n } = N.layers[l], m = a.length, out = new Array(n), last = l === N.layers.length - 1;
      for (let j = 0; j < n; j++) { let z = b[j]; for (let i = 0; i < m; i++) z += w[j * m + i] * a[i]; out[j] = last ? 1 / (1 + Math.exp(-z)) : z > 0 ? z : 0; }
      a = out;
    }
    return a[0];
  }
  // the leave for whoever shoots next, from the network - or null (no network for this game: the judge sweeps)
  function leaveNet(world, who) {
    const N = typeof LEAVE_NET !== 'undefined' && LEAVE_NET[g.modeId]; if (!N || g.P.POCKETED) return null;
    if (g.modeId === 'three' && (g.cushions || 0) < 3) return null;   // (trained on 3쿠션 only)
    const c = world.balls[who]; if (!c || !c.on) return 0;
    return netForward(N, leaveFeatures(g.modeId, world.balls.map(b => [b.x, b.y]), who, g.P.HL, g.P.HW));
  }
