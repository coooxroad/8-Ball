  /* ================= the raised cue: massé and jump (owner 11-19: '대역이랑 봇도 맛세이 가능하게, 리뷰도 맛세이·점프샷') =================
     Bots of every rating played 0 massé and 0 jump in 600-odd shots (11-19, web/tools: four, eight, three; the 맛세이 style
     too): the candidates were there but never seen - a plain line ranked ahead, the 4구 stand-in barred from them. A player
     lifts the cue when the plain ways are shut: Dr. Dave's order for a ball hidden behind another is a kick, a jump, then
     a massé when neither will do; in 4구 a massé is also the way off a red the cue ball is almost touching.
     What this gives is the strokes worth trying, for the caller to play out on the physics (humanPlan's consider, the
     judge's judgeSim) - never a guess at what they do:
       masse - the tip off centre, the cue raised 57-69 degrees, soft: it goes out along the aim and bends away from the
               side struck (struck right, it bends right - measured: el 1.0, a +0.5, 30-50% pace) - so the aim is to the
               other side of the ball by a little, more, much (0.14, 0.26, 0.40 rad), both ways round
       jump  - a pool ball whose straight way to its pocket line is shut by a ball between: the cue raised 34-46 degrees,
               firm (the physics' hop: at 0.6 rad and 80% the ball rises 2 radii - enough over a ball's edge, as Dr. Dave
               shows a half-ball gap needs only 15 degrees with a jump cue), straight at the contact point
     shut(world, cue, x, y, ids): the first ball in the way of a straight stroke there, or null. */
  function raisedShut(world, c, x, y, ids) {
    const P = g.P, dx = x - c.x, dy = y - c.y, L = Math.hypot(dx, dy) || 1;
    const hit = P.cast(world, c.x, c.y, dx / L, dy / L, world.cue);
    if (hit.type !== 'ball' || ids.includes(hit.ball)) return null;
    const b = world.balls[hit.ball], d = Math.hypot(b.x - c.x, b.y - c.y);
    return d < L - P.R ? { id: hit.ball, d } : null;
  }
  // the strokes: { angle, V, a, b, el, target, kind: 'masse'|'jump', difficulty, pocket? } - at most `cap` of them
  function raisedShots(world, who, view, opt = {}) {
    const P = g.P, cue = P.POCKETED ? world.cue : who, c = world.balls[cue], out = [], cap = opt.cap || 16;
    if (!c || !c.on || view.placing) return out;
    const legal = g.mode.legal(view, who).filter(id => world.balls[id] && world.balls[id].on);
    const near = legal.map(id => world.balls[id]).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    const pace = d => g.vOf(Math.max(0.3, Math.min(0.55, 0.3 + 0.18 * d)));
    for (const T of near.slice(0, 3)) {
      if (out.length >= cap) break;
      const d = Math.hypot(T.x - c.x, T.y - c.y);
      // where to meet it: pool - the contact for its best open pocket (the shortest, straightest); carom - its middle
      let gx = T.x, gy = T.y, pocket = null;
      if (P.POCKETED) {
        let best = Infinity;
        for (let k = 0; k < P.POCKETS.length; k++) {
          const p = P.POCKETS[k], L = Math.hypot(p.ax - T.x, p.ay - T.y), ux = (p.ax - T.x) / L, uy = (p.ay - T.y) / L;
          if (ux * p.nx + uy * p.ny < (p.corner ? 0.3 : 0.55) || !P.pathClear(world, T.x, T.y, p.ax, p.ay, [cue, T.id])) continue;
          const x = T.x - ux * 2 * P.R, y = T.y - uy * 2 * P.R, cos = ((x - c.x) * ux + (y - c.y) * uy) / (Math.hypot(x - c.x, y - c.y) || 1);
          const cost = L + Math.hypot(x - c.x, y - c.y) + (1 - cos) * 2; if (cos > 0.2 && cost < best) { best = cost; gx = x; gy = y; pocket = k; }
        }
      }
      const shut = raisedShut(world, c, gx, gy, [T.id]), touching = !P.POCKETED && d < 2 * P.R + 0.05;
      if (!shut && !touching && !opt.all) continue;
      const base = Math.atan2(gy - c.y, gx - c.x);
      // a jump: over the ball in the way, not too close to lift off nor at the target's own side
      if (opt.jump && P.POCKETED && shut && shut.d > 0.1 && shut.d < Math.hypot(gx - c.x, gy - c.y) - 0.12)
        for (const el of [0.6, 0.8]) for (const pw of [0.78, 0.95]) out.push({ pos: null, angle: base, V: g.vOf(pw), a: 0, b: 0, el, target: T.id, pocket, kind: 'jump', difficulty: 1.4 + el * 0.4 });
      if (opt.masse) for (const s of [1, -1]) for (const da of [0.14, 0.26, 0.4])
        out.push({ pos: null, angle: base + s * da, V: pace(d), a: s * 0.5, b: 0, el: 1.0 + (opt.skill || 0.5) * 0.2, target: T.id, pocket, kind: 'masse', difficulty: 1.6 + da });
    }
    return out.slice(0, cap);
  }
