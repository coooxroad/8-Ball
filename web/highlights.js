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

  // Run the shot ahead of time to learn when the moment worth showing happens (the key ball drops; in carom, the second red is hit).
  function plan(P, n, shot) {
    const w = P.makeWorld(n); restore(w, shot.snap);
    P.strike(w, shot.aim, shot.V, shot.a, shot.b);
    const T = 1 / 120; let t = 0, tHit = -1, tKey = -1;
    while (!P.rest(w) && t < 30) {
      P.step(w, T); t += T;
      if (tHit < 0 && w.ev.firstHit != null) tHit = t;
      if (tKey < 0 && (shot.key >= 0 ? w.ev.pocketed.some(p => p.id === shot.key) : w.ev.hits.includes(2) && w.ev.hits.includes(3))) tKey = t;
    }
    return { tHit, tKey, dur: t };
  }
  return { snapshot, restore, rate, plan };
}
if (typeof module !== 'undefined') module.exports = createHighlights;
