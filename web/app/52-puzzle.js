/* ================= flow: puzzle (one position, one shot to score with; solve it and the next one comes) ================= */
const puzzle = {
  quiet: false, save: false, cur: null, helped: false, tries: 0,
  stage: z => puzzles.STAGES[z.stage],
  // the balls of a puzzle, onto the table
  put(z) {
    const P = game.P, w = game.world, n = Math.hypot(z.balls[2][0] - z.balls[0][0], z.balls[2][1] - z.balls[0][1]) <= Math.hypot(z.balls[3][0] - z.balls[0][0], z.balls[3][1] - z.balls[0][1]) ? 2 : 3;
    z.balls.forEach((b, i) => P.place(w, i, b[0], b[1], Math.random));
    w.cue = 0; game.goal = puzzle.stage(z).goal;
    scene.clearFalls(); scene.setZone(null); scene.setMarks(null); st.aim = Math.atan2(z.balls[n][1] - z.balls[0][1], z.balls[n][0] - z.balls[0][0]); st.rev++; scene.invalidate();
  },
  start(id) {
    const z = puzzles.byId(id || prefs.pz.cur) || puzzles.list[0], p = puzzle;
    if (!p.cur || p.cur.id !== z.id) { p.helped = false; p.tries = 0; }
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
  guide: () => prefs.guides[0],
  auto: () => null,
  beforeShot() { scene.setMarks(null); },
  afterShot() {
    const p = puzzle, z = p.cur, r = game.resolve().r;
    if (!r.solved) { p.tries++; toast('다시 · ' + r.note, 'foul', 1900); SND.bad(); return hold(1.6, p.again); }
    // three stars for the first try, two within three, one after that or with help
    const stars = p.helped ? 1 : p.tries === 0 ? 3 : p.tries <= 2 ? 2 : 1, was = prefs.pz.stars[z.id] || 0, opened = pzList().filter(q => pzOpen(q.stage)).length;
    prefs.pz.stars[z.id] = Math.max(was, stars); savePrefs();
    const now = pzList().filter(q => pzOpen(q.stage)).length, all = pzList().every(q => prefs.pz.stars[q.id]);
    toast(all && !was ? '정답! 퍼즐을 모두 풀었습니다.' : now > opened ? '정답! 다음 스테이지가 열렸습니다.' : '정답! ' + '★'.repeat(stars), 'good', 2000); SND.good();
    hold(1.9, () => p.step(1));
  },
  hud() {
    const p = puzzle, z = p.cur, n = prefs.pz.stars[z.id] || 0;
    paintPill(0, { name: `${z.stage + 1}-${z.n} ${p.stage(z).name}`, on: true, sub: n ? '★'.repeat(n) + '☆'.repeat(3 - n) : p.tries ? `${p.tries + 1}번째 시도` : '첫 시도에 풀면 ★★★', tray: [], pts: null });
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
    btn('힌트', aiming(() => { const z = p.cur; p.helped = true; scene.setMarks(p.marks(z)); const k = z.sol[4] ? ` 큐를 ${Math.round(z.sol[4] * 180 / Math.PI)}° 세워 칩니다.` : z.sol[3] > 0 ? ' 밀어치기입니다.' : z.sol[3] < 0 ? ' 끌어치기입니다.' : ''; toast('힌트: 흰 공이 번호 순서대로 닿습니다.' + k, '', 3600); }));
    btn('정답', aiming(() => { const z = p.cur; p.helped = true; scene.setMarks(null); toast('정답: 이렇게 치면 됩니다.', '', 2200); playDemo({ angle: z.sol[0], power: game.powerOf(z.sol[1]), a: z.sol[2], b: z.sol[3], el: z.sol[4] }, { quiet: false, after: p.again }); }));
    btn('이전', aiming(() => p.step(-1)));
    btn('다음', aiming(() => p.step(1)));
  },
};
