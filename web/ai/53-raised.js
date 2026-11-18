  /* ================= the raised cue: massé and jump (owner 11-19: '대역이랑 봇도 맛세이 가능하게, 리뷰도 맛세이·점프샷') =================
     Bots of every rating played 0 massé and 0 jump in 600-odd shots (11-19, web/tools: four, eight, three; the 맛세이 style
     too): the candidates were there but never seen - a plain line ranked ahead, the 4구 stand-in barred from them. A player
     lifts the cue when the plain ways are shut: Dr. Dave's order for a ball hidden behind another is a kick, a jump, then
     a massé when neither will do; in 4구 a massé is also the way off a red the cue ball is almost touching.
     What this gives is the strokes worth trying, for the caller to play out on the physics (humanPlan's consider, the
     judge's judgeSim) - never a guess at what they do:
       masse - the tip off centre, the cue raised 54-72 degrees: it goes out along the aim and bends away to the side struck
               (struck right, it bends right); aimed by its curve, played once on an empty cloth (masseAims, below) - for
               a pot round the ball in the way, for a carom at its first ball, a few thicknesses
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
    for (const T of near.slice(0, 3)) {
      if (!opt.masse && out.length >= cap) break;
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
      if (opt.masse) out.push(...masseAims(world, c, T, gx, gy, pocket, opt));
    }
    return opt.masse ? masseOrder(out, cap) : out.slice(0, cap);
  }
  /* The massé's aim, from its curve (owner 11-19 night: '레아가 맛세이를 안 쳐'). The old aim - a fixed 8, 15 or 23 degrees to
     one side of the ball at one pace - scored in none of 25 random 4구 layouts, where a fine sweep of aims found a scoring
     massé in every one (some 46 each); so the plain line always won, and 3쿠션 played massés that could not score.
     A massé's way to its first ball is the cue ball's alone, the same wherever it starts: each stroke (the cue raised 54-72
     degrees, the tip a third to three-quarters off, soft to firm) is played once on an empty cloth and its path kept
     (masseCurves - made the first time, per table and cloth), and the aim is the turn of that path that runs it through the
     point it must meet the ball at: for a pot, the contact point; for a carom, its first ball at a few thicknesses. The path
     is then walked - on the cloth, clear of the other balls, still running when it gets there - and the caller plays the
     rest out on the physics. */
  const masseCurveCache = {};
  function masseCurves(world) {
    const P = g.P, key = P.KIND + (world.ice ? ':ice' : '') + (world.real ? ':' + JSON.stringify(world.real) : '');
    if (masseCurveCache[key]) return masseCurveCache[key];
    const curves = [];
    for (const el of [0.95, 1.1, 1.25]) for (const a of [0.35, 0.55, 0.75]) for (const pw of [0.2, 0.3, 0.42, 0.56]) {
      const w = P.clone(world); w.walls = P.makeWorld(0).walls; w.shape = null;
      for (const b of w.balls) if (b.id !== w.cue) b.on = false;
      // (struck +a it bends to the right of its aim: started by the left cushion and aimed along it, the whole cloth to bend over)
      const c = w.balls[w.cue], x0 = -P.HL + P.R + 0.03, y0 = P.HW - P.R - 0.03; c.x = c.px = x0; c.y = c.py = y0; c.on = true;
      P.strike(w, 0, g.vOf(pw), a, 0, el);
      const pts = [0, 0, Math.hypot(c.vx, c.vy)];
      for (let t = 0; t < 14 && !P.rest(w) && !w.ev.cushions && !w.ev.rail; t += 1 / 120) { P.step(w, 1 / 120); pts.push(c.x - x0, y0 - c.y, Math.hypot(c.vx, c.vy)); }
      curves.push({ el, a, pw, V: g.vOf(pw), pts });
    }
    return (masseCurveCache[key] = curves);
  }
  // where a curve (in its own frame: along the aim, and to the side it bends) first is `D` from its start
  function curveAt(C, D) {
    const p = C.pts;
    for (let i = 3; i < p.length; i += 3) {
      const r1 = Math.hypot(p[i], p[i + 1]); if (r1 < D) continue;
      const r0 = Math.hypot(p[i - 3], p[i - 2]), u = r1 > r0 ? (D - r0) / (r1 - r0) : 1;
      return { f: p[i - 3] + (p[i] - p[i - 3]) * u, l: p[i - 2] + (p[i + 1] - p[i - 2]) * u, head: Math.atan2(p[i + 1] - p[i - 2], p[i] - p[i - 3]), v: p[i - 1] + (p[i + 2] - p[i - 1]) * u, i };
    }
    return null;
  }
  // the aim that sends curve C, struck on side s (+1 right, -1 left), from c through (x, y) - with its heading and pace there
  function curveAim(C, s, c, x, y) {
    const D = Math.hypot(x - c.x, y - c.y), at = curveAt(C, D); if (!at) return null;
    const ang = Math.atan2(y - c.y, x - c.x) + s * Math.atan2(at.l, at.f);
    return { ang, head: ang - s * at.head, v: at.v, i: at.i };
  }
  // the path up to sample i, turned to `ang`: on the cloth, clear of every ball (its own target's but for the last few cm)
  function curveClear(world, C, s, c, ang, i, skip) {
    const P = g.P, p = C.pts, ca = Math.cos(ang), sa = Math.sin(ang), lx = P.HL - P.R, ly = P.HW - P.R;
    for (let k = 3; k < i; k += 6) {
      const x = c.x + p[k] * ca + s * p[k + 1] * sa, y = c.y + p[k] * sa - s * p[k + 1] * ca;
      if (Math.abs(x) > lx || Math.abs(y) > ly) return false;
      for (const b of world.balls) if (b.on && b.id !== world.cue && Math.hypot(b.x - x, b.y - y) < 2 * P.R + 0.004 && (b.id !== skip || k < i - 9)) return false;
    }
    return true;
  }
  function masseAims(world, c, T, gx, gy, pocket, opt) {
    const P = g.P, out = [], carom = !P.POCKETED;
    const others = carom ? world.balls.filter(b => b.on && b.id !== world.cue && b.id !== T.id) : [];
    for (const C of masseCurves(world)) for (const s of [1, -1]) {
      if (C.el > 1.0 + (opt.skill == null ? 0.5 : opt.skill) * 0.3) continue;   // (the steepest only for a sure hand)
      for (const f of carom ? [-0.6, -0.3, 0, 0.3, 0.6] : [null]) {
        // (a carom's meeting point moves with the heading it arrives on: found by turning twice)
        let x = gx, y = gy, aim = curveAim(C, s, c, x, y);
        if (f != null) for (let k = 0; k < 2 && aim; k++) {
          const hx = Math.cos(aim.head), hy = Math.sin(aim.head), q = Math.sqrt(1 - f * f);
          x = T.x - 2 * P.R * (q * hx - f * hy); y = T.y - 2 * P.R * (q * hy + f * hx); aim = curveAim(C, s, c, x, y);
        }
        if (!aim || aim.v < (carom ? 0.45 : 0.3) || !curveClear(world, C, s, c, aim.ang, aim.i, T.id)) continue;
        // (carom: likelier where the cue ball leaves the ball - along the tangent, bending on - towards the other ball)
        let after = 0;
        if (f != null && others.length) {
          const off = aim.head + (f >= 0 ? -1 : 1) * (Math.PI / 2 - Math.asin(Math.abs(f))) + s * 0.25;
          after = Math.min(...others.map(o => { const d = Math.atan2(o.y - y, o.x - x) - off; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); }));
        }
        out.push({ pos: null, angle: aim.ang, V: C.V, a: s * C.a, b: 0, el: C.el, target: T.id, pocket, kind: 'masse',
          difficulty: 1.4 + (C.el - 0.95) + C.a * 0.4, order: after + C.el * 0.3 + C.a * 0.3 + (f ? Math.abs(f) * 0.2 : 0) });
      }
    }
    return out;
  }
  // the likeliest first, and not all of one stroke: the best of each ball and side in turn (the jumps keep a third)
  function masseOrder(list, cap) {
    const jumps = list.filter(k => k.kind !== 'masse'), groups = new Map(), out = [];
    for (const k of list.filter(k => k.kind === 'masse').sort((a, b) => a.order - b.order)) {
      const key = k.target + ':' + Math.sign(k.a); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(k);
    }
    const lists = [...groups.values()];
    for (let i = 0; out.length < cap && lists.some(l => l.length > i); i++) for (const l of lists) if (l[i] && out.length < cap) out.push(l[i]);
    return [...jumps.slice(0, Math.ceil(cap / 3)), ...out].slice(0, cap);
  }
