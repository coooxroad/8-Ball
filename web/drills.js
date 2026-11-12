/* Lessons (훈련 · 레슨) and free practice: what goes on the table, what counts as success, and one shot known to work.
   The lessons that were here were made on an earlier physics and have been taken out; they are being made again, game by
   game. A lesson is one entry in `list`:
     { id, name, d (one line on the card), tip (the hint), vol: 'three' | 'four' | 'eight' | 'nine' (the game volume it
       sits in), course: one of COURSES (its book's colour), make(P, t, rnd, vOf) -> layout or null }
   make() is given the table (P), how hard (t: 0 at level 1 to 1 at the top level), a random source and the power curve,
   and returns { cue: [x, y], balls: [[id, x, y], ...], aim?, need: { pot?, any?, bank?, only? }, demo: { angle, power, a,
   b, el? }, zone?: { x, y, r } } - or null to be asked again. test/run.js plays every lesson's demo shot at every level on
   every table size and fails if it does not do what the lesson asks, so a lesson can never ask for the impossible.
   No DOM in here. */
function createDrills() {
  const LEVELS = 5;
  // the courses a volume's books are grouped in, first learned first (each its own leather: ui/book-*.webp)
  const COURSES = ['기본기', '큐볼 다루기', '응용', '자유롭게'];
  const list = [
    { id: 'free', name: '자유 연습', d: '규칙 없이 마음껏 쳐 보세요.' },
    /* 8볼 · 기본기 1 (the first lesson, and the pattern for the rest: tasks/gpt-lessons.md). The cue ball, the 1 and a
       corner pocket on one line: strike it straight, a touch below centre so the cue ball stops where it hits. Farther
       apart at each level. */
    { id: 'e-straight', name: '정면 넣기', d: '일직선으로 놓인 공을 똑바로 넣기', tip: '큐볼 가운데 조금 아래를 똑바로. 큐볼은 맞힌 자리에 멈춥니다.',
      vol: 'eight', course: '기본기',
      make(P, t, rnd) {
        const k = [0, 2, 3, 5][Math.floor(rnd() * 4)], pk = P.POCKETS[k], m = Math.hypot(pk.nx, pk.ny);
        const a0 = Math.atan2(-pk.ny / m, -pk.nx / m) + (rnd() - 0.5) * 0.6, ux = Math.cos(a0), uy = Math.sin(a0);
        const d1 = 0.22 + 0.4 * t + rnd() * 0.06, d2 = 0.2 + 0.45 * t + rnd() * 0.06;
        const ob = [pk.ax + ux * d1, pk.ay + uy * d1], cb = [ob[0] + ux * d2, ob[1] + uy * d2];
        for (const q of [ob, cb]) if (Math.abs(q[0]) > P.HL - 2.2 * P.R || Math.abs(q[1]) > P.HW - 2.2 * P.R) return null;
        return { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: Math.atan2(-uy, -ux), power: 0.3 + 0.18 * t, a: 0, b: -0.3 } };
      } },
  ];

  const byId = id => list.find(d => d.id === id) || list[0];
  // A layout for this drill at this level (1..LEVELS). Tries until one checks out; easier levels are the fallback.
  function make(id, P, level, rnd, vOf) {
    const d = byId(id); if (!d.make) return null;
    for (let lv = Math.max(1, Math.min(LEVELS, level)); lv >= 1; lv--) {
      const t = (lv - 1) / (LEVELS - 1);
      for (let k = 0; k < 60; k++) {
        const L = d.make(P, t, rnd, vOf);
        if (L) { if (!L.rack && L.aim == null) { const o = L.balls[0]; L.aim = Math.atan2(o[2] - L.cue[1], o[1] - L.cue[0]); } L.zone = L.zone || null; return L; }
      }
    }
    return null;
  }
  // '' when the shot did what the drill asks, otherwise the reason it did not
  function judge(L, ev, cue) {
    const potted = ev.pocketed.map(p => p.id), n = L.need;
    if (potted.includes(0)) return '큐볼이 포켓에 빠졌습니다';
    if (n.pot && !potted.includes(n.pot)) return `${n.pot}번 공이 들어가지 않았습니다`;
    if (n.any && potted.length < n.any) return '들어간 공이 없습니다';
    if (n.bank && !ev.railed.includes(n.bank)) return '쿠션에 튕기지 않고 들어갔습니다';
    if (n.only && ev.hits.some(h => h !== n.only)) return '다른 공을 건드렸습니다';
    if (L.zone && Math.hypot(cue.x - L.zone.x, cue.y - L.zone.y) > L.zone.r) return '큐볼이 원 밖에 섰습니다';
    return '';
  }
  // the reference shot in words, for the hint button
  function hint(shot) {
    const where = Math.abs(shot.b) < 0.07 && Math.abs(shot.a) < 0.07 ? '가운데' : [shot.b > 0.07 ? '위' : shot.b < -0.07 ? '아래' : '', shot.a > 0.07 ? '오른쪽' : shot.a < -0.07 ? '왼쪽' : ''].filter(Boolean).join(' ');
    return `세기 ${Math.round(shot.power * 100)}쯤, 큐볼 ${where}`;
  }
  return { list, LEVELS, COURSES, byId, make, judge, hint };
}
if (typeof module !== 'undefined') module.exports = createDrills;
