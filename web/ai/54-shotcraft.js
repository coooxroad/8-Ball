  /* Follow, draw, stun and sidespin are deliberate alternatives even for beginners. Style changes their order;
     simulated outcome and position still decide whether the extra spin is worth using. */
  function humanStrokes(shot, person) {
    if (shot.kind === 'masse') return [shot];
    const s = person.style, side = shot.kind === 'bank' ? 0.32 : 0.24;
    const strokes = [
      { a: 0, b: 0, stroke: 'stun', preference: 0.12 + (s.natural || 0) * 0.6 },
      { a: 0, b: 0.34, stroke: 'follow', preference: 0.15 + (s.follow || 0) * 0.7 + (s.gather || 0) * 0.1 },
      { a: 0, b: -0.32, stroke: 'draw', preference: 0.08 + (s.draw || 0) * 0.7 },
      { a: side, b: 0.12, stroke: 'right', preference: s.spin * 0.3 + (shot.kind === 'bank' ? s.bank * 0.2 : 0) },
      { a: -side, b: 0.12, stroke: 'left', preference: s.spin * 0.3 + (shot.kind === 'bank' ? s.bank * 0.2 : 0) },
    ];
    if (s.spin > 0.55) strokes.push({ a: 0.4, b: -0.25, stroke: 'draw-right', preference: s.spin * 0.25 }, { a: -0.4, b: 0.3, stroke: 'follow-left', preference: s.spin * 0.25 });
    return strokes.sort((a, b) => b.preference - a.preference).map(x => {
      // A route is the intended ball direction. Compensate the cue's resolved deflection when proposing its aim;
      // otherwise every sidespin variant wastes a simulation on missing the same first ball. Motor error is later.
      const v = g.P.launch(shot.V, x.a, x.b, shot.el || 0).velocity;
      return { ...shot, ...x, angle: shot.angle - Math.atan2(v[1], v[0]) };
    });
  }
  function humanCaromPosition(world, who) {
    const cue = world.balls[who], ids = g.mode.legal({ ...g, world }, who), P = g.P;
    if (ids.length !== 2 || !cue.on) return 0;
    const [a, b] = ids.map(id => world.balls[id]), dist = (x, y) => Math.hypot(x.x - y.x, x.y - y.y);
    const da = dist(cue, a), db = dist(cue, b), gap = dist(a, b), cluster = 1 / (1 + 1.8 * (da + db + gap));
    let readable = 0;
    for (const [first, second] of [[a, b], [b, a]]) {
      const d = dist(cue, first), direct = P.pathClear(world, cue.x, cue.y, first.x, first.y, [who, first.id]);
      if (!direct || d < P.R * 2.05) continue;
      const ax = first.x - cue.x, ay = first.y - cue.y, bx = second.x - first.x, by = second.y - first.y;
      const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / Math.max(1e-8, d * dist(first, second)))));
      readable = Math.max(readable, (angle < Math.PI * 0.85 ? 1 : 0.2) / (1 + d + gap));
    }
    const rail = Math.min(P.HL - Math.abs(cue.x), P.HW - Math.abs(cue.y));
    return Math.max(0, cluster * 0.45 + readable * 0.55 - (rail < P.R * 2 ? 0.12 : 0));
  }
  function humanCaromRank(hit, angle, other, need) {
    const P = g.P, dx = Math.cos(angle), dy = Math.sin(angle), dot = dx * hit.nx + dy * hit.ny;
    const tx = dx - dot * hit.nx, ty = dy - dot * hit.ny, sign = Math.sign(dx * ty - dy * tx) || 1;
    const directions = [[tx, ty], [Math.cos(angle + sign * Math.PI / 6), Math.sin(angle + sign * Math.PI / 6)]];
    let best = Infinity;
    const limit = need ? 2 : 0;
    for (let ix = -limit; ix <= limit; ix++) for (let iy = -limit; iy <= limit; iy++) {
      const n = Math.abs(ix) + Math.abs(iy); if (need && (n < Math.max(1, need - 1) || n > need)) continue;
      const x = 2 * (P.HL - P.R) * ix + (ix % 2 ? -other.x : other.x), y = 2 * (P.HW - P.R) * iy + (iy % 2 ? -other.y : other.y);
      const ox = x - hit.gx, oy = y - hit.gy;
      for (const [vx, vy] of directions) {
        const len = Math.max(1e-8, Math.hypot(vx, vy)), forward = ox * vx + oy * vy;
        if (forward <= 0) continue;
        best = Math.min(best, Math.abs(ox * vy - oy * vx) / len + n * 0.035);
      }
    }
    return Number.isFinite(best) ? best : 4;
  }
