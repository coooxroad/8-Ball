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
    dkPut(head, dkTitle('퍼즐'));
    dkPut(slate, [...dkH1('퍼즐'), dkHr(), dkTxt('등록된 퍼즐이 없습니다')]);   // (copy audit 03-09: said once)
    return;
  }
  const z = prefs.pz, L = puzzles.list.filter(q => pzOpen(q.stage)), cur = puzzles.byId(z.cur) || puzzles.list[0], S = puzzles.STAGES[cur.stage];
  const go = dir => () => { const i = Math.max(0, L.indexOf(cur)), q = L[(i + dir + L.length) % L.length]; z.cur = q.id; z.open = q.stage; repaintLive(); };
  const solved = qs => qs.filter(q => z.stars[q.id]).length, here = puzzles.of(cur.stage);
  dkNavHead(head, '문제', `${cur.stage + 1}-${cur.n}  ${S.name}`, '', go);   // (copy audit 03-07: its number and name here, once)
  dkPut(foot, puzzles.STAGES.map((s, si) => {
    const qs = puzzles.of(si), open = pzOpen(si);
    const enter = () => {
      if (!open) return toast(`앞 단계에서 ${PZ_NEED}문제 풀기`, '', 2200);
      const q = qs.find(x => !z.stars[x.id]) || qs[0]; z.cur = q.id; z.open = si; repaintLive();
    };
    return el('button', { class: 'dk-pill' + (open ? '' : ' lock'), 'aria-pressed': String(si === cur.stage), onclick: onTap(enter) },
      [document.createTextNode(`${si + 1}단계`), open ? el('small', { text: `${solved(qs)}/${qs.length}` }) : el('img', { class: 'lock', src: 'ui/lock.webp', alt: '잠김' })]);
  }));
  // (the stage being played in view in the row of stages, which scrolls sideways on a narrow screen)
  requestAnimationFrame(() => { const on = foot.querySelector('.dk-pill[aria-pressed="true"]'); if (on && foot.scrollWidth > foot.clientWidth) foot.scrollLeft = Math.max(0, on.offsetLeft - (foot.clientWidth - on.offsetWidth) / 2); });
  const stars = z.stars[cur.id] || 0;
  const starRow = el('div', { class: 'dk-stars', role: 'img', 'aria-label': `별 3개 중 ${stars}개` },
    [0, 1, 2].map(k => el('img', { src: k < stars ? 'ui/star.webp' : 'ui/star-off.webp', alt: '' })));
  // (copy audit 03-07, 03-08: the goal, the stars, how far this stage is; the key just 시작)
  dkPut(slate, [dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + ' · 노란 공 접촉 금지'), dkHr(), starRow, dkTxt(`${cur.stage + 1}단계 ${solved(here)} / ${here.length}`)]);
  dkPut(slate, dkActs(dkMain('시작', null, () => puzzle.start())));
}
// The lessons as volumes and books: four game volumes on the shelf (3구, 4구, 8볼, 9볼); opening one shows its textbooks,
// one a lesson, coloured by its course, with an X back to the volumes; tapping a book starts that lesson.
let lessonVol = null;
const VOLUMES = [['three', '3구'], ['four', '4구'], ['eight', '8볼'], ['nine', '9볼']];
const BOOK_LEATHER = ['navy', 'burgundy', 'green', 'brown'];          // a lesson book's leather by its course (drills.COURSES; ui/book-*.webp)
const volLessons = v => drills.list.filter(d => d.make && d.vol === v).map(d => d.id);
// a volume's prize for doing all of it (economy.js LESSON_PRIZE): a line saying what, and how far along (a lesson counts once
// it is done at its top level with the shot kept: 51-practice.js)
function prizeLine(v) {
  const p = ECONOMY.LESSON_PRIZE[v]; if (!p) return null;
  const ids = volLessons(v), got = net.me && (net.me.prizes || []).includes(v), n = ids.filter(id => prefs.lessonProof[id]).length, what = itemName({ kind: p.kind, id: p.id });
  // (copy audit 03-06: 완료 보상, what it is, how far along; 받음 once it is had)
  return el('div', { class: 'dk-prize' + (got ? ' got' : '') }, [el('i', { class: 'pz' }), el('span', null, [el('b', { text: '완료 보상' }),
    el('small', { text: `${p.coin.toLocaleString('ko-KR')} 코인 + ${what}${ids.length ? ` · ${n} / ${ids.length}` : ''}` })]), got ? el('em', { class: 'got-tag', text: '받음' }) : null]);
}
function deskLesson({ head, stage, slate }) {
  const top = drills.LEVELS; stage.dataset.win = '0';
  const doneOf = ids => ids.filter(id => levelOf(id) >= top).length;
  if (lessonVol == null) {
    dkPut(head, dkTitle('레슨'));
    dkPut(stage, el('div', { class: 'dk-cards vols' }, VOLUMES.map(([v, name], i) => { const ids = volLessons(v);
      return el('button', { class: 'dk-card vol' + (ids.length ? '' : ' empty'), 'aria-label': name + ' 레슨', onclick: onTap(() => { lessonVol = v; paintHome(); }) }, [
        el('i', { class: 'tome', style: `background-image:url(ui/vol-${v}.webp)` }, el('span', { class: 'tt' }, [el('b', { text: name })])),
        // (copy audit 03-02: the progress once - books brought to the top level, which is all that is known)
        el('span', { class: 'nm', text: ids.length ? `${doneOf(ids)}/${ids.length}` : '준비 중' }), ECONOMY.LESSON_PRIZE[v] ? el('span', { class: 'prize-tag', text: '보상' }) : null]); })));
    dkPut(slate, dkH1('레슨'));
    const cur = LESSONS().includes(prefs.drill) ? prefs.drill : LESSONS()[0];
    dkPut(slate, dkActs(cur ? dkMain('이어서 하기', drills.byId(cur).name, () => practice.start(cur)) : null,
      // (58-tutorial.js: the first shot, step by step - its prize once per account)
      dkSec('튜토리얼', () => tutorial.start(), prefs.tutDone ? '완료' : `보상 코인 ${ECONOMY.TUTORIAL_PRIZE.coin} + ${itemName({ kind: 'cue', id: ECONOMY.TUTORIAL_PRIZE.id })}`)));
    return;
  }
  const vol = VOLUMES.find(x => x[0] === lessonVol), ids = volLessons(lessonVol), cur = ids.includes(prefs.drill) ? prefs.drill : ids[0];
  head.className = 'dk-head open';
  dkPut(head, [el('button', { class: 'dk-x', 'aria-label': '레슨 목록으로', onclick: () => { SND.tap(); lessonVol = null; paintHome(); } }, el('i')), dkTitle(`${vol[1]} 레슨`, ids.length ? `완료 ${doneOf(ids)} / ${ids.length}` : '준비 중')]);
  if (!ids.length) {
    // (copy audit 03-04: one line, and the way back)
    dkPut(stage, el('div', { class: 'msg' }, [el('b', { text: '아직 등록된 레슨이 없습니다' })]));
    dkPut(slate, dkH1(`${vol[1]}`)); dkPut(slate, [dkHr(), prizeLine(lessonVol)]);
    dkPut(slate, dkActs(dkSec('레슨 목록', () => { lessonVol = null; paintHome(); })));
    return;
  }
  const books = drills.COURSES.flatMap((course, ci) => ids.filter(id => drills.byId(id).course === course).map(id => [course, ci, id]));
  dkPut(stage, el('div', { class: 'dk-cards books' }, books.map(([course, ci, id], i) => {
    const dr = drills.byId(id), lv = levelOf(id);
    return el('button', { class: 'dk-card book' + (id === cur ? ' last' : '') + (lv >= top ? ' done' : ''), 'aria-label': dr.name, onclick: onTap(() => { prefs.lastTrain = 'practice'; prefs.mode = 'practice'; practice.start(id); }) }, [
      // (copy audit 03-05: the course named once, on the first book of it; no running number)
      el('i', { class: 'cover', style: `background-image:${lv >= top ? 'url(ui/book-gilt.webp),' : ''}url(ui/book-${BOOK_LEATHER[ci] || 'brown'}.webp)` }, el('span', { class: 'tt' }, [i && books[i - 1][0] === course ? null : el('small', { text: course }), el('b', { text: dr.name })])),
      el('span', { class: 'lvl' }, Array.from({ length: top }, (_, k) => el('i', { class: k < lv ? 'on' : '' })))]);
  })));
  const dr = drills.byId(cur);
  // (copy audit 03-03, 03-05: the covers and the gilt say how to use them and what is done)
  dkPut(slate, dkH1(vol[1]));
  dkPut(slate, [dkHr(), prizeLine(lessonVol)]);
  dkPut(slate, dkActs(dkMain('이어서 하기', dr.name, () => practice.start(cur))));
}
function deskFree({ head, slate }) {
  // (copy audit 03-11: moving balls and undoing are told when they are used)
  dkPut(head, dkTitle('자유 연습'));
  dkPut(slate, [...dkH1('자유 연습')]);
  dkPut(slate, dkActs(dkMain('연습 시작', null, () => practice.start('free'))));
}
