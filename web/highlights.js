/* Picking the best shot of a match and preparing it for a replay. A shot is replayed by putting the balls back
   exactly as they were and striking again: the physics is deterministic, so nothing else needs to be stored.
   No DOM in here. */
function createHighlights() {
  // everything the physics depends on, for every ball
  function snapshot(w) { return { cue: w.cue, balls: w.balls.map(b => [b.x, b.y, b.on ? 1 : 0, b.hot || 0, b.spit || 0, b.q.slice()]) }; }
  function restore(w, s) {
    w.cue = s.cue;
    s.balls.forEach((v, i) => { const b = w.balls[i]; b.x = b.px = v[0]; b.y = b.py = v[1]; b.on = !!v[2]; b.hot = v[3]; b.spit = v[4]; b.q = v[5].slice(); b.vx = b.vy = b.wx = b.wy = b.wz = 0; });
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // How good was that? 0 for a foul or a shot that did not score. `shot`: { snap, turn, isBreak }; `res`: the rules' verdict.
  function rate(P, mode, shot, ev, res) {
    if (res.foul) return { score: 0 };
    const cue = shot.snap.balls[shot.snap.cue], first = ev.firstHit;
    if (mode.table === 'carom') {
      if (!(res.pts > 0)) return { score: 0 };
      const viaRail = ev.railed.includes(shot.snap.cue), reds = dist(shot.snap.balls[2], shot.snap.balls[3]);
      return { score: 12 + (viaRail ? 10 : 0) + reds * 8, tag: viaRail ? '쿠션을 돌려 득점' : reds > 1 ? '멀리 떨어진 두 공' : '깔끔한 득점', key: -1 };
    }
    const potted = ev.pocketed.filter(p => p.id !== shot.snap.cue);
    if (!potted.length || (!res.keep && res.win !== shot.turn)) return { score: 0 };
    const main = potted.find(p => p.id === first) || potted[0], ball = shot.snap.balls[main.id], pocket = P.POCKETS[main.pocket];
    const d1 = first == null ? 0 : dist(cue, shot.snap.balls[first]), d2 = dist(ball, [pocket.x, pocket.y]);
    let cut = 0;
    if (main.id === first && d1 > 1e-6 && d2 > 1e-6) {
      const c = ((ball[0] - cue[0]) * (pocket.x - ball[0]) + (ball[1] - cue[1]) * (pocket.y - ball[1])) / (d1 * d2);
      cut = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    }
    const bank = ev.railed.includes(main.id), combo = main.id !== first, many = potted.length;
    let score = 10 * many + 6 * (d1 + d2) + cut / 5 + (bank ? 14 : 0) + (combo ? 12 : 0) + (res.win === shot.turn ? 6 : 0);
    if (shot.isBreak) score *= 0.35;                                   // a break is mostly luck
    const tag = bank ? '뱅크 샷' : combo ? '콤비네이션' : many >= 2 ? `한 번에 ${many}개` : cut > 42 ? '얇은 컷' : d1 + d2 > 1.5 ? '장거리 샷' : res.win === shot.turn ? '승부를 끝낸 샷' : '깔끔한 한 방';
    return { score, tag, key: main.id };
  }

  // And how bad was that? 0 for a shot nobody would laugh at. `kind` says what went wrong and `ball` which ball did it:
  //   lost - the game thrown away   scratch - the cue ball in a pocket   air - nothing hit at all
  //   wrong - the wrong ball first   miss - a pot that was on and did not go
  function rateWorst(P, mode, shot, ev, res) {
    if (shot.isBreak) return { score: 0 };
    const cueId = shot.snap.cue, cue = shot.snap.balls[cueId], first = ev.firstHit, scratch = ev.pocketed.some(p => p.id === cueId);
    if (mode.table !== 'carom' && res.win != null && res.win !== shot.turn) {
      const last = ev.pocketed.filter(p => p.id !== cueId).pop();
      return { score: 90, tag: '경기를 헌납한 샷', kind: 'lost', ball: last ? last.id : cueId };
    }
    if (scratch) return { score: 55 + (first == null ? 10 : 0), tag: '흰 공이 쏙', kind: 'scratch', ball: cueId };
    if (first == null) return { score: 50, tag: '아무것도 못 맞힘', kind: 'air', ball: cueId };
    if (res.foul) return { score: 30, tag: '엉뚱한 공부터', kind: 'wrong', ball: first };
    if (mode.table === 'carom') return res.pts > 0 ? { score: 0 } : { score: 12 + 6 / (0.3 + dist(cue, shot.snap.balls[first])), tag: '빗나간 샷', kind: 'miss', ball: cueId };
    if (res.keep || ev.pocketed.length) return { score: 0 };
    // a miss is funnier the easier the pot was: short, and close to a pocket
    const b = shot.snap.balls[first]; let dp = 9; for (const p of P.POCKETS) dp = Math.min(dp, dist(b, [p.x, p.y]));
    const ease = 1 / (0.25 + dist(cue, b) + dp);
    return { score: 10 + 14 * ease, tag: ease > 1.1 ? '이걸 놓침' : '빗나간 샷', kind: 'miss', ball: first };
  }

  // Run the shot ahead of time to learn when the moment worth showing happens (the key ball drops; in carom, the second red
  // is hit), where on the table that is, and which way the ball was travelling as it got there.
  function plan(P, n, shot) {
    const w = P.makeWorld(n); restore(w, shot.snap);
    P.strike(w, shot.aim, shot.V, shot.a, shot.b);
    const T = 1 / 120, kb = w.balls[shot.key >= 0 ? shot.key : shot.snap.cue]; let t = 0, tHit = -1, tKey = -1, kx = 0, ky = 0, ux = Math.cos(shot.aim), uy = Math.sin(shot.aim);
    while (!P.rest(w) && t < 30) {
      const vx = kb.vx, vy = kb.vy, sp = Math.hypot(vx, vy), x0 = kb.x, y0 = kb.y;
      P.step(w, T); t += T;
      if (tHit < 0 && w.ev.firstHit != null) tHit = t;
      if (tKey < 0 && (shot.key >= 0 ? w.ev.pocketed.some(p => p.id === shot.key) : w.ev.hits.includes(2) && w.ev.hits.includes(3))) {
        tKey = t; if (sp > 1e-3) { ux = vx / sp; uy = vy / sp; }
        const pk = shot.key >= 0 ? P.POCKETS[w.ev.pocketed.find(p => p.id === shot.key).pocket] : null;
        kx = pk ? pk.x : x0; ky = pk ? pk.y : y0;
      }
    }
    return { tHit, tKey, dur: t, kx, ky, ux, uy };
  }
  /* ---- the tape: the whole shot written down once, so that a replay can be run at any speed, backwards, or cut ---- */
  const TICK = 1 / 120, F = 7;                                         // per ball per tick: x, y, on, and the four numbers of its rotation
  function record(P, n, shot) {
    const tape = plan(P, n, shot), w = P.makeWorld(n); restore(w, shot.snap);
    const nb = w.balls.length, S = nb * F, events = []; let data = new Float32Array(S * 600), count = 0;
    const put = () => {
      if ((count + 1) * S > data.length) { const d = new Float32Array(data.length * 2); d.set(data); data = d; }
      let o = count * S; for (const b of w.balls) { data[o] = b.x; data[o + 1] = b.y; data[o + 2] = b.on ? 1 : 0; data[o + 3] = b.q[0]; data[o + 4] = b.q[1]; data[o + 5] = b.q[2]; data[o + 6] = b.q[3]; o += F; }
      count++;
    };
    put(); w.snd = w.snd || []; w.snd.length = 0; P.strike(w, shot.aim, shot.V, shot.a, shot.b);
    while (!P.rest(w) && count < 30 * 120) { P.step(w, TICK); for (const e of w.snd) events.push(Object.assign({ time: count * TICK }, e)); w.snd.length = 0; put(); }
    if (tape.tKey < 0) tape.tKey = Math.min((count - 1) * TICK, 1);
    if (tape.tHit < 0) tape.tHit = tape.tKey;
    Object.assign(tape, { nb, count, data, events, dur: (count - 1) * TICK, cue: shot.snap.cue });
    if (shot.kind) blunder(P, tape, shot);
    return tape;
  }
  // For a bad shot the moment worth showing is the moment it went wrong: the ball dropping that should not have, the wrong
  // ball being hit, the nearest the ball came to the pocket it missed, or the cue ball rolling to a stop having hit nothing.
  function blunder(P, tape, shot) {
    const id = shot.ball, a = [0, 0], b = [0, 0]; let t = tape.dur;
    const drop = tape.events.find(e => e.t === 'pocket' && e.id === id);
    if ((shot.kind === 'lost' || shot.kind === 'scratch') && drop) { t = drop.time; tape.kx = P.POCKETS[drop.pocket].x; tape.ky = P.POCKETS[drop.pocket].y; }
    else {
      if (shot.kind === 'wrong') t = tape.tHit;
      else if (shot.kind === 'miss' && P.POCKETS.length) {
        let best = 9; for (let i = Math.round(tape.tHit / TICK); i < tape.count; i += 2) { if (!at(tape, id, i * TICK, a)) break; for (const p of P.POCKETS) { const d = Math.hypot(a[0] - p.x, a[1] - p.y); if (d < best) { best = d; t = i * TICK; } } }
      }
      at(tape, id, t, a); tape.kx = a[0]; tape.ky = a[1];
    }
    at(tape, id, Math.max(0, t - 0.06), a); at(tape, id, Math.max(0, t - 0.01), b);
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > 1e-5) { tape.ux = (b[0] - a[0]) / l; tape.uy = (b[1] - a[1]) / l; }
    tape.tKey = Math.max(0.05, t); if (tape.tHit > tape.tKey) tape.tHit = tape.tKey;
  }
  // put the balls of a world where the tape has them at time t; returns the speed of the fastest ball (m/s)
  function seek(w, tape, t) {
    const d = tape.data, S = tape.nb * F, f = Math.max(0, Math.min(tape.count - 1, t / TICK)), i = Math.min(tape.count - 2, Math.floor(f)), k = f - i; let vmax = 0;
    for (let j = 0; j < tape.nb; j++) {
      const b = w.balls[j], o = Math.max(0, i) * S + j * F, o2 = tape.count > 1 ? o + S : o, both = d[o + 2] && d[o2 + 2], u = both ? k : 0;
      b.on = !!d[o + 2] && (both || k < 0.5);
      b.x = b.px = d[o] + (d[o2] - d[o]) * u; b.y = b.py = d[o + 1] + (d[o2 + 1] - d[o + 1]) * u;
      const sg = d[o + 3] * d[o2 + 3] + d[o + 4] * d[o2 + 4] + d[o + 5] * d[o2 + 5] + d[o + 6] * d[o2 + 6] < 0 ? -1 : 1;
      for (let c = 0; c < 4; c++) b.q[c] = d[o + 3 + c] + (sg * d[o2 + 3 + c] - d[o + 3 + c]) * u;
      b.vx = b.vy = b.wx = b.wy = b.wz = 0;
      if (both) vmax = Math.max(vmax, Math.hypot(d[o2] - d[o], d[o2 + 1] - d[o + 1]) / TICK);
    }
    return vmax;
  }
  // where one ball is at time t (out: [x, y]); false once it has left the table
  function at(tape, id, t, out) {
    const d = tape.data, S = tape.nb * F, f = Math.max(0, Math.min(tape.count - 1, t / TICK)), i = Math.max(0, Math.min(tape.count - 2, Math.floor(f))), o = i * S + id * F, o2 = tape.count > 1 ? o + S : o;
    const u = d[o + 2] && d[o2 + 2] ? f - i : 0; out[0] = d[o] + (d[o2] - d[o]) * u; out[1] = d[o + 1] + (d[o2 + 1] - d[o + 1]) * u;
    return !!d[o + 2];
  }
  // the line one ball draws over the whole shot, as [x, y, time, ...] with only the points that matter (corners kept sharp);
  // null for a ball that never moved
  function path(tape, id) {
    const d = tape.data, S = tape.nb * F, o0 = id * F; if (!d[o0 + 2]) return null;
    const pts = [d[o0], d[o0 + 1], 0]; let lx = d[o0], ly = d[o0 + 1], px = lx, py = ly, pt = 0, len = 0;
    for (let i = 1; i < tape.count; i++) {
      const o = i * S + o0; if (!d[o + 2]) break;
      const x = d[o], y = d[o + 1], ax = px - lx, ay = py - ly, bx = x - px, by = y - py, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      len += lb;
      if (la > 1e-4 && lb > 1e-5 && Math.abs(ax * by - ay * bx) / (la * lb) > 0.045) { pts.push(px, py, pt); lx = px; ly = py; }
      else if (Math.hypot(x - lx, y - ly) > 0.07) { pts.push(x, y, i * TICK); lx = x; ly = y; }
      px = x; py = y; pt = i * TICK;
    }
    if (len < 0.02) return null;
    if (pts[pts.length - 1] !== pt) pts.push(px, py, pt);
    return new Float32Array(pts);
  }
  return { snapshot, restore, rate, rateWorst, plan, record, seek, at, path };
}
if (typeof module !== 'undefined') module.exports = createHighlights;
