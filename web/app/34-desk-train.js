// 훈련: lessons, puzzles and free practice on the rail, each with its own tray and slate
function deskTrain(d) {
  const t = trainOf() || 'puzzle';
  const to = (mode, drill) => () => { prefs.lastTrain = mode; if (drill) drill(); prefs.mode = mode; repaintLive(); };
  const cpu = () => { prefs.lastTrain = 'cpu'; prefs.trainCpu = true; prefs.vsAI = true; prefs.mode = GAME4.includes(prefs.cpuMode) ? prefs.cpuMode : 'eight'; repaintLive(); };
  const off = () => { prefs.trainCpu = false; prefs.vsAI = false; };
  dkPut(d.rail, [railBtn(t === 'lesson', '레슨', null, to('practice', () => { off(); prefs.lessons = true; })),
    railBtn(t === 'puzzle', '퍼즐', null, to('puzzle', off)),
    railBtn(t === 'free', '자유 연습', null, to('practice', () => { off(); prefs.lessons = false; })),
    railBtn(t === 'cpu', '컴퓨터 대전', null, cpu)]);
  if (t === 'puzzle') deskPuzzle(d); else if (t === 'lesson') deskLesson(d); else if (t === 'cpu') deskMatch(d, true); else deskFree(d);
}
// the puzzle in hand: the head steps through the open puzzles, the foot's pills jump to a stage
function deskPuzzle(d) {
  const { head, foot, slate } = d;
  // (the puzzles are being made again on the game's physics: until then the place is kept, empty)
  if (!puzzles.list.length) {
    dkPut(head, dkTitle('퍼즐', '새로 만드는 중'));
    dkPut(slate, dkH1('퍼즐', '새로 만드는 중'));
    dkPut(slate, [dkHr(), dkTxt('지금 물리에 맞춰 퍼즐을 새로 만들고 있습니다. 단계는 그대로 ' + puzzles.STAGES.length + '단계입니다.')]);
    dkPut(slate, dkActs(dkMain('준비 중', null, () => {}, true)));
    return;
  }
  const z = prefs.pz, L = puzzles.list.filter(q => pzOpen(q.stage)), cur = puzzles.byId(z.cur) || puzzles.list[0], S = puzzles.STAGES[cur.stage];
  const go = dir => () => { const i = Math.max(0, L.indexOf(cur)), q = L[(i + dir + L.length) % L.length]; z.cur = q.id; z.open = q.stage; repaintLive(); };
  const solved = qs => qs.filter(q => z.stars[q.id]).length, here = puzzles.of(cur.stage);
  dkNavHead(head, '문제', `${cur.stage + 1}-${cur.n}  ${S.name}`, `${solved(here)} / ${here.length} 풀이`, go);
  dkPut(foot, puzzles.STAGES.map((s, si) => {
    const qs = puzzles.of(si), open = pzOpen(si);
    const enter = () => {
      if (!open) return toast(`앞 스테이지에서 ${PZ_NEED}문제를 풀면 열립니다.`, '', 2200);
      const q = qs.find(x => !z.stars[x.id]) || qs[0]; z.cur = q.id; z.open = si; repaintLive();
    };
    return el('button', { class: 'dk-pill' + (open ? '' : ' lock'), 'aria-pressed': String(si === cur.stage), onclick: onTap(enter) },
      [document.createTextNode(`${si + 1}단계`), open ? el('small', { text: `${solved(qs)}/${qs.length}` }) : el('img', { class: 'lock', src: 'ui/lock.webp', alt: '잠김' })]);
  }));
  const stars = z.stars[cur.id] || 0, said = stars ? '받음' : '아직 안 풂';
  const starRow = el('div', { class: 'dk-stars', 'aria-label': stars ? `별 ${stars}개 받음` : said },
    [0, 1, 2].map(k => el('img', { src: k < stars ? 'ui/star.webp' : 'ui/star-off.webp', alt: '' })).concat(el('span', { text: said })));
  dkPut(slate, dkH1(S.name, `${cur.stage + 1}-${cur.n}번 문제`));
  dkPut(slate, [dkHr(), dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + '. 노란 공은 건드리면 안 됩니다.'), dkHr(), dkLab('이 문제'), starRow, dkHr(), guideRow()]);
  dkPut(slate, dkActs(dkMain('퍼즐 풀기', `${cur.stage + 1}-${cur.n} ${S.name}`, () => puzzle.start())));
}
// The lessons as volumes and books: four game volumes on the shelf (3구, 4구, 8볼, 9볼); opening one shows its textbooks,
// one a lesson, coloured by its course, with an X back to the volumes; tapping a book starts that lesson.
let lessonVol = null;
const VOLUMES = [['three', '3구'], ['four', '4구'], ['eight', '8볼'], ['nine', '9볼']];
const BOOK_LEATHER = ['navy', 'burgundy', 'green', 'brown'];          // a lesson book's leather by its course (drills.COURSES; ui/book-*.webp)
const volLessons = v => drills.list.filter(d => d.make && d.vol === v).map(d => d.id);
function deskLesson({ head, stage, slate }) {
  const top = drills.LEVELS; stage.dataset.win = '0';
  const doneOf = ids => ids.filter(id => levelOf(id) >= top).length;
  if (lessonVol == null) {
    dkPut(head, dkTitle('교본', '종목을 고르세요'));
    dkPut(stage, el('div', { class: 'dk-cards vols' }, VOLUMES.map(([v, name], i) => { const ids = volLessons(v);
      return el('button', { class: 'dk-card vol' + (ids.length ? '' : ' empty'), 'aria-label': name + ' 교본', onclick: onTap(() => { lessonVol = v; paintHome(); }) }, [
        el('i', { class: 'tome', style: `background-image:url(ui/vol-${v}.webp)` }, el('span', { class: 'tt' }, [el('b', { text: name }), el('small', { text: '교본' })])),
        el('span', { class: 'nm', text: ids.length ? `${ids.length}권 · 다 뗀 ${doneOf(ids)}권` : '준비 중' })]); })));
    dkPut(slate, dkH1('교본', '레슨'));
    dkPut(slate, [dkHr(), dkTxt('종목 교본을 펼치면 그 안에 레슨 교본이 있습니다. 교본을 누르면 그 레슨이 바로 시작됩니다.'), dkHr()]);
    for (const [v, name] of VOLUMES) { const ids = volLessons(v); dkPut(slate, el('div', { class: 'dk-spec' }, [el('span', { text: name }), el('b', { text: ids.length ? `${doneOf(ids)} / ${ids.length}권` : '준비 중' })])); }
    const cur = LESSONS().includes(prefs.drill) ? prefs.drill : LESSONS()[0];
    dkPut(slate, dkActs(cur ? dkMain('이어서 하기', `${drills.byId(cur).name} · ${levelOf(cur)}단계`, () => practice.start(cur)) : dkMain('준비 중', '레슨을 새로 만들고 있습니다', () => {}, true)));
    return;
  }
  const vol = VOLUMES.find(x => x[0] === lessonVol), ids = volLessons(lessonVol), cur = ids.includes(prefs.drill) ? prefs.drill : ids[0];
  head.className = 'dk-head open';
  dkPut(head, [el('button', { class: 'dk-x', 'aria-label': '종목 교본으로', onclick: () => { SND.tap(); lessonVol = null; paintHome(); } }, el('i')), dkTitle(`${vol[1]} 교본`, ids.length ? `${ids.length}권 · 다 뗀 교본 ${doneOf(ids)}권` : '준비 중')]);
  if (!ids.length) {
    dkPut(stage, el('div', { class: 'msg' }, [el('b', { text: `${vol[1]} 교본 준비 중` }), el('span', { text: '이 종목의 레슨을 만들고 있습니다.' })]));
    dkPut(slate, dkH1(`${vol[1]} 교본`, '준비 중')); dkPut(slate, [dkHr(), dkTxt('이 종목의 레슨을 만들고 있습니다.')]);
    dkPut(slate, dkActs(dkMain('준비 중', null, () => {}, true), dkSec('종목 교본으로', () => { lessonVol = null; paintHome(); })));
    return;
  }
  const books = drills.COURSES.flatMap((course, ci) => ids.filter(id => drills.byId(id).course === course).map(id => [course, ci, id]));
  dkPut(stage, el('div', { class: 'dk-cards books' }, books.map(([course, ci, id], i) => {
    const dr = drills.byId(id), lv = levelOf(id);
    return el('button', { class: 'dk-card book' + (id === cur ? ' last' : '') + (lv >= top ? ' done' : ''), 'aria-label': dr.name, onclick: onTap(() => { prefs.lastTrain = 'practice'; prefs.mode = 'practice'; practice.start(id); }) }, [
      el('i', { class: 'cover', style: `background-image:${lv >= top ? 'url(ui/book-gilt.webp),' : ''}url(ui/book-${BOOK_LEATHER[ci] || 'brown'}.webp)` }, el('span', { class: 'tt' }, [el('small', { text: course }), el('b', { text: dr.name }), el('em', { text: String(i + 1) })])),
      el('span', { class: 'lvl' }, Array.from({ length: top }, (_, k) => el('i', { class: k < lv ? 'on' : '' })))]);
  })));
  const dr = drills.byId(cur);
  dkPut(slate, dkH1(`${vol[1]} 교본`, '레슨'));
  dkPut(slate, [dkHr(), dkTxt('교본을 누르면 그 레슨이 바로 시작됩니다. 단계를 다 떼면 표지에 금박이 들어갑니다.'), dkHr()]);
  for (const course of drills.COURSES) { const l = ids.filter(id => drills.byId(id).course === course); if (!l.length) continue;
    dkPut(slate, el('div', { class: 'dk-spec' }, [el('span', { text: course }), el('b', { text: `${doneOf(l)} / ${l.length}권` })])); }
  dkPut(slate, [dkHr(), guideRow()]);
  dkPut(slate, dkActs(dkMain('이어서 하기', `${dr.name} · ${levelOf(cur)}단계`, () => practice.start(cur))));
}
function deskFree({ head, slate }) {
  const dr = drills.byId('free');
  dkPut(head, dkTitle('자유 연습', '혼자서 마음대로'));
  dkPut(slate, dkH1('자유 연습', '규칙 없음'));
  dkPut(slate, [dkHr(), dkTxt(dr.d), dkHr(), guideRow()]);
  dkPut(slate, dkActs(dkMain('연습 시작', null, () => practice.start('free'))));
}
