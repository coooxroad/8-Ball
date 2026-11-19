  /* ================= what a shot meant, and why another was better (owner 11-18: '의도를 구체적으로', Komodo) =================
     The judge (60-judge.js) says how much a shot lost; a coach says what it was for. Three things, each measured on the
     physics and never guessed - the words (app/50-review-words.js) say only what is here (as CueTip grounds its words in
     rules worked out on the table, and lichess's coaches: 'the explanation follows the analysis'):
       route  - carom: what the cue ball met, in order (the physics' ev.seq: balls, 'L' long and 'S' short cushions), and
                the name players give it where the name is certain - 빈쿠션 (원뱅크 / 투뱅크 / 쓰리뱅크), 대회전
       shape  - where the stroke sends the cue ball and what it leaves (as JPool aims the cue ball into a position zone):
                the stroke played again at paces around its own, the same aim and tip, the leave after each; the best of
                them is the position the stroke was reaching for - the next ball it sets up; the stroke's own pace against
                it says short or long, and by how far; how many paces stay near the best, how much room the zone gives
       facts  - what makes a line easy or hard, and a result good (as CueTip's rules from Alciatore's book): the cut, the
                distances, a ball close to either path, the scratch risk (the hand's wobble played), balls that touched
                broken apart, and the shape
     whyBetter sets one shot's facts against another's: the reasons, the strongest first. */
  function routeOf(ev) {
    const seq = ev.seq || [], i = seq.findIndex(x => typeof x === 'number'), pre = i < 0 ? seq.length : i;
    const j = i < 0 ? -1 : seq.findIndex((x, n) => n > i && typeof x === 'number' && x !== seq[i]);
    const rails = i < 0 ? [] : seq.slice(i + 1, j < 0 ? seq.length : j).filter(x => typeof x === 'string');
    const ko = x => x === 'L' ? '장' : '단', alt = rails.length >= 4 && rails.every((x, n) => !n || x !== rails[n - 1]);
    const name = pre >= 1 && i >= 0 ? ['', '원뱅크', '투뱅크', '쓰리뱅크'][Math.min(3, pre)] : alt ? '대회전' : null;
    return { pre, rails: rails.map(ko).join('-'), preRails: seq.slice(0, pre).map(ko).join('-'), name };
  }
  // the stroke at paces around its own: where the cue ball stops, what it leaves
  function shapeOf(world, who, shot, view) {
    const P = g.P, cue = P.POCKETED ? 0 : who, ks = [0.72, 0.85, 1, 1.18, 1.4], runs = [];
    for (const k of ks) {
      const V = Math.min(g.vOf(1), shot.V * k), res = judgeSim(world, who, { ...shot, V }, view);
      if (!res.made) { runs.push({ k, ok: false }); continue; }
      const c = res.world.balls[cue], v = res.won ? 1 : leaveOf(res.world, who, res.r, false);
      runs.push({ k, ok: true, v, at: c && c.on ? [c.x, c.y] : null, next: P.POCKETED ? nextBall(res, who) : null, won: res.won });
    }
    const ok = runs.filter(r => r.ok); if (!ok.length) return null;
    const best = ok.reduce((m, r) => r.v > m.v ? r : m, ok[0]), own = runs.find(r => r.k === 1);
    const room = ok.filter(r => r.v >= best.v - 0.12).length;
    let dir = null, gap = 0;
    if (own && own.ok && best.v - own.v > 0.12 && own.at && best.at) { dir = best.k > 1 ? 'short' : 'long'; gap = Math.hypot(best.at[0] - own.at[0], best.at[1] - own.at[1]); }
    return { best: { k: best.k, v: r2(best.v), next: best.next, won: best.won }, own: own && own.ok ? { v: r2(own.v), next: own.next } : null, dir, gap: Math.round(gap * 100), room };
  }
  const r2 = x => Math.round(x * 100) / 100;
  // the distance from a point to a segment
  const segGap = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  function factsOf(world, who, shot, res, view, shape) {
    const P = g.P, R = P.R, cue = P.POCKETED ? 0 : who, c = shot.pos ? { x: shot.pos[0], y: shot.pos[1] } : world.balls[cue];
    const f = { shape: shape || null, raised: raisedOf(shot, res.ev) };
    const first = res.ev.firstHit, T = first != null ? world.balls[first] : null;
    if (!T || !c) return f;
    f.dist = r2(Math.hypot(T.x - c.x, T.y - c.y));
    if (P.POCKETED) {
      const pot = (res.ev.pocketed || []).find(q => q.id === first) || (res.ev.pocketed || []).find(q => q.id !== 0), pk = pot && P.POCKETS[pot.pocket];
      if (pk) {
        f.run = r2(Math.hypot(pk.ax - T.x, pk.ay - T.y));
        const L = Math.hypot(pk.ax - T.x, pk.ay - T.y) || 1, gx = T.x - (pk.ax - T.x) / L * 2 * R, gy = T.y - (pk.ay - T.y) / L * 2 * R;
        // (the cut as struck - the aim against the line of centres -, so a bank's is its own and not the pocket's)
        const dc = describe(world, who, shot, res).cut; f.cut = dc == null ? null : Math.abs(dc);
        // (a bank: the ball met a cushion and was not sent at the pocket - a rattle in the jaws is no bank, 11-19: plain cuts
        // were named 뱅크샷 - its first line, from the cue ball's contact, off the pocket's by more than about 12 degrees)
        const at = res.ev.at, off = at ? Math.abs(Math.atan2(Math.sin(Math.atan2(T.y - at[1], T.x - at[0]) - Math.atan2(pk.ay - T.y, pk.ax - T.x)), Math.cos(Math.atan2(T.y - at[1], T.x - at[0]) - Math.atan2(pk.ay - T.y, pk.ax - T.x)))) : 0;
        f.bank = pot.id === first && (res.ev.railed || []).includes(first) && off > 0.2;
        // a ball close to either path: the cue ball's to the contact, the object ball's to the pocket
        let near = Infinity;
        for (const b of world.balls) if (b.on && b.id !== cue && b.id !== first) near = Math.min(near, segGap(b.x, b.y, c.x, c.y, gx, gy) - 2 * R, segGap(b.x, b.y, T.x, T.y, pk.ax, pk.ay) - 2 * R);
        f.tight = near < R * 0.6;
      }
      // the scratch risk: the stroke with a looser hand than the reference, eight times
      let sc = 0;
      for (let i = 0; i < 8; i++) { const [ea, ev, es] = JUDGE_WOBBLE[i]; const r = judgeSim(world, who, { ...shot, angle: shot.angle + ea * JUDGE.SIG_A * 1.5, V: shot.V * (1 + ev * JUDGE.SIG_V * 1.5), a: (shot.a || 0) + es * JUDGE.SIG_S }, view); if (r.r && r.r.scratch) sc++; }
      f.scratch = sc / 8;
      // balls that touched (or nearly), broken apart by the shot
      const ids = world.balls.filter(b => b.on && b.id !== 0).map(b => b.id), broke = new Set();
      for (const i of ids) for (const j of ids) if (i < j) {
        const a = world.balls[i], b = world.balls[j]; if (Math.hypot(a.x - b.x, a.y - b.y) > 2.5 * R) continue;
        const a2 = res.world.balls[i], b2 = res.world.balls[j]; if (a2.on && b2.on && Math.hypot(a2.x - b2.x, a2.y - b2.y) > 6 * R) { broke.add(i); broke.add(j); }
      }
      f.breaks = [...broke].sort((x, y) => x - y);
    } else f.route = routeOf(res.ev);
    return f;
  }
  // why `a` was better than `me` (facts of each, and the two shots' own chances and leaves): the reasons, strongest first
  function whyBetter(a, me) {
    const out = [], A = a.facts || {}, M = (me && me.facts) || {};
    if (a.kind === 'safety') out.push({ k: 'safety' });
    if (a.kind === 'masse' || a.kind === 'jump') out.push({ k: a.kind === 'jump' ? 'over' : 'around' });
    if (me && A.cut != null && M.cut != null && M.cut - A.cut >= 12) out.push({ k: 'cut', by: M.cut - A.cut });
    if (me && A.dist != null && M.dist != null && (M.dist + (M.run || 0)) - (A.dist + (A.run || 0)) >= 0.35) out.push({ k: 'near' });
    if (M.tight && !A.tight) out.push({ k: 'clear' });
    if ((M.scratch || 0) >= 0.25 && (A.scratch || 0) < 0.1) out.push({ k: 'scratch' });
    if (A.breaks && A.breaks.length && !(M.breaks && M.breaks.length)) out.push({ k: 'breaks', ids: A.breaks });
    const av = A.shape ? A.shape.best.v : a.leave, mv = M.shape ? (M.shape.own ? M.shape.own.v : 0) : me ? me.leave : 0;
    if (a.kind !== 'safety' && av != null && av - (mv || 0) >= 0.15) out.push({ k: 'pos', next: a.next });
    if (A.shape && M.shape && A.shape.room >= M.shape.room + 2) out.push({ k: 'room' });
    if (me && me.p != null && a.p - me.p >= 0.15) out.push({ k: 'likelier' });
    return out.slice(0, 2);
  }
