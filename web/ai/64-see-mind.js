  /* ================= 보는 AI v2 - a player of a rating looking at the table (owner 11-25 night; project doc §8) =================
     What the physics finds and what a person finds are two things (owner 11-25: "AI의 퍼즐과 사람이 길을 보는 퍼즐의 괴리"):
     the physics tries every aim; a person pictures a few ways, and pictures each with a model of the game that is right
     where the game shows it and guessed where it does not. Built from that, in five parts:
       ① 떠올리기  which ways come to mind (seeIdea): what the way asks one to picture - cushions past what the guide shows,
                   a ball first off a cushion, a bank, a combination, a kiss, spin, a raised cue - as a rating where half of
                   the players think of it (MIND.FIND; the puzzle AI's, now shared)
       ② 예상하기  what one expects a stroke to do (seeMindEv): exactly what the guide shows (GUIDE_STD, scene/90-frame.js:
                   the cue ball's way to its first contact; past a ball, 0.16 m of its real way; past a cushion, a straight
                   stub, angle in = angle out; the object ball's first few cm), and past that a picture - straight lines and
                   mirror cushions (the naive model) corrected by a share s(R) of what the real game adds: the curve that
                   follow, draw and side put on the way, a cushion's angle off the mirror, how far a drawn ball comes back
                   (seeComp: the compensation skill, a logistic in R). s = 0 is the guide extended by a ruler; s = 1 is the
                   game itself (the true way, the other balls standing where they stand)
       ③ 고르기    which seen way one plays (seeChoose): a logit over the ways seen - each weighed by the chance it came to
                   mind and by how sure the player is of it (its window as pictured, the player's own hand) - sharper the
                   higher the rating
       ④ 손        the stroke as struck (seeHand): aim, pace and tip each off by a normal error that halves every 400 points
                   (the puzzle lab's hand: SIG), a raised cue's aim and tip RAISED times less sure; where one aims is the
                   middle of the way as pictured - so a picture that is off moves every stroke, and that is the bias
       ⑤ 거꾸로 읽기 the way a stroke was meant for (seeInverse): Bayes over the ways a player of that rating would see and
                   play (Baker, Saxe & Tenenbaum's inverse planning) - prior ③, likelihood ④ about each way's pictured middle;
                   a kiss way read from v1's visibility (63-see.js kissStory/kissSeen) - so a kiss is luck to one who would
                   not have seen it and a shot to one who would (행운 / 불운 / nothing said)
     Everything is played on the game's own physics (a copy, step by step - seeRecord) and judged by the game's own rules -
     the true outcome by the true events, the pictured one by the events the picture makes (a mental ev, judged the same).
     The numbers are set by hand from what each thing is; the attempts players make (puzzles, ranked records) fit them
     (the Fit workflow, plan §8-3). */
  const MIND = {
    COMP: 1200, COMP_W: 160,              // seeComp: half of the real game's effects pictured at COMP, the logistic's width
    VIS_RAIL: 0.16, VIS_STUB: 0.14,       // the guide (GUIDE_STD 0.5 = grow 1): the cue ball's real way past a ball; the stub off a cushion
    DL: 0.02,                             // the pictured way's step, metres
    ROLL: { true: 0.098, false: 0.0686 }, // the cloth's hold on a rolling ball, m/s^2 (physics MU_R0 x g), by P.POCKETED
    CUSH_KEEP: 0.88,                      // pace kept off a cushion where the picture runs on its own (past the true way)
    IMPACT: 33,                           // aims across a ball: so many, thin to thin
    SIG_V: 0.03, SIG_T: 0.05,             // the hand at 1500: pace (a share of it) and tip (in the -1..1 of a, b) - SEE.AIM_1500 the aim
    RAISED: 2.2,                          // a raised cue's aim and tip so much the less sure (JUDGE.RAISED)
    // ① a way's rating to come to mind: where half the players of that rating think of it (the puzzle AI's FIND, 11-24 -
    // puzzles' first attempts fit it: tools/puzzles/fit.js), and the logistic's width
    FIND: {
      four: { base: 300, cushion: 170, side: 110, fb: 60, raised: 380, wall: 140, shape: 70, need: 110, gather: 260, bank: 60, three: 120, direct: 40, turn: 220, combo: 230, kiss: 260, len: 60, graze: 80, curved: 90, common: -100 },
      pocket: { base: 240, kick: 170, bank: 220, combo: 230, side: 100, fb: 50, raised: 380, wall: 130, shape: 70, need: 110, extra: 180, keep: 80, turn: 200, kiss: 260, len: 60, graze: 80, curved: 90, common: 0 },
    },
    // (len: each metre the picture runs past the first; graze: a ball it passes within 3.2 radii of; curved: a curved
    // cushion it comes off; common: a shape known by name)
    W: 120,
    BETA: [4, 12],                        // ③ the logit's sharpness: BETA[0] + BETA[1] x s(R)
    OTHER: 0.04,                          // ⑤ a stroke none of the ways explains: its prior weight
    LUCK: 0.35, MEANT: 0.65,              // (as v1: under LUCK not meant, over MEANT meant, between nothing said)
  };
  const seeComp = R => 1 / (1 + Math.exp(-((Number.isFinite(R) ? R : 1000) - MIND.COMP) / MIND.COMP_W));
  const seePhi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  // ④ the hand of a player of rating R on this stroke: one-sigma errors - aim (radians), pace (log share), tip
  /* (the error is the cue's angle's - the same at any distance: a long way is harder because the same error misses by
     more at its end, which the ways' own windows already say. What makes the hand itself less sure: a hard stroke - the
     arm moving fast - and the tip off the centre, as 50-human.js's pathFactor has it) */
  function seeHand(R, shot) {
    const k = Math.pow(2, (1500 - (Number.isFinite(R) ? R : 1000)) / 400), up = (shot && shot.el || 0) > 0.3 ? MIND.RAISED : 1;
    const pw = shot && shot.V ? g.powerOf(shot.V) : 0.5, tip = shot ? Math.hypot(shot.a || 0, shot.b || 0) : 0;
    const f = (1 + 0.5 * Math.max(0, pw - 0.6) / 0.4) * (1 + 0.4 * Math.min(1, tip / 0.8));
    return { aim: SEE.AIM_1500 * k * up * f, pace: MIND.SIG_V * k * (1 + 0.5 * Math.max(0, pw - 0.6) / 0.4), tip: MIND.SIG_T * k * up };
  }

  /* ---- the table as a picture is drawn on it: every face a ball's middle comes off (the table's cushions - P.SEGS, jaws
     and all -, a shaped table's faces, the barricades') and every hole it drops into ---- */
  const mindFaces = new WeakMap();
  function seeFaces(w) {
    const P = g.P, key = w.shape || w.walls || P;
    let m = mindFaces.get(key);
    if (m && m.P === P && m.walls === w.walls && m.shape === w.shape) return m;
    const segs = [];
    // (a pocket's jaws - each pool cushion's first and last face, physics build(): a ball off one is not a bank)
    P.SEGS.forEach((s, i) => segs.push({ ...s, kind: 'rail', edge: -1, jaw: P.POCKETED && i % 3 !== 1 }));
    // (a shaped table's curved cushion - a rail drawn in several straight pieces, tables.js rails; an island of many sides:
    // harder to see off than a straight one)
    const RL = w.shape && w.shape.spec && w.shape.spec.rails, isl = w.shape ? w.shape.islands || [] : [];
    const curved = e => e >= 1000 ? (isl[e - 1000] || []).length > 6 : !!RL && RL.of[e] != null && RL.edges[RL.of[e]].length > 1;
    if (w.shape) for (const f of w.shape.faces) segs.push({ ax: f.ax, ay: f.ay, bx: f.bx, by: f.by, len: f.len, tx: f.tx, ty: f.ty, kind: 'rail', edge: f.edge, curved: curved(f.edge) });
    for (const q of (w.walls || [])) for (const f of q.faces) segs.push({ ...f, kind: 'wall', edge: -1 });
    const holes = [];
    P.POCKETS.forEach((p, i) => holes.push({ x: p.x, y: p.y, r: p.sink * 0.8, id: i }));
    if (w.shape) w.shape.holes.forEach((h, i) => holes.push({ x: h.x, y: h.y, r: h.cut ? h.r * 0.95 : h.sink, id: 6 + i }));
    // (each face's box, grown by a ball: a step that does not reach it skips it)
    const R = P.R + 0.002; for (const q of segs) { q.x0 = Math.min(q.ax, q.bx) - R; q.x1 = Math.max(q.ax, q.bx) + R; q.y0 = Math.min(q.ay, q.by) - R; q.y1 = Math.max(q.ay, q.by) + R; }
    m = { P, walls: w.walls, shape: w.shape, segs, holes };
    mindFaces.set(key, m);
    return m;
  }
  // the first thing a ball's middle meets going from (x, y) along (dx, dy) within len: a ball (of `balls`: [id, x, y],
  // less those in skip), a face (its normal, towards the ball), a hole - or null
  function seeCast(F, balls, skip, x, y, dx, dy, len) {
    const R = g.P.R; let best = null, bt = len;
    for (const [id, bx, by] of balls) {
      if (skip.has(id)) continue;
      const fx = bx - x, fy = by - y, pr = fx * dx + fy * dy; if (pr <= 0) continue;
      const q = fx * fx + fy * fy - pr * pr; if (q >= 4 * R * R) continue;
      const t = pr - Math.sqrt(4 * R * R - q); if (t > 1e-7 && t < bt) { bt = t; best = { t, type: 'ball', ball: id, nx: (bx - (x + dx * t)) / (2 * R), ny: (by - (y + dy * t)) / (2 * R) }; }
    }
    const bx0 = Math.min(x, x + dx * len), bx1 = Math.max(x, x + dx * len), by0 = Math.min(y, y + dy * len), by1 = Math.max(y, y + dy * len);
    for (const s of F.segs) {
      if (s.x1 < bx0 || s.x0 > bx1 || s.y1 < by0 || s.y0 > by1) continue;
      for (const sg of [1, -1]) {
        const px = s.ax - s.ty * R * sg, py = s.ay + s.tx * R * sg, den = dx * s.ty - dy * s.tx;
        if (Math.abs(den) < 1e-12) continue;
        // (only the side the ball comes at: moving against that side's normal)
        const nx = -s.ty * sg, ny = s.tx * sg; if (dx * nx + dy * ny >= 0) continue;
        const t = ((px - x) * s.ty - (py - y) * s.tx) / den; if (t <= 1e-7 || t >= bt) continue;
        const u = (x + dx * t - px) * s.tx + (y + dy * t - py) * s.ty; if (u < 0 || u > s.len) continue;
        bt = t; best = { t, type: s.kind, nx, ny, seg: s };
      }
      for (const [ex, ey] of [[s.ax, s.ay], [s.bx, s.by]]) {
        const fx = ex - x, fy = ey - y, pr = fx * dx + fy * dy; if (pr <= 0) continue;
        const q = fx * fx + fy * fy - pr * pr; if (q >= R * R) continue;
        const t = pr - Math.sqrt(R * R - q); if (t > 1e-7 && t < bt) { const gx = x + dx * t, gy = y + dy * t; bt = t; best = { t, type: s.kind, nx: (gx - ex) / R, ny: (gy - ey) / R, seg: s }; }
      }
    }
    for (const h of F.holes) {
      const fx = h.x - x, fy = h.y - y, pr = fx * dx + fy * dy, q = fx * fx + fy * fy - pr * pr;
      if (fx * fx + fy * fy < h.r * h.r) return { t: 0, type: 'pocket', pocket: h.id };
      if (pr <= 0 || q >= h.r * h.r) continue;
      const t = pr - Math.sqrt(h.r * h.r - q); if (t > 1e-7 && t < bt) { bt = t; best = { t, type: 'pocket', pocket: h.id }; }
    }
    return best;
  }

  /* ---- the stroke played out on a copy, step by step, and kept as the picture needs it: for each ball that moved, its
     way from where it started - every step's heading change where nothing was met (the curve), and what it met where
     (a cushion: how far off the mirror it came away; a ball) - ---- */
  // judge(ev, w) -> { ok, foul }: the game's own word on a stroke (seeJudge) or a puzzle's
  function seeJudge(world, who, view) {
    const v = view || judgeView(world, who), c = g.mode.ctx(v);
    return (ev, w) => {
      const r = g.mode.evaluate(ev, c, { ...v, world: w }), off = ev.off && ev.off.length;
      return { ok: !off && !r.foul && (r.keep || r.pts > 0 || r.win === who), foul: !!r.foul || !!off };
    };
  }
  function seeRecord(world, who, shot, judge) {
    const P = g.P, R = P.R, w = P.clone(world); w.cue = P.POCKETED ? 0 : who; JUDGE.sims++;
    if (shot.pos) P.place(w, w.cue, shot.pos[0], shot.pos[1]);
    const start = w.balls.map(b => [b.id, b.x, b.y, b.on]), cue = w.cue, F = seeFaces(w);
    P.strike(w, shot.angle, shot.V, shot.a || 0, shot.b || 0, shot.el || 0);
    w.snd = [];
    /* raw, per ball that moved: a - [x, y, vx, vy] after each step from `from` (its first sample: where it stood, still -
       the cue ball's: struck); ev - what it met in a step: 'r' a cushion, 'w' a barricade, or a ball's id; end - how it
       stopped being followed: { v, pocket } */
    const raw = new Map(), prev = new Map();
    let n = 0, atStep = -1;
    const track = b => { let q = raw.get(b.id); if (!q) { const s0 = start[b.id]; q = { a: [s0[1], s0[2], 0, 0], ev: new Map(), end: null, from: n - 1 }; raw.set(b.id, q); } return q; };
    { const c = w.balls[cue]; raw.set(cue, { a: [c.x, c.y, c.vx, c.vy], ev: new Map(), end: null, from: 0 }); }
    for (let t = 0; t < 20 && !P.rest(w); t += 1 / 120) {
      for (const b of w.balls) if (b.on) prev.set(b.id, [b.vx, b.vy]);
      P.step(w, 1 / 120); n++;
      const evs = w.snd; w.snd = [];
      for (const s of evs) {
        if (s.t === 'rail') { const q = raw.get(s.id); if (q && !q.end) q.ev.set(n, 'r'); }
        else if (s.t === 'ball') for (const [i, j] of [[s.ia, s.ib], [s.ib, s.ia]]) { const q = track(w.balls[i]); if (!q.end && !q.ev.has(n)) q.ev.set(n, j); }
      }
      for (const b of w.balls) {
        let q = raw.get(b.id);
        if (!q) { if (!b.on || !(b.vx || b.vy)) continue; q = track(b); }
        if (q.end) continue;
        if (!b.on) { const pv = prev.get(b.id) || [0, 0], pk = w.ev.pocketed.find(p => p.id === b.id); q.end = { v: Math.hypot(pv[0], pv[1]), pocket: pk ? pk.pocket : null }; continue; }
        q.a.push(b.x, b.y, b.vx, b.vy);
        // (a barricade is told from a cushion by where the ball is: next to one of its faces)
        if (q.ev.get(n) === 'r' && w.walls && w.walls.length) for (const f of F.segs) if (f.kind === 'wall' && segDist(f, b.x, b.y) < R + 0.02) { q.ev.set(n, 'w'); break; }
      }
      if (atStep < 0 && w.ev.at) atStep = n;
    }
    for (const b of w.balls) { const q = raw.get(b.id); if (q && !q.end && b.on && (b.vx || b.vy)) q.end = { v: Math.hypot(b.vx, b.vy), pocket: null }; }
    // (kept as single floats - a sweep keeps thousands of strokes: a tenth of a micron is all a position loses)
    for (const q of raw.values()) q.a = Float32Array.from(q.a);
    const ev = w.ev, res = judge(ev, w);
    return { shot, ev, ok: !!res.ok, foul: !!res.foul, cue, start, at: ev.at ? { x: ev.at[0], y: ev.at[1], ball: ev.at[3], step: atStep } : null, raw, w, views: new Map(), minds: new Map() };
  }
  function segDist(s, x, y) { let u = (x - s.ax) * s.tx + (y - s.ay) * s.ty; u = u < 0 ? 0 : u > s.len ? s.len : u; return Math.hypot(x - s.ax - s.tx * u, y - s.ay - s.ty * u); }
  // the face a ball at (x, y) is against: [its normal towards the ball, the face]
  function faceNormal(F, x, y) {
    const R = g.P.R; let best = null, bd = R + 0.025;
    for (const s of F.segs) {
      let u = (x - s.ax) * s.tx + (y - s.ay) * s.ty; u = u < 0 ? 0 : u > s.len ? s.len : u;
      const ex = x - s.ax - s.tx * u, ey = y - s.ay - s.ty * u, d = Math.hypot(ex, ey);
      if (d < bd && d > 1e-9) { bd = d; best = [ex / d, ey / d, s]; }
    }
    return best;
  }
  /* A ball's true way as the picture reads it, from its record (the cue ball: from its first contact; another: from its
     start): in bins of DL along it, the heading change where nothing was met (kap) and the pace (spd); what it met, in
     order - evs: { l, kind: 'rail' | 'wall' | 'ball' | 'pivot', d } (a cushion: how far off the mirror it came away; a
     ball - the cue ball's first: off the tangent; a pivot - a drawn ball stopping and coming back -: its turn); how far
     it guides the picture (lv: to its second ball - the cue ball's first contact, or the ball that sent another, the
     first) and how far it would have run on
     (lb); the guide's reach (vis: the cue ball past a ball, 0.16 m on - its point and heading). */
  function seeView(rec, id) {
    if (rec.views.has(id)) return rec.views.get(id);
    const q = rec.raw.get(id); if (!q || q.a.length < 8) { rec.views.set(id, null); return null; }
    const P = g.P, F = seeFaces(rec.w), a = q.a, from = q.from, cue = id === rec.cue, N = a.length / 4;
    const i0 = cue ? Math.max(0, (rec.at ? rec.at.step : 0) - from - 1) : 0;
    // (the cue ball's way is measured from the point of its first contact - where the picture takes over - not from the
    // step before it)
    const pre = cue && rec.at ? Math.hypot(rec.at.x - a[4 * i0], rec.at.y - a[4 * i0 + 1]) : 0;
    const kap = [], spd = [], evs = []; let l = -pre, balls = 0, lv = null, vEnd = 0;
    const B = l => Math.max(0, Math.floor(l / MIND.DL));
    for (let i = i0; i < N - 1; i++) {
      const x0 = a[4 * i], y0 = a[4 * i + 1], x1 = a[4 * i + 4], y1 = a[4 * i + 5], u0x = a[4 * i + 2], u0y = a[4 * i + 3], u1x = a[4 * i + 6], u1y = a[4 * i + 7];
      const s0 = Math.hypot(u0x, u0y), s1 = Math.hypot(u1x, u1y), dl = Math.hypot(x1 - x0, y1 - y0), k = B(l + dl / 2);
      let e = q.ev.get(from + i + 1); if (!cue && i === 0 && typeof e === 'number') e = null;   // (another ball's first step: the hit that set it going)
      spd[k] = Math.max(spd[k] || 0, s1);
      if (e === 'r' || e === 'w') {
        // a cushion: the mirror of the way in about the face met, and how far off it the ball came away
        const fn = faceNormal(F, x1, y1);
        if (fn && s0 > 1e-4 && s1 > 1e-4) { const dn = u0x * fn[0] + u0y * fn[1], mx = u0x - 2 * dn * fn[0], my = u0y - 2 * dn * fn[1]; evs.push({ l: Math.max(0, l), kind: e === 'w' ? 'wall' : 'rail', d: wrapA(Math.atan2(u1y, u1x) - Math.atan2(my, mx)), edge: fn[2].edge, jaw: !!fn[2].jaw }); }
      } else if (typeof e === 'number') {
        balls++;
        if (balls >= 2) { lv = Math.max(0, l); vEnd = s0; break; }
        const o = rec.start[e], nx = o[1] - x0, ny = o[2] - y0, nl = Math.hypot(nx, ny) || 1, dn = (u0x * nx + u0y * ny) / nl, tx = u0x - dn * nx / nl, ty = u0y - dn * ny / nl;
        evs.push({ l: Math.max(0, l), kind: 'ball', ball: e, d: Math.hypot(tx, ty) > 1e-3 && s1 > 1e-4 ? wrapA(Math.atan2(u1y, u1x) - Math.atan2(ty, tx)) : 0 });
      } else if (s0 > 1e-4 && s1 > 1e-4) {
        const dphi = wrapA(Math.atan2(u1y, u1x) - Math.atan2(u0y, u0x));
        if (Math.abs(dphi) > 2 && Math.min(s0, s1) < 0.1) evs.push({ l, kind: 'pivot', d: dphi });
        else kap[k] = (kap[k] || 0) + dphi;
      }
      l += dl;
    }
    if (lv == null) { lv = Math.max(0, l); vEnd = q.end ? q.end.v : 0; }
    const lb = lv + (vEnd > 0 ? Math.min(4, vEnd * vEnd / (2 * MIND.ROLL[P.POCKETED])) : 0);
    let j0 = i0; if (!cue) while (j0 < N - 1 && !(a[4 * j0 + 2] || a[4 * j0 + 3])) j0++;
    let vis = null;
    if (cue && rec.at && rec.at.ball >= 0) {
      let m = -pre; vis = { l: 0, x: rec.at.x, y: rec.at.y, phi: Math.atan2(a[4 * i0 + 3], a[4 * i0 + 2]), v: Math.hypot(a[4 * i0 + 2], a[4 * i0 + 3]) };
      for (let i = i0; i < N - 1; i++) {
        const dl = Math.hypot(a[4 * i + 4] - a[4 * i], a[4 * i + 5] - a[4 * i + 1]); if (m + dl > MIND.VIS_RAIL) break; m += dl;
        const vx = a[4 * i + 6], vy = a[4 * i + 7]; vis = { l: m, x: a[4 * i + 4], y: a[4 * i + 5], phi: vx || vy ? Math.atan2(vy, vx) : vis.phi, v: Math.hypot(vx, vy) };
      }
    }
    const out = { id, kap, spd, evs, lv, lb, vis, x0: a[4 * j0], y0: a[4 * j0 + 1], phi0: Math.atan2(a[4 * j0 + 3], a[4 * j0 + 2]), v0: Math.hypot(a[4 * j0 + 2], a[4 * j0 + 3]), end: q.end };
    rec.views.set(id, out);
    return out;
  }

  /* ② The stroke as a player with compensation skill s pictures it - the events the picture makes (a mental ev, the
     game's own fields), judged as the real ones are. The cue ball's way to its first contact is shown, so it is taken as
     it is; past a ball, the guide's 0.16 m of the real way, then the picture; past a cushion, the mirror (the stub), then
     the picture. The picture: straight on, its heading turned by s of the real way's curve as it goes; off a cushion the
     mirror, turned by s of the real cushion's angle off it; into a ball, that ball goes along the line of centres (the
     game has no throw: so it does) and the cue ball along the tangent, turned by s of the real departure's angle off it;
     a drawn ball comes back s of the way it really does. The other balls stand where they stood (one met is gone from the
     picture). Its pace is the real way's while that lasts, then the cloth's and the cushions'. mind.path (MIND.PATH on):
     the picture's points, [id, x, y, ...], for drawing it. */
  function seeMindEv(rec, s) {
    const key = Math.round(s * 100);
    if (rec.minds.has(key)) return rec.minds.get(key);
    const P = g.P, R = P.R, F = seeFaces(rec.w), cue = rec.cue, roll = MIND.ROLL[P.POCKETED], tev = rec.ev;
    const me = { firstHit: null, hits: [], rail: tev.rail, railed: [], banked: {}, miss: {}, img: 0, graze: 0, curved: 0, pocketed: [], cushions: 0, pre: 0, air: tev.air, off: [], at: null, walls: 0, kiss: 0, kissPre: 0, seq: [], run: tev.run, orun: tev.orun, edges: [] };
    const out = { ev: me, path: MIND.PATH ? [] : null, ok: null };
    rec.minds.set(key, out);
    if (!rec.at) return out;
    const statics = rec.start.filter(b => b[3]).map(b => [b[0], b[1], b[2]]), gone = new Set([cue]);
    const grazed = new Set();
    const cushion = (id, c, x, y) => {
      if (c.seg && c.seg.curved) me.curved++;
      if (c.type === 'wall') { me.walls++; return; }
      if (id !== cue) { if (me.railed.indexOf(id) < 0) me.railed.push(id); if (!(c.seg && c.seg.jaw)) me.banked[id] = (me.banked[id] || 0) + 1; return; }
      if (me.hits.length < 2) me.cushions++;
      if (me.firstHit == null) me.pre++;
      if (me.seq.length < 10) me.seq.push(Math.abs(x) > P.HL - 2 * R ? 'S' : 'L');
      if (c.seg && c.seg.edge >= 0 && me.edges.length < 16) me.edges.push([c.seg.edge, me.hits.length]);
    };
    // one ball pictured from (x, y), heading phi at pace v, with its true way tv (or none) read from l on; depth 0 the
    // cue ball, 1 a ball it sends, 2 a ball that one sends (no further)
    const trace = (id, x, y, phi, v, tv, l, depth) => {
      const tc = tv ? tv.evs.filter(e => e.kind === 'rail' || e.kind === 'wall') : [], tb = tv ? tv.evs.filter(e => e.kind === 'ball') : [], tp = tv ? tv.evs.filter(e => e.kind === 'pivot') : [];
      let kc = 0, kb = 0, kp = 0, lm = 0, end = Infinity;
      while (kc < tc.length && tc[kc].l < l) kc++; while (kb < tb.length && tb[kb].l < l) kb++; while (kp < tp.length && tp[kp].l < l) kp++;
      for (let guard = 0; guard < 3000; guard++) {
        const live = !!tv && l < tv.lv;
        if (live) v = tv.spd[Math.floor(l / MIND.DL)] || v;
        else if (v <= 1e-3 || (tv && l >= tv.lb)) return;
        let step = Math.min(MIND.DL, end - lm); if (live) step = Math.min(step, tv.lv - l + 1e-6, (Math.floor(l / MIND.DL) + 1) * MIND.DL - l + 1e-7);
        if (step <= 1e-7) return;
        // (the curve turns the heading as it goes: the step taken along its middle heading)
        const kk = live ? s * (tv.kap[Math.floor(l / MIND.DL)] || 0) / MIND.DL : 0, ph = phi + kk * step / 2;
        const dx = Math.cos(ph), dy = Math.sin(ph), c = seeCast(F, statics, gone, x, y, dx, dy, step);
        const x0 = x, y0 = y, go = c ? c.t : step; x += dx * go; y += dy * go; l += go; lm += go; phi += kk * go; me.img += go;
        // (a ball the picture passes close by without touching: the way looks shut there - harder to believe in)
        for (const b of statics) if (!gone.has(b[0]) && !grazed.has(b[0]) && (!c || c.ball !== b[0])) {
          let u = (b[1] - x0) * dx + (b[2] - y0) * dy; u = u < 0 ? 0 : u > go ? go : u;
          if (Math.hypot(b[1] - x0 - dx * u, b[2] - y0 - dy * u) < 3.2 * R) { grazed.add(b[0]); me.graze++; }
        }
        // (how near the picture passes what it is after - a pocket, for a ball sent; the second ball, for the cue ball
        // after its first - signed by the side it passes on: where the sign turns, a way lies between two aims)
        if (P.POCKETED ? id !== cue : id === cue && me.hits.length === 1) {
          const marks = P.POCKETED ? F.holes.map(h => ['p' + h.id + ':' + id, h.x, h.y, h.r]) : statics.filter(b => !gone.has(b[0])).map(b => ['b' + b[0], b[1], b[2], 2 * R]);
          for (const [k, hx, hy, hr] of marks) {
            let u = (hx - x0) * dx + (hy - y0) * dy; u = u < 0 ? 0 : u > go ? go : u;
            const d = Math.hypot(hx - x0 - dx * u, hy - y0 - dy * u) - hr, sg = (dx * (hy - y0) - dy * (hx - x0)) >= 0 ? 1 : -1, was = me.miss[k];
            if (was == null || Math.abs(d) < Math.abs(was)) me.miss[k] = sg * Math.max(d, 1e-6);
          }
        }
        if (!live) { const v2 = v * v - 2 * roll * go; v = v2 > 0 ? Math.sqrt(v2) : 0; }
        if (out.path && (id === cue || depth === 1)) out.path.push(id, x, y);
        if (c && c.type === 'pocket') { me.pocketed.push({ id, pocket: c.pocket }); return; }
        if (c && (c.type === 'rail' || c.type === 'wall')) {
          cushion(id, c, x, y);
          const dn = dx * c.nx + dy * c.ny, t = tc[kc];
          phi = Math.atan2(dy - 2 * dn * c.ny, dx - 2 * dn * c.nx) + (t ? s * t.d : 0);
          if (t) { l = Math.max(l, t.l + 1e-6); kc++; }
          if (!live) v *= MIND.CUSH_KEEP;
          continue;
        }
        if (c) {
          // a ball: it goes along the line of centres, the one moving on along the tangent
          const b = c.ball;
          if (id === cue) {
            if (me.firstHit == null) { me.firstHit = b; me.at = [x, y, 0, b]; }
            if (me.hits.indexOf(b) < 0) me.hits.push(b);
            if (me.seq.length < 10) me.seq.push(b);
            // (carom: the second ball is the point - the picture ends there)
            if (me.hits.length >= 2 && !P.POCKETED) return;
          } else if (depth >= 2) return;
          gone.add(b);
          const nx = c.nx, ny = c.ny, dn = dx * nx + dy * ny, tx = dx - dn * nx, ty = dy - dn * ny, tl = Math.hypot(tx, ty);
          if (P.POCKETED || id !== cue) {
            const ob = rec.start[b], obv = seeView(rec, b), on = Math.atan2(ny, nx);
            trace(b, ob[1], ob[2], on, v * dn * 0.98, obv && Math.abs(wrapA(obv.phi0 - on)) < 0.35 ? obv : null, 0, depth + 1);
          }
          // (pool: the cue ball's second ball sent on its way - a carom pot - and the picture of the cue ball ends there)
          if (id === cue && me.hits.length >= 2) return;
          // (a ball sent on into another goes on too, as the cue ball does - two balls potted with one; one sent by that,
          // no further)
          const t = tb[kb];
          if (t) { l = Math.max(l, t.l + 1e-6); kb++; }
          if (tl < 0.02) { if (!tp.length) return; v = 0; }
          else { phi = Math.atan2(ty, tx) + (t ? s * t.d : 0); if (!live) v *= tl; }
          continue;
        }
        // a drawn ball's stop and return: it comes back s of the way it really does
        if (kp < tp.length && l >= tp[kp].l) { phi += tp[kp].d; kp++; end = lm + s * Math.max(0, tv.lb - l); continue; }
        if (lm >= end - 1e-7) return;
      }
    };
    const cv = seeView(rec, cue);
    if (rec.at.ball >= 0) {
      // past a ball: what led to it, as shown; the guide's reach of the real way; then the picture
      const b = rec.at.ball, k = tev.seq.findIndex(x => typeof x === 'number');
      me.firstHit = b; me.hits.push(b); me.at = [rec.at.x, rec.at.y, 0, b]; gone.add(b);
      me.seq = tev.seq.slice(0, k + 1); me.cushions = me.pre = tev.pre || 0; me.edges = (tev.edges || []).filter(e => e[1] === 0);
      const ob = rec.start[b], obv = seeView(rec, b);
      if (P.POCKETED && obv) trace(b, ob[1], ob[2], obv.phi0, obv.v0, obv, 0, 1);
      if (cv && cv.vis) {
        if (cv.vis.l >= cv.lv - 1e-6 && tev.hits.length >= 2) { me.hits.push(tev.hits[1]); me.seq.push(tev.hits[1]); }   // (the second ball within the guide's reach: seen)
        else trace(cue, cv.vis.x, cv.vis.y, cv.vis.phi, cv.vis.v, cv, cv.vis.l, 0);
      }
    } else if (cv) {
      // off a cushion (or a barricade) first: the mirror stub, then the picture
      const fn = faceNormal(F, rec.at.x, rec.at.y), q = rec.raw.get(cue), j = Math.max(0, rec.at.step - 1), vx = q.a[4 * j + 2], vy = q.a[4 * j + 3];
      if (fn && (vx || vy)) {
        cushion(cue, { type: fn[2].kind, seg: fn[2] }, rec.at.x, rec.at.y);
        const e0 = cv.evs[0], d0 = e0 && (e0.kind === 'rail' || e0.kind === 'wall') && e0.l < 0.03 ? e0 : null, dn = vx * fn[0] + vy * fn[1];
        trace(cue, rec.at.x, rec.at.y, Math.atan2(vy - 2 * dn * fn[1], vx - 2 * dn * fn[0]) + (d0 ? s * d0.d : 0), cv.v0, cv, d0 ? d0.l + 1e-6 : 0, 0);
      }
    }
    return out;
  }
  // the pictured stroke judged as a real one is: does the player expect it to come off?
  function seeMindOk(rec, s, judge) { const m = seeMindEv(rec, s); if (m.ok == null) m.ok = !!judge(m.ev, rec.w).ok; return m.ok; }

  /* ---- the strokes tried: for each stroke (pace, tip, cue raised) the aims that could make something - across each ball
     it may hit first, thin to thin; at each one seen in a cushion (kicks.1: one cushion; 2: two); every degree round
     (round) - each played out (seeRecord), and where two neighbours come off differently the edge found between them ---- */
  function seeAims(world, cue, targets, o) {
    const P = g.P, R = P.R, c = o.pos ? { x: o.pos[0], y: o.pos[1] } : world.balls[cue], out = [];
    const add = (a, sp) => out.push([wrapA(a), sp]);
    const across = (x, y, n, wide) => {
      const d = Math.hypot(x - c.x, y - c.y); if (d < 2 * R + 1e-4) return;
      const a0 = Math.atan2(y - c.y, x - c.x), B = wide * R;
      for (let j = 0; j < n; j++) { const b = (-1 + 2 * j / (n - 1)) * B; if (Math.abs(b) >= d) continue; const a = a0 + Math.asin(b / d); add(a, (2 * B / (n - 1)) / d * 1.6); }
    };
    // the cushions as lines a ball's middle comes off: the table's four (or a shaped table's longer faces)
    const lines = [];
    // (a shaped table: its six longest faces - a curve's pieces are not aimed at one by one)
    if (world.shape) { for (const f of world.shape.faces.filter(f => f.len >= 0.12).sort((a, b) => b.len - a.len).slice(0, 6)) { let nx = -f.ty, ny = f.tx; if (!P.inShape(world.shape, f.cx + nx * 0.02, f.cy + ny * 0.02)) { nx = -nx; ny = -ny; } lines.push({ px: f.cx + nx * R, py: f.cy + ny * R, nx, ny }); } }
    else { const X = P.HL - R, Y = P.HW - R; lines.push({ px: X, py: 0, nx: -1, ny: 0 }, { px: -X, py: 0, nx: 1, ny: 0 }, { px: 0, py: Y, nx: 0, ny: -1 }, { px: 0, py: -Y, nx: 0, ny: 1 }); }
    const mirror = (x, y, l) => { const d = (x - l.px) * l.nx + (y - l.py) * l.ny; return [x - 2 * d * l.nx, y - 2 * d * l.ny]; };
    for (const id of targets) {
      const b = world.balls[id]; if (!b || !b.on) continue;
      across(b.x, b.y, o.impact || MIND.IMPACT, 2 - 0.004);
      if (o.kicks && (!o.kickTargets || o.kickTargets.indexOf(id) >= 0)) for (const l of lines) {
        const m = mirror(b.x, b.y, l); across(m[0], m[1], o.kickN || 25, 3);
        if (o.kicks > 1 && !world.shape) for (const l2 of lines) if (l2 !== l && l2.nx !== -l.nx) { const m2 = mirror(m[0], m[1], l2); across(m2[0], m2[1], 9, 2.6); }
      }
    }
    if (o.round) for (let a = -180; a < 180; a += o.round) add(a * Math.PI / 180, o.round * Math.PI / 180 * 1.6);
    for (const ar of (o.around ? [o.around] : []).concat(o.arounds || [])) { const [a0, half, step] = ar; for (let d = -half; d <= half + 1e-9; d += step) add(a0 + d, step * 1.6); }
    out.sort((p, q) => p[0] - q[0]);
    const keep = []; for (const p of out) { const l = keep[keep.length - 1]; if (l && p[0] - l[0] < 2e-5) { l[1] = Math.max(l[1], p[1]); continue; } keep.push(p); }
    return keep;
  }
  // a way's name, from its events: carom - the first ball, the second, the cue ball's cushions before it; pool - the first
  // ball, what went down where, the cushions before the first ball, the balls banked; a kiss before it was decided
  function seeSig(ev) {
    if (g.P.POCKETED) {
      const pot = (ev.pocketed || []).filter(q => q.id !== 0).map(q => q.id + ':' + q.pocket).sort().join(',');
      return `${ev.firstHit}>${pot}|${ev.pre || 0}${(ev.pocketed || []).some(q => q.id === 0) ? '|x' : ''}${ev.kissPre > 0 ? '|k' : ''}`;
    }
    return `${ev.firstHit}>${ev.hits && ev.hits[1] != null ? ev.hits[1] : '-'}|${ev.cushions || 0}${ev.kissPre > 0 ? '|k' : ''}`;
  }
  // a sweep: { world, who, judge, view, groups: [{ stroke, recs: [{ aim, sp, rec }] sorted by aim }] }
  function seeSweep(world, who, o = {}) {
    const P = g.P, cue = P.POCKETED ? 0 : who, view = o.view || (o.judge ? null : judgeView(world, who)), judge = o.judge || seeJudge(world, who, view);
    const targets = o.targets || g.mode.legal(view, who).filter(id => world.balls[id] && world.balls[id].on);
    const strokes = o.strokes || [{ V: g.vOf(0.5), a: 0, b: 0, el: 0 }];
    // (coarse: a way is any run of aims that comes off - the puzzles ask only that; else ways are told apart by name, seeSig)
    const sw = { world, who, judge, view, cue, groups: [], sims: 0, coarse: !!o.coarse }, tkey = r => r.ok ? (sw.coarse ? 'ok' + (r.ev.kissPre > 0 ? '|k' : '') : seeSig(r.ev)) : null;
    sw.tkey = tkey;
    for (const st of strokes) {
      const aims = seeAims(world, cue, targets, { ...o, pos: st.pos || o.pos });
      const grp = { stroke: st, recs: [] };
      for (const [aim, sp] of aims) grp.recs.push({ aim, sp, rec: seeRecord(world, who, { ...st, angle: aim }, judge) });
      sw.sims += aims.length; sw.groups.push(grp);
      if (o.refine !== false) seeRefine(sw, grp, tkey, o.coarse ? 3 : 4);
      // (fine: about every way that really comes off, aims close together - where a picture a little off would aim)
      if (o.fine) {
        const runs = seeRuns(grp.recs, tkey), more = [];
        for (const t of runs) for (let a = t.lo - o.fine; a <= t.hi + o.fine; a += 0.0015) if (!grp.recs.some(q => Math.abs(q.aim - a) < 0.0007) && !more.some(q => Math.abs(q - a) < 0.0007)) more.push(a);
        for (const aim of more) grp.recs.push({ aim, sp: 0.0015 * 1.6, rec: seeRecord(world, who, { ...st, angle: aim }, judge) });
        sw.sims += more.length; grp.recs.sort((a, b) => a.aim - b.aim);
        if (more.length && o.refine !== false) seeRefine(sw, grp, tkey, 3);
      }
    }
    return sw;
  }
  /* between neighbours that differ by f, the edge: bisect n times. Into the group's own list (its true edges), or - L
     given - into a copy of it, returned (a rating's pictured edges: what one rating asks does not change what another
     gets); every stroke played is kept (grp.seen) and not played twice */
  function seeRefine(sw, grp, f, n, L0) {
    const L = L0 ? L0.slice() : grp.recs, add = [], seen = grp.seen || (grp.seen = new Map());
    const play = aim => { const k = aim.toFixed(9); let r = seen.get(k); if (!r) { r = seeRecord(sw.world, sw.who, { ...grp.stroke, angle: aim }, sw.judge); sw.sims++; seen.set(k, r); } return r; };
    for (let i = 0; i + 1 < L.length; i++) {
      const p = L[i], q = L[i + 1]; if (q.aim - p.aim > Math.max(p.sp, q.sp)) continue;
      let lo = p, hi = q, fl = f(p.rec); const fh = f(q.rec); if (fl === fh) continue;
      const nk = typeof n === 'function' ? n(q.aim - p.aim, p.aim) : n;
      for (let k = 0; k < nk; k++) {
        // (the halves on a grid - MIND.SNAP - so that what one rating plays another finds already played)
        const aim = Math.round((lo.aim + hi.aim) / 2 / MIND.SNAP) * MIND.SNAP; if (aim <= lo.aim + 1e-12 || aim >= hi.aim - 1e-12) break;
        const m = { aim, sp: Math.max(lo.sp, hi.sp), rec: play(aim) };
        add.push(m); const fm = f(m.rec); if (fm === fl) lo = m; else hi = m;
        if (fm !== fl && fm !== fh) break;
      }
    }
    if (add.length) { L.push(...add); L.sort((a, b) => a.aim - b.aim); }
    return L;
  }
  /* a way the picture makes too narrow to fall on an aim tried: between two neighbours the picture passes what it is
     after (seeMindEv miss) on one side and then the other - bisected on that side (4 times), the way found if there */
  function seeRefineMiss(sw, grp, s, mf, L0, iters) {
    const L = L0.slice(), add = [], seen = grp.seen || (grp.seen = new Map());
    const play = aim => { const k = aim.toFixed(9); let r = seen.get(k); if (!r) { r = seeRecord(sw.world, sw.who, { ...grp.stroke, angle: aim }, sw.judge); sw.sims++; seen.set(k, r); } return r; };
    for (let i = 0; i + 1 < L.length; i++) {
      const p = L[i], q = L[i + 1]; if (q.aim - p.aim > Math.max(p.sp, q.sp) || mf(p.rec) != null || mf(q.rec) != null) continue;
      const mp = seeMindEv(p.rec, s).ev.miss, mq = seeMindEv(q.rec, s).ev.miss;
      const key = Object.keys(mp).find(k => mq[k] != null && Math.abs(mp[k]) < 0.1 && Math.abs(mq[k]) < 0.1 && Math.sign(mp[k]) !== Math.sign(mq[k]));
      if (!key) continue;
      let lo = p, hi = q; const sl = Math.sign(mp[key]), nk = iters ? iters(p.aim) : 4;
      for (let k = 0; k < nk; k++) {
        const aim = Math.round((lo.aim + hi.aim) / 2 / MIND.SNAP) * MIND.SNAP; if (aim <= lo.aim + 1e-12 || aim >= hi.aim - 1e-12) break;
        const m = { aim, sp: Math.max(lo.sp, hi.sp), rec: play(aim) }; add.push(m);
        if (mf(m.rec) != null) break;
        const v = seeMindEv(m.rec, s).ev.miss[key]; if (v == null) break; if (Math.sign(v) === sl) lo = m; else hi = m;
      }
    }
    if (add.length) { L.push(...add); L.sort((a, b) => a.aim - b.aim); return seeRefine(sw, grp, mf, 2, L); }
    return L;
  }
  // the runs of neighbours alike under f (null: none): [{ key, lo, hi, recs }] - an edge half way to the unlike neighbour
  function seeRuns(L, f) {
    const runs = []; let cur = null;
    for (let i = 0; i < L.length; i++) {
      const k = f(L[i].rec), near = i > 0 && L[i].aim - L[i - 1].aim <= Math.max(L[i].sp, L[i - 1].sp);
      if (k == null) { if (cur) { cur.hi = near ? (L[i - 1].aim + L[i].aim) / 2 : L[i - 1].aim + L[i - 1].sp / 3.2; runs.push(cur); cur = null; } continue; }
      if (cur && (cur.key !== k || !near)) { cur.hi = near ? (L[i - 1].aim + L[i].aim) / 2 : L[i - 1].aim + L[i - 1].sp / 3.2; runs.push(cur); cur = null; }
      if (!cur) cur = { key: k, lo: near && f(L[i - 1].rec) != null ? (L[i - 1].aim + L[i].aim) / 2 : near ? (L[i - 1].aim + L[i].aim) / 2 : L[i].aim - L[i].sp / 3.2, recs: [] };
      cur.recs.push(L[i]);
    }
    if (cur) { cur.hi = L[L.length - 1].aim + L[L.length - 1].sp / 3.2; runs.push(cur); }
    return runs;
  }

  /* ① what a way asks one to picture, from its events (true or pictured) and its stroke: { cushions (the cue ball's
     before its second ball, carom), kick (cushions before the first ball), bank (the potted ball off a cushion), combo
     (a ball potted by another), kiss, side, fb (follow or draw), raised, wall } - and the rating at which half the players
     think of it (D): the FIND table's base and a share for each (extra: what a puzzle adds - its goal, a cushion asked
     for, a second turn) */
  function seeFeats(ev, st, rec) {
    const pot = (ev.pocketed || []).filter(q => q.id !== 0).map(q => q.id);
    // (a bank: the potted ball off a cushion's nose - pictured, or on its true way; off a jaw it is no bank)
    const banked = id => ev.banked ? (ev.banked[id] || 0) > 0 : !!rec && (() => { const v = seeView(rec, id); return !!v && v.evs.some(e => e.kind === 'rail' && !e.jaw); })();
    // (a common shape: 3쿠션's ways round three cushions that the systems work out - long, short, long or short, long,
    // short - one a player knows by name; read off the cue ball's cushions before its second ball)
    const rails = (ev.seq || []).slice((ev.seq || []).findIndex(x => typeof x === 'number') + 1).filter(x => typeof x === 'string').join('');
    const common = !g.P.POCKETED && /^(LSL|SLS|LSLS|SLSL|LLS|SLL)/.test(rails);
    return { cushions: Math.min(4, ev.cushions || 0), kick: Math.min(3, ev.pre || 0), bank: pot.some(banked), combo: pot.some(id => id !== ev.firstHit),
      kiss: ev.kissPre > 0, side: Math.abs(st.a || 0) > 0.15, fb: Math.abs(st.b || 0) > 0.15, raised: (st.el || 0) > 0.03, wall: (ev.walls || 0) > 0,
      img: Math.round((ev.img || 0) * 100) / 100, graze: Math.min(2, ev.graze || 0), curved: Math.min(3, ev.curved || 0), common };
  }
  function seeFindD(f, extra) {
    const pocket = g.P.POCKETED, F = pocket ? MIND.FIND.pocket : MIND.FIND.four;
    let D = F.base + (f.side ? F.side : 0) + (f.fb ? F.fb : 0) + (f.raised ? F.raised : 0) + (f.wall ? F.wall : 0) + (f.kiss ? F.kiss : 0) + (extra || 0)
      + F.len * Math.max(0, (f.img || 0) - 1) + F.graze * (f.graze || 0) + F.curved * (f.curved || 0) + (f.common ? F.common : 0);
    if (pocket) D += F.kick * f.kick + (f.bank ? F.bank : 0) + (f.combo ? F.combo : 0);
    else D += F.cushion * f.cushions + (f.kick ? F.bank : 0);
    return D;
  }
  const seeIdea = (R, D) => 1 / (1 + Math.exp(-((Number.isFinite(R) ? R : 1000) - D) / MIND.W));

  /* The ways a player of rating R sees in a sweep, each stroke's: the runs of aims the picture says come off (alike in
     name), and - kisses not being pictured - the runs that really come off through a kiss. For each way:
       lo, hi, c     the run as pictured, its middle (where they aim); half its width
       seen          the chance it comes to mind (seeIdea, by what it asks) - a kiss way also as v1 reads its kiss
       p             the chance it comes off as they play it: their hand about their middle, over every aim that really
                     comes off (any way); pr - over this way's own aims; tries - the same for a second and a third try
                     after a miss (the hand steadier, o.tries; the aim moved 60%, then 85% of the way to the real middle -
                     they saw where it went)
       sure          how sure they are of it: their hand over the run as pictured
       truth         the real run nearest (lo, hi, c) or null
     (a kiss that spoils a pictured way where it lies makes the player less sure of it, as far as they read it coming)
     o: { extra: D added (puzzles), tries: the hand on each try, [1, 0.6, 0.4] } */
  function seeRoutes(sw, R, o = {}) {
    const s = seeComp(R), out = [];
    for (const grp of sw.groups) {
      const st = grp.stroke, hand = seeHand(R, st), sig = hand.aim, tkey = sw.tkey || (r => r.ok ? seeSig(r.ev) : null), mf = r => seeMindOk(r, s, sw.judge) ? (sw.coarse ? 'ok' : seeSig(seeMindEv(r, s).ev)) : null;
      // (the picture's edges found as finely as this hand needs: a half of its spread - a weak hand's coarse, a strong
      // one's on the real edges the sweep found already; a way too narrow to fall on an aim looked for only near a real one)
      const its = gap => Math.max(0, Math.min(3, Math.ceil(Math.log2(gap / (sig / 2)))));
      const real = seeRuns(grp.recs, tkey), nearReal = a => real.some(t => a > t.lo - 0.05 && a < t.hi + 0.05);
      let L = o.refine !== false ? seeRefine(sw, grp, mf, (gap, a) => nearReal(a) ? its(gap) : 0, grp.recs) : grp.recs;
      if (o.refine !== false) L = seeRefineMiss(sw, grp, s, mf, L, a => nearReal(a) ? Math.max(2, its(0.004)) : 0);
      const truth = seeRuns(L, tkey), mind = seeRuns(L, mf);
      const pIn = (c, sg, runs) => { let p = 0; for (const t of runs) if (t.hi > c - 7 * sg && t.lo < c + 7 * sg) p += seePhi((t.hi - c) / sg) - seePhi((t.lo - c) / sg); return Math.min(1, p); };
      const nearest = (c, key) => { let best = null, bd = Infinity; for (const t of truth) { if (key && t.key.replace('|k', '') !== key) continue; const d = c < t.lo ? t.lo - c : c > t.hi ? c - t.hi : 0; if (d < bd) { bd = d; best = t; } } return best && bd < 0.08 ? best : null; };
      const mk = (run, kiss) => {
        const c = (run.lo + run.hi) / 2, half = (run.hi - run.lo) / 2, mid = run.recs.reduce((a, b) => Math.abs(b.aim - c) < Math.abs(a.aim - c) ? b : a);
        const ev = kiss ? mid.rec.ev : seeMindEv(mid.rec, s).ev, f = seeFeats(ev, st, mid.rec), D = seeFindD(f, o.extra);
        const t = kiss ? run : nearest(c, run.key), own = t ? [t] : [];
        let seen = seeIdea(R, D), story = null, sure = half > 0 ? erf(half / (sig * Math.SQRT2)) : 0;
        if (kiss) { story = kissStory(sw.world, sw.who, { ...st, angle: c }); seen *= story ? kissSeen(story, R) : 0; }
        else {
          // (a way pictured where the balls standing still would let it, that a kiss really spoils - the other ball not
          // where the picture keeps it: so much the less sure, as far as this player reads that kiss coming, v1 kissSeen)
          const bad = run.recs.filter(q => !q.rec.ok && q.rec.ev.kissPre > 0);
          if (bad.length) { const q = bad.reduce((a, b) => Math.abs(b.aim - c) < Math.abs(a.aim - c) ? b : a), ks = kissStory(sw.world, sw.who, { ...st, angle: q.aim }); if (ks) sure *= 1 - kissSeen(ks, R) * bad.length / run.recs.length; }
        }
        // (a try after a miss: the hand steadier and the aim moved most of the way to the real middle - the ball showed where it went)
        const tries = (o.tries || [1, 0.6, 0.4]).map((k, i) => { const cc = t ? c + ((t.lo + t.hi) / 2 - c) * [0, 0.6, 0.85][Math.min(2, i)] : c; return pIn(cc, sig * k, truth); });
        return { key: run.key, stroke: st, lo: run.lo, hi: run.hi, c, half, kiss: !!kiss, feats: f, D, seen, p: tries[0], pr: pIn(c, sig, own), tries, sure,
          truth: t ? { lo: t.lo, hi: t.hi, c: (t.lo + t.hi) / 2 } : null, shot: { ...st, angle: c }, story };
      };
      for (const run of mind) out.push(mk(run, false));
      // a kiss way: really comes off through a kiss (a pictured way may lie over it too - they share what is explained)
      for (const t of truth) if (/\|k$/.test(t.key)) out.push(mk(t, true));
    }
    return out;
  }
  // ③ the chance each way is the one played (and of none of them - other), for a player of rating R
  function seeChoose(routes, R) {
    const b = MIND.BETA[0] + MIND.BETA[1] * seeComp(R), w = routes.map(r => r.seen * Math.exp(b * r.sure * (r.value != null ? r.value : 1)));
    const tot = w.reduce((a, x) => a + x, 0) + MIND.OTHER, p = w.map(x => x / tot);
    return { p, other: MIND.OTHER / tot };
  }

  /* ⑤ the way a stroke was meant for: Bayes over what the player might have been doing - each way near the aim (H_r), or
     something else (H_0: a way elsewhere on the table, or none in particular). Before the stroke: H_r has the chance the
     way came to mind and won the choice (③) against what else there is - the ways near, and the table's elsewhere, taken
     as one fair way (a window of +-0.004 rad: MIND.ELSE) for this player's hand; H_0 the rest. The aim then: about
     H_r's pictured middle by the player's hand (④); under H_0 anywhere in the window alike. Only the ways near the aim
     can explain it, so the aims looked at are those within MIND.WIN of it - a way running on past that followed out.
     { post: [{ route, p }], other (H_0), kiss (the chance a kiss way was meant), plain (the pictured way through the
     aim, if any), rec (the stroke as played), pictured (does it come off as the player pictures it), right (would it with
     nothing to kiss: seeRight), routes } */
  MIND.ELSE = 0.004;
  MIND.WIN = 0.12; MIND.WIN_STEP = 0.002;
  MIND.SNAP = 0.0002;                     // (the edges' grid, radians: a 2400 hand's third)
  function seeInverse(world, who, shot, R, o = {}) {
    const st = { V: shot.V, a: shot.a || 0, b: shot.b || 0, el: shot.el || 0, pos: shot.pos || null };
    const win = o.win || MIND.WIN, sw = seeSweep(world, who, { view: o.view, judge: o.judge, targets: [], strokes: [st], around: [shot.angle, win, MIND.WIN_STEP] });
    // (a run at the window's edge: followed out, a window's width further each time, three times at most)
    for (let k = 0, lo = shot.angle - win, hi = shot.angle + win; k < 3; k++) {
      const grp = sw.groups[0], L = grp.recs, ends = [L[0], L[L.length - 1]], more = [];
      if (ends[0].rec.ok) { more.push(...seeAims(world, sw.cue, [], { around: [lo - win / 2, win / 2, MIND.WIN_STEP * 2] })); lo -= win; }
      if (ends[1].rec.ok) { more.push(...seeAims(world, sw.cue, [], { around: [hi + win / 2, win / 2, MIND.WIN_STEP * 2] })); hi += win; }
      if (!more.length) break;
      for (const [aim, sp] of more) L.push({ aim, sp, rec: seeRecord(world, who, { ...st, angle: aim }, sw.judge) });
      L.sort((a, b) => a.aim - b.aim); seeRefine(sw, grp, r => r.ok ? seeSig(r.ev) : null, 4);
    }
    const routes = seeRoutes(sw, R, o), sig = seeHand(R, st).aim, b = MIND.BETA[0] + MIND.BETA[1] * seeComp(R);
    const w = routes.map(r => r.seen * Math.exp(b * r.sure)), wElse = Math.exp(b * winChance(MIND.ELSE, sig)), W = wElse + w.reduce((a, x) => a + x, 0);
    const lik = routes.map(r => Math.exp(-0.5 * Math.pow(wrapA(shot.angle - r.c) / sig, 2)) / (sig * Math.sqrt(2 * Math.PI)));
    const num = routes.map((r, i) => w[i] / W * lik[i]), other = wElse / W / (2 * win), tot = num.reduce((a, x) => a + x, 0) + other;
    const post = routes.map((r, i) => ({ route: r, p: num[i] / tot })).sort((a, b) => b.p - a.p);
    const rec = seeRecord(world, who, { ...st, angle: shot.angle }, sw.judge), s = seeComp(R);
    const plain = routes.find(r => !r.kiss && r.lo <= shot.angle && shot.angle <= r.hi) || null;
    return { post, other: other / tot, kiss: post.filter(q => q.route.kiss).reduce((a, q) => a + q.p, 0), plain, rec, routes, sims: sw.sims,
      pictured: seeMindOk(rec, s, sw.judge), right: seeRight(world, who, shot, sw.judge) };
  }
  /* Would the stroke have come off with no kiss - the line itself right? Played again with nothing to kiss: carom - the
     first ball gone from the table the instant it is hit (nothing comes back into the cue ball, nothing it sends meets
     the other); pool - the cue ball and the first ball alone. */
  function seeRight(world, who, shot, judge) {
    const P = g.P, cue = P.POCKETED ? 0 : who, run = keep => {
      const w = P.clone(world); w.cue = cue; JUDGE.sims++;
      if (shot.pos) P.place(w, cue, shot.pos[0], shot.pos[1]);
      if (keep) for (const b of w.balls) if (b.id !== cue && b.id !== keep) b.on = false;
      P.strike(w, shot.angle, shot.V, shot.a || 0, shot.b || 0, shot.el || 0);
      let gone = false;
      for (let t = 0; t < 20 && !P.rest(w); t += 1 / 120) { P.step(w, 1 / 120); if (!P.POCKETED && !gone && w.ev.firstHit != null) { w.balls[w.ev.firstHit].on = false; gone = true; } }
      return { ev: w.ev, ok: !!judge(w.ev, w).ok };
    };
    if (!P.POCKETED) return run(null).ok;
    const first = run(null).ev.firstHit; return first != null && run(first).ok;
  }
  /* A kiss in a stroke, read for a player of rating R (the review's 행운 / 불운 - 60-judge.js): { p: the chance the kiss
     was meant (a kiss way, ⑤), seen (v1: would they see it coming), story, right: with nothing to kiss the stroke comes
     off (seeRight - so the kiss did not make it), spoiled: right, and the kiss took it, meant:
     the chance it was a plain way through the aim played that they meant } */
  function seeKiss(world, who, shot, view, R) {
    const story = kissStory(world, who, shot); if (!story) return null;
    const inv = seeInverse(world, who, shot, R, { view }), meant = inv.post.filter(q => !q.route.kiss && q.route.lo - 3 * seeHand(R, shot).aim <= shot.angle && shot.angle <= q.route.hi + 3 * seeHand(R, shot).aim).reduce((a, q) => a + q.p, 0);
    const r2 = x => Math.round(x * 100) / 100;
    return { p: r2(inv.kiss), seen: r2(kissSeen(story, R)), story, spoiled: !inv.rec.ok && inv.right, right: inv.right, meant: r2(meant), other: r2(inv.other), sims: inv.sims };
  }

  /* The aim as pictured (the bots and stand-ins, 50-human.js): a stroke found on the physics, looked at as a player of
     rating R pictures it - the strokes within `half` of it at its own pace and tip; the run that really comes off about
     it and the run the picture says comes off nearest it: how far the picture leans the aim (lean: the pictured run's
     middle less the real one's, both read off the same strokes - what the grid misses, it misses in both). { lean (null:
     the picture shows no such way near, or the real one is not there - the player aims where the line is), sims } */
  function seePicture(world, who, shot, R, half = 0.03, step = 0.0025) {
    const st = { V: shot.V, a: shot.a || 0, b: shot.b || 0, el: shot.el || 0, pos: shot.pos || null }, judge = seeJudge(world, who), s = seeComp(R), L = [];
    for (let d = -half; d <= half + 1e-9; d += step) L.push({ aim: shot.angle + d, sp: step * 1.6, rec: seeRecord(world, who, { ...st, angle: shot.angle + d }, judge) });
    const near = runs => { let best = null, bd = Infinity; for (const r of runs) { const d = shot.angle < r.lo ? r.lo - shot.angle : shot.angle > r.hi ? shot.angle - r.hi : 0; if (d < bd) { bd = d; best = r; } } return best && bd < half ? best : null; };
    const m = near(seeRuns(L, r => seeMindOk(r, s, judge) ? 'ok' : null)), t = near(seeRuns(L, r => r.ok ? 'ok' : null));
    return { lean: m && t ? (m.lo + m.hi) / 2 - (t.lo + t.hi) / 2 : null, sims: L.length };
  }

  /* What the attempts and the shots players really play have taught (the Fit workflow - web/tools/see/fit.js writes
     64a-see-fit.js, which hands it here): the hand at 1500 (aim), where and how fast the picture comes right (COMP,
     COMP_W), and what each thing a way asks is worth to real players beyond the table (FIND, rating points added). Nothing
     given: the numbers set by hand stand. */
  function seeApplyFit(f) {
    if (!f || typeof f !== 'object') return;
    const ok = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
    if (ok(f.aim1500, 0.0005, 0.02)) SEE.AIM_1500 = f.aim1500;
    if (ok(f.comp, 500, 2500)) MIND.COMP = f.comp;
    if (ok(f.compW, 80, 600)) MIND.COMP_W = f.compW;
    for (const k of ['four', 'pocket']) if (f.find && f.find[k]) for (const [q, d] of Object.entries(f.find[k])) if (MIND.FIND[k][q] != null && ok(d, -400, 400)) MIND.FIND[k][q] += d;
  }

  /* A miss read for the picture (the review, 60-judge.js cause 'picture'): the strokes within `half` of the one played,
     at its pace and tip. If the aim lies in a way the player of rating R pictures coming off (within their hand of it),
     and that way's real run - the same way by name, nearest its pictured middle - is elsewhere, the miss is in the
     picture: { lean (the pictured middle less the real one), fix (the real middle less the aim), sims } - else null */
  function seeMisread(world, who, shot, R, half = 0.06, step = 0.002) {
    const st = { V: shot.V, a: shot.a || 0, b: shot.b || 0, el: shot.el || 0, pos: shot.pos || null }, judge = seeJudge(world, who), s = seeComp(R), L = [], sg = seeHand(R, st).aim;
    for (let d = -half; d <= half + 1e-9; d += step) L.push({ aim: shot.angle + d, sp: step * 1.6, rec: seeRecord(world, who, { ...st, angle: shot.angle + d }, judge) });
    // (the same way by name - the first ball, the second, the cushions (carom); the ball, the pocket, the kicks (pool))
    const mind = seeRuns(L, r => seeMindOk(r, s, judge) ? seeSig(seeMindEv(r, s).ev) : null), real = seeRuns(L, r => r.ok ? seeSig(r.ev).replace('|k', '') : null), a = shot.angle;
    const m = mind.filter(r => r.lo - 2 * sg <= a && a <= r.hi + 2 * sg).sort((p, q) => Math.abs((p.lo + p.hi) / 2 - a) - Math.abs((q.lo + q.hi) / 2 - a))[0]; if (!m) return null;
    const cm = (m.lo + m.hi) / 2; let t = null, bd = Infinity;
    for (const r of real) { if (r.key !== m.key) continue; const d = cm < r.lo ? r.lo - cm : cm > r.hi ? cm - r.hi : 0; if (d < bd) { bd = d; t = r; } }
    if (!t || (t.lo <= a && a <= t.hi)) return null;
    const ct = (t.lo + t.hi) / 2; return { lean: cm - ct, fix: ct - a, sims: L.length };
  }

