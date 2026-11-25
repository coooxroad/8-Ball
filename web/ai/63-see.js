  /* ================= 보는 AI - what a player of a rating sees coming (owner 11-25, project doc cue-ai-upgrade-plan.md) =================
     The judge (60-judge.js) works every line out on the physics and measures it with one hand for everyone - no allowance
     (owner 11-17). What it cannot tell on its own is what this player saw: a kiss is luck to someone who never saw it
     coming and a shot to someone who played for it (owner 11-25: "행운인지 평가할 때 그 사람이 키스를 예상하고 쳤는지
     아닌지 알 수 있어야 해" - not an allowance for beginners, a reason to tell the cases apart). Here, v1:
       seeSkill(R)       how much of what can be read off the table a player of rating R reads (0..1)
       kissStory(...)    the shot played again up to the first kiss that could decide it (before the point - physics.js
                         kissPre; pool: a ball other than the cue ball meeting another, a combination's included): where,
                         after how many cushions, and whether it lies on a line one can see from where the balls stand
       kissSeen(s, R)    the chance that player saw it coming
       kissMeant(...)    the chance the kiss was part of what they played: they saw it, no plain line lay under their
                         aim (their own hand's spread), and the way through the kiss was one they could play again
     Then the judge: a point made through a kiss that was likely not meant (under SEE.LUCK) is 행운; a line that would
     have come off, spoilt by a kiss the player likely did not see, is 불운; anything between says nothing (owner 11-25:
     "애매하면 표시 x"). The numbers are set by hand for now; the shots players really play (server dataset) will set them
     (plan 6절 9). */
  const SEE = {
    MID: 1200, SPREAD: 250,             // seeSkill: half way at MID, the logistic's width
    VIS: { line: 0.9, rail: 0.6, one: 0.32, more: 0.12, back: 0.22 },   // how readable a kiss is, by where it comes (below)
    LUCK: 0.35, MEANT: 0.65,            // under LUCK: not meant (행운 / 불운); over MEANT: meant; between: nothing said
    AIM_1500: 0.0028,                   // a 1500 player's aim spread (radians, one sigma) - the judge's reference hand; halves every 400
  };
  const seeSkill = R => { const r = Number.isFinite(R) ? R : 1000; return 0.3 + 0.7 / (1 + Math.exp(-(r - SEE.MID) / SEE.SPREAD)); };
  const seeAim = R => SEE.AIM_1500 * Math.pow(2, (1500 - (Number.isFinite(R) ? R : 1000)) / 400);

  /* The shot played again on a copy, step by step, to its first kiss that could decide it. null: none.
     { t, kind: 'back' (the cue ball meets its first ball again) | 'obj' (two balls other than the cue ball meet),
       cushions: the cue ball's before it, objRails: the moving ball's (counted where it turns back off a cushion), straight:
       the kiss lies on the moving ball's first line - the line of centres at the first contact passes within two radii of
       the ball it then meets, before any cushion; nearRail: (back) the first ball was within three radii of a cushion } */
  function kissStory(world, who, shot) {
    const P = g.P, w = P.clone(world); w.cue = P.POCKETED ? 0 : who;
    if (shot.pos) P.place(w, w.cue, shot.pos[0], shot.pos[1]);
    P.strike(w, shot.angle, shot.V, shot.a || 0, shot.b || 0, shot.el || 0);
    const R = P.R, cue = w.cue, rails = {}, last = {}, line = {};
    let first = null, firstAt = null, kp = 0;
    for (let t = 0; t < 30 && !P.rest(w); t += 1 / 120) {
      for (const b of w.balls) last[b.id] = [b.vx, b.vy];
      P.step(w, 1 / 120);
      const ev = w.ev;
      // (where each ball turns back off a cushion: its velocity across the cushion's line flips near the edge)
      for (const b of w.balls) {
        if (!b.on) continue; const [vx, vy] = last[b.id];
        const offX = Math.abs(b.x) > P.HL - R - 0.004 && Math.sign(b.vx) !== Math.sign(vx) && vx !== 0, offY = Math.abs(b.y) > P.HW - R - 0.004 && Math.sign(b.vy) !== Math.sign(vy) && vy !== 0;
        if (offX || offY) rails[b.id] = (rails[b.id] || 0) + 1;
      }
      if (first == null && ev.firstHit != null) { first = ev.firstHit; const o = w.balls[first]; firstAt = { x: o.x, y: o.y }; }
      // (the first ball's line: the way it moves once it has started - its first step may not have moved it yet)
      if (first != null && !line[first]) { const o = w.balls[first], s = Math.hypot(o.vx, o.vy); if (s > 1e-3) line[first] = { x: o.x, y: o.y, dx: o.vx / s, dy: o.vy / s }; }
      if (ev.kissPre > kp) {
        // (the two that met: the closest pair now - they have parted within the step - the cue ball and its first ball, or two others)
        const others = w.balls.filter(b => b.on && b.id !== cue), gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        let pair = null, best = 2 * R + 0.03;
        for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) { const d = gap(others[i], others[j]); if (d < best) { best = d; pair = [others[i], others[j]]; } }
        const back = first != null && w.balls[first].on && gap(w.balls[cue], w.balls[first]) < best;
        if (back) pair = null;
        const kind = back ? 'back' : 'obj';
        let straight = false, nearRail = false, objRails = 0;
        if (kind === 'obj' && pair) {
          // (the moving one of the pair, and the line it left its first contact on)
          const mv = pair.find(b => b.id === first) || pair.slice().sort((a, b) => Math.hypot(b.vx, b.vy) - Math.hypot(a.vx, a.vy))[0], other = pair[0] === mv ? pair[1] : pair[0];
          objRails = rails[mv.id] || 0;
          const L = line[mv.id], b0 = world.balls[other.id];
          if (L && !objRails && b0 && b0.on) { const px = b0.x - L.x, py = b0.y - L.y, along = px * L.dx + py * L.dy, off = Math.abs(px * L.dy - py * L.dx); straight = along > 0 && off <= 2 * R + 0.003; }
        } else if (kind === 'back' && firstAt) nearRail = Math.min(P.HL - Math.abs(firstAt.x), P.HW - Math.abs(firstAt.y)) < 3 * R + R;
        return { t, kind, cushions: ev.cushions || 0, objRails, straight, nearRail };
      }
      kp = ev.kissPre;
    }
    return null;
  }
  // how readable a kiss is from the table as it stands (before any skill): on the moving ball's first line, plain to see;
  // the first ball near a cushion coming back into the cue ball, a known danger; after a cushion, guessing; more, luck
  function kissVis(s) {
    if (!s) return 0;
    if (s.kind === 'back') return s.cushions === 0 && s.nearRail ? SEE.VIS.rail : SEE.VIS.back;
    if (s.straight) return SEE.VIS.line;
    const n = Math.max(s.objRails, s.kind === 'obj' ? 0 : s.cushions);
    return n === 0 ? SEE.VIS.rail : n === 1 ? SEE.VIS.one : SEE.VIS.more;
  }
  const kissSeen = (s, R) => Math.min(0.97, kissVis(s) * seeSkill(R));

  /* the nearest stroke to the one played that comes off without the kiss (carom: no kiss before the point; pool: the first
     ball potted itself) - by aim first (the judge's steps), then pace: { da, k (pace ratio), res } or null */
  function plainNear(world, who, shot, view) {
    const plain = res => res.made && (g.P.POCKETED ? (res.ev.pocketed || []).some(q => q.id === res.ev.firstHit) && !(res.ev.kissPre > 0) : !(res.ev.kissPre > 0));
    for (const k of [1, 0.88, 1.12]) for (const d of JUDGE_STEPS) for (const s of [1, -1]) {
      const res = judgeSim(world, who, { ...shot, angle: shot.angle + s * d, V: Math.min(g.vOf(1), shot.V * k) }, view);
      if (plain(res)) return { da: s * d, k, res };
    }
    return null;
  }
  // the way through the kiss, as played: how far the aim may stray each side and still make it (the judge's windowOf,
  // any make counting) - its chance for the player's own hand
  function madeWindow(world, who, shot, view, R) {
    const ok = da => judgeSim(world, who, { ...shot, angle: shot.angle + da }, view).made;
    const end = s => { let lo = 0, hi = 0.002; while (hi < 0.06 && ok(s * hi)) { lo = hi; hi *= 2; } for (let n = 0; n < 4; n++) { const m = (lo + hi) / 2; if (ok(s * m)) lo = m; else hi = m; } return lo; };
    const half = (end(1) + end(-1)) / 2;
    return { half, p: winChance(half, seeAim(R)) };
  }
  /* was the kiss meant? { story, seen, plain, z, again, p } - p the chance it was part of what was played */
  function kissMeant(world, who, shot, view, R) {
    const story = kissStory(world, who, shot); if (!story) return null;
    const seen = kissSeen(story, R), plain = plainNear(world, who, shot, view), sig = seeAim(R);
    // (how far, in the player's own spread, the stroke was from a plain line: on it - they were playing that)
    const z = !plain ? Infinity : Math.hypot(plain.da / sig, Math.log(plain.k) / 0.05);
    const underPlain = Number.isFinite(z) ? Math.exp(-z * z / 2) : 0;
    const again = madeWindow(world, who, shot, view, R).p;
    const p = seen * (1 - underPlain) * (0.4 + 0.6 * Math.min(1, again / 0.3));
    return { story, seen: Math.round(seen * 100) / 100, plain: !!plain, z: Number.isFinite(z) ? Math.round(z * 10) / 10 : null, again: Math.round(again * 100) / 100, p: Math.round(p * 100) / 100 };
  }
