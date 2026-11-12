/* ================= flow: puzzle (one position, one shot to score with; solve it and the next one comes) ================= */
const puzzle = {
  quiet: false, save: false, cur: null, helped: 0, tries: 0,     // helped: 1 a hint seen, 2 the answer
  stage: z => puzzles.STAGES[z.stage],
  // the balls of a puzzle, onto the table
  put(z) {
    const P = game.P, w = game.world, n = Math.hypot(z.balls[2][0] - z.balls[0][0], z.balls[2][1] - z.balls[0][1]) <= Math.hypot(z.balls[3][0] - z.balls[0][0], z.balls[3][1] - z.balls[0][1]) ? 2 : 3;
    w.walls = P.walls(z.walls);                                       // (its barricades, if it has any)
    // (its table's shape, if it has one: { kind, ... } as tables.js TABLE_SHAPES makes, or { poly, holes } given whole)
    w.shape = z.shape ? P.shape(z.shape.poly ? z.shape : TABLE_SHAPES.spec(P, z.shape)) : null;
    z.balls.forEach((b, i) => P.place(w, i, b[0], b[1], Math.random));
    w.cue = 0; game.goal = puzzle.stage(z).goal;
    scene.clearFalls(); scene.setZone(null); scene.setMarks(null); st.aim = Math.atan2(z.balls[n][1] - z.balls[0][1], z.balls[n][0] - z.balls[0][0]); st.rev++; scene.invalidate();
  },
  start(id) {
    if (!puzzles.list.length) return toast('새 퍼즐을 만드는 중입니다.', '', 2200);
    const z = puzzles.byId(id || prefs.pz.cur) || puzzles.list[0], p = puzzle;
    if (!p.cur || p.cur.id !== z.id) { p.helped = 0; p.tries = 0; }
    p.cur = z; prefs.pz.cur = z.id; prefs.pz.open = z.stage; savePrefs();
    usePhysics(); game.start('puzzle4', [prefs.names[0], ''], false, {});
    flow = puzzle; dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); show('play'); p.bar(); p.again();
    toast(`${z.stage + 1}-${z.n} ${p.stage(z).name} · ${game.MODES.puzzle4.GOALS[p.stage(z).goal].text}. 노란 공은 건드리면 안 됩니다.`, '', 4200);
  },
  restart() { puzzle.start(); },
  again() { flow = puzzle; puzzle.put(puzzle.cur); beginTurn(true); },
  // the next one not yet solved after this (or simply the next, when all are), staying inside the stages that are open
  step(dir) {
    const L = pzList().filter(q => pzOpen(q.stage)), i = Math.max(0, L.indexOf(puzzle.cur)); let k = i;
    for (let n = 0; n < L.length; n++) { k = (k + dir + L.length) % L.length; if (!prefs.pz.stars[L[k].id]) break; }
    if (k === i) k = (i + dir + L.length) % L.length;
    puzzle.start(L[k].id);
  },
  guide: () => GUIDE_STD,
  auto: () => null,
  beforeShot(V, a, b, el) { scene.setMarks(null); puzzle.shot = { aim: st.aim, V, a, b, el: el || 0 }; puzzle.pre = game.P.clone(game.world); },
  /* How cleanly a shot solves it (owner 11-10: stars by the shot's accuracy, not by the tries before it): the same shot
     played again from the same table a quarter and a half of a degree either side, and 3% and 6% softer and harder - how
     many of those eight still solve it. A shot in the middle of what works keeps working; one that only just got there
     does not. (Null: the shot itself does not solve it.) */
  sureOf(s, goal) {
    const p = puzzle, P = game.P, M = game.MODES.puzzle4, d = Math.PI / 720, play = (da, k) => { const w = P.clone(p.pre); P.strike(w, s.aim + da, s.V * k, s.a, s.b, s.el); return M.judge(goal, P.run(w, 30), w).ok; };
    if (!play(0, 1)) return null;
    let ok = 0;
    for (const [da, k] of [[d, 1], [-d, 1], [2 * d, 1], [-2 * d, 1], [0, 0.97], [0, 1.03], [0, 0.94], [0, 1.06]]) if (play(da, k)) ok++;
    return ok;
  },
  // the stars: five of the eight for three, two for two - or fewer, where even the stored answer has no more room than that
  starsOf(goal) {
    const p = puzzle, z = p.cur, sure = p.sureOf(p.shot, goal), ref = p.sureOf({ aim: z.sol[0], V: z.sol[1], a: z.sol[2], b: z.sol[3], el: z.sol[4] }, goal);
    const s3 = ref == null ? 5 : Math.min(5, ref), s2 = ref == null ? 2 : Math.min(2, ref);
    return sure == null ? 1 : sure >= s3 ? 3 : sure >= s2 ? 2 : 1;
  },
  /* after a miss, once a session while it is off: a small capsule in the middle - 빠른 진행을 켤까요? and a tick. Its edge fills
     blue as the moments pass; full, it drops away and fades (owner 11-10). The tick turns it on for puzzles. */
  askFast() {
    const p = puzzle; if (p.askedFast || prefs.pzFast || flow !== puzzle) return; p.askedFast = true;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), edge = document.createElementNS(ns, 'rect');
    svg.setAttribute('class', 'fa-edge'); svg.setAttribute('aria-hidden', 'true'); edge.setAttribute('pathLength', '1'); svg.appendChild(edge);
    const go = () => { cap.classList.add('away'); setTimeout(() => cap.remove(), 450); };
    const tick = el('button', { class: 'fa-ok', 'aria-label': '빠른 진행 켜기', onclick: () => { SND.tap(); prefs.pzFast = true; savePrefs(); cap.classList.add('on'); setTimeout(go, 380); } });
    const cap = el('div', { class: 'fast-ask', role: 'status' }, [svg, el('span', { text: '빠른 진행을 켤까요?' }), tick]);
    edge.addEventListener('animationend', go, { once: true });
    $('#app').appendChild(cap);
    const fit = () => { const r = cap.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); edge.setAttribute('x', 1.5); edge.setAttribute('y', 1.5); edge.setAttribute('width', r.width - 3); edge.setAttribute('height', r.height - 3); edge.setAttribute('rx', (r.height - 3) / 2); };
    requestAnimationFrame(fit);
  },
  afterShot() {
    const p = puzzle, z = p.cur, r = game.resolve().r;
    if (!r.solved) { p.tries++; toast('다시 · ' + r.note, 'foul', 1900); SND.bad(); if (!prefs.pzFast && !p.askedFast) setTimeout(p.askFast, 1700); return hold(1.6, p.again); }
    // three stars for a clean shot, two for a fair one, one for a shot that only just did it; a hint takes one off the most, the answer shown two
    const stars = Math.min(3 - p.helped, p.starsOf(p.stage(z).goal)), was = prefs.pz.stars[z.id] || 0, opened = pzList().filter(q => pzOpen(q.stage)).length;
    prefs.pz.stars[z.id] = Math.max(was, stars); savePrefs();
    if (!was) net.claim('puzzle', { id: z.id, shot: puzzle.shot });     // (paid once, by the server, after it plays the shot again)
    const now = pzList().filter(q => pzOpen(q.stage)).length, all = pzList().every(q => prefs.pz.stars[q.id]);
    toast(all && !was ? '정답! 퍼즐을 모두 풀었습니다.' : now > opened ? '정답! 다음 스테이지가 열렸습니다.' : '정답! ' + '★'.repeat(stars), 'good', 2000); SND.good();
    hold(1.9, () => p.step(1));
  },
  hud() {
    const p = puzzle, z = p.cur, n = prefs.pz.stars[z.id] || 0;
    paintPill(0, { name: `${z.stage + 1}-${z.n} ${p.stage(z).name}`, on: true, sub: n ? '★'.repeat(n) + '☆'.repeat(3 - n) : p.tries ? `${p.tries + 1}번째 시도` : '☆☆☆', tray: [], pts: null });
    paintBadge('4구 퍼즐', { text: game.MODES.puzzle4.GOALS[p.stage(z).goal].text }); setBusy();
  },
  // where the cue ball of the stored answer touches a cushion or a ball, in order, up to the second red
  marks(z) {
    const P = game.P, t = P.clone(game.world), out = []; t.snd = []; P.strike(t, z.sol[0], z.sol[1], z.sol[2], z.sol[3], z.sol[4]);
    for (let i = 0; i < 120 * 25 && !P.rest(t) && out.length < 9; i++) {
      P.step(t, TICK);
      for (const e of t.snd) { if (e.t === 'rail' && e.id === 0) out.push({ x: e.x, y: e.y }); else if (e.t === 'ball' && (e.ia === 0 || e.ib === 0)) out.push({ x: e.x, y: e.y }); }
      t.snd.length = 0; if (t.ev.hits.includes(2) && t.ev.hits.includes(3)) break;
    }
    return out;
  },
  bar() {
    const p = puzzle, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn) => box.appendChild(el('button', { class: 'btn', text, onclick: () => { SND.tap(); fn(); } }));
    const aiming = fn => () => { if (flow === puzzle && st.phase === 'aim') fn(); };
    // a hint marks every place the cue ball touches on the way, numbered; the answer is played out in full
    btn('힌트', aiming(() => { const z = p.cur; p.helped = Math.max(+p.helped, 1); scene.setMarks(p.marks(z)); const k = z.sol[4] ? ` 큐를 ${Math.round(z.sol[4] * 180 / Math.PI)}° 세워 칩니다.` : z.sol[3] > 0 ? ' 밀어치기입니다.' : z.sol[3] < 0 ? ' 끌어치기입니다.' : ''; toast('힌트: 흰 공이 번호 순서대로 닿습니다.' + k, '', 3600); }));
    btn('정답', aiming(() => { const z = p.cur; p.helped = 2; scene.setMarks(null); toast('정답: 이렇게 치면 됩니다.', '', 2200); playDemo({ angle: z.sol[0], power: game.powerOf(z.sol[1]), a: z.sol[2], b: z.sol[3], el: z.sol[4] }, { quiet: false, after: p.again }); }));
    btn('이전', aiming(() => p.step(-1)));
    btn('다음', aiming(() => p.step(1)));
  },
};
