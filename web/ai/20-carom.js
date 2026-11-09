  function aiCarom() {
    const w = g.world, c = w.balls[w.cue], lvl = levelOf(g.turn), ctx = g.mode.ctx(g);
    const need = g.modeId === 'three' ? g.cushions || 0 : 0;       // going round the cushions takes a harder hit
    const nA = [72, 96, 144, 360][lvl], Vs = (need >= 3 ? [[4.6], [4.2, 5.6], [4.2, 5.2, 6.2], [4.0, 5.0, 6.2]] : need ? [[3.4], [2.8, 4.2], [2.8, 4.4], [2.6, 3.6, 4.8]] : [[3], [2.4, 3.8], [2.6, 4.0], [2.2, 3.0, 4.0]])[lvl].map(V => V * PACE.carom), noise = [0.02, 0.009, 0.003, 0][lvl];
    const phase = Math.random() * Math.PI * 2, hit = Vs.map(() => new Array(nA).fill(false)), okay = [];
    const flair = [];                                         // top level: scoring shots it saw, and whether the cue ball went round the cushions to do it
    if (lvl >= 3) {
      const all = []; for (let vi = 0; vi < Vs.length; vi++) for (let i = 0; i < nA; i++) all.push([phase + i * 2 * Math.PI / nA, Vs[vi]]);
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), x = all[i]; all[i] = all[j]; all[j] = x; }
      let fancy = 0; const SPINS = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3], [0.22, 0.22], [-0.22, 0.22]];
      for (let i = 0; i < all.length && fancy < 2 && !(i > 400 && flair.length); i++) {
        // two shots in three are tried with spin: side to either hand, follow or draw
        const sp = SPINS[i % 3 ? 1 + Math.floor(Math.random() * (SPINS.length - 1)) : 0], w2 = g.P.clone(w); g.P.strike(w2, all[i][0], all[i][1], sp[0], sp[1]);
        const r = g.mode.evaluate(g.P.run(w2, 20), ctx, g), railed = w2.ev.railed.includes(w2.cue);
        if (r.pts > 0) { const showy = railed && (sp[0] || sp[1]); flair.push({ angle: all[i][0], V: all[i][1], a: sp[0], b: sp[1], s: (railed ? 3 : 0) + (sp[0] || sp[1] ? 1.5 : 0) + Math.min(3, w2.ev.cushions) * 0.6 + Math.random() }); if (showy) fancy++; }
      }
      // when the raised cue is allowed it likes to use it: a jump straight at a red (40 degrees, hard), or a masse bending in
      // from the side (66 to 77 degrees, soft enough to stay on the cloth)
      if (g.masse && flair.length && Math.random() < 0.6) {
        const trick = (angle, V, a, el) => { const w2 = g.P.clone(w); g.P.strike(w2, angle, V, a, 0, el); const r = g.mode.evaluate(g.P.run(w2, 20), ctx, g); if (r.pts > 0 && !w2.ev.off.length) { flair.push({ angle, V, a, b: 0, el, s: 9 + Math.random() }); return true; } return false; };
        search: for (const id of g.mode.legal(g, g.turn)) { const T = w.balls[id], base = Math.atan2(T.y - c.y, T.x - c.x), far = Math.hypot(T.x - c.x, T.y - c.y);
          if (far > 0.7) for (const da of [0, 0.012, -0.012, 0.024, -0.024]) for (const V of [5.6, 6.6]) if (trick(base + da, V * PACE.carom, 0, 0.7)) break search;
          for (let i = 0; i < 12; i++) { const side = i % 2 ? 0.42 : -0.42; if (trick(base - Math.sign(side) * (0.05 + 0.05 * (i >> 1)), 3.6, side, 1.15 + 0.1 * (i % 3))) break search; } }
      }
      // nothing yet: look again between the angles already tried, at other speeds
      if (!flair.length) again: for (const V of (need >= 3 ? [4.5, 5.6, 6.6] : [2.6, 3.5, 4.6]).map(v => v * PACE.carom)) for (let i = 0; i < 720; i++) {
        const a = phase + (i + 0.5) * Math.PI / 360;
        if (g.mode.evaluate(simShot(a, V), ctx, g).pts > 0) { flair.push({ angle: a, V, s: 0 }); break again; }
      }
    } else for (let vi = 0; vi < Vs.length; vi++) for (let i = 0; i < nA; i++) {
      const a = phase + i * 2 * Math.PI / nA, r = g.mode.evaluate(simShot(a, Vs[vi]), ctx, g);
      if (r.pts > 0) hit[vi][i] = true; else if (!r.foul) okay.push({ angle: a, V: Vs[vi] });
    }
    // the top level takes a shot it has seen score, exactly as it saw it - by way of the cushions when it can
    if (flair.length) { flair.sort((p, q) => q.s - p.s); return { pos: null, angle: flair[0].angle, V: flair[0].V, a: flair[0].a || 0, b: flair[0].b || 0, el: flair[0].el || 0 }; }
    let best = null, bs = -1;
    for (let vi = 0; vi < Vs.length; vi++) for (let i = 0; i < nA; i++) if (hit[vi][i]) {
      let run = 1; for (let k = 1; k < 6 && hit[vi][(i + k) % nA] && hit[vi][(i - k + nA) % nA]; k++) run += 2;
      const s = run + Math.random() * (lvl === 0 ? 3 : 0.5);
      if (s > bs) { bs = s; best = { angle: phase + i * 2 * Math.PI / nA, V: Vs[vi] }; }
    }
    if (!best) {
      // nothing scores: at least hit a red squarely rather than give a point away
      const reds = g.mode.legal(g, g.turn).map(i => w.balls[i]).sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
      for (const T of reds) {
        const a = Math.atan2(T.y - c.y, T.x - c.x), h = g.P.cast(w, c.x, c.y, Math.cos(a), Math.sin(a), w.cue);
        if (h.type === 'ball' && h.ball === T.id) { best = { angle: a, V: 2.2 * PACE.carom }; break; }
      }
    }
    if (!best && okay.length) best = okay[Math.floor(Math.random() * okay.length)];
    if (!best) { const T = w.balls[2]; best = { angle: Math.atan2(T.y - c.y, T.x - c.x), V: 2.8 * PACE.carom }; }
    return { pos: null, angle: best.angle + gauss() * noise, V: best.V };
  }
