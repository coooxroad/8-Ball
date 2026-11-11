  /* Person-like planning is independent of the deterministic training levels. See 51-people.js for its three axes.
     Returned preShot keyframes are data for Claude's matching/autoTick integration; this file never touches the UI. */
  function humanPlan(persona) {
    const person = humanPerson(persona), skill = person.skill, practice = person.practice, turn = humanTurn(person), P = g.P, w = g.world, c = w.balls[w.cue];
    const style = person.style, character = person.personality, pool = g.mode.table === 'pool', targets = g.mode.legal(g, g.turn).filter(id => w.balls[id] && w.balls[id].on);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), noise = () => { let n = -3; for (let i = 0; i < 6; i++) n += rand(); return n / Math.sqrt(0.5); };
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), candidates = [], ctx = g.mode.ctx(g), me = g.turn;
    const ranked = person.version === 3, ordinaryFour = ranked && g.modeId === 'four' && !ctx.last;
    // (ranked: room for weighing how sure each scoring line is - see sure() below)
    const budget = ranked ? Math.round(pool ? 44 + 100 * skill : 56 + 150 * skill) : Math.round(36 + 64 * skill * skill); let sims = 0;   // (a pool simulation costs more)
    const exploreMasse = g.masse && !ordinaryFour && rand() < style.masse * (ranked ? 0.04 + 0.22 * skill : 0.45 + 0.5 * skill);
    const bankChance = ordinaryFour ? 0.025 + 0.82 * practice.bank ** 1.7 + style.bank * 0.18 :
      0.07 + practice.bank * 0.83 + style.bank * 0.16;
    const seeBank = ranked ? rand() < Math.min(0.98, bankChance) : style.bank > 0.3;
    const speed = (x) => clamp(x, g.vOf(0), g.vOf(1));
    const add = (angle, V, id, extra = {}) => {
      const T = w.balls[id], origin = extra.pos ? { x: extra.pos[0], y: extra.pos[1] } : c;
      const d = distance(origin, T), rail = Math.min(P.HL - Math.abs(T.x), P.HW - Math.abs(T.y));
      candidates.push({ pos: null, angle, V: speed(V), a: 0, b: 0, el: 0, target: id, distance: d, cut: 0, difficulty: d * 0.35 + Math.max(0, 0.1 - rail) * 3, rank: d, kind: 'contact', ...extra });
    };
    const nextChance = (world, who, r) => {
      const players = g.players.map(p => ({ ...p }));
      if (r && r.assign) { players[me].group = r.assign; players[1 - me].group = r.assign === 'solid' ? 'stripe' : 'solid'; }
      const view = { ...g, world, players }, cue = world.balls[pool ? world.cue : who];
      if (!cue.on) return 0;
      if (!pool) return humanCaromPosition(world, who);
      let best = 0;
      for (const id of g.mode.legal(view, who)) {
        const T = world.balls[id]; if (!T || !T.on) continue;
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
      if (made) value += (1 + 4 * practice.position + (style.position || 0) * 2 + (style.gather || 0) * 3) * nextChance(copy, me, r) * (ranked ? skill : 1);
      if (!made && safe && skill > 0.5) value -= 4 * (style.safety + (1 - character.aggression)) * nextChance(copy, 1 - me, r);
      value += (shot.kind === 'bank' ? style.bank : shot.kind === 'masse' ? style.masse : shot.kind === 'spin' ? style.spin : 0) * 1.8;
      value += (shot.preference || 0) * 0.65;
      if (made && !pool && style.gather && (!ranked || skill >= 0.52)) {
        const balls = [copy.balls[copy.cue], ...targets.map(id => copy.balls[id])];
        value += 3 / (1 + Math.max(...balls.flatMap(a => balls.map(b => distance(a, b)))) * 3);
      }
      // Do not reward gratuitous force: a comfortable scoring stroke should usually leave the table under control.
      value -= g.powerOf(shot.V) * (0.25 + (1 - style.power) * 0.5);
      value -= shot.difficulty * (1 - skill) * 0.3;
      if (ranked && pool && made) value -= shot.difficulty * (1.2 - 0.6 * skill);
      if (ordinaryFour) {
        value -= (1 - skill) * (Math.min(ev.cushions, 3) * 2.2 + Math.hypot(shot.a, shot.b) * 2);
        if (!made && safe && ev.hits.length) value += 1;
      }
      return { shot, safe, made, value, ev };
    };
    if (g.isBreak && pool) {
      const y = (rand() - 0.5) * P.HW * 0.7, pos = [-P.HL / 2 - 0.04, y];
      const apex = targets.map(id => w.balls[id]).sort((a, b) => a.x - b.x)[0], angle = Math.atan2(apex.y - y, apex.x - pos[0]);
      const shot = { pos, angle: angle + noise() * (0.001 + (1 - skill) * 0.008), V: g.vOf(clamp(0.72 + skill * 0.18 + style.power * 0.12 + rand() * 0.06, 0, 1)), a: 0, b: 0, el: 0 };
      return { ...shot, ...humanPresentation(shot, person, 0.25), decision: 'break', simulations: 0, humanState: turn.state, action: 'play' };
    }
    const spinPractice = ordinaryFour ? skill * skill : g.modeId === 'three' ? 0.25 + skill : 0.10 + skill;
    const trySpin = !ranked || rand() < Math.min(0.97, spinPractice * (0.65 + style.spin * 0.9));
    const ordered = targets.map(id => w.balls[id]).sort((a, b) => distance(c, a) - distance(c, b));
    if (pool) {
      const rails = [['x', P.HL - P.R], ['x', -P.HL + P.R], ['y', P.HW - P.R], ['y', -P.HW + P.R]];
      for (const T of ordered) for (const pocket of P.POCKETS) {
        const dx0 = pocket.ax - T.x, dy0 = pocket.ay - T.y, dTP = Math.hypot(dx0, dy0), dx = dx0 / dTP, dy = dy0 / dTP;
        if (dx * pocket.nx + dy * pocket.ny < (pocket.corner ? 0.3 : 0.55) || !P.pathClear(w, T.x, T.y, pocket.ax, pocket.ay, [w.cue, T.id])) continue;
        const gx = T.x - dx * 2 * P.R, gy = T.y - dy * 2 * P.R, spots = g.placing ? [] : [null];
        if (g.placing) for (const length of [0.28, 0.48]) for (const da of [0, 0.35, -0.35]) {
          const x = gx - (dx * Math.cos(da) - dy * Math.sin(da)) * length, y = gy - (dx * Math.sin(da) + dy * Math.cos(da)) * length;
          if (P.isFree(w, x, y, w.cue) && g.placeOk(x, y)) spots.push([x, y]);
        }
        for (const pos of spots) {
          const x = pos ? pos[0] : c.x, y = pos ? pos[1] : c.y, l = Math.hypot(gx - x, gy - y), cos = ((gx - x) * dx + (gy - y) * dy) / Math.max(l, 1e-9);
          if (cos < (ranked ? 0.6 - skill * 0.37 : 0.25)) continue;
          const V = speed(PACE.pool * ((1 + 1.5 * Math.sqrt(dTP)) / Math.max(0.4, cos) + 0.9 * Math.sqrt(l))), angle = Math.atan2(gy - y, gx - x), clear = P.pathClear(w, x, y, gx, gy, [w.cue, T.id]);
          const rank = (l * 0.6 + 0.3) * (dTP + 0.25) / (cos * cos);
          if (clear) add(angle, V, T.id, { pos, cut: Math.acos(cos), difficulty: l * 0.35 + (1 - cos) * 1.5, rank, kind: 'pot' });
          if (!clear && exploreMasse && l > 0.4) add(angle - 0.12, g.vOf(0.65), T.id, { pos, a: 0.55, el: 1.15, rank: rank + 0.5, kind: 'masse', difficulty: 1.7 });
          if (!g.placing && seeBank) for (const [axis, edge] of rails) {
            const mx = axis === 'x' ? 2 * edge - gx : gx, my = axis === 'y' ? 2 * edge - gy : gy;
            const t = axis === 'x' ? (edge - c.x) / (mx - c.x) : (edge - c.y) / (my - c.y);
            if (!(t > 0.05 && t < 0.95)) continue;
            const bx = c.x + t * (mx - c.x), by = c.y + t * (my - c.y), after = Math.hypot(gx - bx, gy - by);
            if (axis === 'x' ? Math.abs(by) > P.HW - 0.14 : Math.abs(bx) > P.HL - 0.14 || Math.abs(bx) < 0.13) continue;
            if (((gx - bx) * dx + (gy - by) * dy) / Math.max(after, 1e-9) < 0.35) continue;
            if (!P.pathClear(w, c.x, c.y, bx, by, [w.cue]) || !P.pathClear(w, bx, by, gx, gy, [w.cue, T.id])) continue;
            add(Math.atan2(my - c.y, mx - c.x), V * 1.25, T.id, { rank: rank + 0.5, kind: 'bank', route: 'kick', difficulty: 1.5 });
          }
        }
      }
      // A bank pots the object ball off a cushion; a kick sends the cue ball to a cushion first. Search both.
      if (!g.placing && seeBank) for (const T of ordered) for (const pocket of P.POCKETS) for (const [axis, edge] of rails) {
        const mx = axis === 'x' ? 2 * edge - pocket.ax : pocket.ax, my = axis === 'y' ? 2 * edge - pocket.ay : pocket.ay;
        const t = axis === 'x' ? (edge - T.x) / (mx - T.x) : (edge - T.y) / (my - T.y);
        if (!(t > 0.05 && t < 0.95)) continue;
        const bx = T.x + t * (mx - T.x), by = T.y + t * (my - T.y), d = Math.hypot(bx - T.x, by - T.y);
        if (axis === 'x' ? Math.abs(by) > P.HW - 0.15 : Math.abs(bx) > P.HL - 0.15 || Math.abs(bx) < 0.14) continue;
        const ux = (bx - T.x) / d, uy = (by - T.y) / d, gx = T.x - ux * 2 * P.R, gy = T.y - uy * 2 * P.R, l = Math.hypot(gx - c.x, gy - c.y);
        const cos = ((gx - c.x) * ux + (gy - c.y) * uy) / Math.max(l, 1e-9);
        if (cos < 0.35 || !P.pathClear(w, c.x, c.y, gx, gy, [w.cue, T.id]) || !P.pathClear(w, T.x, T.y, bx, by, [w.cue, T.id]) || !P.pathClear(w, bx, by, pocket.ax, pocket.ay, [w.cue, T.id])) continue;
        add(Math.atan2(gy - c.y, gx - c.x), PACE.pool * ((1.3 + 1.5 * Math.sqrt(d + Math.hypot(pocket.ax - bx, pocket.ay - by))) / cos + 0.9 * Math.sqrt(l)), T.id,
          { rank: 0.7 + l * 0.5 + (1 - cos), kind: 'bank', route: 'object-bank', difficulty: 1.5 + (1 - cos) });
      }
    } else {
      const need = g.modeId === 'three' ? g.cushions : ctx.need || 0, L = P.HL - P.R, W = P.HW - P.R;
      for (const T of ordered) {
        const d = distance(c, T), base = Math.atan2(T.y - c.y, T.x - c.x), half = Math.asin(Math.min(0.99, 2 * P.R / d));
        const steps = ordinaryFour ? 12 + 2 * Math.round(10 * skill) : skill < 0.3 ? 14 : 28;
        for (let i = 0; i <= steps; i++) {
          const f = i === 0 ? 0 : Math.ceil(i / 2) / Math.ceil(steps / 2) * (i % 2 ? 1 : -1), angle = base + half * f * 0.98;
          const h = P.cast(w, c.x, c.y, Math.cos(angle), Math.sin(angle), w.cue); if (h.type !== 'ball' || h.ball !== T.id) continue;
          // Geometric tangent ranking finds plausible caroms before any costly simulation.
          const other = ordered.find(b => b.id !== T.id) || w.balls.find(b => b.on && b.id !== w.cue && b.id !== T.id); // In a 3-cushion opening only the red can be hit first.
          let rank = humanCaromRank(h, angle, other, need);
          if (ordinaryFour) rank += (1 - skill) * (d * 0.14 + f * f * 0.16);
          // (4구: firm enough that the cue ball carries on to the second red when the first is not quite as meant - a soft
          // stroke that died after one red was the stand-in's most foolish-looking miss)
          const V = ordinaryFour ? 1.55 + 0.5 * Math.sqrt(d + distance(T, other)) + style.power * 0.25 : (need ? 4.4 : 2.5) * PACE.carom;
          const route = ordinaryFour ? (Math.abs(f) < 0.2 ? 'straight' : 'cut') : 'carom';
          add(angle, V, T.id, { rank, cut: Math.abs(f), difficulty: d * 0.4 + Math.abs(f) * 0.7, kind: 'carom', route });
        }
        if (ranked ? seeBank : skill > 0.25 || style.bank > 0.7) for (let ix = -2; ix <= 2; ix++) for (let iy = -2; iy <= 2; iy++) {
          const n = Math.abs(ix) + Math.abs(iy); if (!n || n > Math.max(1, need)) continue;
          const x = 2 * L * ix + (ix % 2 ? -T.x : T.x), y = 2 * W * iy + (iy % 2 ? -T.y : T.y);
          add(Math.atan2(y - c.y, x - c.x), (need >= 3 ? 5 : 3.8) * PACE.carom, T.id, { rank: 0.7 + n * 0.1 - (need ? 0.5 : 0), kind: 'bank', difficulty: 0.8 + n * 0.3 });
        }
        if (exploreMasse) for (const side of [-0.6, 0.6]) for (const da of [0.12, 0.25]) add(base - Math.sign(side) * da, 3.2 * PACE.carom, T.id, { a: side, el: 1.25, rank: 0.8, kind: 'masse', difficulty: 1.8 });
      }
    }
    /* How sure a scoring line is, for this person (owner 11-10: the stand-in played lines it could not make - one red,
       the pace dying - and missed easy cuts the aim line shows anyone). Their own ordinary miss - the aim and pace error
       they shoot with (below) - is tried both ways; the share that still scores is how sure the line is. A thin cut or a
       long one is a gamble for an unsure hand and nothing to a sure one, so a weak player takes the thick, plain shot and
       a strong one the line that leaves the next. Deterministic: no random numbers. */
    const aimSigma = shot => {
      const diff = clamp(shot.difficulty + Math.hypot(shot.a, shot.b) * 0.65 + g.powerOf(shot.V) * 0.25 + shot.el * 0.4, 0, 2.5);
      return (pool ? 1 : 0.20) * (0.00035 + Math.pow(1 - practice.aim, 2.4) * 0.033) * (0.6 + diff * 1.7);
    };
    const paceSigma = (pool ? 1 : 0.35) * (0.012 + Math.pow(1 - practice.touch, 2) * 0.28);
    const sure = shot => {
      const sa = aimSigma(shot) * 1.4, sp = paceSigma * 1.2; let n = 0, k = 0;
      for (const [da, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (sims >= budget) break;
        const s = simulate({ ...shot, angle: shot.angle + da * sa, V: speed(shot.V * (1 + dv * sp)) }); n++; k += s.made ? 1 : 0;
      }
      return n ? k / n : 0.5;
    };
    const salience = k => k.rank - (k.kind === 'bank' ? style.bank * 0.8 : k.kind === 'masse' ? style.masse * 0.9 : 0);
    // A nearby, obvious route is easy to notice, but two similar lines don't always stand out in the same order.
    if (ranked) for (const k of candidates) {
      k.notice = salience(k) + (rand() - 0.5) * (0.025 + (1 - skill) * 0.16);
    }
    candidates.sort((a, b) => ranked ? a.notice - b.notice : salience(a) - salience(b));
    let best = null, alternative = null;
    const consider = shot => {
      if (sims >= budget) return;
      const r = simulate(shot);
      if (ranked && r.made && r.value < 100) { r.sure = sure(shot); r.value -= (1 - r.sure) * 11; }
      if (ranked) r.value += (rand() - 0.5) * (0.35 + (1 - skill) ** 2 * 3.1) + (shot.kind === 'safety' ? style.safety * 0.8 : 0);
      if (!best || r.value > best.value) { alternative = best; best = r; }
      else if (!alternative || r.value > alternative.value) alternative = r;
    };
    // (everyone sees the plain lines the aim line shows; a better player also sees further ones)
    const visible = ranked ? candidates.slice(0, 7 + Math.round(9 * skill + 2 * rand())) : (skill < 0.3 ? candidates.filter(k => k.target === ordered[0].id && (k.kind !== 'bank' || style.bank > 0.7)) : candidates).slice(0, skill < 0.3 ? 4 : 8);
    if (ordinaryFour && rand() < 1 - skill ** 1.4) {
      // A beginner often looks at the nearby thick hit even when a thin cut looks promising.
      const straight = candidates.find(k => k.target === ordered[0].id && k.route === 'straight');
      if (straight && !visible.includes(straight)) visible[visible.length - 1] = straight;
    }
    const strokes = visible.map(k => humanStrokes(k, person, trySpin));
    // Round-robin routes and stroke families before refining the best one; the first pot must not end all exploration.
    for (let v = 0; v < 7 && sims < budget - 12; v++) for (const options of strokes) {
      if (options[v] && sims < budget - 12) consider(options[v]);
    }
    if (best) {
      const seed = best.shot;
      for (const mult of [0.78, 1.18, 0.55]) for (const da of skill > 0.6 ? [0, 0.002, -0.002] : [0]) {
        if (sims < budget - 9) consider({ ...seed, angle: seed.angle + da, V: speed(seed.V * mult) });
      }
    }
    // A difficult position has recognizable responses: a deliberate safety, or a thick hit with a full-power release.
    // (an ordinary 4구 player with a fair attempt at the points goes for them; the soft touch-and-stay is a good player's
    // choice, not a weak one's - it was the stand-in's 'one red, the pace dying' shot)
    if (!best || !best.made && !(ordinaryFour && best.safe && skill < 0.6)) {
      const T = ordered.find(t => { const angle = Math.atan2(t.y - c.y, t.x - c.x), hit = P.cast(w, c.x, c.y, Math.cos(angle), Math.sin(angle), w.cue); return hit.type === 'ball' && hit.ball === t.id; }) || ordered[0], pos = g.placing ? P.findFree(w, Math.min(T.x - 0.3, g.placing === 'kitchen' ? -P.HL / 2 : P.HL - P.R), T.y, w.cue) : null;
      const x = pos ? pos[0] : c.x, y = pos ? pos[1] : c.y, base = Math.atan2(T.y - y, T.x - x), desperate = rand() < style.desperation * (0.35 + (1 - skill) * 0.65);
      for (const power of desperate ? [1, 0.35, 0.22] : [0.22, 0.35, 0.52]) for (const da of [0, 0.02, -0.02]) {
        const wild = desperate && power === 1 && trySpin;
        consider({ pos, angle: base + da, V: g.vOf(power), a: wild ? (rand() - 0.5) * 1.1 : 0, b: wild ? (rand() - 0.5) * 0.7 : 0, el: 0, target: T.id, distance: Math.hypot(T.x - x, T.y - y), cut: 0, difficulty: 0.8, rank: 2, kind: desperate && power === 1 ? 'blast' : 'safety' });
      }
      if (!best) best = { shot: { pos, angle: base, V: g.vOf(desperate ? 1 : 0.4), a: 0, b: 0, el: 0, distance: distance(c, T), difficulty: 0.7, kind: desperate ? 'blast' : 'contact' }, made: false };
    }
    let chosen = best.shot;
    if (ordinaryFour && g.masse && !best.made && !turn.throwing) chosen = humanFourEscape(c, ordered, person) || chosen;
    if (ordinaryFour && !chosen.a && !chosen.b && !chosen.el && !turn.throwing) {
      // (the habit stays only when the line still scores with it, or by a weak player's lapse - set on after the line was
      // found, it had been turning made lines into misses)
      const tipped = { ...chosen, ...humanHabitTip(person, chosen, best.made) };
      if (tipped.stroke && best.made && sims < budget + 4) { sims++; const keep = simulate(tipped).made || rand() < (1 - skill) * 0.25; if (keep) chosen = tipped; }
      else chosen = tipped;
    }
    if (turn.throwing) {
      const T = ordered[0], base = Math.atan2(T.y - c.y, T.x - c.x);
      chosen = { ...chosen, angle: base + (rand() - 0.5) * 0.35, V: g.vOf(rand() < 0.7 ? 1 : 0.18), a: trySpin ? (rand() - 0.5) * 0.8 : 0, b: trySpin ? (rand() - 0.5) * 0.6 : 0, el: 0, kind: 'throw', route: 'throw' };
    }
    const diff = clamp(chosen.difficulty + Math.hypot(chosen.a, chosen.b) * 0.65 + g.powerOf(chosen.V) * 0.25 + chosen.el * 0.4, 0, 2.5);
    const lapse = rand() < 0.012 + character.nerves * (1 - skill) * 0.05;
    // Carom's scoring window is much narrower than a pocket; motor scatter is scaled separately from shot reading.
    // (nerves: the shot that matters shakes a nervous player's hand a little, less so one with grit)
    const pressure = humanPressure(), shake = 1 + pressure * (character.nerves * 0.9 + (1 - practice.grit) * 0.3) * (1 - skill * 0.5);
    const angleError = (pool ? 1 : ranked ? 0.20 : 0.1) * (0.00035 + Math.pow(1 - practice.aim, 2.4) * 0.033) * (0.6 + diff * 1.7) * (lapse ? 3 : 1) * (1 + turn.tilt * 0.25) * shake;
    const powerError = (pool ? 1 : 0.35) * (0.012 + Math.pow(1 - practice.touch, 2) * 0.28);
    const power = chosen.kind === 'blast' ? 1 : clamp(g.powerOf(chosen.V) * (1 + noise() * powerError) + (chosen.kind === 'masse' && ordinaryFour ? 0 : (1 - skill) * style.power * (pool ? 0.09 : 0.045)), 0, 1);
    const bankError = chosen.kind === 'bank' ? practice.bankBias * (1 - practice.bank) * (pool ? 0.01 : 0.003) : 0;
    const thicknessError = practice.thicknessBias * (1 - practice.aim) * (pool ? 0.003 : 0.0005);
    const spinError = (1 - practice.spin) * 0.045, a = chosen.a * (1 + noise() * spinError), b = chosen.b * (1 + noise() * spinError), spinScale = Math.min(1, 0.79 / Math.max(0.001, Math.hypot(a, b)));
    const guide = ranked && !chosen.el && !turn.throwing ? humanGuideAim(chosen, person, turn.tilt) : [];
    const linedUp = guide.length ? guide[guide.length - 1] : chosen.angle;
    const shot = { pos: chosen.pos, angle: linedUp + noise() * angleError + bankError + thicknessError, V: g.vOf(clamp(power * (1 + practice.paceBias * (1 - practice.touch) * 0.035), 0, 1)), a: a * spinScale, b: b * spinScale, el: chosen.el };
    // A deliberate full-power release remains full power, including for the lower-DAMA strong hitter.
    if (chosen.kind === 'blast') shot.V = g.vOf(1);
    const otherPosition = shot.pos && candidates.find(k => k.pos && Math.hypot(k.pos[0] - shot.pos[0], k.pos[1] - shot.pos[1]) > 0.1);
    const otherLine = ranked && visible.find(k => Math.abs(Math.atan2(Math.sin(k.angle - shot.angle), Math.cos(k.angle - shot.angle))) > 0.06);
    return { ...shot, ...humanPresentation(shot, person, diff, { guide, alternative: otherPosition || otherLine || alternative && alternative.shot, pressure, run: g.players[me].run || 0 }), decision: chosen.kind, stroke: chosen.stroke || 'plain', route: chosen.route || chosen.kind, difficulty: diff, simulations: sims, humanState: turn.state, action: turn.action };
  }
