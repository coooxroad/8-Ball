/* 훈련: 레슨, 퍼즐, 자유 연습 and 컴퓨터 대전, each a card of the menu's (37-desk-menu.js trainGo) and each laid out as
   친구와 플레이's 한 기기에서 is (owner 11-16): the rail the games - 3구, 4구, 8볼, 9볼, 스누커 - under the way back to the
   menu; the tray what is played (레슨 its books, 퍼즐 the puzzle on the table and its topics along the foot, 자유 연습 and
   컴퓨터 대전 the table); the slate the rest (퍼즐 the topic's road of stages, 컴퓨터 대전 its bots: 34-desk-bots.js).
   A game a place has nothing of yet is on the rail all the same, dimmed (준비 중). */
const TRAIN_KO = { lesson: '레슨', puzzle: '퍼즐', free: '자유 연습', cpu: '컴퓨터 대전' };
const volLessons = v => drills.list.filter(d => d.make && d.vol === v).map(d => d.id);
// what each place has for a game (the rest are 준비 중), and the game it is on
const TRAIN_HAS = { lesson: id => volLessons(id).length > 0, puzzle: id => id === 'four' && puzzles.list.length > 0, free: () => true, cpu: id => GAME4.includes(id) };
function trainGameOf(t) {
  const G = prefs.trainGame || {};
  if (t === 'lesson') return FRIEND_GAMES.includes(G.lesson) && TRAIN_HAS.lesson(G.lesson) ? G.lesson : 'eight';
  if (t === 'puzzle') return 'four';
  if (t === 'free') return freeGame();
  return GAME4.includes(prefs.mode) ? prefs.mode : 'eight';
}
function deskTrain(d) {
  const t = trainOf() || 'puzzle', on = trainGameOf(t);
  const pick = id => () => {
    if (!TRAIN_HAS[t](id)) return toast(`${MODE_KO[id]} ${TRAIN_KO[t]}은 준비 중입니다.`, '', 2000);
    if (id === on) return;
    if (t === 'cpu') { prefs.mode = prefs.cpuMode = id; }
    else prefs.trainGame = Object.assign({}, prefs.trainGame, { [t]: id });
    savePrefs(); repaintLive();
  };
  dkPut(d.rail, FRIEND_GAMES.map(id => railBtn(id === on, MODE_KO[id], null, pick(id), !TRAIN_HAS[t](id), 'mode-' + id)));
  if (t === 'puzzle') deskPuzzle(d); else if (t === 'lesson') deskLesson(d, on); else if (t === 'cpu') deskMatch(d, true, trainBack()); else deskFree(d, on);
  // (with the old menu - a screen held upright, or 디버그 - 훈련 is one tab: its four places picked at the slate's top)
  if (!menuOn()) d.slate.insertBefore(dkSeg(Object.entries(TRAIN_KO).map(([k, n]) => [k, k === 'cpu' ? '컴퓨터' : n]), t, k => { if (k !== t) { trainGo(k); repaintLive(); } }), d.slate.firstChild);
}
// the way back to the menu: an X at the tray's head, as 친구와 플레이's (none with the old menu, whose tabs are the way)
const trainBack = () => menuOn() ? () => deskGo('play') : null;
function trainHead(head, title, sub) {
  const back = trainBack();
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '메뉴로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(title, sub));
}
/* 퍼즐: the puzzle in hand on the table, the head stepping through the open ones; the foot its topics (puzzles.js STAGES)
   as holograms across the tray, each by its name; the slate the topic's road - its stages in order, each opening when the
   one before it is solved, every tenth a 챌린지 (a shot a real player made; diamonds the first time: puzzles.js challenge). */
