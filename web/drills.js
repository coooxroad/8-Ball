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
    { id: 'free', name: '자유 연습', d: '규칙 없이 마음대로. 공을 옮기고 한 수 되돌릴 수 있습니다.' },
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
