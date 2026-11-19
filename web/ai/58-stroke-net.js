  /* ================= the stroke network (owner 11-19 noon: '머신러닝도 하고 ... 최선샷 찾는 것도 잘 해야 해') =================
     A carom line is found by sweeping the aim across a ball with a stroke (60-judge.js caromLines) - so the judge sees only
     the strokes it tries, and a few fixed ones missed the easy line a finer search found (a dense search beat its best in
     4 of 10 3쿠션 tables, web/tools: the regret measure). Which strokes are worth sweeping depends on the table; a small
     network learns it from a slow sweep of every stroke over tens of thousands of tables (web/tools/net/strokes.js, on
     GitHub Actions; web/tools/net/train-strokes.js) and tells the judge, in microseconds, the few strokes most likely to
     score off each ball - the way a player sees "this one is a soft follow". With no weights for a game, nothing changes.
     STROKE_SET: the strokes it knows - pace (times the game's usual) and tip (side a, follow b). */
  const STROKE_SET = {
    four: [0.7, 0.9, 1.1, 1.35].flatMap(v => [[0, 0], [0, 0.3], [0, -0.3], [0.35, 0], [-0.35, 0], [0.3, 0.25], [-0.3, 0.25]].map(([a, b]) => [v, a, b])),
    three: [0.85, 1, 1.2, 1.4].flatMap(v => [[0.45, 0.15], [-0.45, 0.15], [0.45, -0.25], [-0.45, -0.25], [0, 0.3], [0.25, 0], [-0.25, 0]].map(([a, b]) => [v, a, b])),
  };
  // a stroke of the set with its side the other way (a table seen in a mirror plays its strokes mirrored)
  const strokeMirror = mode => STROKE_SET[mode].map(([v, a, b]) => STROKE_SET[mode].findIndex(([v2, a2, b2]) => v2 === v && a2 === -a && b2 === b));
  /* What it sees for one ball to be met first: the table turned so the shooter's ball is in one quarter (flip: whether that
     turned it in a mirror - then its sides are the other way round), the shooter's ball, the ball met first, the others
     (4구: the other red, then the other player's ball; 3쿠션: the third ball), how far apart, how near a cushion. */
  function strokeFeatures(mode, balls, who, first, HL, HW) {
    const S = balls[who], fx = S[0] < 0 ? -1 : 1, fy = S[1] < 0 ? -1 : 1, P = b => b ? [b[0] * fx, b[1] * fy] : null;
    const others = balls.map((b, i) => i).filter(i => i !== who && i !== first);
    if (mode === 'four') others.sort((i, j) => (i < 2) - (j < 2));   // (the other red first, the other player's ball after)
    const s = P(S), t = P(balls[first]), x1 = P(balls[others[0]]), x2 = P(balls[others[1]]);
    const d = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) / (2 * HL) : 0, rail = b => b ? Math.min(HL - Math.abs(b[0]), HW - Math.abs(b[1])) / HW : 0;
    const pos = b => b ? [b[0] / HL, b[1] / HW] : [0, 0], ang = Math.atan2(t[1] - s[1], t[0] - s[0]);
    return { x: [...pos(s), ...pos(t), ...pos(x1), ...pos(x2), d(s, t), d(s, x1), d(t, x1), d(s, x2), d(t, x2), d(x1, x2), rail(s), rail(t), rail(x1), rail(x2), Math.cos(ang), Math.sin(ang)],
      flip: fx * fy < 0 };
  }
  function netForwardAll(N, x) {
    let a = x.map((v, i) => (v - N.mean[i]) / N.std[i]);
    for (let l = 0; l < N.layers.length; l++) {
      const { w, b, n } = N.layers[l], m = a.length, out = new Array(n), last = l === N.layers.length - 1;
      for (let j = 0; j < n; j++) { let z = b[j]; for (let i = 0; i < m; i++) z += w[j * m + i] * a[i]; out[j] = last ? 1 / (1 + Math.exp(-z)) : z > 0 ? z : 0; }
      a = out;
    }
    return a;
  }
  // the strokes most likely to score off ball `first` (indices into STROKE_SET), best first - or null with no network
  function strokeGuess(mode, world, who, first, k) {
    const N = STROKE_NET[mode]; if (!N) return null;
    const f = strokeFeatures(mode, world.balls.map(b => [b.x, b.y]), who, first, g.P.HL, g.P.HW), p = netForwardAll(N, f.x), mir = f.flip ? strokeMirror(mode) : null;
    // (seen in a mirror: the network's stroke i is the table's mirror of it)
    const real = p.map((_, i) => p[mir ? mir[i] : i]);
    return real.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, k).map(([v, i]) => ({ i, p: v }));
  }