function deskPuzzle(d) {
  const { head, foot, slate } = d;
  // (the puzzles are being made again on the game's physics: until then the place is kept, empty)
  if (!puzzles.list.length) {
    trainHead(head, '퍼즐');
    dkPut(slate, [...dkH1('퍼즐'), dkHr(), dkTxt('등록된 퍼즐이 없습니다')]);   // (copy audit 03-09: said once)
    return;
  }
  const z = prefs.pz, L = puzzles.list.filter(pzOpenQ), cur0 = puzzles.byId(z.cur) || puzzles.list[0], cur = pzOpenQ(cur0) ? cur0 : L.find(q => q.stage === cur0.stage) || L[0], S = puzzles.STAGES[cur.stage];
  const solved = qs => qs.filter(q => z.stars[q.id]).length, here = puzzles.of(cur.stage);
  // (the stage in hand by its topic and its place on the road - the road on the slate picks it)
  trainHead(head, pzName(cur), S.desc);
  foot.classList.add('holo');
  dkPut(foot, puzzles.STAGES.map((s, si) => {
    const qs = puzzles.of(si), open = pzOpen(si);
    const enter = () => {
      if (!open) return toast(`'${puzzles.STAGES[si - 1].name}'에서 ${PZ_NEED}문제를 풀면 열립니다`, '', 2200);
      const q = qs.find(x => !z.stars[x.id] && pzOpenQ(x)) || qs[0]; z.cur = q.id; z.open = si; repaintLive();
    };
    return el('button', { class: 'dk-holo' + (open ? '' : ' lock'), 'aria-pressed': String(si === cur.stage), 'aria-label': s.name + (open ? '' : ', 잠김'), onclick: onTap(enter) },
      [el('b', { text: s.name.replace(' · ', '·\n') }), open ? el('small', { text: `${solved(qs)}/${qs.length}` }) : el('img', { class: 'lock', src: 'ui/lock.webp', alt: '' })]);
  }));
  // (copy audit 03-07: the goal once; the road says how far this topic is)
  dkPut(slate, [dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + ' · 노란 공 접촉 금지'), dkHr(), ...pzRoad(here, cur, solved(here))]);
  dkPut(slate, dkActs(dkMain(puzzles.challenge(cur) ? '챌린지 시작' : '시작', null, () => puzzle.start(cur.id))));
}
/* A topic's road: its stages winding down the slate three to a row, each its number (and its stars once solved), the one in
   hand ringed, those not open yet locked; a 챌린지 a cut stone, alone and in the middle when it ends a row of its own. */
