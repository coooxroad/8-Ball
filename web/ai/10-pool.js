  /* The top level does not miss. Every shot it thinks of is played out in full first, on a copy of the table, and only one
     that was seen to work is taken - struck exactly as it was tried. Given the choice it shows off: off a cushion into the
     ball, the ball off a cushion into the pocket, one ball into another. It still prefers a shot that leaves it another. */
  function aiShow(cands, targets, speed, good, ctx) {
    const P = g.P, { R, HL, HW, POCKETS } = P, w = g.world, c = w.balls[w.cue], me = g.turn, found = [];
    let sims = 0;
    // is there a plain pot on for the same player, at a ball it will be allowed to hit, once the balls have stopped?
    const leaveOf = w2 => {
      const c2 = w2.balls[w2.cue]; if (!c2.on) return 0;
      let next = targets.filter(t => w2.balls[t].on);
      if (g.modeId === 'nine') { const low = w2.balls.find(b => b.on && b.id !== w2.cue); next = low ? [low.id] : []; }
      else if (!next.length && g.modeId === 'eight') next = [8];
      for (const t of next) { const T = w2.balls[t]; if (!T.on) continue;
        for (const p of POCKETS) {
          let dx = p.ax - T.x, dy = p.ay - T.y; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
          const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R, cx = gx - c2.x, cy = gy - c2.y, cl = Math.hypot(cx, cy);
          if (cl < 1e-4 || (cx * dx + cy * dy) / cl < 0.5) continue;
          if (P.pathClear(w2, T.x, T.y, p.ax, p.ay, [0, T.id]) && P.pathClear(w2, c2.x, c2.y, gx, gy, [0, T.id])) return 1;
        } }
      return 0;
    };
    // a, b: where on the cue ball it is struck (side, and above or below centre). Two balls down in one shot is worth
    // more to it than anything except winning; a shot played with spin is worth a little more than the same shot without.
    const tryShot = (angle, V, pos, flair, a, b, el) => {
      sims++; const w2 = P.clone(w);
      if (pos) { const c2 = w2.balls[w2.cue]; c2.x = c2.px = pos[0]; c2.y = c2.py = pos[1]; }
      P.strike(w2, angle, V, a || 0, b || 0, el || null);   // no angle planned: the ordinary stroke
      const r = g.mode.evaluate(P.run(w2, 20), ctx, g); if (!good(r) || w2.ev.off.length) return false;
      // only its own balls count toward "two at once"; knocking the other player's in for them counts against the shot
      const down = w2.ev.pocketed.filter(q => q.id !== w2.cue), pots = g.modeId === 'nine' ? down.length : down.filter(q => targets.includes(q.id)).length, gift = down.length - pots;
      found.push({ pos: pos || null, angle, V, a: a || 0, b: b || 0, el: el || 0, flair, pots, score: (r.win === me ? 100 : 0) + flair + 7 * Math.max(0, pots - 1) - 3 * gift + (a || b ? 1.5 : 0) + 6 * leaveOf(w2) + Math.random() * 0.8 });
      return true;
    };
    // plain pots, easiest first
    let plain = 0;
    for (const k of cands.slice(0, 14)) {
      let ok = false;
      for (const m of [1, 0.78, 1.3, 0.62]) { for (const da of [0, 0.002, -0.002, 0.005, -0.005]) if (tryShot(k.angle + da, Math.min(6.6, speed(k) * m), k.pos, 0)) { ok = true; break; } if (ok) break; }
      if (ok && ++plain >= (targets.length <= 2 ? 9 : 4)) break;
    }
    if (!g.placing) {
      // the showy ones, worked out with mirrors and then tried a little to either side, because a real cushion is not a mirror
      const rails = [['y', HW - R], ['y', -(HW - R)], ['x', HL - R], ['x', -(HL - R)]], tricks = [];
      const mirror = (x, y, rl) => rl[0] === 'y' ? [x, 2 * rl[1] - y] : [2 * rl[1] - x, y];
      const bounce = (x0, y0, mx, my, rl) => {
        if (rl[0] === 'y') { const t = (rl[1] - y0) / (my - y0); if (!(t > 0.02 && t < 0.98)) return null; const x = x0 + (mx - x0) * t; return Math.abs(x) > HL - 0.17 || Math.abs(x) < 0.14 ? null : [x, rl[1]]; }
        const t = (rl[1] - x0) / (mx - x0); if (!(t > 0.02 && t < 0.98)) return null; const y = y0 + (my - y0) * t; return Math.abs(y) > HW - 0.17 ? null : [rl[1], y];
      };
      const inside = (x, y) => Math.abs(x) < HL - R && Math.abs(y) < HW - R;
      const others = w.balls.filter(b => b.on && b.id !== w.cue).map(b => b.id);
      for (const t of targets) { const T = w.balls[t];
        for (const p of POCKETS) {
          // the ball off a cushion and in
          for (const rl of rails) {
            const m = mirror(p.ax, p.ay, rl), B = bounce(T.x, T.y, m[0], m[1], rl); if (!B) continue;
            let dx = m[0] - T.x, dy = m[1] - T.y; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
            const ix = p.ax - B[0], iy = p.ay - B[1], il = Math.hypot(ix, iy); if ((ix * p.nx + iy * p.ny) / il < 0.45) continue;
            const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R; if (!inside(gx, gy)) continue;
            let cx = gx - c.x, cy = gy - c.y; const cl = Math.hypot(cx, cy); if (cl < 1e-4) continue; cx /= cl; cy /= cl;
            if (cx * dx + cy * dy < 0.45) continue;
            if (!P.pathClear(w, T.x, T.y, B[0], B[1], [0, t]) || !P.pathClear(w, B[0], B[1], p.ax, p.ay, [0, t]) || !P.pathClear(w, c.x, c.y, gx, gy, [0, t])) continue;
            tricks.push({ angle: Math.atan2(cy, cx), len: cl + dl, flair: 3, Vs: [3.2, 4.4], step: 0.005 });
          }
          let dx = p.ax - T.x, dy = p.ay - T.y; const dTP = Math.hypot(dx, dy); dx /= dTP; dy /= dTP;
          if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55) || !P.pathClear(w, T.x, T.y, p.ax, p.ay, [0, t])) continue;
          const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R; if (!inside(gx, gy)) continue;
          // a ball in the way of the cue ball, and jumping allowed: over it (with a house cue a jump is a hard stroke at about 40 degrees)
          if (g.masse) { const jx = gx - c.x, jy = gy - c.y, jl = Math.hypot(jx, jy); if (jl > 0.5 && (jx * dx + jy * dy) / jl > 0.6 && !P.pathClear(w, c.x, c.y, gx, gy, [0, t])) tricks.push({ angle: Math.atan2(jy, jx), len: jl + dTP - 1, flair: 4.5, Vs: [5.4, 6.0, 6.75], step: 0.004, el: 0.7 }); }
          // the cue ball off a cushion first
          for (const rl of rails) {
            const m = mirror(gx, gy, rl), B = bounce(c.x, c.y, m[0], m[1], rl); if (!B) continue;
            const ix = gx - B[0], iy = gy - B[1], il = Math.hypot(ix, iy); if (il < 0.05 || (ix * dx + iy * dy) / il < 0.5) continue;
            if (!P.pathClear(w, c.x, c.y, B[0], B[1], [0]) || !P.pathClear(w, B[0], B[1], gx, gy, [0, t])) continue;
            tricks.push({ angle: Math.atan2(m[1] - c.y, m[0] - c.x), len: Math.hypot(m[0] - c.x, m[1] - c.y) + dTP, flair: 3, Vs: [3.0, 4.2], step: 0.005 });
          }
        }
        // through another ball: the cue ball sends this one into that one, and that one goes in
        for (const o of others) { if (o === t) continue; const O = w.balls[o];
          for (const p of POCKETS) {
            let dx = p.ax - O.x, dy = p.ay - O.y; const dOP = Math.hypot(dx, dy); dx /= dOP; dy /= dOP;
            if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55) || !P.pathClear(w, O.x, O.y, p.ax, p.ay, [0, o])) continue;
            const hx = O.x - dx * 2 * R, hy = O.y - dy * 2 * R; let ex = hx - T.x, ey = hy - T.y; const el = Math.hypot(ex, ey); if (el < 1e-4) continue; ex /= el; ey /= el;
            if (ex * dx + ey * dy < 0.7 || !P.pathClear(w, T.x, T.y, hx, hy, [0, t, o])) continue;
            const gx = T.x - ex * 2 * R, gy = T.y - ey * 2 * R; if (!inside(gx, gy)) continue;
            let cx = gx - c.x, cy = gy - c.y; const cl = Math.hypot(cx, cy); if (cl < 1e-4) continue; cx /= cl; cy /= cl;
            if (cx * ex + cy * ey < 0.7 || !P.pathClear(w, c.x, c.y, gx, gy, [0, t])) continue;
            tricks.push({ angle: Math.atan2(cy, cx), len: cl + el + dOP, flair: 2.5, Vs: [3.4, 4.8], step: 0.002 });
          } }
      }
      tricks.sort((a, b) => a.len - b.len);
      let shown = 0;
      for (const k of tricks) {
        if (sims > 620 || shown >= 3) break;
        let ok = false;
        for (let i = 0; i <= 14 && !ok; i++) { const da = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * k.step; for (const V of k.Vs) if (tryShot(k.angle + da, V, null, k.flair, 0, 0, k.el)) { ok = true; break; } }
        if (ok) shown++;
      }
    }
    if (!g.placing) {
      // where its balls sit in a bunch, hit into them hard: sometimes two go down at once, and it will take that if it sees it
      let bunches = 0;
      for (const t of targets) {
        if (sims > 900 || bunches >= 3) break;
        const T = w.balls[t]; if (!w.balls.some(o => o.on && o.id !== t && o.id !== w.cue && Math.hypot(o.x - T.x, o.y - T.y) < 0.3)) continue;
        bunches++;
        const dd = Math.hypot(T.x - c.x, T.y - c.y), base = Math.atan2(T.y - c.y, T.x - c.x), half = Math.asin(Math.min(1, 2 * R / Math.max(dd, 2 * R))) * 0.9;
        for (let i = 0; i <= 14; i++) { const f = (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 7; for (const V of [5.4, 6.4]) tryShot(base + f * half, V, null, 1.5); }
      }
      // the best few so far, again with spin: side to either hand, follow, draw, and draw with side
      found.sort((p, q) => q.score - p.score);
      for (const k of found.slice(0, 5)) {
        if (sims > 1150) break; if (k.el) continue;
        for (const [a, b] of [[0.3, 0], [-0.3, 0], [0, 0.32], [0, -0.32], [0.22, -0.24], [-0.22, -0.24]]) for (const da of [0, 0.003, -0.003]) if (tryShot(k.angle + da, k.V, k.pos, k.flair, a, b)) break;
      }
    }
    if (!found.length) {
      // nothing obvious: sweep finely across every ball it may hit (from a few places, with the ball in hand), then round the whole clock
      const spots = g.placing ? [[-HL / 2, 0], [0, 0], [HL / 2, 0], [0, HW / 2], [0, -HW / 2]].map(q => P.isFree(w, q[0], q[1], 0) ? q : P.findFree(w, q[0], q[1], 0)) : [null];
      const order = targets.map(t => w.balls[t]);
      sweep: for (const pos of spots) {
        const fx = pos ? pos[0] : c.x, fy = pos ? pos[1] : c.y;
        order.sort((p, q) => Math.hypot(p.x - fx, p.y - fy) - Math.hypot(q.x - fx, q.y - fy));
        for (const T of order) {
          const dd = Math.hypot(T.x - fx, T.y - fy), base = Math.atan2(T.y - fy, T.x - fx), half = Math.asin(Math.min(1, 2 * R / Math.max(dd, 2 * R))) * 0.98;
          for (let i = 0; i <= 44; i++) { const f = (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 22; for (const V of [2.6, 4.2]) if (tryShot(base + f * half, V, pos, 1)) break sweep; }
        }
      }
      if (!found.length && !g.placing) {
        // still nothing: come at each ball off every cushion, sweeping wide because the cushion will not send it quite where a mirror says
        kick: for (const T of order) for (const [ax, v] of [['y', HW - R], ['y', -(HW - R)], ['x', HL - R], ['x', -(HL - R)]]) {
          const mx = ax === 'y' ? T.x : 2 * v - T.x, my = ax === 'y' ? 2 * v - T.y : T.y, base = Math.atan2(my - c.y, mx - c.x);
          for (let i = 0; i <= 40; i++) { const da = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.004; for (const V of [2.6, 3.8, 5]) if (tryShot(base + da, V, null, 3)) break kick; }
        }
      }
      if (!found.length) { const pos = spots[0], ph = Math.random() * 6.283; clock: for (let i = 0; i < 480; i++) for (const V of [3, 4.6]) if (tryShot(ph + i * Math.PI / 240, V, pos, 1)) break clock; }
    }
    if (!found.length) return null;
    found.sort((a, b) => b.score - a.score);
    return { pos: found[0].pos, angle: found[0].angle, V: found[0].V, a: found[0].a, b: found[0].b, el: found[0].el, flair: found[0].flair, pots: found[0].pots };
  }

  function aiPool() {
    const P = g.P, { R, HL, HW, POCKETS } = P, w = g.world, c = w.balls[w.cue], lvl = levelOf(g.turn), me = g.turn;
    const ctx = g.mode.ctx(g), noise = [0.014, 0.0055, 0.0016, 0][lvl];
    if (g.isBreak) {
      const y = (Math.random() - 0.5) * 0.3, pos = [-HL / 2 - 0.1, y];
      return { pos, angle: Math.atan2(-y * 0.92, HL / 2 - pos[0]) + gauss() * 0.003, V: g.vOf(0.94 + Math.random() * 0.06) };
    }
    const verdict = (a, V, pos) => g.mode.evaluate(simShot(a, V, pos), ctx, g);
    const good = r => !r.foul && (r.win == null ? r.keep : r.win === me);
    const safe = r => !r.foul && (r.win == null || r.win === me);
    const targets = g.mode.legal(g, me), cands = [];
    for (const t of targets) for (const p of POCKETS) {
      const T = w.balls[t]; let dx = p.ax - T.x, dy = p.ay - T.y; const dTP = Math.hypot(dx, dy); dx /= dTP; dy /= dTP;
      if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55)) continue;
      if (!P.pathClear(w, T.x, T.y, p.ax, p.ay, [0, t])) continue;
      const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R;
      if (Math.abs(gx) > HL - R || Math.abs(gy) > HW - R) continue;
      const spots = [];
      if (g.placing) {
        for (const dist of [0.32, 0.5, 0.75]) for (const da of [0, 0.3, -0.3, 0.55, -0.55]) {
          const ca = Math.cos(da), sa = Math.sin(da), px = gx - (dx * ca - dy * sa) * dist, py = gy - (dx * sa + dy * ca) * dist;
          if (P.isFree(w, px, py, 0)) spots.push([px, py]);
        }
      } else spots.push([c.x, c.y]);
      for (const s of spots) {
        let cx = gx - s[0], cy = gy - s[1]; const dCG = Math.hypot(cx, cy); if (dCG < 1e-4) continue; cx /= dCG; cy /= dCG;
        const cosc = cx * dx + cy * dy; if (cosc < 0.3) continue;
        if (!P.pathClear(w, s[0], s[1], gx, gy, [0, t])) continue;
        cands.push({ pos: g.placing ? s : null, angle: Math.atan2(cy, cx), cosc, dCG, dTP, score: (dCG * 0.6 + 0.3) * (dTP + 0.25) / (cosc * cosc) * (p.corner ? 1 : 1.15) });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    const speed = k => Math.min(6.4, Math.max(1.3, (1.0 + 1.5 * Math.sqrt(k.dTP)) / Math.max(0.4, k.cosc) + 0.9 * Math.sqrt(k.dCG)));
    if (lvl >= 3) { const show = aiShow(cands, targets, speed, good, ctx); if (show) return show; }
    if (cands.length) {
      let pick = null;
      if (lvl === 0) { const k = cands[Math.min(cands.length - 1, Math.floor(Math.random() * 2))]; pick = { pos: k.pos, angle: k.angle, V: speed(k) }; }
      else {
        const top = cands.slice(0, lvl === 2 ? 10 : 5);
        outer: for (const k of top) for (const m of [1, 0.78, 1.3]) for (const da of [0, 0.003, -0.003]) {
          const V = Math.min(6.6, speed(k) * m);
          if (good(verdict(k.angle + da, V, k.pos))) { pick = { pos: k.pos, angle: k.angle + da, V }; break outer; }
        }
      }
      if (pick) return { pos: pick.pos, angle: pick.angle + gauss() * noise, V: pick.V };
    }
    // No clean pot: play any legal contact, taking a winning or turn-keeping one when it turns up.
    const order = targets.map(t => w.balls[t]).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, 4);
    let firstSafe = null;
    for (const T of order) {
      const spots = [];
      if (g.placing) {
        for (const [ox, oy] of [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]]) if (P.isFree(w, T.x + ox, T.y + oy, 0)) { spots.push([T.x + ox, T.y + oy]); if (spots.length === 2) break; }
        if (!spots.length) spots.push(P.findFree(w, T.x - 0.3, T.y, 0));
      } else spots.push(null);
      for (const pos of spots) {
        const fx = pos ? pos[0] : c.x, fy = pos ? pos[1] : c.y, d = Math.hypot(T.x - fx, T.y - fy);
        const base = Math.atan2(T.y - fy, T.x - fx), half = Math.asin(Math.min(1, 2 * R / Math.max(d, 2 * R))) * 0.9;
        for (const f of [0, 0.35, -0.35, 0.7, -0.7]) for (const V of [2.4, 3.6]) {
          const tr = { pos, angle: base + f * half, V }, r = verdict(tr.angle, V, pos);
          if (good(r)) return { pos, angle: tr.angle + gauss() * noise * 0.5, V };
          if (!firstSafe && safe(r)) firstSafe = tr;
        }
      }
    }
    if (firstSafe) return { pos: firstSafe.pos, angle: firstSafe.angle + gauss() * noise * 0.5, V: firstSafe.V };
    const pos = g.placing ? P.findFree(w, -HL / 2, 0, 0) : null;
    for (let i = 0; i < 120; i++) { const a = i * Math.PI / 60; if (safe(verdict(a, 3, pos))) return { pos, angle: a, V: 3 }; }
    const T = order[0], fx = pos ? pos[0] : c.x, fy = pos ? pos[1] : c.y;
    return { pos, angle: Math.atan2(T.y - fy, T.x - fx), V: 2.6 };
  }
