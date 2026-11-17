  /* ================= the shot judge (owner 11-17 night: 'the base of the game') =================
     How good a shot was, measured - not guessed. Everything here rests on one number: the chance that a shot comes off
     for one fixed hand, the reference hand (JUDGE.SIG_*: how far its aim, pace and tip stray). The owner's rule: no
     allowance for beginners - a shot is as hard as it is, for everyone. (As PickPocket and pooltool measure a shot: play
     it many times with that hand's wobble, count the share that succeeds.)
       a line     - one way to succeed: a ball and a pocket (pool), a first ball and a stroke (carom), and how wide the
                    window of aim is that makes it - its chance for the reference hand (erf of half the window over its aim
                    spread; pool: worked out from the geometry, carom: found by sweeping the aim on copies of the table)
       a leave    - what a table offers whoever shoots next: its three best lines, 1 : 0.33 : 0.15 (PickPocket), 0..1
       a result's worth - made: 1 + JUDGE.GAMMA x the leave for me; not made: - JUDGE.GAMMA x the leave for the other;
                    a frame won or lost: +-JUDGE.WIN (in 'shots': a point now, and what comes next)
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
    GAMMA: 0.9,         // a leave against a point made now
    WIN: 2.5,           // a frame won (or lost) on the shot
    TOP: [1, 0.33, 0.15],
    // the grade from B - A, by table: [좋음, 무난, 아쉬움] upper bounds (above the last: 실수)
    CUTS: { pool: [0.35, 0.8, 1.4], carom: [0.35, 0.8, 1.4] },
    // a line this hard or harder for the reference hand is a hard one (예술 asks for it)
    HARD: { pool: 0.35, snooker: 0.35, four: 0.25, three: 0.12 },
    SAMPLES: 16,
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
    const off = ev.off && ev.off.length, won = r.win === who && !off, lost = r.win === 1 - who || !!off && !r.foul;
    const made = !off && !r.foul && (r.keep || r.pts > 0 || won);
    return { ev, r, world: w, made, won, lost, foul: !!r.foul || !!off };
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

  /* ---- carom: the lines a table offers, found by playing them ----
     For each ball that may be met first, the aim is swept across it (thin one side to thin the other) with the game's
     usual strokes; each run of aims that scores is a line, its window refined at both ends, its chance the reference
     hand's - and a little less if a firmer or softer stroke would lose it. */
  const caromStrokes = full => {
    const three = g.modeId === 'three' && (g.cushions || 0) >= 3, V = x => x * (three ? 5.0 : 3.3) * PACE.carom;
    if (three) return (full ? [[1, 0.45, 0.15], [1, -0.45, 0.15], [1.25, 0.45, -0.25], [1.25, -0.45, -0.25], [0.85, 0, 0.3]] : [[1.1, 0.4, 0.1], [1.1, -0.4, 0.1]]).map(([v, a, b]) => ({ V: V(v), a, b }));
    return (full ? [[0.85, 0, 0], [1.1, 0, 0.3], [1.1, 0, -0.3], [1.25, 0.35, 0]] : [[1, 0, 0.15]]).map(([v, a, b]) => ({ V: V(v), a, b }));
  };
  function caromLines(world, who, view, full) {
    const P = g.P, c = world.balls[who], out = [], steps = full ? 26 : (g.modeId === 'three' ? 11 : 14);
    if (!c || !c.on) return out;
    const ids = g.mode.legal(view, who).filter(id => world.balls[id] && world.balls[id].on);
    const scores = shot => judgeSim(world, who, shot, view).made;
    for (const id of ids) {
      const T = world.balls[id], d = Math.hypot(T.x - c.x, T.y - c.y); if (d < 2 * P.R * 1.01) continue;
      const base = Math.atan2(T.y - c.y, T.x - c.x), half = Math.asin(Math.min(0.99, 2 * P.R / d)) * 0.985;
      for (const st of caromStrokes(full)) {
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

  // what the table offers whoever shoots next: its best three lines, one per ball (pool) or per ball and stroke (carom)
  function leaveOf(world, who, r, inHand) {
    const view = judgeView(world, who, r, inHand);
    if (!g.P.POCKETED) { const c = world.balls[who]; if (!c || !c.on) return 0; }
    const lines = g.P.POCKETED ? potLines(world, who, view, inHand) : caromLines(world, who, view, false), seen = new Set(), ps = [];
    for (const l of lines) { const key = g.P.POCKETED ? l.id : l.id + ':' + Math.round(l.a * 10) + ':' + Math.round(l.b * 10); if (seen.has(key)) continue; seen.add(key); ps.push(l.p); if (ps.length === 3) break; }
    return ps.reduce((s, p, i) => s + p * JUDGE.TOP[i], 0) / (JUDGE.TOP[0] + JUDGE.TOP[1] + JUDGE.TOP[2]);
  }
  // a result's worth for the one who played it, and the two leaves in it
  function worthOf(res, who) {
    if (res.won) return { v: JUDGE.WIN, mine: 1, theirs: 0 };
    if (res.lost) return { v: -JUDGE.WIN, mine: 0, theirs: 1 };
    if (res.made) { const mine = leaveOf(res.world, who, res.r, false); return { v: 1 + JUDGE.GAMMA * mine, mine, theirs: 0 }; }
    const inHand = res.foul && g.mode.ballInHand, theirs = leaveOf(res.world, 1 - who, res.r, inHand);
    // a foul that gives points (스누커, 4구's -1) costs them besides
    const give = res.r.give ? Math.min(1, res.r.give / 4) : res.r.pts < 0 ? 1 : 0;
    return { v: -JUDGE.GAMMA * theirs - give, mine: 0, theirs };
  }
  // a shot's expected worth for the reference hand: played with its wobble, JUDGE.SAMPLES times. (The worth of a result is
  // read once per kind - won, lost, made, fouled, missed - from the first of its kind, or given: the leaves are the costly
  // part, and results of a kind lie close together.)
  function expectOf(world, who, shot, view, n = JUDGE.SAMPLES, known) {
    let sum = 0, made = 0; const ws = new Map(known || []);
    for (let i = 0; i < n; i++) {
      const [ea, ev, es] = JUDGE_WOBBLE[i];
      const res = judgeSim(world, who, { ...shot, angle: shot.angle + ea * JUDGE.SIG_A, V: shot.V * (1 + ev * JUDGE.SIG_V), a: (shot.a || 0) + es * JUDGE.SIG_S }, view);
      const kind = res.won ? 'w' : res.lost ? 'l' : res.made ? 'm' : res.foul ? 'f' : 'x';
      if (!ws.has(kind)) ws.set(kind, worthOf(res, who).v);
      sum += ws.get(kind); if (res.made) made++;
    }
    return { e: sum / n, p: made / n };
  }
  const kindOf = res => res.won ? 'w' : res.lost ? 'l' : res.made ? 'm' : res.foul ? 'f' : 'x';

  /* ---- the best a shot here could bring: candidate strokes, each judged by its expected worth ---- */
  function bestShots(world, who, view) {
    const P = g.P, cands = [];
    if (P.POCKETED) {
      const lines = potLines(world, who, view, !!g.placing).slice(0, 8);
      for (const l of lines) {
        const need = 0.9 + 1.4 * Math.sqrt(l.s + l.L * (l.kind === 'bank' ? 1.6 : 1) / Math.max(0.35, Math.cos(l.cut)));
        for (const k of [0.75, 1, 1.35]) for (const b of [0.35, 0, -0.35]) cands.push({ line: l, shot: { pos: l.pos, angle: l.angle, V: Math.min(g.vOf(1) * 0.95, need * k * PACE.pool), a: 0, b, el: 0 } });
      }
      // a safety: the first legal ball met softly, a few ways, for when nothing is on
      const c = world.balls[0];
      for (const id of g.mode.legal(view, who).filter(i => world.balls[i] && world.balls[i].on).slice(0, 4)) {
        const T = world.balls[id], base = Math.atan2(T.y - c.y, T.x - c.x), d = Math.hypot(T.x - c.x, T.y - c.y), half = Math.asin(Math.min(0.99, 2 * P.R / d));
        if (g.placing || !P.pathClear(world, c.x, c.y, T.x, T.y, [0, id])) continue;
        for (const f of [-0.75, 0, 0.75]) for (const V of [0.9, 1.6]) cands.push({ line: { id, kind: 'safety', p: 0 }, shot: { pos: null, angle: base + half * f, V: V * PACE.pool * (1 + d), a: 0, b: 0, el: 0 } });
      }
    } else {
      for (const l of caromLines(world, who, view, true).slice(0, 10)) cands.push({ line: l, shot: { pos: null, angle: l.angle, V: l.V, a: l.a, b: l.b, el: 0 } });
    }
    // each stroke as aimed (one copy each); the likeliest looked at more closely - its worth, then the reference hand's
    // wobble on the best few
    for (const k of cands) { k.nominal = judgeSim(world, who, k.shot, view); k.guess = k.nominal.made ? k.line.p : k.line.kind === 'safety' && !k.nominal.foul ? 0.05 : -1; }
    cands.sort((a, b) => b.guess - a.guess);
    const near = cands.slice(0, P.POCKETED ? 12 : 4).filter(k => k.guess > -1);
    for (const k of near) {
      k.worth = worthOf(k.nominal, who);
      k.guess = k.nominal.made ? k.line.p * k.worth.v - (1 - k.line.p) * JUDGE.GAMMA * 0.5 : k.worth.v;
    }
    near.sort((a, b) => b.guess - a.guess);
    const top = near.slice(0, P.POCKETED ? 5 : 2);
    for (const k of top) { const x = expectOf(world, who, k.shot, view, JUDGE.SAMPLES, [[kindOf(k.nominal), k.worth.v]]); k.e = x.e; k.p = x.p; }
    top.sort((a, b) => b.e - a.e);
    return top;
  }

  /* ---- what the player meant: the nearest success to what was played ---- */
  const JUDGE_STEPS = [0.0007, 0.0014, 0.0021, 0.003, 0.0042, 0.0056, 0.0075, 0.01, 0.0135, 0.018, 0.024, 0.032, 0.043, 0.057];
  function intentOf(world, who, shot, view) {
    const tries = (V, a) => { for (const d of JUDGE_STEPS) for (const s of [1, -1]) { const res = judgeSim(world, who, { ...shot, angle: shot.angle + s * d, V, a }, view); if (res.made) return { da: s * d, V, a, res }; } return null; };
    let hit = tries(shot.V, shot.a || 0); if (hit) return { ...hit, why: 'aim' };
    for (const k of [0.82, 1.22, 0.6, 1.6, 0.4, 2.4]) { hit = tries(Math.min(g.vOf(1), shot.V * k), shot.a || 0); if (hit) return { ...hit, why: 'pace' }; }
    if (Math.abs(shot.a || 0) > 0.25) { hit = tries(shot.V, 0); if (hit) return { ...hit, why: 'tip' }; }
    return null;
  }
  // a line's own window around an aim that makes it: its two ends (the aim moved each way until it no longer comes off)
  function windowOf(world, who, shot, view) {
    const ok = da => judgeSim(world, who, { ...shot, angle: shot.angle + da }, view).made;
    const end = s => { let lo = 0, hi = 0.004; while (hi < 0.08 && ok(s * hi)) { lo = hi; hi *= 2; } for (let n = 0; n < 5; n++) { const m = (lo + hi) / 2; if (ok(s * m)) lo = m; else hi = m; } return lo; };
    const up = end(1), down = end(-1), half = (up + down) / 2, centre = shot.angle + (up - down) / 2;
    let p = winChance(half);
    if (p > 0.05) { const keep = [0.88, 1.12].filter(k => judgeSim(world, who, { ...shot, angle: centre, V: shot.V * k }, view).made).length; p *= [0.55, 0.8, 1][keep]; }
    return { p, half, centre };
  }

  /* ---- the whole: one shot judged ----
     played: { pos, angle, V, a, b, el } on the table as it is (g: the game before the shot, g.turn the one who played). */
  function judgeShot(played) {
    if (g.isBreak && g.P.POCKETED) return null;            // (a break is not judged: it is a break)
    const who = g.turn, world = g.world, view = judgeView(world, who, null, !!g.placing);
    const game = !g.P.POCKETED ? g.modeId : g.mode.table === 'snooker' ? 'snooker' : 'pool';
    const shot = { pos: played.pos || null, angle: played.angle, V: played.V, a: played.a || 0, b: played.b || 0, el: played.el || 0 };
    const s0 = JUDGE.sims, res = judgeSim(world, who, shot, view), got = worthOf(res, who), s1 = JUDGE.sims, best = bestShots(world, who, view), top = best[0] || null, s2 = JUDGE.sims;
    // the line meant, and how hard it was (for a shot made: its own; missed: the nearest that comes off), and what it was
    // worth as meant - the best is at least that (a way the candidates missed)
    const meant = res.made ? { da: 0, V: shot.V, a: shot.a, res, why: null } : intentOf(world, who, shot, view);
    const aimed = meant ? { ...shot, angle: shot.angle + meant.da, V: meant.V, a: meant.a } : null;
    const line = aimed ? windowOf(world, who, aimed, view) : null;
    const s3 = JUDGE.sims, asMeant = line ? expectOf(world, who, { ...aimed, angle: line.centre }, view, JUDGE.SAMPLES, [[kindOf(res), got.v]]).e : -Infinity;
    const B = Math.max(top ? top.e : got.v, asMeant), A = got.v, loss = B - A;
    // a fluke: made through something no one plays for - a kiss, a ball other than the one met first - and the shot as
    // played is no line (nudge the aim and it is gone)
    const ev = res.ev, potted = (ev.pocketed || []).map(p => p.id).filter(id => id !== 0);
    const odd = g.P.POCKETED ? potted.length && ev.firstHit != null && !potted.includes(ev.firstHit) || ev.kiss > 0 && line && line.p < 0.15 : ev.kiss > 0;
    const fluke = !!(res.made && odd && (!line || line.p < 0.3));
    const cuts = JUDGE.CUTS[g.P.POCKETED ? 'pool' : 'carom'], hard = JUDGE.HARD[game] || 0.4;
    const bestLeave = best.filter(k => k.nominal.made && k.worth).reduce((m, k) => Math.max(m, k.worth.mine), 0);
    const art = res.made && !fluke && !res.won && line && line.p <= hard && loss <= 0.05 && got.mine >= Math.max(0.4, 0.7 * bestLeave)
      || res.won && !fluke && line && line.p <= hard;
    let grade = art ? 0 : loss <= cuts[0] ? 1 : loss <= cuts[1] ? 2 : loss <= cuts[2] ? 3 : 4;
    // a pot (or a point) tried and missed is at best 무난, however little it cost: only a shot that came off - or a safety
    // meant as one, nowhere near a line that scores - is 좋음
    if (!res.made && meant && grade < 2) grade = 2;
    // why it missed, for the words: the aim (thick or thin), the pace (soft or hard), the tip - or a better way
    let cause = null;
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
    }
    const better = top && top.e - Math.max(asMeant, res.made ? A : -Infinity) > 0.3 ? top : null;
    return {
      cost: { shot: s1 - s0, best: s2 - s1, meant: s3 - s2, all: JUDGE.sims - s0 },
      grade, fluke, made: res.made, foul: res.foul, won: res.won, lost: res.lost, game,
      // (inside only - never shown as numbers: the shot's worth against the best, how hard the line was, the leaves)
      loss: Math.round(loss * 100) / 100, B: Math.round(B * 100) / 100, A: Math.round(A * 100) / 100,
      p: line ? Math.round(line.p * 100) / 100 : null, meant: !!meant, off: line ? Math.round((line.centre - shot.angle) / JUDGE.SIG_A * 10) / 10 : null, cause,
      leave: Math.round((res.made ? got.mine : got.theirs) * 100) / 100, bestLeave: Math.round(bestLeave * 100) / 100,
      better: better ? { shot: better.shot, kind: better.line.kind, id: better.line.id, pocket: better.line.pocket, p: Math.round(better.p * 100) / 100, safety: better.line.kind === 'safety',
        same: !!meant && better.line.id === meant.res.ev.firstHit && (!g.P.POCKETED || (meant.res.ev.pocketed || []).some(q => q.id === better.line.id && q.pocket === better.line.pocket)),
        easier: better.p - (line ? line.p : 0) > 0.2, leave: Math.round((better.nominal.made ? better.worth.mine : better.worth.theirs) * 100) / 100 } : null,
    };
  }