function pzRoad(qs, cur, done) {
  // (three to a row; five on a short screen, where the slate has little height)
  const z = prefs.pz, W = 300, short = app.classList.contains('compact') && !app.classList.contains('portrait'), per = short ? 5 : 3, row = short ? 62 : 74, gap = (W - 60) / (per - 1), n = qs.length, rows = Math.ceil(n / per);
  const at = k => { const r = Math.floor(k / per), c = k % per, alone = r === rows - 1 && n - r * per === 1; return [alone ? W / 2 : 30 + (r % 2 ? per - 1 - c : c) * gap, 36 + r * row]; };
  const pts = qs.map((_, k) => at(k)), H = 36 + (rows - 1) * row + 44, reached = qs.filter(pzOpenQ).length;
  const line = P => P.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="rd-all" d="${line(pts)}"/><path class="rd-on" d="${line(pts.slice(0, Math.max(1, reached)))}"/></svg>`;
  const box = el('div', { class: 'pz-road', style: `aspect-ratio:${W}/${H}` }); box.innerHTML = svg;
  qs.forEach((q, k) => {
    const open = pzOpenQ(q), stars = z.stars[q.id] || 0, ch = puzzles.challenge(q), [x, y] = pts[k];
    const pick = () => { if (!open) return toast(ch ? '앞 스테이지를 모두 풀면 챌린지가 열립니다' : '앞 스테이지를 풀면 열립니다', '', 1800); z.cur = q.id; z.open = q.stage; repaintLive(); };
    box.appendChild(el('button', { class: 'rd-node' + (ch ? ' ch' : '') + (open ? '' : ' lock') + (stars ? ' done' : ''), 'aria-pressed': String(q === cur),
      'aria-label': `${ch ? '챌린지' : q.n + '번'}${stars ? `, 별 ${stars}개` : open ? '' : ', 잠김'}`, style: `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`, onclick: onTap(pick) }, [
      ch ? el('i', { class: 'gem' }) : el('b', { text: String(q.n) }),
      stars ? el('span', { class: 'st' }, [0, 1, 2].map(i => el('i', { class: i < stars ? 'on' : '' }))) : null,
      ch ? el('em', { text: stars ? '챌린지' : `챌린지 · 다이아 ${ECONOMY.PUZZLE_CHALLENGE_DIA}` }) : null]));
  });
  return [el('div', { class: 'pz-road-h' }, [el('b', { text: puzzles.STAGES[cur.stage].name }), el('small', { text: `${done} / ${qs.length}` })]), box];
}
// 레슨: the books of the game's volume in the tray, coloured by course, a lesson each; tapping one starts it
const BOOK_LEATHER = ['navy', 'burgundy', 'green', 'brown'];          // a lesson book's leather by its course (drills.COURSES; ui/book-*.webp)
// a volume's prize for doing all of it (economy.js LESSON_PRIZE): a line saying what, and how far along (a lesson counts once
// it is done at its top level with the shot kept: 51-practice.js)
function prizeLine(v) {
  const p = ECONOMY.LESSON_PRIZE[v]; if (!p) return null;
  const ids = volLessons(v), got = net.me && (net.me.prizes || []).includes(v), n = ids.filter(id => prefs.lessonProof[id]).length, what = itemName({ kind: p.kind, id: p.id });
  // (copy audit 03-06: 완료 보상, what it is, how far along; 받음 once it is had)
  return el('div', { class: 'dk-prize' + (got ? ' got' : '') }, [el('i', { class: 'pz' }), el('span', null, [el('b', { text: '완료 보상' }),
    el('small', { text: `${p.coin.toLocaleString('ko-KR')} 코인 + ${what}${ids.length ? ` · ${n} / ${ids.length}` : ''}` })]), got ? el('em', { class: 'got-tag', text: '받음' }) : null]);
}
function deskLesson({ head, stage, slate }, v) {
  const top = drills.LEVELS; stage.dataset.win = '0';
  const ids = volLessons(v), cur = ids.includes(prefs.drill) ? prefs.drill : ids[0], done = ids.filter(id => levelOf(id) >= top).length;
  trainHead(head, `${MODE_KO[v]} 레슨`, ids.length ? `완료 ${done} / ${ids.length}` : '');
  const books = drills.COURSES.flatMap((course, ci) => ids.filter(id => drills.byId(id).course === course).map(id => [course, ci, id]));
  dkPut(stage, el('div', { class: 'dk-cards books' }, books.map(([course, ci, id], i) => {
    const dr = drills.byId(id), lv = levelOf(id);
    return el('button', { class: 'dk-card book' + (id === cur ? ' last' : '') + (lv >= top ? ' done' : ''), 'aria-label': dr.name, onclick: onTap(() => { prefs.lastTrain = 'practice'; prefs.mode = 'practice'; practice.start(id); }) }, [
      // (copy audit 03-05: the course named once, on the first book of it; no running number)
      el('i', { class: 'cover', style: `background-image:${lv >= top ? 'url(ui/book-gilt.webp),' : ''}url(ui/book-${BOOK_LEATHER[ci] || 'brown'}.webp)` }, el('span', { class: 'tt' }, [i && books[i - 1][0] === course ? null : el('small', { text: course }), el('b', { text: dr.name })])),
      el('span', { class: 'lvl' }, Array.from({ length: top }, (_, k) => el('i', { class: k < lv ? 'on' : '' })))]);
  })));
  // (copy audit 03-03, 03-05: the covers and the gilt say how to use them and what is done)
  dkPut(slate, dkH1(MODE_KO[v]));
  dkPut(slate, [dkHr(), prizeLine(v)]);
  dkPut(slate, dkActs(cur ? dkMain('이어서 하기', drills.byId(cur).name, () => practice.start(cur)) : null,
    // (58-tutorial.js: the first shot, step by step - its prize once per account)
    dkSec('튜토리얼', () => tutorial.start(), prefs.tutDone ? '완료' : `보상 코인 ${ECONOMY.TUTORIAL_PRIZE.coin} + ${itemName({ kind: 'cue', id: ECONOMY.TUTORIAL_PRIZE.id })}`)));
}
// 자유 연습: the game's table in the tray, racked as the game begins
function deskFree({ head, slate }, v) {
  // (copy audit 03-11: moving balls and undoing are told when they are used)
  trainHead(head, `${MODE_KO[v]} 자유 연습`);
  // (a partner for it, one of 컴퓨터 대전's bots - 34-desk-bots.js: in the practice its key 시범 has it play a shot from the
  // table as it lies; owner 11-16 asked the bots be picked here as in 컴퓨터 대전, what more they do here is to come)
  dkPut(slate, [dkLab('연습 상대'), ...botPicker()]);
  dkPut(slate, dkActs(dkMain('연습 시작', null, () => practice.start('free'))));
}
