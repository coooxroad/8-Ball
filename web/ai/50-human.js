  /* Person-like planning is independent of the deterministic training levels. See 51-people.js for its three axes.
     Returned preShot keyframes are data for Claude's matching/autoTick integration; this file never touches the UI. */
  function humanPlan(persona) {
    const skill = Math.max(0, Math.min(1, persona.skill)), P = g.P, w = g.world, c = w.balls[w.cue];
    const person = { ...persona, personality: persona.personality || humanPersonalities[0], style: persona.style || humanStyles[0] };
    const style = person.style, character = person.personality, pool = g.mode.table === 'pool', targets = g.mode.legal(g, g.turn).filter(id => w.balls[id] && w.balls[id].on);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), noise = () => { let n = -3; for (let i = 0; i < 6; i++) n += rand(); return n / Math.sqrt(0.5); };
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), candidates = [], ctx = g.mode.ctx(g), me = g.turn;
    const budget = Math.round(10 + 90 * skill * skill); let sims = 0;
    const speed = (x) => clamp(x, g.vOf(0), g.vOf(1));
    const add = (angle, V, id, extra = {}) => {
      const T = w.balls[id], origin = extra.pos ? { x: extra.pos[0], y: extra.pos[1] } : c;
      const d = distance(origin, T), rail = Math.min(P.HL - Math.abs(T.x), P.HW - Math.abs(T.y));
      candidates.push({ pos: null, angle, V: speed(V), a: 0, b: 0, el: 0, target: id, distance: d, cut: 0, difficulty: d * 0.35 + Math.max(0, 0.1 - rail) * 3, rank: d, kind: 'contact', ...extra });
    };
    const nextChance = (world, who, r) => {
      const players = g.players.map(p => ({ ...p }));
      if (r && r.assign) { players[me].group = r.assign; players[1 - me].group = r.assign === 'solid' ? 'stripe' : 'solid'; }
      const view = { ...g, world, players }, cue = world.balls[world.cue];
      if (!cue.on) return 0;
      let best = 0;
      for (const id of g.mode.legal(view, who)) {
        const T = world.balls[id]; if (!T || !T.on) continue;
        if (!pool) { best = Math.max(best, 1 / (1 + distance(cue, T))); continue; }
        for (const p of P.POCKETS) {
          const d = Math.hypot(p.ax - T.x, p.ay - T.y), dx = (p.ax - T.x) / d, dy = (p.ay - T.y) / d;
          const x = T.x - dx * 2 * P.R, y = T.y - dy * 2 * P.R, l = Math.hypot(x - cue.x, y - cue.y);
          const cos = ((x - cue.x) * dx + (y - cue.y) * dy) / Math.max(l, 1e-9);
          if (cos > 0.35 && P.pathClear(world, T.x, T.y, p.ax, p.ay, [world.cue, id]) && P.pathClear(world, cue.x, cue.y, x, y, [world.cue, id])) best = Math.max(best, cos / (1 + d + l));
        }
      }
      return best;
    };
    const simulate = shot => {
      const copy = P.clone(w); if (shot.pos) P.place(copy, copy.cue, ...shot.pos);
      P.strike(copy, shot.angle, shot.V, shot.a, shot.b, shot.el); const ev = P.run(copy, 20); sims++;
      const r = g.mode.evaluate(ev, ctx, { ...g, world: copy });
      const safe = !r.foul && !ev.off.length && r.win !== 1 - me, made = safe && (r.keep || r.pts > 0 || r.win === me);
      let value = r.win === me && safe ? 100 : made ? 10 : safe ? 0 : -12;
      if (made && skill > 0.45) value += 4 * skill * nextChance(copy, me, r);
      if (!made && safe && skill > 0.5) value -= 4 * (style.safety + (1 - character.aggression)) * nextChance(copy, 1 - me, r);
      value += (shot.kind === 'bank' ? style.bank : shot.kind === 'masse' ? style.masse : shot.kind === 'spin' ? style.spin : 0) * 1.8;
      value -= shot.difficulty * (1 - skill) * 0.3;
      return { shot, safe, made, value, ev };
    };
    if (g.isBreak && pool) {
      const y = (rand() - 0.5) * P.HW * 0.7, pos = [-P.HL / 2 - 0.04, y];
      const apex = targets.map(id => w.balls[id]).sort((a, b) => a.x - b.x)[0], angle = Math.atan2(apex.y - y, apex.x - pos[0]);
      const shot = { pos, angle: angle + noise() * (0.001 + (1 - skill) * 0.008), V: g.vOf(clamp(0.72 + skill * 0.18 + style.power * 0.12 + rand() * 0.06, 0, 1)), a: 0, b: 0, el: 0 };
      return { ...shot, ...humanPresentation(shot, person, 0.25), decision: 'break', simulations: 0 };
    }
    const ordered = targets.map(id => w.balls[id]).sort((a, b) => distance(c, a) - distance(c, b));
    if (pool) {
      const rails = [['x', P.HL - P.R], ['x', -P.HL + P.R], ['y', P.HW - P.R], ['y', -P.HW + P.R]];
      for (const T of ordered) for (const pocket of P.POCKETS) {
        const dx0 = pocket.ax - T.x, dy0 = pocket.ay - T.y, dTP = Math.hypot(dx0, dy0), dx = dx0 / dTP, dy = dy0 / dTP;
        if (dx * pocket.nx + dy * pocket.ny < (pocket.corner ? 0.3 : 0.55) || !P.pathClear(w, T.x, T.y, pocket.ax, pocket.ay, [w.cue, T.id])) continue;
        const gx = T.x - dx * 2 * P.R, gy = T.y - dy * 2 * P.R, spots = g.placing ? [] : [null];
        if (g.placing) for (const length of [0.28, 0.48]) for (const da of [0, 0.35, -0.35]) {
          const x = gx - (dx * Math.cos(da) - dy * Math.sin(da)) * length, y = gy - (dx * Math.sin(da) + dy * Math.cos(da)) * length;
          if (P.isFree(w, x, y, w.cue) && (g.placing !== 'kitchen' || x <= -P.HL / 2)) spots.push([x, y]);
        }
        for (const pos of spots) {
          const x = pos ? pos[0] : c.x, y = pos ? pos[1] : c.y, l = Math.hypot(gx - x, gy - y), cos = ((gx - x) * dx + (gy - y) * dy) / Math.max(l, 1e-9);
          if (cos < 0.25) continue;
          const V = speed((1 + 1.5 * Math.sqrt(dTP)) / Math.max(0.4, cos) + 0.9 * Math.sqrt(l)), angle = Math.atan2(gy - y, gx - x), clear = P.pathClear(w, x, y, gx, gy, [w.cue, T.id]);
          const rank = (l * 0.6 + 0.3) * (dTP + 0.25) / (cos * cos);
          if (clear) add(angle, V, T.id, { pos, cut: Math.acos(cos), difficulty: l * 0.35 + (1 - cos) * 1.5, rank, kind: 'pot' });
          if (!clear && g.masse && style.masse > 0.2 && l > 0.4) add(angle, g.vOf(0.9), T.id, { pos, el: 0.7, rank: rank + 0.5, kind: 'masse', difficulty: 1.7 });
          if (!g.placing && skill > 0.2 && style.bank > 0.3) for (const [axis, edge] of rails) {
            const mx = axis === 'x' ? 2 * edge - gx : gx, my = axis === 'y' ? 2 * edge - gy : gy;
            const t = axis === 'x' ? (edge - c.x) / (mx - c.x) : (edge - c.y) / (my - c.y);
            if (!(t > 0.05 && t < 0.95)) continue;
            const bx = c.x + t * (mx - c.x), by = c.y + t * (my - c.y), after = Math.hypot(gx - bx, gy - by);
            if (Math.abs(bx) > P.HL - 0.14 || Math.abs(by) > P.HW - 0.14 || (Math.abs(bx) < 0.13 && axis === 'y')) continue;
            if (((gx - bx) * dx + (gy - by) * dy) / Math.max(after, 1e-9) < 0.35) continue;
            if (!P.pathClear(w, c.x, c.y, bx, by, [w.cue]) || !P.pathClear(w, bx, by, gx, gy, [w.cue, T.id])) continue;
            add(Math.atan2(my - c.y, mx - c.x), V * 1.25, T.id, { rank: rank + 0.5, kind: 'bank', difficulty: 1.5 });
          }
        }
      }
    } else {
      const need = g.modeId === 'three' ? g.cushions : ctx.last ? 1 : 0, L = P.HL - P.R, W = P.HW - P.R;
      for (const T of ordered) {
        const d = distance(c, T), base = Math.atan2(T.y - c.y, T.x - c.x), half = Math.asin(Math.min(0.99, 2 * P.R / d));
        const steps = skill < 0.3 ? 6 : 28;
        for (let i = 0; i <= steps; i++) {
          const f = i === 0 ? 0 : Math.ceil(i / 2) / Math.ceil(steps / 2) * (i % 2 ? 1 : -1), angle = base + half * f * 0.98;
          const h = P.cast(w, c.x, c.y, Math.cos(angle), Math.sin(angle), w.cue); if (h.type !== 'ball' || h.ball !== T.id) continue;
          // Geometric tangent ranking finds plausible caroms before any costly simulation.
          const dot = Math.cos(angle) * h.nx + Math.sin(angle) * h.ny, vx = Math.cos(angle) - dot * h.nx, vy = Math.sin(angle) - dot * h.ny;
          const other = ordered.find(b => b.id !== T.id), ox = other.x - h.gx, oy = other.y - h.gy, cross = Math.abs(ox * vy - oy * vx) / Math.max(Math.hypot(vx, vy), 1e-8), forward = ox * vx + oy * vy;
          add(angle, need ? 4.4 : 2.5, T.id, { rank: cross + (forward < 0 ? 3 : 0) + (need ? 2 : 0), cut: Math.abs(f), difficulty: d * 0.4 + Math.abs(f) * 0.7, kind: 'carom' });
        }
        if (skill > 0.25) for (let ix = -2; ix <= 2; ix++) for (let iy = -2; iy <= 2; iy++) {
          const n = Math.abs(ix) + Math.abs(iy); if (!n || n > Math.max(1, need)) continue;
          const x = 2 * L * ix + (ix % 2 ? -T.x : T.x), y = 2 * W * iy + (iy % 2 ? -T.y : T.y);
          add(Math.atan2(y - c.y, x - c.x), need >= 3 ? 5 : 3.8, T.id, { rank: 0.7 + n * 0.1 - (need ? 0.5 : 0), kind: 'bank', difficulty: 0.8 + n * 0.3 });
        }
        if (g.masse && style.masse > 0.4) for (const side of [-0.6, 0.6]) for (const da of [0.12, 0.25]) add(base - Math.sign(side) * da, 3.2, T.id, { a: side, el: 1.25, rank: 0.8, kind: 'masse', difficulty: 1.8 });
      }
    }
    candidates.sort((a, b) => (a.rank - (a.kind === 'bank' ? style.bank * 0.8 : a.kind === 'masse' ? style.masse * 0.9 : 0)) - (b.rank - (b.kind === 'bank' ? style.bank * 0.8 : b.kind === 'masse' ? style.masse * 0.9 : 0)));
    let best = null, successes = 0;
    const consider = shot => { if (sims >= budget) return; const r = simulate(shot); if (!best || r.value > best.value) best = r; if (r.made) successes++; };
    const visible = skill < 0.3 ? candidates.filter(k => k.target === ordered[0].id && k.kind !== 'bank').slice(0, 2) : candidates;
    for (const k of visible) {
      const mults = skill < 0.3 ? [1] : [1, 0.78, 1.18];
      for (const m of mults) for (const da of skill > 0.6 ? [0, 0.002, -0.002] : [0]) {
        consider({ ...k, angle: k.angle + da, V: speed(k.V * m) });
        if (style.spin > 0.4 && sims < budget - 12) consider({ ...k, angle: k.angle + da, V: speed(k.V * m), a: style.spin * 0.35 * (rand() < 0.5 ? -1 : 1), b: (rand() - 0.5) * style.spin * 0.6, kind: k.kind === 'pot' ? 'spin' : k.kind });
      }
      if (sims >= budget - 12 || successes >= (skill > 0.65 ? 3 : 1)) break;
    }
    // A difficult position has recognizable responses: a deliberate safety, or a thick hit with a full-power release.
    if (!best || !best.made) {
      const T = ordered[0], pos = g.placing ? P.findFree(w, Math.min(T.x - 0.3, g.placing === 'kitchen' ? -P.HL / 2 : P.HL - P.R), T.y, w.cue) : null;
      const x = pos ? pos[0] : c.x, y = pos ? pos[1] : c.y, base = Math.atan2(T.y - y, T.x - x), desperate = rand() < style.desperation * (0.35 + (1 - skill) * 0.65);
      for (const power of desperate ? [1] : [0.22, 0.35, 0.52]) for (const da of [0, 0.02, -0.02]) {
        consider({ pos, angle: base + da, V: g.vOf(power), a: desperate ? (rand() - 0.5) * 1.1 : 0, b: desperate ? (rand() - 0.5) * 0.7 : 0, el: 0, target: T.id, distance: Math.hypot(T.x - x, T.y - y), cut: 0, difficulty: 0.8, rank: 2, kind: desperate ? 'blast' : 'safety' });
      }
      if (!best) best = { shot: { pos, angle: base, V: g.vOf(desperate ? 1 : 0.4), a: 0, b: 0, el: 0, distance: distance(c, T), difficulty: 0.7, kind: desperate ? 'blast' : 'contact' }, made: false };
    }
    const chosen = best.shot, diff = clamp(chosen.difficulty + Math.hypot(chosen.a, chosen.b) * 0.65 + g.powerOf(chosen.V) * 0.25 + chosen.el * 0.4, 0, 2.5);
    const lapse = rand() < 0.012 + character.nerves * (1 - skill) * 0.05;
    const angleError = (0.00035 + Math.pow(1 - skill, 2.4) * 0.014) * (0.6 + diff * 1.7) * (lapse ? 3 : 1);
    const powerError = 0.012 + Math.pow(1 - skill, 2) * 0.22;
    const power = chosen.kind === 'blast' ? 1 : clamp(g.powerOf(chosen.V) * (1 + noise() * powerError) + (1 - skill) * style.power * 0.09, 0, 1);
    const shot = { pos: chosen.pos, angle: chosen.angle + noise() * angleError, V: g.vOf(power), a: chosen.a, b: chosen.b, el: chosen.el };
    return { ...shot, ...humanPresentation(shot, person, diff), decision: chosen.kind, difficulty: diff, simulations: sims };
  }
