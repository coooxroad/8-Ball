/* Practice drills: what goes on the table, what counts as success, and one shot that is known to work.
   Every layout is generated (pocket, distances, angles change each time and get harder with the level), then
   checked by actually simulating the reference shot, so a drill can never ask for something impossible.
   No DOM in here. */
function createDrills() {
  const LEVELS = 5;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = d => d * Math.PI / 180;
  const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];
  const between = (rnd, a, b) => a + (b - a) * rnd();
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

  const isSide = (P, k) => Math.abs(k.x) < P.HL * 0.5;
  const corners = P => P.POCKETS.filter(k => !isSide(P, k));
  const sides = P => P.POCKETS.filter(k => isSide(P, k));
  // the direction a ball should travel to drop cleanly: down the diagonal for a corner, straight in for a side pocket
  function mouthDir(P, k) { return isSide(P, k) ? [0, Math.sign(k.y)] : [Math.sign(k.x) * Math.SQRT1_2, Math.sign(k.y) * Math.SQRT1_2]; }
  const inside = (P, x, y, m) => Math.abs(x) <= P.HL - m && Math.abs(y) <= P.HW - m;

  /* ---- a throw-away table to try shots on ---- */
  function table(P, cue, balls) {
    const w = P.makeWorld(16);
    for (let i = 1; i < 16; i++) { w.balls[i].on = false; w.balls[i].x = 9 + i; w.balls[i].y = 9; }
    P.place(w, 0, cue[0], cue[1]);
    for (const [id, x, y] of balls) P.place(w, id, x, y);
    return w;
  }
  function tryShot(P, w, shot, vOf) {
    const w2 = P.clone(w); P.strike(w2, shot.angle, vOf(shot.power), shot.a, shot.b);
    const ev = P.run(w2, 20), c = w2.balls[0];
    return { ev, x: c.x, y: c.y, potted: ev.pocketed.map(p => p.id) };
  }
  const passes = (need, r) => !r.potted.includes(0) && (!need.pot || r.potted.includes(need.pot)) && (!need.any || r.potted.length >= need.any)
    && (!need.bank || r.ev.railed.includes(need.bank)) && (!need.only || r.ev.hits.every(h => h === need.only));

  /* ---- shared recipe: object ball O into pocket K, cue ball behind it ---- */
  // dist: cue ball to contact point, run: object ball to pocket, cut: degrees off straight, spread: how far off the pocket's easy line
  function potLayout(P, rnd, o) {
    const K = pick(rnd, o.side ? sides(P) : corners(P)), m = mouthDir(P, K), R = P.R;
    const off = rad(between(rnd, -o.spread, o.spread)), u = rot(m[0], m[1], off);          // direction the object ball travels
    const run = Math.min(o.run, isSide(P, K) ? P.HW * 1.5 : Math.hypot(P.HL, P.HW) * 1.5);
    const O = [K.x - u[0] * run, K.y - u[1] * run];
    const G = [O[0] - u[0] * 2 * R, O[1] - u[1] * 2 * R];
    const cut = rad(o.cut * (rnd() < 0.5 ? -1 : 1)), back = rot(-u[0], -u[1], cut);
    const cue = [G[0] + back[0] * o.dist, G[1] + back[1] * o.dist];
    if (!inside(P, O[0], O[1], 2.6 * R) || !inside(P, cue[0], cue[1], 2.6 * R)) return null;
    return { K, u, O, G, cue, balls: [[1, O[0], O[1]]], angle: Math.atan2(G[1] - cue[1], G[0] - cue[0]) };
  }
  // nudge the aim a little either way until the reference shot really goes in (cut shots throw the ball slightly)
  function settle(P, w, L, need, spins, vOf, wide) {
    const steps = [0]; for (let k = 1; k <= (wide || 8); k++) steps.push(k * 0.0035, -k * 0.0035);
    for (const [power, a, b] of spins) for (const d of steps) {
      const shot = { angle: L.angle + d, power, a, b }; let r = tryShot(P, w, shot, vOf);
      if (!passes(need, r)) continue;
      // found one that works: walk to both ends of the working range and use its middle, so the reference shot has room for error
      const edge = dir => { let e = 0; for (let k = 1; k <= 14; k++) { if (!passes(need, tryShot(P, w, { angle: shot.angle + dir * k * 0.0012, power, a, b }, vOf))) break; e = k; } return e * 0.0012 * dir; };
      const mid = (edge(1) + edge(-1)) / 2;
      if (Math.abs(mid) > 1e-6) { const s2 = { angle: shot.angle + mid, power, a, b }, r2 = tryShot(P, w, s2, vOf); if (passes(need, r2)) return { shot: s2, r: r2 }; }
      return { shot, r };
    }
    return null;
  }

  /* ---- the drills ---- */
  const list = [
    { id: 'free', name: '자유 연습', d: '규칙 없이 마음대로. 공을 옮기고 한 수 되돌릴 수 있습니다.' },

    { id: 'straight', name: '똑바로 넣기', d: '일직선으로 놓인 공을 넣습니다.', tip: '공 한가운데를 겨눕니다. 세게 칠 필요가 없습니다.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.3, 0.8, t), run: lerp(0.35, 0.8, t), cut: 0, spread: lerp(8, 20, t) }); if (!L) return null;
        const need = { pot: 1 }, s = settle(P, table(P, L.cue, L.balls), L, need, [[0.36, 0, -0.12], [0.3, 0, -0.2]], vOf);
        return s && { cue: L.cue, balls: L.balls, need, demo: s.shot };
      } },

    { id: 'stop', name: '스톱 샷', d: '공을 넣고 큐볼을 그 자리에 세웁니다.', tip: '큐볼 가운데보다 조금 아래를 칩니다. 멀수록 더 아래를, 더 세게.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.28, 0.75, t), run: lerp(0.4, 0.8, t), cut: 0, spread: 18 }); if (!L) return null;
        const need = { pot: 1 }, w = table(P, L.cue, L.balls);
        let best = null;
        for (const power of [0.4, 0.5, 0.6]) for (const b of [-0.1, -0.18, -0.26, -0.34, -0.42, -0.5]) {
          const shot = { angle: L.angle, power, a: 0, b }, r = tryShot(P, w, shot, vOf); if (!passes(need, r)) continue;
          const e = Math.hypot(r.x - L.G[0], r.y - L.G[1]); if (!best || e < best.e) best = { e, shot };
        }
        if (!best || best.e > 0.035) return null;
        return { cue: L.cue, balls: L.balls, need, demo: best.shot, zone: { x: L.G[0], y: L.G[1], r: lerp(0.11, 0.065, t) } };
      } },

    { id: 'follow', name: '밀어치기', d: '공을 넣고 큐볼을 앞으로 보냅니다.', tip: '큐볼 위쪽을 칩니다. 세기로 얼마나 따라갈지를 정합니다.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.3, 0.6, t), run: between(rnd, 0.7, 0.85) + 0.25 * t, cut: 0, spread: 14 }); if (!L) return null;
        const need = { pot: 1 }, s = settle(P, table(P, L.cue, L.balls), L, need, [[between(rnd, 0.26, 0.42), 0, between(rnd, 0.3, 0.5)]], vOf); if (!s) return null;
        const fwd = (s.r.x - L.G[0]) * L.u[0] + (s.r.y - L.G[1]) * L.u[1]; if (fwd < 0.22 || !inside(P, s.r.x, s.r.y, 0.12)) return null;
        return { cue: L.cue, balls: L.balls, need, demo: s.shot, zone: { x: s.r.x, y: s.r.y, r: lerp(0.17, 0.1, t) } };
      } },

    { id: 'draw', name: '끌어치기', d: '공을 넣고 큐볼을 뒤로 당겨 옵니다.', tip: '큐볼 맨 아래를 세게 칩니다. 가까울수록 잘 끌려옵니다.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.24, 0.48, t), run: lerp(0.38, 0.6, t), cut: 0, spread: 16 }); if (!L) return null;
        const need = { pot: 1 }, s = settle(P, table(P, L.cue, L.balls), L, need, [[between(rnd, 0.42, 0.6), 0, -0.5]], vOf); if (!s) return null;
        const back = -((s.r.x - L.G[0]) * L.u[0] + (s.r.y - L.G[1]) * L.u[1]); if (back < 0.2 || !inside(P, s.r.x, s.r.y, 0.12)) return null;
        return { cue: L.cue, balls: L.balls, need, demo: s.shot, zone: { x: s.r.x, y: s.r.y, r: lerp(0.18, 0.11, t) } };
      } },

    { id: 'cut', name: '비껴 넣기', d: '비스듬히 놓인 공을 넣습니다.', tip: '공 가운데가 아니라, 포켓 반대쪽 옆구리를 겨눕니다.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.35, 0.7, t), run: lerp(0.35, 0.7, t), cut: between(rnd, lerp(12, 30, t), lerp(24, 46, t)), spread: 20 }); if (!L) return null;
        const need = { pot: 1 }, s = settle(P, table(P, L.cue, L.balls), L, need, [[0.4, 0, 0], [0.5, 0, -0.1]], vOf);
        return s && { cue: L.cue, balls: L.balls, need, demo: s.shot };
      } },

    { id: 'thin', name: '얇게 치기', d: '많이 비껴 놓인 공을 살짝 스쳐 넣습니다.', tip: '공 가장자리만 스치게. 얇을수록 공이 느리게 가니 조금 세게 칩니다.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.3, 0.55, t), run: lerp(0.3, 0.5, t), cut: between(rnd, lerp(48, 60, t), lerp(56, 70, t)), spread: 14 }); if (!L) return null;
        const need = { pot: 1 }, s = settle(P, table(P, L.cue, L.balls), L, need, [[0.55, 0, 0], [0.7, 0, 0]], vOf, 12);
        return s && { cue: L.cue, balls: L.balls, need, demo: s.shot };
      } },

    { id: 'side', name: '사이드 포켓', d: '가운데 포켓은 비스듬할수록 입구가 좁아집니다.', tip: '포켓 정면에 가까울수록 쉽습니다. 턱에 맞지 않게 한가운데로.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { side: true, dist: lerp(0.35, 0.6, t), run: lerp(0.3, 0.6, t), cut: between(rnd, 0, lerp(15, 35, t)), spread: lerp(12, 42, t) }); if (!L) return null;
        const need = { pot: 1 }, s = settle(P, table(P, L.cue, L.balls), L, need, [[0.4, 0, 0]], vOf);
        return s && { cue: L.cue, balls: L.balls, need, demo: s.shot };
      } },

    { id: 'bank', name: '뱅크 샷', d: '공을 쿠션에 한 번 튕겨 넣습니다.', tip: '포켓을 쿠션 건너편에 거울처럼 비춘 자리를 겨눈다고 생각하세요.',
      make(P, t, rnd, vOf) {
        // bank off a long rail into the side pocket on the other side, or (harder) into a far corner
        const R = P.R, K = pick(rnd, rnd() < lerp(0.9, 0.4, t) ? sides(P) : corners(P)), rail = -Math.sign(K.y) * (P.HW - R);
        const O = [K.x + between(rnd, -0.45, 0.45) * P.HL + (isSide(P, K) ? 0 : -Math.sign(K.x) * P.HL * 0.7), rail * between(rnd, 0.15, 0.6)];
        if (!inside(P, O[0], O[1], 3 * R)) return null;
        const img = [K.x, 2 * rail - K.y], l = Math.hypot(img[0] - O[0], img[1] - O[1]), u = [(img[0] - O[0]) / l, (img[1] - O[1]) / l];
        const G = [O[0] - u[0] * 2 * R, O[1] - u[1] * 2 * R], back = rot(-u[0], -u[1], rad(between(rnd, -1, 1) * lerp(0, 22, t)));
        const cue = [G[0] + back[0] * lerp(0.3, 0.5, t), G[1] + back[1] * lerp(0.3, 0.5, t)];
        if (!inside(P, cue[0], cue[1], 2.6 * R)) return null;
        const L = { cue, balls: [[1, O[0], O[1]]], angle: Math.atan2(G[1] - cue[1], G[0] - cue[0]) }, need = { pot: 1, bank: 1 };
        const s = settle(P, table(P, L.cue, L.balls), L, need, [[0.42, 0, 0], [0.34, 0, 0], [0.5, 0, 0]], vOf, 16);
        return s && { cue: L.cue, balls: L.balls, need, demo: s.shot };
      } },

    { id: 'spin', name: '옆 회전', d: '쿠션에 똑바로 쳐도 회전을 주면 옆으로 꺾입니다.', tip: '쿠션을 정면으로 겨눈 채 큐볼 옆을 칩니다. 많이 줄수록 많이 꺾입니다.',
      make(P, t, rnd, vOf) {
        const up = rnd() < 0.5 ? 1 : -1, cue = [between(rnd, -0.5, 0.5) * P.HL, -up * between(rnd, 0.0, 0.45) * P.HW];
        const shot = { angle: up * Math.PI / 2, power: between(rnd, 0.36, 0.5), a: (rnd() < 0.5 ? -1 : 1) * between(rnd, lerp(0.38, 0.2, t), 0.5), b: 0 };
        const r = tryShot(P, table(P, cue, []), shot, vOf);
        if (r.potted.length || Math.abs(r.x - cue[0]) < 0.25 || !inside(P, r.x, r.y, 0.1)) return null;
        return { cue, balls: [], aim: shot.angle, need: {}, demo: shot, zone: { x: r.x, y: r.y, r: lerp(0.19, 0.12, t) } };
      } },

    { id: 'position', name: '다음 공 자리 잡기', d: '1번을 넣고, 2번을 치기 좋은 곳에 큐볼을 세웁니다.', tip: '세기와 칠 곳으로 큐볼이 멈출 자리를 정합니다. 2번은 건드리지 않습니다.',
      make(P, t, rnd, vOf) {
        const L = potLayout(P, rnd, { dist: lerp(0.35, 0.6, t), run: lerp(0.35, 0.6, t), cut: between(rnd, 15, 40), spread: 18 }); if (!L) return null;
        const need = { pot: 1, only: 1 }, w = table(P, L.cue, L.balls);
        const s = settle(P, w, L, need, [[between(rnd, 0.3, 0.62), 0, pick(rnd, [-0.35, -0.15, 0, 0.2, 0.4])]], vOf); if (!s) return null;
        if (!inside(P, s.r.x, s.r.y, 0.1) || Math.hypot(s.r.x - L.cue[0], s.r.y - L.cue[1]) < 0.2) return null;
        // the next ball sits a comfortable shot away from where the cue ball ends up, and out of the way of this shot
        for (let k = 0; k < 12; k++) {
          const a = rnd() * Math.PI * 2, d = between(rnd, 0.32, 0.55), x = s.r.x + Math.cos(a) * d, y = s.r.y + Math.sin(a) * d;
          if (!inside(P, x, y, 3 * P.R) || Math.hypot(x - L.O[0], y - L.O[1]) < 0.15) continue;
          const balls = L.balls.concat([[2, x, y]]), r2 = tryShot(P, table(P, L.cue, balls), s.shot, vOf);
          if (passes(need, r2) && Math.hypot(r2.x - s.r.x, r2.y - s.r.y) < 0.01) return { cue: L.cue, balls, need, demo: s.shot, zone: { x: s.r.x, y: s.r.y, r: lerp(0.22, 0.13, t) } };
        }
        return null;
      } },

    { id: 'break', name: '브레이크', d: '공을 깨서 하나 이상 넣습니다.', tip: '맨 앞 공을 정면으로, 가장 세게. 큐볼이 빠지면 실패입니다.',
      make() { return { rack: true, need: { any: 1 }, demo: { angle: 0, power: 1, a: 0, b: 0 } }; } },
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
  return { list, LEVELS, byId, make, judge, hint };
}
if (typeof module !== 'undefined') module.exports = createDrills;
