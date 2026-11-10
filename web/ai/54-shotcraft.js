  /* Style orders the strokes the player considers once they decide to adjust the tip. */
  function humanStrokes(shot, person, trySpin) {
    if (shot.kind === 'masse') return [shot];
    if (!trySpin) return [shot];
    const s = person.style, side = shot.kind === 'bank' ? 0.32 : 0.24;
    const strokes = [
      { a: 0, b: 0, stroke: 'stun', preference: 0.12 + (s.natural || 0) * 0.6 },
      { a: 0, b: 0.34, stroke: 'follow', preference: 0.15 + (s.follow || 0) * 0.7 + (s.gather || 0) * 0.1 },
      { a: 0, b: -0.32, stroke: 'draw', preference: 0.08 + (s.draw || 0) * 0.7 },
      { a: side, b: 0.12, stroke: 'right', preference: s.spin * 0.3 + (shot.kind === 'bank' ? s.bank * 0.2 : 0) },
      { a: -side, b: 0.12, stroke: 'left', preference: s.spin * 0.3 + (shot.kind === 'bank' ? s.bank * 0.2 : 0) },
    ];
    if (s.spin > 0.55) strokes.push({ a: 0.4, b: -0.25, stroke: 'draw-right', preference: s.spin * 0.25 }, { a: -0.4, b: 0.3, stroke: 'follow-left', preference: s.spin * 0.25 });
    return strokes.sort((a, b) => b.preference - a.preference).map(x => ({ ...shot, ...x }));
  }

  function humanHabitTip(person, shot, clearScore) {
    const s = person.style, p = person.practice;
    // Beginners sometimes set the tip out of habit, particularly when the scoring route is unclear.
    const chance = (0.025 + p.spin * 0.10 + s.spin * 0.22) * (1 - (s.natural || 0) * 0.85) * (clearScore ? 0.72 : 1.18);
    if (rand() >= chance) return null;
    const follow = 1.4 + (s.follow || 0) * 4 + (s.gather || 0);
    const draw = 0.7 + (s.draw || 0) * 4;
    const side = 0.3 + s.spin * 1.4 + (shot.kind === 'bank' ? s.bank : 0);
    const pick = rand() * (follow + draw + side), offset = 0.13 + rand() * (0.12 + person.skill * 0.10);
    if (pick < follow) return { a: 0, b: offset, stroke: 'follow' };
    if (pick < follow + draw) return { a: 0, b: -offset, stroke: 'draw' };
    const right = rand() < 0.5 + p.sideBias * 0.35;
    return { a: right ? offset : -offset, b: 0, stroke: right ? 'right' : 'left' };
  }

  function humanGuideAim(shot, person, tilt) {
    const P = g.P, w = shot.pos ? P.clone(g.world) : g.world;
    if (shot.pos) P.place(w, w.cue, ...shot.pos);
    const cue = w.balls[w.cue], wanted = shot.angle, V = g.vOf(0.45);
    // Read the same first-contact marker as the UI's guide before pulling back.
    const line = angle => P.preview(w, angle, V, 0, 0, 0, 0.05);
    const mark = line(wanted), aim = person.practice.aim, p = person.personality;
    const target = mark.hit == null ? null : w.balls[mark.hit];
    const [x, y] = target ? [target.x, target.y] : mark.at || [cue.x + P.HL, cue.y];
    const depth = Math.hypot(x - cue.x, y - cue.y);
    const width = Math.min(0.35, 2 * P.R / Math.max(2 * P.R, depth));
    const thickness = (angle, hit) => ((target.x - hit.at[0]) * Math.sin(angle) - (target.y - hit.at[1]) * Math.cos(angle)) / (2 * P.R);
    const loose = 1 - aim;
    let angle = wanted + (rand() * 2 - 1) * width * (0.45 + loose * 1.35);
    const checks = 1 + Number(rand() < 0.25 + p.hesitation * 0.5 + aim * 0.12) +
      Number(rand() < 0.12 + person.practice.checking * 0.30 + tilt * 0.18);
    const sweep = [angle];
    for (let i = 0; i < checks; i++) {
      const hit = line(angle);
      const correction = target && hit.hit === mark.hit ?
        (thickness(wanted, mark) - thickness(angle, hit)) * width : wanted - angle;
      // (the line on the table is plain to anyone: lining up to it is close even for a beginner - owner 11-10, the stand-in
      // missed easy cuts the guide showed; what a beginner lacks is a sure stroke, the shot's own error in humanPlan)
      const read = (rand() * 2 - 1) * width * (0.002 + loose ** 2 * 0.012);
      angle += correction * (1 + (rand() * 2 - 1) * (0.004 + loose * 0.06)) + read;
      sweep.push(angle);
    }
    return sweep;
  }

  function humanFourEscape(cue, targets, person) {
    const P = g.P, w = g.world, s = person.style, skill = person.skill;
    // A rushed, overhit kick near a cushion can hop the rail under the same rules as a player's stroke.
    const nearRail = Math.min(P.HL - Math.abs(cue.x), P.HW - Math.abs(cue.y)) < 0.23;
    if (nearRail && rand() < 0.025 * s.desperation * (1 - skill)) {
      const T = targets[0], useX = P.HL - Math.abs(cue.x) < P.HW - Math.abs(cue.y);
      const x = useX ? 2 * Math.sign(cue.x) * (P.HL - P.R) - T.x : T.x;
      const y = useX ? T.y : 2 * Math.sign(cue.y) * (P.HW - P.R) - T.y;
      const angle = Math.atan2(y - cue.y, x - cue.x);
      const hit = P.cast(w, cue.x, cue.y, Math.cos(angle), Math.sin(angle), w.cue);
      if (hit.type === 'rail') return { pos: null, angle, V: g.vOf(0.85 + rand() * 0.15), a: 0, b: 0, el: 0.5 + rand() * 0.24, kind: 'overhit-kick', difficulty: 1.5 };
    }
    if (rand() >= s.masse * (0.04 + skill * 0.12)) return null;
    for (const T of targets) {
      const dx = T.x - cue.x, dy = T.y - cue.y, base = Math.atan2(dy, dx);
      const hit = P.cast(w, cue.x, cue.y, Math.cos(base), Math.sin(base), w.cue);
      if (hit.type !== 'ball' || hit.ball !== 1 - g.turn) continue;
      const blocker = w.balls[hit.ball], gap = Math.hypot(blocker.x - cue.x, blocker.y - cue.y);
      if (gap < 3 * P.R || gap > 0.5 || Math.hypot(dx, dy) - gap < 0.18) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const angle = Math.atan2(blocker.y - cue.y, blocker.x - cue.x) + side * (Math.asin(2 * P.R / gap) + 0.10);
      return { pos: null, angle, V: Math.min(g.vOf(1), 1.05 + skill * 0.22), a: side * 0.58, b: 0, el: 0.85 + skill * 0.25, kind: 'masse', difficulty: 1.6 };
    }
    return null;
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
