  /* ================= the shot judge (owner 11-17 night: 'the base of the game') =================
     How good a shot was, measured - not guessed. Everything here rests on one number: the chance that a shot comes off
     for one fixed hand, the reference hand (JUDGE.SIG_*: how far its aim, pace and tip stray). The owner's rule: no
     allowance for beginners - a shot is as hard as it is, for everyone. (As PickPocket and pooltool measure a shot: play
     it many times with that hand's wobble, count the share that succeeds.)
       a line     - one way to succeed: a ball and a pocket (pool), a first ball and a stroke (carom), and how wide the
                    window of aim is that makes it - its chance for the reference hand (erf of half the window over its aim
                    spread; pool: worked out from the geometry, carom: found by sweeping the aim on copies of the table)
       a leave    - what a table offers whoever shoots next: its three best lines, 1 : 0.33 : 0.15 (PickPocket), 0..1
       a result's worth - the shooter's chance to win the frame after it (59-win.js, 11-18 - as chess.com's expected
                    points): made, with the leave for me at the table; not made, the other at it with theirs; won 1, lost 0
       best (B)   - the most a shot here could be expected to bring: the lines on the table, each with a few strokes,
                    its expected worth for the reference hand (pool: refined by sampling the hand's wobble)
       the shot   - what it did bring (A); the grade is from B - A (as chess.com grades by the expected points lost):
                    an easy ball missed loses most, a hard one missed little; one made that leaves nothing loses some.
     And beyond the grade, what a coach would say:
       intent     - the nearest success to what was played: the aim (then the pace) moved, in steps of the reference
                    hand, until it comes off - the line the player meant; how far off and which way says why it missed
                    (the aim - thick or thin -, the pace, the tip)
       예술        - made as meant, a hard line (its chance small for the game), leaving a good next shot, and worth at
                    least the best expected (owner: an easy way left aside for a hard one made with the next shot set is
                    예술; 예술 with a poor leave is not)
       요행 (fluke) - made, but not as a line: through a kiss or another ball, and not to be made again - a mark beside the
                    grade, not a grade (owner 11-17)
     judgeShot(played) is the whole of it (the review, through the Worker); the numbers inside (예술 점수, 실용성) are
     never shown - only the grade, the marks and the words (owner 11-17). The bots will choose with it too (next). */
  const JUDGE = {
    SIG_A: 0.0028,      // the reference hand's aim, radians (one sigma)
    SIG_V: 0.05,        // its pace, a share of the speed
    SIG_S: 0.05,        // its tip, in the -1..1 of a, b
    RAISED: 2.2,        // its aim and tip with the cue raised past 17 degrees (a massé, a jump): so much the less sure (11-19)
    TOP: [1, 0.33, 0.15],
    // the grade from B - A (chances to win lost), by game: [좋음, 무난, 아쉬움] upper bounds (above the last: 실수) - set
    // (11-18) so that bots' misses grade as they did in the old units (tools/judge-games.js, 60-odd misses a game)
    CUTS: { pool: [0.008, 0.02, 0.05], snooker: [0.008, 0.02, 0.05], four: [0.01, 0.06, 0.09], three: [0.01, 0.07, 0.15] },
    // (a shot near the best, for the other ways shown, and a better shot worth showing: shares of what the table is worth
    // to whoever is at it - the swing - so that they mean the same at 0 - 0 and at match ball)
    NEAR: 0.3, BETTER: 0.15,
    // a line this hard or harder for the reference hand is a hard one (예술 asks for it)
    HARD: { pool: 0.35, snooker: 0.35, four: 0.25, three: 0.12 },
    SAMPLES: 16,
    NET_STROKES: 3,     // the strokes the stroke network adds to a shot's own carom sweep (58-stroke-net.js, 11-19)
    sims: 0,            // (copies played so far: the cost, read by the tests)
  };
  const erf = x => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
  // the chance that an aim within +-half of the window's centre comes off, for a spread of sig
  const winChance = (half, sig = JUDGE.SIG_A) => half <= 0 ? 0 : erf(half / (sig * Math.SQRT2));
  // the reference hand's wobble, the same every time: low-discrepancy points (Halton 2, 3, 5) through the normal curve
  const JUDGE_WOBBLE = (() => {
    const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
    const inv = p => { // the normal curve's inverse (Acklam)
      const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
      const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
      const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
      const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
      const q0 = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
      if (q0 < 0.02425) { const q = Math.sqrt(-2 * Math.log(q0)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
      if (q0 > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - q0)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
      const q = q0 - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    };
    return Array.from({ length: 32 }, (_, i) => [inv(halton(i + 1, 2)), inv(halton(i + 1, 3)), inv(halton(i + 1, 5))]);
  })();

  /* ---- a table as someone sees it: a view of the game for who shoots next on this world (the groups as the shot left
     them, 스누커's ball on) - what g.mode.legal and g.mode.ctx read ---- */
  function judgeView(world, who, r, inHand) {
    const players = g.players.map(p => ({ ...p }));
    if (r && r.assign) { players[g.turn].group = r.assign; players[1 - g.turn].group = r.assign === 'solid' ? 'stripe' : 'solid'; }
    const v = { ...g, world, players, turn: who, isBreak: false, placing: inHand ? 'any' : null };
    if (g.snk) {
      const s = r && r.snk ? { ...r.snk } : { ...g.snk }, reds = world.balls.some(b => b.on && b.id >= 1 && b.id <= 15);
      if (who !== g.turn && s.on === 'colour' || s.on === 'after') { s.on = reds ? 'red' : 'clear'; s.next = s.next || 16; }
      if (s.on === 'red' && !reds) { s.on = 'clear'; s.next = 16; }
      v.snk = s;
    }
    return v;
  }
  // one stroke played on a copy: what happened (ev), the rules' word on it (r), the table after
  function judgeSim(world, who, shot, view) {
    const P = g.P, w = P.clone(world); w.cue = P.POCKETED ? 0 : who; JUDGE.sims++;
    if (shot.pos) P.place(w, w.cue, shot.pos[0], shot.pos[1]);
    P.strike(w, shot.angle, shot.V, shot.a || 0, shot.b || 0, shot.el || 0);
    const ev = P.run(w, 20), v = view || judgeView(world, who), r = g.mode.evaluate(ev, g.mode.ctx(v), { ...v, world: w });
    const off = ev.off && ev.off.length; let won = r.win === who && !off, lost = r.win === 1 - who || !!off && !r.foul;
    const made = !off && !r.foul && (r.keep || r.pts > 0 || won);
    /* 후구 (4구, game.js resolve): the one who began, done first, has not won - the other gets a visit to catch up; so the
       last point is not the end, and what it leaves is the other's (owner 11-19: '4구 마지막 샷일 때 성공하면 다음 배치가 안
       좋을수록 좋은 건데'). In that visit, a miss ends the game. */
    const hv = view || g;
    // (a race to points: the game's own resolve ends it - the point that reaches the target wins, game.js)
    if (!won && made && g.mode.target && !(hv.finish && g.mode.FINISH) && !hv.ot && r.pts > 0) { const pl = (hv.players || [])[who]; if (pl && pl.score + r.pts >= (hv.targets || [])[who]) won = true; }
    const pass = won && hv.hugu && hv.chance == null && who === hv.first && !hv.ot;
    if (pass) won = false;
    // (and caught up in it: no win - a draw, or 연장)
    const tie = won && hv.hugu && hv.chance != null && who !== hv.chance;
    if (tie) won = false;
    if (hv.hugu && hv.chance != null && who !== hv.chance && !made && !won && !tie) lost = true;
    // (9볼, WPA: a third foul in a row loses - game.js resolve counts them)
    if (g.modeId === 'nine' && r.foul && !won && (((hv.players || [])[who] || {}).foulRun || 0) >= 2) lost = true;
    return { ev, r, world: w, made, won, lost, pass, tie, foul: !!r.foul || !!off };
  }

  /* ---- pool: the lines a table offers, from its geometry ----
     A pot's window: the object ball must go within h of the pocket's centre line, h the pocket's half-window (measured on
     this table once - judgeMouth - and narrowed for a ball coming in at an angle); an aim error d at the cue ball turns the
     object ball by d (1 + s / (2R cos cut)) - s the cue ball's run to the contact -, so the aim's half-window is
     about h / (L (1 + s / (2R cos cut))), L the object ball's run to the pocket (fitted on the physics: below). A bank: the pocket seen in the cushion, at
     half the chance (a cushion is less sure than the cloth). Measured on the physics (11-18): a corner takes a ball
     coming in up to some 50 degrees off its line nearly as well as one straight in (the jaw and the cushion steer it in),
     a side pocket narrows fast past 40 degrees. */
  const judgeMouths = new WeakMap();
  function judgeMouth(k) {
    const P = g.P; let m = judgeMouths.get(P);
    if (!m) {
      m = P.POCKETS.map((pk, i) => {
        // a lone ball 0.6 m out on the pocket's own line, the aim moved until it stays out: the half-window, as a distance
        const L = 0.6, nl = Math.hypot(pk.nx, pk.ny), x = pk.ax - pk.nx / nl * L, y = pk.ay - pk.ny / nl * L, base = Math.atan2(pk.ay - y, pk.ax - x);
        const ok = da => { const w = P.makeWorld(1); P.place(w, 0, x, y); P.strike(w, base + da, 2.2, 0, 0); return P.run(w, 20).pocketed.some(p => p.pocket === i); };
        const edge = s => { let lo = 0, hi = 0.25; if (!ok(0)) return 0; for (let n = 0; n < 14; n++) { const mid = (lo + hi) / 2; if (ok(s * mid)) lo = mid; else hi = mid; } return lo; };
        return (edge(1) + edge(-1)) / 2 * L;
      });
      judgeMouths.set(P, m);
    }
    return m[k];
  }
  function potLines(world, who, view, inHand) {
    const P = g.P, R = P.R, c = world.balls[0], out = [];
    const ids = g.mode.legal(view, who).filter(id => world.balls[id] && world.balls[id].on);
    const rails = [['x', P.HL - R], ['x', -P.HL + R], ['y', P.HW - R], ['y', -P.HW + R]];
    for (const id of ids) {
      const T = world.balls[id];
      P.POCKETS.forEach((pk, k) => {
        const nl = Math.hypot(pk.nx, pk.ny);
        // straight in, and off each cushion (the pocket's image in it)
        for (const bank of [null, ...rails]) {
          let tx = pk.ax, ty = pk.ay, bx = 0, by = 0;
          if (bank) {
            const [axis, edge] = bank; tx = axis === 'x' ? 2 * edge - pk.ax : pk.ax; ty = axis === 'y' ? 2 * edge - pk.ay : pk.ay;
            const t = axis === 'x' ? (edge - T.x) / (tx - T.x) : (edge - T.y) / (ty - T.y); if (!(t > 0.05 && t < 0.95)) continue;
            bx = T.x + t * (tx - T.x); by = T.y + t * (ty - T.y);
            if (axis === 'x' ? Math.abs(by) > P.HW - 0.12 : Math.abs(bx) > P.HL - 0.12 || Math.abs(bx) < 0.12) continue;
          }
          const L = Math.hypot(tx - T.x, ty - T.y); if (L < 1e-6) continue;
          const ux = (tx - T.x) / L, uy = (ty - T.y) / L;
          // the way in: from the image for a bank, the line itself for a straight pot
          const ix = bank ? (pk.ax - bx) / Math.hypot(pk.ax - bx, pk.ay - by) : ux, iy = bank ? (pk.ay - by) / Math.hypot(pk.ax - bx, pk.ay - by) : uy;
          const cosB = (ix * pk.nx + iy * pk.ny) / nl; if (cosB < (pk.corner ? 0.64 : 0.3)) continue;
          const beta = Math.acos(Math.min(1, cosB)) * 180 / Math.PI, f = pk.corner ? 1 - 0.22 * Math.min(beta, 30) / 30 : Math.max(0, 1 - (beta / 72) ** 2);
          if (bank ? !P.pathClear(world, T.x, T.y, bx, by, [0, id]) || !P.pathClear(world, bx, by, pk.ax, pk.ay, [0, id]) : !P.pathClear(world, T.x, T.y, pk.ax, pk.ay, [0, id])) continue;
          const gx = T.x - ux * 2 * R, gy = T.y - uy * 2 * R;
          // in hand: the cue ball put where the pot is plainest - a short way behind the ghost ball, on the line
          let cx = c.x, cy = c.y;
          if (inHand) { cx = gx - ux * 0.3; cy = gy - uy * 0.3; if (Math.abs(cx) > P.HL - R || Math.abs(cy) > P.HW - R || !P.isFree(world, cx, cy, 0)) { cx = gx - ux * 0.15; cy = gy - uy * 0.15; } if (Math.abs(cx) > P.HL - R || Math.abs(cy) > P.HW - R) continue; }
          const s = Math.hypot(gx - cx, gy - cy); if (s < R * 0.2) continue;
          const cos = ((gx - cx) * ux + (gy - cy) * uy) / s; if (cos < 0.17) continue;
          if (!P.pathClear(world, cx, cy, gx, gy, [0, id])) continue;
          // (the simple lever h / (L M) fitted to windows found on the physics, 274 pots on random tables, 11-18: the
          // ball's throw and the jaws make them wider - 2.06 h / (L^1.074 M^1.15), M = 1 + s / (2R cos cut))
          const half = 2.06 * judgeMouth(k) * f / (L ** 1.074 * (1 + s / (2 * R * cos)) ** 1.15);
          const p = winChance(half) * (bank ? 0.5 : 1);
          out.push({ id, pocket: k, p, angle: Math.atan2(gy - cy, gx - cx), cut: Math.acos(Math.min(1, cos)), s, L, kind: bank ? 'bank' : 'pot', pos: inHand ? [cx, cy] : null });
        }
      });
    }
    return out.sort((a, b) => b.p - a.p);
  }

  /* ---- pool: the lines players reach for when no plain pot is there (11-18: the judge had none of them, so it took a
     table with only a kick or a combination on as having nothing - and graded too kindly) ----
       kick   the cue ball off one cushion into the ghost ball (the ghost seen in the cushion), at 40% of the chance the
              same pot would have from the bounce: a cushion's angle is never quite a mirror's
       combo  the cue ball sends a legal ball into another ball that goes in: each part's chance as a pot, the first
              into a 'pocket' as wide as the second ball's window allows, multiplied, at 70%
     Each is only a guess at its aim (the cushion bends it, throw bends a combination): bestShots looks round it on the
     physics for the aim that really goes in (judgeAim) before judging it. Not used for leaves - those stay quick. */
  function potExtras(world, who, view) {
    const P = g.P, R = P.R, c = world.balls[0], out = [];
    if (g.placing) return out;
    const ids = g.mode.legal(view, who).filter(id => world.balls[id] && world.balls[id].on), mouth = k => judgeMouth(k);
    const rails = [['x', P.HL - R], ['x', -P.HL + R], ['y', P.HW - R], ['y', -P.HW + R]];
    const ghost = (T, k) => { const pk = P.POCKETS[k], L = Math.hypot(pk.ax - T.x, pk.ay - T.y), ux = (pk.ax - T.x) / L, uy = (pk.ay - T.y) / L; return { gx: T.x - ux * 2 * R, gy: T.y - uy * 2 * R, ux, uy, L }; };
    // (a pot's half-window seen from where the cue ball - or the ball that does its work - comes from: s, the run to the
    // contact; cos, the cut)
    const potHalf = (k, L, s, cos) => 2.06 * mouth(k) / (L ** 1.074 * (1 + s / (2 * R * Math.max(0.17, cos))) ** 1.15);
    for (const id of ids) {
      const T = world.balls[id];
      P.POCKETS.forEach((pk, k) => {
        const G = ghost(T, k); if (!P.pathClear(world, T.x, T.y, pk.ax, pk.ay, [0, id])) return;
        if ((G.ux * pk.nx + G.uy * pk.ny) / Math.hypot(pk.nx, pk.ny) < (pk.corner ? 0.64 : 0.3)) return;
        // kicks: off each cushion to the ghost ball
        for (const [axis, edge] of rails) {
          const mx = axis === 'x' ? 2 * edge - G.gx : G.gx, my = axis === 'y' ? 2 * edge - G.gy : G.gy;
          const t = axis === 'x' ? (edge - c.x) / (mx - c.x) : (edge - c.y) / (my - c.y); if (!(t > 0.02 && t < 0.98)) continue;
          const bx = c.x + t * (mx - c.x), by = c.y + t * (my - c.y);
          if (axis === 'x' ? Math.abs(by) > P.HW - 0.1 : Math.abs(bx) > P.HL - 0.1 || Math.abs(bx) < 0.1) continue;
          if (!P.pathClear(world, c.x, c.y, bx, by, [0]) || !P.pathClear(world, bx, by, G.gx, G.gy, [0, id])) continue;
          const s2 = Math.hypot(G.gx - bx, G.gy - by), cos = ((G.gx - bx) * G.ux + (G.gy - by) * G.uy) / s2; if (cos < 0.2) continue;
          out.push({ id, pocket: k, kind: 'kick', angle: Math.atan2(my - c.y, mx - c.x), p: 0.4 * winChance(potHalf(k, G.L, Math.hypot(bx - c.x, by - c.y) + s2, cos)), s: Math.hypot(bx - c.x, by - c.y) + s2, L: G.L, cut: Math.acos(Math.min(1, cos)), pos: null });
        }
      });
    }
    // combinations: a legal ball A into a ball B that goes in (9볼: any ball; 8볼 and the rest: B legal too)
    const pottable = g.modeId === 'nine' ? world.balls.filter(b => b.on && b.id !== 0).map(b => b.id) : ids;
    for (const a of ids) for (const bId of pottable) {
      if (bId === a) continue;
      const A = world.balls[a], B = world.balls[bId], dAB = Math.hypot(B.x - A.x, B.y - A.y); if (dAB > 0.9) continue;
      P.POCKETS.forEach((pk, k) => {
        const GB = ghost(B, k); if (!P.pathClear(world, B.x, B.y, pk.ax, pk.ay, [0, a, bId])) return;
        if ((GB.ux * pk.nx + GB.uy * pk.ny) / Math.hypot(pk.nx, pk.ny) < (pk.corner ? 0.64 : 0.3)) return;
        const vx = GB.gx - A.x, vy = GB.gy - A.y, v = Math.hypot(vx, vy); if (v < 1e-6) return;
        const cosB = (vx * GB.ux + vy * GB.uy) / v; if (cosB < 0.5) return;
        const gx = A.x - vx / v * 2 * R, gy = A.y - vy / v * 2 * R, s = Math.hypot(gx - c.x, gy - c.y), cosA = ((gx - c.x) * vx + (gy - c.y) * vy) / (s * v);
        if (cosA < 0.3 || !P.pathClear(world, c.x, c.y, gx, gy, [0, a]) || !P.pathClear(world, A.x, A.y, GB.gx, GB.gy, [0, a, bId])) return;
        const pB = winChance(potHalf(k, GB.L, v, cosB)), hB = potHalf(k, GB.L, v, cosB) * v;   // (B's window as a width where A must arrive)
        const pA = winChance(Math.min(0.2, 2.06 * Math.max(R * 0.15, hB) / (v ** 1.074 * (1 + s / (2 * R * cosA)) ** 1.15)));
        out.push({ id: a, pocket: k, kind: 'combo', via: bId, angle: Math.atan2(gy - c.y, gx - c.x), p: 0.7 * pA * pB, s, L: v + GB.L, cut: Math.acos(Math.min(1, cosA)), pos: null });
      });
    }
    return out.sort((x, y) => y.p - x.p);
  }
  // the aim near a line's guess that really comes off on the physics (the middle of the first run of aims that do), or null
  function judgeAim(world, who, shot, view, span = 0.035) {
    const made = a => judgeSim(world, who, { ...shot, angle: a }, view).made;
    if (made(shot.angle)) return shot.angle;
    for (let d = 0.0015; d <= span; d *= 1.35) for (const sg of [1, -1]) {
      const a = shot.angle + sg * d; if (!made(a)) continue;
      let lo = a, hi = a; const step = 0.0006 * sg; for (let i = 0; i < 12 && made(hi + step); i++) hi += step;
      return (lo + hi) / 2;
    }
    return null;
  }

  /* ---- carom: the lines a table offers, found by playing them ----
     For each ball that may be met first, the aim is swept across it (thin one side to thin the other) with the game's
     usual strokes; each run of aims that scores is a line, its window refined at both ends, its chance the reference
     hand's - and a little less if a firmer or softer stroke would lose it. */
  // (full: true - a shot's own lines; false - a leave, quickly; 'teach' - a leave as the teacher of the leave network sees
  // it, many strokes and fine steps, offline only: web/tools/net)
  const caromStrokes = full => {
    const three = g.modeId === 'three' && (g.cushions || 0) >= 3, V = x => x * (three ? 5.0 : 3.3) * PACE.carom;
    if (full === 'teach') return (three ? [[1, 0.45, 0.15], [1, -0.45, 0.15], [1.25, 0.45, -0.25], [1.25, -0.45, -0.25], [0.85, 0, 0.3], [1.1, 0.25, 0], [1.1, -0.25, 0]]
      : [[0.8, 0, 0], [1, 0, 0.3], [1, 0, -0.3], [1.25, 0.35, 0], [1.25, -0.35, 0], [0.9, 0, 0.15]]).map(([v, a, b]) => ({ V: V(v), a, b }));
    if (three) return (full ? [[1, 0.45, 0.15], [1, -0.45, 0.15], [1.25, 0.45, -0.25], [1.25, -0.45, -0.25], [0.85, 0, 0.3]] : [[1.1, 0.4, 0.1], [1.1, -0.4, 0.1]]).map(([v, a, b]) => ({ V: V(v), a, b }));
    return (full ? [[0.85, 0, 0], [1.1, 0, 0.3], [1.1, 0, -0.3], [1.25, 0.35, 0]] : [[1, 0, 0.15]]).map(([v, a, b]) => ({ V: V(v), a, b }));
  };
  // the strokes swept off one ball: the usual few, and for a shot's own lines the ones the stroke network (58-stroke-net.js)
  // sees most likely to score off that ball on this table - the line a fixed few would miss (none without its weights)
  function caromStrokesFor(world, who, id, full) {
    const base = caromStrokes(full); if (full !== true) return base;
    const three = g.modeId === 'three' && (g.cushions || 0) >= 3; if (!three && g.modeId !== 'four') return base;
    const guess = strokeGuess(three ? 'three' : 'four', world, who, id, 6); if (!guess) return base;
    const V = x => x * (three ? 5.0 : 3.3) * PACE.carom, set = STROKE_SET[three ? 'three' : 'four'], out = base.slice();
    for (const { i, p } of guess) {
      if (out.length >= base.length + JUDGE.NET_STROKES || p < 0.08) break;
      const [v, a, b] = set[i], st = { V: V(v), a, b };
      if (!out.some(o => Math.abs(o.V - st.V) < 0.08 * st.V && Math.abs(o.a - a) < 0.1 && Math.abs(o.b - b) < 0.1)) out.push(st);
    }
    return out;
  }
  function caromLines(world, who, view, full) {
    const P = g.P, c = world.balls[who], out = [], steps = full === 'teach' ? 40 : full ? 26 : (g.modeId === 'three' ? 11 : 14);
    if (!c || !c.on) return out;
    const ids = g.mode.legal(view, who).filter(id => world.balls[id] && world.balls[id].on);
    const scores = shot => judgeSim(world, who, shot, view).made;
    for (const id of ids) {
      const T = world.balls[id], d = Math.hypot(T.x - c.x, T.y - c.y); if (d < 2 * P.R * 1.01) continue;
      const base = Math.atan2(T.y - c.y, T.x - c.x), half = Math.asin(Math.min(0.99, 2 * P.R / d)) * 0.985;
      for (const st of caromStrokesFor(world, who, id, full)) {
        const at = i => base - half + 2 * half * i / steps, hit = [];
        for (let i = 0; i <= steps; i++) hit.push(scores({ angle: at(i), ...st }));
        for (let i = 0; i <= steps; i++) {
          if (!hit[i] || i && hit[i - 1]) continue;
          let j = i; while (j < steps && hit[j + 1]) j++;
          // the run's ends, found more finely between a scoring aim and the one beside it that does not
          const edge = (inside, outside) => { let a = inside, b = outside; for (let n = 0; n < 4; n++) { const m = (a + b) / 2; if (scores({ angle: m, ...st })) a = m; else b = m; } return a; };
          const lo = i > 0 ? edge(at(i), at(i - 1)) : at(i), hi = j < steps ? edge(at(j), at(j + 1)) : at(j), mid = (lo + hi) / 2;
          let p = winChance((hi - lo) / 2);
          if (p > 0.05) { const keep = [0.88, 1.12].filter(k => scores({ angle: mid, ...st, V: st.V * k })).length; p *= [0.55, 0.8, 1][keep]; }
          out.push({ id, p, angle: mid, ...st, width: hi - lo, kind: 'carom' });
          i = j;
        }
      }
    }
    return out.sort((a, b) => b.p - a.p);
  }

  /* 3쿠션's cushion-first lines (빈쿠션): the aim swept all the way round, away from the balls, with a firm stroke and
     running side either way; each run that scores a line, its window refined as caromLines does. Costly (some 600 copies)
     - only when the ball-first lines are poor. */
  function cushionFirst(world, who, view) {
    const P = g.P, c = world.balls[who], out = [], N = 300; if (!c || !c.on) return out;
    const balls = world.balls.filter(b => b.on && b.id !== who), cone = a => balls.some(b => { const d = Math.hypot(b.x - c.x, b.y - c.y), d0 = Math.atan2(b.y - c.y, b.x - c.x); return Math.abs(Math.atan2(Math.sin(a - d0), Math.cos(a - d0))) < Math.asin(Math.min(0.99, 2 * P.R / d)) + 0.01; });
    const scores = shot => judgeSim(world, who, shot, view).made;
    for (const st of [{ V: 5.4 * PACE.carom, a: 0.45, b: 0.15 }, { V: 5.4 * PACE.carom, a: -0.45, b: 0.15 }]) {
      const at = i => -Math.PI + 2 * Math.PI * i / N, hit = [];
      for (let i = 0; i < N; i++) hit.push(!cone(at(i)) && scores({ angle: at(i), ...st }));
      for (let i = 0; i < N; i++) {
        if (!hit[i] || i && hit[i - 1]) continue;
        let j = i; while (j < N - 1 && hit[j + 1]) j++;
        const edge = (inside, outside) => { let a = inside, b = outside; for (let n = 0; n < 4; n++) { const m = (a + b) / 2; if (scores({ angle: m, ...st })) a = m; else b = m; } return a; };
        const lo = edge(at(i), at(i - 1)), hi = edge(at(j), at(j + 1)), mid = (lo + hi) / 2;
        out.push({ id: -1, p: winChance((hi - lo) / 2) * 0.8, angle: mid, ...st, width: hi - lo, kind: 'kick' });
        i = j;
      }
    }
    return out;
  }

  // the leave as the leave network's teacher sees it (carom, offline: web/tools/net/label.js)
  function leaveTeach(world, who) {
    const view = judgeView(world, who, null, false), c = world.balls[who]; if (!c || !c.on) return 0;
    const seen = new Set(), ps = [];
    for (const l of caromLines(world, who, view, 'teach')) { const key = l.id + ':' + Math.round(l.a * 10) + ':' + Math.round(l.b * 10); if (seen.has(key)) continue; seen.add(key); ps.push(l.p); if (ps.length === 3) break; }
    return ps.reduce((t, p, i) => t + p * JUDGE.TOP[i], 0) / (JUDGE.TOP[0] + JUDGE.TOP[1] + JUDGE.TOP[2]);
  }
  // what the table offers whoever shoots next: its best three lines, one per ball (pool) or per ball and stroke (carom)
  function leaveOf(world, who, r, inHand) {
    if (!g.P.POCKETED) { const c = world.balls[who]; if (!c || !c.on) return 0; const n = leaveNet(world, who); if (n != null) return n; }   // (carom: the network, when it has learnt this game - 56-leave-net.js)
    const view = judgeView(world, who, r, inHand);
    const lines = g.P.POCKETED ? potLines(world, who, view, inHand) : caromLines(world, who, view, false), seen = new Set(), ps = [];
    for (const l of lines) { const key = g.P.POCKETED ? l.id : l.id + ':' + Math.round(l.a * 10) + ':' + Math.round(l.b * 10); if (seen.has(key)) continue; seen.add(key); ps.push(l.p); if (ps.length === 3) break; }
    return ps.reduce((s, p, i) => s + p * JUDGE.TOP[i], 0) / (JUDGE.TOP[0] + JUDGE.TOP[1] + JUDGE.TOP[2]);
  }
  /* A leave looked at two shots deep (pool; 11-18 - PickPocket and CueCard look two shots ahead): its two best lines, each
     played as aimed with three strokes (follow, stun, draw), and what the best of them leaves after it - a pot that leaves
     the next one too counts more than a pot that ends the run. In the same 0..1 as leaveOf. Carom: as leaveOf (a carom
     leave is found by sweeping, and a second sweep inside each would cost too much). */
  function leaveDeep(world, who, r, inHand) {
    if (!g.P.POCKETED) return leaveOf(world, who, r, inHand);
    const view = judgeView(world, who, r, inHand), seen = new Set(), vals = [];
    for (const l of potLines(world, who, view, inHand)) {
      if (seen.has(l.id)) continue; seen.add(l.id);
      const need = 0.9 + 1.4 * Math.sqrt(l.s + l.L / Math.max(0.35, Math.cos(l.cut)));
      let after = 0;
      for (const b of [0.35, 0, -0.35]) {
        const res = judgeSim(world, who, { pos: l.pos, angle: l.angle, V: Math.min(g.vOf(1) * 0.95, need * PACE.pool), a: 0, b, el: 0 }, view);
        if (res.won) { after = 1; break; } if (res.made) after = Math.max(after, leaveOf(res.world, who, res.r, false));
      }
      vals.push(l.p * (0.6 + 0.4 * after)); if (vals.length === 2) break;
    }
    return vals.reduce((t, v, i) => t + v * JUDGE.TOP[i], 0) / (JUDGE.TOP[0] + JUDGE.TOP[1]);
  }
  // a result's worth for the one who played it, and the two leaves in it (deep: leaveDeep - for the final comparisons)
  function worthOf(res, who, deep) {
    const L = deep ? leaveDeep : leaveOf;
    if (res.won) return { v: 1, mine: 1, theirs: 0 };
    if (res.tie) return { v: 0.5, mine: 0.5, theirs: 0 };
    // (the last point before the other's 후구: worth what it denies them - their visit must make every point they lack)
    if (res.pass) {
      const theirs = L(res.world, 1 - who, res.r, false), lack = Math.max(1, (g.targets || [1, 1])[1 - who] - ((g.players[1 - who] || {}).score || 0));
      return { v: 1 - theirs * Math.pow(0.7, lack - 1), mine: 1 - theirs, theirs, pass: true };
    }
    if (res.lost) return { v: 0, mine: 0, theirs: 1 };
    if (res.made) { const mine = L(res.world, who, res.r, false); return { v: winOf(res.world, who, res.r, mine), mine, theirs: 0 }; }
    const inHand = res.foul && g.mode.ballInHand, theirs = L(res.world, 1 - who, res.r, inHand);
    // (4구's -1 is in the points left; 스누커's points given, a little besides - its race is counted by balls)
    const give = res.r.give ? Math.min(0.05, res.r.give / 100) : 0;
    return { v: 1 - winOf(res.world, 1 - who, res.r, theirs) - give, mine: 0, theirs };
  }
  /* ---- the rules as they stand at this shot (owner 11-19: '이제 8볼, 9볼, 3구도 규칙을 보는 거야') ----
     what a commentator keeps in mind: 8볼 - the groups, the balls left to each, who is on the 8; 9볼 - the ball on, the fouls
     in a row; carom - the points still wanted, the cushions a point asks for, a finish, 4구's 후구 */
  function ruleOf(v, who, res) {
    const m = g.mode, id = g.modeId, R = { mode: id, bih: !!m.ballInHand }, pl = v.players || [], me = pl[who] || {}, op = pl[1 - who] || {};
    if (id === 'eight') {
      const ids = grp => grp === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15], left = (grp, w) => grp ? ids(grp).filter(i => w.balls[i].on).length : null;
      const mg = me.group || (res.r && res.r.assign) || null, og = op.group || (res.r && res.r.assign ? (res.r.assign === 'solid' ? 'stripe' : 'solid') : null);
      R.open = !me.group; R.assign = res.r && res.r.assign || null; R.group = mg;
      R.mine = left(me.group, v.world); R.theirs = left(op.group, v.world);
      R.on8 = R.mine === 0; R.opp8 = R.theirs === 0;
      R.mineAfter = left(mg, res.world); R.theirsAfter = left(og, res.world);
      R.cleared = !!(res.made && !res.won && mg && R.mineAfter === 0);           // (the group done: the next is the 8)
      R.eightIn = (res.ev.pocketed || []).some(q => q.id === 8);
    } else if (id === 'nine') {
      R.lowest = m.lowest(v); R.fouls = me.foulRun || 0; R.oppFouls = op.foulRun || 0;
      R.left = v.world.balls.filter(b => b.on && b.id > 0).length;
      R.early9 = !!(res.won && R.lowest !== 9);                                   // (the 9 down early: a combination or a carom)
    } else if (!g.P.POCKETED) {
      const c = m.ctx(v);
      R.need = c.need || 0; R.finish = !!c.last; R.opening = !!c.opening;
      const tg = v.targets || [], sc = [pl[0] && pl[0].score || 0, pl[1] && pl[1].score || 0];
      R.left = tg[who] != null ? Math.max(0, tg[who] - sc[who]) : null; R.oppLeft = tg[1 - who] != null ? Math.max(0, tg[1 - who] - sc[1 - who]) : null;
      R.chase = !!(v.hugu && v.chance != null && who !== v.chance); R.hugu = !!v.hugu; R.first = v.first === who;
      // (both balls met, too few cushions: the point the rule did not count)
      R.short = !res.made && !res.foul && (res.ev.hits || []).filter(i => i !== who).length >= 2 && (res.ev.cushions || 0) < R.need;
    }
    return R;
  }
  // how near a miss came, as a player sees it: carom - the cue ball's least gap to the ball it wanted second; pool - the ball
  // met first, to the pocket meant (one more run, watched)
  function nearOf(world, who, shot, meantRes) {
    if (!meantRes || !meantRes.made) return null;
    const P = g.P, w = P.clone(world); w.cue = P.POCKETED ? 0 : who;
    let q;
    if (P.POCKETED) { const pot = (meantRes.ev.pocketed || []).find(x => x.id !== 0); if (!pot) return null; const pk = P.POCKETS[pot.pocket]; q = { a: pot.id, x: pk.x, y: pk.y, d: Infinity, pk }; }
    else { const second = meantRes.ev.hits[1]; if (second == null) return null; q = { a: w.cue, b: second, after: 1, d: Infinity }; }
    w.watch = [q];
    if (shot.pos) P.place(w, w.cue, shot.pos[0], shot.pos[1]);
    P.strike(w, shot.angle, shot.V, shot.a || 0, shot.b || 0, shot.el || 0); P.run(w, 20); JUDGE.sims++;
    if (!isFinite(q.d)) return null;
    // (in ball widths: carom, the gap between the two; pool, how far the ball's centre stayed from the hole's mouth)
    return P.POCKETED ? Math.round(Math.max(0, q.d - q.pk.r) / (2 * P.R) * 10) / 10 : Math.round(Math.max(0, q.d - 2 * P.R) / (2 * P.R) * 10) / 10;
  }
  // (후구: after the last point, has the other no direct line - must they go to a cushion first? 4구's 빈쿠션)
  function forcedOf(res, who) {
    if (g.P.POCKETED) return null;
    const v = judgeView(res.world, 1 - who, res.r, false);
    return !caromLines(res.world, 1 - who, v, false).some(l => l.kind === 'carom' && l.p >= 0.2);
  }
  // what the table is worth to whoever is at it, here: the swing between me at it and the other at it (an ordinary leave)
  const swingOf = (world, who) => Math.max(0.02, winOf(world, who, null, 0.5) - (1 - winOf(world, 1 - who, null, 0.5)));
  // a shot's expected worth for the reference hand: played with its wobble, JUDGE.SAMPLES times. (The worth of a result is
  // read once per kind - won, lost, made, fouled, missed - from the first of its kind, or given: the leaves are the costly
  // part, and results of a kind lie close together.)
  function expectOf(world, who, shot, view, n = JUDGE.SAMPLES, known, deep) {
    let sum = 0, made = 0; const ws = new Map(known || []), k = raisedK(shot);
    for (let i = 0; i < n; i++) {
      const [ea, ev, es] = JUDGE_WOBBLE[i];
      const res = judgeSim(world, who, { ...shot, angle: shot.angle + ea * JUDGE.SIG_A * k, V: shot.V * (1 + ev * JUDGE.SIG_V), a: (shot.a || 0) + es * JUDGE.SIG_S * k }, view);
      const kind = res.won ? 'w' : res.lost ? 'l' : res.made ? 'm' : res.foul ? 'f' : 'x';
      if (!ws.has(kind)) ws.set(kind, worthOf(res, who, deep).v);
      sum += ws.get(kind); if (res.made) made++;
    }
    return { e: sum / n, p: made / n };
  }
  const kindOf = res => res.won ? 'w' : res.lost ? 'l' : res.made ? 'm' : res.foul ? 'f' : 'x';
  const raisedK = shot => (shot.el || 0) > 0.3 ? JUDGE.RAISED : 1;
  // what the raised cue made of a stroke: 'jump' (the cue ball left the cloth over a ball's height), 'masse' (raised past
  // 34 degrees with side - it bends), 'curve' (a little raised with side), else null - as the aim line names them (80-input.js)
  // (a steep massé lifts the ball a little as it bites - owner 11-19: 레아's massé was called a jump: past 52 degrees with side
  // it is a massé whatever it does in the air)
  const raisedOf = (shot, ev) => { const el = shot.el || 0, side = Math.abs(shot.a || 0) >= 0.15;
    return el >= 0.9 && side ? 'masse' : ev && ev.air > g.P.R * 1.2 ? 'jump' : el >= 0.6 && side ? 'masse' : el >= 0.2 && side ? 'curve' : null; };

  /* ---- what kind of shot a stroke is, and what it did - for the coach's words (50-review-words.js) ----
     styleOf: the way of playing it - safety, kick (pool: off a cushion first; carom: 빈쿠션), bank, combination, side (left
     or right english), follow (밀어치기), draw (끌어치기), stun (센터·스톱) - with the first ball, for telling them apart */
  function styleOf(k) {
    const l = k.line, s = k.shot, first = k.nominal && k.nominal.ev.firstHit;
    const way = l.kind === 'safety' ? 'safety' : l.kind === 'masse' || l.kind === 'jump' ? l.kind : l.kind === 'kick' ? 'kick' : l.kind === 'bank' ? 'bank' : l.kind === 'combo' ? 'combo'
      : Math.abs(s.a || 0) >= 0.25 ? 'side' : (s.b || 0) >= 0.25 ? 'follow' : (s.b || 0) <= -0.25 ? 'draw' : 'stun';
    return { way, key: g.P.POCKETED ? way : way + ':' + first };
  }
  /* describe: what a stroke did, from its copy - the first ball and how thick it was met (1 full, 0 a graze), the cut
     (pool, degrees), the balls potted and where, the cushions the cue ball met before the second ball (carom) and before
     any ball, a kiss; and the stroke itself: tip (a: left-right, b: up-down), pace (0..1 of the cue's range), the cue
     raised (degrees) */
  function describe(world, who, shot, res) {
    const P = g.P, c = shot.pos ? { x: shot.pos[0], y: shot.pos[1] } : world.balls[P.POCKETED ? 0 : who], ev = res.ev, first = ev.firstHit;
    let thick = null, cut = null; const raised = raisedOf(shot, ev);
    // (a massé meets its ball off a curve: the straight line's thickness would be wrong, so none is said)
    if (first != null && world.balls[first] && raised !== 'masse') {
      const T = world.balls[first], d = Math.hypot(T.x - c.x, T.y - c.y), off = Math.atan2(Math.sin(shot.angle - Math.atan2(T.y - c.y, T.x - c.x)), Math.cos(shot.angle - Math.atan2(T.y - c.y, T.x - c.x)));
      const imp = Math.min(2 * P.R, Math.abs(d * Math.sin(off))); thick = Math.round((1 - imp / (2 * P.R)) * 100) / 100; cut = Math.round(Math.asin(imp / (2 * P.R)) * 180 / Math.PI);
      if (off < 0) cut = -cut;   // (the side: + the ball's right as the cue ball sees it, - its left)
    }
    return { first, second: ev.hits.length > 1 ? ev.hits[1] : null, hits: ev.hits.slice(0, 4), thick, cut, potted: (ev.pocketed || []).filter(q => q.id !== 0 || P.POCKETED).map(q => [q.id, q.pocket]),
      cushions: ev.cushions, pre: ev.pre, kiss: ev.kiss, route: P.POCKETED ? null : routeOf(ev), a: Math.round((shot.a || 0) * 100) / 100, b: Math.round((shot.b || 0) * 100) / 100,
      pace: Math.round(Math.min(1, g.powerOf ? g.powerOf(shot.V) : shot.V / g.vOf(1)) * 100) / 100, el: Math.round((shot.el || 0) * 180 / Math.PI), raised };
  }
  // the ball the next shot would go for (pool: the best line on the table the stroke left), or null
  function nextBall(res, who) {
    if (!g.P.POCKETED || !res.made || res.won) return null;
    const l = potLines(res.world, who, judgeView(res.world, who, res.r, false), false)[0]; return l ? { id: l.id, pocket: l.pocket, p: Math.round(l.p * 100) / 100 } : null;
  }

  /* ---- the best a shot here could bring: candidate strokes, each judged by its expected worth ---- */
  function bestShots(world, who, view) {
    const P = g.P, cands = [];
    if (P.POCKETED) {
      const lines = potLines(world, who, view, !!g.placing).slice(0, 8);
      // (the kicks and combinations, looked for when the plain pots are poor - as a player would)
      if (!lines.length || lines[0].p < 0.5) for (const l of potExtras(world, who, view).slice(0, 4)) {
        const V = Math.min(g.vOf(1) * 0.95, (1.1 + 1.4 * Math.sqrt(l.s + l.L)) * PACE.pool), angle = judgeAim(world, who, { pos: null, angle: l.angle, V, a: 0, b: 0, el: 0 }, view);
        if (angle != null) lines.push(Object.assign({}, l, { angle }));
      }
      for (const l of lines) {
        const need = 0.9 + 1.4 * Math.sqrt(l.s + l.L * (l.kind === 'bank' ? 1.6 : 1) / Math.max(0.35, Math.cos(l.cut)));
        for (const k of [0.75, 1, 1.35]) for (const b of [0.35, 0, -0.35]) cands.push({ line: l, shot: { pos: l.pos, angle: l.angle, V: Math.min(g.vOf(1) * 0.95, need * k * PACE.pool), a: 0, b, el: 0 } });
        // (and with side - left or right english - for the ways a player turns the cue ball off a cushion)
        for (const a of [0.35, -0.35]) cands.push({ line: l, shot: { pos: l.pos, angle: l.angle, V: Math.min(g.vOf(1) * 0.95, need * PACE.pool), a, b: 0, el: 0 } });
      }
      // a safety: the first legal ball met softly, a few ways, for when nothing is on
      const c = world.balls[0];
      for (const id of g.mode.legal(view, who).filter(i => world.balls[i] && world.balls[i].on).slice(0, 4)) {
        const T = world.balls[id], base = Math.atan2(T.y - c.y, T.x - c.x), d = Math.hypot(T.x - c.x, T.y - c.y), half = Math.asin(Math.min(0.99, 2 * P.R / d));
        if (g.placing || !P.pathClear(world, c.x, c.y, T.x, T.y, [0, id])) continue;
        for (const f of [-0.75, 0, 0.75]) for (const V of [0.9, 1.6]) cands.push({ line: { id, kind: 'safety', p: 0 }, shot: { pos: null, angle: base + half * f, V: V * PACE.pool * (1 + d), a: 0, b: 0, el: 0 } });
      }
    } else {
      const lines = caromLines(world, who, view, true);
      // (3쿠션: when no ball-first line is a fair chance, the cushion-first ones - 빈쿠션 - too, as a player turns to them)
      if (g.modeId === 'three' && (g.cushions || 0) >= 3 && (!lines.length || lines[0].p < 0.2)) lines.push(...cushionFirst(world, who, view)), lines.sort((a, b) => b.p - a.p);
      for (const l of lines.slice(0, 10)) cands.push({ line: l, shot: { pos: null, angle: l.angle, V: l.V, a: l.a, b: l.b, el: 0 } });
    }
    // the raised cue (11-19, 53-raised.js): a massé round the ball in the way (or, carom, for the point), a jump over it -
    // looked for when no plain line is a fair chance, as a player turns to them; how sure they are, by a raised hand
    if (g.masse && !cands.some(k => k.line.kind !== 'safety' && (k.line.p || 0) >= 0.35))
      for (const s of raisedShots(world, who, view, { masse: true, jump: true, skill: 0.8, cap: 14, all: !P.POCKETED })) cands.push({ line: { id: s.target, pocket: s.pocket, kind: s.kind, p: 0.25 }, shot: s });
    // each stroke as aimed (one copy each); the likeliest looked at more closely - its worth, then the reference hand's
    // wobble on the best few
    const missed = 1 - winOf(world, 1 - who, null, 0.45);   // (a miss, near enough, for the first sorting)
    // (a point that comes by a kiss is no line to play or show - owner 11-19: '가장 쉬운 샷이 2쿠션+키스+밀어치기': a line whose
    // middle scores only through a kiss before the point - physics.js kissPre - is not offered; pool keeps its own rule, below)
    const kissed = k => !g.P.POCKETED && k.nominal.made && k.nominal.ev.kissPre > 0;
    for (const k of cands) { k.nominal = judgeSim(world, who, k.shot, view); k.guess = kissed(k) ? -1 : k.nominal.made ? k.line.p : k.line.kind === 'safety' && !k.nominal.foul ? 0.05 : -1; }
    cands.sort((a, b) => b.guess - a.guess);
    const near = cands.slice(0, P.POCKETED ? 16 : 8).filter(k => k.guess > -1);
    for (const k of near) {
      k.worth = worthOf(k.nominal, who); k.style = styleOf(k);
      k.guess = k.nominal.made ? k.line.p * k.worth.v + (1 - k.line.p) * missed : k.worth.v;
    }
    near.sort((a, b) => b.guess - a.guess);
    /* the few judged closely: the likeliest, and the likeliest of each way of playing it (owner 11-18: '더 좋은 샷 보기 -
       원쿠션, 회전 이용, 여러 개 골라서') - a straight pot, follow, draw, side, a kick or a bank, a combination, a safety;
       carom: each of those with either first ball */
    const top = near.slice(0, P.POCKETED ? 5 : 3), seen = new Set(top.map(k => k.style.key));
    for (const k of near) if (!seen.has(k.style.key) && top.length < (P.POCKETED ? 9 : 6)) { seen.add(k.style.key); top.push(k); }
    // (the few left judged with the deeper leave, as the shot played is)
    for (const k of top) { k.worth = worthOf(k.nominal, who, true); const x = expectOf(world, who, k.shot, view, JUDGE.SAMPLES, [[kindOf(k.nominal), k.worth.v]], true); k.e = x.e; k.p = x.p; }
    top.sort((a, b) => b.e - a.e);
    return top;
  }

  /* ---- what the player meant: the nearest success to what was played ---- */
  const JUDGE_STEPS = [0.0007, 0.0014, 0.0021, 0.003, 0.0042, 0.0056, 0.0075, 0.01, 0.0135, 0.018, 0.024, 0.032, 0.043, 0.057];
  // (pool: a success through another ball - a combination, a kiss - is taken only when no plain pot of the ball met is
  // a little further on: a player means the plain pot far more often; 11-18)
  const plainPot = res => !g.P.POCKETED || (res.ev.pocketed || []).some(q => q.id === res.ev.firstHit);
  // (carom: a point that comes only through a kiss before it - physics.js kissPre - is no line: not the line a missed shot
  // meant, not its 교정한 샷, and it gives a line no width; owner 11-20 '교정한 샷 보기도 키스를 반동으로 씀')
  const clean = res => res.made && (g.P.POCKETED || !(res.ev.kissPre > 0));
  function intentOf(world, who, shot, view) {
    const tries = (V, a) => {
      let odd = null;
      for (let i = 0; i < JUDGE_STEPS.length && !(odd && i > odd.i + 4); i++) for (const s of [1, -1]) {
        const d = JUDGE_STEPS[i], res = judgeSim(world, who, { ...shot, angle: shot.angle + s * d, V, a }, view);
        if (!clean(res)) continue;
        if (plainPot(res)) return { da: s * d, V, a, res };
        if (!odd) odd = { da: s * d, V, a, res, i };
      }
      return odd;
    };
    let hit = tries(shot.V, shot.a || 0); if (hit) return { ...hit, why: 'aim' };
    for (const k of [0.82, 1.22, 0.6, 1.6, 0.4, 2.4]) { hit = tries(Math.min(g.vOf(1), shot.V * k), shot.a || 0); if (hit) return { ...hit, why: 'pace' }; }
    if (Math.abs(shot.a || 0) > 0.25) { hit = tries(shot.V, 0); if (hit) return { ...hit, why: 'tip' }; }
    return null;
  }
  // a line's own window around an aim that makes it: its two ends (the aim moved each way until it no longer comes off)
  function windowOf(world, who, shot, view) {
    const ok = da => clean(judgeSim(world, who, { ...shot, angle: shot.angle + da }, view));
    const end = s => { let lo = 0, hi = 0.004; while (hi < 0.08 && ok(s * hi)) { lo = hi; hi *= 2; } for (let n = 0; n < 5; n++) { const m = (lo + hi) / 2; if (ok(s * m)) lo = m; else hi = m; } return lo; };
    const up = end(1), down = end(-1), half = (up + down) / 2, centre = shot.angle + (up - down) / 2;
    let p = winChance(half / raisedK(shot));
    if (p > 0.05) { const keep = [0.88, 1.12].filter(k => clean(judgeSim(world, who, { ...shot, angle: centre, V: shot.V * k }, view))).length; p *= [0.55, 0.8, 1][keep]; }
    return { p, half, centre };
  }

  /* ---- the whole: one shot judged ----
     played: { pos, angle, V, a, b, el } on the table as it is (g: the game before the shot, g.turn the one who played). */
  function judgeShot(played) {
    if (g.isBreak && g.P.POCKETED) return null;            // (a break is not judged: it is a break)
    const who = g.turn, world = g.world, view = judgeView(world, who, null, !!g.placing);
    const game = !g.P.POCKETED ? g.modeId : g.mode.table === 'snooker' ? 'snooker' : 'pool';
    const shot = { pos: played.pos || null, angle: played.angle, V: played.V, a: played.a || 0, b: played.b || 0, el: played.el || 0 };
    const s0 = JUDGE.sims, res = judgeSim(world, who, shot, view), got = worthOf(res, who, true), s1 = JUDGE.sims, best = bestShots(world, who, view), top = best[0] || null, s2 = JUDGE.sims;
    // the line meant, and how hard it was (for a shot made: its own; missed: the nearest that comes off), and what it was
    // worth as meant - the best is at least that (a way the candidates missed)
    const meant = res.made ? { da: 0, V: shot.V, a: shot.a, res, why: null } : intentOf(world, who, shot, view);
    const aimed = meant ? { ...shot, angle: shot.angle + meant.da, V: meant.V, a: meant.a } : null;
    const line = aimed ? windowOf(world, who, aimed, view) : null;
    const s3 = JUDGE.sims, asMeant = line ? expectOf(world, who, { ...aimed, angle: line.centre }, view, JUDGE.SAMPLES, [[kindOf(res), got.v]], true).e : -Infinity;
    const B = Math.max(top ? top.e : got.v, asMeant), A = got.v, loss = B - A;
    // a fluke: made through something no one plays for - a kiss, a ball other than the one met first - and the shot as
    // played is no line (nudge the aim and it is gone)
    const ev = res.ev, potted = (ev.pocketed || []).map(p => p.id).filter(id => id !== 0);
    // (the kiss that made it - before the point: a kiss after it, or the shot played as a line, is no luck - owner 11-19)
    const odd = g.P.POCKETED ? potted.length && ev.firstHit != null && !potted.includes(ev.firstHit) || ev.kissPre > 0 && line && line.p < 0.15 : ev.kissPre > 0;
    /* 행운 (owner 11-25): whether this player meant the kiss - read by the seeing AI (64-see-mind.js seeKiss, at the
       shooter's rating: played.rating): the ways a player of that rating sees and plays, and which of them the aim was
       for (inverse planning); a kiss way likely not meant - luck; likely meant - none; between - nothing said ("애매하면
       표시 x"). A stroke that comes off with the balls standing still (the kiss did not make it) is no luck. With no kiss
       to read (none found again), the window as before. */
    const R = Number.isFinite(played.rating) ? played.rating : null;
    const meantKiss = res.made && odd ? seeKiss(world, who, shot, view, R) : null;
    const fluke = !!(res.made && odd && (meantKiss ? !meantKiss.right && meantKiss.p < SEE.LUCK : (!line || line.p < 0.3)));
    const cuts = JUDGE.CUTS[game] || JUDGE.CUTS.pool, hard = JUDGE.HARD[game] || 0.4;
    const bestLeave = best.filter(k => k.nominal.made && k.worth).reduce((m, k) => Math.max(m, k.worth.mine), 0);
    /* (owner 11-18) A shot that came off is graded by what it left: the next shot set (실용성 high) - 좋음; and the line
       hard besides (예술 점수 high) - 예술; the next shot left poor - 무난, however well the ball went in. The frame won is
       the best leave there is. A miss by what it cost (B - A): a pot or a point tried and missed is at best 무난; only a
       safety meant as one, nowhere near a line that scores, can be 좋음. */
    // (the last point before the other's 후구: good when it denies about as much as the best way to make it would - a 4구
    // table is rarely bare, so not by a floor)
    const practical = res.won || res.tie || res.made && (res.pass ? got.mine >= bestLeave - 0.2 : got.mine >= Math.max(0.4, 0.7 * bestLeave));
    /* (예술, as the house style has it - owner 11-19: '일반적인 샷으로는 득점할 길이 막혀 있었을 때': a hard line is art only
       where no ordinary line - one without a raised cue - was a fair chance; a hard line played past an easy one is not) */
    const open = best.filter(k => k.nominal.made && k.line.kind !== 'safety' && !/^(masse|jump|curve)$/.test(k.line.kind)).reduce((m, k) => Math.max(m, k.p || 0), 0);
    const blocked = open < (g.P.POCKETED ? 0.5 : 0.45);
    const art = res.made && !fluke && practical && !!line && line.p <= hard && blocked;
    let grade = res.made && !res.foul ? (art ? 0 : practical ? 1 : 2) : loss <= cuts[0] ? 1 : loss <= cuts[1] ? 2 : loss <= cuts[2] ? 3 : 4;
    if (!res.made && meant && grade < 2) grade = 2;
    // (a miss that ends the game - the 후구 not caught up, a third foul in 9볼 - is never good, whatever the table offered)
    if (!res.made && res.lost && grade < 3) grade = 3;
    // (a foul that costs - a ball in hand, a point - is never good: only 4구 played without the minus treats it as a miss)
    if (res.foul && grade < 3 && !(g.modeId === 'four' && !g.minus)) grade = 3;
    // why it missed, for the words: the aim (thick or thin), the pace (soft or hard), the tip - or a better way
    let cause = null, picture = null;
    const fr = res.r || {}, legal = g.mode.legal(view, who);
    if (res.foul) cause = fr.scratch ? 'scratch' : res.ev.off && res.ev.off.length ? 'off' : res.ev.firstHit == null ? 'nohit' : !legal.includes(res.ev.firstHit) || /먼저|상대 공/.test(fr.foul || '') ? 'wrong' : /쿠션/.test(fr.foul || '') ? 'norail' : 'foul';
    else if (!res.made && meant) {
      if (meant.why === 'pace') cause = meant.V > shot.V ? 'soft' : 'hard';
      else if (meant.why === 'tip') cause = 'tip';
      else {
        const first = meant.res.ev.firstHit, T = first != null ? world.balls[first] : null, c = shot.pos ? { x: shot.pos[0], y: shot.pos[1] } : world.balls[world.cue];
        if (T && c) { const centre = Math.atan2(T.y - c.y, T.x - c.x), off = x => Math.abs(Math.atan2(Math.sin(x - centre), Math.cos(x - centre))); cause = off(shot.angle) > off(shot.angle + meant.da) ? 'thin' : 'thick'; }
        else cause = 'aim';
      }
      // (a kiss on the way - the shot as played was the line, near enough: the kiss took it - owner 11-19 '키스 때문에 다 된
      // 공을 놓쳤습니다')
      if (res.ev.kissPre > 0 && meant.why === 'aim' && Math.abs(meant.da) <= 0.012) cause = 'kiss';
      /* (the picture: the aim lies in a way this player pictures coming off - past what the guide shows, cushions after
         the first ball, a kick, a bank - and the real way is elsewhere: the miss is in the picture, not the hand -
         64-see-mind.js seeMisread at the shooter's rating; said when the lean is more than their hand's spread) */
      // (a way the guide shows whole - a plain cut, a point with no cushion - is pictured as it is: no lean to find)
      if (R != null && /^(thick|thin|aim)$/.test(cause || '') && !(shot.el > 0.3)) {
        const mr = seeMisread(world, who, shot, R), sg = seeHand(R, shot).aim;
        if (mr && Math.abs(mr.lean) >= Math.max(0.0026, 1.5 * sg)) { cause = 'picture'; picture = { leanDeg: Math.round(mr.lean * 1800 / Math.PI) / 10, fixDeg: Math.round(mr.fix * 1800 / Math.PI) / 10 }; }
      }
    }
    // 불운 (owner 11-25): a line that would have come off - with the balls standing still it does (seeKiss: right) -,
    // spoilt by a kiss this player likely did not see coming (one they would have seen - on the ball's own line - is
    // theirs to have played round)
    const kissed = cause === 'kiss' ? seeKiss(world, who, shot, view, R) : null, unlucky = !!kissed && kissed.spoiled && kissed.seen < SEE.LUCK;
    const swing = swingOf(world, who), better = top && top.e - Math.max(asMeant, res.made ? A : -Infinity) > JUDGE.BETTER * swing ? top : null;
    /* where the shot lost what it lost (as golf's Strokes Gained is split by kind of shot, 11-18): the way chosen (the best
       expected against the one meant), the striking (meant against what came, a miss), the next shot (a ball made, the
       leave against the best one), a foul. Inside only: the review draws them as bars, never as numbers. */
    const parts = res.foul ? { choice: 0, strike: 0, next: 0, foul: Math.max(0, loss) } : {
      choice: asMeant > -Infinity ? Math.max(0, B - asMeant) : Math.max(0, loss), strike: !res.made && asMeant > -Infinity ? Math.max(0, asMeant - A) : 0,
      next: res.made && !res.won ? Math.max(0, winOf(res.world, who, res.r, bestLeave) - got.v) : 0, foul: 0 };
    for (const k in parts) parts[k] = Math.round(parts[k] * 100) / 100;
    /* the other ways (owner 11-18: several to pick from, the easiest marked): the best few judged closely, one of each way
       of playing it, the ones near the best (or a safety when that is the best there is), best first */
    /* what the shot meant (62-intent.js): the line - the shot itself when made, else the nearest that comes off, at the
       middle of its window -, the ball and pocket or the route, and where its stroke was sending the cue ball (shape:
       the stroke at paces round its own); a safety when no line was near and it left the other little; the facts of it */
    // (the window's middle, or - when that misses, the window being lopsided - the success the search found)
    const aimC = line ? { ...aimed, angle: line.centre } : null, cRes = !res.made && aimC ? judgeSim(world, who, aimC, view) : null, cOk = !!cRes && clean(cRes);
    const asShot = res.made ? shot : cOk ? aimC : aimed, meantRes = res.made ? res : cOk ? cRes : meant ? meant.res : null;
    const shape = asShot && meantRes && meantRes.made && !meantRes.won ? shapeOf(world, who, asShot, view) : null;
    const facts = factsOf(world, who, asShot || shot, meantRes && meantRes.made ? meantRes : res, view, shape);
    // (the ball potted and where; through another - a combination or a kiss - that other, the ball met first, as via)
    const potOf = rr => { const f = rr.ev.firstHit, q = (rr.ev.pocketed || []).find(x => x.id === f) || (rr.ev.pocketed || []).find(x => x.id !== 0); return q ? { id: q.id, pocket: q.pocket, via: q.id !== f ? f : null } : null; };
    const intent = { kind: meant ? 'score' : !res.foul && !res.made && !res.lost && got.theirs < 0.25 ? 'safety' : 'none',
      target: meantRes && meantRes.made ? (g.P.POCKETED ? potOf(meantRes) : { first: meantRes.ev.firstHit, second: meantRes.ev.hits[1] }) : null,
      route: !g.P.POCKETED && meantRes && meantRes.made ? routeOf(meantRes.ev) : null, shape };
    const base = meant ? { facts, p: line ? line.p : null, leave: res.made ? got.mine : shape && shape.own ? shape.own.v : 0 } : null;
    const alts = [], used = new Set();
    for (const k of best.slice().sort((x, y) => y.e - x.e)) {
      if (alts.length >= 4 || used.has(k.style.key) || !(k.nominal.made || k.line.kind === 'safety') || top && k.e < top.e - JUDGE.NEAR * swing) continue;
      used.add(k.style.key);
      const sh = g.P.POCKETED && k.nominal.made && !k.nominal.won ? shapeOf(world, who, k.shot, view) : null;
      const a = { way: k.style.way, kind: k.line.kind, id: k.line.id, via: k.line.via, pocket: k.line.pocket, p: Math.round(k.p * 100) / 100, shot: k.shot,
        d: describe(world, who, k.shot, k.nominal), next: nextBall(k.nominal, who), best: k === top, pass: !!k.nominal.pass, leave: r2(k.worth.mine), facts: factsOf(world, who, k.shot, k.nominal, view, sh) };
      a.why = whyBetter(a, base); alts.push(a);
    }
    /* (the easiest, as a person sees it - owner 11-19: '쿠션이 적을수록, 회전이 예상 가능할수록' - the middle of the cue ball
       goes where the aim line says, a cushion and a side tip each add a guess: the chance the reference hand has, worth less
       by each cushion, side tip and raised cue; a safety only when no line scores) */
    const ease = a => { const d = a.d || {}; return a.kind === 'safety' ? -1 : a.p * Math.pow(0.78, (d.cushions || 0) + (d.pre || 0)) * (1 - 0.4 * Math.abs(d.a || 0)) * (1 - 0.15 * Math.abs(d.b || 0)) * (d.el > 15 ? 0.5 : 1); };
    if (alts.length) { const e = alts.reduce((m, a) => ease(a) > ease(m) ? a : m, alts[0]); e.easiest = true; }
    return {
      parts, alts, practical, intent, facts,
      d: describe(world, who, shot, res), next: nextBall(res, who),
      md: meant && !res.made && line ? describe(world, who, { ...aimed, angle: line.centre }, judgeSim(world, who, { ...aimed, angle: line.centre }, view)) : null,
      // (the shot as it should have been played - the review's 교정한 샷 보기: the meant line at its window's middle when that
      // comes off, else the nearest success found)
      fix: meant && !res.made ? (cOk ? aimC : aimed) : null,
      cost: { shot: s1 - s0, best: s2 - s1, meant: s3 - s2, all: JUDGE.sims - s0 },
      blocked, forced: res.pass ? forcedOf(res, who) : null, rule: ruleOf(view, who, res),
      near: !res.made && !res.foul && meantRes && meantRes.made ? nearOf(world, who, shot, meantRes) : null,
      // (pool: how far the cue ball sat from the nearest cushion before the shot and after - '쿠션에서 떼어', '쿠션에 붙었습니다')
      rail: g.P.POCKETED && res.made ? (() => { const c0 = shot.pos ? { x: shot.pos[0], y: shot.pos[1] } : world.balls[0], c1 = res.world.balls[0], to = b => b && b.on !== false ? r2(Math.min(g.P.HL - Math.abs(b.x), g.P.HW - Math.abs(b.y)) - g.P.R) : null;
        return { before: to(c0), after: to(c1) }; })() : null,
      grade, fluke, unlucky, kissMeant: meantKiss ? meantKiss.p : null, made: res.made, foul: res.foul, won: res.won, lost: res.lost, pass: !!res.pass, tie: !!res.tie, theirs: res.made && got.theirs != null ? r2(got.theirs) : null, game,
      // (inside only - never shown as numbers: the shot's worth against the best, how hard the line was, the leaves)
      loss: Math.round(loss * 100) / 100, B: Math.round(B * 100) / 100, A: Math.round(A * 100) / 100,
      p: line ? Math.round(line.p * 100) / 100 : null, meant: !!meant, off: line ? Math.round((line.centre - shot.angle) / JUDGE.SIG_A * 10) / 10 : null, offDeg: line ? Math.round((line.centre - shot.angle) * 1800 / Math.PI) / 10 : null, cause, picture,
      leave: Math.round((res.made ? got.mine : got.theirs) * 100) / 100, bestLeave: Math.round(bestLeave * 100) / 100,
      better: better ? { shot: better.shot, kind: better.line.kind, id: better.line.id, pocket: better.line.pocket, p: Math.round(better.p * 100) / 100, safety: better.line.kind === 'safety',
        same: !!meant && better.line.id === meant.res.ev.firstHit && (!g.P.POCKETED || (meant.res.ev.pocketed || []).some(q => q.id === better.line.id && q.pocket === better.line.pocket)),
        easier: better.p - (line ? line.p : 0) > 0.2, leave: Math.round((better.nominal.made ? better.worth.mine : better.worth.theirs) * 100) / 100 } : null,
    };
  }
