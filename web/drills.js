/* Lessons (훈련 · 레슨) and free practice: what goes on the table, what counts as success, and one shot known to work.
   The lessons that were here were made on an earlier physics and have been taken out; they are being made again, game by
   game. A lesson is one entry in `list`:
     { id, name, d (one line on the card), tip (the hint), vol: 'three' | 'four' | 'eight' | 'nine' (the game volume it
       sits in), course: one of COURSES (its book's colour), make(P, t, rnd, vOf) -> layout or null }
   make() is given the table (P), how hard (t: 0 at level 1 to 1 at the top level), a random source and the power curve,
   and returns { cue: [x, y], balls: [[id, x, y], ...], aim?, need: { pot?, any?, bank?, only?, first? (the ball the cue ball
   must hit first), kick? (the cue ball off a cushion before any ball) }, demo: { angle, power, a,
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
    // 8볼 · 기본기 2. A cut: the 1 on its way to a corner, the cue ball off to one side - the ghost ball's angle, wider at
    // each level (10 to 40 degrees).
    { id: 'e-cut', name: '컷샷', d: '비스듬히 맞혀 넣기', tip: '1번 공 뒤에 공 하나가 더 있다고 생각하고, 그 자리를 겨냥하세요.',
      vol: 'eight', course: '기본기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.5), d1 = 0.2 + 0.3 * t + rnd() * 0.08;
        const ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk), th = (10 + 30 * t + rnd() * 5) * Math.PI / 180 * (rnd() < 0.5 ? -1 : 1);
        const v = rot(u, th), d2 = 0.25 + 0.3 * t + rnd() * 0.1, cb = [g[0] + v[0] * d2, g[1] + v[1] * d2];
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power: 0.3 + 0.15 * t, a: 0, b: 0 } };
        return fits(P, L) && works(P, L, vOf) ? L : null;
      } },
    // 8볼 · 기본기 3. A stop shot: straight in, the cue ball dead where it struck - inside a ring that shrinks with the level.
    { id: 'e-stop', name: '스톱샷', d: '맞힌 자리에 큐볼 세우기', tip: '큐볼 가운데 아래를 치세요. 멀수록 조금 더 아래, 조금 더 세게.',
      vol: 'eight', course: '기본기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.4), d1 = 0.2 + 0.25 * rnd(), ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const d2 = 0.25 + 0.4 * t + rnd() * 0.08, cb = [g[0] + u[0] * d2, g[1] + u[1] * d2], power = 0.32 + 0.16 * t;
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power, a: 0, b: 0 } };
        if (!fits(P, L)) return null;
        return ringed(P, L, vOf, strokes([power - 0.08, power, power + 0.08, power + 0.16], [-0.08, -0.13, -0.18, -0.24, -0.3, -0.38, -0.46]), g, 0.13 - 0.06 * t, end => Math.hypot(end[0] - g[0], end[1] - g[1]) < 0.06);
      } },
    // 8볼 · 큐볼 다루기 1. Draw: the cue ball back towards where it came from, into a ring behind.
    { id: 'e-draw', name: '끌어치기', d: '큐볼을 뒤로 끌어오기', tip: '큐볼 아래를 세게. 큐를 끝까지 밀어 주세요.',
      vol: 'eight', course: '큐볼 다루기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.4), d1 = 0.2 + 0.2 * rnd(), ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const d2 = 0.3 + 0.25 * t + rnd() * 0.08, cb = [g[0] + u[0] * d2, g[1] + u[1] * d2];
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power: 0.45 + 0.15 * t, a: 0, b: -0.75 } };
        if (!fits(P, L)) return null;
        // (back by a hand's width at least: the ring is behind where it struck)
        return ringed(P, L, vOf, strokes([L.demo.power, L.demo.power + 0.1], [-0.75, -0.65, -0.85]), g, 0.15 - 0.06 * t, end => (end[0] - g[0]) * u[0] + (end[1] - g[1]) * u[1] > 0.18);
      } },
    // 8볼 · 큐볼 다루기 2. Follow: nearly straight in, the cue ball carried on past where it struck into a ring ahead
    // (short of the pocket).
    { id: 'e-follow', name: '밀어치기', d: '큐볼을 앞으로 밀어 보내기', tip: '큐볼 위를 치세요. 너무 세면 큐볼도 들어갑니다.',
      vol: 'eight', course: '큐볼 다루기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.5), d1 = 0.38 + 0.22 * rnd(), ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const th = (2 + 5 * rnd()) * Math.PI / 180 * (rnd() < 0.5 ? -1 : 1), v = rot(u, th), d2 = 0.25 + 0.25 * t, cb = [g[0] + v[0] * d2, g[1] + v[1] * d2];
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power: 0.3, a: 0, b: 0.5 } };
        if (!fits(P, L)) return null;
        // (on along the way it was going: ahead of where it struck by a hand's width)
        return ringed(P, L, vOf, strokes([0.16, 0.2, 0.24, 0.28, 0.32], [0.25, 0.4, 0.55]), g, 0.15 - 0.06 * t, end => (end[0] - g[0]) * -v[0] + (end[1] - g[1]) * -v[1] > 0.15);
      } },
    // 8볼 · 큐볼 다루기 3. Position: a cut, and the cue ball left in a ring somewhere on the table - the next shot's place.
    { id: 'e-place', name: '자리 잡기', d: '넣고 큐볼을 원 안에 세우기', tip: '세기로 거리를, 당점으로 방향을 정하세요.',
      vol: 'eight', course: '큐볼 다루기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.6), d1 = 0.22 + 0.25 * rnd(), ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const th = (15 + 20 * rnd()) * Math.PI / 180 * (rnd() < 0.5 ? -1 : 1), v = rot(u, th), d2 = 0.3 + 0.3 * rnd(), cb = [g[0] + v[0] * d2, g[1] + v[1] * d2];
        const b = [0.4, 0, -0.5][Math.floor(rnd() * 3)];
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power: 0.32 + 0.2 * rnd(), a: 0, b } };
        if (!fits(P, L)) return null;
        return ringed(P, L, vOf, [[L.demo.power, b]], null, 0.17 - 0.08 * t, end => Math.hypot(end[0] - cb[0], end[1] - cb[1]) > 0.2);
      } },
    // 8볼 · 응용 1. A bank: the 1 off the far long cushion and back into a pocket on its own side.
    { id: 'e-bank', name: '뱅크샷', d: '쿠션에 한 번 맞혀 넣기', tip: '쿠션에 비친 포켓을 겨냥한다고 생각하세요.',
      vol: 'eight', course: '응용',
      make(P, t, rnd, vOf) {
        const side = rnd() < 0.5 ? 1 : -1, pks = P.POCKETS.filter(p => p.ny * side < -0.5), pk = pks[Math.floor(rnd() * pks.length)];
        const ob = [(rnd() - 0.5) * P.HL * 0.9, -side * (P.HW * (0.02 + 0.3 * rnd()))], wall = side * (P.HW - P.R), cut = (rnd() - 0.5) * (0.2 + 0.4 * t);
        const m = [pk.ax, 2 * wall - pk.ay], d = Math.hypot(m[0] - ob[0], m[1] - ob[1]), u0 = [(m[0] - ob[0]) / d, (m[1] - ob[1]) / d];
        // (the cushion takes a little of the angle: tried a few ways round the mirrored pocket, the first that goes in kept)
        for (const [off, pw] of strokes([0, 0.015, -0.015, 0.03, -0.03, 0.05, -0.05, 0.07, -0.07, 0.1, -0.1], [0, 0.1]).map(([o, p]) => [o, p])) {
          const u = rot(u0, off), g = [ob[0] - u[0] * 2 * P.R, ob[1] - u[1] * 2 * P.R], d2 = 0.18 + 0.22 * t, k = rot(u, cut), cb = [g[0] - k[0] * d2, g[1] - k[1] * d2];
          const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1, bank: 1 }, demo: { angle: aimTo(cb, g), power: 0.5 + 0.12 * t + pw, a: 0, b: 0 } };
          if (fits(P, L) && works(P, L, vOf)) return L;
        }
        return null;
      } },
    // 8볼 · 응용 2. A kick: the cue ball off a cushion first, then the 1 into a pocket.
    { id: 'e-kick', name: '킥샷', d: '큐볼을 쿠션에 먼저 맞히고 넣기', tip: '큐볼이 갈 자리를 쿠션에 비춰서 겨냥하세요.',
      vol: 'eight', course: '응용',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.4), d1 = 0.15 + 0.2 * rnd(), ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        // the cushion the cue ball comes off: the long one on the 1's side, the cue ball nearer the middle
        const sy = Math.sign(ob[1]) || 1, wall = sy * (P.HW - P.R), cb = [ob[0] - Math.sign(ob[0] || 1) * (0.45 + 0.35 * t), -sy * P.HW * (0.1 + 0.3 * rnd())];
        const mg = [g[0], 2 * wall - g[1]], a0 = aimTo(cb, mg);
        for (const off of [0, 0.01, -0.01, 0.02, -0.02, 0.03, -0.03, 0.045, -0.045]) {
          const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1, kick: true }, demo: { angle: a0 + off, power: 0.42 + 0.12 * t, a: 0, b: 0 } };
          if (fits(P, L) && works(P, L, vOf)) { L.aim = L.demo.angle; return L; }
        }
        return null;
      } },
    // 8볼 · 응용 3. A combination: the cue ball on the 1, the 1 on the 2, the 2 in.
    { id: 'e-combo', name: '콤비네이션', d: '1번 공으로 2번 공을 넣기', tip: '2번 공을 넣을 자리를 정하고, 1번 공을 그 자리로 보내세요.',
      vol: 'eight', course: '응용',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.4), d1 = 0.15 + 0.15 * rnd(), b2 = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g2 = ghost(P, b2, pk);
        const v = rot(u, (rnd() - 0.5) * 0.3 * t), gap = 0.12 + 0.2 * t, b1 = [g2[0] + v[0] * gap, g2[1] + v[1] * gap], g1 = [b1[0] + v[0] * 2 * P.R, b1[1] + v[1] * 2 * P.R];
        const d2 = 0.25 + 0.2 * t, cb = [g1[0] + v[0] * d2, g1[1] + v[1] * d2];
        const L = { cue: cb, balls: [[1, b1[0], b1[1]], [2, b2[0], b2[1]]], need: { pot: 2, first: 1 }, demo: { angle: aimTo(cb, g1), power: 0.4 + 0.15 * t, a: 0, b: 0 } };
        return fits(P, L) && works(P, L, vOf) ? L : null;
      } },
    // 9볼 · 기본기 1. The 9 into a corner from a cut: the 9 is the game.
    { id: 'n-cut', name: '9번 공 넣기', d: '비스듬히 놓인 9번 공 넣기', tip: '9번 공 뒤에 공 하나가 더 있다고 생각하고 겨냥하세요.',
      vol: 'nine', course: '기본기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.5), d1 = 0.25 + 0.3 * t, ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const v = rot(u, (12 + 25 * t) * Math.PI / 180 * (rnd() < 0.5 ? -1 : 1)), d2 = 0.3 + 0.35 * t, cb = [g[0] + v[0] * d2, g[1] + v[1] * d2];
        const L = { cue: cb, balls: [[9, ob[0], ob[1]]], need: { pot: 9 }, demo: { angle: aimTo(cb, g), power: 0.32 + 0.15 * t, a: 0, b: 0 } };
        return fits(P, L) && works(P, L, vOf) ? L : null;
      } },
    // 9볼 · 기본기 2. A side pocket: the narrower mouth, straight on.
    { id: 'n-side', name: '사이드 포켓', d: '가운데 포켓에 넣기', tip: '사이드 포켓은 정면에 가까울수록 잘 들어갑니다.',
      vol: 'nine', course: '기본기',
      make(P, t, rnd, vOf) {
        const pk = P.POCKETS[rnd() < 0.5 ? 1 : 4], u = inward(pk, (rnd() - 0.5) * (0.3 + 0.5 * t)), d1 = 0.2 + 0.2 * t, ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const v = rot(u, (5 + 15 * t) * Math.PI / 180 * (rnd() < 0.5 ? -1 : 1)), d2 = 0.25 + 0.2 * t, cb = [g[0] + v[0] * d2, g[1] + v[1] * d2];
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power: 0.3 + 0.1 * t, a: 0, b: 0 } };
        return fits(P, L) && works(P, L, vOf) ? L : null;
      } },
    // 9볼 · 큐볼 다루기. The 1 in, the cue ball left for the 2 (a ring where the 2 can be potted from).
    { id: 'n-next', name: '다음 공 보기', d: '넣고 다음 공을 칠 자리에 세우기', tip: '넣는 것보다 큐볼이 설 자리를 먼저 정하세요.',
      vol: 'nine', course: '큐볼 다루기',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.6), d1 = 0.22 + 0.2 * rnd(), ob = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g = ghost(P, ob, pk);
        const v = rot(u, (15 + 20 * rnd()) * Math.PI / 180 * (rnd() < 0.5 ? -1 : 1)), d2 = 0.3 + 0.25 * rnd(), cb = [g[0] + v[0] * d2, g[1] + v[1] * d2];
        const b = [0.35, 0, -0.45][Math.floor(rnd() * 3)];
        const L = { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, demo: { angle: aimTo(cb, g), power: 0.3 + 0.18 * rnd(), a: 0, b } };
        if (!fits(P, L)) return null;
        const R = ringed(P, L, vOf, [[L.demo.power, b]], null, 0.16 - 0.07 * t, end => Math.hypot(end[0] - cb[0], end[1] - cb[1]) > 0.2);
        if (!R) return null;
        // the 2 set where it can be potted from the ring: on a line from the ring through it to another corner
        const pk2 = P.POCKETS.filter(q => q !== pk && [0, 2, 3, 5].includes(P.POCKETS.indexOf(q)))[Math.floor(rnd() * 3)], z = R.zone;
        const dz = Math.hypot(pk2.ax - z.x, pk2.ay - z.y), b2 = [z.x + (pk2.ax - z.x) * 0.55, z.y + (pk2.ay - z.y) * 0.55];
        if (dz < 0.4 || !P.isFree || Math.hypot(b2[0] - ob[0], b2[1] - ob[1]) < 4 * P.R) return null;
        R.balls.push([2, b2[0], b2[1]]); R.need.only = 1;
        return works(P, R, vOf) ? R : null;
      } },
    // 9볼 · 응용. The 1 on the 9: the combination that wins a rack.
    { id: 'n-combo', name: '1-9 콤비', d: '1번 공으로 9번 공을 넣기', tip: '9번 공을 넣을 자리로 1번 공을 보내세요.',
      vol: 'nine', course: '응용',
      make(P, t, rnd, vOf) {
        const pk = corner(P, rnd), u = inward(pk, (rnd() - 0.5) * 0.4), d1 = 0.15 + 0.15 * rnd(), b9 = [pk.ax + u[0] * d1, pk.ay + u[1] * d1], g9 = ghost(P, b9, pk);
        const v = rot(u, (rnd() - 0.5) * 0.35 * t), gap = 0.15 + 0.25 * t, b1 = [g9[0] + v[0] * gap, g9[1] + v[1] * gap], g1 = [b1[0] + v[0] * 2 * P.R, b1[1] + v[1] * 2 * P.R];
        const w = rot(v, (rnd() - 0.5) * 0.4 * t), d2 = 0.25 + 0.25 * t, cb = [g1[0] + w[0] * d2, g1[1] + w[1] * d2];
        const L = { cue: cb, balls: [[1, b1[0], b1[1]], [9, b9[0], b9[1]]], need: { pot: 9, first: 1 }, demo: { angle: aimTo(cb, g1), power: 0.4 + 0.15 * t, a: 0, b: 0 } };
        return fits(P, L) && works(P, L, vOf) ? L : null;
      } },
  ];
  /* helpers for the lessons: a corner pocket by chance; the way into the table from a pocket's mouth (turned by off); a
     vector turned; the ghost ball - where the cue ball must be to send ob into pk; the angle from a to b; whether a layout's
     balls are all on the cloth and apart; and the demo played on a table of its own - each lesson keeps a layout only
     when its demo does what it asks, so the checks in test/run.js (every level, every table size) cannot fail */
  const corner = (P, rnd) => P.POCKETS[[0, 2, 3, 5][Math.floor(rnd() * 4)]];
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const inward = (pk, off) => { const m = Math.hypot(pk.nx, pk.ny); return rot([-pk.nx / m, -pk.ny / m], off); };
  const ghost = (P, ob, pk) => { const dx = pk.ax - ob[0], dy = pk.ay - ob[1], d = Math.hypot(dx, dy); return [ob[0] - dx / d * 2 * P.R, ob[1] - dy / d * 2 * P.R]; };
  const aimTo = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  function fits(P, L) {
    const all = [L.cue, ...L.balls.map(b => [b[1], b[2]])];
    for (const q of all) if (Math.abs(q[0]) > P.HL - 2.2 * P.R || Math.abs(q[1]) > P.HW - 2.2 * P.R) return false;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]) < 2.4 * P.R) return false;
    return true;
  }
  function play(P, L, vOf) {
    const w = P.makeWorld(16); for (let i = 1; i < 16; i++) { w.balls[i].on = false; w.balls[i].x = 9 + i; w.balls[i].y = 9; }
    P.place(w, 0, L.cue[0], L.cue[1]); for (const [id, x, y] of L.balls) P.place(w, id, x, y);
    P.strike(w, L.demo.angle, vOf(L.demo.power), L.demo.a, L.demo.b);
    return { ev: P.run(w, 20), cue: w.balls[0] };
  }
  const works = (P, L, vOf) => { const r = play(P, L, vOf); return judge(L, r.ev, r.cue) === ''; };
  // strokes to try: each power with each height on the cue ball
  const strokes = (ps, bs) => ps.flatMap(p => bs.map(b => [p, b]));
  /* a lesson whose cue ball must stop in a ring: each stroke tried ([power, b]), the first whose ball goes in and whose cue ball
     stops where want(end) says - the ring put round where it stopped (radius r) */
  function ringed(P, L, vOf, strokes, at, r, want) {
    for (const [power, b] of strokes) {
      L.demo.power = power; L.demo.b = b; L.zone = null; const q = play(P, L, vOf);
      if (judge(L, q.ev, q.cue) !== '' || !q.cue.on) continue;
      const end = [q.cue.x, q.cue.y]; if (!want(end)) continue;
      if (Math.abs(end[0]) > P.HL - r * 0.6 || Math.abs(end[1]) > P.HW - r * 0.6) continue;
      L.zone = { x: end[0], y: end[1], r: Math.max(0.05, r) };
      return L;
    }
    return null;
  }

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
    if (n.first && ev.firstHit !== n.first) return `${n.first}번 공을 먼저 맞히지 않았습니다`;
    if (n.kick && !ev.pre) return '큐볼이 쿠션에 먼저 닿지 않았습니다';
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
